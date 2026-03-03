import { useState, useRef, useEffect } from "react";
import { hapticLight, hapticSelection, hapticMedium } from "./haptics";

interface MediaReactionQuestionProps {
  imageUrl: string;
  text?: string;
  mode: "emoji" | "slider";
  // Emoji mode
  options?: string[];
  onSelectEmoji?: (option: string) => void;
  // Slider mode
  labelLeft?: string;
  labelRight?: string;
  min?: number;
  max?: number;
  onConfirmSlider?: (value: number) => void;
}

/**
 * media_reaction — Fullscreen image background with overlay interaction.
 *
 * The image fills the screen with a dark gradient overlay.
 * Interaction controls float in the thumb zone (center-lower).
 *
 * Mode "emoji": Two large emoji buttons over the image.
 * Mode "slider": Emoji slider over the image + confirm button.
 *
 * Produces choice data (emoji mode) or slider data (slider mode).
 */
export function MediaReactionQuestion({
  imageUrl,
  text,
  mode,
  options = [],
  onSelectEmoji,
  labelLeft = "🫣",
  labelRight = "😏",
  min = 1,
  max = 5,
  onConfirmSlider,
}: MediaReactionQuestionProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Background image */}
      <img
        src={imageUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
        style={{ opacity: imageLoaded ? 1 : 0 }}
        onLoad={() => setImageLoaded(true)}
      />

      {/* Dark gradient overlay — heavier at bottom for readability */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.75) 100%)",
        }}
      />

      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col items-center">
        {/* Top spacer */}
        <div className="flex-[2]" />

        {/* Optional text overlay */}
        {text && (
          <h2
            className="font-['Roboto'] font-bold text-[#fff] text-center leading-tight px-6 max-w-[340px] mb-8 drop-shadow-lg"
            style={{ fontSize: text.length > 40 ? "20px" : "26px" }}
          >
            {text}
          </h2>
        )}

        {/* Interaction zone — thumb zone */}
        {mode === "emoji" && options.length >= 2 && onSelectEmoji && (
          <EmojiOverlay options={options} onSelect={onSelectEmoji} />
        )}

        {mode === "slider" && onConfirmSlider && (
          <SliderOverlay
            labelLeft={labelLeft}
            labelRight={labelRight}
            min={min}
            max={max}
            onConfirm={onConfirmSlider}
          />
        )}

        {/* Bottom spacer — larger to bias upward */}
        <div className="flex-[3]" />
      </div>
    </div>
  );
}

// ── Emoji Overlay ─────────────────────────────────────────

function EmojiOverlay({
  options,
  onSelect,
}: {
  options: string[];
  onSelect: (option: string) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    hapticLight();
    setTimeout(() => onSelect(options[idx]), 350);
  };

  return (
    <div className="flex items-center justify-center gap-8">
      {options.map((emoji, i) => {
        const isSelected = selected === i;
        const isDimmed = selected !== null && !isSelected;

        return (
          <button
            key={i}
            onClick={() => handleSelect(i)}
            className="flex items-center justify-center select-none active:scale-110"
            style={{
              transform: isSelected ? "scale(1.2)" : isDimmed ? "scale(0.85)" : "scale(1)",
              opacity: isDimmed ? 0.25 : 1,
              transition: "transform 0.2s ease, opacity 0.2s ease",
              filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))",
            }}
          >
            <span className="select-none" style={{ fontSize: 80, lineHeight: 1 }}>
              {emoji}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Slider Overlay ────────────────────────────────────────

function SliderOverlay({
  labelLeft,
  labelRight,
  min,
  max,
  onConfirm,
}: {
  labelLeft: string;
  labelRight: string;
  min: number;
  max: number;
  onConfirm: (value: number) => void;
}) {
  const range = max - min;
  const [value, setValue] = useState(Math.round(range / 2) + min);
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
    setValue(newVal);
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
    <div className="w-full px-6 flex flex-col items-center gap-6 max-w-[380px]">
      {/* Slider with glass morphism */}
      <div
        className="w-full rounded-full px-3 py-3"
        style={{
          backgroundColor: "rgba(0,0,0,0.40)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="select-none shrink-0 drop-shadow-md" style={{ fontSize: 36, lineHeight: 1 }}>
            {labelLeft}
          </span>

          <div
            ref={trackRef}
            className="relative flex-1 select-none touch-none cursor-pointer"
            style={{ height: `${thumbSize + 4}px` }}
            onMouseDown={(e) => startDrag(e.clientX)}
            onTouchStart={(e) => startDrag(e.touches[0].clientX)}
          >
            {/* Track */}
            <div
              className="absolute left-0 right-0 rounded-full border-2 border-[#fff]/40 overflow-hidden"
              style={{ height: 30, top: "50%", transform: "translateY(-50%)" }}
            >
              <div
                className="absolute top-1/2 -translate-y-1/2"
                style={{
                  left: 10,
                  right: 10,
                  height: 2,
                  backgroundImage:
                    "repeating-linear-gradient(to right, rgba(255,255,255,0.5) 0, rgba(255,255,255,0.5) 6px, transparent 6px, transparent 12px)",
                }}
              />
            </div>

            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-[#000] border-[2.5px] border-[#fff] flex items-center justify-center shadow-lg z-10"
              style={{
                width: thumbSize,
                height: thumbSize,
                left: `calc(${thumbSize / 2}px + ${pct / 100} * (100% - ${thumbSize}px))`,
              }}
            >
              <div className="w-[28px] h-[28px] rounded-full bg-[#fff] flex items-center justify-center">
                <div className="w-[16px] h-[16px] rounded-full bg-[#000] flex items-center justify-center">
                  <div className="w-[7px] h-[7px] rounded-full bg-[#fff]" />
                </div>
              </div>
            </div>
          </div>

          <span className="select-none shrink-0 drop-shadow-md" style={{ fontSize: 36, lineHeight: 1 }}>
            {labelRight}
          </span>
        </div>
      </div>

      {/* Confirm button — glass */}
      <button
        onClick={() => { hapticMedium(); onConfirm(value); }}
        className="h-[52px] px-10 rounded-full flex items-center justify-center select-none active:scale-[0.98] transition-all duration-200"
        style={{
          backgroundColor: "rgba(255,255,255,0.90)",
        }}
      >
        <span className="font-['Roboto'] font-semibold text-[#000] text-[17px]">
          Confirmar
        </span>
      </button>
    </div>
  );
}