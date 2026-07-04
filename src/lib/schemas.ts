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

export interface LeadPath {
  backup: boolean;       // leads_framer_backup — captura crua do form
  framer: boolean;       // leads_framer — lead validado / enriquecido
  rd_pipedrive: boolean; // leads_rd_pipedrive — chegou na passagem
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
  lead_path?: LeadPath | null;
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

// ── Funil unificado (bases reais do Supabase) ────────────────────────────────
export type LeadSourceKey = 'framer' | 'rd_pipedrive' | 'webinar';
export type FunnelStage =
  | 'incompleto' | 'capturado' | 'inscrito'
  | 'nao_processado' | 'processado_sem_deal' | 'deal_criado'
  | 'deal_ganho' | 'deal_perdido';
export type Health = 'ok' | 'atencao' | 'erro';

// S4 — status atual do deal no Pipedrive (vem de deals_snapshot; null até o sync do Pipedrive rodar)
export interface PipeStatus {
  status: 'open' | 'won' | 'lost' | string | null;
  stage_id: number | null;
  valor: number | null;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  atualizado_em: string | null;
}

export interface UnifiedLead {
  uid: string;
  source: LeadSourceKey;
  source_label: string;
  source_id: number | string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  empresa: string | null;
  produto: string | null;
  created_at: string;
  is_indicacao: boolean;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  status: 'completo' | 'incompleto';
  missing: string[];
  stage: FunnelStage;
  stage_label: string;
  health: Health;
  routing: {
    rota_definida: string | null;
    rota_encontrada: boolean | null;
    destino_pipeline: string | null;
    destino_stage: string | null;
    destino_owner: string | null;
    processado: boolean | null;
    motivo_rota: string | null;
  } | null;
  pipedrive: { person_id: number | null; deal_id: number | null } | null;
  pipe: PipeStatus | null;
  is_duplicate: boolean;
  dup_count?: number;
  also_in: { source: LeadSourceKey; stage: FunnelStage; deal_id: number | null }[];
  raw: Record<string, any>;
}

interface PeriodStats {
  entraram: number;
  completos: number;
  incompletos: number;
  problema: number;
  deals: number;
  taxa_completos: number;
}

export interface FunnelStats {
  periodos: Record<'h24' | 'hoje' | 'd7', PeriodStats>;
  por_origem: { source: LeadSourceKey; source_label: string; total: number; completos: number; problema: number }[];
  funil_rd: { capturado: number; processado: number; deal: number; nao_processado: number; ganho: number; perdido: number };
  duplicados: number;
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
