// ============================================================
// BOT MANAGER — Telegram Bot question push & notification panel
// Migrated to CSS variables var(--p-*) for light/dark theming
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Plus,
  Send,
  Trash2,
  Users,
  BarChart3,
  Settings,
  Loader2,
  RefreshCw,
  ChevronLeft,
  Bell,
  MessageSquare,
  Wifi,
  WifiOff,
  Eye,
  Image,
  AlertTriangle,
  Check,
  Copy,
} from "lucide-react";

const API_BASE = "";
const CRON_POLL_URL = `${API_BASE}/bot/poll`;
const CRON_AUTH_HEADER = sessionStorage.getItem("brutal_panel_token") || "";
const headers = () => ({
  "Content-Type": "application/json",
  "X-Panel-Token": sessionStorage.getItem("brutal_panel_token") || "",
});

// ── Types ────────────────────────────────────────────────────

interface BotQuestion {
  id: string;
  text: string;
  options: string[];
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  sentCount: number;
  lastSentAt: string | null;
  rewardTickets?: number;
  segmentIds?: string[];
}

interface BotResponse {
  questionId: string;
  userId: number;
  firstName: string;
  username: string;
  optionIndex: number;
  optionText: string;
  answeredAt: string;
}

interface BotSubscriber {
  userId: number;
  firstName: string;
  lastName: string;
  username: string;
  chatId: number;
  firstSeen: string;
  lastSeen: string;
  active: boolean;
}

// ── API helpers ──────────────────────────────────────────────

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { ...headers(), ...(opts?.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Helper: fetch telegramUserIds for a segment array
async function getTelegramUsersForSegments(segmentIds: string[]): Promise<number[]> {
  try {
    const allUsers = new Set<number>();
    for (const segId of segmentIds) {
      const data = await apiFetch<{ telegramUserIds: string[] }>(`/admin/segments/${segId}/telegram-users`);
      data.telegramUserIds?.forEach(id => allUsers.add(Number(id)));
    }
    return Array.from(allUsers);
  } catch (err) {
    console.error("[BOT] Error fetching segment users:", err);
    return [];
  }
}

// ── Subcomponents ────────────────────────────────────────────

type BotTab = "questions" | "subscribers" | "notify" | "config";

// ── Segment Picker para Notificaciones (Unico) ───────────────

interface SegmentOption {
  segmentId: string;
  name: string;
  matchingCount: number;
}

function SingleSegmentPicker({
  selected,
  onChange,
}: {
  selected: string | null;
  onChange: (segmentId: string | null) => void;
}) {
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ segments: SegmentOption[] }>("/admin/segments")
      .then((data) => setSegments(data.segments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-[10px]" style={{ color: "var(--p-text-ghost)" }}>Cargando segmentos...</p>;
  if (segments.length === 0) return null;

  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider mb-1.5 flex items-center gap-1 block" style={{ color: "var(--p-text-faint)" }}>
        <Users size={11} /> Segmento (opcional)
      </label>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onChange(null)}
          className="px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors"
          style={{
            backgroundColor: !selected ? "color-mix(in srgb, var(--p-text) 10%, transparent)" : "var(--p-bg-input)",
            borderColor: !selected ? "color-mix(in srgb, var(--p-text) 20%, transparent)" : "var(--p-border-subtle)",
            color: !selected ? "var(--p-text)" : "var(--p-text-muted)",
          }}
        >
          Todos
        </button>
        {segments.map((seg) => (
          <button
            key={seg.segmentId}
            onClick={() => onChange(selected === seg.segmentId ? null : seg.segmentId)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
              selected === seg.segmentId ? "bg-purple-500/15 border-purple-500/30 text-purple-300" : ""
            }`}
            style={selected !== seg.segmentId ? { backgroundColor: "var(--p-bg-input)", borderColor: "var(--p-border-subtle)", color: "var(--p-text-muted)" } : undefined}
          >
            {seg.name}
            <span className="ml-1 text-[9px] opacity-60">({seg.matchingCount})</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Multi Segment Picker (Para Preguntas) ────────────────────

function BotSegmentSelector({ selectedIds = [], onChange }: { selectedIds: string[], onChange: (ids: string[]) => void }) {
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  
  useEffect(() => {
    apiFetch<{ segments: SegmentOption[] }>("/admin/segments")
      .then((data) => setSegments(data.segments || []))
      .catch(() => {});
  }, []);

  // FIX: Array seguro e inmutable para evitar bugs de selección cruzada
  const safeSelected = Array.isArray(selectedIds) ? selectedIds : [];

  const toggleSegment = (id: string) => {
    if (safeSelected.includes(id)) {
      onChange(safeSelected.filter((s) => s !== id));
    } else {
      onChange([...safeSelected, id]);
    }
  };

  if (segments.length === 0) return null;

  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1 block" style={{ color: "var(--p-text-faint)" }}>
        <Users size={11} /> Restringir a segmentos
      </label>
      <div className="flex flex-wrap gap-1.5">
        {segments.map((seg) => {
          const isSelected = safeSelected.includes(seg.segmentId);
          return (
            <button
              key={seg.segmentId}
              type="button" // Previene que el formulario se envíe por error
              onClick={(e) => { e.preventDefault(); toggleSegment(seg.segmentId); }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                isSelected ? "bg-purple-500/15 border-purple-500/30 text-purple-300" : ""
              }`}
              style={!isSelected ? { backgroundColor: "var(--p-bg-hover)", borderColor: "var(--p-border-subtle)", color: "var(--p-text-muted)" } : undefined}
            >
              {seg.name}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] mt-1" style={{ color: "var(--p-text-ghost)" }}>
        Sin segmentos = se enviará a todos los usuarios activos.
      </p>
    </div>
  );
}

// (Dentro de QuestionForm, asegurate de que el estado inicial también sea inmutable)
// Busca la línea donde defines segmentIds y cambiala por esto:
// const [segmentIds, setSegmentIds] = useState<string[]>(Array.isArray(initial?.segmentIds) ? [...initial.segmentIds] : []);

function TabBar({ active, onChange }: { active: BotTab; onChange: (t: BotTab) => void }) {
  const tabs: { id: BotTab; label: string; icon: typeof Bot }[] = [
    { id: "questions", label: "Preguntas", icon: MessageSquare },
    { id: "notify", label: "Notificar", icon: Bell },
    { id: "subscribers", label: "Suscriptores", icon: Users },
    { id: "config", label: "Config", icon: Settings },
  ];
  return (
    <div className="flex gap-1 rounded-xl p-1 mb-6" style={{ backgroundColor: "var(--p-bg-input)" }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: active === t.id ? "var(--p-bg-hover)" : "transparent",
            color: active === t.id ? "var(--p-text)" : "var(--p-text-faint)",
          }}
        >
          <t.icon size={13} />
          <span className="hidden sm:inline">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Question Form ────────────────────────────────────────────

function QuestionForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: BotQuestion | null;
  onSave: (q: { text: string; options: string[]; imageUrl: string | null; rewardTickets: number; segmentIds: string[] }) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial?.text || "");
  const [options, setOptions] = useState<string[]>(initial?.options?.length ? initial.options : ["", ""]);
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || "");
  const [rewardTickets, setRewardTickets] = useState(initial?.rewardTickets ?? 1);
  const [segmentIds, setSegmentIds] = useState<string[]>(initial?.segmentIds || []);
  const [saving, setSaving] = useState(false);

  const updateOption = (i: number, v: string) => {
    const next = [...options];
    next[i] = v;
    setOptions(next);
  };

  const addOption = () => {
    if (options.length < 8) setOptions([...options, ""]);
  };

  const removeOption = (i: number) => {
    if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    if (!text.trim() || options.some((o) => !o.trim())) return;
    setSaving(true);
    try {
      await onSave({
        text: text.trim(),
        options: options.map((o) => o.trim()),
        imageUrl: imageUrl.trim() || null,
        rewardTickets,
        segmentIds
      });
    } finally {
      setSaving(false);
    }
  };

  const valid = text.trim() && options.every((o) => o.trim()) && options.length >= 2;
  const formInput: React.CSSProperties = {
    backgroundColor: "var(--p-bg-hover)",
    border: "1px solid var(--p-border-subtle)",
    color: "var(--p-text)",
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onCancel}
        className="flex items-center gap-1.5 text-xs transition-colors mb-2"
        style={{ color: "var(--p-text-faint)" }}
      >
        <ChevronLeft size={14} /> Volver a la lista
      </button>

      <h3 className="text-sm font-semibold" style={{ color: "var(--p-text)" }}>
        {initial ? "Editar pregunta" : "Nueva pregunta bot"}
      </h3>

      <div>
        <label className="text-[11px] uppercase tracking-wider mb-1 block" style={{ color: "var(--p-text-faint)" }}>Texto de la pregunta</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-lg px-3 py-2.5 text-sm resize-none min-h-[80px]"
          style={formInput}
          placeholder="Ej: Si pudieras ser invisible por un dia, que harias?"
        />
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: "var(--p-text-faint)" }}>
          <Image size={11} /> Imagen (opcional)
        </label>
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full rounded-lg px-3 py-2 text-xs font-['Fira_Code']" style={formInput} placeholder="https://..." />
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider mb-2 block" style={{ color: "var(--p-text-faint)" }}>Opciones (botones inline)</label>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-[10px] w-4 text-right font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>{i + 1}</span>
              <input value={opt} onChange={(e) => updateOption(i, e.target.value)} className="flex-1 rounded-lg px-3 py-2 text-sm" style={formInput} placeholder={`Opcion ${i + 1}`} />
              {options.length > 2 && (
                <button onClick={() => removeOption(i)} className="p-1.5 transition-colors" style={{ color: "var(--p-text-ghost)" }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < 8 && (
          <button onClick={addOption} className="mt-2 flex items-center gap-1 text-xs transition-colors" style={{ color: "var(--p-text-faint)" }}>
            <Plus size={12} /> Agregar opcion
          </button>
        )}
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider mb-1 block" style={{ color: "var(--p-text-faint)" }}>Reward por respuesta (tickets)</label>
        <div className="flex items-center gap-3">
          <input type="number" min={0} max={100} step={1} value={rewardTickets} onChange={(e) => setRewardTickets(Math.max(0, parseInt(e.target.value) || 0))} className="w-24 rounded-lg px-3 py-2 text-sm font-['Fira_Code'] text-center" style={formInput} />
          <span className="text-[11px]" style={{ color: "var(--p-text-ghost)" }}>
            {rewardTickets === 0 ? "Sin reward" : `${rewardTickets} tickets`}
          </span>
        </div>
      </div>

      <BotSegmentSelector selectedIds={segmentIds} onChange={setSegmentIds} />

      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="px-4 py-2 text-xs rounded-lg transition-colors" style={{ color: "var(--p-text-faint)", border: "1px solid var(--p-border-subtle)" }}>Cancelar</button>
        <button onClick={handleSubmit} disabled={!valid || saving} className="flex-1 py-2 text-sm font-bold rounded-lg transition-colors disabled:opacity-40 flex items-center justify-center gap-2" style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} /> Guardar Pregunta</>}
        </button>
      </div>
    </div>
  );
}

// ── Response Detail ──────────────────────────────────────────

function ResponseDetail({ question, onBack }: { question: BotQuestion; onBack: () => void; }) {
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<BotResponse[]>([]);
  const [optionCounts, setOptionCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);

  useEffect(() => {
    apiFetch<{ total: number; optionCounts: Record<string, number>; responses: BotResponse[] }>(`/bot-responses/${question.id}`)
      .then((data) => {
        setTotal(data.total);
        setOptionCounts(data.optionCounts);
        setResponses(data.responses);
      })
      .catch((err) => console.error("[BOT] Error loading responses:", err))
      .finally(() => setLoading(false));
  }, [question.id]);

  const maxCount = Math.max(...Object.values(optionCounts), 1);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: "var(--p-text-faint)" }}><ChevronLeft size={14} /> Volver</button>
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}>
        <p className="text-sm mb-1" style={{ color: "var(--p-text)" }}>{question.text}</p>
        <p className="text-[10px] font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>Enviada {question.sentCount}x | {total} respuestas</p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: "var(--p-text-ghost)" }} /></div>
      ) : total === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--p-text-ghost)" }}>Sin respuestas todavia</p>
      ) : (
        <>
          <div className="space-y-2">
            {question.options.map((opt) => {
              const count = optionCounts[opt] || 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={opt} className="flex items-center gap-3">
                  <span className="text-xs w-20 truncate" style={{ color: "var(--p-text-muted)" }}>{opt}</span>
                  <div className="flex-1 h-6 rounded-md overflow-hidden relative" style={{ backgroundColor: "var(--p-bg-hover)" }}>
                    <div className="h-full rounded-md transition-all" style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: "color-mix(in srgb, var(--p-text) 15%, transparent)" }} />
                    <span className="absolute inset-0 flex items-center px-2 text-[10px] font-['Fira_Code']" style={{ color: "var(--p-text)" }}>{count} ({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--p-text-ghost)" }}>Ultimas respuestas</p>
            {responses.slice(0, 50).map((r, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg text-xs" style={{ backgroundColor: "var(--p-bg-card)" }}>
                <span style={{ color: "var(--p-text-muted)" }}>{r.firstName || r.username || `user:${r.userId}`}</span>
                <span className="font-medium" style={{ color: "var(--p-text)" }}>{r.optionText}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Questions Tab ────────────────────────────────────────────

function QuestionsTab() {
  const [questions, setQuestions] = useState<BotQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<
    | { mode: "list" }
    | { mode: "create" }
    | { mode: "edit"; question: BotQuestion }
    | { mode: "responses"; question: BotQuestion }
  >({ mode: "list" });
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadQuestions = useCallback(async () => {
    try {
      const data = await apiFetch<{ questions: BotQuestion[] }>("/bot/questions");
      setQuestions(data.questions);
    } catch (err) {
      console.error("[BOT] Error loading questions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreate = async (q: { text: string; options: string[]; imageUrl: string | null; rewardTickets: number; segmentIds: string[] }) => {
    try {
      await apiFetch("/bot/questions", { method: "POST", body: JSON.stringify(q) });
      showToast("Pregunta creada exitosamente");
      setView({ mode: "list" });
      loadQuestions();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleUpdate = async (id: string, q: { text: string; options: string[]; imageUrl: string | null; rewardTickets: number; segmentIds: string[] }) => {
    try {
      await apiFetch(`/bot/questions/${id}`, { method: "PUT", body: JSON.stringify(q) });
      showToast("Pregunta actualizada");
      setView({ mode: "list" });
      loadQuestions();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar esta pregunta bot?")) return;
    await apiFetch(`/bot/questions/${id}`, { method: "DELETE" });
    showToast("Pregunta eliminada");
    loadQuestions();
  };

  const handleSend = async (question: BotQuestion) => {
    setSendingId(question.id);
    try {
      const body: Record<string, any> = {};
      if (question.segmentIds && question.segmentIds.length > 0) {
        const telegramUserIds = await getTelegramUsersForSegments(question.segmentIds);
        if (telegramUserIds.length === 0) {
          showToast("Error: Los segmentos asignados no tienen usuarios de Telegram");
          setSendingId(null);
          return;
        }
        body.targetTelegramUserIds = telegramUserIds;
      }
      
      const result = await apiFetch<{ sent: number; failed: number; total: number }>(
        `/bot/send-question/${question.id}`,
        { method: "POST", body: JSON.stringify(body) }
      );
      showToast(`Enviada a ${result.sent}/${result.total} suscriptores`);
      loadQuestions();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setSendingId(null);
    }
  };

  if (view.mode === "create") return <QuestionForm onSave={handleCreate} onCancel={() => setView({ mode: "list" })} />;
  if (view.mode === "edit") return <QuestionForm initial={view.question} onSave={(q) => handleUpdate(view.question.id, q)} onCancel={() => setView({ mode: "list" })} />;
  if (view.mode === "responses") return <ResponseDetail question={view.question} onBack={() => setView({ mode: "list" })} />;

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 text-xs px-4 py-2.5 rounded-xl shadow-xl" style={{ backgroundColor: "var(--p-bg-hover)", border: "1px solid var(--p-border)", color: "var(--p-text)" }}>
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--p-text)" }}>Preguntas Bot</h3>
          <p className="text-[11px]" style={{ color: "var(--p-text-ghost)" }}>Preguntas individuales enviadas via inline keyboard</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setLoading(true); loadQuestions(); }} className="p-2 rounded-lg transition-colors" style={{ color: "var(--p-text-faint)", border: "1px solid var(--p-border-subtle)" }}>
            <RefreshCw size={13} />
          </button>
          <button onClick={() => setView({ mode: "create" })} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors" style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}>
            <Plus size={13} /> Nueva
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin" style={{ color: "var(--p-text-ghost)" }} /></div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12">
          <Bot size={32} className="mx-auto mb-3" style={{ color: "var(--p-text-ghost)" }} />
          <p className="text-sm" style={{ color: "var(--p-text-ghost)" }}>No hay preguntas bot todavia</p>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <div key={q.id} className="rounded-xl p-3 transition-colors" style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}>
              <p className="text-sm mb-2 line-clamp-2" style={{ color: "var(--p-text)" }}>{q.text}</p>
              
              <div className="flex flex-wrap gap-1 mb-2">
                {q.options.map((opt, i) => (
                  <span key={i} className="px-2 py-0.5 bg-[#1a2a3a] text-[#6aa8e8] text-[10px] rounded-md">{opt}</span>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-[10px] font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>
                  <span>{new Date(q.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}</span>
                  {q.segmentIds && q.segmentIds.length > 0 && <span className="text-purple-400">Seg: {q.segmentIds.length}</span>}
                  {q.sentCount > 0 && <span>Enviada {q.sentCount}x</span>}
                  <span style={{ color: "var(--p-text-muted)" }}>🎟️ {q.rewardTickets ?? 1}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button onClick={() => setView({ mode: "responses", question: q })} className="p-1.5 transition-colors" style={{ color: "var(--p-text-ghost)" }} title="Ver respuestas"><BarChart3 size={13} /></button>
                  <button onClick={() => setView({ mode: "edit", question: q })} className="p-1.5 transition-colors" style={{ color: "var(--p-text-ghost)" }} title="Editar"><Eye size={13} /></button>
                  <button onClick={() => handleDelete(q.id)} className="p-1.5 transition-colors" style={{ color: "var(--p-text-ghost)" }} title="Eliminar"><Trash2 size={13} /></button>
                  <button onClick={() => handleSend(q)} disabled={sendingId === q.id} className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${q.segmentIds && q.segmentIds.length > 0 ? "bg-purple-500/20 text-purple-300" : "bg-white/10 text-white"}`}>
                    {sendingId === q.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                    {q.segmentIds && q.segmentIds.length > 0 ? "A Segmentos" : "A Todos"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Notify Tab ───────────────────────────────────────────────

function NotifyTab() {
  const [type, setType] = useState<"drop" | "custom">("drop");
  const [text, setText] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  const formInput: React.CSSProperties = {
    backgroundColor: "var(--p-bg-hover)",
    border: "1px solid var(--p-border-subtle)",
    color: "var(--p-text)",
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const body: Record<string, any> = { text: text.trim(), type };
      if (imageUrl.trim()) body.imageUrl = imageUrl.trim();
      if (type === "drop") body.buttonText = buttonText.trim() || "Abrir BRUTAL";
      else if (buttonText.trim() && buttonUrl.trim()) { body.buttonText = buttonText.trim(); body.buttonUrl = buttonUrl.trim(); }

      if (selectedSegment) {
        const telegramUserIds = await getTelegramUsersForSegments([selectedSegment]);
        if (telegramUserIds.length === 0) { setResult("Error: El segmento no tiene telegram users"); setSending(false); return; }
        body.targetTelegramUserIds = telegramUserIds;
      }

      const data = await apiFetch<{ sent: number; failed: number; total: number }>("/bot/send-notification", { method: "POST", body: JSON.stringify(body) });
      setResult(`Enviada a ${data.sent}/${data.total} suscriptores${selectedSegment ? " (segmento)" : ""}`);
      setText(""); setImageUrl("");
    } catch (err: any) { setResult(`Error: ${err.message}`); } finally { setSending(false); }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: "var(--p-text)" }}>Enviar notificacion</h3>
      <p className="text-[11px]" style={{ color: "var(--p-text-ghost)" }}>Push a todos los suscriptores del bot o a un segmento especifico</p>

      <SingleSegmentPicker selected={selectedSegment} onChange={setSelectedSegment} />

      <div className="flex gap-2">
        {(["drop", "custom"] as const).map((t) => (
          <button key={t} onClick={() => setType(t)} className="flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-all" style={{ backgroundColor: type === t ? "var(--p-bg-hover)" : "transparent", borderColor: type === t ? "var(--p-border)" : "var(--p-border-subtle)", color: type === t ? "var(--p-text)" : "var(--p-text-faint)" }}>
            {t === "drop" ? "Nuevo Drop" : "Custom"}
          </button>
        ))}
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider mb-1 block" style={{ color: "var(--p-text-faint)" }}>Mensaje</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-xs font-['Fira_Code'] resize-none min-h-[100px]" style={formInput} placeholder={type === "drop" ? "Ej: Nuevo drop disponible!" : "Ej: Importante..."} />
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: "var(--p-text-faint)" }}><Image size={11} /> Imagen o GIF (opcional)</label>
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full rounded-lg px-3 py-2 text-xs font-['Fira_Code']" style={formInput} placeholder="https://..." />
      </div>

      {type === "drop" && (
        <div><label className="text-[11px] uppercase tracking-wider mb-1 block" style={{ color: "var(--p-text-faint)" }}>Texto del boton</label><input value={buttonText} onChange={(e) => setButtonText(e.target.value)} className="w-full rounded-lg px-3 py-2 text-xs" style={formInput} placeholder="Abrir BRUTAL" /></div>
      )}

      {type === "custom" && (
        <div className="space-y-3">
          <div><label className="text-[11px] uppercase tracking-wider mb-1 block" style={{ color: "var(--p-text-faint)" }}>Texto del boton</label><input value={buttonText} onChange={(e) => setButtonText(e.target.value)} className="w-full rounded-lg px-3 py-2 text-xs" style={formInput} /></div>
          <div><label className="text-[11px] uppercase tracking-wider mb-1 block" style={{ color: "var(--p-text-faint)" }}>URL del boton</label><input value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} className="w-full rounded-lg px-3 py-2 text-xs font-['Fira_Code']" style={formInput} placeholder="https://..." /></div>
        </div>
      )}

      <button onClick={handleSend} disabled={!text.trim() || sending} className={`w-full py-3 text-sm font-bold rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2 ${selectedSegment ? "bg-purple-500 text-white hover:bg-purple-400" : ""}`} style={!selectedSegment ? { backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" } : undefined}>
        {sending ? <Loader2 size={14} className="animate-spin" /> : <><Send size={14} />{selectedSegment ? "Enviar al segmento" : "Enviar a todos"}</>}
      </button>

      {result && <p className="text-xs text-center" style={{ color: result.startsWith("Error") ? "var(--p-danger)" : "var(--p-success)" }}>{result}</p>}
    </div>
  );
}

// ── Subscribers Tab ──────────────────────────────────────────

function SubscribersTab() {
  const [subs, setSubs] = useState<BotSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ total: number; active: number; subscribers: BotSubscriber[] }>("/bot/subscribers");
      setSubs(data.subscribers);
      setTotal(data.total);
      setActive(data.active);
    } catch (err) { console.error("[BOT] Error loading subscribers:", err); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--p-text)" }}>Suscriptores</h3>
          <p className="text-[11px]" style={{ color: "var(--p-text-ghost)" }}>Usuarios que hicieron /start en @BrutalDropBot</p>
        </div>
        <button onClick={() => { setLoading(true); load(); }} className="p-2 rounded-lg transition-colors" style={{ color: "var(--p-text-faint)", border: "1px solid var(--p-border-subtle)" }}><RefreshCw size={13} /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}><p className="text-2xl font-bold font-['Fira_Code']" style={{ color: "var(--p-text)" }}>{total}</p><p className="text-[10px] uppercase" style={{ color: "var(--p-text-ghost)" }}>Total</p></div>
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}><p className="text-2xl font-bold font-['Fira_Code']" style={{ color: "var(--p-success)" }}>{active}</p><p className="text-[10px] uppercase" style={{ color: "var(--p-text-ghost)" }}>Activos</p></div>
      </div>

      {loading ? <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: "var(--p-text-ghost)" }} /></div> : subs.length === 0 ? <p className="text-sm text-center py-8" style={{ color: "var(--p-text-ghost)" }}>Sin suscriptores</p> : (
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {subs.map((s) => (
            <div key={s.userId} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ backgroundColor: "var(--p-bg-card)" }}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${s.active ? "bg-green-500" : ""}`} style={!s.active ? { backgroundColor: "var(--p-border)" } : undefined} />
                <div><p className="text-xs" style={{ color: "var(--p-text)" }}>{s.firstName} {s.lastName}</p>{s.username && <p className="text-[10px] font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>@{s.username}</p>}</div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>{new Date(s.lastSeen).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}</p>
                <p className="text-[9px]" style={{ color: "var(--p-text-ghost)" }}>ID: {s.userId}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Config Tab ───────────────────────────────────────────────

function ConfigTab() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: "var(--p-text)" }}>Configuracion del Bot</h3>
      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi size={14} style={{ color: "var(--p-success)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--p-text)" }}>Modo: Webhook Hono (Activo)</span>
          </div>
        </div>
        <p className="text-[11px]" style={{ color: "var(--p-text-ghost)" }}>El bot está conectado directamente a Railway y responde de forma inmediata a los mensajes.</p>
      </div>
    </div>
  );
}

// ── Main BotManager ──────────────────────────────────────────

export function BotManager() {
  const [tab, setTab] = useState<BotTab>("questions");
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1"><Bot size={18} style={{ color: "var(--p-text)" }} /><h2 className="text-lg font-bold" style={{ color: "var(--p-text)" }}>Bot</h2></div>
        <p className="text-xs" style={{ color: "var(--p-text-ghost)" }}>Preguntas push, notificaciones y suscriptores de @BrutalDropBot</p>
      </div>
      <TabBar active={tab} onChange={setTab} />
      {tab === "questions" && <QuestionsTab />}
      {tab === "notify" && <NotifyTab />}
      {tab === "subscribers" && <SubscribersTab />}
      {tab === "config" && <ConfigTab />}
    </div>
  );
}
