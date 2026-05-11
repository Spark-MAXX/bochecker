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
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/20">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-violet-400"></div>
          <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-300">Workflows Monitorados</h3>
        </div>
        <button
          onClick={onSyncNow}
          disabled={syncing}
          className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 hover:text-violet-400 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
          SYNC NOW
        </button>
      </div>

      <div className="divide-y divide-slate-800/50">
        {workflows.map((wf, i) => {
          const isHealthy = wf.last_execution_status === 'success';
          const hasError = wf.last_execution_status === 'error' || wf.last_execution_status === 'crashed';
          const errorRate = wf.total_executions > 0
            ? ((wf.total_errors / wf.total_executions) * 100).toFixed(0)
            : '0';

          return (
            <motion.div
              key={wf.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="p-4 hover:bg-slate-800/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {isHealthy ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : hasError ? (
                    <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-slate-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-300 truncate">
                      {WORKFLOW_LABELS[wf.id] || wf.name}
                    </p>
                    <p className="text-[10px] text-slate-600 font-mono mt-0.5 truncate">
                      {wf.last_execution_at
                        ? formatDistanceToNow(new Date(wf.last_execution_at), { addSuffix: true, locale: ptBR })
                        : 'Nunca executado'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] font-mono text-slate-500">{wf.total_executions} exec</p>
                    <p className={`text-[10px] font-mono font-bold ${Number(errorRate) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {errorRate}% erros
                    </p>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                    isHealthy ? 'bg-emerald-500/10 text-emerald-400' :
                    hasError ? 'bg-rose-500/10 text-rose-400' :
                    'bg-slate-700/50 text-slate-500'
                  }`}>
                    {wf.last_execution_status || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Error rate bar */}
              <div className="mt-2.5 w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(Number(errorRate), 100)}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1 }}
                  className={`h-full rounded-full ${Number(errorRate) > 10 ? 'bg-rose-500' : Number(errorRate) > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                />
              </div>
            </motion.div>
          );
        })}

        {workflows.length === 0 && (
          <div className="p-6 text-center text-slate-600 text-xs font-mono">
            Aguardando primeiro sync...
          </div>
        )}
      </div>
    </div>
  );
}
