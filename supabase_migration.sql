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

-- Leads recebidos no validador (completos e incompletos)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  execution_id TEXT,
  lead_source TEXT,
  status TEXT NOT NULL CHECK (status IN ('completo', 'incompleto')),
  lead_nome TEXT,
  lead_email TEXT,
  lead_telefone TEXT,
  lead_empresa TEXT,
  produto TEXT,
  campos_faltantes TEXT[],
  payload_original JSONB,
  alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_workflow ON leads(workflow_id);
CREATE INDEX IF NOT EXISTS idx_leads_source  ON leads(lead_source);
CREATE INDEX IF NOT EXISTS idx_leads_email   ON leads(lead_email);
CREATE INDEX IF NOT EXISTS idx_leads_execution ON leads(workflow_id, execution_id);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access on leads" ON leads FOR SELECT USING (true);
CREATE POLICY "Allow service role write on leads" ON leads FOR ALL USING (true) WITH CHECK (true);
