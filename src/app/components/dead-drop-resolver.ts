/**
 * Resolves dead_drop content based on current hour.
 *
 * If the dead_drop has hourVariations, checks the current hour
 * against each range and merges matching overrides.
 */

import type { DeadDropQuestion, DeadDropVariation } from "./drop-types";

function isInHourRange(hour: number, from: number, to: number): boolean {
  if (from <= to) {
    // Normal range, e.g. 9-17
    return hour >= from && hour <= to;
  }
  // Wraps midnight, e.g. 22-5
  return hour >= from || hour <= to;
}

export function resolveDeadDrop(q: DeadDropQuestion): {
  firstLine: string;
  codeLines: string[];
  lastLines: string[];
} {
  const now = new Date();
  const hour = now.getHours();

  if (!q.hourVariations || q.hourVariations.length === 0) {
    return { firstLine: q.firstLine, codeLines: q.codeLines, lastLines: q.lastLines };
  }

  // Find first matching variation
  const match: DeadDropVariation | undefined = q.hourVariations.find((v) =>
    isInHourRange(hour, v.fromHour, v.toHour)
  );

  if (!match) {
    return { firstLine: q.firstLine, codeLines: q.codeLines, lastLines: q.lastLines };
  }

  return {
    firstLine: match.firstLine ?? q.firstLine,
    codeLines: match.codeLines ?? q.codeLines,
    lastLines: match.lastLines ?? q.lastLines,
  };
}
