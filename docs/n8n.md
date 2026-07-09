---
title: n8n
tags: [integracao]
---

# n8n

Plataforma de automação que é a **origem dos eventos** de lead. Base: `https://growthsparkmaxx.app.n8n.cloud` (`N8N_BASE_URL`).

## Como integra
Nodes **HTTP Request** no workflow disparam POST para a [[API-Endpoints]]:
1. Após validação de campos → `/api/alerts/lead-incompleto`
2. No **Error Workflow** → `/api/alerts/erro-tecnico`

Cada evento carrega o `execution_id`, que é a chave usada no [[Funil]] para contar conversão por execução.

## Relacionado
- [[API-Endpoints]] · [[Funil]] · [[Arquitetura]]
