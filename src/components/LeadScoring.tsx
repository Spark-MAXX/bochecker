import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Gauge, Flame, TrendingUp, Search, ChevronDown, ChevronRight,
  Mail, Building2, RefreshCcw, Filter, Info, Award,
} from 'lucide-react';
import type { UnifiedLead, FunnelStats } from '../lib/schemas';
import { scoreBand, SCORE_BANDS } from '../lib/schemas';

// Cores por faixa de nota (quente = alto engajamento).
const BAND_META: Record<'quente' | 'morno' | 'frio', { label: string; color: string }> = {
  quente: { label: 'Quente', color: '#10b981' },
  morno:  { label: 'Morno',  color: '#f59e0b' },
  frio:   { label: 'Frio',   color: '#64748b' },
};

function bandColor(value: number | null | undefined): string {
  const b = scoreBand(value);
  return b ? BAND_META[b].color : '#64748b';
}

interface LeadScoringProps {
  refreshKey?: number;
}

export default function LeadScoring({ refreshKey = 0 }: LeadScoringProps) {
  const [leads, setLeads] = useState<UnifiedLead[]>([]);
  const [stats, setStats] = useState<FunnelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const [scoredOnly, setScoredOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.append('source', 'rd_pipedrive');
      if (debouncedSearch) qs.append('search', debouncedSearch);
      qs.append('limit', '200');

      const [leadsRes, statsRes] = await Promise.all([
        fetch(`/api/leads/unified?${qs.toString()}`),
        fetch('/api/leads/unified-stats'),
      ]);
      const leadsJson = leadsRes.ok ? await leadsRes.json() : { data: [] };
      const statsJson = statsRes.ok ? await statsRes.json() : null;
      setLeads(leadsJson.data || []);
      setStats(statsJson);
    } catch (e) { console.error('LeadScoring fetch error', e); }
    finally { setLoading(false); }
  }, [debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  // Ordena por nota desc (sem nota vai pro fim); opcionalmente só os pontuados.
  const visibleLeads = useMemo(() => {
    const withScore = (l: UnifiedLead) => l.score?.value ?? null;
    let arr = leads.slice();
    if (scoredOnly) arr = arr.filter((l) => withScore(l) !== null);
    return arr.sort((a, b) => {
      const av = withScore(a), bv = withScore(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return bv - av;
    });
  }, [leads, scoredOnly]);

  const scoring = stats?.scoring;

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
            <Gauge className="h-4 w-4" />
            Lead Scoring · RD Station
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3" style={{ color: 'var(--text-4)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, email, empresa..."
              className="pl-7 pr-3 py-1 text-[10px] font-mono rounded border outline-none focus:ring-1 focus:ring-emerald-500 w-56"
              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
            />
          </div>

          <button onClick={() => setScoredOnly((v) => !v)}
            className="border rounded px-2 py-1 text-[10px] font-bold uppercase outline-none cursor-pointer transition-colors"
            style={{
              backgroundColor: scoredOnly ? 'rgba(16,185,129,0.12)' : 'var(--bg-input)',
              borderColor: scoredOnly ? 'rgba(16,185,129,0.4)' : 'var(--border)',
              color: scoredOnly ? '#10b981' : 'var(--text-3)',
            }}>
            {scoredOnly ? 'Só pontuados' : 'Todos'}
          </button>

          <button onClick={() => setShowHelp((v) => !v)}
            className="flex items-center gap-1.5 text-[10px] font-mono transition-colors hover:text-cyan-500 px-2 py-1"
            style={{ color: 'var(--text-3)' }}>
            <Info className="h-3 w-3" />
            Como funciona
          </button>

          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 text-[10px] font-mono transition-colors disabled:opacity-40 hover:text-emerald-500 px-2 py-1"
            style={{ color: 'var(--text-3)' }}>
            <RefreshCcw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            SYNC
          </button>
        </div>
      </div>

      {/* Explicação "Como funciona" */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="border-b overflow-hidden" style={{ borderColor: 'var(--border-light)' }}>
            <div className="px-4 py-3 text-[11px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
              <p className="mb-2">
                A <strong>nota é calculada no RD Station</strong> (motor nativo de Lead Scoring) a partir do
                perfil e do engajamento de cada contato. O fluxo do <strong>n8n</strong> puxa essa nota do RD
                e grava no Supabase (<code>leads_rd_pipedrive</code>); este painel apenas <strong>lê</strong> — a
                pontuação nunca é recalculada aqui.
              </p>
              <div className="flex flex-wrap gap-4">
                {(['quente', 'morno', 'frio'] as const).map((b) => (
                  <div key={b} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BAND_META[b].color }} />
                    <span className="font-mono text-[10px]" style={{ color: 'var(--text-3)' }}>
                      {BAND_META[b].label}
                      {b === 'quente' && ` (≥ ${SCORE_BANDS.quente})`}
                      {b === 'morno' && ` (${SCORE_BANDS.morno}–${SCORE_BANDS.quente - 1})`}
                      {b === 'frio' && ` (< ${SCORE_BANDS.morno})`}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px]" style={{ color: 'var(--text-4)' }}>
                Faixas ajustáveis conforme a escala real do RD (confirmada na integração).
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats row */}
      {scoring && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ backgroundColor: 'var(--border)' }}>
          <StatCell label="Nota média" value={scoring.media} icon={<TrendingUp className="h-3 w-3" />}
            color="#06b6d4" sub={`${scoring.scored} de ${scoring.total_rd} pontuados`} />
          <StatCell label="Quentes" value={scoring.por_faixa.quente} icon={<Flame className="h-3 w-3" />}
            color={BAND_META.quente.color} sub={`≥ ${SCORE_BANDS.quente} pts`} />
          <StatCell label="Mornos" value={scoring.por_faixa.morno} icon={<Gauge className="h-3 w-3" />}
            color={BAND_META.morno.color} sub={`${SCORE_BANDS.morno}–${SCORE_BANDS.quente - 1} pts`} />
          <StatCell label="Frios" value={scoring.por_faixa.frio} icon={<Gauge className="h-3 w-3" />}
            color={BAND_META.frio.color} sub={`< ${SCORE_BANDS.morno} pts`} />
        </div>
      )}

      {/* Distribuição por grade (se o RD expõe perfil A/B/C/D) */}
      {scoring && Object.keys(scoring.por_grade).length > 0 && (
        <div className="px-4 py-2 border-b flex items-center gap-3 flex-wrap"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <span className="text-[9px] font-mono uppercase tracking-wider flex items-center gap-1" style={{ color: 'var(--text-4)' }}>
            <Award className="h-3 w-3" /> Perfil:
          </span>
          {Object.entries(scoring.por_grade).sort((a, b) => a[0].localeCompare(b[0])).map(([g, n]) => (
            <div key={g} className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>
                {g} <span className="font-bold" style={{ color: 'var(--text-1)' }}>{n}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Lista */}
      <div className="max-h-[600px] overflow-y-auto">
        {loading && leads.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-3">
            <RefreshCcw className="h-7 w-7 text-emerald-500 animate-spin" />
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Carregando notas...</span>
          </div>
        ) : visibleLeads.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--text-4)' }}>
            <Filter className="h-6 w-6 opacity-40" />
            <span className="text-[11px] font-mono uppercase tracking-widest">
              Nenhum lead RD com nota // aguardando sync do n8n
            </span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="border-b sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
              <tr className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                <th className="p-3 font-semibold w-4" />
                <th className="p-3 font-semibold">Nota</th>
                <th className="p-3 font-semibold">Lead</th>
                <th className="p-3 font-semibold">Estágio</th>
                <th className="p-3 font-semibold">Pontuado</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
              {visibleLeads.map((lead) => {
                const isExpanded = expanded === lead.uid;
                const value = lead.score?.value ?? null;
                const color = bandColor(value);

                return (
                  <React.Fragment key={lead.uid}>
                    <tr className="group transition-colors cursor-pointer border-l-2"
                      style={{ borderLeftColor: color, backgroundColor: `${color}0a` }}
                      onClick={() => setExpanded(isExpanded ? null : lead.uid)}>
                      <td className="pl-3 pr-0">
                        {isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--text-3)' }} />
                          : <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--text-4)' }} />}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <ScoreBadge value={value} grade={lead.score?.grade ?? null} />
                      </td>
                      <td className="p-3">
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                          {lead.nome || <span style={{ color: 'var(--text-4)' }}>—</span>}
                        </div>
                        <div className="text-[10px] font-mono break-all" style={{ color: 'var(--text-2)' }}>
                          {lead.email || <span style={{ color: 'var(--text-4)' }}>sem email</span>}
                        </div>
                        {lead.empresa && (
                          <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{lead.empresa}</div>
                        )}
                      </td>
                      <td className="p-3 text-[10px] font-mono" style={{ color: 'var(--text-2)' }}>
                        {lead.stage_label}
                      </td>
                      <td className="p-3 text-[10px] font-mono whitespace-nowrap" style={{ color: 'var(--text-2)' }}>
                        {lead.score?.scored_at ? (
                          <>
                            {format(new Date(lead.score.scored_at), 'dd/MM HH:mm')}
                            <br />
                            <span style={{ color: 'var(--text-3)' }}>
                              {formatDistanceToNow(new Date(lead.score.scored_at), { addSuffix: true, locale: ptBR })}
                            </span>
                          </>
                        ) : <span style={{ color: 'var(--text-4)' }}>—</span>}
                      </td>
                    </tr>

                    <AnimatePresence>
                      {isExpanded && (
                        <tr style={{ backgroundColor: 'var(--bg-muted)' }}>
                          <td colSpan={5} className="px-6 py-4 border-l-2" style={{ borderLeftColor: color }}>
                            <motion.div
                              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.15 }} className="space-y-3">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                                <Field icon={<Gauge className="h-3 w-3" />} label="Nota (pts)" value={value !== null ? String(value) : null} />
                                <Field icon={<Award className="h-3 w-3" />} label="Perfil" value={lead.score?.grade} />
                                <Field icon={<Mail className="h-3 w-3" />} label="Email" value={lead.email} />
                                <Field icon={<Building2 className="h-3 w-3" />} label="Empresa" value={lead.empresa} />
                              </div>
                              {value === null && (
                                <div className="text-[10px] font-mono" style={{ color: 'var(--c-warning, #f59e0b)' }}>
                                  Sem nota do RD ainda — o n8n grava <code>rd_lead_score</code> em leads_rd_pipedrive.
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
function ScoreBadge({ value, grade }: { value: number | null; grade: string | null }) {
  const color = bandColor(value);
  if (value === null) {
    return <span className="text-[10px] font-mono" style={{ color: 'var(--text-4)' }}>sem nota</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center justify-center rounded-lg text-sm font-bold font-mono"
        style={{ minWidth: 40, padding: '4px 8px', backgroundColor: `${color}1f`, color, border: `1px solid ${color}66` }}>
        {value}
      </span>
      {grade && (
        <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
          {grade}
        </span>
      )}
    </div>
  );
}

function StatCell({ label, value, icon, color, sub }: {
  label: string; value: number; icon: React.ReactNode; color: string; sub?: string;
}) {
  return (
    <div className="p-3" style={{ backgroundColor: 'var(--bg-card)' }}>
      <div className="text-[9px] font-mono uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: 'var(--text-4)' }}>
        {icon} {label}
      </div>
      <div className="text-xl font-bold font-mono" style={{ color }}>{value}</div>
      {sub && <div className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--text-3)' }}>{sub}</div>}
    </div>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5" style={{ color: 'var(--text-4)' }}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>{label}</div>
        <div className="font-mono break-all" style={{ color: value ? 'var(--text-1)' : 'var(--text-4)' }}>{value || '—'}</div>
      </div>
    </div>
  );
}
