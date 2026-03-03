// ============================================================
// PANEL LAYOUT — SaaS-style admin shell with sidebar
// Light/Dark mode with high contrast for accessibility
// ============================================================

import { useState, useCallback, useEffect } from "react";
import {
  LayoutDashboard,
  FileText,
  Layers,
  ChevronLeft,
  Menu,
  Loader2,
  Lock,
  LogOut,
  Bot,
  Trophy,
  Users,
  Compass,
  Sun,
  Moon,
} from "lucide-react";
import { Dashboard } from "./Dashboard";
import { QuestionLibrary } from "./QuestionLibrary";
import { QuestionBuilder } from "./QuestionBuilder";
import { DropManager } from "./DropManager";
import { DropEditor } from "./DropEditor";
import { BotManager } from "./BotManager";
import { SeasonManager } from "./SeasonManager";
import { NodosManager } from "./NodosManager";
import { OnboardingBuilder } from "./OnboardingBuilder";
import {
  isAuthenticated,
  setAuthenticated,
  authenticate,
  loadPanelDataFromServer,
} from "./panel-sync";
import { usePanelTheme } from "./usePanelTheme";

type PanelView =
  | { screen: "dashboard" }
  | { screen: "questions" }
  | { screen: "question_builder"; editId?: string | null }
  | { screen: "drops" }
  | { screen: "drop_editor"; dropId: string }
  | { screen: "bot" }
  | { screen: "economy" }
  | { screen: "nodos" }
  | { screen: "onboarding" };

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "nodos", label: "Nodos", icon: Users },
  { id: "onboarding", label: "Onboarding", icon: Compass },
  { id: "questions", label: "Preguntas", icon: FileText },
  { id: "drops", label: "Drops", icon: Layers },
  { id: "bot", label: "Bot", icon: Bot },
  { id: "economy", label: "Economy", icon: Trophy },
] as const;

// ── Theme Toggle Switch ─────────────────────────────────────

function ThemeToggle({ mode, onToggle, collapsed }: { mode: "dark" | "light"; onToggle: () => void; collapsed: boolean }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all"
      style={{
        color: "var(--p-text-muted)",
        backgroundColor: "transparent",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--p-bg-hover)";
        e.currentTarget.style.color = "var(--p-text)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.color = "var(--p-text-muted)";
      }}
      title={mode === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {mode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
      {!collapsed && (
        <span className="text-xs font-medium">
          {mode === "dark" ? "Light" : "Dark"}
        </span>
      )}
    </button>
  );
}

// ── Auth Gate ────────────────────────────────────────────────

function AuthGate({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError(null);
    const result = await authenticate(password.trim());
    setLoading(false);
    if (result.ok) {
      onAuth();
    } else {
      setError(result.error || "Error desconocido");
    }
  };

  return (
    <div
      className="h-dvh flex items-center justify-center"
      style={{ position: "fixed", inset: 0, backgroundColor: "var(--p-bg)" }}
    >
      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-6 w-full max-w-sm px-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor: "var(--p-bg-input)",
              border: "1px solid var(--p-border-subtle)",
            }}
          >
            <Lock size={20} style={{ color: "var(--p-text-ghost)" }} />
          </div>
          <span className="font-['Silkscreen'] text-[13px] tracking-wide" style={{ color: "var(--p-text)" }}>
            BRUTAL<span style={{ color: "var(--p-text-ghost)" }}>////</span>PANEL
          </span>
          <p className="text-xs" style={{ color: "var(--p-text-ghost)" }}>Ingresa la clave del panel</p>
        </div>

        {/* Input */}
        <input
          type="password"
          className="w-full rounded-xl px-4 py-3 text-sm text-center font-['Fira_Code'] tracking-widest focus:outline-none"
          style={{
            backgroundColor: "var(--p-bg-input)",
            border: "1px solid var(--p-border-subtle)",
            color: "var(--p-text)",
          }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="* * * * * *"
          autoFocus
        />

        {/* Error */}
        {error && (
          <p className="text-xs text-center" style={{ color: "var(--p-danger)" }}>{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !password.trim()}
          className="w-full py-3 text-sm font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{
            backgroundColor: "var(--p-accent)",
            color: "var(--p-accent-fg)",
          }}
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Verificando...
            </>
          ) : (
            "Entrar"
          )}
        </button>

        <p className="text-[10px]" style={{ color: "var(--p-text-ghost)" }}>@BBBrutalbot</p>
      </form>
    </div>
  );
}

// ── Loading screen ───────────────────────────────────────────

function LoadingScreen() {
  return (
    <div
      className="h-dvh flex items-center justify-center"
      style={{ position: "fixed", inset: 0, backgroundColor: "var(--p-bg)" }}
    >
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--p-text-ghost)" }} />
        <span className="font-['Silkscreen'] text-[11px] tracking-wide" style={{ color: "var(--p-text-muted)" }}>
          Cargando panel...
        </span>
      </div>
    </div>
  );
}

// ── Main Panel Layout ────────────────────────────────────────

export default function PanelLayout() {
  const [authed, setAuthed] = useState(isAuthenticated());
  const [dataLoaded, setDataLoaded] = useState(false);
  const [view, setView] = useState<PanelView>({ screen: "dashboard" });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { mode, toggle: toggleTheme } = usePanelTheme();

  // Load panel data from server after auth
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    loadPanelDataFromServer().then(() => {
      if (!cancelled) setDataLoaded(true);
    });
    return () => { cancelled = true; };
  }, [authed]);

  const handleAuth = useCallback(() => {
    setAuthed(true);
  }, []);

  const handleLogout = useCallback(() => {
    setAuthenticated(false);
    setAuthed(false);
    setDataLoaded(false);
  }, []);

  // Show auth gate
  if (!authed) {
    return <AuthGate onAuth={handleAuth} />;
  }

  // Show loading while fetching data
  if (!dataLoaded) {
    return <LoadingScreen />;
  }

  const navigate = (screen: "dashboard" | "questions" | "drops" | "bot" | "economy" | "nodos" | "onboarding") => {
    setView({ screen });
    setMobileMenuOpen(false);
  };

  const currentScreen = view.screen === "question_builder" ? "questions" : view.screen === "drop_editor" ? "drops" : view.screen;

  const renderContent = () => {
    switch (view.screen) {
      case "dashboard":
        return <Dashboard />;
      case "nodos":
        return <NodosManager />;
      case "onboarding":
        return <OnboardingBuilder />;
      case "questions":
        return (
          <QuestionLibrary
            onCreateNew={() => setView({ screen: "question_builder" })}
            onEdit={(id) => setView({ screen: "question_builder", editId: id })}
          />
        );
      case "question_builder":
        return (
          <QuestionBuilder
            editId={view.editId}
            onSaved={() => setView({ screen: "questions" })}
            onCancel={() => setView({ screen: "questions" })}
          />
        );
      case "drops":
        return <DropManager onEditDrop={(id) => setView({ screen: "drop_editor", dropId: id })} />;
      case "drop_editor":
        return (
          <DropEditor
            dropId={view.dropId}
            onBack={() => setView({ screen: "drops" })}
            onRefresh={() => {}}
          />
        );
      case "bot":
        return <BotManager />;
      case "economy":
        return <SeasonManager />;
      default:
        return null;
    }
  };

  return (
    <div
      className="h-dvh flex overflow-hidden"
      style={{ position: "fixed", inset: 0, backgroundColor: "var(--p-bg)", color: "var(--p-text)" }}
    >
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          flex flex-col shrink-0 z-40 transition-all duration-200
          ${sidebarCollapsed ? "w-[60px]" : "w-[220px]"}
          fixed md:relative h-full
          ${mobileMenuOpen ? "left-0" : "-left-[220px] md:left-0"}
        `}
        style={{
          backgroundColor: "var(--p-bg-sidebar)",
          borderRight: "1px solid var(--p-border)",
        }}
      >
        {/* Logo */}
        <div
          className={`flex items-center h-14 px-3 ${sidebarCollapsed ? "justify-center" : "justify-between"}`}
          style={{ borderBottom: "1px solid var(--p-border)" }}
        >
          {!sidebarCollapsed && (
            <span className="font-['Silkscreen'] text-[11px] tracking-wide" style={{ color: "var(--p-text)" }}>
              BRUTAL<span style={{ color: "var(--p-text-ghost)" }}>////</span>PANEL
            </span>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 transition-colors hidden md:block"
            style={{ color: "var(--p-text-ghost)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }}
          >
            <ChevronLeft size={14} className={`transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all ${sidebarCollapsed ? "justify-center" : ""}`}
                style={{
                  backgroundColor: isActive ? "var(--p-bg-active)" : "transparent",
                  color: isActive ? "var(--p-text)" : "var(--p-text-muted)",
                  fontWeight: isActive ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "var(--p-bg-hover)";
                    e.currentTarget.style.color = "var(--p-text)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--p-text-muted)";
                  }
                }}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon size={16} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          className={`p-3 ${sidebarCollapsed ? "text-center" : ""}`}
          style={{ borderTop: "1px solid var(--p-border)" }}
        >
          {/* Theme toggle */}
          <div className={`mb-2 ${sidebarCollapsed ? "flex justify-center" : ""}`}>
            <ThemeToggle mode={mode} onToggle={toggleTheme} collapsed={sidebarCollapsed} />
          </div>

          {!sidebarCollapsed ? (
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-['Fira_Code']" style={{ color: "var(--p-text-ghost)" }}>
                <p>@BBBrutalbot</p>
                <p className="mt-0.5">Panel v2.0</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 transition-colors"
                style={{ color: "var(--p-text-ghost)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-danger)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }}
                title="Cerrar sesion"
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="p-1 transition-colors"
              style={{ color: "var(--p-text-ghost)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-danger)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }}
              title="Cerrar sesion"
            >
              <LogOut size={13} />
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top bar (mobile) */}
        <div
          className="flex items-center h-14 px-4 md:hidden shrink-0"
          style={{ borderBottom: "1px solid var(--p-border)" }}
        >
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 transition-colors -ml-2"
            style={{ color: "var(--p-text-muted)" }}
          >
            <Menu size={18} />
          </button>
          <span className="font-['Silkscreen'] text-[11px] tracking-wide ml-2" style={{ color: "var(--p-text)" }}>
            BRUTAL<span style={{ color: "var(--p-text-ghost)" }}>////</span>PANEL
          </span>
          {/* Mobile theme toggle */}
          <div className="ml-auto">
            <ThemeToggle mode={mode} onToggle={toggleTheme} collapsed={true} />
          </div>
        </div>

        {/* Content area — scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}
