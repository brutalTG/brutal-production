import { useState, useEffect, useRef } from "react";
import { hapticLight } from "./haptics";

interface HotTakeQuestionProps {
  text: string;
  options: string[];
  onSelect: (option: string) => void;
}

export function HotTakeQuestion({ text, options, onSelect }: HotTakeQuestionProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const charIndex = useRef(0);

  useEffect(() => {
    charIndex.current = 0;
    setDisplayedText("");
    setShowOptions(false);
    setSelected(null);

    const interval = setInterval(() => {
      if (charIndex.current < text.length) {
        charIndex.current++;
        setDisplayedText(text.slice(0, charIndex.current));
      } else {
        clearInterval(interval);
        setTimeout(() => setShowOptions(true), 400);
      }
    }, 35);

    return () => clearInterval(interval);
  }, [text]);

  // Blinking cursor
  const [cursorOn, setCursorOn] = useState(true);
  useEffect(() => {
    if (showOptions) {
      setCursorOn(false);
      return;
    }
    const blink = setInterval(() => setCursorOn((p) => !p), 530);
    return () => clearInterval(blink);
  }, [showOptions]);

  const handleSelect = (option: string) => {
    if (selected) return;
    setSelected(option);
    hapticLight();
    setTimeout(() => onSelect(option), 400);
  };

  return (
    <div className="h-dvh flex flex-col items-center justify-center px-7" style={{ backgroundColor: "var(--dynamic-bg, #000)" }}>
      <style>{`
        @keyframes hotTakeFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes hotTakeOptionStagger {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Typewriter text */}
      <div className="text-center mb-14 min-h-[80px]">
        <h1 className="font-['Roboto'] font-bold text-[26px] leading-[1.25] whitespace-pre-wrap" style={{ color: "var(--dynamic-fg, #fff)" }}>
          {displayedText}
          {!showOptions && (
            <span
              className="inline-block w-[2px] h-[26px] ml-[2px] align-text-bottom"
              style={{ backgroundColor: "var(--dynamic-fg, #fff)", opacity: cursorOn ? 1 : 0 }}
            />
          )}
        </h1>
      </div>

      {/* Options */}
      {showOptions && (
        <div
          className="w-full max-w-[360px] flex flex-col gap-3"
          style={{ animation: "hotTakeFadeIn 0.4s ease-out" }}
        >
          {options.map((option, i) => (
            <button
              key={option}
              onClick={() => handleSelect(option)}
              className="w-full h-[60px] rounded-[8px] border-2 flex items-center justify-center select-none active:scale-[0.98] transition-all duration-200"
              style={{
                borderColor: "var(--dynamic-fg, #fff)",
                backgroundColor: selected === option ? "var(--dynamic-fg, #fff)" : "transparent",
                animation: `hotTakeOptionStagger 0.3s ${i * 80}ms ease-out both`,
              }}
            >
              <span
                className="font-['Roboto'] font-semibold text-[18px]"
                style={{ color: selected === option ? "var(--dynamic-bg, #000)" : "var(--dynamic-fg, #fff)" }}
              >
                {option}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}