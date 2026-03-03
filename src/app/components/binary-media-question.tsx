import { useState } from "react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { hapticLight } from "./haptics";
import { OptionButton } from "./brutal-ui";

interface BinaryMediaQuestionProps {
  imageUrl: string;
  optionA: string;
  optionB: string;
  onSelect: (option: string) => void;
}

export function BinaryMediaQuestion({
  imageUrl,
  optionA,
  optionB,
  onSelect,
}: BinaryMediaQuestionProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (option: string) => {
    if (selected) return;
    setSelected(option);
    hapticLight();
    setTimeout(() => {
      onSelect(option);
    }, 350);
  };

  return (
    <div className="flex flex-col flex-1 gap-5">
      {/* Media Card */}
      <div className="relative w-full rounded-[30px] overflow-hidden" style={{ aspectRatio: "355/423" }}>
        <ImageWithFallback
          src={imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>

      {/* Binary Options */}
      <div className="flex gap-3 w-full">
        <OptionButton
          selected={selected === optionA}
          onClick={() => handleSelect(optionA)}
          className="!flex-1 !w-auto"
        >
          {optionA}
        </OptionButton>
        <OptionButton
          selected={selected === optionB}
          onClick={() => handleSelect(optionB)}
          className="!flex-1 !w-auto"
        >
          {optionB}
        </OptionButton>
      </div>
    </div>
  );
}