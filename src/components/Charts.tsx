import React from 'react';
import { motion } from 'motion/react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface ChartsProps {
  data: any;
}

export default function Charts({ data }: ChartsProps) {
  const { recent } = data;

  // Compute Timeline: Alertas/dia últimos 30 dias
  const timelineMap = new Map();
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return format(d, 'yyyy-MM-dd');
  }).reverse();

  last30Days.forEach(date => timelineMap.set(date, 0));
  recent.forEach((a: any) => {
    const date = format(parseISO(a.created_at), 'yyyy-MM-dd');
    if (timelineMap.has(date)) {
      timelineMap.set(date, timelineMap.get(date) + 1);
    }
  });
  const timelineData = Array.from(timelineMap.entries()).map(([date, count]) => ({ date: format(parseISO(date), 'dd/MM'), count }));

  // Compute Workflows: Top workflows com erro
  const workflowMap = new Map();
  recent.forEach((a: any) => {
    workflowMap.set(a.workflow_name, (workflowMap.get(a.workflow_name) || 0) + 1);
  });
  const workflowData = Array.from(workflowMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Compute Distribution: Lead Incompleto vs Erro Técnico
  const typeMap = { lead_incompleto: 0, erro_tecnico: 0 };
  recent.forEach((a: any) => {
    typeMap[a.tipo as keyof typeof typeMap]++;
  });
  const typeData = [
    { name: 'Lead Incompleto', value: typeMap.lead_incompleto, color: '#f59e0b' },
    { name: 'Erro Técnico', value: typeMap.erro_tecnico, color: '#ef4444' }
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Line Chart: Volumetria de Alertas */}
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h3 className="text-[10px] font-bold text-slate-500 mb-6 uppercase tracking-[0.2em]">Volume de Erros 24h</h3>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timelineData.slice(-12)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'JetBrains Mono' }} />
              <YAxis hide />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                itemStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#f43f5e' }}
                labelStyle={{ fontSize: '10px', color: '#64748b' }}
              />
              <Bar dataKey="count" fill="#e11d48" radius={[2, 2, 0, 0]} className="glow-rose" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 font-mono mt-4">
          <span>00:00</span><span>12:00</span><span>NOW</span>
        </div>
      </div>

      {/* Top Workflows Progress Style */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-[10px] font-bold text-slate-500 mb-6 uppercase tracking-[0.2em]">Top Workflow Status</h3>
        <div className="space-y-5">
          {workflowData.map((w, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-medium font-mono uppercase tracking-wider">
                <span className="text-slate-400">{w.name}</span>
                <span className={i === 0 ? 'text-rose-500' : 'text-amber-500'}>{w.count}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(w.count / (workflowData[0].count || 1)) * 100}%` }}
                  transition={{ duration: 1, delay: i * 0.1 }}
                  className={`h-full rounded-full ${i === 0 ? 'bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`}
                ></motion.div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Distribution Mini Pie */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-[10px] font-bold text-slate-500 mb-6 uppercase tracking-[0.2em]">Fluxo vs Erro</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={typeData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={50}
                paddingAngle={8}
                dataKey="value"
              >
                {typeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip 
                 contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4">
          {typeData.map((t, i) => (
             <div key={i} className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }}></div>
               <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tight">{t.name}</span>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
}
