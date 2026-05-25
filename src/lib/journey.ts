// Jornada unificada do lead: agrega Framer + RD→Pipedrive + Webinar por
// conversion_identifier (fallback email) e mostra a progressão ponta a ponta:
//   E1 Form Framer → E2 Chegou ao RD → E3 Processado → E4 Deal → E5 Status no Pipedrive.

import type { SupabaseClient } from '@supabase/supabase-js';

export type JourneyStage = 'form' | 'rd' | 'processado' | 'deal' | 'ganho' | 'perdido' | 'webinar';
export type Health = 'ok' | 'atencao' | 'erro';

export const JOURNEY_STAGE_LABEL: Record<JourneyStage, string> = {
  form: 'Webhook Framer', rd: 'Chegou ao RD', processado: 'MQL (Fluxo Pipedrive)', deal: 'Deal criado',
  ganho: 'Deal ganho', perdido: 'Deal perdido', webinar: 'Inscrito (Webinar)',
};

export interface JourneyRef { source: 'framer' | 'rd_pipedrive' | 'webinar'; id: number | string; criado_em: string | null; }

export interface JourneyLead {
  uid: string; key: string;
  nome: string | null; email: string | null; telefone: string | null; empresa: string | null; produto: string | null;
  is_indicacao: boolean;
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null;
  created_at: string | null; last_at: string | null;
  has_framer: boolean; has_rd: boolean; has_webinar: boolean;
  framer_count: number; rd_count: number; webinar_count: number;
  processado: boolean | null; rota_definida: string | null; rota_encontrada: boolean | null; motivo_rota: string | null;
  destino_pipeline: string | null; destino_stage: string | null; destino_owner: string | null;
  person_id: number | null; deal_id: number | null;
  pipe: { status: string | null; stage_id: number | null; valor: number | null; won_at: string | null; lost_at: string | null; lost_reason: string | null; atualizado_em: string | null } | null;
  reached: { form: boolean; rd: boolean; processado: boolean; deal: boolean };
  stage: JourneyStage; stage_label: string; health: Health; stalled: string | null;
  dup_bases: { framer: number; rd_pipedrive: number; webinar: number };
  refs: JourneyRef[];
}

export interface JourneyFilters {
  stage?: JourneyStage; health?: Health; search?: string;
  problemOnly?: boolean; dupOnly?: boolean; from?: string; to?: string; limit?: number;
}

export interface JourneyStats {
  total: number; framer: number; framer_to_rd: number; rd: number; rd_direct: number;
  processado: number; deal: number; aberto: number; ganho: number; perdido: number; webinar: number;
  leak_framer_sem_rd: number; leak_rd_sem_proc: number; leak_proc_sem_deal: number;
  taxa_framer_rd: number; taxa_rd_proc: number; taxa_proc_deal: number;
}

const norm = (e: any) => (e ?? '').toString().trim().toLowerCase();
// Chave por EMAIL normalizado. conversion_identifier NÃO serve (é o nome da LP/form,
// repetido em centenas de leads — ex.: "Sprout - LP").
const keyOf = (email: any): string | null => {
  const e = norm(email);
  return e ? `e:${e}` : null;
};
const newer = (a: string | null, b: string | null) => ((a || '') > (b || '') ? a : b);

const SEL = {
  framer: 'id,criado_em,email,nome,telefone,empresa,produto,is_indicacao,utm_source,utm_medium,utm_campaign,conversion_identifier',
  rd: 'id,criado_em,lead_email,lead_nome,lead_telefone,lead_empresa,produto_interesse,is_indicacao,utm_source,utm_medium,utm_campaign,conversion_identifier,rota_definida,rota_encontrada,motivo_rota,destino_pipeline_nome,destino_stage_nome,destino_owner_nome,processado,pipedrive_person_id,pipedrive_deal_id',
  webinar: 'id,criado_em,email,nome,telefone,empresa,produto,is_indicacao,utm_source,utm_medium,utm_campaign,conversion_identifier',
};

function blank(key: string): JourneyLead {
  return {
    uid: key, key, nome: null, email: null, telefone: null, empresa: null, produto: null, is_indicacao: false,
    utm_source: null, utm_medium: null, utm_campaign: null, created_at: null, last_at: null,
    has_framer: false, has_rd: false, has_webinar: false, framer_count: 0, rd_count: 0, webinar_count: 0,
    processado: null, rota_definida: null, rota_encontrada: null, motivo_rota: null,
    destino_pipeline: null, destino_stage: null, destino_owner: null, person_id: null, deal_id: null, pipe: null,
    reached: { form: false, rd: false, processado: false, deal: false },
    stage: 'form', stage_label: '', health: 'ok', stalled: null,
    dup_bases: { framer: 0, rd_pipedrive: 0, webinar: 0 }, refs: [],
  };
}
const fill = (cur: any, val: any) => (cur === null || cur === undefined || cur === '' ? (val ?? cur) : cur);

function classify(j: JourneyLead): void {
  j.reached = {
    form: j.has_framer,
    rd: j.has_rd,
    processado: !!j.processado || !!j.deal_id,
    deal: !!j.deal_id,
  };
  let stage: JourneyStage;
  let health: Health = 'ok';
  let stalled: string | null = null;
  if (j.deal_id) {
    if (j.pipe?.status === 'won') stage = 'ganho';
    else if (j.pipe?.status === 'lost') { stage = 'perdido'; health = 'atencao'; }
    else stage = 'deal';
  } else if (j.has_rd && j.processado === true) {
    stage = 'processado'; health = 'atencao'; stalled = 'Virou MQL (Fluxo Pipedrive), mas sem deal criado';
  } else if (j.has_rd) {
    stage = 'rd'; health = 'erro'; stalled = 'Chegou ao RD mas não virou MQL (Fluxo Pipedrive)';
  } else if (j.has_framer) {
    stage = 'form'; health = 'atencao'; stalled = 'Webhook Framer recebido, mas não chegou ao RD';
  } else if (j.has_webinar) {
    stage = 'webinar';
  } else {
    stage = 'form';
  }
  j.stage = stage; j.stage_label = JOURNEY_STAGE_LABEL[stage]; j.health = health; j.stalled = stalled;
}

export async function fetchJourneys(db: SupabaseClient, opts: JourneyFilters = {}): Promise<{ data: JourneyLead[]; total: number }> {
  const from = opts.from || new Date(Date.now() - 30 * 86400_000).toISOString();
  const q = (table: string, sel: string) => {
    let b = db.from(table).select(sel).gte('criado_em', from).order('criado_em', { ascending: false }).limit(5000);
    if (opts.to) b = b.lte('criado_em', opts.to);
    return b;
  };
  const [fr, rd, wb] = await Promise.all([q('leads_framer', SEL.framer), q('leads_rd_pipedrive', SEL.rd), q('leads_webinar', SEL.webinar)]);

  const map = new Map<string, JourneyLead>();
  const get = (key: string) => { let j = map.get(key); if (!j) { j = blank(key); map.set(key, j); } return j; };

  for (const r of (fr.data as any[]) || []) {
    const key = keyOf(r.email); if (!key) continue;
    const j = get(key); j.has_framer = true; j.framer_count++;
    j.nome = fill(j.nome, r.nome); j.email = fill(j.email, r.email); j.telefone = fill(j.telefone, r.telefone);
    j.empresa = fill(j.empresa, r.empresa); j.produto = fill(j.produto, r.produto);
    j.is_indicacao = j.is_indicacao || !!r.is_indicacao;
    j.utm_source = fill(j.utm_source, r.utm_source); j.utm_medium = fill(j.utm_medium, r.utm_medium); j.utm_campaign = fill(j.utm_campaign, r.utm_campaign);
    j.created_at = j.created_at ? (j.created_at < r.criado_em ? j.created_at : r.criado_em) : r.criado_em;
    j.last_at = newer(j.last_at, r.criado_em);
    j.refs.push({ source: 'framer', id: r.id, criado_em: r.criado_em ?? null });
  }
  for (const r of (rd.data as any[]) || []) {
    const key = keyOf(r.lead_email); if (!key) continue;
    const j = get(key); j.has_rd = true; j.rd_count++;
    j.nome = fill(j.nome, r.lead_nome); j.email = fill(j.email, r.lead_email); j.telefone = fill(j.telefone, r.lead_telefone);
    j.empresa = fill(j.empresa, r.lead_empresa); j.produto = fill(j.produto, r.produto_interesse);
    j.is_indicacao = j.is_indicacao || !!r.is_indicacao;
    j.utm_source = fill(j.utm_source, r.utm_source); j.utm_medium = fill(j.utm_medium, r.utm_medium); j.utm_campaign = fill(j.utm_campaign, r.utm_campaign);
    if (r.processado === true) j.processado = true; else if (j.processado === null) j.processado = r.processado ?? null;
    j.rota_definida = fill(j.rota_definida, r.rota_definida); j.motivo_rota = fill(j.motivo_rota, r.motivo_rota);
    if (r.rota_encontrada !== null && r.rota_encontrada !== undefined) j.rota_encontrada = r.rota_encontrada;
    j.destino_pipeline = fill(j.destino_pipeline, r.destino_pipeline_nome); j.destino_stage = fill(j.destino_stage, r.destino_stage_nome); j.destino_owner = fill(j.destino_owner, r.destino_owner_nome);
    if (r.pipedrive_person_id) j.person_id = r.pipedrive_person_id;
    if (r.pipedrive_deal_id) j.deal_id = r.pipedrive_deal_id;
    j.created_at = j.created_at ? (j.created_at < r.criado_em ? j.created_at : r.criado_em) : r.criado_em;
    j.last_at = newer(j.last_at, r.criado_em);
    j.refs.push({ source: 'rd_pipedrive', id: r.id, criado_em: r.criado_em ?? null });
  }
  for (const r of (wb.data as any[]) || []) {
    const key = keyOf(r.email); if (!key) continue;
    const j = get(key); j.has_webinar = true; j.webinar_count++;
    j.nome = fill(j.nome, r.nome); j.email = fill(j.email, r.email); j.telefone = fill(j.telefone, r.telefone);
    j.empresa = fill(j.empresa, r.empresa); j.produto = fill(j.produto, r.produto);
    j.created_at = j.created_at ? (j.created_at < r.criado_em ? j.created_at : r.criado_em) : r.criado_em;
    j.last_at = newer(j.last_at, r.criado_em);
    j.refs.push({ source: 'webinar', id: r.id, criado_em: r.criado_em ?? null });
  }

  const all = [...map.values()];

  // S4: status atual do deal (deals_snapshot)
  const dealIds = Array.from(new Set(all.map((j) => j.deal_id).filter((d): d is number => d !== null && d !== undefined)));
  if (dealIds.length) {
    try {
      const { data } = await db.from('deals_snapshot').select('deal_id,status,stage_id,value,won_time,lost_time,lost_reason,update_time').in('deal_id', dealIds);
      const byDeal = new Map<string, any>();
      for (const d of (data as any[]) || []) byDeal.set(String(d.deal_id), d);
      for (const j of all) {
        if (j.deal_id == null) continue;
        const s = byDeal.get(String(j.deal_id)); if (!s) continue;
        j.pipe = { status: s.status ?? null, stage_id: s.stage_id ?? null, valor: s.value ?? null, won_at: s.won_time ?? null, lost_at: s.lost_time ?? null, lost_reason: s.lost_reason ?? null, atualizado_em: s.update_time ?? null };
      }
    } catch { /* sem deals_snapshot */ }
  }

  for (const j of all) {
    j.dup_bases = { framer: j.framer_count > 1 ? j.framer_count : 0, rd_pipedrive: j.rd_count > 1 ? j.rd_count : 0, webinar: j.webinar_count > 1 ? j.webinar_count : 0 };
    classify(j);
  }

  let filtered = all;
  if (opts.stage) filtered = filtered.filter((j) => j.stage === opts.stage);
  if (opts.health) filtered = filtered.filter((j) => j.health === opts.health);
  if (opts.problemOnly) filtered = filtered.filter((j) => j.health !== 'ok');
  if (opts.dupOnly) filtered = filtered.filter((j) => j.dup_bases.framer || j.dup_bases.rd_pipedrive || j.dup_bases.webinar);
  if (opts.search) {
    const s = opts.search.trim().toLowerCase();
    filtered = filtered.filter((j) => (j.email || '').toLowerCase().includes(s) || (j.nome || '').toLowerCase().includes(s) || (j.empresa || '').toLowerCase().includes(s));
  }
  filtered.sort((a, b) => ((a.last_at || '') < (b.last_at || '') ? 1 : -1));
  const total = filtered.length;
  return { data: filtered.slice(0, opts.limit ?? 300), total };
}

export async function fetchJourneyStats(db: SupabaseClient, opts: { from?: string; to?: string } = {}): Promise<JourneyStats> {
  const { data: js } = await fetchJourneys(db, { from: opts.from, to: opts.to, limit: 1_000_000 });
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const framer = js.filter((j) => j.has_framer).length;
  const framer_to_rd = js.filter((j) => j.has_framer && j.has_rd).length;
  const rd = js.filter((j) => j.has_rd).length;
  const processado = js.filter((j) => j.has_rd && (j.processado === true || j.deal_id)).length;
  const deal = js.filter((j) => j.deal_id).length;
  return {
    total: js.length, framer, framer_to_rd, rd, rd_direct: js.filter((j) => j.has_rd && !j.has_framer).length,
    processado, deal,
    aberto: js.filter((j) => j.deal_id && j.stage === 'deal').length,
    ganho: js.filter((j) => j.stage === 'ganho').length,
    perdido: js.filter((j) => j.stage === 'perdido').length,
    webinar: js.filter((j) => j.has_webinar).length,
    leak_framer_sem_rd: js.filter((j) => j.has_framer && !j.has_rd).length,
    leak_rd_sem_proc: js.filter((j) => j.has_rd && j.processado !== true && !j.deal_id).length,
    leak_proc_sem_deal: js.filter((j) => j.has_rd && j.processado === true && !j.deal_id).length,
    taxa_framer_rd: pct(framer_to_rd, framer),
    taxa_rd_proc: pct(processado, rd),
    taxa_proc_deal: pct(deal, processado),
  };
}
