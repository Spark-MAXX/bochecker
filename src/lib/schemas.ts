import { z } from 'zod';

export const LeadSourceEnum = z.enum(['lp_sprout', 'lp_community', 'site_spark', 'indicacao', 'rd_pipe']);
export type LeadSource = z.infer<typeof LeadSourceEnum>;

export const AlertTypeEnum = z.enum(['lead_incompleto', 'erro_tecnico', 'lead_completo']);
export const SeverityEnum = z.enum(['warning', 'error', 'critical', 'info']);
export const StatusEnum = z.enum(['open', 'resolved', 'ignored']);

export const LeadIncompletoSchema = z.object({
  workflow_id: z.string(),
  workflow_name: z.string(),
  execution_id: z.string().optional(),
  lead_email: z.string().email().optional(),
  lead_nome: z.string().optional(),
  campos_faltantes: z.array(z.string()),
  payload_original: z.record(z.string(), z.any()).optional(),
});

export const ErroTecnicoSchema = z.object({
  workflow_id: z.string(),
  workflow_name: z.string(),
  execution_id: z.string().optional(),
  node_name: z.string(),
  error_message: z.string(),
  payload_original: z.record(z.string(), z.any()).optional(),
});

export interface FieldDiag { campo: string; motivo: string; }

export interface Diagnostico {
  tipo: 'lead_incompleto' | 'erro_tecnico' | 'lead_completo';
  // lead_incompleto
  resumo?: string;
  campos?: FieldDiag[];
  dica?: string;
  // erro_tecnico
  motivo?: string;
  node_falhou?: string;
  detalhe_original?: string;
}

export interface Alert {
  id: string;
  tipo: 'lead_incompleto' | 'erro_tecnico' | 'lead_completo';
  severity: 'warning' | 'error' | 'critical' | 'info';
  workflow_id: string;
  workflow_name: string;
  execution_id?: string;
  lead_email?: string;
  lead_nome?: string;
  campos_faltantes?: string[];
  node_name?: string;
  error_message?: string;
  payload_original?: any;
  diagnostico?: Diagnostico;
  status: 'open' | 'resolved' | 'ignored';
  resolved_at?: string;
  resolved_by?: string;
  created_at: string;
}
