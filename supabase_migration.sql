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
