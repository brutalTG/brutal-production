// ============================================================
// DASHBOARD — Overview stats + quick actions
// ============================================================

import { useState, useEffect } from "react";
import {
  BarChart3,
  Users,
  Clock,
  Zap,
  FileText,
  Activity,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { getQuestions, getDrops } from "./panel-store";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-c68eb08c`;

interface DropStats {
  dropId: string;
  totalSessions: number;
  completedSessions: number;
  abandonedSessions: number;
  avgAbandonPosition: number | null;
  avgLatencyMs: number | null;
  archetypeDistribution: Record<string, number>;
}

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DropStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const panelQuestions = getQuestions();
  const panelDrops = getDrops();
  const activeDrop = panelDrops.find((d) => d.status === "active");

  useEffect(() => {
    // Fetch stats for the active drop (or the first drop with a dropId)
    const targetDrop = activeDrop || panelDrops[0];
    if (!targetDrop) {
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/sessions/${targetDrop.dropId}/stats`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[Panel] Stats fetch error:", err);
        setError("No se pudieron cargar las stats");
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "var(--p-text)" }}>Dashboard</h2>
        <p className="text-xs" style={{ color: "var(--p-text-muted)" }}>Resumen del panel de drops</p>
      </div>

      {/* Panel stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={FileText} label="Preguntas" value={panelQuestions.length.toString()} />
        <StatCard icon={Activity} label="Drops" value={panelDrops.length.toString()} />
        <StatCard
          icon={Zap}
          label="Drop activo"
          value={activeDrop?.name || "—"}
          accent
        />
        <StatCard
          icon={TrendingUp}
          label="Cartas en activo"
          value={activeDrop ? activeDrop.questionIds.length.toString() : "—"}
        />
      </div>

      {/* Live stats from Supabase */}
      <div>
        <h3 className="text-sm font-bold mb-3" style={{ color: "var(--p-text-muted)" }}>
          Sesiones en vivo
          {activeDrop && <span className="font-normal ml-2" style={{ color: "var(--p-text-ghost)" }}>· {activeDrop.dropId}</span>}
        </h3>

        {loading ? (
          <div className="flex items-center gap-2 text-sm py-8 justify-center" style={{ color: "var(--p-text-ghost)" }}>
            <Loader2 size={14} className="animate-spin" />
            Cargando stats...
          </div>
        ) : error ? (
          <div className="text-sm py-8 text-center" style={{ color: "var(--p-text-ghost)" }}>{error}</div>
        ) : !stats ? (
          <div className="text-sm py-8 text-center" style={{ color: "var(--p-text-ghost)" }}>
            No hay drops configurados. Creá uno en la sección Drops.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Users} label="Sesiones totales" value={stats.totalSessions.toString()} />
              <StatCard icon={BarChart3} label="Completadas" value={stats.completedSessions.toString()} />
              <StatCard icon={Clock} label="Latencia promedio" value={stats.avgLatencyMs ? `${(stats.avgLatencyMs / 1000).toFixed(1)}s` : "—"} />
              <StatCard
                icon={Activity}
                label="Abandonos"
                value={`${stats.abandonedSessions} ${stats.avgAbandonPosition !== null ? `(Q#${stats.avgAbandonPosition})` : ""}`}
              />
            </div>

            {/* Archetype distribution */}
            {Object.keys(stats.archetypeDistribution).length > 0 && (
              <div className="mt-4 border rounded-xl p-4" style={{ backgroundColor: "var(--p-bg-card)", borderColor: "var(--p-border-subtle)" }}>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--p-text-muted)" }}>Distribución de arquetipos</h4>
                <div className="flex flex-col gap-2">
                  {Object.entries(stats.archetypeDistribution)
                    .sort(([, a], [, b]) => b - a)
                    .map(([archetype, count]) => {
                      const total = Object.values(stats.archetypeDistribution).reduce((a, b) => a + b, 0);
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={archetype} className="flex items-center gap-3">
                          <span className="text-xs w-32 truncate font-['Fira_Code']" style={{ color: "var(--p-text-muted)" }}>{archetype}</span>
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--p-border-subtle)" }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "var(--p-accent)" }} />
                          </div>
                          <span className="text-xs font-['Fira_Code'] w-12 text-right" style={{ color: "var(--p-text-muted)" }}>{pct}%</span>
                          <span className="text-xs w-8 text-right" style={{ color: "var(--p-text-ghost)" }}>{count}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className="border rounded-xl p-4"
      style={{
        backgroundColor: "var(--p-bg-card)",
        borderColor: accent ? "var(--p-border)" : "var(--p-border-subtle)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color: accent ? "var(--p-accent)" : "var(--p-text-ghost)" }} />
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--p-text-muted)" }}>{label}</span>
      </div>
      <p className="text-lg font-bold truncate" style={{ color: accent ? "var(--p-text)" : "var(--p-text-secondary)" }}>{value}</p>
    </div>
  );
}