import React, { useEffect, useState } from 'react';
import type { FunnelStats, LeadsStats } from '../lib/schemas';
import type { Page } from './Sidebar';

interface OverviewProps {
  dashboard: { openCount: number; resolvedToday: number; totalWeek: number };
  leadsStats: LeadsStats | null;
  refreshKey: number;
  onNavigate: (p: Page) => void;
}

type Tone = 'ink' | 'crimson' | 'amber' | 'olive' | 'navy' | 'plum';
const TONE: Record<Tone, string> = {
  ink: 'var(--ink)', crimson: 'var(--crimson)', amber: 'var(--amber)',
  olive: 'var(--olive)', navy: 'var(--navy)', plum: 'var(--plum)',
};

const PERIODS = [
  { key: 'h24', label: '24h' },
  { key: 'hoje', label: 'Hoje' },
  { key: 'd7', label: '7 dias' },
] as const;

// ── Subcomponentes editoriais ────────────────────────────────────────────────
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.15em', color: 'var(--ink-mute)' }}>
      {children}
    </div>
  );
}

function Kpi({ label, value, suffix, tone = 'ink', foot }: { label: string; value: React.ReactNode; suffix?: string; tone?: Tone; foot?: React.ReactNode }) {
  return (
    <div style={{ padding: '4px 24px', borderRight: '1px solid var(--rule)' }} className="kpi-cell">
      <div className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink-mute)', marginBottom: 12 }}>{label}</div>
      <div className="font-display" style={{ fontSize: 46, lineHeight: 1, color: TONE[tone], fontWeight: 400 }}>
        {value}{suffix && <span style={{ fontSize: 24 }}>{suffix}</span>}
      </div>
      {foot && <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 10 }}>{foot}</div>}
    </div>
  );
}

function Delta({ children }: { children: React.ReactNode }) {
  return <span className="font-mono" style={{ fontSize: 11, padding: '2px 6px', background: 'var(--bg-soft)', color: 'var(--ink)' }}>{children}</span>;
}

function Panel({ title, eyebrow, action, children }: { title: string; eyebrow?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-paper)', border: '1px solid var(--rule)' }}>
      <div className="flex items-baseline justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)' }}>
        <h3 className="font-display" style={{ fontSize: 19, fontWeight: 500, color: 'var(--ink)' }}>{title}</h3>
        {action || (eyebrow && <Eyebrow>{eyebrow}</Eyebrow>)}
      </div>
      {children}
    </div>
  );
}

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
    { label: 'Capturado', value: f.capturado, color: 'var(--navy)' },
    { label: 'Processado', value: f.processado, color: 'var(--amber)' },
    { label: 'Deal criado', value: f.deal, color: 'var(--plum)' },
    { label: 'Ganho', value: f.ganho, color: 'var(--olive)' },
    { label: 'Perdido', value: f.perdido, color: 'var(--crimson)' },
  ] : [];

  return (
    <div className="space-y-8">
      {/* Hero / eyebrow */}
      <div style={{ paddingTop: 8 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
          <span style={{ width: 6, height: 6, background: 'var(--crimson)', display: 'inline-block' }} />
          <Eyebrow>Pipeline ao vivo · Framer → RD → Pipedrive</Eyebrow>
        </div>
        <h1 className="font-display" style={{ fontSize: 'clamp(34px, 4vw, 52px)', lineHeight: 1.04, fontWeight: 400, color: 'var(--ink)', maxWidth: 820 }}>
          O funil de leads, da captura ao <span className="font-display-em">fechamento</span>.
        </h1>
      </div>

      {/* KPI row — período */}
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--rule)' }}>
          <Eyebrow>01 · Janela</Eyebrow>
          <div className="flex items-center gap-1">
            {PERIODS.map((pp) => (
              <button key={pp.key} onClick={() => setPeriod(pp.key)}
                className="font-mono uppercase"
                style={{
                  fontSize: 10, letterSpacing: '0.08em', padding: '4px 10px', cursor: 'pointer', borderRadius: 999,
                  background: period === pp.key ? 'var(--bg-soft)' : 'transparent',
                  color: period === pp.key ? 'var(--ink)' : 'var(--ink-mute)',
                  border: `1px solid ${period === pp.key ? 'var(--rule-strong)' : 'transparent'}`,
                }}>
                {pp.label}
              </button>
            ))}
          </div>
        </div>
        <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', rowGap: 28 }}>
          <Kpi label={`Entraram · ${period}`} value={p?.entraram ?? '—'} tone="ink" foot={<>no funil unificado</>} />
          <Kpi label="Completos" value={p?.completos ?? '—'} tone="olive" foot={p ? <><Delta>{p.taxa_completos}%</Delta> de completude</> : undefined} />
          <Kpi label="Incompletos" value={p?.incompletos ?? '—'} tone="amber" foot={<>faltando campos obrigatórios</>} />
          <Kpi label="Com problema" value={p?.problema ?? '—'} tone="crimson" foot={<>saúde ≠ ok</>} />
          <Kpi label="Viraram deal" value={p?.deals ?? '—'} tone="plum" foot={<>chegaram ao Pipedrive</>} />
          <Kpi label="Duplicados" value={funnel?.duplicados ?? '—'} tone="amber" foot={<>mesmo email em +1 base</>} />
        </div>
      </div>

      {/* Funil em barras */}
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--rule)' }}>
          <h2 className="font-display" style={{ fontSize: 24, fontWeight: 400, color: 'var(--ink)' }}>
            Onde o lead <span className="font-display-em">para</span>.
          </h2>
          <Eyebrow>02 · Estágios (30d)</Eyebrow>
        </div>
        <div style={{ background: 'var(--bg-paper)', border: '1px solid var(--rule)', padding: 24 }}>
          {steps.length === 0 ? (
            <div className="font-mono" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Carregando funil…</div>
          ) : (
            <div className="flex flex-col" style={{ gap: 10 }}>
              {steps.map((s) => (
                <div key={s.label} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 56px', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 13, color: 'var(--ink)' }}>{s.label}</span>
                  <div style={{ background: 'var(--bg-soft)', height: 26, position: 'relative' }}>
                    <div style={{ height: '100%', width: `${(s.value / fmax) * 100}%`, background: s.color, display: 'flex', alignItems: 'center', paddingLeft: 10, transition: 'width .6s ease' }}>
                      <span className="font-mono" style={{ fontSize: 12, color: '#1A1814', fontWeight: 600 }}>{s.value}</span>
                    </div>
                  </div>
                  <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink-mute)', textAlign: 'right' }}>
                    {fmax ? Math.round((s.value / fmax) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          )}
          {f && f.nao_processado > 0 && (
            <div className="font-mono" style={{ fontSize: 11, color: 'var(--crimson)', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--rule)' }}>
              ⚠ {f.nao_processado} lead(s) chegaram no RD mas não foram processados
            </div>
          )}
        </div>
      </div>

      {/* Painéis menores */}
      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 24 }}>
        <Panel title="Resultado no Pipedrive" eyebrow="S4 · deals">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {[
              { l: 'Deals criados', v: f?.deal ?? '—', t: 'plum' as Tone },
              { l: 'Em aberto', v: f ? Math.max(f.deal - f.ganho - f.perdido, 0) : '—', t: 'navy' as Tone },
              { l: 'Ganhos', v: f?.ganho ?? '—', t: 'olive' as Tone },
              { l: 'Perdidos', v: f?.perdido ?? '—', t: 'crimson' as Tone },
            ].map((c, i) => (
              <div key={c.l} style={{ padding: '16px 20px', borderRight: i % 2 === 0 ? '1px solid var(--rule)' : 'none', borderBottom: i < 2 ? '1px solid var(--rule)' : 'none' }}>
                <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-mute)', marginBottom: 6 }}>{c.l}</div>
                <div className="font-display" style={{ fontSize: 30, lineHeight: 1, color: TONE[c.t] }}>{c.v}</div>
              </div>
            ))}
          </div>
          <div className="font-mono" style={{ fontSize: 10, color: 'var(--ink-faint)', padding: '10px 20px', borderTop: '1px solid var(--rule)' }}>
            ganho/perdido dependem do sync do Pipedrive (deals_snapshot)
          </div>
        </Panel>

        <Panel title="Por origem" eyebrow="30 dias"
          action={<button onClick={() => onNavigate('funil')} className="font-mono uppercase" style={{ fontSize: 9, color: 'var(--crimson)', letterSpacing: '0.08em', cursor: 'pointer', background: 'none', border: 0 }}>ver funil →</button>}>
          <div>
            {(funnel?.por_origem ?? []).map((o, i, arr) => (
              <div key={o.source} className="flex items-center justify-between" style={{ padding: '12px 20px', borderBottom: i < arr.length - 1 ? '1px solid var(--rule)' : 'none' }}>
                <span style={{ fontSize: 13, color: 'var(--ink-mute)' }}>{o.source_label}</span>
                <span className="font-mono" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                  {o.total}{o.problema > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--crimson)' }}>{o.problema}⚠</span>}
                </span>
              </div>
            ))}
            {!funnel && <div className="font-mono" style={{ fontSize: 11, color: 'var(--ink-faint)', padding: '12px 20px' }}>Carregando…</div>}
          </div>
        </Panel>

        <Panel title="Alertas & qualidade" eyebrow="agora"
          action={<button onClick={() => onNavigate('alertas')} className="font-mono uppercase" style={{ fontSize: 9, color: 'var(--crimson)', letterSpacing: '0.08em', cursor: 'pointer', background: 'none', border: 0 }}>ver alertas →</button>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {[
              { l: 'Alertas abertos', v: dashboard.openCount, t: (dashboard.openCount > 0 ? 'crimson' : 'olive') as Tone },
              { l: 'Resolvidos hoje', v: dashboard.resolvedToday, t: 'olive' as Tone },
              { l: 'Completude 24h', v: `${leadsStats?.completion_rate_24h ?? 0}%`, t: 'navy' as Tone },
              { l: 'Leads 7d', v: leadsStats?.total_7d ?? 0, t: 'ink' as Tone },
            ].map((c, i) => (
              <div key={c.l} style={{ padding: '16px 20px', borderRight: i % 2 === 0 ? '1px solid var(--rule)' : 'none', borderBottom: i < 2 ? '1px solid var(--rule)' : 'none' }}>
                <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-mute)', marginBottom: 6 }}>{c.l}</div>
                <div className="font-display" style={{ fontSize: 30, lineHeight: 1, color: TONE[c.t] }}>{c.v}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
