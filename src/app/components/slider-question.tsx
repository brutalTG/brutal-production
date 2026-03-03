import { useState, useRef, useEffect } from "react";
import { hapticSelection, hapticMedium } from "./haptics";
import { DuotoneCard, CardTitle, ActionButton } from "./brutal-ui";

interface SliderQuestionProps {
  actionHint: string;
  text: string;
  min?: number;
  max?: number;
  labelLeft?: string;
  labelRight?: string;
  onConfirm: (value: number) => void;
}

function QuestionSlider({ value, onChange, min = 0, max = 10, labelLeft = "Nada", labelRight = "Totalmente" }: { value: number; onChange: (val: number) => void; min?: number; max?: number; labelLeft?: string; labelRight?: string }) {
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
    const newValue = Math.round(percent * (max - min)) + min;
    if (newValue !== lastValueRef.current) {
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

  const percent = ((value - min) / (max - min)) * 100;
  const thumbSize = 48;
  const thumbHalf = thumbSize / 2;
  const trackHeight = 34;
  const dotSize = 7;

  return (
    <div className="w-full relative select-none touch-none">
      {/* Value Display */}
      <div className="text-center mb-3">
        <span className="font-['Roboto'] font-semibold text-[42px] leading-none drop-shadow-sm" style={{ color: "var(--dynamic-fg, #fff)" }}>
          {value}
        </span>
      </div>

      {/* Track Container */}
      <div
        ref={trackRef}
        className="relative flex items-center cursor-pointer"
        style={{ height: `${thumbSize + 4}px` }}
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

        {/* Thumb - bullseye */}
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

      {/* Labels */}
      <div className="flex justify-between mt-1.5 font-['Roboto'] font-medium text-xs px-1 opacity-90" style={{ color: "var(--dynamic-fg, #fff)" }}>
        <span>{labelLeft}</span>
        <span>{labelRight}</span>
      </div>
    </div>
  );
}

export function SliderQuestion({
  actionHint,
  text,
  min = 0,
  max = 10,
  labelLeft = "Nada",
  labelRight = "Totalmente",
  onConfirm,
}: SliderQuestionProps) {
  const range = max - min;
  const [sliderValue, setSliderValue] = useState(Math.round(range / 2) + min);

  return (
    <div className="flex flex-col flex-1 gap-8">
      {/* Card */}
      <DuotoneCard hint={actionHint} className="min-h-[300px] pb-10">
        <CardTitle>{text}</CardTitle>
      </DuotoneCard>

      {/* Slider */}
      <div className="w-full">
        <QuestionSlider value={sliderValue} onChange={setSliderValue} min={min} max={max} labelLeft={labelLeft} labelRight={labelRight} />
      </div>

      {/* Confirmar Button */}
      <ActionButton
        label="Confirmar"
        onClick={() => onConfirm(sliderValue)}
        variant="pill"
      />
    </div>
  );
}