import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, GitBranch, Users, Activity, Trophy, XOctagon } from 'lucide-react';
import type { FunnelStats, LeadsStats } from '../lib/schemas';
import type { Page } from './Sidebar';

interface OverviewProps {
  dashboard: { openCount: number; resolvedToday: number; totalWeek: number };
  leadsStats: LeadsStats | null;
  refreshKey: number;
  onNavigate: (p: Page) => void;
}

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'won';
const TONE: Record<Tone, string> = {
  info: '#22d3ee', success: '#10b981', warning: '#f59e0b',
  danger: '#ef4444', neutral: 'var(--text-1)', won: '#16a34a',
};

function Kpi({ label, value, tone = 'neutral', sub }: { label: string; value: React.ReactNode; tone?: Tone; sub?: string }) {
  return (
    <div className="px-3 py-2.5" style={{ backgroundColor: 'var(--bg-card)' }}>
      <div className="text-[9px] font-mono uppercase tracking-[0.12em] mb-1 truncate" style={{ color: 'var(--text-4)' }}>{label}</div>
      <div className="text-2xl font-bold font-mono leading-none" style={{ color: TONE[tone] }}>{value}</div>
      {sub && <div className="text-[9px] font-mono mt-1" style={{ color: 'var(--text-3)' }}>{sub}</div>}
    </div>
  );
}

function Section({ title, icon: Icon, action, children }: { title: string; icon: React.ComponentType<{ className?: string }>; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ backgroundColor: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-cyan-400" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-2)' }}>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

const PERIODS = [
  { key: 'h24', label: '24h' },
  { key: 'hoje', label: 'Hoje' },
  { key: 'd7', label: '7 dias' },
] as const;

export default function Overview({ dashboard, leadsStats, refreshKey, onNavigate }: OverviewProps) {
  const [funnel, setFunnel] = useState<FunnelStats | null>(null);
  const [period, setPeriod] = useState<'h24' | 'hoje' | 'd7'>('d7');

  useEffect(() => {
    let alive = true;
    fetch('/api/leads/unified-stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setFunnel(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [refreshKey]);

  const p = funnel?.periodos[period];
  const f = funnel?.funil_rd;
  const fmax = Math.max(f?.capturado ?? 1, 1);
  const steps = f ? [
    { label: 'Capturado', value: f.capturado, color: '#06b6d4' },
    { label: 'Processado', value: f.processado, color: '#f59e0b' },
    { label: 'Deal criado', value: f.deal, color: '#10b981' },
    { label: 'Ganho', value: f.ganho, color: '#16a34a' },
    { label: 'Perdido', value: f.perdido, color: '#6b7280' },
  ] : [];

  return (
    <div className="space-y-4">
      {/* Topo: período + funil ponta a ponta */}
      <Section
        title="Funil ponta a ponta — RD → Pipedrive"
        icon={GitBranch}
        action={
          <div className="flex items-center gap-1">
            {PERIODS.map((pp) => (
              <button key={pp.key} onClick={() => setPeriod(pp.key)}
                className="text-[10px] font-bold uppercase px-2 py-0.5 rounded transition-colors"
                style={{
                  backgroundColor: period === pp.key ? 'rgba(6,182,212,0.15)' : 'transparent',
                  color: period === pp.key ? '#22d3ee' : 'var(--text-4)',
                  border: `1px solid ${period === pp.key ? 'rgba(6,182,212,0.4)' : 'var(--border)'}`,
                }}>
                {pp.label}
              </button>
            ))}
          </div>
        }
      >
        {/* período: matriz de KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px" style={{ backgroundColor: 'var(--border)' }}>
          <Kpi label={`Entraram (${period})`} value={p?.entraram ?? '—'} tone="info" />
          <Kpi label="Completos" value={p?.completos ?? '—'} tone="success" sub={p ? `${p.taxa_completos}% taxa` : undefined} />
          <Kpi label="Incompletos" value={p?.incompletos ?? '—'} tone="warning" />
          <Kpi label="Com problema" value={p?.problema ?? '—'} tone="danger" />
          <Kpi label="Viraram deal" value={p?.deals ?? '—'} tone="success" />
          <Kpi label="Duplicados (email)" value={funnel?.duplicados ?? '—'} tone="warning" />
        </div>

        {/* barra de estágios */}
        <div className="px-3 py-3 border-t space-y-1.5" style={{ borderColor: 'var(--border-light)' }}>
          {steps.length === 0 ? (
            <div className="text-[10px] font-mono py-2" style={{ color: 'var(--text-4)' }}>Carregando funil…</div>
          ) : steps.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="text-[10px] font-mono w-20 shrink-0" style={{ color: 'var(--text-3)' }}>{s.label}</span>
              <div className="flex-1 h-3.5 rounded overflow-hidden" style={{ backgroundColor: 'var(--bg-input)' }}>
                <div className="h-full rounded" style={{ width: `${(s.value / fmax) * 100}%`, backgroundColor: s.color, transition: 'width .6s ease' }} />
              </div>
              <span className="text-[11px] font-mono font-bold w-10 text-right" style={{ color: 'var(--text-1)' }}>{s.value}</span>
            </div>
          ))}
          {f && f.nao_processado > 0 && (
            <div className="text-[10px] font-mono pt-1" style={{ color: 'var(--c-error)' }}>
              ⚠ {f.nao_processado} lead(s) no RD não processados
            </div>
          )}
        </div>
      </Section>

      {/* Linha de seções menores */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipedrive (S4) */}
        <Section title="Resultado no Pipedrive" icon={Trophy}>
          <div className="grid grid-cols-2 gap-px" style={{ backgroundColor: 'var(--border)' }}>
            <Kpi label="Deals criados" value={f?.deal ?? '—'} tone="success" />
            <Kpi label="Em aberto" value={f ? Math.max(f.deal - f.ganho - f.perdido, 0) : '—'} tone="info" />
            <Kpi label="Ganhos" value={f?.ganho ?? '—'} tone="won" />
            <Kpi label="Perdidos" value={f?.perdido ?? '—'} tone="neutral" />
          </div>
          <div className="px-3 py-2 text-[9px] font-mono border-t" style={{ borderColor: 'var(--border-light)', color: 'var(--text-4)' }}>
            Ganho/perdido dependem do sync do Pipedrive (deals_snapshot)
          </div>
        </Section>

        {/* Origens */}
        <Section title="Por origem (30d)" icon={Users} action={
          <button onClick={() => onNavigate('funil')} className="text-[9px] font-mono uppercase text-cyan-400 hover:underline">ver funil →</button>
        }>
          <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
            {(funnel?.por_origem ?? []).map((o) => (
              <div key={o.source} className="flex items-center justify-between px-3 py-2">
                <span className="text-[11px] font-mono" style={{ color: 'var(--text-2)' }}>{o.source_label}</span>
                <span className="text-[12px] font-mono font-bold" style={{ color: 'var(--text-1)' }}>
                  {o.total}
                  {o.problema > 0 && <span className="ml-1.5 text-[10px]" style={{ color: 'var(--c-error)' }}>{o.problema}⚠</span>}
                </span>
              </div>
            ))}
            {!funnel && <div className="px-3 py-3 text-[10px] font-mono" style={{ color: 'var(--text-4)' }}>Carregando…</div>}
          </div>
        </Section>

        {/* Alertas + Leads */}
        <Section title="Alertas & qualidade" icon={AlertCircle} action={
          <button onClick={() => onNavigate('alertas')} className="text-[9px] font-mono uppercase text-cyan-400 hover:underline">ver alertas →</button>
        }>
          <div className="grid grid-cols-2 gap-px" style={{ backgroundColor: 'var(--border)' }}>
            <Kpi label="Alertas abertos" value={dashboard.openCount} tone={dashboard.openCount > 0 ? 'danger' : 'success'} />
            <Kpi label="Resolvidos hoje" value={dashboard.resolvedToday} tone="success" />
            <Kpi label="Completude 24h" value={`${leadsStats?.completion_rate_24h ?? 0}%`} tone="info" sub={`7d ${leadsStats?.completion_rate_7d ?? 0}%`} />
            <Kpi label="Leads 7d" value={leadsStats?.total_7d ?? 0} tone="neutral" sub={`${leadsStats?.incompletos_7d ?? 0} incompletos`} />
          </div>
        </Section>
      </div>
    </div>
  );
}
