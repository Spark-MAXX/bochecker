import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCcw } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { type Alert } from '../lib/schemas';
import StatsHeader from './StatsHeader';
import AlertsTable from './AlertsTable';
import Charts from './Charts';
import Filters from './Filters';
import WorkflowsPanel from './WorkflowsPanel';

interface PipelineViewProps {
  onOpenCountChange?: (n: number) => void;
}

export default function PipelineView({ onOpenCountChange }: PipelineViewProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState({
    openCount: 0, resolvedToday: 0, totalWeek: 0,
    recent: [] as Alert[], workflows: [] as any[],
  });
  const [workflowStats, setWorkflowStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filters, setFilters] = useState({ status: 'open', tipo: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.tipo) queryParams.append('tipo', filters.tipo);
      const [alertsRes, statsRes, wfStatsRes] = await Promise.all([
        fetch(`/api/alerts?${queryParams.toString()}`),
        fetch('/api/dashboard/stats'),
        fetch('/api/n8n/workflow-stats'),
      ]);
      const alertsData  = await alertsRes.json();
      const statsData   = await statsRes.json();
      const wfStatsData = wfStatsRes.ok ? await wfStatsRes.json() : [];
      setAlerts(alertsData.data || []);
      setStats({
        openCount: statsData.openCount || 0, resolvedToday: statsData.resolvedToday || 0,
        totalWeek: statsData.totalWeek || 0, recent: statsData.recent || [], workflows: statsData.workflows || [],
      });
      onOpenCountChange?.(statsData.openCount || 0);
      setWorkflowStats(Array.isArray(wfStatsData) ? wfStatsData : []);
    } catch (error) { console.error('Error fetching data:', error); }
    finally { setLoading(false); }
  }, [filters, onOpenCountChange]);

  const handleResolve = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}/resolve`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved_by: 'Dashboard User' }),
      });
      if (res.ok) fetchData();
    } catch (error) { console.error('Error resolving alert:', error); }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try { await fetch('/api/n8n/sync', { method: 'POST' }); await fetchData(); }
    finally { setSyncing(false); }
  };

  useEffect(() => {
    fetchData();
    const supabase = getSupabase();
    if (!supabase) return;
    const subscription = supabase.channel('alerts_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'n8n_executions' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [fetchData]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <StatsHeader openCount={stats.openCount} resolvedToday={stats.resolvedToday} totalWeek={stats.totalWeek} />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          <div className="rounded-2xl flex flex-col overflow-hidden shadow-2xl border"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="p-4 border-b flex flex-wrap gap-4 justify-between items-center"
              style={{ backgroundColor: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                <h3 className="text-sm font-semibold tracking-wide uppercase" style={{ color: 'var(--text-2)' }}>
                  Monitor de Alertas
                </h3>
              </div>
              <Filters filters={filters} setFilters={setFilters} />
            </div>
            <div className="min-h-[400px]">
              <AnimatePresence mode="wait">
                {loading && alerts.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center gap-3">
                    <RefreshCcw className="h-8 w-8 text-cyan-500 animate-spin" />
                    <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">Acessando Supabase...</span>
                  </div>
                ) : (
                  <motion.div key={filters.status + filters.tipo} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <AlertsTable alerts={alerts} onResolve={handleResolve} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <WorkflowsPanel workflows={workflowStats.length ? workflowStats : stats.workflows} onSyncNow={handleSyncNow} syncing={syncing} />
        </div>

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <Charts data={stats} />
          <div className="mt-auto flex items-center justify-between p-4 rounded-xl border"
            style={{ backgroundColor: 'rgba(6,182,212,0.06)', borderColor: 'rgba(6,182,212,0.2)' }}>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse glow-cyan" />
              <span className="text-[10px] text-cyan-500 font-bold uppercase tracking-widest">Real-time Pipeline Active</span>
            </div>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>n8n + SUPABASE // OK</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
