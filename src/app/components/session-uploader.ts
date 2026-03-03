// ============================================================
// SESSION UPLOADER — Session persistence to Supabase
// ============================================================
// Sends the session payload to the backend KV store.
// Now includes telegramUserId for reward attribution.
// Fire-and-forget: errors are logged but never block the UI.
// ============================================================

import { projectId, publicAnonKey } from "/utils/supabase/info";
import type { DropSession } from "./signal-store";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-c68eb08c`;

/**
 * Generate a random anonymous session ID.
 * Uses crypto.randomUUID when available, falls back to timestamp+random.
 */
function generateSessionId(): string {
  try {
    return crypto.randomUUID();
  } catch (_e) {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Strip PII from answers:
 * - confesionario answers: keep type + latency, drop any user text
 * - all answers: remove any fields that could identify the user
 */
function anonymizeAnswers(
  answers: Record<number, any>
): Record<number, any> {
  const clean: Record<number, any> = {};
  for (const [idx, answer] of Object.entries(answers)) {
    if (!answer) continue;
    if (answer.type === "confesionario") {
      // Only keep type and latency — no text
      clean[Number(idx)] = {
        type: "confesionario",
        latencyMs: answer.latencyMs ?? null,
      };
    } else {
      // All other answer types are safe (indices, values, booleans)
      clean[Number(idx)] = { ...answer };
    }
  }
  return clean;
}

/**
 * Build the payload from a finalized DropSession.
 * telegramUserId is included for reward attribution (it's a numeric ID, not PII).
 */
function buildPayload(session: DropSession) {
  return {
    sessionId: generateSessionId(),
    dropId: session.dropId,
    dropName: session.dropName,
    platform: session.platform,
    telegramUserId: session.telegramUserId || null,
    startedAt: session.startedAt,
    completedAt: session.completedAt || null,
    answers: anonymizeAnswers(session.answers),
    cardMetrics: session.cardMetrics || [],
    signalPairs: session.signalPairs || [],
    rewards: session.rewards || null,
    archetype: session.archetype || null,
    lastQuestionIndex: session.lastQuestionIndex,
    completed: session.completed,
    trapResults: session.trapResults || [],
  };
}

/** Track upload status so the UI can wait before closing */
let _uploadPromise: Promise<boolean> | null = null;

/**
 * Upload an anonymized session to the backend.
 * Uses keepalive: true so the fetch survives mini app close / page unload.
 * Never throws, never blocks the UI.
 */
export async function uploadSession(session: DropSession): Promise<boolean> {
  const doUpload = async (): Promise<boolean> => {
    try {
      const payload = buildPayload(session);
      const body = JSON.stringify(payload);

      console.log(`[BRUTAL] Uploading session: telegramUserId=${payload.telegramUserId}, completed=${payload.completed}, rewards=${JSON.stringify(payload.rewards)}`);

      const res = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body,
        keepalive: true, // Critical: survives page unload / mini app close
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`[BRUTAL] Session upload failed (${res.status}): ${errBody}`);
        return false;
      }

      const result = await res.json();
      console.log(`[BRUTAL] Session uploaded: ${result.key}`);
      return true;
    } catch (err) {
      console.error(`[BRUTAL] Session upload error: ${err}`);
      return false;
    }
  };

  _uploadPromise = doUpload();
  return _uploadPromise;
}

/**
 * Wait for any pending upload to complete.
 * Used by close/claim flow to ensure session data is saved before claiming.
 */
export async function waitForUpload(): Promise<void> {
  if (_uploadPromise) {
    await _uploadPromise;
    _uploadPromise = null;
  }
}

/**
 * Claim rewards for a completed drop — calls dedicated `/claim-rewards` endpoint.
 * This is the ONLY place where drop rewards are credited to the user profile.
 * Idempotent: server checks if already claimed for this (user, drop) pair.
 * Returns { ok, alreadyClaimed?, credited? } on success, throws on network error.
 */
export async function claimRewards(params: {
  telegramUserId: number;
  dropId: string;
  coins: number;
  tickets: number;
  finalTickets: number;
}): Promise<{ ok: boolean; alreadyClaimed?: boolean; credited?: { coins: number; tickets: number; dropsCompleted: number } }> {
  const body = JSON.stringify(params);
  console.log(`[BRUTAL] Claiming rewards: userId=${params.telegramUserId}, dropId=${params.dropId}, coins=${params.coins}, tickets=${params.finalTickets}`);

  const res = await fetch(`${API_BASE}/claim-rewards`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${publicAnonKey}`,
    },
    body,
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`[BRUTAL] Claim failed (${res.status}): ${errBody}`);
    throw new Error(`Claim failed: ${res.status} ${errBody}`);
  }

  const result = await res.json();
  console.log(`[BRUTAL] Claim result:`, result);
  return result;
}