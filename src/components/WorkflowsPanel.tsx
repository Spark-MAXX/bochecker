import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Workflow {
  id: string;
  name: string;
  active: boolean;
  last_execution_at: string | null;
  last_execution_status: string | null;
  total_executions: number;
  total_errors: number;
}

interface WorkflowsPanelProps {
  workflows: Workflow[];
  onSyncNow: () => void;
  syncing: boolean;
}

const WORKFLOW_LABELS: Record<string, string> = {
  'VVdWQERBqJsPxeDo': 'RD → Pipedrive',
  'iCSEmoah1GxnsprH': 'Indicação Interna',
  'J2rdIrv7C7gILmpk': 'Leads LP Framer',
};

export default function WorkflowsPanel({ workflows, onSyncNow, syncing }: WorkflowsPanelProps) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-xl border"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="p-4 border-b flex items-center justify-between"
        style={{ backgroundColor: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
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

      <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
        {workflows.map((wf, i) => {
          const isHealthy = wf.last_execution_status === 'success';
          const hasError = wf.last_execution_status === 'error' || wf.last_execution_status === 'crashed';
          const errorRate = wf.total_executions > 0
            ? ((wf.total_errors / wf.total_executions) * 100).toFixed(0) : '0';

          return (
            <motion.div key={wf.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="p-4 transition-colors"
              style={{ borderColor: 'var(--border-light)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-muted)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {isHealthy
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    : hasError
                    ? <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
                    : <Clock className="h-4 w-4 shrink-0" style={{ color: 'var(--text-4)' }} />}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-1)' }}>
                      {WORKFLOW_LABELS[wf.id] || wf.name}
                    </p>
                    <p className="text-[10px] font-mono mt-0.5 truncate" style={{ color: 'var(--text-4)' }}>
                      {wf.last_execution_at
                        ? formatDistanceToNow(new Date(wf.last_execution_at), { addSuffix: true, locale: ptBR })
                        : 'Nunca executado'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>{wf.total_executions} exec</p>
                    <p className={`text-[10px] font-mono font-bold ${Number(errorRate) > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {errorRate}% erros
                    </p>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                    isHealthy  ? 'bg-emerald-500/10 text-emerald-500' :
                    hasError   ? 'bg-rose-500/10 text-rose-500' :
                    'text-slate-500'
                  }`} style={!isHealthy && !hasError ? { backgroundColor: 'var(--bg-muted)' } : {}}>
                    {wf.last_execution_status || 'N/A'}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(Number(errorRate), 100)}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1 }}
                  className={`h-full rounded-full ${
                    Number(errorRate) > 10 ? 'bg-rose-500' :
                    Number(errorRate) > 0  ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
              </div>
            </motion.div>
          );
        })}

        {workflows.length === 0 && (
          <div className="p-6 text-center text-xs font-mono" style={{ color: 'var(--text-4)' }}>
            Aguardando primeiro sync...
          </div>
        )}
      </div>
    </div>
  );
}
