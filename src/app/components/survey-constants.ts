// ============================================================
// SURVEY CONSTANTS — Pure helpers & constants for SurveyApp
// ============================================================

import type { Question } from "./drop-types";

export const REWARD_ANIM_MS = 900;
export const REACTION_MS = 700;

// --- Action hint per question type ---
const ACTION_HINTS: Partial<Record<Question["type"], string>> = {
  choice: "Elegi una",
  choice_emoji: "Reacciona",
  choice_hybrid: "Elegi una",
  prediction_bet: "Aposta",
  ranking: "Ordena",
  confesionario: "Confesionario",
  slider: "Desliza",
  slider_emoji: "Desliza",
  trap: "Elegi una",
  trap_silent: "Elegi una",
  hot_take: "Hot take",
  hot_take_visual: "Hot take",
  binary_media: "Elegi una",
  rafaga: "Rafaga",
  rafaga_emoji: "Rafaga",
};

export function getActionHint(q: Question): string {
  return ACTION_HINTS[q.type] ?? "";
}

// --- Tonal variation: timeout messages ---
const TIMEOUT_POOL = [
  "Brutal eligió por vos. De nada.",
  "El silencio también es respuesta. Pero no suma.",
  "Se te acabó el tiempo.",
  "Tarde. Siguiente.",
  "Timeout. Input descartado.",
  "Sin respuesta. Avanzando.",
  "La no-respuesta también es dato.",
  "Dudar tanto es una forma de responder.",
  "Brutal eligió por vos.",
];

export function pickTimeoutMessage(): string {
  return TIMEOUT_POOL[Math.floor(Math.random() * TIMEOUT_POOL.length)];
}

// --- Question types that have options arrays (for scoring map) ---
const TYPES_WITH_OPTIONS = new Set<Question["type"]>([
  "ranking", "choice", "trap", "hot_take", "trap_silent",
  "choice_emoji", "choice_hybrid", "hot_take_visual",
]);

export function buildQuestionOptionsMap(questions: Question[]): Record<number, string[]> {
  const map: Record<number, string[]> = {};
  questions.forEach((q, i) => {
    if (TYPES_WITH_OPTIONS.has(q.type) && "options" in q) {
      map[i] = (q as { options: string[] }).options;
    }
    if (q.type === "media_reaction" && q.options) {
      map[i] = q.options;
    }
  });
  return map;
}

// --- Full-screen question types (skip the standard header layout) ---
export const FULLSCREEN_TYPES = new Set<Question["type"]>([
  "dead_drop", "hot_take", "hot_take_visual", "media_reaction", "rafaga_burst",
]);
