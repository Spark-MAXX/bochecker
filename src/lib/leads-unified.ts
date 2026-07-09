// Camada unificada de leads — lê as bases reais do Supabase (Framer, RD→Pipedrive, Webinar),
// normaliza num formato único, calcula o estágio do funil ("onde o lead parou"),
// detecta duplicados por email e produz estatísticas agregadas.
//
// Usado tanto pelo dev server (server.ts) quanto pelo serverless de produção (api/index.ts).

import type { SupabaseClient } from '@supabase/supabase-js';

export type LeadSourceKey = 'framer' | 'rd_pipedrive' | 'webinar';

export const SOURCE_LABELS: Record<LeadSourceKey, string> = {
  framer: 'LP Framer',
  rd_pipedrive: 'RD → Pipedrive',
  webinar: 'LP Webinar',
};

// Estágios do funil — ordenados do início ao fim
export type FunnelStage =
  | 'incompleto'
  | 'capturado'
  | 'inscrito'
  | 'nao_processado'
  | 'processado_sem_deal'
  | 'deal_criado'
  | 'deal_ganho'
  | 'deal_perdido';

export const STAGE_LABELS: Record<FunnelStage, string> = {
  incompleto: 'Incompleto',
  capturado: 'Capturado',
  inscrito: 'Inscrito',
  nao_processado: 'Não processado',
  processado_sem_deal: 'Processado (sem deal)',
  deal_criado: 'Deal criado',
  deal_ganho: 'Deal ganho',
  deal_perdido: 'Deal perdido',
};

export type Health = 'ok' | 'atencao' | 'erro';

// Nota nativa do RD Station (lead scoring). Vem das colunas rd_lead_score* de leads_rd_pipedrive,
// gravadas pelo n8n. Null quando a fonte não é RD ou o lead ainda não foi pontuado.
export interface LeadScore {
  value: number | null;   // pontos (escala do RD; confirmar via MCP no Step 0)
  grade: string | null;   // perfil A/B/C/D, se existir no RD
  scored_at: string | null;
}

// Faixas de exibição da nota (ajustáveis quando a escala do RD for confirmada no Step 0).
export const SCORE_BANDS = { quente: 70, morno: 40 } as const;
export function scoreBand(value: number | null | undefined): 'quente' | 'morno' | 'frio' | null {
  if (value === null || value === undefined) return null;
  if (value >= SCORE_BANDS.quente) return 'quente';
  if (value >= SCORE_BANDS.morno) return 'morno';
  return 'frio';
}

// S4 — status atual do deal no Pipedrive (deals_snapshot). Null até o sync do Pipedrive rodar.
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
  score: LeadScore | null;
  is_duplicate: boolean;
  dup_count?: number;
  also_in: { source: LeadSourceKey; stage: FunnelStage; deal_id: number | null }[];
  raw: Record<string, any>;
}

// Campos mínimos para o lead ser "completo"
const REQUIRED_CORE = ['nome', 'email', 'telefone'] as const;

const isEmpty = (v: any) =>
  v === undefined || v === null || v === '' || v === 'null' ||
  (Array.isArray(v) && v.length === 0);

const SELECT: Record<LeadSourceKey, string> = {
  framer:
    'id,criado_em,email,nome,telefone,empresa,cargo,produto,is_indicacao,utm_source,utm_medium,utm_campaign,page_url,origem_canal,conversion_identifier,o_que_busca,faz_influencia,tags',
  rd_pipedrive:
    'id,criado_em,lead_nome,lead_email,lead_telefone,lead_empresa,produto_interesse,is_indicacao,utm_source,utm_medium,utm_campaign,rota_definida,rota_encontrada,motivo_rota,destino_pipeline_nome,destino_stage_nome,destino_owner_nome,processado,pipedrive_person_id,pipedrive_deal_id,conversion_identifier,lp_origem,rd_lead_score,rd_lead_score_grade,rd_scored_at',
  webinar:
    'id,criado_em,email,nome,telefone,empresa,cargo,produto,is_indicacao,utm_source,utm_medium,utm_campaign,page_url,origem_canal,conversion_identifier',
};

const TABLE: Record<LeadSourceKey, string> = {
  framer: 'leads_framer',
  rd_pipedrive: 'leads_rd_pipedrive',
  webinar: 'leads_webinar',
};

// Normaliza uma linha bruta de cada tabela para o formato único
function normalize(source: LeadSourceKey, row: any): UnifiedLead {
  const common =
    source === 'rd_pipedrive'
      ? {
          nome: row.lead_nome ?? null,
          email: row.lead_email ?? null,
          telefone: row.lead_telefone ?? null,
          empresa: row.lead_empresa ?? null,
          produto: row.produto_interesse ?? null,
        }
      : {
          nome: row.nome ?? null,
          email: row.email ?? null,
          telefone: row.telefone ?? null,
          empresa: row.empresa ?? null,
          produto: row.produto ?? null,
        };

  const missing = REQUIRED_CORE.filter((f) => isEmpty((common as any)[f]));
  const status: UnifiedLead['status'] = missing.length ? 'incompleto' : 'completo';

  let routing: UnifiedLead['routing'] = null;
  let pipedrive: UnifiedLead['pipedrive'] = null;
  if (source === 'rd_pipedrive') {
    routing = {
      rota_definida: row.rota_definida ?? null,
      rota_encontrada: row.rota_encontrada ?? null,
      destino_pipeline: row.destino_pipeline_nome ?? null,
      destino_stage: row.destino_stage_nome ?? null,
      destino_owner: row.destino_owner_nome ?? null,
      processado: row.processado ?? null,
      motivo_rota: row.motivo_rota ?? null,
    };
    pipedrive = {
      person_id: row.pipedrive_person_id ?? null,
      deal_id: row.pipedrive_deal_id ?? null,
    };
  }

  const { stage, health } = classify(source, status, routing, pipedrive, null);

  const score: LeadScore | null =
    source === 'rd_pipedrive'
      ? {
          value: row.rd_lead_score ?? null,
          grade: row.rd_lead_score_grade ?? null,
          scored_at: row.rd_scored_at ?? null,
        }
      : null;

  return {
    uid: `${source}:${row.id}`,
    source,
    source_label: SOURCE_LABELS[source],
    source_id: row.id,
    ...common,
    created_at: row.criado_em,
    is_indicacao: !!row.is_indicacao,
    utm_source: row.utm_source ?? null,
    utm_medium: row.utm_medium ?? null,
    utm_campaign: row.utm_campaign ?? null,
    status,
    missing,
    stage,
    stage_label: STAGE_LABELS[stage],
    health,
    routing,
    pipedrive,
    pipe: null,
    score,
    is_duplicate: false,
    also_in: [],
    raw: row,
  };
}

// Define o estágio do funil onde o lead parou + a saúde.
// pipe (deals_snapshot) tem prioridade: define ganho/perdido quando o deal já tem desfecho.
function classify(
  source: LeadSourceKey,
  status: 'completo' | 'incompleto',
  routing: UnifiedLead['routing'],
  pipedrive: UnifiedLead['pipedrive'],
  pipe: PipeStatus | null,
): { stage: FunnelStage; health: Health } {
  if (status === 'incompleto') return { stage: 'incompleto', health: 'atencao' };

  if (source === 'rd_pipedrive') {
    if (pipedrive?.deal_id) {
      if (pipe?.status === 'won') return { stage: 'deal_ganho', health: 'ok' };
      if (pipe?.status === 'lost') return { stage: 'deal_perdido', health: 'atencao' };
      return { stage: 'deal_criado', health: 'ok' };
    }
    if (routing?.processado === true) return { stage: 'processado_sem_deal', health: 'atencao' };
    return { stage: 'nao_processado', health: 'erro' };
  }
  if (source === 'webinar') return { stage: 'inscrito', health: 'ok' };
  return { stage: 'capturado', health: 'ok' };
}

// Busca o status atual dos deals no Pipedrive (deals_snapshot) e enriquece os leads RD→Pipedrive.
// Tolerante a falhas: se a tabela não existir / sem permissão, apenas mantém pipe = null.
async function enrichWithPipedrive(db: SupabaseClient, leads: UnifiedLead[]): Promise<void> {
  const dealIds = Array.from(
    new Set(
      leads
        .map((l) => l.pipedrive?.deal_id)
        .filter((d): d is number => d !== null && d !== undefined),
    ),
  );
  if (!dealIds.length) return;

  try {
    const { data, error } = await db
      .from('deals_snapshot')
      .select('deal_id,status,stage_id,value,won_time,lost_time,lost_reason,update_time')
      .in('deal_id', dealIds);
    if (error || !data) return;

    const byDeal = new Map<string, any>();
    for (const d of data) byDeal.set(String(d.deal_id), d);

    for (const l of leads) {
      const did = l.pipedrive?.deal_id;
      if (did === null || did === undefined) continue;
      const snap = byDeal.get(String(did));
      if (!snap) continue;
      l.pipe = {
        status: snap.status ?? null,
        stage_id: snap.stage_id ?? null,
        valor: snap.value ?? null,
        won_at: snap.won_time ?? null,
        lost_at: snap.lost_time ?? null,
        lost_reason: snap.lost_reason ?? null,
        atualizado_em: snap.update_time ?? null,
      };
      const { stage, health } = classify(l.source, l.status, l.routing, l.pipedrive, l.pipe);
      l.stage = stage;
      l.stage_label = STAGE_LABELS[stage];
      l.health = health;
    }
  } catch {
    /* deals_snapshot indisponível — segue sem S4 */
  }
}

function normEmail(e: string | null): string {
  return (e || '').trim().toLowerCase();
}

// Marca duplicados e presença cruzada.
// REGRA: duplicado = mesmo email repetido NA MESMA base. Estar em bases diferentes
// (ex.: Framer e RD→Pipedrive) NÃO é duplicado — é o mesmo lead avançando no funil.
function indexDuplicates(leads: UnifiedLead[]): void {
  const byEmail = new Map<string, UnifiedLead[]>();        // presença cruzada (todas as bases)
  const bySourceEmail = new Map<string, UnifiedLead[]>();  // duplicidade dentro da mesma base
  for (const l of leads) {
    const email = normEmail(l.email);
    if (!email) continue;
    let arr = byEmail.get(email);
    if (!arr) { arr = []; byEmail.set(email, arr); }
    arr.push(l);
    const sk = `${l.source}::${email}`;
    let sarr = bySourceEmail.get(sk);
    if (!sarr) { sarr = []; bySourceEmail.set(sk, sarr); }
    sarr.push(l);
  }
  // Duplicado real: mesmo email > 1x na mesma base
  for (const group of bySourceEmail.values()) {
    if (group.length < 2) continue;
    for (const l of group) { l.is_duplicate = true; l.dup_count = group.length; }
  }
  // Informativo: mesmo email presente em OUTRAS bases (não conta como duplicado)
  for (const group of byEmail.values()) {
    if (group.length < 2) continue;
    for (const l of group) {
      const others = group.filter((o) => o.source !== l.source);
      const seen = new Set<string>();
      l.also_in = others
        .map((o) => ({ source: o.source, stage: o.stage, deal_id: o.pipedrive?.deal_id ?? null }))
        .filter((v) => { const k = `${v.source}:${v.deal_id}`; if (seen.has(k)) return false; seen.add(k); return true; });
    }
  }
}

export interface UnifiedFilters {
  source?: LeadSourceKey;
  status?: 'completo' | 'incompleto';
  stage?: FunnelStage;
  health?: Health;
  problemOnly?: boolean;
  dupOnly?: boolean;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
}

const DEFAULT_WINDOW_DAYS = 30;
const PER_TABLE_CAP = 2000;

export async function fetchUnifiedLeads(
  db: SupabaseClient,
  opts: UnifiedFilters = {},
): Promise<{ data: UnifiedLead[]; total: number }> {
  const sources: LeadSourceKey[] = opts.source ? [opts.source] : ['framer', 'rd_pipedrive', 'webinar'];
  const from = opts.from || new Date(Date.now() - DEFAULT_WINDOW_DAYS * 86400_000).toISOString();

  const all: UnifiedLead[] = [];
  await Promise.all(
    sources.map(async (src) => {
      let q = db
        .from(TABLE[src])
        .select(SELECT[src])
        .gte('criado_em', from)
        .order('criado_em', { ascending: false })
        .limit(PER_TABLE_CAP);
      if (opts.to) q = q.lte('criado_em', opts.to);
      const { data, error } = await q;
      if (error) throw new Error(`${TABLE[src]}: ${error.message}`);
      (data || []).forEach((row: any) => all.push(normalize(src, row)));
    }),
  );

  // S4: status atual no Pipedrive (deals_snapshot) — enriquece e reclassifica deal_ganho/perdido
  await enrichWithPipedrive(db, all);

  // Duplicados são detectados no conjunto completo da janela (todas as fontes consultadas)
  indexDuplicates(all);

  let filtered = all;
  if (opts.status) filtered = filtered.filter((l) => l.status === opts.status);
  if (opts.stage) filtered = filtered.filter((l) => l.stage === opts.stage);
  if (opts.health) filtered = filtered.filter((l) => l.health === opts.health);
  if (opts.problemOnly) filtered = filtered.filter((l) => l.health !== 'ok');
  if (opts.dupOnly) filtered = filtered.filter((l) => l.is_duplicate);
  if (opts.search) {
    const s = opts.search.trim().toLowerCase();
    filtered = filtered.filter(
      (l) =>
        (l.email || '').toLowerCase().includes(s) ||
        (l.nome || '').toLowerCase().includes(s) ||
        (l.empresa || '').toLowerCase().includes(s),
    );
  }

  filtered.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const total = filtered.length;
  const limit = opts.limit ?? 200;
  return { data: filtered.slice(0, limit), total };
}

export interface ScoringStats {
  total_rd: number;                         // leads RD na janela
  scored: number;                           // leads RD com nota preenchida
  media: number;                            // média das notas (arredondada)
  por_faixa: { quente: number; morno: number; frio: number };
  por_grade: Record<string, number>;        // contagem por grade (A/B/C/D), se houver
}

export interface FunnelStats {
  periodos: Record<'h24' | 'hoje' | 'd7', PeriodStats>;
  por_origem: { source: LeadSourceKey; source_label: string; total: number; completos: number; problema: number }[];
  funil_rd: { capturado: number; processado: number; deal: number; nao_processado: number };
  scoring: ScoringStats;
  duplicados: number;
}

// Agrega as notas nativas do RD sobre o conjunto de leads (usado em fetchUnifiedStats).
export function computeScoringStats(leads: UnifiedLead[]): ScoringStats {
  const rd = leads.filter((l) => l.source === 'rd_pipedrive');
  const scored = rd.filter((l) => l.score && l.score.value !== null && l.score.value !== undefined);
  const media = scored.length
    ? Math.round(scored.reduce((s, l) => s + (l.score!.value || 0), 0) / scored.length)
    : 0;
  const por_faixa = { quente: 0, morno: 0, frio: 0 };
  const por_grade: Record<string, number> = {};
  for (const l of scored) {
    const band = scoreBand(l.score!.value);
    if (band) por_faixa[band]++;
    const g = l.score!.grade;
    if (g) por_grade[g] = (por_grade[g] || 0) + 1;
  }
  return { total_rd: rd.length, scored: scored.length, media, por_faixa, por_grade };
}

interface PeriodStats {
  entraram: number;
  completos: number;
  incompletos: number;
  problema: number;
  deals: number;
  taxa_completos: number;
}

export async function fetchUnifiedStats(db: SupabaseClient): Promise<FunnelStats> {
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: leads } = await fetchUnifiedLeads(db, { from: since30, limit: 100000 });

  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t24 = now - 24 * 3600_000;
  const t7 = now - 7 * 86400_000;
  const tToday = today.getTime();

  const mk = (pred: (l: UnifiedLead) => boolean): PeriodStats => {
    const subset = leads.filter(pred);
    const entraram = subset.length;
    const completos = subset.filter((l) => l.status === 'completo').length;
    const incompletos = entraram - completos;
    const problema = subset.filter((l) => l.health !== 'ok').length;
    const deals = subset.filter((l) => l.stage === 'deal_criado' || l.stage === 'deal_ganho' || l.stage === 'deal_perdido').length;
    return {
      entraram,
      completos,
      incompletos,
      problema,
      deals,
      taxa_completos: entraram ? Math.round((completos / entraram) * 100) : 0,
    };
  };

  const ts = (l: UnifiedLead) => new Date(l.created_at).getTime();

  const por_origem = (['framer', 'rd_pipedrive', 'webinar'] as LeadSourceKey[]).map((src) => {
    const subset = leads.filter((l) => l.source === src);
    return {
      source: src,
      source_label: SOURCE_LABELS[src],
      total: subset.length,
      completos: subset.filter((l) => l.status === 'completo').length,
      problema: subset.filter((l) => l.health !== 'ok').length,
    };
  });

  const rd = leads.filter((l) => l.source === 'rd_pipedrive');
  const isDeal = (s: FunnelStage) => s === 'deal_criado' || s === 'deal_ganho' || s === 'deal_perdido';
  const funil_rd = {
    capturado: rd.length,
    processado: rd.filter((l) => l.routing?.processado === true || isDeal(l.stage)).length,
    deal: rd.filter((l) => isDeal(l.stage)).length,
    nao_processado: rd.filter((l) => l.stage === 'nao_processado').length,
    ganho: rd.filter((l) => l.stage === 'deal_ganho').length,
    perdido: rd.filter((l) => l.stage === 'deal_perdido').length,
  };

  return {
    periodos: {
      h24: mk((l) => ts(l) >= t24),
      hoje: mk((l) => ts(l) >= tToday),
      d7: mk((l) => ts(l) >= t7),
    },
    por_origem,
    funil_rd,
    scoring: computeScoringStats(leads),
    duplicados: leads.filter((l) => l.is_duplicate).length,
  };
}
