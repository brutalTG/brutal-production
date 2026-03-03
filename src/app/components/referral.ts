/**
 * Referral system for BRUTAL.
 *
 * Uses Telegram's start_param for deep linking:
 *   - Format: ref_{userId}
 *   - Bot link: https://t.me/BOTNAME?startapp=ref_{userId}
 *
 * Since there's no backend, referral tracking is local-only.
 * A future backend would validate and credit referrals.
 */

import { getTelegramStartParam, getTelegramUserId } from "./telegram-sdk";

const STORAGE_KEY = "brutal_referral";

interface ReferralData {
  /** The user ID who referred this user */
  referrerId: string | null;
  /** Whether this user came via a referral link */
  isReferred: boolean;
  /** Timestamp of when referral was detected */
  detectedAt: number;
}

/**
 * Parse the start_param to extract referral info.
 * Call once on app init.
 */
export function detectReferral(): ReferralData {
  const startParam = getTelegramStartParam();
  const data: ReferralData = {
    referrerId: null,
    isReferred: false,
    detectedAt: Date.now(),
  };

  if (startParam && startParam.startsWith("ref_")) {
    data.referrerId = startParam.replace("ref_", "");
    data.isReferred = true;

    // Persist locally
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_e) { /* storage full or unavailable */ }
  }

  return data;
}

const BOT_USERNAME = "BBBrutalbot";

/**
 * Get the referral link for the current user.
 */
export function getReferralLink(): string {
  const userId = getTelegramUserId();
  const userParam = userId ? `ref_${userId}` : `ref_anon_${Date.now()}`;
  return `https://t.me/${BOT_USERNAME}?startapp=${userParam}`;
}

/**
 * Check if the current user was referred.
 */
export function wasReferred(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as ReferralData;
      return data.isReferred;
    }
  } catch (_e) { /* nope */ }

  return detectReferral().isReferred;
}

/**
 * Get referrer ID if available.
 */
export function getReferrerId(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as ReferralData;
      return data.referrerId;
    }
  } catch (_e) { /* nope */ }

  return detectReferral().referrerId;
}