// ============================================================
// PROFILE SCREEN — User profile + reward history in mini app
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { fetchUserProfile, linkWallet } from "./reward-api";
import type { UserProfile, RewardTransaction } from "./reward-api";
import { hapticLight, hapticSuccess, hapticError } from "./haptics";

interface ProfileScreenProps {
  telegramUserId: number;
  onBack: () => void;
  onLeaderboard: () => void;
}

export function ProfileScreen({ telegramUserId, onBack, onLeaderboard }: ProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletInput, setWalletInput] = useState("");
  const [walletSaving, setWalletSaving] = useState(false);
  const [walletSuccess, setWalletSuccess] = useState(false);
  const [showWalletForm, setShowWalletForm] = useState(false);

  const loadProfile = useCallback(async () => {
    const data = await fetchUserProfile(telegramUserId);
    if (data) {
      setProfile(data.profile);
      setTransactions(data.transactions);
      setWalletInput(data.profile.walletAlias || "");
    }
    setLoading(false);
  }, [telegramUserId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Reset dynamic colors from reveal screen
  useEffect(() => {
    document.body.style.setProperty("--dynamic-bg", "#000");
    document.body.style.setProperty("--dynamic-fg", "#fff");
    document.body.style.backgroundColor = "#000";
  }, []);

  const handleWalletSave = async () => {
    if (!walletInput.trim()) return;
    setWalletSaving(true);
    const ok = await linkWallet(telegramUserId, walletInput.trim());
    setWalletSaving(false);
    if (ok) {
      hapticSuccess();
      setWalletSuccess(true);
      setShowWalletForm(false);
      setTimeout(() => setWalletSuccess(false), 2000);
      loadProfile();
    } else {
      hapticError();
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="font-['Fira_Code'] text-xs text-white/50">Cargando perfil...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-black px-6">
        <span className="font-['Fira_Code'] text-sm text-white/50 mb-4 text-center">
          No se encontro tu perfil. Completa un drop o responde una pregunta del bot para empezar.
        </span>
        <button
          onClick={onBack}
          className="px-6 py-3 bg-white text-black font-bold rounded-full text-sm"
        >
          Volver
        </button>
      </div>
    );
  }

  const formattedCoins = profile.totalCoins % 1 === 0
    ? profile.totalCoins.toString()
    : profile.totalCoins.toFixed(2).replace(".", ",");

  return (
    <div className="h-dvh flex justify-center bg-black font-['Roboto'] overflow-hidden">
      <div
        className="w-full max-w-[420px] flex flex-col h-dvh overflow-y-auto overflow-x-hidden"
        style={{
          paddingTop: "calc(var(--tg-safe-top, 0px) + 20px)",
          paddingBottom: "calc(var(--tg-safe-bottom, 0px) + 24px)",
        }}
      >
        {/* Header */}
        <div className="px-5 flex items-center justify-between mb-6">
          <button onClick={() => { hapticLight(); onBack(); }} className="text-white/60 text-sm">
            <span className="font-['Fira_Code']">&lt; volver</span>
          </button>
          <span className="font-['Silkscreen'] text-[11px] text-white/40 tracking-wide">
            BRUTAL////PROFILE
          </span>
        </div>

        {/* Identity */}
        <div className="px-5 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-lg font-bold text-white">
              {(profile.firstName?.[0] || profile.username?.[0] || "?").toUpperCase()}
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">
                {profile.firstName} {profile.lastName}
              </p>
              {profile.username && (
                <p className="text-white/40 text-sm font-['Fira_Code']">@{profile.username}</p>
              )}
            </div>
          </div>
          <p className="text-white/30 text-[10px] font-['Fira_Code'] mt-1">
            Desde {formatDate(profile.firstSeen)} · Activo {formatDate(profile.lastActiveAt)}
          </p>
        </div>

        {/* Stats grid */}
        <div className="px-5 grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1">Cash</p>
            <p className="text-white font-extrabold text-2xl">${formattedCoins}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1">Tickets (season)</p>
            <p className="text-white font-extrabold text-2xl">{profile.seasonTickets.toLocaleString("es-AR")}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1">Drops jugados</p>
            <p className="text-white font-extrabold text-2xl">{profile.dropsCompleted}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1">Preguntas bot</p>
            <p className="text-white font-extrabold text-2xl">{profile.botQuestionsAnswered}</p>
          </div>
        </div>

        {/* Lifetime tickets */}
        <div className="px-5 mb-6">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-white/40 text-xs">Tickets lifetime (todas las seasons)</span>
            <span className="text-white font-bold font-['Fira_Code'] text-sm">{profile.lifetimeTickets.toLocaleString("es-AR")}</span>
          </div>
        </div>

        {/* Wallet / Lemon Cash */}
        <div className="px-5 mb-6">
          <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/60 text-xs font-bold uppercase tracking-wider">Lemon Cash Alias</p>
              {profile.walletAlias && !showWalletForm && (
                <button
                  onClick={() => { hapticLight(); setShowWalletForm(true); }}
                  className="text-white/30 text-[10px] font-['Fira_Code'] underline"
                >
                  editar
                </button>
              )}
            </div>

            {walletSuccess && (
              <p className="text-green-400 text-xs font-['Fira_Code'] mb-2">Alias guardado</p>
            )}

            {profile.walletAlias && !showWalletForm ? (
              <p className="text-white font-['Fira_Code'] text-sm">{profile.walletAlias}</p>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={walletInput}
                  onChange={(e) => setWalletInput(e.target.value)}
                  placeholder="tu-alias.lemon"
                  className="flex-1 bg-black border border-white/20 rounded-lg px-3 py-2 text-white text-sm font-['Fira_Code'] placeholder:text-white/20 focus:outline-none focus:border-white/40"
                />
                <button
                  onClick={handleWalletSave}
                  disabled={walletSaving || !walletInput.trim()}
                  className="px-4 py-2 bg-white text-black text-xs font-bold rounded-lg disabled:opacity-30"
                >
                  {walletSaving ? "..." : "Guardar"}
                </button>
              </div>
            )}
            <p className="text-white/20 text-[10px] mt-2 font-['Fira_Code']">
              Para recibir premios de cada season
            </p>
          </div>
        </div>

        {/* Transaction history */}
        <div className="px-5 mb-6">
          <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3">Historial reciente</p>
          {transactions.length === 0 ? (
            <p className="text-white/20 text-xs font-['Fira_Code'] text-center py-4">
              Sin transacciones aun
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {transactions.slice(0, 20).map((tx) => (
                <div
                  key={tx.txId}
                  className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-5 text-center">
                      {tx.rewardType === "coins" ? "💵" : "🎟️"}
                    </span>
                    <div>
                      <p className="text-white/70 text-xs">
                        {tx.source === "drop" ? "Drop completado" : tx.source === "bot_question" ? "Pregunta bot" : "Bonus"}
                      </p>
                      <p className="text-white/25 text-[10px] font-['Fira_Code']">
                        {formatDate(tx.createdAt)} {formatTime(tx.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span className="text-white font-bold text-sm font-['Fira_Code']">
                    +{tx.rewardValue}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 flex flex-col gap-3 mt-auto">
          <button
            onClick={() => { hapticLight(); onLeaderboard(); }}
            className="w-full py-3.5 bg-white/10 border border-white/20 text-white text-sm font-bold rounded-full"
          >
            Ver Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}