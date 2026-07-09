import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Gauge, Search, ChevronDown, ChevronRight,
  Mail, Building2, RefreshCcw, Filter, Info, Award, TrendingUp,
} from 'lucide-react';
import type { UnifiedLead, FunnelStats } from '../lib/schemas';
import { GRADE_COLORS, gradeFromScore } from '../lib/schemas';

// Bandas de Perfil A/B/C/D (matriz Spark). Faixa da nota 0–10.
const GRADE_META: Record<'A' | 'B' | 'C' | 'D', { label: string; faixa: string }> = {
  A: { label: 'Ótimo perfil', faixa: '7,5–10' },
  B: { label: 'Bom perfil',   faixa: '5,0–7,4' },
  C: { label: 'Perfil médio', faixa: '2,5–4,9' },
  D: { label: 'Perfil baixo', faixa: '0–2,4' },
};
const GRADES = ['A', 'B', 'C', 'D'] as const;

function gradeOf(l: UnifiedLead): 'A' | 'B' | 'C' | 'D' | null {
  const g = l.score?.grade as ('A' | 'B' | 'C' | 'D' | undefined);
  return g || gradeFromScore(l.score?.value ?? null);
}
function gradeColor(g: string | null): string {
  return (g && GRADE_COLORS[g]) || '#64748b';
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
      qs.append('limit', '500');
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
    const val = (l: UnifiedLead) => l.score?.value ?? null;
    let arr = leads.slice();
    if (scoredOnly) arr = arr.filter((l) => val(l) !== null);
    return arr.sort((a, b) => {
      const av = val(a), bv = val(b);
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
            Lead Scoring · Perfil RD
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
            {scoredOnly ? 'Só com Perfil' : 'Todos'}
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
                O <strong>Perfil</strong> é o Lead Scoring demográfico do RD Station. A nota (0–10) vem de
                <strong> Σ nota×peso</strong> de 3 propriedades — <em>O que busca</em> (0,9), <em>Frequência de
                campanha</em> (0,4) e <em>Você é</em> (0,1), pesos normalizados — e classifica o lead em A/B/C/D:
              </p>
              <div className="flex flex-wrap gap-4 mb-2">
                {GRADES.map((g) => (
                  <div key={g} className="flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center rounded font-bold font-mono text-[10px]"
                      style={{ width: 18, height: 18, backgroundColor: `${GRADE_COLORS[g]}1f`, color: GRADE_COLORS[g], border: `1px solid ${GRADE_COLORS[g]}66` }}>{g}</span>
                    <span className="font-mono text-[10px]" style={{ color: 'var(--text-3)' }}>
                      {GRADE_META[g].label} ({GRADE_META[g].faixa})
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px]" style={{ color: 'var(--text-4)' }}>
                Nota calculada a partir dos campos do contato no RD (via n8n → Supabase). Leads sem as respostas
                de "O que busca" e "Frequência" ficam <strong>sem perfil</strong>.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats row */}
      {scoring && (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-px" style={{ backgroundColor: 'var(--border)' }}>
          <StatCell label="Nota média" value={scoring.media.toFixed(1)} icon={<TrendingUp className="h-3 w-3" />}
            color="#06b6d4" sub={`${scoring.scored} de ${scoring.total_rd} c/ perfil`} />
          {GRADES.map((g) => (
            <React.Fragment key={g}>
              <StatCell label={`Banda ${g}`} value={scoring.por_grade?.[g] ?? 0}
                icon={<Award className="h-3 w-3" />} color={GRADE_COLORS[g]} sub={GRADE_META[g].faixa} />
            </React.Fragment>
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
              Nenhum lead RD com Perfil // aguardando sync do n8n
            </span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="border-b sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
              <tr className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                <th className="p-3 font-semibold w-4" />
                <th className="p-3 font-semibold">Perfil</th>
                <th className="p-3 font-semibold">Lead</th>
                <th className="p-3 font-semibold">Estágio</th>
                <th className="p-3 font-semibold">Pontuado</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
              {visibleLeads.map((lead) => {
                const isExpanded = expanded === lead.uid;
                const value = lead.score?.value ?? null;
                const g = gradeOf(lead);
                const color = gradeColor(g);

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
                        <ScoreBadge value={value} grade={g} />
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
                              <ScoreDetail lead={lead} value={value} grade={g} />
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
  const color = gradeColor(grade);
  if (value === null) {
    return <span className="text-[10px] font-mono" style={{ color: 'var(--text-4)' }}>sem perfil</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center justify-center rounded-lg text-sm font-bold font-mono"
        style={{ width: 30, height: 30, backgroundColor: `${color}1f`, color, border: `1px solid ${color}66` }}>
        {grade || '—'}
      </span>
      <span className="text-[11px] font-mono font-semibold" style={{ color: 'var(--text-1)' }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function ScoreDetail({ lead, value, grade }: { lead: UnifiedLead; value: number | null; grade: string | null }) {
  const det: any = (lead.score as any)?.detail || (lead.raw && (lead.raw as any).rd_score_detail) || null;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
        <Field icon={<Award className="h-3 w-3" />} label="Banda" value={grade} />
        <Field icon={<Gauge className="h-3 w-3" />} label="Nota (0–10)" value={value !== null ? value.toFixed(1) : null} />
        <Field icon={<Mail className="h-3 w-3" />} label="Email" value={lead.email} />
        <Field icon={<Building2 className="h-3 w-3" />} label="Empresa" value={lead.empresa} />
      </div>
      {det && (det.o_que_busca || det.frequencia || det.voce_e) && (
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-3)' }}>
            Composição do Perfil (nota × peso)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px] font-mono">
            <PerfilTerm label="O que busca ×0,9" termo={det.o_que_busca?.termo} nota={det.o_que_busca?.nota} />
            <PerfilTerm label="Frequência ×0,4" termo={det.frequencia?.termo} nota={det.frequencia?.nota} />
            <PerfilTerm label="Você é ×0,1" termo={det.voce_e?.termo} nota={det.voce_e?.nota} />
          </div>
        </div>
      )}
      {value === null && (
        <div className="text-[10px] font-mono" style={{ color: 'var(--c-warning, #f59e0b)' }}>
          Sem Perfil — lead não respondeu "O que busca" / "Frequência" no RD.
        </div>
      )}
    </div>
  );
}

function PerfilTerm({ label, termo, nota }: { label: string; termo?: string | null; nota?: number | null }) {
  return (
    <div className="p-2 rounded border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>{label}</div>
      <div style={{ color: 'var(--text-1)' }}>{termo || '—'}</div>
      <div className="mt-0.5" style={{ color: 'var(--text-3)' }}>nota: {nota ?? '—'}</div>
    </div>
  );
}

function StatCell({ label, value, icon, color, sub }: {
  label: string; value: number | string; icon: React.ReactNode; color: string; sub?: string;
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
