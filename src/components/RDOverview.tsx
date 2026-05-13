import React, { useEffect, useState } from 'react';
import { Send, MailCheck, Eye, MousePointerClick, AlertOctagon, UserMinus, Activity, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import KpiCard from './KpiCard';
import RDFunnel from './RDFunnel';
import RDTimeSeries from './RDTimeSeries';
import { nFmt, pctFixed, type RDOverview as RDOverviewType, type RDTimeseriesPoint, type RDFunnel as RDFunnelType, type RDWorkflowWithLatest, type RDEmailWithLatest } from '../lib/rd-schemas';

interface Props { }

export default function RDOverview({ }: Props) {
  const [overview, setOverview]   = useState<RDOverviewType | null>(null);
  const [ts, setTs]               = useState<RDTimeseriesPoint[]>([]);
  const [funnel, setFunnel]       = useState<RDFunnelType | null>(null);
  const [topWf, setTopWf]         = useState<RDWorkflowWithLatest[]>([]);
  const [worstEm, setWorstEm]     = useState<RDEmailWithLatest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [days, setDays]           = useState(30);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetch('/api/rd/overview').then(r => r.json()).catch(() => null),
      fetch(`/api/rd/timeseries?days=${days}`).then(r => r.json()).catch(() => []),
      fetch('/api/rd/funnel').then(r => r.json()).catch(() => null),
      fetch('/api/rd/workflows/top?limit=5').then(r => r.json()).catch(() => []),
      fetch('/api/rd/emails/worst?limit=5&minSent=10').then(r => r.json()).catch(() => []),
    ]).then(([o, t, f, top, worst]) => {
      if (!alive) return;
      setOverview(o); setTs(Array.isArray(t) ? t : []); setFunnel(f);
      setTopWf(Array.isArray(top) ? top : []); setWorstEm(Array.isArray(worst) ? worst : []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [days]);

  const ov = overview;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      {/* Header info */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
            RD Station <span className="text-cyan-400 font-mono text-sm">// Visão Geral</span>
          </h2>
          <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-3)' }}>
            {ov?.snapshot_date
              ? `Snapshot mais recente: ${format(parseISO(ov.snapshot_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
              : 'Aguardando primeiro snapshot do Workflow 1 (cron 06:00 BRT)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Janela:</span>
          {[7, 14, 30, 60, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className="px-2.5 py-1 rounded text-[10px] font-bold font-mono transition-all"
              style={{
                backgroundColor: days === d ? 'rgba(6,182,212,0.15)' : 'var(--bg-input)',
                color: days === d ? '#06b6d4' : 'var(--text-3)',
                borderColor: 'var(--border)', borderWidth: 1, borderStyle: 'solid',
              }}>{d}d</button>
          ))}
        </div>
      </div>

      {/* KPI Grid — linha 1: volume */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Workflows Ativos" value={ov ? `${ov.enabled_workflows}/${ov.total_workflows}` : '—'}
          hint="enabled" icon={Activity} accent="cyan" loading={loading} />
        <KpiCard label="Emails Cadastrados" value={ov ? nFmt(ov.total_emails) : '—'}
          hint="total" icon={Mail} accent="sky" loading={loading} />
        <KpiCard label="Enviados" value={ov ? nFmt(ov.sent) : '—'}
          delta={ov?.delta?.sent ?? null} deltaSuffix="%" icon={Send} accent="cyan" loading={loading} />
        <KpiCard label="Entregues" value={ov ? nFmt(ov.delivered) : '—'}
          hint={ov ? pctFixed(ov.delivery_rate) + ' delivery' : undefined}
          icon={MailCheck} accent="emerald" loading={loading} />
      </div>

      {/* KPI Grid — linha 2: engajamento */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Open Rate" value={ov ? pctFixed(ov.open_rate) : '—'}
          delta={ov?.delta?.open_rate ?? null} deltaSuffix="pp" icon={Eye} accent="amber" loading={loading} />
        <KpiCard label="Click Rate" value={ov ? pctFixed(ov.click_rate) : '—'}
          delta={ov?.delta?.click_rate ?? null} deltaSuffix="pp" icon={MousePointerClick} accent="violet" loading={loading} />
        <KpiCard label="Bounce Rate" value={ov ? pctFixed(ov.bounce_rate) : '—'}
          delta={ov?.delta?.bounce_rate ?? null} deltaSuffix="pp" icon={AlertOctagon} accent="rose" loading={loading} />
        <KpiCard label="Unsubscribe" value={ov ? pctFixed(ov.unsubscribe_rate) : '—'}
          hint={ov ? `${nFmt(ov.unsubscribed)} optouts` : undefined}
          icon={UserMinus} accent="rose" loading={loading} />
      </div>

      {/* Time series + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RDTimeSeries data={ts} loading={loading} />
        </div>
        <RDFunnel funnel={funnel} loading={loading} />
      </div>

      {/* Top workflows + Worst emails */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top workflows */}
        <div className="border p-6 rounded-2xl shadow-xl" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>
              Top Workflows por Volume
            </h3>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-4)' }}>último snapshot</span>
          </div>
          {topWf.length === 0 ? (
            <p className="text-[10px] font-mono text-center py-8" style={{ color: 'var(--text-4)' }}>
              {loading ? 'Carregando…' : 'Sem dados ainda'}
            </p>
          ) : (
            <div className="space-y-3">
              {topWf.map((w, i) => {
                const sent = w.latest_metric?.total_sent || 0;
                const max = topWf[0]?.latest_metric?.total_sent || 1;
                const open = w.latest_metric?.open_rate ?? 0;
                return (
                  <div key={w.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-1)' }} title={w.name}>
                        {w.name}
                      </span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>
                          {pctFixed(open)} open
                        </span>
                        <span className="text-sm font-bold font-mono text-cyan-400">{nFmt(sent)}</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-muted)' }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(sent / max) * 100}%` }}
                        transition={{ duration: 0.8, delay: i * 0.05 }}
                        className="h-full rounded-full" style={{ backgroundColor: '#06b6d4' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Worst emails */}
        <div className="border p-6 rounded-2xl shadow-xl" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>
              Emails com Pior Performance
            </h3>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-4)' }}>open rate ↓</span>
          </div>
          {worstEm.length === 0 ? (
            <p className="text-[10px] font-mono text-center py-8" style={{ color: 'var(--text-4)' }}>
              {loading ? 'Carregando…' : 'Aguardando emails enviados'}
            </p>
          ) : (
            <div className="space-y-3">
              {worstEm.map((e) => {
                const open = e.latest_metric?.open_rate ?? 0;
                return (
                  <div key={e.id} className="flex items-center justify-between gap-3 pb-2"
                    style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-1)' }} title={e.name}>
                        {e.name}
                      </div>
                      <div className="text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>
                        {nFmt(e.latest_metric?.sent ?? 0)} enviados · {nFmt(e.latest_metric?.delivered ?? 0)} entregues
                      </div>
                    </div>
                    <span className="text-sm font-bold font-mono shrink-0"
                      style={{ color: open < 10 ? '#ef4444' : open < 20 ? '#f59e0b' : '#10b981' }}>
                      {pctFixed(open)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Last sync info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { key: 'workflows', label: 'W1 — Coleta Workflows', sync: ov?.last_sync.workflows, color: '#06b6d4' },
          { key: 'emails',    label: 'W2 — Coleta Emails',    sync: ov?.last_sync.emails,    color: '#a855f7' },
        ].map(s => (
          <div key={s.key} className="rounded-xl border p-4 flex items-center gap-4"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}` }} />
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{s.label}</div>
              <div className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-1)' }}>
                {s.sync
                  ? `${s.sync.status === 'success' ? '✓' : s.sync.status === 'error' ? '✗' : '⚠'} ${s.sync.items_synced || 0} items · ${
                      s.sync.duration_ms ? (s.sync.duration_ms / 1000).toFixed(1) + 's' : '—'
                    } · ${format(parseISO(s.sync.created_at), "dd/MM HH:mm", { locale: ptBR })}`
                  : 'Nunca executou'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
