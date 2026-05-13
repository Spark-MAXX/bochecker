import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { type RDSyncLog } from '../lib/rd-schemas';

const SOURCES = [
  { key: '',           label: 'Todas' },
  { key: 'workflows',  label: 'W1 Workflows' },
  { key: 'emails',     label: 'W2 Emails' },
  { key: 'assets',     label: 'Assets' },
];

function statusIcon(s: string) {
  if (s === 'success') return <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#10b981' }} />;
  if (s === 'error')   return <XCircle      className="h-3.5 w-3.5" style={{ color: '#ef4444' }} />;
  return <AlertTriangle className="h-3.5 w-3.5" style={{ color: '#f59e0b' }} />;
}

export default function RDSyncLog() {
  const [data, setData]     = useState<RDSyncLog[]>([]);
  const [source, setSource] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (source) params.set('source', source);
    params.set('limit', '100');
    fetch(`/api/rd/sync-log?${params}`)
      .then(r => r.json()).then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [source]);

  const counts = {
    success: data.filter(d => d.status === 'success').length,
    partial: data.filter(d => d.status === 'partial').length,
    error:   data.filter(d => d.status === 'error').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
            Sync Log <span className="text-cyan-400 font-mono text-sm">// {data.length}</span>
          </h2>
          <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-3)' }}>
            Execuções dos cron jobs de coleta da RD Station.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {SOURCES.map(s => (
            <button key={s.key} onClick={() => setSource(s.key)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                backgroundColor: source === s.key ? 'rgba(6,182,212,0.15)' : 'var(--bg-input)',
                color: source === s.key ? '#06b6d4' : 'var(--text-3)',
                borderColor: 'var(--border)', borderWidth: 1, borderStyle: 'solid',
              }}>{s.label}</button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Sucessos',  v: counts.success, color: '#10b981', icon: CheckCircle2 },
          { label: 'Parciais',  v: counts.partial, color: '#f59e0b', icon: AlertTriangle },
          { label: 'Falhas',    v: counts.error,   color: '#ef4444', icon: XCircle },
        ].map(c => (
          <div key={c.label} className="rounded-xl border p-4 flex items-center justify-between"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{c.label}</div>
              <div className="text-2xl font-bold font-mono mt-0.5" style={{ color: c.color }}>{c.v}</div>
            </div>
            <c.icon className="h-6 w-6 opacity-30" style={{ color: c.color }} />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden border shadow-xl"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <table className="w-full">
          <thead style={{ backgroundColor: 'var(--bg-muted)', borderBottom: '1px solid var(--border)' }}>
            <tr className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
              <th className="p-3 w-6" />
              <th className="p-3 font-semibold text-left">Status</th>
              <th className="p-3 font-semibold text-left">Fonte</th>
              <th className="p-3 font-semibold text-right">Items</th>
              <th className="p-3 font-semibold text-right">Duração</th>
              <th className="p-3 font-semibold text-left">Quando</th>
              <th className="p-3 font-semibold text-left">Data/Hora</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
            {loading && (
              <tr><td colSpan={7} className="p-10 text-center text-[10px] font-mono" style={{ color: 'var(--text-4)' }}>
                Carregando…
              </td></tr>
            )}
            {!loading && data.length === 0 && (
              <tr><td colSpan={7} className="p-10 text-center text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-4)' }}>
                Aguardando primeiros registros //
              </td></tr>
            )}
            {data.map(row => {
              const isExpanded = expanded === row.id;
              const hasMeta = row.metadata && Object.keys(row.metadata).length > 0;
              return (
                <React.Fragment key={row.id}>
                  <tr className="cursor-pointer transition-colors"
                    onClick={() => hasMeta && setExpanded(isExpanded ? null : row.id)}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-muted)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                    <td className="p-3">
                      {hasMeta && (isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--text-3)' }} />
                        : <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--text-4)' }} />)}
                    </td>
                    <td className="p-3"><span className="inline-flex items-center gap-1.5">{statusIcon(row.status)}
                      <span className="text-[11px] font-bold uppercase" style={{
                        color: row.status === 'success' ? '#10b981' : row.status === 'error' ? '#ef4444' : '#f59e0b',
                      }}>{row.status}</span>
                    </span></td>
                    <td className="p-3 text-[11px] font-mono" style={{ color: 'var(--text-2)' }}>
                      {row.source}
                    </td>
                    <td className="p-3 text-right text-[12px] font-bold font-mono" style={{ color: 'var(--text-1)' }}>
                      {row.items_synced ?? '—'}
                    </td>
                    <td className="p-3 text-right text-[11px] font-mono" style={{ color: 'var(--text-3)' }}>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {row.duration_ms != null ? `${(row.duration_ms / 1000).toFixed(1)}s` : '—'}
                      </span>
                    </td>
                    <td className="p-3 text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>
                      {formatDistanceToNow(parseISO(row.created_at), { addSuffix: true, locale: ptBR })}
                    </td>
                    <td className="p-3 text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>
                      {format(parseISO(row.created_at), 'dd/MM/yy HH:mm:ss')}
                    </td>
                  </tr>
                  {isExpanded && hasMeta && (
                    <tr style={{ backgroundColor: 'var(--bg-muted)' }}>
                      <td colSpan={7} className="p-4">
                        <div className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>
                          Metadata
                        </div>
                        <pre className="text-[10px] font-mono overflow-x-auto max-h-60 p-3 rounded-lg border"
                          style={{ color: 'var(--text-2)', backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                          {JSON.stringify(row.metadata, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
