// ============================================================
// ONBOARDING APP — Main application form flow at /entrar
// ============================================================

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import svgPaths from "../../../imports/svg-mcipxppzoz";
import { initTelegramSDK, getTelegramUserId } from "../telegram-sdk";
import { getNextDuotonePair } from "../color-generator";
import { hapticMedium } from "../haptics";
import { ONBOARDING_STEPS, BOOST_PER_RAFAGA, BASE_QUEUE_MIN, BASE_QUEUE_MAX } from "./onboarding-data";
import { submitApplication } from "./onboarding-api";
import type { OnboardingStep, MultiplierHandlesStep, CompassRafagaStep } from "./onboarding-types";
import type { CompassRafaga, PairAnswer } from "./compass-types";
import { DEFAULT_RAFAGAS } from "./compass-data";
import { computeCompassVector, findArchetype } from "./compass-engine";
// API calls go to same-origin Hono server
import { RafagaEmojiQuestion } from "../rafaga-emoji-question";
import type { RafagaEmojiItem } from "../rafaga-emoji-question";
import { CompassReveal } from "./CompassReveal";
import {
  IntroStepView, PhoneStepView, TextInputStepView, AgeSelectorStepView,
  SingleChoiceStepView, NestedChoiceStepView, MultiSelectStepView,
  ScaleStepView, FreeTextStepView, TransitionStepView, MultiplierHandlesStepView,
  ClosingStepView, AgeRejectScreen,
} from "./OnboardingSteps";

// ── Progress bar ────────────────────────────────────────────

function OnboardingProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-[3px] w-full">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-[3px] flex-1 rounded-full transition-all duration-300"
          style={{
            backgroundColor: "var(--dynamic-fg, #fff)",
            opacity: i <= current ? 0.9 : 0.15,
          }}
        />
      ))}
    </div>
  );
}

// ── BRUTAL Logo (reused from splash) ────────────────────────

function BrutalLogoSmall() {
  return (
    <svg width="24" height="24" viewBox="0 0 41 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g>
        <path d={svgPaths.p129e0f00} fill="currentColor" />
        <path d={svgPaths.p28b23600} fill="currentColor" />
        <path d={svgPaths.p2de5a800} fill="currentColor" />
        <path d={svgPaths.pca92a80} fill="currentColor" />
        <path d={svgPaths.p1f938400} fill="currentColor" />
        <path d={svgPaths.p377956f0} fill="currentColor" />
        <path d={svgPaths.p1082f800} fill="currentColor" />
        <path d={svgPaths.pd01a700} fill="currentColor" />
        <path d={svgPaths.p14e44f00} fill="currentColor" />
        <path d={svgPaths.p31786300} fill="currentColor" />
        <path d={svgPaths.p10e83600} fill="currentColor" />
        <path d={svgPaths.p6a77000} fill="currentColor" />
      </g>
    </svg>
  );
}

// ── Main Component ──────────────────────────────────────────

export default function OnboardingApp() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [ageRejected, setAgeRejected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    queuePosition: number;
    referralCode: string;
  } | null>(null);
  const [positionBoost, setPositionBoost] = useState(0);
  const [duotoneColors, setDuotoneColors] = useState({ bg: "#000000", fg: "#FFFFFF" });
  const firstStepDone = useRef(false);

  // --- LÓGICA DE REANUDACIÓN ---
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    async function checkExistingProgress() {
      try {
        const initData = (window as any).Telegram?.WebApp?.initData || "";
        const tgUserId = getTelegramUserId();
        
        // Consultamos al backend en qué estado está el usuario
        const res = await fetch("/apply/init", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(initData ? { "X-Telegram-Init-Data": initData } : {})
          },
          body: JSON.stringify({ telegramUserId: tgUserId, phone: "telegram_verified" }) 
        });
        
        const data = await res.json();
        
        if (data.ok && data.resumed && data.onboardingStep >= 10) {
          // Buscamos cuál es el índice de la primera ráfaga (fase compass)
          const rafagaStartIndex = ONBOARDING_STEPS.findIndex(step => step.phase === "compass");
          
          if (rafagaStartIndex !== -1) {
            console.log(`[BRUTAL] 🔄 Usuario reanudado. Saltando al paso ${rafagaStartIndex} (Ráfagas)`);
            setStepIndex(rafagaStartIndex);
            checkpointSaved.current = true; // No queremos que dispare el checkpoint de nuevo
          }
        }
      } catch (err) {
        console.error("[BRUTAL] Error al chequear progreso:", err);
      } finally {
        setIsInitializing(false);
      }
    }

    checkExistingProgress();
  }, []);

  // Compass rafagas — fetched from server, fallback to defaults
  const [rafagas, setRafagas] = useState<CompassRafaga[]>(DEFAULT_RAFAGAS);

  // Fetch compass config from panel builder
  useEffect(() => {
    const API_BASE = "";  // Same origin
    fetch(`${API_BASE}/compass-config`, {
      headers: {
        "Content-Type": "application/json",
        // Public endpoint, no auth needed
      },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.rafagas && Array.isArray(data.rafagas) && data.rafagas.length > 0) {
          console.log(`[ONBOARDING] Loaded compass config from server: ${data.rafagas.length} rafagas`);
          setRafagas(data.rafagas);
        }
      })
      .catch((err) => console.warn("[ONBOARDING] Using default rafagas:", err));
  }, []);

  // Compass state
  const [compassAnswers, setCompassAnswers] = useState<Record<string, PairAnswer[]>>({});
  const compassResult = useMemo(() => {
    if (Object.keys(compassAnswers).length === 0) return null;
    const vector = computeCompassVector(rafagas, compassAnswers);
    const arch = findArchetype(vector);
    return { vector, ...arch };
  }, [compassAnswers, rafagas]);

  // Init Telegram SDK
  useEffect(() => { initTelegramSDK(); }, []);

  // Duotone sync
  useEffect(() => {
    document.body.style.setProperty("--dynamic-bg", duotoneColors.bg);
    document.body.style.setProperty("--dynamic-fg", duotoneColors.fg);
    document.body.style.backgroundColor = duotoneColors.bg;
    document.body.style.color = duotoneColors.fg;
  }, [duotoneColors]);

  const changeColors = useCallback(() => {
    if (!firstStepDone.current) return;
    const pair = getNextDuotonePair();
    setDuotoneColors({ bg: pair.bg, fg: pair.fg });
  }, []);

  // Change colors on step change
  useEffect(() => {
    changeColors();
  }, [stepIndex, changeColors]);

  const currentStep = ONBOARDING_STEPS[stepIndex];
  const totalSteps = ONBOARDING_STEPS.length;

  // --- CHECKPOINT DE DATOS DUROS ---
  const checkpointSaved = useRef(false);

  useEffect(() => {
    // Si el usuario llega a la fase "compass" (ráfagas) y no guardamos el checkpoint todavía
    if (currentStep && currentStep.phase === "compass" && !checkpointSaved.current) {
      checkpointSaved.current = true;
      
      const saveHardDataCheckpoint = async () => {
        try {
          const initData = (window as any).Telegram?.WebApp?.initData || "";
          const tgUserId = getTelegramUserId();
          
          // Apuntamos a /apply/init para NO disparar la finalización del embudo
          await fetch("/apply/init", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(initData ? { "X-Telegram-Init-Data": initData } : {})
            },
            body: JSON.stringify({
              telegramUserId: tgUserId,
              phone: answers.phone,
              nickname: answers.nickname,
              age: answers.age,
              gender: answers.gender,
              location: answers.location,
              phoneBrand: answers.phone_brand || answers.phoneBrand
            })
          });
          console.log("[BRUTAL] 💾 Checkpoint de datos duros guardado en Supabase");
        } catch (err) {
          console.error("[BRUTAL] ❌ Falló el guardado del checkpoint:", err);
        }
      };

      saveHardDataCheckpoint();
    }
  }, [currentStep, answers]);
  // ------------------------------------

  // Count progress (only A + compass steps for the bar)
  const questionSteps = ONBOARDING_STEPS.filter(
    (s) => s.phase === "A" || s.phase === "compass"
  );
  const currentQuestionIndex = questionSteps.indexOf(currentStep);
  const isQuestionStep = currentQuestionIndex >= 0;

  const advance = useCallback((id: string, value: any) => {
    // VALIDACIÓN: Solo revisamos si es un teléfono manual. Si viene de Telegram, lo dejamos pasar.
    if (id === "phone" && value !== "telegram_verified") {
      const clean = String(value).replace(/\D/g, "");
      if (clean.length < 10) {
        alert("Por favor ingresá un número de celular válido con código de área (ej: 11 2345 6789).");
        return; // Cortamos acá
      }
    }

    firstStepDone.current = true;
    setAnswers((prev) => ({ ...prev, [id]: value }));
    hapticMedium();
    if (stepIndex < totalSteps - 1) {
      setStepIndex((i) => i + 1);
    }
  }, [stepIndex, totalSteps]);

  const advanceNoValue = useCallback(() => {
    firstStepDone.current = true;
    hapticMedium();
    if (stepIndex < totalSteps - 1) {
      setStepIndex((i) => i + 1);
    }
  }, [stepIndex, totalSteps]);

  // Handle compass rafaga completion
  const handleRafagaComplete = useCallback((rafagaIndex: number, rawAnswers: (string | null)[]) => {
    const rafaga = rafagas[rafagaIndex];
    if (!rafaga) return;

    // Map raw emoji answers to PairAnswer format ("A", "B", or null)
    const mapped: PairAnswer[] = rafaga.pairs.map((pair, i) => {
      const raw = rawAnswers[i];
      if (raw === null) return null;
      if (raw === pair.optionA) return "A";
      if (raw === pair.optionB) return "B";
      return null;
    });

    setCompassAnswers((prev) => ({ ...prev, [rafaga.id]: mapped }));
    setPositionBoost((prev) => prev + BOOST_PER_RAFAGA);

    // Change colors between rafagas
    const pair = getNextDuotonePair();
    setDuotoneColors({ bg: pair.bg, fg: pair.fg });

    // Advance to next step
    firstStepDone.current = true;
    if (stepIndex < totalSteps - 1) {
      setStepIndex((i) => i + 1);
    }
  }, [stepIndex, totalSteps, rafagas]);

  // Submit application when reaching closing step
  useEffect(() => {
    if (currentStep && currentStep.type === "closing" && !submitResult && !submitting) {
      setSubmitting(true);
      const doSubmit = async () => {
        try {
          const basePosition = Math.floor(Math.random() * (BASE_QUEUE_MAX - BASE_QUEUE_MIN)) + BASE_QUEUE_MIN;
          const handlesData = answers.multiplier_handles || {};
          const handleBoost = Object.entries(handlesData).reduce((sum, [key, val]) => {
            if (typeof val === "string" && val.trim()) {
              const handleDef = (ONBOARDING_STEPS.find((s) => s.id === "multiplier_handles") as MultiplierHandlesStep)
                ?.handles.find((h) => h.id === key);
              return sum + (handleDef?.positionBoost || 0);
            }
            return sum;
          }, 0);

          const totalBoost = positionBoost + handleBoost;
          setPositionBoost(totalBoost);

          const referralCode = `app_${Date.now().toString(36)}`;

          const result = await submitApplication({
            phone: answers.phone || "",
            nickname: answers.nickname || "",
            age: answers.age || 0,
            gender: answers.gender || "",
            location: answers.location || "",
            phoneBrand: answers.phone_brand || "",
            spending: [],
            platforms: [],
            musicGenre: "",
            politicalStance: 0,
            toxicBrand: "",
            occupation: "",
            aspirational: "",
            financialStress: 0,
            confession: "",
            handles: {
              instagram: handlesData.instagram || undefined,
              tiktok: handlesData.tiktok || undefined,
              twitter: handlesData.twitter || undefined,
              spotify: handlesData.spotify || undefined,
            },
            referralCode,
            positionBoost: totalBoost,
            telegramUserId: getTelegramUserId(),
            compassVector: compassResult?.vector,
            compassArchetype: compassResult?.primary.id,
            compassPurity: compassResult?.purity,
            compassRaw: compassAnswers,
          });

          if (result.ok) {
            setSubmitResult({
              queuePosition: result.queuePosition || basePosition,
              referralCode: result.referralCode || referralCode,
            });
          } else {
            console.error("[ONBOARDING] Submit failed:", result.error);
            setSubmitResult({
              queuePosition: basePosition,
              referralCode,
            });
          }
        } catch (err) {
          console.error("[ONBOARDING] Submit error:", err);
          setSubmitResult({
            queuePosition: Math.floor(Math.random() * 1500) + 800,
            referralCode: `app_${Date.now().toString(36)}`,
          });
        } finally {
          setSubmitting(false);
        }
      };
      doSubmit();
    }
  }, [currentStep, submitResult, submitting, answers, positionBoost, compassResult, compassAnswers]);

  // ── Pantallas protectoras y de carga ────────────────────────────────────────────
  
  // Mostrar pantalla de carga mientras verificamos si hay que reanudar
  if (isInitializing) {
    return (
      <div className="h-dvh flex flex-col justify-center items-center font-['Roboto'] bg-black text-white">
        <div className="w-8 h-8 border-2 border-[#333] border-t-white rounded-full animate-spin mb-4" />
        <p className="font-['Fira_Code'] text-[12px] opacity-60">Cargando tu perfil...</p>
      </div>
    );
  }

  if (ageRejected) {
    return (
      <div
        className="h-dvh flex justify-center font-['Roboto'] overflow-hidden"
        style={{ backgroundColor: duotoneColors.bg, color: duotoneColors.fg }}
      >
        <div className="w-full max-w-[420px] flex flex-col h-dvh px-5"
          style={{ paddingTop: "calc(var(--tg-safe-top, 0px) + 24px)", paddingBottom: "calc(var(--tg-safe-bottom, 0px) + 24px)" }}>
          <AgeRejectScreen message={ageRejected} />
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────

  const renderStep = () => {
    switch (currentStep.type) {
      case "intro":
        return <IntroStepView step={currentStep} onNext={advanceNoValue} />;

      case "phone":
        return <PhoneStepView step={currentStep} onNext={(val) => advance("phone", val)} />;

      case "text_input":
        return <TextInputStepView step={currentStep} onNext={(val) => advance(currentStep.id, val)} />;

      case "age_selector":
        return (
          <AgeSelectorStepView
            step={currentStep}
            onNext={(val) => advance("age", val)}
            onReject={(msg) => setAgeRejected(msg)}
          />
        );

      case "single_choice":
        return <SingleChoiceStepView step={currentStep} onNext={(val) => advance(currentStep.id, val)} />;

      case "nested_choice":
        return <NestedChoiceStepView step={currentStep} onNext={(val) => advance(currentStep.id, val)} />;

      case "multi_select":
        return <MultiSelectStepView step={currentStep} onNext={(val) => advance(currentStep.id, val)} />;

      case "scale":
        return <ScaleStepView step={currentStep} onNext={(val) => advance(currentStep.id, val)} />;

      case "free_text":
        return <FreeTextStepView step={currentStep} onNext={(val) => advance(currentStep.id, val)} />;

      case "transition":
        return <TransitionStepView step={currentStep} onNext={advanceNoValue} />;

      case "compass_rafaga": {
        const rafagaStep = currentStep as CompassRafagaStep;
        const rafaga = rafagas[rafagaStep.rafagaIndex];
        if (!rafaga) return null;

        // Convert CompassPairs to RafagaEmojiItems
        const items: RafagaEmojiItem[] = rafaga.pairs.map((p) => ({
          text: p.text,
          optionA: p.optionA,
          optionB: p.optionB,
        }));

        return (
          <RafagaEmojiQuestion
            key={`rafaga-${rafaga.id}`}
            promptBold={rafaga.promptBold}
            items={items}
            secondsPerItem={rafaga.secondsPerItem}
            onComplete={(rawAnswers) => handleRafagaComplete(rafagaStep.rafagaIndex, rawAnswers)}
          />
        );
      }

      case "compass_reveal": {
        if (!compassResult) {
          return (
            <div className="flex flex-col flex-1 justify-center items-center">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "var(--dynamic-fg, #fff)", borderTopColor: "transparent" }} />
            </div>
          );
        }
        return (
          <CompassReveal
            vector={compassResult.vector}
            primary={compassResult.primary}
            secondary={compassResult.secondary}
            purity={compassResult.purity}
            onContinue={advanceNoValue}
          />
        );
      }

      case "multiplier_handles":
        return (
          <MultiplierHandlesStepView
            step={currentStep}
            positionBoost={positionBoost}
            onNext={(handles) => advance("multiplier_handles", handles)}
          />
        );

      case "closing":
        if (submitting || !submitResult) {
          return (
            <div className="flex flex-col flex-1 justify-center items-center">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "var(--dynamic-fg, #fff)", borderTopColor: "transparent" }} />
              <p className="font-['Fira_Code'] text-[12px] mt-4 opacity-60" style={{ color: "var(--dynamic-fg, #fff)" }}>
                Procesando tu aplicacion...
              </p>
            </div>
          );
        }
        return (
          <ClosingStepView
            queuePosition={submitResult.queuePosition}
            referralCode={submitResult.referralCode}
            positionBoost={positionBoost}
          />
        );

      default:
        return null;
    }
  };

  // Steps that use full-bleed layout (no progress bar / header)
  const isFullBleed = currentStep.type === "intro" || currentStep.type === "transition"
    || currentStep.type === "closing" || currentStep.type === "compass_rafaga"
    || currentStep.type === "compass_reveal" || currentStep.type === "multiplier_handles"; // Añadido multiplier_handles para mantener el diseño limpio de Figma Make

  return (
    <div
      className="h-dvh flex justify-center font-['Roboto'] overflow-hidden"
      style={{ backgroundColor: duotoneColors.bg, color: duotoneColors.fg }}
    >
      <div
        className="w-full max-w-[420px] flex flex-col h-dvh px-5 overflow-hidden"
        style={{
          paddingTop: "calc(var(--tg-safe-top, 0px) + 24px)",
          paddingBottom: "calc(var(--tg-safe-bottom, 0px) + 24px)",
        }}
      >
        {/* Header — hidden on full bleed screens */}
        {!isFullBleed && (
          <>
            {/* Progress Bar */}
            {isQuestionStep && (
              <div className="w-full mb-3">
                <OnboardingProgressBar current={currentQuestionIndex} total={questionSteps.length} />
              </div>
            )}

            {/* Brand */}
            <div className="flex items-center gap-2 mb-5">
              <div style={{ color: duotoneColors.fg }}>
                <BrutalLogoSmall />
              </div>
              <span className="font-['Silkscreen'] text-[12px] tracking-wide" style={{ color: duotoneColors.fg }}>
                BRUTAL////////////////
              </span>
              {positionBoost > 0 && (
                <span
                  className="font-['Fira_Code'] text-[10px] px-2 py-0.5 rounded-full font-bold ml-auto"
                  style={{ color: duotoneColors.fg, backgroundColor: `${duotoneColors.fg}1a` }}
                >
                  +{positionBoost} pos
                </span>
              )}
            </div>
          </>
        )}

        {/* Step Content */}
        <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
