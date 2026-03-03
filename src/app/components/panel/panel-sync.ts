// ============================================================
// PANEL SYNC — API client for BRUTAL admin panel
// ============================================================
// Conectado al server Hono en Railway (mismo dominio).
// Reemplaza la integración con Supabase Edge Functions (Figma Make).
//
// Arquitectura:
//   - Auth: POST /panel-auth → guarda token en sessionStorage
//   - Carga inicial: GET /admin/questions + GET /admin/drops → hidrata localStorage
//   - Writes: por operación individual (create/update/delete)
//   - scheduleSyncToServer(): no-op (legacy, llamado desde panel-store)
//     El bulk sync fue reemplazado por writes por operación.
// ============================================================

import type { PanelQuestion, PanelDrop } from “./panel-store”;

const API_BASE = window.location.origin;
const QUESTIONS_KEY = “brutal_panel_questions”;
const DROPS_KEY = “brutal_panel_drops”;
const AUTH_KEY = “brutal_panel_auth”;
const TOKEN_KEY = “brutal_panel_token”;

// ── Headers ──────────────────────────────────────────────────

function getToken(): string | null {
return sessionStorage.getItem(TOKEN_KEY);
}

function headers(): Record<string, string> {
const token = getToken();
return {
“Content-Type”: “application/json”,
…(token ? { “X-Panel-Token”: token } : {}),
};
}

// ── Auth ─────────────────────────────────────────────────────

export function isAuthenticated(): boolean {
return sessionStorage.getItem(AUTH_KEY) === “1”;
}

export function setAuthenticated(val: boolean) {
if (val) {
sessionStorage.setItem(AUTH_KEY, “1”);
} else {
sessionStorage.removeItem(AUTH_KEY);
sessionStorage.removeItem(TOKEN_KEY);
}
}

export function logout() {
setAuthenticated(false);
}

export async function authenticate(password: string): Promise<{ ok: boolean; error?: string }> {
try {
const res = await fetch(`${API_BASE}/panel-auth`, {
method: “POST”,
headers: { “Content-Type”: “application/json” },
body: JSON.stringify({ password }),
});

```
if (res.ok) {
  const data = await res.json().catch(() => ({}));
  // Guardar token: si el server devuelve token, usarlo.
  // Si no, guardar la password directamente (server valida X-Panel-Token === PANEL_PASSWORD)
  const tokenToSave = data.token || password;
  sessionStorage.setItem(TOKEN_KEY, tokenToSave);
  setAuthenticated(true);
  return { ok: true };
}

const data = await res.json().catch(() => ({ error: "Error de red" }));
return { ok: false, error: data.error || "Contraseña incorrecta" };
```

} catch (err) {
console.error(”[Panel] Auth error:”, err);
return { ok: false, error: `Error de conexión: ${err}` };
}
}

// ── Request helper ───────────────────────────────────────────

async function request<T>(
method: string,
path: string,
body?: unknown
): Promise<{ ok: boolean; data?: T; error?: string }> {
try {
const res = await fetch(`${API_BASE}${path}`, {
method,
headers: headers(),
…(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

```
if (res.status === 401) {
  setAuthenticated(false);
  return { ok: false, error: "Sesión expirada. Reingresá la contraseña." };
}

if (res.status === 204) {
  return { ok: true };
}

if (!res.ok) {
  const text = await res.text().catch(() => res.statusText);
  console.error(`[Panel] ${method} ${path} → ${res.status}: ${text}`);
  return { ok: false, error: `Error ${res.status}: ${text}` };
}

const data = await res.json().catch(() => undefined);
return { ok: true, data };
```

} catch (err) {
console.error(`[Panel] ${method} ${path} error:`, err);
return { ok: false, error: `Error de red: ${err}` };
}
}

// ── Load from server → hydrate localStorage ──────────────────

export async function loadPanelDataFromServer(): Promise<boolean> {
try {
const token = getToken();

```
// ── TEMP DEBUG ──
alert(
  `DEBUG — loadPanelDataFromServer\n\n` +
  `API_BASE: ${API_BASE}\n` +
  `Token: ${token ? `"${token.slice(0, 12)}..."` : "NULL ⚠️"}\n` +
  `AUTH_KEY en sessionStorage: ${sessionStorage.getItem(AUTH_KEY) ?? "null"}`
);
// ── END DEBUG ──

const [questionsRes, dropsRes] = await Promise.all([
  request<PanelQuestion[]>("GET", "/admin/questions"),
  request<PanelDrop[]>("GET", "/admin/drops"),
]);

// ── TEMP DEBUG ──
alert(
  `DEBUG — Respuesta del server\n\n` +
  `Questions: ${questionsRes.ok
    ? `✅ ${questionsRes.data?.length ?? 0} items`
    : `❌ ${questionsRes.error}`
  }\n` +
  `Drops: ${dropsRes.ok
    ? `✅ ${dropsRes.data?.length ?? 0} items`
    : `❌ ${dropsRes.error}`
  }`
);
// ── END DEBUG ──

if (!questionsRes.ok || !dropsRes.ok) {
  console.error("[Panel] Failed to load from server:", {
    questions: questionsRes.error,
    drops: dropsRes.error,
  });
  return false;
}

const questions: PanelQuestion[] = questionsRes.data || [];
const drops: PanelDrop[] = dropsRes.data || [];

// Hidratar localStorage
localStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions));
localStorage.setItem(DROPS_KEY, JSON.stringify(drops));

console.log(`[Panel] Loaded from server: ${questions.length} questions, ${drops.length} drops`);
return true;
```

} catch (err) {
// ── TEMP DEBUG ──
alert(`DEBUG — ERROR en loadPanelDataFromServer:\n\n${err}`);
// ── END DEBUG ──
console.error(”[Panel] Error loading panel data:”, err);
return false;
}
}

// ── scheduleSyncToServer — no-op (legacy) ───────────────────

let _syncTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSyncToServer() {
if (_syncTimer) clearTimeout(_syncTimer);
_syncTimer = null;
}

// ── Stats ─────────────────────────────────────────────────────

export async function loadStats(): Promise<{
ok: boolean;
data?: Record<string, unknown>;
error?: string;
}> {
return request(“GET”, “/admin/stats”);
}

// ── Questions — server writes ─────────────────────────────────

export async function syncQuestionCreate(q: PanelQuestion): Promise<{
ok: boolean;
data?: PanelQuestion;
error?: string;
}> {
return request(“POST”, “/admin/questions”, q);
}

export async function syncQuestionUpdate(
id: string,
q: Partial<PanelQuestion>
): Promise<{ ok: boolean; data?: PanelQuestion; error?: string }> {
return request(“PUT”, `/admin/questions/${id}`, q);
}

export async function syncQuestionDelete(id: string): Promise<{
ok: boolean;
error?: string;
}> {
return request(“DELETE”, `/admin/questions/${id}`);
}

// ── Drops — server writes ─────────────────────────────────────

export async function syncDropCreate(d: PanelDrop): Promise<{
ok: boolean;
data?: PanelDrop;
error?: string;
}> {
return request(“POST”, “/admin/drops”, d);
}

export async function syncDropUpdate(
id: string,
d: Partial<PanelDrop>
): Promise<{ ok: boolean; data?: PanelDrop; error?: string }> {
return request(“PUT”, `/admin/drops/${id}`, d);
}

export async function syncDropDelete(id: string): Promise<{
ok: boolean;
error?: string;
}> {
return request(“DELETE”, `/admin/drops/${id}`);
}

// ── Drop Questions (junction) ─────────────────────────────────

export async function syncDropQuestions(
dropId: string,
questionIds: string[]
): Promise<{ ok: boolean; error?: string }> {
return request(“POST”, `/admin/drop-questions/${dropId}`, { questions: questionIds });
}

export async function syncDropQuestionRemove(
dropId: string,
questionId: string
): Promise<{ ok: boolean; error?: string }> {
return request(“DELETE”, `/admin/drop-questions/${dropId}`, { questionId });
}

// ── Users ─────────────────────────────────────────────────────

export async function loadUsers(): Promise<{
ok: boolean;
data?: unknown[];
error?: string;
}> {
return request(“GET”, “/admin/users”);
}

export async function updateUserStatus(
userId: string,
status: string
): Promise<{ ok: boolean; error?: string }> {
return request(“PUT”, `/admin/users/${userId}/status`, { status });
}

export async function updateUserNotes(
userId: string,
notes: string
): Promise<{ ok: boolean; error?: string }> {
return request(“PUT”, `/admin/users/${userId}/notes`, { notes });
}

// ── Segments ──────────────────────────────────────────────────

export async function loadSegments(): Promise<{
ok: boolean;
data?: unknown[];
error?: string;
}> {
return request(“GET”, “/admin/segments”);
}

export async function createSegment(segment: unknown): Promise<{
ok: boolean;
data?: unknown;
error?: string;
}> {
return request(“POST”, “/admin/segments”, segment);
}

export async function updateSegment(
id: string,
segment: unknown
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
return request(“PUT”, `/admin/segments/${id}`, segment);
}

export async function deleteSegment(id: string): Promise<{
ok: boolean;
error?: string;
}> {
return request(“DELETE”, `/admin/segments/${id}`);
}

// ── Config ────────────────────────────────────────────────────

export async function loadConfig(): Promise<{
ok: boolean;
data?: unknown;
error?: string;
}> {
return request(“GET”, “/admin/config”);
}

export async function saveConfig(config: unknown): Promise<{
ok: boolean;
error?: string;
}> {
return request(“PUT”, “/admin/config”, config);
}
