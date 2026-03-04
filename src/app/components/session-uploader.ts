// ============================================================
// SESSION UPLOADER — Per-card upload lifecycle to Hono server
// ============================================================
// Architecture (3-call lifecycle):
//   1. serverStartSession(dropId) → POST /sessions/start → session_id
//   2. uploadResponse(question, index, answer, dropId) → POST /responses (per-card, immediate)
//   3. completeSession({ archetype_result, bic_scores }) → POST /sessions/complete
//
// All three endpoints require X-Telegram-Init-Data header.
// Fire-and-forget: errors are swallowed and never block the Drop UI.
// Offline queue: responses accumulate in memory when offline, flushed on reconnect.
// ============================================================

import type { UserAnswer } from "./archetype-engine";
import type { Question } from "./drop-types";

// ============================================================
// State
// ============================================================

let _sessionId: string | null = null;
let _dropId: string | null = null;

/** Offline queue — responses that couldn't be sent yet */
const _offlineQueue: Array<{ question: Question; index: number; answer: UserAnswer; dropId: string }> = [];

/** Track the completeSession promise so the UI can await it */
let _completionPromise: Promise<boolean> | null = null;

// ============================================================
// Helpers
// ============================================================

/** Get Telegram initData for auth header */
function getTelegramInitData(): string {
  try {
    return (window as any).Telegram?.WebApp?.initData || "";
  } catch {
    return "";
  }
}

/** Build common headers */
function authHeaders(): Record<string, string> {
  const initData = getTelegramInitData();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (initData) h["X-Telegram-Init-Data"] = initData;
  return h;
}

/**
 * Fetch with retry — 3 attempts, exponential backoff (1s, 2s, 4s).
 * Only retries 5xx errors. 4xx are considered permanent failures.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxAttempts = 3
): Promise<Response | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      // 4xx = permanent failure, don't retry
      if (res.status >= 400 && res.status < 500) {
        const body = await res.text().catch(() => "");
        console.error(`[BRUTAL] ${url} → ${res.status}: ${body}`);
        return null;
      }
      // 5xx = transient, retry
      console.warn(`[BRUTAL] ${url} → ${res.status}, attempt ${attempt}/${maxAttempts}`);
    } catch (err) {
      console.warn(`[BRUTAL] ${url} network error, attempt ${attempt}/${maxAttempts}:`, err);
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  console.error(`[BRUTAL] ${url} failed after ${maxAttempts} attempts`);
  return null;
}

/**
 * Map UserAnswer fields to the flat fields expected by POST /responses.
 * Server expects: choice_index, slider_value, ranking_result, rafaga_choices,
 *   text_response, latency_ms, raw_response
 */
function answerToPayloadFields(answer: UserAnswer): Record<string, any> {
  const fields: Record<string, any> = {
    latency_ms: answer.latencyMs ?? null,
  };

  switch (answer.type) {
    case "choice":
    case "hot_take":
    case "trap_silent":
      fields.choice_index = answer.selectedIndex;
      break;
    case "slider":
      fields.slider_value = answer.value;
      break;
    case "ranking":
      fields.ranking_result = answer.order;
      break;
    case "rafaga":
      fields.rafaga_choices = answer.answers;
      break;
    case "trap":
      fields.raw_response = JSON.stringify({ correct: answer.correct });
      break;
    case "confesionario":
      // Text is stripped for privacy in the answer pipeline;
      // if somehow present, send as text_response
      fields.text_response = (answer as any).text || null;
      break;
    case "dead_drop":
    case "timeout":
      // No additional data
      break;
    case "prediction_bet":
      fields.choice = answer.side;
      break;
  }

  return fields;
}

// ============================================================
// Lifecycle: 1. Start Session
// ============================================================

/**
 * Start a server session for a Drop.
 * Returns the session_id on success, null on failure.
 * Non-blocking — call in background.
 */
export async function serverStartSession(dropId: string): Promise<string | null> {
  _dropId = dropId;
  _sessionId = null;

  try {
    const res = await fetchWithRetry("/sessions/start", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ drop_id: dropId }),
    });

    if (!res) return null;
    const data = await res.json();
    _sessionId = data.session_id || null;
    console.log(`[BRUTAL] Session started: ${_sessionId} (resumed: ${data.resumed})`);

    // Now flush any responses that queued while session was starting
    if (_sessionId && _offlineQueue.length > 0) {
      _flushQueue();
    }

    return _sessionId;
  } catch (err) {
    console.error("[BRUTAL] startSession error:", err);
    return null;
  }
}

// ============================================================
// Lifecycle: 2. Upload Response (per-card)
// ============================================================

/**
 * Upload a single card response to the server.
 * If offline or session not started, queues for later.
 * Fire-and-forget — never throws, never blocks UI.
 */
export async function uploadResponse(
  question: Question,
  index: number,
  answer: UserAnswer,
  dropId: string
): Promise<void> {
  // Queue if offline
  if (!navigator.onLine) {
    _offlineQueue.push({ question, index, answer, dropId });
    console.log(`[BRUTAL] Offline — queued response for card ${index}`);
    return;
  }

  // Queue if session not started yet
  if (!_sessionId) {
    _offlineQueue.push({ question, index, answer, dropId });
    console.log(`[BRUTAL] No session_id yet — queued response for card ${index}`);
    return;
  }

  await _sendResponse(question, index, answer, dropId);
}

/** Internal: actually send a response to the server */
async function _sendResponse(
  question: Question,
  index: number,
  answer: UserAnswer,
  dropId: string
): Promise<void> {
  if (!_sessionId) return;

  const payload: Record<string, any> = {
    session_id: _sessionId,
    drop_id: dropId,
    question_id: (question as any).questionId || null,
    position_in_drop: index,
    question_type: question.type,
    source: "drop_card",
    ...answerToPayloadFields(answer),
  };

  try {
    const res = await fetchWithRetry("/responses", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
      keepalive: true, // Survives page unload
    });

    if (res) {
      const data = await res.json().catch(() => ({}));
      console.log(`[BRUTAL] Response ${index} uploaded: reward=${data.reward_granted}, cash=${data.cash_credited}, tickets=${data.tickets_credited}`);
    }
  } catch (err) {
    console.error(`[BRUTAL] Response ${index} upload error:`, err);
  }
}

// ============================================================
// Lifecycle: 3. Complete Session
// ============================================================

/**
 * Mark the session as completed on the server.
 * Flushes offline queue first.
 */
export async function completeSession(params: {
  archetype_result?: { id: string; title: string };
  bic_scores?: any;
}): Promise<boolean> {
  const doComplete = async (): Promise<boolean> => {
    // Flush any queued responses first
    await _flushQueue();

    if (!_sessionId) {
      console.warn("[BRUTAL] completeSession called without session_id");
      return false;
    }

    try {
      const res = await fetchWithRetry("/sessions/complete", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          session_id: _sessionId,
          archetype_result: params.archetype_result || null,
          bic_scores: params.bic_scores || null,
        }),
      });

      if (!res) return false;
      const data = await res.json().catch(() => ({}));
      console.log("[BRUTAL] Session completed:", data);
      return true;
    } catch (err) {
      console.error("[BRUTAL] completeSession error:", err);
      return false;
    }
  };

  _completionPromise = doComplete();
  return _completionPromise;
}

// ============================================================
// Offline Queue
// ============================================================

/** Flush all queued responses */
async function _flushQueue(): Promise<void> {
  if (_offlineQueue.length === 0) return;
  if (!_sessionId) return;

  console.log(`[BRUTAL] Flushing ${_offlineQueue.length} queued responses`);
  const queue = [..._offlineQueue];
  _offlineQueue.length = 0;

  for (const item of queue) {
    await _sendResponse(item.question, item.index, item.answer, item.dropId);
  }
}

// Auto-flush when coming back online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("[BRUTAL] Back online — flushing queue");
    _flushQueue();
  });
}

// ============================================================
// Legacy stubs — kept for backward compatibility
// ============================================================

/** @deprecated No-op. Sessions are now uploaded per-card. */
export async function uploadSession(_session: any): Promise<boolean> {
  console.log("[BRUTAL] uploadSession() is deprecated — responses are sent per-card now");
  return true;
}

/** Wait for any pending completion to finish */
export async function waitForUpload(): Promise<void> {
  await _flushQueue();
  if (_completionPromise) {
    await _completionPromise;
    _completionPromise = null;
  }
}

/**
 * Claim rewards for a completed drop.
 * Idempotent: server checks if already claimed.
 */
export async function claimRewards(params: {
  telegramUserId: number;
  dropId: string;
  coins: number;
  tickets: number;
  finalTickets: number;
}): Promise<{ ok: boolean; alreadyClaimed?: boolean; credited?: { coins: number; tickets: number; dropsCompleted: number } }> {
  console.log(`[BRUTAL] Claiming rewards: userId=${params.telegramUserId}, dropId=${params.dropId}, coins=${params.coins}, tickets=${params.finalTickets}`);

  const res = await fetch("/claim-rewards", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`[BRUTAL] Claim failed (${res.status}): ${errBody}`);
    throw new Error(`Claim failed: ${res.status} ${errBody}`);
  }

  const result = await res.json();
  console.log("[BRUTAL] Claim result:", result);
  return result;
}

/** Reset state between drops */
export function resetUploader(): void {
  _sessionId = null;
  _dropId = null;
  _offlineQueue.length = 0;
  _completionPromise = null;
}
