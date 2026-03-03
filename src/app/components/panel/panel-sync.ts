// ============================================================
// PANEL SYNC — API client for BRUTAL admin panel
// ============================================================
// Conectado al server Hono en Railway (mismo dominio).
// ============================================================

import type { PanelQuestion, PanelDrop } from “./panel-store”;

const API_BASE = window.location.origin;
const QUESTIONS_KEY = “brutal_panel_questions”;
const DROPS_KEY = “brutal_panel_drops”;
const AUTH_KEY = “brutal_panel_auth”;
const TOKEN_KEY = “brutal_panel_token”;

// ── Debug toast (visible feedback sin consola) ───────────────

let _debugContainer: HTMLDivElement | null = null;

function debugToast(msg: string, isError = false) {
if (!_debugContainer) {
_debugContainer = document.createElement(“div”);
_debugContainer.style.cssText =
“position:fixed;bottom:12px;right:12px;z-index:99999;display:flex;flex-direction:column;gap:6px;max-width:360px;pointer-events:none;”;
document.body.appendChild(_debugContainer);
}
const el = document.createElement(“div”);
el.style.cssText = `font-family:'Fira Code',monospace;font-size:11px;padding:8px 12px;border-radius:8px; color:#fff;pointer-events:auto;word-break:break-all; background:${isError ? "#c0392b" : "#2d3436"}; opacity:1;transition:opacity 0.3s;`;
el.textContent = msg;
_debugContainer.appendChild(el);
setTimeout(() => {
el.style.opacity = “0”;
setTimeout(() => el.remove(), 300);
}, 6000);
}

// ── Headers ──────────────────────────────────────────────────

function getToken(): string | null {
return sessionStorage.getItem(TOKEN_KEY);
}

function headers(): Record<string, string> {
const token = getToken();
const h: Record<string, string> = { “Content-Type”: “application/json” };
if (token) h[“X-Panel-Token”] = token;
return h;
}

// ── Auth ─────────────────────────────────────────────────────

export function isAuthenticated(): boolean {
// Require BOTH the auth flag AND a token — prevents stale sessions
// from Figma Make era where AUTH_KEY existed but TOKEN_KEY didn’t
const hasAuth = sessionStorage.getItem(AUTH_KEY) === “1”;
const hasToken = !!sessionStorage.getItem(TOKEN_KEY);
if (hasAuth && !hasToken) {
// Stale session — force re-login
sessionStorage.removeItem(AUTH_KEY);
return false;
}
return hasAuth && hasToken;
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
debugToast(`AUTH → POST ${API_BASE}/panel-auth`);
const res = await fetch(`${API_BASE}/panel-auth`, {
method: “POST”,
headers: { “Content-Type”: “application/json” },
body: JSON.stringify({ password }),
});

```
if (res.ok) {
  const data = await res.json().catch(() => ({}));
  const tokenToSave = data.token || password;
  sessionStorage.setItem(TOKEN_KEY, tokenToSave);
  setAuthenticated(true);
  debugToast(`AUTH ✅ token saved (${tokenToSave.slice(0, 8)}...)`);
  return { ok: true };
}

const data = await res.json().catch(() => ({ error: "Error de red" }));
debugToast(`AUTH ❌ ${res.status}: ${data.error || "unknown"}`, true);
return { ok: false, error: data.error || "Contraseña incorrecta" };
```

} catch (err) {
debugToast(`AUTH ❌ ${err}`, true);
return { ok: false, error: `Error de conexión: ${err}` };
}
}

// ── Request helper ───────────────────────────────────────────

async function request<T>(
method: string,
path: string,
body?: unknown
): Promise<{ ok: boolean; data?: T; error?: string }> {
const token = getToken();
debugToast(`${method} ${path} [token: ${token ? "yes" : "NO ⚠️"}]`);

try {
const res = await fetch(`${API_BASE}${path}`, {
method,
headers: headers(),
…(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

```
if (res.status === 401) {
  debugToast(`${method} ${path} → 401 UNAUTHORIZED`, true);
  setAuthenticated(false);
  return { ok: false, error: "Sesión expirada. Reingresá la contraseña." };
}

if (res.status === 204) {
  debugToast(`${method} ${path} → 204 OK`);
  return { ok: true };
}

if (!res.ok) {
  const text = await res.text().catch(() => res.statusText);
  debugToast(`${method} ${path} → ${res.status}: ${text.slice(0, 100)}`, true);
  return { ok: false, error: `Error ${res.status}: ${text}` };
}

const data = await res.json().catch(() => undefined);
debugToast(`${method} ${path} → ${res.status} OK ✅`);
return { ok: true, data };
```

} catch (err) {
debugToast(`${method} ${path} → NETWORK ERROR: ${err}`, true);
return { ok: false, error: `Error de red: ${err}` };
}
}

// ── Load from server → hydrate localStorage ──────────────────

export async function loadPanelDataFromServer(): Promise<boolean> {
try {
const [questionsRes, dropsRes] = await Promise.all([
request<PanelQuestion[]>(“GET”, “/admin/questions”),
request<PanelDrop[]>(“GET”, “/admin/drops”),
]);

```
if (!questionsRes.ok || !dropsRes.ok) {
  console.error("[Panel] Failed to load from server:", {
    questions: questionsRes.error,
    drops: dropsRes.error,
  });
  return false;
}

const questions: PanelQuestion[] = questionsRes.data || [];
const drops: PanelDrop[] = dropsRes.data || [];

localStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions));
localStorage.setItem(DROPS_KEY, JSON.stringify(drops));

debugToast(`LOADED: ${questions.length}q + ${drops.length}d`);
return true;
```

} catch (err) {
debugToast(`LOAD ERROR: ${err}`, true);
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

export async function syncQuestionCreate(q: unknown): Promise<{
ok: boolean;
data?: PanelQuestion;
error?: string;
}> {
return request(“POST”, “/admin/questions”, q);
}

export async function syncQuestionUpdate(
id: string,
q: unknown
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

export async function syncDropCreate(d: unknown): Promise<{
ok: boolean;
data?: PanelDrop;
error?: string;
}> {
return request(“POST”, “/admin/drops”, d);
}

export async function syncDropUpdate(
id: string,
d: unknown
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
