import { useState } from "react";
import { DuotoneCard, CardTitle, OptionButton } from "./brutal-ui";

interface ChoiceQuestionProps {
  actionHint: string;
  text: string;
  options: string[];
  onSelect: (option: string) => void;
}

export function ChoiceQuestion({
  actionHint,
  text,
  options,
  onSelect,
}: ChoiceQuestionProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (option: string) => {
    if (selected) return;
    setSelected(option);
    setTimeout(() => onSelect(option), 350);
  };

  return (
    <div className="flex flex-col flex-1">
      <DuotoneCard hint={actionHint}>
        <CardTitle>{text}</CardTitle>
        <div className="w-full flex flex-col gap-[5px]">
          {options.map((option) => (
            <OptionButton
              key={option}
              selected={selected === option}
              onClick={() => handleSelect(option)}
            >
              {option}
            </OptionButton>
          ))}
        </div>
      </DuotoneCard>
    </div>
  );
}
