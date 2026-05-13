import React from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

export interface TabItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  badge?: number;
}

interface TabNavProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}

export default function TabNav({ tabs, active, onChange }: TabNavProps) {
  return (
    <div className="flex items-center gap-1 px-1 py-1 rounded-xl border overflow-x-auto"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      {tabs.map(t => {
        const isActive = active === t.key;
        const Icon = t.icon;
        return (
          <button key={t.key} onClick={() => onChange(t.key)}
            className="relative px-4 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap"
            style={{ color: isActive ? 'var(--text-1)' : 'var(--text-3)' }}>
            {isActive && (
              <motion.div layoutId="active-tab-pill"
                className="absolute inset-0 rounded-lg"
                style={{ backgroundColor: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.35)' }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
            )}
            <span className="relative flex items-center gap-2">
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold tabular-nums"
                  style={{ backgroundColor: 'rgba(244,63,94,0.15)', color: '#f43f5e' }}>
                  {t.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
