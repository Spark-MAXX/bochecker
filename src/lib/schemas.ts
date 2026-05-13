import { z } from 'zod';

export const LeadSourceEnum = z.enum(['lp_sprout', 'lp_community', 'site_spark', 'indicacao', 'rd_pipe']);
export type LeadSource = z.infer<typeof LeadSourceEnum>;

export const AlertTypeEnum = z.enum(['lead_incompleto', 'erro_tecnico']);
export const SeverityEnum = z.enum(['warning', 'error', 'critical']);
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
  tipo: 'lead_incompleto' | 'erro_tecnico';
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
  tipo: 'lead_incompleto' | 'erro_tecnico';
  severity: 'warning' | 'error' | 'critical';
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

export interface Lead {
  id: string;
  workflow_id: string;
  workflow_name: string;
  execution_id?: string | null;
  lead_source?: string | null;
  status: 'completo' | 'incompleto';
  lead_nome?: string | null;
  lead_email?: string | null;
  lead_telefone?: string | null;
  lead_empresa?: string | null;
  produto?: string | null;
  campos_faltantes?: string[] | null;
  payload_original?: any;
  alert_id?: string | null;
  created_at: string;
}

export interface LeadsStats {
  completos_24h: number;
  incompletos_24h: number;
  total_24h: number;
  completos_today: number;
  incompletos_today: number;
  total_today: number;
  completos_7d: number;
  incompletos_7d: number;
  total_7d: number;
  completion_rate_24h: number;
  completion_rate_today: number;
  completion_rate_7d: number;
}
