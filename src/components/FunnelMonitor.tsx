import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  GitBranch, CheckCircle2, AlertTriangle, XCircle, Search, ChevronDown, ChevronRight,
  Mail, Phone, Building2, Package, ExternalLink, RefreshCcw, Filter, Copy, Route, Briefcase, Trash2,
} from 'lucide-react';
import type { UnifiedLead, FunnelStats, LeadSourceKey, FunnelStage, Health } from '../lib/schemas';

// Paleta terrosa (warm) — alinhada ao tema editorial
const SOURCE_COLORS: Record<string, string> = {
  framer: '#7CA5DA',        // navy
  rd_pipedrive: '#E08369',  // crimson
  webinar: '#BD8AA8',       // plum
};

const STAGE_COLORS: Record<FunnelStage, string> = {
  incompleto: '#D49555',          // amber
  capturado: '#7CA5DA',           // navy
  inscrito: '#BD8AA8',            // plum
  nao_processado: '#E08369',      // crimson
  processado_sem_deal: '#D49555', // amber
  deal_criado: '#A8B782',         // olive
  deal_ganho: '#A8B782',          // olive
  deal_perdido: '#9B9690',        // mute
};

const HEALTH_META: Record<Health, { color: string; icon: React.ReactNode; label: string }> = {
  ok:      { color: '#A8B782', icon: <CheckCircle2 className="h-2.5 w-2.5" />, label: 'OK' },
  atencao: { color: '#D49555', icon: <AlertTriangle className="h-2.5 w-2.5" />, label: 'Atenção' },
  erro:    { color: '#E08369', icon: <XCircle className="h-2.5 w-2.5" />, label: 'Problema' },
};

const n8nBase = 'https://growthsparkmaxx.app.n8n.cloud';
const PERIODS = [
  { key: 'h24', label: '24h' },
  { key: 'hoje', label: 'Hoje' },
  { key: 'd7', label: '7 dias' },
] as const;

export default function FunnelMonitor({ refreshKey = 0 }: { refreshKey?: number }) {
  const [leads, setLeads] = useState<UnifiedLead[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<FunnelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [period, setPeriod] = useState<'h24' | 'hoje' | 'd7'>('d7');

  const [sourceFilter, setSourceFilter] = useState<'' | LeadSourceKey>('');
  const [stageFilter, setStageFilter] = useState<'' | FunnelStage>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'completo' | 'incompleto'>('');
  const [healthFilter, setHealthFilter] = useState<'' | Health>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [problemOnly, setProblemOnly] = useState(false);
  const [dupOnly, setDupOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Limpeza das bases (gated por X-Webhook-Secret)
  const [adminSecret, setAdminSecret] = useState<string>(() => localStorage.getItem('spark-admin-secret') || '');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (sourceFilter) qs.append('source', sourceFilter);
      if (stageFilter) qs.append('stage', stageFilter);
      if (statusFilter) qs.append('status', statusFilter);
      if (healthFilter) qs.append('health', healthFilter);
      if (problemOnly) qs.append('problem', '1');
      if (dupOnly) qs.append('dup', '1');
      if (debouncedSearch) qs.append('search', debouncedSearch);
      if (fromDate) qs.append('from', new Date(fromDate + 'T00:00:00').toISOString());
      if (toDate) qs.append('to', new Date(toDate + 'T23:59:59').toISOString());
      qs.append('limit', '500');

      const [leadsRes, statsRes] = await Promise.all([
        fetch(`/api/leads/unified?${qs.toString()}`),
        fetch('/api/leads/unified-stats'),
      ]);
      const leadsJson = leadsRes.ok ? await leadsRes.json() : { data: [], total: 0 };
      const statsJson = statsRes.ok ? await statsRes.json() : null;
      setLeads(leadsJson.data || []);
      setTotal(leadsJson.total || 0);
      setStats(statsJson);
    } catch (e) { console.error('FunnelMonitor fetch error', e); }
    finally { setLoading(false); }
  }, [sourceFilter, stageFilter, statusFilter, healthFilter, problemOnly, dupOnly, debouncedSearch, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  const ensureSecret = (): string | null => {
    let s = adminSecret;
    if (!s) {
      s = (window.prompt('Senha de admin (o mesmo valor de WEBHOOK_SECRET):') || '').trim();
      if (!s) return null;
      setAdminSecret(s); localStorage.setItem('spark-admin-secret', s);
    }
    return s;
  };
  const clearSecret = () => { localStorage.removeItem('spark-admin-secret'); setAdminSecret(''); };

  const toggleSelecting = () => {
    if (selecting) { setSelecting(false); setSelected(new Set()); return; }
    if (!ensureSecret()) return;
    setExpanded(null); setSelecting(true);
  };

  const toggleRow = (uid: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });
  };

  const postAdmin = async (path: string, body: any): Promise<{ ok: boolean; json: any }> => {
    const s = ensureSecret(); if (!s) return { ok: false, json: null };
    const res = await fetch(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': s }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) { alert('Senha incorreta. Informe novamente.'); clearSecret(); return { ok: false, json }; }
    if (res.status === 501) { alert(json.error || 'Recurso não configurado.'); return { ok: false, json }; }
    if (!res.ok) { alert('Erro: ' + (json.error || res.status)); return { ok: false, json }; }
    return { ok: true, json };
  };

  const deleteSelected = async () => {
    const items = leads.filter((l) => selected.has(l.uid)).map((l) => ({ source: l.source, id: l.source_id }));
    if (!items.length) return;
    if (!window.confirm(`Excluir ${items.length} lead(s) das bases? Ação permanente.`)) return;
    setDeleting(true);
    try {
      const { ok } = await postAdmin('/api/funnel/delete', { items });
      if (ok) { setSelected(new Set()); setSelecting(false); fetchData(); }
    } finally { setDeleting(false); }
  };

  const deleteOne = async (lead: UnifiedLead) => {
    if (!window.confirm(`Excluir "${lead.nome || lead.email || lead.uid}" da base ${lead.source_label}? Permanente.`)) return;
    const { ok } = await postAdmin('/api/funnel/delete', { items: [{ source: lead.source, id: lead.source_id }] });
    if (ok) fetchData();
  };

  const reprocessOne = async (lead: UnifiedLead) => {
    if (!window.confirm(`Reprocessar "${lead.nome || lead.email || lead.uid}" pelo fluxo de ${lead.source_label}?`)) return;
    const { ok } = await postAdmin('/api/funnel/reprocess', { source: lead.source, id: lead.source_id });
    if (ok) alert('Lead reenviado ao fluxo do n8n.');
  };

  const applyPreset = (preset: 'hoje' | '7d' | '30d' | 'tudo') => {
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    if (preset === 'tudo') { setFromDate('2020-01-01'); setToDate(''); return; }
    const now = new Date();
    const from = new Date();
    if (preset === 'hoje') from.setHours(0, 0, 0, 0);
    else from.setTime(Date.now() - (preset === '7d' ? 7 : 30) * 86400000);
    setFromDate(fmt(from)); setToDate(fmt(now));
  };

  const p = stats?.periodos[period];

  const stageDistribution = useMemo(() => {
    const m = new Map<FunnelStage, number>();
    leads.forEach((l) => m.set(l.stage, (m.get(l.stage) || 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="p-4 border-b flex flex-wrap gap-3 justify-between items-center"
        style={{ backgroundColor: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <h3 className="text-sm font-semibold tracking-wide uppercase flex items-center gap-2"
            style={{ color: 'var(--text-2)' }}>
            <GitBranch className="h-4 w-4" />
            Central do Funil de Leads
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3" style={{ color: 'var(--text-4)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, email, empresa..."
              className="pl-7 pr-3 py-1 text-[10px] font-mono rounded border outline-none focus:ring-1 focus:ring-cyan-500 w-52"
              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-2)' }} />
          </div>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as any)}
            className="border rounded px-2 py-1 text-[10px] font-bold uppercase outline-none cursor-pointer"
            style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
            <option value="">Todas origens</option>
            <option value="framer">LP Framer</option>
            <option value="rd_pipedrive">RD → Pipedrive</option>
            <option value="webinar">LP Webinar</option>
          </select>
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as any)}
            className="border rounded px-2 py-1 text-[10px] font-bold uppercase outline-none cursor-pointer"
            style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
            <option value="">Todos estágios</option>
            <option value="incompleto">Incompleto</option>
            <option value="capturado">Capturado</option>
            <option value="inscrito">Inscrito</option>
            <option value="nao_processado">Não processado</option>
            <option value="processado_sem_deal">Processado (sem deal)</option>
            <option value="deal_criado">Deal criado</option>
            <option value="deal_ganho">Deal ganho</option>
            <option value="deal_perdido">Deal perdido</option>
          </select>
          <Toggle active={problemOnly} onClick={() => setProblemOnly((v) => !v)} color="#ef4444" label="Só problemas" />
          <Toggle active={dupOnly} onClick={() => setDupOnly((v) => !v)} color="#f59e0b" label="Duplicados" />
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 text-[10px] font-mono transition-colors disabled:opacity-40 px-2 py-1"
            style={{ color: 'var(--text-3)' }}>
            <RefreshCcw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> SYNC
          </button>
          <button onClick={toggleSelecting}
            className="flex items-center gap-1.5 text-[10px] font-mono uppercase px-2 py-1"
            style={{ color: selecting ? 'var(--crimson)' : 'var(--text-3)' }} title="Limpar leads das bases">
            <Trash2 className="h-3 w-3" /> {selecting ? 'Cancelar' : 'Limpeza'}
          </button>
        </div>
      </div>

      {/* Filtros avançados: período, status, saúde */}
      <div className="px-4 py-2 border-b flex flex-wrap items-center gap-2"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
        <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>Período:</span>
        {(['hoje', '7d', '30d', 'tudo'] as const).map((pp) => (
          <button key={pp} onClick={() => applyPreset(pp)}
            className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-3)', background: 'transparent' }}>{pp}</button>
        ))}
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="De"
          className="text-[10px] font-mono rounded border px-2 py-0.5 outline-none focus:ring-1 focus:ring-cyan-500"
          style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-2)', colorScheme: 'dark light' as any }} />
        <span className="text-[10px]" style={{ color: 'var(--text-4)' }}>→</span>
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="Até"
          className="text-[10px] font-mono rounded border px-2 py-0.5 outline-none focus:ring-1 focus:ring-cyan-500"
          style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-2)', colorScheme: 'dark light' as any }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
          className="border rounded px-2 py-0.5 text-[10px] font-bold uppercase outline-none cursor-pointer"
          style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
          <option value="">Status: todos</option>
          <option value="completo">Completos</option>
          <option value="incompleto">Incompletos</option>
        </select>
        <select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value as any)}
          className="border rounded px-2 py-0.5 text-[10px] font-bold uppercase outline-none cursor-pointer"
          style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
          <option value="">Saúde: toda</option>
          <option value="ok">OK</option>
          <option value="atencao">Atenção</option>
          <option value="erro">Problema</option>
        </select>
        {(fromDate || toDate || statusFilter || healthFilter) && (
          <button onClick={() => { setFromDate(''); setToDate(''); setStatusFilter(''); setHealthFilter(''); }}
            className="text-[10px] font-mono uppercase px-2 py-0.5" style={{ color: 'var(--crimson)' }}>limpar filtros</button>
        )}
      </div>

      {selecting && (
        <div className="px-4 py-2 border-b flex items-center justify-between gap-3"
          style={{ backgroundColor: 'var(--crimson-soft)', borderColor: 'var(--border)' }}>
          <span className="text-[11px] font-mono" style={{ color: 'var(--crimson)' }}>
            {selected.size} selecionado(s) · marque as linhas e exclua das bases (Framer / RD / Webinar)
          </span>
          <button onClick={deleteSelected} disabled={deleting || selected.size === 0}
            className="text-[10px] font-mono uppercase px-3 py-1 rounded disabled:opacity-40"
            style={{ background: 'var(--crimson)', color: '#fff' }}>
            {deleting ? 'Excluindo…' : `Excluir ${selected.size}`}
          </button>
        </div>
      )}

      {/* Stats + período */}
      {stats && (
        <>
          <div className="px-4 pt-3 flex items-center gap-2">
            <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>Janela:</span>
            {PERIODS.map((pp) => (
              <button key={pp.key} onClick={() => setPeriod(pp.key)}
                className="text-[10px] font-bold uppercase px-2 py-0.5 rounded transition-colors"
                style={{
                  backgroundColor: period === pp.key ? 'rgba(6,182,212,0.15)' : 'transparent',
                  color: period === pp.key ? '#06b6d4' : 'var(--text-4)',
                  border: `1px solid ${period === pp.key ? 'rgba(6,182,212,0.4)' : 'var(--border)'}`,
                }}>
                {pp.label}
              </button>
            ))}
          </div>
          {p && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-px mt-3" style={{ backgroundColor: 'var(--border)' }}>
              <StatCell label="Entraram" value={p.entraram} tone="info" />
              <StatCell label="Completos" value={p.completos} tone="success" sub={`${p.taxa_completos}% taxa`} />
              <StatCell label="Incompletos" value={p.incompletos} tone="warning" />
              <StatCell label="Com problema" value={p.problema} tone="danger" />
              <StatCell label="Viraram deal" value={p.deals} tone="success" />
            </div>
          )}

          {/* Funil RD→Pipedrive */}
          <FunnelBar funil={stats.funil_rd} />

          {/* Por origem + duplicados */}
          <div className="px-4 py-2 border-b flex items-center gap-4 flex-wrap"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
            {stats.por_origem.map((o) => (
              <div key={o.source} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SOURCE_COLORS[o.source] || '#94a3b8' }} />
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>
                  {o.source_label} <span className="font-bold" style={{ color: 'var(--text-1)' }}>{o.total}</span>
                  {o.problema > 0 && <span style={{ color: '#ef4444' }}> · {o.problema}⚠</span>}
                </span>
              </div>
            ))}
            {stats.duplicados > 0 && (
              <div className="flex items-center gap-1.5 ml-auto">
                <Copy className="h-3 w-3" style={{ color: '#f59e0b' }} />
                <span className="text-[10px] font-mono" style={{ color: '#f59e0b' }}>
                  {stats.duplicados} duplicado(s) por email
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Lista */}
      <div className="max-h-[640px] overflow-y-auto">
        {loading && leads.length === 0 ? (
          <Loader />
        ) : leads.length === 0 ? (
          <Empty />
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="border-b sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
              <tr className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                <th className="p-3 font-semibold w-4" />
                <th className="p-3 font-semibold">Saúde</th>
                <th className="p-3 font-semibold">Lead</th>
                <th className="p-3 font-semibold">Origem</th>
                <th className="p-3 font-semibold">Parou em</th>
                <th className="p-3 font-semibold">Recebido</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
              {leads.map((lead) => {
                const isExpanded = expanded === lead.uid;
                const hm = HEALTH_META[lead.health];
                const rowBg = lead.health === 'ok' ? 'transparent'
                  : lead.health === 'erro' ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.04)';
                return (
                  <React.Fragment key={lead.uid}>
                    <tr className="group transition-colors cursor-pointer border-l-2"
                      style={{ borderLeftColor: hm.color, backgroundColor: selecting && selected.has(lead.uid) ? 'var(--crimson-soft)' : rowBg }}
                      onClick={() => (selecting ? toggleRow(lead.uid) : setExpanded(isExpanded ? null : lead.uid))}>
                      <td className="pl-3 pr-0">
                        {selecting
                          ? <input type="checkbox" readOnly checked={selected.has(lead.uid)} style={{ accentColor: 'var(--crimson)', cursor: 'pointer' }} />
                          : isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--text-3)' }} />
                            : <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--text-4)' }} />}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                          style={{ backgroundColor: `${hm.color}1f`, color: hm.color, border: `1px solid ${hm.color}66` }}>
                          {hm.icon}{hm.label}
                        </span>
                        {lead.is_duplicate && (
                          <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase"
                            style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b' }} title="Email repetido na MESMA base">
                            <Copy className="h-2 w-2" />DUP
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                          {lead.nome || <span style={{ color: 'var(--text-4)' }}>—</span>}
                        </div>
                        <div className="text-[10px] font-mono break-all" style={{ color: 'var(--text-2)' }}>
                          {lead.email || <span style={{ color: 'var(--text-4)' }}>sem email</span>}
                        </div>
                        {lead.empresa && <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{lead.empresa}</div>}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold border"
                          style={{
                            borderColor: SOURCE_COLORS[lead.source] || 'var(--border)',
                            color: SOURCE_COLORS[lead.source] || 'var(--text-3)',
                            backgroundColor: `${SOURCE_COLORS[lead.source] || '#94a3b8'}15`,
                          }}>
                          {lead.source_label}
                        </span>
                        {lead.is_indicacao && (
                          <span className="ml-1 text-[8px] font-bold uppercase px-1 py-0.5 rounded"
                            style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>indicação</span>
                        )}
                      </td>
                      <td className="p-3">
                        <StageBadge stage={lead.stage} label={lead.stage_label} />
                      </td>
                      <td className="p-3 text-[10px] font-mono whitespace-nowrap" style={{ color: 'var(--text-2)' }}>
                        {format(new Date(lead.created_at), 'dd/MM HH:mm')}<br />
                        <span style={{ color: 'var(--text-3)' }}>
                          {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </td>
                    </tr>

                    <AnimatePresence>
                      {isExpanded && (
                        <tr style={{ backgroundColor: 'var(--bg-muted)' }}>
                          <td colSpan={6} className="px-6 py-4 border-l-2" style={{ borderLeftColor: hm.color }}>
                            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.15 }} className="space-y-3">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                                <Field icon={<Mail className="h-3 w-3" />} label="Email" value={lead.email} />
                                <Field icon={<Phone className="h-3 w-3" />} label="Telefone" value={lead.telefone} />
                                <Field icon={<Building2 className="h-3 w-3" />} label="Empresa" value={lead.empresa} />
                                <Field icon={<Package className="h-3 w-3" />} label="Produto" value={lead.produto} />
                              </div>

                              {lead.missing.length > 0 && (
                                <Chips title={`Campos faltando (${lead.missing.length})`} items={lead.missing} color="#f59e0b" />
                              )}

                              {/* Roteamento + Pipedrive (RD→Pipedrive) */}
                              {lead.routing && (
                                <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
                                  <div className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
                                    <Route className="h-3 w-3" /> Roteamento &amp; Pipedrive
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                                    <Field label="Rota" value={lead.routing.rota_definida} />
                                    <Field label="Pipeline destino" value={lead.routing.destino_pipeline} />
                                    <Field label="Stage destino" value={lead.routing.destino_stage} />
                                    <Field label="Owner" value={lead.routing.destino_owner} />
                                    <Field label="Processado" value={lead.routing.processado === null ? null : lead.routing.processado ? 'sim' : 'não'} />
                                    <Field icon={<Briefcase className="h-3 w-3" />} label="Pessoa Pipedrive" value={lead.pipedrive?.person_id ? String(lead.pipedrive.person_id) : null} />
                                    <Field icon={<Briefcase className="h-3 w-3" />} label="Deal Pipedrive" value={lead.pipedrive?.deal_id ? String(lead.pipedrive.deal_id) : null} />
                                    {lead.routing.motivo_rota && <Field label="Motivo rota" value={lead.routing.motivo_rota} />}
                                  </div>
                                </div>
                              )}

                              {/* Status atual no Pipedrive (S4 — deals_snapshot) */}
                              {lead.pipe && (
                                <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
                                  <div className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
                                    <Briefcase className="h-3 w-3" /> Status no Pipedrive
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                                    <Field label="Situação" value={lead.pipe.status} />
                                    <Field label="Stage atual (id)" value={lead.pipe.stage_id != null ? String(lead.pipe.stage_id) : null} />
                                    <Field label="Valor" value={lead.pipe.valor != null ? String(lead.pipe.valor) : null} />
                                    <Field label="Atualizado em" value={lead.pipe.atualizado_em} />
                                    {lead.pipe.won_at && <Field label="Ganho em" value={lead.pipe.won_at} />}
                                    {lead.pipe.lost_at && <Field label="Perdido em" value={lead.pipe.lost_at} />}
                                    {lead.pipe.lost_reason && <Field label="Motivo da perda" value={lead.pipe.lost_reason} />}
                                  </div>
                                </div>
                              )}

                              {/* Também presente em outras bases */}
                              {lead.also_in.length > 0 && (
                                <div className="text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>
                                  <span className="font-bold" style={{ color: '#f59e0b' }}>Mesmo email também em:</span>{' '}
                                  {lead.also_in.map((a, i) => (
                                    <span key={i}>
                                      {a.source}{a.deal_id ? ` (deal ${a.deal_id})` : ''}{i < lead.also_in.length - 1 ? ' · ' : ''}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center gap-4 text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>
                                {(lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
                                  <span>UTM: {lead.utm_source || '—'} / {lead.utm_medium || '—'} / {lead.utm_campaign || '—'}</span>
                                )}
                                <span>ID: {String(lead.source_id)}</span>
                              </div>

                              {/* Ações por lead */}
                              <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-light)' }}>
                                <button onClick={(e) => { e.stopPropagation(); reprocessOne(lead); }}
                                  className="flex items-center gap-1.5 text-[10px] font-mono uppercase px-2.5 py-1 rounded border"
                                  style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }} title="Reenvia o lead ao fluxo do n8n">
                                  <RefreshCcw className="h-3 w-3" /> Reprocessar no fluxo
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); deleteOne(lead); }}
                                  className="flex items-center gap-1.5 text-[10px] font-mono uppercase px-2.5 py-1 rounded border"
                                  style={{ borderColor: 'rgba(224,131,105,0.5)', color: 'var(--crimson)' }} title="Exclui este lead da base">
                                  <Trash2 className="h-3 w-3" /> Excluir lead
                                </button>
                              </div>
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

      {/* Footer count */}
      <div className="px-4 py-2 border-t text-[10px] font-mono flex justify-between"
        style={{ borderColor: 'var(--border-light)', color: 'var(--text-4)' }}>
        <span>Exibindo {leads.length} de {total} lead(s) na janela</span>
        {stageDistribution.length > 0 && (
          <span>{stageDistribution.map(([s, n]) => `${s}:${n}`).join('  ·  ')}</span>
        )}
      </div>
    </div>
  );
}

// ── Subcomponentes ───────────────────────────────────────────────────────────
function FunnelBar({ funil }: { funil: FunnelStats['funil_rd'] }) {
  const max = Math.max(funil.capturado, 1);
  const steps = [
    { label: 'Capturado', value: funil.capturado, color: '#06b6d4' },
    { label: 'Processado', value: funil.processado, color: '#f59e0b' },
    { label: 'Deal criado', value: funil.deal, color: '#10b981' },
  ];
  return (
    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
      <div className="text-[9px] font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--text-4)' }}>
        Funil RD → Pipedrive (30d) {funil.nao_processado > 0 && <span style={{ color: '#ef4444' }}>· {funil.nao_processado} não processados</span>}
      </div>
      <div className="space-y-1.5">
        {steps.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="text-[10px] font-mono w-24 shrink-0" style={{ color: 'var(--text-3)' }}>{s.label}</span>
            <div className="flex-1 h-4 rounded overflow-hidden" style={{ backgroundColor: 'var(--bg-input)' }}>
              <div className="h-full rounded transition-all" style={{ width: `${(s.value / max) * 100}%`, backgroundColor: s.color }} />
            </div>
            <span className="text-[10px] font-mono font-bold w-10 text-right" style={{ color: 'var(--text-1)' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageBadge({ stage, label }: { stage: FunnelStage; label: string }) {
  const c = STAGE_COLORS[stage];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold border"
      style={{ borderColor: `${c}66`, color: c, backgroundColor: `${c}15` }}>
      {label}
    </span>
  );
}

function Toggle({ active, onClick, color, label }: { active: boolean; onClick: () => void; color: string; label: string }) {
  return (
    <button onClick={onClick}
      className="text-[10px] font-bold uppercase px-2 py-1 rounded border transition-colors"
      style={{
        backgroundColor: active ? `${color}20` : 'transparent',
        color: active ? color : 'var(--text-4)',
        borderColor: active ? `${color}66` : 'var(--border)',
      }}>
      {label}
    </button>
  );
}

function StatCell({ label, value, tone, sub }: {
  label: string; value: number; tone: 'success' | 'warning' | 'info' | 'danger' | 'neutral'; sub?: string;
}) {
  const toneColor = { success: '#10b981', warning: '#f59e0b', info: '#06b6d4', danger: '#ef4444', neutral: 'var(--text-2)' }[tone];
  return (
    <div className="p-3" style={{ backgroundColor: 'var(--bg-card)' }}>
      <div className="text-[9px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>{label}</div>
      <div className="text-xl font-bold font-mono" style={{ color: toneColor }}>{value}</div>
      {sub && <div className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--text-3)' }}>{sub}</div>}
    </div>
  );
}

function Chips({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color }}>{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((c) => (
          <span key={c} className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold border"
            style={{ color, borderColor: `${color}66`, backgroundColor: `${color}1a` }}>{c}</span>
        ))}
      </div>
    </div>
  );
}

function Field({ icon, label, value }: { icon?: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2">
      {icon && <div className="mt-0.5" style={{ color: 'var(--text-4)' }}>{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>{label}</div>
        <div className="font-mono break-all text-[11px]" style={{ color: value ? 'var(--text-1)' : 'var(--text-4)' }}>{value || '—'}</div>
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div className="h-48 flex flex-col items-center justify-center gap-3">
      <RefreshCcw className="h-7 w-7 text-cyan-500 animate-spin" />
      <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">Carregando funil...</span>
    </div>
  );
}

function Empty() {
  return (
    <div className="h-48 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--text-4)' }}>
      <Filter className="h-6 w-6 opacity-40" />
      <span className="text-[11px] font-mono uppercase tracking-widest">Nenhum lead na janela // ajuste os filtros</span>
    </div>
  );
}
