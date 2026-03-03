import { useState, useEffect, useRef, useCallback } from "react";
import { hapticLight, hapticRigid } from "./haptics";

export interface RafagaItem {
  text: string;
  optionA: string;
  optionB: string;
}

interface RafagaQuestionProps {
  prompt: string;
  promptBold: string;
  items: RafagaItem[];
  secondsPerItem?: number;
  onComplete: (answers: (string | null)[]) => void;
}

// Frenetic blink: 7 rapid opacity toggles (100→0→100→0→100→0→100)
const BLINK_STEPS = [1, 0, 1, 0, 1, 0, 1];
const BLINK_STEP_MS = 45;
// Content swaps at step 3 (opacity 0)
const BLINK_SWAP_AT = 3;
// Delay after selecting before blink/complete (ms) — lets user see filled button
const POST_SELECT_DELAY = 250;

export function RafagaQuestion({
  prompt,
  promptBold,
  items,
  secondsPerItem = 3,
  onComplete,
}: RafagaQuestionProps) {
  const [started, setStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [blinkOpacity, setBlinkOpacity] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const [subProgress, setSubProgress] = useState(100);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Use refs to avoid stale closures
  const currentIdxRef = useRef(0);
  const answersRef = useRef<(string | null)[]>(new Array(items.length).fill(null));
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

  // Intro screen — show prompt for 2.5s before starting items
  useEffect(() => {
    if (started) return;
    const timer = setTimeout(() => setStarted(true), 2500);
    return () => clearTimeout(timer);
  }, [started]);

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
            setSelectedOption(null);
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

  // Auto-advance timer — only runs after intro is done
  useEffect(() => {
    if (!started || completedRef.current || transitioning) return;

    timerRef.current = setTimeout(() => {
      advanceOrComplete();
    }, secondsPerItem * 1000);

    return clearTimer;
  }, [started, currentIdx, secondsPerItem, advanceOrComplete, transitioning]);

  const handleSelect = useCallback(
    (option: string) => {
      if (transitioningRef.current || completedRef.current) return;
      clearTimer();
      hapticLight();

      answersRef.current[currentIdxRef.current] = option;
      setSelectedOption(option);

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

  // Sub-timer progress bar — only runs after intro
  useEffect(() => {
    if (!started || completedRef.current || transitioning) return;
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
  }, [started, currentIdx, secondsPerItem, transitioning]);

  // --- RENDER ---

  // Intro screen
  if (!started) {
    return (
      <div className="flex flex-col flex-1">
        <div
          className="w-full rounded-[30px] flex flex-col items-center justify-center px-5 pt-10 pb-10 shadow-lg mx-auto min-h-[280px]"
          style={{ backgroundColor: "var(--dynamic-fg, #fff)" }}
        >
          <p style={{ color: "var(--dynamic-bg, #000)" }} className="font-['Roboto'] text-[20px] text-center mb-2">
            <span>{prompt} </span>
            <span className="font-bold">{promptBold}</span>
          </p>
          <p className="font-['Roboto'] text-[14px] text-center mt-4" style={{ color: "var(--dynamic-bg, #000)", opacity: 0.6 }}>
            {items.length} respuestas rápidas — {secondsPerItem}s cada una
          </p>
          <div className="mt-6 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--dynamic-bg, #000)" }} />
            <span className="font-['Fira_Code'] text-[13px] font-medium" style={{ color: "var(--dynamic-bg, #000)" }}>
              Preparate...
            </span>
          </div>
        </div>
      </div>
    );
  }

  const isASelected = selectedOption === item.optionA;
  const isBSelected = selectedOption === item.optionB;

  return (
    <div className="flex flex-col flex-1">
      {/* Card */}
      <div
        className="w-full rounded-[30px] flex flex-col items-center px-5 pt-6 pb-6 shadow-lg mx-auto overflow-hidden"
        style={{ backgroundColor: "var(--dynamic-fg, #fff)" }}
      >
        {/* Counter pill */}
        <span className="font-['Roboto'] font-semibold text-[14px] tracking-[-0.14px] mb-3" style={{ color: "var(--dynamic-bg, #000)" }}>
          {currentIdx + 1} / {total}
        </span>

        {/* Prompt text */}
        <p className="font-['Roboto'] text-[18px] text-center mb-4" style={{ color: "var(--dynamic-bg, #000)" }}>
          <span>{prompt} </span>
          <span className="font-bold">{promptBold}</span>
        </p>

        {/* Sub-question content — frenetic blink transition */}
        <div
          className="w-full flex flex-col items-center"
          style={{ opacity: blinkOpacity }}
        >
          {/* Bold item text */}
          <h2 className="font-['Roboto'] font-bold text-[28px] text-center leading-tight mb-6" style={{ color: "var(--dynamic-bg, #000)" }}>
            {item.text}
          </h2>

          {/* Binary options side by side */}
          <div className="flex gap-3 w-full">
            <button
              onClick={() => handleSelect(item.optionA)}
              className="flex-1 h-[60px] rounded-[8px] flex items-center justify-center select-none active:scale-[0.98] transition-all duration-150 border-2"
              style={{
                borderColor: "var(--dynamic-bg, #000)",
                backgroundColor: isASelected ? "var(--dynamic-bg, #000)" : "transparent",
                color: isASelected ? "var(--dynamic-fg, #fff)" : "var(--dynamic-bg, #000)",
              }}
            >
              <span className="font-['Roboto'] font-semibold text-[18px]">
                {item.optionA}
              </span>
            </button>
            <button
              onClick={() => handleSelect(item.optionB)}
              className="flex-1 h-[60px] rounded-[8px] flex items-center justify-center select-none active:scale-[0.98] transition-all duration-150 border-2"
              style={{
                borderColor: "var(--dynamic-bg, #000)",
                backgroundColor: isBSelected ? "var(--dynamic-bg, #000)" : "transparent",
                color: isBSelected ? "var(--dynamic-fg, #fff)" : "var(--dynamic-bg, #000)",
              }}
            >
              <span className="font-['Roboto'] font-semibold text-[18px]">
                {item.optionB}
              </span>
            </button>
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center gap-[6px] mt-5">
          {items.map((_, i) => (
            <div key={i}>
              {i <= currentIdx ? (
                <div className="w-[11px] h-[11px] rounded-full" style={{ backgroundColor: "var(--dynamic-bg, #000)" }} />
              ) : (
                <div className="w-[11px] h-[11px] rounded-full border-2 bg-transparent" style={{ borderColor: "var(--dynamic-bg, #000)" }} />
              )}
            </div>
          ))}
        </div>

        {/* Sub-timer bar */}
        <div className="w-full h-[3px] rounded-full mt-4 overflow-hidden" style={{ backgroundColor: "color-mix(in srgb, var(--dynamic-bg, #000) 15%, transparent)" }}>
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