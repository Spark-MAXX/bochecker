import React, { useState } from 'react';
import { format } from 'date-fns';
import { ExternalLink, CheckCircle2, ChevronDown, ChevronRight, AlertTriangle, Zap } from 'lucide-react';
import { type Alert } from '../lib/schemas';

interface AlertsTableProps {
  alerts: Alert[];
  onResolve: (id: string) => void;
}

const MOTIVO_COLORS: Record<string, string> = {
  'não veio no payload':      'text-rose-400 bg-rose-500/10 border-rose-500/20',
  'veio como nulo':           'text-orange-400 bg-orange-500/10 border-orange-500/20',
  'veio vazio':               'text-amber-400 bg-amber-500/10 border-amber-500/20',
  'veio como string "null"':  'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  'valor inválido':           'text-red-400 bg-red-500/10 border-red-500/20',
};

function MotivoTag({ motivo }: { motivo: string }) {
  const cls = MOTIVO_COLORS[motivo] || 'text-slate-400 bg-slate-500/10 border-slate-500/20';
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border ${cls}`}>
      {motivo}
    </span>
  );
}

function DiagnosticoPanel({ alert }: { alert: Alert }) {
  const d = alert.diagnostico;

  if (alert.tipo === 'lead_incompleto') {
    if (!d?.campos?.length) {
      return (
        <div className="text-xs font-mono text-amber-300/80 italic">
          Campos faltando: {alert.campos_faltantes?.join(', ') || '—'}
        </div>
      );
    }
    return (
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          {d.resumo}
        </div>
        <div className="space-y-1">
          {d.campos.map((c, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono text-slate-300 font-semibold">{c.campo}</span>
              <span className="text-slate-600 text-[10px]">→</span>
              <MotivoTag motivo={c.motivo} />
            </div>
          ))}
        </div>
        {d.dica && (
          <div className="mt-2 flex items-start gap-1.5 text-[10px] text-cyan-400/70 italic">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            {d.dica}
          </div>
        )}
      </div>
    );
  }

  // erro_tecnico
  return (
    <div className="space-y-1.5">
      {d?.motivo ? (
        <div className="flex items-start gap-1.5">
          <Zap className="h-3.5 w-3.5 text-rose-400 mt-0.5 shrink-0" />
          <span className="text-[11px] font-semibold text-rose-300">{d.motivo}</span>
        </div>
      ) : null}
      {d?.node_falhou && (
        <div className="text-[10px] font-mono text-slate-500">
          Node: <span className="text-slate-300">{d.node_falhou}</span>
        </div>
      )}
      {(d?.detalhe_original || alert.error_message) && (
        <div className="text-[10px] font-mono text-slate-600 italic truncate max-w-xs"
          title={d?.detalhe_original || alert.error_message}>
          {d?.detalhe_original || alert.error_message}
        </div>
      )}
      {!d && alert.error_message && (
        <div className="text-xs font-mono text-rose-300/80 truncate" title={alert.error_message}>
          {alert.error_message}
        </div>
      )}
    </div>
  );
}

export default function AlertsTable({ alerts, onResolve }: AlertsTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const n8nBaseUrl = 'https://growthsparkmaxx.app.n8n.cloud';

  return (
    <div className="w-full">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-950/50 border-b border-slate-800/50">
          <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
            <th className="p-4 font-semibold w-4"></th>
            <th className="p-4 font-semibold">Severity</th>
            <th className="p-4 font-semibold">Workflow / Lead</th>
            <th className="p-4 font-semibold">Diagnóstico</th>
            <th className="p-4 font-semibold">Criado</th>
            <th className="p-4 font-semibold text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {alerts.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-20 text-center text-slate-600 font-mono text-xs uppercase tracking-widest">
                Safe: No pending alerts in pipeline //
              </td>
            </tr>
          ) : (
            alerts.map((alert) => {
              const isExpanded = expanded === alert.id;
              const hasDiag = !!alert.diagnostico;
              return (
                <React.Fragment key={alert.id}>
                  <tr
                    className={`group transition-colors border-l-2 cursor-pointer ${
                      alert.status === 'resolved' ? 'border-transparent bg-slate-900/10' :
                      alert.severity === 'critical' ? 'border-rose-500 bg-rose-500/5 hover:bg-rose-500/10' :
                      alert.severity === 'error'    ? 'border-orange-500 bg-orange-500/5 hover:bg-orange-500/10' :
                      'border-amber-500 bg-amber-500/5 hover:bg-amber-500/10'
                    }`}
                    onClick={() => setExpanded(isExpanded ? null : alert.id)}
                  >
                    <td className="pl-3 pr-0">
                      {hasDiag
                        ? (isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                          : <ChevronRight className="h-3.5 w-3.5 text-slate-600" />)
                        : null}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                        alert.severity === 'critical' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                        alert.severity === 'error'    ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                        'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium text-slate-200">{alert.workflow_name}</div>
                      <div className="text-[10px] font-mono text-slate-500 break-all">{alert.lead_email || 'N/A'}</div>
                      {alert.lead_nome && (
                        <div className="text-[10px] text-slate-600">{alert.lead_nome}</div>
                      )}
                    </td>
                    <td className="p-4 max-w-sm">
                      <DiagnosticoPanel alert={alert} />
                    </td>
                    <td className="p-4 text-[10px] font-mono text-slate-500 whitespace-nowrap">
                      {format(new Date(alert.created_at), 'HH:mm:ss')}
                      <br />
                      <span className="opacity-50">{format(new Date(alert.created_at), 'dd/MM/yy')}</span>
                    </td>
                    <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        {alert.execution_id && (
                          <a
                            href={`${n8nBaseUrl}/workflow/${alert.workflow_id}/executions/${alert.execution_id}`}
                            target="_blank" rel="noreferrer"
                            className="p-2 text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all"
                            title="Ver no n8n"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                        {alert.status === 'open' && (
                          <button
                            onClick={() => onResolve(alert.id)}
                            className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                            title="Resolver"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Linha expandida com payload original */}
                  {isExpanded && alert.payload_original && (
                    <tr className="bg-slate-950/60">
                      <td colSpan={6} className="px-6 py-3 border-l-2 border-slate-700">
                        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">Payload recebido</div>
                        <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto max-h-40 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                          {JSON.stringify(alert.payload_original, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
