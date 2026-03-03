// ============================================================
// COMPASS ENGINE — Calculate axes and archetype from answers
// ============================================================

import type { CompassRafaga, CompassAxis, CompassVector, PairAnswer, Archetype } from "./compass-types";
import { ARCHETYPES } from "./compass-data";

/**
 * Given all rafaga answers, compute the compass vector.
 * Each pair contributes +1 or -1 to its axis based on the chosen option and polarity.
 * Skips (null) are excluded from the calculation.
 * Returns normalized values between -1 and +1.
 */
export function computeCompassVector(
  rafagas: CompassRafaga[],
  answersByRafaga: Record<string, PairAnswer[]>
): CompassVector {
  const axisScores: Record<CompassAxis, { sum: number; count: number }> = {
    X: { sum: 0, count: 0 },
    Y: { sum: 0, count: 0 },
    Z: { sum: 0, count: 0 },
  };

  for (const rafaga of rafagas) {
    const answers = answersByRafaga[rafaga.id];
    if (!answers) continue;

    for (let i = 0; i < rafaga.pairs.length; i++) {
      const pair = rafaga.pairs[i];
      const answer = answers[i];
      if (answer === null || answer === undefined) continue; // skip

      const axis = pair.axis;
      // If user picked A, the score is the polarity of A
      // If user picked B, the score is the opposite
      const score = answer === "A" ? pair.optionAPolarity : -pair.optionAPolarity;

      axisScores[axis].sum += score;
      axisScores[axis].count += 1;
    }
  }

  // Normalize to -1..+1
  const normalize = (s: { sum: number; count: number }) =>
    s.count === 0 ? 0 : Math.max(-1, Math.min(1, s.sum / s.count));

  return {
    x: normalize(axisScores.X),
    y: normalize(axisScores.Y),
    z: normalize(axisScores.Z),
  };
}

/**
 * Given a compass vector, find the closest archetype.
 * Uses Euclidean distance to the 8 archetype vertices.
 * Returns the closest archetype + distance (lower = purer match).
 */
export function findArchetype(vector: CompassVector): {
  primary: Archetype;
  secondary: Archetype | null;
  distance: number;
  /** 0-100 purity: how close to the pure vertex */
  purity: number;
} {
  const distances = ARCHETYPES.map((a) => {
    const dx = vector.x - a.coords.x;
    const dy = vector.y - a.coords.y;
    const dz = vector.z - a.coords.z;
    return { archetype: a, distance: Math.sqrt(dx * dx + dy * dy + dz * dz) };
  }).sort((a, b) => a.distance - b.distance);

  const primary = distances[0];
  const secondary = distances[1];

  // Max possible distance to a vertex is sqrt(12) ≈ 3.46
  // Purity = 100% at distance 0, 0% at max distance
  const maxDist = Math.sqrt(12);
  const purity = Math.round(Math.max(0, (1 - primary.distance / maxDist) * 100));

  return {
    primary: primary.archetype,
    secondary: secondary ? secondary.archetype : null,
    distance: primary.distance,
    purity,
  };
}

/**
 * Determine if an axis is "indeterminate" (too few answers).
 * If less than 4 out of 10 pairs answered, the axis is indeterminate.
 */
export function getAxisStats(
  rafagas: CompassRafaga[],
  answersByRafaga: Record<string, PairAnswer[]>
): Record<CompassAxis, { answered: number; total: number; indeterminate: boolean }> {
  const stats: Record<CompassAxis, { answered: number; total: number }> = {
    X: { answered: 0, total: 0 },
    Y: { answered: 0, total: 0 },
    Z: { answered: 0, total: 0 },
  };

  for (const rafaga of rafagas) {
    const answers = answersByRafaga[rafaga.id];
    for (let i = 0; i < rafaga.pairs.length; i++) {
      const pair = rafaga.pairs[i];
      stats[pair.axis].total += 1;
      if (answers && answers[i] !== null && answers[i] !== undefined) {
        stats[pair.axis].answered += 1;
      }
    }
  }

  return {
    X: { ...stats.X, indeterminate: stats.X.answered < 4 },
    Y: { ...stats.Y, indeterminate: stats.Y.answered < 4 },
    Z: { ...stats.Z, indeterminate: stats.Z.answered < 4 },
  };
}
