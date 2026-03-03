// ============================================================
// ONBOARDING DATA — All steps configuration
// Phase A = datos duros (unchanged), then compass rafagas
// ============================================================

import type { OnboardingStep } from "./onboarding-types";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  // ── INTRO ──────────────────────────────────────────────────
  {
    id: "intro",
    type: "intro",
    phase: "intro",
    title: "Aplica al Club",
    subtitle:
      "Esto no es un registro. Es una aplicacion.\nCuanto mas completo tu perfil, mas rapido entras y mejores Drops recibis.",
  },

  // ── FASE A: DATOS DUROS ───────────────────────────────────
  {
    id: "phone",
    type: "phone",
    phase: "A",
    copy: "Tu numero de WhatsApp.\nEl unico dato personal que pedimos.",
  },
  {
    id: "nickname",
    type: "text_input",
    phase: "A",
    copy: "Como te decimos?\nElegi un nombre. Puede ser el tuyo, puede ser inventado.",
    placeholder: "Tu apodo",
    maxLength: 20,
  },
  {
    id: "age",
    type: "age_selector",
    phase: "A",
    copy: "Cuantos anos tenes?",
    min: 15,
    max: 28,
    rejectMessage:
      "BRUTAL es solo para Gen Z (15-28).\nPero no te preocupes, vas a poder seguirnos desde afuera.",
  },
  {
    id: "gender",
    type: "single_choice",
    phase: "A",
    copy: "Como te identificas?",
    options: ["Hombre", "Mujer", "No binario", "Prefiero no decir"],
  },
  {
    id: "location",
    type: "nested_choice",
    phase: "A",
    copy: "Donde vivis?",
    options: [
      {
        label: "CABA",
        subOptions: [
          "Palermo", "Recoleta", "Belgrano", "Caballito", "Nunez",
          "Villa Urquiza", "Almagro", "San Telmo", "La Boca", "Flores",
          "Villa Devoto", "Otro barrio",
        ],
      },
      { label: "GBA Norte" },
      { label: "GBA Sur" },
      { label: "GBA Oeste" },
      {
        label: "Interior",
        subOptions: [
          "Buenos Aires (interior)", "Cordoba", "Santa Fe", "Mendoza",
          "Tucuman", "Salta", "Entre Rios", "Misiones", "Chaco",
          "Neuquen", "Rio Negro", "Otra provincia",
        ],
      },
    ],
  },
  {
    id: "phone_brand",
    type: "single_choice",
    phase: "A",
    copy: "Que celular tenes?",
    options: [
      "iPhone (ultimo modelo)",
      "iPhone (modelo anterior)",
      "Samsung Galaxy S o A alto",
      "Motorola/Xiaomi gama media",
      "Otro",
    ],
  },

  // ── TRANSICION A COMPASS ──────────────────────────────────
  {
    id: "transition_compass",
    type: "transition",
    phase: "transition",
    lines: [
      "> Ya tenemos tus datos.",
      "> Ahora viene lo que importa.",
      "",
      "> 5 rafagas. 30 instintos.",
      "> No pienses. Reacciona.",
      "",
      "> Tu primer reflejo",
      "> es la senal.",
    ],
  },

  // ── COMPASS: 5 RAFAGAS ────────────────────────────────────
  { id: "compass_0", type: "compass_rafaga", phase: "compass", rafagaIndex: 0 },
  { id: "compass_1", type: "compass_rafaga", phase: "compass", rafagaIndex: 1 },
  { id: "compass_2", type: "compass_rafaga", phase: "compass", rafagaIndex: 2 },
  { id: "compass_3", type: "compass_rafaga", phase: "compass", rafagaIndex: 3 },
  { id: "compass_4", type: "compass_rafaga", phase: "compass", rafagaIndex: 4 },

  // ── COMPASS REVEAL ────────────────────────────────────────
  { id: "compass_reveal", type: "compass_reveal", phase: "compass_reveal" },

  // ── MULTIPLICADOR — HANDLES ───────────────────────────────
  {
    id: "multiplier_handles",
    type: "multiplier_handles",
    phase: "multiplier",
    title: "Queres saltar la fila?",
    subtitle:
      "Cada campo completado suma posiciones.\nMas datos = mejor perfil = mejores Drops.",
    handles: [
      { id: "instagram", label: "Instagram", prefix: "@", placeholder: "tu_usuario", positionBoost: 50 },
      { id: "tiktok", label: "TikTok", prefix: "@", placeholder: "tu_usuario", positionBoost: 50 },
      { id: "twitter", label: "X (Twitter)", prefix: "@", placeholder: "tu_usuario", positionBoost: 30 },
      { id: "spotify", label: "Spotify", prefix: "link", placeholder: "open.spotify.com/user/...", positionBoost: 30 },
    ],
  },

  // ── CIERRE ────────────────────────────────────────────────
  {
    id: "closing",
    type: "closing",
    phase: "closing",
  },
];

/** Total form questions (excluding intro, transition, multiplier, closing, compass) */
export const TOTAL_FORM_QUESTIONS = ONBOARDING_STEPS.filter(
  (s) => s.phase === "A"
).length;

/** Phase B question count — now 0 (replaced by compass) */
export const PHASE_B_COUNT = 0;

/** Compass rafaga count */
export const COMPASS_RAFAGA_COUNT = ONBOARDING_STEPS.filter((s) => s.phase === "compass").length;

/** Base queue position range */
export const BASE_QUEUE_MIN = 800;
export const BASE_QUEUE_MAX = 2500;

/** Position boost per compass rafaga completed */
export const BOOST_PER_RAFAGA = 30;

/** Position boost per Phase B question answered (legacy, kept for handles calc) */
export const BOOST_PER_PHASE_B = 15;
