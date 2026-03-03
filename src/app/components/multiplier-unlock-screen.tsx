import { useEffect, useState, useRef } from "react";
import svgPaths from "../../imports/svg-tmfxsn4jxy";
import { hapticSuccess, hapticHeavy, hapticRigid } from "./haptics";

interface MultiplierUnlockScreenProps {
  multiplier: string; // "x1.25" or "x1.50"
  subtitle?: string;
  onComplete: () => void;
}

export function MultiplierUnlockScreen({
  multiplier,
  subtitle = "Tus tickets vuelan",
  onComplete,
}: MultiplierUnlockScreenProps) {
  const [phase, setPhase] = useState<"enter" | "icon" | "text" | "exit">("enter");
  const completeCalled = useRef(false);

  useEffect(() => {
    hapticRigid();

    const t1 = setTimeout(() => {
      setPhase("icon");
      hapticHeavy();
    }, 200);

    const t2 = setTimeout(() => {
      setPhase("text");
      hapticSuccess();
    }, 700);

    const t3 = setTimeout(() => {
      setPhase("exit");
    }, 2800);

    const t4 = setTimeout(() => {
      if (!completeCalled.current) {
        completeCalled.current = true;
        onComplete();
      }
    }, 3200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  return (
    <div className="h-dvh flex items-center justify-center overflow-hidden font-['Roboto']"
      style={{
        backgroundColor: "var(--dynamic-fg, #fff)",
        paddingTop: "var(--tg-safe-top, 0px)",
        paddingBottom: "var(--tg-safe-bottom, 0px)",
      }}
    >
      <style>{`
        @keyframes mu-flame-in {
          0% { transform: scale(0) translateY(40px); opacity: 0; }
          50% { transform: scale(1.2) translateY(-8px); opacity: 1; }
          70% { transform: scale(0.9) translateY(4px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes mu-flame-idle {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.05) translateY(-4px); }
        }
        @keyframes mu-title-in {
          0% { transform: translateY(24px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes mu-value-in {
          0% { transform: scale(0.3) translateY(20px); opacity: 0; }
          60% { transform: scale(1.08) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes mu-sub-in {
          0% { transform: translateY(12px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes mu-burst-ring {
          0% { transform: scale(0.2); opacity: 0.8; border-width: 3px; }
          100% { transform: scale(3.5); opacity: 0; border-width: 1px; }
        }
        @keyframes mu-burst-ring-2 {
          0% { transform: scale(0.4); opacity: 0.6; border-width: 2px; }
          100% { transform: scale(2.8); opacity: 0; border-width: 1px; }
        }
        @keyframes mu-particle {
          0% { transform: translate(0, 0) scale(1); opacity: 0.7; }
          100% { transform: translate(var(--px), var(--py)) scale(0); opacity: 0; }
        }
        @keyframes mu-exit {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.92); }
        }
        @keyframes mu-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-2px); }
          40% { transform: translateX(2px); }
          60% { transform: translateX(-1px); }
          80% { transform: translateX(1px); }
        }
      `}</style>

      <div
        className="flex flex-col items-center relative"
        style={{
          animation: phase === "exit" ? "mu-exit 400ms ease-in forwards" : "none",
        }}
      >
        {/* Burst rings on icon phase */}
        {(phase === "icon" || phase === "text") && (
          <>
            <div
              className="absolute rounded-full"
              style={{
                border: "1px solid var(--dynamic-bg, #000)",
                width: 80,
                height: 80,
                top: 0,
                left: "50%",
                marginLeft: -40,
                animation: "mu-burst-ring 900ms ease-out forwards",
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                border: "1px solid var(--dynamic-bg, #000)",
                width: 80,
                height: 80,
                top: 0,
                left: "50%",
                marginLeft: -40,
                animation: "mu-burst-ring-2 700ms 100ms ease-out forwards",
              }}
            />
          </>
        )}

        {/* Dot particles */}
        {(phase === "icon" || phase === "text") &&
          Array.from({ length: 8 }).map((_, i) => {
            const angle = (Math.PI * 2 * i) / 8;
            const dist = 50 + Math.random() * 60;
            return (
              <div
                key={i}
                className="absolute w-[6px] h-[6px] rounded-full"
                style={{
                  backgroundColor: "var(--dynamic-bg, #000)",
                  top: 37,
                  left: "50%",
                  marginLeft: -3,
                  "--px": `${Math.cos(angle) * dist}px`,
                  "--py": `${Math.sin(angle) * dist}px`,
                  animation: `mu-particle 800ms ${i * 40}ms ease-out forwards`,
                } as React.CSSProperties}
              />
            );
          })}

        {/* Flame icon */}
        <div
          className="w-[78px] h-[93px] relative"
          style={{
            animation:
              phase === "enter"
                ? "none"
                : phase === "icon"
                  ? "mu-flame-in 500ms ease-out forwards"
                  : phase === "text"
                    ? "mu-flame-idle 2s ease-in-out infinite"
                    : "none",
            opacity: phase === "enter" ? 0 : 1,
          }}
        >
          <svg
            className="absolute block size-full"
            fill="none"
            preserveAspectRatio="none"
            viewBox="0 0 78 93"
          >
            <path d={svgPaths.p337bc80} fill="var(--dynamic-bg, black)" />
          </svg>
        </div>

        {/* Title */}
        {(phase === "text" || phase === "exit") && (
          <p
            className="text-center mt-8"
            style={{
              color: "var(--dynamic-bg, #000)",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "-0.3px",
              lineHeight: "1.05",
              maxWidth: 284,
              animation: "mu-title-in 450ms ease-out forwards",
            }}
          >
            Multiplier{"\n"}desbloqueado
          </p>
        )}

        {/* Multiplier value */}
        {(phase === "text" || phase === "exit") && (
          <p
            className="text-center mt-6"
            style={{
              color: "var(--dynamic-bg, #000)",
              fontSize: 62,
              fontWeight: 800,
              letterSpacing: "-0.62px",
              lineHeight: 1,
              animation: "mu-value-in 500ms 150ms ease-out both",
            }}
          >
            {multiplier}
          </p>
        )}

        {/* Subtitle */}
        {(phase === "text" || phase === "exit") && (
          <p
            className="text-center mt-3"
            style={{
              color: "var(--dynamic-bg, #000)",
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "-0.16px",
              animation: "mu-sub-in 400ms 350ms ease-out both",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}