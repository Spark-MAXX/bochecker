import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, RefreshCcw, Sun, Moon, Activity, BarChart3, Workflow, Mail, ScrollText } from 'lucide-react';
import TabNav, { type TabItem } from './components/TabNav';
import PipelineView from './components/PipelineView';
import RDOverview from './components/RDOverview';
import RDWorkflowsTable from './components/RDWorkflowsTable';
import RDEmailsTable from './components/RDEmailsTable';
import RDSyncLog from './components/RDSyncLog';

type TabKey = 'overview' | 'workflows' | 'emails' | 'sync' | 'pipeline';

const TAB_STORAGE_KEY = 'spark-active-tab';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (typeof window !== 'undefined' && (localStorage.getItem('spark-theme') as 'dark' | 'light')) || 'dark';
  });
  const [active, setActive] = useState<TabKey>(() => {
    return (typeof window !== 'undefined' && (localStorage.getItem(TAB_STORAGE_KEY) as TabKey)) || 'overview';
  });
  const [openAlertsBadge, setOpenAlertsBadge] = useState<number>(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('spark-theme', theme);
  }, [theme]);

  useEffect(() => { localStorage.setItem(TAB_STORAGE_KEY, active); }, [active]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  const tabs: TabItem[] = [
    { key: 'overview',  label: 'Visão Geral', icon: BarChart3 },
    { key: 'workflows', label: 'Fluxos RD',   icon: Workflow },
    { key: 'emails',    label: 'Emails RD',   icon: Mail },
    { key: 'sync',      label: 'Sync Log',    icon: ScrollText },
    { key: 'pipeline',  label: 'Pipeline n8n', icon: Activity, badge: openAlertsBadge },
  ];

  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-1)' }}>
      <nav className="h-16 border-b sticky top-0 z-50 backdrop-blur-md flex items-center justify-between px-8"
        style={{ backgroundColor: 'var(--bg-nav)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-cyan-500 rounded flex items-center justify-center glow-cyan transition-transform hover:scale-110 duration-300">
            <Bell className="h-5 w-5 text-slate-950 stroke-[2.5px]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight uppercase" style={{ color: 'var(--text-1)' }}>
            Spark Maxx{' '}
            <span className="text-cyan-400 opacity-80 font-mono text-base ml-1 tracking-normal">// Control Center</span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2">
            <div className="w-2 h-2 rounded-full glow-emerald bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>
              System Operational
            </span>
          </div>
          <div className="h-4 w-px" style={{ backgroundColor: 'var(--border)' }} />

          <button onClick={toggleTheme} className="p-2 rounded-lg transition-all hover:scale-105"
            style={{ color: 'var(--text-3)' }} title={isDark ? 'Modo claro' : 'Modo escuro'}>
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
          </button>

          <button onClick={() => setRefreshKey(k => k + 1)} className="p-2 rounded-lg transition-all"
            style={{ color: 'var(--text-3)' }} title="Recarregar dados da aba atual">
            <RefreshCcw className="h-4 w-4" />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <TabNav tabs={tabs} active={active} onChange={(k) => setActive(k as TabKey)} />

        <AnimatePresence mode="wait">
          <motion.div key={`${active}-${refreshKey}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}>
            {active === 'overview'  && <RDOverview />}
            {active === 'workflows' && <RDWorkflowsTable />}
            {active === 'emails'    && <RDEmailsTable />}
            {active === 'sync'      && <RDSyncLog />}
            {active === 'pipeline'  && <PipelineView onOpenCountChange={setOpenAlertsBadge} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-10 mt-12 flex justify-between items-center border-t"
        style={{ borderColor: 'var(--border-light)' }}>
        <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-4)' }}>
          Spark Maxx Control Center // v4.0.0
        </div>
        <div className="text-[10px] font-mono" style={{ color: 'var(--text-3)' }}>
          RD Station + n8n + Supabase // &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
