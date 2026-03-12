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

// ── PHONE INPUT (Solo Telegram Estricto) ─────────────────────────

export function PhoneStepView({ step, onNext }: { step: PhoneStep; onNext: (val: string) => void }) {
  const handleTelegramContact = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.requestContact) {
      tg.requestContact((shared: boolean) => {
        if (shared) {
          resetViewport();
          setTimeout(() => onNext("telegram_verified"), 150);
        } else {
          // Si el usuario cancela, cerramos la mini app sin dejarlo avanzar
          tg.close();
        }
      });
    } else {
      // Fallback para entornos donde no hay SDK de Telegram
      alert("Por favor, abrí esta app desde la versión más reciente de Telegram.");
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <DuotoneCard>
        <CardTitle size="md">{step.copy || "Tu número de celular.\nEl único dato personal que pedimos."}</CardTitle>
        <div className="w-full mt-4">
          <ActionButton label="Continuar con Telegram" onClick={handleTelegramContact} />
        </div>
      </DuotoneCard>
    </div>
  );
}

// ── TEXT INPUT ───────────────────────────────────────────────

export function TextInputStepView({ step, onNext }: { step: TextInputStep; onNext: (val: string) => void }) {
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
      <DuotoneCard>
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

export function AgeSelectorStepView({ step, onNext, onReject }: { step: AgeSelectorStep; onNext: (val: number) => void; onReject: (msg: string) => void }) {
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
      <DuotoneCard>
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

export function SingleChoiceStepView({ step, onNext }: { step: SingleChoiceStep; onNext: (val: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (opt: string) => {
    if (selected) return;
    setSelected(opt);
    setTimeout(() => onNext(opt), 350);
  };

  return (
    <div className="flex flex-col flex-1">
      <DuotoneCard>
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

export function NestedChoiceStepView({ step, onNext }: { step: NestedChoiceStep; onNext: (val: string) => void }) {
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
        <DuotoneCard>
          <CardTitle size="md">{`${selectedParent} — ¿Donde?`}</CardTitle>
          <div className="w-full flex flex-col gap-[10px] max-h-[380px] overflow-y-auto">
            {parentOpt!.subOptions!.map((sub) => (
              <OptionButton
                key={sub}
                selected={selectedSub === sub}
                onClick={() => handleSub(sub)}
                height="md"
              >
                {sub}
              </OptionButton>
            ))}
          </div>
          <button
            onClick={() => { setSelectedParent(null); setSelectedSub(null); setLocked(false); }}
            className="mt-4 text-[14px] font-semibold opacity-60 font-['Roboto']"
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
      <DuotoneCard>
        <CardTitle size="md">{step.copy}</CardTitle>
        <div className="w-full flex flex-col gap-[10px]">
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

// ── MULTI SELECT INPUT (Estilo Lista Vertical con Validación) ───────────────

export function MultiSelectStepView({ step, onNext }: { step: any; onNext: (val: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (optId: string) => {
    setSelected((prev) => {
      if (prev.includes(optId)) return prev.filter((x) => x !== optId);
      if (step.maxSelections && prev.length >= step.maxSelections) return prev;
      return [...prev, optId];
    });
  };

  const isValid = selected.length > 0;

  return (
    <div className="flex flex-col flex-1">
      <DuotoneCard>
        <CardTitle size="md">{step.copy || step.prompt}</CardTitle>
        
        {step.maxSelections && (
          <p 
            className="text-center font-['Fira_Code'] text-[12px] opacity-60 mt-1 mb-4" 
            style={{ color: "var(--dynamic-bg, #000)" }}
          >
            {selected.length}/{step.maxSelections} max
          </p>
        )}

        <div className="flex flex-col gap-3 w-full">
          {step.options.map((opt: any) => {
            const isSel = selected.includes(opt.id || opt);
            const label = opt.label || opt;
            const val = opt.id || opt;
            const isMaxedOut = !isSel && step.maxSelections && selected.length >= step.maxSelections;

            return (
              <button
                key={val}
                onClick={() => toggle(val)}
                disabled={isMaxedOut}
                className="w-full text-left px-5 py-4 rounded-xl font-['Roboto'] font-bold text-[16px] transition-all flex justify-between items-center"
                style={{
                  border: "2px solid var(--dynamic-bg, #000)",
                  backgroundColor: isSel ? "var(--dynamic-bg, #000)" : "transparent",
                  color: isSel ? "var(--dynamic-fg, #fff)" : "var(--dynamic-bg, #000)",
                  opacity: isMaxedOut ? 0.2 : (isSel ? 1 : 0.6),
                }}
              >
                <span>{label}</span>
                
                {/* Icono de Checkmark */}
                {isSel && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        <div className="w-full mt-8">
          <button
            onClick={() => isValid && onNext(selected)}
            disabled={!isValid}
            className={`w-full h-[60px] rounded-[12px] font-['Roboto'] font-bold text-[18px] transition-all shadow-lg ${
              isValid ? "active:scale-95" : "opacity-20 cursor-not-allowed"
            }`}
            style={{
              backgroundColor: "var(--dynamic-bg, #000)",
              color: "var(--dynamic-fg, #fff)"
            }}
          >
            Siguiente
          </button>
        </div>
      </DuotoneCard>
    </div>
  );
}
// ── SCALE ───────────────────────────────────────────────────

export function ScaleStepView({ step, onNext }: { step: ScaleStep; onNext: (val: number) => void }) {
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (val: number) => {
    if (selected !== null) return;
    setSelected(val);
    hapticLight();
    setTimeout(() => onNext(val), 400);
  };

  return (
    <div className="flex flex-col flex-1">
      <DuotoneCard>
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

export function FreeTextStepView({ step, onNext }: { step: FreeTextStep; onNext: (val: string) => void }) {
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
      <DuotoneCard>
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
      {/* Title */}
      <h2
        className="font-['Roboto'] font-bold text-[24px] text-center leading-tight mb-2"
        style={{ color: "var(--dynamic-fg, #fff)" }}
      >
        {step.title}
      </h2>
      <div
        className="text-center mb-6"
        style={{ color: "var(--dynamic-fg, #fff)" }}
      >
        <p className="font-['Roboto'] text-[14px] leading-[22px]">
          Cada campo completo suma posiciones
        </p>
        <p className="font-['Roboto'] text-[14px] leading-[22px]">
          Mas datos = mejor perfil = mejores drops
        </p>
      </div>

      {/* Handle inputs */}
      <div className="w-full flex flex-col gap-5 mb-6">
        {step.handles.map((h) => (
          <div key={h.id}>
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="font-['Roboto'] font-semibold text-[14px]"
                style={{ color: "var(--dynamic-fg, #fff)" }}
              >
                {h.label}
              </span>
              <span
                className="font-['Roboto'] text-[14px]"
                style={{ color: "var(--dynamic-fg, #fff)" }}
              >
                + {h.positionBoost} pos
              </span>
            </div>
            <div
              className="w-full h-[54px] rounded-[14px] border-2 flex items-center px-4"
              style={{ borderColor: "var(--dynamic-fg, #fff)" }}
            >
              <input
                type="text"
                value={handles[h.id] || ""}
                onChange={(e) => setHandles((prev) => ({ ...prev, [h.id]: e.target.value }))}
                placeholder={h.placeholder}
                className="w-full bg-transparent outline-none font-['Roboto'] font-medium text-[16px]"
                style={{
                  color: "var(--dynamic-fg, #fff)",
                  caretColor: "var(--dynamic-fg, #fff)",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Boost pill */}
      {(positionBoost + totalBoost) > 0 && (
        <div className="flex justify-center mb-6">
          <div
            className="px-4 py-1.5 rounded-[21px] flex items-center gap-1.5"
            style={{ backgroundColor: "var(--dynamic-fg, #fff)" }}
          >
            <span
              className="font-['Fira_Code'] font-semibold text-[10px] tracking-tight"
              style={{ color: "var(--dynamic-bg, #000)" }}
            >
              + {positionBoost + totalBoost} posiciones ganadas
            </span>
          </div>
        </div>
      )}

      {/* Continue button — pushed to bottom */}
      <div className="mt-auto mb-4">
        <button
          onClick={() => {
            resetViewport();
            setTimeout(() => onNext(handles), 100);
          }}
          className="w-full h-[60px] rounded-[14px] flex items-center justify-center active:scale-[0.98] transition-transform"
          style={{ backgroundColor: "var(--dynamic-fg, #fff)" }}
        >
          <span
            className="font-['Roboto'] font-semibold text-[21px]"
            style={{ color: "var(--dynamic-bg, #000)" }}
          >
            {filledCount > 0 ? "Continuar" : "Saltar"}
          </span>
        </button>
      </div>
    </div>
  );
}

// ── CLOSING (Modo Auto-Active y Jugar Directo) ─────────────────────────────

export function ClosingStepView() {
  const handlePlay = () => {
    // Lo mandamos directo a la raíz (el juego)
    window.location.href = "/";
  };

  return (
    <div className="flex flex-col flex-1 justify-center items-center px-6 py-6">
      <div className="flex flex-col items-center justify-center w-full max-w-[332px]">
        
        {/* Title con fuente Silkscreen */}
        <h1
          className="font-['Silkscreen'] text-[34px] uppercase text-center mb-6 leading-tight"
          style={{ color: "var(--dynamic-fg, #fff)" }}
        >
          ¡Estás Adentro!
        </h1>

        {/* Description */}
        <div className="text-center mb-10">
          <p
            className="font-['Roboto'] text-[18px] leading-[24px] mb-4 font-bold"
            style={{ color: "var(--dynamic-fg, #fff)" }}
          >
            Tu perfil fue aprobado automáticamente.
          </p>
          <p
            className="font-['Roboto'] text-[16px] leading-[22px]"
            style={{ color: "var(--dynamic-fg, #fff)", opacity: 0.8 }}
          >
            Ya tenés tu primer Drop esperándote para ganar cash y tickets.
          </p>
        </div>

        {/* Botón (sin mt-auto para que flote en el centro con el texto) */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={handlePlay}
            className="w-full h-[64px] rounded-[12px] flex items-center justify-center active:scale-[0.98] transition-transform shadow-lg"
            style={{ backgroundColor: "var(--dynamic-fg, #fff)" }}
          >
            <span
              className="font-['Roboto'] font-bold text-[21px]"
              style={{ color: "var(--dynamic-bg, #000)" }}
            >
              Jugar Drop
            </span>
          </button>
        </div>

      </div>
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
