import { useEffect, useState } from "react";

// --- Reaction text pools ---
const REACTIONS_GENERAL = [
  "hmm.",
  "brutal.",
  "ok.",
  "interesante.",
  "dato.",
  "uf.",
  "noted.",
  "registrado.",
  "anotado.",
];

const REACTIONS_FAST = [
  "rapido.",
  "sin dudar.",
  "instinto puro.",
  "ni lo pensaste.",
  "velocidad.",
];

const REACTIONS_SLOW = [
  "te costo.",
  "dudaste.",
  "le diste vueltas.",
  "pensaste mucho.",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Pick a context-aware micro-reaction.
 * @param latencyMs — response latency in ms (undefined = use general pool)
 * @param fastThreshold — below this = fast reaction (default 2000)
 * @param slowThreshold — above this = slow reaction (default 5000)
 */
export function pickReaction(
  latencyMs?: number,
  fastThreshold = 2000,
  slowThreshold = 5000
): string {
  if (latencyMs !== undefined && latencyMs > 0) {
    if (latencyMs < fastThreshold) return pickRandom(REACTIONS_FAST);
    if (latencyMs > slowThreshold) return pickRandom(REACTIONS_SLOW);
  }
  return pickRandom(REACTIONS_GENERAL);
}

interface MicroReactionProps {
  /** The reaction text to display */
  text: string;
  /** Duration in ms before fading out (default 700) */
  duration?: number;
}

/**
 * Full-screen overlay that shows a brief reaction text with fade in/out.
 * Purely visual — parent controls mounting/unmounting.
 */
export function MicroReaction({ text, duration = 700 }: MicroReactionProps) {
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    // Start fade-out before unmount
    const fadeOutAt = duration - 250;
    const timer = setTimeout(() => setPhase("out"), Math.max(fadeOutAt, 100));
    return () => clearTimeout(timer);
  }, [duration]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
      style={{
        opacity: phase === "in" ? 1 : 0,
        transition: "opacity 0.25s ease-out",
      }}
    >
      {/* Subtle scrim using dynamic bg */}
      <div className="absolute inset-0" style={{ backgroundColor: "var(--dynamic-bg, #000)", opacity: 0.4 }} />
      {/* Reaction text */}
      <span
        className="relative font-['Fira_Code'] text-[28px] tracking-tight select-none"
        style={{
          color: "var(--dynamic-fg, #fff)",
          textShadow: "0 2px 20px rgba(0,0,0,0.6)",
          transform: phase === "in" ? "scale(1)" : "scale(0.95)",
          transition: "transform 0.25s ease-out",
        }}
      >
        {text}
      </span>
    </div>
  );
}