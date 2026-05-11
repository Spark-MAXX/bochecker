import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getSupabaseAdmin } from '../src/lib/supabase.ts';
import { sendDiscordAlert } from '../src/lib/discord.ts';
import { LeadIncompletoSchema, ErroTecnicoSchema } from '../src/lib/schemas.ts';
import { validateLeadFields, LEAD_SOURCE_LABELS, type LeadSource } from '../src/lib/validation-config.ts';

const N8N_API_KEY = process.env.N8N_API_KEY;
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://growthsparkmaxx.app.n8n.cloud';
const MONITORED_WORKFLOWS = (process.env.N8N_MONITORED_WORKFLOWS || '').split(',').filter(Boolean);

const WORKFLOW_NAMES: Record<string, string> = {
  'VVdWQERBqJsPxeDo': 'Passagem Leads - RD >> Pipedrive',
  'iCSEmoah1GxnsprH': 'Programa de indicação interna',
  'J2rdIrv7C7gILmpk': 'Leads LP - Framer',
};

const app = express();
app.use(cors());
app.use(express.json());

const webhookAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const secret = req.headers['x-webhook-secret'];
  const expected = process.env.WEBHOOK_SECRET;
  if (expected && secret !== expected) {
    return res.status(401).json({ error: 'Unauthorized: Invalid webhook secret' });
  }
  next();
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/validate/lead', webhookAuth, async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(503).json({ error: 'Database service unavailable' });

  const { lead_source, workflow_id, workflow_name, execution_id, payload } = req.body;
  if (!lead_source || !payload) {
    return res.status(400).json({ error: 'lead_source e payload são obrigatórios' });
  }

  const missingFields = validateLeadFields(payload, lead_source as LeadSource);
  if (missingFields.length === 0) {
    return res.json({ valid: true, missing: [], message: 'Lead completo ✅' });
  }

  try {
    const alertData = {
      tipo: 'lead_incompleto',
      severity: missingFields.length >= 3 ? 'error' : 'warning',
      workflow_id: workflow_id || lead_source,
      workflow_name: workflow_name || LEAD_SOURCE_LABELS[lead_source as LeadSource] || lead_source,
      execution_id: execution_id || null,
      lead_email: payload.email || payload.indicado_email || null,
      lead_nome: payload.nome || payload.indicado_nome || null,
      campos_faltantes: missingFields,
      payload_original: payload,
      status: 'open',
    };

    const { data: inserted, error } = await supabaseAdmin
      .from('alerts')
      .upsert(alertData, { onConflict: 'workflow_id,execution_id,tipo' })
      .select()
      .single();

    if (error) throw error;
    await sendDiscordAlert(inserted);

    return res.status(201).json({
      valid: false,
      missing: missingFields,
      alert_id: inserted.id,
      message: `Lead incompleto — ${missingFields.length} campo(s) faltando: ${missingFields.join(', ')}`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/alerts/lead-incompleto', webhookAuth, async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(503).json({ error: 'Database service unavailable' });

  try {
    const data = LeadIncompletoSchema.parse(req.body);
    const alertData = {
      tipo: 'lead_incompleto', severity: 'warning',
      workflow_id: data.workflow_id, workflow_name: data.workflow_name,
      execution_id: data.execution_id, lead_email: data.lead_email,
      lead_nome: data.lead_nome, campos_faltantes: data.campos_faltantes,
      payload_original: data.payload_original, status: 'open',
    };
    const { data: inserted, error } = await supabaseAdmin
      .from('alerts').upsert(alertData, { onConflict: 'workflow_id,execution_id,tipo' })
      .select().single();
    if (error) throw error;
    await sendDiscordAlert(inserted);
    res.status(201).json(inserted);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/alerts/erro-tecnico', webhookAuth, async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(503).json({ error: 'Database service unavailable' });

  try {
    const data = ErroTecnicoSchema.parse(req.body);
    const alertData = {
      tipo: 'erro_tecnico', severity: 'error',
      workflow_id: data.workflow_id, workflow_name: data.workflow_name,
      execution_id: data.execution_id, node_name: data.node_name,
      error_message: data.error_message, payload_original: data.payload_original,
      status: 'open',
    };
    const { data: inserted, error } = await supabaseAdmin
      .from('alerts').upsert(alertData, { onConflict: 'workflow_id,execution_id,tipo' })
      .select().single();
    if (error) throw error;
    await sendDiscordAlert(inserted);
    res.status(201).json(inserted);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/alerts', async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(503).json({ error: 'Database service unavailable' });

  const { status, tipo, from, to, page = '1', limit = '50' } = req.query;
  let query = supabaseAdmin.from('alerts').select('*', { count: 'exact' });
  if (status) query = query.eq('status', status);
  if (tipo) query = query.eq('tipo', tipo);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const fromIdx = (Number(page) - 1) * Number(limit);
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(fromIdx, fromIdx + Number(limit) - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, count, page: Number(page), limit: Number(limit) });
});

app.patch('/api/alerts/:id/resolve', async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(503).json({ error: 'Database service unavailable' });

  const { data, error } = await supabaseAdmin
    .from('alerts')
    .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: req.body.resolved_by || 'system' })
    .eq('id', req.params.id).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/dashboard/stats', async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(503).json({ error: 'Database service unavailable' });

  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [openAlerts, resolvedToday, totalWeek, workflows, recentAlerts] = await Promise.all([
      supabaseAdmin.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabaseAdmin.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'resolved').gte('resolved_at', today.toISOString()),
      supabaseAdmin.from('alerts').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabaseAdmin.from('n8n_workflows').select('*'),
      supabaseAdmin.from('alerts').select('tipo, workflow_name, status, created_at').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);
    res.json({
      openCount: openAlerts.count || 0,
      resolvedToday: resolvedToday.count || 0,
      totalWeek: totalWeek.count || 0,
      workflows: workflows.data || [],
      recent: recentAlerts.data || [],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/n8n/workflows', async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(503).json({ error: 'Database service unavailable' });
  const { data, error } = await supabaseAdmin.from('n8n_workflows').select('*').order('updated_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/n8n/executions', async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(503).json({ error: 'Database service unavailable' });
  const { workflowId, status, limit = '50' } = req.query;
  let query = supabaseAdmin.from('n8n_executions').select('*').order('started_at', { ascending: false }).limit(Number(limit));
  if (workflowId) query = query.eq('workflow_id', workflowId);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Sync manual — na Vercel o polling automático não roda (serverless)
// Use Vercel Cron Jobs para chamar este endpoint periodicamente
app.post('/api/n8n/sync', async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(503).json({ error: 'Database service unavailable' });
  if (!N8N_API_KEY || !MONITORED_WORKFLOWS.length) return res.json({ ok: true, skipped: true });

  let synced = 0;
  for (const workflowId of MONITORED_WORKFLOWS) {
    try {
      const r = await fetch(`${N8N_BASE_URL}/api/v1/executions?workflowId=${workflowId}&limit=25`, {
        headers: { 'X-N8N-API-KEY': N8N_API_KEY },
      });
      const json = await r.json();

      for (const exec of json.data || []) {
        const { data: existing } = await supabaseAdmin
          .from('n8n_executions').select('id').eq('execution_id', String(exec.id)).maybeSingle();
        if (existing) continue;

        let alertId: string | null = null;
        if (exec.status === 'error' || exec.status === 'crashed') {
          const errorMsg = exec.data?.resultData?.error?.message || 'Execução falhou';
          const { data: alert } = await supabaseAdmin.from('alerts').upsert({
            tipo: 'erro_tecnico', severity: 'error',
            workflow_id: workflowId,
            workflow_name: WORKFLOW_NAMES[workflowId] || workflowId,
            execution_id: String(exec.id),
            node_name: exec.data?.resultData?.lastNodeExecuted || null,
            error_message: errorMsg, status: 'open',
          }, { onConflict: 'workflow_id,execution_id,tipo' }).select('id').single();
          if (alert) { alertId = alert.id; await sendDiscordAlert({ ...alert, tipo: 'erro_tecnico' }); }
        }

        await supabaseAdmin.from('n8n_executions').insert({
          execution_id: String(exec.id), workflow_id: workflowId,
          workflow_name: WORKFLOW_NAMES[workflowId] || workflowId,
          status: exec.status, started_at: exec.startedAt, finished_at: exec.stoppedAt,
          duration_ms: exec.stoppedAt && exec.startedAt ? new Date(exec.stoppedAt).getTime() - new Date(exec.startedAt).getTime() : null,
          error_message: exec.status === 'error' ? (exec.data?.resultData?.error?.message || null) : null,
          node_error: exec.data?.resultData?.lastNodeExecuted || null, alert_id: alertId,
        });
        synced++;
      }

      const lastExec = json.data?.[0];
      if (lastExec) {
        await supabaseAdmin.from('n8n_workflows').update({
          last_execution_at: lastExec.startedAt,
          last_execution_status: lastExec.status,
          updated_at: new Date().toISOString(),
        }).eq('id', workflowId);
      }
    } catch (_) {}
  }

  res.json({ ok: true, synced, timestamp: new Date().toISOString() });
});

export default app;
