import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  delta?: number | null;        // % de variação vs período anterior
  deltaSuffix?: string;          // ex: 'pp' (pontos percentuais)
  icon?: LucideIcon;
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet' | 'sky';
  loading?: boolean;
}

const ACCENT: Record<string, { color: string; bg: string }> = {
  cyan:    { color: 'text-cyan-500',    bg: 'rgba(6,182,212,0.10)' },
  emerald: { color: 'text-emerald-500', bg: 'rgba(16,185,129,0.10)' },
  amber:   { color: 'text-amber-500',   bg: 'rgba(245,158,11,0.10)' },
  rose:    { color: 'text-rose-500',    bg: 'rgba(244,63,94,0.10)' },
  violet:  { color: 'text-violet-500',  bg: 'rgba(139,92,246,0.10)' },
  sky:     { color: 'text-sky-500',     bg: 'rgba(14,165,233,0.10)' },
};

export default function KpiCard({ label, value, hint, delta, deltaSuffix, icon: Icon, accent = 'cyan', loading }: KpiCardProps) {
  const a = ACCENT[accent];
  const deltaColor = delta == null
    ? 'var(--text-3)'
    : delta > 0 ? '#10b981'
    : delta < 0 ? '#ef4444'
    : 'var(--text-3)';
  const deltaSign = delta == null ? '' : delta > 0 ? '+' : '';
  return (
    <div className="glass-card p-5 group relative overflow-hidden transition-all duration-300" style={{ borderColor: 'var(--border)' }}>
      <p className="text-[10px] uppercase tracking-[0.2em] font-medium mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold font-mono ${a.color}`}>
          {loading ? <span className="inline-block w-16 h-7 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-muted)' }} /> : value}
        </span>
        {hint && <span className="text-[10px] font-medium italic" style={{ color: 'var(--text-4)' }}>{hint}</span>}
      </div>
      {delta != null && (
        <div className="mt-1.5 text-[10px] font-mono font-semibold" style={{ color: deltaColor }}>
          {deltaSign}{delta.toFixed(2)}{deltaSuffix || '%'} <span style={{ color: 'var(--text-4)' }}>vs 7d atrás</span>
        </div>
      )}
      {Icon && <Icon className={`absolute top-4 right-4 h-4 w-4 opacity-10 group-hover:opacity-25 transition-opacity ${a.color}`} />}
    </div>
  );
}
