// ============================================================
// NODOS MANAGER — Application management + segmentation panel
// ============================================================

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users, Loader2, Search, Filter, X, ChevronDown, ChevronUp,
  Check, Ban, Trash2, Eye, ToggleLeft, ToggleRight, Save,
  Tag, Plus, RefreshCw, AlertTriangle, Copy, Download,
  UserCheck, UserX, Clock, ChevronRight, Layers,
} from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const API_BASE = "";
const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
});

// ── Types ────────────────────────────────────────────────────

type NodoStatus = "pending" | "active" | "blocked";

interface Nodo {
  applicationId: string;
  phone: string;
  nickname: string;
  age: number;
  gender: string;
  location: string;
  phoneBrand: string;
  spending: string[];
  platforms: string[];
  musicGenre: string;
  politicalStance: number;
  toxicBrand: string;
  occupation: string;
  aspirational: string;
  financialStress: number;
  confession: string;
  handles: {
    instagram?: string;
    tiktok?: string;
    twitter?: string;
    spotify?: string;
  };
  referralCode: string;
  referredBy?: string;
  queuePosition: number;
  positionBoost: number;
  telegramUserId?: number;
  status?: NodoStatus;
  createdAt: string;
  statusUpdatedAt?: string;
}

interface Segment {
  segmentId: string;
  name: string;
  filters: FilterState;
  matchingCount: number;
  createdAt: string;
  updatedAt: string;
}

interface FilterState {
  status?: NodoStatus[];
  ageMin?: number;
  ageMax?: number;
  gender?: string[];
  locationZone?: string[];
  locationDetail?: string[];
  phoneBrand?: string[];
  spending?: string[];
  platforms?: string[];
  musicGenre?: string[];
  politicalMin?: number;
  politicalMax?: number;
  occupation?: string[];
  financialStressMin?: number;
  financialStressMax?: number;
  hasInstagram?: boolean;
  hasTiktok?: boolean;
  hasTwitter?: boolean;
  hasSpotify?: boolean;
  searchQuery?: string;
}

// ── Filter Options ──────────────────────────────────────────

const GENDER_OPTIONS = ["Hombre", "Mujer", "No binario", "Prefiero no decir"];
const LOCATION_ZONES = ["CABA", "GBA Norte", "GBA Sur", "GBA Oeste", "Interior"];
const PHONE_BRANDS = [
  "iPhone (último modelo)", "iPhone (modelo anterior)",
  "Samsung Galaxy S o A alto", "Motorola/Xiaomi gama media", "Otro",
];
const SPENDING_OPTIONS = [
  "Ropa y zapatillas", "Joda y salidas", "Gaming y tech",
  "Comida delivery", "Música y streaming", "Ahorro o crypto",
  "Cuidado personal", "Apuestas",
];
const PLATFORM_OPTIONS = [
  "Instagram", "TikTok", "YouTube", "X (Twitter)", "Discord",
  "Twitch", "Telegram", "Spotify", "WhatsApp", "Reddit",
];
const MUSIC_OPTIONS = [
  "Trap", "Reggaetón", "Rock", "Pop", "Cumbia",
  "Electrónica", "Jazz/Soul", "K-Pop", "Clásica", "Otro",
];
const OCCUPATION_OPTIONS = [
  "Estudio secundario", "Estudio terciario/universidad",
  "Laburo", "Estudio y laburo", "Ni estudio ni laburo", "Otra cosa",
];
const POLITICAL_LABELS: Record<number, string> = {
  1: "Lo banco fuerte", 2: "Tibio a favor", 3: "Ni fu ni fa",
  4: "Tibio en contra", 5: "Lo detesto",
};
const STRESS_LABELS: Record<number, string> = {
  1: "Tranqui", 2: "Pienso, no estresa", 3: "Me preocupa",
  4: "Me estresa", 5: "Me angustia",
};

// ── Filter logic ────────────────────────────────────────────

function applyFilters(nodos: Nodo[], filters: FilterState): Nodo[] {
  return nodos.filter((n) => {
    // Search query
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const searchable = `${n.nickname} ${n.phone} ${n.location} ${n.toxicBrand} ${n.aspirational} ${n.confession}`.toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    // Status
    if (filters.status && filters.status.length > 0) {
      if (!filters.status.includes(n.status || "pending")) return false;
    }
    // Age
    if (filters.ageMin !== undefined && n.age < filters.ageMin) return false;
    if (filters.ageMax !== undefined && n.age > filters.ageMax) return false;
    // Gender
    if (filters.gender && filters.gender.length > 0) {
      if (!filters.gender.includes(n.gender)) return false;
    }
    // Location zone
    if (filters.locationZone && filters.locationZone.length > 0) {
      const zone = n.location.split(" — ")[0] || n.location;
      if (!filters.locationZone.some((z) => zone.startsWith(z))) return false;
    }
    // Location detail
    if (filters.locationDetail && filters.locationDetail.length > 0) {
      const detail = n.location.split(" — ")[1] || "";
      if (!filters.locationDetail.some((d) => detail.includes(d))) return false;
    }
    // Phone brand
    if (filters.phoneBrand && filters.phoneBrand.length > 0) {
      if (!filters.phoneBrand.includes(n.phoneBrand)) return false;
    }
    // Spending (any match)
    if (filters.spending && filters.spending.length > 0) {
      if (!n.spending?.some((s) => filters.spending!.includes(s))) return false;
    }
    // Platforms (any match)
    if (filters.platforms && filters.platforms.length > 0) {
      if (!n.platforms?.some((p) => filters.platforms!.includes(p))) return false;
    }
    // Music
    if (filters.musicGenre && filters.musicGenre.length > 0) {
      if (!filters.musicGenre.includes(n.musicGenre)) return false;
    }
    // Political
    if (filters.politicalMin !== undefined && n.politicalStance < filters.politicalMin) return false;
    if (filters.politicalMax !== undefined && n.politicalStance > filters.politicalMax) return false;
    // Occupation
    if (filters.occupation && filters.occupation.length > 0) {
      if (!filters.occupation.includes(n.occupation)) return false;
    }
    // Financial stress
    if (filters.financialStressMin !== undefined && n.financialStress < filters.financialStressMin) return false;
    if (filters.financialStressMax !== undefined && n.financialStress > filters.financialStressMax) return false;
    // Handles
    if (filters.hasInstagram && !n.handles?.instagram) return false;
    if (filters.hasTiktok && !n.handles?.tiktok) return false;
    if (filters.hasTwitter && !n.handles?.twitter) return false;
    if (filters.hasSpotify && !n.handles?.spotify) return false;

    return true;
  });
}

function isFilterEmpty(f: FilterState): boolean {
  return !f.searchQuery && !f.status?.length && f.ageMin === undefined && f.ageMax === undefined
    && !f.gender?.length && !f.locationZone?.length && !f.locationDetail?.length
    && !f.phoneBrand?.length && !f.spending?.length && !f.platforms?.length
    && !f.musicGenre?.length && f.politicalMin === undefined && f.politicalMax === undefined
    && !f.occupation?.length && f.financialStressMin === undefined && f.financialStressMax === undefined
    && !f.hasInstagram && !f.hasTiktok && !f.hasTwitter && !f.hasSpotify;
}

function countActiveFilters(f: FilterState): number {
  let count = 0;
  if (f.status?.length) count++;
  if (f.ageMin !== undefined || f.ageMax !== undefined) count++;
  if (f.gender?.length) count++;
  if (f.locationZone?.length) count++;
  if (f.phoneBrand?.length) count++;
  if (f.spending?.length) count++;
  if (f.platforms?.length) count++;
  if (f.musicGenre?.length) count++;
  if (f.politicalMin !== undefined || f.politicalMax !== undefined) count++;
  if (f.occupation?.length) count++;
  if (f.financialStressMin !== undefined || f.financialStressMax !== undefined) count++;
  if (f.hasInstagram || f.hasTiktok || f.hasTwitter || f.hasSpotify) count++;
  return count;
}

// ── Sub-components ──────────────────────────────────────────

function StatusBadge({ status }: { status: NodoStatus }) {
  const config: Record<NodoStatus, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-yellow-500/10", text: "text-yellow-400", label: "Pending" },
    active: { bg: "bg-green-500/10", text: "text-green-400", label: "Active" },
    blocked: { bg: "bg-red-500/10", text: "text-red-400", label: "Blocked" },
  };
  const c = config[status];
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function StatusToggle({ status, loading, onToggle }: { status: NodoStatus; loading: boolean; onToggle: () => void }) {
  const isActive = status === "active";
  return (
    <button
      onClick={onToggle}
      disabled={loading || status === "blocked"}
      className="flex items-center gap-1 disabled:opacity-40"
      title={status === "blocked" ? "Desbloqueá primero" : isActive ? "Cambiar a Pending" : "Activar nodo"}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin text-[#555]" />
      ) : isActive ? (
        <ToggleRight size={18} className="text-green-400" />
      ) : (
        <ToggleLeft size={18} className="text-[#555]" />
      )}
    </button>
  );
}

// Filter chip
function FilterChipMulti({
  label, options, selected, onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
          selected.length > 0
            ? "bg-white/10 border-white/20 text-white"
            : "bg-[#111] border-[#222] text-[#888] hover:border-[#444]"
        }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="bg-white/20 text-[10px] px-1.5 rounded-full">{selected.length}</span>
        )}
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl p-2 min-w-[200px] max-h-[280px] overflow-y-auto">
            {options.map((opt) => {
              const isSelected = selected.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => {
                    onChange(
                      isSelected
                        ? selected.filter((s) => s !== opt)
                        : [...selected, opt]
                    );
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded text-[12px] flex items-center gap-2 ${
                    isSelected ? "text-white bg-white/10" : "text-[#aaa] hover:bg-white/5"
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-white border-white" : "border-[#555]"
                  }`}>
                    {isSelected && <Check size={9} className="text-black" />}
                  </div>
                  <span className="truncate">{opt}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function FilterRange({
  label, min, max, valueMin, valueMax, onChange, formatLabel,
}: {
  label: string;
  min: number;
  max: number;
  valueMin?: number;
  valueMax?: number;
  onChange: (vMin: number | undefined, vMax: number | undefined) => void;
  formatLabel?: (v: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const hasValue = valueMin !== undefined || valueMax !== undefined;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
          hasValue
            ? "bg-white/10 border-white/20 text-white"
            : "bg-[#111] border-[#222] text-[#888] hover:border-[#444]"
        }`}
      >
        {label}
        {hasValue && (
          <span className="text-[10px] opacity-70">
            {valueMin ?? min}–{valueMax ?? max}
          </span>
        )}
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl p-3 min-w-[220px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1">
                <label className="text-[10px] text-[#666] block mb-1">Mín</label>
                <input
                  type="number"
                  min={min}
                  max={max}
                  value={valueMin ?? ""}
                  onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined, valueMax)}
                  className="w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-[12px] text-white outline-none"
                  placeholder={String(min)}
                />
              </div>
              <span className="text-[#555] mt-4">–</span>
              <div className="flex-1">
                <label className="text-[10px] text-[#666] block mb-1">Máx</label>
                <input
                  type="number"
                  min={min}
                  max={max}
                  value={valueMax ?? ""}
                  onChange={(e) => onChange(valueMin, e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-[12px] text-white outline-none"
                  placeholder={String(max)}
                />
              </div>
            </div>
            {formatLabel && (
              <div className="flex justify-between text-[10px] text-[#555]">
                <span>{formatLabel(valueMin ?? min)}</span>
                <span>{formatLabel(valueMax ?? max)}</span>
              </div>
            )}
            <button
              onClick={() => { onChange(undefined, undefined); setOpen(false); }}
              className="mt-2 text-[10px] text-[#666] hover:text-white"
            >
              Limpiar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function FilterToggle({
  label, value, onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
        value
          ? "bg-white/10 border-white/20 text-white"
          : "bg-[#111] border-[#222] text-[#888] hover:border-[#444]"
      }`}
    >
      {value ? <Check size={10} /> : null}
      {label}
    </button>
  );
}

// ── Nodo Detail Card ────────────────────────────────────────

function NodoDetail({ nodo, onClose }: { nodo: Nodo; onClose: () => void }) {
  const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between py-1.5" style={{ borderBottom: "1px solid var(--p-border-subtle)" }}>
      <span className="text-[11px]" style={{ color: "var(--p-text-muted)" }}>{label}</span>
      <span className="text-[12px] text-right max-w-[60%] break-words" style={{ color: "var(--p-text-secondary)" }}>{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="border rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto p-5"
        style={{ backgroundColor: "var(--p-bg-card)", borderColor: "var(--p-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-lg" style={{ color: "var(--p-text)" }}>{nodo.nickname}</h3>
            <StatusBadge status={nodo.status || "pending"} />
          </div>
          <button onClick={onClose} style={{ color: "var(--p-text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-0">
          <DetailRow label="Teléfono" value={nodo.phone} />
          <DetailRow label="Edad" value={nodo.age} />
          <DetailRow label="Género" value={nodo.gender} />
          <DetailRow label="Ubicación" value={nodo.location} />
          <DetailRow label="Celular" value={nodo.phoneBrand} />
          <DetailRow label="Gasto" value={nodo.spending?.join(", ") || "—"} />
          <DetailRow label="Plataformas" value={nodo.platforms?.join(", ") || "—"} />
          <DetailRow label="Música" value={nodo.musicGenre || "—"} />
          <DetailRow label="Política" value={POLITICAL_LABELS[nodo.politicalStance] || nodo.politicalStance} />
          <DetailRow label="Marca tóxica" value={nodo.toxicBrand || "—"} />
          <DetailRow label="Ocupación" value={nodo.occupation || "—"} />
          <DetailRow label="Aspiracional" value={nodo.aspirational || "—"} />
          <DetailRow label="Estrés financiero" value={STRESS_LABELS[nodo.financialStress] || nodo.financialStress} />
          <DetailRow label="Confesión" value={nodo.confession || "—"} />
          {nodo.handles?.instagram && <DetailRow label="Instagram" value={`@${nodo.handles.instagram}`} />}
          {nodo.handles?.tiktok && <DetailRow label="TikTok" value={`@${nodo.handles.tiktok}`} />}
          {nodo.handles?.twitter && <DetailRow label="X" value={`@${nodo.handles.twitter}`} />}
          {nodo.handles?.spotify && <DetailRow label="Spotify" value={nodo.handles.spotify} />}
          <DetailRow label="Posición fila" value={`#${nodo.queuePosition}`} />
          <DetailRow label="Boost" value={`+${nodo.positionBoost}`} />
          <DetailRow label="Código referido" value={nodo.referralCode} />
          <DetailRow label="Registrado" value={new Date(nodo.createdAt).toLocaleDateString("es-AR")} />
          {nodo.telegramUserId && <DetailRow label="Telegram ID" value={nodo.telegramUserId} />}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────

export function NodosManager() {
  const [tab, setTab] = useState<"nodos" | "segments">("nodos");
  const [nodos, setNodos] = useState<Nodo[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<FilterState>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusLoading, setStatusLoading] = useState<Set<string>>(new Set());
  const [detailNodo, setDetailNodo] = useState<Nodo | null>(null);
  const [segmentName, setSegmentName] = useState("");
  const [savingSegment, setSavingSegment] = useState(false);
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [refreshingSegments, setRefreshingSegments] = useState<Set<string>>(new Set());

  // ── Fetch data ────────────────────────────────────────────
  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [nodosRes, segmentsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/applications`, { headers: headers() }),
        fetch(`${API_BASE}/admin/segments`, { headers: headers() }),
      ]);
      if (nodosRes.ok) {
        const data = await nodosRes.json();
        setNodos(data.applications || []);
      }
      if (segmentsRes.ok) {
        const data = await segmentsRes.json();
        setSegments(data.segments || []);
      }
    } catch (err) {
      console.error("[NodosManager] Fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Filtered nodos ────────────────────────────────────────
  const filteredNodos = useMemo(() => applyFilters(nodos, filters), [nodos, filters]);
  const activeFilterCount = countActiveFilters(filters);

  // ── Status update ─────────────────────────────────────────
  const updateStatus = async (id: string, newStatus: NodoStatus) => {
    setStatusLoading((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`${API_BASE}/admin/applications/${id}/status`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setNodos((prev) =>
          prev.map((n) => (n.applicationId === id ? { ...n, ...data.application } : n))
        );
      }
    } catch (err) {
      console.error("[NodosManager] Status update error:", err);
    } finally {
      setStatusLoading((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // ── Delete nodo ───────────────────────────────────────────
  const deleteNodo = async (id: string) => {
    if (!confirm("Eliminar este nodo permanentemente?")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/applications/${id}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (res.ok) {
        setNodos((prev) => prev.filter((n) => n.applicationId !== id));
      }
    } catch (err) {
      console.error("[NodosManager] Delete error:", err);
    }
  };

  // ── Bulk actions ──────────────────────────────────────────
  const handleBulkAction = async (action: string) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);

    if (action === "delete") {
      if (!confirm(`Eliminar ${ids.length} nodos permanentemente?`)) return;
      for (const id of ids) {
        await fetch(`${API_BASE}/admin/applications/${id}`, { method: "DELETE", headers: headers() });
      }
      setNodos((prev) => prev.filter((n) => !selectedIds.has(n.applicationId)));
      setSelectedIds(new Set());
      return;
    }

    // Bulk status update
    const status = action as NodoStatus;
    try {
      const res = await fetch(`${API_BASE}/admin/applications/bulk-status`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ ids, status }),
      });
      if (res.ok) {
        setNodos((prev) =>
          prev.map((n) =>
            selectedIds.has(n.applicationId)
              ? { ...n, status, statusUpdatedAt: new Date().toISOString() }
              : n
          )
        );
        setSelectedIds(new Set());
      }
    } catch (err) {
      console.error("[NodosManager] Bulk action error:", err);
    }
    setBulkAction(null);
  };

  // ── Save segment ──────────────────────────────────────────
  const saveSegment = async () => {
    if (!segmentName.trim() || isFilterEmpty(filters)) return;
    setSavingSegment(true);
    try {
      // Collect telegramUserIds of matching active nodos for targeted sends
      const matchingTelegramUserIds = filteredNodos
        .filter((n) => n.telegramUserId)
        .map((n) => String(n.telegramUserId));

      const res = await fetch(`${API_BASE}/admin/segments`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          name: segmentName.trim(),
          filters,
          matchingCount: filteredNodos.length,
          matchingTelegramUserIds,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSegments((prev) => [data.segment, ...prev]);
        setSegmentName("");
      }
    } catch (err) {
      console.error("[NodosManager] Save segment error:", err);
    } finally {
      setSavingSegment(false);
    }
  };

  // ── Refresh segment (re-evaluate filters against current nodos) ──
  const refreshSegment = async (segment: Segment) => {
    setRefreshingSegments((prev) => new Set([...prev, segment.segmentId]));
    try {
      const matching = applyFilters(nodos, segment.filters);
      const matchingTelegramUserIds = matching
        .filter((n) => n.telegramUserId)
        .map((n) => String(n.telegramUserId));

      const res = await fetch(`${API_BASE}/admin/segments/${segment.segmentId}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({
          matchingCount: matching.length,
          matchingTelegramUserIds,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSegments((prev) =>
          prev.map((s) => (s.segmentId === segment.segmentId ? { ...s, ...data.segment } : s))
        );
      }
    } catch (err) {
      console.error("[NodosManager] Refresh segment error:", err);
    } finally {
      setRefreshingSegments((prev) => {
        const next = new Set(prev);
        next.delete(segment.segmentId);
        return next;
      });
    }
  };

  const refreshAllSegments = async () => {
    for (const seg of segments) {
      await refreshSegment(seg);
    }
  };

  // ── Delete segment ────────────────────────────────────────
  const deleteSegment = async (id: string) => {
    if (!confirm("Eliminar este segmento?")) return;
    try {
      await fetch(`${API_BASE}/admin/segments/${id}`, { method: "DELETE", headers: headers() });
      setSegments((prev) => prev.filter((s) => s.segmentId !== id));
    } catch (err) {
      console.error("[NodosManager] Delete segment error:", err);
    }
  };

  // ── Load segment filters ─────────────────────────────────
  const loadSegment = (segment: Segment) => {
    setFilters(segment.filters);
    setFiltersOpen(true);
    setTab("nodos");
  };

  // ── Export filtered ───────────────────────────────────────
  const exportCSV = () => {
    const rows = filteredNodos.map((n) => ({
      nickname: n.nickname,
      phone: n.phone,
      age: n.age,
      gender: n.gender,
      location: n.location,
      phoneBrand: n.phoneBrand,
      spending: n.spending?.join("; "),
      platforms: n.platforms?.join("; "),
      music: n.musicGenre,
      political: POLITICAL_LABELS[n.politicalStance] || n.politicalStance,
      occupation: n.occupation,
      financialStress: STRESS_LABELS[n.financialStress] || n.financialStress,
      toxicBrand: n.toxicBrand,
      aspirational: n.aspirational,
      instagram: n.handles?.instagram || "",
      tiktok: n.handles?.tiktok || "",
      twitter: n.handles?.twitter || "",
      status: n.status || "pending",
      createdAt: n.createdAt,
    }));
    const header = Object.keys(rows[0] || {}).join(",");
    const csv = [header, ...rows.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nodos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Stats ─────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = nodos.length;
    const active = nodos.filter((n) => n.status === "active").length;
    const pending = nodos.filter((n) => !n.status || n.status === "pending").length;
    const blocked = nodos.filter((n) => n.status === "blocked").length;
    return { total, active, pending, blocked };
  }, [nodos]);

  // ── Selection helpers ─────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () => {
    if (selectedIds.size === filteredNodos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNodos.map((n) => n.applicationId)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--p-text-ghost)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--p-text)" }}>
            <Users size={20} /> Nodos
          </h1>
          <p className="text-[12px] mt-1" style={{ color: "var(--p-text-muted)" }}>
            {stats.total} total · {stats.active} activos · {stats.pending} pendientes · {stats.blocked} bloqueados
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="p-2 transition-colors"
          style={{ color: "var(--p-text-muted)" }}
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: "var(--p-bg-card)" }}>
        {(["nodos", "segments"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-md text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: tab === t ? "var(--p-bg-active)" : "transparent",
              color: tab === t ? "var(--p-text)" : "var(--p-text-muted)",
            }}
          >
            {t === "nodos" ? (
              <span className="flex items-center justify-center gap-1.5">
                <Users size={13} /> Nodos ({filteredNodos.length})
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <Layers size={13} /> Segmentos ({segments.length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── NODOS TAB ──────────────────────────────────────── */}
      {tab === "nodos" && (
        <>
          {/* Search + Filter Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
              <input
                type="text"
                value={filters.searchQuery || ""}
                onChange={(e) => setFilters((f) => ({ ...f, searchQuery: e.target.value || undefined }))}
                placeholder="Buscar por nombre, tel, ubicación..."
                className="w-full bg-[#111] border border-[#222] rounded-lg pl-9 pr-4 py-2.5 text-[13px] text-white placeholder:text-[#444] outline-none focus:border-[#444]"
              />
            </div>
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg border text-[13px] font-medium transition-colors ${
                activeFilterCount > 0
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-[#111] border-[#222] text-[#888] hover:border-[#444]"
              }`}
            >
              <Filter size={13} />
              Filtros
              {activeFilterCount > 0 && (
                <span className="bg-white text-black text-[10px] px-1.5 rounded-full font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {!isFilterEmpty(filters) && (
              <button
                onClick={() => setFilters({})}
                className="text-[11px] text-[#666] hover:text-red-400 transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Filter Panel */}
          {filtersOpen && (
            <div className="bg-[#0f0f0f] border border-[#222] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] text-[#888] font-medium">FILTROS ACTIVOS</span>
                <button onClick={() => setFiltersOpen(false)} className="text-[#555] hover:text-white">
                  <ChevronUp size={14} />
                </button>
              </div>

              {/* Row 1: Status + Demographics */}
              <div className="flex flex-wrap gap-2">
                <FilterChipMulti
                  label="Estado"
                  options={["pending", "active", "blocked"]}
                  selected={filters.status || []}
                  onChange={(vals) => setFilters((f) => ({ ...f, status: vals.length ? vals as NodoStatus[] : undefined }))}
                />
                <FilterRange
                  label="Edad"
                  min={15} max={28}
                  valueMin={filters.ageMin} valueMax={filters.ageMax}
                  onChange={(vMin, vMax) => setFilters((f) => ({ ...f, ageMin: vMin, ageMax: vMax }))}
                />
                <FilterChipMulti
                  label="Género"
                  options={GENDER_OPTIONS}
                  selected={filters.gender || []}
                  onChange={(vals) => setFilters((f) => ({ ...f, gender: vals.length ? vals : undefined }))}
                />
                <FilterChipMulti
                  label="Zona"
                  options={LOCATION_ZONES}
                  selected={filters.locationZone || []}
                  onChange={(vals) => setFilters((f) => ({ ...f, locationZone: vals.length ? vals : undefined }))}
                />
                <FilterChipMulti
                  label="Celular"
                  options={PHONE_BRANDS}
                  selected={filters.phoneBrand || []}
                  onChange={(vals) => setFilters((f) => ({ ...f, phoneBrand: vals.length ? vals : undefined }))}
                />
              </div>

              {/* Row 2: Cultural DNA */}
              <div className="flex flex-wrap gap-2">
                <FilterChipMulti
                  label="Gasto"
                  options={SPENDING_OPTIONS}
                  selected={filters.spending || []}
                  onChange={(vals) => setFilters((f) => ({ ...f, spending: vals.length ? vals : undefined }))}
                />
                <FilterChipMulti
                  label="Plataformas"
                  options={PLATFORM_OPTIONS}
                  selected={filters.platforms || []}
                  onChange={(vals) => setFilters((f) => ({ ...f, platforms: vals.length ? vals : undefined }))}
                />
                <FilterChipMulti
                  label="Música"
                  options={MUSIC_OPTIONS}
                  selected={filters.musicGenre || []}
                  onChange={(vals) => setFilters((f) => ({ ...f, musicGenre: vals.length ? vals : undefined }))}
                />
                <FilterChipMulti
                  label="Ocupación"
                  options={OCCUPATION_OPTIONS}
                  selected={filters.occupation || []}
                  onChange={(vals) => setFilters((f) => ({ ...f, occupation: vals.length ? vals : undefined }))}
                />
              </div>

              {/* Row 3: Scales + Handles */}
              <div className="flex flex-wrap gap-2">
                <FilterRange
                  label="Política"
                  min={1} max={5}
                  valueMin={filters.politicalMin} valueMax={filters.politicalMax}
                  onChange={(vMin, vMax) => setFilters((f) => ({ ...f, politicalMin: vMin, politicalMax: vMax }))}
                  formatLabel={(v) => POLITICAL_LABELS[v] || String(v)}
                />
                <FilterRange
                  label="Estrés $"
                  min={1} max={5}
                  valueMin={filters.financialStressMin} valueMax={filters.financialStressMax}
                  onChange={(vMin, vMax) => setFilters((f) => ({ ...f, financialStressMin: vMin, financialStressMax: vMax }))}
                  formatLabel={(v) => STRESS_LABELS[v] || String(v)}
                />
                <FilterToggle label="IG" value={!!filters.hasInstagram} onChange={(v) => setFilters((f) => ({ ...f, hasInstagram: v || undefined }))} />
                <FilterToggle label="TikTok" value={!!filters.hasTiktok} onChange={(v) => setFilters((f) => ({ ...f, hasTiktok: v || undefined }))} />
                <FilterToggle label="X" value={!!filters.hasTwitter} onChange={(v) => setFilters((f) => ({ ...f, hasTwitter: v || undefined }))} />
                <FilterToggle label="Spotify" value={!!filters.hasSpotify} onChange={(v) => setFilters((f) => ({ ...f, hasSpotify: v || undefined }))} />
              </div>

              {/* Save as segment */}
              {!isFilterEmpty(filters) && (
                <div className="flex items-center gap-2 pt-2 border-t border-[#222]">
                  <Tag size={13} className="text-[#666] shrink-0" />
                  <input
                    type="text"
                    value={segmentName}
                    onChange={(e) => setSegmentName(e.target.value)}
                    placeholder="Nombre del segmento..."
                    className="flex-1 bg-[#111] border border-[#222] rounded px-3 py-1.5 text-[12px] text-white placeholder:text-[#444] outline-none"
                  />
                  <button
                    onClick={saveSegment}
                    disabled={!segmentName.trim() || savingSegment}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white text-black rounded text-[12px] font-bold disabled:opacity-40 hover:bg-[#eee] transition-colors"
                  >
                    {savingSegment ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                    Guardar segmento ({filteredNodos.length})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="bg-[#111] border border-[#222] rounded-lg p-3 flex items-center justify-between">
              <span className="text-[12px] text-[#aaa]">
                {selectedIds.size} seleccionados
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkAction("active")}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-400 rounded text-[11px] font-bold hover:bg-green-500/20"
                >
                  <UserCheck size={12} /> Activar
                </button>
                <button
                  onClick={() => handleBulkAction("pending")}
                  className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500/10 text-yellow-400 rounded text-[11px] font-bold hover:bg-yellow-500/20"
                >
                  <Clock size={12} /> Pending
                </button>
                <button
                  onClick={() => handleBulkAction("blocked")}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 rounded text-[11px] font-bold hover:bg-red-500/20"
                >
                  <Ban size={12} /> Bloquear
                </button>
                <button
                  onClick={() => handleBulkAction("delete")}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 rounded text-[11px] font-bold hover:bg-red-500/20"
                >
                  <Trash2 size={12} /> Eliminar
                </button>
              </div>
            </div>
          )}

          {/* Actions row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="text-[11px] text-[#666] hover:text-white transition-colors"
              >
                {selectedIds.size === filteredNodos.length && filteredNodos.length > 0 ? "Deseleccionar" : "Seleccionar"} todo
              </button>
            </div>
            <button
              onClick={exportCSV}
              disabled={filteredNodos.length === 0}
              className="flex items-center gap-1 text-[11px] text-[#666] hover:text-white transition-colors disabled:opacity-40"
            >
              <Download size={11} /> Exportar CSV
            </button>
          </div>

          {/* Nodos Table */}
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[32px_1fr_80px_90px_80px_90px_60px] gap-2 px-4 py-2.5 border-b border-[#1a1a1a] text-[10px] text-[#555] font-medium uppercase tracking-wider">
              <div />
              <div>Nodo</div>
              <div>Edad</div>
              <div>Zona</div>
              <div>Estado</div>
              <div>Fecha</div>
              <div />
            </div>

            {/* Rows */}
            {filteredNodos.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-[#555]">
                {nodos.length === 0 ? "No hay nodos registrados" : "Ningún nodo coincide con los filtros"}
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto">
                {filteredNodos.map((nodo) => {
                  const isSelected = selectedIds.has(nodo.applicationId);
                  const status: NodoStatus = nodo.status || "pending";
                  return (
                    <div
                      key={nodo.applicationId}
                      className={`grid grid-cols-[32px_1fr_80px_90px_80px_90px_60px] gap-2 px-4 py-2.5 border-b border-[#111] items-center hover:bg-[#111] transition-colors ${
                        isSelected ? "bg-white/5" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <button onClick={() => toggleSelect(nodo.applicationId)}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                          isSelected ? "bg-white border-white" : "border-[#444]"
                        }`}>
                          {isSelected && <Check size={10} className="text-black" />}
                        </div>
                      </button>

                      {/* Name + phone */}
                      <button
                        onClick={() => setDetailNodo(nodo)}
                        className="flex flex-col items-start text-left min-w-0"
                      >
                        <span className="text-[13px] text-white font-medium truncate max-w-full">
                          {nodo.nickname}
                        </span>
                        <span className="text-[10px] text-[#555] font-['Fira_Code'] truncate max-w-full">
                          {nodo.phone}
                        </span>
                      </button>

                      {/* Age + Gender */}
                      <div className="text-[12px] text-[#aaa]">
                        {nodo.age}
                        <span className="text-[10px] text-[#555] ml-1">
                          {nodo.gender === "Hombre" ? "M" : nodo.gender === "Mujer" ? "F" : nodo.gender === "No binario" ? "NB" : "—"}
                        </span>
                      </div>

                      {/* Location */}
                      <div className="text-[11px] text-[#888] truncate">
                        {(nodo.location || "—").split(" — ")[0]}
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-1.5">
                        <StatusToggle
                          status={status}
                          loading={statusLoading.has(nodo.applicationId)}
                          onToggle={() => updateStatus(nodo.applicationId, status === "active" ? "pending" : "active")}
                        />
                        <StatusBadge status={status} />
                      </div>

                      {/* Date */}
                      <div className="text-[11px] text-[#555] font-['Fira_Code']">
                        {new Date(nodo.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        {status !== "blocked" ? (
                          <button
                            onClick={() => updateStatus(nodo.applicationId, "blocked")}
                            className="p-1 text-[#555] hover:text-red-400 transition-colors"
                            title="Bloquear"
                          >
                            <Ban size={12} />
                          </button>
                        ) : (
                          <button
                            onClick={() => updateStatus(nodo.applicationId, "pending")}
                            className="p-1 text-red-400 hover:text-yellow-400 transition-colors"
                            title="Desbloquear"
                          >
                            <UserX size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNodo(nodo.applicationId)}
                          className="p-1 text-[#555] hover:text-red-400 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── SEGMENTS TAB ───────────────────────────────────── */}
      {tab === "segments" && (
        <div className="space-y-4">
          {segments.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-[#555]">
                {segments.length} segmento{segments.length !== 1 ? "s" : ""} guardado{segments.length !== 1 ? "s" : ""}
              </p>
              <button
                onClick={refreshAllSegments}
                disabled={refreshingSegments.size > 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[#888] hover:text-white border border-[#222] rounded-lg transition-colors disabled:opacity-40"
              >
                <RefreshCw size={11} className={refreshingSegments.size > 0 ? "animate-spin" : ""} />
                Actualizar todos
              </button>
            </div>
          )}
          {segments.length === 0 ? (
            <div className="py-12 text-center">
              <Layers size={32} className="mx-auto mb-3 text-[#333]" />
              <p className="text-[14px] text-[#666]">No hay segmentos creados</p>
              <p className="text-[12px] text-[#444] mt-1">
                Usá los filtros en la pestaña Nodos y guardá como segmento
              </p>
            </div>
          ) : (
            segments.map((seg) => {
              const filterSummary = describeFilters(seg.filters);
              const isRefreshing = refreshingSegments.has(seg.segmentId);
              // Re-evaluate current match count from nodos in memory
              const currentMatch = applyFilters(nodos, seg.filters).length;
              const isStale = currentMatch !== seg.matchingCount;
              return (
                <div
                  key={seg.segmentId}
                  className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-white font-bold text-[14px] flex items-center gap-2">
                        <Tag size={13} className="text-[#888]" />
                        {seg.name}
                      </h3>
                      <p className="text-[11px] text-[#555] mt-0.5">
                        {seg.matchingCount} nodos cacheados
                        {isStale && (
                          <span className="text-yellow-400 ml-1">
                            (ahora {currentMatch})
                          </span>
                        )}
                        {" · "}
                        actualizado {new Date(seg.updatedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => refreshSegment(seg)}
                        disabled={isRefreshing}
                        className={`p-1.5 transition-colors rounded ${
                          isStale
                            ? "text-yellow-400 hover:text-yellow-300 bg-yellow-400/10"
                            : "text-[#555] hover:text-white"
                        }`}
                        title="Refrescar datos del segmento"
                      >
                        <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
                      </button>
                      <button
                        onClick={() => loadSegment(seg)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-white/10 text-white rounded text-[11px] font-medium hover:bg-white/20 transition-colors"
                      >
                        <Filter size={10} /> Aplicar
                      </button>
                      <button
                        onClick={() => deleteSegment(seg.segmentId)}
                        className="p-1.5 text-[#555] hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  {/* Filter description */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {filterSummary.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-full bg-[#1a1a1a] text-[10px] text-[#888]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Detail Modal */}
      {detailNodo && <NodoDetail nodo={detailNodo} onClose={() => setDetailNodo(null)} />}
    </div>
  );
}

// ── Describe filters as tags ────────────────────────────────

function describeFilters(f: FilterState): string[] {
  const tags: string[] = [];
  if (f.status?.length) tags.push(`Estado: ${f.status.join(", ")}`);
  if (f.ageMin !== undefined || f.ageMax !== undefined) {
    tags.push(`Edad: ${f.ageMin ?? 15}–${f.ageMax ?? 28}`);
  }
  if (f.gender?.length) tags.push(`Género: ${f.gender.join(", ")}`);
  if (f.locationZone?.length) tags.push(`Zona: ${f.locationZone.join(", ")}`);
  if (f.phoneBrand?.length) tags.push(`Cel: ${f.phoneBrand.length} tipos`);
  if (f.spending?.length) tags.push(`Gasto: ${f.spending.join(", ")}`);
  if (f.platforms?.length) tags.push(`Plat: ${f.platforms.join(", ")}`);
  if (f.musicGenre?.length) tags.push(`Música: ${f.musicGenre.join(", ")}`);
  if (f.politicalMin !== undefined || f.politicalMax !== undefined) {
    tags.push(`Política: ${f.politicalMin ?? 1}–${f.politicalMax ?? 5}`);
  }
  if (f.occupation?.length) tags.push(`Ocup: ${f.occupation.join(", ")}`);
  if (f.financialStressMin !== undefined || f.financialStressMax !== undefined) {
    tags.push(`Estrés $: ${f.financialStressMin ?? 1}–${f.financialStressMax ?? 5}`);
  }
  if (f.hasInstagram) tags.push("Tiene IG");
  if (f.hasTiktok) tags.push("Tiene TikTok");
  if (f.hasTwitter) tags.push("Tiene X");
  if (f.hasSpotify) tags.push("Tiene Spotify");
  return tags;
}
