import React from 'react';

export type Page = 'overview' | 'funil' | 'leads' | 'scoring' | 'execucoes' | 'alertas';

interface NavItem { key: Page; num: string; label: string; sub: string; }

const NAV: NavItem[] = [
  { key: 'overview',  num: 'i',   label: 'Visão geral',   sub: 'KPIs do pipeline' },
  { key: 'funil',     num: 'ii',  label: 'Funil',         sub: 'Framer → RD → Pipe' },
  { key: 'leads',     num: 'iii', label: 'Leads',         sub: 'Validador de campos' },
  { key: 'scoring',   num: 'iv',  label: 'Lead Scoring',  sub: 'Nota RD por lead' },
  { key: 'execucoes', num: 'v',   label: 'Execuções n8n', sub: 'Saúde dos workflows' },
  { key: 'alertas',   num: 'vi',  label: 'Alertas',       sub: 'Incompletos & erros' },
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
  return (
    <aside className="fixed left-0 top-0 h-screen w-[224px] flex flex-col z-40"
      style={{ background: 'var(--bg)', borderRight: '1px solid var(--rule)' }}>

      {/* Brand */}
      <div className="flex items-center gap-3" style={{ padding: '20px 20px 18px', borderBottom: '1px solid var(--rule)' }}>
        <div className="font-display" style={{ width: 32, height: 32, background: 'var(--ink)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic', fontWeight: 600, fontSize: 18, flexShrink: 0 }}>
          S
        </div>
        <div style={{ lineHeight: 1.2 }}>
          <div className="font-display" style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Spark Maxx</div>
          <div className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-mute)' }}>Growth Ops</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: '20px 0' }}>
        <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.15em', color: 'var(--ink-faint)', padding: '0 20px 12px' }}>
          Navegação
        </div>
        {NAV.map((item) => {
          const active = page === item.key;
          return (
            <button key={item.key} onClick={() => onNavigate(item.key)}
              className="w-full text-left flex flex-col"
              style={{
                gap: 3, padding: '12px 20px', cursor: 'pointer', background: active ? 'var(--bg-soft)' : 'transparent',
                borderLeft: `2px solid ${active ? 'var(--crimson)' : 'transparent'}`, transition: 'background .12s, border-color .12s',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-soft)'; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
              <span className="font-display" style={{ fontStyle: 'italic', fontSize: 11, letterSpacing: '0.04em', color: active ? 'var(--crimson)' : 'var(--ink-faint)' }}>
                Parte {item.num}
              </span>
              <span className="flex items-center justify-between" style={{ fontSize: 14, fontWeight: 500, color: active ? 'var(--ink)' : 'var(--ink-mute)' }}>
                {item.label}
                {item.key === 'alertas' && openAlerts > 0 && (
                  <span className="font-mono" style={{ fontSize: 9, padding: '1px 6px', background: 'var(--crimson-soft)', color: 'var(--crimson)' }}>{openAlerts}</span>
                )}
              </span>
              <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{item.sub}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer controls */}
      <div style={{ borderTop: '1px solid var(--rule)', padding: 16 }} className="space-y-3">
        {/* theme pill */}
        <div className="flex items-center" style={{ background: 'var(--bg-soft)', border: '1px solid var(--rule)', borderRadius: 999, padding: 4 }}>
          {(['light', 'dark'] as const).map((t) => {
            const on = theme === t;
            return (
              <button key={t} onClick={() => { if (!on) onToggleTheme(); }}
                className="font-mono uppercase flex-1"
                style={{
                  fontSize: 10, letterSpacing: '0.08em', padding: '5px 8px', cursor: 'pointer', borderRadius: 999, border: 0,
                  background: on ? 'var(--bg-paper)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-mute)',
                }}>
                {t === 'light' ? '☀ Claro' : '☾ Escuro'}
              </button>
            );
          })}
        </div>
        <button onClick={onRefresh}
          className="font-mono uppercase w-full flex items-center justify-center"
          style={{ gap: 6, fontSize: 10, letterSpacing: '0.08em', padding: '8px', cursor: 'pointer', borderRadius: 999, background: 'var(--bg-soft)', border: '1px solid var(--rule)', color: 'var(--ink-mute)' }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: loading ? 'var(--amber)' : 'var(--olive)', display: 'inline-block' }} />
          {loading ? 'Sincronizando' : 'Atualizar'}
        </button>
      </div>
    </aside>
  );
}
