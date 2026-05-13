# Spark Maxx Control Center

Centro de monitoramento unificado para a operação Spark Maxx — analítico de **RD Station Marketing** + monitoramento do **pipeline n8n** que move leads para o Pipedrive.

> **Maintainer:** Caio (caiogss1909@gmail.com)
> **Stack:** React 19 + Vite + Express + Supabase + Recharts + Tailwind v4

---

## 🎯 O que faz

O dashboard tem 5 abas:

| Aba | O que mostra | Origem |
|---|---|---|
| **Visão Geral** | KPIs agregados (sent, delivered, open/click/bounce rate), funil de engajamento, evolução temporal, top workflows, piores emails | `rd_workflow_metrics` + `rd_email_metrics` |
| **Fluxos RD** | Tabela de todos os workflows RD com métricas do último snapshot, sparkline de tendência e histórico de 30d | `rd_workflows` + `rd_workflow_metrics` |
| **Emails RD** | Tabela de todos os emails com métricas (open, click, ctor, bounce), busca e ordenação | `rd_emails` + `rd_email_metrics` |
| **Sync Log** | Histórico de execução dos cron jobs n8n (W1/W2) que coletam dados da RD | `rd_sync_log` |
| **Pipeline n8n** | Monitor dos workflows operacionais (RD→Pipedrive, Indicação, LP-Framer) com alertas de lead incompleto e erros técnicos | `alerts` + `n8n_executions` + `n8n_workflows` |

---

## 🏗️ Arquitetura

```
RD Station ──► n8n (W1 cron 06:00, W2 cron 06:15) ──► Supabase (rd_*)
                                                            │
n8n workflows ──► alerts API ──► Supabase (alerts)          │
                                                            ▼
                          Express (server.ts | api/index.ts)
                                       │
                                       ▼
                          React Dashboard (5 abas)
```

- **Dev:** [server.ts](server.ts) com Vite middleware + polling n8n a cada 60s
- **Prod (Vercel):** [api/index.ts](api/index.ts) como serverless + [api/cron/sync.ts](api/cron/sync.ts) como Vercel Cron
- **Lógica compartilhada:** [src/lib/rd-queries.ts](src/lib/rd-queries.ts) é importada pelos dois backends para evitar drift

---

## 🚀 Setup local

### 1. Variáveis de ambiente (`.env`)

```env
# Supabase
VITE_SUPABASE_URL=https://rximtawdguljuwiektgx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Discord (alertas de pipeline)
DISCORD_WEBHOOK_ALERTAS=https://discord.com/api/webhooks/...

# Segurança dos webhooks que recebem dados do n8n
WEBHOOK_SECRET=alguma-chave-secreta

# n8n monitoring (pull de execuções)
N8N_API_KEY=...
N8N_BASE_URL=https://growthsparkmaxx.app.n8n.cloud
N8N_MONITORED_WORKFLOWS=VVdWQERBqJsPxeDo,iCSEmoah1GxnsprH,J2rdIrv7C7gILmpk

# Vercel Cron auth (somente prod)
CRON_SECRET=...
```

### 2. Banco (Supabase SQL Editor)

Rode na ordem:

1. [supabase_migration.sql](supabase_migration.sql) — tabela `alerts` + `n8n_workflows` + `n8n_executions`
2. [supabase_migration_lead_completo.sql](supabase_migration_lead_completo.sql) — adiciona o tipo `lead_completo` ao constraint
3. [supabase_migration_rd.sql](supabase_migration_rd.sql) — tabelas `rd_workflows`, `rd_workflow_metrics`, `rd_emails`, `rd_email_metrics`, `rd_sync_log`

### 3. Executar

```bash
npm install
npm run dev      # http://localhost:3000
```

---

## 📡 Endpoints da API

### Pipeline (n8n alerts)
- `POST /api/validate/lead` — n8n chama no início do workflow. Diagnostica campos faltantes do payload e cria `lead_incompleto` (ou `lead_completo` se OK)
- `POST /api/alerts/lead-incompleto` — webhook explícito
- `POST /api/alerts/erro-tecnico` — webhook de erro do n8n
- `GET  /api/alerts` — lista com filtros `?status&tipo&from&to&page&limit`
- `PATCH /api/alerts/:id/resolve` — marca alerta como resolvido
- `GET  /api/dashboard/stats` — KPIs do pipeline
- `GET  /api/n8n/workflow-stats` — stats agregadas por workflow (success_rate, sparkline, etc.)
- `POST /api/n8n/sync` — força um sync das execuções n8n agora

### RD Station (analítico)
- `GET /api/rd/overview` — KPIs do snapshot mais recente + delta vs 7d atrás
- `GET /api/rd/timeseries?days=30` — série diária agregada (sent/delivered/open/click/bounce)
- `GET /api/rd/funnel` — funil enviados→entregues→abertos→cliques (com uniques)
- `GET /api/rd/workflows[?status=enabled]` — workflows + último metric + tendência 7d
- `GET /api/rd/workflows/top?limit=10` — top por volume enviado
- `GET /api/rd/workflows/:id/history?days=30` — todos os snapshots de um workflow
- `GET /api/rd/emails?limit=200&status=&search=` — emails + último metric
- `GET /api/rd/emails/worst?minSent=50&limit=10` — emails com pior open_rate (≥minSent)
- `GET /api/rd/sync-log?source=workflows|emails|assets&limit=50` — log dos crons

Autenticação: endpoints `POST` aceitam header `X-Webhook-Secret`. GETs são livres (assumindo deploy interno).

---

## ⚙️ Workflows n8n associados

| Workflow | ID | Cron | O que faz |
|---|---|---|---|
| **W1 — Coleta Workflows RD** | `pAaL4WFxiNOHTO3p` | 06:00 BRT | Pull `/platform/workflows` + `/platform/analytics/workflow_emails` → popula `rd_workflows` + `rd_workflow_metrics` |
| **W2 — Coleta Emails RD** | `KywF3gIEflkTgP2W` | 06:15 BRT | Pull `/platform/analytics/emails` → popula `rd_emails` + `rd_email_metrics` |
| Passagem Leads RD → Pipedrive | `VVdWQERBqJsPxeDo` | trigger por lead | monitorado pelo Pipeline tab |
| Programa de Indicação Interna | `iCSEmoah1GxnsprH` | trigger por form | monitorado pelo Pipeline tab |
| Leads LP - Framer | `J2rdIrv7C7gILmpk` | trigger por form | monitorado pelo Pipeline tab |

---

## 🔌 Integração n8n (alertas)

### Validar lead no início do workflow

POST `/api/validate/lead` com `lead_source` ∈ `lp_sprout | lp_community | site_spark | indicacao | rd_pipe`:

```json
{
  "lead_source": "rd_pipe",
  "workflow_id": "{{ $workflow.id }}",
  "workflow_name": "{{ $workflow.name }}",
  "execution_id": "{{ $execution.id }}",
  "payload": "{{ $json._lead }}"
}
```

Resposta:
- `200 valid:true` → lead OK, alerta `lead_completo` criado (resolved)
- `201 valid:false` → cria `lead_incompleto` com `diagnostico.campos[]` apontando motivo por campo (`não veio no payload` / `veio vazio` / `veio como nulo` / etc.) e dispara Discord

### Erro técnico

```json
POST /api/alerts/erro-tecnico
{
  "workflow_id": "{{ $workflow.id }}",
  "workflow_name": "{{ $workflow.name }}",
  "execution_id": "{{ $execution.id }}",
  "node_name": "{{ $node.name }}",
  "error_message": "{{ $error.message }}",
  "payload_original": "{{ $json }}"
}
```

---

## 🚀 Deploy (Vercel)

- Frontend: `vite build` → `dist/` servido como estático
- API: `api/index.ts` cobre todas as rotas via rewrite em [vercel.json](vercel.json)
- Cron: `api/cron/sync.ts` configurado como Vercel Cron (autenticado por `Bearer $CRON_SECRET`)

---

## 📁 Estrutura

```
src/
├── App.tsx                    # tab navigation + roteamento
├── components/
│   ├── KpiCard.tsx            # primitiva de KPI com delta
│   ├── TabNav.tsx             # tabs animadas
│   ├── RDOverview.tsx         # aba 1 — KPIs + funnel + timeseries + top/worst
│   ├── RDFunnel.tsx           # funil sent→delivered→opened→clicked
│   ├── RDTimeSeries.tsx       # line/area chart de evolução
│   ├── RDWorkflowsTable.tsx   # aba 2 — workflows RD com histórico expandível
│   ├── RDEmailsTable.tsx      # aba 3 — emails RD
│   ├── RDSyncLog.tsx          # aba 4 — log dos crons
│   ├── PipelineView.tsx       # aba 5 — n8n alerts (antiga raiz do App)
│   ├── AlertsTable.tsx        # tabela de alerts com diagnóstico
│   ├── WorkflowsPanel.tsx     # workflows n8n monitorados
│   ├── StatsHeader.tsx        # KPIs do pipeline
│   ├── Charts.tsx             # gráficos do pipeline
│   └── Filters.tsx
└── lib/
    ├── rd-schemas.ts          # tipos + helpers compartilhados
    ├── rd-queries.ts          # queries Supabase (compartilhado server/api)
    ├── schemas.ts             # zod do pipeline n8n
    ├── validation-config.ts   # campos obrigatórios por lead_source
    ├── supabase.ts
    └── discord.ts
```
