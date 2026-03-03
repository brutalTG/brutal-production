/**
 * Emoji extraction utilities using Intl.Segmenter.
 *
 * Intl.Segmenter with granularity "grapheme" correctly handles:
 * - Simple emojis (😏, 💀, 🔥)
 * - Variation selectors (🗣️ = U+1F5E3 + U+FE0F)
 * - ZWJ sequences (🧘‍♀️)
 * - Skin tone modifiers (👋🏽)
 * - Flag sequences (🇦🇷)
 *
 * No regex = no escaping issues with build tools.
 */

/**
 * Check if a single grapheme cluster is an emoji.
 * Uses a conservative approach: if the grapheme contains
 * characters outside the basic ASCII/Latin range and includes
 * emoji-range codepoints, it's likely an emoji.
 */
function isEmojiGrapheme(grapheme: string): boolean {
  // Quick check: single ASCII chars are never emoji
  if (grapheme.length === 1 && grapheme.charCodeAt(0) < 256) return false;

  // Check for common emoji indicators
  for (const char of grapheme) {
    const cp = char.codePointAt(0);
    if (cp === undefined) continue;

    // Emoji ranges (non-exhaustive but covers 99%+ of common emoji)
    if (
      (cp >= 0x1F600 && cp <= 0x1F64F) || // Emoticons
      (cp >= 0x1F300 && cp <= 0x1F5FF) || // Misc Symbols and Pictographs
      (cp >= 0x1F680 && cp <= 0x1F6FF) || // Transport and Map
      (cp >= 0x1F1E0 && cp <= 0x1F1FF) || // Flags
      (cp >= 0x2600 && cp <= 0x26FF) ||   // Misc symbols
      (cp >= 0x2700 && cp <= 0x27BF) ||   // Dingbats
      (cp >= 0xFE00 && cp <= 0xFE0F) ||   // Variation Selectors
      (cp >= 0x1F900 && cp <= 0x1F9FF) || // Supplemental Symbols
      (cp >= 0x1FA00 && cp <= 0x1FA6F) || // Chess Symbols
      (cp >= 0x1FA70 && cp <= 0x1FAFF) || // Symbols Extended-A
      (cp >= 0x200D && cp <= 0x200D) ||   // ZWJ
      (cp >= 0x2300 && cp <= 0x23FF) ||   // Misc Technical (⌚ etc)
      (cp >= 0x2B05 && cp <= 0x2B55) ||   // Arrows + shapes
      cp === 0x20E3 ||                     // Combining Enclosing Keycap
      cp === 0x200D ||                     // ZWJ
      cp === 0xFE0F                        // Variation Selector-16
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Segment a string into grapheme clusters.
 * Falls back to Array.from() if Intl.Segmenter is not available.
 */
function getGraphemes(str: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return [...segmenter.segment(str)].map((s) => s.segment);
  }
  // Fallback: Array.from handles surrogate pairs but not ZWJ sequences
  return Array.from(str);
}

/**
 * Extract the trailing emoji from a string.
 * Returns the emoji and the remaining text.
 *
 * "Sobrevivo 😏" → { emoji: "😏", text: "Sobrevivo" }
 * "💀 Muerte"    → { emoji: "💀", text: "Muerte" }
 * "No emoji"     → { emoji: null, text: "No emoji" }
 */
export function extractTrailingEmoji(str: string): { emoji: string | null; text: string } {
  const trimmed = str.trim();
  if (!trimmed) return { emoji: null, text: "" };

  const graphemes = getGraphemes(trimmed);
  if (graphemes.length === 0) return { emoji: null, text: trimmed };

  // Check trailing grapheme first (most common: "Sobrevivo 😏")
  const last = graphemes[graphemes.length - 1];
  if (isEmojiGrapheme(last)) {
    const rest = graphemes.slice(0, -1).join("").trim();
    return { emoji: last, text: rest };
  }

  // Check leading grapheme ("💀 Muerte")
  const first = graphemes[0];
  if (isEmojiGrapheme(first)) {
    const rest = graphemes.slice(1).join("").trim();
    return { emoji: first, text: rest };
  }

  // No emoji found
  return { emoji: null, text: trimmed };
}

/**
 * Check if a string is ONLY emoji (no alphabetic text).
 * "😏" → true
 * "😏 text" → false
 * "😏🫣" → true
 */
export function isEmojiOnly(str: string): boolean {
  const trimmed = str.trim();
  if (!trimmed) return false;

  const graphemes = getGraphemes(trimmed);
  return graphemes.every((g) => isEmojiGrapheme(g) || g.trim() === "");
}
