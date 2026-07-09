---
title: Arquitetura
tags: [visao-geral]
---

# Arquitetura

Monorepo **full-stack**: o mesmo repositório contém o frontend React e o backend Express. Em produção, o build do Vite gera os estáticos que o Express serve.

## Componentes

| Camada | Tecnologia | Nota |
|--------|-----------|------|
| Frontend | React 19 + Vite + Tailwind 4 | [[Frontend]] |
| Backend | Express (`server.ts`) | [[Backend-Server]] |
| Banco / Realtime | Supabase | [[Supabase]] |
| Notificações | Discord Webhook | [[Discord]] |
| Origem dos eventos | n8n | [[n8n]] |

## Fluxo de dados

```
[[n8n]]  ──POST──▶  [[API-Endpoints]]  ──▶  [[Supabase]] (grava)
                          │
                          └──▶  [[Discord]] (alerta #alertas-fluxo)

[[Supabase]] Realtime  ──▶  [[Frontend]] (atualiza dashboard ao vivo)
```

## Segurança
- Autenticação dos webhooks via header `X-Webhook-Secret`. Ver [[Variaveis-de-Ambiente]].

## Diretórios principais
- `src/` → frontend ([[Frontend]], [[Componentes]])
- `src/lib/` → lógica compartilhada (schemas, supabase, journey, dedupe…)
- `server.ts` → [[Backend-Server]]
- `api/` → handlers serverless / cron ([[API-Endpoints]])
