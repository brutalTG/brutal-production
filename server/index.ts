/**
 * BRUTAL — Production Server v3.0
 * Node.js + Hono + Supabase PostgreSQL
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

let _db: any = null;
function db() {
  if (!_db) {
    _db = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
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

function validateInitData(initData: string) {
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

function extractTgFields(initData: string | undefined | null) {
  if (!initData) return {};
  const user = validateInitData(initData);
  if (!user) return {};
  const fields: any = {};
  if (user.language_code !== undefined) fields.tg_language_code = user.language_code;
  if (user.is_premium !== undefined) fields.tg_is_premium = user.is_premium;
  if (user.photo_url !== undefined) fields.tg_photo_url = user.photo_url;
  if (user.allows_write_to_pm !== undefined) fields.tg_allows_write_to_pm = user.allows_write_to_pm;
  return fields;
}

async function requireTelegram(c: any, next: any) {
  const initData = c.req.header("X-Telegram-Init-Data");
  if (!initData) return c.json({ error: "Missing Telegram initData" }, 401);
  const user = validateInitData(initData);
  if (!user) return c.json({ error: "Invalid Telegram initData" }, 401);
  c.set("tgUser", user);
  await next();
}

async function requirePanel(c: any, next: any) {
  const token = c.req.header("X-Panel-Token");
  const expected = process.env.PANEL_PASSWORD || "brutal-admin";
  if (token !== expected) return c.json({ error: "Unauthorized" }, 401);
  await next();
}

// ============================================================================
// HELPERS (FIX: ANTIBALAS PARA DUPLICADOS)
// ============================================================================

async function resolveNode(telegramUserId: string | number) {
  const { data: chs } = await db()
    .from("node_channels")
    .select("node_id")
    .eq("channel", "telegram")
    .eq("channel_identifier", String(telegramUserId))
    .limit(1); // FIX: Evita que crashee si hay canales duplicados
  
  if (!chs?.[0]) return null;
  
  const { data: nodes } = await db()
    .from("nodes")
    .select("node_id, status, nickname") 
    .eq("node_id", chs[0].node_id)
    .limit(1); // FIX: Evita que crashee
    
  if (!nodes?.[0]) return null;
  return { node_id: nodes[0].node_id, status: nodes[0].status, nickname: nodes[0].nickname };
}

async function anonId(nodeId: string) {
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

function dbQuestionToPanel(row: any) {
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

function dbDropToPanel(row: any) {
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

function dbToPlayableDrop(dropRow: any, questionRows: any[]) {
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

function buildReward(dropQuestion: any, question: any) {
  const cash = dropQuestion.reward_cash_override ?? question.reward_cash ?? 0;
  const tickets = dropQuestion.reward_tickets_override ?? question.reward_tickets ?? 0;
  if (cash > 0) return { type: "coins", value: cash };
  if (tickets > 0) return { type: "tickets", value: tickets };
  return undefined;
}

function dbToUserProfile(node: any, profile: any, telegramUserId: any, tgUser: any) {
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

function dbToTransaction(tx: any) {
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

function dbToClaim(row: any) {
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

function dbToSeason(row: any) {
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
      .eq("node_id", node.node_id).eq("drop_id", dropId).eq("status", "completed").limit(1);
    if (done?.[0]) return c.json({ status: "completed" });
  }
  return c.json({ status: "granted", node_id: node.node_id });
});

// ============================================================================
// DROPS
// ============================================================================

app.get("/active-drop", async (c) => {
  const { data: dropRows } = await db()
    .from("drops").select("*").eq("status", "active")
    .order("published_at", { ascending: false }).limit(1);
  const dropRow = dropRows?.[0];
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
    await db().from("drops").update({ status: "archived" }).eq("status", "active");
    const dropId = body.id || body.drop_id || crypto.randomUUID();

    const { data: dropData, error: dropErr } = await db().from("drops").upsert({
      drop_id: dropId, name: body.name || "Drop", status: "active",
      published_at: new Date().toISOString(),
      config: { timeoutMessage: body.timeoutMessage, multiplierCheckpoints: body.multiplierCheckpoints,
        reveal: body.reveal, splash: body.splash },
      segment_ids: body.segmentIds || null,
    }).select().single();
    if (dropErr) return c.json({ error: dropErr.message }, 500);

    await db().from("drop_questions").delete().eq("drop_id", dropId);

    let linked = 0;
    for (let i = 0; i < body.questions.length; i++) {
      const q = body.questions[i];
      const qType = q.type;
      if (!qType) continue;

      const rewardCash = q.reward?.type === "coins" ? (q.reward.value || 0) : 0;
      const rewardTickets = q.reward?.type === "tickets" ? (q.reward.value || 0) : 0;
      const { type: _t, reward: _r, questionId: _qid, ...config } = q;
      let questionId = q.questionId || null;
      if (questionId) {
        await db().from("questions").upsert({
          question_id: questionId, type: qType, config,
          reward_cash: rewardCash, reward_tickets: rewardTickets,
          label: q.text || q.statement || q.label || null,
          trap_correct_option: q.trapCorrectIndex != null ? String(q.trapCorrectIndex) : null,
        });
      } else {
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
      .eq("drop_id", body.drop_id).select();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(dbDropToPanel(data[0]));
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
  const { error } = await db().from("drops").upsert({
    drop_id: dropId, name: body.name || "Preview", status: "draft",
    config: { timeoutMessage: body.timeoutMessage, multiplierCheckpoints: body.multiplierCheckpoints,
      reveal: body.reveal, splash: body.splash, _preview: true },
  }).select().single();
  if (error) return c.json({ error: error.message }, 500);

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
  const { data: drops } = await db().from("drops").select("*").eq("status", "draft")
    .order("created_at", { ascending: false }).limit(1);
  const data = drops?.[0];
  if (!data) return c.json(null, 404);
  const cfg = data.config || {};
  if (!cfg._preview) return c.json(null, 404);
  const { data: dqRows } = await db().from("drop_questions")
    .select("position, reward_cash_override, reward_tickets_override, questions(*)")
    .eq("drop_id", data.drop_id).order("position", { ascending: true });
  if (dqRows?.length) return c.json(dbToPlayableDrop(data, dqRows));
  return c.json({ error: "Preview drop has no questions" }, 404);
});

app.get("/drop/:id", async (c) => {
  const { data } = await db().from("drops").select("*").eq("drop_id", c.req.param("id")).limit(1);
  if (!data?.[0]) return c.json({ error: "Drop not found" }, 404);
  return c.json(dbDropToPanel(data[0]));
});

app.get("/drop/:id/questions", async (c) => {
  const { data, error } = await db().from("drop_questions")
    .select("position, reward_cash_override, reward_tickets_override, questions(*)")
    .eq("drop_id", c.req.param("id")).order("position", { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json((data || []).map((dq: any) => ({
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

  const initData = c.req.header("X-Telegram-Init-Data");
  const tgFields = extractTgFields(initData);

  const node = await resolveNode(user.id);
  if (!node || node.status !== "active") return c.json({ error: "Not authorized" }, 403);

  if (Object.keys(tgFields).length > 0) {
    await db().from("nodes").update(tgFields).eq("node_id", node.node_id);
  }

  const { data: existing } = await db().from("sessions")
    .select("session_id, current_position, status")
    .eq("node_id", node.node_id).eq("drop_id", drop_id).limit(1);
  if (existing?.[0]) {
    if (existing[0].status === "completed") return c.json({ error: "Already completed" }, 409);
    return c.json({ session_id: existing[0].session_id, resumed: true, current_index: existing[0].current_position || 0 });
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

  const { data: sessionData } = await db().from("sessions")
    .select("drop_id").eq("session_id", session_id).limit(1);
  let serverMultiplier = 1;
  if (sessionData?.[0]?.drop_id) {
    const { data: dropData } = await db().from("drops")
      .select("config").eq("drop_id", sessionData[0].drop_id).limit(1);
    const checkpoints = dropData?.[0]?.config?.multiplierCheckpoints || {};
    const { count: responseCount } = await db().from("responses")
      .select("*", { count: "exact", head: true }).eq("session_id", session_id);
    for (const [pos, cp] of Object.entries(checkpoints)) {
      if (Number(pos) < (responseCount || 0) && (cp as any).multiplier > serverMultiplier) {
        serverMultiplier = (cp as any).multiplier;
      }
    }
  }
  const finalMultiplier = serverMultiplier > 1 ? serverMultiplier : (clientMultiplier || 1);

  await db().from("sessions").update({ multiplier: finalMultiplier }).eq("session_id", session_id);

  const { data: rewards } = await db().from("responses")
    .select("reward_type, reward_value, reward_granted").eq("session_id", session_id);
  const baseCash = rewards?.filter((r: any) => r.reward_type === "cash" && r.reward_granted)
    .reduce((s: any, r: any) => s + Number(r.reward_value || 0), 0) || 0;
  const baseTickets = rewards?.filter((r: any) => r.reward_type === "golden_ticket" && r.reward_granted)
    .reduce((s: any, r: any) => s + Number(r.reward_value || 0), 0) || 0;
  
  const totalCash = Number((baseCash * finalMultiplier).toFixed(4));
  const totalTickets = Math.round(baseTickets * finalMultiplier);

  const { data: traps } = await db().from("responses")
    .select("question_type, raw_response").eq("session_id", session_id)
    .in("question_type", ["trap", "trap_silent"]);
  const trapsPassed = traps?.filter((t: any) => t.raw_response?.correct === true).length || 0;
  const trapsFailed = (traps?.length || 0) - trapsPassed;
  
  const { data: latencies } = await db().from("responses")
    .select("latency_ms").eq("session_id", session_id).not("latency_ms", "is", null);
  const avgLatency = latencies?.length
    ? Math.round(latencies.reduce((s: any, r: any) => s + r.latency_ms, 0) / latencies.length) : null;
    
  const { error } = await db().from("sessions").update({
    status: "completed", completed_at: new Date().toISOString(),
    total_cash_earned: totalCash, total_tickets_earned: totalTickets,
    multiplier: finalMultiplier,
    trap_score: trapsPassed, traps_passed: trapsPassed, traps_failed: trapsFailed,
    avg_latency_ms: avgLatency,
    archetype_result: archetype_result || null, bic_scores: bic_scores || null,
  }).eq("session_id", session_id).eq("node_id", node.node_id);
  if (error) return c.json({ error: error.message }, 500);

  const { data: sessionBefore } = await db().from("sessions")
    .select("status").eq("session_id", session_id).limit
