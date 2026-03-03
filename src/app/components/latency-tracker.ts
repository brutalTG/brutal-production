/**
 * Latency tracking system for survey interactions.
 *
 * Measures time between question render and first user interaction.
 * Latency < INSTINCT_THRESHOLD_MS = instinctive response
 * Latency > DOUBT_THRESHOLD_MS = moment of doubt
 */

const INSTINCT_THRESHOLD_MS = 1500;
const DOUBT_THRESHOLD_MS = 5000;

export interface InteractionRecord {
  questionIndex: number;
  questionType: string;
  latencyMs: number;
  timestamp: number;
}

let records: InteractionRecord[] = [];
let currentQuestionStart: number | null = null;
let currentQuestionIndex: number = -1;
let currentQuestionType: string = "";
let firstInteractionRecorded: boolean = false;

/**
 * Call when a question screen mounts / becomes visible.
 * Resets the timer for the current question.
 */
export function markQuestionRendered(questionIndex: number, questionType: string) {
  currentQuestionStart = performance.now();
  currentQuestionIndex = questionIndex;
  currentQuestionType = questionType;
  firstInteractionRecorded = false;
}

/**
 * Call on the FIRST user interaction with the current question.
 * Records the latency and returns the value in ms.
 * Subsequent calls for the same question are ignored.
 */
export function markFirstInteraction(): number | null {
  if (firstInteractionRecorded || currentQuestionStart === null) return null;
  firstInteractionRecorded = true;

  const latencyMs = Math.round(performance.now() - currentQuestionStart);

  const record: InteractionRecord = {
    questionIndex: currentQuestionIndex,
    questionType: currentQuestionType,
    latencyMs,
    timestamp: Date.now(),
  };

  records.push(record);
  return latencyMs;
}

/**
 * Get all recorded interactions.
 */
export function getRecords(): InteractionRecord[] {
  return [...records];
}

/**
 * Reset all tracking data.
 */
export function resetRecords() {
  records = [];
  currentQuestionStart = null;
  currentQuestionIndex = -1;
  currentQuestionType = "";
  firstInteractionRecorded = false;
}

// --- Aggregate helpers for the reveal screen ---

/**
 * Average latency across all recorded interactions.
 */
export function getAverageLatency(): number {
  if (records.length === 0) return 0;
  const sum = records.reduce((acc, r) => acc + r.latencyMs, 0);
  return Math.round(sum / records.length);
}

/**
 * Count of instinctive responses (latency below threshold).
 */
export function getInstinctiveCount(): number {
  return records.filter((r) => r.latencyMs < INSTINCT_THRESHOLD_MS).length;
}

/**
 * Count of doubt moments (latency above threshold).
 */
export function getDoubtCount(): number {
  return records.filter((r) => r.latencyMs > DOUBT_THRESHOLD_MS).length;
}

/**
 * Total time from first question render to last interaction, formatted.
 */
export function getTotalTime(): string {
  if (records.length === 0) return "0s";
  const first = records[0].timestamp - records[0].latencyMs;
  const last = records[records.length - 1].timestamp;
  const totalMs = last - first;
  const totalSec = Math.round(totalMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `${min}m ${sec.toString().padStart(2, "0")}s`;
  return `${sec}s`;
}

/**
 * Format average latency as string (e.g. "556ms" or "1.2s").
 */
export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
