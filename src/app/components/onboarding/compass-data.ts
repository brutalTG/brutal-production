// ============================================================
// COMPASS DATA — 5 rafagas, 30 pairs, 8 archetypes
// ============================================================
//
// EJES:
// X: SISTEMA (-1) ←→ GRIETA (+1)  — ¿Operás dentro de las reglas o las esquivás?
// Y: BUNKER (-1) ←→ VITRINA (+1)  — ¿Tu identidad la procesás adentro o la exhibís?
// Z: CALCULO (-1) ←→ FUEGO (+1)   — ¿Actuás con cabeza fría o con impulso?
//
// Cada ráfaga: 6 pares, 2 por eje. Statements que ocultan el eje bajo tema.
// optionAPolarity: elegir opción A empuja hacia ese valor del eje.
// ============================================================

import type { CompassRafaga, Archetype } from "./compass-types";

// ── RAFAGA 1: PLATA ─────────────────────────────────────────

const RAFAGA_PLATA: CompassRafaga = {
  id: "plata",
  label: "PLATA",
  theme: "Cómo te relacionás con la guita, el gasto y el riesgo.",
  promptBold: "PLATA",
  secondsPerItem: 2,
  pairs: [
    // Z: FUEGO (+1) — impulso financiero sin red
    { id: "p1", text: "Me endeudo si me copa", optionA: "🔥", optionB: "🧊", axis: "Z", optionAPolarity: 1 },
    // X: GRIETA (+1) — operar por fuera del sistema fiscal
    { id: "p2", text: "Si puedo evitar pagar impuestos, lo hago", optionA: "✅", optionB: "❌", axis: "X", optionAPolarity: 1 },
    // Y: VITRINA (+1) — consumo como identidad pública
    { id: "p3", text: "Muestro lo que me compro", optionA: "📸", optionB: "🔇", axis: "Y", optionAPolarity: 1 },
    // Z: CALCULO (-1) — aversión al riesgo
    { id: "p4", text: "Prefiero poco seguro a mucho incierto", optionA: "🔒", optionB: "🎲", axis: "Z", optionAPolarity: -1 },
    // X: GRIETA (+1) — contrato social roto
    { id: "p5", text: "Si el Estado no me da nada, no le debo nada", optionA: "✅", optionB: "❌", axis: "X", optionAPolarity: 1 },
    // Y: VITRINA (+1) — consumo relativo, status
    { id: "p6", text: "Me comparo con lo que tienen otros", optionA: "😬", optionB: "🚫", axis: "Y", optionAPolarity: 1 },
  ],
};

// ── RAFAGA 2: PANTALLA ──────────────────────────────────────

const RAFAGA_PANTALLA: CompassRafaga = {
  id: "pantalla",
  label: "PANTALLA",
  theme: "Cómo vivís tu vida digital.",
  promptBold: "PANTALLA",
  secondsPerItem: 2,
  pairs: [
    // Y: BUNKER (-1) — consumo voyeurista oculto
    { id: "d1", text: "Stalkeé a alguien hoy", optionA: "🙋", optionB: "🚫", axis: "Y", optionAPolarity: -1 },
    // X: GRIETA (+1) — el algoritmo como autoridad no institucional
    { id: "d2", text: "Mi feed me conoce mejor que mis amigos", optionA: "😬", optionB: "🚫", axis: "X", optionAPolarity: 1 },
    // Y: VITRINA (+1) — validación numérica
    { id: "d3", text: "Borro lo que publico si no llega a X likes", optionA: "✅", optionB: "❌", axis: "Y", optionAPolarity: 1 },
    // Z: CALCULO (-1) — control sobre la dependencia
    { id: "d4", text: "Podría dejar las redes un mes", optionA: "💪", optionB: "😂", axis: "Z", optionAPolarity: -1 },
    // Y: BUNKER (-1) — identidad digital secreta
    { id: "d5", text: "Sigo cuentas que no le diría a nadie", optionA: "🫣", optionB: "🚫", axis: "Y", optionAPolarity: -1 },
    // Z: FUEGO (+1) — impulsividad digital
    { id: "d6", text: "Publiqué en caliente y me arrepentí", optionA: "🔥", optionB: "🚫", axis: "Z", optionAPolarity: 1 },
  ],
};

// ── RAFAGA 3: RUIDO ─────────────────────────────────────────

const RAFAGA_RUIDO: CompassRafaga = {
  id: "ruido",
  label: "RUIDO",
  theme: "Qué te prende, qué te aburre, cómo consumís cultura.",
  promptBold: "RUIDO",
  secondsPerItem: 2,
  pairs: [
    // X: GRIETA (+1) — identidad contra lo masivo
    { id: "r1", text: "Lo mainstream me da vergüenza", optionA: "😬", optionB: "🚫", axis: "X", optionAPolarity: 1 },
    // Y: VITRINA (+1) — compartir como parte del placer
    { id: "r2", text: "Si me gusta algo, necesito contarlo", optionA: "📢", optionB: "🔇", axis: "Y", optionAPolarity: 1 },
    // Z: FUEGO (+1) — adicción a la novedad
    { id: "r3", text: "Me aburro si no pasa algo nuevo cada día", optionA: "✅", optionB: "❌", axis: "Z", optionAPolarity: 1 },
    // X: SISTEMA (-1) — delegación cultural al algoritmo
    { id: "r4", text: "Escucho lo que me recomienda el algoritmo", optionA: "✅", optionB: "❌", axis: "X", optionAPolarity: -1 },
    // Y: BUNKER (-1) — placer privado
    { id: "r5", text: "Disfruto más las cosas solo que acompañado", optionA: "🏝️", optionB: "🚫", axis: "Y", optionAPolarity: -1 },
    // Z: CALCULO (-1) — comfort, paciencia, profundidad
    { id: "r6", text: "Puedo ver lo mismo 10 veces y no aburrirme", optionA: "✅", optionB: "❌", axis: "Z", optionAPolarity: -1 },
  ],
};

// ── RAFAGA 4: PODER ─────────────────────────────────────────

const RAFAGA_PODER: CompassRafaga = {
  id: "poder",
  label: "PODER",
  theme: "Qué pensás del sistema, de la autoridad, de las reglas.",
  promptBold: "PODER",
  secondsPerItem: 2,
  pairs: [
    // X: GRIETA (+1) — fatalismo institucional
    { id: "w1", text: "Los que mandan no cambian nunca", optionA: "✅", optionB: "❌", axis: "X", optionAPolarity: 1 },
    // Y: VITRINA (+1) — poder visible
    { id: "w2", text: "Si tengo poder, quiero que se note", optionA: "👑", optionB: "🚫", axis: "Y", optionAPolarity: 1 },
    // Z: FUEGO (+1) — impulsividad ante injusticia
    { id: "w3", text: "Cuando algo me indigna, reacciono al toque", optionA: "🔥", optionB: "🧊", axis: "Z", optionAPolarity: 1 },
    // X: SISTEMA (-1) — meritocracia legítima
    { id: "w4", text: "Respeto a alguien que llegó sin romper reglas", optionA: "✅", optionB: "❌", axis: "X", optionAPolarity: -1 },
    // Y: BUNKER (-1) — poder oculto
    { id: "w5", text: "Prefiero mover cosas desde atrás", optionA: "🤫", optionB: "🚫", axis: "Y", optionAPolarity: -1 },
    // Z: CALCULO (-1) — tolerancia estratégica
    { id: "w6", text: "Me banco un jefe que no me gusta si me conviene", optionA: "✅", optionB: "❌", axis: "Z", optionAPolarity: -1 },
  ],
};

// ── RAFAGA 5: ESPEJO ────────────────────────────────────────

const RAFAGA_ESPEJO: CompassRafaga = {
  id: "espejo",
  label: "ESPEJO",
  theme: "Cómo te ves, cómo te sentís, qué te mueve.",
  promptBold: "ESPEJO",
  secondsPerItem: 2,
  pairs: [
    // Y: BUNKER (-1) — identidad oculta
    { id: "e1", text: "Hay una versión de mí que nadie conoce", optionA: "🫣", optionB: "🚫", axis: "Y", optionAPolarity: -1 },
    // X: SISTEMA (-1) — mimetismo social
    { id: "e2", text: "Me adapto al grupo en el que estoy", optionA: "🎭", optionB: "🚫", axis: "X", optionAPolarity: -1 },
    // Z: FUEGO (+1) — intensidad contenida
    { id: "e3", text: "Soy más intenso de lo que muestro", optionA: "🔥", optionB: "🚫", axis: "Z", optionAPolarity: 1 },
    // X: GRIETA (+1) — identidad disruptiva
    { id: "e4", text: "No encajo y no me jode", optionA: "✅", optionB: "❌", axis: "X", optionAPolarity: 1 },
    // Y: VITRINA (+1) — dependencia de mirada ajena
    { id: "e5", text: "Me importa lo que piensan de mí", optionA: "😬", optionB: "🚫", axis: "Y", optionAPolarity: 1 },
    // Z: CALCULO (-1) — gratificación diferida
    { id: "e6", text: "Puedo esperar mucho por algo que quiero", optionA: "✅", optionB: "❌", axis: "Z", optionAPolarity: -1 },
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
//
// Coords: x/y/z = -1 o +1
// X: -1 = SISTEMA, +1 = GRIETA
// Y: -1 = BUNKER,  +1 = VITRINA
// Z: -1 = CALCULO, +1 = FUEGO
//

export const ARCHETYPES: Archetype[] = [
  {
    id: "invisible",
    name: "El Invisible",
    emoji: "🧠",
    coords: { x: -1, y: -1, z: -1 },
    phrase: "Tengo un plan y no necesito que lo veas",
    description:
      "Operás dentro del sistema, vivís hacia adentro y calculás cada movimiento. Tu poder es que nadie sabe lo que estás armando. Ahorrás, esperás, y cuando movés, ya ganaste. El mundo te subestima y eso te conviene.",
  },
  {
    id: "fantasma",
    name: "El Fantasma",
    emoji: "💻",
    coords: { x: 1, y: -1, z: -1 },
    phrase: "El sistema no sirve, pero yo ya encontré la vuelta",
    description:
      "No confiás en nada, no mostrás nada, y sin embargo todo lo que hacés está calculado. Tres cuentas, VPN, cripto a las 3am. Nadie te ve, nadie te encuentra, y así te gusta. Perfil bajo, impacto quirúrgico.",
  },
  {
    id: "vidriera",
    name: "La Vidriera",
    emoji: "👑",
    coords: { x: -1, y: 1, z: -1 },
    phrase: "Todo lo que ves de mí está pensado",
    description:
      "Confiás en las instituciones, cuidás tu imagen y pensás todo tres veces. Cada post construye marca personal, cada decisión de consumo es estratégica. Tu feed es un portfolio, no un diario. LinkedIn a los 20, plan a los 25.",
  },
  {
    id: "truco",
    name: "El Truco",
    emoji: "🎭",
    coords: { x: 1, y: 1, z: -1 },
    phrase: "No creo en el sistema pero sé cómo usarlo",
    description:
      "Desconfiás de todo pero vivís hacia afuera, calculando cada jugada. Entendés el algoritmo como herramienta económica, la grieta como mercado, y la atención como moneda. Nadie sabe si es personaje o persona. Ese es el punto.",
  },
  {
    id: "bunker",
    name: "El Búnker",
    emoji: "🛡️",
    coords: { x: -1, y: -1, z: 1 },
    phrase: "Banco lo mío y no necesito explicárselo a nadie",
    description:
      "Confiás en las estructuras, vivís hacia adentro, pero te movés por pasión. Estudiás lo que te gusta, bancás con el corazón, defendés con fuego lo que tenés adentro. Lealtad de hierro, círculo chico, intensidad que no se ve hasta que se siente.",
  },
  {
    id: "motosierra",
    name: "La Motosierra",
    emoji: "🔥",
    coords: { x: 1, y: -1, z: 1 },
    phrase: "Me chupa todo un huevo y lo digo en serio",
    description:
      "No confiás en nada, no mostrás nada, y te movés por impulso puro. El más difícil de leer y el más auténtico. No hay curación, no hay estrategia, no hay plan B. Vida sin filtro, sin red, sin pedir permiso.",
  },
  {
    id: "megafono",
    name: "El Megáfono",
    emoji: "✊",
    coords: { x: -1, y: 1, z: 1 },
    phrase: "Esto me importa y necesito que te importe",
    description:
      "Creés que se puede cambiar las cosas desde adentro, vivís hacia afuera y te movés por convicción emocional. La causa es identidad, no estrategia. Cuando algo te importa, no podés quedarte callado. El volumen no es ruido, es urgencia.",
  },
  {
    id: "incendio",
    name: "El Incendio",
    emoji: "☄️",
    coords: { x: 1, y: 1, z: 1 },
    phrase: "Prendo todo y ya fue",
    description:
      "No confiás en nada, vivís hacia afuera y te movés por impulso. Pura intensidad pública. Cuando entrás a una conversación, cambia la temperatura. Volátil, impredecible, y culturalmente ruidoso. Lo que tocás no queda igual.",
  },
];
