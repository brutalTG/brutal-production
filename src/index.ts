/**
 * BRUTAL — Production Server v2.0
 * Node.js + Hono + Supabase PostgreSQL
 *
 * Implements decisions D1-D14 from DECISIONS_LOG
 *
 * Env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *           TELEGRAM_BOT_TOKEN, PANEL_PASSWORD, PORT
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

// ============================================================================
// TYPES
// ============================================================================

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface GateResult {
  status: "granted" | "unregistered" | "denied" | "completed";
  reason?: string;
  node_id?: string;
}

// ============================================================================
// INIT
// ============================================================================

const app = new Hono();

let _adminClient: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _adminClient;
}

function botToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

// ============================================================================
// CORS
// ============================================================================

app.use("*", cors({
  origin: "*", // Tighten in production to your Railway domain
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-Telegram-Init-Data", "X-Panel-Token"],
  maxAge: 86400,
}));

// ============================================================================
// TELEGRAM INIT DATA VALIDATION
//
// Cómo funciona (ELI5):
// Telegram firma los datos del usuario con tu bot token.
// Nosotros re-calculamos esa firma. Si coincide → el request es real.
// Si no coincide → alguien está inventando datos.
// ============================================================================

function validateInitData(initData: string): TelegramUser | null {
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
    const computedHash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (computedHash !== hash) return null;

    // Allow 24h window
    const authDate = parseInt(params.get("auth_date") || "0");
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return null;

    const userStr = params.get("user");
    if (!userStr) return null;
    return JSON.parse(userStr) as TelegramUser;
  } catch {
    return null;
  }
}

// Middleware: require valid Telegram initData
async function requireTelegram(c: any, next: () => Promise<void>) {
  const initData = c.req.header("X-Telegram-Init-Data");
  if (!initData) return c.json({ error: "Missing Telegram initData" }, 401);
  const user = validateInitData(initData);
  if (!user) return c.json({ error: "Invalid Telegram initData" }, 401);
  c.set("tgUser", user);
  await next();
}

// Middleware: require panel password
async function requirePanel(c: any, next: () => Promise<void>) {
  const token = c.req.header("X-Panel-Token");
  const expected = process.env.PANEL_PASSWORD || "brutal-admin";
  if (token !== expected) return c.json({ error: "Unauthorized" }, 401);
  await next();
}

// ============================================================================
// HELPERS
// ============================================================================

/** D6: Resolve node_id from Telegram user via node_channels */
async function resolveNode(telegramUserId: number): Promise<{ node_id: string; status: string } | null> {
  const { data: ch } = await db()
    .from("node_channels")
    .select("node_id")
    .eq("channel_type", "telegram")
    .eq("channel_identifier", String(telegramUserId))
    .single();
  if (!ch) return null;

  const { data: node } = await db()
    .from("nodes")
    .select("id, status")
    .eq("id", ch.node_id)
    .single();
  if (!node) return null;
  return { node_id: node.id, status: node.status };
}

/** Get or create anonymous ID for a node */
async function anonId(nodeId: string): Promise<string | null> {
  const { data, error } = await db().rpc("get_anonymous_id", { p_node_id: nodeId });
  if (error) return null;
  return data;
}

/** D9/D10: Credit reward to a node */
async function creditReward(
  nodeId: string, type: "cash" | "tickets", amount: number,
  source: string, sourceId?: string
): Promise<boolean> {
  const { error } = await db().rpc("credit_reward", {
    p_node_id: nodeId, p_type: type, p_amount: amount,
    p_source: source, p_source_id: sourceId || null,
  });
  return !error;
}

// ============================================================================
// HEALTH
// ============================================================================

app.get("/health", (c) => c.json({ status: "ok", version: "2.0.0" }));

// ============================================================================
// GATE CHECK — D7
// One request: can this user play this drop?
// Returns: granted / unregistered / denied (reason) / completed
// ============================================================================

app.get("/gate", requireTelegram, async (c) => {
  const user = c.get("tgUser") as TelegramUser;
  const dropId = c.req.query("drop_id");

  const node = await resolveNode(user.id);
  if (!node) return c.json<GateResult>({ status: "unregistered" });

  if (node.status !== "active") {
    return c.json<GateResult>({ status: "denied", reason: node.status });
  }

  if (dropId) {
    const { data: done } = await db()
      .from("sessions")
      .select("id")
      .eq("node_id", node.node_id)
      .eq("drop_id", dropId)
      .eq("completed", true)
      .single();
    if (done) return c.json<GateResult>({ status: "completed" });
  }

  return c.json<GateResult>({ status: "granted", node_id: node.node_id });
});

// ============================================================================
// DROPS
// ============================================================================

// Get active drop (public, after gate)
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

// Publish a drop (admin)
app.put("/active-drop", requirePanel, async (c) => {
  const { drop_id } = await c.req.json();
  if (!drop_id) return c.json({ error: "drop_id required" }, 400);

  // Archive current active
  await db().from("drops").update({ status: "archived" }).eq("status", "active");

  // Activate new
  const { data, error } = await db()
    .from("drops")
    .update({ status: "active", published_at: new Date().toISOString() })
    .eq("id", drop_id)
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Deactivate (admin)
app.delete("/active-drop", requirePanel, async (c) => {
  await db().from("drops").update({ status: "archived" }).eq("status", "active");
  return c.json({ ok: true });
});

// Preview drop (admin)
app.get("/preview-drop", requirePanel, async (c) => {
  const { data } = await db()
    .from("drops").select("*").eq("status", "preview").limit(1).single();
  if (!data) return c.json({ error: "No preview drop" }, 404);
  return c.json(data);
});

app.put("/preview-drop", requirePanel, async (c) => {
  const { drop_id } = await c.req.json();
  await db().from("drops").update({ status: "draft" }).eq("status", "preview");
  const { data, error } = await db()
    .from("drops").update({ status: "preview" }).eq("id", drop_id).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ============================================================================
// SESSIONS — Start / Complete
// ============================================================================

// Start session
app.post("/sessions/start", requireTelegram, async (c) => {
  const user = c.get("tgUser") as TelegramUser;
  const { drop_id } = await c.req.json();
  if (!drop_id) return c.json({ error: "drop_id required" }, 400);

  const node = await resolveNode(user.id);
  if (!node || node.status !== "active") return c.json({ error: "Not authorized" }, 403);

  // Check existing
  const { data: existing } = await db()
    .from("sessions")
    .select("id, current_question_index, completed")
    .eq("node_id", node.node_id)
    .eq("drop_id", drop_id)
    .single();

  if (existing) {
    if (existing.completed) return c.json({ error: "Already completed" }, 409);
    return c.json({ session_id: existing.id, resumed: true, current_index: existing.current_question_index });
  }

  const anonymous_id = await anonId(node.node_id);

  const { data: session, error } = await db()
    .from("sessions")
    .insert({
      node_id: node.node_id,
      drop_id,
      anonymous_id,
      started_at: new Date().toISOString(),
      current_question_index: 0,
      total_cash_earned: 0,
      total_tickets_earned: 0,
      trap_score: 0,
      traps_total: 0,
    })
    .select("id")
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ session_id: session.id, resumed: false, current_index: 0 });
});

// Complete session
app.post("/sessions/complete", requireTelegram, async (c) => {
  const user = c.get("tgUser") as TelegramUser;
  const { session_id, archetype_data, signal_pairs } = await c.req.json();
  if (!session_id) return c.json({ error: "session_id required" }, 400);

  const node = await resolveNode(user.id);
  if (!node) return c.json({ error: "Not authorized" }, 403);

  // Sum rewards from responses
  const { data: totals } = await db()
    .from("responses")
    .select("cash_earned, tickets_earned")
    .eq("session_id", session_id);

  const totalCash = totals?.reduce((s, r) => s + (r.cash_earned || 0), 0) || 0;
  const totalTickets = totals?.reduce((s, r) => s + (r.tickets_earned || 0), 0) || 0;

  // Count traps
  const { data: traps } = await db()
    .from("responses")
    .select("response_data")
    .eq("session_id", session_id)
    .in("question_type", ["trap", "trap_silent"]);

  const trapsTotal = traps?.length || 0;
  const trapsPassed = traps?.filter((t: any) => t.response_data?.correct === true).length || 0;

  const { error } = await db()
    .from("sessions")
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
      total_cash_earned: totalCash,
      total_tickets_earned: totalTickets,
      trap_score: trapsPassed,
      traps_total: trapsTotal,
      archetype_data: archetype_data || null,
      signal_pairs: signal_pairs || null,
    })
    .eq("id", session_id)
    .eq("node_id", node.node_id);

  if (error) return c.json({ error: error.message }, 500);

  // Increment drops completed on profile
  await db().rpc("increment_drops_completed", { p_node_id: node.node_id });

  return c.json({ ok: true, total_cash: totalCash, total_tickets: totalTickets, trap_score: `${trapsPassed}/${trapsTotal}` });
});

// ============================================================================
// RESPONSES — Per-card signal capture (D11, D12)
// THE most important endpoint. One row per answer.
// ============================================================================

app.post("/responses", requireTelegram, async (c) => {
  const user = c.get("tgUser") as TelegramUser;
  const body = await c.req.json();
  const {
    session_id, drop_id, question_id, question_index,
    question_type, response_data, latency_ms,
    source_type, is_brand_card, reward_amount,
  } = body;

  if (!session_id || !question_id || response_data === undefined || latency_ms === undefined) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const node = await resolveNode(user.id);
  if (!node || node.status !== "active") return c.json({ error: "Not authorized" }, 403);

  const anonymous_id = await anonId(node.node_id);

  // --- D12: Latency threshold check ---
  const { data: config } = await db()
    .from("admin_config").select("value").eq("key", "latency_thresholds").single();

  const thresholds: Record<string, number> = config?.value || {
    binary: 400, slider: 800, ranking: 800,
    confesionario: 2000, rafaga_item: 300, default: 400,
  };

  const thKey = question_type?.includes("slider") ? "slider"
    : question_type?.includes("rank") ? "ranking"
    : question_type?.includes("confesionario") ? "confesionario"
    : question_type?.includes("rafaga") ? "rafaga_item"
    : "binary";

  const minLatency = thresholds[thKey] || thresholds.default || 400;
  const belowThreshold = latency_ms < minLatency;

  // Rewards only if above threshold
  let cashEarned = 0;
  let ticketsEarned = 0;
  if (!belowThreshold && (reward_amount || 0) > 0) {
    if (is_brand_card) cashEarned = reward_amount;
    else ticketsEarned = reward_amount;
  }

  // Insert response
  const { data: resp, error } = await db()
    .from("responses")
    .insert({
      session_id, anonymous_id, drop_id: drop_id || null,
      question_id, question_index: question_index ?? null,
      question_type: question_type || null,
      response_data, latency_ms,
      below_threshold: belowThreshold,
      source_type: source_type || "drop",
      cash_earned: cashEarned, tickets_earned: ticketsEarned,
    })
    .select("id")
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // Credit rewards
  if (cashEarned > 0) await creditReward(node.node_id, "cash", cashEarned, "drop_card", question_id);
  if (ticketsEarned > 0) await creditReward(node.node_id, "tickets", ticketsEarned, "drop_card", question_id);

  // Update session progress
  await db().from("sessions")
    .update({ current_question_index: (question_index ?? 0) + 1 })
    .eq("id", session_id);

  return c.json({
    response_id: resp.id, below_threshold: belowThreshold,
    cash_earned: cashEarned, tickets_earned: ticketsEarned,
  });
});

// ============================================================================
// ONBOARDING — D1, D2, D3, D4, D5, D8
// ============================================================================

app.post("/apply", async (c) => {
  const body = await c.req.json();
  const {
    phone, nickname, age, gender, location, phone_brand,
    compass_vector, compass_archetype, compass_choices,
    brand_choices, handles, referred_by_code, telegram_user_id,
  } = body;

  // D3: Phone validation
  if (!phone) return c.json({ error: "Phone required" }, 400);
  const clean = phone.replace(/\D/g, "");
  if (!clean.startsWith("54") || clean.length !== 12) {
    return c.json({ error: "Invalid phone. Format: +54 + 10 digits" }, 400);
  }
  const normalPhone = "+" + clean;

  // Check duplicate
  const { data: exists } = await db()
    .from("nodes").select("id, status").eq("phone", normalPhone).single();
  if (exists) return c.json({ error: "Phone already registered", status: exists.status }, 409);

  // D8: Resolve referrer
  let referredBy: string | null = null;
  if (referred_by_code) {
    const { data: ref } = await db()
      .from("nodes").select("id").eq("referral_code", referred_by_code).single();
    if (ref) referredBy = ref.id;
  }

  // D1: Create node
  const { data: newNode, error: nodeErr } = await db()
    .from("nodes")
    .insert({
      phone: normalPhone, nickname: nickname || null,
      age: age || null, gender: gender || null,
      location: location || null, phone_brand: phone_brand || null,
      compass_vector: compass_vector || null,
      compass_archetype: compass_archetype || null,
      handles: handles || null, referred_by: referredBy,
      status: (nickname && age && gender) ? "pending" : "incomplete",
    })
    .select("id, referral_code, status")
    .single();

  if (nodeErr) return c.json({ error: nodeErr.message }, 500);

  // Create profile
  await db().from("profiles").insert({
    node_id: newNode.id, total_cash: 0,
    season_tickets: 0, lifetime_tickets: 0, drops_completed: 0,
  });

  // D6: Link Telegram channel
  if (telegram_user_id) {
    await db().from("node_channels").insert({
      node_id: newNode.id, channel_type: "telegram",
      channel_identifier: String(telegram_user_id),
    });
  }

  // D5: Save compass choices
  if (compass_choices?.length) {
    await db().from("node_compass_choices").insert(
      compass_choices.map((ch: any) => ({
        node_id: newNode.id, rafaga_index: ch.rafaga_index,
        pair_index: ch.pair_index, chosen_emoji: ch.chosen_emoji,
        latency_ms: ch.latency_ms,
      }))
    );
  }

  // D4: Save brand choices
  if (brand_choices?.length) {
    await db().from("node_brand_choices").insert(
      brand_choices.map((ch: any) => ({
        node_id: newNode.id, pair_index: ch.pair_index,
        chosen_brand: ch.chosen_brand, latency_ms: ch.latency_ms,
      }))
    );
  }

  return c.json({ node_id: newNode.id, referral_code: newNode.referral_code, status: newNode.status }, 201);
});

// Check existing application
app.get("/apply/check", async (c) => {
  const phone = c.req.query("phone");
  if (!phone) return c.json({ error: "phone required" }, 400);
  const clean = "+" + phone.replace(/\D/g, "");

  const { data } = await db()
    .from("nodes")
    .select("id, status, nickname, referral_code, created_at")
    .eq("phone", clean).single();

  if (!data) return c.json({ exists: false });
  return c.json({ exists: true, ...data });
});

// D8: Deep link — link Telegram to existing node
app.post("/link-channel", async (c) => {
  const { code, channel_type, channel_identifier } = await c.req.json();
  if (!code || !channel_type || !channel_identifier) {
    return c.json({ error: "code, channel_type, channel_identifier required" }, 400);
  }
  const { data, error } = await db().rpc("link_channel_by_code", {
    p_code: code, p_channel_type: channel_type, p_channel_identifier: channel_identifier,
  });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || { linked: true });
});

// ============================================================================
// USER PROFILE & REWARDS
// ============================================================================

app.get("/user/profile", requireTelegram, async (c) => {
  const user = c.get("tgUser") as TelegramUser;
  const node = await resolveNode(user.id);
  if (!node) return c.json({ error: "Not found" }, 404);

  const [{ data: profile }, { data: nodeData }, { data: txs }] = await Promise.all([
    db().from("profiles").select("*").eq("node_id", node.node_id).single(),
    db().from("nodes").select("nickname, compass_archetype, compass_vector, referral_code, created_at").eq("id", node.node_id).single(),
    db().from("transactions").select("*").eq("node_id", node.node_id).order("created_at", { ascending: false }).limit(20),
  ]);

  return c.json({ node_id: node.node_id, ...nodeData, ...profile, transactions: txs || [] });
});

app.put("/user/wallet", requireTelegram, async (c) => {
  const user = c.get("tgUser") as TelegramUser;
  const { wallet_alias } = await c.req.json();
  const node = await resolveNode(user.id);
  if (!node) return c.json({ error: "Not found" }, 404);

  await db().from("profiles").update({ wallet_alias }).eq("node_id", node.node_id);
  return c.json({ ok: true });
});

// ============================================================================
// LEADERBOARD — D10
// ============================================================================

app.get("/leaderboard", async (c) => {
  const limit = parseInt(c.req.query("limit") || "20");
  const { data, error } = await db().from("leaderboard").select("*").limit(limit);
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

// ============================================================================
// SEASONS — D10
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
  const { data: s } = await db().from("seasons").select("id").eq("is_active", true).single();
  if (!s) return c.json({ error: "No active season" }, 400);
  const { error } = await db().rpc("reset_season_tickets", { p_season_id: s.id });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true, reset_season: s.id });
});

// ============================================================================
// CLAIMS — D9
// ============================================================================

app.post("/claim-rewards", requireTelegram, async (c) => {
  const user = c.get("tgUser") as TelegramUser;
  const { amount } = await c.req.json();
  const node = await resolveNode(user.id);
  if (!node) return c.json({ error: "Not found" }, 404);

  const { data: profile } = await db()
    .from("profiles").select("total_cash, wallet_alias").eq("node_id", node.node_id).single();
  if (!profile) return c.json({ error: "Profile not found" }, 404);

  const { data: cfgMin } = await db()
    .from("admin_config").select("value").eq("key", "withdrawal_minimum").single();
  const minW = cfgMin?.value || 10;

  if ((amount || profile.total_cash) < minW) return c.json({ error: `Minimum $${minW} USD` }, 400);
  if (!profile.wallet_alias) return c.json({ error: "Link wallet first" }, 400);

  const { data: pending } = await db()
    .from("claims").select("id").eq("node_id", node.node_id).eq("status", "pending").single();
  if (pending) return c.json({ error: "Pending claim exists", claim_id: pending.id }, 409);

  const claimAmt = amount || profile.total_cash;
  const { data: claim, error } = await db()
    .from("claims")
    .insert({ node_id: node.node_id, amount: claimAmt, wallet_alias: profile.wallet_alias, status: "pending" })
    .select("id").single();
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ claim_id: claim.id, amount: claimAmt, status: "pending" });
});

app.get("/claims", requirePanel, async (c) => {
  const { data, error } = await db()
    .from("claims").select("*, nodes!inner(nickname, phone)")
    .order("created_at", { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.put("/claims/:id", requirePanel, async (c) => {
  const claimId = c.req.param("id");
  const { status } = await c.req.json();
  if (!["approved", "rejected"].includes(status)) return c.json({ error: "Invalid status" }, 400);

  const { data: claim } = await db()
    .from("claims").select("node_id, amount, status").eq("id", claimId).single();
  if (!claim) return c.json({ error: "Not found" }, 404);
  if (claim.status !== "pending") return c.json({ error: "Already resolved" }, 409);

  if (status === "approved") {
    await db().from("profiles").update({ total_cash: 0 }).eq("node_id", claim.node_id);
    await db().from("transactions").insert({
      node_id: claim.node_id, reward_type: "cash",
      amount: -claim.amount, source: "withdrawal", source_id: claimId,
    });
  }

  await db().from("claims").update({ status, resolved_at: new Date().toISOString() }).eq("id", claimId);
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

// D8: Referral bonus on activation
app.put("/admin/users/:id/status", requirePanel, async (c) => {
  const nodeId = c.req.param("id");
  const { status } = await c.req.json();
  if (!["active", "pending", "blocked", "rejected"].includes(status)) {
    return c.json({ error: "Invalid status" }, 400);
  }

  if (status === "active") {
    const { data: nd } = await db()
      .from("nodes").select("referred_by, status").eq("id", nodeId).single();
    if (nd?.referred_by && nd.status !== "active") {
      const { data: bonusCfg } = await db()
        .from("admin_config").select("value").eq("key", "referral_bonus_tickets").single();
      await creditReward(nd.referred_by, "tickets", bonusCfg?.value || 50, "referral", nodeId);
    }
  }

  const { error } = await db().from("nodes")
    .update({ status, updated_at: new Date().toISOString() }).eq("id", nodeId);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true, status });
});

app.delete("/admin/users/:id", requirePanel, async (c) => {
  await db().from("nodes").update({ status: "deleted", updated_at: new Date().toISOString() }).eq("id", c.req.param("id"));
  return c.json({ ok: true });
});

app.get("/admin/users/export", requirePanel, async (c) => {
  const { data } = await db().from("nodes")
    .select("id, nickname, phone, age, gender, location, status, compass_archetype, referral_code, created_at, profiles(total_cash, season_tickets, drops_completed)")
    .order("created_at", { ascending: false });

  if (!data?.length) return c.text("No data");

  const hdr = "id,nickname,phone,age,gender,location,status,archetype,referral_code,cash,tickets,drops,created_at";
  const rows = data.map((n: any) => {
    const p = Array.isArray(n.profiles) ? n.profiles[0] : n.profiles || {};
    return `${n.id},${n.nickname||""},${n.phone||""},${n.age||""},${n.gender||""},${n.location||""},${n.status},${n.compass_archetype||""},${n.referral_code||""},${p.total_cash||0},${p.season_tickets||0},${p.drops_completed||0},${n.created_at}`;
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
    .select("id, name, status, segment_ids, created_at, published_at")
    .order("created_at", { ascending: false });
  return c.json(data || []);
});

app.post("/admin/drops", requirePanel, async (c) => {
  const body = await c.req.json();
  const { data, error } = await db().from("drops").insert({
    id: body.id || crypto.randomUUID(), name: body.name,
    config: body.config || body, status: "draft",
    segment_ids: body.segment_ids || null, season_id: body.season_id || null,
  }).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

app.put("/admin/drops/:id", requirePanel, async (c) => {
  const body = await c.req.json();
  const { data, error } = await db().from("drops").update({
    name: body.name, config: body.config || body,
    segment_ids: body.segment_ids, updated_at: new Date().toISOString(),
  }).eq("id", c.req.param("id")).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.delete("/admin/drops/:id", requirePanel, async (c) => {
  await db().from("drops").delete().eq("id", c.req.param("id")).neq("status", "active");
  return c.json({ ok: true });
});

// ============================================================================
// ADMIN — QUESTIONS
// ============================================================================

app.get("/admin/questions", requirePanel, async (c) => {
  const type = c.req.query("type");
  const search = c.req.query("search");
  let q = db().from("questions").select("*").order("created_at", { ascending: false });
  if (type) q = q.eq("type", type);
  if (search) q = q.or(`label.ilike.%${search}%`);
  const { data, error } = await q;
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.post("/admin/questions", requirePanel, async (c) => {
  const body = await c.req.json();
  const { data, error } = await db().from("questions").insert({
    type: body.type, data: body.data || body, label: body.label || null, tags: body.tags || null,
  }).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

app.put("/admin/questions/:id", requirePanel, async (c) => {
  const body = await c.req.json();
  const { data, error } = await db().from("questions").update({
    type: body.type, data: body.data || body, label: body.label, tags: body.tags,
  }).eq("id", c.req.param("id")).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.delete("/admin/questions/:id", requirePanel, async (c) => {
  await db().from("questions").delete().eq("id", c.req.param("id"));
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
  const { data, error } = await db().from("segments").insert({ name: body.name, filters: body.filters }).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

app.delete("/admin/segments/:id", requirePanel, async (c) => {
  await db().from("segments").delete().eq("id", c.req.param("id"));
  return c.json({ ok: true });
});

// ============================================================================
// COMPASS & BRAND CONFIG — D4, D5
// ============================================================================

app.get("/compass-config", async (c) => {
  const { data } = await db().from("compass_config").select("rafagas, updated_at").eq("id", "current").single();
  return c.json(data || { rafagas: [] });
});

app.put("/compass-config", requirePanel, async (c) => {
  const body = await c.req.json();
  const { data, error } = await db().from("compass_config").upsert({
    id: "current", rafagas: body.rafagas, updated_at: new Date().toISOString(),
  }).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.get("/brand-config", async (c) => {
  const { data } = await db().from("brand_config").select("pairs, updated_at").eq("id", "current").single();
  return c.json(data || { pairs: [] });
});

app.put("/brand-config", requirePanel, async (c) => {
  const body = await c.req.json();
  const { data, error } = await db().from("brand_config").upsert({
    id: "current", pairs: body.pairs, updated_at: new Date().toISOString(),
  }).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ============================================================================
// ADMIN CONFIG — D12 thresholds, withdrawal min, referral bonus
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
// PANEL AUTH & DATA SYNC
// ============================================================================

app.post("/panel-auth", async (c) => {
  const { password } = await c.req.json();
  if (password === (process.env.PANEL_PASSWORD || "brutal-admin")) {
    return c.json({ authenticated: true, token: password });
  }
  return c.json({ authenticated: false }, 401);
});

app.get("/panel-data", requirePanel, async (c) => {
  const [{ data: questions }, { data: drops }] = await Promise.all([
    db().from("questions").select("*").order("created_at", { ascending: false }),
    db().from("drops").select("*").order("created_at", { ascending: false }),
  ]);
  return c.json({ questions: questions || [], drops: drops || [] });
});

app.put("/panel-data", requirePanel, async (c) => {
  const body = await c.req.json();
  if (body.questions?.length) {
    for (const q of body.questions) {
      await db().from("questions").upsert({ id: q.id, type: q.type, data: q.data || q, label: q.label, tags: q.tags });
    }
  }
  if (body.drops?.length) {
    for (const d of body.drops) {
      await db().from("drops").upsert({ id: d.id, name: d.name, config: d.config || d, status: d.status || "draft", segment_ids: d.segment_ids });
    }
  }
  return c.json({ ok: true });
});

// ============================================================================
// BOT — Telegram messaging + standalone questions (D11, D13)
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
  const { data } = await db().from("bot_questions").select("*").order("created_at", { ascending: false });
  return c.json(data || []);
});

app.post("/bot/questions", requirePanel, async (c) => {
  const body = await c.req.json();
  const { data, error } = await db().from("bot_questions").insert({
    question_id: body.question_id, drop_id: body.drop_id || null,
    reward_type: body.reward_type || "tickets", reward_amount: body.reward_amount || 5,
    is_active: body.is_active ?? true,
  }).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

// ============================================================================
// ANALYSIS (anonymized views)
// ============================================================================

app.get("/analysis/responses", requirePanel, async (c) => {
  const dropId = c.req.query("drop_id");
  let q = db().from("analysis_responses").select("*").order("created_at", { ascending: true });
  if (dropId) q = q.eq("drop_id", dropId);
  const { data, error } = await q;
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.get("/analysis/drop-summary", requirePanel, async (c) => {
  const dropId = c.req.query("drop_id");
  let q = db().from("analysis_drop_summary").select("*");
  if (dropId) q = q.eq("drop_id", dropId);
  const { data, error } = await q;
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

// ============================================================================
// DASHBOARD STATS
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
    db().from("sessions").select("*", { count: "exact", head: true }).eq("completed", true),
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
// SEGMENT ACCESS CHECK
// ============================================================================

app.get("/check-drop-access", requireTelegram, async (c) => {
  const user = c.get("tgUser") as TelegramUser;
  const dropId = c.req.query("drop_id");
  if (!dropId) return c.json({ error: "drop_id required" }, 400);

  const node = await resolveNode(user.id);
  if (!node || node.status !== "active") return c.json({ access: false, reason: "not_active" });

  const { data: drop } = await db().from("drops").select("segment_ids").eq("id", dropId).single();
  if (!drop) return c.json({ access: false, reason: "drop_not_found" });
  if (!drop.segment_ids?.length) return c.json({ access: true });

  const { data: nodeData } = await db().from("nodes").select("age, gender, location").eq("id", node.node_id).single();
  const { data: segs } = await db().from("segments").select("filters").in("id", drop.segment_ids);

  const match = segs?.some((s: any) => {
    const f = s.filters;
    if (f.gender && nodeData?.gender !== f.gender) return false;
    if (f.min_age && (nodeData?.age || 0) < f.min_age) return false;
    if (f.max_age && (nodeData?.age || 0) > f.max_age) return false;
    if (f.location && nodeData?.location !== f.location) return false;
    return true;
  }) || false;

  return c.json({ access: match });
});

// ============================================================================
// LEGACY NODE STATUS
// ============================================================================

app.get("/node-status", requireTelegram, async (c) => {
  const user = c.get("tgUser") as TelegramUser;
  const node = await resolveNode(user.id);
  if (!node) return c.json({ status: "unknown", registered: false });
  return c.json({ status: node.status, registered: true, node_id: node.node_id });
});

// ============================================================================
// KV LEGACY (keep during migration)
// ============================================================================

app.get("/kv/:key", requirePanel, async (c) => {
  const { data } = await db().from("kv_store_c68eb08c").select("value").eq("key", c.req.param("key")).single();
  return c.json(data?.value || null);
});

app.put("/kv/:key", requirePanel, async (c) => {
  await db().from("kv_store_c68eb08c").upsert({ key: c.req.param("key"), value: await c.req.json() });
  return c.json({ ok: true });
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
// START SERVER
// ============================================================================

const port = parseInt(process.env.PORT || "3000");
console.log(`[BRUTAL] Server starting on port ${port}`);
serve({ fetch: app.fetch, port });
