import { useState, useMemo } from "react";
import { hapticLight } from "./haptics";
import { extractTrailingEmoji } from "./emoji-utils";
import { DuotoneCard, CardTitle, OptionButton } from "./brutal-ui";

interface ChoiceHybridQuestionProps {
  actionHint: string;
  text: string;
  options: string[];
  onSelect: (option: string) => void;
}

/**
 * choice_hybrid — Emoji-prominent + subordinate text buttons.
 *
 * Full-width buttons like `choice`, but each button shows a large emoji
 * on the left and smaller text on the right. If no emoji is found in the
 * option string, renders as a normal choice button.
 * Produces the same data as `choice`.
 */
export function ChoiceHybridQuestion({
  actionHint,
  text,
  options,
  onSelect,
}: ChoiceHybridQuestionProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const parsed = useMemo(
    () => options.map((o) => ({ raw: o, ...extractTrailingEmoji(o) })),
    [options]
  );

  const handleSelect = (option: string) => {
    if (selected) return;
    setSelected(option);
    hapticLight();
    setTimeout(() => onSelect(option), 350);
  };

  return (
    <div className="flex flex-col flex-1">
      <DuotoneCard hint={actionHint}>
        <CardTitle>{text}</CardTitle>

        {/* Options */}
        <div className="w-full flex flex-col gap-[5px]">
          {parsed.map(({ raw, emoji, text: optText }) => {
            const isSelected = selected === raw;
            const hasEmoji = emoji !== null;

            return (
              <OptionButton
                key={raw}
                selected={isSelected}
                onClick={() => handleSelect(raw)}
                className={hasEmoji ? "!justify-start !pl-3.5 !pr-3.5 !gap-3" : ""}
              >
                <span className="flex items-center gap-3">
                  {hasEmoji && (
                    <span className="select-none shrink-0" style={{ fontSize: 32, lineHeight: 1 }}>
                      {emoji}
                    </span>
                  )}
                  <span
                    className="font-['Roboto'] font-medium truncate"
                    style={{ fontSize: hasEmoji ? 15 : 16 }}
                  >
                    {optText || raw}
                  </span>
                </span>
              </OptionButton>
            );
          })}
        </div>
      </DuotoneCard>
    </div>
  );
}