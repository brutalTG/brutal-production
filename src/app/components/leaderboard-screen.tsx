// ============================================================
// LEADERBOARD SCREEN — BRUTAL season rankings + profile card
// ============================================================
// Same look & feel as the main app: duotone, Silkscreen logo,
// Fira_Code metrics, Roboto body. Shows aspirational prize image,
// season countdown, user's own profile stats, and claim button.
// ============================================================

import { useState, useEffect, useMemo } from "react";
import svgPaths from "../../imports/svg-mcipxppzoz";
import { fetchLeaderboard, fetchUserProfile } from "./reward-api";
import type { LeaderboardEntry, Season, UserProfile } from "./reward-api";
import { hapticLight, hapticMedium } from "./haptics";
import { ImageWithFallback } from "./figma/ImageWithFallback";

// ── Constants ────────────────────────────────────────────────
const CLAIM_MINIMUM_USD = 10;

interface LeaderboardScreenProps {
  telegramUserId?: number;
  onBack: () => void;
  onProfile: () => void;
}

// ── BRUTAL Logo (same as splash) ─────────────────────────────
function BrutalLogo({ size = 32 }: { size?: number }) {
  const h = size * (39.8 / 40.8);
  return (
    <svg width={size} height={h} viewBox="0 0 40.8 39.8004" fill="none" className="block">
      <g filter="url(#filter0_g_lb)">
        <path d={svgPaths.p129e0f00} fill="white" />
        <path d={svgPaths.p28b23600} fill="white" />
        <path d={svgPaths.p2de5a800} fill="white" />
        <path d={svgPaths.pca92a80} fill="white" />
        <path d={svgPaths.p1f938400} fill="white" />
        <path d={svgPaths.p377956f0} fill="white" />
        <path d={svgPaths.p1082f800} fill="white" />
        <path d={svgPaths.pd01a700} fill="white" />
        <path d={svgPaths.p14e44f00} fill="white" />
        <path d={svgPaths.p31786300} fill="white" />
        <path d={svgPaths.p10e83600} fill="white" />
        <path d={svgPaths.p6a77000} fill="white" />
      </g>
      <defs>
        <filter id="filter0_g_lb" x="0" y="0" width="40.8" height="39.8004" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feTurbulence type="fractalNoise" baseFrequency="0.999 0.999" numOctaves={3} seed={9996} />
          <feDisplacementMap in="shape" scale={0.8} xChannelSelector="R" yChannelSelector="G" result="displacedImage" width="100%" height="100%" />
          <feMerge result="effect1_texture"><feMergeNode in="displacedImage" /></feMerge>
        </filter>
      </defs>
    </svg>
  );
}

// ── Countdown helper ─────────────────────────────────────────
function useCountdown(endDate: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!endDate) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endDate]);

  if (!endDate) return null;
  const diff = new Date(endDate).getTime() - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds, expired: false };
}

// ── Dashed line ──────────────────────────────────────────────
function DashedLine() {
  return (
    <svg className="w-full h-[1px]" fill="none" preserveAspectRatio="none" viewBox="0 0 343 1">
      <line stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" x2="343" y1="0.5" y2="0.5" />
    </svg>
  );
}

// ── Main Component ───────────────────────────────────────────
export function LeaderboardScreen({ telegramUserId, onBack, onProfile }: LeaderboardScreenProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [season, setSeason] = useState<Season | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [lbData, profileData] = await Promise.all([
        fetchLeaderboard(),
        telegramUserId ? fetchUserProfile(telegramUserId) : Promise.resolve(null),
      ]);
      if (lbData) {
        setEntries(lbData.leaderboard);
        setSeason(lbData.season);
        setTotalUsers(lbData.totalUsers);
      }
      if (profileData) {
        setProfile(profileData.profile);
      }
      setLoading(false);
    };
    load();
  }, [telegramUserId]);

  // Reset dynamic colors
  useEffect(() => {
    document.body.style.setProperty("--dynamic-bg", "#000");
    document.body.style.setProperty("--dynamic-fg", "#fff");
    document.body.style.backgroundColor = "#000";
  }, []);

  const countdown = useCountdown(season?.endDate || null);

  const myEntry = useMemo(
    () => (telegramUserId ? entries.find((e) => e.telegramUserId === telegramUserId) : null),
    [entries, telegramUserId]
  );

  const cashStr = profile
    ? profile.totalCoins % 1 === 0
      ? profile.totalCoins.toString()
      : profile.totalCoins.toFixed(2).replace(".", ",")
    : "0";

  const canClaim = profile ? profile.totalCoins >= CLAIM_MINIMUM_USD : false;

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="font-['Fira_Code'] text-xs text-white/50">Cargando ranking...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex justify-center bg-black font-['Roboto'] overflow-hidden">
      <div
        className="w-full max-w-[420px] flex flex-col h-dvh overflow-y-auto overflow-x-hidden"
        style={{
          paddingTop: "calc(var(--tg-safe-top, 0px) + 16px)",
          paddingBottom: "calc(var(--tg-safe-bottom, 0px) + 24px)",
        }}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <div className="px-5 flex items-center gap-3 mb-5">
          <button
            onClick={() => { hapticLight(); onBack(); }}
            className="text-white/40 text-xs font-['Fira_Code'] shrink-0"
          >
            &lt; volver
          </button>
          <div className="flex-1" />
          <BrutalLogo size={28} />
          <span className="font-['Silkscreen'] text-[13px] text-white tracking-wide leading-none">
            BRUTAL////
          </span>
        </div>

        {/* ── Season Hero ────────────────────────────────── */}
        {season && (
          <div className="px-5 mb-5">
            {/* Prize image */}
            {season.prizeImageUrl && (
              <div className="relative rounded-2xl overflow-hidden mb-3 border border-white/10">
                <ImageWithFallback
                  src={season.prizeImageUrl}
                  alt="Premio de la season"
                  className="w-full h-[160px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <p className="font-['Fira_Code'] text-[10px] text-white/60 uppercase tracking-wider">
                    Premio en juego
                  </p>
                </div>
              </div>
            )}

            {/* Season info card */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-bold text-sm">{season.name}</p>
                <span className="text-[10px] text-green-400 font-['Fira_Code'] bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">
                  ACTIVA
                </span>
              </div>

              {/* Dates */}
              <p className="text-white/30 text-[10px] font-['Fira_Code'] mb-3">
                {new Date(season.startDate).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                {season.endDate && ` — ${new Date(season.endDate).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}`}
              </p>

              {/* Countdown */}
              {countdown && !countdown.expired && (
                <div className="flex gap-2 mb-3">
                  {[
                    { val: countdown.days, label: "D" },
                    { val: countdown.hours, label: "H" },
                    { val: countdown.minutes, label: "M" },
                    { val: countdown.seconds, label: "S" },
                  ].map((u) => (
                    <div
                      key={u.label}
                      className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-lg py-2 text-center"
                    >
                      <p className="text-white font-['Fira_Code'] font-bold text-lg leading-none">
                        {String(u.val).padStart(2, "0")}
                      </p>
                      <p className="text-white/30 text-[9px] font-['Fira_Code'] mt-0.5">{u.label}</p>
                    </div>
                  ))}
                </div>
              )}
              {countdown?.expired && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
                  <p className="text-red-400 text-xs font-['Fira_Code'] font-bold text-center">SEASON CERRADA</p>
                </div>
              )}

              {/* Prizes */}
              {season.prizes && season.prizes.length > 0 && (
                <div className="flex flex-col gap-1">
                  {season.prizes.map((prize, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-white/40 font-['Fira_Code'] w-10 shrink-0">
                        #{prize.position}
                      </span>
                      <span className="text-xs text-white/70 flex-1">{prize.description}</span>
                      {prize.value && (
                        <span className="text-[10px] text-white/30 font-['Fira_Code']">{prize.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!season && (
          <div className="px-5 mb-5">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
              <p className="text-white/30 text-xs font-['Fira_Code']">No hay season activa</p>
            </div>
          </div>
        )}

        {/* ── My Profile Card ────────────────────────────── */}
        {profile && (
          <div className="px-5 mb-5">
            <div className="bg-white/[0.06] border border-white/[0.12] rounded-2xl p-4">
              {/* Identity row */}
              <button
                onClick={() => { hapticLight(); onProfile(); }}
                className="w-full flex items-center gap-3 mb-3 text-left"
              >
                <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {myEntry ? `#${myEntry.position}` : "—"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">
                    {profile.firstName || `@${profile.username}`}
                    <span className="text-white/30 font-normal text-[10px] ml-2">VOS</span>
                  </p>
                  <p className="text-white/30 text-[10px] font-['Fira_Code']">
                    {myEntry ? `${myEntry.seasonTickets.toLocaleString("es-AR")} tickets` : "Sin tickets aún"}
                    {" · "}{profile.dropsCompleted}d · {profile.botQuestionsAnswered}q
                  </p>
                </div>
                <span className="text-white/20 text-[10px] font-['Fira_Code']">perfil &gt;</span>
              </button>

              <DashedLine />

              {/* Stats row */}
              <div className="flex items-center justify-between mt-3 gap-3">
                <div className="flex-1">
                  <p className="text-white/30 text-[9px] font-bold uppercase tracking-wider">Cash</p>
                  <p className="text-white font-['Fira_Code'] font-bold text-lg">${cashStr}</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-white/30 text-[9px] font-bold uppercase tracking-wider">Tickets</p>
                  <p className="text-white font-['Fira_Code'] font-bold text-lg">
                    {profile.seasonTickets.toLocaleString("es-AR")}
                  </p>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-white/30 text-[9px] font-bold uppercase tracking-wider">Drops</p>
                  <p className="text-white font-['Fira_Code'] font-bold text-lg">{profile.dropsCompleted}</p>
                </div>
              </div>

              {/* Claim button */}
              <div className="mt-3">
                {canClaim ? (
                  <button
                    onClick={() => { hapticMedium(); onProfile(); }}
                    className="w-full py-2.5 bg-white text-black text-xs font-bold rounded-full active:scale-[0.98] transition-transform"
                  >
                    Reclamar ${cashStr} USD
                  </button>
                ) : (
                  <div className="w-full py-2.5 bg-white/[0.06] border border-white/[0.08] text-white/25 text-xs font-bold rounded-full text-center">
                    Claim cash desde ${CLAIM_MINIMUM_USD} USD
                    <span className="text-white/15 font-normal ml-1">
                      (te faltan ${(CLAIM_MINIMUM_USD - (profile?.totalCoins || 0)).toFixed(2).replace(".", ",")} )
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Ranking Header ─────────────────────────────── */}
        <div className="px-5 mb-2 flex items-center justify-between">
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider">
            Top {entries.length}
          </p>
          <p className="text-white/20 text-[10px] font-['Fira_Code']">
            {totalUsers} jugadores
          </p>
        </div>

        {/* ── Ranking List ───────────────────────────────── */}
        <div className="px-5 flex flex-col gap-[2px] mb-6">
          {entries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/30 text-sm mb-1">Sin jugadores aún</p>
              <p className="text-white/15 text-xs font-['Fira_Code']">
                Completá un drop para aparecer
              </p>
            </div>
          ) : (
            entries.map((entry, idx) => {
              const isMe = telegramUserId && entry.telegramUserId === telegramUserId;
              const isPodium = entry.position <= 3;
              const podiumColors = [
                "from-yellow-500/10 border-yellow-500/20",
                "from-gray-400/10 border-gray-400/20",
                "from-orange-500/10 border-orange-500/20",
              ];

              return (
                <div
                  key={entry.telegramUserId}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    isMe
                      ? "bg-white/10 border border-white/20"
                      : isPodium
                      ? `bg-gradient-to-r ${podiumColors[entry.position - 1]} border`
                      : idx % 2 === 0
                      ? "bg-white/[0.02]"
                      : ""
                  }`}
                >
                  {/* Position */}
                  <div className="w-7 text-center shrink-0">
                    {isPodium ? (
                      <span className="text-base">
                        {entry.position === 1 ? "🥇" : entry.position === 2 ? "🥈" : "🥉"}
                      </span>
                    ) : (
                      <span className="text-white/30 text-[11px] font-['Fira_Code'] font-bold">
                        {entry.position}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      isPodium ? "bg-white/15 text-white" : "bg-white/5 text-white/50"
                    }`}
                  >
                    {(entry.firstName?.[0] || entry.username?.[0] || "?").toUpperCase()}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isMe ? "text-white font-bold" : "text-white/80"}`}>
                      {entry.firstName || `@${entry.username}` || "Anon"}
                      {isMe && <span className="text-white/30 text-[10px] ml-1">(vos)</span>}
                    </p>
                    <p className="text-white/20 text-[9px] font-['Fira_Code']">
                      {entry.dropsCompleted}d · {entry.botQuestionsAnswered}q
                    </p>
                  </div>

                  {/* Tickets */}
                  <div className="text-right shrink-0">
                    <p
                      className={`font-['Fira_Code'] font-bold text-sm ${
                        isPodium ? "text-white" : "text-white/70"
                      }`}
                    >
                      {entry.seasonTickets.toLocaleString("es-AR")}
                    </p>
                    <p className="text-white/15 text-[9px] font-['Fira_Code']">tickets</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Bottom actions ──────────────────────────────── */}
        <div className="px-5 flex flex-col gap-3 mt-auto">
          {telegramUserId && (
            <button
              onClick={() => { hapticLight(); onProfile(); }}
              className="w-full py-3.5 bg-white/10 border border-white/15 text-white text-sm font-bold rounded-full active:scale-[0.98] transition-transform"
            >
              Mi Perfil
            </button>
          )}
          <p className="text-white/10 text-[9px] font-['Fira_Code'] text-center pb-1">
            BRUTAL//////////////// — signal extraction protocol
          </p>
        </div>
      </div>
    </div>
  );
}
