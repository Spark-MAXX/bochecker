import React from 'react';
import { AlertCircle, CheckCircle, Users, Activity } from 'lucide-react';
import type { LeadsStats } from '../lib/schemas';

interface StatsHeaderProps {
  openCount: number;
  resolvedToday: number;
  totalWeek: number;
  leadsStats?: LeadsStats | null;
}

export default function StatsHeader({ openCount, resolvedToday, totalWeek, leadsStats }: StatsHeaderProps) {
  const completionRate = leadsStats?.completion_rate_24h ?? 0;
  const completos24h = leadsStats?.completos_24h ?? 0;
  const total24h = leadsStats?.total_24h ?? 0;
  const incompletos24h = leadsStats?.incompletos_24h ?? 0;

  const stats = [
    {
      label: 'Alertas Abertos',
      value: openCount,
      icon: AlertCircle,
      color: 'text-rose-500',
      description: `${resolvedToday} resolvidos hoje`,
    },
    {
      label: 'Leads Completos (24h)',
      value: completos24h,
      icon: CheckCircle,
      color: 'text-emerald-500',
      description: `${total24h} recebidos · ${incompletos24h} incompletos`,
    },
    {
      label: 'Taxa de Completude (24h)',
      value: `${completionRate}%`,
      icon: Users,
      color: completionRate >= 85 ? 'text-emerald-500' : completionRate >= 60 ? 'text-amber-500' : 'text-rose-500',
      description: `Meta 85% · 7d ${leadsStats?.completion_rate_7d ?? 0}%`,
    },
    {
      label: 'Volume (7d)',
      value: leadsStats?.total_7d ?? totalWeek,
      icon: Activity,
      color: 'text-cyan-500',
      description: `${leadsStats?.completos_7d ?? 0} OK · ${leadsStats?.incompletos_7d ?? 0} falhos`,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, idx) => (
        <div key={idx}
          className="glass-card p-5 group relative overflow-hidden transition-all duration-300"
          style={{ borderColor: 'var(--border)' }}>
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium mb-1" style={{ color: 'var(--text-3)' }}>
            {stat.label}
          </p>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold font-mono ${stat.color}`}>{stat.value}</span>
            <span className="text-[10px] font-medium italic" style={{ color: 'var(--text-4)' }}>
              {stat.description}
            </span>
          </div>
          <stat.icon className={`absolute top-4 right-4 h-4 w-4 opacity-10 group-hover:opacity-25 transition-opacity ${stat.color}`} />
        </div>
      ))}
    </div>
  );
}
