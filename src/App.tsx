import React, { useState, useEffect } from 'react';
import { getSupabase } from './lib/supabase';
import StatsHeader from './components/StatsHeader';
import AlertsTable from './components/AlertsTable';
import Charts from './components/Charts';
import Filters from './components/Filters';
import { type Alert } from './lib/schemas';
import { Bell, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState({
    openCount: 0,
    resolvedToday: 0,
    totalWeek: 0,
    recent: [] as Alert[]
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'open',
    tipo: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Alerts based on filters
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.tipo) queryParams.append('tipo', filters.tipo);

      const [alertsRes, statsRes] = await Promise.all([
        fetch(`/api/alerts?${queryParams.toString()}`),
        fetch('/api/dashboard/stats')
      ]);

      const alertsData = await alertsRes.json();
      const statsData = await statsRes.json();

      setAlerts(alertsData.data || []);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved_by: 'Dashboard User' })
      });
      if (res.ok) {
        fetchData(); // Refresh everything
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  useEffect(() => {
    fetchData();

    const supabase = getSupabase();
    if (!supabase) return;

    // Setup Supabase Realtime Subscription
    const subscription = supabase
      .channel('alerts_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [filters]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-cyan-500/20">
      {/* Navigation Layer */}
      <nav className="h-16 border-b border-slate-800 bg-[#020617]/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-cyan-500 rounded flex items-center justify-center glow-cyan transition-transform hover:scale-110 duration-300">
            <Bell className="h-5 w-5 text-slate-950 stroke-[2.5px]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 uppercase">
            Spark Maxx <span className="text-cyan-400 opacity-80 font-mono text-base ml-1 tracking-normal">// Pipeline</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full glow-emerald ${loading ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></div>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
              {loading ? 'Analyzing...' : 'System Operational'}
            </span>
          </div>
          <div className="h-4 w-px bg-slate-800"></div>
          <button 
            onClick={() => fetchData()}
            className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-all"
            title="Sincronizar"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Stats Bar */}
          <StatsHeader 
            openCount={stats.openCount}
            resolvedToday={stats.resolvedToday}
            totalWeek={stats.totalWeek}
          />

          <div className="grid grid-cols-12 gap-6">
            {/* Main Content (Left) */}
            <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
              {/* Table Container */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-slate-800 flex flex-wrap gap-4 justify-between items-center bg-slate-950/20">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                    <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-300">Monitor de Alertas</h3>
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
                      <motion.div
                        key={filters.status + filters.tipo}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <AlertsTable alerts={alerts} onResolve={handleResolve} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Sidebar Charts (Right) */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
              <Charts data={stats} />
              
              <div className="mt-auto flex items-center justify-between bg-cyan-950/20 border border-cyan-900/30 p-4 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse glow-cyan"></div>
                  <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">Real-time Pipeline Active</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">SUPABASE // OK</span>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-10 border-t border-slate-800/50 mt-12 flex justify-between items-center">
        <div className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">
          Spark Maxx Monitoring // v2.4.0
        </div>
        <div className="text-[10px] font-mono text-slate-500">
          &copy; {new Date().getFullYear()} Build with AI Studio
        </div>
      </footer>
    </div>
  );
}
