import { useState } from "react";
import { hapticLight, hapticError, hapticSuccess } from "./haptics";
import { DuotoneCard, CardTitle, CardPill } from "./brutal-ui";

interface TrapQuestionProps {
  actionHint: string;
  text: string;
  options: string[];
  correctIndex: number;
  onAnswer: (correct: boolean) => void;
}

export function TrapQuestion({
  actionHint,
  text,
  options,
  correctIndex,
  onAnswer,
}: TrapQuestionProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "wrong" | "correct">("idle");

  const handleSelect = (index: number) => {
    if (selected !== null) return;
    setSelected(index);

    const isCorrect = index === correctIndex;

    if (isCorrect) {
      setPhase("correct");
      hapticSuccess();
      setTimeout(() => onAnswer(true), 500);
    } else {
      setPhase("wrong");
      hapticError();
      // Show wrong shake, then highlight correct, then callback
      setTimeout(() => onAnswer(false), 1000);
    }
  };

  const getOptionStyle = (index: number) => {
    if (selected === null) {
      return {
        backgroundColor: "var(--dynamic-bg, #000)",
        border: "2px solid var(--dynamic-bg, #000)",
        color: "var(--dynamic-fg, #fff)",
        animation: "none",
      };
    }

    if (phase === "correct" && index === selected) {
      return {
        backgroundColor: "var(--dynamic-fg, #fff)",
        border: "2px solid var(--dynamic-bg, #000)",
        color: "var(--dynamic-bg, #000)",
        animation: "trap-correct-pulse 500ms ease-out",
      };
    }

    if (phase === "wrong") {
      if (index === selected) {
        return {
          backgroundColor: "var(--dynamic-fg, #fff)",
          border: "2px solid var(--dynamic-bg, #000)",
          color: "var(--dynamic-bg, #000)",
          animation: "trap-wrong-shake 400ms ease-out",
        };
      }
      if (index === correctIndex) {
        return {
          backgroundColor: "var(--dynamic-bg, #000)",
          border: "2px solid var(--dynamic-fg, #fff)",
          color: "var(--dynamic-fg, #fff)",
          animation: "trap-reveal-correct 600ms 300ms ease-out both",
        };
      }
    }

    if (selected !== null) {
      return {
        backgroundColor: "var(--dynamic-bg, #000)",
        border: "2px solid var(--dynamic-bg, #000)",
        color: "var(--dynamic-fg, #fff)",
        opacity: 0.3,
        animation: "none",
      };
    }

    return {
      backgroundColor: "var(--dynamic-bg, #000)",
      border: "2px solid var(--dynamic-bg, #000)",
      color: "var(--dynamic-fg, #fff)",
      animation: "none",
    };
  };

  return (
    <div className="flex flex-col flex-1">
      <style>{`
        @keyframes trap-wrong-shake {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-8px); }
          20% { transform: translateX(8px); }
          30% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          50% { transform: translateX(-4px); }
          60% { transform: translateX(4px); }
          70% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
        @keyframes trap-correct-pulse {
          0% { transform: scale(1); }
          40% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        @keyframes trap-reveal-correct {
          0% { opacity: 0.3; border-color: #000; }
          30% { opacity: 1; border-color: #fff; }
          50% { opacity: 0.5; border-color: #fff; }
          70% { opacity: 1; border-color: #fff; }
          100% { opacity: 1; border-color: #fff; }
        }
        @keyframes trap-card-shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-3px); }
          30% { transform: translateX(3px); }
          45% { transform: translateX(-2px); }
          60% { transform: translateX(2px); }
        }
      `}</style>

      {/* Card */}
      <DuotoneCard
        className={phase === "wrong" ? "animate-[trap-card-shake_400ms_100ms_ease-out]" : ""}
      >
        {/* Counter Pill with trap indicator */}
        <CardPill>{actionHint}</CardPill>

        <CardTitle>{text}</CardTitle>

        {/* Options */}
        <div className="w-full flex flex-col gap-[5px]">
          {options.map((option, i) => {
            const style = getOptionStyle(i);
            return (
              <button
                key={option}
                onClick={() => handleSelect(i)}
                className="w-full h-[60px] rounded-[8px] flex items-center justify-center select-none transition-opacity duration-200"
                style={{
                  backgroundColor: style.backgroundColor,
                  border: style.border,
                  color: style.color,
                  opacity: (style as any).opacity ?? 1,
                  animation: style.animation,
                }}
              >
                <span className="font-['Roboto'] font-medium text-[16px]">
                  {option}
                </span>
              </button>
            );
          })}
        </div>
      </DuotoneCard>
    </div>
  );
}