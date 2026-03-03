// ============================================================
// DROP SEGMENT SELECTOR — Assign segments to restrict drop access
// Migrated to CSS variables var(--p-*) for light/dark theming
// ============================================================

import { useState, useEffect } from "react";
import { Users, Loader2, X, AlertTriangle } from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const API_BASE = "";

interface SegmentOption {
  segmentId: string;
  name: string;
  matchingCount: number;
}

interface DropSegmentSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function DropSegmentSelector({ selectedIds, onChange }: DropSegmentSelectorProps) {
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/admin/segments`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${publicAnonKey}`,
      },
    })
      .then((r) => r.json())
      .then((data) => setSegments(data.segments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleSegment = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider mt-2 flex items-center gap-1.5" style={{ color: "var(--p-text-faint)" }}>
        <Users size={12} /> Restriccion por segmento
      </h4>
      <p className="text-xs mt-1 mb-3" style={{ color: "var(--p-text-ghost)" }}>
        Si seleccionas segmentos, solo los nodos en esos segmentos podran ver este drop.
        Sin segmentos = todos los nodos activos.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--p-text-ghost)" }}>
          <Loader2 size={12} className="animate-spin" /> Cargando segmentos...
        </div>
      ) : segments.length === 0 ? (
        <p className="text-[11px]" style={{ color: "var(--p-text-ghost)" }}>
          No hay segmentos creados. Crea segmentos en la pestaña Nodos.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {segments.map((seg) => {
            const isSelected = selectedIds.includes(seg.segmentId);
            return (
              <button
                key={seg.segmentId}
                onClick={() => toggleSegment(seg.segmentId)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                  isSelected
                    ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
                    : ""
                }`}
                style={!isSelected ? {
                  backgroundColor: "var(--p-bg-hover)",
                  borderColor: "var(--p-border-subtle)",
                  color: "var(--p-text-muted)",
                } : undefined}
              >
                {seg.name}
                <span className="ml-1 text-[9px] opacity-60">({seg.matchingCount})</span>
              </button>
            );
          })}
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] text-purple-400">
            <AlertTriangle size={10} />
            Drop restringido a {selectedIds.length} segmento{selectedIds.length !== 1 ? "s" : ""}
          </div>
          <button
            onClick={() => onChange([])}
            className="text-[10px] flex items-center gap-0.5 transition-colors"
            style={{ color: "var(--p-text-faint)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-danger)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-faint)"; }}
          >
            <X size={10} /> Quitar todos
          </button>
        </div>
      )}
    </div>
  );
}
