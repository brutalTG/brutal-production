import { useEffect, useState, useRef } from "react";
import { Ticket } from "lucide-react";
import { hapticError, hapticHeavy, hapticRigid } from "./haptics";

interface TrapFailScreenProps {
  penaltyValue: number;
  onComplete: () => void;
}

export function TrapFailScreen({ penaltyValue, onComplete }: TrapFailScreenProps) {
  const [phase, setPhase] = useState<"enter" | "shake" | "text" | "exit">("enter");
  const completeCalled = useRef(false);

  useEffect(() => {
    // Initial heavy slam
    hapticHeavy();

    const t1 = setTimeout(() => {
      setPhase("shake");
      hapticError();
      // Double haptic for extra punch
      setTimeout(() => hapticRigid(), 150);
    }, 200);

    const t2 = setTimeout(() => {
      setPhase("text");
    }, 700);

    const t3 = setTimeout(() => {
      setPhase("exit");
    }, 3000);

    const t4 = setTimeout(() => {
      if (!completeCalled.current) {
        completeCalled.current = true;
        onComplete();
      }
    }, 3400);

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
        backgroundColor: "var(--dynamic-bg, #000)",
        paddingTop: "var(--tg-safe-top, 0px)",
        paddingBottom: "var(--tg-safe-bottom, 0px)",
      }}
    >
      <style>{`
        @keyframes tf-screen-flash {
          0% { opacity: 0; }
          15% { opacity: 0.15; }
          30% { opacity: 0; }
          45% { opacity: 0.08; }
          60% { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes tf-icon-slam {
          0% { transform: scale(3) rotate(-10deg); opacity: 0; }
          40% { transform: scale(0.85) rotate(3deg); opacity: 1; }
          60% { transform: scale(1.1) rotate(-1deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes tf-shake-hard {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          10% { transform: translateX(-12px) rotate(-2deg); }
          20% { transform: translateX(12px) rotate(2deg); }
          30% { transform: translateX(-10px) rotate(-1.5deg); }
          40% { transform: translateX(10px) rotate(1.5deg); }
          50% { transform: translateX(-6px) rotate(-1deg); }
          60% { transform: translateX(6px) rotate(1deg); }
          70% { transform: translateX(-3px) rotate(-0.5deg); }
          80% { transform: translateX(3px) rotate(0.5deg); }
          90% { transform: translateX(-1px); }
        }
        @keyframes tf-title-in {
          0% { transform: translateY(30px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes tf-penalty-in {
          0% { transform: scale(0.3) translateY(20px); opacity: 0; }
          50% { transform: scale(1.15) translateY(-5px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes tf-subtitle-in {
          0% { transform: translateY(15px); opacity: 0; }
          100% { transform: translateY(0); opacity: 0.5; }
        }
        @keyframes tf-exit {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.95); }
        }
        @keyframes tf-ticket-fall {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 0.7; }
          100% { transform: translate(var(--tx), var(--ty)) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes tf-line-glitch {
          0%, 100% { transform: scaleX(1); opacity: 0.15; }
          25% { transform: scaleX(1.5) translateX(5px); opacity: 0.3; }
          50% { transform: scaleX(0.8) translateX(-3px); opacity: 0.1; }
          75% { transform: scaleX(1.2) translateX(2px); opacity: 0.25; }
        }
      `}</style>

      {/* Screen flash overlay */}
      {(phase === "shake" || phase === "text") && (
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{ backgroundColor: "var(--dynamic-fg, #fff)", animation: "tf-screen-flash 600ms ease-out forwards" }}
        />
      )}

      {/* Glitch lines */}
      {(phase === "shake" || phase === "text") &&
        Array.from({ length: 5 }).map((_, i) => (
          <div
            key={`line-${i}`}
            className="absolute h-[1px] pointer-events-none"
            style={{
              backgroundColor: "var(--dynamic-fg, #fff)",
              width: `${40 + Math.random() * 50}%`,
              top: `${15 + i * 17}%`,
              left: `${Math.random() * 20}%`,
              animation: `tf-line-glitch ${400 + i * 100}ms ${i * 80}ms ease-in-out both`,
            }}
          />
        ))}

      {/* Falling ticket particles */}
      {(phase === "shake" || phase === "text") &&
        Array.from({ length: 10 }).map((_, i) => {
          const tx = (Math.random() - 0.5) * 200;
          const ty = 100 + Math.random() * 200;
          const rot = (Math.random() - 0.5) * 360;
          return (
            <div
              key={`ticket-${i}`}
              className="absolute z-0"
              style={{
                top: "45%",
                left: "50%",
                "--tx": `${tx}px`,
                "--ty": `${ty}px`,
                "--rot": `${rot}deg`,
                animation: `tf-ticket-fall ${800 + Math.random() * 600}ms ${i * 50}ms ease-out forwards`,
              } as React.CSSProperties}
            >
              <Ticket className="w-4 h-4 opacity-40" style={{ color: "var(--dynamic-fg, #fff)" }} />
            </div>
          );
        })}

      {/* Main content */}
      <div
        className="flex flex-col items-center relative z-20 px-8"
        style={{
          animation:
            phase === "shake"
              ? "tf-shake-hard 500ms ease-out"
              : phase === "exit"
                ? "tf-exit 400ms ease-in forwards"
                : "none",
        }}
      >
        {/* Ticket icon - slams in */}
        <div
          className="w-[72px] h-[72px] rounded-full border-2 flex items-center justify-center"
          style={{
            borderColor: "var(--dynamic-fg, #fff)",
            animation: phase !== "enter" ? "tf-icon-slam 450ms ease-out forwards" : "none",
            opacity: phase === "enter" ? 0 : 1,
          }}
        >
          <Ticket className="w-8 h-8" style={{ color: "var(--dynamic-fg, #fff)", transform: "rotate(-45deg)" }} />
        </div>

        {/* Penalty value */}
        {(phase === "text" || phase === "exit") && (
          <p
            className="text-center mt-6"
            style={{
              color: "var(--dynamic-fg, #fff)",
              fontSize: 56,
              fontWeight: 800,
              letterSpacing: "-0.5px",
              lineHeight: 1,
              animation: "tf-penalty-in 500ms ease-out forwards",
            }}
          >
            -{penaltyValue}
          </p>
        )}

        {/* Title */}
        {(phase === "text" || phase === "exit") && (
          <p
            className="text-center mt-5"
            style={{
              color: "var(--dynamic-fg, #fff)",
              fontSize: 22,
              fontWeight: 700,
              lineHeight: "1.15",
              maxWidth: 280,
              animation: "tf-title-in 400ms 150ms ease-out both",
            }}
          >
            Estás en piloto automático
          </p>
        )}

        {/* Subtitle */}
        {(phase === "text" || phase === "exit") && (
          <p
            className="font-['Fira_Code'] text-center mt-3"
            style={{
              color: "var(--dynamic-fg, #fff)",
              fontSize: 13,
              animation: "tf-subtitle-in 400ms 300ms ease-out both",
            }}
          >
            Perdiste {penaltyValue} tickets
          </p>
        )}
      </div>
    </div>
  );
}