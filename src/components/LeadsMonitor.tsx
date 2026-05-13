import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Users, CheckCircle2, AlertTriangle, Search, ChevronDown, ChevronRight,
  Mail, Phone, Building2, Package, ExternalLink, RefreshCcw, Filter,
} from 'lucide-react';
import type { Lead, LeadsStats } from '../lib/schemas';

const SOURCE_LABELS: Record<string, string> = {
  lp_sprout:    'LP Sprout',
  lp_community: 'LP Community',
  site_spark:   'Site Spark',
  indicacao:    'Indicação',
  rd_pipe:      'RD → Pipedrive',
};

const SOURCE_COLORS: Record<string, string> = {
  lp_sprout:    '#06b6d4',
  lp_community: '#8b5cf6',
  site_spark:   '#22c55e',
  indicacao:    '#f59e0b',
  rd_pipe:      '#ec4899',
};

interface LeadsMonitorProps {
  refreshKey?: number;
}

export default function LeadsMonitor({ refreshKey = 0 }: LeadsMonitorProps) {
  const [leads, setLeads]   = useState<Lead[]>([]);
  const [stats, setStats]   = useState<LeadsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'' | 'completo' | 'incompleto'>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce na busca
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (statusFilter) qs.append('status', statusFilter);
      if (sourceFilter) qs.append('lead_source', sourceFilter);
      if (debouncedSearch) qs.append('search', debouncedSearch);
      qs.append('limit', '100');

      const [leadsRes, statsRes] = await Promise.all([
        fetch(`/api/leads?${qs.toString()}`),
        fetch('/api/leads/stats'),
      ]);
      const leadsJson = leadsRes.ok ? await leadsRes.json() : { data: [] };
      const statsJson = statsRes.ok ? await statsRes.json() : null;
      setLeads(leadsJson.data || []);
      setStats(statsJson);
    } catch (e) { console.error('LeadsMonitor fetch error', e); }
    finally { setLoading(false); }
  }, [statusFilter, sourceFilter, debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  // Distribuição por origem (para o cabeçalho)
  const sourceDistribution = useMemo(() => {
    const m = new Map<string, number>();
    leads.forEach(l => {
      if (l.lead_source) m.set(l.lead_source, (m.get(l.lead_source) || 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="p-4 border-b flex flex-wrap gap-3 justify-between items-center"
        style={{ backgroundColor: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="text-sm font-semibold tracking-wide uppercase flex items-center gap-2"
            style={{ color: 'var(--text-2)' }}>
            <Users className="h-4 w-4" />
            Monitor de Leads
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3"
              style={{ color: 'var(--text-4)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar nome, email, empresa..."
              className="pl-7 pr-3 py-1 text-[10px] font-mono rounded border outline-none focus:ring-1 focus:ring-emerald-500 w-56"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border)',
                color: 'var(--text-2)',
              }}
            />
          </div>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
            className="border rounded px-2 py-1 text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
            <option value="">Todos</option>
            <option value="completo">Completos</option>
            <option value="incompleto">Incompletos</option>
          </select>

          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
            className="border rounded px-2 py-1 text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
            <option value="">Todas origens</option>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 text-[10px] font-mono transition-colors disabled:opacity-40 hover:text-emerald-500 px-2 py-1"
            style={{ color: 'var(--text-3)' }}>
            <RefreshCcw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            SYNC
          </button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px"
          style={{ backgroundColor: 'var(--border)' }}>
          <StatCell
            label="Completos (24h)"
            value={stats.completos_24h}
            tone="success"
            sub={`${stats.completion_rate_24h}% taxa`}
          />
          <StatCell
            label="Incompletos (24h)"
            value={stats.incompletos_24h}
            tone="warning"
            sub={`${stats.total_24h} total`}
          />
          <StatCell
            label="Hoje"
            value={stats.total_today}
            tone="info"
            sub={`${stats.completos_today} OK · ${stats.incompletos_today} falhos`}
          />
          <StatCell
            label="7 dias"
            value={stats.total_7d}
            tone="neutral"
            sub={`${stats.completion_rate_7d}% completos`}
          />
        </div>
      )}

      {/* Distribuição por origem */}
      {sourceDistribution.length > 0 && (
        <div className="px-4 py-2 border-b flex items-center gap-3 flex-wrap"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>
            Origens visíveis:
          </span>
          {sourceDistribution.map(([src, n]) => (
            <div key={src} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SOURCE_COLORS[src] || '#94a3b8' }} />
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>
                {SOURCE_LABELS[src] || src} <span className="font-bold" style={{ color: 'var(--text-1)' }}>{n}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Lista de leads */}
      <div className="max-h-[600px] overflow-y-auto">
        {loading && leads.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-3">
            <RefreshCcw className="h-7 w-7 text-emerald-500 animate-spin" />
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
              Carregando leads...
            </span>
          </div>
        ) : leads.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2"
            style={{ color: 'var(--text-4)' }}>
            <Filter className="h-6 w-6 opacity-40" />
            <span className="text-[11px] font-mono uppercase tracking-widest">
              Nenhum lead encontrado // aguardando captura
            </span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="border-b sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
              <tr className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                <th className="p-3 font-semibold w-4" />
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Lead</th>
                <th className="p-3 font-semibold">Origem</th>
                <th className="p-3 font-semibold">Workflow</th>
                <th className="p-3 font-semibold">Recebido</th>
                <th className="p-3 font-semibold text-right">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
              {leads.map(lead => {
                const isExpanded = expanded === lead.id;
                const isComplete = lead.status === 'completo';
                const leftBorder = isComplete ? '#10b981' : '#f59e0b';
                const rowBg = isComplete ? 'rgba(16,185,129,0.04)' : 'rgba(245,158,11,0.04)';
                const n8nBase = 'https://growthsparkmaxx.app.n8n.cloud';

                return (
                  <React.Fragment key={lead.id}>
                    <tr
                      className="group transition-colors cursor-pointer border-l-2"
                      style={{ borderLeftColor: leftBorder, backgroundColor: rowBg }}
                      onClick={() => setExpanded(isExpanded ? null : lead.id)}
                    >
                      <td className="pl-3 pr-0">
                        {isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--text-3)' }} />
                          : <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--text-4)' }} />}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {isComplete ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                            style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)' }}>
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Completo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                            style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' }}>
                            <AlertTriangle className="h-2.5 w-2.5" />
                            Incompleto
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                          {lead.lead_nome || <span style={{ color: 'var(--text-4)' }}>—</span>}
                        </div>
                        <div className="text-[10px] font-mono break-all" style={{ color: 'var(--text-2)' }}>
                          {lead.lead_email || <span style={{ color: 'var(--text-4)' }}>sem email</span>}
                        </div>
                        {lead.lead_empresa && (
                          <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                            {lead.lead_empresa}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {lead.lead_source ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold border"
                            style={{
                              borderColor: SOURCE_COLORS[lead.lead_source] || 'var(--border)',
                              color: SOURCE_COLORS[lead.lead_source] || 'var(--text-3)',
                              backgroundColor: `${SOURCE_COLORS[lead.lead_source] || '#94a3b8'}15`,
                            }}>
                            {SOURCE_LABELS[lead.lead_source] || lead.lead_source}
                          </span>
                        ) : <span className="text-[10px]" style={{ color: 'var(--text-4)' }}>—</span>}
                      </td>
                      <td className="p-3 text-[10px] font-mono" style={{ color: 'var(--text-2)' }}>
                        {lead.workflow_name}
                      </td>
                      <td className="p-3 text-[10px] font-mono whitespace-nowrap" style={{ color: 'var(--text-2)' }}>
                        {format(new Date(lead.created_at), 'HH:mm:ss')}
                        <br />
                        <span style={{ color: 'var(--text-3)' }}>
                          {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </td>
                      <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                        {lead.execution_id ? (
                          <a href={`${n8nBase}/workflow/${lead.workflow_id}/executions/${lead.execution_id}`}
                            target="_blank" rel="noreferrer"
                            className="inline-block p-1.5 rounded-lg transition-all hover:text-cyan-500"
                            style={{ color: 'var(--text-3)' }} title="Ver execução no n8n">
                            <ExternalLink size={14} />
                          </a>
                        ) : (
                          <span className="text-[10px]" style={{ color: 'var(--text-4)' }}>—</span>
                        )}
                      </td>
                    </tr>

                    <AnimatePresence>
                      {isExpanded && (
                        <tr style={{ backgroundColor: 'var(--bg-muted)' }}>
                          <td colSpan={7} className="px-6 py-4 border-l-2"
                            style={{ borderLeftColor: leftBorder }}>
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.15 }}
                              className="space-y-3">

                              {/* Campos extraídos */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                                <Field icon={<Mail className="h-3 w-3" />} label="Email" value={lead.lead_email} />
                                <Field icon={<Phone className="h-3 w-3" />} label="Telefone" value={lead.lead_telefone} />
                                <Field icon={<Building2 className="h-3 w-3" />} label="Empresa" value={lead.lead_empresa} />
                                <Field icon={<Package className="h-3 w-3" />} label="Produto" value={lead.produto} />
                              </div>

                              {/* Campos faltantes (se incompleto) */}
                              {!isComplete && (lead.campos_faltantes?.length ?? 0) > 0 && (
                                <div>
                                  <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
                                    style={{ color: 'var(--c-warning)' }}>
                                    Campos faltantes ({lead.campos_faltantes!.length})
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {lead.campos_faltantes!.map(c => (
                                      <span key={c} className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold border"
                                        style={{
                                          color: '#f59e0b',
                                          borderColor: 'rgba(245,158,11,0.4)',
                                          backgroundColor: 'rgba(245,158,11,0.1)',
                                        }}>
                                        {c}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Payload */}
                              {lead.payload_original && (
                                <div>
                                  <div className="text-[10px] font-mono uppercase tracking-wider mb-1.5"
                                    style={{ color: 'var(--text-3)' }}>
                                    Payload original
                                  </div>
                                  <pre className="text-[10px] font-mono overflow-x-auto max-h-48 p-3 rounded-lg border"
                                    style={{
                                      color: 'var(--text-2)',
                                      backgroundColor: 'var(--bg-card)',
                                      borderColor: 'var(--border)',
                                    }}>
                                    {JSON.stringify(lead.payload_original, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {lead.execution_id && (
                                <div className="text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>
                                  Execution ID: <span style={{ color: 'var(--text-2)' }}>{lead.execution_id}</span>
                                </div>
                              )}
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
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function StatCell({ label, value, tone, sub }: {
  label: string; value: number; tone: 'success' | 'warning' | 'info' | 'neutral'; sub?: string;
}) {
  const toneColor = {
    success: '#10b981',
    warning: '#f59e0b',
    info: '#06b6d4',
    neutral: 'var(--text-2)',
  }[tone];

  return (
    <div className="p-3" style={{ backgroundColor: 'var(--bg-card)' }}>
      <div className="text-[9px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>
        {label}
      </div>
      <div className="text-xl font-bold font-mono" style={{ color: toneColor }}>
        {value}
      </div>
      {sub && (
        <div className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--text-3)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5" style={{ color: 'var(--text-4)' }}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>
          {label}
        </div>
        <div className="font-mono break-all" style={{ color: value ? 'var(--text-1)' : 'var(--text-4)' }}>
          {value || '—'}
        </div>
      </div>
    </div>
  );
}
