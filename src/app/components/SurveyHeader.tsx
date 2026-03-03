// ============================================================
// SURVEY HEADER — Progress bar, timer, stat pills, playing badge
// ============================================================

import { useState, useRef, useEffect } from "react";
import { Flame, Coins, Ticket } from "lucide-react";
import { RewardAnimation, AnimatedStatPill, type RewardEvent } from "./reward-animation";
import { hapticWarning } from "./haptics";

// --- Story Progress Bar ---
export function StoryProgressBar({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-[3px] w-full">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="h-[2.5px] flex-1 rounded-full"
          style={{
            backgroundColor: i <= current
              ? "var(--dynamic-fg, #fff)"
              : "color-mix(in srgb, var(--dynamic-fg, #fff) 20%, transparent)",
          }}
        />
      ))}
    </div>
  );
}

// --- Timer Bar ---
export function TimerBar({ duration, onTimeUp }: { duration: number; onTimeUp?: () => void }) {
  const [progress, setProgress] = useState(100);
  const [blinkOn, setBlinkOn] = useState(true);
  const timeUpCalled = useRef(false);

  useEffect(() => {
    const start = Date.now();
    const durationMs = duration * 1000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, durationMs - elapsed);
      const newProgress = (remaining / durationMs) * 100;
      setProgress(newProgress);
      if (newProgress <= 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [duration]);

  const seconds = Math.ceil((duration * progress) / 100);
  const isBlinking = seconds <= 3 && progress > 0;

  useEffect(() => {
    if (!isBlinking) { setBlinkOn(true); return; }
    hapticWarning();
    const blinkInterval = setInterval(() => setBlinkOn((p) => !p), 250);
    return () => clearInterval(blinkInterval);
  }, [isBlinking]);

  useEffect(() => {
    if (progress <= 0 && !timeUpCalled.current && onTimeUp) {
      timeUpCalled.current = true;
      onTimeUp();
    }
  }, [progress, onTimeUp]);

  const timeString = `00:${seconds.toString().padStart(2, "0")}`;

  return (
    <div
      className="relative h-[44px] w-full rounded-full overflow-hidden shadow-sm select-none"
      style={{
        backgroundColor: "var(--dynamic-bg, #000)",
        opacity: isBlinking ? (blinkOn ? 1 : 0.1) : 1,
        transition: "opacity 0.15s ease",
      }}
    >
      <div
        className="absolute inset-0 opacity-100"
        style={{
          backgroundImage: `repeating-linear-gradient(135deg, var(--dynamic-fg, #fff) 0, var(--dynamic-fg, #fff) 2px, transparent 2px, transparent 6px)`,
        }}
      />
      {progress > 0 && (
        <div
          className="absolute left-0 top-0 h-full flex items-center justify-center overflow-hidden rounded-l-full"
          style={{
            backgroundColor: "var(--dynamic-fg, #fff)",
            width: `${progress}%`,
            transition: "width 0.05s linear",
          }}
        >
          <span
            className="font-['Roboto'] font-extrabold tracking-tight whitespace-nowrap pl-2 text-[16px]"
            style={{ color: "var(--dynamic-bg, #000)" }}
          >
            {timeString}
          </span>
        </div>
      )}
    </div>
  );
}

// --- Playing Badge ---
export function PlayingBadge() {
  return (
    <div className="flex items-center gap-1.5 font-['Fira_Code'] text-xs mb-1" style={{ color: "var(--dynamic-fg, #fff)" }}>
      <Flame className="w-4 h-4" style={{ fill: "var(--dynamic-fg, #fff)" }} />
      <span className="font-bold">42</span>
      <span className="font-medium opacity-90">jugando</span>
    </div>
  );
}

// --- Stat Pills Row ---
interface StatPillsProps {
  formattedCoins: string;
  formattedTickets: string;
  rewardEvent: RewardEvent | null;
  isPenalty: boolean;
}

export function StatPills({ formattedCoins, formattedTickets, rewardEvent, isPenalty }: StatPillsProps) {
  return (
    <div className="flex w-[55%] gap-1.5 min-w-0 relative">
      <AnimatedStatPill
        icon={Coins}
        value={formattedCoins}
        className="rounded-l-full rounded-r-[5px] flex-1 px-2"
        flash={!isPenalty && rewardEvent?.type === "coins"}
        key={`coins-${!isPenalty && rewardEvent?.type === "coins" ? rewardEvent.id : "stable"}`}
      />
      <AnimatedStatPill
        icon={Ticket}
        value={formattedTickets}
        className="rounded-r-full rounded-l-[5px] flex-1 px-2"
        flash={!isPenalty && rewardEvent?.type === "tickets"}
        shake={isPenalty && rewardEvent?.type === "tickets"}
        key={`tickets-${rewardEvent?.type === "tickets" ? rewardEvent.id : "stable"}`}
      />
      <RewardAnimation event={rewardEvent} />
    </div>
  );
}
