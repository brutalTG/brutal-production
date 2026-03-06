// ============================================================
// PANEL STORE — State management for Drop Builder admin panel
// ============================================================
// localStorage = fuente de verdad para la UI
// Cada operación CRUD también escribe al server Hono via panel-sync
// ============================================================

import type { Question, Drop, RevealArchetype, RevealScoringConfig, MultiplierCheckpoint, SplashConfig } from "../drop-types";
import {
  syncQuestionCreate,
  syncQuestionUpdate,
  syncQuestionDelete,
  syncDropCreate,
  syncDropUpdate,
  syncDropDelete,
} from "./panel-sync";

// --- Panel-specific types ---

export interface PanelQuestion {
  /** UUID */
  id: string;
  /** The question data (matches Drop schema exactly) */
  data: Question;
  /** Admin-only metadata */
  label: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type DropStatus = "draft" | "active" | "archived";

export interface PanelDrop {
  /** UUID */
  id: string;
  name: string;
  dropId: string; // The actual drop.id used in the app
  status: DropStatus;
  timeoutMessage: string;
  multiplierCheckpoints: Record<string, MultiplierCheckpoint>;
  reveal: {
    title: string;
    description: string;
    archetypes: RevealArchetype[];
    scoring?: RevealScoringConfig;
  };
  /** Ordered list of PanelQuestion IDs */
  questionIds: string[];
  /** IDs of questions disabled (pending) — kept in drop but not published */
  disabledQuestionIds?: string[];
  /** Splash screen customization */
  splash?: SplashConfig;
  /** Segment restriction — only users in these segments see this drop */
  segmentIds?: string[];
  createdAt: string;
  updatedAt: string;
}

// --- Storage keys ---
const QUESTIONS_KEY = "brutal_panel_questions";
const DROPS_KEY = "brutal_panel_drops";

// --- Helpers ---

function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch (_e) {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function now(): string {
  return new Date().toISOString();
}

// --- Schema mapping: PanelQuestion → server format ---

function toServerQuestion(q: PanelQuestion) {
  // Extraemos los rewards del objeto data para enviarlos como columnas de primer nivel
  const rewardCash = q.data.reward?.type === "coins" ? (q.data.reward.value || 0) : 0;
  const rewardTickets = q.data.reward?.type === "tickets" ? (q.data.reward.value || 0) : 0;

  return {
    question_id: q.id, // Pasamos el ID del panel como question_id para el upsert
    type: q.data.type,
    config: q.data, // Aquí viajan los segmentIds y toda la data de la pregunta
    label: q.label,
    tags: q.tags,
    reward_cash: rewardCash,
    reward_tickets: rewardTickets,
  };
}

function toServerDrop(d: PanelDrop) {
  return {
    drop_id: d.dropId,
    name: d.name,
    status: d.status,
    config: {
      dropId: d.dropId,
      status: d.status,
      timeoutMessage: d.timeoutMessage,
      multiplierCheckpoints: d.multiplierCheckpoints,
      reveal: d.reveal,
      questionIds: d.questionIds,
      disabledQuestionIds: d.disabledQuestionIds,
      splash: d.splash,
    },
    segment_ids: d.segmentIds || null,
  };
}

// --- Question CRUD ---

export function getQuestions(): PanelQuestion[] {
  try {
    const raw = localStorage.getItem(QUESTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_e) {
    return [];
  }
}

function saveQuestionsLocal(questions: PanelQuestion[]) {
  localStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions));
}

export function createQuestion(data: Question, label?: string, tags?: string[]): PanelQuestion {
  const questions = getQuestions();
  const q: PanelQuestion = {
    id: generateId(),
    data,
    label: label || data.type + " — " + ("text" in data ? (data as any).text?.slice(0, 40) || "Sin texto" : "Sin texto"),
    tags: tags || [],
    createdAt: now(),
    updatedAt: now(),
  };
  questions.push(q);
  saveQuestionsLocal(questions);

  // Sync to server
  syncQuestionCreate(toServerQuestion(q)).catch((err) => {
    console.warn("[Store] syncQuestionCreate failed:", err);
  });

  return q;
}

export function updateQuestion(id: string, data: Partial<Question>, label?: string, tags?: string[]): PanelQuestion | null {
  const questions = getQuestions();
  const idx = questions.findIndex((q) => q.id === id);
  if (idx === -1) return null;
  
  questions[idx].data = { ...questions[idx].data, ...data } as Question;
  if (label !== undefined) questions[idx].label = label;
  if (tags !== undefined) questions[idx].tags = tags;
  questions[idx].updatedAt = now();
  
  saveQuestionsLocal(questions);

  // Sync to server
  syncQuestionUpdate(id, toServerQuestion(questions[idx])).catch((err) => {
    console.warn("[Store] syncQuestionUpdate failed:", err);
  });

  return questions[idx];
}

export function deleteQuestion(id: string): boolean {
  const questions = getQuestions();
  const filtered = questions.filter((q) => q.id !== id);
  if (filtered.length === questions.length) return false;
  saveQuestionsLocal(filtered);

  const drops = getDrops();
  let dropsChanged = false;
  for (const drop of drops) {
    const before = drop.questionIds.length;
    drop.questionIds = drop.questionIds.filter((qId) => qId !== id);
    if (drop.questionIds.length < before) dropsChanged = true;
  }
  if (dropsChanged) saveDropsLocal(drops);

  // Sync to server
  syncQuestionDelete(id).catch((err) => {
    console.warn("[Store] syncQuestionDelete failed:", err);
  });

  return true;
}

export function duplicateQuestion(id: string): PanelQuestion | null {
  const questions = getQuestions();
  const original = questions.find((q) => q.id === id);
  if (!original) return null;
  const dup: PanelQuestion = {
    ...JSON.parse(JSON.stringify(original)),
    id: generateId(),
    label: original.label + " (copia)",
    createdAt: now(),
    updatedAt: now(),
  };
  questions.push(dup);
  saveQuestionsLocal(questions);

  syncQuestionCreate(toServerQuestion(dup)).catch((err) => {
    console.warn("[Store] syncQuestionCreate (duplicate) failed:", err);
  });

  return dup;
}

export function getQuestionById(id: string): PanelQuestion | undefined {
  return getQuestions().find((q) => q.id === id);
}

// --- Drop CRUD ---

export function getDrops(): PanelDrop[] {
  try {
    const raw = localStorage.getItem(DROPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_e) {
    return [];
  }
}

function saveDropsLocal(drops: PanelDrop[]) {
  localStorage.setItem(DROPS_KEY, JSON.stringify(drops));
}

export function createDrop(name: string): PanelDrop {
  const drops = getDrops();
  const drop: PanelDrop = {
    id: generateId(),
    name,
    dropId: `drop-${Date.now()}`,
    status: "draft",
    timeoutMessage: "Brutal eligio por vos.",
    multiplierCheckpoints: {},
    reveal: {
      title: "Tu perfil\\nde señal",
      description: "",
      archetypes: [],
    },
    questionIds: [],
    createdAt: now(),
    updatedAt: now(),
  };
  drops.push(drop);
  saveDropsLocal(drops);

  syncDropCreate(toServerDrop(drop) as any).catch((err) => {
    console.warn("[Store] syncDropCreate failed:", err);
  });

  return drop;
}

export function updateDrop(id: string, updates: Partial<PanelDrop>): PanelDrop | null {
  const drops = getDrops();
  const idx = drops.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  drops[idx] = { ...drops[idx], ...updates, updatedAt: now() };
  saveDropsLocal(drops);

  syncDropUpdate(drops[idx].dropId, toServerDrop(drops[idx]) as any).catch((err) => {
    console.warn("[Store] syncDropUpdate failed:", err);
  });

  return drops[idx];
}

export function deleteDrop(id: string): boolean {
  const drops = getDrops();
  const filtered = drops.filter((d) => d.id !== id);
  if (filtered.length === drops.length) return false;
  saveDropsLocal(filtered);

  syncDropDelete(id).catch((err) => {
    console.warn("[Store] syncDropDelete failed:", err);
  });

  return true;
}

export function duplicateDrop(id: string): PanelDrop | null {
  const drops = getDrops();
  const original = drops.find((d) => d.id === id);
  if (!original) return null;
  const dup: PanelDrop = {
    ...JSON.parse(JSON.stringify(original)),
    id: generateId(),
    dropId: `drop-${Date.now()}`,
    name: original.name + " (copia)",
    status: "draft" as DropStatus,
    createdAt: now(),
    updatedAt: now(),
  };
  drops.push(dup);
  saveDropsLocal(drops);

  syncDropCreate(toServerDrop(dup) as any).catch((err) => {
    console.warn("[Store] syncDropCreate (duplicate) failed:", err);
  });

  return dup;
}

export function getDropById(id: string): PanelDrop | undefined {
  return getDrops().find((d) => d.id === id);
}

export function activateDrop(id: string): PanelDrop | null {
  const drops = getDrops();
  drops.forEach((d) => {
    if (d.status === "active") d.status = "draft";
  });
  const idx = drops.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  drops[idx].status = "active";
  drops[idx].updatedAt = now();
  saveDropsLocal(drops);

  syncDropUpdate(drops[idx].dropId, toServerDrop(drops[idx]) as any).catch((err) => {
    console.warn("[Store] syncDropUpdate (activate) failed:", err);
  });

  return drops[idx];
}

export function scheduleSyncToServer() {
  // No-op
}

// --- Export/Import JSON ---

export function exportDropJSON(drop: PanelDrop, allQuestions: PanelQuestion[]): Drop {
  const questionsMap = new Map(allQuestions.map((q) => [q.id, q]));
  const disabled = new Set(drop.disabledQuestionIds || []);
  const orderedQuestions: Question[] = drop.questionIds
    .filter((qId) => !disabled.has(qId))
    .map((qId) => questionsMap.get(qId))
    .filter((q): q is PanelQuestion => q !== undefined)
    .map((q) => {
      const pq = q as any;
      let reward = q.data.reward;
      if (!reward) {
        if (pq.reward_cash > 0) reward = { type: "coins" as const, value: Number(pq.reward_cash) };
        else if (pq.reward_tickets > 0) reward = { type: "tickets" as const, value: Number(pq.reward_tickets) };
      }
      return { ...q.data, questionId: q.id, ...(reward ? { reward } : {}) };
    });

  const result: Drop = {
    id: drop.dropId,
    name: drop.name,
    version: 1,
    timeoutMessage: drop.timeoutMessage,
    multiplierCheckpoints: drop.multiplierCheckpoints,
    reveal: drop.reveal,
    questions: orderedQuestions,
  };

  if (drop.splash) result.splash = drop.splash;
  if (drop.segmentIds && drop.segmentIds.length > 0) result.segmentIds = drop.segmentIds;

  return result;
}

export function importDropJSON(dropJson: Drop): { drop: PanelDrop; questions: PanelQuestion[] } {
  const importedQuestions: PanelQuestion[] = dropJson.questions.map((q) => ({
    id: generateId(),
    data: q,
    label: q.type + " — " + ("text" in q ? (q as any).text?.slice(0, 40) || "Sin texto" : "Sin texto"),
    tags: ["imported"],
    createdAt: now(),
    updatedAt: now(),
  }));

  const existing = getQuestions();
  saveQuestionsLocal([...existing, ...importedQuestions]);

  importedQuestions.forEach((q) => {
    syncQuestionCreate(toServerQuestion(q)).catch((err) => {
      console.warn("[Store] syncQuestionCreate (import) failed:", err);
    });
  });

  const panelDrop: PanelDrop = {
    id: generateId(),
    name: dropJson.name,
    dropId: dropJson.id,
    status: "draft",
    timeoutMessage: dropJson.timeoutMessage || "Brutal eligio por vos.",
    multiplierCheckpoints: dropJson.multiplierCheckpoints || {},
    reveal: {
      title: dropJson.reveal.title,
      description: dropJson.reveal.description,
      archetypes: dropJson.reveal.archetypes || [],
      scoring: dropJson.reveal.scoring,
    },
    questionIds: importedQuestions.map((q) => q.id),
    createdAt: now(),
    updatedAt: now(),
  };

  const drops = getDrops();
  drops.push(panelDrop);
  saveDropsLocal(drops);

  syncDropCreate(toServerDrop(panelDrop) as any).catch((err) => {
    console.warn("[Store] syncDropCreate (import) failed:", err);
  });

  return { drop: panelDrop, questions: importedQuestions };
}

// --- Metadata & Defaults ---

export type QuestionType = Question["type"];

export const QUESTION_TYPE_CATEGORIES: Record<string, { label: string; types: QuestionType[] }> = {
  basic: { label: "Básico", types: ["choice", "slider", "confesionario"] },
  visual: { label: "Visual", types: ["choice_emoji", "choice_hybrid", "slider_emoji", "binary_media", "hot_take_visual", "media_reaction"] },
  interactive: { label: "Interactivo", types: ["ranking", "prediction_bet", "rafaga", "rafaga_emoji", "hot_take"] },
  special: { label: "Especial", types: ["trap", "trap_silent", "dead_drop"] },
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  choice: "Choice", prediction_bet: "Prediction Bet", ranking: "Ranking", confesionario: "Confesionario",
  slider: "Slider", binary_media: "Binary Media", rafaga: "Ráfaga", dead_drop: "Dead Drop",
  trap: "Trap", hot_take: "Hot Take", trap_silent: "Trap Silent", choice_emoji: "Choice Emoji",
  choice_hybrid: "Choice Hybrid", slider_emoji: "Slider Emoji", rafaga_emoji: "Ráfaga Emoji",
  hot_take_visual: "Hot Take Visual", media_reaction: "Media Reaction",
};

export const QUESTION_TYPE_ICONS: Record<QuestionType, string> = {
  choice: "🔘", prediction_bet: "🎰", ranking: "📊", confesionario: "🤫", slider: "🎚️",
  binary_media: "🖼️", rafaga: "⚡", dead_drop: "💀", trap: "🪤", hot_take: "🔥",
  trap_silent: "🕵️", choice_emoji: "😀", choice_hybrid: "💬", slider_emoji: "🫠",
  rafaga_emoji: "⚡😀", hot_take_visual: "🔥🖼️", media_reaction: "📸",
};

export function getDefaultQuestionData(type: QuestionType): Question {
  const base = { timer: 15 };
  switch (type) {
    case "choice": return { ...base, type: "choice", text: "", options: ["", ""] };
    case "choice_emoji": return { ...base, type: "choice_emoji", text: "", options: ["😀", "😢"] };
    case "choice_hybrid": return { ...base, type: "choice_hybrid", text: "", options: ["", ""] };
    case "slider": return { ...base, type: "slider", text: "", min: 0, max: 10, labelLeft: "Nada", labelRight: "Totalmente" };
    case "slider_emoji": return { ...base, type: "slider_emoji", text: "", min: 0, max: 10, labelLeft: "🫣", labelRight: "😏" };
    case "confesionario": return { ...base, timer: 30, type: "confesionario", text: "" };
    case "prediction_bet": return { ...base, type: "prediction_bet", text: "", optionA: "", optionB: "", maxTickets: 100 };
    case "ranking": return { ...base, type: "ranking", text: "", options: ["", "", ""] };
    case "binary_media": return { ...base, type: "binary_media", imageUrl: "", optionA: "", optionB: "" };
    case "rafaga": return { ...base, timer: 0, type: "rafaga", prompt: "", promptBold: "", items: [{ text: "", optionA: "", optionB: "" }], secondsPerItem: 3 };
    case "rafaga_emoji": return { ...base, timer: 0, type: "rafaga_emoji", prompt: "", promptBold: "", items: [{ text: "", optionA: "😀", optionB: "😢" }], secondsPerItem: 3 };
    case "hot_take": return { ...base, type: "hot_take", text: "", options: ["", ""] };
    case "hot_take_visual": return { ...base, type: "hot_take_visual", text: "", options: ["", ""] };
    case "trap": return { ...base, type: "trap", text: "", options: ["", ""], correctIndex: 0, penalty: 50 };
    case "trap_silent": return { ...base, type: "trap_silent", text: "", options: ["", ""], correctIndex: 0, penalty: 25 };
    case "dead_drop": return { ...base, timer: 0, type: "dead_drop", firstLine: "", codeLines: [""], lastLines: [""] };
    case "media_reaction": return { ...base, type: "media_reaction", imageUrl: "", text: "", mode: "emoji", options: ["😍", "🤮"] };
    default: return { ...base, type: "choice", text: "", options: ["", ""] };
  }
}
