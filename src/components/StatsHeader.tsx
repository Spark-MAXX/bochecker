import React from 'react';
import { AlertCircle, CheckCircle, TrendingDown, Clock } from 'lucide-react';
import KpiCard from './KpiCard';

interface StatsHeaderProps {
  openCount: number;
  resolvedToday: number;
  totalWeek: number;
}

export default function StatsHeader({ openCount, resolvedToday, totalWeek }: StatsHeaderProps) {
  const leadCompletion = ((totalWeek - openCount) / (totalWeek || 1)) * 100;
  const errorRate      = (openCount / (totalWeek || 1)) * 100;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <KpiCard label="Alertas Abertos"    value={openCount}                                  accent="rose"    icon={AlertCircle}  hint="pipeline n8n" />
      <KpiCard label="Resolvidos Hoje"    value={resolvedToday}                              accent="emerald" icon={CheckCircle}  hint="últimas 24h" />
      <KpiCard label="Lead Completion"    value={`${leadCompletion.toFixed(1)}%`}            accent="cyan"    icon={Clock}        hint="meta 85%" />
      <KpiCard label="Error Rate (7d)"    value={`${errorRate.toFixed(1)}%`}                 accent="amber"   icon={TrendingDown} hint="janela 7d" />
    </div>
  );
}
