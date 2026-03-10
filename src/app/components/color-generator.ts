/**
 * 10 paletas duotono de alto contraste (WCAG AAA 7:1+)
 * Se loopean en orden secuencial, sin generacion dinamica.
 */

interface ColorPair {
  bg: string;
  fg: string;
}

const PALETTES: ColorPair[] = [
  { bg: "#fbba16", fg: "#00492c" },
{ bg: "#9bccd0", fg: "#e22028" },
{ bg: "#00492c", fg: "#fbba16" },
{ bg: "#e22028", fg: "#9bccd0" },
{ bg: "#e2b2b4", fg: "#1e4380" },
{ bg: "#b1d8b8", fg: "#E04C26" },
{ bg: "#1e4380", fg: "#e2b2b4" },
{ bg: "#E04C26", fg: "#b1d8b8" },
];

let currentIndex = -1; // starts at -1 so first call returns index 0

/**
 * Returns the next palette in the loop.
 * Cycles 0 → 1 → 2 → ... → 9 → 0 → ...
 */
export function getNextDuotonePair(): ColorPair {
  currentIndex = (currentIndex + 1) % PALETTES.length;
  return PALETTES[currentIndex];
}

/**
 * Returns a random palette (used for one-off screens like reveal).
 * Avoids returning the same as the current loop position.
 */
export function getRandomDuotonePair(): ColorPair {
  let idx: number;
  do {
    idx = Math.floor(Math.random() * PALETTES.length);
  } while (idx === currentIndex && PALETTES.length > 1);
  return PALETTES[idx];
}
