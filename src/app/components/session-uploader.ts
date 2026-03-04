// ============================================================
// SESSION UPLOADER v2 — Per-card upload con retry y offline queue
// ============================================================
// Flujo correcto de 3 pasos:
//   1. startSession(dropId)      → POST /sessions/start   → session_id
//   2. uploadResponse(...)       → POST /responses        → per-card, inmediato
//   3. completeSession(...)      → POST /sessions/complete
//
// Diseño fire-and-forget: ningún error bloquea la UI del Drop.
// Retry con backoff exponencial (1s, 2s, 4s) para errores de servidor.
// Queue offline: acumula responses cuando no hay red, drena al reconectar.
// ============================================================

import type { Question } from "./drop-types";
import type { UserAnswer } from "./archetype-engine";

// --- Auth header ---

function getTelegramInitData(): string {
  try {
    return (window as any).Telegram?.WebApp?.initData || "";
  } catch {
    return "";
  }
}

function tgHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Telegram-Init-Data": getTelegramInitData(),
  };
}

// ============================================================
// Retry con backoff exponencial
// ============================================================

const RETRY_DELAYS_MS = [1000, 2000, 4000];

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      // 4xx son errores del cliente → no reintenta (datos incorrectos)
      if (res.status >= 400 && res.status < 500) return res;
      // 5xx → reintenta
      if (!res.ok && attempt < retries) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? 4000);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? 4000);
      }
    }
  }
  throw lastErr;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// Estado de sesión
// ============================================================

let _sessionId: string | null = null;
let _dropId: string | null = null;

// ============================================================
// Offline queue
// ============================================================

interface QueuedResponse {
  payload: ResponsePayload;
}

const _offlineQueue: QueuedResponse[] = [];
let _draining = false;

// Escucha reconexión para drenar la queue
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    drainQueue();
  });
}

async function drainQueue(): Promise<void> {
  if (_draining || _offlineQueue.length === 0) return;
  _draining = true;
  console.log(`[BRUTAL] Drenando queue offline: ${_offlineQueue.length} respuestas pendientes`);

  while (_offlineQueue.length > 0) {
    const item = _offlineQueue[0];
    const ok = await sendResponse(item.payload);
    if (ok) {
      _offlineQueue.shift();
    } else {
      console.warn("[BRUTAL] Queue drain: fallo al enviar, reintentando en 5s");
      await sleep(5000);
      break;
    }
  }
  _draining = false;
}

// ============================================================
// PASO 1: Iniciar sesión
// ============================================================

export async function startSession(dropId: string): Promise<boolean> {
  _dropId = dropId;
  _sessionId = null;

  try {
    const res = await fetchWithRetry("/sessions/start", {
      method: "POST",
      headers: tgHeaders(),
      body: JSON.stringify({ drop_id: dropId }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[BRUTAL] sessions/start failed (${res.status}): ${errText}`);
      return false;
    }

    const data = await res.json();
    _sessionId = data.sessionId ?? data.session_id ?? null;
    console.log(`[BRUTAL] Sesión iniciada: ${_sessionId}, multiplier: ${data.multiplier}`);

    // Si había responses encoladas esperando session_id, drenarlas ahora
    if (_sessionId && _offlineQueue.length > 0) {
      // Actualizar session_id en todos los items encolados
      for (const item of _offlineQueue) {
        item.payload.session_id = _sessionId;
      }
      drainQueue();
    }

    return !!_sessionId;
  } catch (err) {
    console.error("[BRUTAL] sessions/start error:", err);
    return false;
  }
}

// ============================================================
// Payload type para POST /responses
// ============================================================

export interface ResponsePayload {
  session_id: string;
  drop_id: string;
  question_id: string;
  position_in_drop: number;
  question_type: string;
  choice?: string;
  choice_index?: number;
  text_response?: string;
  slider_value?: number;
  ranking_result?: unknown;
  rafaga_choices?: unknown;
  raw_response?: unknown;
  latency_ms: number;
}

// ============================================================
// Mapper: UserAnswer → campos planos del server
// ============================================================

function answerToPayloadFields(
  answer: UserAnswer,
  question: Question
): Partial<ResponsePayload> {
  const base: Partial<ResponsePayload> = {
    latency_ms: (answer as { latencyMs?: number }).latencyMs ?? 0,
  };

  switch (answer.type) {
    case "choice":
    case "hot_take": {
      const q = question as { options?: Array<{ text?: string; label?: string }> };
      const opts = q.options || [];
      const opt = opts[answer.selectedIndex];
      return {
        ...base,
        choice_index: answer.selectedIndex,
        choice: opt?.text ?? opt?.label ?? String(answer.selectedIndex),
        raw_response: { selectedIndex: answer.selectedIndex },
      };
    }

    case "slider":
      return {
        ...base,
        slider_value: answer.value,
        raw_response: { value: answer.value },
      };

    case "ranking":
      return {
        ...base,
        ranking_result: answer.order,
        raw_response: { order: answer.order },
      };

    case "rafaga":
      return {
        ...base,
        rafaga_choices: answer.answers,
        raw_response: { answers: answer.answers },
      };

    case "prediction_bet":
      return {
        ...base,
        choice: answer.side,
        choice_index: answer.side === "A" ? 0 : 1,
        raw_response: { side: answer.side },
      };

    case "trap":
      return {
        ...base,
        choice: answer.correct ? "correct" : "incorrect",
        choice_index: answer.correct ? 1 : 0,
        raw_response: { correct: answer.correct },
      };

    case "trap_silent":
      return {
        ...base,
        choice: answer.correct ? "correct" : "incorrect",
        choice_index: (answer as { selectedIndex?: number }).selectedIndex ?? 0,
        raw_response: {
          correct: answer.correct,
          selectedIndex: (answer as { selectedIndex?: number }).selectedIndex,
        },
      };

    case "confesionario":
      return {
        ...base,
        text_response: (answer as { text?: string }).text ?? "",
        raw_response: { type: "confesionario" },
      };

    case "dead_drop":
    case "timeout":
      return {
        ...base,
        raw_response: { type: answer.type },
      };

    default:
      return base;
  }
}

// ============================================================
// Envío individual (interno)
// ============================================================

async function sendResponse(payload: ResponsePayload): Promise<boolean> {
  try {
    const res = await fetchWithRetry("/responses", {
      method: "POST",
      headers: tgHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[BRUTAL] /responses failed (${res.status}): ${errText}`);
      return false;
    }

    const data = await res.json();
    console.log(
      `[BRUTAL] Response saved: pos=${payload.position_in_drop}, reward=${data.reward_value} ${data.reward_type}, granted=${data.reward_granted}`
    );
    return true;
  } catch (err) {
    console.error("[BRUTAL] /responses error:", err);
    return false;
  }
}

// ============================================================
// PASO 2: Upload de una respuesta individual (fire-and-forget)
// ============================================================

export function uploadResponse(params: {
  question: Question;
  questionIndex: number;
  answer: UserAnswer;
  dropId?: string;
}): void {
  const { question, questionIndex, answer } = params;
  const dropId = params.dropId ?? _dropId;

  if (!dropId) {
    console.warn("[BRUTAL] uploadResponse: no dropId disponible, skipping");
    return;
  }

  // question_id viene del server via PlayableDrop (campo `id` en dbToPlayableDrop)
  // Si no está disponible (drop de sample/dev), generamos un placeholder
  const questionId = (question as { id?: string }).id ?? `sample-q-${questionIndex}`;

  const payload: ResponsePayload = {
    session_id: _sessionId ?? "pending",
    drop_id: dropId,
    question_id: questionId,
    position_in_drop: questionIndex,
    question_type: question.type,
    ...answerToPayloadFields(answer, question),
  };

  // Si no hay session_id todavía (start aún en vuelo), encolar
  if (!_sessionId) {
    console.warn(`[BRUTAL] uploadResponse: sesión no iniciada, encola pos=${questionIndex}`);
    _offlineQueue.push({ payload });
    return;
  }

  // Sin red → encolar
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    console.log(`[BRUTAL] Sin red, encola response pos=${questionIndex}`);
    _offlineQueue.push({ payload });
    return;
  }

  // Fire-and-forget
  sendResponse(payload).then((ok) => {
    if (!ok) {
      console.warn(`[BRUTAL] uploadResponse falló, encola pos=${questionIndex}`);
      _offlineQueue.push({ payload });
    }
  });
}

// ============================================================
// PASO 3: Completar sesión
// ============================================================

export async function completeSession(params?: {
  archetype_result?: unknown;
  bic_scores?: unknown;
}): Promise<boolean> {
  if (!_sessionId) {
    console.warn("[BRUTAL] completeSession: no hay session_id activo");
    return false;
  }

  // Drenar queue pendiente antes de completar
  await drainQueue();

  try {
    const body: Record<string, unknown> = { session_id: _sessionId };
    if (params?.archetype_result) body.archetype_result = params.archetype_result;
    if (params?.bic_scores) body.bic_scores = params.bic_scores;

    const res = await fetchWithRetry("/sessions/complete", {
      method: "POST",
      headers: tgHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[BRUTAL] sessions/complete failed (${res.status}): ${errText}`);
      return false;
    }

    console.log(`[BRUTAL] Sesión completada: ${_sessionId}`);
    _sessionId = null;
    return true;
  } catch (err) {
    console.error("[BRUTAL] sessions/complete error:", err);
    return false;
  }
}

// ============================================================
// Legacy exports — backward compat
// ============================================================

import type { DropSession } from "./signal-store";

/**
 * @deprecated Usar startSession + uploadResponse + completeSession
 * No-op mantenido para backward compat.
 */
export async function uploadSession(_session: DropSession): Promise<boolean> {
  console.warn("[BRUTAL] uploadSession() está deprecado — usar el flujo per-card");
  return true;
}

/**
 * @deprecated Usar completeSession()
 * Drena la queue offline si hay items pendientes.
 */
export async function waitForUpload(): Promise<void> {
  await drainQueue();
}

/**
 * Claim de rewards — llama al endpoint con auth correcta.
 */
export async function claimRewards(params: {
  telegramUserId: number;
  dropId: string;
  coins: number;
  tickets: number;
  finalTickets: number;
}): Promise<{
  ok: boolean;
  alreadyClaimed?: boolean;
  credited?: { coins: number; tickets: number; dropsCompleted: number };
}> {
  console.log(
    `[BRUTAL] Claiming rewards: userId=${params.telegramUserId}, dropId=${params.dropId}`
  );

  try {
    const res = await fetchWithRetry("/claim-rewards", {
      method: "POST",
      headers: tgHeaders(),
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[BRUTAL] claim-rewards failed (${res.status}): ${errText}`);
      throw new Error(`Claim failed: ${res.status} ${errText}`);
    }

    const result = await res.json();
    console.log("[BRUTAL] Claim result:", result);
    return result;
  } catch (err) {
    console.error("[BRUTAL] claimRewards error:", err);
    throw err;
  }
}
