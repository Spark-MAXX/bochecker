import React from 'react';
import { AlertCircle, CheckCircle, TrendingDown, Clock } from 'lucide-react';

interface StatsHeaderProps {
  openCount: number;
  resolvedToday: number;
  totalWeek: number;
}

export default function StatsHeader({ openCount, resolvedToday, totalWeek }: StatsHeaderProps) {
  const stats = [
    {
      label: 'Alertas Abertos',
      value: openCount,
      icon: AlertCircle,
      color: 'text-rose-500',
      description: '+2 desde 1h',
    },
    {
      label: 'Resolvidos Hoje',
      value: resolvedToday,
      icon: CheckCircle,
      color: 'text-emerald-500',
      description: 'Eficiência 92%',
    },
    {
      label: 'Lead Completion',
      value: `${((totalWeek - openCount) / (totalWeek || 1) * 100).toFixed(1)}%`,
      icon: Clock,
      color: 'text-cyan-500',
      description: 'Meta 85%',
    },
    {
      label: 'Error Rate (7d)',
      value: `${((openCount / (totalWeek || 1)) * 100).toFixed(1)}%`,
      icon: TrendingDown,
      color: 'text-amber-500',
      description: 'Stable',
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
