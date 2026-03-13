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
    .limit(1);
  
  if (!chs?.[0]) return null;
  
  const { data: nodes } = await db()
    .from("nodes")
    .select("node_id, status, nickname") 
    .eq("node_id", chs[0].node_id)
    .limit(1);
    
  if (!nodes?.[0]) return null;
  return { node_id: nodes[0].node_id, status: nodes[0].status, nickname: nodes[0].nickname };
}

async function anonId(nodeId: string) {
  const { data } = await db()
    .from("anonymous_id_map")
    .select("anonymous_id")
    .eq("node_id", nodeId)
    .limit(1);
  if (data?.[0]) return data[0].anonymous_id;
  const newAnon = "anon_" + crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  const { data: created, error } = await db()
    .from("anonymous_id_map")
    .insert({ node_id: nodeId, anonymous_id: newAnon })
    .select("anonymous_id")
    .single();
  if (error) return null;
  return created.anonymous_id;
}

// Motor que evalúa si un usuario cumple las reglas de un segmento
function evaluateSegment(node: any, filters: any): boolean {
  if (!filters || Object.keys(filters).length === 0) return true; // Si no hay filtros, pasa.

  // Filtro de Edad
  if (filters.age || filters.min_age !== undefined || filters.max_age !== undefined) {
    const nodeAge = parseInt(node.age);
    if (isNaN(nodeAge)) return false; // Si pide edad y el usuario no la cargó, rebota.
    
    const min = filters.age?.min ?? filters.min_age;
    const max = filters.age?.max ?? filters.max_age;
    
    if (min !== undefined && nodeAge < min) return false;
    if (max !== undefined && nodeAge > max) return false;
  }

  // Filtro de Género
  if (Array.isArray(filters.gender) && filters.gender.length > 0) {
    if (!filters.gender.includes(node.gender)) return false;
  }

  // Filtro de Ubicación (Provincia)
  if (Array.isArray(filters.location_province) && filters.location_province.length > 0) {
    if (!filters.location_province.includes(node.location_province)) return false;
  }

  // Filtro de Arquetipo
  if (Array.isArray(filters.compass_archetype) && filters.compass_archetype.length > 0) {
    if (!filters.compass_archetype.includes(node.compass_archetype)) return false;
  }

  return true; // Si superó todas las trabas, hace match.
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
      .eq("node_id", node.node_id).eq("drop_id", dropId).in("status", ["completed", "claimed"]).limit(1);
    if (done?.[0]) return c.json({ status: "completed" });
  }
  return c.json({ status: "granted", node_id: node.node_id });
});

// ============================================================================
// DROPS
// ============================================================================

app.get("/active-drop", async (c) => {
  // 1. Identificamos discretamente quién está pidiendo el Drop
  const initData = c.req.header("X-Telegram-Init-Data");
  const user = validateInitData(initData || "");
  let fullNode = null;

  if (user) {
    const nodeBasic = await resolveNode(user.id);
    if (nodeBasic) {
      // Traemos toda su data (edad, género, etc) para evaluralo
      const { data } = await db().from("nodes").select("*").eq("node_id", nodeBasic.node_id).single();
      fullNode = data;
    }
  }

  // 2. Buscamos el Drop activo
  const { data: dropRows } = await db()
    .from("drops").select("*").eq("status", "active")
    .order("published_at", { ascending: false }).limit(1);
  const dropRow = dropRows?.[0];
  if (!dropRow) return c.json({ error: "No active drop" }, 404);

  // 3. Buscamos todas las preguntas del drop
  const { data: dqRows } = await db()
    .from("drop_questions")
    .select("position, reward_cash_override, reward_tickets_override, questions(*)")
    .eq("drop_id", dropRow.drop_id).order("position", { ascending: true });

  // 4. Traemos todos los segmentos de la DB a la memoria
  const { data: segments } = await db().from("segments").select("*");
  const segmentMap = new Map();
  segments?.forEach((s: any) => segmentMap.set(s.segment_id, s.filters));

  // 5. Armamos el mazo base
  const playableDrop = dbToPlayableDrop(dropRow, dqRows || []);

  // 6. LA MAGIA: Filtramos las cartas según el perfil del usuario
  if (fullNode) {
    playableDrop.questions = playableDrop.questions.filter((q: any) => {
      const segmentIds = q.segmentIds || [];
      // Si la carta no tiene segmentos, es pública. Pasa de largo.
      if (segmentIds.length === 0) return true; 

      // Si tiene segmentos, el usuario debe cumplir con AL MENOS UNO para ver la carta
      return segmentIds.some((segId: string) => {
        const filters = segmentMap.get(segId);
        return evaluateSegment(fullNode, filters);
      });
    });
  } else {
    // Si no está registrado o es una vista previa pública, solo ve las cartas sin segmentar
    playableDrop.questions = playableDrop.questions.filter((q: any) => !q.segmentIds || q.segmentIds.length === 0);
  }

  // Fallback por si el Drop estaba vacío desde el panel o el filtro borró todas las cartas
  if (playableDrop.questions.length === 0 && !dqRows?.length) {
    const cfg = dropRow.config || {};
    if (cfg.questions?.length) {
       // Lógica vieja de fallback (sin filtro dinámico)
       return c.json({
         id: dropRow.drop_id, name: dropRow.name, version: 1,
         timeoutMessage: cfg.timeoutMessage || "Brutal eligio por vos.",
         multiplierCheckpoints: cfg.multiplierCheckpoints || {},
         reveal: cfg.reveal || { title: "", description: "", archetypes: [] },
         splash: cfg.splash || undefined, questions: cfg.questions,
       });
    }
    return c.json({ error: "Active drop has no questions for this user" }, 404);
  }

  return c.json(playableDrop);
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
    if (existing[0].status === "completed" || existing[0].status === "claimed") {
      return c.json({ error: "Already completed" }, 409);
    }
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

// FIX: AHORA ESTA RUTA SOLO GUARDA LAS MÉTRICAS DE LA SESIÓN, NO REGALA MONEDAS
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

  const { data: traps } = await db().from("responses")
    .select("question_type, raw_response").eq("session_id", session_id)
    .in("question_type", ["trap", "trap_silent"]);
  const trapsPassed = traps?.filter((t: any) => t.raw_response?.correct === true).length || 0;
  const trapsFailed = (traps?.length || 0) - trapsPassed;
  
  const { data: latencies } = await db().from("responses")
    .select("latency_ms").eq("session_id", session_id).not("latency_ms", "is", null);
  const avgLatency = latencies?.length
    ? Math.round(latencies.reduce((s: any, r: any) => s + r.latency_ms, 0) / latencies.length) : null;
    
  // Solo actualizamos la sesión a "completed". Las monedas se dan en /claim-rewards
  const { error } = await db().from("sessions").update({
    status: "completed", completed_at: new Date().toISOString(),
    multiplier: finalMultiplier,
    trap_score: trapsPassed, traps_passed: trapsPassed, traps_failed: trapsFailed,
    avg_latency_ms: avgLatency,
    archetype_result: archetype_result || null, bic_scores: bic_scores || null,
  }).eq("session_id", session_id).eq("node_id", node.node_id);
  
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ ok: true, trap_score: `${trapsPassed}/${traps?.length || 0}` });
});

// ============================================================================
// SESSIONS — Notify
// ============================================================================

app.post("/sessions/notify", requireTelegram, async (c) => {
  const user = c.get("tgUser");
  const { session_id, total_cash, total_tickets, multiplier } = await c.req.json();
  if (!session_id) return c.json({ error: "session_id required" }, 400);

  const node = await resolveNode(user.id);
  if (!node) return c.json({ error: "Not authorized" }, 403);

  const { data: session } = await db().from("sessions")
    .select("session_id, node_id, status")
    .eq("session_id", session_id).eq("node_id", node.node_id).limit(1);
  if (!session?.[0]) return c.json({ error: "Session not found" }, 404);

  const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN
    : "https://brutal.up.railway.app";

  try {
    const { data: channel } = await db().from("node_channels")
      .select("channel_identifier").eq("node_id", node.node_id).eq("channel", "telegram").limit(1);

    if (channel?.[0]?.channel_identifier) {
      const tgChatId = channel[0].channel_identifier;
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
  }

  return c.json({ ok: true });
});

// ============================================================================
// RESPONSES
// ============================================================================

// FIX: AHORA ESTA RUTA SOLO GUARDA LAS RESPUESTAS, NO SUMA MONEDAS A LOS PERFILES
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
    .eq("question_id", question_id).limit(1);
    
  let rewardCash = qConfig?.[0]?.reward_cash || 0;
  let rewardTickets = qConfig?.[0]?.reward_tickets || 0;
  if (drop_id && position_in_drop !== undefined) {
    const { data: dqOverride } = await db().from("drop_questions")
      .select("reward_cash_override, reward_tickets_override")
      .eq("drop_id", drop_id).eq("question_id", question_id).limit(1);
    if (dqOverride?.[0]?.reward_cash_override != null) rewardCash = dqOverride[0].reward_cash_override;
    if (dqOverride?.[0]?.reward_tickets_override != null) rewardTickets = dqOverride[0].reward_tickets_override;
  }
  
  const minLatency = qConfig?.[0]?.min_latency_ms || 400;
  const belowThreshold = (latency_ms || 0) < minLatency;
  const rewardGranted = !belowThreshold;
  let rewardType = null;
  let rewardValue = 0;
  if (rewardCash > 0) { rewardType = "cash"; rewardValue = rewardCash; }
  else if (rewardTickets > 0) { rewardType = "golden_ticket"; rewardValue = rewardTickets; }
  
  const { data: activeSeason } = await db().from("seasons")
    .select("season_id").eq("is_active", true).limit(1);
  const seasonId = activeSeason?.[0]?.season_id || null;

  // Insertamos la respuesta con sus datos crudos
  const { data: resp, error } = await db().from("responses").insert({
    node_id: node.node_id, anonymous_id, session_id, drop_id: drop_id || null,
    question_id, position_in_drop: position_in_drop ?? null,
    question_type: question_type || null, choice: choice || null,
    choice_index: choice_index ?? null, text_response: text_response || null,
    slider_value: slider_value ?? null, ranking_result: ranking_result || null,
    rafaga_choices: rafaga_choices || null, raw_response: raw_response || null,
    latency_ms: latency_ms || null, reward_type: rewardType,
    reward_value: rewardValue, reward_granted: rewardGranted,
    multiplier_at_time: body.multiplier_at_position || 1, season_id: seasonId,
    source: "drop",
  }).select("response_id").single();
  
  if (error) return c.json({ error: error.message }, 500);
  
  // Actualizamos el progreso de la sesión
  await db().from("sessions").update({ current_position: (position_in_drop ?? 0) + 1 })
    .eq("session_id", session_id);
    
  return c.json({ response_id: resp.response_id, below_threshold: belowThreshold,
    reward_granted: rewardGranted, reward_type: rewardType, reward_value: rewardValue });
});

// ============================================================================
// ONBOARDING
// ============================================================================

app.post("/apply", async (c) => {
  const body = await c.req.json();
  const initData = c.req.header("X-Telegram-Init-Data");
  const tgFields = extractTgFields(initData);

  const phone = body.phone;
  const nickname = body.nickname;
  const age = body.age;
  const gender = body.gender;
  const phoneBrand = body.phoneBrand || body.phone_brand;
  const handles = body.handles;
  const referredByCode = body.referralCode || body.referred_by_code;
  const telegramUserId = body.telegramUserId || body.telegram_user_id;

  let locationProvince = body.location_province || null;
  let locationCity = body.location_city || null;
  if (!locationProvince && body.location) {
    const parts = String(body.location).split(">").map((s) => s.trim());
    locationProvince = parts[0] || null;
    locationCity = parts[1] || null;
  }

  const compassVector = body.compassVector || body.compass_vector || null;
  const compassArchetype = body.compassArchetype || body.compass_archetype || null;
  const brandVector = body.brandVector || body.brand_vector || null;

  const compassRaw = body.compassRaw || null;
  const compassChoicesFromBody = body.compass_choices || null;
  const brandChoices = body.brand_choices || null;

  if (!telegramUserId && (!phone || phone === "telegram_verified")) {
    return c.json({ ok: false, error: "Missing Telegram ID or valid Phone" }, 400);
  }
  
  let normalPhone = null;
  if (phone && phone !== "telegram_verified") {
    const clean = phone.replace(/\D/g, "");
    if (clean.length >= 10 && clean.length <= 13) {
       normalPhone = "+" + (clean.startsWith("54") ? clean : "549" + clean.replace(/^9?/, ""));
    }
  }

  let referredBy = null;
  if (referredByCode) {
    const { data: ref } = await db().from("nodes").select("node_id").eq("referral_code", referredByCode).limit(1);
    if (ref?.[0]) referredBy = ref[0].node_id;
  }

  let existingNodeId = null;
  if (telegramUserId) {
    const { data: ch } = await db().from("node_channels").select("node_id").eq("channel", "telegram").eq("channel_identifier", String(telegramUserId)).limit(1);
    if (ch?.[0]) existingNodeId = ch[0].node_id;
  }

  const isComplete = nickname && age && gender;
  const finalStatus = isComplete ? "active" : "incomplete";
  const finalStep = isComplete ? 100 : 1;

  let newNode;
  if (existingNodeId) {
    const updateData: any = {
      status: finalStatus,
      onboarding_step: finalStep,
      ...tgFields
    };
    if (nickname) updateData.nickname = nickname;
    if (age) updateData.age = age;
    if (gender) updateData.gender = gender;
    if (locationProvince) updateData.location_province = locationProvince;
    if (locationCity) updateData.location_city = locationCity;
    if (phoneBrand) updateData.phone_brand = phoneBrand;
    if (compassVector) updateData.compass_vector = compassVector;
    if (compassArchetype) updateData.compass_archetype = compassArchetype;
    if (brandVector) updateData.brand_vector = brandVector;
    if (handles && Object.keys(handles).length > 0) updateData.handles = handles;
    if (referredBy) updateData.referred_by = referredBy;

    if (finalStatus === "active") updateData.approved_at = new Date().toISOString();

    const { data: updatedNode, error: nodeErr } = await db().from("nodes").update(updateData).eq("node_id", existingNodeId).select("node_id, referral_code, status").single();
    
    if (nodeErr) return c.json({ ok: false, error: nodeErr.message }, 500);
    newNode = updatedNode;
  } else {
    const insertData: any = {
      phone: normalPhone, nickname: nickname || null, age: age || null, gender: gender || null,
      location_province: locationProvince, location_city: locationCity,
      phone_brand: phoneBrand || null, compass_vector: compassVector,
      compass_archetype: compassArchetype, brand_vector: brandVector,
      handles: handles || null, referred_by: referredBy, 
      status: finalStatus, onboarding_step: finalStep,
      ...tgFields
    };

    if (finalStatus === "active") insertData.approved_at = new Date().toISOString();

    const { data: insertedNode, error: nodeErr } = await db().from("nodes").insert(insertData).select("node_id, referral_code, status").single();
    
    if (nodeErr) return c.json({ ok: false, error: nodeErr.message }, 500);
    newNode = insertedNode;

    await db().from("profiles").insert({
      node_id: newNode.node_id, cash_balance: 0, cash_lifetime: 0, cash_withdrawn: 0,
      tickets_current: 0, tickets_lifetime: 0, drops_completed: 0, bot_questions_answered: 0,
      traps_passed: 0, traps_failed: 0, current_streak: 0, best_streak: 0,
    });
    await anonId(newNode.node_id);

    if (telegramUserId) {
      await db().from("node_channels").insert({
        node_id: newNode.node_id, channel: "telegram",
        channel_identifier: String(telegramUserId), is_primary: true,
      });
    }
  }

  if (compassRaw && typeof compassRaw === "object") {
    const { data: config } = await db().from("compass_config").select("rafagas").limit(1).single();
    const rafagaList = config?.rafagas || [];
    const rows = [];
    const rafagaIds = Object.keys(compassRaw);
    for (let ri = 0; ri < rafagaIds.length; ri++) {
      const rafagaId = rafagaIds[ri];
      const answers = compassRaw[rafagaId];
      const rafagaDef = rafagaList.find((r: any) => r.id === rafagaId);
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
      await db().from("node_compass_choices").upsert(rows);
    }
  } else if (compassChoicesFromBody?.length) {
    await db().from("node_compass_choices").upsert(
      compassChoicesFromBody.map((ch: any) => ({ node_id: newNode.node_id, rafaga_index: ch.rafaga_index,
        pair_index: ch.pair_index, emoji_left: ch.emoji_left || "", emoji_right: ch.emoji_right || "",
        chosen: ch.chosen_emoji || ch.chosen || "", latency_ms: ch.latency_ms }))
    );
  }

  if (brandChoices?.length) {
    await db().from("node_brand_choices").upsert(
      brandChoices.map((ch: any) => ({ node_id: newNode.node_id, pair_id: ch.pair_id || `brand_${ch.pair_index}`,
        brand_a: ch.brand_a || "", brand_b: ch.brand_b || "",
        chosen: ch.chosen_brand || ch.chosen || "", latency_ms: ch.latency_ms }))
    );
  }

  if (isComplete && telegramUserId && botToken()) {
    try {
      await fetch(`https://api.telegram.org/bot${botToken()}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramUserId,
          text: `🔥 <b>¡Tu cuenta ya está activa!</b>\n\nEstás oficialmente adentro de BRUTAL.\n\nJugá tu primer Drop ahora, ganá cash real y acumulá Golden Tickets para el sorteo de entradas al <b>Lollapalooza 2026</b>.\n\n🔔 <i>Importante: Activá las notificaciones de este chat para que te avisemos apenas salga un Drop nuevo.</i>`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[
              { text: "▶️ Jugar Primer Drop", web_app: { url: `https://brutal.up.railway.app/` } }
            ]]
          }
        }),
      });
    } catch (e) {
      console.error("[BOT] Post-registration message failed:", e);
    }
  }
  return c.json({ ok: true, applicationId: newNode.node_id, referralCode: newNode.referral_code, queuePosition: 0 }, 201);
});

app.get("/apply/check", async (c) => {
  const phone = c.req.query("phone");
  if (!phone) return c.json({ error: "phone required" }, 400);
  if (phone === "telegram_verified") return c.json({ exists: false }); 
  const clean = "+" + phone.replace(/\D/g, "");
  const { data } = await db().from("nodes")
    .select("node_id, status, referral_code, onboarding_step").eq("phone", clean).limit(1);
  if (!data?.[0]) return c.json({ exists: false });
  return c.json({ exists: true, nodeId: data[0].node_id, referralCode: data[0].referral_code, onboardingStep: data[0].onboarding_step, status: data[0].status });
});

// ============================================================================
// PROGRESSIVE ONBOARDING
// ============================================================================

app.post("/apply/init", async (c) => {
  const body = await c.req.json();
  const initData = c.req.header("X-Telegram-Init-Data");
  const tgFields = extractTgFields(initData);
  
  let secureTgId = null;
  if (initData) {
    try {
      const params = new URLSearchParams(initData);
      const userStr = params.get("user");
      if (userStr) secureTgId = JSON.parse(userStr).id;
    } catch(e) {}
  }
  
  const tgId = secureTgId || body.telegram_user_id || body.telegramUserId;
  const { phone, referred_by_code, nickname, age, gender, location, phoneBrand } = body;
  
  if (!tgId && (!phone || phone === "telegram_verified")) {
    return c.json({ ok: false, error: "Missing Telegram ID or valid Phone" }, 400);
  }

  let normalPhone = null;
  if (phone && phone !== "telegram_verified") {
    let clean = String(phone).replace(/\D/g, "");
    if (clean.length === 10) clean = "549" + clean; 
    else if (clean.length === 11 && clean.startsWith("9")) clean = "54" + clean; 
    else if (clean.length === 12 && clean.startsWith("54")) clean = "549" + clean.substring(2); 
    if (!clean.startsWith("54") || clean.length < 12 || clean.length > 13) {
      return c.json({ ok: false, error: "Teléfono inválido. Verificá el código de área." }, 400);
    }
    normalPhone = "+" + clean;
  }

  let existing = null;
  if (tgId) {
     const { data: chs } = await db().from("node_channels")
       .select("node_id").eq("channel", "telegram").eq("channel_identifier", String(tgId)).limit(1);
     if (chs?.[0]) {
       const { data: nodes } = await db().from("nodes").select("node_id, status, onboarding_step, referral_code, phone").eq("node_id", chs[0].node_id).limit(1);
       existing = nodes?.[0];
     }
  }
  if (!existing && normalPhone) {
    const { data: nodesByPhone } = await db().from("nodes")
      .select("node_id, status, onboarding_step, referral_code, phone").eq("phone", normalPhone).limit(1);
    existing = nodesByPhone?.[0];
  }

  if (existing) {
    const updates: any = { ...tgFields };
    if (normalPhone && !existing.phone) updates.phone = normalPhone;
    if (nickname) updates.nickname = nickname;
    if (age) updates.age = age;
    if (gender) updates.gender = gender;
    if (location) updates.location_province = location;
    if (phoneBrand) updates.phone_brand = phoneBrand;
    if (nickname) updates.onboarding_step = 10;

    if (Object.keys(updates).length > 0) {
      await db().from("nodes").update(updates).eq("node_id", existing.node_id);
    }
    return c.json({
      ok: true, resumed: true,
      nodeId: existing.node_id, referralCode: existing.referral_code,
      onboardingStep: updates.onboarding_step || existing.onboarding_step, 
      status: existing.status,
    });
  }

  let referredBy = null;
  if (referred_by_code) {
    const { data: ref } = await db().from("nodes").select("node_id").eq("referral_code", referred_by_code).limit(1);
    if (ref?.[0]) referredBy = ref[0].node_id;
  }

  const { data: newNode, error: nodeErr } = await db().from("nodes").insert({
    phone: normalPhone, status: "incomplete", onboarding_step: nickname ? 10 : 1, 
    referred_by: referredBy, nickname: nickname || null, age: age || null,
    gender: gender || null, location_province: location || null, phone_brand: phoneBrand || null, ...tgFields
  }).select("node_id, referral_code, status, onboarding_step").single();

  if (nodeErr) return c.json({ ok: false, error: nodeErr.message }, 500);

  await db().from("profiles").insert({
    node_id: newNode.node_id, cash_balance: 0, cash_lifetime: 0, cash_withdrawn: 0,
    tickets_current: 0, tickets_lifetime: 0, drops_completed: 0, bot_questions_answered: 0,
    traps_passed: 0, traps_failed: 0, current_streak: 0, best_streak: 0,
  });

  await anonId(newNode.node_id);

  if (tgId) {
    await db().from("node_channels").insert({
      node_id: newNode.node_id, channel: "telegram", channel_identifier: String(tgId), is_primary: true,
    });
  }

  return c.json({
    ok: true, resumed: false, nodeId: newNode.node_id, referralCode: newNode.referral_code,
    onboardingStep: nickname ? 10 : 1, status: "incomplete",
  }, 201);
});

app.put("/apply/:nodeId/step", async (c) => {
  const nodeId = c.req.param("nodeId");
  const body = await c.req.json();
  const { step, value } = body;
  if (!step || value === undefined) return c.json({ ok: false, error: "step and value required" }, 400);
  const { data: nodes } = await db().from("nodes").select("node_id, status, onboarding_data").eq("node_id", nodeId).limit(1);
  if (!nodes?.[0]) return c.json({ ok: false, error: "Node not found" }, 404);

  const coreFields = ["phone", "nickname", "age", "gender", "location_province", "location_city", "phone_brand"];
  if (coreFields.includes(step)) {
    let finalValue = value;
    if (step === "phone") {
      let clean = String(value).replace(/\D/g, "");
      if (clean.length === 10) clean = "549" + clean;
      else if (clean.length === 11 && clean.startsWith("9")) clean = "54" + clean;
      else if (clean.length === 12 && clean.startsWith("54")) clean = "549" + clean.substring(2);
      if (!clean.startsWith("54") || clean.length < 12 || clean.length > 13) {
         return c.json({ ok: false, error: "Teléfono inválido. Verificá el código de área." }, 400);
      }
      finalValue = "+" + clean;
    }
    const { error } = await db().from("nodes").update({ [step]: finalValue }).eq("node_id", nodeId);
    if (error) return c.json({ ok: false, error: error.message }, 500);
  } else {
    const current = nodes[0].onboarding_data || {};
    current[step] = value;
    const { error } = await db().from("nodes").update({ onboarding_data: current }).eq("node_id", nodeId);
    if (error) return c.json({ ok: false, error: error.message }, 500);
  }

  const stepOrder = ["phone", "nickname", "age", "gender", "location", "phone_brand", "occupation", "platforms", "spending", "financialStress"];
  const stepIdx = stepOrder.indexOf(step);
  const newStep = stepIdx >= 0 ? stepIdx + 2 : (nodes[0].onboarding_data?._step || 1) + 1;
  await db().from("nodes").update({ onboarding_step: newStep }).eq("node_id", nodeId);

  return c.json({ ok: true, step, saved: true });
});

app.post("/apply/:nodeId/compass-rafaga", async (c) => {
  const nodeId = c.req.param("nodeId");
  const body = await c.req.json();
  const { rafaga_index, choices } = body;
  if (rafaga_index === undefined || !choices?.length) return c.json({ ok: false, error: "rafaga_index and choices required" }, 400);
  const { data: nodes } = await db().from("nodes").select("node_id").eq("node_id", nodeId).limit(1);
  if (!nodes?.[0]) return c.json({ ok: false, error: "Node not found" }, 404);
  await db().from("node_compass_choices").delete().eq("node_id", nodeId).eq("rafaga_index", rafaga_index);
  const rows = choices.map((ch: any) => ({
    node_id: nodeId, rafaga_index, pair_index: ch.pair_index,
    emoji_left: ch.emoji_left, emoji_right: ch.emoji_right, chosen: ch.chosen, latency_ms: ch.latency_ms || null,
  }));
  const { error } = await db().from("node_compass_choices").insert(rows);
  if (error) return c.json({ ok: false, error: error.message }, 500);
  await db().from("nodes").update({ onboarding_step: 20 + rafaga_index }).eq("node_id", nodeId);
  return c.json({ ok: true, rafaga_index, saved: choices.length });
});

app.post("/apply/:nodeId/brand-rafaga", async (c) => {
  const nodeId = c.req.param("nodeId");
  const body = await c.req.json();
  const { choices } = body;
  if (!choices?.length) return c.json({ ok: false, error: "choices required" }, 400);
  const { data: nodes } = await db().from("nodes").select("node_id").eq("node_id", nodeId).limit(1);
  if (!nodes?.[0]) return c.json({ ok: false, error: "Node not found" }, 404);
  await db().from("node_brand_choices").delete().eq("node_id", nodeId);
  const rows = choices.map((ch: any) => ({
    node_id: nodeId, pair_id: ch.pair_id, brand_a: ch.brand_a, brand_b: ch.brand_b,
    chosen: ch.chosen, latency_ms: ch.latency_ms || null,
  }));
  const { error } = await db().from("node_brand_choices").insert(rows);
  if (error) return c.json({ ok: false, error: error.message }, 500);
  await db().from("nodes").update({ onboarding_step: 25 }).eq("node_id", nodeId);
  return c.json({ ok: true, saved: choices.length });
});

app.put("/apply/:nodeId/complete", async (c) => {
  const nodeId = c.req.param("nodeId");
  const body = await c.req.json();
  const { compass_vector, compass_archetype, handles, brand_vector } = body;
  const { data: nodes } = await db().from("nodes").select("node_id, status, phone").eq("node_id", nodeId).limit(1);
  if (!nodes?.[0]) return c.json({ ok: false, error: "Node not found" }, 404);
  
  const { error } = await db().from("nodes").update({
    compass_vector: compass_vector || null, compass_archetype: compass_archetype || null,
    brand_vector: brand_vector || null, handles: handles || null, 
    onboarding_step: 100, status: "active", approved_at: new Date().toISOString()
  }).eq("node_id", nodeId);
  if (error) return c.json({ ok: false, error: error.message }, 500);
  
  const { data: updated } = await db().from("nodes").select("referral_code").eq("node_id", nodeId).single();
  const { data: channel } = await db().from("node_channels").select("channel_identifier").eq("node_id", nodeId).eq("channel", "telegram").limit(1);

  if (channel?.[0]?.channel_identifier && botToken()) {
    try {
      await fetch(`https://api.telegram.org/bot${botToken()}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: channel[0].channel_identifier,
          text: `🔥 <b>¡Tu cuenta ya está activa!</b>\n\nEstás oficialmente adentro de BRUTAL.\n\nJugá tu primer Drop ahora, ganá cash real y acumulá Golden Tickets para el sorteo de entradas al <b>Lollapalooza 2026</b>.\n\n🔔 <i>Importante: Activá las notificaciones de este chat para que te avisemos apenas salga un Drop nuevo.</i>`,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[ { text: "▶️ Jugar Primer Drop", web_app: { url: `https://brutal.up.railway.app/` } } ]] }
        }),
      });
    } catch (e) {
      console.error("[BOT] Post-registration message failed:", e);
    }
  }

  return c.json({ ok: true, nodeId, referralCode: updated?.referral_code || null, status: "active" });
});

// ============================================================================
// USER PROFILE and REWARDS
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
  return c.json({ profile: dbToUserProfile(nodeData, profile, user.id, user), transactions: (txs || []).map(dbToTransaction) });
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
  return c.json({ profile: dbToUserProfile(nodeData, profile, tgId, null), transactions: (txs || []).map(dbToTransaction) });
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
// LEADERBOARD
// ============================================================================

app.get("/leaderboard", async (c) => {
  const limit = parseInt(c.req.query("limit") || "20");
  const { data: season } = await db().from("seasons").select("*").eq("is_active", true).limit(1);
  const { data, error } = await db().from("profiles")
    .select("node_id, tickets_current, tickets_lifetime, drops_completed, bot_questions_answered, nodes(nickname, compass_archetype)")
    .order("tickets_current", { ascending: false }).limit(limit);
  if (error) return c.json({ error: error.message }, 500);
  const { count: totalUsers } = await db().from("profiles").select("*", { count: "exact", head: true });
  const leaderboard = (data || []).map((p: any, i: number) => ({
    position: i + 1, telegramUserId: 0,
    username: p.nodes?.nickname || "", firstName: p.nodes?.nickname || "",
    seasonTickets: p.tickets_current, lifetimeTickets: p.tickets_lifetime,
    dropsCompleted: p.drops_completed, botQuestionsAnswered: p.bot_questions_answered || 0,
  }));
  return c.json({ season: season?.[0] ? dbToSeason(season[0]) : null, leaderboard, totalUsers: totalUsers || 0 });
});

// ============================================================================
// SEASONS
// ============================================================================

app.get("/season", async (c) => {
  const { data } = await db().from("seasons").select("*").eq("is_active", true).limit(1);
  if (!data?.[0]) return c.json({ error: "No active season" }, 404);
  return c.json(dbToSeason(data[0]));
});

app.post("/season", requirePanel, async (c) => {
  const body = await c.req.json();
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
  const { data: existing } = await db().from("seasons").select("season_id").eq("is_active", true).limit(1);

  if (existing?.[0]) {
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.startDate || body.start_date || body.starts_at) updateData.starts_at = body.startDate || body.start_date || body.starts_at;
    if (body.endDate || body.end_date || body.ends_at) updateData.ends_at = body.endDate || body.end_date || body.ends_at;
    if (body.prizes) updateData.prizes = body.prizes;
    if (body.prizeImageUrl !== undefined || body.prize_image_url !== undefined) {
      updateData.config = { ...(existing[0] as any).config, prizeImageUrl: body.prizeImageUrl ?? body.prize_image_url };
    }
    const { data, error } = await db().from("seasons").update(updateData).eq("season_id", existing[0].season_id).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ season: dbToSeason(data) });
  } else {
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
  const { data: s } = await db().from("seasons").select("season_id").eq("is_active", true).limit(1);
  if (!s?.[0]) return c.json({ error: "No active season" }, 400);
  await db().from("profiles").update({ tickets_current: 0 });
  await db().from("seasons").update({ is_active: false }).eq("season_id", s[0].season_id);
  return c.json({ ok: true, resetCount: 0 });
});

// ============================================================================
// CLAIMS (FIX: AHORA MANEJA EL RECLAMO DE DROP Y EL RETIRO DE PLATA)
// ============================================================================

app.post("/claim-rewards", requireTelegram, async (c) => {
  const user = c.get("tgUser");
  const body = await c.req.json();
  const node = await resolveNode(user.id);
  if (!node) return c.json({ error: "Not found" }, 404);

  // 1. LÓGICA DE RECLAMO DE DROP (Viene de la App al terminar)
  if (body.dropId || body.drop_id) {
    const dropId = body.dropId || body.drop_id;
    const coins = Number(body.coins || 0);
    const finalTickets = Number(body.finalTickets || 0);

    const { data: session } = await db()
      .from("sessions").select("session_id, status").eq("node_id", node.node_id).eq("drop_id", dropId).limit(1);

    if (!session?.[0]) return c.json({ error: "Session not found" }, 404);
    
    // EVITA DOBLE COBRO SI YA RECLAMÓ ESTE DROP
    if (session[0].status === "claimed") {
      return c.json({ ok: true, alreadyClaimed: true });
    }

    const { data: p } = await db().from("profiles").select("*").eq("node_id", node.node_id).single();
    if (p) {
      // Sumamos LA ÚNICA VEZ las monedas y tickets al perfil
      await db().from("profiles").update({
        drops_completed: (p.drops_completed || 0) + 1,
        last_drop_at: new Date().toISOString(),
        cash_balance: Number(p.cash_balance || 0) + coins,
        cash_lifetime: Number(p.cash_lifetime || 0) + coins,
        tickets_current: Number(p.tickets_current || 0) + finalTickets,
        tickets_lifetime: Number(p.tickets_lifetime || 0) + finalTickets,
      }).eq("node_id", node.node_id);

      // Registramos las transacciones
      if (coins > 0) {
        await db().from("transactions").insert({
          node_id: node.node_id, type: "cash", amount: coins, source: "drop_completion", source_id: dropId,
          balance_after: Number(p.cash_balance || 0) + coins,
        });
      }
      if (finalTickets > 0) {
        await db().from("transactions").insert({
          node_id: node.node_id, type: "golden_ticket", amount: finalTickets, source: "drop_completion", source_id: dropId,
          balance_after: Number(p.tickets_current || 0) + finalTickets,
        });
      }
    }

    // Sellamos la sesión como cobrada
    await db().from("sessions").update({ status: "claimed" }).eq("session_id", session[0].session_id);
    return c.json({ ok: true, credited: { coins, tickets: finalTickets } });
  }

  // 2. LÓGICA DE RETIRO DE FONDOS ORIGINAL (Si no mandan dropId)
  const { amount } = body;
  const { data: profile } = await db()
    .from("profiles").select("cash_balance, wallet_alias").eq("node_id", node.node_id).single();
  if (!profile) return c.json({ error: "Profile not found" }, 404);

  const { data: cfgMin } = await db()
    .from("admin_config").select("value").eq("key", "withdrawal_minimum").limit(1);
  const minW = cfgMin?.[0]?.value || 10;

  const claimAmt = amount || profile.cash_balance;
  if (claimAmt < minW) return c.json({ error: `Minimum $${minW} USD` }, 400);
  if (!profile.wallet_alias) return c.json({ error: "Link wallet first" }, 400);

  const { data: pending } = await db()
    .from("claims").select("claim_id").eq("node_id", node.node_id).eq("status", "pending").limit(1);
  if (pending?.[0]) return c.json({ error: "Pending claim exists", claim_id: pending[0].claim_id }, 409);

  const { data: claim, error } = await db().from("claims").insert({
    node_id: node.node_id, claim_type: "cash", amount: claimAmt, wallet_alias: profile.wallet_alias, status: "pending",
  }).select("claim_id").single();
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ claim_id: claim.claim_id, amount: claimAmt, status: "pending" });
});

app.get("/claims", requirePanel, async (c) => {
  const { data, error } = await db()
    .from("claims").select("*, nodes(nickname, phone)").order("created_at", { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ claims: (data || []).map(dbToClaim) });
});

app.put("/claims/:id", requirePanel, async (c) => {
  const claimId = c.req.param("id");
  const body = await c.req.json();
  const status = body.status;
  const note = body.note || null;
  if (!["approved", "rejected"].includes(status)) return c.json({ error: "Invalid status" }, 400);

  const { data: claim } = await db().from("claims").select("node_id, amount, status").eq("claim_id", claimId).single();
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
      node_id: claim.node_id, type: "cash", amount: -claim.amount, source: "withdrawal", source_id: claimId,
      balance_after: Math.max(0, ((p?.cash_balance || 0) - claim.amount)),
    });
  }

  await db().from("claims").update({ status, note, resolved_at: new Date().toISOString() }).eq("claim_id", claimId);
  return c.json({ ok: true, status });
});

// ============================================================================
// ADMIN — NODES
// ============================================================================

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

  const applications = (data || []).map((n: any) => {
    const p = Array.isArray(n.profiles) ? n.profiles[0] : n.profiles || {};
    const od = n.onboarding_data || {};
    return {
      applicationId: n.node_id,
      telegramUserId: 0,
      nickname: n.nickname,
      phone: n.phone,
      age: n.age,
      gender: n.gender,
      location: [n.location_province, n.location_city].filter(Boolean).join(" — "),
      phoneBrand: n.phone_brand || "",
      status: n.status,
      referralCode: n.referral_code,
      createdAt: n.created_at,
      compassArchetype: n.compass_archetype,
      compassXPole: n.compass_x_pole,
      compassYPole: n.compass_y_pole,
      compassZPole: n.compass_z_pole,
      platforms: od.platforms || [],
      aiTool: od.ai_tool || "",
      totalCoins: p.cash_balance || 0,
      seasonTickets: p.tickets_current || 0,
      dropsCompleted: p.drops_completed || 0,
      handles: n.handles || {},
    };
  });

  return c.json({ applications, count: count || 0 });
});

app.put("/admin/users/:id/status", requirePanel, async (c) => {
  const id = c.req.param("id");
  const { status } = await c.req.json();

  const validStatuses = ["active", "pending", "blocked", "incomplete"];
  if (!validStatuses.includes(status)) {
    return c.json({ error: "Invalid status" }, 400);
  }

  const updateData: Record<string, unknown> = { status };
  if (status === "active") updateData.approved_at = new Date().toISOString();

  const { data: updatedNode, error } = await db()
    .from("nodes")
    .update(updateData)
    .eq("node_id", id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);

  if (status === "active" && botToken()) {
    const { data: channel } = await db()
      .from("node_channels")
      .select("channel_identifier")
      .eq("node_id", id)
      .eq("channel", "telegram")
      .limit(1);

    if (channel?.[0]?.channel_identifier) {
      try {
        await fetch(`https://api.telegram.org/bot${botToken()}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: channel[0].channel_identifier,
            text: `✅ <b>¡Tu cuenta ya está activa!</b>\n\nYa estás adentro de BRUTAL. Quedate atento que te avisamos por acá cuando haya un Drop disponible para jugar y ganar cash.`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: "🔥 Entrar a BRUTAL", web_app: { url: `https://brutal.up.railway.app/` } }
              ]]
            }
          }),
        });
      } catch (e) {
        console.error("[BOT] Falló el mensaje de activación:", e);
      }
    }
  }

  return c.json({ 
    ok: true, 
    application: { status: updatedNode.status } 
  });
});

// ============================================================================
// ADMIN — DROPS
// ============================================================================

app.get("/admin/drops", requirePanel, async (c) => {
  const { data } = await db().from("drops").select("*").order("created_at", { ascending: false });
  const drops = (data || []).map(dbDropToPanel);
  for (const drop of drops) {
    const { data: dqRows } = await db().from("drop_questions")
      .select("question_id").eq("drop_id", drop.id).order("position", { ascending: true });
    if (dqRows?.length) {
      drop.questionIds = dqRows.map((r: any) => r.question_id);
    }
  }
  return c.json(drops);
});

app.post("/admin/drops", requirePanel, async (c) => {
  const body = await c.req.json();
  const insertData: any = {
    name: body.name, config: body.config || {}, status: "draft",
    segment_ids: body.segment_ids || body.segmentIds || null, season_id: body.season_id || null,
  };
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
// ADMIN — QUESTIONS
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
  const type = body.data?.type || body.type;
  const config = body.data || body.config || {};

  let rewardCash = body.reward_cash || 0;
  let rewardTickets = body.reward_tickets || 0;
  if (!rewardCash && !rewardTickets && config?.reward) {
    const rt = config.reward;
    if (rt.type === "coins" || rt.type === "cash") rewardCash = rt.value || 0;
    else if (rt.type === "tickets" || rt.type === "golden_ticket") rewardTickets = rt.value || 0;
  }

  const insertData: any = {
    type, config, label: body.label || null, tags: body.tags || null,
    reward_cash: rewardCash, reward_tickets: rewardTickets,
    min_latency_ms: body.min_latency_ms || null,
    signal_pair_id: body.signal_pair_id || null, signal_pair_role: body.signal_pair_role || null,
    trap_correct_option: body.trap_correct_option || null,
  };
  if (body.question_id || body.id) insertData.question_id = body.question_id || body.id;

  const { data, error } = await db().from("questions").insert(insertData).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(dbQuestionToPanel(data), 201);
});

app.put("/admin/questions/:id", requirePanel, async (c) => {
  const body = await c.req.json();
  const type = body.data?.type || body.type;
  const config = body.data || body.config;

  let rewardCash = body.reward_cash || 0;
  let rewardTickets = body.reward_tickets || 0;
  if (!rewardCash && !rewardTickets && config?.reward) {
    const rt = config.reward;
    if (rt.type === "coins" || rt.type === "cash") rewardCash = rt.value || 0;
    else if (rt.type === "tickets" || rt.type === "golden_ticket") rewardTickets = rt.value || 0;
  }

  const { data, error } = await db().from("questions").update({
    type, config, label: body.label, tags: body.tags,
    reward_cash: rewardCash, reward_tickets: rewardTickets,
    min_latency_ms: body.min_latency_ms, signal_pair_id: body.signal_pair_id,
    signal_pair_role: body.signal_pair_role, trap_correct_option: body.trap_correct_option,
  }).eq("question_id", c.req.param("id")).select();
  if (error) return c.json({ error: error.message }, 500);
  if (!data || data.length === 0) return c.json({ error: "Question not found" }, 404);
  return c.json(dbQuestionToPanel(data[0]));
});

app.delete("/admin/questions/:id", requirePanel, async (c) => {
  const qid = c.req.param("id");
  await db().from("drop_questions").delete().eq("question_id", qid);
  const { error } = await db().from("questions").delete().eq("question_id", qid);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.get("/admin/drop-questions/:dropId", requirePanel, async (c) => {
  const { data } = await db().from("drop_questions").select("*, questions(*)")
    .eq("drop_id", c.req.param("dropId")).order("position", { ascending: true });
  return c.json((data || []).map((dq: any) => ({
    ...dq, question: dq.questions ? dbQuestionToPanel(dq.questions) : null, questions: undefined,
  })));
});

app.post("/admin/drop-questions", requirePanel, async (c) => {
  const body = await c.req.json();
  const { data, error } = await db().from("drop_questions").insert({
    drop_id: body.drop_id, question_id: body.question_id, position: body.position,
    reward_cash_override: body.reward_cash_override ?? null, reward_tickets_override: body.reward_tickets_override ?? null,
  }).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

app.delete("/admin/drop-questions/:dropId/:questionId", requirePanel, async (c) => {
  await db().from("drop_questions").delete().eq("drop_id", c.req.param("dropId")).eq("question_id", c.req.param("questionId"));
  return c.json({ ok: true });
});

// ============================================================================
// ADMIN — SEGMENTS
// ============================================================================

app.get("/admin/segments", requirePanel, async (c) => {
  const { data } = await db().from("segments").select("*").order("created_at", { ascending: false });
  return c.json({ segments: data || [] });
});

app.post("/admin/segments", requirePanel, async (c) => {
  const body = await c.req.json();
  const { data, error } = await db().from("segments").insert({
    name: body.name, description: body.description || null, filters: body.filters,
  }).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ segment: data }, 201);
});

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
  return c.json({ segment: data });
});

app.delete("/admin/segments/:id", requirePanel, async (c) => {
  await db().from("segments").delete().eq("segment_id", c.req.param("id"));
  return c.json({ ok: true });
});

app.get("/admin/segments/:id/telegram-users", requirePanel, async (c) => {
  const id = c.req.param("id");
  const { data: segment } = await db().from("segments").select("filters").eq("segment_id", id).single();
  if (!segment) return c.json({ error: "Segment not found" }, 404);
  const { data: channels } = await db().from("node_channels").select("channel_identifier, nodes!inner(status)").eq("channel", "telegram");
  const telegramUserIds = (channels || []).filter((ch: any) => ch.nodes?.status === "active").map((ch: any) => ch.channel_identifier);
  return c.json({ telegramUserIds });
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
// ADMIN — BOT MANAGER
// ============================================================================

// 1. Listar preguntas del bot
app.get("/bot/questions", requirePanel, async (c) => {
  const { data, error } = await db()
    .from("bot_questions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return c.json({ error: error.message }, 500);

  const formatted = (data || []).map((bq: any) => ({
    id: bq.bot_question_id,
    text: bq.message_config?.text || "",
    options: bq.message_config?.options || [],
    imageUrl: bq.message_config?.imageUrl || null,
    rewardTickets: bq.message_config?.rewardTickets || 0,
    sentCount: bq.total_sent || 0,
    lastSentAt: bq.sent_at || null,
    createdAt: bq.created_at,
    updatedAt: bq.created_at,
  }));

  return c.json({ questions: formatted });
});

// 2. Crear nueva pregunta de bot
app.post("/bot/questions", requirePanel, async (c) => {
  const body = await c.req.json();
  const { text, options, imageUrl, rewardTickets } = body;

  // 1. Primero creamos el registro obligatorio en la tabla 'questions'
  const { data: q, error: qErr } = await db().from("questions").insert({
    type: "bot_question",
    label: text,
    config: { options, imageUrl },
    reward_tickets: rewardTickets || 0,
    reward_cash: 0
  }).select("question_id").single();

  if (qErr) return c.json({ error: qErr.message }, 500);

  // 2. Ahora sí, creamos el registro del bot vinculándolo
  const { data: bq, error: bqErr } = await db().from("bot_questions").insert({
    bot_question_id: crypto.randomUUID(),
    question_id: q.question_id, // <-- ESTO ES LO QUE FALTABA
    message_config: { text, options, imageUrl, rewardTickets },
    total_sent: 0,
    total_answered: 0,
  }).select("bot_question_id").single();

  if (bqErr) {
    // Si falla, hacemos limpieza
    await db().from("questions").delete().eq("question_id", q.question_id);
    return c.json({ error: bqErr.message }, 500);
  }
  return c.json({ ok: true, id: bq.bot_question_id });
});

// 3. Actualizar pregunta del bot
app.put("/bot/questions/:id", requirePanel, async (c) => {
  const bqId = c.req.param("id");
  const { text, options, imageUrl, rewardTickets } = await c.req.json();

  const { data: bq } = await db().from("bot_questions").select("question_id").eq("bot_question_id", bqId).single();
  if (!bq) return c.json({ error: "Not found" }, 404);

  // Actualizamos la tabla principal
  await db().from("questions").update({
    label: text,
    config: { options, imageUrl },
    reward_tickets: rewardTickets || 0,
  }).eq("question_id", bq.question_id);

  // Actualizamos la tabla del bot
  const { error } = await db().from("bot_questions").update({
    message_config: { text, options, imageUrl, rewardTickets },
  }).eq("bot_question_id", bqId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// 4. Eliminar pregunta de bot
app.delete("/bot/questions/:id", requirePanel, async (c) => {
  const bqId = c.req.param("id");
  const { data: bq } = await db().from("bot_questions").select("question_id").eq("bot_question_id", bqId).single();
  
  // Borramos de la tabla bot
  await db().from("bot_questions").delete().eq("bot_question_id", bqId);
  
  // Borramos de la tabla principal
  if (bq?.question_id) {
    await db().from("questions").delete().eq("question_id", bq.question_id);
  }
  return c.json({ ok: true });
});
// 5. Enviar pregunta via Telegram (Todos o Segmento)
app.post("/bot/send-question/:id", requirePanel, async (c) => {
  const bqId = c.req.param("id");
  const { targetTelegramUserIds } = await c.req.json().catch(() => ({ targetTelegramUserIds: null }));

  const { data: bq } = await db().from("bot_questions").select("*").eq("bot_question_id", bqId).single();
  if (!bq || !bq.message_config) return c.json({ error: "Not found" }, 404);

  let chatIds = [];
  if (targetTelegramUserIds && targetTelegramUserIds.length > 0) {
    chatIds = targetTelegramUserIds;
  } else {
    const { data: channels } = await db().from("node_channels").select("channel_identifier, nodes!inner(status)").eq("channel", "telegram").eq("nodes.status", "active");
    chatIds = (channels || []).map((ch: any) => ch.channel_identifier);
  }

  if (chatIds.length === 0) return c.json({ sent: 0, failed: 0, total: 0 });

  const text = bq.message_config.text;
  const options = bq.message_config.options || [];
  const imageUrl = bq.message_config.imageUrl;

  const keyboard = options.map((opt: string, i: number) => ([{
    text: opt,
    callback_data: `bq:${bqId}:${i}`
  }]));

  let sent = 0, failed = 0;
  for (const chatId of chatIds) {
    try {
      const payload: any = { chat_id: chatId, reply_markup: { inline_keyboard: keyboard } };
      let url = `https://api.telegram.org/bot${botToken()}/sendMessage`;
      
      if (imageUrl) {
         url = `https://api.telegram.org/bot${botToken()}/sendPhoto`;
         payload.photo = imageUrl;
         payload.caption = text;
      } else {
         payload.text = text;
      }
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (r.ok) sent++; else failed++;
    } catch (e) { failed++; }
  }

  await db().from("bot_questions").update({
    total_sent: (bq.total_sent || 0) + sent,
    sent_at: new Date().toISOString()
  }).eq("bot_question_id", bqId);

  return c.json({ sent, failed, total: chatIds.length });
});

// 6. Enviar Notificación Custom via Telegram
app.post("/bot/send-notification", requirePanel, async (c) => {
  const { text, type, imageUrl, buttonText, buttonUrl, targetTelegramUserIds } = await c.req.json();

  let chatIds = [];
  if (targetTelegramUserIds && targetTelegramUserIds.length > 0) {
    chatIds = targetTelegramUserIds;
  } else {
    const { data: channels } = await db().from("node_channels").select("channel_identifier, nodes!inner(status)").eq("channel", "telegram").eq("nodes.status", "active");
    chatIds = (channels || []).map((ch: any) => ch.channel_identifier);
  }

  let inline_keyboard = [];
  if (type === "drop") {
    inline_keyboard = [[{ text: buttonText || "Abrir BRUTAL", web_app: { url: "https://brutal.up.railway.app" } }]];
  } else if (buttonText && buttonUrl) {
    inline_keyboard = [[{ text: buttonText, url: buttonUrl }]];
  }

  let sent = 0, failed = 0;
  for (const chatId of chatIds) {
    try {
      const payload: any = { chat_id: chatId };
      if (inline_keyboard.length > 0) payload.reply_markup = { inline_keyboard };

      let url = `https://api.telegram.org/bot${botToken()}/sendMessage`;
      if (imageUrl) {
         url = `https://api.telegram.org/bot${botToken()}/sendPhoto`;
         payload.photo = imageUrl;
         payload.caption = text;
      } else {
         payload.text = text;
      }

      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (r.ok) sent++; else failed++;
    } catch (e) { failed++; }
  }
  return c.json({ sent, failed, total: chatIds.length });
});

// 7. Listar suscriptores para el panel
app.get("/bot/subscribers", requirePanel, async (c) => {
  const { data: channels } = await db().from("node_channels").select("channel_identifier, nodes!inner(nickname, status, created_at, last_active_at)").eq("channel", "telegram");

  const subscribers = (channels || []).map((ch: any) => ({
    userId: ch.channel_identifier,
    firstName: ch.nodes?.nickname || "Sin nombre",
    lastName: "",
    username: "",
    chatId: ch.channel_identifier,
    firstSeen: ch.nodes?.created_at,
    lastSeen: ch.nodes?.last_active_at || ch.nodes?.created_at,
    active: ch.nodes?.status === "active"
  }));

  return c.json({ total: subscribers.length, active: subscribers.filter((s: any) => s.active).length, subscribers });
});

// 8. Ver respuestas a una pregunta específica
app.get("/bot-responses/:id", requirePanel, async (c) => {
  const bqId = c.req.param("id");
  const { data: bq } = await db().from("bot_questions").select("*").eq("bot_question_id", bqId).single();
  if (!bq) return c.json({ error: "Not found"}, 404);

  const { data: resps } = await db().from("responses")
    .select("response_id, node_id, choice, choice_index, created_at, raw_response, nodes(nickname)")
    .eq("source", "bot");

  const specificResps = (resps || []).filter((r: any) => r.raw_response?.bot_question_id === bqId);

  const optionCounts: Record<string, number> = {};
  const options = bq.message_config?.options || [];
  options.forEach((o: string) => optionCounts[o] = 0);

  const formattedResponses = specificResps.map((r: any) => {
    const optText = r.choice || options[r.choice_index] || "Unknown";
    optionCounts[optText] = (optionCounts[optText] || 0) + 1;
    return {
      questionId: bqId,
      userId: r.node_id,
      firstName: r.nodes?.nickname || "Anónimo",
      username: "",
      optionIndex: r.choice_index,
      optionText: optText,
      answeredAt: r.created_at
    };
  }).sort((a: any, b: any) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime());

  return c.json({ total: specificResps.length, optionCounts, responses: formattedResponses });
});

// 9. Fake endpoints para dejar contento al panel que busca estado de Polling
app.get("/bot-status", requirePanel, async (c) => {
  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken()}/getWebhookInfo`);
    const info = await r.json();
    return c.json({
      ok: true,
      mode: "webhook", 
      webhookUrl: info.result?.url || "Activo",
      webhookPending: info.result?.pending_update_count || 0,
      botUsername: "BrutalBot", 
      botName: "BRUTAL"
    });
  } catch (e) { return c.json({ ok: false }, 500); }
});
app.post("/bot/poll", requirePanel, async (c) => c.json({ ok: true, processed: 0, total: 0 }));
app.post("/bot-delete-webhook", requirePanel, async (c) => c.json({ ok: true }));

// ============================================================================
// BOT WEBHOOK
// ============================================================================

app.post("/bot/webhook", async (c) => {
  const update = await c.req.json();
  const botT = botToken();
  
  async function tgSend(method: string, body: any) {
    try {
      await fetch(`https://api.telegram.org/bot${botT}/${method}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
    } catch (e) {
      console.error("[BOT] Error enviando mensaje a TG:", e);
    }
  }

  // LÓGICA EN SEGUNDO PLANO: Procesamos todo acá adentro
  const processWebhook = async () => {
    try {
      if (update.message?.contact) {
        const contact = update.message.contact;
        const tgUserId = contact.user_id;
        let phone = contact.phone_number;
        if (!phone.startsWith("+")) phone = "+" + phone;

        if (tgUserId) {
          const { data: chs } = await db().from("node_channels")
            .select("node_id").eq("channel", "telegram").eq("channel_identifier", String(tgUserId)).limit(1);
            
          if (chs?.[0]?.node_id) {
            await db().from("nodes").update({
              phone: phone, phone_verified: true, phone_source: "telegram"
            }).eq("node_id", chs[0].node_id);
          } else {
            const { data: newNode } = await db().from("nodes").insert({
              phone: phone, phone_verified: true, phone_source: "telegram", status: "incomplete", onboarding_step: 1
            }).select("node_id").single();
            
            if (newNode) {
              const newAnon = "anon_" + crypto.randomUUID().replace(/-/g, "").slice(0, 32);
              Promise.all([
                db().from("node_channels").insert({ node_id: newNode.node_id, channel: "telegram", channel_identifier: String(tgUserId), is_primary: true }),
                db().from("profiles").insert({ node_id: newNode.node_id, cash_balance: 0, cash_lifetime: 0, cash_withdrawn: 0, tickets_current: 0, tickets_lifetime: 0, drops_completed: 0, bot_questions_answered: 0, traps_passed: 0, traps_failed: 0, current_streak: 0, best_streak: 0 }),
                db().from("anonymous_id_map").insert({ node_id: newNode.node_id, anonymous_id: newAnon })
              ]).catch(e => console.error("[BOT] Error en inserts paralelos:", e));
            }
          }
        }
        return;
      }

      if (update.message?.text?.startsWith("/start")) {
        const chatId = update.message.chat.id;
        const userId = update.message.from.id;
        
        let node = await resolveNode(userId);
        
        if (!node) {
          const { data: newNode } = await db().from("nodes").insert({
            status: "incomplete", 
            onboarding_step: 1
          }).select("node_id").single();
          
          if (newNode) {
            const newAnon = "anon_" + crypto.randomUUID().replace(/-/g, "").slice(0, 32);
            Promise.all([
              db().from("node_channels").insert({ node_id: newNode.node_id, channel: "telegram", channel_identifier: String(userId), is_primary: true }),
              db().from("profiles").insert({ node_id: newNode.node_id, cash_balance: 0, cash_lifetime: 0, cash_withdrawn: 0, tickets_current: 0, tickets_lifetime: 0, drops_completed: 0, bot_questions_answered: 0, traps_passed: 0, traps_failed: 0, current_streak: 0, best_streak: 0 }),
              db().from("anonymous_id_map").insert({ node_id: newNode.node_id, anonymous_id: newAnon })
            ]).catch(e => console.error("[BOT] Error en inserts paralelos:", e));
            node = { node_id: newNode.node_id, status: "incomplete", nickname: null };
          }
        }
        
        const { data: stepData } = await db().from("nodes").select("onboarding_step").eq("node_id", node?.node_id).limit(1);
        const currentStep = stepData?.[0]?.onboarding_step || 1;
        const displayName = node?.nickname || "Node";
        
        if (node?.status === "incomplete") {
          if (currentStep <= 1) {
            await tgSend("sendMessage", {
              chat_id: chatId,
              text: `⚡ <b>BRUTAL</b>\n\nHola.\n\nRegistrate para jugar Drops, ganar plata real y competir por premios.`,
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: [[{ text: "🔥 Entrar", web_app: { url: `https://brutal.up.railway.app/entrar` } }]] }
            });
          } else {
            await tgSend("sendMessage", {
              chat_id: chatId,
              text: `📝 Hola${displayName !== "Node" ? ` ${displayName}` : ""}, te quedaste por la mitad.\n\nCompletá tu registro para asegurar tu lugar en la fila.`,
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: [[{ text: "📝 Completar registro", web_app: { url: `https://brutal.up.railway.app/entrar` } }]] }
            });
          }
          return;
        }
        
        if (node?.status !== "active") {
          const nameStr = displayName !== "Node" ? ` ${displayName}` : "";
          const msgs: any = {
            pending: `⏳ Hola${nameStr}, tu cuenta está en revisión. Te avisamos cuando estés dentro.`,
            blocked: "🚫 Tu cuenta fue suspendida.",
            rejected: "❌ Tu solicitud no fue aprobada.",
          };
          await tgSend("sendMessage", { chat_id: chatId, text: msgs[node?.status || "pending"] || "⚠️ Tu cuenta no está activa.", parse_mode: "HTML" });
          return;
        }
        
        const { data: activeDropRows } = await db().from("drops").select("drop_id, name").eq("status", "active").limit(1);
        const activeDrop = activeDropRows?.[0];
        
        let text = `⚡ <b>BRUTAL</b>\n\nBienvenido de vuelta, ${displayName}.\n\nUsá /drop para jugar, /perfil para ver tu balance, /leaderboard para el ranking.`;
        let keyboard: any[] = [];

        if (activeDrop) {
          const { data: done } = await db().from("sessions").select("session_id").eq("node_id", node.node_id).eq("drop_id", activeDrop.drop_id).in("status", ["completed", "claimed"]).limit(1);
          if (done?.[0]) {
            text += `\n\n✅ Ya jugaste <b>${activeDrop.name}</b>. Quedate atento a nuevas preguntas para sumar tickets 🎟️.`;
            keyboard = [[{ text: "📊 Ver mi Perfil", web_app: { url: `https://brutal.up.railway.app/?screen=profile` } }]];
          } else {
            text += `\n\n🎯 <b>${activeDrop.name}</b> está activo. ¡Entrá a jugar!`;
            keyboard = [[{ text: "▶️ Jugar Drop", web_app: { url: `https://brutal.up.railway.app/` } }]];
          }
        } else {
           text += `\n\n😴 No hay ningún Drop activo en este momento.`;
           keyboard = [[{ text: "📊 Ver mi Perfil", web_app: { url: `https://brutal.up.railway.app/?screen=profile` } }]];
        }

        await tgSend("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined });
        return;
      }

      if (update.message?.text?.startsWith("/drop")) {
        const chatId = update.message.chat.id;
        const userId = update.message.from.id;
        const node = await resolveNode(userId);
        
        if (!node) {
          await tgSend("sendMessage", {
            chat_id: chatId, text: "⚡ Todavía no sos parte de <b>BRUTAL</b>.\n\nRegistrate para jugar Drops, ganar plata y competir por premios.", parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "🔥 Entrar", web_app: { url: `https://brutal.up.railway.app/entrar` } }]] }
          });
          return;
        }
        if (node.status !== "active") {
          const msgs: any = {
            pending: "⏳ Tu cuenta está en revisión. Te avisamos cuando estés dentro.",
            blocked: "🚫 Tu cuenta fue suspendida.",
            rejected: "❌ Tu solicitud no fue aprobada.",
            incomplete: "📝 Te falta completar el registro.",
          };
          await tgSend("sendMessage", {
            chat_id: chatId, text: msgs[node.status] || "⚠️ Tu cuenta no está activa.", parse_mode: "HTML",
            ...(node.status === "incomplete" ? { reply_markup: { inline_keyboard: [[{ text: "📝 Completar registro", web_app: { url: `https://brutal.up.railway.app/entrar` } }]] } } : {})
          });
          return;
        }
        
        const { data: activeDropRows } = await db().from("drops").select("drop_id, name").eq("status", "active").limit(1);
        const activeDrop = activeDropRows?.[0];

        if (!activeDrop) {
          await tgSend("sendMessage", { chat_id: chatId, text: "😴 No hay ningún Drop activo ahora.\n\nQuedate atento, el bot te avisa cuando salga uno nuevo. Mientras tanto, contestá las preguntas que te mande para sumar tickets 🎟️", parse_mode: "HTML" });
          return;
        }
        
        const { data: done } = await db().from("sessions").select("session_id").eq("node_id", node.node_id).eq("drop_id", activeDrop.drop_id).in("status", ["completed", "claimed"]).limit(1);
        if (done?.[0]) {
          await tgSend("sendMessage", { chat_id: chatId, text: `✅ Ya jugaste <b>${activeDrop.name}</b>.\n\nQuedate atento que el bot te manda preguntas sueltas todo el tiempo y sumás tickets 🎟️ para el sorteo.`, parse_mode: "HTML" });
          return;
        }
        
        await tgSend("sendMessage", {
          chat_id: chatId, text: `🎯 <b>${activeDrop.name}</b> está activo.\n\nResponde rápido, ganá monedas y tickets.`, parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[{ text: "▶️ Jugar", web_app: { url: `https://brutal.up.railway.app` } }]] }
        });
        return;
      }

      if (update.message?.text?.startsWith("/help")) {
        const chatId = update.message.chat.id;
        await tgSend("sendMessage", {
          chat_id: chatId, text: `⚡ <b>BRUTAL — Comandos</b>\n\n/start — Iniciar\n/drop — Jugar el Drop activo\n/leaderboard — Ver ranking\n/perfil — Tu perfil y balance\n/help — Ver ayuda\n\nLos Drops se publican semanalmente. Respondé rápido, ganá cash y tickets.`, parse_mode: "HTML",
        });
        return;
      }

      if (update.message?.text?.startsWith("/leaderboard")) {
        const chatId = update.message.chat.id;
        const { data } = await db().from("profiles").select("tickets_current, nodes(nickname)").order("tickets_current", { ascending: false }).limit(10);
        let text = "🏆 <b>LEADERBOARD</b>\n\n";
        if (!data?.length) {
          text += "Todavía no hay jugadores.";
        } else {
          data.forEach((p: any, i: number) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
            const name = p.nodes?.nickname || "Anónimo";
            text += `${medal} <b>${name}</b> — ${p.tickets_current || 0} 🎟️\n`;
          });
        }
        await tgSend("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
        return;
      }

      if (update.message?.text?.startsWith("/perfil")) {
        const chatId = update.message.chat.id;
        const userId = update.message.from.id;
        const node = await resolveNode(userId);
        if (!node) {
          await tgSend("sendMessage", {
            chat_id: chatId, text: "⚠️ No estás registrado. Abrí la app primero.",
            reply_markup: { inline_keyboard: [[{ text: "🔥 Abrir BRUTAL", web_app: { url: `https://brutal.up.railway.app/entrar` } }]] }
          });
          return;
        }
        const { data: profile } = await db().from("profiles")
          .select("cash_balance, tickets_current, tickets_lifetime, drops_completed, bot_questions_answered").eq("node_id", node.node_id).single();
        const { data: nd } = await db().from("nodes")
          .select("nickname, compass_archetype, referral_code").eq("node_id", node.node_id).single();
        
        const p = profile || {};
        const text = `⚡ <b>Tu Perfil</b>\n\n👤 <b>${nd?.nickname || "Node"}</b>\n${nd?.compass_archetype ? `🧭 ${nd.compass_archetype}\n` : ""}\n💰 Balance: <b>$${p.cash_balance || 0}</b>\n🎟️ Tickets (season): <b>${p.tickets_current || 0}</b>\n🎟️ Tickets (lifetime): <b>${p.tickets_lifetime || 0}</b>\n📦 Drops completados: <b>${p.drops_completed || 0}</b>\n🤖 Bot preguntas: <b>${p.bot_questions_answered || 0}</b>\n\n🔗 Tu código: <code>${nd?.referral_code || "—"}</code>`;
        
        await tgSend("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
        return;
      }

      if (update.callback_query) {
        const cb = update.callback_query;
        const chatId = cb.message.chat.id;
        const userId = cb.from.id;
        const data = cb.callback_data;
        await tgSend("answerCallbackQuery", { callback_query_id: cb.id });

        if (data?.startsWith("bq:")) {
          const parts = data.split(":");
          const botQuestionId = parts[1];
          const choiceIndex = parseInt(parts[2]);

          const node = await resolveNode(userId);
          if (!node) {
            await tgSend("sendMessage", {
              chat_id: chatId, text: "⚠️ No estás registrado. Abrí la app primero.",
              reply_markup: { inline_keyboard: [[{ text: "🔥 Abrir BRUTAL", web_app: { url: `https://brutal.up.railway.app/entrar` } }]] }
            });
            return;
          }

          // FIX: Buscamos en bot_questions y extraemos los datos de message_config
          const { data: bq } = await db().from("bot_questions").select("*").eq("bot_question_id", botQuestionId).single();
          
          if (bq && bq.message_config) {
            const config = bq.message_config;
            const anonymous_id = await anonId(node.node_id);
            const options = config.options || [];
            const chosenOption = options[choiceIndex] || `option_${choiceIndex}`;
            const rewardTickets = config.rewardTickets || 0;

            // Guardar la respuesta
            await db().from("responses").insert({
              node_id: node.node_id, anonymous_id, question_id: botQuestionId, drop_id: bq.linked_drop_id || null,
              question_type: "bot_question", choice: chosenOption,
              choice_index: choiceIndex, raw_response: { callback_data: data, bot_question_id: botQuestionId },
              source: "bot", reward_type: rewardTickets > 0 ? "golden_ticket" : null,
              reward_value: rewardTickets, reward_granted: true,
            });

            // Dar premios (Tickets)
            if (rewardTickets > 0) {
              const { data: p } = await db().from("profiles").select("tickets_current, tickets_lifetime").eq("node_id", node.node_id).single();
              if (p) {
                await db().from("profiles").update({
                  tickets_current: (p.tickets_current || 0) + rewardTickets, 
                  tickets_lifetime: (p.tickets_lifetime || 0) + rewardTickets,
                  bot_questions_answered: (p.bot_questions_answered || 0) + 1
                }).eq("node_id", node.node_id);
              }
            } else {
              // Si no daba tickets, igual sumamos la métrica
              const { data: p } = await db().from("profiles").select("bot_questions_answered").eq("node_id", node.node_id).single();
              if (p) {
                await db().from("profiles").update({ bot_questions_answered: (p.bot_questions_answered || 0) + 1 }).eq("node_id", node.node_id);
              }
            }

            // Actualizar la métrica de total respondido en la pregunta del bot
            await db().from("bot_questions").update({
               total_answered: (bq.total_answered || 0) + 1
            }).eq("bot_question_id", botQuestionId);

            // Responderle al usuario en Telegram
            const rewardText = rewardTickets > 0 ? `+${rewardTickets} 🎟️` : "✅";
            await tgSend("editMessageText", {
              chat_id: chatId, message_id: cb.message.message_id, text: `${cb.message.text}\n\n<b>Tu respuesta:</b> ${chosenOption}\n${rewardText}`, parse_mode: "HTML",
            });
          }
        }
        return;
      }
    } catch (err) {
      console.error("[BOT] Error procesando webhook:", err);
    }
  };

  // DISPARAR Y OLVIDAR: Ejecuta el proceso en segundo plano.
  processWebhook();

  // RESPUESTA INSTANTÁNEA A TELEGRAM: "Ya te escuché, no me lo mandes de nuevo"
  return c.json({ ok: true });
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
    ? Math.round(latencyData.reduce((s: any, r: any) => s + r.latency_ms, 0) / latencyData.length)
    : null;

  return c.json({ ...drop, total_responses: responseCount || 0, avg_latency_ms: avgLatency });
});

// ============================================================================
// ADMIN STATS
// ============================================================================

app.get("/admin/stats", requirePanel, async (c) => {
  const [
    { count: totalNodes }, { count: activeNodes }, { count: pendingNodes },
    { count: totalSessions }, { count: completedSessions }, { count: totalResponses },
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
    responses: totalResponses, pending_claims: pendingClaims,
  });
});

app.get("/node-status", requireTelegram, async (c) => {
  const user = c.get("tgUser");
  const node = await resolveNode(user.id);
  if (!node) return c.json({ status: "unknown", registered: false });
  return c.json({ status: node.status, registered: true, node_id: node.node_id });
});

// ============================================================================
// RESCUE BOT (Auto-recuperación de Onboarding)
// ============================================================================

// Este proceso corre silenciosamente en el servidor cada 15 minutos
setInterval(async () => {
  try {
    const botT = botToken();
    if (!botT) return;

    // 1. Buscamos a todos los usuarios que siguen "incomplete"
    const { data: nodes } = await db()
      .from("nodes")
      .select("node_id, nickname, created_at, onboarding_data")
      .eq("status", "incomplete");

    if (!nodes || nodes.length === 0) return;

    const now = new Date().getTime();
    
    for (const node of nodes) {
      const nodeTime = new Date(node.created_at).getTime();
      
      // 2. Si pasaron menos de 30 minutos desde que arrancó, le damos tiempo. No lo molestamos.
      if (now - nodeTime < 30 * 60 * 1000) continue; 

      // 3. Revisamos si ya le mandamos el recordatorio antes
      const data = node.onboarding_data || {};
      if (data.reminded) continue;

      // 4. Buscamos su chat de Telegram
      const { data: channel } = await db()
        .from("node_channels")
        .select("channel_identifier")
        .eq("node_id", node.node_id)
        .eq("channel", "telegram")
        .limit(1);

      if (channel?.[0]?.channel_identifier) {
        const displayName = node.nickname || "ahí";
        
        // 5. Mandamos el mensaje proactivo
        await fetch(`https://api.telegram.org/bot${botT}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: channel[0].channel_identifier,
            text: `👀 ¡Ey${displayName !== "ahí" ? ` ${displayName}` : ""}! Te quedaste a mitad de camino.\n\nCompletá tus datos y las ráfagas para asegurar tu lugar en la fila. ¡No te quedes afuera!`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: "📝 Terminar de registrarme", web_app: { url: `https://brutal.up.railway.app/entrar` } }
              ]]
            }
          }),
        });

        // 6. Lo marcamos silenciosamente como "avisado" para no spamearlo a los 15 minutos
        data.reminded = true;
        await db().from("nodes").update({ onboarding_data: data }).eq("node_id", node.node_id);
        
        console.log(`[RESCUE BOT] Recordatorio de abandono enviado a ${node.node_id}`);
      }
    }
  } catch (err) {
    console.error("[RESCUE BOT] Error en el worker:", err);
  }
}, 15 * 60 * 1000); // Se ejecuta cada 15 minutos (900,000 ms)

// ============================================================================
// FOLLOW-UP BOT (15 min después del Drop - Referral & Notificaciones)
// ============================================================================

setInterval(async () => {
  try {
    const botT = botToken();
    if (!botT) return;

    const now = new Date().getTime();
    const fifteenMinsAgo = new Date(now - 15 * 60 * 1000).toISOString();
    const thirtyMinsAgo = new Date(now - 30 * 60 * 1000).toISOString(); // Ventana de 15 min para no repetirlo al infinito

    // Buscamos perfiles que completaron >0 drops hace exactamente 15-30 mins
    const { data: profiles } = await db()
      .from("profiles")
      .select("node_id, drops_completed, last_drop_at, nodes!inner(nickname, referral_code, onboarding_data)")
      .gt("drops_completed", 0)
      .lte("last_drop_at", fifteenMinsAgo)
      .gte("last_drop_at", thirtyMinsAgo);

    if (!profiles || profiles.length === 0) return;

    for (const p of profiles) {
      const node = (p as any).nodes;
      const data = node.onboarding_data || {};
      
      // Si ya le mandamos el recordatorio de referidos, lo salteamos
      if (data.referral_reminded) continue;

      const { data: channel } = await db()
        .from("node_channels")
        .select("channel_identifier")
        .eq("node_id", p.node_id)
        .eq("channel", "telegram")
        .limit(1);

      if (channel?.[0]?.channel_identifier) {
        const referralLink = `https://t.me/BrutalDropBot/jugar?startapp=ref_${node.referral_code}`;
        const displayName = node.nickname ? ` ${node.nickname}` : "";
        
        const text = `🔥 ¡Bien jugado${displayName}!\n\nYa completaste tu primer Drop.\n\nAcordate que por cada amigo que invites a BRUTAL, vas a multiplicar tus ganancias y subir en el ranking.\n\nCompartile tu link exclusivo a tus amigos:\n<code>${referralLink}</code>\n\n🔔 <b>¡Activá las notificaciones de este chat!</b> Es la única forma de enterarte a tiempo cuando hay plata nueva en la mesa.`;

        await fetch(`https://api.telegram.org/bot${botT}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: channel[0].channel_identifier,
            text: text,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: "📲 Invitar a un amigo", url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("Sumate a BRUTAL, respondé preguntas y ganá cash real.")}` }
              ]]
            }
          }),
        });

        // Marcamos como enviado para no spamear
        data.referral_reminded = true;
        await db().from("nodes").update({ onboarding_data: data }).eq("node_id", p.node_id);
        console.log(`[FOLLOW-UP BOT] Recordatorio enviado a ${p.node_id}`);
      }
    }
  } catch (err) {
    console.error("[FOLLOW-UP BOT] Error:", err);
  }
}, 5 * 60 * 1000); // Chequea cada 5 minutos

// ============================================================================
// STATIC FILES
// ============================================================================

app.use("/assets/*", serveStatic({ root: "./dist" }));

app.get("*", (c) => {
  const indexPath = "./dist/index.html";
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, "utf-8");
    return c.html(html);
  }
  return c.json({ error: "Frontend not built" }, 404);
});

app.onError((err, c) => {
  console.error("[BRUTAL]", err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = parseInt(process.env.PORT || "3000");
console.log(`[BRUTAL] Server v3.0 starting on port ${port}`);
serve({ fetch: app.fetch, port });
