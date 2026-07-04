import React, { useEffect, useState } from 'react';
import type { LeadsStats } from '../lib/schemas';
import type { JourneyStats } from '../lib/journey';
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

interface FlowStats {
  backup_total: number;
  framer_total: number; framer_ok: number; pass_total: number; pass_ok: number;
  framer_falhou: number; pass_falhou: number;
  taxa_backup_framer: number; taxa_framer_ok: number; taxa_rd_mql: number; taxa_mql_deal: number;
}

// ── Subcomponentes editoriais ────────────────────────────────────────────────
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.15em', color: 'var(--ink-mute)' }}>{children}</div>;
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
function MiniCell({ label, value, tone = 'ink', right, bottom }: { label: string; value: React.ReactNode; tone?: Tone; right?: boolean; bottom?: boolean }) {
  return (
    <div style={{ padding: '16px 20px', borderRight: right ? 'none' : '1px solid var(--rule)', borderBottom: bottom ? 'none' : '1px solid var(--rule)' }}>
      <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-mute)', marginBottom: 6 }}>{label}</div>
      <div className="font-display" style={{ fontSize: 30, lineHeight: 1, color: TONE[tone] }}>{value}</div>
    </div>
  );
}

export default function Overview({ dashboard, leadsStats, refreshKey, onNavigate }: OverviewProps) {
  const [fromDate, setFromDate] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [flow, setFlow] = useState<FlowStats | null>(null);
  const [jstats, setJstats] = useState<JourneyStats | null>(null);

  useEffect(() => {
    let alive = true;
    const sp = new URLSearchParams();
    if (fromDate) sp.append('from', new Date(fromDate + 'T00:00:00').toISOString());
    if (toDate) sp.append('to', new Date(toDate + 'T23:59:59').toISOString());
    Promise.all([
      fetch(`/api/journey/flow-stats?${sp}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/journey/stats?${sp}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([f, j]) => { if (alive) { setFlow(f); setJstats(j); } });
    return () => { alive = false; };
  }, [fromDate, toDate, refreshKey]);

  // 5 estágios do funil: backup → webhook framer → RD → MQL → deal
  // O max da barra é o topo do funil, para o visual "afunilar" naturalmente.
  const stages = flow ? [
    { n: '01', label: 'Backup Framer',         value: flow.backup_total, tone: 'crimson' as Tone, sub: 'captura crua (leads_framer_backup)',      chip: null as string | null },
    { n: '02', label: 'Webhook Framer',        value: flow.framer_total, tone: 'amber'   as Tone, sub: 'gatilho do form disparou o fluxo',        chip: flow.backup_total ? `${flow.taxa_backup_framer}% do backup` : null },
    { n: '03', label: 'Chegou ao RD',          value: flow.framer_ok,    tone: 'navy'    as Tone, sub: 'execução Framer concluída sem erro',      chip: `${flow.taxa_framer_ok}% do webhook` },
    { n: '04', label: 'MQL (Fluxo Pipedrive)', value: flow.pass_total,   tone: 'plum'    as Tone, sub: 'iniciou a passagem de leads',             chip: `${flow.taxa_rd_mql}% do RD` },
    { n: '05', label: 'Deal criado',           value: flow.pass_ok,      tone: 'olive'   as Tone, sub: 'passagem RD → Pipedrive concluída',       chip: `${flow.taxa_mql_deal}% do MQL` },
  ] : [];
  const fmax = Math.max(stages[0]?.value ?? 1, 1);

  return (
    <div className="space-y-8">
      {/* Hero + período */}
      <div style={{ paddingTop: 8 }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
              <span style={{ width: 6, height: 6, background: 'var(--crimson)', display: 'inline-block' }} />
              <Eyebrow>Pipeline ao vivo · Framer → RD → Pipedrive</Eyebrow>
            </div>
            <h1 className="font-display" style={{ fontSize: 'clamp(30px, 4vw, 46px)', lineHeight: 1.04, fontWeight: 400, color: 'var(--ink)' }}>
              O funil de leads, da captura ao <span className="font-display-em">fechamento</span>.
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono uppercase" style={{ fontSize: 9, color: 'var(--text-4)' }}>De</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="De"
              className="text-[10px] font-mono rounded border px-2 py-1" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-2)' }} />
            <span className="font-mono uppercase" style={{ fontSize: 9, color: 'var(--text-4)' }}>Até</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="Até"
              className="text-[10px] font-mono rounded border px-2 py-1" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-2)' }} />
          </div>
        </div>
      </div>

      {/* Funil de conversão por execução do n8n */}
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--rule)' }}>
          <h2 className="font-display" style={{ fontSize: 24, fontWeight: 400, color: 'var(--ink)' }}>Funil de <span className="font-display-em">conversão</span></h2>
          <button onClick={() => onNavigate('funil')} className="font-mono uppercase" style={{ fontSize: 9, color: 'var(--crimson)', letterSpacing: '0.08em', background: 'none', border: 0, cursor: 'pointer' }}>abrir funil →</button>
        </div>
        {/* Funil unificado: cada estágio é uma linha com número, big number e barra proporcional */}
        <div style={{ background: 'var(--bg-paper)', border: '1px solid var(--rule)' }}>
          {stages.length === 0 ? (
            <div className="font-mono" style={{ fontSize: 11, color: 'var(--ink-faint)', padding: 20 }}>Carregando…</div>
          ) : (
            stages.map((s, i) => {
              const width = fmax > 0 ? (s.value / fmax) * 100 : 0;
              const isLast = i === stages.length - 1;
              return (
                <div key={s.n} style={{
                  display: 'grid',
                  gridTemplateColumns: '44px minmax(180px, 220px) minmax(120px, 140px) 1fr auto',
                  alignItems: 'center',
                  columnGap: 20,
                  padding: '18px 24px',
                  borderBottom: isLast ? 'none' : '1px solid var(--rule)',
                }}>
                  {/* Nº do estágio */}
                  <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink-faint)' }}>{s.n}</div>

                  {/* Rótulo + subtítulo */}
                  <div style={{ minWidth: 0 }}>
                    <div className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink-mute)', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{s.sub}</div>
                  </div>

                  {/* Big number */}
                  <div className="font-display" style={{ fontSize: 44, lineHeight: 1, color: TONE[s.tone], fontWeight: 400 }}>
                    {s.value}
                  </div>

                  {/* Barra proporcional ao topo do funil */}
                  <div style={{ background: 'var(--bg-soft)', height: 10, position: 'relative' }}>
                    <div style={{
                      height: '100%', width: `${width}%`, background: TONE[s.tone],
                      transition: 'width .6s', display: 'flex', alignItems: 'center', paddingLeft: 8,
                    }} />
                  </div>

                  {/* Delta / conversão */}
                  <div>
                    {s.chip ? (
                      <span className="font-mono" style={{ fontSize: 11, padding: '3px 8px', background: 'var(--bg-soft)', color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                        {s.chip}
                      </span>
                    ) : (
                      <span className="font-mono uppercase" style={{ fontSize: 9, color: 'var(--text-4)', letterSpacing: '0.1em' }}>topo</span>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {flow && (
            <div className="flex flex-wrap gap-2" style={{ borderTop: '1px solid var(--rule)', padding: '12px 24px' }}>
              <span className="font-mono uppercase" style={{ fontSize: 9, color: 'var(--text-4)', alignSelf: 'center', letterSpacing: '0.1em' }}>Erros:</span>
              <span className="font-mono" style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'var(--bg-soft)', color: flow.framer_falhou > 0 ? 'var(--crimson)' : 'var(--text-3)' }}>Framer disparou sem concluir: <b>{flow.framer_falhou}</b></span>
              <span className="font-mono" style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'var(--bg-soft)', color: flow.pass_falhou > 0 ? 'var(--crimson)' : 'var(--text-3)' }}>Passagem com erro: <b>{flow.pass_falhou}</b></span>
              <span className="font-mono" style={{ fontSize: 9, color: 'var(--text-4)', marginLeft: 'auto', alignSelf: 'center', letterSpacing: '0.1em' }}>por execução do n8n</span>
            </div>
          )}
        </div>
      </div>

      {/* Painéis */}
      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 24 }}>
        <Panel title="Resultado no Pipedrive" eyebrow="passagem de leads">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <MiniCell label="Deals criados" value={flow?.pass_ok ?? '—'} tone="olive" />
            <MiniCell label="Passagens c/ erro" value={flow?.pass_falhou ?? '—'} tone="crimson" right />
            <MiniCell label="Ganhos" value={jstats?.ganho ?? '—'} tone="olive" bottom />
            <MiniCell label="Perdidos" value={jstats?.perdido ?? '—'} tone="ink" right bottom />
          </div>
          <div className="font-mono" style={{ fontSize: 9, color: 'var(--ink-faint)', padding: '10px 20px', borderTop: '1px solid var(--rule)' }}>
            ganho/perdido dependem do sync do Pipedrive (deals_snapshot)
          </div>
        </Panel>

        <Panel title="Jornada dos leads" eyebrow="por lead (base)"
          action={<button onClick={() => onNavigate('funil')} className="font-mono uppercase" style={{ fontSize: 9, color: 'var(--crimson)', background: 'none', border: 0, cursor: 'pointer' }}>ver →</button>}>
          <div>
            {[
              { l: 'Total de leads', v: jstats?.total, t: 'ink' as Tone },
              { l: 'Passaram pelo Backup', v: jstats?.backup, t: 'crimson' as Tone },
              { l: 'Vieram do Framer', v: jstats?.framer, t: 'amber' as Tone },
              { l: 'Chegaram ao RD', v: jstats?.framer_to_rd, t: 'navy' as Tone },
              { l: 'Webinar (separado)', v: jstats?.webinar, t: 'plum' as Tone },
            ].map((r, i, arr) => (
              <div key={r.l} className="flex items-center justify-between" style={{ padding: '12px 20px', borderBottom: i < arr.length - 1 ? '1px solid var(--rule)' : 'none' }}>
                <span style={{ fontSize: 13, color: 'var(--ink-mute)' }}>{r.l}</span>
                <span className="font-mono" style={{ fontSize: 15, fontWeight: 600, color: TONE[r.t] }}>{r.v ?? '—'}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Alertas & qualidade" eyebrow="agora"
          action={<button onClick={() => onNavigate('alertas')} className="font-mono uppercase" style={{ fontSize: 9, color: 'var(--crimson)', background: 'none', border: 0, cursor: 'pointer' }}>ver alertas →</button>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <MiniCell label="Alertas abertos" value={dashboard.openCount} tone={dashboard.openCount > 0 ? 'crimson' : 'olive'} />
            <MiniCell label="Resolvidos hoje" value={dashboard.resolvedToday} tone="olive" right />
            <MiniCell label="Completude 24h" value={`${leadsStats?.completion_rate_24h ?? 0}%`} tone="navy" bottom />
            <MiniCell label="Leads 7d" value={leadsStats?.total_7d ?? 0} tone="ink" right bottom />
          </div>
        </Panel>
      </div>
    </div>
  );
}
