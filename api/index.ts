import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const app = express();
app.use(cors());
app.use(express.json());

// ── Supabase ────────────────────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ── Discord ─────────────────────────────────────────────────────────────────
async function notifyDiscordSuccess(payload: { lead_source: string; workflow_name: string; lead_nome?: string; lead_email?: string; execution_id?: string }) {
  const url = process.env.DISCORD_WEBHOOK_ALERTAS;
  if (!url) return;
  const embed = {
    title: `✅ Lead Completo — ${payload.workflow_name}`,
    description: `👤 **${payload.lead_nome || 'N/A'}** · 📧 ${payload.lead_email || 'N/A'}\n✔️ Todos os campos obrigatórios presentes.`,
    color: 5763719, // verde
    timestamp: new Date().toISOString(),
    fields: payload.execution_id ? [{ name: 'Execution ID', value: payload.execution_id, inline: true }] : [],
    footer: { text: 'Spark Maxx Alerts Pipeline' },
  };
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [embed] }) });
  } catch (e) { console.error('Discord success notify failed', e); }
}

async function notifyDiscord(alert: any) {
  const url = process.env.DISCORD_WEBHOOK_ALERTAS;
  if (!url) return;
  const isError = alert.tipo === 'erro_tecnico';
  const embed = {
    title: `${isError ? '🔴 Erro no Fluxo' : '🟡 Lead Incompleto'} — ${alert.workflow_name}`,
    description: isError
      ? `❌ **Node:** ${alert.node_name}\n💬 ${alert.error_message}`
      : `👤 ${alert.lead_nome || 'N/A'} · 📧 ${alert.lead_email || 'N/A'}\n⚠️ **Faltando:** ${alert.campos_faltantes?.join(', ')}`,
    color: isError ? 15548997 : 16776960,
    timestamp: new Date().toISOString(),
    footer: { text: 'Spark Maxx Alerts Pipeline' },
  };
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [embed] }) });
  } catch (e) { console.error('Discord notify failed', e); }
}

// ── Validação de campos ──────────────────────────────────────────────────────
const LEAD_SOURCE_LABELS: Record<string, string> = {
  lp_sprout:    'LP Sprout (Framer)',
  lp_community: 'LP Community (Framer)',
  site_spark:   'Site Spark (RD nativo)',
  indicacao:    'Indicação Interna',
  rd_pipe:      'RD → Pipedrive',
};

const REQUIRED_FIELDS: Record<string, string[]> = {
  lp_sprout:    ['nome','email','telefone','empresa','voce_e','o_que_busca','faz_influencia','produto','conversion_identifier','page_url','utm_source','utm_medium','utm_campaign','tags'],
  lp_community: ['nome','email','telefone','empresa','cargo','tamanho_da_empresa','faz_influencia','produto','conversion_identifier','page_url','utm_source','utm_medium','utm_campaign'],
  site_spark:   ['nome','email','telefone','empresa','voce_e','frequencia','budget','o_que_busca','conversion_url','conversion_identifier'],
  // Indicação Interna — nomes reais do output de "Processar indicação"
  indicacao:    ['indicador_nome','indicador_email','nome','email','telefone','empresa','produto_tag','page_url'],
  // Campos de $json._lead — URL/UTMs NÃO são obrigatórias (nem sempre chegam via RD Station)
  rd_pipe:      ['lead_nome','lead_email','lead_telefone','lead_empresa','rota_definida','destino_pipeline_id','destino_stage_id','destino_owner_id','tags_rd'],
};

// Arrays que devem ser não-vazios
const ARRAY_FIELDS: Record<string, string[]> = {
  lp_sprout: ['tags'],
  rd_pipe:   ['tags_rd'],
};

type FieldDiag = { campo: string; motivo: string };

function diagnoseMissingFields(payload: Record<string, any>, source: string): FieldDiag[] {
  const arrayFields = ARRAY_FIELDS[source] || [];
  return (REQUIRED_FIELDS[source] || [])
    .filter(f => {
      const v = payload[f];
      if (v === undefined || v === null || v === '' || v === 'null') return true;
      if (arrayFields.includes(f) && Array.isArray(v) && v.length === 0) return true;
      return false;
    })
    .map(f => {
      const v = payload[f];
      let motivo: string;
      if (!(f in payload) || v === undefined) motivo = 'não veio no payload';
      else if (v === null)                    motivo = 'veio como nulo';
      else if (v === '')                      motivo = 'veio vazio';
      else if (v === 'null')                  motivo = 'veio como string "null"';
      else if (Array.isArray(v) && v.length === 0) motivo = 'array chegou vazio';
      else                                    motivo = 'valor inválido';
      return { campo: f, motivo };
    });
}

function getMissingFields(payload: Record<string, any>, source: string): string[] {
  const arrayFields = ARRAY_FIELDS[source] || [];
  return (REQUIRED_FIELDS[source] || []).filter(f => {
    const v = payload[f];
    if (v === undefined || v === null || v === '' || v === 'null') return true;
    if (arrayFields.includes(f) && Array.isArray(v) && v.length === 0) return true;
    return false;
  });
}

function diagnoseError(errorMessage: string): string {
  if (!errorMessage) return 'Erro desconhecido na execução';
  const m = errorMessage.toLowerCase();
  if (m.includes('econnrefused') || m.includes('connection refused')) return 'Conexão recusada pelo serviço externo';
  if (m.includes('etimedout') || m.includes('timeout'))               return 'Timeout — serviço não respondeu a tempo';
  if (m.includes('enotfound'))                                         return 'Serviço externo inacessível (falha de DNS)';
  if (m.includes('401') || m.includes('unauthorized'))                 return 'Falha de autenticação na API externa';
  if (m.includes('403') || m.includes('forbidden'))                    return 'Acesso negado pela API externa';
  if (m.includes('404') || m.includes('not found'))                    return 'Recurso não encontrado na API';
  if (m.includes('500') || m.includes('internal server'))              return 'Erro interno no serviço externo';
  if (m.includes('cannot read') || m.includes('undefined'))            return 'Dado esperado não encontrado no payload';
  if (m.includes('json') || m.includes('parse'))                       return 'Payload com formato JSON inválido';
  if (m.includes('rate limit') || m.includes('429'))                   return 'Rate limit atingido no serviço externo';
  if (m.includes('invalid') && m.includes('schema'))                   return 'Dados fora do schema esperado';
  if (m.includes('network') || m.includes('socket'))                   return 'Falha de rede — sem conexão com o serviço';
  if (m.includes('nenhum') || m.includes('não encontrado'))            return 'Registro não encontrado na base de dados';
  return errorMessage.length > 120 ? errorMessage.substring(0, 120) + '…' : errorMessage;
}

// ── Schemas ──────────────────────────────────────────────────────────────────
const LeadIncompletoSchema = z.object({
  workflow_id: z.string(), workflow_name: z.string(),
  execution_id: z.string().optional(), lead_email: z.string().email().optional(),
  lead_nome: z.string().optional(), campos_faltantes: z.array(z.string()),
  payload_original: z.record(z.string(), z.any()).optional(),
});

const ErroTecnicoSchema = z.object({
  workflow_id: z.string(), workflow_name: z.string(),
  execution_id: z.string().optional(), node_name: z.string(),
  error_message: z.string(), payload_original: z.record(z.string(), z.any()).optional(),
});

// ── Auth middleware ──────────────────────────────────────────────────────────
const webhookAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const secret = req.headers['x-webhook-secret'];
  const expected = process.env.WEBHOOK_SECRET;
  if (expected && secret !== expected) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// ── N8n config ───────────────────────────────────────────────────────────────
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://growthsparkmaxx.app.n8n.cloud';
const MONITORED_WORKFLOWS = (process.env.N8N_MONITORED_WORKFLOWS || '').split(',').filter(Boolean);
const WORKFLOW_NAMES: Record<string, string> = {
  'VVdWQERBqJsPxeDo': 'Passagem Leads - RD >> Pipedrive',
  'iCSEmoah1GxnsprH': 'Programa de indicação interna',
  'J2rdIrv7C7gILmpk': 'Leads LP - Framer',
};

// ── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Extrai os campos canônicos do lead a partir do payload bruto
function extractLeadFields(payload: Record<string, any>) {
  return {
    lead_nome:     payload.nome || payload.lead_nome || payload.indicado_nome || null,
    lead_email:    payload.email || payload.lead_email || payload.indicado_email || null,
    lead_telefone: payload.telefone || payload.lead_telefone || payload.indicado_telefone || null,
    lead_empresa:  payload.empresa || payload.lead_empresa || payload.indicado_empresa || null,
    produto:       payload.produto || payload.produto_tag || null,
  };
}

app.post('/api/validate/lead', webhookAuth, async (req, res) => {
  const db = getSupabase();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const { lead_source, workflow_id, workflow_name, execution_id, payload } = req.body;
  if (!lead_source || !payload) return res.status(400).json({ error: 'lead_source e payload obrigatórios' });

  const missing = getMissingFields(payload, lead_source);
  const wfId = workflow_id || lead_source;
  const wfName = workflow_name || LEAD_SOURCE_LABELS[lead_source] || lead_source;
  const leadFields = extractLeadFields(payload);

  if (!missing.length) {
    // Lead válido — auto-resolve alertas abertos desse email no mesmo workflow
    if (leadFields.lead_email && db) {
      await db.from('alerts')
        .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: 'auto:resubmit_ok' })
        .eq('lead_email', leadFields.lead_email)
        .eq('workflow_id', wfId)
        .eq('tipo', 'lead_incompleto')
        .eq('status', 'open');
    }
    // Persistir lead completo no monitor
    try {
      await db.from('leads').insert({
        workflow_id: wfId, workflow_name: wfName,
        execution_id: execution_id || null, lead_source,
        status: 'completo', ...leadFields, payload_original: payload,
      });
    } catch (e) { console.error('Failed to persist complete lead', e); }

    await notifyDiscordSuccess({
      lead_source, workflow_name: wfName,
      lead_nome: leadFields.lead_nome, lead_email: leadFields.lead_email,
      execution_id: execution_id || null,
    });
    return res.json({ valid: true, missing: [], message: 'Lead completo ✅' });
  }

  try {
    const fieldDiags = diagnoseMissingFields(payload, lead_source);
    const diagnostico = {
      tipo: 'lead_incompleto',
      resumo: `${missing.length} campo(s) faltando`,
      campos: fieldDiags,
      dica: fieldDiags.every(d => d.motivo === 'não veio no payload')
        ? 'Campos ausentes do payload processado. Verifique o mapeamento no node "Processar dados" do n8n.'
        : fieldDiags.some(d => d.motivo.includes('vazio') || d.motivo.includes('nulo'))
        ? 'Campos chegaram mas sem valor. O formulário pode estar enviando campos em branco.'
        : 'Combinação de campos ausentes e vazios. Verifique o formulário e o mapeamento no n8n.',
    };

    const alertPayload: any = {
      tipo: 'lead_incompleto',
      severity: missing.length >= 3 ? 'error' : 'warning',
      workflow_id: wfId, workflow_name: wfName,
      execution_id: execution_id || null,
      lead_email: leadFields.lead_email, lead_nome: leadFields.lead_nome,
      campos_faltantes: missing, payload_original: payload, status: 'open',
      diagnostico,
    };

    // Deduplicação: atualiza alerta aberto existente p/ mesmo email+workflow em vez de criar novo
    let existingId: string | null = null;
    if (leadFields.lead_email) {
      const { data: existing } = await db.from('alerts')
        .select('id').eq('lead_email', leadFields.lead_email)
        .eq('workflow_id', wfId)
        .eq('tipo', 'lead_incompleto').eq('status', 'open').maybeSingle();
      if (existing) existingId = existing.id;
    }

    let inserted: any, error: any;
    if (existingId) {
      ({ data: inserted, error } = await db.from('alerts').update(alertPayload).eq('id', existingId).select().single());
    } else {
      ({ data: inserted, error } = await db.from('alerts').upsert(alertPayload, { onConflict: 'workflow_id,execution_id,tipo' }).select().single());
    }
    if (error) throw error;

    // Persistir lead incompleto no monitor (linkado ao alerta)
    try {
      await db.from('leads').insert({
        workflow_id: wfId, workflow_name: wfName,
        execution_id: execution_id || null, lead_source,
        status: 'incompleto', ...leadFields,
        campos_faltantes: missing, payload_original: payload,
        alert_id: inserted.id,
      });
    } catch (e) { console.error('Failed to persist incomplete lead', e); }

    await notifyDiscord(inserted);
    res.status(201).json({ valid: false, missing, alert_id: inserted.id, message: `${missing.length} campo(s) faltando: ${missing.join(', ')}` });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/leads — listagem de leads recebidos
app.get('/api/leads', async (req, res) => {
  const db = getSupabase();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const { status, lead_source, workflow_id, search, from, to, page = '1', limit = '50' } = req.query;
  let q = db.from('leads').select('*', { count: 'exact' });

  if (status)      q = q.eq('status', status);
  if (lead_source) q = q.eq('lead_source', lead_source);
  if (workflow_id) q = q.eq('workflow_id', workflow_id);
  if (from)        q = q.gte('created_at', from);
  if (to)          q = q.lte('created_at', to);
  if (search) {
    const s = String(search).replace(/[%_]/g, '');
    q = q.or(`lead_email.ilike.%${s}%,lead_nome.ilike.%${s}%,lead_empresa.ilike.%${s}%`);
  }

  const fromIdx = (Number(page) - 1) * Number(limit);
  const { data, count, error } = await q
    .order('created_at', { ascending: false })
    .range(fromIdx, fromIdx + Number(limit) - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, count, page: Number(page), limit: Number(limit) });
});

// GET /api/leads/stats — contadores agregados
app.get('/api/leads/stats', async (req, res) => {
  const db = getSupabase();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [c24, i24, cT, iT, c7, i7] = await Promise.all([
      db.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'completo').gte('created_at', since24h),
      db.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'incompleto').gte('created_at', since24h),
      db.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'completo').gte('created_at', today.toISOString()),
      db.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'incompleto').gte('created_at', today.toISOString()),
      db.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'completo').gte('created_at', since7d),
      db.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'incompleto').gte('created_at', since7d),
    ]);

    const total24h = (c24.count || 0) + (i24.count || 0);
    const totalToday = (cT.count || 0) + (iT.count || 0);
    const total7d = (c7.count || 0) + (i7.count || 0);

    res.json({
      completos_24h: c24.count || 0, incompletos_24h: i24.count || 0, total_24h: total24h,
      completos_today: cT.count || 0, incompletos_today: iT.count || 0, total_today: totalToday,
      completos_7d: c7.count || 0, incompletos_7d: i7.count || 0, total_7d: total7d,
      completion_rate_24h:  total24h  > 0 ? Math.round((c24.count || 0) / total24h  * 100) : 0,
      completion_rate_today: totalToday > 0 ? Math.round((cT.count || 0) / totalToday * 100) : 0,
      completion_rate_7d:   total7d   > 0 ? Math.round((c7.count  || 0) / total7d   * 100) : 0,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/alerts/lead-incompleto', webhookAuth, async (req, res) => {
  const db = getSupabase();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const data = LeadIncompletoSchema.parse(req.body);
    const { data: inserted, error } = await db.from('alerts').upsert({
      tipo: 'lead_incompleto', severity: 'warning', ...data, status: 'open',
    }, { onConflict: 'workflow_id,execution_id,tipo' }).select().single();
    if (error) throw error;
    await notifyDiscord(inserted);
    res.status(201).json(inserted);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.post('/api/alerts/erro-tecnico', webhookAuth, async (req, res) => {
  const db = getSupabase();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const data = ErroTecnicoSchema.parse(req.body);
    const { data: inserted, error } = await db.from('alerts').upsert({
      tipo: 'erro_tecnico', severity: 'error', ...data, status: 'open',
    }, { onConflict: 'workflow_id,execution_id,tipo' }).select().single();
    if (error) throw error;
    await notifyDiscord(inserted);
    res.status(201).json(inserted);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.get('/api/alerts', async (req, res) => {
  const db = getSupabase();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const { status, tipo, page = '1', limit = '50' } = req.query;
  let q = db.from('alerts').select('*', { count: 'exact' });
  if (status) q = q.eq('status', status);
  if (tipo) q = q.eq('tipo', tipo);
  const from = (Number(page) - 1) * Number(limit);
  const { data, count, error } = await q.order('created_at', { ascending: false }).range(from, from + Number(limit) - 1);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, count, page: Number(page), limit: Number(limit) });
});

app.patch('/api/alerts/:id/resolve', async (req, res) => {
  const db = getSupabase();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const { data, error } = await db.from('alerts')
    .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: req.body.resolved_by || 'system' })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/dashboard/stats', async (req, res) => {
  const db = getSupabase();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const month = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [open, resolved, total, wf, recent] = await Promise.all([
      db.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      db.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'resolved').gte('resolved_at', today.toISOString()),
      db.from('alerts').select('*', { count: 'exact', head: true }).gte('created_at', week.toISOString()),
      db.from('n8n_workflows').select('*'),
      db.from('alerts').select('tipo,workflow_name,status,created_at').gte('created_at', month.toISOString()),
    ]);
    res.json({ openCount: open.count || 0, resolvedToday: resolved.count || 0, totalWeek: total.count || 0, workflows: wf.data || [], recent: recent.data || [] });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/n8n/workflows', async (req, res) => {
  const db = getSupabase();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const { data, error } = await db.from('n8n_workflows').select('*').order('updated_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/n8n/executions', async (req, res) => {
  const db = getSupabase();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const { workflowId, status, limit = '50' } = req.query;
  let q = db.from('n8n_executions').select('*').order('started_at', { ascending: false }).limit(Number(limit));
  if (workflowId) q = q.eq('workflow_id', workflowId);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/n8n/workflow-stats — estatísticas completas por workflow
app.get('/api/n8n/workflow-stats', async (req, res) => {
  const db = getSupabase();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const since7d  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: workflows } = await db.from('n8n_workflows').select('*');
  if (!workflows?.length) return res.json([]);

  const stats = await Promise.all(workflows.map(async (wf) => {
    const [all, last10, daily24h, recent] = await Promise.all([
      // Todas as execuções dos últimos 30 dias
      db.from('n8n_executions')
        .select('status, duration_ms, started_at')
        .eq('workflow_id', wf.id)
        .gte('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('started_at', { ascending: false }),

      // Últimas 10 para os dots
      db.from('n8n_executions')
        .select('status, started_at, duration_ms, node_error, error_message, execution_id')
        .eq('workflow_id', wf.id)
        .order('started_at', { ascending: false })
        .limit(10),

      // Contagens por dia nos últimos 7 dias
      db.from('n8n_executions')
        .select('status, started_at')
        .eq('workflow_id', wf.id)
        .gte('started_at', since7d),

      // Últimas 5 execuções para expandir
      db.from('n8n_executions')
        .select('execution_id, status, started_at, finished_at, duration_ms, node_error, error_message')
        .eq('workflow_id', wf.id)
        .order('started_at', { ascending: false })
        .limit(5),
    ]);

    const executions = all.data || [];
    const total = executions.length;
    const successes = executions.filter(e => e.status === 'success').length;
    const errors = executions.filter(e => e.status === 'error' || e.status === 'crashed').length;
    const successRate = total > 0 ? Math.round((successes / total) * 100) : 0;

    const durations = executions.filter(e => e.duration_ms && e.status === 'success').map(e => e.duration_ms as number);
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

    const exec24h = (daily24h.data || []).filter(e => e.started_at >= since24h);
    const executions24h = exec24h.length;
    const errors24h = exec24h.filter(e => e.status === 'error' || e.status === 'crashed').length;

    // Sparkline: últimos 7 dias agrupados por data
    const sparkMap = new Map<string, { total: number; errors: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      sparkMap.set(d.toISOString().split('T')[0], { total: 0, errors: 0 });
    }
    (daily24h.data || []).concat(
      executions.filter(e => e.started_at >= since7d)
    ).forEach(e => {
      const day = e.started_at?.split('T')[0];
      if (day && sparkMap.has(day)) {
        sparkMap.get(day)!.total++;
        if (e.status === 'error' || e.status === 'crashed') sparkMap.get(day)!.errors++;
      }
    });
    const sparkline = Array.from(sparkMap.entries()).map(([date, v]) => ({ date, ...v }));

    return {
      ...wf,
      total_executions: wf.total_executions || total,
      total_errors: wf.total_errors || errors,
      success_rate: successRate,
      avg_duration_ms: avgDuration,
      executions_24h: executions24h,
      errors_24h: errors24h,
      last_10_statuses: (last10.data || []).map(e => e.status),
      sparkline,
      recent_executions: recent.data || [],
    };
  }));

  res.json(stats);
});

app.post('/api/n8n/sync', async (req, res) => {
  const db = getSupabase();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const apiKey = process.env.N8N_API_KEY;
  if (!apiKey || !MONITORED_WORKFLOWS.length) return res.json({ ok: true, skipped: true });

  let synced = 0;
  for (const wfId of MONITORED_WORKFLOWS) {
    try {
      const r = await fetch(`${N8N_BASE_URL}/api/v1/executions?workflowId=${wfId}&limit=25`, { headers: { 'X-N8N-API-KEY': apiKey } });
      const json = await r.json();
      for (const exec of json.data || []) {
        const { data: ex } = await db.from('n8n_executions').select('id').eq('execution_id', String(exec.id)).maybeSingle();
        if (ex) continue;
        let alertId = null;
        if (exec.status === 'error' || exec.status === 'crashed') {
          const errorMsg = exec.data?.resultData?.error?.message || 'Execução falhou';
          const nodeName = exec.data?.resultData?.lastNodeExecuted || null;
          const diagnostico = {
            tipo: 'erro_tecnico',
            motivo: diagnoseError(errorMsg),
            node_falhou: nodeName,
            detalhe_original: errorMsg.length > 200 ? errorMsg.substring(0, 200) + '…' : errorMsg,
          };
          const { data: al } = await db.from('alerts').upsert({
            tipo: 'erro_tecnico', severity: 'error', workflow_id: wfId,
            workflow_name: WORKFLOW_NAMES[wfId] || wfId, execution_id: String(exec.id),
            node_name: nodeName, error_message: errorMsg, status: 'open', diagnostico,
          }, { onConflict: 'workflow_id,execution_id,tipo' }).select('id').single();
          if (al) { alertId = al.id; await notifyDiscord({ ...al, tipo: 'erro_tecnico', workflow_name: WORKFLOW_NAMES[wfId] }); }
        }
        await db.from('n8n_executions').insert({
          execution_id: String(exec.id), workflow_id: wfId, workflow_name: WORKFLOW_NAMES[wfId] || wfId,
          status: exec.status, started_at: exec.startedAt, finished_at: exec.stoppedAt,
          duration_ms: exec.stoppedAt && exec.startedAt ? new Date(exec.stoppedAt).getTime() - new Date(exec.startedAt).getTime() : null,
          error_message: exec.status === 'error' ? (exec.data?.resultData?.error?.message || null) : null,
          node_error: exec.data?.resultData?.lastNodeExecuted || null, alert_id: alertId,
        });
        synced++;
      }
      const last = json.data?.[0];
      if (last) await db.from('n8n_workflows').update({ last_execution_at: last.startedAt, last_execution_status: last.status, updated_at: new Date().toISOString() }).eq('id', wfId);
    } catch (e) { console.error(`Sync error for ${wfId}:`, e); }
  }
  res.json({ ok: true, synced, timestamp: new Date().toISOString() });
});

export default app;
