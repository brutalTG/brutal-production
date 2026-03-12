import { useState, useEffect, useRef, useCallback } from "react";
import { hapticLight, hapticRigid, hapticSelection } from "./haptics";
import type { RafagaBurstQuestion as RafagaBurstQuestionType, RafagaBurstItem } from "./drop-types";

interface RafagaBurstQuestionProps extends RafagaBurstQuestionType {
  onComplete: (answers: (string | number | null)[]) => void;
}

const BLINK_STEPS = [1, 0, 1, 0, 1, 0, 1];
const BLINK_STEP_MS = 45;
const BLINK_SWAP_AT = 3;
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

  const currentIdxRef = useRef(0);
  const answersRef = useRef<(string | number | null)[]>(new Array(items.length).fill(null));
  const completedRef = useRef(false);
  const transitioningRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    currentIdxRef.current = 0;
    answersRef.current = new Array(items.length).fill(null);
    completedRef.current = false;
    transitioningRef.current = false;
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

  useEffect(() => {
    if (phase !== "pre") return;
    const duration = preScreen.durationMs ?? 2500;
    const timer = setTimeout(() => setPhase("countdown"), duration);
    return () => clearTimeout(timer);
  }, [phase, preScreen.durationMs]);

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
            if (isCompleting) doComplete();
            else {
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
    if (idx >= total - 1) runBlinkAndAdvance(idx, true);
    else runBlinkAndAdvance(idx + 1);
  }, [total, runBlinkAndAdvance]);

  const isSlider = item?.interaction?.type === "slider";
  useEffect(() => {
    if (phase !== "playing" || completedRef.current || transitioning || isSlider) return;
    timerRef.current = setTimeout(advanceOrComplete, secondsPerItem * 1000);
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
        if (isLast) runBlinkAndAdvance(idx, true);
        else runBlinkAndAdvance(idx + 1);
      }, POST_SELECT_DELAY);
    },
    [total, runBlinkAndAdvance]
  );

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

  if (phase === "pre") return <PreScreen title={preScreen.title} subtitle={preScreen.subtitle} />;
  
  if (phase === "countdown") {
    return (
      <div className="flex items-center justify-center h-dvh bg-black">
        <span className="font-['Roboto'] font-bold text-[128px] text-white">{countdownValue}</span>
      </div>
    );
  }

  if (!item || !item.trigger) {
    return <div className="flex items-center justify-center h-dvh bg-black"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white opacity-20"></div></div>;
  }

  const hasImage = item.trigger.type === "image" || item.trigger.type === "image_text";

  return (
    <div className="relative h-dvh overflow-hidden flex flex-col" style={{ backgroundColor: transitioning ? "var(--dynamic-fg, #fff)" : "var(--dynamic-bg, #000)" }}>
      {/* Top Indicators */}
      <div className="flex flex-col items-center pt-4 z-30" style={{ opacity: blinkOpacity }}>
        <div className="flex items-center gap-[6px]">
          {items.map((_, i) => (
            <div key={i} className="w-[11px] h-[11px] rounded-full" style={{ backgroundColor: "var(--dynamic-fg, #fff)", opacity: i <= currentIdx ? 1 : 0.2 }} />
          ))}
        </div>
        {!isSlider && (
          <div className="w-[80%] h-[3px] rounded-full mt-3 overflow-hidden relative bg-white/20">
            <div className="h-full bg-white" style={{ width: `${subProgress}%` }} />
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6" style={{ opacity: blinkOpacity }}>
        {hasImage && item.trigger.imageUrl && (
          <img src={item.trigger.imageUrl} className="absolute inset-0 w-full h-full object-cover z-0" alt="" />
        )}
        <div className="relative z-10 w-full flex flex-col items-center">
          <h2 className="font-['Roboto'] font-bold text-[39px] text-center leading-tight mb-12" style={{ color: "var(--dynamic-fg, #fff)" }}>
            {item.trigger.text}
          </h2>
          <InteractionRenderer interaction={item.interaction} selectedValue={selectedValue} onSelect={handleSelect} />
        </div>
      </div>
    </div>
  );
}

function InteractionRenderer({ interaction, selectedValue, onSelect }: { interaction: any, selectedValue: any, onSelect: any }) {
  if (interaction.type === "emoji_binary") {
    const { emojiA = "👍", emojiB = "👎" } = interaction;
    return (
      <div className="flex justify-center gap-12 w-full">
        <button onClick={() => onSelect(emojiA)} className="active:scale-90 transition-transform text-[100px]">{emojiA}</button>
        <button onClick={() => onSelect(emojiB)} className="active:scale-90 transition-transform text-[100px]">{emojiB}</button>
      </div>
    );
  }

  if (interaction.type === "button_binary") {
    const { buttonA = "A", buttonB = "B" } = interaction;
    return (
      <div className="flex gap-4 w-full">
        <button onClick={() => onSelect(buttonA)} className="flex-1 h-16 rounded-xl font-bold text-xl border-2" 
          style={{ backgroundColor: selectedValue === buttonA ? 'var(--dynamic-fg)' : 'transparent', color: selectedValue === buttonA ? 'var(--dynamic-bg)' : 'var(--dynamic-fg)', borderColor: 'var(--dynamic-fg)' }}>
          {buttonA}
        </button>
        <button onClick={() => onSelect(buttonB)} className="flex-1 h-16 rounded-xl font-bold text-xl border-2" 
          style={{ backgroundColor: selectedValue === buttonB ? 'var(--dynamic-fg)' : 'transparent', color: selectedValue === buttonB ? 'var(--dynamic-bg)' : 'var(--dynamic-fg)', borderColor: 'var(--dynamic-fg)' }}>
          {buttonB}
        </button>
      </div>
    );
  }

  if (interaction.type === "slider") {
    const config = interaction.sliderConfig ?? { min: 0, max: 100, labelLeft: "Nah", labelRight: "Full" };
    return <SliderInteraction config={config} onConfirm={onSelect} />;
  }
  return null;
}

function SliderInteraction({ config, onConfirm }: { config: any, onConfirm: any }) {
  const { min, max, labelLeft, labelRight } = config;
  const [value, setValue] = useState(Math.round((max - min) / 2) + min);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleInteract = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
    const newValue = Math.round(pct * (max - min)) + min;
    setValue(newValue);
  }, [max, min]);

  useEffect(() => {
    if (!isDragging) return;
    const move = (e: any) => handleInteract(e.clientX || e.touches?.[0]?.clientX);
    const stop = () => setIsDragging(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", stop);
    };
  }, [isDragging, handleInteract]);

  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className="w-full flex flex-col gap-4">
      <div ref={trackRef} className="h-12 relative flex items-center bg-white/10 rounded-full border-2 border-white/20 px-2 cursor-pointer" 
        onMouseDown={() => setIsDragging(true)} onTouchStart={() => setIsDragging(true)}>
        <div className="absolute h-8 w-8 rounded-full shadow-xl bg-white" style={{ left: `calc(${percent}% - 16px)` }} />
      </div>
      <div className="flex justify-between text-xs font-bold" style={{ color: "var(--dynamic-fg)" }}>
        <span>{labelLeft}</span>
        <span>{labelRight}</span>
      </div>
      <button onClick={() => onConfirm(value)} className="h-16 font-bold rounded-xl text-xl" 
        style={{ backgroundColor: "var(--dynamic-fg)", color: "var(--dynamic-bg)" }}>
        Confirmar
      </button>
    </div>
  );
}

function PreScreen({ title, subtitle }: { title: string; subtitle?: string }) {
  const [displayedSubtitle, setDisplayedSubtitle] = useState("");
  useEffect(() => {
    if (!subtitle) return;
    let i = 0;
    const interval = setInterval(() => {
      if (i < subtitle.length) {
        setDisplayedSubtitle(subtitle.slice(0, i + 1));
        i++;
      } else { clearInterval(interval); }
    }, 40);
    return () => clearInterval(interval);
  }, [subtitle]);

  return (
    <div className="flex flex-col items-center justify-center h-dvh px-8 bg-black text-white">
      <h1 className="font-bold text-4xl text-center leading-tight mb-4">{title}</h1>
      <p className="font-bold text-2xl text-center opacity-80">{displayedSubtitle}_</p>
    </div>
  );
}
