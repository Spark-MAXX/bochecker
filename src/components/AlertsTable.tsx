import React from 'react';
import { format } from 'date-fns';
import { ExternalLink, CheckCircle2 } from 'lucide-react';
import { type Alert } from '../lib/schemas';

interface AlertsTableProps {
  alerts: Alert[];
  onResolve: (id: string) => void;
}

export default function AlertsTable({ alerts, onResolve }: AlertsTableProps) {
  const n8nBaseUrl = 'https://growthsparkmaxx.app.n8n.cloud';

  return (
    <div className="w-full">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-950/50 border-b border-slate-800/50">
          <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
            <th className="p-4 font-semibold">Severity</th>
            <th className="p-4 font-semibold uppercase">Workflow / Lead</th>
            <th className="p-4 font-semibold uppercase">Issue Description</th>
            <th className="p-4 font-semibold uppercase">Created</th>
            <th className="p-4 font-semibold text-right uppercase">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {alerts.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-20 text-center text-slate-600 font-mono text-xs uppercase tracking-widest">
                Safe: No pending alerts in pipeline //
              </td>
            </tr>
          ) : (
            alerts.map((alert) => (
              <tr 
                key={alert.id} 
                className={`group transition-colors border-l-2 ${
                  alert.status === 'resolved' ? 'border-transparent bg-slate-900/10' :
                  alert.severity === 'critical' ? 'border-rose-500 bg-rose-500/5' :
                  alert.severity === 'error' ? 'border-orange-500 bg-orange-500/5' :
                  'border-amber-500 bg-amber-500/5'
                }`}
              >
                <td className="p-4 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                    alert.severity === 'critical' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                    alert.severity === 'error' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                    'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}>
                    {alert.severity}
                  </span>
                </td>
                <td className="p-4">
                  <div className="text-sm font-medium text-slate-200">{alert.workflow_name}</div>
                  <div className="text-[10px] font-mono text-slate-500 break-all">{alert.lead_email || 'N/A'}</div>
                </td>
                <td className="p-4 max-w-sm">
                  {alert.tipo === 'lead_incompleto' ? (
                    <div className="text-xs font-mono text-amber-300/80 italic leading-relaxed">
                      Missing: {alert.campos_faltantes?.join(', ')}
                    </div>
                  ) : (
                    <div className="text-xs font-mono text-rose-300/80 leading-relaxed truncate" title={alert.error_message}>
                      {alert.error_message}
                    </div>
                  )}
                </td>
                <td className="p-4 text-[10px] font-mono text-slate-500 whitespace-nowrap">
                  {format(new Date(alert.created_at), 'HH:mm:ss')}
                  <br />
                  <span className="opacity-50">{format(new Date(alert.created_at), 'dd/MM/yy')}</span>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    {alert.execution_id && (
                      <a 
                        href={`${n8nBaseUrl}/workflow/${alert.workflow_id}/executions/${alert.execution_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all"
                        title="Ver n8n"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                    {alert.status === 'open' && (
                      <button
                        onClick={() => onResolve(alert.id)}
                        className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                        title="Resolve"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
