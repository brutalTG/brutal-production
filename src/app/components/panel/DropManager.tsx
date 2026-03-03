// ============================================================
// DROP MANAGER — List, create, import, manage drops
// Migrated to CSS variables var(--p-*) for light/dark theming
// ============================================================

import { useState, useCallback, useRef } from "react";
import {
  Plus,
  Play,
  Archive,
  FileText,
  Trash2,
  Copy,
  Upload,
  Edit3,
} from "lucide-react";
import {
  type PanelDrop,
  getDrops,
  createDrop,
  deleteDrop,
  duplicateDrop,
  activateDrop,
  updateDrop,
  importDropJSON,
} from "./panel-store";
import type { Drop } from "../drop-types";

interface DropManagerProps {
  onEditDrop: (id: string) => void;
}

export function DropManager({ onEditDrop }: DropManagerProps) {
  const [drops, setDrops] = useState<PanelDrop[]>(getDrops);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => setDrops(getDrops()), []);

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;
    const d = createDrop(newName.trim());
    setNewName("");
    setShowCreate(false);
    refresh();
    onEditDrop(d.id);
  }, [newName, refresh, onEditDrop]);

  const handleDelete = useCallback((id: string) => {
    deleteDrop(id);
    refresh();
  }, [refresh]);

  const handleDuplicate = useCallback((id: string) => {
    duplicateDrop(id);
    refresh();
  }, [refresh]);

  const handleActivate = useCallback((id: string) => {
    activateDrop(id);
    refresh();
  }, [refresh]);

  const handleArchive = useCallback((id: string) => {
    updateDrop(id, { status: "archived" });
    refresh();
  }, [refresh]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string) as Drop;
        importDropJSON(json);
        refresh();
      } catch (err) {
        console.error("[Panel] Import error:", err);
        alert("Error al importar: JSON inválido");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = "";
  }, [refresh]);

  const activeDrop = drops.find((d) => d.status === "active");
  const draftDrops = drops.filter((d) => d.status === "draft");
  const archivedDrops = drops.filter((d) => d.status === "archived");

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "var(--p-text)" }}>Drops</h2>
          <p className="text-xs" style={{ color: "var(--p-text-faint)" }}>{drops.length} drops</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
          <button
            onClick={handleImport}
            className="flex items-center gap-1.5 px-3 py-2 border text-xs rounded-lg transition-colors"
            style={{ borderColor: "var(--p-border)", color: "var(--p-text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--p-text-ghost)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--p-border)"; }}
          >
            <Upload size={12} /> Importar JSON
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg transition-colors"
            style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}
          >
            <Plus size={14} /> Nuevo drop
          </button>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}
        >
          <FileText size={16} style={{ color: "var(--p-text-ghost)" }} className="shrink-0" />
          <input
            className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: "var(--p-bg-hover)",
              border: "1px solid var(--p-border-subtle)",
              color: "var(--p-text)",
            }}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del nuevo drop"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
          />
          <button
            onClick={handleCreate}
            className="px-4 py-2 text-sm font-bold rounded-lg transition-colors"
            style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}
          >
            Crear
          </button>
          <button
            onClick={() => setShowCreate(false)}
            className="px-3 py-2 text-sm transition-colors"
            style={{ color: "var(--p-text-faint)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-faint)"; }}
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Active drop */}
      {activeDrop && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: "var(--p-success)" }}>
            <Play size={10} fill="currentColor" /> Activo
          </h3>
          <DropCard drop={activeDrop} onEdit={onEditDrop} onDelete={handleDelete} onDuplicate={handleDuplicate} onActivate={handleActivate} onArchive={handleArchive} />
        </div>
      )}

      {/* Draft drops */}
      {draftDrops.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--p-warning)" }}>Borradores</h3>
          <div className="flex flex-col gap-1.5">
            {draftDrops.map((d) => (
              <DropCard key={d.id} drop={d} onEdit={onEditDrop} onDelete={handleDelete} onDuplicate={handleDuplicate} onActivate={handleActivate} onArchive={handleArchive} />
            ))}
          </div>
        </div>
      )}

      {/* Archived */}
      {archivedDrops.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--p-text-ghost)" }}>Archivados</h3>
          <div className="flex flex-col gap-1.5">
            {archivedDrops.map((d) => (
              <DropCard key={d.id} drop={d} onEdit={onEditDrop} onDelete={handleDelete} onDuplicate={handleDuplicate} onActivate={handleActivate} onArchive={handleArchive} />
            ))}
          </div>
        </div>
      )}

      {drops.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-16 border border-dashed rounded-xl"
          style={{ borderColor: "var(--p-border-subtle)" }}
        >
          <p className="text-sm mb-3" style={{ color: "var(--p-text-ghost)" }}>No hay drops todavía</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm font-bold rounded-lg transition-colors"
            style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}
          >
            Crear primer drop
          </button>
        </div>
      )}
    </div>
  );
}

// --- Drop Card ---

function DropCard({
  drop,
  onEdit,
  onDelete,
  onDuplicate,
  onActivate,
  onArchive,
}: {
  drop: PanelDrop;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onActivate: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg transition-all group"
      style={{
        backgroundColor: "var(--p-bg-card)",
        border: "1px solid var(--p-border-subtle)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--p-border)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--p-border-subtle)"; }}
    >
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(drop.id)}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-bold" style={{ color: "var(--p-text)" }}>{drop.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
            drop.status === "active" ? "bg-green-500/20 text-green-400" :
            drop.status === "archived" ? "text-[#555]" :
            "bg-yellow-500/20 text-yellow-400"
          }`}
          style={drop.status === "archived" ? { backgroundColor: "var(--p-bg-active)", color: "var(--p-text-ghost)" } : undefined}
          >
            {drop.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--p-text-ghost)" }}>
          <span className="font-['Fira_Code']">{drop.dropId}</span>
          <span>{drop.questionIds.length} cartas</span>
          <span>{new Date(drop.updatedAt).toLocaleDateString("es-AR")}</span>
        </div>
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => onEdit(drop.id)} className="p-1.5 transition-colors" style={{ color: "var(--p-text-ghost)" }} onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-text)"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }} title="Editar">
          <Edit3 size={13} />
        </button>
        <button onClick={() => onDuplicate(drop.id)} className="p-1.5 transition-colors" style={{ color: "var(--p-text-ghost)" }} onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-text)"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }} title="Duplicar">
          <Copy size={13} />
        </button>
        {drop.status !== "active" && (
          <button onClick={() => onActivate(drop.id)} className="p-1.5 transition-colors" style={{ color: "var(--p-text-ghost)" }} onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-success)"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }} title="Activar">
            <Play size={13} />
          </button>
        )}
        {drop.status !== "archived" && (
          <button onClick={() => onArchive(drop.id)} className="p-1.5 transition-colors" style={{ color: "var(--p-text-ghost)" }} onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-warning)"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }} title="Archivar">
            <Archive size={13} />
          </button>
        )}
        <button onClick={() => onDelete(drop.id)} className="p-1.5 transition-colors" style={{ color: "var(--p-text-ghost)" }} onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-danger)"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }} title="Eliminar">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
