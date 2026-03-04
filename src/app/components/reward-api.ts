// ============================================================
// REWARD API — Frontend helpers for profile, leaderboard, season
// ============================================================
// Admin functions use X-Panel-Token. User functions are public
// (server uses TG initData or telegramUserId in URL).
// ============================================================

const API_BASE = "";  // Same origin — Hono serves API + frontend from Railway

/** Headers for panel/admin operations (require X-Panel-Token) */
const panelHeaders = () => ({
  "Content-Type": "application/json",
  "X-Panel-Token": sessionStorage.getItem("brutal_panel_token") || "",
});

/** Headers for public/user operations (no auth needed for these endpoints) */
const publicHeaders = () => ({
  "Content-Type": "application/json",
});

// ── Types ────────────────────────────────────────────────────

export interface UserProfile {
  telegramUserId: number;
  username: string;
  firstName: string;
  lastName: string;
  walletAlias: string | null;
  totalCoins: number;
  seasonTickets: number;
  lifetimeTickets: number;
  dropsCompleted: number;
  botQuestionsAnswered: number;
  firstSeen: string;
  lastActiveAt: string;
}

export interface RewardTransaction {
  txId: string;
  telegramUserId: number;
  rewardType: "coins" | "tickets";
  rewardValue: number;
  source: "drop" | "bot_question" | "bonus";
  sourceId: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  position: number;
  telegramUserId: number;
  username: string;
  firstName: string;
  seasonTickets: number;
  lifetimeTickets: number;
  dropsCompleted: number;
  botQuestionsAnswered: number;
}

export interface Season {
  seasonId: string;
  name: string;
  startDate: string;
  endDate: string | null;
  prizes: SeasonPrize[];
  prizeImageUrl: string | null;
  active: boolean;
  createdAt: string;
}

export interface SeasonPrize {
  position: string; // "1", "2", "3", "top10", etc.
  description: string;
  value?: string;
}

export interface LeaderboardResponse {
  season: Season | null;
  leaderboard: LeaderboardEntry[];
  totalUsers: number;
}

// ── User functions (public endpoints) ───────────────────────

export async function fetchUserProfile(
  telegramUserId: number
): Promise<{ profile: UserProfile; transactions: RewardTransaction[] } | null> {
  try {
    const res = await fetch(`${API_BASE}/user/${telegramUserId}/profile`, {
      headers: publicHeaders(),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error(`[REWARD-API] Profile fetch failed (${res.status})`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[REWARD-API] Profile fetch error: ${err}`);
    return null;
  }
}

export async function linkWallet(
  telegramUserId: number,
  walletAlias: string
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/user/${telegramUserId}/wallet`, {
      method: "PUT",
      headers: publicHeaders(),
      body: JSON.stringify({ walletAlias }),
    });
    return res.ok;
  } catch (err) {
    console.error(`[REWARD-API] Wallet link error: ${err}`);
    return false;
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/leaderboard`, {
      headers: publicHeaders(),
    });
    if (!res.ok) {
      console.error(`[REWARD-API] Leaderboard fetch failed (${res.status})`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[REWARD-API] Leaderboard fetch error: ${err}`);
    return null;
  }
}

export async function fetchSeason(): Promise<Season | null> {
  try {
    const res = await fetch(`${API_BASE}/season`, {
      headers: publicHeaders(),
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`[REWARD-API] Season fetch error: ${err}`);
    return null;
  }
}

// ── Admin functions (require X-Panel-Token) ─────────────────

export async function saveSeason(season: {
  seasonId?: string;
  name: string;
  startDate?: string;
  endDate?: string | null;
  prizes?: SeasonPrize[];
  prizeImageUrl?: string | null;
}): Promise<Season | null> {
  try {
    const res = await fetch(`${API_BASE}/season`, {
      method: "PUT",
      headers: panelHeaders(),
      body: JSON.stringify(season),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[REWARD-API] Season save failed: ${err}`);
      return null;
    }
    const data = await res.json();
    return data.season || data;
  } catch (err) {
    console.error(`[REWARD-API] Season save error: ${err}`);
    return null;
  }
}

export async function resetSeason(): Promise<{ ok: boolean; resetCount?: number }> {
  try {
    const res = await fetch(`${API_BASE}/season/reset`, {
      method: "POST",
      headers: panelHeaders(),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[REWARD-API] Season reset failed: ${err}`);
      return { ok: false };
    }
    return await res.json();
  } catch (err) {
    console.error(`[REWARD-API] Season reset error: ${err}`);
    return { ok: false };
  }
}

// ── Claims (admin) ──────────────────────────────────────────

export interface Claim {
  claimId: string;
  telegramUserId: number;
  username: string;
  firstName: string;
  walletAlias: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export async function fetchClaims(): Promise<Claim[]> {
  try {
    const res = await fetch(`${API_BASE}/claims`, { headers: panelHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.claims || [];
  } catch (err) {
    console.error(`[REWARD-API] Claims fetch error: ${err}`);
    return [];
  }
}

export async function updateClaim(
  claimId: string,
  status: "approved" | "rejected",
  note?: string
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/claims/${claimId}`, {
      method: "PUT",
      headers: panelHeaders(),
      body: JSON.stringify({ status, note: note || null }),
    });
    return res.ok;
  } catch (err) {
    console.error(`[REWARD-API] Claim update error: ${err}`);
    return false;
  }
}

// ── Admin: user management ──────────────────────────────────

export async function fetchAdminUsers(): Promise<{ users: (UserProfile & { status?: string })[]; count: number } | null> {
  try {
    const res = await fetch(`${API_BASE}/admin/users`, { headers: panelHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`[REWARD-API] Admin users fetch error: ${err}`);
    return null;
  }
}

export async function deleteUser(userId: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: "DELETE",
      headers: panelHeaders(),
    });
    return res.ok;
  } catch (err) {
    console.error(`[REWARD-API] Delete user error: ${err}`);
    return false;
  }
}

export async function updateUserStatus(userId: number, status: "active" | "pending" | "banned"): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/status`, {
      method: "PUT",
      headers: panelHeaders(),
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch (err) {
    console.error(`[REWARD-API] Update user status error: ${err}`);
    return false;
  }
}

export async function resetAllTickets(): Promise<{ ok: boolean; resetCount?: number }> {
  try {
    const res = await fetch(`${API_BASE}/admin/reset-tickets`, {
      method: "POST",
      headers: panelHeaders(),
    });
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch (err) {
    console.error(`[REWARD-API] Reset tickets error: ${err}`);
    return { ok: false };
  }
}
