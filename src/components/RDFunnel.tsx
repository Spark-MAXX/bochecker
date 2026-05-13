import React from 'react';
import { motion } from 'motion/react';
import { Send, MailCheck, Eye, MousePointerClick } from 'lucide-react';
import { nFmt, safeRate, type RDFunnel as RDFunnelType } from '../lib/rd-schemas';

interface Props { funnel: RDFunnelType | null; loading?: boolean; }

export default function RDFunnel({ funnel, loading }: Props) {
  const data = funnel || { sent: 0, delivered: 0, opened: 0, unique_opened: 0, clicked: 0, unique_clicked: 0 };
  const max = Math.max(data.sent, 1);

  const stages = [
    { key: 'sent',      label: 'Enviados',     value: data.sent,      sub: undefined,                          icon: Send,               color: '#06b6d4', rate: 100 },
    { key: 'delivered', label: 'Entregues',    value: data.delivered, sub: undefined,                          icon: MailCheck,          color: '#10b981', rate: safeRate(data.delivered, data.sent) },
    { key: 'opened',    label: 'Abertos',      value: data.opened,    sub: `${nFmt(data.unique_opened)} únicos`, icon: Eye,                color: '#f59e0b', rate: safeRate(data.opened, data.delivered) },
    { key: 'clicked',   label: 'Cliques',      value: data.clicked,   sub: `${nFmt(data.unique_clicked)} únicos`, icon: MousePointerClick,  color: '#a855f7', rate: safeRate(data.clicked, data.delivered) },
  ];

  return (
    <div className="border p-6 rounded-2xl shadow-xl" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>
          Funil de Engajamento — Snapshot Atual
        </h3>
        <span className="text-[10px] font-mono" style={{ color: 'var(--text-4)' }}>
          {loading ? 'Carregando…' : 'agregado entre workflows'}
        </span>
      </div>

      <div className="space-y-4">
        {stages.map((s, i) => {
          const widthPct = (s.value / max) * 100;
          return (
            <div key={s.key}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <s.icon className="h-3.5 w-3.5" style={{ color: s.color }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
                    {s.label}
                  </span>
                  {s.sub && <span className="text-[10px] font-mono" style={{ color: 'var(--text-4)' }}>· {s.sub}</span>}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-1)' }}>{nFmt(s.value)}</span>
                  <span className="text-[10px] font-mono" style={{ color: s.color }}>{s.rate.toFixed(1)}%</span>
                </div>
              </div>
              <div className="relative h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-muted)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPct}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}40` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
