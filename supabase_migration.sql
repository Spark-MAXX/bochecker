-- Supabase schema — Spark Maxx Alerts Pipeline (BO Checker)
-- Base consolidada: projeto "Agentes - IA" (ref: epkxxiadrevsuopkndej).
-- Idempotente — pode rodar em projeto novo ou já existente. Rode no SQL Editor do Supabase.
--
-- Tabelas: alerts, n8n_workflows, n8n_executions, leads.
-- As fontes de lead (leads_framer / leads_rd_pipedrive / leads_webinar) são gravadas
-- pelos fluxos do n8n e não fazem parte desta migration.

-- ── alerts ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('lead_incompleto', 'erro_tecnico', 'lead_completo')),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'error', 'critical', 'info', 'success')),
  workflow_id TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  execution_id TEXT,
  lead_email TEXT,
  lead_nome TEXT,
  campos_faltantes TEXT[],
  node_name TEXT,
  error_message TEXT,
  payload_original JSONB,
  diagnostico JSONB,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_execution_alert UNIQUE (workflow_id, execution_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_alerts_status   ON public.alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_workflow ON public.alerts(workflow_id);
CREATE INDEX IF NOT EXISTS idx_alerts_tipo     ON public.alerts(tipo);
CREATE INDEX IF NOT EXISTS idx_alerts_lead_email_open
  ON public.alerts(lead_email, workflow_id, tipo) WHERE status = 'open';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_alerts_with_exec
  ON public.alerts(workflow_id, execution_id, tipo) WHERE execution_id IS NOT NULL;

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='alerts' AND policyname='alerts_anon_read') THEN
    CREATE POLICY "alerts_anon_read" ON public.alerts FOR SELECT USING (true);
  END IF;
END $$;

-- ── n8n_workflows ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.n8n_workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  last_execution_at TIMESTAMPTZ,
  last_execution_status TEXT,
  total_executions INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.n8n_workflows ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='n8n_workflows' AND policyname='n8n_workflows_anon_read') THEN
    CREATE POLICY "n8n_workflows_anon_read" ON public.n8n_workflows FOR SELECT USING (true);
  END IF;
END $$;

-- ── n8n_executions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.n8n_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id TEXT NOT NULL UNIQUE,
  workflow_id TEXT NOT NULL,
  workflow_name TEXT,
  status TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_ms BIGINT,
  error_message TEXT,
  node_error TEXT,
  alert_id UUID REFERENCES public.alerts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_n8n_exec_status           ON public.n8n_executions(status);
CREATE INDEX IF NOT EXISTS idx_n8n_exec_workflow_started ON public.n8n_executions(workflow_id, started_at DESC);

ALTER TABLE public.n8n_executions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='n8n_executions' AND policyname='n8n_executions_anon_read') THEN
    CREATE POLICY "n8n_executions_anon_read" ON public.n8n_executions FOR SELECT USING (true);
  END IF;
END $$;

-- ── leads (validador: completos e incompletos) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leads (
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
  alert_id UUID REFERENCES public.alerts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_status    ON public.leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_workflow  ON public.leads(workflow_id);
CREATE INDEX IF NOT EXISTS idx_leads_source    ON public.leads(lead_source);
CREATE INDEX IF NOT EXISTS idx_leads_email     ON public.leads(lead_email);
CREATE INDEX IF NOT EXISTS idx_leads_execution ON public.leads(workflow_id, execution_id);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leads' AND policyname='leads_anon_read') THEN
    CREATE POLICY "leads_anon_read" ON public.leads FOR SELECT USING (true);
  END IF;
END $$;

-- NOTA: as escritas (insert/update) são feitas pela API com a SUPABASE_SERVICE_ROLE_KEY,
-- que ignora RLS. As policies acima liberam apenas LEITURA pública (dashboard via anon key).

-- ── Lead Scoring (nota nativa do RD Station) ─────────────────────────────────
-- A tabela leads_rd_pipedrive é escrita pelo n8n e NÃO faz parte desta migration.
-- O painel "Lead Scoring" do BO Checker lê estas colunas (via camada unificada de leads).
-- O n8n deve puxar a nota do RD Station e fazer upsert nestas colunas, casando por
-- lead_email / conversion_identifier. Rode este ALTER uma vez no SQL Editor:
--
--   ALTER TABLE public.leads_rd_pipedrive
--     ADD COLUMN IF NOT EXISTS rd_lead_score        INTEGER,      -- pontos (escala do RD)
--     ADD COLUMN IF NOT EXISTS rd_lead_score_grade  TEXT,         -- perfil A/B/C/D (se houver)
--     ADD COLUMN IF NOT EXISTS rd_scored_at         TIMESTAMPTZ;  -- quando a nota foi calculada
--
-- Nomes/escala confirmados via inspeção da API do RD (contact fields). Ajuste os nomes
-- acima e o SELECT em src/lib/leads-unified.ts + api/index.ts se o RD usar outra convenção.
