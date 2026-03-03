import { useState, useEffect } from "react";
import svgPaths from "../../imports/svg-molz8y3cxk";
import { hapticHeavy, hapticSuccess, hapticRigid } from "./haptics";
import { getRandomDuotonePair } from "./color-generator";
import { BrutalLogo } from "./brutal-ui";

interface RevealScreenProps {
  title: string;
  description: string;
  metrics: {
    latency: string;
    instinctiveResponses: string;
    doubtMoments: string;
    totalTime: string;
  };
  coins: number;
  tickets: number;
  multiplier: number; // 1, 1.25, or 1.5
  onClaim: () => void;
  /** Async function that claims rewards on the server — called before animation */
  onClaimRewards: () => Promise<boolean>;
  /** Optional share card component rendered between metrics and bottom */
  shareCard?: React.ReactNode;
  /** Navigate to profile screen */
  onProfile?: () => void;
  /** Navigate to leaderboard screen */
  onLeaderboard?: () => void;
}

// Coin icon SVG (from Figma)
function CoinIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 20.25 20.2486">
      <path d={svgPaths.p62f2500} fill="currentColor" />
      <path d={svgPaths.p1a986a80} fill="currentColor" />
    </svg>
  );
}

// Ticket icon SVG (from Figma)
function TicketIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 19.9688 15.975">
      <path clipRule="evenodd" d={svgPaths.p23be4400} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

function DashedLine() {
  return (
    <div className="w-full h-0 my-0">
      <svg className="w-full h-[1px]" fill="none" preserveAspectRatio="none" viewBox="0 0 343 1">
        <line stroke="var(--dynamic-fg, white)" strokeDasharray="4 4" x2="343" y1="0.5" y2="0.5" />
      </svg>
    </div>
  );
}

export function RevealScreen({
  title,
  description,
  metrics,
  coins,
  tickets,
  multiplier,
  onClaim,
  onClaimRewards,
  shareCard,
  onProfile,
  onLeaderboard,
}: RevealScreenProps) {
  const [claimPhase, setClaimPhase] = useState<"idle" | "claiming" | "multiplying" | "done">("idle");
  const [displayTickets, setDisplayTickets] = useState(tickets);
  const [showMultBadge, setShowMultBadge] = useState(false);
  const [claimError, setClaimError] = useState(false);

  // Pick a random duotone pair for the reveal screen
  const [revealColors] = useState(() => getRandomDuotonePair());

  // Apply to body on mount
  useEffect(() => {
    document.body.style.setProperty("--dynamic-bg", revealColors.bg);
    document.body.style.setProperty("--dynamic-fg", revealColors.fg);
    document.body.style.backgroundColor = revealColors.bg;
    document.body.style.color = revealColors.fg;
  }, [revealColors]);

  const finalTickets = Math.round(tickets * multiplier);
  const hasMultiplier = multiplier > 1;

  const formattedCoins = coins % 1 === 0 ? coins.toString() : coins.toFixed(2).replace(".", ",");
  const formattedTickets = displayTickets.toLocaleString("es-AR");

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  // Animated ticket count-up during multiplier phase
  useEffect(() => {
    if (claimPhase !== "multiplying") return;
    
    const startVal = tickets;
    const endVal = finalTickets;
    const duration = 1000;
    const startTime = Date.now();
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * eased);
      setDisplayTickets(current);
      
      if (progress >= 1) {
        clearInterval(interval);
        hapticSuccess();
        setClaimPhase("done");
        // No auto-close — user taps "Reclamado" to close
      }
    }, 16);

    return () => clearInterval(interval);
  }, [claimPhase, tickets, finalTickets, onClaim]);

  const handleClaim = async () => {
    if (claimPhase !== "idle") return;

    // Phase 1: Call API first — block UI until done
    setClaimPhase("claiming");
    setClaimError(false);

    try {
      const success = await onClaimRewards();
      if (!success) {
        console.error("[BRUTAL] Claim returned false");
        // Continue anyway — rewards may have been already claimed (idempotent)
      }
    } catch (err) {
      console.error("[BRUTAL] Claim error:", err);
      setClaimError(true);
      setClaimPhase("idle");
      return; // Let user retry
    }

    // Phase 2: Now do the animation (API is done, safe to show Reclamado after)
    if (hasMultiplier) {
      hapticRigid();
      setShowMultBadge(true);
      setClaimPhase("multiplying");

      // Haptic bursts during count-up
      setTimeout(() => hapticHeavy(), 300);
      setTimeout(() => hapticHeavy(), 600);
      setTimeout(() => hapticHeavy(), 900);
    } else {
      hapticSuccess();
      setClaimPhase("done");
    }
  };

  return (
    <div className="h-dvh flex justify-center font-['Roboto'] overflow-hidden" style={{ backgroundColor: "var(--dynamic-bg, #000)" }}>
      <style>{`
        @keyframes reveal-mult-badge {
          0% { transform: scale(0) rotate(-20deg); opacity: 0; }
          50% { transform: scale(1.2) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes reveal-mult-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes reveal-ticket-flash {
          0% { background-color: transparent; }
          30% { background-color: rgba(255,255,255,0.15); }
          100% { background-color: transparent; }
        }
        @keyframes reveal-claim-success {
          0% { transform: scale(1); }
          30% { transform: scale(0.95); }
          60% { transform: scale(1.02); }
          100% { transform: scale(1); opacity: 0.6; }
        }
        @keyframes reveal-burst-ring {
          0% { transform: scale(0.5); opacity: 0.8; border-color: #fff; }
          100% { transform: scale(3); opacity: 0; border-color: #fff; }
        }
        @keyframes reveal-particle-fly {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--rpx), var(--rpy)) scale(0); opacity: 0; }
        }
        @keyframes reveal-checkmark {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div className="w-full max-w-[420px] flex flex-col h-dvh overflow-y-auto overflow-x-hidden"
        style={{
          paddingTop: "calc(var(--tg-safe-top, 0px) + 24px)",
          paddingLeft: "20px",
          paddingRight: "20px",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <BrutalLogo size="lg" fill="var(--dynamic-fg, white)" withFilter filterId="filter0_g_reveal" />
          <div className="flex flex-col">
            <span className="font-['Silkscreen'] text-[19px] leading-[20px] tracking-wide" style={{ color: "var(--dynamic-fg, #fff)" }}>
              BRUTAL////////////////
            </span>
            <span className="font-['Fira_Code'] font-medium text-[14px] leading-[20px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
              Signal extraction {timeStr}
            </span>
          </div>
        </div>

        {/* Profile card */}
        <div className="rounded-[30px] px-6 pt-6 pb-7 mb-6" style={{ backgroundColor: "var(--dynamic-fg, #fff)" }}>
          {/* "Tu perfil" pill */}
          <div className="inline-flex items-center justify-center rounded-full px-[14px] py-[6px] mb-5" style={{ backgroundColor: "var(--dynamic-bg, #000)", color: "var(--dynamic-fg, #fff)" }}>
            <span className="font-['Roboto'] font-semibold text-[12px] tracking-[-0.12px]">
              Tu perfil
            </span>
          </div>

          {/* Title */}
          <h1 className="font-['Roboto'] font-bold text-[30px] leading-tight mb-4 whitespace-pre-wrap" style={{ color: "var(--dynamic-bg, #000)" }}>
            {title}
          </h1>

          {/* Description */}
          <p className="font-['Roboto'] text-[16px] leading-normal" style={{ color: "var(--dynamic-bg, #000)" }}>
            {description}
          </p>
        </div>

        {/* Signal metrics section */}
        <div className="flex flex-col gap-0 mb-8 px-1">
          <p className="font-['Fira_Code'] font-semibold text-[15px] leading-[31px] mb-0" style={{ color: "var(--dynamic-fg, #fff)" }}>
            Signal metrics
          </p>

          <div className="flex justify-between items-baseline">
            <span className="font-['Fira_Code'] font-normal text-[15px] leading-[31px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
              {">"} Latencia promedio:
            </span>
            <span className="font-['Fira_Code'] font-semibold text-[15px] leading-[31px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
              {metrics.latency}
            </span>
          </div>
          <DashedLine />

          <div className="flex justify-between items-baseline">
            <span className="font-['Fira_Code'] font-normal text-[15px] leading-[31px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
              {">"} Respuestas instintivas:
            </span>
            <span className="font-['Fira_Code'] font-semibold text-[15px] leading-[31px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
              {metrics.instinctiveResponses}
            </span>
          </div>
          <DashedLine />

          <div className="flex justify-between items-baseline">
            <span className="font-['Fira_Code'] font-normal text-[15px] leading-[31px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
              {">"} Momentos de duda:
            </span>
            <span className="font-['Fira_Code'] font-semibold text-[15px] leading-[31px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
              {metrics.doubtMoments}
            </span>
          </div>
          <DashedLine />

          <div className="flex justify-between items-baseline">
            <span className="font-['Fira_Code'] font-normal text-[15px] leading-[31px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
              {">"} Tiempo total:
            </span>
            <span className="font-['Fira_Code'] font-semibold text-[15px] leading-[31px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
              {metrics.totalTime}
            </span>
          </div>
          <DashedLine />
        </div>

        {/* Optional share card */}
        {shareCard && (
          <div className="mb-8 flex justify-center">
            {shareCard}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom section */}
        <div className="-mx-5 px-5 pt-8 flex flex-col items-center gap-4 rounded-t-[0px] relative"
          style={{
            backgroundColor: "var(--dynamic-fg, #fff)",
            paddingBottom: "calc(var(--tg-safe-bottom, 0px) + 32px)",
          }}
        >
          {/* Multiplier badge */}
          {showMultBadge && (
            <div className="absolute -top-5 right-8 z-20">
              <div
                className="rounded-full px-4 py-2 font-['Roboto'] font-extrabold text-[18px] border-2"
                style={{
                  backgroundColor: "var(--dynamic-bg, #000)",
                  color: "var(--dynamic-fg, #fff)",
                  borderColor: "var(--dynamic-fg, #fff)",
                  animation: "reveal-mult-badge 500ms ease-out forwards, reveal-mult-pulse 1s 500ms ease-in-out infinite",
                }}
              >
                x{multiplier.toFixed(2).replace(/\.?0+$/, "")}
              </div>
            </div>
          )}

          {/* Burst particles on claim */}
          {claimPhase !== "idle" && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 10 }).map((_, i) => {
                const angle = (Math.PI * 2 * i) / 10;
                const dist = 50 + Math.random() * 100;
                return (
                  <div
                    key={i}
                    className="absolute top-1/2 left-1/2"
                    style={{
                      "--rpx": `${Math.cos(angle) * dist}px`,
                      "--rpy": `${Math.sin(angle) * dist}px`,
                      animation: `reveal-particle-fly 1s ${i * 40}ms ease-out forwards`,
                    } as React.CSSProperties}
                  >
                    <TicketIcon className="w-4 h-3" style={{ color: "var(--dynamic-bg, #000)" }} />
                  </div>
                );
              })}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60px] h-[60px] rounded-full border-2"
                style={{
                  borderColor: "var(--dynamic-bg, #000)",
                  animation: "reveal-burst-ring 800ms ease-out forwards",
                }}
              />
            </div>
          )}

          {/* Reward pills */}
          <div className="flex gap-2 w-full max-w-[290px]">
            {/* Coins pill */}
            <div className="flex-1 h-[60px] border-2 rounded-l-full rounded-r-[5px] flex items-center justify-center gap-2" style={{ borderColor: "var(--dynamic-bg, #000)" }}>
              <CoinIcon className="w-5 h-5" style={{ color: "var(--dynamic-bg, #000)" }} />
              <span className="font-['Roboto'] font-extrabold text-[22px] tracking-[-0.22px]" style={{ color: "var(--dynamic-bg, #000)" }}>
                {formattedCoins}
              </span>
            </div>

            {/* Tickets pill */}
            <div
              className="flex-1 h-[60px] border-2 rounded-r-full rounded-l-[5px] flex items-center justify-center gap-2"
              style={{
                borderColor: "var(--dynamic-bg, #000)",
                animation: claimPhase === "multiplying" ? "reveal-ticket-flash 300ms ease-in-out infinite" : "none",
              }}
            >
              <TicketIcon className="w-5 h-4" style={{ color: "var(--dynamic-bg, #000)" }} />
              <span className="font-['Roboto'] font-extrabold text-[22px] tracking-[-0.22px]" style={{ color: "var(--dynamic-bg, #000)" }}>
                {formattedTickets}
              </span>
            </div>
          </div>

          {/* Claim button / Done state */}
          {claimPhase === "done" ? (
            <div className="flex flex-col items-center gap-3 w-full max-w-[290px]">
              <button
                onClick={onClaim}
                className="w-full h-[60px] rounded-full flex items-center justify-center select-none active:scale-[0.98] transition-transform duration-150"
                style={{ backgroundColor: "var(--dynamic-bg, #000)", animation: "reveal-checkmark 400ms ease-out forwards" }}
              >
                <span className="font-['Roboto'] font-semibold text-[21px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
                  Reclamado
                </span>
              </button>

              {/* Post-claim navigation */}
              <div className="flex gap-2 w-full">
                {onProfile && (
                  <button
                    onClick={onProfile}
                    className="flex-1 h-[44px] rounded-full border-2 flex items-center justify-center select-none active:scale-[0.97] transition-transform duration-150"
                    style={{ borderColor: "var(--dynamic-bg, #000)" }}
                  >
                    <span className="font-['Fira_Code'] font-semibold text-[13px]" style={{ color: "var(--dynamic-bg, #000)" }}>
                      Mi Perfil
                    </span>
                  </button>
                )}
                {onLeaderboard && (
                  <button
                    onClick={onLeaderboard}
                    className="flex-1 h-[44px] rounded-full flex items-center justify-center select-none active:scale-[0.97] transition-transform duration-150"
                    style={{ backgroundColor: "var(--dynamic-bg, #000)" }}
                  >
                    <span className="font-['Fira_Code'] font-semibold text-[13px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
                      Leaderboard
                    </span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 w-full max-w-[290px]">
              <button
                onClick={handleClaim}
                disabled={claimPhase !== "idle"}
                className="w-full h-[60px] rounded-full flex items-center justify-center select-none active:scale-[0.98] transition-all duration-150"
                style={{
                  backgroundColor: "var(--dynamic-bg, #000)",
                  opacity: claimPhase === "claiming" ? 0.7 : 1,
                  animation: claimPhase === "multiplying" ? "reveal-claim-success 600ms ease-out" : "none",
                }}
              >
                {claimPhase === "claiming" ? (
                  <span className="font-['Roboto'] font-semibold text-[21px] flex items-center gap-3" style={{ color: "var(--dynamic-fg, #fff)" }}>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Reclamando...
                  </span>
                ) : (
                  <span className="font-['Roboto'] font-semibold text-[21px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
                    Reclamar todo
                  </span>
                )}
              </button>
              {claimError && (
                <p className="font-['Fira_Code'] text-[11px] text-center" style={{ color: "var(--dynamic-bg, #000)" }}>
                  Error al reclamar. Tocá de nuevo para reintentar.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}