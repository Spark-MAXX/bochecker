---
title: Variáveis de Ambiente
tags: [config, infra]
---

# Variáveis de Ambiente

Crie um `.env` baseado no `.env.example`.

| Variável | Usada em |
|----------|----------|
| `VITE_SUPABASE_URL` | [[Supabase]] (browser) |
| `VITE_SUPABASE_ANON_KEY` | [[Supabase]] (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | [[Supabase]] (server) |
| `DISCORD_WEBHOOK_ALERTAS` | [[Discord]] |
| `WEBHOOK_SECRET` | Auth dos webhooks ([[API-Endpoints]]) |
| `N8N_BASE_URL` | [[n8n]] |

> ⚠️ Nunca commite o `.env` real. Só o `.env.example`.

## Relacionado
- [[Backend-Server]] · [[Deploy]]
