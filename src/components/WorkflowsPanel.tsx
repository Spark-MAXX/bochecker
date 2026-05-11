import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Clock, RefreshCw, ChevronDown, ChevronRight, Zap, TrendingUp } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Types ────────────────────────────────────────────────────────────────────
interface SparkDay { date: string; total: number; errors: number; }
interface RecentExec {
  execution_id: string; status: string; started_at: string;
  finished_at: string | null; duration_ms: number | null;
  node_error: string | null; error_message: string | null;
}
interface WorkflowStats {
  id: string; name: string; active: boolean;
  last_execution_at: string | null; last_execution_status: string | null;
  total_executions: number; total_errors: number;
  success_rate: number; avg_duration_ms: number | null;
  executions_24h: number; errors_24h: number;
  last_10_statuses: string[]; sparkline: SparkDay[];
  recent_executions: RecentExec[];
}

interface WorkflowsPanelProps {
  workflows: WorkflowStats[];
  onSyncNow: () => void;
  syncing: boolean;
}

const LABELS: Record<string, string> = {
  'VVdWQERBqJsPxeDo': 'RD → Pipedrive',
  'iCSEmoah1GxnsprH': 'Indicação Interna',
  'J2rdIrv7C7gILmpk': 'Leads LP Framer',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDuration(ms: number | null) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

function rateColor(rate: number) {
  if (rate >= 90) return '#22c55e';
  if (rate >= 70) return '#f59e0b';
  return '#ef4444';
}

// ── Donut SVG ────────────────────────────────────────────────────────────────
function DonutChart({ rate }: { rate: number }) {
  const r = 18, circ = 2 * Math.PI * r;
  const dash = (rate / 100) * circ;
  const color = rateColor(rate);
  return (
    <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      </svg>
      <span className="absolute text-[11px] font-bold font-mono" style={{ color }}>
        {rate}%
      </span>
    </div>
  );
}

// ── Sparkline SVG ────────────────────────────────────────────────────────────
function Sparkline({ data }: { data: SparkDay[] }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.total), 1);
  const W = 80, H = 24, barW = Math.floor(W / data.length) - 1;

  return (
    <svg width={W} height={H} className="shrink-0">
      {data.map((d, i) => {
        const h = Math.max(2, Math.round((d.total / max) * H));
        const errH = d.total > 0 ? Math.round((d.errors / d.total) * h) : 0;
        const x = i * (barW + 1);
        return (
          <g key={i}>
            <rect x={x} y={H - h} width={barW} height={h} fill="var(--border)" rx="1" />
            {errH > 0 && <rect x={x} y={H - errH} width={barW} height={errH} fill="#ef4444" rx="1" opacity="0.7" />}
          </g>
        );
      })}
    </svg>
  );
}

// ── History Dots ─────────────────────────────────────────────────────────────
function HistoryDots({ statuses }: { statuses: string[] }) {
  const reversed = [...statuses].reverse(); // oldest first → left
  return (
    <div className="flex items-center gap-1">
      {reversed.map((s, i) => (
        <div key={i}
          title={s}
          className="rounded-full transition-transform hover:scale-125"
          style={{
            width: 7, height: 7,
            backgroundColor: s === 'success' ? '#22c55e' : s === 'error' || s === 'crashed' ? '#ef4444' : '#94a3b8',
            boxShadow: s === 'error' || s === 'crashed' ? '0 0 4px rgba(239,68,68,0.6)' : 'none',
          }} />
      ))}
      {statuses.length === 0 && <span className="text-[9px] font-mono" style={{ color: 'var(--text-4)' }}>sem dados</span>}
    </div>
  );
}

// ── Recent Executions Table ───────────────────────────────────────────────────
function RecentTable({ execs, workflowId }: { execs: RecentExec[]; workflowId: string }) {
  const n8nBase = 'https://growthsparkmaxx.app.n8n.cloud';
  return (
    <div className="mt-3 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-light)' }}>
      <table className="w-full text-[10px] font-mono">
        <thead>
          <tr style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-3)' }}>
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Status</th>
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Início</th>
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Duração</th>
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Erro</th>
            <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Link</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
          {execs.map((e, i) => (
            <tr key={i} style={{ color: 'var(--text-2)' }}>
              <td className="px-3 py-2">
                <span className="font-bold" style={{ color: e.status === 'success' ? '#22c55e' : '#ef4444' }}>
                  {e.status === 'success' ? '● OK' : '● ERRO'}
                </span>
              </td>
              <td className="px-3 py-2" style={{ color: 'var(--text-3)' }}>
                {e.started_at ? format(new Date(e.started_at), 'dd/MM HH:mm:ss') : '—'}
              </td>
              <td className="px-3 py-2">{fmtDuration(e.duration_ms)}</td>
              <td className="px-3 py-2 max-w-[160px] truncate" style={{ color: 'var(--c-error)' }}
                title={e.error_message || ''}>
                {e.node_error || e.error_message || '—'}
              </td>
              <td className="px-3 py-2 text-right">
                <a href={`${n8nBase}/workflow/${workflowId}/executions/${e.execution_id}`}
                  target="_blank" rel="noreferrer"
                  className="text-cyan-500 hover:underline">↗</a>
              </td>
            </tr>
          ))}
          {execs.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-4 text-center" style={{ color: 'var(--text-4)' }}>
                Sem execuções registradas
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function WorkflowsPanel({ workflows, onSyncNow, syncing }: WorkflowsPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="rounded-2xl overflow-hidden shadow-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between" style={{ backgroundColor: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-violet-500" />
          <h3 className="text-sm font-semibold tracking-wide uppercase" style={{ color: 'var(--text-2)' }}>
            Workflows Monitorados
          </h3>
        </div>
        <button onClick={onSyncNow} disabled={syncing}
          className="flex items-center gap-1.5 text-[10px] font-mono transition-colors disabled:opacity-40 hover:text-violet-500"
          style={{ color: 'var(--text-3)' }}>
          <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
          SYNC NOW
        </button>
      </div>

      {/* Workflow Cards */}
      <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
        {workflows.length === 0 && (
          <div className="p-6 text-center text-xs font-mono" style={{ color: 'var(--text-4)' }}>
            Aguardando primeiro sync...
          </div>
        )}

        {workflows.map((wf, i) => {
          const isExpanded = expanded === wf.id;
          const isHealthy = wf.last_execution_status === 'success';
          const hasError = wf.last_execution_status === 'error' || wf.last_execution_status === 'crashed';
          const rate = wf.success_rate ?? 0;

          return (
            <motion.div key={wf.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}>

              {/* Card principal */}
              <div className="p-4 cursor-pointer transition-colors"
                style={{ borderColor: 'var(--border-light)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-muted)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                onClick={() => setExpanded(isExpanded ? null : wf.id)}>

                {/* Linha superior: nome + status + expand */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {isExpanded
                      ? <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--text-3)' }} />
                      : <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--text-4)' }} />}
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                      {LABELS[wf.id] || wf.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>
                      {wf.last_execution_at
                        ? formatDistanceToNow(new Date(wf.last_execution_at), { addSuffix: true, locale: ptBR })
                        : 'nunca'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      isHealthy  ? 'bg-emerald-500/10 text-emerald-500' :
                      hasError   ? 'bg-rose-500/10    text-rose-500'    :
                      'text-slate-400'
                    }`} style={!isHealthy && !hasError ? { backgroundColor: 'var(--bg-muted)' } : {}}>
                      {wf.last_execution_status || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Métricas principais */}
                <div className="flex items-center gap-4">
                  {/* Donut */}
                  <DonutChart rate={rate} />

                  {/* Stats grid */}
                  <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-2">
                    <div>
                      <div className="text-[9px] font-mono uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-4)' }}>
                        Total Execuções
                      </div>
                      <div className="text-sm font-bold font-mono" style={{ color: 'var(--text-1)' }}>
                        {wf.total_executions}
                        <span className="text-[10px] font-normal ml-1.5" style={{ color: 'var(--text-3)' }}>
                          ({wf.total_errors} erros)
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-mono uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-4)' }}>
                        Últimas 24h
                      </div>
                      <div className="text-sm font-bold font-mono" style={{ color: 'var(--text-1)' }}>
                        {wf.executions_24h}
                        {wf.errors_24h > 0 && (
                          <span className="text-[10px] font-normal ml-1.5 text-rose-500">
                            ({wf.errors_24h} erros)
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-mono uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-4)' }}>
                        Tempo Médio
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-amber-500" />
                        <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-1)' }}>
                          {fmtDuration(wf.avg_duration_ms)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-mono uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-4)' }}>
                        Taxa Sucesso
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" style={{ color: rateColor(rate) }} />
                        <span className="text-sm font-bold font-mono" style={{ color: rateColor(rate) }}>
                          {rate}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sparkline */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>7 dias</div>
                    <Sparkline data={wf.sparkline || []} />
                  </div>
                </div>

                {/* History dots */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[9px] font-mono uppercase tracking-wider shrink-0" style={{ color: 'var(--text-4)' }}>
                    Últimas 10
                  </span>
                  <HistoryDots statuses={wf.last_10_statuses || []} />
                </div>
              </div>

              {/* Expanded: tabela de execuções */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                    className="overflow-hidden px-4 pb-4"
                    style={{ borderTop: `1px solid var(--border-light)` }}>
                    <div className="pt-3">
                      <div className="text-[10px] font-mono uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-3)' }}>
                        Últimas execuções
                      </div>
                      <RecentTable execs={wf.recent_executions || []} workflowId={wf.id} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
