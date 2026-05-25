import React, { useState, useEffect, useCallback } from 'react';
import { getSupabase } from './lib/supabase';
import Sidebar, { type Page } from './components/Sidebar';
import Overview from './components/Overview';
import AlertsTable from './components/AlertsTable';
import Filters from './components/Filters';
import WorkflowsPanel from './components/WorkflowsPanel';
import JourneyMonitor from './components/JourneyMonitor';
import LeadsMonitor from './components/LeadsMonitor';
import { type Alert, type LeadsStats } from './lib/schemas';

const PAGE_META: Record<Page, { title: string; subtitle: string }> = {
  overview:  { title: 'Visão geral',     subtitle: 'KPIs do pipeline em tempo real' },
  funil:     { title: 'Funil de leads',  subtitle: 'Framer / Webinar → RD → Pipedrive' },
  leads:     { title: 'Leads',           subtitle: 'Completos e incompletos do validador' },
  execucoes: { title: 'Execuções n8n',   subtitle: 'Saúde e histórico dos workflows' },
  alertas:   { title: 'Alertas',         subtitle: 'Leads incompletos e erros técnicos' },
};

export default function App() {
  const [page, setPage] = useState<Page>('overview');
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
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Theme ──────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('spark-theme') as 'dark' | 'light') || 'dark',
  );
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('spark-theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  // ── Data ───────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      if (filters.status) qp.append('status', filters.status);
      if (filters.tipo) qp.append('tipo', filters.tipo);
      const [alertsRes, statsRes, wfStatsRes, leadsStatsRes] = await Promise.all([
        fetch(`/api/alerts?${qp.toString()}`),
        fetch('/api/dashboard/stats'),
        fetch('/api/n8n/workflow-stats'),
        fetch('/api/leads/stats'),
      ]);
      const alertsData = await alertsRes.json();
      const statsData = await statsRes.json();
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

  const handleRefresh = () => { fetchData(); setRefreshKey((k) => k + 1); };

  useEffect(() => {
    fetchData();
    const supabase = getSupabase();
    if (!supabase) return;
    const bump = () => { fetchData(); setRefreshKey((k) => k + 1); };
    const subscription = supabase.channel('spark_pipeline')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'n8n_executions' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads_framer' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads_rd_pipedrive' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads_webinar' }, bump)
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [fetchData]);

  const meta = PAGE_META[page];

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-1)' }}>
      <Sidebar
        page={page} onNavigate={setPage}
        theme={theme} onToggleTheme={toggleTheme}
        onRefresh={handleRefresh} loading={loading}
        openAlerts={stats.openCount}
      />

      <div className="ml-[224px] min-h-screen flex flex-col">
        {/* Topbar */}
        <header className="h-16 border-b sticky top-0 z-30 backdrop-blur-md flex items-center justify-between px-6 shrink-0"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--rule)' }}>
          <div>
            <h2 className="font-display" style={{ fontSize: 21, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.1 }}>{meta.title}</h2>
            <p className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-mute)' }}>{meta.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--ink-faint)' }}>
            <span className="hidden md:inline">n8n · Supabase · Pipedrive</span>
            <span style={{ width: 6, height: 6, background: 'var(--crimson)', display: 'inline-block' }} />
          </div>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 px-5 py-4">
          {page === 'overview' && (
            <Overview dashboard={stats} leadsStats={leadsStats} refreshKey={refreshKey} onNavigate={setPage} />
          )}

          {page === 'funil' && <JourneyMonitor refreshKey={refreshKey} />}

          {page === 'leads' && <LeadsMonitor refreshKey={refreshKey} />}

          {page === 'execucoes' && (
            <WorkflowsPanel
              workflows={workflowStats.length ? workflowStats : stats.workflows}
              onSyncNow={handleSyncNow} syncing={syncing}
            />
          )}

          {page === 'alertas' && (
            <div className="border overflow-hidden" style={{ backgroundColor: 'var(--bg-paper)', borderColor: 'var(--rule)' }}>
              <div className="p-3 border-b flex flex-wrap gap-3 justify-between items-center"
                style={{ backgroundColor: 'var(--bg-soft)', borderColor: 'var(--rule)' }}>
                <div className="flex items-center gap-2.5">
                  <span style={{ width: 6, height: 6, background: 'var(--crimson)', display: 'inline-block' }} />
                  <h3 className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink-mute)' }}>
                    Monitor de alertas
                  </h3>
                  <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>{alerts.length} no filtro</span>
                </div>
                <Filters filters={filters} setFilters={setFilters} />
              </div>
              <AlertsTable alerts={alerts} onResolve={handleResolve} />
            </div>
          )}
        </main>

        <footer className="px-5 py-4 flex justify-between items-center border-t" style={{ borderColor: 'var(--border-light)' }}>
          <span className="font-display" style={{ fontSize: 13, color: 'var(--ink-mute)' }}>
            Spark Maxx · <span style={{ fontStyle: 'italic' }}>Growth Ops</span>
          </span>
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>
            &copy; {new Date().getFullYear()} Pipeline Ops
          </span>
        </footer>
      </div>
    </div>
  );
}
