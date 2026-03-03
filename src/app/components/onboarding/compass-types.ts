// ============================================================
// COMPASS TYPES — 3-axis generational profiling system
// ============================================================

/** The three axes of the BRUTAL compass */
export type CompassAxis = "X" | "Y" | "Z";

/** Pole names per axis */
export const AXIS_POLES: Record<CompassAxis, { negative: string; positive: string }> = {
  X: { negative: "SISTEMA", positive: "GRIETA" },
  Y: { negative: "BUNKER", positive: "VITRINA" },
  Z: { negative: "CALCULO", positive: "FUEGO" },
};

/** A single emoji pair inside a rafaga */
export interface CompassPair {
  id: string;
  /** Micro-question text (3-5 words) */
  text: string;
  /** Emoji for option A */
  optionA: string;
  /** Emoji for option B */
  optionB: string;
  /** Which axis this pair feeds */
  axis: CompassAxis;
  /**
   * Which pole option A maps to:
   * -1 = negative pole (SISTEMA/BUNKER/CALCULO)
   * +1 = positive pole (GRIETA/VITRINA/FUEGO)
   * Option B always maps to the opposite.
   */
  optionAPolarity: -1 | 1;
}

/** A rafaga = themed group of 6 pairs */
export interface CompassRafaga {
  id: string;
  /** Rafaga label shown in panel */
  label: string;
  /** Theme description */
  theme: string;
  /** Bold prompt shown before countdown */
  promptBold: string;
  /** Seconds per pair */
  secondsPerItem: number;
  /** The 6 pairs */
  pairs: CompassPair[];
}

/** Full compass configuration */
export interface CompassConfig {
  rafagas: CompassRafaga[];
}

/** Raw answer for a single pair: "A", "B", or null (skip/timeout) */
export type PairAnswer = "A" | "B" | null;

/** All answers for the full compass (5 rafagas x 6 pairs = 30 slots) */
export interface CompassAnswers {
  /** rafagaId -> array of answers per pair */
  byRafaga: Record<string, PairAnswer[]>;
}

/** Computed position on each axis (-1 to +1) */
export interface CompassVector {
  x: number;
  y: number;
  z: number;
}

/** One of 8 archetypes */
export interface Archetype {
  id: string;
  name: string;
  emoji: string;
  /** Coordinates as sign: +1 or -1 per axis */
  coords: { x: -1 | 1; y: -1 | 1; z: -1 | 1 };
  /** Short defining phrase */
  phrase: string;
  /** Longer description */
  description: string;
}
