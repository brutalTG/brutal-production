// ============================================================
// QUESTION BUILDER — Dynamic form per question type
// Migrated to CSS variables var(--p-*) for light/dark theming
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  ChevronDown,
  GripVertical,
  Gift,
  BarChart3,
  Link2,
  Tag,
} from "lucide-react";
import type { Question, RafagaItem, RafagaBurstItem } from "../drop-types";
import {
  type PanelQuestion,
  type QuestionType,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_ICONS,
  QUESTION_TYPE_CATEGORIES,
  getDefaultQuestionData,
  createQuestion,
  updateQuestion,
  getQuestionById,
} from "./panel-store";

// Auth: panel token from sessionStorage (set during login)

// --- Shared input styles ---
const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--p-bg-hover)",
  border: "1px solid var(--p-border-subtle)",
  color: "var(--p-text)",
};

const labelStyle: React.CSSProperties = {
  color: "var(--p-text-muted)",
};

// --- Field Components ---

function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  mono?: boolean;
}) {
  const cls = `w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors ${mono ? "font-['Fira_Code']" : ""}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>{label}</label>
      {multiline ? (
        <textarea
          className={cls + " min-h-[80px] resize-y"}
          style={inputStyle}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className={cls}
          style={inputStyle}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>{label}</label>
      <div className="flex items-center gap-2">
        <input
          className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors"
          style={inputStyle}
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step || 1}
        />
        {suffix && <span className="text-xs whitespace-nowrap" style={{ color: "var(--p-text-faint)" }}>{suffix}</span>}
      </div>
    </div>
  );
}

function StringListField({
  label,
  values,
  onChange,
  min,
  max,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  const addItem = () => {
    if (max && values.length >= max) return;
    onChange([...values, ""]);
  };
  const removeItem = (i: number) => {
    if (min && values.length <= min) return;
    onChange(values.filter((_, idx) => idx !== i));
  };
  const updateItem = (i: number, v: string) => {
    const next = [...values];
    next[i] = v;
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>{label}</label>
      <div className="flex flex-col gap-2">
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs w-5 text-right font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>{i + 1}</span>
            <input
              className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors"
              style={inputStyle}
              value={v}
              onChange={(e) => updateItem(i, e.target.value)}
              placeholder={placeholder || `Opción ${i + 1}`}
            />
            {(!min || values.length > min) && (
              <button
                onClick={() => removeItem(i)}
                className="p-1.5 transition-colors"
                style={{ color: "var(--p-text-ghost)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-danger)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        {(!max || values.length < max) && (
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 text-xs py-1.5 transition-colors"
            style={{ color: "var(--p-text-faint)" }}
          >
            <Plus size={12} /> Agregar opción
          </button>
        )}
      </div>
    </div>
  );
}

function RafagaItemsField({
  items,
  onChange,
  emojiMode,
}: {
  items: RafagaItem[];
  onChange: (items: RafagaItem[]) => void;
  emojiMode?: boolean;
}) {
  const addItem = () => {
    onChange([...items, { text: "", optionA: emojiMode ? "😀" : "", optionB: emojiMode ? "😢" : "" }]);
  };
  const removeItem = (i: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, idx) => idx !== i));
  };
  const updateItem = (i: number, field: keyof RafagaItem, v: string) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: v };
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>Items de ráfaga</label>
      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-lg p-3 flex flex-col gap-2" style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical size={14} style={{ color: "var(--p-text-ghost)" }} />
                <span className="text-xs font-['Fira_Code']" style={{ color: "var(--p-text-faint)" }}>#{i + 1}</span>
              </div>
              {items.length > 1 && (
                <button onClick={() => removeItem(i)} className="p-1 transition-colors" style={{ color: "var(--p-text-ghost)" }} onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-danger)"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }}>
                  <Trash2 size={12} />
                </button>
              )}
            </div>
            <input
              className="w-full rounded px-2.5 py-1.5 text-sm focus:outline-none"
              style={inputStyle}
              value={item.text}
              onChange={(e) => updateItem(i, "text", e.target.value)}
              placeholder="Texto del item"
            />
            <div className="flex gap-2">
              <input
                className="flex-1 rounded px-2.5 py-1.5 text-sm focus:outline-none"
                style={inputStyle}
                value={item.optionA}
                onChange={(e) => updateItem(i, "optionA", e.target.value)}
                placeholder={emojiMode ? "Emoji A" : "Opción A"}
              />
              <input
                className="flex-1 rounded px-2.5 py-1.5 text-sm focus:outline-none"
                style={inputStyle}
                value={item.optionB}
                onChange={(e) => updateItem(i, "optionB", e.target.value)}
                placeholder={emojiMode ? "Emoji B" : "Opción B"}
              />
            </div>
          </div>
        ))}
        <button
          onClick={addItem}
          className="flex items-center gap-1.5 text-xs py-1.5 transition-colors"
          style={{ color: "var(--p-text-faint)" }}
        >
          <Plus size={12} /> Agregar item
        </button>
      </div>
    </div>
  );
}

function RafagaBurstItemsField({
  items,
  onChange,
}: {
  items: RafagaBurstItem[];
  onChange: (items: RafagaBurstItem[]) => void;
}) {
  const addItem = () => {
    onChange([...items, {
      trigger: { type: "text", text: "" },
      interaction: { type: "emoji_binary", emojiA: "👍", emojiB: "👎" }
    }]);
  };
  const removeItem = (i: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, idx) => idx !== i));
  };
  const updateTrigger = (i: number, text: string) => {
    const next = [...items];
    next[i] = { ...next[i], trigger: { type: "text", text } };
    onChange(next);
  };
  const updateInteraction = (i: number, field: "emojiA" | "emojiB", value: string) => {
    const next = [...items];
    if (next[i].interaction.type === "emoji_binary") {
      next[i] = {
        ...next[i],
        interaction: { ...next[i].interaction, [field]: value }
      };
    }
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>Items de ráfaga burst</label>
      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-lg p-3 flex flex-col gap-2" style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical size={14} style={{ color: "var(--p-text-ghost)" }} />
                <span className="text-xs font-['Fira_Code']" style={{ color: "var(--p-text-faint)" }}>#{i + 1}</span>
              </div>
              {items.length > 1 && (
                <button onClick={() => removeItem(i)} className="p-1 transition-colors" style={{ color: "var(--p-text-ghost)" }} onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-danger)"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }}>
                  <Trash2 size={12} />
                </button>
              )}
            </div>
            <input
              className="w-full rounded px-2.5 py-1.5 text-sm focus:outline-none"
              style={inputStyle}
              value={item.trigger.type === "text" ? item.trigger.text : ""}
              onChange={(e) => updateTrigger(i, e.target.value)}
              placeholder="Texto trigger"
            />
            <div className="flex gap-2">
              <input
                className="flex-1 rounded px-2.5 py-1.5 text-sm focus:outline-none"
                style={inputStyle}
                value={item.interaction.type === "emoji_binary" ? item.interaction.emojiA : ""}
                onChange={(e) => updateInteraction(i, "emojiA", e.target.value)}
                placeholder="Emoji A"
              />
              <input
                className="flex-1 rounded px-2.5 py-1.5 text-sm focus:outline-none"
                style={inputStyle}
                value={item.interaction.type === "emoji_binary" ? item.interaction.emojiB : ""}
                onChange={(e) => updateInteraction(i, "emojiB", e.target.value)}
                placeholder="Emoji B"
              />
            </div>
          </div>
        ))}
        <button
          onClick={addItem}
          className="flex items-center gap-1.5 text-xs py-1.5 transition-colors"
          style={{ color: "var(--p-text-faint)" }}
        >
          <Plus size={12} /> Agregar item
        </button>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>{label}</label>
      <div className="relative">
        <select
          className="w-full rounded-lg px-3 py-2.5 text-sm appearance-none focus:outline-none transition-colors"
          style={inputStyle}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--p-text-ghost)" }} />
      </div>
    </div>
  );
}

function ToggleField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <span className="text-sm" style={{ color: "var(--p-text)" }}>{label}</span>
        {description && <p className="text-xs mt-0.5" style={{ color: "var(--p-text-faint)" }}>{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className="w-10 h-5.5 rounded-full transition-colors relative"
        style={{ backgroundColor: value ? "var(--p-accent)" : "var(--p-border)" }}
      >
        <div
          className="w-4 h-4 rounded-full absolute top-[3px] transition-all"
          style={{
            backgroundColor: value ? "var(--p-accent-fg)" : "var(--p-text-faint)",
            right: value ? "3px" : undefined,
            left: value ? undefined : "3px",
          }}
        />
      </button>
    </div>
  );
}

// --- Type-specific field renderers ---

function TypeSpecificFields({
  data,
  onChange,
}: {
  data: Question;
  onChange: (updates: Partial<Question>) => void;
}) {
  const d = data as any;

  switch (data.type) {
    case "choice":
    case "choice_hybrid":
      return (
        <>
          <TextField label="Pregunta" value={d.text} onChange={(v) => onChange({ text: v } as any)} placeholder="Texto de la pregunta" multiline />
          <StringListField label="Opciones" values={d.options || []} onChange={(v) => onChange({ options: v } as any)} min={2} max={6} />
        </>
      );

    case "choice_emoji":
      return (
        <>
          <TextField label="Pregunta" value={d.text} onChange={(v) => onChange({ text: v } as any)} placeholder="Texto (puede quedar vacío)" multiline />
          <StringListField label="Opciones emoji" values={d.options || []} onChange={(v) => onChange({ options: v } as any)} min={2} max={3} placeholder="Emoji" />
        </>
      );

    case "slider":
      return (
        <>
          <TextField label="Pregunta" value={d.text} onChange={(v) => onChange({ text: v } as any)} multiline />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Mínimo" value={d.min ?? 0} onChange={(v) => onChange({ min: v } as any)} />
            <NumberField label="Máximo" value={d.max ?? 10} onChange={(v) => onChange({ max: v } as any)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Label izquierda" value={d.labelLeft ?? "Nada"} onChange={(v) => onChange({ labelLeft: v } as any)} />
            <TextField label="Label derecha" value={d.labelRight ?? "Totalmente"} onChange={(v) => onChange({ labelRight: v } as any)} />
          </div>
        </>
      );

    case "slider_emoji":
      return (
        <>
          <TextField label="Pregunta" value={d.text} onChange={(v) => onChange({ text: v } as any)} multiline />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Mínimo" value={d.min ?? 0} onChange={(v) => onChange({ min: v } as any)} />
            <NumberField label="Máximo" value={d.max ?? 10} onChange={(v) => onChange({ max: v } as any)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Emoji izquierda" value={d.labelLeft ?? ""} onChange={(v) => onChange({ labelLeft: v } as any)} placeholder="" />
            <TextField label="Emoji derecha" value={d.labelRight ?? ""} onChange={(v) => onChange({ labelRight: v } as any)} placeholder="😏" />
          </div>
        </>
      );

    case "confesionario":
      return (
        <>
          <TextField label="Pregunta" value={d.text} onChange={(v) => onChange({ text: v } as any)} multiline />
          <TextField
            label="Mensaje intersticial"
            value={d.interstitialMessage ?? ""}
            onChange={(v) => onChange({ interstitialMessage: v || undefined } as any)}
            placeholder="Nadie nunca va a saber lo que escribiste."
          />
        </>
      );

    case "prediction_bet":
      return (
        <>
          <TextField label="Pregunta" value={d.text} onChange={(v) => onChange({ text: v } as any)} multiline />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Opción A" value={d.optionA} onChange={(v) => onChange({ optionA: v } as any)} />
            <TextField label="Opción B" value={d.optionB} onChange={(v) => onChange({ optionB: v } as any)} />
          </div>
          <NumberField label="Max tickets" value={d.maxTickets ?? 100} onChange={(v) => onChange({ maxTickets: v } as any)} min={10} max={1000} />
        </>
      );

    case "ranking":
      return (
        <>
          <TextField label="Pregunta" value={d.text} onChange={(v) => onChange({ text: v } as any)} multiline />
          <StringListField label="Items a ordenar" values={d.options || []} onChange={(v) => onChange({ options: v } as any)} min={3} max={5} />
        </>
      );

    case "binary_media":
      return (
        <>
          <TextField label="URL imagen" value={d.imageUrl} onChange={(v) => onChange({ imageUrl: v } as any)} placeholder="https://..." />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Opción A" value={d.optionA} onChange={(v) => onChange({ optionA: v } as any)} />
            <TextField label="Opción B" value={d.optionB} onChange={(v) => onChange({ optionB: v } as any)} />
          </div>
        </>
      );

    case "hot_take":
    case "hot_take_visual":
      return (
        <>
          <TextField label="Statement" value={d.text} onChange={(v) => onChange({ text: v } as any)} multiline placeholder="El hot take que se muestra con typewriter" />
          <StringListField label="Opciones de reacción" values={d.options || []} onChange={(v) => onChange({ options: v } as any)} min={2} max={4} />
        </>
      );

    case "trap":
      return (
        <>
          <TextField label="Pregunta" value={d.text} onChange={(v) => onChange({ text: v } as any)} multiline />
          <StringListField label="Opciones" values={d.options || []} onChange={(v) => onChange({ options: v } as any)} min={2} max={4} />
          <NumberField label="Índice correcto (0-based)" value={d.correctIndex} onChange={(v) => onChange({ correctIndex: v } as any)} min={0} max={3} />
          <NumberField label="Penalidad (tickets)" value={d.penalty} onChange={(v) => onChange({ penalty: v } as any)} min={0} />
        </>
      );

    case "trap_silent":
      return (
        <>
          <TextField label="Pregunta (parece choice normal)" value={d.text} onChange={(v) => onChange({ text: v } as any)} multiline />
          <StringListField label="Opciones" values={d.options || []} onChange={(v) => onChange({ options: v } as any)} min={2} max={4} />
          <NumberField label="Índice correcto (0-based)" value={d.correctIndex} onChange={(v) => onChange({ correctIndex: v } as any)} min={0} max={3} />
          <NumberField label="Penalidad silenciosa (tickets)" value={d.penalty} onChange={(v) => onChange({ penalty: v } as any)} min={0} />
        </>
      );

    case "dead_drop":
      return (
        <>
          <TextField label="Primera línea (Silkscreen)" value={d.firstLine} onChange={(v) => onChange({ firstLine: v } as any)} mono />
          <StringListField label="Líneas de código (Fira Code)" values={d.codeLines || []} onChange={(v) => onChange({ codeLines: v } as any)} min={1} placeholder="Línea de código" />
          <StringListField label="Últimas líneas (Silkscreen)" values={d.lastLines || []} onChange={(v) => onChange({ lastLines: v } as any)} min={1} placeholder="Línea final" />
        </>
      );

    case "rafaga":
      return (
        <>
          <TextField label="Prompt" value={d.prompt} onChange={(v) => onChange({ prompt: v } as any)} />
          <TextField label="Prompt bold" value={d.promptBold} onChange={(v) => onChange({ promptBold: v } as any)} />
          <NumberField label="Segundos por item" value={d.secondsPerItem ?? 3} onChange={(v) => onChange({ secondsPerItem: v } as any)} min={1} max={10} suffix="seg" />
          <RafagaItemsField items={d.items || []} onChange={(v) => onChange({ items: v } as any)} />
        </>
      );

    case "rafaga_emoji":
      return (
        <>
          <TextField label="Prompt" value={d.prompt ?? ""} onChange={(v) => onChange({ prompt: v } as any)} />
          <TextField label="Prompt bold" value={d.promptBold} onChange={(v) => onChange({ promptBold: v } as any)} />
          <NumberField label="Segundos por item" value={d.secondsPerItem ?? 3} onChange={(v) => onChange({ secondsPerItem: v } as any)} min={1} max={10} suffix="seg" />
          <RafagaItemsField items={d.items || []} onChange={(v) => onChange({ items: v } as any)} emojiMode />
        </>
      );

    case "rafaga_burst":
      return (
        <>
          <TextField 
            label="Pre-screen title" 
            value={d.preScreen?.title ?? ""} 
            onChange={(v) => onChange({ 
              preScreen: { ...d.preScreen, title: v, subtitle: d.preScreen?.subtitle ?? "Respondé rápido", durationMs: d.preScreen?.durationMs ?? 2500 } 
            } as any)} 
            placeholder="RÁFAGA BURST" 
          />
          <TextField 
            label="Pre-screen subtitle" 
            value={d.preScreen?.subtitle ?? ""} 
            onChange={(v) => onChange({ 
              preScreen: { ...d.preScreen, title: d.preScreen?.title ?? "RÁFAGA BURST", subtitle: v, durationMs: d.preScreen?.durationMs ?? 2500 } 
            } as any)} 
            placeholder="Respondé rápido" 
          />
          <NumberField 
            label="Pre-screen duración (ms)" 
            value={d.preScreen?.durationMs ?? 2500} 
            onChange={(v) => onChange({ 
              preScreen: { ...d.preScreen, title: d.preScreen?.title ?? "RÁFAGA BURST", subtitle: d.preScreen?.subtitle ?? "Respondé rápido", durationMs: v } 
            } as any)} 
            min={1000} 
            max={5000} 
            suffix="ms" 
          />
          <NumberField label="Segundos por item" value={d.secondsPerItem ?? 3} onChange={(v) => onChange({ secondsPerItem: v } as any)} min={1} max={10} suffix="seg" />
          <RafagaBurstItemsField items={d.items || []} onChange={(v) => onChange({ items: v } as any)} />
        </>
      );

    case "media_reaction":
      return (
        <>
          <TextField label="URL imagen" value={d.imageUrl} onChange={(v) => onChange({ imageUrl: v } as any)} placeholder="https://..." />
          <TextField label="Texto overlay" value={d.text ?? ""} onChange={(v) => onChange({ text: v || undefined } as any)} />
          <SelectField
            label="Modo"
            value={d.mode}
            onChange={(v) => onChange({ mode: v } as any)}
            options={[
              { value: "emoji", label: "Emoji (2 botones)" },
              { value: "slider", label: "Slider emoji" },
            ]}
          />
          {d.mode === "emoji" ? (
            <StringListField label="Opciones emoji" values={d.options || ["😍", "🤮"]} onChange={(v) => onChange({ options: v } as any)} min={2} max={2} placeholder="Emoji" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Emoji izquierda" value={d.labelLeft ?? ""} onChange={(v) => onChange({ labelLeft: v } as any)} placeholder="🤮" />
                <TextField label="Emoji derecha" value={d.labelRight ?? ""} onChange={(v) => onChange({ labelRight: v } as any)} placeholder="😍" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Mínimo" value={d.min ?? 0} onChange={(v) => onChange({ min: v } as any)} />
                <NumberField label="Máximo" value={d.max ?? 10} onChange={(v) => onChange({ max: v } as any)} />
              </div>
            </>
          )}
        </>
      );

    default:
      return <p className="text-sm" style={{ color: "var(--p-text-faint)" }}>Tipo de pregunta no reconocido.</p>;
  }
}

// --- Meta fields (common to all questions) ---

function MetaFields({
  data,
  onChange,
  label,
  onLabelChange,
  tags,
  onTagsChange,
}: {
  data: Question;
  onChange: (updates: Partial<Question>) => void;
  label: string;
  onLabelChange: (v: string) => void;
  tags: string[];
  onTagsChange: (v: string[]) => void;
}) {
  const [showReward, setShowReward] = useState(!!data.reward);
  const [showResult, setShowResult] = useState(!!data.result);
  const [segments, setSegments] = useState<{ segmentId: string; name: string }[]>([]);

  // Fetch segments once
  useEffect(() => {
    const API_BASE = "";
    fetch(`${API_BASE}/admin/segments`, {
      headers: { "Content-Type": "application/json", "X-Panel-Token": sessionStorage.getItem("brutal_panel_token") || "" },
    })
      .then((r) => r.ok ? r.json() : { segments: [] })
      .then((d) => setSegments(d.segments || []))
      .catch(() => {});
  }, []);

  const currentSegmentIds = (data as any).segmentIds || [];

  // FIXED TAREA 3: Corregido el bug de selección múltiple
  const toggleSegment = (id: string) => {
    let nextArr: string[];
    if (currentSegmentIds.includes(id)) {
      nextArr = currentSegmentIds.filter((sid: string) => sid !== id);
    } else {
      nextArr = [...currentSegmentIds, id];
    }
    onChange({ segmentIds: nextArr.length > 0 ? nextArr : undefined } as any);
  };

  const sectionBorder: React.CSSProperties = { borderBottom: "1px solid var(--p-border-subtle)" };
  const sectionLabel: React.CSSProperties = { color: "var(--p-text-faint)" };

  return (
    <div className="flex flex-col gap-4">
      <div className="pb-3 mb-1" style={sectionBorder}>
        <span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5" style={sectionLabel}>
          <Tag size={12} /> Admin
        </span>
      </div>
      <TextField label="Etiqueta interna" value={label} onChange={onLabelChange} placeholder="Nombre para identificar esta pregunta" />
      <TextField
        label="Tags (separados por coma)"
        value={tags.join(", ")}
        onChange={(v) => onTagsChange(v.split(",").map((t) => t.trim()).filter(Boolean))}
        placeholder="cultura, sexo, brand"
      />

      <div className="pb-3 mb-1 mt-2" style={sectionBorder}>
        <span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5" style={sectionLabel}>
          ⏱ Timer & Mecánicas
        </span>
      </div>
      <NumberField label="Timer (segundos)" value={data.timer} onChange={(v) => onChange({ timer: v })} min={0} max={120} suffix="seg" />
      <TextField label="Signal Pair ID" value={(data as any).signalPairId ?? ""} onChange={(v) => onChange({ signalPairId: v || undefined } as any)} placeholder="Opcional: vincula 2 cartas" />
      <SelectField
        label="Card Type"
        value={(data as any).cardType ?? ""}
        onChange={(v) => onChange({ cardType: v || undefined } as any)}
        options={[
          { value: "", label: "Auto-detect" },
          { value: "brand", label: "Brand" },
          { value: "culture", label: "Culture" },
          { value: "trap", label: "Trap" },
          { value: "dead_drop", label: "Dead Drop" },
        ]}
      />

      <div className="pb-3 mb-1 mt-2" style={sectionBorder}>
        <span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5" style={sectionLabel}>
          <Gift size={12} /> Reward
        </span>
      </div>
      <ToggleField label="Tiene reward" description="Dar coins o tickets al responder" value={showReward} onChange={(v) => {
        setShowReward(v);
        if (!v) onChange({ reward: undefined } as any);
        else onChange({ reward: { type: "coins", value: 0.5 } } as any);
      }} />
      {showReward && data.reward && (
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Tipo"
            value={data.reward.type}
            onChange={(v) => onChange({ reward: { ...data.reward!, type: v as "coins" | "tickets" } } as any)}
            options={[
              { value: "coins", label: "Coins" },
              { value: "tickets", label: "Tickets" },
            ]}
          />
          <NumberField label="Valor" value={data.reward.value} onChange={(v) => onChange({ reward: { ...data.reward!, value: v } } as any)} min={0} step={0.5} />
        </div>
      )}

      <div className="pb-3 mb-1 mt-2" style={sectionBorder}>
        <span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5" style={sectionLabel}>
          <BarChart3 size={12} /> Result card
        </span>
      </div>
      <ToggleField label="Mostrar Result card" description="Pantalla de porcentaje después de responder" value={showResult} onChange={(v) => {
        setShowResult(v);
        if (!v) onChange({ result: undefined } as any);
        else onChange({ result: { percentage: 50, text: "Opina igual que vos." } } as any);
      }} />
      {showResult && data.result && (
        <div className="flex flex-col gap-3">
          <NumberField label="Porcentaje" value={data.result.percentage} onChange={(v) => onChange({ result: { ...data.result!, percentage: v } } as any)} min={0} max={100} suffix="%" />
          <TextField label="Texto" value={data.result.text} onChange={(v) => onChange({ result: { ...data.result!, text: v } } as any)} placeholder="Opina igual que vos." />
        </div>
      )}

      <div className="pb-3 mb-1 mt-2" style={sectionBorder}>
        <span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5" style={sectionLabel}>
          🎯 Segmento
        </span>
      </div>
      <p className="text-[10px]" style={{ color: "var(--p-text-ghost)" }}>
        Sin segmento = todos los nodos activos reciben esta pregunta.
      </p>
      {segments.length === 0 ? (
        <p className="text-[11px] italic" style={{ color: "var(--p-text-ghost)" }}>No hay segmentos creados. Crealos desde Nodos.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {segments.map((seg) => {
            const isSelected = currentSegmentIds.includes(seg.segmentId);
            return (
              <button
                key={seg.segmentId}
                type="button"
                onClick={() => toggleSegment(seg.segmentId)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  isSelected
                    ? "bg-purple-500/15 border border-purple-500/30 text-purple-300"
                    : ""
                }`}
                style={!isSelected ? {
                  backgroundColor: "var(--p-bg-hover)",
                  border: "1px solid var(--p-border-subtle)",
                  color: "var(--p-text-muted)",
                } : undefined}
              >
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                  isSelected ? "bg-purple-500 border-purple-500" : ""
                }`}
                style={!isSelected ? { borderColor: "var(--p-text-ghost)" } : undefined}
                >
                  {isSelected && <span className="text-[8px] text-white font-bold">✓</span>}
                </div>
                {seg.name}
              </button>
            );
          })}
        </div>
      )}
      {currentSegmentIds.length > 0 && (
        <button
          type="button"
          onClick={() => onChange({ segmentIds: undefined } as any)}
          className="text-[10px] transition-colors text-left"
          style={{ color: "var(--p-text-faint)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-danger)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-faint)"; }}
        >
          Quitar segmentos (mostrar a todos)
        </button>
      )}
    </div>
  );
}

// --- Main Builder Component ---

interface QuestionBuilderProps {
  editId?: string | null;
  onSaved: (q: PanelQuestion) => void;
  onCancel: () => void;
}

export function QuestionBuilder({ editId, onSaved, onCancel }: QuestionBuilderProps) {
  const [selectedType, setSelectedType] = useState<QuestionType>("choice");
  const [data, setData] = useState<Question>(getDefaultQuestionData("choice"));
  const [label, setLabel] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [showTypeSelector, setShowTypeSelector] = useState(!editId);

  // Load existing question if editing
  useEffect(() => {
    if (editId) {
      const existing = getQuestionById(editId);
      if (existing) {
        setSelectedType(existing.data.type);
        setData({ ...existing.data });
        setLabel(existing.label);
        setTags([...existing.tags]);
        setShowTypeSelector(false);
      }
    }
  }, [editId]);

  const handleTypeChange = useCallback((type: QuestionType) => {
    setSelectedType(type);
    setData(getDefaultQuestionData(type));
    setShowTypeSelector(false);
  }, []);

  const handleDataChange = useCallback((updates: Partial<Question>) => {
    setData((prev) => ({ ...prev, ...updates } as Question));
  }, []);

  const handleSave = useCallback(() => {
    let saved: PanelQuestion | null;
    if (editId) {
      saved = updateQuestion(editId, data, label, tags);
    } else {
      saved = createQuestion(data, label || undefined, tags);
    }
    if (saved) onSaved(saved);
  }, [editId, data, label, tags, onSaved]);

  // --- Type selector grid ---
  if (showTypeSelector) {
    return (
      <div className="flex flex-col gap-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 transition-colors" style={{ color: "var(--p-text-faint)" }} onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-text)"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-faint)"; }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--p-text)" }}>Elegí el tipo de carta</h2>
            <p className="text-xs" style={{ color: "var(--p-text-faint)" }}>Cada tipo despliega sus campos específicos</p>
          </div>
        </div>

        {Object.entries(QUESTION_TYPE_CATEGORIES).map(([catKey, cat]) => (
          <div key={catKey}>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--p-text-ghost)" }}>{cat.label}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {cat.types.map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  className="flex flex-col items-start gap-1 rounded-lg p-3 transition-all text-left group"
                  style={{
                    backgroundColor: "var(--p-bg-input)",
                    border: "1px solid var(--p-border-subtle)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--p-border)"; e.currentTarget.style.backgroundColor = "var(--p-bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--p-border-subtle)"; e.currentTarget.style.backgroundColor = "var(--p-bg-input)"; }}
                >
                  <span className="text-lg">{QUESTION_TYPE_ICONS[type]}</span>
                  <span className="text-sm font-medium" style={{ color: "var(--p-text)" }}>{QUESTION_TYPE_LABELS[type]}</span>
                  <span className="text-[10px] font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>{type}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // --- Builder form ---
  return (
    <div className="flex flex-col gap-0 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 z-10 pb-4" style={{ backgroundColor: "var(--p-bg)" }}>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 transition-colors" style={{ color: "var(--p-text-faint)" }} onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-text)"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-faint)"; }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--p-text)" }}>
              <span className="text-lg">{QUESTION_TYPE_ICONS[selectedType]}</span>
              {QUESTION_TYPE_LABELS[selectedType]}
            </h2>
            <p className="text-xs font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>{editId ? "Editando" : "Nueva"} · {selectedType}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!editId && (
            <button
              onClick={() => setShowTypeSelector(true)}
              className="px-3 py-1.5 text-xs rounded-lg transition-colors"
              style={{ color: "var(--p-text-muted)", border: "1px solid var(--p-border)" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--p-text-ghost)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--p-border)"; }}
            >
              Cambiar tipo
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold rounded-lg transition-colors"
            style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}
          >
            <Save size={14} />
            Guardar
          </button>
        </div>
      </div>

      {/* Two-column layout: content + meta */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Main content fields */}
        <div className="lg:col-span-3 flex flex-col gap-4 rounded-xl p-5" style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}>
          <span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--p-text-faint)" }}>
            <Link2 size={12} /> Contenido
          </span>
          <TypeSpecificFields data={data} onChange={handleDataChange} />
        </div>

        {/* Meta / sidebar */}
        <div className="lg:col-span-2 rounded-xl p-5" style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}>
          <MetaFields
            data={data}
            onChange={handleDataChange}
            label={label}
            onLabelChange={setLabel}
            tags={tags}
            onTagsChange={setTags}
          />
        </div>
      </div>
    </div>
  );
}
