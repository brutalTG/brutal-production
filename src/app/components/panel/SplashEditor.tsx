// ============================================================
// SPLASH EDITOR — Splash screen customization in Drop config
// Migrated to CSS variables var(--p-*) for light/dark theming
// ============================================================

import { Image, Type, Trash2 } from "lucide-react";
import type { SplashConfig } from "../drop-types";

const AVAILABLE_FONTS = [
  { value: "Fira_Code", label: "Fira Code" },
  { value: "Silkscreen", label: "Silkscreen" },
  { value: "Roboto", label: "Roboto" },
];

const DEFAULT_SPLASH: SplashConfig = {
  mode: "terminal",
  fontFamily: "Fira_Code",
  buttonText: "ENTRO",
  buttonBg: "#FFFFFF",
  buttonTextColor: "#000000",
};

interface SplashEditorProps {
  splash?: SplashConfig;
  onSave: (splash: SplashConfig | undefined) => void;
}

export function SplashEditor({ splash, onSave }: SplashEditorProps) {
  const cfg = splash || DEFAULT_SPLASH;

  const update = (partial: Partial<SplashConfig>) => {
    onSave({ ...cfg, ...partial });
  };

  const formInput: React.CSSProperties = {
    backgroundColor: "var(--p-bg-hover)",
    border: "1px solid var(--p-border-subtle)",
    color: "var(--p-text)",
  };

  return (
    <div className="flex flex-col gap-3 mt-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--p-text-faint)" }}>Splash Screen</h4>
        {splash && (
          <button
            onClick={() => onSave(undefined)}
            className="text-[10px] transition-colors flex items-center gap-1"
            style={{ color: "var(--p-text-ghost)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-danger)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }}
          >
            <Trash2 size={10} /> Reset a default
          </button>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => update({ mode: "terminal" })}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition-colors"
          style={{
            backgroundColor: cfg.mode === "terminal" ? "var(--p-accent)" : "transparent",
            color: cfg.mode === "terminal" ? "var(--p-accent-fg)" : "var(--p-text-faint)",
            borderColor: cfg.mode === "terminal" ? "var(--p-accent)" : "var(--p-border)",
          }}
        >
          <Type size={13} /> Terminal
        </button>
        <button
          onClick={() => update({ mode: "image" })}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition-colors"
          style={{
            backgroundColor: cfg.mode === "image" ? "var(--p-accent)" : "transparent",
            color: cfg.mode === "image" ? "var(--p-accent-fg)" : "var(--p-text-faint)",
            borderColor: cfg.mode === "image" ? "var(--p-accent)" : "var(--p-border)",
          }}
        >
          <Image size={13} /> Imagen
        </button>
      </div>

      {cfg.mode === "terminal" && (
        <div className="flex flex-col gap-3">
          {/* Font selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--p-text-muted)" }}>Tipografia</label>
            <div className="flex gap-2">
              {AVAILABLE_FONTS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => update({ fontFamily: f.value })}
                  className="flex-1 py-2 px-2 rounded-lg border text-xs transition-colors"
                  style={{
                    backgroundColor: cfg.fontFamily === f.value ? "color-mix(in srgb, var(--p-success) 20%, transparent)" : "var(--p-bg-hover)",
                    borderColor: cfg.fontFamily === f.value ? "color-mix(in srgb, var(--p-success) 40%, transparent)" : "var(--p-border-subtle)",
                    color: cfg.fontFamily === f.value ? "var(--p-success)" : "var(--p-text-muted)",
                    fontFamily: f.value.replace("_", " "),
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Static lines */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--p-text-muted)" }}>
              Lineas estaticas <span style={{ color: "var(--p-text-ghost)" }}>(1 por linea, dejalo vacio para usar default)</span>
            </label>
            <textarea
              className="rounded-lg px-3 py-2 text-xs font-['Fira_Code'] focus:outline-none min-h-[60px]"
              style={formInput}
              value={(cfg.staticLines || []).join("\n")}
              onChange={(e) => {
                const val = e.target.value;
                update({ staticLines: val.trim() ? val.split("\n") : undefined });
              }}
              placeholder={"> Establishing secure connection...\n> Encryption: AES-256-GCM\n> Signal extraction engine: LOADED"}
            />
          </div>

          {/* Typewriter lines */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--p-text-muted)" }}>
              Lineas typewriter <span style={{ color: "var(--p-text-ghost)" }}>(1 por linea, dejalo vacio para usar default)</span>
            </label>
            <textarea
              className="rounded-lg px-3 py-2 text-xs font-['Fira_Code'] focus:outline-none min-h-[80px]"
              style={formInput}
              value={(cfg.typewriterLines || []).join("\n")}
              onChange={(e) => {
                const val = e.target.value;
                update({ typewriterLines: val.trim() ? val.split("\n") : undefined });
              }}
              placeholder={"> WARNING: Todo lo que pase aca es anonimo.\n> No guardamos tu nombre.\n> Toca ENTRO para comenzar:"}
            />
          </div>
        </div>
      )}

      {cfg.mode === "image" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--p-text-muted)" }}>
              URL de imagen o GIF
            </label>
            <input
              className="rounded-lg px-3 py-2 text-sm font-['Fira_Code'] focus:outline-none"
              style={formInput}
              value={cfg.imageUrl || ""}
              onChange={(e) => update({ imageUrl: e.target.value })}
              placeholder="https://ejemplo.com/splash.gif"
            />
          </div>
          {cfg.imageUrl && (
            <div className="relative w-full aspect-[9/16] max-h-[200px] rounded-lg overflow-hidden bg-black" style={{ border: "1px solid var(--p-border-subtle)" }}>
              <img
                src={cfg.imageUrl}
                alt="Splash preview"
                className="w-full h-full object-contain"
                style={{ objectPosition: "center center" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
        </div>
      )}

      {/* Button config (shared between modes) */}
      <div className="pt-3 flex flex-col gap-3" style={{ borderTop: "1px solid var(--p-border-subtle)" }}>
        <h5 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--p-text-faint)" }}>Boton de entrada</h5>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--p-text-muted)" }}>Texto</label>
            <input
              className="rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={formInput}
              value={cfg.buttonText || "ENTRO"}
              onChange={(e) => update({ buttonText: e.target.value })}
              placeholder="ENTRO"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--p-text-muted)" }}>Color fondo</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-8 rounded cursor-pointer bg-transparent"
                style={{ border: "1px solid var(--p-border-subtle)" }}
                value={cfg.buttonBg || "#FFFFFF"}
                onChange={(e) => update({ buttonBg: e.target.value })}
              />
              <input
                className="rounded px-2 py-1 text-[11px] font-['Fira_Code'] focus:outline-none w-full"
                style={formInput}
                value={cfg.buttonBg || "#FFFFFF"}
                onChange={(e) => update({ buttonBg: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--p-text-muted)" }}>Color texto</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-8 rounded cursor-pointer bg-transparent"
                style={{ border: "1px solid var(--p-border-subtle)" }}
                value={cfg.buttonTextColor || "#000000"}
                onChange={(e) => update({ buttonTextColor: e.target.value })}
              />
              <input
                className="rounded px-2 py-1 text-[11px] font-['Fira_Code'] focus:outline-none w-full"
                style={formInput}
                value={cfg.buttonTextColor || "#000000"}
                onChange={(e) => update({ buttonTextColor: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Font for button */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--p-text-muted)" }}>Tipografia del boton</label>
          <div className="flex gap-2">
            {AVAILABLE_FONTS.map((f) => (
              <button
                key={f.value}
                onClick={() => update({ fontFamily: f.value })}
                className="flex-1 py-1.5 px-2 rounded border text-[11px] transition-colors"
                style={{
                  backgroundColor: cfg.fontFamily === f.value ? "color-mix(in srgb, var(--p-success) 20%, transparent)" : "var(--p-bg-hover)",
                  borderColor: cfg.fontFamily === f.value ? "color-mix(in srgb, var(--p-success) 40%, transparent)" : "var(--p-border-subtle)",
                  color: cfg.fontFamily === f.value ? "var(--p-success)" : "var(--p-text-muted)",
                  fontFamily: f.value.replace("_", " "),
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live preview of button */}
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px]" style={{ color: "var(--p-text-ghost)" }}>Preview:</span>
          <div
            className="h-[36px] px-6 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: cfg.buttonBg || "#FFFFFF",
              fontFamily: (cfg.fontFamily || "Fira_Code").replace("_", " "),
            }}
          >
            <span
              className="font-semibold text-[14px]"
              style={{ color: cfg.buttonTextColor || "#000000" }}
            >
              {cfg.buttonText || "ENTRO"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
