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

const isVideoUrl = (url?: string) => {
  if (!url) return false;
  return url.match(/\.(mp4|webm|mov|ogg)($|\?)/i) !== null;
};

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

  // Defensive reset on mount — ensures fresh state if React reuses the fiber
  useEffect(() => {
    currentIdxRef.current = 0;
    answersRef.current = new Array(items.length).fill(null);
    completedRef.current = false;
    transitioningRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPhase("pre");
    setCountdownValue(3);
    setCurrentIdx(0);
    setBlinkOpacity(1);
    setTransitioning(false);
    setSubProgress(100);
    setSelectedValue(null);
  }, [items]);

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
    (nextIdx: number, isCompleting = false) => {
      if (transitioningRef.current || (completedRef.current && !isCompleting)) return;
      transitioningRef.current = true;
      setTransitioning(true);
      clearTimer();
      hapticRigid();

      let step = 0;
      const interval = setInterval(() => {
        if (step < BLINK_STEPS.length) {
          setBlinkOpacity(BLINK_STEPS[step]);
          if (step === BLINK_SWAP_AT) {
            if (isCompleting) {
              doComplete();
            } else {
              currentIdxRef.current = nextIdx;
              setCurrentIdx(nextIdx);
              setSelectedValue(null);
            }
          }
          step++;
        } else {
          clearInterval(interval);
          setBlinkOpacity(1);
          if (!isCompleting) {
            transitioningRef.current = false;
            setTransitioning(false);
          }
        }
      }, BLINK_STEP_MS);
    },
    [doComplete]
  );

  const advanceOrComplete = useCallback(() => {
    if (completedRef.current || transitioningRef.current) return;
    const idx = currentIdxRef.current;

    if (idx >= total - 1) {
      runBlinkAndAdvance(idx, true);
    } else {
      runBlinkAndAdvance(idx + 1);
    }
  }, [total, runBlinkAndAdvance]);

  // Auto-advance timer — only runs during "playing" phase
  // For slider interactions, we pause the auto-timer (user must press Confirmar)
  const isSlider = item?.interaction?.type === "slider";
  useEffect(() => {
    if (phase !== "playing" || completedRef.current || transitioning || isSlider) return;

    timerRef.current = setTimeout(() => {
      advanceOrComplete();
    }, secondsPerItem * 1000);

    return clearTimer;
  }, [phase, currentIdx, secondsPerItem, advanceOrComplete, transitioning, isSlider]);

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
          runBlinkAndAdvance(idx, true);
        } else {
          runBlinkAndAdvance(idx + 1);
        }
      }, POST_SELECT_DELAY);
    },
    [total, runBlinkAndAdvance]
  );

  // Sub-timer progress bar — only runs during "playing" phase (not for slider)
  useEffect(() => {
    if (phase !== "playing" || completedRef.current || transitioning || isSlider) return;
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
  }, [phase, currentIdx, secondsPerItem, transitioning, isSlider]);

  // === RENDER ===

  // Phase 1: Pre-screen — fullscreen black, typewriter subtitle
  if (phase === "pre") {
    return <PreScreen title={preScreen.title} subtitle={preScreen.subtitle} />;
  }

  // Phase 2: Countdown (3-2-1)
  if (phase === "countdown") {
    return (
      <div
        className="flex items-center justify-center h-dvh overflow-hidden"
        style={{
          backgroundColor: "var(--dynamic-bg, #000)",
          paddingTop: "var(--tg-safe-top, 0px)",
          paddingBottom: "var(--tg-safe-bottom, 0px)",
        }}
      >
        <span
          className="font-['Roboto'] font-bold text-[128px] text-center leading-none select-none"
          style={{
            color: "var(--dynamic-fg, #fff)",
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
  const hasImage = item.trigger.type === "image" || item.trigger.type === "image_text";

  if (hasImage) {
    // === IMAGE LAYOUT: fullscreen image bg, gradient, lower-third interaction ===
    return (
      <div className="relative h-dvh overflow-hidden" style={{ backgroundColor: transitioning ? "var(--dynamic-fg, #fff)" : "var(--dynamic-bg, #000)" }}>
        {/* Fullscreen image background */}
        {isVideoUrl(item.trigger.imageUrl) ? (
          <video
            src={item.trigger.imageUrl}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: blinkOpacity }}
          />
        ) : (
          <img
            src={item.trigger.imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: blinkOpacity }}
          />
        )}

        {/* Bottom gradient overlay */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{
            height: "300px",
            background: "linear-gradient(to top, var(--dynamic-bg, rgba(0,0,0,1)) 0%, transparent 100%)",
            opacity: blinkOpacity
          }}
        />

        {/* Dot indicators (overlaid near top of image) */}
        <div className="absolute top-0 left-0 right-0 z-20 flex flex-col items-center pt-4"
          style={{ paddingTop: "calc(var(--tg-safe-top, 0px) + 16px)", opacity: blinkOpacity }}
        >
          <div className="flex items-center gap-[6px]">
            {items.map((_, i) => (
              <div key={i}>
                {i <= currentIdx ? (
                  <div className="w-[11px] h-[11px] rounded-full" style={{ backgroundColor: "var(--dynamic-fg, #fff)" }} />
                ) : (
                  <div className="w-[11px] h-[11px] rounded-full border-2 bg-transparent" style={{ borderColor: "var(--dynamic-fg, #fff)" }} />
                )}
              </div>
            ))}
          </div>

          {/* Sub-timer bar */}
          {!isSlider && (
            <div className="w-[80%] h-[3px] rounded-full mt-3 overflow-hidden relative">
              <div className="absolute inset-0 opacity-20" style={{ backgroundColor: "var(--dynamic-fg, #fff)" }} />
              <div
                className="h-full rounded-full relative z-10"
                style={{ backgroundColor: "var(--dynamic-fg, #fff)", width: `${subProgress}%`, transition: "width 0.03s linear" }}
              />
            </div>
          )}
        </div>

        {/* Lower third interaction area */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-6 flex flex-col items-center"
          style={{ paddingBottom: "calc(var(--tg-safe-bottom, 0px) + 24px)" }}
        >
          <div className="w-full" style={{ opacity: blinkOpacity }}>
            {/* image_text overlay label */}
            {item.trigger.type === "image_text" && item.trigger.text && (
              <p className="font-['Roboto'] font-bold text-[31px] text-center leading-tight mb-5" style={{ color: "var(--dynamic-fg, #fff)" }}>
                {item.trigger.text}
              </p>
            )}

            <InteractionRenderer
              interaction={item.interaction}
              selectedValue={selectedValue}
              onSelect={handleSelect}
              variant="image"
            />
          </div>
        </div>
      </div>
    );
  }

  // === TEXT LAYOUT: black bg, centered text, interaction below ===
  return (
    <div className="relative h-dvh overflow-hidden flex flex-col"
      style={{
        backgroundColor: transitioning ? "var(--dynamic-fg, #fff)" : "var(--dynamic-bg, #000)",
        paddingTop: "var(--tg-safe-top, 0px)",
        paddingBottom: "var(--tg-safe-bottom, 0px)",
      }}
    >
      {/* Dot indicators at top */}
      <div className="flex flex-col items-center pt-4" style={{ opacity: blinkOpacity }}>
        <div className="flex items-center gap-[6px]">
          {items.map((_, i) => (
            <div key={i}>
              {i <= currentIdx ? (
                <div className="w-[11px] h-[11px] rounded-full" style={{ backgroundColor: "var(--dynamic-fg, #fff)" }} />
              ) : (
                <div className="w-[11px] h-[11px] rounded-full border-2 bg-transparent" style={{ borderColor: "var(--dynamic-fg, #fff)" }} />
              )}
            </div>
          ))}
        </div>
        {!isSlider && (
          <div className="w-[80%] h-[3px] rounded-full mt-3 overflow-hidden relative">
            <div className="absolute inset-0 opacity-20" style={{ backgroundColor: "var(--dynamic-fg, #fff)" }} />
            <div
              className="h-full rounded-full relative z-10"
              style={{ backgroundColor: "var(--dynamic-fg, #fff)", width: `${subProgress}%`, transition: "width 0.03s linear" }}
            />
          </div>
        )}
      </div>

      {/* Center: text + interaction */}
      <div className="flex-1 flex flex-col items-center justify-center px-6" style={{ opacity: blinkOpacity }}>
        {/* Text trigger */}
        <h2 className="font-['Roboto'] font-bold text-[39px] text-center leading-tight mb-12" style={{ color: "var(--dynamic-fg, #fff)" }}>
          {item.trigger.text}
        </h2>

        {/* Interaction below text */}
        <div className="w-full">
          <InteractionRenderer
            interaction={item.interaction}
            selectedValue={selectedValue}
            onSelect={handleSelect}
            variant="text"
          />
        </div>
      </div>
    </div>
  );
}

// === PRE-SCREEN with typewriter ===

function PreScreen({ title, subtitle }: { title: string; subtitle?: string }) {
  const [displayedSubtitle, setDisplayedSubtitle] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    if (!subtitle) return;
    let i = 0;
    const interval = setInterval(() => {
      if (i < subtitle.length) {
        setDisplayedSubtitle(subtitle.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 40);
    return () => clearInterval(interval);
  }, [subtitle]);

  // Blink cursor
  useEffect(() => {
    const interval = setInterval(() => setShowCursor((v) => !v), 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="flex flex-col items-center justify-center h-dvh overflow-hidden px-8"
      style={{
        backgroundColor: "var(--dynamic-bg, #000)",
        paddingTop: "var(--tg-safe-top, 0px)",
        paddingBottom: "var(--tg-safe-bottom, 0px)",
      }}
    >
      <h1 className="font-['Roboto'] font-bold text-[40px] text-center leading-tight" style={{ color: "var(--dynamic-fg, #fff)" }}>
        {title}
      </h1>
      {subtitle && (
        <p className="font-['Roboto'] font-bold text-[34px] text-center leading-tight mt-4" style={{ color: "var(--dynamic-fg, #fff)" }}>
          {displayedSubtitle}
          <span style={{ opacity: showCursor ? 1 : 0, backgroundColor: "var(--dynamic-fg, #fff)" }} className="inline-block w-[2px] h-[34px] ml-1 align-middle" />
        </p>
      )}
    </div>
  );
}

// === INTERACTION RENDERER ===

interface InteractionRendererProps {
  interaction: RafagaBurstItem["interaction"];
  selectedValue: string | number | null;
  onSelect: (value: string | number) => void;
  variant: "image" | "text"; // determines color scheme
}

function InteractionRenderer({ interaction, selectedValue, onSelect, variant }: InteractionRendererProps) {
  // For image variant: white buttons on dark. For text variant: white on black.
  // Both use white as primary color since bg is always dark/black now.

  if (interaction.type === "emoji_binary") {
    const { emojiA = "👍", emojiB = "👎" } = interaction;
    const isASelected = selectedValue === emojiA;
    const isBSelected = selectedValue === emojiB;
    // Large emojis, no borders, just tappable areas
    const emojiSize = variant === "text" ? "120px" : "106px";

    return (
      <div className="flex justify-center gap-8 w-full">
        <button
          onClick={() => onSelect(emojiA)}
          className="select-none active:scale-[0.92] transition-transform duration-150 p-2"
          style={{ opacity: isBSelected ? 0.4 : 1 }}
        >
          <span style={{ fontSize: emojiSize }} className="leading-none block">{emojiA}</span>
        </button>
        <button
          onClick={() => onSelect(emojiB)}
          className="select-none active:scale-[0.92] transition-transform duration-150 p-2"
          style={{ opacity: isASelected ? 0.4 : 1 }}
        >
          <span style={{ fontSize: emojiSize }} className="leading-none block">{emojiB}</span>
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
          className="flex-1 h-[60px] rounded-[8px] flex items-center justify-center select-none active:scale-[0.97] transition-all duration-150 border-[2px]"
          style={{
            backgroundColor: isASelected ? "var(--dynamic-bg, #000)" : "var(--dynamic-fg, #fff)",
            borderColor: "var(--dynamic-fg, #fff)",
            color: isASelected ? "var(--dynamic-fg, #fff)" : "var(--dynamic-bg, #000)",
          }}
        >
          <span className="font-['Roboto'] font-semibold text-[21px]">
            {buttonA}
          </span>
        </button>
        <button
          onClick={() => onSelect(buttonB)}
          className="flex-1 h-[60px] rounded-[8px] flex items-center justify-center select-none active:scale-[0.97] transition-all duration-150 border-[2px]"
          style={{
            backgroundColor: isBSelected ? "var(--dynamic-bg, #000)" : "var(--dynamic-fg, #fff)",
            borderColor: "var(--dynamic-fg, #fff)",
            color: isBSelected ? "var(--dynamic-fg, #fff)" : "var(--dynamic-bg, #000)",
          }}
        >
          <span className="font-['Roboto'] font-semibold text-[21px]">
            {buttonB}
          </span>
        </button>
      </div>
    );
  }

  if (interaction.type === "slider") {
    const config = interaction.sliderConfig ?? {
      min: 0,
      max: 100,
      labelLeft: "Nah",
      labelRight: "Full",
    };

    return (
      <SliderInteraction
        config={config}
        onConfirm={onSelect}
      />
    );
  }

  return null;
}

// === SLIDER with Confirmar button ===

interface SliderInteractionProps {
  config: { min: number; max: number; labelLeft: string; labelRight: string };
  onConfirm: (value: number) => void;
}

function SliderInteraction({ config, onConfirm }: SliderInteractionProps) {
  const { min, max, labelLeft, labelRight } = config;
  const range = max - min;
  const [value, setValue] = useState(Math.round(range / 2) + min);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastValueRef = useRef(value);

  const handleInteract = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const thumbHalfPx = 24;
    const usableWidth = rect.width - thumbHalfPx * 2;
    const x = Math.max(0, Math.min(clientX - rect.left - thumbHalfPx, usableWidth));
    const pct = x / usableWidth;
    const newValue = Math.round(pct * (max - min)) + min;
    if (newValue !== lastValueRef.current) {
      hapticSelection();
      lastValueRef.current = newValue;
    }
    setValue(newValue);
  }, [max, min]);

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
    const handle
