import { useState, useRef, useEffect } from "react";
import { hapticLight, hapticMedium } from "./haptics";
import { DuotoneCard, CardTitle, CardPill, ActionButton } from "./brutal-ui";

interface RankingQuestionProps {
  actionHint: string;
  text: string;
  options: string[];
  onConfirm: (rankedOrder: string[]) => void;
}

function AnimatedOption({
  option,
  variant,
  onClick,
  index,
}: {
  option: string;
  variant: "ranked" | "unranked";
  onClick: () => void;
  index: number;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const isRanked = variant === "ranked";

  return (
    <button
      ref={ref}
      onClick={onClick}
      className="w-full h-[60px] rounded-[8px] flex items-center justify-center select-none active:scale-[0.98]"
      style={{
        backgroundColor: isRanked ? "var(--dynamic-bg, #000)" : "transparent",
        border: "2px solid var(--dynamic-bg, #000)",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0) scale(1)" : "translateY(12px) scale(0.95)",
        transition: "opacity 0.25s ease, transform 0.25s ease, background-color 0.2s ease",
        transitionDelay: `${index * 40}ms`,
      }}
    >
      <span
        className="font-['Roboto'] font-medium text-[16px]"
        style={{ color: isRanked ? "var(--dynamic-fg, #fff)" : "var(--dynamic-bg, #000)" }}
      >
        {option}
      </span>
    </button>
  );
}

export function RankingQuestion({
  actionHint,
  text,
  options,
  onConfirm,
}: RankingQuestionProps) {
  const [ranked, setRanked] = useState<string[]>([]);

  const unranked = options.filter((opt) => !ranked.includes(opt));
  const allRanked = ranked.length === options.length;

  const handleSelect = (option: string) => {
    if (ranked.includes(option)) return;
    hapticLight();
    setRanked((prev) => [...prev, option]);
  };

  const handleUnselect = (option: string) => {
    hapticLight();
    setRanked((prev) => prev.filter((o) => o !== option));
  };

  return (
    <div className="flex flex-col flex-1 gap-6">
      {/* Card */}
      <DuotoneCard hint={actionHint}>
        <CardTitle>{text}</CardTitle>

        {/* Ranked options */}
        <div className="w-full flex flex-col gap-2.5">
          {ranked.map((option, i) => (
            <AnimatedOption
              key={`ranked-${option}`}
              option={option}
              variant="ranked"
              onClick={() => handleUnselect(option)}
              index={i}
            />
          ))}
        </div>

        {/* Dashed separator line */}
        {unranked.length > 0 && (
          <div
            className="w-full my-5"
            style={{
              opacity: allRanked ? 0 : 1,
              transition: "opacity 0.3s ease",
            }}
          >
            <svg
              width="100%"
              height="2"
              className="block"
              preserveAspectRatio="none"
            >
              <line
                x1="0"
                y1="1"
                x2="100%"
                y2="1"
                stroke="var(--dynamic-bg, #000)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            </svg>
          </div>
        )}

        {/* Unranked options */}
        <div className="w-full flex flex-col gap-2.5">
          {unranked.map((option, i) => (
            <AnimatedOption
              key={`unranked-${option}`}
              option={option}
              variant="unranked"
              onClick={() => handleSelect(option)}
              index={i}
            />
          ))}
        </div>
      </DuotoneCard>

      {/* Confirm button */}
      <ActionButton
        label="Confirmar orden"
        disabled={!allRanked}
        onClick={() => allRanked && onConfirm(ranked)}
        variant="pill"
      />
    </div>
  );
}