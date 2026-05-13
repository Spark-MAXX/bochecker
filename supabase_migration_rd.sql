-- ============================================================================
-- RD Station — Schema das tabelas analíticas
-- Project: rximtawdguljuwiektgx (sa-east-1)
-- Ordem de execução: APÓS supabase_migration.sql e supabase_migration_lead_completo.sql
--
-- Workflows que populam:
--   • W1 (pAaL4WFxiNOHTO3p) — Cron 06:00 BRT  → rd_workflows + rd_workflow_metrics
--   • W2 (KywF3gIEflkTgP2W) — Cron 06:15 BRT  → rd_emails + rd_email_metrics
--   • W3 (assets)           — não usado, coleta via ferramenta externa
-- ============================================================================

-- ── rd_workflows ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rd_workflows (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  status              TEXT,
  user_email_created  TEXT,
  user_email_updated  TEXT,
  rd_created_at       TIMESTAMPTZ,
  rd_updated_at       TIMESTAMPTZ,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rd_workflows_status ON rd_workflows(status);
CREATE INDEX IF NOT EXISTS idx_rd_workflows_synced ON rd_workflows(synced_at DESC);

-- ── rd_workflow_metrics ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rd_workflow_metrics (
  id                  BIGSERIAL PRIMARY KEY,
  workflow_id         TEXT NOT NULL REFERENCES rd_workflows(id) ON DELETE CASCADE,
  snapshot_date       DATE NOT NULL,
  period_start        DATE,
  period_end          DATE,
  emails_count        INT,
  total_sent          INT DEFAULT 0,
  total_delivered     INT DEFAULT 0,
  total_opened        INT DEFAULT 0,
  total_clicked       INT DEFAULT 0,
  total_bounced       INT DEFAULT 0,
  total_unsubscribed  INT DEFAULT 0,
  delivery_rate       NUMERIC(6,3),
  open_rate           NUMERIC(6,3),
  click_rate          NUMERIC(6,3),
  bounce_rate         NUMERIC(6,3),
  worst_email_id      TEXT,                  -- UUID (RD usa UUID, não bigint)
  worst_email_metric  TEXT,
  worst_email_value   NUMERIC,
  raw_payload         JSONB,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uniq_workflow_metric_day UNIQUE (workflow_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_rd_wf_metrics_workflow      ON rd_workflow_metrics(workflow_id);
CREATE INDEX IF NOT EXISTS idx_rd_wf_metrics_snapshot      ON rd_workflow_metrics(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_rd_wf_metrics_wf_snapshot   ON rd_workflow_metrics(workflow_id, snapshot_date DESC);

-- ── rd_emails ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rd_emails (
  id                    TEXT PRIMARY KEY,    -- UUID
  campaign_id           TEXT,                 -- UUID
  workflow_id           TEXT REFERENCES rd_workflows(id) ON DELETE SET NULL,
  name                  TEXT NOT NULL,
  type                  TEXT,
  status                TEXT,
  send_at               TIMESTAMPTZ,
  leads_count           INT DEFAULT 0,
  is_predictive_sending BOOLEAN DEFAULT FALSE,
  rd_created_at         TIMESTAMPTZ,
  rd_updated_at         TIMESTAMPTZ,
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rd_emails_workflow ON rd_emails(workflow_id);
CREATE INDEX IF NOT EXISTS idx_rd_emails_status   ON rd_emails(status);
CREATE INDEX IF NOT EXISTS idx_rd_emails_send_at  ON rd_emails(send_at DESC);

-- ── rd_email_metrics ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rd_email_metrics (
  id                BIGSERIAL PRIMARY KEY,
  email_id          TEXT NOT NULL REFERENCES rd_emails(id) ON DELETE CASCADE,
  snapshot_date     DATE NOT NULL,
  period_start      DATE,
  period_end        DATE,
  sent              INT DEFAULT 0,
  delivered         INT DEFAULT 0,
  opened            INT DEFAULT 0,
  unique_opens      INT DEFAULT 0,
  clicked           INT DEFAULT 0,
  unique_clicks     INT DEFAULT 0,
  bounced           INT DEFAULT 0,
  soft_bounces      INT DEFAULT 0,
  hard_bounces      INT DEFAULT 0,
  unsubscribed      INT DEFAULT 0,
  spam_reports      INT DEFAULT 0,
  delivery_rate     NUMERIC(6,3),
  open_rate         NUMERIC(6,3),
  click_rate        NUMERIC(6,3),
  ctor              NUMERIC(6,3),               -- click-to-open rate
  bounce_rate       NUMERIC(6,3),
  unsubscribe_rate  NUMERIC(6,3),
  raw_payload       JSONB,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uniq_email_metric_day UNIQUE (email_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_rd_em_metrics_email     ON rd_email_metrics(email_id);
CREATE INDEX IF NOT EXISTS idx_rd_em_metrics_snapshot  ON rd_email_metrics(snapshot_date DESC);

-- ── rd_sync_log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rd_sync_log (
  id            BIGSERIAL PRIMARY KEY,
  source        TEXT NOT NULL,             -- 'workflows' | 'emails' | 'assets'
  status        TEXT NOT NULL,             -- 'success' | 'partial' | 'error'
  items_synced  INT DEFAULT 0,
  duration_ms   INT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rd_sync_log_source ON rd_sync_log(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rd_sync_log_status ON rd_sync_log(status);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Decisão: workflows internos. RLS desabilitado intencionalmente.
ALTER TABLE rd_workflows         DISABLE ROW LEVEL SECURITY;
ALTER TABLE rd_workflow_metrics  DISABLE ROW LEVEL SECURITY;
ALTER TABLE rd_emails            DISABLE ROW LEVEL SECURITY;
ALTER TABLE rd_email_metrics     DISABLE ROW LEVEL SECURITY;
ALTER TABLE rd_sync_log          DISABLE ROW LEVEL SECURITY;
