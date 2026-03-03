import { useState, useRef } from "react";
import { hapticMedium } from "./haptics";
import { resetViewport } from "./telegram-sdk";
import { DuotoneCard, CardTitle, CardTextarea, ActionButton } from "./brutal-ui";

interface ConfesionarioQuestionProps {
  actionHint: string;
  text: string;
  onSubmit: () => void;
}

export function ConfesionarioQuestion({
  actionHint,
  text,
  onSubmit,
}: ConfesionarioQuestionProps) {
  const [value, setValue] = useState("");
  const isValid = value.trim().length >= 3;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!isValid) return;
    hapticMedium();
    textareaRef.current?.blur();
    resetViewport();
    setTimeout(() => onSubmit(), 150);
  };

  return (
    <div className="flex flex-col flex-1 gap-6">
      <DuotoneCard hint={actionHint}>
        <CardTitle>{text}</CardTitle>
        <div className="w-full mb-4">
          <CardTextarea
            textareaRef={textareaRef}
            value={value}
            onChange={setValue}
            placeholder="Escribi aca"
          />
        </div>
        <ActionButton label="Enviar" disabled={!isValid} onClick={handleSubmit} />
      </DuotoneCard>
    </div>
  );
}
