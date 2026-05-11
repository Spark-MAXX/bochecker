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
  lp_sprout:    ['nome','email','telefone','empresa','voce_e','o_que_busca','frequencia_campanhas','url','utm_source','utm_medium','utm_campaign'],
  lp_community: ['nome','email','telefone','empresa','cargo','tamanho_da_empresa','frequencia_campanhas','url','utm_source','utm_medium','utm_campaign'],
  site_spark:   ['nome','email','telefone','empresa','voce_e','frequencia','budget','o_que_busca','conversion_url','conversion_identifier'],
  indicacao:    ['sparker_nome','sparker_email','indicado_nome','indicado_email','indicado_telefone','indicado_empresa','produto_indicado','url','utm_source','utm_medium','utm_campaign'],
  rd_pipe:      ['nome','email','tags','rota_definida','destino_pipeline_id','destino_stage_id','destino_owner_id','pipedrive_person_id','pipedrive_deal_id','label'],
};

function getMissingFields(payload: Record<string, any>, source: string): string[] {
  return (REQUIRED_FIELDS[source] || []).filter(f => {
    const v = payload[f];
    return v === undefined || v === null || v === '' || v === 'null';
  });
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

app.post('/api/validate/lead', webhookAuth, async (req, res) => {
  const db = getSupabase();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const { lead_source, workflow_id, workflow_name, execution_id, payload } = req.body;
  if (!lead_source || !payload) return res.status(400).json({ error: 'lead_source e payload obrigatórios' });

  const missing = getMissingFields(payload, lead_source);
  if (!missing.length) {
    await notifyDiscordSuccess({
      lead_source,
      workflow_name: workflow_name || LEAD_SOURCE_LABELS[lead_source] || lead_source,
      lead_nome: payload.nome || payload.indicado_nome || null,
      lead_email: payload.email || payload.indicado_email || null,
      execution_id: execution_id || null,
    });
    return res.json({ valid: true, missing: [], message: 'Lead completo ✅' });
  }

  try {
    const { data: inserted, error } = await db.from('alerts').upsert({
      tipo: 'lead_incompleto',
      severity: missing.length >= 3 ? 'error' : 'warning',
      workflow_id: workflow_id || lead_source,
      workflow_name: workflow_name || LEAD_SOURCE_LABELS[lead_source] || lead_source,
      execution_id: execution_id || null,
      lead_email: payload.email || payload.indicado_email || null,
      lead_nome: payload.nome || payload.indicado_nome || null,
      campos_faltantes: missing, payload_original: payload, status: 'open',
    }, { onConflict: 'workflow_id,execution_id,tipo' }).select().single();
    if (error) throw error;
    await notifyDiscord(inserted);
    res.status(201).json({ valid: false, missing, alert_id: inserted.id, message: `${missing.length} campo(s) faltando: ${missing.join(', ')}` });
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
          const { data: al } = await db.from('alerts').upsert({
            tipo: 'erro_tecnico', severity: 'error', workflow_id: wfId,
            workflow_name: WORKFLOW_NAMES[wfId] || wfId, execution_id: String(exec.id),
            node_name: exec.data?.resultData?.lastNodeExecuted || null,
            error_message: errorMsg, status: 'open',
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
