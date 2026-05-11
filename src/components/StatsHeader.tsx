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
      color: 'text-emerald-400',
      description: 'Eficiência 92%',
    },
    {
      label: 'Lead Completion',
      value: `${((totalWeek - openCount) / (totalWeek || 1) * 100).toFixed(1)}%`,
      icon: Clock,
      color: 'text-cyan-400',
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
        <div key={idx} className="glass-card p-5 group hover:border-slate-700 transition-all duration-300">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1 font-medium">{stat.label}</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold font-mono ${stat.color}`}>{stat.value}</span>
            <span className="text-[10px] text-slate-600 font-medium italic">{stat.description}</span>
          </div>
          <stat.icon className={`absolute top-4 right-4 h-4 w-4 opacity-10 group-hover:opacity-30 transition-opacity ${stat.color}`} />
        </div>
      ))}
    </div>
  );
}
