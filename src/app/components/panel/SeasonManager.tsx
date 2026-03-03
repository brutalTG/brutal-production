// ============================================================
// SEASON MANAGER — Panel component for season + leaderboard admin
// Migrated to CSS variables var(--p-*) for light/dark theming
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  Trophy,
  Calendar,
  Users,
  Loader2,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  AlertTriangle,
  Crown,
  Ticket,
  DollarSign,
  Check,
  X,
  Ban,
  Clock,
  Image,
  TicketX,
} from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import type {
  Season,
  SeasonPrize,
  LeaderboardEntry,
  Claim,
  UserProfile,
} from "../reward-api";
import {
  fetchAdminUsers,
  deleteUser,
  updateUserStatus,
  resetAllTickets,
} from "../reward-api";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-c68eb08c`;
const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
});

const formInput: React.CSSProperties = {
  backgroundColor: "var(--p-bg-card)",
  border: "1px solid var(--p-border-subtle)",
  color: "var(--p-text)",
};

export function SeasonManager() {
  const [tab, setTab] = useState<"season" | "leaderboard" | "users" | "claims">("season");
  const [loading, setLoading] = useState(true);

  const [season, setSeason] = useState<Season | null>(null);
  const [seasonName, setSeasonName] = useState("");
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");
  const [prizes, setPrizes] = useState<SeasonPrize[]>([]);
  const [prizeImageUrl, setPrizeImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [lbLoading, setLbLoading] = useState(false);

  const [users, setUsers] = useState<(UserProfile & { status?: string })[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [processingUserId, setProcessingUserId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showResetTicketsConfirm, setShowResetTicketsConfirm] = useState(false);
  const [resettingTickets, setResettingTickets] = useState(false);

  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [processingClaimId, setProcessingClaimId] = useState<string | null>(null);

  const loadSeason = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/season`, { headers: headers() });
      if (res.status === 404) { setSeason(null); setLoading(false); return; }
      if (res.ok) {
        const data = await res.json();
        setSeason(data);
        setSeasonName(data.name || "");
        setSeasonStart(data.startDate ? data.startDate.split("T")[0] : "");
        setSeasonEnd(data.endDate ? data.endDate.split("T")[0] : "");
        setPrizes(data.prizes || []);
        setPrizeImageUrl(data.prizeImageUrl || "");
      }
    } catch (err) { console.error("[Panel] Season load error:", err); }
    setLoading(false);
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setLbLoading(true);
    try {
      const res = await fetch(`${API_BASE}/leaderboard`, { headers: headers() });
      if (res.ok) { const data = await res.json(); setLeaderboard(data.leaderboard || []); setTotalUsers(data.totalUsers || 0); }
    } catch (err) { console.error("[Panel] Leaderboard load error:", err); }
    setLbLoading(false);
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try { const data = await fetchAdminUsers(); if (data) setUsers(data.users); }
    catch (err) { console.error("[Panel] Users load error:", err); }
    setUsersLoading(false);
  }, []);

  const loadClaims = useCallback(async () => {
    setClaimsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/claims`, { headers: headers() });
      if (res.ok) { const data = await res.json(); setClaims(data.claims || []); }
    } catch (err) { console.error("[Panel] Claims load error:", err); }
    setClaimsLoading(false);
  }, []);

  useEffect(() => { loadSeason(); }, [loadSeason]);
  useEffect(() => {
    if (tab === "leaderboard") loadLeaderboard();
    if (tab === "users") loadUsers();
    if (tab === "claims") loadClaims();
  }, [tab, loadLeaderboard, loadUsers, loadClaims]);

  const handleSaveSeason = async () => {
    if (!seasonName.trim()) { setMessage({ type: "error", text: "El nombre de la season es requerido" }); return; }
    setSaving(true); setMessage(null);
    try {
      const body: any = { name: seasonName.trim(), startDate: seasonStart ? new Date(seasonStart).toISOString() : new Date().toISOString(), endDate: seasonEnd ? new Date(seasonEnd).toISOString() : null, prizes, prizeImageUrl: prizeImageUrl.trim() || null };
      if (season?.seasonId) body.seasonId = season.seasonId;
      const res = await fetch(`${API_BASE}/season`, { method: "PUT", headers: headers(), body: JSON.stringify(body) });
      if (res.ok) { const data = await res.json(); setSeason(data.season || data); setMessage({ type: "success", text: "Season guardada" }); }
      else { const err = await res.text(); setMessage({ type: "error", text: `Error: ${err}` }); }
    } catch (err) { setMessage({ type: "error", text: `Error de red: ${err}` }); }
    setSaving(false);
  };

  const handleReset = async () => {
    setResetting(true); setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/season/reset`, { method: "POST", headers: headers() });
      if (res.ok) { const data = await res.json(); setSeason(null); setSeasonName(""); setSeasonStart(""); setSeasonEnd(""); setPrizes([]); setPrizeImageUrl(""); setShowResetConfirm(false); setMessage({ type: "success", text: `Season reseteada. ${data.resetCount} usuarios reseteados.` }); }
      else { const err = await res.text(); setMessage({ type: "error", text: `Error: ${err}` }); }
    } catch (err) { setMessage({ type: "error", text: `Error de red: ${err}` }); }
    setResetting(false);
  };

  const handleResetTicketsOnly = async () => {
    setResettingTickets(true); setMessage(null);
    try {
      const result = await resetAllTickets();
      if (result.ok) { setShowResetTicketsConfirm(false); setMessage({ type: "success", text: `Tickets reseteados. ${result.resetCount} usuarios afectados.` }); if (tab === "users") loadUsers(); if (tab === "leaderboard") loadLeaderboard(); }
      else { setMessage({ type: "error", text: "Error al resetear tickets" }); }
    } catch (err) { setMessage({ type: "error", text: `Error: ${err}` }); }
    setResettingTickets(false);
  };

  const addPrize = () => setPrizes([...prizes, { position: String(prizes.length + 1), description: "", value: "" }]);
  const removePrize = (index: number) => setPrizes(prizes.filter((_, i) => i !== index));
  const updatePrize = (index: number, field: keyof SeasonPrize, value: string) => { const updated = [...prizes]; updated[index] = { ...updated[index], [field]: value }; setPrizes(updated); };

  const handleDeleteUser = async (userId: number) => {
    setProcessingUserId(userId);
    try { const ok = await deleteUser(userId); if (ok) { setUsers((prev) => prev.filter((u) => u.telegramUserId !== userId)); setMessage({ type: "success", text: `Usuario ${userId} eliminado` }); } else { setMessage({ type: "error", text: "Error al eliminar usuario" }); } }
    catch (err) { setMessage({ type: "error", text: `Error: ${err}` }); }
    setProcessingUserId(null); setShowDeleteConfirm(null);
  };

  const handleUserStatus = async (userId: number, status: "active" | "pending" | "banned") => {
    setProcessingUserId(userId);
    try { const ok = await updateUserStatus(userId, status); if (ok) { setUsers((prev) => prev.map((u) => (u.telegramUserId === userId ? { ...u, status } : u))); setMessage({ type: "success", text: `Usuario ${userId} → ${status}` }); } else { setMessage({ type: "error", text: "Error al actualizar estado" }); } }
    catch (err) { setMessage({ type: "error", text: `Error: ${err}` }); }
    setProcessingUserId(null);
  };

  const handleClaimAction = async (claimId: string, status: "approved" | "rejected", note?: string) => {
    setProcessingClaimId(claimId); setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/claims/${claimId}`, { method: "PUT", headers: headers(), body: JSON.stringify({ status, note: note || null }) });
      if (res.ok) { setMessage({ type: "success", text: `Claim ${status === "approved" ? "aprobado" : "rechazado"}` }); loadClaims(); }
      else { const err = await res.text(); setMessage({ type: "error", text: `Error: ${err}` }); }
    } catch (err) { setMessage({ type: "error", text: `Error de red: ${err}` }); }
    setProcessingClaimId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--p-text-ghost)" }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "var(--p-text)" }}>Reward Economy</h2>
        <p className="text-xs" style={{ color: "var(--p-text-faint)" }}>Seasons, leaderboard, usuarios y premios</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: "var(--p-bg-input)" }}>
        {[
          { id: "season" as const, label: "Season", icon: Calendar },
          { id: "leaderboard" as const, label: "Ranking", icon: Trophy },
          { id: "users" as const, label: "Usuarios", icon: Users },
          { id: "claims" as const, label: "Reclamos", icon: DollarSign },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all"
            style={{
              backgroundColor: tab === t.id ? "var(--p-bg-active)" : "transparent",
              color: tab === t.id ? "var(--p-text)" : "var(--p-text-faint)",
            }}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div
          className="px-4 py-2.5 rounded-lg text-xs font-medium"
          style={{
            backgroundColor: message.type === "success" ? "color-mix(in srgb, var(--p-success) 10%, transparent)" : "color-mix(in srgb, var(--p-danger) 10%, transparent)",
            color: message.type === "success" ? "var(--p-success)" : "var(--p-danger)",
            border: `1px solid ${message.type === "success" ? "color-mix(in srgb, var(--p-success) 20%, transparent)" : "color-mix(in srgb, var(--p-danger) 20%, transparent)"}`,
          }}
        >
          {message.text}
        </div>
      )}

      {/* ════════════════════ Season Tab ════════════════════ */}
      {tab === "season" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            {season ? (
              <span className="text-[10px] font-['Fira_Code'] px-2.5 py-1 rounded-full" style={{ color: "var(--p-success)", backgroundColor: "color-mix(in srgb, var(--p-success) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--p-success) 20%, transparent)" }}>
                SEASON ACTIVA: {season.name}
              </span>
            ) : (
              <span className="text-[10px] font-['Fira_Code'] px-2.5 py-1 rounded-full" style={{ color: "var(--p-text-faint)", backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}>
                SIN SEASON ACTIVA
              </span>
            )}
          </div>

          <div className="rounded-xl p-4 flex flex-col gap-4" style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--p-text-faint)" }}>Nombre</label>
              <input type="text" value={seasonName} onChange={(e) => setSeasonName(e.target.value)} placeholder="Season 1 — Genesis" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={formInput} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--p-text-faint)" }}>Inicio</label>
                <input type="date" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none [color-scheme:dark]" style={formInput} />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--p-text-faint)" }}>Cierre</label>
                <input type="date" value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none [color-scheme:dark]" style={formInput} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 flex items-center gap-1.5" style={{ color: "var(--p-text-faint)" }}>
                <Image size={11} /> Imagen premio (URL)
              </label>
              <input type="url" value={prizeImageUrl} onChange={(e) => setPrizeImageUrl(e.target.value)} placeholder="https://ejemplo.com/premio.jpg" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={formInput} />
              {prizeImageUrl && (
                <div className="mt-2 rounded-lg overflow-hidden h-[80px]" style={{ border: "1px solid var(--p-border-subtle)" }}>
                  <img src={prizeImageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              )}
            </div>

            {/* Prizes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--p-text-faint)" }}>Premios</label>
                <button onClick={addPrize} className="text-[10px] flex items-center gap-1 transition-colors" style={{ color: "var(--p-text-muted)" }}>
                  <Plus size={12} /> Agregar
                </button>
              </div>
              {prizes.length === 0 ? (
                <p className="text-xs text-center py-3" style={{ color: "var(--p-text-ghost)" }}>Sin premios configurados</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {prizes.map((prize, i) => (
                    <div key={i} className="flex gap-2 items-start rounded-lg p-2.5" style={{ backgroundColor: "var(--p-bg-card)" }}>
                      <input type="text" value={prize.position} onChange={(e) => updatePrize(i, "position", e.target.value)} placeholder="#" className="w-14 bg-transparent rounded px-2 py-1.5 text-xs text-center focus:outline-none" style={{ border: "1px solid var(--p-border-subtle)", color: "var(--p-text)" }} />
                      <input type="text" value={prize.description} onChange={(e) => updatePrize(i, "description", e.target.value)} placeholder="Descripcion del premio" className="flex-1 bg-transparent rounded px-2 py-1.5 text-xs focus:outline-none" style={{ border: "1px solid var(--p-border-subtle)", color: "var(--p-text)" }} />
                      <input type="text" value={prize.value || ""} onChange={(e) => updatePrize(i, "value", e.target.value)} placeholder="Valor" className="w-24 bg-transparent rounded px-2 py-1.5 text-xs focus:outline-none" style={{ border: "1px solid var(--p-border-subtle)", color: "var(--p-text)" }} />
                      <button onClick={() => removePrize(i)} className="p-1.5 transition-colors" style={{ color: "var(--p-text-ghost)" }} onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-danger)"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button onClick={handleSaveSeason} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-colors disabled:opacity-40" style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {season ? "Actualizar Season" : "Crear Season"}
              </button>
              {season && (
                <button onClick={() => setShowResetConfirm(true)} className="px-4 py-2.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5" style={{ backgroundColor: "color-mix(in srgb, var(--p-danger) 10%, transparent)", color: "var(--p-danger)", border: "1px solid color-mix(in srgb, var(--p-danger) 20%, transparent)" }}>
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>
          </div>

          {/* Reset confirm */}
          {showResetConfirm && (
            <div className="rounded-xl p-4" style={{ backgroundColor: "color-mix(in srgb, var(--p-danger) 5%, var(--p-bg))", border: "1px solid color-mix(in srgb, var(--p-danger) 20%, transparent)" }}>
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: "var(--p-danger)" }} />
                <div className="flex-1">
                  <p className="text-sm font-bold mb-1" style={{ color: "var(--p-danger)" }}>Resetear Season?</p>
                  <p className="text-xs mb-3" style={{ color: "color-mix(in srgb, var(--p-danger) 60%, var(--p-text))" }}>
                    Esto archiva la season actual y resetea los seasonTickets de TODOS los usuarios a 0. Los lifetimeTickets se mantienen. Esta accion no se puede deshacer.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={handleReset} disabled={resetting} className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                      {resetting ? <Loader2 size={12} className="animate-spin" /> : null}
                      Confirmar Reset
                    </button>
                    <button onClick={() => setShowResetConfirm(false)} className="px-4 py-2 text-xs font-bold rounded-lg transition-colors" style={{ backgroundColor: "var(--p-bg-active)", color: "var(--p-text-muted)" }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ Leaderboard Tab ════════════════════ */}
      {tab === "leaderboard" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: "var(--p-text-faint)" }}>
              {totalUsers} usuarios con tickets · Top {leaderboard.length}
            </p>
            <button onClick={loadLeaderboard} disabled={lbLoading} className="text-[10px] flex items-center gap-1 transition-colors disabled:opacity-40" style={{ color: "var(--p-text-muted)" }}>
              {lbLoading ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
              Refresh
            </button>
          </div>

          {lbLoading && leaderboard.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={16} className="animate-spin" style={{ color: "var(--p-text-ghost)" }} />
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color: "var(--p-text-ghost)" }}>Sin jugadores aun</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}>
              <div className="grid grid-cols-[40px_1fr_80px_80px_60px] gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--p-text-ghost)", borderBottom: "1px solid var(--p-border-subtle)" }}>
                <span>#</span>
                <span>Usuario</span>
                <span className="text-right">S.Tickets</span>
                <span className="text-right">Lifetime</span>
                <span className="text-right">Drops</span>
              </div>
              {leaderboard.map((entry) => (
                <div key={entry.telegramUserId} className="grid grid-cols-[40px_1fr_80px_80px_60px] gap-2 px-3 py-2.5 transition-colors" style={{ borderBottom: "1px solid var(--p-bg-card)" }}>
                  <span className="text-xs">
                    {entry.position <= 3 ? (
                      <Crown size={14} className={entry.position === 1 ? "text-yellow-400" : entry.position === 2 ? "text-gray-300" : "text-orange-400"} />
                    ) : (
                      <span className="font-['Fira_Code']" style={{ color: "var(--p-text-faint)" }}>{entry.position}</span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs truncate" style={{ color: "var(--p-text)" }}>{entry.firstName || "Anon"}</p>
                    <p className="text-[10px] font-['Fira_Code'] truncate" style={{ color: "var(--p-text-ghost)" }}>
                      {entry.username ? `@${entry.username}` : `ID: ${entry.telegramUserId}`}
                    </p>
                  </div>
                  <span className="text-xs font-['Fira_Code'] font-bold text-right" style={{ color: "var(--p-text)" }}>{entry.seasonTickets.toLocaleString("es-AR")}</span>
                  <span className="text-xs font-['Fira_Code'] text-right" style={{ color: "var(--p-text-faint)" }}>{entry.lifetimeTickets.toLocaleString("es-AR")}</span>
                  <span className="text-xs font-['Fira_Code'] text-right" style={{ color: "var(--p-text-faint)" }}>{entry.dropsCompleted}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ Users Tab ════════════════════ */}
      {tab === "users" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: "var(--p-text-faint)" }}>{users.length} usuarios registrados</p>
            <div className="flex gap-2">
              <button onClick={() => setShowResetTicketsConfirm(true)} className="text-[10px] flex items-center gap-1 transition-colors px-2 py-1 rounded" style={{ color: "var(--p-warning)", backgroundColor: "color-mix(in srgb, var(--p-warning) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--p-warning) 20%, transparent)" }}>
                <TicketX size={11} /> Reset Tickets
              </button>
              <button onClick={loadUsers} disabled={usersLoading} className="text-[10px] flex items-center gap-1 transition-colors disabled:opacity-40" style={{ color: "var(--p-text-muted)" }}>
                {usersLoading ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                Refresh
              </button>
            </div>
          </div>

          {/* Reset tickets confirm */}
          {showResetTicketsConfirm && (
            <div className="rounded-xl p-4" style={{ backgroundColor: "color-mix(in srgb, var(--p-warning) 5%, var(--p-bg))", border: "1px solid color-mix(in srgb, var(--p-warning) 20%, transparent)" }}>
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: "var(--p-warning)" }} />
                <div className="flex-1">
                  <p className="text-sm font-bold mb-1" style={{ color: "var(--p-warning)" }}>Resetear TODOS los tickets?</p>
                  <p className="text-xs mb-3" style={{ color: "color-mix(in srgb, var(--p-warning) 60%, var(--p-text))" }}>
                    Pone los seasonTickets de todos los usuarios en 0. La season NO se archiva. Ideal despues de asignar premios.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={handleResetTicketsOnly} disabled={resettingTickets} className="px-4 py-2 bg-orange-500 text-white text-xs font-bold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                      {resettingTickets ? <Loader2 size={12} className="animate-spin" /> : <TicketX size={12} />}
                      Confirmar
                    </button>
                    <button onClick={() => setShowResetTicketsConfirm(false)} className="px-4 py-2 text-xs font-bold rounded-lg transition-colors" style={{ backgroundColor: "var(--p-bg-active)", color: "var(--p-text-muted)" }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {usersLoading && users.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={16} className="animate-spin" style={{ color: "var(--p-text-ghost)" }} />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color: "var(--p-text-ghost)" }}>Sin usuarios registrados</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}>
              <div className="grid grid-cols-[1fr_60px_60px_50px_50px_60px_100px_32px] gap-1 px-3 py-2 text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--p-text-ghost)", borderBottom: "1px solid var(--p-border-subtle)" }}>
                <span>Usuario</span>
                <span className="text-right">Cash</span>
                <span className="text-right">S.Tix</span>
                <span className="text-right">Drops</span>
                <span className="text-right">BotQ</span>
                <span className="text-center">Status</span>
                <span className="text-center">Acciones</span>
                <span></span>
              </div>
              {users.map((user) => {
                const status = (user as any).status || "active";
                const statusColor =
                  status === "active" ? "text-green-400 bg-green-400/10 border-green-400/20" :
                  status === "pending" ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" :
                  "text-red-400 bg-red-400/10 border-red-400/20";
                const coinsStr = user.totalCoins % 1 === 0 ? user.totalCoins.toString() : user.totalCoins.toFixed(2);
                const isProcessing = processingUserId === user.telegramUserId;

                return (
                  <div key={user.telegramUserId}>
                    <div className="grid grid-cols-[1fr_60px_60px_50px_50px_60px_100px_32px] gap-1 px-3 py-2 transition-colors items-center" style={{ borderBottom: "1px solid var(--p-bg-card)" }}>
                      <div className="min-w-0">
                        <p className="text-xs truncate" style={{ color: "var(--p-text)" }}>{user.firstName} {user.lastName}</p>
                        <p className="text-[9px] font-['Fira_Code'] truncate" style={{ color: "var(--p-text-ghost)" }}>
                          {user.username ? `@${user.username}` : `ID:${user.telegramUserId}`}
                        </p>
                      </div>
                      <span className="text-xs font-['Fira_Code'] font-bold text-right" style={{ color: "var(--p-text)" }}>${coinsStr}</span>
                      <span className="text-xs font-['Fira_Code'] font-bold text-right" style={{ color: "var(--p-text)" }}>{user.seasonTickets}</span>
                      <span className="text-xs font-['Fira_Code'] text-right" style={{ color: "var(--p-text-muted)" }}>{user.dropsCompleted}</span>
                      <span className="text-xs font-['Fira_Code'] text-right" style={{ color: "var(--p-text-muted)" }}>{user.botQuestionsAnswered}</span>
                      <div className="flex justify-center">
                        <span className={`text-[8px] font-['Fira_Code'] px-1.5 py-0.5 rounded-full border ${statusColor}`}>
                          {status.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex gap-1 justify-center">
                        {status !== "pending" && (
                          <button onClick={() => handleUserStatus(user.telegramUserId, "pending")} disabled={isProcessing} className="p-1 text-yellow-400/60 hover:text-yellow-400 transition-colors disabled:opacity-40" title="Set Pending"><Clock size={12} /></button>
                        )}
                        {status !== "active" && (
                          <button onClick={() => handleUserStatus(user.telegramUserId, "active")} disabled={isProcessing} className="p-1 text-green-400/60 hover:text-green-400 transition-colors disabled:opacity-40" title="Set Active"><Check size={12} /></button>
                        )}
                        {status !== "banned" && (
                          <button onClick={() => handleUserStatus(user.telegramUserId, "banned")} disabled={isProcessing} className="p-1 text-red-400/40 hover:text-red-400 transition-colors disabled:opacity-40" title="Ban"><Ban size={12} /></button>
                        )}
                      </div>
                      <button
                        onClick={() => showDeleteConfirm === user.telegramUserId ? handleDeleteUser(user.telegramUserId) : setShowDeleteConfirm(user.telegramUserId)}
                        disabled={isProcessing}
                        className="p-1 transition-colors disabled:opacity-40"
                        style={{ color: showDeleteConfirm === user.telegramUserId ? "var(--p-danger)" : "var(--p-text-ghost)" }}
                        title={showDeleteConfirm === user.telegramUserId ? "Confirmar eliminar" : "Eliminar"}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {showDeleteConfirm === user.telegramUserId && (
                      <div className="px-3 py-1.5 flex items-center gap-3" style={{ backgroundColor: "color-mix(in srgb, var(--p-danger) 5%, transparent)", borderBottom: "1px solid color-mix(in srgb, var(--p-danger) 20%, transparent)" }}>
                        <p className="text-[10px] flex-1" style={{ color: "var(--p-danger)" }}>Click trash de nuevo para eliminar, o:</p>
                        <button onClick={() => setShowDeleteConfirm(null)} className="text-[10px] px-2 py-1 rounded" style={{ color: "var(--p-text-muted)", backgroundColor: "var(--p-bg-active)" }}>Cancelar</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ Claims Tab ════════════════════ */}
      {tab === "claims" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: "var(--p-text-faint)" }}>
              {claims.filter((c) => c.status === "pending").length} pendientes · {claims.length} total
            </p>
            <button onClick={loadClaims} disabled={claimsLoading} className="text-[10px] flex items-center gap-1 transition-colors disabled:opacity-40" style={{ color: "var(--p-text-muted)" }}>
              {claimsLoading ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
              Refresh
            </button>
          </div>

          {claimsLoading && claims.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={16} className="animate-spin" style={{ color: "var(--p-text-ghost)" }} />
            </div>
          ) : claims.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign size={28} className="mx-auto mb-2" style={{ color: "var(--p-text-ghost)" }} />
              <p className="text-sm" style={{ color: "var(--p-text-ghost)" }}>Sin reclamos</p>
              <p className="text-[10px] font-['Fira_Code'] mt-1" style={{ color: "var(--p-text-ghost)" }}>
                Los usuarios reclaman via /claim en el bot
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {claims.map((claim) => {
                const isPending = claim.status === "pending";
                const statusColor = claim.status === "approved" ? "text-green-400" : claim.status === "rejected" ? "text-red-400" : "text-yellow-400";
                const statusBg = claim.status === "approved" ? "bg-green-400/10 border-green-400/20" : claim.status === "rejected" ? "bg-red-400/10 border-red-400/20" : "bg-yellow-400/10 border-yellow-400/20";
                return (
                  <div key={claim.claimId} className={`rounded-xl p-4 ${isPending ? "" : "opacity-60"}`} style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--p-text)" }}>
                          {claim.firstName || "Anon"} {claim.username ? `(@${claim.username})` : ""}
                        </p>
                        <p className="text-[10px] font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>
                          ID: {claim.telegramUserId} · {new Date(claim.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <span className={`text-[10px] font-['Fira_Code'] px-2 py-0.5 rounded-full border ${statusBg} ${statusColor}`}>
                        {claim.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mb-3">
                      <div>
                        <p className="text-[10px] uppercase" style={{ color: "var(--p-text-faint)" }}>Monto</p>
                        <p className="font-bold font-['Fira_Code']" style={{ color: "var(--p-text)" }}>${claim.amount}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase" style={{ color: "var(--p-text-faint)" }}>Wallet</p>
                        <p className="text-sm font-['Fira_Code']" style={{ color: "var(--p-text)" }}>{claim.walletAlias}</p>
                      </div>
                    </div>

                    {claim.note && (
                      <p className="text-[10px] font-['Fira_Code'] mb-2" style={{ color: "var(--p-text-faint)" }}>Nota: {claim.note}</p>
                    )}

                    {isPending && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleClaimAction(claim.claimId, "approved")}
                          disabled={processingClaimId === claim.claimId}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-500/10 text-green-400 text-xs font-bold rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-40 border border-green-500/20"
                        >
                          {processingClaimId === claim.claimId ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          Aprobar
                        </button>
                        <button
                          onClick={() => { const note = prompt("Motivo del rechazo (opcional):"); handleClaimAction(claim.claimId, "rejected", note || undefined); }}
                          disabled={processingClaimId === claim.claimId}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-500/10 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-40 border border-red-500/20"
                        >
                          <X size={12} /> Rechazar
                        </button>
                      </div>
                    )}

                    {claim.resolvedAt && (
                      <p className="text-[10px] font-['Fira_Code'] mt-2" style={{ color: "var(--p-text-ghost)" }}>
                        Resuelto: {new Date(claim.resolvedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
