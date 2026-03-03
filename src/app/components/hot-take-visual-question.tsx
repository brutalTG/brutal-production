import { useState, useEffect, useRef, useMemo } from "react";
import { hapticLight } from "./haptics";
import { extractTrailingEmoji, isEmojiOnly } from "./emoji-utils";

interface HotTakeVisualQuestionProps {
  text: string;
  options: string[];
  onSelect: (option: string) => void;
}

/**
 * hot_take_visual — Hot take with emoji/hybrid option buttons.
 *
 * Same typewriter intro as `hot_take`, but the post-typewriter options
 * adapt to the content:
 *   - All emoji-only options -> large emoji buttons (like choice_emoji)
 *   - Options with emoji+text -> hybrid buttons (like choice_hybrid)
 *   - Options without emoji -> standard text buttons (like hot_take)
 *
 * Produces the same data as `hot_take`.
 */
export function HotTakeVisualQuestion({
  text,
  options,
  onSelect,
}: HotTakeVisualQuestionProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const charIndex = useRef(0);

  // Detect option rendering mode
  const allEmoji = useMemo(() => options.every(isEmojiOnly), [options]);
  const parsed = useMemo(
    () => options.map((o) => ({ raw: o, ...extractTrailingEmoji(o) })),
    [options]
  );
  const someEmoji = useMemo(
    () => !allEmoji && parsed.some((p) => p.emoji !== null),
    [allEmoji, parsed]
  );

  // Typewriter
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

  // Cursor blink
  const [cursorOn, setCursorOn] = useState(true);
  useEffect(() => {
    if (showOptions) { setCursorOn(false); return; }
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
        @keyframes htv-fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes htv-stagger {
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
          className="w-full max-w-[360px]"
          style={{ animation: "htv-fadeIn 0.4s ease-out" }}
        >
          {/* MODE: All emoji */}
          {allEmoji && (
            <div className="flex items-center justify-center gap-6">
              {options.map((emoji, i) => {
                const isSelected = selected === emoji;
                const isDimmed = selected !== null && !isSelected;
                return (
                  <button
                    key={emoji}
                    onClick={() => handleSelect(emoji)}
                    className="flex items-center justify-center select-none transition-all duration-200 active:scale-105"
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: 20,
                      backgroundColor: isSelected
                        ? "color-mix(in srgb, var(--dynamic-fg, #fff) 20%, transparent)"
                        : "color-mix(in srgb, var(--dynamic-fg, #fff) 6%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--dynamic-fg, #fff) 15%, transparent)",
                      transform: isSelected ? "scale(1.1)" : isDimmed ? "scale(0.95)" : "scale(1)",
                      opacity: isDimmed ? 0.3 : 1,
                      animation: `htv-stagger 0.3s ${i * 80}ms ease-out both`,
                    }}
                  >
                    <span style={{ fontSize: 56, lineHeight: 1 }}>{emoji}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* MODE: Some emoji -> hybrid buttons */}
          {someEmoji && (
            <div className="flex flex-col gap-3">
              {parsed.map(({ raw, emoji, text: optText }, i) => {
                const isSelected = selected === raw;
                const hasEmoji = emoji !== null;
                return (
                  <button
                    key={raw}
                    onClick={() => handleSelect(raw)}
                    className="w-full h-[60px] rounded-[8px] border-2 flex items-center select-none active:scale-[0.98] transition-all duration-200"
                    style={{
                      borderColor: "var(--dynamic-fg, #fff)",
                      backgroundColor: isSelected ? "var(--dynamic-fg, #fff)" : "transparent",
                      paddingLeft: hasEmoji ? 14 : 0,
                      paddingRight: 14,
                      justifyContent: hasEmoji ? "flex-start" : "center",
                      gap: hasEmoji ? 12 : 0,
                      animation: `htv-stagger 0.3s ${i * 80}ms ease-out both`,
                    }}
                  >
                    {hasEmoji && (
                      <span className="shrink-0" style={{ fontSize: 28, lineHeight: 1 }}>
                        {emoji}
                      </span>
                    )}
                    <span
                      className="font-['Roboto'] font-semibold truncate"
                      style={{
                        color: isSelected ? "var(--dynamic-bg, #000)" : "var(--dynamic-fg, #fff)",
                        fontSize: hasEmoji ? 16 : 18,
                      }}
                    >
                      {optText || raw}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* MODE: No emoji -> standard text buttons */}
          {!allEmoji && !someEmoji && (
            <div className="flex flex-col gap-3">
              {options.map((option, i) => (
                <button
                  key={option}
                  onClick={() => handleSelect(option)}
                  className="w-full h-[60px] rounded-[8px] border-2 flex items-center justify-center select-none active:scale-[0.98] transition-all duration-200"
                  style={{
                    borderColor: "var(--dynamic-fg, #fff)",
                    backgroundColor: selected === option ? "var(--dynamic-fg, #fff)" : "transparent",
                    animation: `htv-stagger 0.3s ${i * 80}ms ease-out both`,
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
      )}
    </div>
  );
}