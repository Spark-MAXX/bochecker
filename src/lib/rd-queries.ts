// ── RD Station — queries reutilizadas por server.ts e api/index.ts ──────────
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  safeRate,
  type RDOverview, type RDTimeseriesPoint, type RDFunnel,
  type RDWorkflow, type RDWorkflowMetric, type RDEmail, type RDEmailMetric,
  type RDSyncLog, type RDWorkflowWithLatest, type RDEmailWithLatest,
} from './rd-schemas.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (d: Date) => d.toISOString().split('T')[0];

function sum<T>(arr: T[], pick: (x: T) => number | null | undefined): number {
  return arr.reduce((a, b) => a + (Number(pick(b)) || 0), 0);
}

// ── Overview ────────────────────────────────────────────────────────────────
export async function fetchOverview(db: SupabaseClient): Promise<RDOverview> {
  const today = new Date();
  const todayIso = isoDay(today);
  const past = new Date(today.getTime() - 7 * DAY_MS);
  const pastIso = isoDay(past);

  // Pega último snapshot por workflow (sub-select implícito por ordenação)
  const [
    workflowsRes,
    emailsCountRes,
    enabledRes,
    metricsLatestRes,
    metricsWeekAgoRes,
    syncWorkflowsRes,
    syncEmailsRes,
  ] = await Promise.all([
    db.from('rd_workflows').select('id', { count: 'exact', head: true }),
    db.from('rd_emails').select('id', { count: 'exact', head: true }),
    db.from('rd_workflows').select('id', { count: 'exact', head: true }).eq('status', 'enabled'),
    db.from('rd_workflow_metrics').select('*').order('snapshot_date', { ascending: false }).limit(500),
    db.from('rd_workflow_metrics').select('*').lte('snapshot_date', pastIso).order('snapshot_date', { ascending: false }).limit(500),
    db.from('rd_sync_log').select('*').eq('source', 'workflows').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('rd_sync_log').select('*').eq('source', 'emails').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  // Pega o último snapshot_date conhecido (across all workflows)
  const allMetrics = (metricsLatestRes.data || []) as RDWorkflowMetric[];
  const maxSnapshot = allMetrics.length
    ? allMetrics.reduce((max, m) => (m.snapshot_date > max ? m.snapshot_date : max), allMetrics[0].snapshot_date)
    : null;

  const latest = maxSnapshot ? allMetrics.filter(m => m.snapshot_date === maxSnapshot) : [];

  // Soma do snapshot mais recente
  const sent      = sum(latest, m => m.total_sent);
  const delivered = sum(latest, m => m.total_delivered);
  const opened    = sum(latest, m => m.total_opened);
  const clicked   = sum(latest, m => m.total_clicked);
  const bounced   = sum(latest, m => m.total_bounced);
  const unsubscribed = sum(latest, m => m.total_unsubscribed);

  // Snapshot anterior (7d atrás) — pega o snapshot_date mais próximo de pastIso
  const prevAll = (metricsWeekAgoRes.data || []) as RDWorkflowMetric[];
  const prevSnapshot = prevAll.length
    ? prevAll.reduce((max, m) => (m.snapshot_date > max ? m.snapshot_date : max), prevAll[0].snapshot_date)
    : null;
  const prev = prevSnapshot ? prevAll.filter(m => m.snapshot_date === prevSnapshot) : [];
  const prevSent      = sum(prev, m => m.total_sent);
  const prevDelivered = sum(prev, m => m.total_delivered);
  const prevOpened    = sum(prev, m => m.total_opened);
  const prevClicked   = sum(prev, m => m.total_clicked);
  const prevBounced   = sum(prev, m => m.total_bounced);

  const prevOpenRate   = safeRate(prevOpened, prevDelivered);
  const prevClickRate  = safeRate(prevClicked, prevDelivered);
  const prevBounceRate = safeRate(prevBounced, prevSent);

  const open_rate   = safeRate(opened, delivered);
  const click_rate  = safeRate(clicked, delivered);
  const bounce_rate = safeRate(bounced, sent);
  const delivery_rate = safeRate(delivered, sent);
  const unsubscribe_rate = safeRate(unsubscribed, delivered);
  const ctor = safeRate(clicked, opened);

  return {
    total_workflows: workflowsRes.count || 0,
    total_emails:    emailsCountRes.count || 0,
    enabled_workflows: enabledRes.count || 0,
    sent, delivered, opened,
    unique_opened: opened,                                 // workflow level só tem total
    clicked,
    unique_clicked: clicked,
    bounced,
    unsubscribed,
    delivery_rate, open_rate, click_rate, ctor, bounce_rate, unsubscribe_rate,
    delta: {
      sent: prevSent ? ((sent - prevSent) / prevSent) * 100 : 0,
      open_rate:   open_rate - prevOpenRate,
      click_rate:  click_rate - prevClickRate,
      bounce_rate: bounce_rate - prevBounceRate,
    },
    last_sync: {
      workflows: (syncWorkflowsRes.data as RDSyncLog) || null,
      emails:    (syncEmailsRes.data as RDSyncLog) || null,
    },
    snapshot_date: maxSnapshot,
  };
}

// ── Timeseries (últimos N dias agregados entre workflows) ───────────────────
export async function fetchTimeseries(db: SupabaseClient, days = 30): Promise<RDTimeseriesPoint[]> {
  const since = isoDay(new Date(Date.now() - days * DAY_MS));
  const { data } = await db.from('rd_workflow_metrics').select('*').gte('snapshot_date', since);
  const rows = (data || []) as RDWorkflowMetric[];

  const byDay = new Map<string, RDTimeseriesPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const d = isoDay(new Date(Date.now() - i * DAY_MS));
    byDay.set(d, { date: d, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, open_rate: 0, click_rate: 0, bounce_rate: 0 });
  }
  rows.forEach(m => {
    const bucket = byDay.get(m.snapshot_date);
    if (!bucket) return;
    bucket.sent      += m.total_sent || 0;
    bucket.delivered += m.total_delivered || 0;
    bucket.opened    += m.total_opened || 0;
    bucket.clicked   += m.total_clicked || 0;
    bucket.bounced   += m.total_bounced || 0;
  });
  return Array.from(byDay.values()).map(p => ({
    ...p,
    open_rate:   safeRate(p.opened, p.delivered),
    click_rate:  safeRate(p.clicked, p.delivered),
    bounce_rate: safeRate(p.bounced, p.sent),
  }));
}

// ── Funil agregado do último snapshot ───────────────────────────────────────
export async function fetchFunnel(db: SupabaseClient): Promise<RDFunnel> {
  const { data } = await db.from('rd_workflow_metrics').select('*').order('snapshot_date', { ascending: false }).limit(500);
  const rows = (data || []) as RDWorkflowMetric[];
  if (!rows.length) return { sent: 0, delivered: 0, opened: 0, unique_opened: 0, clicked: 0, unique_clicked: 0 };
  const max = rows.reduce((m, r) => (r.snapshot_date > m ? r.snapshot_date : m), rows[0].snapshot_date);
  const latest = rows.filter(r => r.snapshot_date === max);

  // Tenta enriquecer com unique_opens / unique_clicks dos email_metrics no mesmo snapshot
  const { data: em } = await db.from('rd_email_metrics').select('*').eq('snapshot_date', max);
  const emRows = (em || []) as RDEmailMetric[];
  const uniq_op = sum(emRows, m => m.unique_opens);
  const uniq_cl = sum(emRows, m => m.unique_clicks);

  const sent = sum(latest, m => m.total_sent);
  const delivered = sum(latest, m => m.total_delivered);
  const opened = sum(latest, m => m.total_opened);
  const clicked = sum(latest, m => m.total_clicked);

  return {
    sent, delivered, opened,
    unique_opened: uniq_op || opened,
    clicked,
    unique_clicked: uniq_cl || clicked,
  };
}

// ── Workflows + último snapshot ─────────────────────────────────────────────
export async function fetchWorkflowsWithLatest(db: SupabaseClient): Promise<RDWorkflowWithLatest[]> {
  const [wfRes, metricsRes] = await Promise.all([
    db.from('rd_workflows').select('*').order('rd_updated_at', { ascending: false, nullsFirst: false }),
    db.from('rd_workflow_metrics').select('*').order('snapshot_date', { ascending: false }).limit(2000),
  ]);

  const workflows = (wfRes.data || []) as RDWorkflow[];
  const metrics = (metricsRes.data || []) as RDWorkflowMetric[];

  // Index do último metric e dos últimos 7 snapshots por workflow
  const latestById = new Map<string, RDWorkflowMetric>();
  const trendById  = new Map<string, RDWorkflowMetric[]>();
  for (const m of metrics) {
    if (!latestById.has(m.workflow_id)) latestById.set(m.workflow_id, m);
    const arr = trendById.get(m.workflow_id) || [];
    if (arr.length < 7) arr.push(m);
    trendById.set(m.workflow_id, arr);
  }

  return workflows.map(w => ({
    ...w,
    latest_metric: latestById.get(w.id) || null,
    trend7d: (trendById.get(w.id) || []).map(m => ({
      date: m.snapshot_date,
      open_rate: m.open_rate, click_rate: m.click_rate, sent: m.total_sent || 0,
    })).reverse(),
  }));
}

// ── Histórico de um workflow ────────────────────────────────────────────────
export async function fetchWorkflowHistory(db: SupabaseClient, id: string, days = 30): Promise<RDWorkflowMetric[]> {
  const since = isoDay(new Date(Date.now() - days * DAY_MS));
  const { data } = await db.from('rd_workflow_metrics').select('*').eq('workflow_id', id).gte('snapshot_date', since).order('snapshot_date', { ascending: true });
  return (data || []) as RDWorkflowMetric[];
}

// ── Emails + último snapshot ────────────────────────────────────────────────
export async function fetchEmailsWithLatest(db: SupabaseClient, opts: { limit?: number; search?: string; status?: string } = {}): Promise<RDEmailWithLatest[]> {
  let q = db.from('rd_emails').select('*').order('rd_updated_at', { ascending: false, nullsFirst: false });
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.search) q = q.ilike('name', `%${opts.search}%`);
  if (opts.limit)  q = q.limit(opts.limit);

  const { data: emails } = await q;
  const rows = (emails || []) as RDEmail[];
  if (!rows.length) return [];

  const ids = rows.map(e => e.id);
  const { data: metricsData } = await db.from('rd_email_metrics').select('*').in('email_id', ids).order('snapshot_date', { ascending: false });
  const metrics = (metricsData || []) as RDEmailMetric[];

  const latestById = new Map<string, RDEmailMetric>();
  for (const m of metrics) if (!latestById.has(m.email_id)) latestById.set(m.email_id, m);

  return rows.map(e => ({ ...e, latest_metric: latestById.get(e.id) || null }));
}

// ── Worst-performing emails (open_rate baixo, com volume mínimo) ────────────
export async function fetchWorstEmails(db: SupabaseClient, minSent = 50, limit = 10): Promise<RDEmailWithLatest[]> {
  const { data: metricsData } = await db.from('rd_email_metrics').select('*').gte('sent', minSent).order('open_rate', { ascending: true, nullsFirst: false }).limit(limit);
  const metrics = (metricsData || []) as RDEmailMetric[];
  if (!metrics.length) return [];
  const { data: emails } = await db.from('rd_emails').select('*').in('id', metrics.map(m => m.email_id));
  const emailMap = new Map((emails || []).map((e: any) => [e.id, e as RDEmail]));
  return metrics.map(m => {
    const e = emailMap.get(m.email_id);
    if (!e) return null;
    return { ...e, latest_metric: m };
  }).filter(Boolean) as RDEmailWithLatest[];
}

// ── Top workflows por volume enviado (snapshot mais recente por wf) ─────────
export async function fetchTopWorkflows(db: SupabaseClient, limit = 10): Promise<RDWorkflowWithLatest[]> {
  const all = await fetchWorkflowsWithLatest(db);
  return all
    .filter(w => w.latest_metric && (w.latest_metric.total_sent || 0) > 0)
    .sort((a, b) => (b.latest_metric?.total_sent || 0) - (a.latest_metric?.total_sent || 0))
    .slice(0, limit);
}

// ── Sync log ────────────────────────────────────────────────────────────────
export async function fetchSyncLog(db: SupabaseClient, opts: { source?: string; limit?: number } = {}): Promise<RDSyncLog[]> {
  let q = db.from('rd_sync_log').select('*').order('created_at', { ascending: false });
  if (opts.source) q = q.eq('source', opts.source);
  q = q.limit(opts.limit || 50);
  const { data } = await q;
  return (data || []) as RDSyncLog[];
}
