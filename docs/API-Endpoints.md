---
title: API / Endpoints
tags: [backend, api]
---

# API / Endpoints

Rotas servidas pelo [[Backend-Server]]. Todas as rotas de alerta exigem o header `X-Webhook-Secret` ([[Variaveis-de-Ambiente]]).

## Alertas (origem: [[n8n]])

### `POST /api/alerts/lead-incompleto`
Lead que passou pela validação com campos faltando.
```json
{
  "workflow_id": "ID_DO_WORKFLOW",
  "workflow_name": "Nome do Fluxo",
  "execution_id": "={{ $execution.id }}",
  "lead_email": "={{ $json.email }}",
  "lead_nome": "={{ $json.nome }}",
  "campos_faltantes": ["telefone", "cargo"],
  "payload_original": "={{ $json }}"
}
```

### `POST /api/alerts/erro-tecnico`
Disparado pelo **Error Workflow** do n8n.
```json
{
  "workflow_id": "={{ $workflow.id }}",
  "workflow_name": "={{ $workflow.name }}",
  "execution_id": "={{ $execution.id }}",
  "node_name": "={{ $node.name }}",
  "error_message": "={{ $error.message }}",
  "payload_original": "={{ $json }}"
}
```

## Sync
- `api/cron/sync.ts` — job de sincronização (cron). Documente aqui a periodicidade e a origem dos dados quando confirmar.

## Relacionado
- [[Backend-Server]] · [[Supabase]] · [[Discord]] · [[n8n]]
