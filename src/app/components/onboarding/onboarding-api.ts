// ============================================================
// ONBOARDING API — Frontend helpers for application submission
// ============================================================

// API calls go to same-origin Hono server
import type { OnboardingApplication } from "./onboarding-types";

const API_BASE = "";  // Same origin — Hono serves API + frontend from Railway

const headers = () => ({
  "Content-Type": "application/json",
  // Auth: /apply is public, no auth needed
});

/** Submit the full application */
export async function submitApplication(
  app: Omit<OnboardingApplication, "applicationId" | "queuePosition" | "createdAt">
): Promise<{ ok: boolean; applicationId?: string; queuePosition?: number; referralCode?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/apply`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(app),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[ONBOARDING-API] Submit failed (${res.status}): ${err}`);
      return { ok: false, error: err };
    }
    return await res.json();
  } catch (err) {
    console.error(`[ONBOARDING-API] Submit error: ${err}`);
    return { ok: false, error: String(err) };
  }
}

/** Check if a phone number already has an application */
export async function checkExistingApplication(
  phone: string
): Promise<{ exists: boolean; queuePosition?: number; referralCode?: string }> {
  try {
    const res = await fetch(`${API_BASE}/apply/check?phone=${encodeURIComponent(phone)}`, {
      headers: headers(),
    });
    if (!res.ok) return { exists: false };
    return await res.json();
  } catch (err) {
    console.error(`[ONBOARDING-API] Check error: ${err}`);
    return { exists: false };
  }
}
