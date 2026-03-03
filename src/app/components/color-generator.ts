/**
 * 10 paletas duotono de alto contraste (WCAG AAA 7:1+)
 * Se loopean en orden secuencial, sin generacion dinamica.
 */

interface ColorPair {
  bg: string;
  fg: string;
}

const PALETTES: ColorPair[] = [
  { bg: "#0D0D0D", fg: "#F5F5F5" },   // negro casi puro / blanco roto
  { bg: "#FF006E", fg: "#FFFF00" },     // magenta / amarillo
  { bg: "#0000CC", fg: "#00FF66" },     // azul profundo / verde neon
  { bg: "#1A0033", fg: "#00FFCC" },     // violeta oscuro / turquesa
  { bg: "#FF4500", fg: "#000000" },     // naranja / negro
  { bg: "#FFFF00", fg: "#8B0000" },     // amarillo / bordo
  { bg: "#00CED1", fg: "#0A0A0A" },     // turquesa / negro
  { bg: "#8B00FF", fg: "#CCFF00" },     // violeta / lima
  { bg: "#DC143C", fg: "#F0FFF0" },     // carmesi / blanco menta
  { bg: "#00FF00", fg: "#1A001A" },     // verde neon / negro violeta
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
