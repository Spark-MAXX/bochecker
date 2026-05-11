import React, { useState } from 'react';
import { format } from 'date-fns';
import { ExternalLink, CheckCircle2, ChevronDown, ChevronRight, AlertTriangle, Zap } from 'lucide-react';
import { type Alert } from '../lib/schemas';

interface AlertsTableProps {
  alerts: Alert[];
  onResolve: (id: string) => void;
}

const MOTIVO_COLORS: Record<string, string> = {
  'não veio no payload':      'text-rose-500   bg-rose-500/10   border-rose-400/30',
  'veio como nulo':           'text-orange-500 bg-orange-500/10 border-orange-400/30',
  'veio vazio':               'text-amber-500  bg-amber-500/10  border-amber-400/30',
  'veio como string "null"':  'text-yellow-600 bg-yellow-500/10 border-yellow-400/30',
  'valor inválido':           'text-red-500    bg-red-500/10    border-red-400/30',
};

function MotivoTag({ motivo }: { motivo: string }) {
  const cls = MOTIVO_COLORS[motivo] || 'text-slate-500 bg-slate-500/10 border-slate-400/30';
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
        <div className="text-xs font-mono text-amber-500/90 italic">
          Campos faltando: {alert.campos_faltantes?.join(', ') || '—'}
        </div>
      );
    }
    return (
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
          {d.resumo}
        </div>
        <div className="space-y-1">
          {d.campos.map((c, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono font-semibold" style={{ color: 'var(--text-1)' }}>{c.campo}</span>
              <span className="text-[10px]" style={{ color: 'var(--text-4)' }}>→</span>
              <MotivoTag motivo={c.motivo} />
            </div>
          ))}
        </div>
        {d.dica && (
          <div className="mt-2 flex items-start gap-1.5 text-[10px] text-cyan-500/80 italic">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            {d.dica}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {d?.motivo ? (
        <div className="flex items-start gap-1.5">
          <Zap className="h-3.5 w-3.5 text-rose-500 mt-0.5 shrink-0" />
          <span className="text-[11px] font-semibold text-rose-500">{d.motivo}</span>
        </div>
      ) : null}
      {d?.node_falhou && (
        <div className="text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>
          Node: <span style={{ color: 'var(--text-2)' }}>{d.node_falhou}</span>
        </div>
      )}
      {(d?.detalhe_original || alert.error_message) && (
        <div className="text-[10px] font-mono italic truncate max-w-xs" style={{ color: 'var(--text-4)' }}
          title={d?.detalhe_original || alert.error_message}>
          {d?.detalhe_original || alert.error_message}
        </div>
      )}
      {!d && alert.error_message && (
        <div className="text-xs font-mono text-rose-500/80 truncate" title={alert.error_message}>
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
        <thead className="border-b" style={{ backgroundColor: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
          <tr className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
            <th className="p-4 font-semibold w-4" />
            <th className="p-4 font-semibold">Severity</th>
            <th className="p-4 font-semibold">Workflow / Lead</th>
            <th className="p-4 font-semibold">Diagnóstico</th>
            <th className="p-4 font-semibold">Criado</th>
            <th className="p-4 font-semibold text-right">Ação</th>
          </tr>
        </thead>
        <tbody style={{ borderColor: 'var(--border-light)' }} className="divide-y divide-[var(--border-light)]">
          {alerts.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-20 text-center text-xs uppercase tracking-widest font-mono"
                style={{ color: 'var(--text-4)' }}>
                Safe: No pending alerts in pipeline //
              </td>
            </tr>
          ) : (
            alerts.map((alert) => {
              const isExpanded = expanded === alert.id;
              const hasDiag = !!alert.diagnostico;
              const leftBorder =
                alert.status === 'resolved' ? 'transparent' :
                alert.severity === 'critical' ? '#f43f5e' :
                alert.severity === 'error' ? '#f97316' : '#f59e0b';
              const rowBg =
                alert.status === 'resolved' ? 'transparent' :
                alert.severity === 'critical' ? 'rgba(244,63,94,0.04)' :
                alert.severity === 'error' ? 'rgba(249,115,22,0.04)' : 'rgba(245,158,11,0.04)';

              return (
                <React.Fragment key={alert.id}>
                  <tr
                    className="group transition-colors cursor-pointer border-l-2"
                    style={{ borderLeftColor: leftBorder, backgroundColor: rowBg }}
                    onClick={() => setExpanded(isExpanded ? null : alert.id)}
                  >
                    <td className="pl-3 pr-0">
                      {hasDiag
                        ? (isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--text-3)' }} />
                          : <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--text-4)' }} />)
                        : null}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                        alert.severity === 'critical' ? 'bg-rose-500/20   text-rose-500   border-rose-500/30' :
                        alert.severity === 'error'    ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' :
                        'bg-amber-500/20 text-amber-500 border-amber-500/30'
                      }`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{alert.workflow_name}</div>
                      <div className="text-[10px] font-mono break-all" style={{ color: 'var(--text-3)' }}>{alert.lead_email || 'N/A'}</div>
                      {alert.lead_nome && (
                        <div className="text-[10px]" style={{ color: 'var(--text-4)' }}>{alert.lead_nome}</div>
                      )}
                    </td>
                    <td className="p-4 max-w-sm">
                      <DiagnosticoPanel alert={alert} />
                    </td>
                    <td className="p-4 text-[10px] font-mono whitespace-nowrap" style={{ color: 'var(--text-3)' }}>
                      {format(new Date(alert.created_at), 'HH:mm:ss')}
                      <br />
                      <span style={{ color: 'var(--text-4)' }}>{format(new Date(alert.created_at), 'dd/MM/yy')}</span>
                    </td>
                    <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        {alert.execution_id && (
                          <a href={`${n8nBaseUrl}/workflow/${alert.workflow_id}/executions/${alert.execution_id}`}
                            target="_blank" rel="noreferrer"
                            className="p-2 rounded-lg transition-all hover:text-cyan-500"
                            style={{ color: 'var(--text-3)' }} title="Ver no n8n">
                            <ExternalLink size={16} />
                          </a>
                        )}
                        {alert.status === 'open' && (
                          <button onClick={() => onResolve(alert.id)}
                            className="p-2 rounded-lg transition-all hover:text-emerald-500"
                            style={{ color: 'var(--text-3)' }} title="Resolver">
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isExpanded && alert.payload_original && (
                    <tr style={{ backgroundColor: 'var(--bg-muted)' }}>
                      <td colSpan={6} className="px-6 py-3 border-l-2" style={{ borderLeftColor: 'var(--border)' }}>
                        <div className="text-[10px] font-mono uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-3)' }}>
                          Payload recebido
                        </div>
                        <pre className="text-[10px] font-mono overflow-x-auto max-h-40 p-3 rounded-lg border"
                          style={{ color: 'var(--text-2)', backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
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
