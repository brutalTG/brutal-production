// ============================================================
// SIGNAL STORE — Persistence & Signal Analysis
// ============================================================
// Stores all drop session data to localStorage.
// Computes BIC (Brecha Inter-Carta) for Signal Pairs.
// Exports complete session data as JSON for analysis.
// ============================================================

import type { UserAnswer } from "./archetype-engine";
import type { Question } from "./drop-types";
import type { InteractionRecord } from "./latency-tracker";

// --- Session data structure ---

export interface DropSession {
  /** Drop ID */
  dropId: string;
  /** Drop name */
  dropName: string;
  /** Session start timestamp (ISO) */
  startedAt: string;
  /** Session end timestamp (ISO), set on reveal */
  completedAt?: string;
  /** Telegram user ID (anonymous — not tied to identity) */
  telegramUserId?: number;
  /** Platform (ios/android/web) */
  platform: string;
  /** All answers keyed by question index */
  answers: Record<number, UserAnswer>;
  /** Raw latency records from the tracker */
  latencyRecords: InteractionRecord[];
  /** Accumulated rewards */
  rewards: {
    coins: number;
    tickets: number;
    multiplier: number;
    finalTickets: number;
  };
  /** Computed archetype (if any) */
  archetype?: {
    id: string;
    title: string;
  };
  /** Signal Pair BIC analysis */
  signalPairs: SignalPairResult[];
  /** Per-card signal metrics */
  cardMetrics: CardMetric[];
  /** Abandonment tracking: last question index reached */
  lastQuestionIndex: number;
  /** Did the user complete the full drop? */
  completed: boolean;
  /** Trap card results */
  trapResults: { questionIndex: number; correct: boolean }[];
}

export interface CardMetric {
  questionIndex: number;
  questionType: string;
  latencyMs: number | null;
  /** Deviation from user's average latency (positive = slower than average) */
  latencyDeviationMs: number | null;
  /** Was this an instinctive response? (<1500ms) */
  instinctive: boolean;
  /** Was this a doubt moment? (>5000ms) */
  doubt: boolean;
  /** Did the user timeout? */
  timedOut: boolean;
  /** Signal pair ID if part of a pair */
  signalPairId?: string;
  /** Card classification */
  cardType: "brand" | "culture" | "trap" | "dead_drop" | "unknown";
}

export interface SignalPairResult {
  pairId: string;
  cardA: { questionIndex: number; answer: UserAnswer | null; latencyMs: number | null };
  cardB: { questionIndex: number; answer: UserAnswer | null; latencyMs: number | null };
  /** BIC score: divergence between paired responses (0 = consistent, higher = more divergent) */
  bic: number;
  /** Human-readable BIC interpretation */
  bicLabel: "consistent" | "mild_divergence" | "significant_divergence" | "contradiction";
}

// --- Constants ---

const STORAGE_KEY_PREFIX = "brutal_session_";
const INSTINCT_THRESHOLD_MS = 1500;
const DOUBT_THRESHOLD_MS = 5000;

// --- BIC Calculation ---

/**
 * Calculate Brecha Inter-Carta (BIC) between two paired answers.
 * Returns a score from 0 (perfectly consistent) to 100 (complete contradiction).
 *
 * BIC measures the gap between what a user says in one context vs another.
 * High BIC = fragile consensus, the user's position shifts with framing.
 * Low BIC = real conviction, stable across different angles.
 */
function calculateBIC(
  answerA: UserAnswer | undefined,
  answerB: UserAnswer | undefined,
  latencyA: number | null,
  latencyB: number | null
): number {
  if (!answerA || !answerB) return -1; // Can't compute — missing data

  let divergence = 0;

  // --- Response divergence (0–70 points) ---

  // Choice vs Choice: did they pick the "same direction"?
  if (answerA.type === "choice" && answerB.type === "choice") {
    if (answerA.selectedIndex !== answerB.selectedIndex) {
      divergence += 50;
    }
  }

  // Slider vs Choice: high slider + "safe" choice = divergence
  if (answerA.type === "slider" && answerB.type === "choice") {
    divergence += 20;
  }
  if (answerB.type === "slider" && answerA.type === "choice") {
    divergence += 20;
  }

  // Prediction vs Choice: betting against your own stated preference
  if (answerA.type === "prediction_bet" && answerB.type === "choice") {
    divergence += 25;
  }
  if (answerB.type === "prediction_bet" && answerA.type === "choice") {
    divergence += 25;
  }

  // Confesionario is always qualitative — mark as requiring human review
  if (answerA.type === "confesionario" || answerB.type === "confesionario") {
    divergence += 15;
  }

  // --- Latency divergence (0–30 points) ---
  if (latencyA !== null && latencyB !== null) {
    const latencyDiff = Math.abs(latencyA - latencyB);
    if (latencyDiff > 3000) {
      divergence += 30;
    } else if (latencyDiff > 1500) {
      divergence += 15;
    } else if (latencyDiff > 800) {
      divergence += 5;
    }
  }

  return Math.min(100, divergence);
}

function bicLabel(bic: number): "consistent" | "mild_divergence" | "significant_divergence" | "contradiction" {
  if (bic < 0) return "consistent";
  if (bic < 15) return "consistent";
  if (bic < 40) return "mild_divergence";
  if (bic < 70) return "significant_divergence";
  return "contradiction";
}

// --- Card metric computation ---

function inferCardType(q: Question): "brand" | "culture" | "trap" | "dead_drop" | "unknown" {
  if (q.cardType) return q.cardType;
  if (q.type === "trap" || q.type === "trap_silent") return "trap";
  if (q.type === "dead_drop") return "dead_drop";
  if (q.reward?.type === "coins") return "brand";
  if (q.reward?.type === "tickets") return "culture";
  return "unknown";
}

// --- Session management ---

let currentSession: DropSession | null = null;

/**
 * Start a new session for a drop.
 * Clears any previous in-progress session.
 */
export function startSession(dropId: string, dropName: string, platform: string, telegramUserId?: number) {
  currentSession = {
    dropId,
    dropName,
    startedAt: new Date().toISOString(),
    telegramUserId,
    platform,
    answers: {},
    latencyRecords: [],
    rewards: { coins: 0, tickets: 0, multiplier: 1, finalTickets: 0 },
    signalPairs: [],
    cardMetrics: [],
    lastQuestionIndex: -1,
    completed: false,
    trapResults: [],
  };
}

/**
 * Record an answer for a question.
 */
export function recordAnswer(questionIndex: number, answer: UserAnswer) {
  if (!currentSession) return;
  currentSession.answers[questionIndex] = answer;
  if (questionIndex > currentSession.lastQuestionIndex) {
    currentSession.lastQuestionIndex = questionIndex;
  }

  // Track trap results
  if (answer.type === "trap") {
    currentSession.trapResults.push({ questionIndex, correct: answer.correct });
  }

  // Persist after each answer (crash-safe)
  persistSession();
}

/**
 * Finalize the session: compute metrics, BIC, save to localStorage.
 */
export function finalizeSession(
  questions: Question[],
  latencyRecords: InteractionRecord[],
  rewards: { coins: number; tickets: number; multiplier: number },
  archetype?: { id: string; title: string },
  telegramUserId?: number
): DropSession | null {
  if (!currentSession) return null;

  // Safety: if telegramUserId wasn't available at session start but is now, set it
  if (telegramUserId && !currentSession.telegramUserId) {
    currentSession.telegramUserId = telegramUserId;
  }

  currentSession.completedAt = new Date().toISOString();
  currentSession.completed = true;
  currentSession.latencyRecords = latencyRecords;
  currentSession.rewards = {
    ...rewards,
    finalTickets: Math.round(rewards.tickets * rewards.multiplier),
  };
  if (archetype) {
    currentSession.archetype = archetype;
  }

  // Compute per-card metrics
  const allLatencies = latencyRecords.map((r) => r.latencyMs);
  const avgLatency = allLatencies.length > 0
    ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length
    : 0;

  currentSession.cardMetrics = questions.map((q, i) => {
    const answer = currentSession!.answers[i];
    const record = latencyRecords.find((r) => r.questionIndex === i);
    const latencyMs = answer && "latencyMs" in answer ? (answer.latencyMs ?? null) : null;
    const recordLatency = record?.latencyMs ?? null;
    const effectiveLatency = latencyMs ?? recordLatency;

    return {
      questionIndex: i,
      questionType: q.type,
      latencyMs: effectiveLatency,
      latencyDeviationMs: effectiveLatency !== null ? Math.round(effectiveLatency - avgLatency) : null,
      instinctive: effectiveLatency !== null && effectiveLatency < INSTINCT_THRESHOLD_MS,
      doubt: effectiveLatency !== null && effectiveLatency > DOUBT_THRESHOLD_MS,
      timedOut: answer?.type === "timeout",
      signalPairId: q.signalPairId,
      cardType: inferCardType(q),
    };
  });

  // Compute Signal Pair BIC
  const pairMap = new Map<string, number[]>();
  questions.forEach((q, i) => {
    if (q.signalPairId) {
      const existing = pairMap.get(q.signalPairId) || [];
      existing.push(i);
      pairMap.set(q.signalPairId, existing);
    }
  });

  currentSession.signalPairs = [];
  for (const [pairId, indices] of pairMap) {
    if (indices.length >= 2) {
      const [idxA, idxB] = indices;
      const answerA = currentSession.answers[idxA];
      const answerB = currentSession.answers[idxB];
      const metricA = currentSession.cardMetrics[idxA];
      const metricB = currentSession.cardMetrics[idxB];

      const bic = calculateBIC(answerA, answerB, metricA?.latencyMs ?? null, metricB?.latencyMs ?? null);

      currentSession.signalPairs.push({
        pairId,
        cardA: { questionIndex: idxA, answer: answerA || null, latencyMs: metricA?.latencyMs ?? null },
        cardB: { questionIndex: idxB, answer: answerB || null, latencyMs: metricB?.latencyMs ?? null },
        bic,
        bicLabel: bicLabel(bic),
      });
    }
  }

  // Persist final session
  persistSession();

  return currentSession;
}

/**
 * Get the current session (for real-time access).
 */
export function getCurrentSession(): DropSession | null {
  return currentSession;
}

/**
 * Update the current viewing position (for abandon tracking).
 * Called when a question renders, even before the user answers.
 */
export function updateCurrentPosition(questionIndex: number) {
  if (!currentSession) return;
  currentSession.lastQuestionIndex = Math.max(currentSession.lastQuestionIndex, questionIndex);
  persistSession();
}

// --- localStorage persistence ---

function persistSession() {
  if (!currentSession) return;
  try {
    const key = `${STORAGE_KEY_PREFIX}${currentSession.dropId}`;
    localStorage.setItem(key, JSON.stringify(currentSession));
  } catch (_e) {
    // localStorage full or unavailable — silent fail
  }
}

/**
 * Load a previous session from localStorage.
 */
export function loadSession(dropId: string): DropSession | null {
  try {
    const key = `${STORAGE_KEY_PREFIX}${dropId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as DropSession;
  } catch (_e) {
    return null;
  }
}

/**
 * Get all stored sessions.
 */
export function getAllSessions(): DropSession[] {
  const sessions: DropSession[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          sessions.push(JSON.parse(raw));
        }
      }
    }
  } catch (_e) {
    // Ignore
  }
  return sessions;
}

/**
 * Export the current (or specified) session as a formatted JSON string.
 * This is the complete dataset for analysis.
 */
export function exportSessionJSON(session?: DropSession): string {
  const s = session || currentSession;
  if (!s) return "{}";
  return JSON.stringify(s, null, 2);
}

/**
 * Clear all stored sessions.
 */
export function clearAllSessions() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (_e) {
    // Ignore
  }
}