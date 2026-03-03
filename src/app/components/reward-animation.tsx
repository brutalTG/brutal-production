import { useEffect, useState, useRef } from "react";
import { Coins, Ticket } from "lucide-react";

export interface RewardEvent {
  type: "coins" | "tickets";
  value: number;
  id: number; // unique to trigger re-renders
  penalty?: boolean; // if true, this is a loss animation
}

interface RewardAnimationProps {
  event: RewardEvent | null;
}

// Generate random particles for burst effect
function generateParticles(count: number, isPenalty: boolean) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const distance = 30 + Math.random() * 50;
    const dx = Math.cos(angle) * distance;
    const dy = isPenalty
      ? Math.abs(Math.sin(angle) * distance) + 20 + Math.random() * 40 // bias downward
      : Math.sin(angle) * distance - 40 - Math.random() * 30; // bias upward
    const delay = Math.random() * 80;
    const scale = 0.5 + Math.random() * 0.6;
    const rotation = Math.random() * 360;
    return { dx, dy, delay, scale, rotation, id: i };
  });
}

export function RewardAnimation({ event }: RewardAnimationProps) {
  const [activeEvent, setActiveEvent] = useState<RewardEvent | null>(null);
  const [particles, setParticles] = useState<ReturnType<typeof generateParticles>>([]);
  const [phase, setPhase] = useState<"idle" | "burst" | "done">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!event) return;

    // Clear previous timers
    timeoutRef.current.forEach(clearTimeout);
    timeoutRef.current = [];

    setActiveEvent(event);
    setParticles(generateParticles(8, !!event.penalty));
    setPhase("burst");

    const t1 = setTimeout(() => setPhase("done"), 900);
    const t2 = setTimeout(() => {
      setPhase("idle");
      setActiveEvent(null);
    }, 1100);

    timeoutRef.current = [t1, t2];

    return () => {
      timeoutRef.current.forEach(clearTimeout);
    };
  }, [event]);

  if (phase === "idle" || !activeEvent) return null;

  const isCoins = activeEvent.type === "coins";
  const isPenalty = !!activeEvent.penalty;
  const Icon = isCoins ? Coins : Ticket;

  const formattedValue = isPenalty
    ? `-${activeEvent.value}`
    : isCoins
      ? `+${activeEvent.value % 1 === 0 ? activeEvent.value : activeEvent.value.toFixed(2).replace(".", ",")}`
      : `+${activeEvent.value}`;

  const floatAnim = isPenalty ? "penalty-drop-down" : "reward-float-up";
  const particleAnim = isPenalty ? "penalty-particle" : "reward-particle";
  const ringAnim = isPenalty ? "penalty-ring" : "reward-ring";

  return (
    <>
      {/* Injected keyframes */}
      <style>{`
        @keyframes reward-float-up {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          60% { opacity: 1; transform: translateY(-38px) scale(1.15); }
          100% { opacity: 0; transform: translateY(-60px) scale(0.9); }
        }
        @keyframes reward-particle {
          0% { opacity: 1; transform: translate(0, 0) scale(var(--p-scale)) rotate(0deg); }
          30% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--p-dx), var(--p-dy)) scale(0.1) rotate(var(--p-rot)); }
        }
        @keyframes reward-pill-flash {
          0% { transform: scale(1); filter: brightness(1); }
          25% { transform: scale(1.18); filter: brightness(1.8); }
          50% { transform: scale(0.95); filter: brightness(1.2); }
          75% { transform: scale(1.06); filter: brightness(1); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes reward-ring {
          0% { opacity: 0.8; transform: scale(0.5); }
          50% { opacity: 0.4; transform: scale(1.8); }
          100% { opacity: 0; transform: scale(2.5); }
        }

        /* Penalty animations */
        @keyframes penalty-drop-down {
          0% { opacity: 1; transform: translateY(0) scale(1.2); }
          20% { opacity: 1; transform: translateY(-8px) scale(1.3); }
          60% { opacity: 1; transform: translateY(30px) scale(1); }
          100% { opacity: 0; transform: translateY(55px) scale(0.7); }
        }
        @keyframes penalty-particle {
          0% { opacity: 1; transform: translate(0, 0) scale(var(--p-scale)) rotate(0deg); }
          20% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--p-dx), var(--p-dy)) scale(0.05) rotate(var(--p-rot)); }
        }
        @keyframes penalty-pill-shake {
          0%, 100% { transform: translateX(0) scale(1); filter: brightness(1); }
          10% { transform: translateX(-6px) scale(0.95); filter: brightness(0.3); }
          20% { transform: translateX(6px) scale(0.95); filter: brightness(1.5); }
          30% { transform: translateX(-5px) scale(0.97); filter: brightness(0.4); }
          40% { transform: translateX(5px) scale(0.97); filter: brightness(1.3); }
          50% { transform: translateX(-3px) scale(0.98); filter: brightness(0.5); }
          60% { transform: translateX(3px) scale(0.98); filter: brightness(1.2); }
          70% { transform: translateX(-2px); filter: brightness(0.7); }
          80% { transform: translateX(2px); filter: brightness(1); }
        }
        @keyframes penalty-ring {
          0% { opacity: 0.6; transform: scale(0.8); border-style: dashed; }
          40% { opacity: 0.3; transform: scale(1.6); }
          100% { opacity: 0; transform: scale(2.2); }
        }
        @keyframes penalty-crack {
          0% { opacity: 0; transform: scaleX(0); }
          20% { opacity: 1; transform: scaleX(1); }
          70% { opacity: 1; transform: scaleX(1); }
          100% { opacity: 0; transform: scaleX(0.5); }
        }
      `}</style>

      {/* Overlay container — positioned relative to the pills row via parent */}
      <div
        className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center"
        style={{
          /* Shift to center over the correct pill — penalties always target tickets */
          left: isCoins ? "0%" : "50%",
          width: "50%",
        }}
      >
        {/* Expanding ring */}
        <div
          className="absolute rounded-full border-2"
          style={{
            borderColor: "var(--dynamic-fg, #fff)",
            width: 60,
            height: 60,
            animation: `${ringAnim} 600ms ease-out forwards`,
          }}
        />

        {/* Penalty: horizontal crack line */}
        {isPenalty && (
          <div
            className="absolute w-16 h-[2px]"
            style={{
              backgroundColor: "var(--dynamic-fg, #fff)",
              animation: "penalty-crack 700ms ease-out forwards",
            }}
          />
        )}

        {/* Floating value text */}
        <div
          className="absolute font-['Roboto'] font-extrabold text-[20px] tracking-tight whitespace-nowrap"
          style={{
            color: "var(--dynamic-fg, #fff)",
            animation: `${floatAnim} 800ms ease-out forwards`,
            textShadow: "0 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(255,255,255,0.3)",
          }}
        >
          {formattedValue}
        </div>

        {/* Particle burst */}
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute"
            style={{
              "--p-dx": `${p.dx}px`,
              "--p-dy": `${p.dy}px`,
              "--p-scale": p.scale,
              "--p-rot": `${p.rotation}deg`,
              animation: `${particleAnim} 700ms ease-out ${p.delay}ms forwards`,
              opacity: 0,
            } as React.CSSProperties}
          >
            <Icon
              className="w-3.5 h-3.5"
              style={{ color: "var(--dynamic-fg, #fff)", fill: "var(--dynamic-fg, #fff)" }}
              strokeWidth={2.5}
            />
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Wrapper that applies pill-flash or pill-shake animation when triggered.
 */
export function AnimatedStatPill({
  icon: Icon,
  value,
  className = "",
  flash,
  shake,
}: {
  icon?: any;
  value: string;
  className?: string;
  flash: boolean;
  shake?: boolean;
}) {
  const animName = shake ? "penalty-pill-shake" : flash ? "reward-pill-flash" : "none";
  const animDuration = shake ? "600ms" : "500ms";

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1.5 h-[44px] justify-center shadow-sm select-none min-w-0 ${className}`}
      style={{
        backgroundColor: "var(--dynamic-fg, #fff)",
        color: "var(--dynamic-bg, #000)",
        animation: animName !== "none" ? `${animName} ${animDuration} ease-out` : "none",
      }}
    >
      {Icon && (
        <Icon className="w-[14px] h-[14px] shrink-0 fill-current" strokeWidth={2.5} />
      )}
      <span className="font-['Roboto'] font-extrabold tracking-tight truncate text-[16px]">
        {value}
      </span>
    </div>
  );
}