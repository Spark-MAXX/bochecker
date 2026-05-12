-- SQL Migration to add 'lead_completo' to alerts table

-- 1. Update the 'tipo' constraint
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_tipo_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_tipo_check CHECK (tipo IN ('lead_incompleto', 'erro_tecnico', 'lead_completo'));

-- 2. Update the 'severity' constraint
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_severity_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_severity_check CHECK (severity IN ('warning', 'error', 'critical', 'info', 'success'));
