import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LineChart, Line, ResponsiveContainer, YAxis, Tooltip,
} from 'recharts';
import { ChevronDown, ChevronRight, ExternalLink, Search, ArrowUpDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { nFmt, pctFixed, type RDWorkflowWithLatest, type RDWorkflowMetric } from '../lib/rd-schemas';

type SortKey = 'name' | 'sent' | 'open' | 'click' | 'bounce' | 'updated';
type SortDir = 'asc' | 'desc';

function statusBadge(status: string | null) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    enabled:  { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'ENABLED' },
    disabled: { color: '#64748b', bg: 'rgba(100,116,139,0.10)', label: 'DISABLED' },
    archived: { color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', label: 'ARCHIVED' },
  };
  const s = map[status || ''] || { color: 'var(--text-3)', bg: 'var(--bg-muted)', label: (status || '—').toUpperCase() };
  return (
    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase inline-block"
      style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.color}40` }}>
      {s.label}
    </span>
  );
}

function MiniSparkline({ data }: { data: { date: string; open_rate: number | null }[] }) {
  if (!data?.length) return <span className="text-[9px] font-mono" style={{ color: 'var(--text-4)' }}>—</span>;
  return (
    <div className="w-24 h-8">
      <ResponsiveContainer>
        <LineChart data={data}>
          <YAxis hide domain={[0, 'dataMax']} />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 10 }}
            formatter={(v: any) => [`${Number(v).toFixed(2)}%`, 'open rate']}
            labelFormatter={(l: any) => format(parseISO(l), 'dd/MM')} />
          <Line type="monotone" dataKey="open_rate" stroke="#06b6d4" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function HistoryPanel({ workflowId }: { workflowId: string }) {
  const [history, setHistory] = useState<RDWorkflowMetric[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/rd/workflows/${workflowId}/history?days=30`)
      .then(r => r.json()).then(d => { setHistory(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [workflowId]);

  if (loading) return <div className="p-3 text-[10px] font-mono" style={{ color: 'var(--text-4)' }}>Carregando histórico…</div>;
  if (history.length === 0) return <div className="p-3 text-[10px] font-mono" style={{ color: 'var(--text-4)' }}>Sem snapshots nos últimos 30d</div>;

  return (
    <div className="p-3">
      <div className="text-[10px] font-mono uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-3)' }}>
        Histórico — últimos 30 dias
      </div>
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-light)' }}>
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-3)' }}>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Data</th>
              <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Enviados</th>
              <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Entregues</th>
              <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Open</th>
              <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Click</th>
              <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Bounce</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
            {[...history].reverse().slice(0, 30).map((m, i) => (
              <tr key={i} style={{ color: 'var(--text-2)' }}>
                <td className="px-3 py-1.5">{format(parseISO(m.snapshot_date), 'dd/MM/yy')}</td>
                <td className="px-3 py-1.5 text-right">{nFmt(m.total_sent)}</td>
                <td className="px-3 py-1.5 text-right">{nFmt(m.total_delivered)}</td>
                <td className="px-3 py-1.5 text-right" style={{ color: '#f59e0b' }}>{pctFixed(m.open_rate)}</td>
                <td className="px-3 py-1.5 text-right" style={{ color: '#a855f7' }}>{pctFixed(m.click_rate)}</td>
                <td className="px-3 py-1.5 text-right" style={{ color: '#ef4444' }}>{pctFixed(m.bounce_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RDWorkflowsTable() {
  const [data, setData]       = useState<RDWorkflowWithLatest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState<string>('');
  const [sortBy, setSortBy]   = useState<SortKey>('sent');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    fetch(`/api/rd/workflows?${params}`)
      .then(r => r.json()).then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status]);

  const sorted = useMemo(() => {
    const filtered = data.filter(w => !search || w.name.toLowerCase().includes(search.toLowerCase()));
    const dir = sortDir === 'asc' ? 1 : -1;
    const pick: Record<SortKey, (w: RDWorkflowWithLatest) => any> = {
      name:    w => w.name.toLowerCase(),
      sent:    w => w.latest_metric?.total_sent ?? -1,
      open:    w => w.latest_metric?.open_rate ?? -1,
      click:   w => w.latest_metric?.click_rate ?? -1,
      bounce:  w => w.latest_metric?.bounce_rate ?? -1,
      updated: w => w.rd_updated_at ?? '',
    };
    return [...filtered].sort((a, b) => {
      const va = pick[sortBy](a); const vb = pick[sortBy](b);
      if (va < vb) return -1 * dir;
      if (va > vb) return  1 * dir;
      return 0;
    });
  }, [data, search, sortBy, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortBy === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(k); setSortDir(k === 'name' ? 'asc' : 'desc'); }
  };

  const SortTh: React.FC<{ k: SortKey; children: React.ReactNode; align?: 'left' | 'right' }> = ({ k, children, align = 'left' }) => (
    <th onClick={() => toggleSort(k)}
      className={`p-3 font-semibold text-[10px] uppercase tracking-wider cursor-pointer select-none transition-colors text-${align}`}
      style={{ color: sortBy === k ? '#06b6d4' : 'var(--text-3)' }}>
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </span>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
            Workflows RD <span className="text-cyan-400 font-mono text-sm">// {sorted.length}</span>
          </h2>
          <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-3)' }}>
            Coletados pelo W1 (cron 06:00 BRT). Clique numa linha para ver o histórico de snapshots.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-3)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar workflow…"
              className="pl-8 pr-3 py-1.5 rounded-lg border outline-none text-[11px] font-mono w-56 focus:ring-1 focus:ring-cyan-500"
              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-1)' }} />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase outline-none cursor-pointer"
            style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
            <option value="">Status: Todos</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden border shadow-xl"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <table className="w-full">
          <thead style={{ backgroundColor: 'var(--bg-muted)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th className="p-3 w-6" />
              <SortTh k="name">Workflow</SortTh>
              <SortTh k="updated">Status</SortTh>
              <SortTh k="sent" align="right">Enviados</SortTh>
              <SortTh k="open" align="right">Open</SortTh>
              <SortTh k="click" align="right">Click</SortTh>
              <SortTh k="bounce" align="right">Bounce</SortTh>
              <th className="p-3 font-semibold text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Tendência</th>
              <th className="p-3 w-6" />
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
            {loading && (
              <tr><td colSpan={9} className="p-10 text-center text-[10px] font-mono" style={{ color: 'var(--text-4)' }}>
                Carregando workflows…
              </td></tr>
            )}
            {!loading && sorted.length === 0 && (
              <tr><td colSpan={9} className="p-10 text-center text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-4)' }}>
                Nenhum workflow encontrado //
              </td></tr>
            )}
            {sorted.map(w => {
              const isExpanded = expanded === w.id;
              const m = w.latest_metric;
              return (
                <React.Fragment key={w.id}>
                  <tr className="cursor-pointer transition-colors group"
                    onClick={() => setExpanded(isExpanded ? null : w.id)}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-muted)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                    <td className="p-3">
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--text-3)' }} />
                        : <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--text-4)' }} />}
                    </td>
                    <td className="p-3">
                      <div className="text-[12px] font-semibold" style={{ color: 'var(--text-1)' }}>{w.name}</div>
                      <div className="text-[9px] font-mono" style={{ color: 'var(--text-4)' }}>
                        {w.user_email_created || '—'}
                      </div>
                    </td>
                    <td className="p-3">{statusBadge(w.status)}</td>
                    <td className="p-3 text-right text-[12px] font-bold font-mono" style={{ color: 'var(--text-1)' }}>
                      {m ? nFmt(m.total_sent) : '—'}
                    </td>
                    <td className="p-3 text-right text-[12px] font-mono" style={{ color: '#f59e0b' }}>
                      {m ? pctFixed(m.open_rate) : '—'}
                    </td>
                    <td className="p-3 text-right text-[12px] font-mono" style={{ color: '#a855f7' }}>
                      {m ? pctFixed(m.click_rate) : '—'}
                    </td>
                    <td className="p-3 text-right text-[12px] font-mono" style={{ color: '#ef4444' }}>
                      {m ? pctFixed(m.bounce_rate) : '—'}
                    </td>
                    <td className="p-3"><MiniSparkline data={w.trend7d || []} /></td>
                    <td className="p-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <a href={`https://app.rdstation.com.br/automacao/workflow/${w.id}`}
                        target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="p-1 rounded hover:text-cyan-500 transition-colors inline-block"
                        style={{ color: 'var(--text-3)' }} title="Abrir no RD">
                        <ExternalLink size={14} />
                      </a>
                    </td>
                  </tr>
                  <AnimatePresence>
                    {isExpanded && (
                      <tr style={{ backgroundColor: 'var(--bg-muted)' }}>
                        <td colSpan={9}>
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                            <HistoryPanel workflowId={w.id} />
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
