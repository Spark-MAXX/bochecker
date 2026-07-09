---
title: Deploy
tags: [infra]
---

# Deploy

Monorepo full-stack: o build gera os estáticos que o [[Backend-Server]] (Express) serve em produção.

## Build
```bash
npm run build   # vite build
npm run preview # testar o build
```

## Plataformas
- `vercel.json` presente → deploy na **Vercel**
- Alternativas sugeridas: Railway / Render / Cloud Run para o backend

## Checklist
- [ ] Configurar [[Variaveis-de-Ambiente]] na plataforma
- [ ] Rodar `supabase_migration.sql` no [[Supabase]] de produção
- [ ] Apontar os webhooks do [[n8n]] para a URL de produção

## Relacionado
- [[Arquitetura]] · [[Backend-Server]]
