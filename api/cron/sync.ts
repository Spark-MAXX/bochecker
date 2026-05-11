import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

const N8N_API_KEY  = process.env.N8N_API_KEY;
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://growthsparkmaxx.app.n8n.cloud';
const MONITORED    = (process.env.N8N_MONITORED_WORKFLOWS || '').split(',').filter(Boolean);
const DISCORD_URL  = process.env.DISCORD_WEBHOOK_ALERTAS;

const WORKFLOW_NAMES: Record<string, string> = {
  'VVdWQERBqJsPxeDo': 'Passagem Leads - RD >> Pipedrive',
  'iCSEmoah1GxnsprH': 'Programa de indicação interna',
  'J2rdIrv7C7gILmpk': 'Leads LP - Framer',
};

function getDB() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function notifyDiscord(alert: any) {
  if (!DISCORD_URL) return;
  const embed = {
    title: `🔴 Erro no Fluxo — ${alert.workflow_name}`,
    description: `❌ **Node:** ${alert.node_name || 'desconhecido'}\n💬 ${alert.error_message}`,
    color: 15548997, timestamp: new Date().toISOString(),
    footer: { text: 'Spark Maxx Alerts Pipeline' },
  };
  try { await fetch(DISCORD_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [embed] }) }); }
  catch (e) { console.error('Discord notify failed', e); }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Vercel Cron auth header
  const authHeader = (req.headers['authorization'] as string) || '';
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.writeHead(401); res.end('Unauthorized'); return;
  }

  const db = getDB();
  if (!db || !N8N_API_KEY || !MONITORED.length) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, skipped: true })); return;
  }

  let synced = 0, errors = 0;

  for (const wfId of MONITORED) {
    try {
      const r = await fetch(`${N8N_BASE_URL}/api/v1/executions?workflowId=${wfId}&limit=25`, {
        headers: { 'X-N8N-API-KEY': N8N_API_KEY },
      });
      const json = await r.json();

      for (const exec of json.data || []) {
        const { data: existing } = await db.from('n8n_executions').select('id').eq('execution_id', String(exec.id)).maybeSingle();
        if (existing) continue;

        let alertId = null;
        if (exec.status === 'error' || exec.status === 'crashed') {
          const errorMsg = exec.data?.resultData?.error?.message || 'Execução falhou';
          const nodeName = exec.data?.resultData?.lastNodeExecuted || null;
          const { data: al } = await db.from('alerts').upsert({
            tipo: 'erro_tecnico', severity: 'error',
            workflow_id: wfId, workflow_name: WORKFLOW_NAMES[wfId] || wfId,
            execution_id: String(exec.id), node_name: nodeName,
            error_message: errorMsg, status: 'open',
            diagnostico: { tipo: 'erro_tecnico', motivo: errorMsg, node_falhou: nodeName, detalhe_original: errorMsg },
          }, { onConflict: 'workflow_id,execution_id,tipo' }).select('id').single();
          if (al) { alertId = al.id; await notifyDiscord({ ...al, workflow_name: WORKFLOW_NAMES[wfId], node_name: nodeName, error_message: errorMsg }); errors++; }
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
      if (last) {
        await db.from('n8n_workflows').update({
          last_execution_at: last.startedAt, last_execution_status: last.status,
          updated_at: new Date().toISOString(),
        }).eq('id', wfId);
      }
    } catch (e) { console.error(`Cron sync error ${wfId}:`, e); }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, synced, errors, ts: new Date().toISOString() }));
}
