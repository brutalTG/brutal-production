// ============================================================
// COMPASS REVEAL — Shows archetype result after all 5 rafagas
// ============================================================

import { useState, useEffect, useRef } from "react";
import { hapticHeavy, hapticRigid } from "../haptics";
import type { CompassVector } from "./compass-types";
import type { Archetype } from "./compass-types";
import { AXIS_POLES } from "./compass-types";

interface CompassRevealProps {
  vector: CompassVector;
  primary: Archetype;
  secondary: Archetype | null;
  purity: number;
  onContinue: () => void;
}

export function CompassReveal({ vector, primary, secondary, purity, onContinue }: CompassRevealProps) {
  const [phase, setPhase] = useState<"computing" | "axes" | "archetype" | "done">("computing");
  const hapticFired = useRef(false);

  useEffect(() => {
    const t1 = setTimeout(() => {
      hapticRigid();
      setPhase("axes");
    }, 1800);
    const t2 = setTimeout(() => {
      hapticHeavy();
      setPhase("archetype");
    }, 3600);
    const t3 = setTimeout(() => setPhase("done"), 5200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (phase === "archetype" && !hapticFired.current) {
      hapticFired.current = true;
      hapticHeavy();
    }
  }, [phase]);

  // Axis bar helper
  const AxisBar = ({ label, value, negLabel, posLabel }: { label: string; value: number; negLabel: string; posLabel: string }) => {
    const pct = ((value + 1) / 2) * 100; // -1..+1 -> 0..100
    return (
      <div className="w-full mb-4">
        <div className="flex justify-between mb-1">
          <span className="font-['Fira_Code'] text-[10px] uppercase tracking-wider opacity-60" style={{ color: "var(--dynamic-fg, #fff)" }}>
            {negLabel}
          </span>
          <span className="font-['Fira_Code'] text-[10px] uppercase tracking-wider opacity-80 font-bold" style={{ color: "var(--dynamic-fg, #fff)" }}>
            {label}
          </span>
          <span className="font-['Fira_Code'] text-[10px] uppercase tracking-wider opacity-60" style={{ color: "var(--dynamic-fg, #fff)" }}>
            {posLabel}
          </span>
        </div>
        <div className="w-full h-[6px] rounded-full overflow-hidden relative" style={{ backgroundColor: "color-mix(in srgb, var(--dynamic-fg, #fff) 15%, transparent)" }}>
          <div
            className="absolute top-0 h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              backgroundColor: "var(--dynamic-fg, #fff)",
              left: `${Math.min(pct, 50)}%`,
              width: `${Math.abs(pct - 50)}%`,
            }}
          />
          {/* Center marker */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-full" style={{ backgroundColor: "color-mix(in srgb, var(--dynamic-fg, #fff) 30%, transparent)" }} />
        </div>
        <div className="flex justify-center mt-1">
          <span className="font-['Fira_Code'] text-[11px] font-bold" style={{ color: "var(--dynamic-fg, #fff)" }}>
            {value > 0 ? "+" : ""}{value.toFixed(2)}
          </span>
        </div>
      </div>
    );
  };

  // ── Computing phase ──
  if (phase === "computing") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6">
        <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mb-6"
          style={{ borderColor: "var(--dynamic-fg, #fff)", borderTopColor: "transparent" }} />
        <p className="font-['Fira_Code'] text-[13px] text-center opacity-70 leading-relaxed" style={{ color: "var(--dynamic-fg, #fff)" }}>
          Calculando tu posicion<br />en el compass...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 items-center px-4">
      {/* Axes */}
      {(phase === "axes" || phase === "archetype" || phase === "done") && (
        <div className="w-full mt-4 mb-6" style={{ animation: "compass-fade-in 600ms ease-out" }}>
          <p className="font-['Fira_Code'] text-[10px] uppercase tracking-widest text-center mb-5 opacity-50" style={{ color: "var(--dynamic-fg, #fff)" }}>
            Tus 3 ejes
          </p>
          <AxisBar label="EJE X" value={vector.x} negLabel={AXIS_POLES.X.negative} posLabel={AXIS_POLES.X.positive} />
          <AxisBar label="EJE Y" value={vector.y} negLabel={AXIS_POLES.Y.negative} posLabel={AXIS_POLES.Y.positive} />
          <AxisBar label="EJE Z" value={vector.z} negLabel={AXIS_POLES.Z.negative} posLabel={AXIS_POLES.Z.positive} />
        </div>
      )}

      {/* Archetype */}
      {(phase === "archetype" || phase === "done") && (
        <div className="flex flex-col items-center text-center" style={{ animation: "compass-scale-in 500ms ease-out" }}>
          {/* Big emoji */}
          <span className="leading-none mb-3" style={{ fontSize: 72 }}>{primary.emoji}</span>

          {/* Archetype name */}
          <h1 className="font-['Silkscreen'] text-[28px] leading-tight mb-2" style={{ color: "var(--dynamic-fg, #fff)" }}>
            {primary.name.toUpperCase()}
          </h1>

          {/* Purity badge */}
          <div
            className="px-4 py-1 rounded-full font-['Fira_Code'] text-[11px] font-bold mb-4"
            style={{ backgroundColor: "color-mix(in srgb, var(--dynamic-fg, #fff) 15%, transparent)", color: "var(--dynamic-fg, #fff)" }}
          >
            {purity}% puro
          </div>

          {/* Phrase */}
          <p className="font-['Roboto'] font-bold text-[18px] leading-snug mb-3 px-4 italic" style={{ color: "var(--dynamic-fg, #fff)" }}>
            "{primary.phrase}"
          </p>

          {/* Description */}
          <p className="font-['Roboto'] text-[14px] leading-relaxed opacity-70 px-2 mb-4" style={{ color: "var(--dynamic-fg, #fff)" }}>
            {primary.description}
          </p>

          {/* Secondary archetype hint */}
          {secondary && (
            <p className="font-['Fira_Code'] text-[11px] opacity-40 mb-6" style={{ color: "var(--dynamic-fg, #fff)" }}>
              {secondary.emoji} con trazos de {secondary.name}
            </p>
          )}
        </div>
      )}

      {/* Continue button */}
      {phase === "done" && (
        <div className="w-full mt-auto mb-4" style={{ animation: "compass-fade-in 500ms ease-out" }}>
          <button
            onClick={() => { hapticRigid(); onContinue(); }}
            className="w-full h-[56px] rounded-full flex items-center justify-center active:scale-[0.98] transition-transform"
            style={{ backgroundColor: "var(--dynamic-fg, #fff)" }}
          >
            <span className="font-['Roboto'] font-semibold text-[18px]" style={{ color: "var(--dynamic-bg, #000)" }}>
              CONTINUAR
            </span>
          </button>
        </div>
      )}

      <style>{`
        @keyframes compass-fade-in {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes compass-scale-in {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
