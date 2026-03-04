// ============================================================
// DROP API — Frontend helpers for drop CRUD via Hono server
// ============================================================
// Used by both the panel (to publish) and SurveyApp (to fetch).
// Panel calls need X-Panel-Token. Read calls are public.
// ============================================================

import type { Drop } from "./drop-types";

const API_BASE = "";  // Same origin — Hono serves API + frontend from Railway

/** Headers for read-only (public) requests */
const readHeaders = () => ({
  "Content-Type": "application/json",
});

/** Headers for panel write operations (require auth) */
const panelHeaders = () => ({
  "Content-Type": "application/json",
  "X-Panel-Token": sessionStorage.getItem("brutal_panel_token") || "",
});

// ── Publish active drop ─────────────────────────────────────
export async function publishActiveDrop(drop: Drop): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/active-drop`, {
      method: "PUT",
      headers: panelHeaders(),
      body: JSON.stringify(drop),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[BRUTAL] Failed to publish active drop (${res.status}): ${err}`);
      return false;
    }
    const result = await res.json();
    console.log(`[BRUTAL] Active drop published: ${result.dropId} (${result.questionCount} questions)`);
    return true;
  } catch (err) {
    console.error(`[BRUTAL] Error publishing active drop: ${err}`);
    return false;
  }
}

// ── Fetch active drop ───────────────────────────────────────
export async function fetchActiveDrop(): Promise<Drop | null> {
  try {
    const res = await fetch(`${API_BASE}/active-drop`, {
      method: "GET",
      headers: readHeaders(),
    });
    if (res.status === 404) {
      console.log("[BRUTAL] No active drop published — using fallback");
      return null;
    }
    if (!res.ok) {
      const err = await res.text();
      console.error(`[BRUTAL] Failed to fetch active drop (${res.status}): ${err}`);
      return null;
    }
    const drop: Drop = await res.json();
    console.log(`[BRUTAL] Active drop loaded: ${drop.id} (${drop.questions.length} questions)`);
    return drop;
  } catch (err) {
    console.error(`[BRUTAL] Error fetching active drop: ${err}`);
    return null;
  }
}

// ── Clear active drop ───────────────────────────────────────
export async function clearActiveDrop(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/active-drop`, {
      method: "DELETE",
      headers: panelHeaders(),
    });
    return res.ok;
  } catch (err) {
    console.error(`[BRUTAL] Error clearing active drop: ${err}`);
    return false;
  }
}

// ── Publish preview drop ────────────────────────────────────
export async function publishPreviewDrop(drop: Drop): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/preview-drop`, {
      method: "PUT",
      headers: panelHeaders(),
      body: JSON.stringify(drop),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[BRUTAL] Failed to publish preview drop (${res.status}): ${err}`);
      return false;
    }
    console.log(`[BRUTAL] Preview drop published`);
    return true;
  } catch (err) {
    console.error(`[BRUTAL] Error publishing preview drop: ${err}`);
    return false;
  }
}

// ── Fetch preview drop ──────────────────────────────────────
export async function fetchPreviewDrop(): Promise<Drop | null> {
  try {
    const res = await fetch(`${API_BASE}/preview-drop`, {
      method: "GET",
      headers: readHeaders(),
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`[BRUTAL] Error fetching preview drop: ${err}`);
    return null;
  }
}
