import React, { useState, useEffect, useCallback } from 'react';
import { getSupabase } from './lib/supabase';
import StatsHeader from './components/StatsHeader';
import AlertsTable from './components/AlertsTable';
import Charts from './components/Charts';
import Filters from './components/Filters';
import WorkflowsPanel from './components/WorkflowsPanel';
import LeadsMonitor from './components/LeadsMonitor';
import { type Alert, type LeadsStats } from './lib/schemas';
import { Bell, RefreshCcw, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState({
    openCount: 0, resolvedToday: 0, totalWeek: 0,
    recent: [] as Alert[], workflows: [] as any[],
  });
  const [leadsStats, setLeadsStats] = useState<LeadsStats | null>(null);
  const [workflowStats, setWorkflowStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filters, setFilters] = useState({ status: 'open', tipo: '' });
  const [leadsRefreshKey, setLeadsRefreshKey] = useState(0);

  // ── Theme ──────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('spark-theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('spark-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  // ── Data ───────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.tipo) queryParams.append('tipo', filters.tipo);
      const [alertsRes, statsRes, wfStatsRes, leadsStatsRes] = await Promise.all([
        fetch(`/api/alerts?${queryParams.toString()}`),
        fetch('/api/dashboard/stats'),
        fetch('/api/n8n/workflow-stats'),
        fetch('/api/leads/stats'),
      ]);
      const alertsData  = await alertsRes.json();
      const statsData   = await statsRes.json();
      const wfStatsData = wfStatsRes.ok ? await wfStatsRes.json() : [];
      const leadsStatsData = leadsStatsRes.ok ? await leadsStatsRes.json() : null;
      setAlerts(alertsData.data || []);
      setStats({
        openCount: statsData.openCount || 0, resolvedToday: statsData.resolvedToday || 0,
        totalWeek: statsData.totalWeek || 0, recent: statsData.recent || [], workflows: statsData.workflows || [],
      });
      setLeadsStats(leadsStatsData);
      setWorkflowStats(Array.isArray(wfStatsData) ? wfStatsData : []);
    } catch (error) { console.error('Error fetching data:', error); }
    finally { setLoading(false); }
  }, [filters]);

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchData();
        setLeadsRefreshKey(k => k + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [fetchData]);

  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-1)' }}>

      {/* Nav */}
      <nav className="h-16 border-b sticky top-0 z-50 backdrop-blur-md flex items-center justify-between px-8"
        style={{ backgroundColor: 'var(--bg-nav)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-cyan-500 rounded flex items-center justify-center glow-cyan transition-transform hover:scale-110 duration-300">
            <Bell className="h-5 w-5 text-slate-950 stroke-[2.5px]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight uppercase"
            style={{ color: 'var(--text-1)' }}>
            Spark Maxx{' '}
            <span className="text-cyan-400 opacity-80 font-mono text-base ml-1 tracking-normal">// Pipeline</span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full glow-emerald ${loading ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>
              {loading ? 'Analyzing...' : 'System Operational'}
            </span>
          </div>
          <div className="h-4 w-px" style={{ backgroundColor: 'var(--border)' }} />

          {/* Theme toggle */}
          <button onClick={toggleTheme}
            className="p-2 rounded-lg transition-all hover:scale-105"
            style={{ color: 'var(--text-3)' }}
            title={isDark ? 'Modo claro' : 'Modo escuro'}>
            {isDark
              ? <Sun className="h-4 w-4 text-amber-400" />
              : <Moon className="h-4 w-4 text-slate-600" />}
          </button>

          <button onClick={fetchData}
            className="p-2 rounded-lg transition-all"
            style={{ color: 'var(--text-3)' }}
            title="Sincronizar">
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
          <StatsHeader
            openCount={stats.openCount}
            resolvedToday={stats.resolvedToday}
            totalWeek={stats.totalWeek}
            leadsStats={leadsStats}
          />

          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">

              {/* Alerts table */}
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

              <LeadsMonitor refreshKey={leadsRefreshKey} />
            </div>

            {/* Sidebar */}
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
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-10 mt-12 flex justify-between items-center border-t"
        style={{ borderColor: 'var(--border-light)' }}>
        <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-4)' }}>
          Spark Maxx Monitoring // v3.1.0
        </div>
        <div className="text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>
          &copy; {new Date().getFullYear()} Build with AI Studio
        </div>
      </footer>
    </div>
  );
}
