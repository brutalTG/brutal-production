// ============================================================
// PANEL THEME — light/dark mode with high contrast for accessibility
// ============================================================

import { useState, useEffect, useCallback } from "react";

export type PanelMode = "dark" | "light";

const STORAGE_KEY = "brutal-panel-theme";

/** CSS custom properties for each mode — HIGH CONTRAST optimized */
const THEMES: Record<PanelMode, Record<string, string>> = {
  dark: {
    "--p-bg": "#000000",
    "--p-bg-sidebar": "#050505",
    "--p-bg-card": "#0d0d0d",
    "--p-bg-hover": "#1a1a1a",
    "--p-bg-active": "#222222",
    "--p-bg-input": "#111111",
    "--p-border": "#333333",
    "--p-border-subtle": "#222222",
    "--p-text": "#ffffff",
    "--p-text-secondary": "#bbbbbb",
    "--p-text-muted": "#999999",
    "--p-text-faint": "#777777",
    "--p-text-ghost": "#555555",
    "--p-accent": "#ffffff",
    "--p-accent-fg": "#000000",
    "--p-danger": "#ff4466",
    "--p-success": "#44ff88",
    "--p-warning": "#ffcc00",
    "--p-badge-bg": "#222222",
    "--p-badge-text": "#ffffff",
    "--p-scrollbar-track": "#111111",
    "--p-scrollbar-thumb": "#333333",
  },
  light: {
    "--p-bg": "#f5f5f5",
    "--p-bg-sidebar": "#ffffff",
    "--p-bg-card": "#ffffff",
    "--p-bg-hover": "#eeeeee",
    "--p-bg-active": "#e0e0e0",
    "--p-bg-input": "#ffffff",
    "--p-border": "#cccccc",
    "--p-border-subtle": "#dddddd",
    "--p-text": "#000000",
    "--p-text-secondary": "#222222",
    "--p-text-muted": "#444444",
    "--p-text-faint": "#666666",
    "--p-text-ghost": "#888888",
    "--p-accent": "#000000",
    "--p-accent-fg": "#ffffff",
    "--p-danger": "#cc0022",
    "--p-success": "#007733",
    "--p-warning": "#aa6600",
    "--p-badge-bg": "#e0e0e0",
    "--p-badge-text": "#000000",
    "--p-scrollbar-track": "#eeeeee",
    "--p-scrollbar-thumb": "#bbbbbb",
  },
};

export function usePanelTheme() {
  const [mode, setMode] = useState<PanelMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return "dark";
  });

  // Apply CSS variables to :root whenever mode changes
  useEffect(() => {
    const vars = THEMES[mode];
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return { mode, toggle } as const;
}
