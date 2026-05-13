import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import pino from 'pino';
import { getSupabaseAdmin } from './src/lib/supabase.ts';
import { sendDiscordAlert } from './src/lib/discord.ts';
import { LeadIncompletoSchema, ErroTecnicoSchema } from './src/lib/schemas.ts';
import { validateLeadFields, LEAD_SOURCE_LABELS, type LeadSource } from './src/lib/validation-config.ts';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

const N8N_API_KEY = process.env.N8N_API_KEY;
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://growthsparkmaxx.app.n8n.cloud';
const MONITORED_WORKFLOWS = (process.env.N8N_MONITORED_WORKFLOWS || '').split(',').filter(Boolean);

const WORKFLOW_NAMES: Record<string, string> = {
  'VVdWQERBqJsPxeDo': 'Passagem Leads - RD >> Pipedrive',
  'iCSEmoah1GxnsprH': 'Programa de indicação interna',
  'J2rdIrv7C7gILmpk': 'Leads LP - Framer',
};

// Lead fields required per workflow
const REQUIRED_LEAD_FIELDS: Record<string, string[]> = {
  'J2rdIrv7C7gILmpk': ['email', 'nome', 'produto'],
  'VVdWQERBqJsPxeDo': ['email', 'nome'],
  'iCSEmoah1GxnsprH': ['email', 'nome', 'indicador_email'],
};

async function fetchN8nExecutions(workflowId: string, lastSyncedId?: string) {
  const url = `${N8N_BASE_URL}/api/v1/executions?workflowId=${workflowId}&limit=25`;
  const res = await fetch(url, { headers: { 'X-N8N-API-KEY': N8N_API_KEY! } });
  if (!res.ok) throw new Error(`n8n API error: ${res.status}`);
  const json = await res.json();
  return json.data as any[];
}

async function syncN8nExecutions() {
  if (!N8N_API_KEY || !MONITORED_WORKFLOWS.length) return;
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  for (const workflowId of MONITORED_WORKFLOWS) {
    try {
      const executions = await fetchN8nExecutions(workflowId);
      let newErrors = 0;

      for (const exec of executions) {
        const execId = String(exec.id);

        // Skip already synced
        const { data: existing } = await supabaseAdmin
          .from('n8n_executions')
          .select('id')
          .eq('execution_id', execId)
          .maybeSingle();

        if (existing) continue;

        const duration = exec.stoppedAt && exec.startedAt
          ? new Date(exec.stoppedAt).getTime() - new Date(exec.startedAt).getTime()
          : null;

        let alertId: string | null = null;

        // Create alert for failed executions
        if (exec.status === 'error' || exec.status === 'crashed') {
          const errorMsg = exec.data?.resultData?.error?.message
            || exec.data?.resultData?.error?.description
            || 'Execução falhou sem mensagem de erro';
          const nodeName = exec.data?.resultData?.lastNodeExecuted || 'desconhecido';

          const { data: alert } = await supabaseAdmin
            .from('alerts')
            .upsert({
              tipo: 'erro_tecnico',
              severity: 'error',
              workflow_id: workflowId,
              workflow_name: WORKFLOW_NAMES[workflowId] || workflowId,
              execution_id: execId,
              node_name: nodeName,
              error_message: errorMsg,
              status: 'open',
            }, { onConflict: 'workflow_id,execution_id,tipo' })
            .select('id')
            .single();

          if (alert) {
            alertId = alert.id;
            newErrors++;
            await sendDiscordAlert({ ...alert, tipo: 'erro_tecnico', workflow_name: WORKFLOW_NAMES[workflowId] });
          }
        }

        // Save execution record
        await supabaseAdmin.from('n8n_executions').insert({
          execution_id: execId,
          workflow_id: workflowId,
          workflow_name: WORKFLOW_NAMES[workflowId] || workflowId,
          status: exec.status,
          started_at: exec.startedAt,
          finished_at: exec.stoppedAt,
          duration_ms: duration,
          error_message: exec.status === 'error' ? (exec.data?.resultData?.error?.message || null) : null,
          node_error: exec.data?.resultData?.lastNodeExecuted || null,
          alert_id: alertId,
        });
      }

      // Update workflow summary stats
      const lastExec = executions[0];
      if (lastExec) {
        const { count: totalErrors } = await supabaseAdmin
          .from('n8n_executions')
          .select('*', { count: 'exact', head: true })
          .eq('workflow_id', workflowId)
          .eq('status', 'error');

        const { count: totalExecs } = await supabaseAdmin
          .from('n8n_executions')
          .select('*', { count: 'exact', head: true })
          .eq('workflow_id', workflowId);

        await supabaseAdmin.from('n8n_workflows').update({
          last_execution_at: lastExec.startedAt,
          last_execution_status: lastExec.status,
          total_executions: totalExecs || 0,
          total_errors: totalErrors || 0,
          updated_at: new Date().toISOString(),
        }).eq('id', workflowId);
      }

      if (newErrors > 0) {
        logger.warn({ workflowId, newErrors }, 'New n8n execution errors detected');
      }

    } catch (err) {
      logger.error({ workflowId, err }, 'Failed to sync n8n workflow executions');
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

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
    res.json({ status: 'ok', timestamp: new Date().toISOString(), monitoredWorkflows: MONITORED_WORKFLOWS });
  });

  // POST /api/alerts/lead-incompleto
  app.post('/api/alerts/lead-incompleto', webhookAuth, async (req, res) => {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(503).json({ error: 'Database service unavailable' });

    try {
      const data = LeadIncompletoSchema.parse(req.body);
      const alertData = {
        tipo: 'lead_incompleto',
        severity: 'warning',
        workflow_id: data.workflow_id,
        workflow_name: data.workflow_name,
        execution_id: data.execution_id,
        lead_email: data.lead_email,
        lead_nome: data.lead_nome,
        campos_faltantes: data.campos_faltantes,
        payload_original: data.payload_original,
        status: 'open',
      };

      const { data: inserted, error } = await supabaseAdmin
        .from('alerts')
        .upsert(alertData, { onConflict: 'workflow_id,execution_id,tipo' })
        .select()
        .single();

      if (error) throw error;
      await sendDiscordAlert(inserted);
      res.status(201).json(inserted);
    } catch (error: any) {
      logger.error(error);
      res.status(400).json({ error: error.message || 'Validation error' });
    }
  });

  // POST /api/alerts/erro-tecnico
  app.post('/api/alerts/erro-tecnico', webhookAuth, async (req, res) => {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(503).json({ error: 'Database service unavailable' });

    try {
      const data = ErroTecnicoSchema.parse(req.body);
      const alertData = {
        tipo: 'erro_tecnico',
        severity: 'error',
        workflow_id: data.workflow_id,
        workflow_name: data.workflow_name,
        execution_id: data.execution_id,
        node_name: data.node_name,
        error_message: data.error_message,
        payload_original: data.payload_original,
        status: 'open',
      };

      const { data: inserted, error } = await supabaseAdmin
        .from('alerts')
        .upsert(alertData, { onConflict: 'workflow_id,execution_id,tipo' })
        .select()
        .single();

      if (error) throw error;
      await sendDiscordAlert(inserted);
      res.status(201).json(inserted);
    } catch (error: any) {
      logger.error(error);
      res.status(400).json({ error: error.message || 'Validation error' });
    }
  });

  // GET /api/alerts
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
    const toIdx = fromIdx + Number(limit) - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(fromIdx, toIdx);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data, count, page: Number(page), limit: Number(limit) });
  });

  // PATCH /api/alerts/:id/resolve
  app.patch('/api/alerts/:id/resolve', async (req, res) => {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(503).json({ error: 'Database service unavailable' });

    const { id } = req.params;
    const { resolved_by } = req.body;

    const { data, error } = await supabaseAdmin
      .from('alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: resolved_by || 'system'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // GET /api/dashboard/stats
  app.get('/api/dashboard/stats', async (req, res) => {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(503).json({ error: 'Database service unavailable' });

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

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

  // GET /api/n8n/workflows — status de cada workflow monitorado
  app.get('/api/n8n/workflows', async (req, res) => {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(503).json({ error: 'Database service unavailable' });

    const { data, error } = await supabaseAdmin
      .from('n8n_workflows')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // GET /api/n8n/workflow-stats — estatísticas completas por workflow
  app.get('/api/n8n/workflow-stats', async (req, res) => {
    const db = getSupabaseAdmin();
    if (!db) return res.status(503).json({ error: 'Database service unavailable' });

    const since7d  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: workflows } = await db.from('n8n_workflows').select('*');
    if (!workflows?.length) return res.json([]);

    const stats = await Promise.all(workflows.map(async (wf: any) => {
      const [all, last10, daily, recent] = await Promise.all([
        db.from('n8n_executions').select('status, duration_ms, started_at')
          .eq('workflow_id', wf.id)
          .gte('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('started_at', { ascending: false }),
        db.from('n8n_executions').select('status, started_at, duration_ms, node_error, error_message, execution_id')
          .eq('workflow_id', wf.id).order('started_at', { ascending: false }).limit(10),
        db.from('n8n_executions').select('status, started_at')
          .eq('workflow_id', wf.id).gte('started_at', since7d),
        db.from('n8n_executions').select('execution_id, status, started_at, finished_at, duration_ms, node_error, error_message')
          .eq('workflow_id', wf.id).order('started_at', { ascending: false }).limit(5),
      ]);

      const executions = all.data || [];
      const total = executions.length;
      const successes = executions.filter((e: any) => e.status === 'success').length;
      const errors = executions.filter((e: any) => e.status === 'error' || e.status === 'crashed').length;
      const successRate = total > 0 ? Math.round((successes / total) * 100) : 0;
      const durations = executions.filter((e: any) => e.duration_ms && e.status === 'success').map((e: any) => e.duration_ms as number);
      const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length) : null;

      const exec24h = (daily.data || []).filter((e: any) => e.started_at >= since24h);

      const sparkMap = new Map<string, { total: number; errors: number }>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        sparkMap.set(d.toISOString().split('T')[0], { total: 0, errors: 0 });
      }
      (daily.data || []).forEach((e: any) => {
        const day = e.started_at?.split('T')[0];
        if (day && sparkMap.has(day)) {
          sparkMap.get(day)!.total++;
          if (e.status === 'error' || e.status === 'crashed') sparkMap.get(day)!.errors++;
        }
      });

      return {
        ...wf, success_rate: successRate, avg_duration_ms: avgDuration,
        executions_24h: exec24h.length,
        errors_24h: exec24h.filter((e: any) => e.status === 'error' || e.status === 'crashed').length,
        last_10_statuses: (last10.data || []).map((e: any) => e.status),
        sparkline: Array.from(sparkMap.entries()).map(([date, v]) => ({ date, ...v })),
        recent_executions: recent.data || [],
      };
    }));

    res.json(stats);
  });

  // GET /api/n8n/executions — histórico de execuções
  app.get('/api/n8n/executions', async (req, res) => {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(503).json({ error: 'Database service unavailable' });

    const { workflowId, status, limit = '50' } = req.query;
    let query = supabaseAdmin
      .from('n8n_executions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(Number(limit));

    if (workflowId) query = query.eq('workflow_id', workflowId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // Extrai os campos canônicos do lead a partir do payload bruto (fontes têm nomes diferentes)
  const extractLeadFields = (payload: Record<string, any>) => ({
    lead_nome:     payload.nome || payload.lead_nome || payload.indicado_nome || null,
    lead_email:    payload.email || payload.lead_email || payload.indicado_email || null,
    lead_telefone: payload.telefone || payload.lead_telefone || payload.indicado_telefone || null,
    lead_empresa:  payload.empresa || payload.lead_empresa || payload.indicado_empresa || null,
    produto:       payload.produto || payload.produto_tag || null,
  });

  // POST /api/validate/lead — valida campos obrigatórios de um lead
  // Chamado pelo n8n no início de cada workflow com o payload completo do lead
  app.post('/api/validate/lead', webhookAuth, async (req, res) => {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(503).json({ error: 'Database service unavailable' });

    const { lead_source, workflow_id, workflow_name, execution_id, payload } = req.body;

    if (!lead_source || !payload) {
      return res.status(400).json({ error: 'lead_source e payload são obrigatórios' });
    }

    const missingFields = validateLeadFields(payload, lead_source as LeadSource);
    const wfId = workflow_id || lead_source;
    const wfName = workflow_name || LEAD_SOURCE_LABELS[lead_source as LeadSource] || lead_source;
    const leadFields = extractLeadFields(payload);

    if (missingFields.length === 0) {
      // Persistir lead completo no monitor
      try {
        await supabaseAdmin.from('leads').insert({
          workflow_id: wfId,
          workflow_name: wfName,
          execution_id: execution_id || null,
          lead_source,
          status: 'completo',
          ...leadFields,
          payload_original: payload,
        });
      } catch (err) {
        logger.error({ err }, 'Falha ao persistir lead completo');
      }
      return res.json({ valid: true, missing: [], message: 'Lead completo ✅' });
    }

    try {
      const alertData = {
        tipo: 'lead_incompleto',
        severity: missingFields.length >= 3 ? 'error' : 'warning',
        workflow_id: wfId,
        workflow_name: wfName,
        execution_id: execution_id || null,
        lead_email: leadFields.lead_email,
        lead_nome: leadFields.lead_nome,
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

      // Persistir lead incompleto no monitor (linkado ao alerta)
      try {
        await supabaseAdmin.from('leads').insert({
          workflow_id: wfId,
          workflow_name: wfName,
          execution_id: execution_id || null,
          lead_source,
          status: 'incompleto',
          ...leadFields,
          campos_faltantes: missingFields,
          payload_original: payload,
          alert_id: inserted.id,
        });
      } catch (err) {
        logger.error({ err }, 'Falha ao persistir lead incompleto');
      }

      await sendDiscordAlert(inserted);
      logger.warn({ lead_source, missingFields }, 'Lead incompleto detectado');

      return res.status(201).json({
        valid: false,
        missing: missingFields,
        alert_id: inserted.id,
        message: `Lead incompleto — ${missingFields.length} campo(s) faltando: ${missingFields.join(', ')}`,
      });
    } catch (err: any) {
      logger.error(err);
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/leads — listagem de leads recebidos (completos e incompletos)
  app.get('/api/leads', async (req, res) => {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(503).json({ error: 'Database service unavailable' });

    const { status, lead_source, workflow_id, search, from, to, page = '1', limit = '50' } = req.query;
    let query = supabaseAdmin.from('leads').select('*', { count: 'exact' });

    if (status)      query = query.eq('status', status);
    if (lead_source) query = query.eq('lead_source', lead_source);
    if (workflow_id) query = query.eq('workflow_id', workflow_id);
    if (from)        query = query.gte('created_at', from);
    if (to)          query = query.lte('created_at', to);
    if (search) {
      const s = String(search).replace(/[%_]/g, '');
      query = query.or(`lead_email.ilike.%${s}%,lead_nome.ilike.%${s}%,lead_empresa.ilike.%${s}%`);
    }

    const fromIdx = (Number(page) - 1) * Number(limit);
    const toIdx = fromIdx + Number(limit) - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(fromIdx, toIdx);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data, count, page: Number(page), limit: Number(limit) });
  });

  // GET /api/leads/stats — contadores agregados
  app.get('/api/leads/stats', async (req, res) => {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(503).json({ error: 'Database service unavailable' });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7d  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString();

    try {
      const [completos24h, incompletos24h, completosToday, incompletosToday, completos7d, incompletos7d] = await Promise.all([
        supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'completo').gte('created_at', since24h),
        supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'incompleto').gte('created_at', since24h),
        supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'completo').gte('created_at', today.toISOString()),
        supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'incompleto').gte('created_at', today.toISOString()),
        supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'completo').gte('created_at', since7d),
        supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'incompleto').gte('created_at', since7d),
      ]);

      const total24h = (completos24h.count || 0) + (incompletos24h.count || 0);
      const totalToday = (completosToday.count || 0) + (incompletosToday.count || 0);
      const total7d = (completos7d.count || 0) + (incompletos7d.count || 0);

      res.json({
        completos_24h: completos24h.count || 0,
        incompletos_24h: incompletos24h.count || 0,
        total_24h: total24h,
        completos_today: completosToday.count || 0,
        incompletos_today: incompletosToday.count || 0,
        total_today: totalToday,
        completos_7d: completos7d.count || 0,
        incompletos_7d: incompletos7d.count || 0,
        total_7d: total7d,
        completion_rate_24h:  total24h  > 0 ? Math.round((completos24h.count  || 0) / total24h  * 100) : 0,
        completion_rate_today: totalToday > 0 ? Math.round((completosToday.count || 0) / totalToday * 100) : 0,
        completion_rate_7d:   total7d   > 0 ? Math.round((completos7d.count   || 0) / total7d   * 100) : 0,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/n8n/sync — disparo manual de sync
  app.post('/api/n8n/sync', async (req, res) => {
    try {
      await syncN8nExecutions();
      res.json({ ok: true, message: 'Sync concluído', timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Polling automático a cada 60 segundos
  setInterval(syncN8nExecutions, 60_000);
  syncN8nExecutions().then(() => logger.info('n8n initial sync complete'));

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
