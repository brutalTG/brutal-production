// ============================================================
// QUESTION LIBRARY — Filterable grid of all questions
// Migrated to CSS variables var(--p-*) for light/dark theming
// ============================================================

import { useState, useMemo, useCallback } from "react";
import {
  Plus,
  Search,
  Copy,
  Trash2,
  Filter,
  X,
  CheckSquare,
  Square,
  ArrowUpDown,
  Pencil,
} from "lucide-react";
import {
  type PanelQuestion,
  type PanelDrop,
  type QuestionType,
  getQuestions,
  getDrops,
  deleteQuestion,
  duplicateQuestion,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_ICONS,
} from "./panel-store";

// --- Sort criteria ---
type SortField = "date" | "type" | "drop" | "active";
type SortDir = "asc" | "desc";

interface QuestionLibraryProps {
  onCreateNew: () => void;
  onEdit: (id: string) => void;
  /** If in "pick mode", call this to add questions to a drop */
  onPick?: (ids: string[]) => void;
  pickMode?: boolean;
}

// Helper: build question→drop membership map
function buildQuestionDropMap(drops: PanelDrop[]): Map<string, { dropName: string; dropId: string; isActive: boolean; isDisabled: boolean }[]> {
  const map = new Map<string, { dropName: string; dropId: string; isActive: boolean; isDisabled: boolean }[]>();
  for (const drop of drops) {
    const disabledSet = new Set(drop.disabledQuestionIds || []);
    for (const qId of drop.questionIds) {
      const existing = map.get(qId) || [];
      existing.push({
        dropName: drop.name,
        dropId: drop.id,
        isActive: drop.status === "active",
        isDisabled: disabledSet.has(qId),
      });
      map.set(qId, existing);
    }
  }
  return map;
}

export function QuestionLibrary({ onCreateNew, onEdit, onPick, pickMode }: QuestionLibraryProps) {
  const [questions, setQuestions] = useState<PanelQuestion[]>(getQuestions);
  const [drops, setDrops] = useState<PanelDrop[]>(getDrops);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<QuestionType | "">("");
  const [tagFilter, setTagFilter] = useState("");
  const [dropFilter, setDropFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"" | "enabled" | "disabled" | "has_segment">("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const refresh = useCallback(() => {
    setQuestions(getQuestions());
    setDrops(getDrops());
  }, []);

  const questionDropMap = useMemo(() => buildQuestionDropMap(drops), [drops]);
  const activeDrop = useMemo(() => drops.find((d) => d.status === "active"), [drops]);

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (typeFilter && q.data.type !== typeFilter) return false;
      if (tagFilter && !q.tags.some((t) => t.toLowerCase().includes(tagFilter.toLowerCase()))) return false;
      if (dropFilter) {
        const memberships = questionDropMap.get(q.id) || [];
        if (dropFilter === "active") {
          if (!memberships.some((m) => m.isActive)) return false;
        } else if (dropFilter === "unassigned") {
          if (memberships.length > 0) return false;
        } else {
          if (!memberships.some((m) => m.dropId === dropFilter)) return false;
        }
      }
      if (search) {
        const s = search.toLowerCase();
        const text = ("text" in q.data ? (q.data as any).text : "") || "";
        if (
          !q.label.toLowerCase().includes(s) &&
          !text.toLowerCase().includes(s) &&
          !q.data.type.toLowerCase().includes(s) &&
          !q.tags.some((t) => t.toLowerCase().includes(s))
        )
          return false;
      }
      if (statusFilter) {
        const memberships = questionDropMap.get(q.id) || [];
        if (statusFilter === "enabled") {
          if (!memberships.some((m) => m.isActive && !m.isDisabled)) return false;
        } else if (statusFilter === "disabled") {
          if (!memberships.some((m) => m.isActive && m.isDisabled)) return false;
        } else if (statusFilter === "has_segment") {
          if (!q.data.segmentIds || q.data.segmentIds.length === 0) return false;
        }
      }
      return true;
    });
  }, [questions, search, typeFilter, tagFilter, dropFilter, questionDropMap, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortField) {
        case "type":
          return dir * a.data.type.localeCompare(b.data.type);
        case "active": {
          const aActive = (questionDropMap.get(a.id) || []).some((m) => m.isActive) ? 1 : 0;
          const bActive = (questionDropMap.get(b.id) || []).some((m) => m.isActive) ? 1 : 0;
          return dir * (bActive - aActive);
        }
        case "drop": {
          const aDrops = (questionDropMap.get(a.id) || []).map((m) => m.dropName).join(",");
          const bDrops = (questionDropMap.get(b.id) || []).map((m) => m.dropName).join(",");
          return dir * aDrops.localeCompare(bDrops);
        }
        case "date":
        default:
          return dir * (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      }
    });
    return arr;
  }, [filtered, sortField, sortDir, questionDropMap]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === sorted.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((q) => q.id)));
    }
  };

  const handleDelete = (id: string) => {
    deleteQuestion(id);
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    refresh();
  };

  const handleDuplicate = (id: string) => {
    duplicateQuestion(id);
    refresh();
  };

  const handleBulkDelete = () => {
    selected.forEach((id) => deleteQuestion(id));
    setSelected(new Set());
    refresh();
  };

  const allTags = useMemo(() => {
    const s = new Set<string>();
    questions.forEach((q) => q.tags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [questions]);

  const presentTypes = useMemo(() => {
    const s = new Set<QuestionType>();
    questions.forEach((q) => s.add(q.data.type));
    return Array.from(s);
  }, [questions]);

  const activeFilterCount = [typeFilter, tagFilter, dropFilter, statusFilter].filter(Boolean).length;

  // Shared input style
  const selectStyle: React.CSSProperties = {
    backgroundColor: "var(--p-bg-hover)",
    border: "1px solid var(--p-border-subtle)",
    color: "var(--p-text)",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "var(--p-text)" }}>Preguntas</h2>
          <p className="text-xs" style={{ color: "var(--p-text-faint)" }}>{questions.length} preguntas · {sorted.length} visibles</p>
        </div>
        <div className="flex gap-2">
          {pickMode && selected.size > 0 && onPick && (
            <button
              onClick={() => { onPick(Array.from(selected)); setSelected(new Set()); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg transition-colors"
              style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}
            >
              <Plus size={14} /> Agregar {selected.size} al drop
            </button>
          )}
          {!pickMode && selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors"
              style={{ color: "var(--p-danger)", border: "1px solid color-mix(in srgb, var(--p-danger) 30%, transparent)" }}
            >
              <Trash2 size={14} /> Eliminar ({selected.size})
            </button>
          )}
          <button
            onClick={onCreateNew}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg transition-colors"
            style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}
          >
            <Plus size={14} /> Nueva pregunta
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--p-text-ghost)" }} />
            <input
              className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none transition-colors"
              style={{
                backgroundColor: "var(--p-bg-input)",
                border: "1px solid var(--p-border-subtle)",
                color: "var(--p-text)",
              }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por texto, tipo, tag..."
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "var(--p-text-ghost)" }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-2 border rounded-lg text-sm transition-colors relative"
            style={{
              backgroundColor: showFilters ? "var(--p-accent)" : "transparent",
              color: showFilters ? "var(--p-accent-fg)" : "var(--p-text-muted)",
              borderColor: showFilters ? "var(--p-accent)" : "var(--p-border)",
            }}
          >
            <Filter size={14} />
            {activeFilterCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 w-4 h-4 text-[9px] font-bold rounded-full flex items-center justify-center"
                style={{ backgroundColor: "var(--p-success)", color: "var(--p-accent-fg)" }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div
            className="flex gap-2 flex-wrap rounded-lg p-3"
            style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}
          >
            <select className="rounded px-2.5 py-1.5 text-xs focus:outline-none" style={selectStyle} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as QuestionType | "")}>
              <option value="">Todos los tipos</option>
              {presentTypes.map((t) => (
                <option key={t} value={t}>{QUESTION_TYPE_ICONS[t]} {QUESTION_TYPE_LABELS[t]}</option>
              ))}
            </select>
            <select className="rounded px-2.5 py-1.5 text-xs focus:outline-none" style={selectStyle} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
              <option value="">Todos los tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select className="rounded px-2.5 py-1.5 text-xs focus:outline-none" style={selectStyle} value={dropFilter} onChange={(e) => setDropFilter(e.target.value)}>
              <option value="">Todos los drops</option>
              <option value="active">En drop activo</option>
              <option value="unassigned">Sin asignar</option>
              {drops.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.status === "active" ? "● " : ""}{d.name}
                </option>
              ))}
            </select>
            <select className="rounded px-2.5 py-1.5 text-xs focus:outline-none" style={selectStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | "enabled" | "disabled" | "has_segment")}>
              <option value="">Todos los estados</option>
              <option value="enabled">Habilitado</option>
              <option value="disabled">Deshabilitado</option>
              <option value="has_segment">Con segmento</option>
            </select>
            {(typeFilter || tagFilter || dropFilter || statusFilter) && (
              <button
                onClick={() => { setTypeFilter(""); setTagFilter(""); setDropFilter(""); setStatusFilter(""); }}
                className="text-xs flex items-center gap-1 transition-colors"
                style={{ color: "var(--p-text-muted)" }}
              >
                <X size={12} /> Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sort bar */}
      <div className="flex items-center gap-1 pb-1" style={{ borderBottom: "1px solid var(--p-border-subtle)" }}>
        <button onClick={selectAll} className="transition-colors mr-2" style={{ color: "var(--p-text-faint)" }}>
          {selected.size === sorted.length && sorted.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
        {selected.size > 0 && (
          <span className="text-xs mr-3" style={{ color: "var(--p-text-faint)" }}>{selected.size} sel.</span>
        )}
        <span className="text-[10px] uppercase tracking-wider mr-2" style={{ color: "var(--p-text-ghost)" }}>Ordenar:</span>
        {([
          { field: "date" as SortField, label: "Fecha" },
          { field: "type" as SortField, label: "Tipo" },
          { field: "active" as SortField, label: "Activo" },
          { field: "drop" as SortField, label: "Drop" },
        ]).map(({ field, label }) => (
          <button
            key={field}
            onClick={() => toggleSort(field)}
            className="flex items-center gap-0.5 px-2 py-1 rounded text-[10px] uppercase tracking-wider transition-colors"
            style={{
              backgroundColor: sortField === field ? "var(--p-bg-active)" : "transparent",
              color: sortField === field ? "var(--p-text)" : "var(--p-text-ghost)",
            }}
          >
            {label}
            {sortField === field && (
              <ArrowUpDown size={9} className={sortDir === "desc" ? "rotate-180" : ""} />
            )}
          </button>
        ))}
      </div>

      {/* Question cards */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm mb-3" style={{ color: "var(--p-text-ghost)" }}>
            {questions.length === 0 ? "No hay preguntas todavía" : "No se encontraron resultados"}
          </p>
          {questions.length === 0 && (
            <button
              onClick={onCreateNew}
              className="px-4 py-2 text-sm font-bold rounded-lg transition-colors"
              style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}
            >
              Crear primera pregunta
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {sorted.map((q) => {
            const isSelected = selected.has(q.id);
            const text = "text" in q.data ? (q.data as any).text : "";
            const preview = text?.slice(0, 80) || "(sin texto)";
            const memberships = questionDropMap.get(q.id) || [];
            const isInActiveDrop = memberships.some((m) => m.isActive);
            const isDisabledInActiveDrop = memberships.some((m) => m.isActive && m.isDisabled);
            const isActiveAndEnabled = isInActiveDrop && !isDisabledInActiveDrop;

            return (
              <div
                key={q.id}
                className="flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer group"
                style={{
                  backgroundColor: isSelected
                    ? "var(--p-bg-hover)"
                    : isDisabledInActiveDrop
                    ? "color-mix(in srgb, var(--p-danger) 5%, var(--p-bg-card))"
                    : isActiveAndEnabled
                    ? "color-mix(in srgb, var(--p-success) 5%, var(--p-bg-card))"
                    : "var(--p-bg-card)",
                  border: `1px solid ${
                    isSelected
                      ? "var(--p-border)"
                      : "var(--p-border-subtle)"
                  }`,
                }}
                onClick={() => pickMode ? toggleSelect(q.id) : undefined}
              >
                {/* Select checkbox */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelect(q.id); }}
                  className="mt-0.5 transition-colors shrink-0"
                  style={{ color: "var(--p-text-ghost)" }}
                >
                  {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>

                {/* Type icon */}
                <div className="text-lg shrink-0 mt-0.5">{QUESTION_TYPE_ICONS[q.data.type]}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>{QUESTION_TYPE_LABELS[q.data.type]}</span>

                    {/* STATUS BADGES */}
                    {isActiveAndEnabled && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest"
                        style={{
                          background: "#0f0",
                          color: "#000",
                          boxShadow: "0 0 6px #0f0, 0 0 12px rgba(0,255,0,0.4)",
                          textShadow: "0 0 2px rgba(0,255,0,0.5)",
                        }}
                      >
                        ACTIVO
                      </span>
                    )}
                    {isDisabledInActiveDrop && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest"
                        style={{
                          background: "#f50",
                          color: "#000",
                          boxShadow: "0 0 6px #f50, 0 0 12px rgba(255,85,0,0.4)",
                        }}
                      >
                        DISABLED
                      </span>
                    )}

                    {/* Segment badges */}
                    {q.data.segmentIds && q.data.segmentIds.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                        {q.data.segmentIds.length} seg
                      </span>
                    )}

                    {q.data.reward && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--p-bg-active)", color: "var(--p-text-muted)" }}>
                        {q.data.reward.type === "coins" ? "🪙" : "🎟️"} {q.data.reward.value}
                      </span>
                    )}
                    {q.data.result && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--p-bg-active)", color: "var(--p-text-muted)" }}>📊 {q.data.result.percentage}%</span>
                    )}
                    <span className="text-[10px]" style={{ color: "var(--p-text-ghost)" }}>⏱ {q.data.timer}s</span>
                  </div>
                  <p className="text-sm truncate" style={{ color: "var(--p-text)" }}>{q.label}</p>
                  {preview !== q.label && (
                    <p className="text-xs truncate mt-0.5" style={{ color: "var(--p-text-ghost)" }}>{preview}</p>
                  )}

                  {/* Drop memberships + tags row */}
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {memberships.map((m) => (
                      <span
                        key={m.dropId}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          m.isActive && !m.isDisabled
                            ? "bg-green-500/15 text-green-400 border border-green-500/30"
                            : m.isActive && m.isDisabled
                            ? "bg-orange-500/15 text-orange-400 border border-orange-500/30 line-through"
                            : ""
                        }`}
                        style={
                          !(m.isActive)
                            ? { backgroundColor: "var(--p-bg-hover)", color: "var(--p-text-faint)", border: "1px solid var(--p-border-subtle)" }
                            : undefined
                        }
                      >
                        {m.isActive && !m.isDisabled ? "●" : m.isActive && m.isDisabled ? "⊘" : "○"} {m.dropName}
                      </span>
                    ))}
                    {memberships.length === 0 && (
                      <span className="text-[10px] italic" style={{ color: "var(--p-text-ghost)" }}>sin drop</span>
                    )}
                    {q.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: "var(--p-bg-hover)", color: "var(--p-text-faint)" }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions — Edit button always visible, rest on hover */}
                <div className="flex gap-1 shrink-0 items-start">
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(q.id); }}
                    className="p-1.5 transition-colors rounded"
                    style={{ color: "var(--p-success)", backgroundColor: "color-mix(in srgb, var(--p-success) 5%, transparent)" }}
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDuplicate(q.id); }}
                      className="p-1.5 transition-colors"
                      style={{ color: "var(--p-text-ghost)" }}
                      title="Duplicar"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }}
                      className="p-1.5 transition-colors"
                      style={{ color: "var(--p-text-ghost)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-danger)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }}
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
