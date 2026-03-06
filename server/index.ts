/**
 * BRUTAL — Production Server v3.0
 * Node.js + Hono + Supabase PostgreSQL
 *
 * KEY CHANGE from v2: All endpoints return data in the format
 * the Figma Make frontend expects. No transformers needed.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, PANEL_PASSWORD, PORT
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import { serveStatic } from "@hono/node-server/serve-static";
import { readFileSync, existsSync } from "fs";

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

async function anonId(nodeId) {
  const { data } = await db()
    .from("anonymous_id_map")
    .select("anonymous_id")
    .eq("node_id", nodeId)
    .single();
  if (data) return data.anonymous_id;
  const newAnon = "anon_" + crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  const { data: created, error } = await db()
    .from("anonymous_id_map")
    .insert({ node_id: nodeId, anonymous_id: newAnon })
    .select("anonymous_id")
    .single();
  if (error) return null;
  return created.anonymous_id;
}

// ============================================================================
// FORMAT HELPERS — DB rows → Frontend format
// ============================================================================

function dbQuestionToPanel(row) {
  // Reconstruct reward for data object
  const reward = row.reward_cash > 0
    ? { type: "coins", value: Number(row.reward_cash) }
    : row.reward_tickets > 0
      ? { type: "tickets", value: Number(row.reward_tickets) }
      : undefined;
  return {
    id: row.question_id,
    data: { type: row.type, ...(row.config || {}), ...(reward ? { reward } : {}) },
    label: row.label || "",
    tags: row.tags || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    reward_cash: row.reward_cash || 0,
    reward_tickets: row.reward_tickets || 0,
    min_latency_ms: row.min_latency_ms,
    signal_pair_id: row.signal_pair_id,
    signal_pair_role: row.signal_pair_role,
    trap_correct_option: row.trap_correct_option,
  };
}

function dbDropToPanel(row) {
  const cfg = row.config || {};
  return {
    id: row.drop_id,
    name: row.name,
    dropId: cfg.dropId || row.drop_id,
    status: row.status,
    timeoutMessage: cfg.timeoutMessage || "Brutal eligió por vos.",
    multiplierCheckpoints: cfg.multiplierCheckpoints || {},
    reveal: cfg.reveal || { title: "", description: "", archetypes: [] },
    questionIds: cfg.questionIds || [],
    disabledQuestionIds: cfg.disabledQuestionIds || [],
    splash: cfg.splash || null,
    segmentIds: row.segment_ids || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

function dbToPlayableDrop(dropRow, questionRows) {
  const cfg = dropRow.config || {};
  return {
    id: dropRow.drop_id,
    name: dropRow.name,
    version: 1,
    timeoutMessage: cfg.timeoutMessage || "Brutal eligió por vos.",
    multiplierCheckpoints: cfg.multiplierCheckpoints || {},
    reveal: cfg.reveal || { title: "", description: "", archetypes: [] },
    splash: cfg.splash || undefined,
    segmentIds: dropRow.segment_ids || undefined,
    questions: questionRows.map((dq) => {
      const q = dq.questions;
      const config = q.config || {};
      return {
        questionId: q.question_id,
        type: q.type,
        ...config,
        timer: config.timer ?? 15,
        reward: buildReward(dq, q),
        result: config.result || undefined,
        signalPairId: q.signal_pair_id || undefined,
        cardType: config.cardType || undefined,
        segmentIds: config.segmentIds || undefined,
      };
    }),
  };
}

function buildReward(dropQuestion, question) {
  const cash = dropQuestion.reward_cash_override ?? question.reward_cash ?? 0;
  const tickets = dropQuestion.reward_tickets_override ?? question.reward_tickets ?? 0;
  if (cash > 0) return { type: "coins", value: cash };
  if (tickets > 0) return { type: "tickets", value: tickets };
  return undefined;
}

function dbToUserProfile(node, profile, telegramUserId, tgUser) {
  return {
    telegramUserId: telegramUserId,
    username: tgUser?.username || node?.nickname || "",
    firstName: tgUser?.first_name || node?.nickname || "",
    lastName: tgUser?.last_name || "",
    walletAlias: profile?.wallet_alias || null,
    totalCoins: profile?.cash_balance || 0,
    seasonTickets: profile?.tickets_current || 0,
    lifetimeTickets: profile?.tickets_lifetime || 0,
    dropsCompleted: profile?.drops_completed || 0,
    botQuestionsAnswered: profile?.bot_questions_answered || 0,
    firstSeen: node?.created_at || "",
    lastActiveAt: node?.last_active_at || node?.created_at || "",
  };
}

function dbToTransaction(tx) {
  return {
    txId: tx.tx_id,
    telegramUserId: 0,
    rewardType: tx.type === "cash" ? "coins" : "tickets",
    rewardValue: tx.amount,
    source: tx.source,
    sourceId: tx.source_id,
    createdAt: tx.created_at,
  };
}

function dbToClaim(row) {
  return {
    claimId: row.claim_id,
    telegramUserId: 0,
    username: row.nodes?.nickname || "",
    firstName: row.nodes?.nickname || "",
    walletAlias: row.wallet_alias || "",
    amount: row.amount,
    status: row.status,
    note: row.note || null,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at || null,
  };
}

function dbToSeason(row) {
  return {
    seasonId: row.season_id,
    name: row.name,
    startDate: row.starts_at || row.created_at,
    endDate: row.ends_at || null,
    prizes: row.prizes || [],
    prizeImageUrl: row.prize_image_url || null,
    active: row.is_active ?? true,
    createdAt: row.created_at,
  };
}

// ============================================================================
// HEALTH
// ============================================================================

app.get("/health", (c) => c.json({ status: "ok", version: "3.0.0" }));

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
      .from("sessions").select("session_id")
      .eq("node_id", node.node_id).eq("drop_id", dropId).eq("status", "completed").single();
    if (done) return c.json({ status: "completed" });
  }
  return c.json({ status: "granted", node_id: node.node_id });
});

// ============================================================================
// DROPS — Public endpoints for SurveyApp / Mini App
// ============================================================================

app.get("/active-drop", async (c) => {
  const { data: dropRow } = await db()
    .from("drops").select("*").eq("status", "active")
    .order("published_at", { ascending: false }).limit(1).single();
  if (!dropRow) return c.json({ error: "No active drop" }, 404);
  const { data: dqRows } = await db()
    .from("drop_questions")
    .select("position, reward_cash_override, reward_tickets_override, questions(*)")
    .eq("drop_id", dropRow.drop_id).order("position", { ascending: true });
  if (dqRows?.length) return c.json(dbToPlayableDrop(dropRow, dqRows));
  const cfg = dropRow.config || {};
  if (cfg.questions?.length) {
    return c.json({
      id: dropRow.drop_id, name: dropRow.name, version: 1,
      timeoutMessage: cfg.timeoutMessage || "Brutal eligio por vos.",
      multiplierCheckpoints: cfg.multiplierCheckpoints || {},
      reveal: cfg.reveal || { title: "", description: "", archetypes: [] },
      splash: cfg.splash || undefined, questions: cfg.questions,
    });
  }
  return c.json({ error: "Active drop has no questions" }, 404);
});

app.put("/active-drop", requirePanel, async (c) => {
  const body = await c.req.json();
  if (body.questions && Array.isArray(body.questions)) {
    // Archive any currently active drop
    await db().from("drops").update({ status: "archived" }).eq("status", "active");
    const dropId = body.id || body.drop_id || crypto.randomUUID();

    // Upsert the drop record (without embedding questions in config)
    const { data: dropData, error: dropErr } = await db().from("drops").upsert({
      drop_id: dropId, name: body.name || "Drop", status: "active",
      published_at: new Date().toISOString(),
      config: { timeoutMessage: body.timeoutMessage, multiplierCheckpoints: body.multiplierCheckpoints,
        reveal: body.reveal, splash: body.splash },
      segment_ids: body.segmentIds || null,
    }).select().single();
    if (dropErr) return c.json({ error: dropErr.message }, 500);

    // Clear old linkages for this drop
    await db().from("drop_questions").delete().eq("drop_id", dropId);

    // Persist each question as a DB record + link to drop
    let linked = 0;
    for (let i = 0; i < body.questions.length; i++) {
      const q = body.questions[i];
      const qType = q.type;
      if (!qType) continue;

      // Extract reward from question's reward field (frontend format)
      const rewardCash = q.reward?.type === "coins" ? (q.reward.value || 0) : 0;
      const rewardTickets = q.reward?.type === "tickets" ? (q.reward.value || 0) : 0;

      // Build the config object (everything except meta fields)
      const { type: _t, reward: _r, questionId: _qid, ...config } = q;

      // Upsert question: if questionId exists, update; otherwise create new
      let questionId = q.questionId || null;
      if (questionId) {
        // Update existing question
        await db().from("questions").upsert({
          question_id: questionId, type: qType, config,
          reward_cash: rewardCash, reward_tickets: rewardTickets,
          label: q.text || q.statement || q.label || null,
          trap_correct_option: q.trapCorrectIndex != null ? String(q.trapCorrectIndex) : null,
        });
      } else {
        // Create new question
        const { data: newQ } = await db().from("questions").insert({
          type: qType, config,
          reward_cash: rewardCash, reward_tickets: rewardTickets,
          label: q.text || q.statement || q.label || null,
          trap_correct_option: q.trapCorrectIndex != null ? String(q.trapCorrectIndex) : null,
        }).select("question_id").single();
        questionId = newQ?.question_id;
      }

      if (questionId) {
        await db().from("drop_questions").insert({
          drop_id: dropId, question_id: questionId, position: i,
          reward_cash_override: rewardCash || null,
          reward_tickets_override: rewardTickets || null,
        });
        linked++;
      }
    }

    return c.json({ dropId: dropData.drop_id, questionCount: linked });
  }
  if (body.drop_id) {
    await db().from("drops").update({ status: "archived" }).eq("status", "active");
    const { data, error } = await db().from("drops")
      .update({ status: "active", published_at: new Date().toISOString() })
      .eq("drop_id", body.drop_id).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(dbDropToPanel(data));
  }
  return c.json({ error: "Provide drop JSON or drop_id" }, 400);
});

app.delete("/active-drop", requirePanel, async (c) => {
  await db().from("drops").update({ status: "archived" }).eq("status", "active");
  return c.json({ ok: true });
});

app.put("/preview-drop", requirePanel, async (c) => {
  const body = await c.req.json();
  const dropId = body.id || "preview-" + crypto.randomUUID();
  // Upsert drop without embedding questions
  const { error } = await db().from("drops").upsert({
    drop_id: dropId, name: body.name || "Preview", status: "draft",
    config: { timeoutMessage: body.timeoutMessage, multiplierCheckpoints: body.multiplierCheckpoints,
      reveal: body.reveal, splash: body.splash, _preview: true },
  }).select().single();
  if (error) return c.json({ error: error.message }, 500);

  // Persist questions + linkages (same logic as active-drop)
  if (body.questions && Array.isArray(body.questions)) {
    await db().from("drop_questions").delete().eq("drop_id", dropId);
    for (let i = 0; i < body.questions.length; i++) {
      const q = body.questions[i];
      if (!q.type) continue;
      const rewardCash = q.reward?.type === "coins" ? (q.reward.value || 0) : 0;
      const rewardTickets = q.reward?.type === "tickets" ? (q.reward.value || 0) : 0;
      const { type: _t, reward: _r, questionId: _qid, ...config } = q;
      let questionId = q.questionId || null;
      if (questionId) {
        await db().from("questions").upsert({
          question_id: questionId, type: q.type, config,
          reward_cash: rewardCash, reward_tickets: rewardTickets,
          label: q.text || q.statement || q.label || null,
        });
      } else {
        const { data: newQ } = await db().from("questions").insert({
          type: q.type, config, reward_cash: rewardCash, reward_tickets: rewardTickets,
          label: q.text || q.statement || q.label || null,
        }).select("question_id").single();
        questionId = newQ?.question_id;
      }
      if (questionId) {
        await db().from("drop_questions").insert({
          drop_id: dropId, question_id: questionId, position: i,
          reward_cash_override: rewardCash || null, reward_tickets_override: rewardTickets || null,
        });
      }
    }
  }
  return c.json({ ok: true });
});

app.get("/preview-drop", async (c) => {
  const { data } = await db().from("drops").select("*").eq("status", "draft")
    .order("created_at", { ascending: false }).limit(1).single();
  if (!data) return c.json(null, 404);
  const cfg = data.config || {};
  if (!cfg._preview) return c.json(null, 404);
  // Use drop_questions if available (same as active-drop)
  const { data: dqRows } = await db().from("drop_questions")
    .select("position, reward_cash_override, reward_tickets_override, questions(*)")
    .eq("drop_id", data.drop_id).order("position", { ascending: true });
  if (dqRows?.length) return c.json(dbToPlayableDrop(data, dqRows));
  return c.json({ error: "Preview drop has no questions" }, 404);
});

app.get("/drop/:id", async (c) => {
  const { data } = await db().from("drops").select("*").eq("drop_id", c.req.param("id")).single();
  if (!data) return c.json({ error: "Drop not found" }, 404);
  return c.json(dbDropToPanel(data));
});

app.get("/drop/:id/questions", async (c) => {
  const { data, error } = await db().from("drop_questions")
    .select("position, reward_cash_override, reward_tickets_override, questions(*)")
    .eq("drop_id", c.req.param("id")).order("position", { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json((data || []).map((dq) => ({
    position: dq.position, reward_cash_override: dq.reward_cash_override,
    reward_tickets_override: dq.reward_tickets_override,
    question: dq.questions ? dbQuestionToPanel(dq.questions) : null,
  })));
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
  const { data: existing } = await db().from("sessions")
    .select("session_id, current_position, status")
    .eq("node_id", node.node_id).eq("drop_id", drop_id).single();
  if (existing) {
    if (existing.status === "completed") return c.json({ error: "Already completed" }, 409);
    return c.json({ session_id: existing.session_id, resumed: true, current_index: existing.current_position || 0 });
  }
  const { data: session, error } = await db().from("sessions").insert({
    node_id: node.node_id, drop_id, status: "in_progress", current_position: 0,
    started_at: new Date().toISOString(), total_cash_earned: 0, total_tickets_earned: 0,
    trap_score: 0, traps_passed: 0, traps_failed: 0, multiplier: 1,
  }).select("session_id").single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ session_id: session.session_id, resumed: false, current_index: 0 });
});

app.post("/sessions/complete", requireTelegram, async (c) => {
  const user = c.get("tgUser");
  const { session_id, archetype_result, bic_scores, multiplier: clientMultiplier } = await c.req.json();
  if (!session_id) return c.json({ error: "session_id required" }, 400);
  const node = await resolveNode(user.id);
  if (!node) return c.json({ error: "Not authorized" }, 403);

  // Calculate multiplier server-side from drop config + actual responses
  const { data: sessionData } = await db().from("sessions")
    .select("drop_id").eq("session_id", session_id).single();
  let serverMultiplier = 1;
  if (sessionData?.drop_id) {
    const { data: dropData } = await db().from("drops")
      .select("config").eq("drop_id", sessionData.drop_id).single();
    const checkpoints = dropData?.config?.multiplierCheckpoints || {};
    // Count actual responses for this session
    const { count: responseCount } = await db().from("responses")
      .select("*", { count: "exact", head: true }).eq("session_id", session_id);
    // Apply all checkpoints where position < responseCount
    for (const [pos, cp] of Object.entries(checkpoints)) {
      if (Number(pos) < (responseCount || 0) && (cp as any).multiplier > serverMultiplier) {
        serverMultiplier = (cp as any).multiplier;
      }
    }
  }
  // Use server-calculated multiplier, fallback to client if server can't determine
  const finalMultiplier = serverMultiplier > 1 ? serverMultiplier : (clientMultiplier || 1);

  // Update session multiplier first so it's recorded
  await db().from("sessions").update({ multiplier: finalMultiplier }).eq("session_id", session_id);

  const { data: rewards } = await db().from("responses")
    .select("reward_type, reward_value, reward_granted").eq("session_id", session_id);
  // Base totals from responses (stored without multiplier)
  const baseCash = rewards?.filter(r => r.reward_type === "cash" && r.reward_granted)
    .reduce((s, r) => s + Number(r.reward_value || 0), 0) || 0;
  const baseTickets = rewards?.filter(r => r.reward_type === "golden_ticket" && r.reward_granted)
    .reduce((s, r) => s + Number(r.reward_value || 0), 0) || 0;
  // Apply multiplier for final totals
  const totalCash = Number((baseCash * finalMultiplier).toFixed(4));
  const totalTickets = Math.round(baseTickets * finalMultiplier);

  const { data: traps } = await db().from("responses")
    .select("question_type, raw_response").eq("session_id", session_id)
    .in("question_type", ["trap", "trap_silent"]);
  const trapsPassed = traps?.filter(t => t.raw_response?.correct === true).length || 0;
  const trapsFailed = (traps?.length || 0) - trapsPassed;
  const { data: latencies } = await db().from("responses")
    .select("latency_ms").eq("session_id", session_id).not("latency_ms", "is", null);
  const avgLatency = latencies?.length
    ? Math.round(latencies.reduce((s, r) => s + r.latency_ms, 0) / latencies.length) : null;
  const { error } = await db().from("sessions").update({
    status: "completed", completed_at: new Date().toISOString(),
    total_cash_earned: totalCash, total_tickets_earned: totalTickets,
    multiplier: finalMultiplier,
    trap_score: trapsPassed, traps_passed: trapsPassed, traps_failed: trapsFailed,
    avg_latency_ms: avgLatency,
    archetype_result: archetype_result || null, bic_scores: bic_scores || null,
  }).eq("session_id", session_id).eq("node_id", node.node_id);
  if (error) return c.json({ error: error.message }, 500);

  // Check if session was already completed before this call (idempotency guard)
  const { data: sessionBefore } = await db().from("sessions")
    .select("status").eq("session_id", session_id).single();
  const alreadyCompleted = sessionBefore?.status === "completed";

  // Update profile with multiplied totals
  const { data: prof } = await db().from("profiles")
    .select("drops_completed, cash_balance, cash_lifetime, tickets_current, tickets_lifetime")
    .eq("node_id", node.node_id).single();
  if (prof) {
    // Calculate the multiplier bonus (difference between multiplied and base)
    const cashBonus = totalCash - baseCash;
    const ticketBonus = totalTickets - baseTickets;
    await db().from("profiles").update({
      // Only increment drops_completed if this is the first time completing
      ...(alreadyCompleted ? {} : { drops_completed: (prof.drops_completed || 0) + 1 }),
      last_drop_at: new Date().toISOString(),
      // Add multiplier bonus to profile (base rewards already added per-response)
      cash_balance: Number(prof.cash_balance || 0) + cashBonus,
      cash_lifetime: Number(prof.cash_lifetime || 0) + cashBonus,
      tickets_current: (prof.tickets_current || 0) + ticketBonus,
      tickets_lifetime: (prof.tickets_lifetime || 0) + ticketBonus,
    }).eq("node_id", node.node_id);
  }
  // Bot message is now sent via POST /sessions/notify (called from frontend after claim animation)

  return c.json({ ok: true, total_cash: totalCash, total_tickets: totalTickets,
    trap_score: `${trapsPassed}/${traps?.length || 0}` });
});

// ============================================================================
// SESSIONS — Notify (bot message after claim)
// ============================================================================

app.post("/sessions/notify", requireTelegram, async (c) => {
  const user = c.get("tgUser");
  const { session_id, total_cash, total_tickets, multiplier } = await c.req.json();
  if (!session_id) return c.json({ error: "session_id required" }, 400);

  const node = await resolveNode(user.id);
  if (!node) return c.json({ error: "Not authorized" }, 403);

  // Verify session belongs to this node
  const { data: session } = await db().from("sessions")
    .select("session_id, node_id, status")
    .eq("session_id", session_id).eq("node_id", node.node_id).single();
  if (!session) return c.json({ error: "Session not found" }, 404);

  const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN
    : "https://brutal-production-production-24da.up.railway.app";

  try {
    const { data: channel } = await db().from("node_channels")
      .select("channel_identifier").eq("node_id", node.node_id).eq("channel", "telegram").single();

    if (channel?.channel_identifier) {
      const tgChatId = channel.channel_identifier;
      const cashStr = total_cash > 0 ? `💰 $${Number(total_cash).toFixed(2)}` : "";
      const ticketStr = total_tickets > 0 ? `🎟️ ${total_tickets} tickets` : "";
      const multStr = multiplier > 1 ? ` (x${multiplier})` : "";
      const rewardLine = [cashStr, ticketStr].filter(Boolean).join("  +  ");
      const msgText = `✅ *Drop completado*${multStr}\n\n${rewardLine || "Sin rewards esta vez"}\n\nMirá cómo te fue:`;

      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: msgText,
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [
            [
              { text: "📊 Mi Perfil", web_app: { url: `${baseUrl}/?screen=profile` } },
              { text: "🏆 Leaderboard", web_app: { url: `${baseUrl}/?screen=leaderboard` } },
            ],
          ]},
        }),
      });
    }
  } catch (botErr) {
    console.error("[BRUTAL] Notify bot message failed:", botErr);
    // Non-blocking — still return ok
  }

  return c.json({ ok: true });
});

// ============================================================================
// RESPONSES — Per-card capture
// ============================================================================

app.post("/responses", requireTelegram, async (c) => {
  const user = c.get("tgUser");
  const body = await c.req.json();
  const { session_id, drop_id, question_id, position_in_drop, question_type,
    choice, choice_index, text_response, slider_value, ranking_result,
    rafaga_choices, raw_response, latency_ms, source } = body;
  if (!session_id || !question_id) return c.json({ error: "session_id and question_id required" }, 400);
  const node = await resolveNode(user.id);
  if (!node || node.status !== "active") return c.json({ error: "Not authorized" }, 403);
  const anonymous_id = await anonId(node.node_id);
  const { data: qConfig } = await db().from("questions")
    .select("reward_cash, reward_tickets, min_latency_ms, trap_correct_option")
    .eq("question_id", question_id).single();
  let rewardCash = qConfig?.reward_cash || 0;
  let rewardTickets = qConfig?.reward_tickets || 0;
  if (drop_id && position_in_drop !== undefined) {
    const { data: dqOverride } = await db().from("drop_questions")
      .select("reward_cash_override, reward_tickets_override")
      .eq("drop_id", drop_id).eq("question_id", question_id).single();
    if (dqOverride?.reward_cash_override != null) rewardCash = dqOverride.reward_cash_override;
    if (dqOverride?.reward_tickets_override != null) rewardTickets = dqOverride.reward_tickets_override;
  }
  const minLatency = qConfig?.min_latency_ms || 400;
  const belowThreshold = (latency_ms || 0) < minLatency;
  const rewardGranted = !belowThreshold;
  let rewardType = null;
  let rewardValue = 0;
  if (rewardCash > 0) { rewardType = "cash"; rewardValue = rewardCash; }
  else if (rewardTickets > 0) { rewardType = "golden_ticket"; rewardValue = rewardTickets; }
  const { data: sess } = await db().from("sessions")
    .select("multiplier").eq("session_id", session_id).single();
  const multiplier = sess?.multiplier || 1;
  // Get season_id from active season, not from sessions table
  const { data: activeSeason } = await db().from("seasons")
    .select("season_id").eq("is_active", true).limit(1).single();
  const seasonId = activeSeason?.season_id || null;
  const finalRewardValue = rewardGranted ? (rewardType === "cash" ? Number((rewardValue * multiplier).toFixed(4)) : Math.round(rewardValue * multiplier)) : 0;
  const { data: resp, error } = await db().from("responses").insert({
    node_id: node.node_id, anonymous_id, session_id, drop_id: drop_id || null,
    question_id, position_in_drop: position_in_drop ?? null,
    question_type: question_type || null, choice: choice || null,
    choice_index: choice_index ?? null, text_response: text_response || null,
    slider_value: slider_value ?? null, ranking_result: ranking_result || null,
    rafaga_choices: rafaga_choices || null, raw_response: raw_response || null,
    latency_ms: latency_ms || null, reward_type: rewardType,
    reward_value: finalRewardValue, reward_granted: rewardGranted,
    multiplier_at_time: multiplier, season_id: seasonId,
    source: "drop",
  }).select("response_id").single();
  if (error) return c.json({ error: error.message }, 500);
  if (rewardGranted && finalRewardValue > 0 && rewardType) {
    if (rewardType === "cash") {
      const { data: p } = await db().from("profiles").select("cash_balance, cash_lifetime").eq("node_id", node.node_id).single();
      if (p) await db().from("profiles").update({
        cash_balance: (p.cash_balance || 0) + finalRewardValue,
        cash_lifetime: (p.cash_lifetime || 0) + finalRewardValue,
      }).eq("node_id", node.node_id);
    } else {
      const { data: p } = await db().from("profiles").select("tickets_current, tickets_lifetime").eq("node_id", node.node_id).single();
      if (p) await db().from("profiles").update({
        tickets_current: (p.tickets_current || 0) + finalRewardValue,
        tickets_lifetime: (p.tickets_lifetime || 0) + finalRewardValue,
      }).eq("node_id", node.node_id);
    }
    const { data: pAfter } = await db().from("profiles")
      .select("cash_balance, tickets_current").eq("node_id", node.node_id).single();
    await db().from("transactions").insert({
      node_id: node.node_id, type: rewardType, amount: finalRewardValue,
      source: "drop_card", source_id: question_id,
      balance_after: rewardType === "cash" ? pAfter?.cash_balance : pAfter?.tickets_current,
    });
  }
  await db().from("sessions").update({ current_position: (position_in_drop ?? 0) + 1 })
    .eq("session_id", session_id);
  return c.json({ response_id: resp.response_id, below_threshold: belowThreshold,
    reward_granted: rewardGranted, reward_type: rewardType, reward_value: finalRewardValue });
});

// ============================================================================
// ONBOARDING — returns onboarding-api.ts format
// ============================================================================

app.post("/apply", async (c) => {
  const body = await c.req.json();

  // Accept both camelCase (frontend) and snake_case field names
  const phone = body.phone;
  const nickname = body.nickname;
  const age = body.age;
  const gender = body.gender;
  const phoneBrand = body.phoneBrand || body.phone_brand;
  const handles = body.handles;
  const referredByCode = body.referralCode || body.referred_by_code;
  const telegramUserId = body.telegramUserId || body.telegram_user_id;

  // Location: frontend sends "location" as combined string, or separate fields
  let locationProvince = body.location_province || null;
  let locationCity = body.location_city || null;
  if (!locationProvince && body.location) {
    const parts = String(body.location).split(">").map((s) => s.trim());
    locationProvince = parts[0] || null;
    locationCity = parts[1] || null;
  }

  // Compass: frontend sends camelCase
  const compassVector = body.compassVector || body.compass_vector || null;
  const compassArchetype = body.compassArchetype || body.compass_archetype || null;
  const brandVector = body.brandVector || body.brand_vector || null;

  // compassRaw: Record<rafagaId, ("A"|"B"|null)[]> from frontend
  const compassRaw = body.compassRaw || null;
  const compassChoicesFromBody = body.compass_choices || null;
  const brandChoices = body.brand_choices || null;

  if (!phone) return c.json({ ok: false, error: "Phone required" }, 400);
  const clean = phone.replace(/\D/g, "");
  if (!clean.startsWith("54") || clean.length < 10 || clean.length > 13) {
    return c.json({ ok: false, error: "Invalid phone" }, 400);
  }
  const normalPhone = "+" + clean;
  const { data: exists } = await db().from("nodes").select("node_id").eq("phone", normalPhone).single();
  if (exists) return c.json({ ok: false, error: "Phone already registered" }, 409);

  let referredBy = null;
  if (referredByCode) {
    const { data: ref } = await db().from("nodes").select("node_id").eq("referral_code", referredByCode).single();
    if (ref) referredBy = ref.node_id;
  }

  const isComplete = nickname && age && gender;
  const status = isComplete ? "pending" : "incomplete";
  const { data: newNode, error: nodeErr } = await db().from("nodes").insert({
    phone: normalPhone, nickname: nickname || null, age: age || null, gender: gender || null,
    location_province: locationProvince, location_city: locationCity,
    phone_brand: phoneBrand || null, compass_vector: compassVector,
    compass_archetype: compassArchetype, brand_vector: brandVector,
    handles: handles || null, referred_by: referredBy, status,
    onboarding_step: isComplete ? 99 : 1,
  }).select("node_id, referral_code, status").single();
  if (nodeErr) return c.json({ ok: false, error: nodeErr.message }, 500);

  await db().from("profiles").insert({
    node_id: newNode.node_id, cash_balance: 0, cash_lifetime: 0, cash_withdrawn: 0,
    tickets_current: 0, tickets_lifetime: 0, drops_completed: 0, bot_questions_answered: 0,
    traps_passed: 0, traps_failed: 0, current_streak: 0, best_streak: 0,
  });
  await anonId(newNode.node_id);

  if (telegramUserId) {
    await db().from("node_channels").upsert({
      node_id: newNode.node_id, channel: "telegram",
      channel_identifier: String(telegramUserId), is_primary: true,
    }, { onConflict: "channel,channel_identifier" });
  }

  // Save compass choices — handle compassRaw (frontend format) or compass_choices (direct)
  if (compassRaw && typeof compassRaw === "object") {
    const { data: config } = await db().from("compass_config").select("rafagas").limit(1).single();
    const rafagaList = config?.rafagas || [];
    const rows = [];
    const rafagaIds = Object.keys(compassRaw);
    for (let ri = 0; ri < rafagaIds.length; ri++) {
      const rafagaId = rafagaIds[ri];
      const answers = compassRaw[rafagaId];
      const rafagaDef = rafagaList.find((r) => r.id === rafagaId);
      if (!answers) continue;
      for (let pi = 0; pi < answers.length; pi++) {
        const answer = answers[pi];
        if (answer === null || answer === undefined) continue;
        const pair = rafagaDef?.pairs?.[pi];
        rows.push({
          node_id: newNode.node_id, rafaga_index: ri, pair_index: pi,
          emoji_left: pair?.optionA || "", emoji_right: pair?.optionB || "",
          chosen: answer, latency_ms: null,
        });
      }
    }
    if (rows.length > 0) {
      await db().from("node_compass_choices").insert(rows);
    }
  } else if (compassChoicesFromBody?.length) {
    await db().from("node_compass_choices").insert(
      compassChoicesFromBody.map((ch) => ({ node_id: newNode.node_id, rafaga_index: ch.rafaga_index,
        pair_index: ch.pair_index, emoji_left: ch.emoji_left || "", emoji_right: ch.emoji_right || "",
        chosen: ch.chosen_emoji || ch.chosen || "", latency_ms: ch.latency_ms }))
    );
  }

  if (brandChoices?.length) {
    await db().from("node_brand_choices").insert(
      brandChoices.map((ch) => ({ node_id: newNode.node_id, pair_id: ch.pair_id || `brand_${ch.pair_index}`,
        brand_a: ch.brand_a || "", brand_b: ch.brand_b || "",
        chosen: ch.chosen_brand || ch.chosen || "", latency_ms: ch.latency_ms }))
    );
  }

  // Count pending nodes for queue position (always, so frontend can display it)
  const { count: pendingCount } = await db()
    .from("nodes").select("*", { count: "exact", head: true })
    .in("status", ["pending", "active"]);
  const queuePosition = pendingCount || 1;

  // Send welcome message via bot after registration
  if (telegramUserId && botToken()) {
    try {
      await fetch(`https://api.telegram.org/bot${botToken()}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramUserId,
          text: `✅ <b>Registro completo</b>\n\n` +
            `Tu posición en la fila: <b>#${queuePosition}</b>\n\n` +
            `Activá las notificaciones 🔔 que te vamos a avisar por acá cuando estés dentro y tengas un Drop activo para jugar.\n\n` +
            `Tu link de invitación: <b>t.me/BrutalDropBot?start=${newNode.referral_code}</b>\nCompartilo con amigos para subir en la fila.`,
          parse_mode: "HTML",
        }),
      });
    } catch (e) {
      console.error("[BOT] Post-registration message failed:", e);
    }
  }
  return c.json({ ok: true, applicationId: newNode.node_id, referralCode: newNode.referral_code, queuePosition }, 201);
});

app.get("/apply/check", async (c) => {
  const phone = c.req.query("phone");
  if (!phone) return c.json({ error: "phone required" }, 400);
  const clean = "+" + phone.replace(/\D/g, "");
  const { data } = await db().from("nodes")
    .select("node_id, status, referral_code, onboarding_step").eq("phone", clean).single();
  if (!data) return c.json({ exists: false });
  return c.json({ exists: true, nodeId: data.node_id, referralCode: data.referral_code, onboardingStep: data.onboarding_step, status: data.status });
});

// ============================================================================
// PROGRESSIVE ONBOARDING (Option C2) — 4 new endpoints
// ============================================================================

// POST /apply/init — Create node with status 'incomplete' at phone input
// Returns existing node if phone already registered (for resume)
app.post("/apply/init", async (c) => {
  const body = await c.req.json();
  const { phone, telegram_user_id, referred_by_code } = body;
  if (!phone) return c.json({ ok: false, error: "Phone required" }, 400);
  const clean = phone.replace(/\D/g, "");
  if (!clean.startsWith("54") || clean.length < 10 || clean.length > 13) {
    return c.json({ ok: false, error: "Invalid phone" }, 400);
  }
  const normalPhone = "+" + clean;

  // Check if node already exists (resume flow)
  const { data: existing } = await db().from("nodes")
    .select("node_id, status, onboarding_step, referral_code")
    .eq("phone", normalPhone).single();
  if (existing) {
    return c.json({
      ok: true, resumed: true,
      nodeId: existing.node_id,
      referralCode: existing.referral_code,
      onboardingStep: existing.onboarding_step,
      status: existing.status,
    });
  }

  // Resolve referral
  let referredBy = null;
  if (referred_by_code) {
    const { data: ref } = await db().from("nodes")
      .select("node_id").eq("referral_code", referred_by_code).single();
    if (ref) referredBy = ref.node_id;
  }

  // Create incomplete node
  const { data: newNode, error: nodeErr } = await db().from("nodes").insert({
    phone: normalPhone,
    status: "incomplete",
    onboarding_step: 1,
    referred_by: referredBy,
  }).select("node_id, referral_code, status, onboarding_step").single();

  if (nodeErr) return c.json({ ok: false, error: nodeErr.message }, 500);

  // Create profile row
  await db().from("profiles").insert({
    node_id: newNode.node_id, cash_balance: 0, cash_lifetime: 0, cash_withdrawn: 0,
    tickets_current: 0, tickets_lifetime: 0, drops_completed: 0, bot_questions_answered: 0,
    traps_passed: 0, traps_failed: 0, current_streak: 0, best_streak: 0,
  });

  // Create anonymous ID
  await anonId(newNode.node_id);

  // Link Telegram channel if provided
  if (telegram_user_id) {
    await db().from("node_channels").upsert({
      node_id: newNode.node_id, channel: "telegram",
      channel_identifier: String(telegram_user_id), is_primary: true,
    }, { onConflict: "channel,channel_identifier" });
  }

  return c.json({
    ok: true, resumed: false,
    nodeId: newNode.node_id,
    referralCode: newNode.referral_code,
    onboardingStep: 1,
    status: "incomplete",
  }, 201);
});

// PUT /apply/:nodeId/step — Save a single onboarding step progressively
// Core fields (nickname, age, gender, location_*, phone_brand) → columns
// Extra fields (occupation, platforms, spending, financialStress) → onboarding_data jsonb
app.put("/apply/:nodeId/step", async (c) => {
  const nodeId = c.req.param("nodeId");
  const body = await c.req.json();
  const { step, value } = body;
  if (!step || value === undefined) return c.json({ ok: false, error: "step and value required" }, 400);

  // Verify node exists and is incomplete
  const { data: node } = await db().from("nodes")
    .select("node_id, status, onboarding_data").eq("node_id", nodeId).single();
  if (!node) return c.json({ ok: false, error: "Node not found" }, 404);

  // Core fields go to columns directly
  const coreFields = ["nickname", "age", "gender", "location_province", "location_city", "phone_brand"];
  if (coreFields.includes(step)) {
    const { error } = await db().from("nodes").update({ [step]: value }).eq("node_id", nodeId);
    if (error) return c.json({ ok: false, error: error.message }, 500);
  } else {
    // Extra fields go to onboarding_data jsonb
    const current = node.onboarding_data || {};
    current[step] = value;
    const { error } = await db().from("nodes")
      .update({ onboarding_data: current }).eq("node_id", nodeId);
    if (error) return c.json({ ok: false, error: error.message }, 500);
  }

  // Update step counter (use step index or just increment)
  // We track the step name so frontend knows where to resume
  const stepOrder = ["phone", "nickname", "age", "gender", "location", "phone_brand",
    "occupation", "platforms", "spending", "financialStress"];
  const stepIdx = stepOrder.indexOf(step);
  const newStep = stepIdx >= 0 ? stepIdx + 2 : (node.onboarding_data?._step || 1) + 1;
  await db().from("nodes").update({ onboarding_step: newStep }).eq("node_id", nodeId);

  return c.json({ ok: true, step, saved: true });
});

// POST /apply/:nodeId/compass-rafaga — Save one ráfaga of Compass choices with latency
// Called after each of the 5 ráfagas (4 pairs each = 20 total)
app.post("/apply/:nodeId/compass-rafaga", async (c) => {
  const nodeId = c.req.param("nodeId");
  const body = await c.req.json();
  const { rafaga_index, choices } = body;

  if (rafaga_index === undefined || !choices?.length) {
    return c.json({ ok: false, error: "rafaga_index and choices required" }, 400);
  }

  // Verify node exists
  const { data: node } = await db().from("nodes")
    .select("node_id").eq("node_id", nodeId).single();
  if (!node) return c.json({ ok: false, error: "Node not found" }, 404);

  // Delete any existing choices for this ráfaga (idempotent — allows retry)
  await db().from("node_compass_choices")
    .delete().eq("node_id", nodeId).eq("rafaga_index", rafaga_index);

  // Insert all choices for this ráfaga
  // DB columns: node_id, rafaga_index, pair_index, emoji_left, emoji_right, chosen, latency_ms
  const rows = choices.map((ch) => ({
    node_id: nodeId,
    rafaga_index,
    pair_index: ch.pair_index,
    emoji_left: ch.emoji_left,
    emoji_right: ch.emoji_right,
    chosen: ch.chosen,
    latency_ms: ch.latency_ms || null,
  }));

  const { error } = await db().from("node_compass_choices").insert(rows);
  if (error) return c.json({ ok: false, error: error.message }, 500);

  // Update onboarding step to reflect compass progress
  const compassStep = 20 + rafaga_index; // steps 20-24 = ráfagas
  await db().from("nodes").update({ onboarding_step: compassStep }).eq("node_id", nodeId);

  return c.json({ ok: true, rafaga_index, saved: choices.length });
});

// POST /apply/:nodeId/brand-rafaga — Save brand vs brand choices (mini-ráfaga)
// Structurally identical to compass but writes to node_brand_choices
app.post("/apply/:nodeId/brand-rafaga", async (c) => {
  const nodeId = c.req.param("nodeId");
  const body = await c.req.json();
  const { choices } = body;

  if (!choices?.length) {
    return c.json({ ok: false, error: "choices required" }, 400);
  }

  const { data: node } = await db().from("nodes")
    .select("node_id").eq("node_id", nodeId).single();
  if (!node) return c.json({ ok: false, error: "Node not found" }, 404);

  // Delete existing (idempotent)
  await db().from("node_brand_choices").delete().eq("node_id", nodeId);

  // DB columns: node_id, pair_id, brand_a, brand_b, chosen, latency_ms
  const rows = choices.map((ch) => ({
    node_id: nodeId,
    pair_id: ch.pair_id,
    brand_a: ch.brand_a,
    brand_b: ch.brand_b,
    chosen: ch.chosen,
    latency_ms: ch.latency_ms || null,
  }));

  const { error } = await db().from("node_brand_choices").insert(rows);
  if (error) return c.json({ ok: false, error: error.message }, 500);

  await db().from("nodes").update({ onboarding_step: 25 }).eq("node_id", nodeId);
  return c.json({ ok: true, saved: choices.length });
});

// PUT /apply/:nodeId/complete — Finalize onboarding
// Receives computed archetype, vector, handles. Sets status to 'pending'.
app.put("/apply/:nodeId/complete", async (c) => {
  const nodeId = c.req.param("nodeId");
  const body = await c.req.json();
  const { compass_vector, compass_archetype, compass_purity, handles, brand_vector } = body;

  const { data: node } = await db().from("nodes")
    .select("node_id, status, phone").eq("node_id", nodeId).single();
  if (!node) return c.json({ ok: false, error: "Node not found" }, 404);

  // Update node with final computed data
  const { error } = await db().from("nodes").update({
    compass_vector: compass_vector || null,
    compass_archetype: compass_archetype || null,
    brand_vector: brand_vector || null,
    handles: handles || null,
    onboarding_step: 99,
    status: "pending",
  }).eq("node_id", nodeId);

  if (error) return c.json({ ok: false, error: error.message }, 500);

  // Get referral code for response
  const { data: updated } = await db().from("nodes")
    .select("referral_code").eq("node_id", nodeId).single();

  // Send welcome message via bot if telegram channel exists
  const { data: channel } = await db().from("node_channels")
    .select("channel_identifier").eq("node_id", nodeId)
    .eq("channel", "telegram").single();

  if (channel?.channel_identifier && botToken()) {
    const { count } = await db()
      .from("nodes").select("*", { count: "exact", head: true })
      .in("status", ["pending", "active"]);
    const position = count || 1;
    try {
      await fetch(`https://api.telegram.org/bot${botToken()}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: channel.channel_identifier,
          text: `✅ <b>Registro completo</b>\n\n` +
            `Tu posición en la fila: <b>#${position}</b>\n\n` +
            `Activá las notificaciones 🔔 que te vamos a avisar por acá cuando estés dentro y tengas un Drop activo para jugar.\n\n` +
            `Tu link de invitación: <b>t.me/BrutalDropBot?start=${updated?.referral_code || ""}</b>\nCompartilo con amigos para subir en la fila.`,
          parse_mode: "HTML",
        }),
      });
    } catch (e) {
      console.error("[BOT] Post-registration message failed:", e);
    }
  }

  return c.json({
    ok: true,
    nodeId,
    referralCode: updated?.referral_code || null,
    status: "pending",
  });
});

app.post("/link-channel", async (c) => {
  const { code, channel, channel_identifier } = await c.req.json();
  if (!code || !channel || !channel_identifier) return c.json({ error: "Missing fields" }, 400);
  const { data: node } = await db().from("nodes").select("node_id").eq("referral_code", code).single();
  if (!node) return c.json({ error: "Invalid code", linked: false });
  const { data: existing } = await db().from("node_channels").select("id")
    .eq("channel", channel).eq("channel_identifier", channel_identifier).single();
  if (existing) return c.json({ error: "Already linked", linked: false });
  await db().from("node_channels").insert({ node_id: node.node_id, channel, channel_identifier, is_primary: false });
  return c.json({ node_id: node.node_id, linked: true });
});

// ============================================================================
// USER PROFILE and REWARDS — reward-api.ts format
// ============================================================================

app.get("/user/profile", requireTelegram, async (c) => {
  const user = c.get("tgUser");
  const node = await resolveNode(user.id);
  if (!node) return c.json(null, 404);
  const [{ data: profile }, { data: nodeData }, { data: txs }] = await Promise.all([
    db().from("profiles").select("*").eq("node_id", node.node_id).single(),
    db().from("nodes").select("nickname, compass_archetype, created_at, last_active_at").eq("node_id", node.node_id).single(),
    db().from("transactions").select("*").eq("node_id", node.node_id).order("created_at", { ascending: false }).limit(20),
  ]);
  return c.json({
    profile: dbToUserProfile(nodeData, profile, user.id, user),
    transactions: (txs || []).map(dbToTransaction),
  });
});

app.get("/user/:telegramUserId/profile", async (c) => {
  const tgId = parseInt(c.req.param("telegramUserId"));
  if (!tgId) return c.json(null, 400);
  const node = await resolveNode(tgId);
  if (!node) return c.json(null, 404);
  const [{ data: profile }, { data: nodeData }, { data: txs }] = await Promise.all([
    db().from("profiles").select("*").eq("node_id", node.node_id).single(),
    db().from("nodes").select("nickname, compass_archetype, created_at, last_active_at").eq("node_id", node.node_id).single(),
    db().from("transactions").select("*").eq("node_id", node.node_id).order("created_at", { ascending: false }).limit(20),
  ]);
  return c.json({
    profile: dbToUserProfile(nodeData, profile, tgId, null),
    transactions: (txs || []).map(dbToTransaction),
  });
});

app.put("/user/wallet", requireTelegram, async (c) => {
  const user = c.get("tgUser");
  const body = await c.req.json();
  const node = await resolveNode(user.id);
  if (!node) return c.json({ error: "Not found" }, 404);
  await db().from("profiles").update({ wallet_alias: body.walletAlias || body.wallet_alias }).eq("node_id", node.node_id);
  return c.json({ ok: true });
});

app.put("/user/:telegramUserId/wallet", async (c) => {
  const tgId = parseInt(c.req.param("telegramUserId"));
  if (!tgId) return c.json({ error: "Invalid" }, 400);
  const node = await resolveNode(tgId);
  if (!node) return c.json({ error: "Not found" }, 404);
  const body = await c.req.json();
  await db().from("profiles").update({ wallet_alias: body.walletAlias || body.wallet_alias }).eq("node_id", node.node_id);
  return c.json({ ok: true });
});

// ============================================================================
// LEADERBOARD — reward-api.ts LeaderboardResponse format
// ============================================================================

app.get("/leaderboard", async (c) => {
  const limit = parseInt(c.req.query("limit") || "20");
  const { data: season } = await db().from("seasons").select("*").eq("is_active", true).single();
  const { data, error } = await db().from("profiles")
    .select("node_id, tickets_current, tickets_lifetime, drops_completed, bot_questions_answered, nodes(nickname, compass_archetype)")
    .order("tickets_current", { ascending: false }).limit(limit);
  if (error) return c.json({ error: error.message }, 500);
  const { count: totalUsers } = await db().from("profiles").select("*", { count: "exact", head: true });
  const leaderboard = (data || []).map((p, i) => ({
    position: i + 1, telegramUserId: 0,
    username: p.nodes?.nickname || "", firstName: p.nodes?.nickname || "",
    seasonTickets: p.tickets_current, lifetimeTickets: p.tickets_lifetime,
    dropsCompleted: p.drops_completed, botQuestionsAnswered: p.bot_questions_answered || 0,
  }));
  return c.json({
    season: season ? dbToSeason(season) : null,
    leaderboard,
    totalUsers: totalUsers || 0,
  });
});

// ============================================================================
// SEASONS — reward-api.ts Season format
// ============================================================================

app.get("/season", async (c) => {
  const { data } = await db().from("seasons").select("*").eq("is_active", true).single();
  if (!data) return c.json({ error: "No active season" }, 404);
  return c.json(dbToSeason(data));
});

app.post("/season", requirePanel, async (c) => {
  const body = await c.req.json();
  // Deactivate any existing season
  await db().from("seasons").update({ is_active: false }).eq("is_active", true);
  const insertData: any = {
    season_id: body.seasonId || body.season_id || `season-${Date.now()}`,
    name: body.name || "Season 1",
    starts_at: body.startDate || body.start_date || body.starts_at || new Date().toISOString(),
    ends_at: body.endDate || body.end_date || body.ends_at || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    prizes: body.prizes || [],
    is_active: true,
  };
  const { data, error } = await db().from("seasons").insert(insertData).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ season: dbToSeason(data) }, 201);
});

app.put("/season", requirePanel, async (c) => {
  const body = await c.req.json();

  // Check if an active season exists
  const { data: existing } = await db().from("seasons").select("season_id").eq("is_active", true).single();

  if (existing) {
    // UPDATE existing active season
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.startDate || body.start_date || body.starts_at) updateData.starts_at = body.startDate || body.start_date || body.starts_at;
    if (body.endDate || body.end_date || body.ends_at) updateData.ends_at = body.endDate || body.end_date || body.ends_at;
    if (body.prizes) updateData.prizes = body.prizes;
    // Store prize_image_url inside config jsonb (column doesn't exist on table)
    if (body.prizeImageUrl !== undefined || body.prize_image_url !== undefined) {
      updateData.config = { ...(existing as any).config, prizeImageUrl: body.prizeImageUrl ?? body.prize_image_url };
    }

    const { data, error } = await db().from("seasons").update(updateData).eq("season_id", existing.season_id).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ season: dbToSeason(data) });
  } else {
    // CREATE new season (no active season exists — treat PUT as upsert)
    await db().from("seasons").update({ is_active: false }).eq("is_active", true);
    const insertData: any = {
      season_id: body.seasonId || body.season_id || `season-${Date.now()}`,
      name: body.name || "Season 1",
      starts_at: body.startDate || body.start_date || body.starts_at || new Date().toISOString(),
      ends_at: body.endDate || body.end_date || body.ends_at || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      prizes: body.prizes || [],
      is_active: true,
    };
    if (body.prizeImageUrl || body.prize_image_url) {
      insertData.config = { prizeImageUrl: body.prizeImageUrl || body.prize_image_url };
    }
    const { data, error } = await db().from("seasons").insert(insertData).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ season: dbToSeason(data) }, 201);
  }
});

app.post("/season/reset", requirePanel, async (c) => {
  const { data: s } = await db().from("seasons").select("season_id").eq("is_active", true).single();
  if (!s) return c.json({ error: "No active season" }, 400);
  await db().from("profiles").update({ tickets_current: 0 });
  await db().from("seasons").update({ is_active: false }).eq("season_id", s.season_id);
  return c.json({ ok: true, resetCount: 0 });
});

// ============================================================================
// CLAIMS — reward-api.ts Claim format
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
  return c.json({ claims: (data || []).map(dbToClaim) });
});

app.put("/claims/:id", requirePanel, async (c) => {
  const claimId = c.req.param("id");
  const body = await c.req.json();
  const status = body.status;
  const note = body.note || null;
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

  await db().from("claims").update({ status, note, resolved_at: new Date().toISOString() }).eq("claim_id", claimId);
  return c.json({ ok: true, status });
});

// ============================================================================
// ADMIN — NODES
// ============================================================================

// Legacy alias — NodosManager calls /admin/applications
app.get("/admin/applications", requirePanel, async (c) => {
  const limit = parseInt(c.req.query("limit") || "100");
  const offset = parseInt(c.req.query("offset") || "0");
  const status = c.req.query("status");
  const search = c.req.query("search");

  let q = db().from("nodes").select("*, profiles(*)", { count: "exact" })
    .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (status) q = q.eq("status", status);
  if (search) q = q.or(`nickname.ilike.%${search}%,phone.ilike.%${search}%,referral_code.ilike.%${search}%`);

  const { data, count, error } = await q;
  if (error) return c.json({ error: error.message }, 500);

  const applications = (data || []).map((n) => {
    const p = Array.isArray(n.profiles) ? n.profiles[0] : n.profiles || {};
    return {
      applicationId: n.node_id,
      telegramUserId: 0,
      nickname: n.nickname,
      phone: n.phone,
      age: n.age,
      gender: n.gender,
      location: n.location_province,
      status: n.status,
      referralCode: n.referral_code,
      compassArchetype: n.compass_archetype,
      createdAt: n.created_at,
      totalCoins: p.cash_balance || 0,
      seasonTickets: p.tickets_current || 0,
      dropsCompleted: p.drops_completed || 0,
    };
  });

  return c.json({ applications });
});
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

  const users = (data || []).map((n) => {
    const p = Array.isArray(n.profiles) ? n.profiles[0] : n.profiles || {};
    return {
      ...dbToUserProfile(n, p, 0, null),
      applicationId: n.node_id,
      status: n.status,
      node_id: n.node_id,
      phone: n.phone,
      referralCode: n.referral_code,
      compassArchetype: n.compass_archetype,
      age: n.age,
      gender: n.gender,
      locationProvince: n.location_province,
    };
  });

  return c.json({ applications: users, users, count: count || 0 });
});

app.put("/admin/users/:id/status", requirePanel, async (c) => {
  const nodeId = c.req.param("id");
  const { status } = await c.req.json();
  if (!["active", "pending", "blocked", "rejected", "incomplete", "banned"].includes(status)) {
    return c.json({ error: "Invalid status" }, 400);
  }

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

  const updateData: any = { status, updated_at: new Date().toISOString() };
  if (status === "active") updateData.approved_at = new Date().toISOString();

  const { error } = await db().from("nodes").update(updateData).eq("node_id", nodeId);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true, status, application: { applicationId: nodeId, status } });
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

app.post("/admin/reset-tickets", requirePanel, async (c) => {
  const { error } = await db().from("profiles").update({ tickets_current: 0 });
  if (error) return c.json({ error: error.message }, 500);
  const { count } = await db().from("profiles").select("*", { count: "exact", head: true });
  return c.json({ ok: true, resetCount: count || 0 });
});

// ============================================================================
// ADMIN — DROPS (returns PanelDrop format)
// ============================================================================

app.get("/admin/drops", requirePanel, async (c) => {
  const { data } = await db().from("drops")
    .select("*")
    .order("created_at", { ascending: false });
  const drops = (data || []).map(dbDropToPanel);
  // Enrich with question IDs from drop_questions table
  for (const drop of drops) {
    const { data: dqRows } = await db().from("drop_questions")
      .select("question_id").eq("drop_id", drop.id).order("position", { ascending: true });
    if (dqRows?.length) {
      drop.questionIds = dqRows.map(r => r.question_id);
    }
  }
  return c.json(drops);
});

app.post("/admin/drops", requirePanel, async (c) => {
  const body = await c.req.json();
  const insertData: any = {
    name: body.name,
    config: body.config || {},
    status: "draft",
    segment_ids: body.segment_ids || body.segmentIds || null,
    season_id: body.season_id || null,
  };
  // Accept client-generated UUID
  if (body.drop_id || body.id) insertData.drop_id = body.drop_id || body.id;

  const { data, error } = await db().from("drops").insert(insertData).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(dbDropToPanel(data), 201);
});

app.put("/admin/drops/:id", requirePanel, async (c) => {
  const body = await c.req.json();
  const { data, error } = await db().from("drops").update({
    name: body.name, config: body.config,
    segment_ids: body.segment_ids || body.segmentIds, updated_at: new Date().toISOString(),
  }).eq("drop_id", c.req.param("id")).select();
  if (error) return c.json({ error: error.message }, 500);
  if (!data || data.length === 0) return c.json({ error: "Drop not found" }, 404);
  return c.json(dbDropToPanel(data[0]));
});

app.delete("/admin/drops/:id", requirePanel, async (c) => {
  await db().from("drops").delete().eq("drop_id", c.req.param("id")).neq("status", "active");
  return c.json({ ok: true });
});

// ============================================================================
// ADMIN — QUESTIONS (returns PanelQuestion format)
// ============================================================================

app.get("/admin/questions", requirePanel, async (c) => {
  const type = c.req.query("type");
  let q = db().from("questions").select("*").order("created_at", { ascending: false });
  if (type) q = q.eq("type", type);
  const { data, error } = await q;
  if (error) return c.json({ error: error.message }, 500);
  return c.json((data || []).map(dbQuestionToPanel));
});

app.post("/admin/questions", requirePanel, async (c) => {
  const body = await c.req.json();

  // Accept BOTH formats:
  // A) PanelQuestion style: { data: { type, ...config }, label, tags }
  // B) DB style: { type, config, label, tags }
  const type = body.data?.type || body.type;
  const config = body.data || body.config || {};

  // Extract reward from config.reward if top-level fields missing
  let rewardCash = body.reward_cash || 0;
  let rewardTickets = body.reward_tickets || 0;
  if (!rewardCash && !rewardTickets && config?.reward) {
    const rt = config.reward;
    if (rt.type === "coins" || rt.type === "cash") rewardCash = rt.value || 0;
    else if (rt.type === "tickets" || rt.type === "golden_ticket") rewardTickets = rt.value || 0;
  }

  const insertData: any = {
    type,
    config,
    label: body.label || null,
    tags: body.tags || null,
    reward_cash: rewardCash,
    reward_tickets: rewardTickets,
    min_latency_ms: body.min_latency_ms || null,
    signal_pair_id: body.signal_pair_id || null,
    signal_pair_role: body.signal_pair_role || null,
    trap_correct_option: body.trap_correct_option || null,
  };
  // Accept client-generated UUID
  if (body.question_id || body.id) insertData.question_id = body.question_id || body.id;

  const { data, error } = await db().from("questions").insert(insertData).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(dbQuestionToPanel(data), 201);
});

app.put("/admin/questions/:id", requirePanel, async (c) => {
  const body = await c.req.json();
  const type = body.data?.type || body.type;
  const config = body.data || body.config;

  // Extract reward from config.reward if top-level fields missing
  let rewardCash = body.reward_cash || 0;
  let rewardTickets = body.reward_tickets || 0;
  if (!rewardCash && !rewardTickets && config?.reward) {
    const rt = config.reward;
    if (rt.type === "coins" || rt.type === "cash") rewardCash = rt.value || 0;
    else if (rt.type === "tickets" || rt.type === "golden_ticket") rewardTickets = rt.value || 0;
  }

  const { data, error } = await db().from("questions").update({
    type, config,
    label: body.label, tags: body.tags,
    reward_cash: rewardCash, reward_tickets: rewardTickets,
    min_latency_ms: body.min_latency_ms,
    signal_pair_id: body.signal_pair_id,
    signal_pair_role: body.signal_pair_role,
    trap_correct_option: body.trap_correct_option,
  }).eq("question_id", c.req.param("id")).select();
  if (error) return c.json({ error: error.message }, 500);
  if (!data || data.length === 0) return c.json({ error: "Question not found" }, 404);
  return c.json(dbQuestionToPanel(data[0]));
});

app.delete("/admin/questions/:id", requirePanel, async (c) => {
  const qid = c.req.param("id");
  // Remove linkages first (also handled by CASCADE but explicit is safer)
  await db().from("drop_questions").delete().eq("question_id", qid);
  const { error } = await db().from("questions").delete().eq("question_id", qid);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// Drop-question linking
app.get("/admin/drop-questions/:dropId", requirePanel, async (c) => {
  const { data } = await db().from("drop_questions")
    .select("*, questions(*)")
    .eq("drop_id", c.req.param("dropId"))
    .order("position", { ascending: true });
  return c.json((data || []).map((dq) => ({
    ...dq,
    question: dq.questions ? dbQuestionToPanel(dq.questions) : null,
    questions: undefined,
  })));
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
  // Panel typically sends only { rafagas }, so we merge with existing row
  const { data: existing } = await db().from("compass_config").select("*").limit(1).single();
  const merged = {
    config_id: body.config_id || existing?.config_id || "default",
    rafagas: body.rafagas ?? existing?.rafagas ?? [],
    axes: body.axes ?? existing?.axes ?? [],
    archetypes: body.archetypes ?? existing?.archetypes ?? [],
  };
  await db().from("compass_config").delete().neq("config_id", "__never__");
  const { data, error } = await db().from("compass_config").insert(merged).select().single();
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

// ============================================================================
// BOT WEBHOOK — receives Telegram updates
// ============================================================================

app.post("/bot/webhook", async (c) => {
  const update = await c.req.json();
  const botT = botToken();
  
  async function tgSend(method: string, body: any) {
    await fetch(`https://api.telegram.org/bot${botT}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // Handle /start command — smart routing
  if (update.message?.text?.startsWith("/start")) {
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;
    const firstName = update.message.from.first_name || "Node";
    
    const node = await resolveNode(userId);
    
    // Not registered
    if (!node) {
      await tgSend("sendMessage", {
        chat_id: chatId,
        text: `⚡ <b>BRUTAL</b>\n\nHola ${firstName}.\n\nRegistrate para jugar Drops, ganar plata real y competir por premios.`,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[
          { text: "🔥 Entrar", web_app: { url: `https://brutal-production-production-24da.up.railway.app/entrar` } }
        ]] }
      });
      return c.json({ ok: true });
    }
    
    // Pending/incomplete/blocked
    if (node.status !== "active") {
      const msgs = {
        pending: `⏳ Hola ${firstName}, tu cuenta está en revisión. Te avisamos cuando estés dentro.`,
        incomplete: `📝 Hola ${firstName}, te falta completar el registro.`,
        blocked: "🚫 Tu cuenta fue suspendida.",
        rejected: "❌ Tu solicitud no fue aprobada.",
      };
      await tgSend("sendMessage", {
        chat_id: chatId,
        text: msgs[node.status] || "⚠️ Tu cuenta no está activa.",
        parse_mode: "HTML",
        ...(node.status === "incomplete" ? { reply_markup: { inline_keyboard: [[
          { text: "📝 Completar registro", web_app: { url: `https://brutal-production-production-24da.up.railway.app/entrar` } }
        ]] } } : {})
      });
      return c.json({ ok: true });
    }
    
    // Active user — welcome back
    await tgSend("sendMessage", {
      chat_id: chatId,
      text: `⚡ <b>BRUTAL</b>\n\nBienvenido de vuelta, ${firstName}.\n\nUsá /drop para jugar, /perfil para ver tu balance, /leaderboard para el ranking.`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[
        { text: "▶️ Jugar Drop", web_app: { url: `https://brutal-production-production-24da.up.railway.app` } }
      ]] }
    });
    return c.json({ ok: true });
  }

  // Handle /drop command — smart routing
  if (update.message?.text?.startsWith("/drop")) {
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;
    
    // Check if user exists
    const node = await resolveNode(userId);
    
    // Not registered → onboarding
    if (!node) {
      await tgSend("sendMessage", {
        chat_id: chatId,
        text: "⚡ Todavía no sos parte de <b>BRUTAL</b>.\n\nRegistrate para jugar Drops, ganar plata y competir por premios.",
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[
          { text: "🔥 Entrar", web_app: { url: `https://brutal-production-production-24da.up.railway.app/entrar` } }
        ]] }
      });
      return c.json({ ok: true });
    }
    
    // Registered but not active (pending/blocked/etc)
    if (node.status !== "active") {
      const msgs = {
        pending: "⏳ Tu cuenta está en revisión. Te avisamos cuando estés dentro.",
        blocked: "🚫 Tu cuenta fue suspendida.",
        rejected: "❌ Tu solicitud no fue aprobada.",
        incomplete: "📝 Te falta completar el registro.",
      };
      await tgSend("sendMessage", {
        chat_id: chatId,
        text: msgs[node.status] || "⚠️ Tu cuenta no está activa.",
        parse_mode: "HTML",
        ...(node.status === "incomplete" ? { reply_markup: { inline_keyboard: [[
          { text: "📝 Completar registro", web_app: { url: `https://brutal-production-production-24da.up.railway.app/entrar` } }
        ]] } } : {})
      });
      return c.json({ ok: true });
    }
    
    // Active user — check if there's an active drop
    const { data: activeDrop } = await db()
      .from("drops").select("drop_id, name").eq("status", "active").limit(1).single();
    
    if (!activeDrop) {
      await tgSend("sendMessage", {
        chat_id: chatId,
        text: "😴 No hay ningún Drop activo ahora.\n\nQuedate atento, el bot te avisa cuando salga uno nuevo. Mientras tanto, contestá las preguntas que te mande para sumar tickets 🎟️",
        parse_mode: "HTML",
      });
      return c.json({ ok: true });
    }
    
    // Check if already completed this drop
    const { data: done } = await db()
      .from("sessions").select("session_id")
      .eq("node_id", node.node_id).eq("drop_id", activeDrop.drop_id).eq("status", "completed").single();
    
    if (done) {
      await tgSend("sendMessage", {
        chat_id: chatId,
        text: `✅ Ya jugaste <b>${activeDrop.name}</b>.\n\nQuedate atento que el bot te manda preguntas sueltas todo el tiempo y sumás tickets 🎟️ para el sorteo.`,
        parse_mode: "HTML",
      });
      return c.json({ ok: true });
    }
    
    // Active user, active drop, not completed → play!
    await tgSend("sendMessage", {
      chat_id: chatId,
      text: `🎯 <b>${activeDrop.name}</b> está activo.\n\nResponde rápido, ganá monedas y tickets.`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[
        { text: "▶️ Jugar", web_app: { url: `https://brutal-production-production-24da.up.railway.app` } }
      ]] }
    });
    return c.json({ ok: true });
  }

  // Handle /help command
  if (update.message?.text?.startsWith("/help")) {
    const chatId = update.message.chat.id;
    await tgSend("sendMessage", {
      chat_id: chatId,
      text: `⚡ <b>BRUTAL — Comandos</b>\n\n/start — Iniciar\n/drop — Jugar el Drop activo\n/leaderboard — Ver ranking\n/perfil — Tu perfil y balance\n/help — Ver ayuda\n\nLos Drops se publican semanalmente. Respondé rápido, ganá cash y tickets.`,
      parse_mode: "HTML",
    });
    return c.json({ ok: true });
  }
// Handle /leaderboard command
  if (update.message?.text?.startsWith("/leaderboard")) {
    const chatId = update.message.chat.id;
    const { data } = await db().from("profiles")
      .select("tickets_current, nodes(nickname)")
      .order("tickets_current", { ascending: false }).limit(10);
    
    let text = "🏆 <b>LEADERBOARD</b>\n\n";
    if (!data?.length) {
      text += "Todavía no hay jugadores.";
    } else {
      data.forEach((p, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        const name = p.nodes?.nickname || "Anónimo";
        text += `${medal} <b>${name}</b> — ${p.tickets_current || 0} 🎟️\n`;
      });
    }
    await tgSend("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
    return c.json({ ok: true });
  }

  // Handle /perfil command
  if (update.message?.text?.startsWith("/perfil")) {
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;
    const node = await resolveNode(userId);
    if (!node) {
      await tgSend("sendMessage", {
        chat_id: chatId,
        text: "⚠️ No estás registrado. Abrí la app primero.",
        reply_markup: { inline_keyboard: [[
          { text: "🔥 Abrir BRUTAL", web_app: { url: `https://brutal-production-production-24da.up.railway.app/entrar` } }
        ]] }
      });
      return c.json({ ok: true });
    }
    const { data: profile } = await db().from("profiles")
      .select("cash_balance, tickets_current, tickets_lifetime, drops_completed, bot_questions_answered")
      .eq("node_id", node.node_id).single();
    const { data: nd } = await db().from("nodes")
      .select("nickname, compass_archetype, referral_code")
      .eq("node_id", node.node_id).single();
    
    const p = profile || {};
    const text = `⚡ <b>Tu Perfil</b>\n\n` +
      `👤 <b>${nd?.nickname || "Node"}</b>\n` +
      `${nd?.compass_archetype ? `🧭 ${nd.compass_archetype}\n` : ""}` +
      `\n💰 Balance: <b>$${p.cash_balance || 0}</b>\n` +
      `🎟️ Tickets (season): <b>${p.tickets_current || 0}</b>\n` +
      `🎟️ Tickets (lifetime): <b>${p.tickets_lifetime || 0}</b>\n` +
      `📦 Drops completados: <b>${p.drops_completed || 0}</b>\n` +
      `🤖 Bot preguntas: <b>${p.bot_questions_answered || 0}</b>\n` +
      `\n🔗 Tu código: <code>${nd?.referral_code || "—"}</code>`;
    
    await tgSend("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
    return c.json({ ok: true });
  }
  // Handle callback queries (inline keyboard responses from bot questions)
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const userId = cb.from.id;
    const data = cb.callback_data; // format: "bq:<bot_question_id>:<choice_index>"

    // Acknowledge the callback immediately
    await tgSend("answerCallbackQuery", { callback_query_id: cb.id });

    if (data?.startsWith("bq:")) {
      const parts = data.split(":");
      const botQuestionId = parts[1];
      const choiceIndex = parseInt(parts[2]);

      // Resolve node
      const node = await resolveNode(userId);
      if (!node) {
        await tgSend("sendMessage", {
          chat_id: chatId,
          text: "⚠️ No estás registrado. Abrí la app primero.",
          reply_markup: {
            inline_keyboard: [[
              { text: "🔥 Abrir BRUTAL", web_app: { url: `https://brutal-production-production-24da.up.railway.app/entrar` } }
            ]]
          }
        });
        return c.json({ ok: true });
      }

      // Get the bot question + linked question
      const { data: bq } = await db()
        .from("bot_questions").select("*, questions(*)").eq("id", botQuestionId).single();
      
      if (bq?.questions) {
        const q = bq.questions;
        const anonymous_id = await anonId(node.node_id);
        const options = q.config?.options || [];
        const chosenOption = options[choiceIndex] || `option_${choiceIndex}`;

        // Save response
        await db().from("responses").insert({
          node_id: node.node_id,
          anonymous_id,
          question_id: q.question_id,
          drop_id: bq.linked_drop_id || null,
          question_type: q.type,
          choice: typeof chosenOption === "string" ? chosenOption : chosenOption.text || chosenOption.label,
          choice_index: choiceIndex,
          raw_response: { callback_data: data, bot_question_id: botQuestionId },
          source: "bot",
          reward_type: q.reward_cash > 0 ? "cash" : q.reward_tickets > 0 ? "golden_ticket" : null,
          reward_value: q.reward_cash || q.reward_tickets || 0,
          reward_granted: true,
        });

        // Credit rewards
        const rewardCash = q.reward_cash || 0;
        const rewardTickets = q.reward_tickets || 0;
        if (rewardCash > 0) {
          const { data: p } = await db().from("profiles").select("cash_balance, cash_lifetime").eq("node_id", node.node_id).single();
          if (p) await db().from("profiles").update({
            cash_balance: (p.cash_balance || 0) + rewardCash,
            cash_lifetime: (p.cash_lifetime || 0) + rewardCash,
          }).eq("node_id", node.node_id);
        } else if (rewardTickets > 0) {
          const { data: p } = await db().from("profiles").select("tickets_current, tickets_lifetime").eq("node_id", node.node_id).single();
          if (p) await db().from("profiles").update({
            tickets_current: (p.tickets_current || 0) + rewardTickets,
            tickets_lifetime: (p.tickets_lifetime || 0) + rewardTickets,
          }).eq("node_id", node.node_id);
        }

        // Update bot_questions_answered
        const { data: prof } = await db().from("profiles").select("bot_questions_answered").eq("node_id", node.node_id).single();
        if (prof) await db().from("profiles").update({
          bot_questions_answered: (prof.bot_questions_answered || 0) + 1,
        }).eq("node_id", node.node_id);

        // Edit original message to show result
        const rewardText = rewardCash > 0 ? `+$${rewardCash} 💰` : rewardTickets > 0 ? `+${rewardTickets} 🎟️` : "✅";
        await tgSend("editMessageText", {
          chat_id: chatId,
          message_id: cb.message.message_id,
          text: `${cb.message.text}\n\n<b>Tu respuesta:</b> ${typeof chosenOption === "string" ? chosenOption : chosenOption.text || chosenOption.label}\n${rewardText}`,
          parse_mode: "HTML",
        });
      }
    }

    return c.json({ ok: true });
  }

  // Default: ignore other messages
  return c.json({ ok: true });
});
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
  const questions = (data || []).map((bq) => ({
    ...bq,
    question: bq.questions ? dbQuestionToPanel(bq.questions) : null,
    questions: undefined,
  }));
  return c.json({ questions });
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

// ── PUT /bot/questions/:id — Update bot question ──────────────
app.put("/bot/questions/:id", requirePanel, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const update: Record<string, unknown> = {};
  if (body.question_id !== undefined) update.question_id = body.question_id;
  if (body.linked_drop_id !== undefined) update.linked_drop_id = body.linked_drop_id;
  if (body.bot_name !== undefined) update.bot_name = body.bot_name;
  if (body.message_config !== undefined) update.message_config = body.message_config;
  if (body.segment_ids !== undefined) update.segment_ids = body.segment_ids;
  update.updated_at = new Date().toISOString();
  const { data, error } = await db().from("bot_questions").update(update).eq("id", id).select().single();
  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: "Not found" }, 404);
  return c.json(data);
});

// ── DELETE /bot/questions/:id — Delete bot question ───────────
app.delete("/bot/questions/:id", requirePanel, async (c) => {
  const id = c.req.param("id");
  const { error } = await db().from("bot_questions").delete().eq("id", id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// ── GET /bot/subscribers — List nodes with telegram channel ───
app.get("/bot/subscribers", requirePanel, async (c) => {
  const { data, error } = await db()
    .from("node_channels")
    .select("node_id, channel_identifier, is_primary, nodes(nickname, status)")
    .eq("channel", "telegram");
  if (error) return c.json({ error: error.message }, 500);
  const subscribers = (data || []).map((nc: any) => ({
    userId: nc.channel_identifier,
    chatId: nc.channel_identifier,
    firstName: nc.nodes?.nickname || "",
    lastName: "",
    username: nc.nodes?.nickname || "",
    firstSeen: "",
    lastSeen: "",
    active: nc.nodes?.status === "active",
  }));
  return c.json({
    total: subscribers.length,
    active: subscribers.filter((s: any) => s.active).length,
    subscribers,
  });
});

// ── POST /bot/send-question/:id — Send bot question to users ──
app.post("/bot/send-question/:id", requirePanel, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  // Get the bot question with its linked question
  const { data: bq } = await db().from("bot_questions").select("*, questions(*)").eq("id", id).single();
  if (!bq || !bq.questions) return c.json({ error: "Bot question not found or no linked question" }, 404);
  const q = bq.questions as any;
  const text = q.data?.prompt || q.data?.text || "Pregunta BRUTAL";
  const options = q.data?.options || [];
  // Build inline keyboard
  const keyboard = options.map((opt: any, i: number) => ([{
    text: typeof opt === "string" ? opt : opt.text || opt.label || `Opción ${i + 1}`,
    callback_data: `bq:${id}:${i}`,
  }]));
  // Determine target users
  let targetIds: string[] = body.targetTelegramUserIds || [];
  if (targetIds.length === 0) {
    const { data: channels } = await db().from("node_channels")
      .select("channel_identifier, nodes!inner(status)")
      .eq("channel", "telegram");
    targetIds = (channels || []).filter((ch: any) => ch.nodes?.status === "active").map((ch: any) => ch.channel_identifier);
  }
  let sent = 0, failed = 0;
  for (const chatId of targetIds) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken()}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId, text, parse_mode: "HTML",
          reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
        }),
      });
      if ((await res.json()).ok) sent++; else failed++;
    } catch { failed++; }
  }
  // Update sent count
  await db().from("bot_questions").update({
    sent_count: (bq.sent_count || 0) + sent,
    last_sent_at: new Date().toISOString(),
  }).eq("id", id);
  return c.json({ sent, failed, total: targetIds.length });
});

// ── POST /bot/send-notification — Send notification to users ──
app.post("/bot/send-notification", requirePanel, async (c) => {
  const body = await c.req.json();
  const { text, type, imageUrl, buttonText, buttonUrl, targetTelegramUserIds } = body;
  if (!text) return c.json({ error: "text required" }, 400);
  // Determine target users
  let targetIds: string[] = targetTelegramUserIds || [];
  if (targetIds.length === 0) {
    const { data: channels } = await db().from("node_channels")
      .select("channel_identifier, nodes!inner(status)")
      .eq("channel", "telegram");
    targetIds = (channels || []).filter((ch: any) => ch.nodes?.status === "active").map((ch: any) => ch.channel_identifier);
  }
  // Build message
  let replyMarkup: any = undefined;
  if (type === "drop" && buttonText) {
    // Mini App button for drop
    replyMarkup = { inline_keyboard: [[{ text: buttonText, web_app: { url: `https://brutal-production-production-24da.up.railway.app/` } }]] };
  } else if (buttonText && buttonUrl) {
    replyMarkup = { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] };
  }
  let sent = 0, failed = 0;
  for (const chatId of targetIds) {
    try {
      const msgBody: any = { chat_id: chatId, text, parse_mode: "HTML" };
      if (replyMarkup) msgBody.reply_markup = replyMarkup;
      // If there's an image, send photo instead
      if (imageUrl) {
        const res = await fetch(`https://api.telegram.org/bot${botToken()}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, photo: imageUrl, caption: text, parse_mode: "HTML", reply_markup: replyMarkup }),
        });
        if ((await res.json()).ok) sent++; else failed++;
      } else {
        const res = await fetch(`https://api.telegram.org/bot${botToken()}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msgBody),
        });
        if ((await res.json()).ok) sent++; else failed++;
      }
    } catch { failed++; }
  }
  return c.json({ sent, failed, total: targetIds.length });
});

// ── POST /bot/poll — Manual poll trigger (webhook mode - returns bot info) ──
app.post("/bot/poll", requirePanel, async (c) => {
  try {
    // In webhook mode, we can't use getUpdates. Return bot status instead.
    const res = await fetch(`https://api.telegram.org/bot${botToken()}/getWebhookInfo`);
    const data = await res.json() as any;
    if (!data.ok) return c.json({ ok: false, error: "Telegram API error" });
    const info = data.result;
    return c.json({
      ok: true,
      mode: "webhook",
      url: info.url || "(not set)",
      pending_update_count: info.pending_update_count || 0,
      last_error_date: info.last_error_date || null,
      last_error_message: info.last_error_message || null,
    });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message });
  }
});

// ── POST /admin/users/bulk-status — Bulk update user status ───
app.post("/admin/users/bulk-status", requirePanel, async (c) => {
  const { ids, status } = await c.req.json();
  if (!ids || !Array.isArray(ids) || !status) return c.json({ error: "ids (array) and status required" }, 400);
  const validStatuses = ["active", "pending", "blocked"];
  if (!validStatuses.includes(status)) return c.json({ error: `Invalid status. Must be: ${validStatuses.join(", ")}` }, 400);
  const update: Record<string, unknown> = { status };
  if (status === "active") update.approved_at = new Date().toISOString();
  let updated = 0;
  for (const id of ids) {
    const { error } = await db().from("nodes").update(update).eq("node_id", id);
    if (!error) updated++;
  }
  return c.json({ ok: true, updated, total: ids.length });
});

// ── PUT /admin/segments/:id — Update segment ─────────────────
app.put("/admin/segments/:id", requirePanel, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.filters !== undefined) update.filters = body.filters;
  if (body.description !== undefined) update.description = body.description;
  update.updated_at = new Date().toISOString();
  const { data, error } = await db().from("segments").update(update).eq("segment_id", id).select().single();
  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: "Segment not found" }, 404);
  return c.json(data);
});

// ── GET /admin/segments/:id/telegram-users — Get telegram IDs for segment ──
app.get("/admin/segments/:id/telegram-users", requirePanel, async (c) => {
  const id = c.req.param("id");
  const { data: segment } = await db().from("segments").select("filters").eq("segment_id", id).single();
  if (!segment) return c.json({ error: "Segment not found" }, 404);
  // Get all active telegram users (basic implementation — can be refined with actual filter logic)
  const { data: channels } = await db().from("node_channels")
    .select("channel_identifier, nodes!inner(status)")
    .eq("channel", "telegram");
  const telegramUserIds = (channels || [])
    .filter((ch: any) => ch.nodes?.status === "active")
    .map((ch: any) => ch.channel_identifier);
  return c.json({ telegramUserIds });
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
// STATIC FILES — Serve Vite build
// ============================================================================

app.use("/assets/*", serveStatic({ root: "./dist" }));

// SPA fallback — serve index.html for all non-API routes
app.get("*", (c) => {
  const indexPath = "./dist/index.html";
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, "utf-8");
    return c.html(html);
  }
  return c.json({ error: "Frontend not built" }, 404);
});

// ============================================================================
// ERROR & 404
// ============================================================================

app.onError((err, c) => {
  console.error("[BRUTAL]", err);
  return c.json({ error: "Internal server error" }, 500);
});

// ============================================================================
// START
// ============================================================================

const port = parseInt(process.env.PORT || "3000");
console.log(`[BRUTAL] Server v3.0 starting on port ${port}`);
serve({ fetch: app.fetch, port });
