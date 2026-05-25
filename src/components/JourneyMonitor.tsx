import React, { useState, useEffect, useCallback } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  GitBranch, CheckCircle2, AlertTriangle, XCircle, Search, ChevronDown, ChevronRight,
  Mail, Phone, Building2, Package, RefreshCcw, Filter, Copy, Trash2, Download, ExternalLink,
} from 'lucide-react';
import type { JourneyLead, JourneyStats, JourneyStage, Health } from '../lib/journey';

const HEALTH: Record<Health, { color: string; label: string; icon: React.ReactNode }> = {
  ok:      { color: '#A8B782', label: 'OK', icon: <CheckCircle2 className="h-2.5 w-2.5" /> },
  atencao: { color: '#D49555', label: 'Atenção', icon: <AlertTriangle className="h-2.5 w-2.5" /> },
  erro:    { color: '#E08369', label: 'Travou', icon: <XCircle className="h-2.5 w-2.5" /> },
};
const STAGE_COLOR: Record<JourneyStage, string> = {
  form: '#D49555', rd: '#E08369', processado: '#D49555', deal: '#BD8AA8', ganho: '#A8B782', perdido: '#9B9690', webinar: '#7CA5DA',
};
const STEPS = [
  { key: 'form', label: 'Framer' },
  { key: 'rd', label: 'RD' },
  { key: 'processado', label: 'MQL' },
  { key: 'deal', label: 'Deal' },
] as const;
const PERIODS = [{ k: 'hoje' }, { k: '7d' }, { k: '30d' }, { k: 'tudo' }] as const;
const n8nBase = 'https://growthsparkmaxx.app.n8n.cloud';

export default function JourneyMonitor({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<JourneyLead[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<JourneyStats | null>(null);
  const [flow, setFlow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [stageFilter, setStageFilter] = useState<'' | JourneyStage>('');
  const [healthFilter, setHealthFilter] = useState<'' | Health>('');
  const [problemOnly, setProblemOnly] = useState(false);
  const [dupOnly, setDupOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [dsearch, setDsearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activePreset, setActivePreset] = useState<string>('30d');

  const [adminSecret, setAdminSecret] = useState<string>(() => localStorage.getItem('spark-admin-secret') || '');
  const [dupOpen, setDupOpen] = useState(false);
  const [dupGroups, setDupGroups] = useState<any[]>([]);
  const [dupLoading, setDupLoading] = useState(false);

  useEffect(() => { const id = setTimeout(() => setDsearch(search.trim()), 350); return () => clearTimeout(id); }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (stageFilter) qs.append('stage', stageFilter);
      if (healthFilter) qs.append('health', healthFilter);
      if (problemOnly) qs.append('problem', '1');
      if (dupOnly) qs.append('dup', '1');
      if (dsearch) qs.append('search', dsearch);
      if (fromDate) qs.append('from', new Date(fromDate + 'T00:00:00').toISOString());
      if (toDate) qs.append('to', new Date(toDate + 'T23:59:59').toISOString());
      qs.append('limit', '500');
      const sp = new URLSearchParams();
      if (fromDate) sp.append('from', new Date(fromDate + 'T00:00:00').toISOString());
      if (toDate) sp.append('to', new Date(toDate + 'T23:59:59').toISOString());
      const [jr, sr, fr] = await Promise.all([fetch(`/api/journey?${qs}`), fetch(`/api/journey/stats?${sp}`), fetch(`/api/journey/flow-stats?${sp}`)]);
      const jj = jr.ok ? await jr.json() : { data: [], total: 0 };
      setRows(jj.data || []); setTotal(jj.total || 0);
      setStats(sr.ok ? await sr.json() : null);
      setFlow(fr.ok ? await fr.json() : null);
    } catch (e) { console.error('journey fetch', e); } finally { setLoading(false); }
  }, [stageFilter, healthFilter, problemOnly, dupOnly, dsearch, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  // ── admin actions ──────────────────────────────────────────────────────────
  const ensureSecret = (): string | null => {
    let s = adminSecret;
    if (!s) { s = (window.prompt('Senha de admin (WEBHOOK_SECRET):') || '').trim(); if (!s) return null; setAdminSecret(s); localStorage.setItem('spark-admin-secret', s); }
    return s;
  };
  const postAdmin = async (path: string, body: any) => {
    const s = ensureSecret(); if (!s) return { ok: false, json: null as any };
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': s }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) { alert('Senha incorreta.'); localStorage.removeItem('spark-admin-secret'); setAdminSecret(''); return { ok: false, json }; }
    if (res.status === 501) { alert(json.error || 'Recurso não configurado.'); return { ok: false, json }; }
    if (!res.ok) { alert('Erro: ' + (json.error || res.status)); return { ok: false, json }; }
    return { ok: true, json };
  };
  const deleteJourney = async (j: JourneyLead) => {
    const items = j.refs.map((r) => ({ source: r.source, id: r.id }));
    if (!window.confirm(`Excluir "${j.nome || j.email}" de TODAS as bases? ${items.length} registro(s). Permanente.`)) return;
    const { ok } = await postAdmin('/api/funnel/delete', { items });
    if (ok) fetchData();
  };
  const reprocessJourney = async (j: JourneyLead) => {
    const source = j.has_rd ? 'rd_pipedrive' : j.has_framer ? 'framer' : 'webinar';
    const ref = [...j.refs].filter((r) => r.source === source).sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''))[0];
    if (!ref) return;
    if (!window.confirm(`Reprocessar "${j.nome || j.email}" pelo fluxo (${source})?`)) return;
    const { ok } = await postAdmin('/api/funnel/reprocess', { source, id: ref.id });
    if (ok) alert('Lead reenviado ao fluxo do n8n.');
  };
  const dedupeBase = async (j: JourneyLead, source: string) => {
    if (!j.email) return;
    if (!window.confirm(`Manter só o mais recente de ${j.email} em ${source}?`)) return;
    const { ok, json } = await postAdmin('/api/funnel/dedupe', { source, email: j.email });
    if (ok) { alert(`✓ Mantido o registro mais recente em ${source}. ${json?.removed ?? 0} cópia(s) antiga(s) removida(s). O lead NÃO foi apagado — só deixou de ser duplicado (some da visão "Duplicados", continua na lista normal).`); fetchData(); }
  };

  const loadDuplicates = async () => {
    setDupLoading(true);
    try { const r = await fetch('/api/funnel/duplicates'); const j = r.ok ? await r.json() : { groups: [] }; setDupGroups(j.groups || []); }
    finally { setDupLoading(false); }
  };
  const openDup = () => { const nx = !dupOpen; setDupOpen(nx); if (nx) loadDuplicates(); };
  const dedupeGroup = async (g: any) => {
    if (!window.confirm(`Manter só o mais recente de "${g.key}" em ${g.source_label}? Remove ${g.remove_ids.length} cópia(s) antiga(s) (o lead continua na base).`)) return;
    const { ok } = await postAdmin('/api/funnel/dedupe', { source: g.source, email: g.key });
    if (ok) { loadDuplicates(); fetchData(); }
  };
  const dedupeAll = async () => {
    const s = ensureSecret(); if (!s) return;
    const pre = await fetch('/api/funnel/dedupe', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': s }, body: JSON.stringify({ dryRun: true }) });
    const pj = await pre.json().catch(() => ({})); if (!pre.ok) { alert('Erro: ' + (pj.error || pre.status)); return; }
    if (!pj.toRemove) { alert('Nenhum duplicado.'); return; }
    if (!window.confirm(`Remover ${pj.toRemove} cópia(s) de ${pj.groups} grupo(s), mantendo o mais recente?`)) return;
    const { ok } = await postAdmin('/api/funnel/dedupe', {}); if (ok) { loadDuplicates(); fetchData(); }
  };

  const applyPreset = (p: string) => {
    setActivePreset(p);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    if (p === 'tudo') { setFromDate('2020-01-01'); setToDate(''); return; }
    const now = new Date(); const f = new Date();
    if (p === 'hoje') f.setHours(0, 0, 0, 0); else f.setTime(Date.now() - (p === '7d' ? 7 : 30) * 86400000);
    setFromDate(fmt(f)); setToDate(fmt(now));
  };
  const onDate = (which: 'from' | 'to', v: string) => { setActivePreset('custom'); which === 'from' ? setFromDate(v) : setToDate(v); };

  const exportCsv = () => {
    const head = ['nome', 'email', 'telefone', 'empresa', 'estagio', 'saude', 'parou_em', 'framer', 'rd', 'processado', 'deal_id', 'status_pipe', 'recebido'];
    const esc = (v: any) => `"${(v ?? '').toString().replace(/"/g, '""')}"`;
    const lines = rows.map((j) => [j.nome, j.email, j.telefone, j.empresa, j.stage_label, j.health, j.stalled || '', j.has_framer ? 'sim' : '', j.has_rd ? 'sim' : '', j.processado ? 'sim' : '', j.deal_id || '', j.pipe?.status || '', j.created_at].map(esc).join(','));
    const csv = [head.join(','), ...lines].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `jornada_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const card = { backgroundColor: 'var(--bg-paper)', border: '1px solid var(--rule)' };

  return (
    <div className="space-y-4">
      {/* Filtro de data único — controla o funil E a lista */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--ink-mute)' }}>Período (funil + leads):</span>
        {PERIODS.map((p) => {
          const active = activePreset === p.k;
          return (
            <button key={p.k} onClick={() => applyPreset(p.k)} className="font-mono uppercase"
              style={{ fontSize: 10, padding: '4px 10px', borderRadius: 999, border: `1px solid ${active ? 'var(--crimson)' : 'var(--border)'}`, background: active ? 'var(--crimson-soft)' : 'transparent', color: active ? 'var(--crimson)' : 'var(--text-3)' }}>
              {p.k}
            </button>
          );
        })}
        <input type="date" value={fromDate} onChange={(e) => onDate('from', e.target.value)} aria-label="De"
          className="text-[10px] font-mono rounded border px-2 py-1" style={{ backgroundColor: 'var(--bg-input)', borderColor: activePreset === 'custom' ? 'var(--crimson)' : 'var(--border)', color: 'var(--text-2)' }} />
        <span style={{ color: 'var(--text-4)' }}>→</span>
        <input type="date" value={toDate} onChange={(e) => onDate('to', e.target.value)} aria-label="Até"
          className="text-[10px] font-mono rounded border px-2 py-1" style={{ backgroundColor: 'var(--bg-input)', borderColor: activePreset === 'custom' ? 'var(--crimson)' : 'var(--border)', color: 'var(--text-2)' }} />
        {(fromDate || toDate) && <button onClick={() => { setFromDate(''); setToDate(''); setActivePreset('30d'); }} className="font-mono uppercase" style={{ fontSize: 10, color: 'var(--crimson)' }}>limpar</button>}
      </div>

      {/* Funil de conversão */}
      <div style={card}>
        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--rule)', backgroundColor: 'var(--bg-soft)' }}>
          <h3 className="font-display flex items-center gap-2" style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>
            <GitBranch className="h-4 w-4" /> Funil de conversão · ponta a ponta
          </h3>
          <span className="font-mono uppercase" style={{ fontSize: 9, color: 'var(--text-4)' }}>por execução do n8n</span>
        </div>
        {flow && (
          <div className="p-4 space-y-1.5">
            {[
              { label: 'Webhook Framer', val: flow.framer_total, color: '#D49555', sub: 'gatilho do forms disparou' },
              { label: 'Chegou ao RD', val: flow.framer_ok, color: '#7CA5DA', sub: `${flow.taxa_framer_ok}% concluíram sem erro` },
              { label: 'MQL (Fluxo Pipedrive)', val: flow.pass_total, color: '#BD8AA8', sub: `iniciou a passagem · ${flow.taxa_rd_mql}% do RD` },
              { label: 'Deal criado', val: flow.pass_ok, color: '#A8B782', sub: `${flow.taxa_mql_deal}% das passagens sem erro` },
            ].map((s) => {
              const max = Math.max(flow.framer_total, 1);
              return (
                <div key={s.label} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 150px', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink)' }}>{s.label}</span>
                  <div style={{ background: 'var(--bg-soft)', height: 24, position: 'relative' }}>
                    <div style={{ height: '100%', width: `${(s.val / max) * 100}%`, background: s.color, display: 'flex', alignItems: 'center', paddingLeft: 8, transition: 'width .6s' }}>
                      <span className="font-mono" style={{ fontSize: 11, color: '#1A1814', fontWeight: 600 }}>{s.val}</span>
                    </div>
                  </div>
                  <span className="font-mono" style={{ fontSize: 9, color: 'var(--text-4)' }}>{s.sub}</span>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: '1px solid var(--rule)', marginTop: 8 }}>
              <span className="font-mono uppercase" style={{ fontSize: 9, color: 'var(--text-4)', alignSelf: 'center' }}>Erros:</span>
              <span className="font-mono" style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'var(--bg-soft)', color: flow.framer_falhou > 0 ? 'var(--crimson)' : 'var(--text-3)' }}>Framer disparou sem concluir: <b>{flow.framer_falhou}</b></span>
              <span className="font-mono" style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'var(--bg-soft)', color: flow.pass_falhou > 0 ? 'var(--crimson)' : 'var(--text-3)' }}>Passagem com erro: <b>{flow.pass_falhou}</b></span>
              <span className="font-mono" style={{ fontSize: 10, padding: '3px 8px', color: 'var(--navy)' }}>Webinar: <b>{stats?.webinar ?? 0}</b></span>
              <span className="font-mono" style={{ fontSize: 9, color: 'var(--text-4)', marginLeft: 'auto', alignSelf: 'center' }}>por execução do n8n</span>
            </div>
          </div>
        )}
      </div>

      {/* Lista de jornadas */}
      <div style={card}>
        {/* Header / filtros */}
        <div className="px-4 py-2 border-b flex flex-wrap gap-2 justify-between items-center" style={{ borderColor: 'var(--rule)', backgroundColor: 'var(--bg-soft)' }}>
          <div className="flex items-center gap-2">
            <h3 className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--text-2)' }}>Jornada dos leads</h3>
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-4)' }}>{rows.length} de {total}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3" style={{ color: 'var(--text-4)' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome, email, empresa…"
                className="pl-7 pr-3 py-1 text-[10px] font-mono rounded border outline-none w-48"
                style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-2)' }} />
            </div>
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as any)} className="border rounded px-2 py-1 text-[10px] font-bold uppercase outline-none cursor-pointer" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
              <option value="">Estágio: todos</option>
              <option value="form">Webhook Framer (parou)</option>
              <option value="rd">Chegou ao RD (travou)</option>
              <option value="processado">MQL s/ deal</option>
              <option value="deal">Deal criado</option>
              <option value="ganho">Ganho</option>
              <option value="perdido">Perdido</option>
              <option value="webinar">Webinar</option>
            </select>
            <select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value as any)} className="border rounded px-2 py-1 text-[10px] font-bold uppercase outline-none cursor-pointer" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
              <option value="">Saúde: toda</option>
              <option value="ok">OK</option>
              <option value="atencao">Atenção</option>
              <option value="erro">Travou</option>
            </select>
            <Toggle active={problemOnly} onClick={() => setProblemOnly((v) => !v)} color="#E08369" label="Só problemas" />
            <Toggle active={dupOnly} onClick={() => setDupOnly((v) => !v)} color="#D49555" label="Duplicados" />
            <button onClick={openDup} className="text-[10px] font-mono uppercase px-2 py-1 flex items-center gap-1" style={{ color: dupOpen ? 'var(--amber)' : 'var(--text-3)' }}><Copy className="h-3 w-3" /> Duplicados</button>
            <button onClick={exportCsv} className="text-[10px] font-mono uppercase px-2 py-1 flex items-center gap-1" style={{ color: 'var(--text-3)' }}><Download className="h-3 w-3" /> CSV</button>
            <button onClick={fetchData} disabled={loading} className="text-[10px] font-mono uppercase px-2 py-1 flex items-center gap-1" style={{ color: 'var(--text-3)' }}><RefreshCcw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Sync</button>
          </div>
        </div>

        {dupOpen && (
          <div className="border-b" style={{ borderColor: 'var(--rule)', backgroundColor: 'var(--bg-soft)' }}>
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="font-mono uppercase" style={{ fontSize: 11, color: 'var(--text-2)' }}>Duplicados por base {dupGroups.length > 0 && `· ${dupGroups.length}`}</span>
              {dupGroups.length > 0 && <button onClick={dedupeAll} className="text-[10px] font-mono uppercase px-3 py-1 rounded" style={{ background: 'var(--amber)', color: '#1A1814' }}>Limpar todos (manter recente)</button>}
            </div>
            <div className="max-h-56 overflow-y-auto px-4 pb-3 space-y-1">
              {dupLoading && dupGroups.length === 0 && <div className="text-[10px] font-mono py-1" style={{ color: 'var(--text-4)' }}>Procurando…</div>}
              {!dupLoading && dupGroups.length === 0 && <div className="text-[10px] font-mono py-1" style={{ color: 'var(--olive)' }}>✓ Nenhum duplicado por base.</div>}
              {dupGroups.map((g, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-1 px-2 rounded" style={{ backgroundColor: 'var(--bg-paper)' }}>
                  <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink)' }}>{g.key} <span style={{ color: 'var(--text-3)' }}>· {g.source_label}</span> <b style={{ color: 'var(--crimson)' }}>{g.count}×</b></span>
                  <button onClick={() => dedupeGroup(g)} className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border" style={{ borderColor: 'var(--border)', color: 'var(--amber)' }}>manter recente</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabela */}
        <div className="max-h-[640px] overflow-y-auto">
          {loading && rows.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2"><RefreshCcw className="h-6 w-6 animate-spin" style={{ color: 'var(--crimson)' }} /><span className="font-mono uppercase" style={{ fontSize: 10, color: 'var(--text-3)' }}>Montando jornadas…</span></div>
          ) : rows.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--text-4)' }}><Filter className="h-6 w-6 opacity-40" /><span className="font-mono uppercase" style={{ fontSize: 11 }}>Nenhuma jornada na janela</span></div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-soft)' }}>
                <tr className="font-mono uppercase" style={{ fontSize: 10, color: 'var(--text-3)', borderBottom: '1px solid var(--rule)' }}>
                  <th className="p-3 w-4" /><th className="p-3">Etapa atual</th><th className="p-3">Lead</th><th className="p-3">Jornada</th><th className="p-3">Recebido</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((j) => {
                  const isExp = expanded === j.uid; const hm = HEALTH[j.health];
                  return (
                    <React.Fragment key={j.uid}>
                      <tr className="cursor-pointer" style={{ borderLeft: `2px solid ${hm.color}`, borderBottom: '1px solid var(--border-light)' }} onClick={() => setExpanded(isExp ? null : j.uid)}>
                        <td className="pl-3">{isExp ? <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--text-3)' }} /> : <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--text-4)' }} />}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <span style={{ width: 7, height: 7, borderRadius: 999, background: hm.color }} title={hm.label} />
                            <span className="inline-flex items-center px-2 py-0.5 rounded font-mono" style={{ fontSize: 10, fontWeight: 600, border: `1px solid ${STAGE_COLOR[j.stage]}66`, color: STAGE_COLOR[j.stage], backgroundColor: `${STAGE_COLOR[j.stage]}18` }}>{j.stage_label}</span>
                          </span>
                          {(j.dup_bases.framer || j.dup_bases.rd_pipedrive || j.dup_bases.webinar) ? <span className="ml-1 px-1 py-0.5 rounded" style={{ fontSize: 8, fontWeight: 700, backgroundColor: 'rgba(212,149,85,0.15)', color: '#D49555' }} title="Tem duplicados na mesma base">DUP</span> : null}
                        </td>
                        <td className="p-3">
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{j.nome || <span style={{ color: 'var(--text-4)' }}>—</span>}</div>
                          <div className="font-mono break-all" style={{ fontSize: 10, color: 'var(--text-2)' }}>{j.email || 'sem email'}</div>
                          {j.empresa && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{j.empresa}</div>}
                        </td>
                        <td className="p-3"><Steps j={j} /></td>
                        <td className="p-3 font-mono whitespace-nowrap" style={{ fontSize: 10, color: 'var(--text-2)' }}>{j.last_at ? format(new Date(j.last_at), 'dd/MM HH:mm') : '—'}<br /><span style={{ color: 'var(--text-3)' }}>{j.last_at ? formatDistanceToNow(new Date(j.last_at), { addSuffix: true, locale: ptBR }) : ''}</span></td>
                      </tr>
                      {isExp && (
                        <tr style={{ backgroundColor: 'var(--bg-soft)' }}>
                          <td colSpan={5} className="px-6 py-4" style={{ borderLeft: `2px solid ${hm.color}` }}>
                            <div className="space-y-3">
                              <Timeline j={j} />
                              {j.stalled && <div className="font-mono" style={{ fontSize: 11, color: 'var(--crimson)' }}>⚠ {j.stalled}</div>}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ fontSize: 11 }}>
                                <Field icon={<Mail className="h-3 w-3" />} label="Email" value={j.email} />
                                <Field icon={<Phone className="h-3 w-3" />} label="Telefone" value={j.telefone} />
                                <Field icon={<Building2 className="h-3 w-3" />} label="Empresa" value={j.empresa} />
                                <Field icon={<Package className="h-3 w-3" />} label="Produto" value={j.produto} />
                              </div>
                              {(j.has_rd || j.deal_id) && (
                                <div className="rounded border p-3 grid grid-cols-2 md:grid-cols-4 gap-3" style={{ borderColor: 'var(--rule)', backgroundColor: 'var(--bg-paper)', fontSize: 11 }}>
                                  <Field label="Rota" value={j.rota_definida} />
                                  <Field label="Pipeline" value={j.destino_pipeline} />
                                  <Field label="Stage destino" value={j.destino_stage} />
                                  <Field label="Owner" value={j.destino_owner} />
                                  <Field label="Processado" value={j.processado == null ? null : j.processado ? 'sim' : 'não'} />
                                  <Field label="Pessoa Pipe" value={j.person_id ? String(j.person_id) : null} />
                                  <Field label="Deal Pipe" value={j.deal_id ? String(j.deal_id) : null} />
                                  <Field label="Status deal" value={j.pipe?.status || null} />
                                </div>
                              )}
                              {(j.dup_bases.framer || j.dup_bases.rd_pipedrive || j.dup_bases.webinar) ? (
                                <div className="flex flex-wrap items-center gap-2 font-mono" style={{ fontSize: 10, color: '#D49555' }}>
                                  <Copy className="h-3 w-3" /> Duplicado:
                                  {(['framer', 'rd_pipedrive', 'webinar'] as const).map((b) => (j.dup_bases[b] > 1 ? (
                                    <button key={b} onClick={(e) => { e.stopPropagation(); dedupeBase(j, b); }} className="px-2 py-0.5 rounded border" style={{ borderColor: 'rgba(212,149,85,0.5)', color: 'var(--amber)' }}>{b}: {j.dup_bases[b]}× · manter recente</button>
                                  ) : null))}
                                </div>
                              ) : null}
                              <div className="flex items-center gap-2 pt-2 flex-wrap" style={{ borderTop: '1px solid var(--border-light)' }}>
                                <button onClick={(e) => { e.stopPropagation(); reprocessJourney(j); }} className="flex items-center gap-1.5 font-mono uppercase px-2.5 py-1 rounded border" style={{ fontSize: 10, borderColor: 'var(--border)', color: 'var(--text-2)' }}><RefreshCcw className="h-3 w-3" /> Reprocessar no fluxo</button>
                                <button onClick={(e) => { e.stopPropagation(); deleteJourney(j); }} className="flex items-center gap-1.5 font-mono uppercase px-2.5 py-1 rounded border" style={{ fontSize: 10, borderColor: 'rgba(224,131,105,0.5)', color: 'var(--crimson)' }}><Trash2 className="h-3 w-3" /> Excluir das bases</button>
                                {j.deal_id ? <a href={`${n8nBase}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 font-mono uppercase px-2.5 py-1" style={{ fontSize: 10, color: 'var(--text-3)' }}><ExternalLink className="h-3 w-3" /> Deal #{j.deal_id}</a> : null}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Steps({ j }: { j: JourneyLead }) {
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => {
        const on = (j.reached as any)[s.key] as boolean;
        return (
          <React.Fragment key={s.key}>
            {i > 0 && <span style={{ width: 10, height: 1, background: on ? 'var(--olive)' : 'var(--rule)' }} />}
            <span title={s.label} className="flex items-center gap-1">
              <span style={{ width: 8, height: 8, borderRadius: 999, background: on ? 'var(--olive)' : 'transparent', border: `1px solid ${on ? 'var(--olive)' : 'var(--rule-strong)'}` }} />
              <span className="font-mono" style={{ fontSize: 8, textTransform: 'uppercase', color: on ? 'var(--text-2)' : 'var(--text-4)' }}>{s.label}</span>
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Timeline({ j }: { j: JourneyLead }) {
  const events: { when: string | null; label: string; on: boolean }[] = [
    { when: j.has_framer ? j.created_at : null, label: 'Webhook Framer disparou com os dados', on: j.reached.form },
    { when: j.has_rd ? j.last_at : null, label: 'Chegou ao RD (execução concluída sem erro)', on: j.reached.rd },
    { when: null, label: 'MQL (Fluxo Pipedrive)', on: j.reached.processado },
    { when: null, label: j.deal_id ? `Deal criado — fluxo RD → Pipedrive concluído (#${j.deal_id})` : 'Deal criado (fluxo RD → Pipedrive concluído)', on: j.reached.deal },
    { when: j.pipe?.won_at || j.pipe?.lost_at || null, label: j.pipe?.status ? `Status no Pipedrive: ${j.pipe.status}` : 'Status no Pipedrive (em breve)', on: !!j.pipe?.status },
  ];
  return (
    <div className="space-y-1.5">
      {events.map((e, i) => (
        <div key={i} className="flex items-center gap-2">
          <span style={{ width: 9, height: 9, borderRadius: 999, background: e.on ? 'var(--olive)' : 'transparent', border: `1px solid ${e.on ? 'var(--olive)' : 'var(--rule-strong)'}` }} />
          <span style={{ fontSize: 11, color: e.on ? 'var(--ink)' : 'var(--text-4)' }}>{e.label}</span>
          {e.when && <span className="font-mono" style={{ fontSize: 9, color: 'var(--text-4)' }}>· {format(new Date(e.when), 'dd/MM HH:mm')}</span>}
        </div>
      ))}
    </div>
  );
}

function Toggle({ active, onClick, color, label }: { active: boolean; onClick: () => void; color: string; label: string }) {
  return <button onClick={onClick} className="font-mono uppercase" style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, border: `1px solid ${active ? color : 'var(--border)'}`, background: active ? `${color}22` : 'transparent', color: active ? color : 'var(--text-4)' }}>{label}</button>;
}

function Field({ icon, label, value }: { icon?: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2">
      {icon && <div className="mt-0.5" style={{ color: 'var(--text-4)' }}>{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="font-mono uppercase" style={{ fontSize: 9, color: 'var(--text-4)' }}>{label}</div>
        <div className="font-mono break-all" style={{ fontSize: 11, color: value ? 'var(--ink)' : 'var(--text-4)' }}>{value || '—'}</div>
      </div>
    </div>
  );
}
