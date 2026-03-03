// ============================================================
// BRUTAL UI — Centralized shared primitives for Survey + Onboarding
// ============================================================
// All duotone-themed UI elements live here. Both the main survey
// question components and the onboarding steps import from this
// file, ensuring consistent styling across the entire app.
//
// CSS convention: all colors use CSS custom properties:
//   --dynamic-bg  = background (dark in duotone pair)
//   --dynamic-fg  = foreground (light in duotone pair)
// These are set on <body> by color-generator.ts and swapped per screen.
// ============================================================

import { type ReactNode } from "react";
import svgPaths from "../../imports/svg-mcipxppzoz";
import { hapticMedium, hapticLight } from "./haptics";

// ── DuotoneLayout ───────────────────────────────────────────
// Outermost wrapper for any duotone screen (survey, onboarding, reveal).
// Centers a max-w-[420px] column with safe area padding.

interface DuotoneLayoutProps {
  children: ReactNode;
  className?: string;
}

export function DuotoneLayout({ children, className = "" }: DuotoneLayoutProps) {
  return (
    <div
      className={`h-dvh flex justify-center font-['Roboto'] overflow-hidden ${className}`}
      style={{ backgroundColor: "var(--dynamic-bg, #000)", color: "var(--dynamic-fg, #fff)" }}
    >
      <div
        className="w-full max-w-[420px] flex flex-col h-dvh px-5 overflow-hidden"
        style={{
          paddingTop: "calc(var(--tg-safe-top, 0px) + 24px)",
          paddingBottom: "calc(var(--tg-safe-bottom, 0px) + 24px)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── DuotoneCard ─────────────────────────────────────────────
// The inverted-color rounded card used by all question types
// and onboarding steps. bg = dynamic-fg (inverted).

interface DuotoneCardProps {
  children: ReactNode;
  /** Optional hint/badge text shown at top of card */
  hint?: string;
  className?: string;
}

export function DuotoneCard({ children, hint, className = "" }: DuotoneCardProps) {
  return (
    <div
      className={`w-full rounded-[30px] flex flex-col items-center px-5 pt-6 pb-6 shadow-lg mx-auto ${className}`}
      style={{ backgroundColor: "var(--dynamic-fg, #fff)" }}
    >
      {hint && <CardPill>{hint}</CardPill>}
      {children}
    </div>
  );
}

// ── CardPill ────────────────────────────────────────────────
// Small rounded badge inside a DuotoneCard (e.g. "Elegi una", "FASE A - 2/6").
// bg = dynamic-bg (dark), text = dynamic-fg (light).

interface CardPillProps {
  children: ReactNode;
  className?: string;
}

export function CardPill({ children, className = "" }: CardPillProps) {
  return (
    <div
      className={`px-5 py-1.5 rounded-full font-['Roboto'] font-semibold text-[13px] shadow-sm mb-5 tracking-[-0.14px] ${className}`}
      style={{ backgroundColor: "var(--dynamic-bg, #000)", color: "var(--dynamic-fg, #fff)" }}
    >
      {children}
    </div>
  );
}

// ── CardTitle ───────────────────────────────────────────────
// Bold question/copy text inside a DuotoneCard.
// color = dynamic-bg (dark text on light card).

interface CardTitleProps {
  children: ReactNode;
  className?: string;
  /** Font size override. Default: 24px for survey, use 22px for onboarding */
  size?: "sm" | "md" | "lg";
}

const TITLE_SIZES = {
  sm: "text-[20px]",
  md: "text-[22px]",
  lg: "text-[24px]",
};

export function CardTitle({ children, className = "", size = "lg" }: CardTitleProps) {
  return (
    <div className={`text-center mb-6 px-2 ${className}`}>
      <h2
        className={`font-['Roboto'] font-bold leading-tight whitespace-pre-wrap ${TITLE_SIZES[size]}`}
        style={{ color: "var(--dynamic-bg, #000)" }}
      >
        {children}
      </h2>
    </div>
  );
}

// ── OptionButton ────────────────────────────────────────────
// Selectable option button used in choice questions and onboarding.
// Inverts colors when selected. Consistent height and styling.

interface OptionButtonProps {
  children: ReactNode;
  selected?: boolean;
  onClick: () => void;
  /** Height variant. Default: 60px (survey), 56px (onboarding) */
  height?: "sm" | "md" | "lg";
  className?: string;
}

const BUTTON_HEIGHTS = {
  sm: "h-[50px]",
  md: "h-[56px]",
  lg: "h-[60px]",
};

export function OptionButton({ children, selected = false, onClick, height = "lg", className = "" }: OptionButtonProps) {
  return (
    <button
      onClick={() => { hapticLight(); onClick(); }}
      className={`w-full ${BUTTON_HEIGHTS[height]} rounded-[8px] flex items-center justify-center select-none active:scale-[0.98] transition-all duration-200 ${className}`}
      style={{
        backgroundColor: selected ? "var(--dynamic-fg, #fff)" : "var(--dynamic-bg, #000)",
        border: "2px solid var(--dynamic-bg, #000)",
      }}
    >
      <span
        className="font-['Roboto'] font-medium text-[16px]"
        style={{ color: selected ? "var(--dynamic-bg, #000)" : "var(--dynamic-fg, #fff)" }}
      >
        {children}
      </span>
    </button>
  );
}

// ── ActionButton ────────────────────────────────────────────
// Primary action / submit button. Full-width, bg = dynamic-bg.
// Used for "Siguiente", "Confirmar", "Enviar", "EMPEZAR", etc.

interface ActionButtonProps {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  /** Visual variant */
  variant?: "filled" | "outline" | "pill";
  className?: string;
}

export function ActionButton({ label, disabled = false, onClick, variant = "filled", className = "" }: ActionButtonProps) {
  const baseClasses = "w-full flex items-center justify-center select-none active:scale-[0.98] transition-all duration-200";

  if (variant === "pill") {
    return (
      <button
        onClick={() => { if (!disabled) { hapticMedium(); onClick(); } }}
        disabled={disabled}
        className={`${baseClasses} h-[60px] rounded-full ${className}`}
        style={{
          backgroundColor: "var(--dynamic-fg, #fff)",
          opacity: disabled ? 0.3 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span className="font-['Roboto'] font-semibold text-[18px]" style={{ color: "var(--dynamic-bg, #000)" }}>
          {label}
        </span>
      </button>
    );
  }

  if (variant === "outline") {
    return (
      <button
        onClick={() => { if (!disabled) { hapticMedium(); onClick(); } }}
        disabled={disabled}
        className={`${baseClasses} h-[56px] rounded-full border-2 ${className}`}
        style={{
          borderColor: "var(--dynamic-fg, #fff)",
          opacity: disabled ? 0.3 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span className="font-['Roboto'] font-semibold text-[16px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
          {label}
        </span>
      </button>
    );
  }

  // Default: filled rectangle
  return (
    <button
      onClick={() => { if (!disabled) { hapticMedium(); onClick(); } }}
      disabled={disabled}
      className={`${baseClasses} h-[56px] rounded-[8px] mt-4 ${className}`}
      style={{
        backgroundColor: "var(--dynamic-bg, #000)",
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span className="font-['Roboto'] font-semibold text-[18px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
        {label}
      </span>
    </button>
  );
}

// ── CardInput ───────────────────────────────────────────────
// Text input styled for inside a DuotoneCard.

interface CardInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: "text" | "tel" | "password";
  inputMode?: "text" | "numeric" | "tel";
  maxLength?: number;
  /** Ref forwarding for focus management */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  className?: string;
  fontFamily?: string;
}

export function CardInput({
  value, onChange, placeholder, type = "text", inputMode,
  maxLength, inputRef, onKeyDown, className = "", fontFamily = "Roboto",
}: CardInputProps) {
  return (
    <input
      ref={inputRef}
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
      placeholder={placeholder}
      className={`w-full h-[52px] rounded-[8px] border-2 bg-transparent font-medium text-[16px] px-4 outline-none ${className}`}
      style={{
        fontFamily,
        borderColor: "var(--dynamic-bg, #000)",
        color: "var(--dynamic-bg, #000)",
        fontSize: "16px", // prevents iOS zoom
      }}
      onKeyDown={onKeyDown}
    />
  );
}

// ── CardTextarea ────────────────────────────────────────────

interface CardTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  className?: string;
}

export function CardTextarea({ value, onChange, placeholder, rows, textareaRef, className = "" }: CardTextareaProps) {
  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-[8px] border-2 bg-transparent font-['Roboto'] font-medium text-[15px] px-4 py-3 resize-none outline-none ${className}`}
      style={{
        fontSize: "16px",
        borderColor: "var(--dynamic-bg, #000)",
        color: "var(--dynamic-bg, #000)",
        height: rows ? `${rows * 28 + 24}px` : "111px",
      }}
    />
  );
}

// ── ChipButton ──────────────────────────────────────────────
// Small pill-shaped button for multi-select / tag selection.

interface ChipButtonProps {
  children: ReactNode;
  selected?: boolean;
  onClick: () => void;
}

export function ChipButton({ children, selected = false, onClick }: ChipButtonProps) {
  return (
    <button
      onClick={() => { hapticLight(); onClick(); }}
      className="px-4 py-2.5 rounded-full select-none active:scale-[0.96] transition-all duration-200"
      style={{
        backgroundColor: selected ? "var(--dynamic-bg, #000)" : "transparent",
        border: "2px solid var(--dynamic-bg, #000)",
      }}
    >
      <span
        className="font-['Roboto'] font-medium text-[13px]"
        style={{ color: selected ? "var(--dynamic-fg, #fff)" : "var(--dynamic-bg, #000)" }}
      >
        {children}
      </span>
    </button>
  );
}

// ── ProgressBar ─────────────────────────────────────────────
// Story-style segmented progress bar used in both survey and onboarding.

interface ProgressBarProps {
  total: number;
  current: number;
  /** Height in px. Default: 2.5 */
  height?: number;
}

export function ProgressBar({ total, current, height = 2.5 }: ProgressBarProps) {
  return (
    <div className="flex gap-[3px] w-full">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="flex-1 rounded-full transition-all duration-300"
          style={{
            height: `${height}px`,
            backgroundColor: "var(--dynamic-fg, #fff)",
            opacity: i <= current ? 0.9 : 0.15,
          }}
        />
      ))}
    </div>
  );
}

// ── BrutalLogo ──────────────────────────────────────────────
// The single source of truth for the BRUTAL logo SVG.
// Sizes: "sm" (24px), "md" (32px), "lg" (41px)

interface BrutalLogoProps {
  size?: "sm" | "md" | "lg";
  /** Override fill color. Default: "currentColor" */
  fill?: string;
  /** Apply SVG displacement filter for gritty effect */
  withFilter?: boolean;
  /** Unique filter ID to avoid SVG ID collisions */
  filterId?: string;
}

const LOGO_SIZES = { sm: 24, md: 32, lg: 41 };

export function BrutalLogo({ size = "md", fill = "currentColor", withFilter = false, filterId = "logo-filter" }: BrutalLogoProps) {
  const px = LOGO_SIZES[size];
  const ratio = 39.8 / 40.8;

  return (
    <svg
      width={px}
      height={Math.round(px * ratio)}
      viewBox="0 0 41 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="block"
    >
      <g filter={withFilter ? `url(#${filterId})` : undefined}>
        <path d={svgPaths.p129e0f00} fill={fill} />
        <path d={svgPaths.p28b23600} fill={fill} />
        <path d={svgPaths.p2de5a800} fill={fill} />
        <path d={svgPaths.pca92a80} fill={fill} />
        <path d={svgPaths.p1f938400} fill={fill} />
        <path d={svgPaths.p377956f0} fill={fill} />
        <path d={svgPaths.p1082f800} fill={fill} />
        <path d={svgPaths.pd01a700} fill={fill} />
        <path d={svgPaths.p14e44f00} fill={fill} />
        <path d={svgPaths.p31786300} fill={fill} />
        <path d={svgPaths.p10e83600} fill={fill} />
        <path d={svgPaths.p6a77000} fill={fill} />
      </g>
      {withFilter && (
        <defs>
          <filter id={filterId} x="0" y="0" width="40.8" height="39.8004" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feTurbulence type="fractalNoise" baseFrequency="0.999 0.999" numOctaves={3} seed={9996} />
            <feDisplacementMap in="shape" scale={0.8} xChannelSelector="R" yChannelSelector="G" result="displacedImage" width="100%" height="100%" />
            <feMerge result="effect1_texture">
              <feMergeNode in="displacedImage" />
            </feMerge>
          </filter>
        </defs>
      )}
    </svg>
  );
}

// ── BrandHeader ─────────────────────────────────────────────
// "BRUTAL////////////////" text with optional logo.
// Used in survey header, onboarding header, splash, reveal.

interface BrandHeaderProps {
  showLogo?: boolean;
  logoSize?: "sm" | "md" | "lg";
  withFilter?: boolean;
  children?: ReactNode;
}

export function BrandHeader({ showLogo = false, logoSize = "sm", withFilter = false, children }: BrandHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      {showLogo && (
        <div style={{ color: "var(--dynamic-fg, #fff)" }}>
          <BrutalLogo size={logoSize} withFilter={withFilter} filterId="brand-header-filter" />
        </div>
      )}
      <span className="font-['Silkscreen'] text-sm tracking-wide" style={{ color: "var(--dynamic-fg, #fff)" }}>
        BRUTAL////////////////
      </span>
      {children}
    </div>
  );
}

// ── InvertedText ────────────────────────────────────────────
// Text colored with dynamic-bg (for use inside DuotoneCards).

interface InvertedTextProps {
  children: ReactNode;
  className?: string;
}

export function InvertedText({ children, className = "" }: InvertedTextProps) {
  return (
    <span className={className} style={{ color: "var(--dynamic-bg, #000)" }}>
      {children}
    </span>
  );
}

// ── FgText ──────────────────────────────────────────────────
// Text colored with dynamic-fg (for use on dark backgrounds).

interface FgTextProps {
  children: ReactNode;
  className?: string;
  opacity?: number;
}

export function FgText({ children, className = "", opacity }: FgTextProps) {
  return (
    <span className={className} style={{ color: "var(--dynamic-fg, #fff)", opacity }}>
      {children}
    </span>
  );
}
