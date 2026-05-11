# Spark Maxx Alerts Pipeline Dashboard

Painel de monitoramento em tempo real para o pipeline de leads da Spark Maxx.

## Funcionalidades
- **Endpoints de Alerta:** Recebe dados do n8n para leads incompletos e erros técnicos.
- **Notificação Discord:** Disparo automático para o canal `#alertas-fluxo` via Webhooks.
- **Dashboard Real-time:** Interface moderna com estatísticas, gráficos e gerenciamento de status via Supabase Realtime.
- **Segurança:** Autenticação via header `X-Webhook-Secret`.

## Configuração Local

1. **Variáveis de Ambiente:**
   Crie um arquivo `.env` baseado no `.env.example`:
   ```env
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   DISCORD_WEBHOOK_ALERTAS=...
   WEBHOOK_SECRET=sua-chave-secreta
   N8N_BASE_URL=https://growthsparkmaxx.app.n8n.cloud
   ```

2. **Banco de Dados (Supabase):**
   Execute o conteúdo de `supabase_migration.sql` no SQL Editor do seu projeto Supabase.

3. **Instalação e Execução:**
   ```bash
   npm install
   npm run dev
   ```

## Configuração n8n

### 1. Monitoramento de Leads Incompleto
No seu workflow n8n, após a validação de campos, adicione um node **HTTP Request**:
- **Method:** POST
- **URL:** `https://seu-app.com/api/alerts/lead-incompleto`
- **Headers:**
  - `X-Webhook-Secret`: `sua-chave-secreta`
- **Body:**
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

### 2. Monitoramento de Erros Técnicos
Configure o **Error Workflow** do n8n para disparar um POST:
- **URL:** `https://seu-app.com/api/alerts/erro-tecnico`
- **Headers:**
  - `X-Webhook-Secret`: `sua-chave-secreta`
- **Body:**
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

## Deploy
- **Backend/Frontend:** Este projeto é um monorepo full-stack. O build gera os estáticos que o Express serve em produção.
- **Plataformas Sugeridas:** Vercel (Frontend) e Railway/Render (Backend) ou Cloud Run.
