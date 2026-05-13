-- SQL Migration for Supabase
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('lead_incompleto', 'erro_tecnico')),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'error', 'critical')),
  workflow_id TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  execution_id TEXT,
  lead_email TEXT,
  lead_nome TEXT,
  campos_faltantes TEXT[],
  node_name TEXT,
  error_message TEXT,
  payload_original JSONB,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Unique constraint to prevent duplication of same execution alert
  CONSTRAINT unique_execution_alert UNIQUE (workflow_id, execution_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_workflow ON alerts(workflow_id);
CREATE INDEX IF NOT EXISTS idx_alerts_tipo ON alerts(tipo);

-- RLS Policies
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Allow anon/authenticated users to read (for dashboard)
-- In a real prod environment, you'd restrict this more strictly.
CREATE POLICY "Allow public read access" ON alerts FOR SELECT USING (true);
CREATE POLICY "Allow service role update" ON alerts FOR UPDATE USING (true) WITH CHECK (true);

-- ============================================================================
-- n8n monitoring tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS n8n_workflows (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  active                 BOOLEAN DEFAULT TRUE,
  last_execution_at      TIMESTAMPTZ,
  last_execution_status  TEXT,
  total_executions       INT DEFAULT 0,
  total_errors           INT DEFAULT 0,
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_n8n_workflows_updated ON n8n_workflows(updated_at DESC);

CREATE TABLE IF NOT EXISTS n8n_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id    TEXT UNIQUE NOT NULL,
  workflow_id     TEXT NOT NULL,
  workflow_name   TEXT,
  status          TEXT NOT NULL,
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  duration_ms     INT,
  error_message   TEXT,
  node_error      TEXT,
  alert_id        UUID REFERENCES alerts(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_n8n_exec_workflow_started ON n8n_executions(workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_n8n_exec_status            ON n8n_executions(status);

ALTER TABLE n8n_workflows  ENABLE ROW LEVEL SECURITY;
ALTER TABLE n8n_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read n8n_workflows"  ON n8n_workflows  FOR SELECT USING (true);
CREATE POLICY "Allow public read n8n_executions" ON n8n_executions FOR SELECT USING (true);
