import React, { useEffect, useMemo, useState } from 'react';
import { Search, ArrowUpDown, ExternalLink, Send } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { nFmt, pctFixed, type RDEmailWithLatest } from '../lib/rd-schemas';

type SortKey = 'name' | 'sent' | 'open' | 'click' | 'bounce' | 'ctor' | 'send_at';
type SortDir = 'asc' | 'desc';

function statusBadge(status: string | null) {
  const map: Record<string, { color: string; bg: string }> = {
    sent:        { color: '#10b981', bg: 'rgba(16,185,129,0.10)' },
    sending:     { color: '#06b6d4', bg: 'rgba(6,182,212,0.10)' },
    scheduled:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
    draft:       { color: '#64748b', bg: 'rgba(100,116,139,0.10)' },
    cancelled:   { color: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
  };
  const s = map[status || ''] || { color: 'var(--text-3)', bg: 'var(--bg-muted)' };
  return (
    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase inline-block"
      style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.color}40` }}>
      {status || 'N/A'}
    </span>
  );
}

function colorByRate(rate: number | null | undefined, type: 'good' | 'bad' = 'good'): string {
  if (rate == null) return 'var(--text-3)';
  if (type === 'good') {
    if (rate >= 20) return '#10b981';
    if (rate >= 10) return '#f59e0b';
    return '#ef4444';
  }
  // bad: lower is better (bounce)
  if (rate <= 1)  return '#10b981';
  if (rate <= 3)  return '#f59e0b';
  return '#ef4444';
}

export default function RDEmailsTable() {
  const [data, setData]       = useState<RDEmailWithLatest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState<string>('');
  const [sortBy, setSortBy]   = useState<SortKey>('send_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('limit', '500');
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    fetch(`/api/rd/emails?${params}`)
      .then(r => r.json()).then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status, search]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const pick: Record<SortKey, (e: RDEmailWithLatest) => any> = {
      name:    e => e.name.toLowerCase(),
      sent:    e => e.latest_metric?.sent ?? -1,
      open:    e => e.latest_metric?.open_rate ?? -1,
      click:   e => e.latest_metric?.click_rate ?? -1,
      bounce:  e => e.latest_metric?.bounce_rate ?? -1,
      ctor:    e => e.latest_metric?.ctor ?? -1,
      send_at: e => e.send_at ?? '',
    };
    return [...data].sort((a, b) => {
      const va = pick[sortBy](a); const vb = pick[sortBy](b);
      if (va < vb) return -1 * dir;
      if (va > vb) return  1 * dir;
      return 0;
    });
  }, [data, sortBy, sortDir]);

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

  // Resumo agregado (acima da tabela)
  const summary = useMemo(() => {
    const acc = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
    data.forEach(e => {
      const m = e.latest_metric;
      if (!m) return;
      acc.sent += m.sent; acc.delivered += m.delivered; acc.opened += m.unique_opens || m.opened;
      acc.clicked += m.unique_clicks || m.clicked; acc.bounced += m.bounced;
    });
    return acc;
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
            Emails RD <span className="text-cyan-400 font-mono text-sm">// {sorted.length}</span>
          </h2>
          <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-3)' }}>
            Coletados pelo W2 (cron 06:15 BRT). Métricas do snapshot mais recente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-3)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar email…"
              className="pl-8 pr-3 py-1.5 rounded-lg border outline-none text-[11px] font-mono w-56 focus:ring-1 focus:ring-cyan-500"
              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-1)' }} />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase outline-none cursor-pointer"
            style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
            <option value="">Status: Todos</option>
            <option value="sent">Enviado</option>
            <option value="scheduled">Agendado</option>
            <option value="draft">Rascunho</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Summary mini-cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Enviados',  v: summary.sent,      color: '#06b6d4' },
          { label: 'Entregues', v: summary.delivered, color: '#10b981' },
          { label: 'Abertos',   v: summary.opened,    color: '#f59e0b' },
          { label: 'Cliques',   v: summary.clicked,   color: '#a855f7' },
          { label: 'Bounces',   v: summary.bounced,   color: '#ef4444' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border p-3"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{c.label}</div>
            <div className="text-lg font-bold font-mono mt-0.5" style={{ color: c.color }}>{nFmt(c.v)}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden border shadow-xl"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <table className="w-full">
          <thead style={{ backgroundColor: 'var(--bg-muted)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <SortTh k="name">Email</SortTh>
              <th className="p-3 font-semibold text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Status</th>
              <SortTh k="send_at">Envio</SortTh>
              <SortTh k="sent" align="right">Enviados</SortTh>
              <SortTh k="open" align="right">Open</SortTh>
              <SortTh k="ctor" align="right">CTOR</SortTh>
              <SortTh k="click" align="right">Click</SortTh>
              <SortTh k="bounce" align="right">Bounce</SortTh>
              <th className="p-3 w-6" />
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
            {loading && (
              <tr><td colSpan={9} className="p-10 text-center text-[10px] font-mono" style={{ color: 'var(--text-4)' }}>
                Carregando emails…
              </td></tr>
            )}
            {!loading && sorted.length === 0 && (
              <tr><td colSpan={9} className="p-10 text-center text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-4)' }}>
                {data.length === 0 ? 'W2 ainda não populou rd_emails //' : 'Sem emails para o filtro //'}
              </td></tr>
            )}
            {sorted.map(e => {
              const m = e.latest_metric;
              return (
                <tr key={e.id} className="group transition-colors"
                  onMouseEnter={ev => (ev.currentTarget.style.backgroundColor = 'var(--bg-muted)')}
                  onMouseLeave={ev => (ev.currentTarget.style.backgroundColor = '')}>
                  <td className="p-3 max-w-md">
                    <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--text-1)' }} title={e.name}>{e.name}</div>
                    <div className="text-[9px] font-mono" style={{ color: 'var(--text-4)' }}>
                      {e.type || '—'} {e.is_predictive_sending && '· predictive'}
                    </div>
                  </td>
                  <td className="p-3">{statusBadge(e.status)}</td>
                  <td className="p-3 text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>
                    {e.send_at ? format(parseISO(e.send_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}
                  </td>
                  <td className="p-3 text-right text-[12px] font-bold font-mono" style={{ color: 'var(--text-1)' }}>
                    {m ? nFmt(m.sent) : '—'}
                  </td>
                  <td className="p-3 text-right text-[12px] font-mono" style={{ color: colorByRate(m?.open_rate) }}>
                    {m ? pctFixed(m.open_rate) : '—'}
                  </td>
                  <td className="p-3 text-right text-[12px] font-mono" style={{ color: colorByRate(m?.ctor) }}>
                    {m ? pctFixed(m.ctor) : '—'}
                  </td>
                  <td className="p-3 text-right text-[12px] font-mono" style={{ color: colorByRate(m?.click_rate) }}>
                    {m ? pctFixed(m.click_rate) : '—'}
                  </td>
                  <td className="p-3 text-right text-[12px] font-mono" style={{ color: colorByRate(m?.bounce_rate, 'bad') }}>
                    {m ? pctFixed(m.bounce_rate) : '—'}
                  </td>
                  <td className="p-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={`https://app.rdstation.com.br/email/${e.id}`} target="_blank" rel="noreferrer"
                      className="p-1 rounded hover:text-cyan-500 transition-colors inline-block"
                      style={{ color: 'var(--text-3)' }} title="Abrir no RD">
                      <ExternalLink size={14} />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
