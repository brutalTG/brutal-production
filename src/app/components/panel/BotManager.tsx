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
// Auth: panel token from sessionStorage (set during login)

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

// ── Subcomponents ────────────────────────────────────────────

type BotTab = "questions" | "subscribers" | "notify" | "config";

// ── Segment Picker ───────────────────────────────────────────

interface SegmentOption {
  segmentId: string;
  name: string;
  matchingCount: number;
}

function SegmentPicker({
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
              selected === seg.segmentId
                ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
                : ""
            }`}
            style={selected !== seg.segmentId ? { backgroundColor: "var(--p-bg-input)", borderColor: "var(--p-border-subtle)", color: "var(--p-text-muted)" } : undefined}
          >
            {seg.name}
            <span className="ml-1 text-[9px] opacity-60">({seg.matchingCount})</span>
          </button>
        ))}
      </div>
      {selected && (
        <p className="text-[10px] text-purple-400 mt-1">
          Solo se enviara a suscriptores que esten en este segmento
        </p>
      )}
    </div>
  );
}

// Helper: fetch telegramUserIds for a segment
async function getSegmentTelegramUserIds(segmentId: string): Promise<string[]> {
  try {
    const data = await apiFetch<{ telegramUserIds: string[] }>(`/admin/segments/${segmentId}/telegram-users`);
    return data.telegramUserIds || [];
  } catch (err) {
    console.error("[BOT] Error fetching segment users:", err);
    return [];
  }
}

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
  onSave: (q: { text: string; options: string[]; imageUrl: string | null; rewardTickets: number }) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial?.text || "");
  const [options, setOptions] = useState<string[]>(initial?.options || ["", ""]);
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || "");
  const [rewardTickets, setRewardTickets] = useState(initial?.rewardTickets ?? 1);
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
        <ChevronLeft size={14} />
        Volver a la lista
      </button>

      <h3 className="text-sm font-semibold" style={{ color: "var(--p-text)" }}>
        {initial ? "Editar pregunta" : "Nueva pregunta bot"}
      </h3>

      {/* Text */}
      <div>
        <label className="text-[11px] uppercase tracking-wider mb-1 block" style={{ color: "var(--p-text-faint)" }}>
          Texto de la pregunta
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-lg px-3 py-2.5 text-sm resize-none min-h-[80px]"
          style={formInput}
          placeholder="Ej: Si pudieras ser invisible por un dia, que harias?"
        />
      </div>

      {/* Image URL (optional) */}
      <div>
        <label className="text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: "var(--p-text-faint)" }}>
          <Image size={11} /> Imagen (opcional)
        </label>
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-xs font-['Fira_Code']"
          style={formInput}
          placeholder="https://..."
        />
      </div>

      {/* Options */}
      <div>
        <label className="text-[11px] uppercase tracking-wider mb-2 block" style={{ color: "var(--p-text-faint)" }}>
          Opciones (botones inline)
        </label>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-[10px] w-4 text-right font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>
                {i + 1}
              </span>
              <input
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                className="flex-1 rounded-lg px-3 py-2 text-sm"
                style={formInput}
                placeholder={`Opcion ${i + 1}`}
              />
              {options.length > 2 && (
                <button
                  onClick={() => removeOption(i)}
                  className="p-1.5 transition-colors"
                  style={{ color: "var(--p-text-ghost)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-danger)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < 8 && (
          <button
            onClick={addOption}
            className="mt-2 flex items-center gap-1 text-xs transition-colors"
            style={{ color: "var(--p-text-faint)" }}
          >
            <Plus size={12} /> Agregar opcion
          </button>
        )}
      </div>

      {/* Reward config */}
      <div>
        <label className="text-[11px] uppercase tracking-wider mb-1 block" style={{ color: "var(--p-text-faint)" }}>
          Reward por respuesta (tickets)
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={rewardTickets}
            onChange={(e) => setRewardTickets(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-24 rounded-lg px-3 py-2 text-sm font-['Fira_Code'] text-center"
            style={formInput}
          />
          <span className="text-[11px]" style={{ color: "var(--p-text-ghost)" }}>
            {rewardTickets === 0 ? "Sin reward" : rewardTickets === 1 ? "1 ticket por respuesta" : `${rewardTickets} tickets por respuesta`}
          </span>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--p-bg-card)", border: "1px solid var(--p-border-subtle)" }}>
        <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--p-text-ghost)" }}>
          Preview (Telegram)
        </p>
        <div className="rounded-lg p-3 max-w-[280px]" style={{ backgroundColor: "var(--p-bg-hover)" }}>
          {imageUrl && (
            <div className="w-full h-24 rounded mb-2 flex items-center justify-center" style={{ backgroundColor: "var(--p-bg-active)", color: "var(--p-text-ghost)" }}>
              <Image size={20} />
            </div>
          )}
          <p className="text-sm mb-3" style={{ color: "var(--p-text)" }}>{text || "Texto de la pregunta..."}</p>
          <div className="space-y-1.5">
            {options.map((opt, i) => (
              <div
                key={i}
                className="w-full py-1.5 px-3 bg-[#2a4a6a] text-[#7ab8ff] text-xs text-center rounded-md"
              >
                {opt || `Opcion ${i + 1}`}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs rounded-lg transition-colors"
          style={{ color: "var(--p-text-faint)", border: "1px solid var(--p-border-subtle)" }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!valid || saving}
          className="flex-1 py-2 text-sm font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <>
              <Check size={14} />
              {initial ? "Guardar cambios" : "Crear pregunta"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Response Detail ──────────────────────────────────────────

function ResponseDetail({
  question,
  onBack,
}: {
  question: BotQuestion;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<BotResponse[]>([]);
  const [optionCounts, setOptionCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);

  useEffect(() => {
    apiFetch<{ total: number; optionCounts: Record<string, number>; responses: BotResponse[] }>(
      `/bot-responses/${question.id}`
    )
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
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs transition-colors"
        style={{ color: "var(--p-text-faint)" }}
      >
        <ChevronLeft size={14} />
        Volver
      </button>

      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}>
        <p className="text-sm mb-1" style={{ color: "var(--p-text)" }}>{question.text}</p>
        <p className="text-[10px] font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>
          Enviada {question.sentCount}x | {total} respuestas
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--p-text-ghost)" }} />
        </div>
      ) : total === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--p-text-ghost)" }}>
          Sin respuestas todavia
        </p>
      ) : (
        <>
          {/* Bar chart */}
          <div className="space-y-2">
            {question.options.map((opt) => {
              const count = optionCounts[opt] || 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={opt} className="flex items-center gap-3">
                  <span className="text-xs w-20 truncate" style={{ color: "var(--p-text-muted)" }}>{opt}</span>
                  <div className="flex-1 h-6 rounded-md overflow-hidden relative" style={{ backgroundColor: "var(--p-bg-hover)" }}>
                    <div
                      className="h-full rounded-md transition-all"
                      style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: "color-mix(in srgb, var(--p-text) 15%, transparent)" }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-[10px] font-['Fira_Code']" style={{ color: "var(--p-text)" }}>
                      {count} ({pct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Response list */}
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--p-text-ghost)" }}>
              Ultimas respuestas
            </p>
            {responses.slice(0, 50).map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg text-xs"
                style={{ backgroundColor: "var(--p-bg-card)" }}
              >
                <span style={{ color: "var(--p-text-muted)" }}>
                  {r.firstName || r.username || `user:${r.userId}`}
                </span>
                <span className="font-medium" style={{ color: "var(--p-text)" }}>{r.optionText}</span>
                <span className="font-['Fira_Code'] text-[10px]" style={{ color: "var(--p-text-ghost)" }}>
                  {new Date(r.answeredAt).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
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
  const [questionSegment, setQuestionSegment] = useState<string | null>(null);

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

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreate = async (q: { text: string; options: string[]; imageUrl: string | null; rewardTickets: number }) => {
    await apiFetch("/bot/questions", {
      method: "POST",
      body: JSON.stringify(q),
    });
    showToast("Pregunta creada");
    setView({ mode: "list" });
    loadQuestions();
  };

  const handleUpdate = async (
    id: string,
    q: { text: string; options: string[]; imageUrl: string | null; rewardTickets: number }
  ) => {
    await apiFetch(`/bot/questions/${id}`, {
      method: "PUT",
      body: JSON.stringify(q),
    });
    showToast("Pregunta actualizada");
    setView({ mode: "list" });
    loadQuestions();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar esta pregunta bot?")) return;
    await apiFetch(`/bot/questions/${id}`, { method: "DELETE" });
    showToast("Pregunta eliminada");
    loadQuestions();
  };

  const handleSend = async (id: string) => {
    setSendingId(id);
    try {
      const body: Record<string, any> = {};
      if (questionSegment) {
        const telegramUserIds = await getSegmentTelegramUserIds(questionSegment);
        if (telegramUserIds.length === 0) {
          showToast("Error: El segmento no tiene telegram users");
          setSendingId(null);
          return;
        }
        body.targetTelegramUserIds = telegramUserIds;
      }
      const result = await apiFetch<{ sent: number; failed: number; total: number }>(
        `/bot/send-question/${id}`,
        { method: "POST", body: JSON.stringify(body) }
      );
      showToast(`Enviada a ${result.sent}/${result.total} suscriptores${questionSegment ? " (segmento)" : ""}`);
      loadQuestions();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setSendingId(null);
    }
  };

  if (view.mode === "create") {
    return <QuestionForm onSave={handleCreate} onCancel={() => setView({ mode: "list" })} />;
  }
  if (view.mode === "edit") {
    return (
      <QuestionForm
        initial={view.question}
        onSave={(q) => handleUpdate(view.question.id, q)}
        onCancel={() => setView({ mode: "list" })}
      />
    );
  }
  if (view.mode === "responses") {
    return (
      <ResponseDetail
        question={view.question}
        onBack={() => setView({ mode: "list" })}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 text-xs px-4 py-2.5 rounded-xl shadow-xl" style={{ backgroundColor: "var(--p-bg-hover)", border: "1px solid var(--p-border)", color: "var(--p-text)" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--p-text)" }}>Preguntas Bot</h3>
          <p className="text-[11px]" style={{ color: "var(--p-text-ghost)" }}>
            Preguntas individuales enviadas via inline keyboard
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setLoading(true); loadQuestions(); }}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--p-text-faint)", border: "1px solid var(--p-border-subtle)" }}
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={() => setView({ mode: "create" })}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors"
            style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}
          >
            <Plus size={13} /> Nueva
          </button>
        </div>
      </div>

      {/* Segment picker for targeted sends */}
      <SegmentPicker selected={questionSegment} onChange={setQuestionSegment} />

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--p-text-ghost)" }} />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12">
          <Bot size={32} className="mx-auto mb-3" style={{ color: "var(--p-text-ghost)" }} />
          <p className="text-sm" style={{ color: "var(--p-text-ghost)" }}>No hay preguntas bot todavia</p>
          <p className="text-xs mt-1" style={{ color: "var(--p-text-ghost)" }}>
            Crea una para enviarla como inline keyboard
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <div
              key={q.id}
              className="rounded-xl p-3 transition-colors"
              style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}
            >
              {/* Question text */}
              <p className="text-sm mb-2 line-clamp-2" style={{ color: "var(--p-text)" }}>{q.text}</p>

              {/* Options preview */}
              <div className="flex flex-wrap gap-1 mb-2">
                {q.options.map((opt, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-[#1a2a3a] text-[#6aa8e8] text-[10px] rounded-md"
                  >
                    {opt}
                  </span>
                ))}
              </div>

              {/* Meta */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-[10px] font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>
                  <span>
                    {new Date(q.createdAt).toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                  {q.sentCount > 0 && <span>Enviada {q.sentCount}x</span>}
                  {q.imageUrl && (
                    <span className="flex items-center gap-0.5">
                      <Image size={9} /> img
                    </span>
                  )}
                  <span style={{ color: "var(--p-text-muted)" }}>
                    🎟️ {q.rewardTickets ?? 1}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setView({ mode: "responses", question: q })}
                    className="p-1.5 transition-colors"
                    style={{ color: "var(--p-text-ghost)" }}
                    title="Ver respuestas"
                  >
                    <BarChart3 size={13} />
                  </button>
                  <button
                    onClick={() => setView({ mode: "edit", question: q })}
                    className="p-1.5 transition-colors"
                    style={{ color: "var(--p-text-ghost)" }}
                    title="Editar"
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="p-1.5 transition-colors"
                    style={{ color: "var(--p-text-ghost)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-danger)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }}
                    title="Eliminar"
                  >
                    <Trash2 size={13} />
                  </button>
                  <button
                    onClick={() => handleSend(q.id)}
                    disabled={sendingId === q.id}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors disabled:opacity-40 ${
                      questionSegment
                        ? "bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"
                        : ""
                    }`}
                    style={!questionSegment ? { backgroundColor: "color-mix(in srgb, var(--p-text) 10%, transparent)", color: "var(--p-text)" } : undefined}
                    title={questionSegment ? "Enviar al segmento" : "Enviar a todos los suscriptores"}
                  >
                    {sendingId === q.id ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Send size={11} />
                    )}
                    {questionSegment ? "Segmento" : "Enviar"}
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
      if (type === "drop") {
        body.buttonText = buttonText.trim() || "Abrir BRUTAL";
      } else if (buttonText.trim() && buttonUrl.trim()) {
        body.buttonText = buttonText.trim();
        body.buttonUrl = buttonUrl.trim();
      }

      if (selectedSegment) {
        const telegramUserIds = await getSegmentTelegramUserIds(selectedSegment);
        if (telegramUserIds.length === 0) {
          setResult("Error: El segmento no tiene telegram users");
          setSending(false);
          return;
        }
        body.targetTelegramUserIds = telegramUserIds;
      }

      const data = await apiFetch<{ sent: number; failed: number; total: number }>(
        "/bot/send-notification",
        { method: "POST", body: JSON.stringify(body) }
      );
      setResult(`Enviada a ${data.sent}/${data.total} suscriptores${selectedSegment ? " (segmento)" : ""}`);
      setText("");
      setImageUrl("");
    } catch (err: any) {
      setResult(`Error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: "var(--p-text)" }}>Enviar notificacion</h3>
      <p className="text-[11px]" style={{ color: "var(--p-text-ghost)" }}>
        Push a todos los suscriptores del bot o a un segmento especifico
      </p>

      <SegmentPicker selected={selectedSegment} onChange={setSelectedSegment} />

      {/* Type selector */}
      <div className="flex gap-2">
        {(["drop", "custom"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className="flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-all"
            style={{
              backgroundColor: type === t ? "var(--p-bg-hover)" : "transparent",
              borderColor: type === t ? "var(--p-border)" : "var(--p-border-subtle)",
              color: type === t ? "var(--p-text)" : "var(--p-text-faint)",
            }}
          >
            {t === "drop" ? "Nuevo Drop" : "Custom"}
          </button>
        ))}
      </div>

      {/* Message text */}
      <div>
        <label className="text-[11px] uppercase tracking-wider mb-1 block" style={{ color: "var(--p-text-faint)" }}>
          Mensaje
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-lg px-3 py-2.5 text-xs font-['Fira_Code'] resize-none min-h-[100px]"
          style={formInput}
          placeholder={
            type === "drop"
              ? "Ej: Nuevo drop disponible! Entra ahora y responde antes que se cierre."
              : "Ej: Importante: maniana a las 20hs drop especial."
          }
        />
      </div>

      {/* Image URL */}
      <div>
        <label className="text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: "var(--p-text-faint)" }}>
          <Image size={11} /> Imagen o GIF (opcional)
        </label>
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-xs font-['Fira_Code']"
          style={formInput}
          placeholder="https://... (URL directa a imagen o GIF)"
        />
        {imageUrl && (
          <div className="mt-2 w-full h-20 rounded-lg overflow-hidden" style={{ backgroundColor: "var(--p-bg-active)" }}>
            <img src={imageUrl} alt="preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}
      </div>

      {/* Button config */}
      {type === "drop" && (
        <div>
          <label className="text-[11px] uppercase tracking-wider mb-1 block" style={{ color: "var(--p-text-faint)" }}>
            Texto del boton (default: "Abrir BRUTAL")
          </label>
          <input value={buttonText} onChange={(e) => setButtonText(e.target.value)} className="w-full rounded-lg px-3 py-2 text-xs" style={formInput} placeholder="Abrir BRUTAL" />
        </div>
      )}

      {type === "custom" && (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider mb-1 block" style={{ color: "var(--p-text-faint)" }}>Texto del boton (opcional)</label>
            <input value={buttonText} onChange={(e) => setButtonText(e.target.value)} className="w-full rounded-lg px-3 py-2 text-xs" style={formInput} placeholder="Ej: Ver mas" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider mb-1 block" style={{ color: "var(--p-text-faint)" }}>URL del boton (opcional)</label>
            <input value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} className="w-full rounded-lg px-3 py-2 text-xs font-['Fira_Code']" style={formInput} placeholder="https://..." />
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--p-bg-card)", border: "1px solid var(--p-border-subtle)" }}>
        <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--p-text-ghost)" }}>Preview</p>
        <div className="rounded-lg p-3 max-w-[280px]" style={{ backgroundColor: "var(--p-bg-hover)" }}>
          {imageUrl && (
            <div className="w-full h-24 rounded mb-2 flex items-center justify-center overflow-hidden" style={{ backgroundColor: "var(--p-bg-active)", color: "var(--p-text-ghost)" }}>
              <img src={imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).replaceWith(document.createTextNode('img')); }} />
            </div>
          )}
          <p className="text-xs whitespace-pre-wrap mb-2" style={{ color: "var(--p-text)" }}>
            {text || "Texto del mensaje..."}
          </p>
          {(type === "drop" || (buttonText && buttonUrl)) && (
            <div className="py-1.5 px-3 bg-[#2a4a6a] text-[#7ab8ff] text-xs text-center rounded-md">
              {type === "drop" ? buttonText || "Abrir BRUTAL" : buttonText || "Boton"}
            </div>
          )}
        </div>
      </div>

      {/* Send */}
      <button
        onClick={handleSend}
        disabled={!text.trim() || sending}
        className={`w-full py-3 text-sm font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
          selectedSegment ? "bg-purple-500 text-white hover:bg-purple-400" : ""
        }`}
        style={!selectedSegment ? { backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" } : undefined}
      >
        {sending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <>
            <Send size={14} />
            {selectedSegment ? "Enviar al segmento" : "Enviar a todos"}
          </>
        )}
      </button>

      {result && (
        <p className="text-xs text-center" style={{ color: result.startsWith("Error") ? "var(--p-danger)" : "var(--p-success)" }}>
          {result}
        </p>
      )}
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
    } catch (err) {
      console.error("[BOT] Error loading subscribers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--p-text)" }}>Suscriptores</h3>
          <p className="text-[11px]" style={{ color: "var(--p-text-ghost)" }}>
            Usuarios que hicieron /start en @BrutalDropBot
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); load(); }}
          className="p-2 rounded-lg transition-colors"
          style={{ color: "var(--p-text-faint)", border: "1px solid var(--p-border-subtle)" }}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}>
          <p className="text-2xl font-bold font-['Fira_Code']" style={{ color: "var(--p-text)" }}>{total}</p>
          <p className="text-[10px] uppercase" style={{ color: "var(--p-text-ghost)" }}>Total</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}>
          <p className="text-2xl font-bold font-['Fira_Code']" style={{ color: "var(--p-success)" }}>{active}</p>
          <p className="text-[10px] uppercase" style={{ color: "var(--p-text-ghost)" }}>Activos</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--p-text-ghost)" }} />
        </div>
      ) : subs.length === 0 ? (
        <div className="text-center py-8">
          <Users size={28} className="mx-auto mb-2" style={{ color: "var(--p-text-ghost)" }} />
          <p className="text-sm" style={{ color: "var(--p-text-ghost)" }}>Sin suscriptores</p>
          <p className="text-xs mt-1" style={{ color: "var(--p-text-ghost)" }}>
            Los usuarios se registran al hacer /start en el bot
          </p>
        </div>
      ) : (
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {subs.map((s) => (
            <div key={s.userId} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ backgroundColor: "var(--p-bg-card)" }}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${s.active ? "bg-green-500" : ""}`} style={!s.active ? { backgroundColor: "var(--p-border)" } : undefined} />
                <div>
                  <p className="text-xs" style={{ color: "var(--p-text)" }}>{s.firstName} {s.lastName}</p>
                  {s.username && (
                    <p className="text-[10px] font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>@{s.username}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>
                  {new Date(s.lastSeen).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                </p>
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

interface BotStatus {
  ok: boolean;
  mode: "webhook" | "polling";
  webhookUrl: string | null;
  webhookPending: number;
  webhookLastError: string | null;
  webhookLastErrorDate: number | null;
  pollOffset: number;
  botUsername: string | null;
  botName: string | null;
}

const AUTO_POLL_KEY = "brutal_bot_auto_polling";

function ConfigTab() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [polling, setPolling] = useState(false);
  const [autoPolling, setAutoPolling] = useState(() => {
    try { return localStorage.getItem(AUTO_POLL_KEY) === "true"; } catch (_e) { return false; }
  });
  const [result, setResult] = useState<string | null>(null);
  const [pollStats, setPollStats] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem(AUTO_POLL_KEY, autoPolling ? "true" : "false"); } catch (_e) { /* noop */ }
  }, [autoPolling]);

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiFetch<BotStatus>("/bot-status");
      setStatus(data);
    } catch (err) {
      console.error("[BOT] Error loading status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  useEffect(() => {
    if (!autoPolling) return;
    const doPoll = async () => {
      setPolling(true);
      try {
        const data = await apiFetch<{ ok: boolean; processed: number; total: number; errors: number; offset: number }>(
          "/bot/poll",
          { method: "POST" }
        );
        if (data.total > 0) {
          setPollStats(`${data.processed} procesados de ${data.total} updates`);
          setTimeout(() => setPollStats(null), 3000);
        }
      } catch (_e) {
        console.error("[BOT] Auto-poll error:", _e);
      } finally {
        setPolling(false);
      }
    };
    doPoll();
    const interval = setInterval(doPoll, 3000);
    return () => clearInterval(interval);
  }, [autoPolling]);

  const deleteWebhook = async () => {
    setActing(true);
    setResult(null);
    try {
      const data = await apiFetch<{ ok: boolean }>("/bot-delete-webhook", { method: "POST" });
      if (data.ok) {
        setResult("Webhook eliminado — modo polling activo");
        loadStatus();
      } else {
        setResult("Error al eliminar webhook");
      }
    } catch (err: any) {
      setResult(`Error: ${err.message}`);
    } finally {
      setActing(false);
    }
  };

  const pollNow = async () => {
    setPolling(true);
    setPollStats(null);
    try {
      const data = await apiFetch<{ ok: boolean; processed: number; total: number; errors: number; offset: number }>(
        "/bot/poll",
        { method: "POST" }
      );
      if (data.total === 0) {
        setPollStats("Sin updates pendientes");
      } else {
        setPollStats(`${data.processed} procesados, ${data.errors} errores (de ${data.total} updates)`);
      }
      loadStatus();
    } catch (err: any) {
      setPollStats(`Error: ${err.message}`);
    } finally {
      setPolling(false);
    }
  };

  const hasWebhook = status?.mode === "webhook";

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: "var(--p-text)" }}>Configuracion del Bot</h3>

      {/* Connection status */}
      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--p-text-ghost)" }} />
          </div>
        ) : status ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {hasWebhook ? (
                  <WifiOff size={14} style={{ color: "var(--p-warning)" }} />
                ) : (
                  <Wifi size={14} style={{ color: "var(--p-success)" }} />
                )}
                <span className="text-sm font-medium" style={{ color: "var(--p-text)" }}>
                  Modo: {hasWebhook ? "Webhook (con error)" : "Polling"}
                </span>
              </div>
              <button
                onClick={() => { setLoading(true); loadStatus(); }}
                className="p-1.5 transition-colors"
                style={{ color: "var(--p-text-faint)" }}
              >
                <RefreshCw size={12} />
              </button>
            </div>

            {status.botUsername && (
              <p className="text-[11px] font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>
                Bot: @{status.botUsername} ({status.botName})
              </p>
            )}

            {hasWebhook && (
              <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: "color-mix(in srgb, var(--p-warning) 5%, var(--p-bg))", border: "1px solid color-mix(in srgb, var(--p-warning) 20%, transparent)" }}>
                <p className="text-[11px] font-medium" style={{ color: "var(--p-warning)" }}>
                  Hay un webhook activo que no funciona con Supabase Edge Functions (401 auth).
                  Eliminalo para usar modo polling.
                </p>
                {status.webhookLastError && (
                  <p className="text-[10px] font-['Fira_Code']" style={{ color: "var(--p-text-faint)" }}>
                    Ultimo error: {status.webhookLastError}
                  </p>
                )}
                <button
                  onClick={deleteWebhook}
                  disabled={acting}
                  className="w-full py-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ backgroundColor: "color-mix(in srgb, var(--p-warning) 20%, transparent)", color: "var(--p-warning)" }}
                >
                  {acting ? <Loader2 size={13} className="animate-spin" /> : <><Trash2 size={13} /> Eliminar webhook</>}
                </button>
              </div>
            )}

            {!hasWebhook && (
              <div className="space-y-3">
                <p className="text-[11px] font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>
                  Offset: {status.pollOffset}
                </p>

                <button
                  onClick={pollNow}
                  disabled={polling}
                  className="w-full py-2.5 text-xs font-bold rounded-lg transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}
                >
                  {polling ? <Loader2 size={13} className="animate-spin" /> : <><RefreshCw size={13} /> Poll ahora</>}
                </button>

                {/* Auto-polling toggle */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ backgroundColor: "var(--p-bg-card)" }}>
                  <div>
                    <p className="text-xs font-medium" style={{ color: "var(--p-text)" }}>Auto-polling</p>
                    <p className="text-[10px]" style={{ color: "var(--p-text-ghost)" }}>
                      Consulta cada 3s mientras esta pestaña este abierta
                    </p>
                  </div>
                  <button
                    onClick={() => setAutoPolling(!autoPolling)}
                    className="w-10 h-5 rounded-full transition-colors relative"
                    style={{ backgroundColor: autoPolling ? "var(--p-success)" : "var(--p-border)" }}
                  >
                    <div
                      className="w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all"
                      style={{ left: autoPolling ? "22px" : "2px" }}
                    />
                  </button>
                </div>

                {autoPolling && (
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--p-success)" }}>
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--p-success)" }} />
                    Polling activo...
                  </div>
                )}
              </div>
            )}

            {result && (
              <p className="text-xs text-center" style={{ color: result.startsWith("Error") ? "var(--p-danger)" : "var(--p-success)" }}>
                {result}
              </p>
            )}
            {pollStats && (
              <p className="text-xs text-center text-blue-400">{pollStats}</p>
            )}
          </>
        ) : (
          <p className="text-xs" style={{ color: "var(--p-text-ghost)" }}>No se pudo obtener estado del bot</p>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: "var(--p-bg-card)", border: "1px solid var(--p-border-subtle)" }}>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--p-text-muted)" }}>
          <AlertTriangle size={12} />
          Como funciona
        </div>
        <ul className="text-[11px] space-y-1.5 list-disc list-inside" style={{ color: "var(--p-text-ghost)" }}>
          <li>
            Los usuarios hacen <code className="font-['Fira_Code']" style={{ color: "var(--p-text-muted)" }}>/start</code> en{" "}
            <span style={{ color: "var(--p-text)" }}>@BrutalDropBot</span> para suscribirse
          </li>
          <li>
            El bot usa <span style={{ color: "var(--p-text)" }}>polling</span> (no webhook) porque
            Supabase Edge Functions requieren auth que Telegram no puede enviar
          </li>
          <li>
            Activa <span style={{ color: "var(--p-text)" }}>auto-polling</span> o usa{" "}
            <span style={{ color: "var(--p-text)" }}>Poll ahora</span> para procesar mensajes pendientes
          </li>
          <li>
            Desde <span style={{ color: "var(--p-text)" }}>Preguntas</span> creas preguntas con
            opciones que se envian como inline keyboard
          </li>
          <li>
            Desde <span style={{ color: "var(--p-text)" }}>Notificar</span> podes enviar
            avisos de nuevos drops con boton para abrir la mini app
          </li>
        </ul>
      </div>

      {/* Bot link */}
      <div className="rounded-xl p-3 flex items-center justify-between" style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}>
        <div>
          <p className="text-xs font-medium" style={{ color: "var(--p-text)" }}>Link del bot</p>
          <p className="text-[11px] font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>
            https://t.me/BrutalDropBot
          </p>
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText("https://t.me/BrutalDropBot"); }}
          className="p-2 transition-colors"
          style={{ color: "var(--p-text-ghost)" }}
          title="Copiar link"
        >
          <Copy size={13} />
        </button>
      </div>

      {/* Cron URL for external polling */}
      <CronUrlBox />
    </div>
  );
}

// ── Cron URL Box — copiable URL for external cron ────────────

function CronUrlBox() {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedHeader, setCopiedHeader] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const handleCopyUrl = () => { navigator.clipboard.writeText(CRON_POLL_URL); setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000); };
  const handleCopyHeader = () => { navigator.clipboard.writeText(CRON_AUTH_HEADER); setCopiedHeader(true); setTimeout(() => setCopiedHeader(false), 2000); };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(CRON_POLL_URL, { method: "POST", headers: { "Content-Type": "application/json", "X-Panel-Token": CRON_AUTH_HEADER } });
      const data = await res.json();
      setTestResult(data.ok ? `OK — ${data.processed} procesados de ${data.total} updates` : `Error: ${data.error || "respuesta inesperada"}`);
    } catch (err) {
      setTestResult(`Error de red: ${err}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "color-mix(in srgb, var(--p-success) 5%, var(--p-bg))", border: "1px solid color-mix(in srgb, var(--p-success) 20%, transparent)" }}>
      <div className="flex items-center gap-2">
        <RefreshCw size={13} style={{ color: "var(--p-success)" }} />
        <p className="text-xs font-semibold" style={{ color: "var(--p-success)" }}>Cron externo (polling 24/7 sin panel)</p>
      </div>
      <p className="text-[11px]" style={{ color: "var(--p-text-faint)" }}>
        Configura{" "}
        <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" style={{ color: "var(--p-success)" }} className="underline">
          cron-job.org
        </a>{" "}
        (gratis) para que el bot procese respuestas automaticamente cada minuto.
      </p>

      {/* Field 1: URL */}
      <div>
        <p className="text-[10px] uppercase tracking-wider mb-1 font-semibold" style={{ color: "var(--p-text-faint)" }}>1. URL</p>
        <div className="relative">
          <div className="rounded-lg p-2.5 pr-20 overflow-x-auto" style={{ backgroundColor: "var(--p-bg-card)", border: "1px solid var(--p-border-subtle)" }}>
            <code className="text-[10px] font-['Fira_Code'] whitespace-nowrap select-all" style={{ color: "var(--p-success)" }}>
              {CRON_POLL_URL}
            </code>
          </div>
          <button
            onClick={handleCopyUrl}
            className="absolute top-1.5 right-1.5 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all"
            style={copiedUrl ? { backgroundColor: "color-mix(in srgb, var(--p-success) 20%, transparent)", color: "var(--p-success)" } : { backgroundColor: "color-mix(in srgb, var(--p-text) 10%, transparent)", color: "var(--p-text)" }}
          >
            {copiedUrl ? <><Check size={10} /> OK</> : <><Copy size={10} /> Copiar</>}
          </button>
        </div>
      </div>

      {/* Field 2: Authorization Header */}
      <div>
        <p className="text-[10px] uppercase tracking-wider mb-1 font-semibold" style={{ color: "var(--p-text-faint)" }}>2. Header &quot;Authorization&quot;</p>
        <div className="relative">
          <div className="rounded-lg p-2.5 pr-20 overflow-x-auto" style={{ backgroundColor: "var(--p-bg-card)", border: "1px solid var(--p-border-subtle)" }}>
            <code className="text-[10px] font-['Fira_Code'] whitespace-nowrap select-all" style={{ color: "var(--p-success)" }}>
              {CRON_AUTH_HEADER}
            </code>
          </div>
          <button
            onClick={handleCopyHeader}
            className="absolute top-1.5 right-1.5 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all"
            style={copiedHeader ? { backgroundColor: "color-mix(in srgb, var(--p-success) 20%, transparent)", color: "var(--p-success)" } : { backgroundColor: "color-mix(in srgb, var(--p-text) 10%, transparent)", color: "var(--p-text)" }}
          >
            {copiedHeader ? <><Check size={10} /> OK</> : <><Copy size={10} /> Copiar</>}
          </button>
        </div>
      </div>

      {/* Test button */}
      <button
        onClick={handleTest}
        disabled={testing}
        className="w-full py-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        style={{ backgroundColor: "color-mix(in srgb, var(--p-success) 10%, transparent)", color: "var(--p-success)" }}
      >
        {testing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        Probar ahora (desde el panel)
      </button>

      {testResult && (
        <p className="text-[11px] text-center" style={{ color: testResult.startsWith("OK") ? "var(--p-success)" : "var(--p-danger)" }}>
          {testResult}
        </p>
      )}

      {/* Instructions */}
      <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: "var(--p-bg-card)", border: "1px solid var(--p-border-subtle)" }}>
        <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--p-text-faint)" }}>
          Paso a paso en cron-job.org
        </p>
        <ol className="text-[11px] space-y-1.5 list-decimal list-inside" style={{ color: "var(--p-text-ghost)" }}>
          <li>Crear cuenta en <span style={{ color: "var(--p-success)" }}>cron-job.org</span> (gratis)</li>
          <li>Click <span style={{ color: "var(--p-text)" }}>Create Cron Job</span></li>
          <li>Pegar la <span style={{ color: "var(--p-text)" }}>URL</span> de arriba</li>
          <li>Method: <span style={{ color: "var(--p-text)" }}>POST</span></li>
          <li>Ir a la tab <span style={{ color: "var(--p-text)" }}>Headers</span> y agregar:
            <div className="mt-1 ml-4 space-y-0.5 font-['Fira_Code']">
              <p className="text-[10px]">Key: <span style={{ color: "var(--p-text)" }}>Authorization</span></p>
              <p className="text-[10px]">Value: <span style={{ color: "var(--p-success)" }}>(pegar el header de arriba)</span></p>
            </div>
          </li>
          <li>Schedule: <span style={{ color: "var(--p-text)" }}>Every 1 minute</span></li>
          <li>Guardar. Listo, el bot responde 24/7</li>
        </ol>
      </div>
    </div>
  );
}

// ── Main BotManager ──────────────────────────────────────────

export function BotManager() {
  const [tab, setTab] = useState<BotTab>("questions");

  return (
    <div>
      {/* Title */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Bot size={18} style={{ color: "var(--p-text)" }} />
          <h2 className="text-lg font-bold" style={{ color: "var(--p-text)" }}>Bot</h2>
        </div>
        <p className="text-xs" style={{ color: "var(--p-text-ghost)" }}>
          Preguntas push, notificaciones y suscriptores de @BrutalDropBot
        </p>
      </div>

      <TabBar active={tab} onChange={setTab} />

      {tab === "questions" && <QuestionsTab />}
      {tab === "notify" && <NotifyTab />}
      {tab === "subscribers" && <SubscribersTab />}
      {tab === "config" && <ConfigTab />}
    </div>
  );
}
