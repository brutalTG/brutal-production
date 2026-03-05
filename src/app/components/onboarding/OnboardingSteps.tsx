// ============================================================
// ONBOARDING STEPS — Individual step renderers
// Now uses shared primitives from brutal-ui.tsx
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { hapticLight, hapticMedium, hapticSelection } from "../haptics";
import { resetViewport } from "../telegram-sdk";
import {
  DuotoneCard, CardTitle, CardPill, OptionButton, ActionButton,
  CardInput, ChipButton,
} from "../brutal-ui";
import type {
  IntroStep, PhoneStep, TextInputStep, AgeSelectorStep,
  SingleChoiceStep, NestedChoiceStep, MultiSelectStep,
  ScaleStep, FreeTextStep, TransitionStep, MultiplierHandlesStep,
} from "./onboarding-types";

// ── INTRO ───────────────────────────────────────────────────

export function IntroStepView({ step, onNext }: { step: IntroStep; onNext: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-2 transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}>
      <h1
        className="font-['Silkscreen'] text-[32px] leading-tight text-center mb-6"
        style={{ color: "var(--dynamic-fg, #fff)" }}
      >
        {step.title}
      </h1>
      <p
        className="font-['Fira_Code'] text-[14px] leading-relaxed text-center mb-10 opacity-80 whitespace-pre-wrap max-w-[340px]"
        style={{ color: "var(--dynamic-fg, #fff)" }}
      >
        {step.subtitle}
      </p>

      {/* Queue bar preview */}
      <div className="w-full max-w-[320px] mb-10">
        <p className="font-['Fira_Code'] text-[11px] opacity-60 mb-2" style={{ color: "var(--dynamic-fg, #fff)" }}>
          Tu posicion en la fila:
        </p>
        <div className="w-full h-[6px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--dynamic-fg, #fff)", opacity: 0.15 }}>
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: "85%", backgroundColor: "var(--dynamic-fg, #fff)", opacity: 0.6 }} />
        </div>
        <p className="font-['Fira_Code'] text-[10px] opacity-40 mt-1" style={{ color: "var(--dynamic-fg, #fff)" }}>
          Completa mas datos = salta mas gente
        </p>
      </div>

      <ActionButton label="EMPEZAR" onClick={onNext} variant="pill" className="max-w-[320px]" />
    </div>
  );
}

// ── PHONE INPUT ─────────────────────────────────────────────

export function PhoneStepView({ step, onNext }: { step: PhoneStep; onNext: (val: string) => void }) {
  const [phone, setPhone] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isValid = phone.replace(/\D/g, "").length >= 8;

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 400); }, []);

  const handleSubmit = () => {
    if (!isValid) return;
    inputRef.current?.blur();
    resetViewport();
    setTimeout(() => onNext(`+54${phone.replace(/\D/g, "")}`), 150);
  };

  return (
    <div className="flex flex-col flex-1">
      <DuotoneCard hint="FASE A · 1/6">
        <CardTitle size="md">{step.copy}</CardTitle>
        <div className="w-full mb-2">
          <div className="flex items-center gap-2">
            <span
              className="font-['Fira_Code'] font-medium text-[16px] shrink-0"
              style={{ color: "var(--dynamic-bg, #000)" }}
            >
              +54
            </span>
            <CardInput
              inputRef={inputRef}
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(val) => setPhone(val.replace(/[^\d\s-]/g, ""))}
              placeholder="11 2345 6789"
              fontFamily="Fira_Code"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
        </div>
        <ActionButton label="Siguiente" disabled={!isValid} onClick={handleSubmit} />
      </DuotoneCard>
    </div>
  );
}

// ── TEXT INPUT ───────────────────────────────────────────────

export function TextInputStepView({ step, hint, onNext }: { step: TextInputStep; hint: string; onNext: (val: string) => void }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isValid = value.trim().length >= 2;

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 400); }, []);

  const handleSubmit = () => {
    if (!isValid) return;
    inputRef.current?.blur();
    resetViewport();
    setTimeout(() => onNext(value.trim()), 150);
  };

  return (
    <div className="flex flex-col flex-1">
      <DuotoneCard hint={hint}>
        <CardTitle size="md">{step.copy}</CardTitle>
        <div className="w-full mb-2">
          <CardInput
            inputRef={inputRef}
            value={value}
            onChange={setValue}
            placeholder={step.placeholder || "Escribi aca"}
            maxLength={step.maxLength}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          {step.maxLength && (
            <p className="text-right text-[11px] mt-1 opacity-40 font-['Fira_Code']" style={{ color: "var(--dynamic-bg, #000)" }}>
              {value.length}/{step.maxLength}
            </p>
          )}
        </div>
        <ActionButton label="Siguiente" disabled={!isValid} onClick={handleSubmit} />
      </DuotoneCard>
    </div>
  );
}

// ── AGE SELECTOR ────────────────────────────────────────────

export function AgeSelectorStepView({ step, hint, onNext, onReject }: { step: AgeSelectorStep; hint: string; onNext: (val: number) => void; onReject: (msg: string) => void }) {
  const [age, setAge] = useState(20);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastVal = useRef(age);
  const range = step.max - step.min;

  const handleInteract = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = x / rect.width;
    const newAge = Math.round(pct * range) + step.min;
    const clamped = Math.max(step.min, Math.min(step.max, newAge));
    if (clamped !== lastVal.current) {
      hapticSelection();
      lastVal.current = clamped;
    }
    setAge(clamped);
  }, [range, step.min, step.max]);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => { if (isDragging) { e.preventDefault(); handleInteract(e.clientX); } };
    const handleUp = () => setIsDragging(false);
    const handleTouchMove = (e: TouchEvent) => { if (isDragging) { e.preventDefault(); handleInteract(e.touches[0].clientX); } };
    if (isDragging) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [isDragging, handleInteract]);

  const pct = ((age - step.min) / range) * 100;

  const handleConfirm = () => {
    if (age < step.min || age > step.max) {
      onReject(step.rejectMessage || "Fuera de rango.");
      return;
    }
    onNext(age);
  };

  return (
    <div className="flex flex-col flex-1 gap-6">
      <DuotoneCard hint={hint}>
        <CardTitle size="md">{step.copy}</CardTitle>
        <div className="text-center mb-4">
          <span className="font-['Roboto'] font-bold text-[64px] leading-none" style={{ color: "var(--dynamic-bg, #000)" }}>
            {age}
          </span>
        </div>
      </DuotoneCard>

      {/* Slider outside card */}
      <div className="w-full select-none touch-none">
        <div
          ref={trackRef}
          className="relative h-[52px] flex items-center cursor-pointer"
          onMouseDown={(e) => { setIsDragging(true); handleInteract(e.clientX); }}
          onTouchStart={(e) => { setIsDragging(true); handleInteract(e.touches[0].clientX); }}
        >
          <div
            className="absolute left-0 right-0 h-[34px] rounded-full border-2 overflow-hidden"
            style={{ top: "50%", transform: "translateY(-50%)", borderColor: "var(--dynamic-fg, #fff)" }}
          >
            <div
              className="absolute top-1/2 -translate-y-1/2 left-3 right-3 h-[2px]"
              style={{ backgroundImage: "repeating-linear-gradient(to right, var(--dynamic-fg, #fff) 0, var(--dynamic-fg, #fff) 6px, transparent 6px, transparent 12px)" }}
            />
          </div>
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[48px] h-[48px] rounded-full border-[2.5px] flex items-center justify-center shadow-lg z-10"
            style={{
              backgroundColor: "var(--dynamic-bg, #000)",
              borderColor: "var(--dynamic-fg, #fff)",
              left: `calc(24px + ${pct / 100} * (100% - 48px))`,
            }}
          >
            <div className="w-[28px] h-[28px] rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--dynamic-fg, #fff)" }}>
              <div className="w-[16px] h-[16px] rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--dynamic-bg, #000)" }}>
                <div className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: "var(--dynamic-fg, #fff)" }} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-between mt-1 font-['Fira_Code'] text-[12px] px-1 opacity-70" style={{ color: "var(--dynamic-fg, #fff)" }}>
          <span>{step.min}</span>
          <span>{step.max}</span>
        </div>
      </div>

      <ActionButton label="Confirmar" onClick={handleConfirm} />
    </div>
  );
}

// ── SINGLE CHOICE ───────────────────────────────────────────

export function SingleChoiceStepView({ step, hint, onNext }: { step: SingleChoiceStep; hint: string; onNext: (val: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (opt: string) => {
    if (selected) return;
    setSelected(opt);
    setTimeout(() => onNext(opt), 350);
  };

  return (
    <div className="flex flex-col flex-1">
      <DuotoneCard hint={hint}>
        <CardTitle size="md">{step.copy}</CardTitle>
        <div className="w-full flex flex-col gap-[5px]">
          {step.options.map((opt) => (
            <OptionButton
              key={opt}
              selected={selected === opt}
              onClick={() => handleSelect(opt)}
              height="md"
            >
              {opt}
            </OptionButton>
          ))}
        </div>
      </DuotoneCard>
    </div>
  );
}

// ── NESTED CHOICE ───────────────────────────────────────────

export function NestedChoiceStepView({ step, hint, onNext }: { step: NestedChoiceStep; hint: string; onNext: (val: string) => void }) {
  const [selectedParent, setSelectedParent] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const parentOpt = step.options.find((o) => o.label === selectedParent);
  const hasSubs = parentOpt?.subOptions && parentOpt.subOptions.length > 0;

  const handleParent = (label: string) => {
    if (locked) return;
    hapticLight();
    const opt = step.options.find((o) => o.label === label);
    if (opt?.subOptions && opt.subOptions.length > 0) {
      setSelectedParent(label);
    } else {
      setLocked(true);
      setSelectedParent(label);
      setTimeout(() => onNext(label), 350);
    }
  };

  const handleSub = (sub: string) => {
    if (locked) return;
    setSelectedSub(sub);
    setLocked(true);
    hapticLight();
    setTimeout(() => onNext(`${selectedParent} — ${sub}`), 350);
  };

  if (hasSubs && selectedParent) {
    return (
      <div className="flex flex-col flex-1">
        <DuotoneCard hint={hint}>
          <CardTitle size="md">{`${selectedParent} — ¿Donde?`}</CardTitle>
          <div className="w-full flex flex-col gap-[5px] max-h-[380px] overflow-y-auto">
            {parentOpt!.subOptions!.map((sub) => (
              <OptionButton
                key={sub}
                selected={selectedSub === sub}
                onClick={() => handleSub(sub)}
                height="sm"
              >
                {sub}
              </OptionButton>
            ))}
          </div>
          <button
            onClick={() => { setSelectedParent(null); setSelectedSub(null); setLocked(false); }}
            className="mt-3 text-[12px] opacity-50 font-['Fira_Code']"
            style={{ color: "var(--dynamic-bg, #000)" }}
          >
            {"<"} Volver
          </button>
        </DuotoneCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <DuotoneCard hint={hint}>
        <CardTitle size="md">{step.copy}</CardTitle>
        <div className="w-full flex flex-col gap-[5px]">
          {step.options.map((opt) => (
            <OptionButton
              key={opt.label}
              selected={selectedParent === opt.label}
              onClick={() => handleParent(opt.label)}
              height="md"
            >
              {opt.label}{opt.subOptions ? " >" : ""}
            </OptionButton>
          ))}
        </div>
      </DuotoneCard>
    </div>
  );
}

// ── MULTI SELECT ────────────────────────────────────────────

export function MultiSelectStepView({ step, hint, onNext }: { step: MultiSelectStep; hint: string; onNext: (val: string[]) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const limit = step.exactCount || step.maxSelect || step.options.length;
  const minRequired = step.exactCount || step.minSelect || 1;
  const isValid = step.exactCount ? selected.size === step.exactCount : selected.size >= minRequired;

  const toggle = (opt: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(opt)) {
        next.delete(opt);
      } else if (next.size < limit) {
        next.add(opt);
      }
      return next;
    });
  };

  const counterLabel = step.exactCount
    ? `${selected.size}/${step.exactCount}`
    : step.maxSelect
    ? `${selected.size}/${step.maxSelect} max`
    : `${selected.size} seleccionados`;

  return (
    <div className="flex flex-col flex-1">
      <DuotoneCard hint={hint}>
        <CardTitle size="md">{step.copy}</CardTitle>
        <p className="text-[12px] font-['Fira_Code'] mb-3 opacity-60" style={{ color: "var(--dynamic-bg, #000)" }}>
          {counterLabel}
        </p>
        <div className="w-full flex flex-wrap gap-[6px] justify-center">
          {step.options.map((opt) => (
            <ChipButton key={opt} selected={selected.has(opt)} onClick={() => toggle(opt)}>
              {opt}
            </ChipButton>
          ))}
        </div>
        <ActionButton label="Siguiente" disabled={!isValid} onClick={() => onNext(Array.from(selected))} />
      </DuotoneCard>
    </div>
  );
}

// ── SCALE ───────────────────────────────────────────────────

export function ScaleStepView({ step, hint, onNext }: { step: ScaleStep; hint: string; onNext: (val: number) => void }) {
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (val: number) => {
    if (selected !== null) return;
    setSelected(val);
    hapticLight();
    setTimeout(() => onNext(val), 400);
  };

  return (
    <div className="flex flex-col flex-1">
      <DuotoneCard hint={hint}>
        <CardTitle size="md">{step.copy}</CardTitle>
        <div className="w-full flex flex-col gap-[5px]">
          {step.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className="w-full min-h-[52px] rounded-[8px] flex items-center justify-start px-4 select-none active:scale-[0.98] transition-all duration-200"
              style={{
                backgroundColor: selected === opt.value ? "var(--dynamic-fg, #fff)" : "var(--dynamic-bg, #000)",
                border: "2px solid var(--dynamic-bg, #000)",
              }}
            >
              <span
                className="font-['Fira_Code'] font-bold text-[13px] mr-3 shrink-0"
                style={{ color: selected === opt.value ? "var(--dynamic-bg, #000)" : "var(--dynamic-fg, #fff)" }}
              >
                {opt.value}
              </span>
              <span
                className="font-['Roboto'] font-medium text-[14px] text-left"
                style={{ color: selected === opt.value ? "var(--dynamic-bg, #000)" : "var(--dynamic-fg, #fff)" }}
              >
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </DuotoneCard>
    </div>
  );
}

// ── FREE TEXT ────────────────────────────────────────────────

export function FreeTextStepView({ step, hint, onNext }: { step: FreeTextStep; hint: string; onNext: (val: string) => void }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const minLen = step.minLength || 2;
  const isValid = value.trim().length >= minLen;

  useEffect(() => { setTimeout(() => textareaRef.current?.focus(), 400); }, []);

  const handleSubmit = () => {
    if (!isValid) return;
    textareaRef.current?.blur();
    resetViewport();
    setTimeout(() => onNext(value.trim()), 150);
  };

  return (
    <div className="flex flex-col flex-1">
      <DuotoneCard hint={hint}>
        <CardTitle size="md">{step.copy}</CardTitle>
        <div className="w-full mb-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={step.placeholder || "Escribi aca"}
            className="w-full h-[100px] rounded-[8px] border-2 bg-transparent font-['Roboto'] font-medium text-[15px] px-4 py-3 resize-none outline-none"
            style={{ borderColor: "var(--dynamic-bg, #000)", color: "var(--dynamic-bg, #000)", fontSize: "16px" }}
          />
        </div>
        <ActionButton label="Enviar" disabled={!isValid} onClick={handleSubmit} />
      </DuotoneCard>
    </div>
  );
}

// ── TRANSITION ──────────────────────────────────────────────

export function TransitionStepView({ step, onNext }: { step: TransitionStep; onNext: () => void }) {
  const [visibleChars, setVisibleChars] = useState(0);
  const [done, setDone] = useState(false);
  const fullText = step.lines.join("\n");
  const totalChars = fullText.length;

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      const iv = setInterval(() => {
        if (cancelled) return;
        setVisibleChars((prev) => {
          if (prev >= totalChars) {
            clearInterval(iv);
            setDone(true);
            return totalChars;
          }
          return prev + 1;
        });
      }, 30);
    }, 300);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [totalChars]);

  const revealedText = fullText.slice(0, visibleChars);
  const revealedLines = revealedText.split("\n");

  return (
    <div className="flex flex-col flex-1 justify-center" style={{ color: "var(--dynamic-fg, #fff)" }}>
      <div className="min-h-[200px]">
        {revealedLines.map((line, i) => (
          <p key={i} className="font-['Fira_Code'] font-medium text-[14px] leading-[22px] whitespace-pre-wrap">
            {line === "" ? "\u00A0" : line}
          </p>
        ))}
      </div>
      <div className="mt-10">
        <ActionButton
          label="DALE"
          onClick={onNext}
          variant="pill"
          disabled={!done}
        />
      </div>
    </div>
  );
}

// ── MULTIPLIER / HANDLES ────────────────────────────────────

export function MultiplierHandlesStepView({
  step, positionBoost, onNext,
}: {
  step: MultiplierHandlesStep;
  positionBoost: number;
  onNext: (handles: Record<string, string>) => void;
}) {
  const [handles, setHandles] = useState<Record<string, string>>({});
  const filledCount = Object.values(handles).filter((v) => v.trim().length > 0).length;

  const totalBoost = step.handles.reduce((sum, h) => {
    return sum + (handles[h.id]?.trim() ? h.positionBoost : 0);
  }, 0);

  return (
    <div className="flex flex-col flex-1">
      <DuotoneCard>
        <div className="text-center mb-2">
          <h2 className="font-['Roboto'] font-bold text-[22px] leading-tight" style={{ color: "var(--dynamic-bg, #000)" }}>
            {step.title}
          </h2>
          <p className="font-['Fira_Code'] text-[12px] mt-2 opacity-60 whitespace-pre-wrap" style={{ color: "var(--dynamic-bg, #000)" }}>
            {step.subtitle}
          </p>
        </div>

        {/* Boost counter */}
        {(positionBoost + totalBoost) > 0 && (
          <CardPill>
            +{positionBoost + totalBoost} posiciones ganadas
          </CardPill>
        )}

        <div className="w-full flex flex-col gap-3">
          {step.handles.map((h) => (
            <div key={h.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-['Roboto'] font-medium text-[13px]" style={{ color: "var(--dynamic-bg, #000)" }}>
                  {h.label}
                </span>
                <span className="font-['Fira_Code'] text-[11px] opacity-50" style={{ color: "var(--dynamic-bg, #000)" }}>
                  +{h.positionBoost} pos
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-['Fira_Code'] text-[13px] shrink-0 opacity-40" style={{ color: "var(--dynamic-bg, #000)" }}>
                  {h.prefix}
                </span>
                <CardInput
                  value={handles[h.id] || ""}
                  onChange={(val) => setHandles((prev) => ({ ...prev, [h.id]: val }))}
                  placeholder={h.placeholder}
                  fontFamily="Fira_Code"
                  className="h-[42px] text-[14px]"
                />
              </div>
            </div>
          ))}
        </div>

        <ActionButton
          label={filledCount > 0 ? `Guardar (${filledCount})` : "Saltar"}
          onClick={() => {
            resetViewport();
            setTimeout(() => onNext(handles), 100);
          }}
        />
      </DuotoneCard>
    </div>
  );
}

// ── CLOSING ─────────────────────────────────────────────────

export function ClosingStepView({
  queuePosition, referralCode, positionBoost,
}: {
  queuePosition: number;
  referralCode: string;
  positionBoost: number;
}) {
  const [copied, setCopied] = useState(false);
  const referralLink = `https://t.me/BrutalDropBot?startapp=ref_${referralCode}`;
  const whatsappMsg = `Metete en BRUTAL. Es una app donde respondes preguntas anonimas y cobras cash real. Usa mi link y salto la fila: ${referralLink}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMsg)}`;

  const effectivePosition = Math.max(1, queuePosition - positionBoost);
  const barPercent = Math.max(5, Math.min(95, 100 - (effectivePosition / 2500) * 100));

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      hapticMedium();
      setTimeout(() => setCopied(false), 2000);
    } catch (_e) { /* clipboard unavailable */ }
  };

  return (
    <div className="flex flex-col flex-1 justify-center items-center">
      <h1 className="font-['Silkscreen'] text-[28px] text-center mb-4" style={{ color: "var(--dynamic-fg, #fff)" }}>
        Estas en la fila.
      </h1>

      <div className="w-full max-w-[340px] mb-6">
        <p className="font-['Fira_Code'] text-[14px] text-center mb-2" style={{ color: "var(--dynamic-fg, #fff)" }}>
          Tu posicion: <span className="font-bold">#{effectivePosition}</span>
        </p>
        <div className="w-full h-[8px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--dynamic-fg, #fff)", opacity: 0.15 }}>
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${barPercent}%`, backgroundColor: "var(--dynamic-fg, #fff)" }} />
        </div>
        {positionBoost > 0 && (
          <p className="font-['Fira_Code'] text-[11px] text-center mt-2 opacity-60" style={{ color: "var(--dynamic-fg, #fff)" }}>
            Saltaste {positionBoost} posiciones por completar tu perfil
          </p>
        )}
      </div>

      <div className="w-full max-w-[340px] mb-6">
        <p className="font-['Fira_Code'] text-[12px] opacity-60 text-center mb-4 leading-relaxed" style={{ color: "var(--dynamic-fg, #fff)" }}>
          Te vamos a escribir por WhatsApp cuando sea tu turno con un link para entrar a Telegram.
          Mientras tanto, cada amigo que invites y sea aceptado te sube 100 posiciones.
        </p>
      </div>

      {/* Share buttons */}
      <div className="w-full max-w-[340px] flex flex-col gap-3">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-[56px] rounded-full flex items-center justify-center active:scale-[0.98] transition-transform"
          style={{ backgroundColor: "#25D366" }}
          onClick={() => hapticMedium()}
        >
          <span className="font-['Roboto'] font-semibold text-[16px] text-white">
            INVITAR POR WHATSAPP
          </span>
        </a>

        <ActionButton label={copied ? "COPIADO" : "COPIAR MI LINK"} onClick={handleCopy} variant="outline" />
      </div>

      <p className="font-['Fira_Code'] text-[11px] opacity-30 mt-8 text-center" style={{ color: "var(--dynamic-fg, #fff)" }}>
        BRUTAL. No preguntamos para saber.{"\n"}Preguntamos para que cobres.
      </p>
    </div>
  );
}

// ── AGE REJECT SCREEN ───────────────────────────────────────

export function AgeRejectScreen({ message }: { message: string }) {
  return (
    <div className="flex flex-col flex-1 justify-center items-center px-6">
      <h1 className="font-['Silkscreen'] text-[22px] text-center mb-4" style={{ color: "var(--dynamic-fg, #fff)" }}>
        ://
      </h1>
      <p className="font-['Fira_Code'] text-[14px] text-center opacity-80 whitespace-pre-wrap" style={{ color: "var(--dynamic-fg, #fff)" }}>
        {message}
      </p>
    </div>
  );
}
