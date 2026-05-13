// ── RD Station — tipos e helpers compartilhados front/back ───────────────────

export interface RDWorkflow {
  id: string;
  name: string;
  status: string | null;
  user_email_created: string | null;
  user_email_updated: string | null;
  rd_created_at: string | null;
  rd_updated_at: string | null;
  synced_at: string;
}

export interface RDWorkflowMetric {
  id: number;
  workflow_id: string;
  snapshot_date: string;            // YYYY-MM-DD
  period_start: string | null;
  period_end: string | null;
  emails_count: number | null;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  total_unsubscribed: number;
  delivery_rate: number | null;
  open_rate: number | null;
  click_rate: number | null;
  bounce_rate: number | null;
  worst_email_id: string | null;
  worst_email_metric: string | null;
  worst_email_value: number | null;
  raw_payload?: any;
  synced_at: string;
}

export interface RDEmail {
  id: string;
  campaign_id: string | null;
  workflow_id: string | null;
  name: string;
  type: string | null;
  status: string | null;
  send_at: string | null;
  leads_count: number;
  is_predictive_sending: boolean;
  rd_created_at: string | null;
  rd_updated_at: string | null;
  synced_at: string;
}

export interface RDEmailMetric {
  id: number;
  email_id: string;
  snapshot_date: string;
  period_start: string | null;
  period_end: string | null;
  sent: number;
  delivered: number;
  opened: number;
  unique_opens: number;
  clicked: number;
  unique_clicks: number;
  bounced: number;
  soft_bounces: number;
  hard_bounces: number;
  unsubscribed: number;
  spam_reports: number;
  delivery_rate: number | null;
  open_rate: number | null;
  click_rate: number | null;
  ctor: number | null;
  bounce_rate: number | null;
  unsubscribe_rate: number | null;
  raw_payload?: any;
  synced_at: string;
}

export interface RDSyncLog {
  id: number;
  source: 'workflows' | 'emails' | 'assets' | string;
  status: 'success' | 'partial' | 'error' | string;
  items_synced: number | null;
  duration_ms: number | null;
  metadata: any;
  created_at: string;
}

// Combinações usadas pelo front
export interface RDWorkflowWithLatest extends RDWorkflow {
  latest_metric?: RDWorkflowMetric | null;
  trend7d?: { date: string; open_rate: number | null; click_rate: number | null; sent: number }[];
}

export interface RDEmailWithLatest extends RDEmail {
  latest_metric?: RDEmailMetric | null;
}

export interface RDOverview {
  // Totais do snapshot mais recente, somados entre todos os workflows
  total_workflows: number;
  total_emails: number;
  enabled_workflows: number;

  sent: number;
  delivered: number;
  opened: number;
  unique_opened: number;
  clicked: number;
  unique_clicked: number;
  bounced: number;
  unsubscribed: number;

  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  ctor: number;
  bounce_rate: number;
  unsubscribe_rate: number;

  // Comparativo: mesmo snapshot, 7 dias atrás
  delta?: {
    sent: number;
    open_rate: number;
    click_rate: number;
    bounce_rate: number;
  };

  // Última sync conhecida (por fonte)
  last_sync: {
    workflows: RDSyncLog | null;
    emails: RDSyncLog | null;
  };

  // Janela considerada
  snapshot_date: string | null;
}

export interface RDTimeseriesPoint {
  date: string;          // YYYY-MM-DD
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
}

export interface RDFunnel {
  sent: number;
  delivered: number;
  opened: number;
  unique_opened: number;
  clicked: number;
  unique_clicked: number;
}

// ── Helpers de formatação ────────────────────────────────────────────────────

export function pct(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${(Number(v) * (Number(v) > 1 ? 1 : 100)).toFixed(digits)}%`;
}

// Para taxas que já chegam como 0–100 (rd_workflow_metrics) vs como 0–1 (raw RD)
export function pctFixed(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${Number(v).toFixed(digits)}%`;
}

export function nFmt(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '0';
  const n = Number(v);
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return n.toLocaleString('pt-BR');
}

export function safeRate(num: number, denom: number): number {
  if (!denom || denom <= 0) return 0;
  return (num / denom) * 100;
}

export function deltaPct(curr: number, prev: number): number {
  if (!prev || prev === 0) return 0;
  return ((curr - prev) / prev) * 100;
}
