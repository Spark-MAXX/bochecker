import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import pino from 'pino';
import { getSupabaseAdmin } from './src/lib/supabase.ts';
import { sendDiscordAlert } from './src/lib/discord.ts';
import { LeadIncompletoSchema, ErroTecnicoSchema } from './src/lib/schemas.ts';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Middleware: Authentication with X-Webhook-Secret
  const webhookAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const secret = req.headers['x-webhook-secret'];
    const expected = process.env.WEBHOOK_SECRET;
    
    if (expected && secret !== expected) {
      return res.status(401).json({ error: 'Unauthorized: Invalid webhook secret' });
    }
    next();
  };

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

      // Simple counts using Supabase
      const [openAlerts, resolvedToday, totalWeek] = await Promise.all([
        supabaseAdmin.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabaseAdmin.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'resolved').gte('resolved_at', today.toISOString()),
        supabaseAdmin.from('alerts').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      // Chart data: Alertas/dia últimos 30d
      const { data: timelineData } = await supabaseAdmin
        .rpc('get_alerts_timeline', { days_limit: 30 }) || { data: [] };
        
      // For now, if RPC doesn't exist, we'll return an empty or simplified mock if needed, 
      // but I'll assume the user might need to add these or I should compute them.
      // Let's compute some basic stats manually for robustness if RPC fails.
      
      const { data: recentAlerts } = await supabaseAdmin
        .from('alerts')
        .select('tipo, workflow_name, status, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      res.json({
        openCount: openAlerts.count || 0,
        resolvedToday: resolvedToday.count || 0,
        totalWeek: totalWeek.count || 0,
        recent: recentAlerts || []
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
