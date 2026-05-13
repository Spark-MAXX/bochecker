import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { type RDTimeseriesPoint } from '../lib/rd-schemas';

interface Props { data: RDTimeseriesPoint[]; loading?: boolean; }

type Mode = 'rates' | 'volume';

const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 11,
};

export default function RDTimeSeries({ data, loading }: Props) {
  const [mode, setMode] = useState<Mode>('rates');

  const formatted = (data || []).map(d => ({
    ...d,
    label: format(parseISO(d.date), 'dd/MM', { locale: ptBR }),
  }));

  return (
    <div className="border p-6 rounded-2xl shadow-xl" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>
          Evolução — Últimos {data?.length || 30} dias
        </h3>
        <div className="flex items-center gap-1 p-0.5 rounded-md border" style={{ borderColor: 'var(--border)' }}>
          {(['rates', 'volume'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-all"
              style={{
                backgroundColor: mode === m ? 'rgba(6,182,212,0.15)' : 'transparent',
                color: mode === m ? '#06b6d4' : 'var(--text-3)',
              }}>
              {m === 'rates' ? 'Taxas' : 'Volume'}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        {loading ? (
          <div className="h-full flex items-center justify-center text-[10px] font-mono" style={{ color: 'var(--text-4)' }}>
            Carregando série temporal…
          </div>
        ) : formatted.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[10px] font-mono" style={{ color: 'var(--text-4)' }}>
            Aguardando primeiros snapshots…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {mode === 'rates' ? (
              <LineChart data={formatted} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-3)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-3)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${Number(v).toFixed(2)}%`} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="circle" />
                <Line type="monotone" dataKey="open_rate"   name="Open Rate"   stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="click_rate"  name="Click Rate"  stroke="#a855f7" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="bounce_rate" name="Bounce Rate" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            ) : (
              <AreaChart data={formatted} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-3)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-3)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="circle" />
                <Area type="monotone" dataKey="sent"      name="Enviados"  stroke="#06b6d4" fill="url(#gSent)" strokeWidth={2} />
                <Area type="monotone" dataKey="delivered" name="Entregues" stroke="#10b981" fill="url(#gDel)"  strokeWidth={2} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
