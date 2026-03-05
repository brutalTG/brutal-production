import { useState, useEffect } from "react";

/**
 * SharedResultPage — Landing page for shared results.
 *
 * URL format: ?view=result&t=Title&d=Description&drop=DropName
 *
 * Shows the friend's archetype result with a provocative CTA
 * that links to the external onboarding landing.
 */

interface SharedResultData {
  title: string;
  description: string;
  dropName: string;
  metrics?: {
    latency?: string;
    totalTime?: string;
  };
}

const CTA_PHRASES = [
  "¿Vos qué señal emitís?",
  "Tu turno. Sin anestesia.",
  "¿Te animás a descubrir tu perfil?",
  "Tu amigo ya tiene señal. ¿Y vos?",
  "20 preguntas. Sin filtro. ¿Te animás?",
];

function pickCTA(): string {
  return CTA_PHRASES[Math.floor(Math.random() * CTA_PHRASES.length)];
}

/** Parse shared result data from URL search params */
export function parseSharedResult(): SharedResultData | null {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") !== "result") return null;

    const title = params.get("t");
    const description = params.get("d");
    const dropName = params.get("drop");

    if (!title) return null;

    return {
      title: title.replace(/\\n/g, "\n"),
      description: description || "",
      dropName: dropName || "BRUTAL",
      metrics: {
        latency: params.get("lat") || undefined,
        totalTime: params.get("tt") || undefined,
      },
    };
  } catch (_e) {
    return null;
  }
}

/** Generate a shareable URL with result data encoded */
export function buildShareUrl(data: {
  title: string;
  description: string;
  dropName: string;
  latency?: string;
  totalTime?: string;
}): string {
  const base = window.location.origin + window.location.pathname;
  const params = new URLSearchParams();
  params.set("view", "result");
  params.set("t", data.title);
  params.set("d", data.description);
  params.set("drop", data.dropName);
  if (data.latency) params.set("lat", data.latency);
  if (data.totalTime) params.set("tt", data.totalTime);
  return `${base}?${params.toString()}`;
}

// External landing URL — replace with actual onboarding URL
const ONBOARDING_URL = "https://t.me/BrutalDropBot";

export function SharedResultPage({ data }: { data: SharedResultData }) {
  const [cta] = useState(pickCTA);
  const [animPhase, setAnimPhase] = useState(0);

  // Staggered entrance animation
  useEffect(() => {
    const t1 = setTimeout(() => setAnimPhase(1), 200);
    const t2 = setTimeout(() => setAnimPhase(2), 600);
    const t3 = setTimeout(() => setAnimPhase(3), 1000);
    const t4 = setTimeout(() => setAnimPhase(4), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  const titleLines = data.title.split("\n");

  const handleCTA = () => {
    window.open(ONBOARDING_URL, "_blank");
  };

  return (
    <div className="h-dvh bg-[#000] flex justify-center font-['Roboto'] overflow-hidden">
      <style>{`
        @keyframes sr-fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sr-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes sr-slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div
        className="w-full max-w-[420px] flex flex-col h-dvh px-5 overflow-y-auto"
        style={{
          paddingTop: "calc(var(--tg-safe-top, 0px) + 32px)",
          paddingBottom: "calc(var(--tg-safe-bottom, 0px) + 32px)",
        }}
      >
        {/* Brand header */}
        <div
          className="mb-2"
          style={{
            opacity: animPhase >= 0 ? 1 : 0,
            animation: animPhase >= 0 ? "sr-fadeUp 0.6s ease-out" : "none",
          }}
        >
          <div className="h-[2px] bg-[#fff] w-full mb-3" />
          <span className="font-['Silkscreen'] text-[#fff] text-sm tracking-wide">
            BRUTAL////////////////
          </span>
        </div>

        {/* Drop name */}
        <div
          className="mb-1"
          style={{
            opacity: animPhase >= 0 ? 1 : 0,
            animation: animPhase >= 0 ? "sr-fadeUp 0.6s 0.1s ease-out both" : "none",
          }}
        >
          <span className="font-['Fira_Code'] text-[#fff]/50 text-[13px]">
            {data.dropName}
          </span>
        </div>

        {/* "Tu amigo obtuvo:" label */}
        <div
          className="mt-6 mb-3"
          style={{
            opacity: animPhase >= 1 ? 1 : 0,
            animation: animPhase >= 1 ? "sr-fadeUp 0.5s ease-out" : "none",
          }}
        >
          <span className="font-['Fira_Code'] text-[#fff]/40 text-[12px] tracking-wider uppercase">
            Tu amigo obtuvo:
          </span>
        </div>

        {/* White card with result */}
        <div
          className="w-full bg-[#fff] rounded-[30px] flex flex-col px-7 pt-8 pb-8 shadow-lg"
          style={{
            opacity: animPhase >= 1 ? 1 : 0,
            animation: animPhase >= 1 ? "sr-fadeUp 0.6s ease-out" : "none",
          }}
        >
          {/* Pill */}
          <div className="flex mb-5">
            <div className="bg-[#000] text-[#fff] px-4 py-1.5 rounded-full font-['Roboto'] font-semibold text-[12px]">
              Resultado
            </div>
          </div>

          {/* Archetype title */}
          <div className="mb-4">
            {titleLines.map((line, i) => (
              <h1
                key={i}
                className="font-['Roboto'] font-bold text-[#000] text-[38px] leading-[1.1]"
                style={{
                  opacity: animPhase >= 2 ? 1 : 0,
                  animation: animPhase >= 2 ? `sr-slideIn 0.4s ${i * 100}ms ease-out both` : "none",
                }}
              >
                {line}
              </h1>
            ))}
          </div>

          {/* Description */}
          <p
            className="font-['Roboto'] text-[#000]/70 text-[15px] leading-[1.5]"
            style={{
              opacity: animPhase >= 2 ? 1 : 0,
              animation: animPhase >= 2 ? "sr-fadeUp 0.5s 0.2s ease-out both" : "none",
            }}
          >
            {data.description}
          </p>
        </div>

        {/* Metrics (if available) */}
        {data.metrics?.latency && (
          <div
            className="mt-5 px-2"
            style={{
              opacity: animPhase >= 3 ? 1 : 0,
              animation: animPhase >= 3 ? "sr-fadeUp 0.5s ease-out" : "none",
            }}
          >
            <div className="flex justify-between font-['Fira_Code'] text-[13px]">
              <span className="text-[#fff]/40">Latencia promedio:</span>
              <span className="text-[#fff]/80">{data.metrics.latency}</span>
            </div>
            {data.metrics.totalTime && (
              <div className="flex justify-between font-['Fira_Code'] text-[13px] mt-1">
                <span className="text-[#fff]/40">Tiempo total:</span>
                <span className="text-[#fff]/80">{data.metrics.totalTime}</span>
              </div>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1 min-h-8" />

        {/* CTA block */}
        <div
          className="flex flex-col items-center gap-5 mt-6"
          style={{
            opacity: animPhase >= 4 ? 1 : 0,
            animation: animPhase >= 4 ? "sr-fadeUp 0.6s ease-out" : "none",
          }}
        >
          {/* Provocative line */}
          <p className="font-['Roboto'] font-bold text-[#fff] text-[22px] text-center leading-tight">
            {cta}
          </p>

          {/* CTA button */}
          <button
            onClick={handleCTA}
            className="w-full max-w-[300px] h-[60px] bg-[#fff] rounded-full flex items-center justify-center select-none active:scale-[0.97] transition-transform duration-150"
            style={{
              animation: "sr-pulse 2s ease-in-out infinite 2s",
            }}
          >
            <span className="font-['Roboto'] font-bold text-[#000] text-[18px]">
              Descubrir mi señal
            </span>
          </button>

          {/* Subtle sub-text */}
          <span className="font-['Fira_Code'] text-[#fff]/30 text-[11px] text-center">
            20 preguntas · 3 min · sin registro
          </span>
        </div>

        {/* Bottom border */}
        <div className="h-[2px] bg-[#fff]/20 w-full mt-8" />
      </div>
    </div>
  );
}
