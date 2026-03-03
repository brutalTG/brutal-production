// ============================================================
// ONBOARDING BUILDER — Panel section to edit compass rafagas
// Migrated to CSS variables var(--p-*) for light/dark theming
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Loader2,
  Check,
  AlertCircle,
  Eye,
} from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import type { CompassRafaga, CompassPair, CompassAxis } from "../onboarding/compass-types";
import { AXIS_POLES } from "../onboarding/compass-types";
import { DEFAULT_RAFAGAS, ARCHETYPES } from "../onboarding/compass-data";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-c68eb08c`;
const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
});

const AXIS_OPTIONS: { value: CompassAxis; label: string }[] = [
  { value: "X", label: `X: ${AXIS_POLES.X.negative} / ${AXIS_POLES.X.positive}` },
  { value: "Y", label: `Y: ${AXIS_POLES.Y.negative} / ${AXIS_POLES.Y.positive}` },
  { value: "Z", label: `Z: ${AXIS_POLES.Z.negative} / ${AXIS_POLES.Z.positive}` },
];

// ── Pair Editor ─────────────────────────────────────────────

function PairEditor({
  pair,
  index,
  onChange,
  onRemove,
}: {
  pair: CompassPair;
  index: number;
  onChange: (updated: CompassPair) => void;
  onRemove: () => void;
}) {
  const poleName = pair.optionAPolarity === -1
    ? AXIS_POLES[pair.axis].negative
    : AXIS_POLES[pair.axis].positive;

  return (
    <div
      className="flex items-start gap-2 p-3 rounded-lg group transition-colors"
      style={{
        backgroundColor: "var(--p-bg-card)",
        border: "1px solid var(--p-border-subtle)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--p-border)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--p-border-subtle)"; }}
    >
      {/* Index */}
      <span className="text-[10px] font-['Fira_Code'] w-5 pt-2 text-right shrink-0" style={{ color: "var(--p-text-ghost)" }}>
        {index + 1}
      </span>

      <div className="flex-1 flex flex-col gap-2">
        {/* Top row: text + emojis */}
        <div className="flex items-center gap-2">
          <input
            className="flex-1 rounded px-2 py-1.5 text-xs font-['Roboto'] focus:outline-none"
            style={{
              backgroundColor: "var(--p-bg-input)",
              border: "1px solid var(--p-border-subtle)",
              color: "var(--p-text)",
            }}
            value={pair.text}
            onChange={(e) => onChange({ ...pair, text: e.target.value })}
            placeholder="Micro-pregunta (3-5 palabras)"
          />
          <input
            className="w-12 rounded px-1 py-1.5 text-center text-lg focus:outline-none"
            style={{
              backgroundColor: "var(--p-bg-input)",
              border: "1px solid var(--p-border-subtle)",
              color: "var(--p-text)",
            }}
            value={pair.optionA}
            onChange={(e) => onChange({ ...pair, optionA: e.target.value })}
            title="Emoji A"
          />
          <input
            className="w-12 rounded px-1 py-1.5 text-center text-lg focus:outline-none"
            style={{
              backgroundColor: "var(--p-bg-input)",
              border: "1px solid var(--p-border-subtle)",
              color: "var(--p-text)",
            }}
            value={pair.optionB}
            onChange={(e) => onChange({ ...pair, optionB: e.target.value })}
            title="Emoji B"
          />
        </div>

        {/* Bottom row: axis + polarity */}
        <div className="flex items-center gap-2">
          <select
            className="rounded px-2 py-1 text-[11px] font-['Fira_Code'] focus:outline-none"
            style={{
              backgroundColor: "var(--p-bg-input)",
              border: "1px solid var(--p-border-subtle)",
              color: "var(--p-text-secondary)",
            }}
            value={pair.axis}
            onChange={(e) => onChange({ ...pair, axis: e.target.value as CompassAxis })}
          >
            {AXIS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button
            onClick={() => onChange({ ...pair, optionAPolarity: pair.optionAPolarity === 1 ? -1 : 1 })}
            className="px-2 py-1 rounded text-[10px] font-['Fira_Code'] transition-colors"
            style={{
              backgroundColor: "var(--p-bg-input)",
              border: "1px solid var(--p-border-subtle)",
              color: "var(--p-text-muted)",
            }}
            title="Toggle: emoji A mapea al polo..."
          >
            A={pair.optionAPolarity === 1 ? AXIS_POLES[pair.axis].positive : AXIS_POLES[pair.axis].negative}
          </button>

          <span className="text-[10px] font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>
            B={pair.optionAPolarity === 1 ? AXIS_POLES[pair.axis].negative : AXIS_POLES[pair.axis].positive}
          </span>

          <button
            onClick={onRemove}
            className="ml-auto p-1 opacity-0 group-hover:opacity-100 transition-all"
            style={{ color: "var(--p-text-ghost)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-danger)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }}
            title="Eliminar par"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rafaga Editor ───────────────────────────────────────────

function RafagaEditor({
  rafaga,
  onChange,
  onRemove,
}: {
  rafaga: CompassRafaga;
  onChange: (updated: CompassRafaga) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const updatePair = (idx: number, updated: CompassPair) => {
    const pairs = [...rafaga.pairs];
    pairs[idx] = updated;
    onChange({ ...rafaga, pairs });
  };

  const removePair = (idx: number) => {
    onChange({ ...rafaga, pairs: rafaga.pairs.filter((_, i) => i !== idx) });
  };

  const addPair = () => {
    const newPair: CompassPair = {
      id: `${rafaga.id}_${Date.now().toString(36)}`,
      text: "",
      optionA: "\u2753",
      optionB: "\u2753",
      axis: "X",
      optionAPolarity: -1,
    };
    onChange({ ...rafaga, pairs: [...rafaga.pairs, newPair] });
  };

  // Count pairs per axis
  const axisCounts = rafaga.pairs.reduce((acc, p) => {
    acc[p.axis] = (acc[p.axis] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--p-border-subtle)" }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 transition-colors text-left"
        style={{ backgroundColor: "var(--p-bg-card)" }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--p-bg-input)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--p-bg-card)"; }}
      >
        {expanded ? <ChevronDown size={14} style={{ color: "var(--p-text-ghost)" }} /> : <ChevronRight size={14} style={{ color: "var(--p-text-ghost)" }} />}
        <span className="text-sm font-bold font-['Silkscreen']" style={{ color: "var(--p-text)" }}>{rafaga.label}</span>
        <span className="text-[11px] font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>{rafaga.pairs.length} pares</span>

        {/* Axis balance badges */}
        <div className="flex gap-1 ml-auto mr-2">
          {(["X", "Y", "Z"] as CompassAxis[]).map((axis) => (
            <span
              key={axis}
              className="text-[9px] font-['Fira_Code'] px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: axisCounts[axis] ? "color-mix(in srgb, #0f0 15%, transparent)" : "color-mix(in srgb, #f00 10%, transparent)",
                color: axisCounts[axis] ? "#4f4" : "#f44",
              }}
            >
              {axis}:{axisCounts[axis] || 0}
            </span>
          ))}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="p-4 flex flex-col gap-3" style={{ backgroundColor: "var(--p-bg)" }}>
          {/* Rafaga meta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-['Fira_Code'] uppercase" style={{ color: "var(--p-text-faint)" }}>Label</label>
              <input
                className="rounded px-2 py-1.5 text-xs font-['Silkscreen'] focus:outline-none"
                style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)", color: "var(--p-text)" }}
                value={rafaga.label}
                onChange={(e) => onChange({ ...rafaga, label: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-['Fira_Code'] uppercase" style={{ color: "var(--p-text-faint)" }}>Prompt bold</label>
              <input
                className="rounded px-2 py-1.5 text-xs focus:outline-none"
                style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)", color: "var(--p-text)" }}
                value={rafaga.promptBold}
                onChange={(e) => onChange({ ...rafaga, promptBold: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-['Fira_Code'] uppercase" style={{ color: "var(--p-text-faint)" }}>Tema</label>
              <input
                className="rounded px-2 py-1.5 text-xs focus:outline-none"
                style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)", color: "var(--p-text)" }}
                value={rafaga.theme}
                onChange={(e) => onChange({ ...rafaga, theme: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-['Fira_Code'] uppercase" style={{ color: "var(--p-text-faint)" }}>Segundos/par</label>
              <input
                className="rounded px-2 py-1.5 text-xs font-['Fira_Code'] focus:outline-none"
                style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)", color: "var(--p-text)" }}
                type="number"
                min={1}
                max={10}
                step={0.5}
                value={rafaga.secondsPerItem}
                onChange={(e) => onChange({ ...rafaga, secondsPerItem: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Pairs */}
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-['Fira_Code'] uppercase tracking-wider" style={{ color: "var(--p-text-faint)" }}>Pares</span>
              <button
                onClick={addPair}
                className="flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors"
                style={{ color: "var(--p-text-muted)", border: "1px solid var(--p-border)" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--p-text-ghost)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--p-border)"; }}
              >
                <Plus size={10} /> Agregar par
              </button>
            </div>
            {rafaga.pairs.map((pair, idx) => (
              <PairEditor
                key={pair.id}
                pair={pair}
                index={idx}
                onChange={(updated) => updatePair(idx, updated)}
                onRemove={() => removePair(idx)}
              />
            ))}
          </div>

          {/* Remove rafaga */}
          <button
            onClick={onRemove}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors self-start mt-2"
            style={{ color: "var(--p-danger)", border: "1px solid color-mix(in srgb, var(--p-danger) 30%, transparent)" }}
          >
            <Trash2 size={12} /> Eliminar rafaga
          </button>
        </div>
      )}
    </div>
  );
}

// ── Archetype Reference ─────────────────────────────────────

function ArchetypeReference() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--p-border-subtle)" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 transition-colors text-left"
        style={{ backgroundColor: "var(--p-bg-card)" }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--p-bg-input)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--p-bg-card)"; }}
      >
        {expanded ? <ChevronDown size={14} style={{ color: "var(--p-text-ghost)" }} /> : <ChevronRight size={14} style={{ color: "var(--p-text-ghost)" }} />}
        <span className="text-xs font-bold" style={{ color: "var(--p-text-muted)" }}>8 ARQUETIPOS — Referencia</span>
      </button>
      {expanded && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2" style={{ backgroundColor: "var(--p-bg)" }}>
          {ARCHETYPES.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-2 p-2 rounded-lg"
              style={{ backgroundColor: "var(--p-bg-card)", border: "1px solid var(--p-border-subtle)" }}
            >
              <span className="text-2xl leading-none">{a.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: "var(--p-text)" }}>{a.name}</span>
                  <span className="text-[9px] font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>
                    {a.coords.x === -1 ? "SIS" : "GRI"}+{a.coords.y === -1 ? "BUN" : "VIT"}+{a.coords.z === -1 ? "CAL" : "FUE"}
                  </span>
                </div>
                <p className="text-[10px] italic mt-0.5 truncate" style={{ color: "var(--p-text-faint)" }}>"{a.phrase}"</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Axis Balance Summary ────────────────────────────────────

function AxisBalance({ rafagas }: { rafagas: CompassRafaga[] }) {
  const totals: Record<CompassAxis, number> = { X: 0, Y: 0, Z: 0 };
  for (const r of rafagas) {
    for (const p of r.pairs) {
      totals[p.axis]++;
    }
  }
  const totalPairs = rafagas.reduce((s, r) => s + r.pairs.length, 0);

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--p-bg-card)", border: "1px solid var(--p-border-subtle)" }}>
      <h4 className="text-[10px] font-bold font-['Fira_Code'] uppercase tracking-wider mb-3" style={{ color: "var(--p-text-faint)" }}>
        Balance de ejes ({totalPairs} pares totales)
      </h4>
      <div className="flex gap-4">
        {(["X", "Y", "Z"] as CompassAxis[]).map((axis) => {
          const isBalanced = totals[axis] >= 8 && totals[axis] <= 12;
          return (
            <div key={axis} className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-['Fira_Code']" style={{ color: "var(--p-text-muted)" }}>
                  {AXIS_POLES[axis].negative}/{AXIS_POLES[axis].positive}
                </span>
                <span className={`text-[11px] font-['Fira_Code'] font-bold`} style={{ color: isBalanced ? "var(--p-success)" : "var(--p-warning)" }}>
                  {totals[axis]}
                </span>
              </div>
              <div className="w-full h-[4px] rounded-full" style={{ backgroundColor: "var(--p-border-subtle)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (totals[axis] / 12) * 100)}%`,
                    backgroundColor: isBalanced ? "#4f4" : "#fa4",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Builder ────────────────────────────────────────────

export function OnboardingBuilder() {
  const [rafagas, setRafagas] = useState<CompassRafaga[]>([...DEFAULT_RAFAGAS]);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<"ok" | "error" | null>(null);
  const [loading, setLoading] = useState(true);

  // Load from server on mount
  useEffect(() => {
    fetch(`${API_BASE}/compass-config`, { headers: headers() })
      .then((r) => r.json())
      .then((data) => {
        if (data.rafagas && Array.isArray(data.rafagas) && data.rafagas.length > 0) {
          setRafagas(data.rafagas);
        }
      })
      .catch((err) => console.error("[Panel] Failed to load compass config:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch(`${API_BASE}/compass-config`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ rafagas }),
      });
      setSaveResult(res.ok ? "ok" : "error");
    } catch {
      setSaveResult("error");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveResult(null), 3000);
    }
  }, [rafagas]);

  const handleReset = useCallback(() => {
    if (confirm("Resetear a las rafagas por defecto? Se perderan los cambios.")) {
      setRafagas([...DEFAULT_RAFAGAS]);
    }
  }, []);

  const updateRafaga = (idx: number, updated: CompassRafaga) => {
    setRafagas((prev) => prev.map((r, i) => (i === idx ? updated : r)));
  };

  const removeRafaga = (idx: number) => {
    setRafagas((prev) => prev.filter((_, i) => i !== idx));
  };

  const addRafaga = () => {
    const newRafaga: CompassRafaga = {
      id: `rafaga_${Date.now().toString(36)}`,
      label: "NUEVA",
      theme: "",
      promptBold: "NUEVA",
      secondsPerItem: 2,
      pairs: [],
    };
    setRafagas((prev) => [...prev, newRafaga]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--p-text-ghost)" }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "var(--p-text)" }}>Onboarding — Compass</h2>
          <p className="text-xs mt-0.5 font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>
            {rafagas.length} rafagas · {rafagas.reduce((s, r) => s + r.pairs.length, 0)} pares · 3 ejes · 8 arquetipos
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors"
            style={{ border: "1px solid var(--p-border)", color: "var(--p-text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--p-text-ghost)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--p-border)"; }}
          >
            <RotateCcw size={12} /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Guardar
          </button>
          {saveResult === "ok" && (
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--p-success)" }}><Check size={12} /> Guardado</span>
          )}
          {saveResult === "error" && (
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--p-danger)" }}><AlertCircle size={12} /> Error</span>
          )}
        </div>
      </div>

      {/* Axis balance */}
      <AxisBalance rafagas={rafagas} />

      {/* Archetype reference */}
      <ArchetypeReference />

      {/* Rafagas */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold" style={{ color: "var(--p-text-muted)" }}>Rafagas</h3>
          <button
            onClick={addRafaga}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors"
            style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}
          >
            <Plus size={12} /> Agregar rafaga
          </button>
        </div>
        {rafagas.map((raf, idx) => (
          <RafagaEditor
            key={raf.id}
            rafaga={raf}
            onChange={(updated) => updateRafaga(idx, updated)}
            onRemove={() => removeRafaga(idx)}
          />
        ))}
      </div>
    </div>
  );
}
