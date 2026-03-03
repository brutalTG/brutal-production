import { useState, useRef, useEffect } from "react";
import { hapticSelection, hapticMedium } from "./haptics";
import { DuotoneCard, CardTitle, ActionButton } from "./brutal-ui";

interface SliderEmojiQuestionProps {
  text: string;
  min?: number;
  max?: number;
  labelLeft: string;
  labelRight: string;
  onConfirm: (value: number) => void;
}

/**
 * slider_emoji — Emoji-labeled slider without visible numbers.
 *
 * Same mechanic as `slider` but extremes are large emojis and
 * no numeric value is shown. The user slides between two feelings.
 * Produces the same data as `slider`.
 */
export function SliderEmojiQuestion({
  text,
  min = 1,
  max = 5,
  labelLeft,
  labelRight,
  onConfirm,
}: SliderEmojiQuestionProps) {
  const range = max - min;
  const [value, setValue] = useState(Math.round(range / 2) + min);

  return (
    <div className="flex flex-col flex-1 gap-8">
      {/* Card */}
      <DuotoneCard className="min-h-[280px] pb-10">
        <CardTitle>{text}</CardTitle>
      </DuotoneCard>

      {/* Emoji Slider */}
      <EmojiSlider
        value={value}
        onChange={setValue}
        min={min}
        max={max}
        emojiLeft={labelLeft}
        emojiRight={labelRight}
      />

      {/* Confirmar */}
      <ActionButton
        label="Confirmar"
        onClick={() => onConfirm(value)}
        variant="pill"
      />
    </div>
  );
}

// ── Emoji Slider ──────────────────────────────────────────

function EmojiSlider({
  value,
  onChange,
  min,
  max,
  emojiLeft,
  emojiRight,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  emojiLeft: string;
  emojiRight: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastValueRef = useRef(value);

  const handleInteract = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const thumbHalf = 24;
    const usable = rect.width - thumbHalf * 2;
    const x = Math.max(0, Math.min(clientX - rect.left - thumbHalf, usable));
    const pct = x / usable;
    const newVal = Math.round(pct * (max - min)) + min;
    if (newVal !== lastValueRef.current) {
      hapticSelection();
      lastValueRef.current = newVal;
    }
    onChange(newVal);
  };

  const startDrag = (clientX: number) => {
    setIsDragging(true);
    handleInteract(clientX);
  };

  useEffect(() => {
    const move = (e: MouseEvent) => { if (isDragging) { e.preventDefault(); handleInteract(e.clientX); } };
    const up = () => setIsDragging(false);
    const touchMove = (e: TouchEvent) => { if (isDragging) { e.preventDefault(); handleInteract(e.touches[0].clientX); } };

    if (isDragging) {
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      window.addEventListener("touchmove", touchMove, { passive: false });
      window.addEventListener("touchend", up);
    }
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("touchend", up);
    };
  }, [isDragging]);

  const pct = ((value - min) / (max - min)) * 100;
  const thumbSize = 48;

  return (
    <div className="w-full select-none touch-none">
      {/* Emoji labels + track */}
      <div className="flex items-center gap-3">
        {/* Left emoji */}
        <span className="select-none shrink-0" style={{ fontSize: 40, lineHeight: 1 }}>
          {emojiLeft}
        </span>

        {/* Track */}
        <div
          ref={trackRef}
          className="relative flex-1 cursor-pointer"
          style={{ height: `${thumbSize + 4}px` }}
          onMouseDown={(e) => startDrag(e.clientX)}
          onTouchStart={(e) => startDrag(e.touches[0].clientX)}
        >
          {/* Track pill */}
          <div
            className="absolute left-0 right-0 rounded-full border-2 overflow-hidden"
            style={{ height: 34, top: "50%", transform: "translateY(-50%)", borderColor: "var(--dynamic-fg, #fff)" }}
          >
            {/* Gradient fill — subtle warm-to-cool */}
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(to right, rgba(255,255,255,0.05), rgba(255,255,255,0.15))",
              }}
            />
            {/* Dashed center line */}
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                left: 14,
                right: 14,
                height: 2,
                backgroundImage:
                  `repeating-linear-gradient(to right, var(--dynamic-fg, #fff) 0, var(--dynamic-fg, #fff) 6px, transparent 6px, transparent 12px)`,
              }}
            />
          </div>

          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full border-[2.5px] flex items-center justify-center shadow-lg z-10 transition-transform active:scale-110"
            style={{
              backgroundColor: "var(--dynamic-bg, #000)",
              borderColor: "var(--dynamic-fg, #fff)",
              width: thumbSize,
              height: thumbSize,
              left: `calc(${thumbSize / 2}px + ${pct / 100} * (100% - ${thumbSize}px))`,
            }}
          >
            <div className="w-[28px] h-[28px] rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--dynamic-fg, #fff)" }}>
              <div className="w-[16px] h-[16px] rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--dynamic-bg, #000)" }}>
                <div className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: "var(--dynamic-fg, #fff)" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Right emoji */}
        <span className="select-none shrink-0" style={{ fontSize: 40, lineHeight: 1 }}>
          {emojiRight}
        </span>
      </div>
    </div>
  );
}