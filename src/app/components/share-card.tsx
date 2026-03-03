import { useRef, useState, useCallback } from "react";
import { hapticHeavy, hapticSuccess } from "./haptics";

/**
 * ShareCard — Canvas-rendered archetype card for sharing.
 *
 * Renders the archetype result as a styled card, captures it to
 * a canvas image, and shares via Telegram or native share API.
 */

interface ShareCardProps {
  /** Archetype title (supports \n) */
  title: string;
  /** Archetype description */
  description: string;
  /** Drop name */
  dropName: string;
  /** Signal metrics */
  metrics: {
    latency: string;
    instinctiveResponses: string;
    totalTime: string;
  };
  /** Referral link for the bot */
  referralLink?: string;
  /** Shareable web URL showing the result */
  shareUrl?: string;
}

// ── Canvas rendering ─────────────────────────────────────

function drawShareCard(
  canvas: HTMLCanvasElement,
  props: ShareCardProps
): Promise<Blob | null> {
  const W = 720;
  const H = 1280;
  const PADDING = 48;
  const ctx = canvas.getContext("2d")!;
  canvas.width = W;
  canvas.height = H;

  // Background
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  // Top border line
  ctx.fillStyle = "#fff";
  ctx.fillRect(PADDING, 80, W - PADDING * 2, 2);

  // Brand
  ctx.fillStyle = "#fff";
  ctx.font = "bold 22px 'Silkscreen', monospace";
  ctx.fillText("BRUTAL////////////////", PADDING, 130);

  // Drop name
  ctx.font = "14px 'Fira Code', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(props.dropName, PADDING, 160);

  // White card area
  const cardY = 200;
  const cardH = 560;
  const cardR = 30;

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(PADDING, cardY, W - PADDING * 2, cardH, cardR);
  ctx.fill();

  // "Tu perfil" pill
  const pillX = PADDING + 28;
  const pillY = cardY + 32;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, 100, 30, 15);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px 'Roboto', sans-serif";
  ctx.fillText("Tu perfil", pillX + 18, pillY + 20);

  // Title (multiline)
  const titleLines = props.title.split("\n");
  ctx.fillStyle = "#000";
  ctx.font = "bold 42px 'Roboto', sans-serif";
  let titleY = cardY + 100;
  for (const line of titleLines) {
    ctx.fillText(line, PADDING + 28, titleY);
    titleY += 52;
  }

  // Description (word-wrapped)
  ctx.font = "16px 'Roboto', sans-serif";
  ctx.fillStyle = "#000";
  const maxLineW = W - PADDING * 2 - 56;
  const descLines = wrapText(ctx, props.description, maxLineW);
  let descY = titleY + 20;
  for (const line of descLines) {
    ctx.fillText(line, PADDING + 28, descY);
    descY += 24;
  }

  // Signal metrics below card
  const metricsY = cardY + cardH + 40;
  ctx.fillStyle = "#fff";
  ctx.font = "bold 15px 'Fira Code', monospace";
  ctx.fillText("Signal metrics", PADDING, metricsY);

  ctx.font = "14px 'Fira Code', monospace";
  const metricItems = [
    ["Latencia promedio", props.metrics.latency],
    ["Respuestas instintivas", props.metrics.instinctiveResponses],
    ["Tiempo total", props.metrics.totalTime],
  ];
  let mY = metricsY + 32;
  for (const [label, value] of metricItems) {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText(`> ${label}:`, PADDING, mY);
    ctx.fillStyle = "#fff";
    const valueW = ctx.measureText(value).width;
    ctx.fillText(value, W - PADDING - valueW, mY);

    // Dashed line
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(PADDING, mY + 8);
    ctx.lineTo(W - PADDING, mY + 8);
    ctx.stroke();
    ctx.setLineDash([]);

    mY += 36;
  }

  // Bottom CTA
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "13px 'Fira Code', monospace";
  const ctaText = "Descubrí tu señal → t.me/BBBrutalbot";
  const ctaW = ctx.measureText(ctaText).width;
  ctx.fillText(ctaText, (W - ctaW) / 2, H - 60);

  // Bottom border
  ctx.fillStyle = "#fff";
  ctx.fillRect(PADDING, H - 40, W - PADDING * 2, 2);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 1.0);
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ── Share logic ────────���─────────────────────────────────

async function shareImage(blob: Blob, referralLink?: string, shareUrl?: string) {
  const file = new File([blob], "brutal-resultado.png", { type: "image/png" });

  // Try native share API first (works in many mobile browsers)
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "BRUTAL////////////////",
        text: referralLink
          ? `Mi resultado en BRUTAL. Descubrí el tuyo → ${referralLink}`
          : "Mi resultado en BRUTAL////////////////",
      });
      return true;
    } catch (_e) {
      // User cancelled or share failed
    }
  }

  // Fallback: try Telegram's share
  if (referralLink) {
    try {
      const wa = window.Telegram?.WebApp;
      if (wa?.switchInlineQuery) {
        wa.switchInlineQuery("Mi resultado en BRUTAL", ["users", "groups"]);
        return true;
      }
      // Fallback: open share URL
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("Descubrí tu señal en BRUTAL////////////////")}`;
      window.open(shareUrl, "_blank");
      return true;
    } catch (_e) {
      // fallback below
    }
  }

  // Last fallback: download the image
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "brutal-resultado.png";
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

// ── Component ────────────────────────────────────────────

export function ShareCard(props: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);

  const handleShare = useCallback(async () => {
    if (sharing || !canvasRef.current) return;
    setSharing(true);
    hapticHeavy();

    try {
      const blob = await drawShareCard(canvasRef.current, props);
      if (blob) {
        await shareImage(blob, props.referralLink, props.shareUrl);
        hapticSuccess();
        setShared(true);
      }
    } catch (_e) {
      // silent
    } finally {
      setSharing(false);
    }
  }, [props, sharing]);

  return (
    <>
      {/* Hidden canvas for rendering */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Share button */}
      <button
        onClick={handleShare}
        disabled={sharing}
        className="w-full max-w-[290px] h-[60px] rounded-full flex items-center justify-center select-none active:scale-[0.98] transition-transform duration-150 gap-2"
        style={{ backgroundColor: "var(--dynamic-bg, #000)" }}
      >
        {shared ? (
          <span className="font-['Roboto'] font-semibold text-[17px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
            Compartido
          </span>
        ) : sharing ? (
          <span className="font-['Roboto'] font-semibold text-[17px] opacity-60" style={{ color: "var(--dynamic-fg, #fff)" }}>
            Generando...
          </span>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--dynamic-fg, white)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span className="font-['Roboto'] font-semibold text-[17px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
              Compartir resultado
            </span>
          </>
        )}
      </button>
    </>
  );
}