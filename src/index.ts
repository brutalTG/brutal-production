/**
 * BRUTAL — Production Server v2.0
 * Node.js + Hono + Supabase PostgreSQL
 * Adapted to actual DB schema (Mar 2026)
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, PANEL_PASSWORD, PORT
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

// ============================================================================
// INIT
// ============================================================================

const app = new Hono();

let _db = null;
function db() {
  if (!_db) {
    _db = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _db;
}

function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

// ============================================================================
// CORS
// ============================================================================

app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-Telegram-Init-Data", "X-Panel-Token"],
  maxAge: 86400,
}));

// ============================================================================
// TELEGRAM INIT DATA VALIDATION
// ============================================================================

function validateInitData(initData) {
  try {
    const token = botToken();
    if (!token) return null;
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    params.delete("hash");
    const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");
    const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
    const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    if (computedHash !== hash) return null;
    const authDate = parseInt(params.get("auth_date") || "0");
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return null;
    const userStr = params.get("user");
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

async function requireTelegram(c, next) {
  const initData = c.req.header("X-Telegram-Init-Data");
  if (!initData) return c.json({ error: "Missing Telegram initData" }, 401);
  const user = validateInitData(initData);
  if (!user) return c.json({ error: "Invalid Telegram initData" }, 401);
  c.set("tgUser", user);
  await next();
}

async function requirePanel(c, next) {
  const token = c.req.header("X-Panel-Token");
  const expected = process.env.PANEL_PASSWORD || "brutal-admin";
  if (token !== expected) return c.json({ error: "Unauthorized" }, 401);
  await next();
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Resolve node from Telegram user ID.
 * node_channels.channel = 'telegram', channel_identifier = TG user ID string
 */
async function resolveNode(telegramUserId) {
  const { data: ch } = await db()
    .from("node_channels")
    .select("node_id")
    .eq("channel", "telegram")
    .eq("channel_identifier", String(telegramUserId))
    .single();
  if (!ch) return null;

  const { data: node } = await db()
    .from("nodes")
    .select("node_id, status")
    .eq("node_id", ch.node_id)
    .single();
  if (!node) return null;
  return { node_id: node.node_id, status: node.status };
}

/**
 * Get anonymous_id from the anonymous_id_map table.
 * Creates one if missing.
 */
async function anonId(nodeId) {
  const { data } = await db()
    .from("anonymous_id_map")
    .select("anonymous_id")
    .eq("node_id", nodeId)
    .single();
  if (data) return data.anonymous_id;

  // Create new
  const newAnon = "anon_" + crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  const { data: created, error } = await db()
    .from("anonymous_id_map")
    .insert({ node_id: nodeId, anonymous_id: newAnon })
    .select("anonymous_id")
    .single();
  if (error) return null;
  return created.anonymous_id;
}

/**
 * Credit reward: update profiles + insert transaction.
 * profiles: cash_balance, cash_lifetime, tickets_current, tickets_lifetime
 * transactions: type, amount, source, source_id
 */
async function creditReward(nodeId, type, amount, source, sourceId) {
  // Get current balance
  const { data: profile } = await db()
    .from("profiles")
    .select("cash_balance, tickets_current")
    .eq("node_id", nodeId)
    .single();
  if (!profile) return false;

  if (type === "cash") {
    const newBal = (profile.cash_balance || 0) + amount;
    await db().from("profiles").update({
      cash_balance: newBal,
      cash_lifetime: db().rpc ? undefined : undefined, // handled below
    }).eq("node_id", nodeId);
    // Use raw update for incrementing lifetime
    await db().rpc("credit_reward_v2", {
      p_node_id: nodeId, p_type: type, p_amount: amount,
      p_source: source, p_source_id: sourceId || null
    }).catch(() => {
      // Fallback: manual update if RPC doesn't exist yet
    });
  } else if (type === "tickets") {
    await db().rpc("credit_reward_v2", {
      p_node_id: nodeId, p_type: type, p_amount: amount,
      p_source: source, p_source_id: sourceId || null
    }).catch(() => {});
  }

  // Always log transaction
  const balAfter = type === "cash"
    ? (profile.cash_balance || 0) + amount
    : (profile.tickets_current || 0) + amount;

  await db().from("transactions").insert({
    node_id: nodeId,
    type: type,
    amount: amount,
    source: source,
    source_id: sourceId || null,
    balance_after: balAfter,
    description: `${source}${sourceId ? ': ' + sourceId : ''}`,
  });
  return true;
}

// ============================================================================
// HEALTH
// ============================================================================

app.get("/health", (c) => c.json({ status: "ok", version: "2.0.0" }));

// ============================================================================
// GATE CHECK — D7
// ============================================================================

app.get("/gate", requireTelegram, async (c) => {
  const user = c.get("tgUser");
  const dropId = c.req.query("drop_id");

  const node = await resolveNode(user.id);
  if (!node) return c.json({ status: "unregistered" });
  if (node.status !== "active") return c.json({ status: "denied", reason: node.status });

  if (dropId) {
    const { data: done } = await db()
      .from("sessions")
      .select("session_id")
      .eq("node_id", node.node_id)
      .eq("drop_id", dropId)
      .eq("status", "completed")
      .single();
    if (done) return c.json({ status: "completed" });
  }

  return c.json({ status: "granted", node_id: node.node_id });
});

// ============================================================================
// DROPS
// ============================================================================

app.get("/active-drop", async (c) => {
  const { data } = await db()
    .from("drops")
    .select("*")
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .limit(1)
    .single();
  if (!data) return c.json({ error: "No active drop" }, 404);
  return c.json(data);
});

app.get("/drop/:id", async (c) => {
  const { data } = await db()
    .from("drops")
    .select("*")
    .eq("drop_id", c.req.param("id"))
    .single();
  if (!data) return c.json({ error: "Drop not found" }, 404);
  return c.json(data);
});

// Get drop questions in order
app.get("/drop/:id/questions", async (c) => {
  const dropId = c.req.param("id");
  const { data, error } = await db()
    .from("drop_questions")
    .select("position, reward_cash_override, reward_tickets_override, questions(*)")
    .eq("drop_id", dropId)
    .order("position", { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.put("/active-drop", requirePanel, async (c) => {
  const { drop_id } = await c.req.json();
  if (!drop_id) return c.json({ error: "drop_id required" }, 400);
  await db().from("drops").update({ status: "archived" }).eq("status", "active");
  const { data, error } = await db()
    .from("drops")
    .update({ status: "active", published_at: new Date().toISOString() })
    .eq("drop_id", drop_id)
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.delete("/active-drop", requirePanel, async (c) => {
  await db().from("drops").update({ status: "archived" }).eq("status", "active");
  return c.json({ ok: true });
});

// ============================================================================
// SESSIONS
// ============================================================================

app.post("/sessions/start", requireTelegram, async (c) => {
  const user = c.get("tgUser");
  const { drop_id } = await c.req.json();
  if (!drop_id) return c.json({ error: "drop_id required" }, 400);

  const node = await resolveNode(user.id);
  if (!node || node.status !== "active") return c.json({ error: "Not authorized" }, 403);

  // Check existing
  const { data: existing } = await db()
    .from("sessions")
    .select("session_id, current_position, status")
    .eq("node_id", node.node_id)
    .eq("drop_id", drop_id)
    .single();

  if (existing) {
    if (existing.status === "completed") return c.json({ error: "Already completed" }, 409);
    return c.json({ session_id: existing.session_id, resumed: true, current_index: existing.current_position || 0 });
  }

  const { data: session, error } = await db()
    .from("sessions")
    .insert({
      node_id: node.node_id,
      drop_id,
      status: "active",
      current_position: 0,
      started_at: new Date().toISOString(),
      total_cash_earned: 0,
      total_tickets_earned: 0,
      trap_score: 0,
      traps_passed: 0,
      traps_failed: 0,
      multiplier: 1,
    })
    .select("session_id")
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ session_id: session.session_id, resumed: false, current_index: 0 });
});

app.post("/sessions/complete", requireTelegram, async (c) => {
  const user = c.get("tgUser");
  const { session_id, archetype_result, bic_scores } = await c.req.json();
  if (!session_id) return c.json({ error: "session_id required" }, 400);

  const node = await resolveNode(user.id);
  if (!node) return c.json({ error: "Not authorized" }, 403);

  // Sum rewards from responses
  const { data: rewards } = await db()
    .from("responses")
    .select("reward_type, reward_value, reward_granted")
    .eq("session_id", session_id);

  const totalCash = rewards?.filter(r => r.reward_type === "cash" && r.reward_granted)
    .reduce((s, r) => s + (r.reward_value || 0), 0) || 0;
  const totalTickets = rewards?.filter(r => r.reward_type === "tickets" && r.reward_granted)
    .reduce((s, r) => s + (r.reward_value || 0), 0) || 0;

  // Count traps
  const { data: traps } = await db()
    .from("responses")
    .select("question_type, raw_response")
    .eq("session_id", session_id)
    .in("question_type", ["trap", "trap_silent"]);

  const trapsPassed = traps?.filter(t => t.raw_response?.correct === true).length || 0;
  const trapsFailed = (traps?.length || 0) - trapsPassed;

  // Calculate avg latency
  const { data: latencies } = await db()
    .from("responses")
    .select("latency_ms")
    .eq("session_id", session_id)
    .not("latency_ms", "is", null);

  const avgLatency = latencies?.length
    ? Math.round(latencies.reduce((s, r) => s + r.latency_ms, 0) / latencies.length)
    : null;

  const { error } = await db()
    .from("sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      total_cash_earned: totalCash,
      total_tickets_earned: totalTickets,
      trap_score: trapsPassed,
      traps_passed: trapsPassed,
      traps_failed: trapsFailed,
      avg_latency_ms: avgLatency,
      archetype_result: archetype_result || null,
      bic_scores: bic_scores || null,
    })
    .eq("session_id", session_id)
    .eq("node_id", node.node_id);

  if (error) return c.json({ error: error.message }, 500);

  // Increment drops completed on profile
  await db().from("profiles")
    .update({ drops_completed: db().rpc ? undefined : undefined })
    .eq("node_id", node.node_id);
  // Direct increment
  const { data: prof } = await db().from("profiles").select("drops_completed").eq("node_id", node.node_id).single();
  if (prof) {
    await db().from("profiles").update({
      drops_completed: (prof.drops_completed || 0) + 1,
      last_drop_at: new Date().toISOString(),
    }).eq("node_id", node.node_id);
  }

  return c.json({
    ok: true, total_cash: totalCash, total_tickets: totalTickets,
    trap_score: `${trapsPassed}/${traps?.length || 0}`,
  });
});

// ============================================================================
// RESPONSES — Per-card capture
// ============================================================================

app.post("/responses", requireTelegram, async (c) => {
  const user = c.get("tgUser");
  const body = await c.req.json();
  const {
    session_id, drop_id, question_id, position_in_drop,
    question_type, choice, choice_index, text_response,
    slider_value, ranking_result, rafaga_choices, raw_response,
    latency_ms, source, is_brand_card
  } = body;

  if (!session_id || !question_id) {
    return c.json({ error: "session_id and question_id required" }, 400);
  }

  const node = await resolveNode(user.id);
  if (!node || node.status !== "active") return c.json({ error: "Not authorized" }, 403);

  const anonymous_id = await anonId(node.node_id);

  // Get question config for rewards and latency threshold
  const { data: qConfig } = await db()
    .from("questions")
    .select("reward_cash, reward_tickets, min_latency_ms, trap_correct_option")
    .eq("question_id", question_id)
    .single();

  // Check drop_questions for reward overrides
  let rewardCash = qConfig?.reward_cash || 0;
  let rewardTickets = qConfig?.reward_tickets || 0;
  if (drop_id && position_in_drop !== undefined) {
    const { data: dqOverride } = await db()
      .from("drop_questions")
      .select("reward_cash_override, reward_tickets_override")
      .eq("drop_id", drop_id)
      .eq("question_id", question_id)
      .single();
    if (dqOverride?.reward_cash_override !== null && dqOverride?.reward_cash_override !== undefined)
      rewardCash = dqOverride.reward_cash_override;
    if (dqOverride?.reward_tickets_override !== null && dqOverride?.reward_tickets_override !== undefined)
      rewardTickets = dqOverride.reward_tickets_override;
  }

  // Latency threshold check
  const minLatency = qConfig?.min_latency_ms || 400;
  const belowThreshold = (latency_ms || 0) < minLatency;
  const rewardGranted = !belowThreshold;

  // Determine reward type and value
  let rewardType = null;
  let rewardValue = 0;
  if (rewardCash > 0) { rewardType = "cash"; rewardValue = rewardCash; }
  else if (rewardTickets > 0) { rewardType = "tickets"; rewardValue = rewardTickets; }

  // Get current session multiplier
  const { data: sess } = await db()
    .from("sessions")
    .select("multiplier, season_id")
    .eq("session_id", session_id)
    .single();
  const multiplier = sess?.multiplier || 1;
  const finalRewardValue = rewardGranted ? Math.round(rewardValue * multiplier) : 0;

  // Insert response
  const { data: resp, error } = await db()
    .from("responses")
    .insert({
      node_id: node.node_id,
      anonymous_id,
      session_id,
      drop_id: drop_id || null,
      question_id,
      position_in_drop: position_in_drop ?? null,
      question_type: question_type || null,
      choice: choice || null,
      choice_index: choice_index ?? null,
      text_response: text_response || null,
      slider_value: slider_value ?? null,
      ranking_result: ranking_result || null,
      rafaga_choices: rafaga_choices || null,
      raw_response: raw_response || null,
      latency_ms: latency_ms || null,
      reward_type: rewardType,
      reward_value: finalRewardValue,
      reward_granted: rewardGranted,
      multiplier_at_time: multiplier,
      season_id: sess?.season_id || null,
      source: source || "drop",
    })
    .select("response_id")
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // Credit rewards to profile
  if (rewardGranted && finalRewardValue > 0 && rewardType) {
    if (rewardType === "cash") {
      const { data: p } = await db().from("profiles").select("cash_balance, cash_lifetime").eq("node_id", node.node_id).single();
      if (p) {
        await db().from("profiles").update({
          cash_balance: (p.cash_balance || 0) + finalRewardValue,
          cash_lifetime: (p.cash_lifetime || 0) + finalRewardValue,
        }).eq("node_id", node.node_id);
      }
    } else {
      const { data: p } = await db().from("profiles").select("tickets_current, tickets_lifetime").eq("node_id", node.node_id).single();
      if (p) {
        await db().from("profiles").update({
          tickets_current: (p.tickets_current || 0) + finalRewardValue,
          tickets_lifetime: (p.tickets_lifetime || 0) + finalRewardValue,
        }).eq("node_id", node.node_id);
      }
    }

    // Log transaction
    const { data: pAfter } = await db().from("profiles")
      .select("cash_balance, tickets_current")
      .eq("node_id", node.node_id).single();
    await db().from("transactions").insert({
      node_id: node.node_id,
      type: rewardType,
      amount: finalRewardValue,
      source: "drop_card",
      source_id: question_id,
      balance_after: rewardType === "cash" ? pAfter?.cash_balance : pAfter?.tickets_current,
    });
  }

  // Update session position
  await db().from("sessions")
    .update({ current_position: (position_in_drop ?? 0) + 1 })
    .eq("session_id", session_id);

  return c.json({
    response_id: resp.response_id,
    below_threshold: belowThreshold,
    reward_granted: rewardGranted,
    reward_type: rewardType,
    reward_value: finalRewardValue,
  });
});

// ============================================================================
// ONBOARDING
// ============================================================================

app.post("/apply", async (c) => {
  const body = await c.req.json();
  const {
    phone, nickname, age, gender, location_province, location_city,
    phone_brand, compass_vector, compass_archetype, compass_choices,
    brand_choices, brand_vector, handles, referred_by_code, telegram_user_id,
  } = body;

  // Phone validation
  if (!phone) return c.json({ error: "Phone required" }, 400);
  const clean = phone.replace(/\D/g, "");
  if (!clean.startsWith("54") || clean.length !== 12) {
    return c.json({ error: "Invalid phone. Format: +54 + 10 digits" }, 400);
  }
  const normalPhone = "+" + clean;

  // Check duplicate
  const { data: exists } = await db()
    .from("nodes").select("node_id, status").eq("phone", normalPhone).single();
  if (exists) return c.json({ error: "Phone already registered", status: exists.status }, 409);

  // Resolve referrer
  let referredBy = null;
  if (referred_by_code) {
    const { data: ref } = await db()
      .from("nodes").select("node_id").eq("referral_code", referred_by_code).single();
    if (ref) referredBy = ref.node_id;
  }

  // Determine status
  const isComplete = nickname && age && gender;
  const status = isComplete ? "pending" : "incomplete";
  const onboardingStep = isComplete ? "complete" : (phone ? "phone" : "start");

  // Create node
  const { data: newNode, error: nodeErr } = await db()
    .from("nodes")
    .insert({
      phone: normalPhone, nickname: nickname || null,
      age: age || null, gender: gender || null,
      location_province: location_province || null,
      location_city: location_city || null,
      phone_brand: phone_brand || null,
      compass_vector: compass_vector || null,
      compass_archetype: compass_archetype || null,
      brand_vector: brand_vector || null,
      handles: handles || null,
      referred_by: referredBy,
      status,
      onboarding_step: onboardingStep,
    })
    .select("node_id, referral_code, status")
    .single();

  if (nodeErr) return c.json({ error: nodeErr.message }, 500);

  // Create profile
  await db().from("profiles").insert({
    node_id: newNode.node_id,
    cash_balance: 0, cash_lifetime: 0, cash_withdrawn: 0,
    tickets_current: 0, tickets_lifetime: 0,
    drops_completed: 0, bot_questions_answered: 0,
    traps_passed: 0, traps_failed: 0,
    current_streak: 0, best_streak: 0,
  });

  // Create anonymous_id
  await anonId(newNode.node_id);

  // Link Telegram channel
  if (telegram_user_id) {
    await db().from("node_channels").insert({
      node_id: newNode.node_id,
      channel: "telegram",
      channel_identifier: String(telegram_user_id),
      is_primary: true,
    });
  }

  // Save compass choices
  if (compass_choices?.length) {
    await db().from("node_compass_choices").insert(
      compass_choices.map((ch) => ({
        node_id: newNode.node_id,
        rafaga_index: ch.rafaga_index,
        pair_index: ch.pair_index,
        chosen_emoji: ch.chosen_emoji,
        latency_ms: ch.latency_ms,
      }))
    );
  }

  // Save brand choices
  if (brand_choices?.length) {
    await db().from("node_brand_choices").insert(
      brand_choices.map((ch) => ({
        node_id: newNode.node_id,
        pair_index: ch.pair_index,
        chosen_brand: ch.chosen_brand,
        latency_ms: ch.latency_ms,
      }))
    );
  }

  return c.json({ node_id: newNode.node_id, referral_code: newNode.referral_code, status: newNode.status }, 201);
});

app.get("/apply/check", async (c) => {
  const phone = c.req.query("phone");
  if (!phone) return c.json({ error: "phone required" }, 400);
  const clean = "+" + phone.replace(/\D/g, "");
  const { data } = await db()
    .from("nodes")
    .select("node_id, status, nickname, referral_code, created_at")
    .eq("phone", clean).single();
  if (!data) return c.json({ exists: false });
  return c.json({ exists: true, ...data });
});

app.post("/link-channel", async (c) => {
  const { code, channel, channel_identifier } = await c.req.json();
  if (!code || !channel || !channel_identifier) {
    return c.json({ error: "code, channel, channel_identifier required" }, 400);
  }
  // Find node by referral code
  const { data: node } = await db()
    .from("nodes").select("node_id").eq("referral_code", code).single();
  if (!node) return c.json({ error: "Invalid code", linked: false });

  // Check if already linked
  const { data: existing } = await db()
    .from("node_channels")
    .select("id")
    .eq("channel", channel)
    .eq("channel_identifier", channel_identifier)
    .single();
  if (existing) return c.json({ error: "Channel already linked", linked: false });

  await db().from("node_channels").insert({
    node_id: node.node_id, channel, channel_identifier, is_primary: false,
  });
  return c.json({ node_id: node.node_id, linked: true });
});

// ============================================================================
// USER PROFILE & REWARDS
// ============================================================================

app.get("/user/profile", requireTelegram, async (c) => {
  const user = c.get("tgUser");
  const node = await resolveNode(user.id);
  if (!node) return c.json({ error: "Not found" }, 404);

  const [{ data: profile }, { data: nodeData }, { data: txs }] = await Promise.all([
    db().from("profiles").select("*").eq("node_id", node.node_id).single(),
    db().from("nodes").select("nickname, compass_archetype, compass_vector, referral_code, created_at").eq("node_id", node.node_id).single(),
    db().from("transactions").select("*").eq("node_id", node.node_id).order("created_at", { ascending: false }).limit(20),
  ]);

  return c.json({ node_id: node.node_id, ...nodeData, ...profile, transactions: txs || [] });
});

app.put("/user/wallet", requireTelegram, async (c) => {
  const user = c.get("tgUser");
  const { wallet_alias } = await c.req.json();
  const node = await resolveNode(user.id);
  if (!node) return c.json({ error: "Not found" }, 404);
  await db().from("profiles").update({ wallet_alias }).eq("node_id", node.node_id);
  return c.json({ ok: true });
});

// ============================================================================
// LEADERBOARD
// ============================================================================

app.get("/leaderboard", async (c) => {
  const limit = parseInt(c.req.query("limit") || "20");
  const { data, error } = await db()
    .from("profiles")
    .select("node_id, tickets_current, tickets_lifetime, drops_completed, nodes(nickname, compass_archetype)")
    .order("tickets_current", { ascending: false })
    .limit(limit);
  if (error) return c.json({ error: error.message }, 500);

  const ranked = (data || []).map((p, i) => ({
    rank: i + 1,
    node_id: p.node_id,
    nickname: p.nodes?.nickname,
    compass_archetype: p.nodes?.compass_archetype,
    tickets_current: p.tickets_current,
    tickets_lifetime: p.tickets_lifetime,
    drops_completed: p.drops_completed,
  }));
  return c.json(ranked);
});

// ============================================================================
// SEASONS
// ============================================================================

app.get("/season", async (c) => {
  const { data } = await db().from("seasons").select("*").eq("is_active", true).single();
  if (!data) return c.json({ error: "No active season" }, 404);
  return c.json(data);
});

app.put("/season", requirePanel, async (c) => {
  const body = await c.req.json();
  const { data, error } = await db().from("seasons").update(body).eq("is_active", true).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.post("/season/reset", requirePanel, async (c) => {
  const { data: s } = await db().from("seasons").select("season_id").eq("is_active", true).single();
  if (!s) return c.json({ error: "No active season" }, 400);
  await db().from("profiles").update({ tickets_current: 0 });
  await db().from("seasons").update({ is_active: false, archived_at: new Date().toISOString() }).eq("season_id", s.season_id);
  return c.json({ ok: true, reset_season: s.season_id });
});

// ============================================================================
// CLAIMS
// ============================================================================

app.post("/claim-rewards", requireTelegram, async (c) => {
  const user = c.get("tgUser");
  const { amount } = await c.req.json();
  const node = await resolveNode(user.id);
  if (!node) return c.json({ error: "Not found" }, 404);

  const { data: profile } = await db()
    .from("profiles").select("cash_balance, wallet_alias").eq("node_id", node.node_id).single();
  if (!profile) return c.json({ error: "Profile not found" }, 404);

  const { data: cfgMin } = await db()
    .from("admin_config").select("value").eq("key", "withdrawal_minimum").single();
  const minW = cfgMin?.value || 10;

  const claimAmt = amount || profile.cash_balance;
  if (claimAmt < minW) return c.json({ error: `Minimum $${minW} USD` }, 400);
  if (!profile.wallet_alias) return c.json({ error: "Link wallet first" }, 400);

  const { data: pending } = await db()
    .from("claims").select("claim_id").eq("node_id", node.node_id).eq("status", "pending").single();
  if (pending) return c.json({ error: "Pending claim exists", claim_id: pending.claim_id }, 409);

  const { data: claim, error } = await db()
    .from("claims")
    .insert({
      node_id: node.node_id, claim_type: "cash",
      amount: claimAmt, wallet_alias: profile.wallet_alias, status: "pending",
    })
    .select("claim_id").single();
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ claim_id: claim.claim_id, amount: claimAmt, status: "pending" });
});

app.get("/claims", requirePanel, async (c) => {
  const { data, error } = await db()
    .from("claims").select("*, nodes(nickname, phone)")
    .order("created_at", { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.put("/claims/:id", requirePanel, async (c) => {
  const claimId = c.req.param("id");
  const { status } = await c.req.json();
  if (!["approved", "rejected"].includes(status)) return c.json({ error: "Invalid status" }, 400);

  const { data: claim } = await db()
    .from("claims").select("node_id, amount, status").eq("claim_id", claimId).single();
  if (!claim) return c.json({ error: "Not found" }, 404);
  if (claim.status !== "pending") return c.json({ error: "Already resolved" }, 409);

  if (status === "approved") {
    const { data: p } = await db().from("profiles").select("cash_balance, cash_withdrawn").eq("node_id", claim.node_id).single();
    if (p) {
      await db().from("profiles").update({
        cash_balance: Math.max(0, (p.cash_balance || 0) - claim.amount),
        cash_withdrawn: (p.cash_withdrawn || 0) + claim.amount,
      }).eq("node_id", claim.node_id);
    }
    await db().from("transactions").insert({
      node_id: claim.node_id, type: "cash",
      amount: -claim.amount, source: "withdrawal", source_id: claimId,
      balance_after: Math.max(0, ((p?.cash_balance || 0) - claim.amount)),
    });
  }

  await db().from("claims").update({ status, resolved_at: new Date().toISOString() }).eq("claim_id", claimId);
  return c.json({ ok: true, status });
});

// ============================================================================
// ADMIN — NODES
// ============================================================================

app.get("/admin/users", requirePanel, async (c) => {
  const status = c.req.query("status");
  const search = c.req.query("search");
  const limit = parseInt(c.req.query("limit") || "100");
  const offset = parseInt(c.req.query("offset") || "0");

  let q = db().from("nodes").select("*, profiles(*)", { count: "exact" })
    .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (status) q = q.eq("status", status);
  if (search) q = q.or(`nickname.ilike.%${search}%,phone.ilike.%${search}%,referral_code.ilike.%${search}%`);

  const { data, count, error } = await q;
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ users: data || [], total: count || 0 });
});

app.put("/admin/users/:id/status", requirePanel, async (c) => {
  const nodeId = c.req.param("id");
  const { status } = await c.req.json();
  if (!["active", "pending", "blocked", "rejected", "incomplete"].includes(status)) {
    return c.json({ error: "Invalid status" }, 400);
  }

  // On activation: credit referrer bonus
  if (status === "active") {
    const { data: nd } = await db()
      .from("nodes").select("referred_by, status").eq("node_id", nodeId).single();
    if (nd?.referred_by && nd.status !== "active") {
      const { data: bonusCfg } = await db()
        .from("admin_config").select("value").eq("key", "referral_bonus_tickets").single();
      const bonus = bonusCfg?.value || 50;
      const { data: rp } = await db().from("profiles").select("tickets_current, tickets_lifetime").eq("node_id", nd.referred_by).single();
      if (rp) {
        await db().from("profiles").update({
          tickets_current: (rp.tickets_current || 0) + bonus,
          tickets_lifetime: (rp.tickets_lifetime || 0) + bonus,
        }).eq("node_id", nd.referred_by);
        await db().from("transactions").insert({
          node_id: nd.referred_by, type: "tickets", amount: bonus,
          source: "referral", source_id: nodeId,
          balance_after: (rp.tickets_current || 0) + bonus,
        });
      }
    }
  }

  const updateData = { status, updated_at: new Date().toISOString() };
  if (status === "active") updateData.approved_at = new Date().toISOString();

  const { error } = await db().from("nodes").update(updateData).eq("node_id", nodeId);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true, status });
});

app.delete("/admin/users/:id", requirePanel, async (c) => {
  await db().from("nodes").update({ status: "deleted", updated_at: new Date().toISOString() }).eq("node_id", c.req.param("id"));
  return c.json({ ok: true });
});

app.get("/admin/users/export", requirePanel, async (c) => {
  const { data } = await db().from("nodes")
    .select("node_id, nickname, phone, age, gender, location_province, status, compass_archetype, referral_code, created_at, profiles(cash_balance, tickets_current, drops_completed)")
    .order("created_at", { ascending: false });

  if (!data?.length) return c.text("No data");
  const hdr = "node_id,nickname,phone,age,gender,province,status,archetype,referral_code,cash,tickets,drops,created_at";
  const rows = data.map((n) => {
    const p = Array.isArray(n.profiles) ? n.profiles[0] : n.profiles || {};
    return `${n.node_id},${n.nickname||""},${n.phone||""},${n.age||""},${n.gender||""},${n.location_province||""},${n.status},${n.compass_archetype||""},${n.referral_code||""},${p.cash_balance||0},${p.tickets_current||0},${p.drops_completed||0},${n.created_at}`;
  });
  c.header("Content-Type", "text/csv");
  c.header("Content-Disposition", "attachment; filename=brutal-nodes.csv");
  return c.text([hdr, ...rows].join("\n"));
});

// ============================================================================
// ADMIN — DROPS
// ============================================================================

app.get("/admin/drops", requirePanel, async (c) => {
  const { data } = await db().from("drops")
    .select("drop_id, name, status, segment_ids, created_at, published_at")
    .order("created_at", { ascending: false });
  return c.json(data || []);
});

app.post("/admin/drops", requirePanel, async (c) => {
  const body = await c.req.json();
  const { data, error } = await db().from("drops").insert({
    name: body.name, config: body.config || {},
    status: "draft", segment_ids: body.segment_ids || null,
    season_id: body.season_id || null,
  }).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

app.put("/admin/drops/:id", requirePanel, async (c) => {
  const body = await c.req.json();
  const { data, error } = await db().from("drops").update({
    name: body.name, config: body.config,
    segment_ids: body.segment_ids, updated_at: new Date().toISOString(),
  }).eq("drop_id", c.req.param("id")).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.delete("/admin/drops/:id", requirePanel, async (c) => {
  await db().from("drops").delete().eq("drop_id", c.req.param("id")).neq("status", "active");
  return c.json({ ok: true });
});

// ============================================================================
// ADMIN — QUESTIONS
// ============================================================================

app.get("/admin/questions", requirePanel, async (c) => {
  const type = c.req.query("type");
  let q = db().from("questions").select("*").order("created_at", { ascending: false });
  if (type) q = q.eq("type", type);
  const { data, error } = await q;
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.post("/admin/questions", requirePanel, async (c) => {
  const body = await c.req.json();
  const { data, error } = await db().from("questions").insert({
    type: body.type, config: body.config || body.data || {},
    label: body.label || null, tags: body.tags || null,
    reward_cash: body.reward_cash || 0, reward_tickets: body.reward_tickets || 0,
    min_latency_ms: body.min_latency_ms || null,
    signal_pair_id: body.signal_pair_id || null,
    signal_pair_role: body.signal_pair_role || null,
    trap_correct_option: body.trap_correct_option || null,
  }).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

app.put("/admin/questions/:id", requirePanel, async (c) => {
  const body = await c.req.json();
  const { data, error } = await db().from("questions").update({
    type: body.type, config: body.config || body.data,
    label: body.label, tags: body.tags,
    reward_cash: body.reward_cash, reward_tickets: body.reward_tickets,
    min_latency_ms: body.min_latency_ms,
    signal_pair_id: body.signal_pair_id,
    signal_pair_role: body.signal_pair_role,
    trap_correct_option: body.trap_correct_option,
  }).eq("question_id", c.req.param("id")).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.delete("/admin/questions/:id", requirePanel, async (c) => {
  await db().from("questions").delete().eq("question_id", c.req.param("id"));
  return c.json({ ok: true });
});

// Drop-question linking
app.get("/admin/drop-questions/:dropId", requirePanel, async (c) => {
  const { data } = await db().from("drop_questions")
    .select("*, questions(*)")
    .eq("drop_id", c.req.param("dropId"))
    .order("position", { ascending: true });
  return c.json(data || []);
});

app.post("/admin/drop-questions", requirePanel, async (c) => {
  const body = await c.req.json();
  const { data, error } = await db().from("drop_questions").insert({
    drop_id: body.drop_id, question_id: body.question_id,
    position: body.position,
    reward_cash_override: body.reward_cash_override ?? null,
    reward_tickets_override: body.reward_tickets_override ?? null,
  }).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

app.delete("/admin/drop-questions/:dropId/:questionId", requirePanel, async (c) => {
  await db().from("drop_questions").delete()
    .eq("drop_id", c.req.param("dropId"))
    .eq("question_id", c.req.param("questionId"));
  return c.json({ ok: true });
});

// ============================================================================
// ADMIN — SEGMENTS
// ============================================================================

app.get("/admin/segments", requirePanel, async (c) => {
  const { data } = await db().from("segments").select("*").order("created_at", { ascending: false });
  return c.json(data || []);
});

app.post("/admin/segments", requirePanel, async (c) => {
  const body = await c.req.json();
  const { data, error } = await db().from("segments").insert({
    name: body.name, description: body.description || null, filters: body.filters,
  }).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

app.delete("/admin/segments/:id", requirePanel, async (c) => {
  await db().from("segments").delete().eq("segment_id", c.req.param("id"));
  return c.json({ ok: true });
});

// ============================================================================
// COMPASS & BRAND CONFIG
// ============================================================================

app.get("/compass-config", async (c) => {
  const { data } = await db().from("compass_config").select("*").limit(1).single();
  return c.json(data || { rafagas: [] });
});

app.put("/compass-config", requirePanel, async (c) => {
  const body = await c.req.json();
  // Upsert — delete all and insert
  await db().from("compass_config").delete().neq("key", "__never__");
  const { data, error } = await db().from("compass_config").insert(body).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.get("/brand-config", async (c) => {
  const { data } = await db().from("brand_config").select("*").limit(1).single();
  return c.json(data || { pairs: [] });
});

app.put("/brand-config", requirePanel, async (c) => {
  const body = await c.req.json();
  await db().from("brand_config").delete().neq("key", "__never__");
  const { data, error } = await db().from("brand_config").insert(body).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ============================================================================
// ADMIN CONFIG
// ============================================================================

app.get("/admin/config", requirePanel, async (c) => {
  const { data } = await db().from("admin_config").select("*");
  return c.json(data || []);
});

app.put("/admin/config/:key", requirePanel, async (c) => {
  const key = c.req.param("key");
  const { value } = await c.req.json();
  const { data, error } = await db().from("admin_config")
    .upsert({ key, value, updated_at: new Date().toISOString() }).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ============================================================================
// PANEL AUTH
// ============================================================================

app.post("/panel-auth", async (c) => {
  const { password } = await c.req.json();
  if (password === (process.env.PANEL_PASSWORD || "brutal-admin")) {
    return c.json({ authenticated: true, token: password });
  }
  return c.json({ authenticated: false }, 401);
});

// ============================================================================
// BOT
// ============================================================================

app.post("/bot/send-message", requirePanel, async (c) => {
  const { chat_id, text, parse_mode } = await c.req.json();
  if (!chat_id || !text) return c.json({ error: "chat_id and text required" }, 400);
  const res = await fetch(`https://api.telegram.org/bot${botToken()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id, text, parse_mode: parse_mode || "HTML" }),
  });
  return c.json(await res.json());
});

app.get("/bot/questions", requirePanel, async (c) => {
  const { data } = await db().from("bot_questions").select("*, questions(*)").order("created_at", { ascending: false });
  return c.json(data || []);
});

app.post("/bot/questions", requirePanel, async (c) => {
  const body = await c.req.json();
  const { data, error } = await db().from("bot_questions").insert({
    question_id: body.question_id, linked_drop_id: body.linked_drop_id || null,
    bot_name: body.bot_name || null, message_config: body.message_config || null,
    segment_ids: body.segment_ids || null,
  }).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

// ============================================================================
// ANALYSIS
// ============================================================================

app.get("/analysis/responses", requirePanel, async (c) => {
  const dropId = c.req.query("drop_id");
  let q = db().from("responses")
    .select("response_id, anonymous_id, session_id, drop_id, question_id, position_in_drop, question_type, choice, choice_index, text_response, slider_value, ranking_result, rafaga_choices, raw_response, latency_ms, reward_type, reward_value, reward_granted, answered_at")
    .order("answered_at", { ascending: true });
  if (dropId) q = q.eq("drop_id", dropId);
  const { data, error } = await q;
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.get("/analysis/drop-summary", requirePanel, async (c) => {
  const dropId = c.req.query("drop_id");
  if (!dropId) return c.json({ error: "drop_id required" }, 400);

  const { data: drop } = await db().from("drops")
    .select("drop_id, name, total_sessions, completed_sessions, avg_completion_time_ms")
    .eq("drop_id", dropId).single();

  const { count: responseCount } = await db().from("responses")
    .select("*", { count: "exact", head: true }).eq("drop_id", dropId);

  const { data: latencyData } = await db().from("responses")
    .select("latency_ms").eq("drop_id", dropId).not("latency_ms", "is", null);

  const avgLatency = latencyData?.length
    ? Math.round(latencyData.reduce((s, r) => s + r.latency_ms, 0) / latencyData.length)
    : null;

  return c.json({
    ...drop,
    total_responses: responseCount || 0,
    avg_latency_ms: avgLatency,
  });
});

// ============================================================================
// ADMIN STATS
// ============================================================================

app.get("/admin/stats", requirePanel, async (c) => {
  const [
    { count: totalNodes },
    { count: activeNodes },
    { count: pendingNodes },
    { count: totalSessions },
    { count: completedSessions },
    { count: totalResponses },
    { count: pendingClaims },
  ] = await Promise.all([
    db().from("nodes").select("*", { count: "exact", head: true }),
    db().from("nodes").select("*", { count: "exact", head: true }).eq("status", "active"),
    db().from("nodes").select("*", { count: "exact", head: true }).eq("status", "pending"),
    db().from("sessions").select("*", { count: "exact", head: true }),
    db().from("sessions").select("*", { count: "exact", head: true }).eq("status", "completed"),
    db().from("responses").select("*", { count: "exact", head: true }),
    db().from("claims").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return c.json({
    nodes: { total: totalNodes, active: activeNodes, pending: pendingNodes },
    sessions: { total: totalSessions, completed: completedSessions },
    responses: totalResponses,
    pending_claims: pendingClaims,
  });
});

// ============================================================================
// NODE STATUS (legacy/convenience)
// ============================================================================

app.get("/node-status", requireTelegram, async (c) => {
  const user = c.get("tgUser");
  const node = await resolveNode(user.id);
  if (!node) return c.json({ status: "unknown", registered: false });
  return c.json({ status: node.status, registered: true, node_id: node.node_id });
});

// ============================================================================
// ERROR & 404
// ============================================================================

app.onError((err, c) => {
  console.error("[BRUTAL]", err);
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

// ============================================================================
// START
// ============================================================================

const port = parseInt(process.env.PORT || "3000");
console.log(`[BRUTAL] Server v2.0 starting on port ${port}`);
serve({ fetch: app.fetch, port });
