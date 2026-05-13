import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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

// Accent colors are theme-agnostic semantic hues (status/identity)
const ACCENT: Record<string, { fg: string; ring: string }> = {
  cyan:    { fg: 'var(--accent)',  ring: 'var(--accent-soft)' },
  emerald: { fg: '#10b981', ring: 'rgba(16,185,129,0.12)' },
  amber:   { fg: '#f59e0b', ring: 'rgba(245,158,11,0.12)' },
  rose:    { fg: '#f43f5e', ring: 'rgba(244,63,94,0.12)' },
  violet:  { fg: '#a855f7', ring: 'rgba(168,85,247,0.12)' },
  sky:     { fg: '#0ea5e9', ring: 'rgba(14,165,233,0.12)' },
};

export default function KpiCard({ label, value, hint, delta, deltaSuffix, icon: Icon, accent = 'cyan', loading }: KpiCardProps) {
  const a = ACCENT[accent];
  const deltaPositive = delta != null && delta > 0;
  const deltaNegative = delta != null && delta < 0;
  const deltaColor = deltaPositive ? 'var(--c-success)' : deltaNegative ? 'var(--c-error)' : 'var(--text-3)';
  const DeltaIcon = deltaPositive ? TrendingUp : deltaNegative ? TrendingDown : Minus;

  return (
    <div className="glass-card p-5 group relative overflow-hidden">
      {/* Top accent strip */}
      <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: a.fg }} />

      <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: 'var(--text-3)' }}>
        {label}
      </p>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold font-mono tabular-nums" style={{ color: a.fg }}>
          {loading
            ? <span className="inline-block w-20 h-8 skeleton" />
            : value}
        </span>
        {hint && !loading && (
          <span className="text-[10px] font-medium" style={{ color: 'var(--text-4)' }}>{hint}</span>
        )}
      </div>

      {delta != null && !loading && (
        <div className="mt-2 flex items-center gap-1 text-[10px] font-mono font-semibold" style={{ color: deltaColor }}>
          <DeltaIcon className="h-3 w-3" />
          <span className="tabular-nums">{deltaPositive ? '+' : ''}{delta.toFixed(2)}{deltaSuffix || '%'}</span>
          <span className="font-normal" style={{ color: 'var(--text-4)' }}>vs 7d</span>
        </div>
      )}

      {Icon && (
        <div className="absolute top-3 right-3 p-2 rounded-lg opacity-40 group-hover:opacity-90 transition-opacity"
          style={{ backgroundColor: a.ring }}>
          <Icon className="h-3.5 w-3.5" style={{ color: a.fg }} />
        </div>
      )}
    </div>
  );
}
