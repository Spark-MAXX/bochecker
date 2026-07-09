---
title: Backend / Server
tags: [backend]
---

# Backend — `server.ts`

Servidor **Express** que:
1. Expõe as rotas de alerta e sync → ver [[API-Endpoints]]
2. Em produção, serve os estáticos do build do Vite ([[Frontend]])
3. Valida webhooks com `X-Webhook-Secret` ([[Variaveis-de-Ambiente]])
4. Grava no [[Supabase]] e dispara o [[Discord]]

## Rodar local
```bash
npm install
npm run dev   # tsx server.ts
```

## Relacionado
- [[API-Endpoints]] · [[Supabase]] · [[Discord]] · [[Deploy]]
