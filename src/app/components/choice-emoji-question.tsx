import { useState } from "react";
import { hapticLight } from "./haptics";

interface ChoiceEmojiQuestionProps {
  text: string;
  options: string[];
  onSelect: (option: string) => void;
}

/**
 * choice_emoji — Emoji-only reaction buttons.
 * Large emojis without background frames, centered in thumb zone.
 */
export function ChoiceEmojiQuestion({
  text,
  options,
  onSelect,
}: ChoiceEmojiQuestionProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    hapticLight();
    setTimeout(() => onSelect(options[idx]), 350);
  };

  return (
    <div className="flex flex-col flex-1 items-center">
      {/* Spacer — pushes content to upper-center (thumb zone) */}
      <div className="flex-[2]" />

      {/* Premise text — only if non-empty */}
      {text && (
        <h2
          className="font-['Roboto'] font-bold text-center leading-tight whitespace-pre-wrap px-4 max-w-[320px] mb-10"
          style={{ color: "var(--dynamic-fg, #fff)", fontSize: text.length > 40 ? "20px" : "26px" }}
        >
          {text}
        </h2>
      )}

      {/* Emoji buttons — no frame, just big emojis */}
      <div className="flex items-center justify-center gap-10">
        {options.map((emoji, i) => {
          const isSelected = selected === i;
          const isDimmed = selected !== null && !isSelected;

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              className="relative flex items-center justify-center select-none active:scale-110"
              style={{
                transform: isSelected ? "scale(1.2)" : isDimmed ? "scale(0.85)" : "scale(1)",
                opacity: isDimmed ? 0.25 : 1,
                transition: "transform 0.2s ease, opacity 0.2s ease",
              }}
            >
              <span className="select-none" style={{ fontSize: 80, lineHeight: 1 }}>
                {emoji}
              </span>
            </button>
          );
        })}
      </div>

      {/* Larger bottom spacer — biases content upward */}
      <div className="flex-[3]" />
    </div>
  );
}
