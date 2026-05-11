import React from 'react';
import { motion } from 'motion/react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface ChartsProps { data: any; }

export default function Charts({ data }: ChartsProps) {
  const { recent } = data;

  // Timeline últimos 30 dias
  const timelineMap = new Map();
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return format(d, 'yyyy-MM-dd');
  }).reverse();
  last30Days.forEach(date => timelineMap.set(date, 0));
  recent.forEach((a: any) => {
    const date = format(parseISO(a.created_at), 'yyyy-MM-dd');
    if (timelineMap.has(date)) timelineMap.set(date, timelineMap.get(date) + 1);
  });
  const timelineData = Array.from(timelineMap.entries()).map(([date, count]) => ({
    date: format(parseISO(date), 'dd/MM'), count,
  }));

  // Top workflows
  const workflowMap = new Map();
  recent.forEach((a: any) => workflowMap.set(a.workflow_name, (workflowMap.get(a.workflow_name) || 0) + 1));
  const workflowData = Array.from(workflowMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a: any, b: any) => b.count - a.count).slice(0, 5);

  // Distribution
  const typeMap = { lead_incompleto: 0, erro_tecnico: 0 };
  recent.forEach((a: any) => { typeMap[a.tipo as keyof typeof typeMap]++; });
  const typeData = [
    { name: 'Lead Incompleto', value: typeMap.lead_incompleto, color: '#f59e0b' },
    { name: 'Erro Técnico',    value: typeMap.erro_tecnico,    color: '#ef4444' },
  ];

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)',
    borderColor: 'var(--border)',
  };

  const tooltipStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
  };

  const gridColor = 'var(--border)';
  const tickColor = 'var(--text-3)';

  return (
    <div className="flex flex-col gap-6">
      {/* Bar chart */}
      <div className="border p-6 rounded-2xl shadow-xl" style={cardStyle}>
        <h3 className="text-[10px] font-bold mb-6 uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>
          Volume de Erros 30d
        </h3>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timelineData.slice(-12)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
              <XAxis dataKey="date" axisLine={false} tickLine={false}
                tick={{ fontSize: 9, fill: tickColor, fontFamily: 'JetBrains Mono' }} />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: 'rgba(127,127,127,0.08)' }}
                contentStyle={tooltipStyle}
                itemStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#f43f5e' }}
                labelStyle={{ fontSize: '10px', color: tickColor }}
              />
              <Bar dataKey="count" fill="#e11d48" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between text-[10px] font-mono mt-4" style={{ color: 'var(--text-4)' }}>
          <span>00:00</span><span>12:00</span><span>NOW</span>
        </div>
      </div>

      {/* Top workflows */}
      <div className="border p-6 rounded-2xl" style={cardStyle}>
        <h3 className="text-[10px] font-bold mb-6 uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>
          Top Workflow Status
        </h3>
        <div className="space-y-5">
          {workflowData.length === 0 ? (
            <p className="text-[10px] font-mono text-center" style={{ color: 'var(--text-4)' }}>Sem dados ainda</p>
          ) : workflowData.map((w: any, i: number) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-medium font-mono uppercase tracking-wider">
                <span style={{ color: 'var(--text-2)' }}>{w.name}</span>
                <span className={i === 0 ? 'text-rose-500' : 'text-amber-500'}>{w.count}</span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(w.count / (workflowData[0].count || 1)) * 100}%` }}
                  transition={{ duration: 1, delay: i * 0.1 }}
                  className={`h-full rounded-full ${i === 0 ? 'bg-rose-500' : 'bg-amber-500'}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pie chart */}
      <div className="border p-6 rounded-2xl" style={cardStyle}>
        <h3 className="text-[10px] font-bold mb-6 uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>
          Fluxo vs Erro
        </h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={typeData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={8} dataKey="value">
                {typeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4">
          {typeData.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="text-[10px] font-mono uppercase tracking-tight" style={{ color: 'var(--text-3)' }}>
                {t.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
