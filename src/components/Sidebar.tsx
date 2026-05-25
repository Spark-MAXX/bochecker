import React from 'react';
import { LayoutDashboard, GitBranch, Users, Activity, Bell, Sun, Moon, RefreshCcw } from 'lucide-react';

export type Page = 'overview' | 'funil' | 'leads' | 'execucoes' | 'alertas';

interface NavItem { key: Page; label: string; icon: React.ComponentType<{ className?: string }>; }

const NAV: NavItem[] = [
  { key: 'overview',  label: 'Visão geral',   icon: LayoutDashboard },
  { key: 'funil',     label: 'Funil',         icon: GitBranch },
  { key: 'leads',     label: 'Leads',         icon: Users },
  { key: 'execucoes', label: 'Execuções n8n', icon: Activity },
  { key: 'alertas',   label: 'Alertas',       icon: Bell },
];

interface SidebarProps {
  page: Page;
  onNavigate: (p: Page) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onRefresh: () => void;
  loading: boolean;
  openAlerts: number;
}

export default function Sidebar({ page, onNavigate, theme, onToggleTheme, onRefresh, loading, openAlerts }: SidebarProps) {
  const isDark = theme === 'dark';
  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[208px] flex flex-col border-r z-40"
      style={{ backgroundColor: 'var(--bg-nav)', borderColor: 'var(--border)' }}
    >
      {/* Brand */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="w-7 h-7 bg-cyan-500 rounded-md flex items-center justify-center glow-cyan shrink-0">
          <Bell className="h-4 w-4 text-slate-950 stroke-[2.5px]" />
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-bold tracking-tight uppercase" style={{ color: 'var(--text-1)' }}>Spark Maxx</div>
          <div className="text-[9px] font-mono tracking-[0.2em] uppercase text-cyan-400/80">Pipeline Ops</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map((item) => {
          const active = page === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-semibold transition-colors relative"
              style={{
                backgroundColor: active ? 'rgba(6,182,212,0.12)' : 'transparent',
                color: active ? '#22d3ee' : 'var(--text-3)',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'var(--bg-muted)'; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-cyan-400" />}
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.key === 'alertas' && openAlerts > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold font-mono"
                  style={{ backgroundColor: 'var(--c-error-bg)', color: 'var(--c-error)' }}>
                  {openAlerts}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer controls */}
      <div className="border-t p-3 space-y-2 shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 px-1">
          <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
          <span className="text-[9px] font-mono uppercase tracking-[0.15em]" style={{ color: 'var(--text-4)' }}>
            {loading ? 'Sincronizando' : 'Operacional'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onRefresh}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-[10px] font-mono uppercase transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }} title="Atualizar">
            <RefreshCcw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Sync
          </button>
          <button onClick={onToggleTheme}
            className="py-1.5 px-2.5 rounded-lg border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
            title={isDark ? 'Modo claro' : 'Modo escuro'}>
            {isDark ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-slate-600" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
