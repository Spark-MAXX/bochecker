import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
    },
  },
});

export async function sendDiscordAlert(alert: any) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_ALERTAS;
  
  if (!webhookUrl) {
    logger.warn('Discord webhook URL not configured. Skipping notification.');
    return;
  }

  const isError = alert.tipo === 'erro_tecnico';
  const color = isError ? 15548997 : 16776960; // Red or Yellow
  const emoji = isError ? '🔴' : '🟡';
  const title = isError ? 'Erro no Fluxo' : 'Lead Incompleto';
  const n8nBaseUrl = process.env.N8N_BASE_URL || 'https://growthsparkmaxx.app.n8n.cloud';
  const executionLink = alert.execution_id 
    ? `${n8nBaseUrl}/workflow/${alert.workflow_id}/executions/${alert.execution_id}`
    : null;

  let description = '';
  if (isError) {
    description = `❌ **Node:** ${alert.node_name}\n💬 ${alert.error_message}`;
  } else {
    description = `👤 ${alert.lead_nome || 'N/A'} · 📧 ${alert.lead_email || 'N/A'}\n⚠️ **Faltando:** ${alert.campos_faltantes?.join(', ')}`;
  }

  const embed: any = {
    title: `${emoji} ${title} — ${alert.workflow_name}`,
    description,
    color,
    timestamp: new Date().toISOString(),
    fields: [],
    footer: {
      text: 'Spark Maxx Alerts Pipeline',
    }
  };

  if (alert.execution_id) {
    embed.fields.push({ name: 'ID Execution', value: alert.execution_id, inline: true });
  }

  if (executionLink) {
    embed.description += `\n\n🔗 [Ver no n8n](${executionLink})`;
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });

      if (response.ok) {
        return;
      }

      const errorText = await response.text();
      
      if (response.status === 429 && attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000;
        logger.warn({ attempt, delay }, 'Discord rate limited (429). Retrying...');
        await sleep(delay);
        attempt++;
        continue;
      }

      logger.error(
        { status: response.status, body: errorText, alert_id: alert.id, workflow: alert.workflow_name },
        'Failed to send Discord notification'
      );
      break;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000;
        logger.warn({ attempt, delay, error: (error as Error).message }, 'Discord connection error. Retrying...');
        await sleep(delay);
        attempt++;
        continue;
      }
      logger.error({ error, alert_id: alert.id, workflow: alert.workflow_name }, 'Critical failure sending Discord alert');
      break;
    }
  }
}
