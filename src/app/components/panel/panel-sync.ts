// ============================================================
// PANEL SYNC — Bidirectional sync between localStorage ↔ Supabase KV
// ============================================================
// On load: fetch from server → hydrate localStorage
// On save: update localStorage → debounced push to server
// ============================================================

import { projectId, publicAnonKey } from "/utils/supabase/info";
import type { PanelQuestion, PanelDrop } from "./panel-store";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-c68eb08c`;
const QUESTIONS_KEY = "brutal_panel_questions";
const DROPS_KEY = "brutal_panel_drops";
const AUTH_KEY = "brutal_panel_auth";

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
});

// ── Auth ─────────────────────────────────────────────────────

export function isAuthenticated(): boolean {
  return sessionStorage.getItem(AUTH_KEY) === "1";
}

export function setAuthenticated(val: boolean) {
  if (val) {
    sessionStorage.setItem(AUTH_KEY, "1");
  } else {
    sessionStorage.removeItem(AUTH_KEY);
  }
}

export async function authenticate(password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/panel-auth`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthenticated(true);
      return { ok: true };
    }
    const data = await res.json().catch(() => ({ error: "Error de red" }));
    return { ok: false, error: data.error || "Contraseña incorrecta" };
  } catch (err) {
    console.error("[Panel] Auth error:", err);
    return { ok: false, error: `Error de conexión: ${err}` };
  }
}

// ── Load from server → hydrate localStorage ─────────────────

export async function loadPanelDataFromServer(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/panel-data`, {
      method: "GET",
      headers: headers(),
    });
    if (!res.ok) {
      console.error(`[Panel] Failed to fetch panel data: ${res.status}`);
      return false;
    }
    const data = await res.json();
    const questions: PanelQuestion[] = data.questions || [];
    const drops: PanelDrop[] = data.drops || [];

    // Hydrate localStorage
    localStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions));
    localStorage.setItem(DROPS_KEY, JSON.stringify(drops));

    console.log(`[Panel] Loaded from server: ${questions.length} questions, ${drops.length} drops`);
    return true;
  } catch (err) {
    console.error("[Panel] Error loading panel data from server:", err);
    return false;
  }
}

// ── Push localStorage → server ──────────────────────────────

let syncTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSyncToServer() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncToServer();
  }, 1500); // debounce 1.5s
}

async function syncToServer() {
  try {
    const questionsRaw = localStorage.getItem(QUESTIONS_KEY);
    const dropsRaw = localStorage.getItem(DROPS_KEY);
    const questions = questionsRaw ? JSON.parse(questionsRaw) : [];
    const drops = dropsRaw ? JSON.parse(dropsRaw) : [];

    const res = await fetch(`${API_BASE}/panel-data`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ questions, drops }),
    });

    if (res.ok) {
      console.log(`[Panel] Synced to server: ${questions.length}q, ${drops.length}d`);
    } else {
      const err = await res.text();
      console.error(`[Panel] Sync failed (${res.status}): ${err}`);
    }
  } catch (err) {
    console.error("[Panel] Sync error:", err);
  }
}
