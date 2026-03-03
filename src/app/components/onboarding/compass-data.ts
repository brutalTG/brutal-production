// ============================================================
// COMPASS DATA — Default 5 rafagas, 30 pairs, 8 archetypes
// ============================================================

import type { CompassRafaga, Archetype } from "./compass-types";

// ── RAFAGA 1: PLATA ─────────────────────────────────────────

const RAFAGA_PLATA: CompassRafaga = {
  id: "plata",
  label: "PLATA",
  theme: "Como te relacionas con el dinero, el gasto y el riesgo.",
  promptBold: "PLATA",
  secondsPerItem: 2,
  pairs: [
    { id: "p1", text: "Gastar o guardar?", optionA: "\u{1F525}", optionB: "\u{1FA99}", axis: "Z", optionAPolarity: 1 },
    { id: "p2", text: "Sueldo fijo o rebusque?", optionA: "\u{1F3E2}", optionB: "\u{1F3B2}", axis: "X", optionAPolarity: -1 },
    { id: "p3", text: "Marca o precio?", optionA: "\u{1F451}", optionB: "\u{1F3F7}\uFE0F", axis: "Y", optionAPolarity: 1 },
    { id: "p4", text: "Crypto o banco?", optionA: "\u{1FA99}", optionB: "\u{1F3E6}", axis: "X", optionAPolarity: 1 },
    { id: "p5", text: "Experiencia o cosa?", optionA: "\u{1F3AA}", optionB: "\u{1F4E6}", axis: "Z", optionAPolarity: 1 },
    { id: "p6", text: "Mostras lo que compras?", optionA: "\u{1F4F8}", optionB: "\u{1F507}", axis: "Y", optionAPolarity: 1 },
  ],
};

// ── RAFAGA 2: PANTALLA ──────────────────────────────────────

const RAFAGA_PANTALLA: CompassRafaga = {
  id: "pantalla",
  label: "PANTALLA",
  theme: "Como vivis tu vida digital, que consumis, donde estas.",
  promptBold: "PANTALLA",
  secondsPerItem: 2,
  pairs: [
    { id: "d1", text: "Feed o algoritmo?", optionA: "\u{1F4F8}", optionB: "\u{1F3B5}", axis: "Y", optionAPolarity: 1 },
    { id: "d2", text: "Comentas o lurkeas?", optionA: "\u{1F4E2}", optionB: "\u{1F440}", axis: "Y", optionAPolarity: 1 },
    { id: "d3", text: "Grupo grande o chat chico?", optionA: "\u{1F3DF}\uFE0F", optionB: "\u{1F510}", axis: "Y", optionAPolarity: 1 },
    { id: "d4", text: "Noticias o memes?", optionA: "\u{1F4F0}", optionB: "\u{1F480}", axis: "X", optionAPolarity: -1 },
    { id: "d5", text: "Tutorial o improvisar?", optionA: "\u{1F4DA}", optionB: "\u{1F937}", axis: "Z", optionAPolarity: -1 },
    { id: "d6", text: "Playlist o shuffle?", optionA: "\u{1F4CB}", optionB: "\u{1F500}", axis: "Z", optionAPolarity: -1 },
  ],
};

// ── RAFAGA 3: RUIDO ─────────────────────────────────────────

const RAFAGA_RUIDO: CompassRafaga = {
  id: "ruido",
  label: "RUIDO",
  theme: "Que te prende, que te aburre, como consumis cultura.",
  promptBold: "RUIDO",
  secondsPerItem: 2,
  pairs: [
    { id: "r1", text: "Joda o casa?", optionA: "\u{1FA69}", optionB: "\u{1F6CB}\uFE0F", axis: "Y", optionAPolarity: 1 },
    { id: "r2", text: "Mainstream o under?", optionA: "\u{1F4FB}", optionB: "\u{1F526}", axis: "X", optionAPolarity: -1 },
    { id: "r3", text: "Plan o improviso?", optionA: "\u{1F4C5}", optionB: "\u26A1", axis: "Z", optionAPolarity: -1 },
    { id: "r4", text: "Solo o en grupo?", optionA: "\u{1F3A7}", optionB: "\u{1F465}", axis: "Y", optionAPolarity: -1 },
    { id: "r5", text: "Clasico o ultimo?", optionA: "\u{1F519}", optionB: "\u{1F195}", axis: "X", optionAPolarity: -1 },
    { id: "r6", text: "Sentir o pensar?", optionA: "\u{1FAC0}", optionB: "\u{1F9E0}", axis: "Z", optionAPolarity: 1 },
  ],
};

// ── RAFAGA 4: PODER ─────────────────────────────────────────

const RAFAGA_PODER: CompassRafaga = {
  id: "poder",
  label: "PODER",
  theme: "Que pensas del sistema, de la autoridad, de las reglas.",
  promptBold: "PODER",
  secondsPerItem: 2,
  pairs: [
    { id: "w1", text: "Votar sirve?", optionA: "\u{1F5F3}\uFE0F", optionB: "\u{1F5D1}\uFE0F", axis: "X", optionAPolarity: -1 },
    { id: "w2", text: "Merito o contacto?", optionA: "\u{1F4AA}", optionB: "\u{1F91D}", axis: "X", optionAPolarity: -1 },
    { id: "w3", text: "Ley o calle?", optionA: "\u2696\uFE0F", optionB: "\u{1F525}", axis: "X", optionAPolarity: -1 },
    { id: "w4", text: "Opinas o te guardas?", optionA: "\u{1F4E2}", optionB: "\u{1F910}", axis: "Y", optionAPolarity: 1 },
    { id: "w5", text: "Lider o manada?", optionA: "\u{1F43A}", optionB: "\u{1F411}", axis: "Z", optionAPolarity: 1 },
    { id: "w6", text: "Cambio o estabilidad?", optionA: "\u{1F4A3}", optionB: "\u{1F9F1}", axis: "Z", optionAPolarity: 1 },
  ],
};

// ── RAFAGA 5: ESPEJO ────────────────────────────────────────

const RAFAGA_ESPEJO: CompassRafaga = {
  id: "espejo",
  label: "ESPEJO",
  theme: "Como te ves, como te sentis, que te mueve.",
  promptBold: "ESPEJO",
  secondsPerItem: 2,
  pairs: [
    { id: "e1", text: "Presente o futuro?", optionA: "\u23F0", optionB: "\u{1F680}", axis: "Z", optionAPolarity: 1 },
    { id: "e2", text: "Careta o sincero?", optionA: "\u{1F3AD}", optionB: "\u{1FA9E}", axis: "Y", optionAPolarity: 1 },
    { id: "e3", text: "Solo o acompanado?", optionA: "\u{1F3DD}\uFE0F", optionB: "\u{1FAC2}", axis: "Y", optionAPolarity: -1 },
    { id: "e4", text: "Aguantar o pedir ayuda?", optionA: "\u{1F9F1}", optionB: "\u{1F198}", axis: "Z", optionAPolarity: -1 },
    { id: "e5", text: "Titulo o calle?", optionA: "\u{1F393}", optionB: "\u{1F6E3}\uFE0F", axis: "X", optionAPolarity: -1 },
    { id: "e6", text: "Encajar o incomodar?", optionA: "\u{1F9E9}", optionB: "\u{1F994}", axis: "X", optionAPolarity: 1 },
  ],
};

// ── ALL RAFAGAS ─────────────────────────────────────────────

export const DEFAULT_RAFAGAS: CompassRafaga[] = [
  RAFAGA_PLATA,
  RAFAGA_PANTALLA,
  RAFAGA_RUIDO,
  RAFAGA_PODER,
  RAFAGA_ESPEJO,
];

// ── 8 ARCHETYPES ────────────────────────────────────────────

export const ARCHETYPES: Archetype[] = [
  {
    id: "estratega",
    name: "El Estratega",
    emoji: "\u{1F9E0}",
    coords: { x: -1, y: -1, z: -1 },
    phrase: "Tengo un plan y no necesito que lo veas",
    description: "Confian en las estructuras, viven hacia adentro, piensan con la cabeza. Son los que estudian la carrera que conviene, ahorran en plazo fijo, tienen el feed limpio y no postean hace meses.",
  },
  {
    id: "hacker",
    name: "El Hacker",
    emoji: "\u{1F4BB}",
    coords: { x: 1, y: -1, z: -1 },
    phrase: "El sistema no sirve, pero yo ya encontre la vuelta",
    description: "Desconfian de todo, viven en privado, pero calculan cada movimiento. Crypto a las 3am, tres cuentas de mail, VPN. Perfil bajo, impacto alto.",
  },
  {
    id: "curador",
    name: "El Curador",
    emoji: "\u{1F451}",
    coords: { x: -1, y: 1, z: -1 },
    phrase: "Todo lo que ves de mi esta pensado",
    description: "Confian en las instituciones, cuidan su imagen, y piensan todo. LinkedIn a los 20, cada decision de consumo construye marca personal. El feed es portfolio, no diario.",
  },
  {
    id: "performer",
    name: "El Performer",
    emoji: "\u{1F3AD}",
    coords: { x: 1, y: 1, z: -1 },
    phrase: "No creo en el sistema pero se como usarlo",
    description: "Desconfian del sistema pero viven hacia afuera, calculando cada movimiento. Entienden el algoritmo como herramienta economica. La grieta es su mercado.",
  },
  {
    id: "guardian",
    name: "El Guardian",
    emoji: "\u{1F6E1}\uFE0F",
    coords: { x: -1, y: -1, z: 1 },
    phrase: "Banco lo mio y no necesito explicarselo a nadie",
    description: "Confian en las estructuras y viven hacia adentro, pero se mueven por pasion. Estudian lo que les gusta, bancan un equipo con el corazon. Son leales. Cambian poco. Sienten mucho.",
  },
  {
    id: "salvaje",
    name: "El Salvaje",
    emoji: "\u{1F525}",
    coords: { x: 1, y: -1, z: 1 },
    phrase: "Me chupa todo un huevo y lo digo en serio",
    description: "Desconfian de todo, viven en privado, y se mueven por impulso. Los mas dificiles de leer y los mas autenticos. Vida sin curaduria.",
  },
  {
    id: "activista",
    name: "El Activista",
    emoji: "\u270A",
    coords: { x: -1, y: 1, z: 1 },
    phrase: "Esto me importa y necesito que te importe",
    description: "Confian en la posibilidad de cambiar las cosas desde adentro, viven hacia afuera, y se mueven por conviccion emocional. La causa es identidad, no estrategia.",
  },
  {
    id: "cometa",
    name: "El Cometa",
    emoji: "\u2604\uFE0F",
    coords: { x: 1, y: 1, z: 1 },
    phrase: "Prendo todo y ya fue",
    description: "Desconfian de todo, viven hacia afuera, y se mueven por impulso. Pura intensidad publica. Volatiles, impredecibles, y culturalmente ruidosos.",
  },
];
