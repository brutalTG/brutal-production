// ============================================================
// COMPASS REVEAL — Shows archetype result after all 5 rafagas
// Redesigned: white card + slider-style axis bars
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

// ── Slider-style axis bar (matches BRUTAL slider design) ────
// Two colors only, zero transparency. Fill from center toward pole.
// Fill has rounded-0 at center edge, rounded-full at outer edge.
// Dashed line (CSS) with filled circular div endpoints. mix-blend-mode: exclusion.
function AxisSlider({
  value,
  negLabel,
  posLabel,
  animate,
}: {
  value: number;       // -1 to +1
  negLabel: string;
  posLabel: string;
  animate: boolean;
}) {
  // How far from center: 0 = center, 50 = full pole
  const halfPct = Math.abs(value) * 50;
  const animatedHalf = animate ? halfPct : 0;
  const goesLeft = value < 0;

  const trackH = 29;
  const borderW = 2;
  const innerH = trackH - borderW * 2; // 25
  const dotSize = 11; // px, diameter of endpoint dots

  return (
    <div className="w-full mb-5">
      {/* Labels */}
      <div className="flex justify-between mb-1.5">
        <span
          className="font-['Roboto'] text-[12px] font-semibold tracking-wide"
          style={{ color: "var(--dynamic-fg, #fff)" }}
        >
          {negLabel}
        </span>
        <span
          className="font-['Roboto'] text-[12px] font-semibold tracking-wide"
          style={{ color: "var(--dynamic-fg, #fff)" }}
        >
          {posLabel}
        </span>
      </div>

      {/* Track */}
      <div
        className="relative w-full rounded-full"
        style={{
          height: `${trackH}px`,
          border: `${borderW}px solid var(--dynamic-fg, #fff)`,
        }}
      >
        {/* Dashed center line (CSS) */}
        <div
          className="absolute"
          style={{
            top: "50%",
            left: `${dotSize / 2 + 4}px`,
            right: `${dotSize / 2 + 4}px`,
            height: "0px",
            borderTop: "2px dashed var(--dynamic-fg, #fff)",
            transform: "translateY(-50%)",
          }}
        />

        {/* Left endpoint dot (HTML div — always circular) */}
        <div
          className="absolute rounded-full"
          style={{
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            top: "50%",
            left: "4px",
            transform: "translateY(-50%)",
            backgroundColor: "var(--dynamic-fg, #fff)",
          }}
        />

        {/* Right endpoint dot (HTML div — always circular) */}
        <div
          className="absolute rounded-full"
          style={{
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            top: "50%",
            right: "4px",
            transform: "translateY(-50%)",
            backgroundColor: "var(--dynamic-fg, #fff)",
          }}
        />

        {/* Fill bar — from center toward pole, flush with inner edge */}
        <div
          className="absolute overflow-hidden"
          style={{
            top: "0px",
            bottom: "0px",
            left: goesLeft ? "0px" : "50%",
            right: goesLeft ? "50%" : "0px",
          }}
        >
          <div
            className="absolute"
            style={{
              top: "0px",
              bottom: "0px",
              ...(goesLeft
                ? {
                    right: "0px",
                    width: animate ? `${animatedHalf * 2}%` : "0%",
                    borderRadius: `${innerH / 2}px 0px 0px ${innerH / 2}px`,
                  }
                : {
                    left: "0px",
                    width: animate ? `${animatedHalf * 2}%` : "0%",
                    borderRadius: `0px ${innerH / 2}px ${innerH / 2}px 0px`,
                  }),
              backgroundColor: "var(--dynamic-fg, #fff)",
              mixBlendMode: "exclusion",
              transition: animate ? "width 1s ease-out" : "none",
            }}
          />
        </div>

        {/* Center mark — thin vertical bar at 50% (visible even at value=0) */}
        <div
          className="absolute"
          style={{
            width: "3px",
            top: "2px",
            bottom: "2px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "var(--dynamic-fg, #fff)",
            mixBlendMode: "exclusion",
          }}
        />
      </div>
    </div>
  );
}

export function CompassReveal({ vector, primary, secondary, purity, onContinue }: CompassRevealProps) {
  const [phase, setPhase] = useState<"computing" | "reveal" | "done">("computing");
  const [animateAxes, setAnimateAxes] = useState(false);
  const hapticFired = useRef(false);

  useEffect(() => {
    const t1 = setTimeout(() => {
      hapticHeavy();
      setPhase("reveal");
    }, 1800);
    const t2 = setTimeout(() => {
      setAnimateAxes(true);
    }, 2200);
    const t3 = setTimeout(() => setPhase("done"), 3800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  useEffect(() => {
    if (phase === "reveal" && !hapticFired.current) {
      hapticFired.current = true;
      hapticHeavy();
    }
  }, [phase]);

  // ── Computing phase ──
  if (phase === "computing") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6">
        <div
          className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mb-6"
          style={{
            borderColor: "var(--dynamic-fg, #fff)",
            borderTopColor: "transparent",
          }}
        />
        <p
          className="font-['Fira_Code'] text-[13px] text-center opacity-70 leading-relaxed"
          style={{ color: "var(--dynamic-fg, #fff)" }}
        >
          Calculando tu posicion
          <br />
          en el compass...
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col flex-1 items-center px-2 overflow-y-auto compass-reveal-scroll"
      style={{ animation: "compass-scale-in 500ms ease-out", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
    >
      {/* ── Duotone Card ── */}
      <div
        className="w-full rounded-[35px] px-6 pt-6 pb-7 relative mt-2 mb-8"
        style={{ backgroundColor: "var(--dynamic-fg, #fff)" }}
      >
        {/* Purity badge — top right */}
        <div
          className="absolute top-[20px] right-[20px] px-2.5 py-1 rounded-full"
          style={{ backgroundColor: "var(--dynamic-bg, #000)", color: "var(--dynamic-fg, #fff)" }}
        >
          <span className="font-['Fira_Code'] font-bold text-[12px] tracking-tight">
            {purity}% puro
          </span>
        </div>

        {/* Emoji */}
        <div className="flex justify-center mt-4 mb-2">
          <span className="leading-none" style={{ fontSize: 80 }}>
            {primary.emoji}
          </span>
        </div>

        {/* Archetype name */}
        <h1
          className="font-['Silkscreen'] text-[33px] leading-tight text-center mb-4"
          style={{ color: "var(--dynamic-bg, #000)" }}
        >
          {primary.name.toUpperCase()}
        </h1>

        {/* Quote */}
        <p
          className="font-['Roboto'] font-semibold text-[16px] leading-snug text-center mb-3 px-2"
          style={{ color: "var(--dynamic-bg, #000)" }}
        >
          &ldquo;{primary.phrase}&rdquo;
        </p>

        {/* Description */}
        <p
          className="font-['Roboto'] text-[14px] leading-relaxed text-center px-2 opacity-80"
          style={{ color: "var(--dynamic-bg, #000)" }}
        >
          {primary.description}
        </p>
      </div>

      {/* ── Axis Sliders ── */}
      <div className="w-full px-1">
        <AxisSlider
          value={vector.x}
          negLabel={AXIS_POLES.X.negative.charAt(0) + AXIS_POLES.X.negative.slice(1).toLowerCase()}
          posLabel={AXIS_POLES.X.positive.charAt(0) + AXIS_POLES.X.positive.slice(1).toLowerCase()}
          animate={animateAxes}
        />
        <AxisSlider
          value={vector.y}
          negLabel={AXIS_POLES.Y.negative.charAt(0) + AXIS_POLES.Y.negative.slice(1).toLowerCase()}
          posLabel={AXIS_POLES.Y.positive.charAt(0) + AXIS_POLES.Y.positive.slice(1).toLowerCase()}
          animate={animateAxes}
        />
        <AxisSlider
          value={vector.z}
          negLabel={AXIS_POLES.Z.negative.charAt(0) + AXIS_POLES.Z.negative.slice(1).toLowerCase()}
          posLabel={AXIS_POLES.Z.positive.charAt(0) + AXIS_POLES.Z.positive.slice(1).toLowerCase()}
          animate={animateAxes}
        />
      </div>

      {/* ── Continue Button ── */}
      {phase === "done" && (
        <div
          className="w-full mt-auto mb-4 px-1"
          style={{ animation: "compass-fade-in 500ms ease-out" }}
        >
          <button
            onClick={() => {
              hapticRigid();
              onContinue();
            }}
            className="w-full h-[64px] rounded-[8px] flex items-center justify-center active:scale-[0.98] transition-transform"
            style={{ backgroundColor: "var(--dynamic-fg, #fff)" }}
          >
            <span
              className="font-['Roboto'] font-semibold text-[21px]"
              style={{ color: "var(--dynamic-bg, #000)" }}
            >
              Continuar
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
        .compass-reveal-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
