import { useState, useEffect, useRef, useCallback } from "react";
import { hapticLight, hapticRigid, hapticSelection } from "./haptics";
import type { RafagaBurstQuestion as RafagaBurstQuestionType, RafagaBurstItem } from "./drop-types";

interface RafagaBurstQuestionProps extends RafagaBurstQuestionType {
  onComplete: (answers: (string | number | null)[]) => void;
}

// Frenetic blink: 7 rapid opacity toggles (100→0→100→0→100→0→100)
const BLINK_STEPS = [1, 0, 1, 0, 1, 0, 1];
const BLINK_STEP_MS = 45;
// Content swaps at step 3 (opacity 0)
const BLINK_SWAP_AT = 3;
// Delay after selecting before blink/complete (ms) — lets user see filled button
const POST_SELECT_DELAY = 250;

export function RafagaBurstQuestion({
  preScreen,
  items,
  secondsPerItem = 3,
  onComplete,
}: RafagaBurstQuestionProps) {
  const [phase, setPhase] = useState<"pre" | "countdown" | "playing">("pre");
  const [countdownValue, setCountdownValue] = useState(3);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [blinkOpacity, setBlinkOpacity] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const [subProgress, setSubProgress] = useState(100);
  const [selectedValue, setSelectedValue] = useState<string | number | null>(null);

  // Refs to avoid stale closures
  const currentIdxRef = useRef(0);
  const answersRef = useRef<(string | number | null)[]>(new Array(items.length).fill(null));
  const completedRef = useRef(false);
  const transitioningRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const total = items.length;
  const item = items[currentIdx];

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // === PHASE 1: Pre-screen ===
  useEffect(() => {
    if (phase !== "pre") return;
    const duration = preScreen.durationMs ?? 2500;
    const timer = setTimeout(() => setPhase("countdown"), duration);
    return () => clearTimeout(timer);
  }, [phase, preScreen.durationMs]);

  // === PHASE 2: Countdown (3-2-1) ===
  useEffect(() => {
    if (phase !== "countdown") return;
    
    const interval = setInterval(() => {
      setCountdownValue((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setPhase("playing");
          return 0;
        }
        hapticRigid();
        return prev - 1;
      });
    }, 700);

    return () => clearInterval(interval);
  }, [phase]);

  // === PHASE 3: Playing ===
  const doComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setTimeout(() => {
      onCompleteRef.current([...answersRef.current]);
    }, 300);
  }, []);

  const runBlinkAndAdvance = useCallback(
    (nextIdx: number) => {
      if (transitioningRef.current || completedRef.current) return;
      transitioningRef.current = true;
      setTransitioning(true);
      clearTimer();
      hapticRigid();

      let step = 0;
      const interval = setInterval(() => {
        if (step < BLINK_STEPS.length) {
          setBlinkOpacity(BLINK_STEPS[step]);
          if (step === BLINK_SWAP_AT) {
            currentIdxRef.current = nextIdx;
            setCurrentIdx(nextIdx);
            setSelectedValue(null);
          }
          step++;
        } else {
          clearInterval(interval);
          setBlinkOpacity(1);
          transitioningRef.current = false;
          setTransitioning(false);
        }
      }, BLINK_STEP_MS);
    },
    []
  );

  const advanceOrComplete = useCallback(() => {
    if (completedRef.current || transitioningRef.current) return;
    const idx = currentIdxRef.current;

    if (idx >= total - 1) {
      doComplete();
    } else {
      runBlinkAndAdvance(idx + 1);
    }
  }, [total, doComplete, runBlinkAndAdvance]);

  // Auto-advance timer — only runs during "playing" phase
  useEffect(() => {
    if (phase !== "playing" || completedRef.current || transitioning) return;

    timerRef.current = setTimeout(() => {
      advanceOrComplete();
    }, secondsPerItem * 1000);

    return clearTimer;
  }, [phase, currentIdx, secondsPerItem, advanceOrComplete, transitioning]);

  const handleSelect = useCallback(
    (value: string | number) => {
      if (transitioningRef.current || completedRef.current) return;
      clearTimer();
      hapticLight();

      answersRef.current[currentIdxRef.current] = value;
      setSelectedValue(value);

      const idx = currentIdxRef.current;
      const isLast = idx >= total - 1;

      setTimeout(() => {
        if (isLast) {
          doComplete();
        } else {
          runBlinkAndAdvance(idx + 1);
        }
      }, POST_SELECT_DELAY);
    },
    [total, doComplete, runBlinkAndAdvance]
  );

  // Sub-timer progress bar — only runs during "playing" phase
  useEffect(() => {
    if (phase !== "playing" || completedRef.current || transitioning) return;
    setSubProgress(100);
    const start = Date.now();
    const durationMs = secondsPerItem * 1000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, durationMs - elapsed);
      setSubProgress((remaining / durationMs) * 100);
      if (remaining <= 0) clearInterval(interval);
    }, 30);

    return () => clearInterval(interval);
  }, [phase, currentIdx, secondsPerItem, transitioning]);

  // === RENDER ===

  // Phase 1: Pre-screen
  if (phase === "pre") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-5">
        <div
          className="w-full max-w-md rounded-2xl flex flex-col items-center justify-center px-6 py-12 shadow-lg"
          style={{ backgroundColor: "var(--dynamic-fg, #fff)" }}
        >
          <h1
            className="font-['Roboto'] font-bold text-[32px] text-center leading-tight mb-3"
            style={{ color: "var(--dynamic-bg, #000)" }}
          >
            {preScreen.title}
          </h1>
          {preScreen.subtitle && (
            <p
              className="font-['Roboto'] text-[16px] text-center opacity-70"
              style={{ color: "var(--dynamic-bg, #000)" }}
            >
              {preScreen.subtitle}
            </p>
          )}
          <div className="mt-8 flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: "var(--dynamic-bg, #000)" }}
            />
            <span
              className="font-['Fira_Code'] text-[13px] font-medium"
              style={{ color: "var(--dynamic-bg, #000)" }}
            >
              Preparate...
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Phase 2: Countdown (3-2-1)
  if (phase === "countdown") {
    return (
      <div
        className="flex items-center justify-center h-dvh bg-[#000] overflow-hidden"
        style={{
          paddingTop: "var(--tg-safe-top, 0px)",
          paddingBottom: "var(--tg-safe-bottom, 0px)",
        }}
      >
        <span
          className="font-['Roboto'] font-bold text-white text-[128px] text-center leading-none select-none"
          style={{
            transform: `scale(1)`,
            transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
            opacity: countdownValue >= 0 ? 1 : 0,
          }}
        >
          {countdownValue}
        </span>
      </div>
    );
  }

  // Phase 3: Playing
  return (
    <div className="flex flex-col flex-1">
      <div
        className="w-full rounded-2xl flex flex-col px-5 pt-6 pb-6 shadow-lg mx-auto overflow-hidden"
        style={{ backgroundColor: "var(--dynamic-fg, #fff)" }}
      >
        {/* Counter pill */}
        <span
          className="font-['Roboto'] font-semibold text-[14px] tracking-[-0.14px] mb-3 text-center"
          style={{ color: "var(--dynamic-bg, #000)" }}
        >
          {currentIdx + 1} / {total}
        </span>

        {/* Content with blink transition */}
        <div style={{ opacity: blinkOpacity }}>
          <RafagaBurstItemRenderer
            item={item}
            selectedValue={selectedValue}
            onSelect={handleSelect}
          />
        </div>

        {/* Dot indicators */}
        <div className="flex items-center gap-[6px] mt-5 justify-center">
          {items.map((_, i) => (
            <div key={i}>
              {i <= currentIdx ? (
                <div
                  className="w-[11px] h-[11px] rounded-full"
                  style={{ backgroundColor: "var(--dynamic-bg, #000)" }}
                />
              ) : (
                <div
                  className="w-[11px] h-[11px] rounded-full border-2 bg-transparent"
                  style={{ borderColor: "var(--dynamic-bg, #000)" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Sub-timer bar */}
        <div
          className="w-full h-[3px] rounded-full mt-4 overflow-hidden"
          style={{
            backgroundColor: "color-mix(in srgb, var(--dynamic-bg, #000) 15%, transparent)",
          }}
        >
          <div
            className="h-full rounded-full"
            style={{
              backgroundColor: "var(--dynamic-bg, #000)",
              width: `${subProgress}%`,
              transition: "width 0.03s linear",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// === SUB-COMPONENTS ===

interface RafagaBurstItemRendererProps {
  item: RafagaBurstItem;
  selectedValue: string | number | null;
  onSelect: (value: string | number) => void;
}

function RafagaBurstItemRenderer({ item, selectedValue, onSelect }: RafagaBurstItemRendererProps) {
  const { trigger, interaction } = item;

  return (
    <div className="flex flex-col">
      {/* Trigger */}
      <TriggerRenderer trigger={trigger} />

      {/* Interaction */}
      <div className="mt-6">
        <InteractionRenderer
          interaction={interaction}
          selectedValue={selectedValue}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}

interface TriggerRendererProps {
  trigger: RafagaBurstItem["trigger"];
}

function TriggerRenderer({ trigger }: TriggerRendererProps) {
  if (trigger.type === "text") {
    return (
      <h2
        className="font-['Roboto'] font-bold text-[28px] text-center leading-tight"
        style={{ color: "var(--dynamic-bg, #000)" }}
      >
        {trigger.text}
      </h2>
    );
  }

  if (trigger.type === "image") {
    return (
      <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-black/5">
        <img
          src={trigger.imageUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (trigger.type === "image_text") {
    return (
      <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden">
        <img
          src={trigger.imageUrl}
          alt=""
          className="w-full h-full object-cover"
        />
        {/* Text overlay with gradient background */}
        <div className="absolute inset-0 flex items-end">
          <div
            className="w-full p-4"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
            }}
          >
            <h2 className="font-['Roboto'] font-bold text-[24px] text-white leading-tight">
              {trigger.text}
            </h2>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

interface InteractionRendererProps {
  interaction: RafagaBurstItem["interaction"];
  selectedValue: string | number | null;
  onSelect: (value: string | number) => void;
}

function InteractionRenderer({ interaction, selectedValue, onSelect }: InteractionRendererProps) {
  if (interaction.type === "emoji_binary") {
    const { emojiA = "👍", emojiB = "👎" } = interaction;
    const isASelected = selectedValue === emojiA;
    const isBSelected = selectedValue === emojiB;

    return (
      <div className="flex gap-3 w-full">
        <button
          onClick={() => onSelect(emojiA)}
          className="flex-1 h-[80px] rounded-xl flex items-center justify-center select-none active:scale-[0.98] transition-all duration-150 border-2"
          style={{
            borderColor: "var(--dynamic-bg, #000)",
            backgroundColor: isASelected ? "var(--dynamic-bg, #000)" : "transparent",
          }}
        >
          <span className="text-[42px] leading-none">{emojiA}</span>
        </button>
        <button
          onClick={() => onSelect(emojiB)}
          className="flex-1 h-[80px] rounded-xl flex items-center justify-center select-none active:scale-[0.98] transition-all duration-150 border-2"
          style={{
            borderColor: "var(--dynamic-bg, #000)",
            backgroundColor: isBSelected ? "var(--dynamic-bg, #000)" : "transparent",
          }}
        >
          <span className="text-[42px] leading-none">{emojiB}</span>
        </button>
      </div>
    );
  }

  if (interaction.type === "button_binary") {
    const { buttonA = "A", buttonB = "B" } = interaction;
    const isASelected = selectedValue === buttonA;
    const isBSelected = selectedValue === buttonB;

    return (
      <div className="flex gap-3 w-full">
        <button
          onClick={() => onSelect(buttonA)}
          className="flex-1 h-[60px] rounded-xl flex items-center justify-center select-none active:scale-[0.98] transition-all duration-150 border-2"
          style={{
            borderColor: "var(--dynamic-bg, #000)",
            backgroundColor: isASelected ? "var(--dynamic-bg, #000)" : "transparent",
            color: isASelected ? "var(--dynamic-fg, #fff)" : "var(--dynamic-bg, #000)",
          }}
        >
          <span className="font-['Roboto'] font-semibold text-[18px]">
            {buttonA}
          </span>
        </button>
        <button
          onClick={() => onSelect(buttonB)}
          className="flex-1 h-[60px] rounded-xl flex items-center justify-center select-none active:scale-[0.98] transition-all duration-150 border-2"
          style={{
            borderColor: "var(--dynamic-bg, #000)",
            backgroundColor: isBSelected ? "var(--dynamic-bg, #000)" : "transparent",
            color: isBSelected ? "var(--dynamic-fg, #fff)" : "var(--dynamic-bg, #000)",
          }}
        >
          <span className="font-['Roboto'] font-semibold text-[18px]">
            {buttonB}
          </span>
        </button>
      </div>
    );
  }

  if (interaction.type === "slider") {
    const config = interaction.sliderConfig ?? {
      min: 0,
      max: 10,
      labelLeft: "No me gusta",
      labelRight: "Me gusta",
    };

    return (
      <SliderInteraction
        config={config}
        selectedValue={typeof selectedValue === "number" ? selectedValue : null}
        onSelect={onSelect}
      />
    );
  }

  return null;
}

interface SliderInteractionProps {
  config: { min: number; max: number; labelLeft: string; labelRight: string };
  selectedValue: number | null;
  onSelect: (value: number) => void;
}

function SliderInteraction({ config, selectedValue, onSelect }: SliderInteractionProps) {
  const { min, max, labelLeft, labelRight } = config;
  const range = max - min;
  const [value, setValue] = useState(selectedValue ?? Math.round(range / 2) + min);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastValueRef = useRef(value);

  // Update parent on value change
  useEffect(() => {
    if (value !== selectedValue) {
      onSelect(value);
    }
  }, [value, selectedValue, onSelect]);

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
    setValue(newValue);
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
    <div className="w-full select-none touch-none">
      {/* Value Display */}
      <div className="text-center mb-3">
        <span
          className="font-['Roboto'] font-semibold text-[36px] leading-none"
          style={{ color: "var(--dynamic-bg, #000)" }}
        >
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
          style={{
            height: `${trackHeight}px`,
            top: "50%",
            transform: "translateY(-50%)",
            borderColor: "var(--dynamic-bg, #000)",
          }}
        >
          {/* Dashed center line */}
          <div
            className="absolute top-1/2 -translate-y-1/2"
            style={{
              left: `${dotSize / 2 + 10}px`,
              right: `${dotSize / 2 + 10}px`,
              height: "2px",
              backgroundImage: `repeating-linear-gradient(to right, var(--dynamic-bg, #000) 0, var(--dynamic-bg, #000) 6px, transparent 6px, transparent 12px)`,
            }}
          />
        </div>

        {/* Left endpoint dot */}
        <div
          className="absolute rounded-full z-[5]"
          style={{
            backgroundColor: "var(--dynamic-bg, #000)",
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
            backgroundColor: "var(--dynamic-bg, #000)",
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
            backgroundColor: "var(--dynamic-fg, #fff)",
            borderColor: "var(--dynamic-bg, #000)",
            width: `${thumbSize}px`,
            height: `${thumbSize}px`,
            left: `calc(${thumbHalf}px + ${percent / 100} * (100% - ${thumbSize}px))`,
          }}
        >
          <div
            className="w-[28px] h-[28px] rounded-full flex items-center justify-center"
            style={{ backgroundColor: "var(--dynamic-bg, #000)" }}
          >
            <div
              className="w-[16px] h-[16px] rounded-full flex items-center justify-center"
              style={{ backgroundColor: "var(--dynamic-fg, #fff)" }}
            >
              <div
                className="w-[7px] h-[7px] rounded-full"
                style={{ backgroundColor: "var(--dynamic-bg, #000)" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Labels */}
      <div
        className="flex justify-between mt-1.5 font-['Roboto'] font-medium text-xs px-1 opacity-80"
        style={{ color: "var(--dynamic-bg, #000)" }}
      >
        <span>{labelLeft}</span>
        <span>{labelRight}</span>
      </div>
    </div>
  );
}
