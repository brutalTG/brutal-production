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
  /** Called when user taps "Cerrar" — notifies server and closes Mini App */
  onNotifyAndClose: () => void;
  /** Optional share card component rendered between metrics and bottom */
  shareCard?: React.ReactNode;
}

// Coin icon SVG (from Figma)
function CoinIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 20.25 20.2486" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.2015 14.9571C19.8669 17.6547 17.6561 19.8656 14.9584 20.2002C13.3257 20.403 11.8045 19.9568 10.6179 19.0847C9.93846 18.5877 10.1007 17.533 10.912 17.2896C13.9646 16.3668 16.3681 13.9531 17.3011 10.9006C17.5445 10.0994 18.5992 9.93714 19.0961 10.6065C19.9582 11.8032 20.4044 13.3244 20.2015 14.9571Z" fill="currentColor" />
      <path d="M8.10297 0C3.63062 0 0 3.63062 0 8.10297C0 12.5753 3.63062 16.2059 8.10297 16.2059C12.5753 16.2059 16.2059 12.5753 16.2059 8.10297C16.1958 3.63062 12.5753 0 8.10297 0ZM7.14968 6.96713L9.59375 7.81901C10.4761 8.13339 10.902 8.75201 10.902 9.7053C10.902 10.8006 10.0298 11.7032 8.96499 11.7032H8.87371V11.7539C8.87371 12.1697 8.52891 12.5145 8.11311 12.5145C7.69731 12.5145 7.3525 12.1697 7.3525 11.7539V11.693C6.22681 11.6423 5.32423 10.6992 5.32423 9.52276C5.32423 9.10696 5.66903 8.76216 6.08483 8.76216C6.50063 8.76216 6.84544 9.10696 6.84544 9.52276C6.84544 9.88785 7.10911 10.182 7.43364 10.182H8.95484C9.1881 10.182 9.37064 9.96898 9.37064 9.7053C9.37064 9.35036 9.30979 9.33007 9.07654 9.24894L6.63247 8.39707C5.76031 8.09282 5.32423 7.4742 5.32423 6.51077C5.32423 5.4155 6.19639 4.51292 7.26123 4.51292H7.3525V4.47235C7.3525 4.05655 7.69731 3.71175 8.11311 3.71175C8.52891 3.71175 8.87371 4.05655 8.87371 4.47235V4.5332C9.99941 4.58391 10.902 5.52705 10.902 6.70345C10.902 7.11925 10.5572 7.46406 10.1414 7.46406C9.72559 7.46406 9.38078 7.11925 9.38078 6.70345C9.38078 6.33837 9.11711 6.04427 8.79258 6.04427H7.27137C7.03812 6.04427 6.85558 6.25723 6.85558 6.52091C6.84544 6.86572 6.90628 6.886 7.14968 6.96713Z" fill="currentColor" />
    </svg>
  );
}

// Ticket icon SVG (from Figma)
function TicketIcon({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 19.9688 15.975" xmlns="http://www.w3.org/2000/svg">
      <path clipRule="evenodd" d="M11.9891 14.9795L11.9949 12.9797C11.9949 12.4282 12.443 11.9812 12.9959 11.9812C13.5486 11.9812 13.9968 12.4282 13.9968 12.9797V14.9531C13.9968 15.4338 13.9968 15.6743 14.1509 15.8216C14.3051 15.9691 14.5409 15.959 15.0127 15.9391C16.8727 15.8604 18.0155 15.6088 18.8209 14.8052C19.6284 13.9999 19.8799 12.8565 19.9582 10.9933C19.9737 10.6239 19.9815 10.4391 19.9125 10.3159C19.8435 10.1925 19.5681 10.0388 19.0171 9.73107C18.4053 9.3894 17.9917 8.73662 17.9917 7.9875C17.9917 7.23837 18.4053 6.58559 19.0171 6.24393C19.5681 5.93625 19.8435 5.78242 19.9125 5.65917C19.9815 5.53591 19.9737 5.35116 19.9582 4.98167C19.8799 3.11851 19.6284 1.97514 18.8209 1.16974C17.9446 0.295577 16.6691 0.074683 14.5051 0.0188704C14.2259 0.0116716 13.9968 0.236809 13.9968 0.515373V2.99531C13.9968 3.54673 13.5486 3.99375 12.9959 3.99375C12.443 3.99375 11.9949 3.54673 11.9949 2.99531L11.9876 0.497771C11.9868 0.222631 11.763 0 11.4872 0H7.98252C4.2078 0 2.32044 -1.19023e-07 1.14778 1.16974C0.340376 1.97514 0.0888898 3.11851 0.0105624 4.98167C-0.00497332 5.35116 -0.0127412 5.53591 0.0562508 5.65916C0.125253 5.78242 0.400702 5.93625 0.951589 6.24393C1.56341 6.58559 1.97697 7.23837 1.97697 7.9875C1.97697 8.73662 1.56341 9.3894 0.951589 9.73107C0.400702 10.0388 0.125253 10.1925 0.0562508 10.3159C-0.0127412 10.4391 -0.00497332 10.6239 0.0105624 10.9933C0.0888898 12.8565 0.340376 13.9999 1.14778 14.8052C2.32044 15.975 4.20779 15.975 7.98252 15.975H10.9882C11.4588 15.975 11.6941 15.975 11.8406 15.8293C11.987 15.6835 11.9877 15.4489 11.9891 14.9795ZM13.9968 8.98593V6.98906C13.9968 6.43762 13.5486 5.99062 12.9959 5.99062C12.443 5.99062 11.9949 6.43762 11.9949 6.98906V8.98593C11.9949 9.53737 12.443 9.98437 12.9959 9.98437C13.5486 9.98437 13.9968 9.53737 13.9968 8.98593Z" fill="currentColor" fillRule="evenodd" />
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
  onNotifyAndClose,
  shareCard,
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
      }
    }, 16);

    return () => clearInterval(interval);
  }, [claimPhase, tickets, finalTickets]);

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

          {/* Claim button → Cerrar button flow */}
          {claimPhase === "done" ? (
            <div className="flex flex-col items-center gap-3 w-full max-w-[290px]">
              <button
                onClick={onNotifyAndClose}
                className="w-full h-[60px] rounded-full flex items-center justify-center select-none active:scale-[0.98] transition-all duration-150"
                style={{ backgroundColor: "var(--dynamic-bg, #000)" }}
              >
                <span className="font-['Roboto'] font-semibold text-[21px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
                  Cerrar
                </span>
              </button>
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
