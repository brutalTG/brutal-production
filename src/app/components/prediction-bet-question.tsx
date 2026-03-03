import { useState, useRef, useEffect } from "react";
import { hapticLight, hapticSelection, hapticMedium } from "./haptics";
import { DuotoneCard, CardPill, CardTitle, OptionButton, ActionButton } from "./brutal-ui";

interface PredictionBetQuestionProps {
  actionHint: string;
  text: string;
  optionA: string;
  optionB: string;
  maxTickets?: number;
  onConfirm: (option: string, bet: number) => void;
}

function BetSlider({ value, onChange, max }: { value: number; onChange: (val: number) => void; max: number }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastValueRef = useRef(value);

  const handleInteract = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const thumbHalfPx = 24;
    const usableWidth = rect.width - thumbHalfPx * 2;
    const x = Math.max(0, Math.min(clientX - rect.left - thumbHalfPx, usableWidth));
    const percent = x / usableWidth;
    const newValue = Math.max(10, Math.round(percent * max));
    // Haptic on every 10-unit change for toothed feel
    if (Math.abs(newValue - lastValueRef.current) >= 5) {
      hapticSelection();
      lastValueRef.current = newValue;
    }
    onChange(newValue);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleInteract(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handleInteract(e.touches[0].clientX);
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        handleInteract(e.clientX);
      }
    };
    const handleUp = () => setIsDragging(false);
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        e.preventDefault();
        handleInteract(e.touches[0].clientX);
      }
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [isDragging]);

  const percent = max > 0 ? (value / max) * 100 : 0;
  const thumbSize = 48;
  const thumbHalf = thumbSize / 2;
  const trackHeight = 37;
  const dotSize = 7;

  return (
    <div className="w-full relative select-none touch-none">
      {/* Track Container */}
      <div
        ref={trackRef}
        className="relative flex items-center cursor-pointer"
        style={{ height: `${thumbSize + 8}px` }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Track pill with border */}
        <div
          className="absolute left-0 right-0 rounded-full border-2 overflow-hidden"
          style={{ height: `${trackHeight}px`, top: "50%", transform: "translateY(-50%)", borderColor: "var(--dynamic-fg, #fff)" }}
        >
          {/* Dashed center line */}
          <div
            className="absolute top-1/2 -translate-y-1/2"
            style={{
              left: `${dotSize / 2 + 10}px`,
              right: `${dotSize / 2 + 10}px`,
              height: "2px",
              backgroundImage:
                `repeating-linear-gradient(to right, var(--dynamic-fg, #fff) 0, var(--dynamic-fg, #fff) 6px, transparent 6px, transparent 12px)`,
            }}
          />
        </div>

        {/* Left endpoint dot */}
        <div
          className="absolute rounded-full z-[5]"
          style={{
            backgroundColor: "var(--dynamic-fg, #fff)",
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
          }}
        />

        {/* Right endpoint dot */}
        <div
          className="absolute rounded-full z-[5]"
          style={{
            backgroundColor: "var(--dynamic-fg, #fff)",
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
          }}
        />

        {/* Thumb — bullseye */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full border-[2.5px] flex items-center justify-center shadow-lg z-10 transition-transform active:scale-110"
          style={{
            backgroundColor: "var(--dynamic-bg, #000)",
            borderColor: "var(--dynamic-fg, #fff)",
            width: `${thumbSize}px`,
            height: `${thumbSize}px`,
            left: `calc(${thumbHalf}px + ${percent / 100} * (100% - ${thumbSize}px))`,
          }}
        >
          <div className="w-[28px] h-[28px] rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--dynamic-fg, #fff)" }}>
            <div className="w-[16px] h-[16px] rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--dynamic-bg, #000)" }}>
              <div className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: "var(--dynamic-fg, #fff)" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PredictionBetQuestion({
  actionHint,
  text,
  optionA,
  optionB,
  maxTickets = 100,
  onConfirm,
}: PredictionBetQuestionProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [bet, setBet] = useState(10);

  const canConfirm = selected !== null && bet >= 10;

  return (
    <div className="flex flex-col flex-1 gap-5">
      {/* Card */}
      <DuotoneCard hint={actionHint}>
        <CardTitle>{text}</CardTitle>

        {/* Binary Options inside card */}
        <div className="flex gap-3 w-full">
          <OptionButton
            selected={selected === optionA}
            onClick={() => { hapticLight(); setSelected(optionA); }}
            className="!flex-1 !w-auto"
          >
            {optionA}
          </OptionButton>
          <OptionButton
            selected={selected === optionB}
            onClick={() => { hapticLight(); setSelected(optionB); }}
            className="!flex-1 !w-auto"
          >
            {optionB}
          </OptionButton>
        </div>
      </DuotoneCard>

      {/* Bet Section */}
      <div className="flex flex-col items-center gap-2 mt-2">
        <p className="font-['Roboto'] text-[22px] text-center" style={{ color: "var(--dynamic-fg, #fff)" }}>
          Cuantos tickets apostas?
        </p>

        {/* Big number display */}
        <span className="font-['Roboto'] font-semibold text-[42px] leading-none tracking-[-0.42px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
          {bet}
        </span>
      </div>

      {/* Slider */}
      <div className="w-full px-1">
        <BetSlider value={bet} onChange={setBet} max={maxTickets} />
      </div>

      {/* Apostar button */}
      <ActionButton
        label="Apostar"
        disabled={!canConfirm}
        onClick={() => canConfirm && onConfirm(selected!, bet)}
        variant="pill"
        className="mt-2"
      />
    </div>
  );
}