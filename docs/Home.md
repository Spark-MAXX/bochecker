---
title: Spark Maxx — Documentação
tags: [moc, indice]
---

# 🏠 Spark Maxx Alerts Pipeline Dashboard

Painel de monitoramento em tempo real para o pipeline de leads da Spark Maxx.
Esta é a nota-índice (MOC = *Map of Content*). Comece por aqui e navegue pelos links.

## 🗺️ Mapa da documentação

### Visão geral
- [[Arquitetura]] — como as peças se encaixam (full-stack monorepo)
- [[Deploy]] — build e publicação

### Frontend
- [[Frontend]] — React + Vite + Tailwind
- [[Componentes]] — telas e painéis do dashboard
- [[Funil]] — lógica de conversão por execução do n8n

### Backend
- [[Backend-Server]] — Express (`server.ts`)
- [[API-Endpoints]] — rotas de alerta e sync
- [[Supabase]] — banco + Realtime
- [[Discord]] — notificações via Webhook

### Integrações externas
- [[n8n]] — origem dos eventos de lead
- [[Manychat-Bot-Qualificacao]] — bot de qualificação no WhatsApp → n8n → SDR
- [[Manychat-WhatsApp-Regras-e-API]] — janela de 24h, templates (Marketing/Utility), API oficial e playbook de reengajamento
- [[Lost-Sprout-2026-Diagnostico-e-Retomada]] — 193 lost 2026: diagnóstico + plano de retomada (3 rotas: No-show, Ghosting, Adiou)
- [[Bot-Recuperacao-Fase1-Noshow]] — spec de build da Fase 1 (No-show): templates, import n8n, fluxo ManyChat
- [[Bot-Recuperacao-Fase2-Ghosting]] — spec de build da Fase 2 (Ghosting): ingest n8n ativo, webhook Pipedrive, fila `ghosting_disparos`; falta fluxo ManyChat + templates Meta
- [[Bot-Recuperacao-Fase3-Adiou]] — spec de build da Fase 3 (Adiou): ingest n8n ativo, campo "Data prometida de retomada" (12638) + webhook Pipedrive, fila `adiou_disparos`; falta fluxo ManyChat + templates Meta
- [[Workflow-Leads-LP-Framer]] — leads dos formulários (LPs + site novo) → RD Station
- [[Form-Maxxnews-Evento-Varejo]] — form de pré-inscrição (embed Beehiiv) → n8n → conversão RD `Maxxnews - Evento Varejo`
- [[Workflow-RD-Pipedrive]] — oportunidade do RD → Pipedrive
- [[Alertas-Pipedrive-Teams]] — 4 alertas de SLA de Pré-Vendas (Novo MQL, MQL +48h, SLA 1º contato, cadência +8d) via Automação nativa Pipedrive → Teams
- [[CustomerX]] — plataforma de Customer Success (pós-venda): API, modelo de dados, webhooks
- [[CustomerX-API-Referencia]] — as 268 rotas da API do CustomerX
- [[Workflow-CustomerX-RD-Tags]] — 🟡 rascunho: clientes do CustomerX → tag no RD Station
- [[QA-Formularios-Leads-2026-07]] — teste E2E dos forms, 2 forms de contato não entregam + fix do `conversion_identifier` (LP virava "Site - Contato")
- [[Monitor-Formularios]] — 🩺 monitor sintético: submete os 9 forms a cada 4h e prova que o lead chegou no n8n (Playwright + GitHub Actions → alerta `form_quebrado`)
- [[Variaveis-de-Ambiente]] — configuração (`.env`)

## 🔗 Fluxo em uma frase
`[[n8n]]` dispara eventos → `[[API-Endpoints]]` valida e grava no `[[Supabase]]` → dispara `[[Discord]]` → `[[Frontend]]` mostra em tempo real via Realtime.

## ✅ Como manter isso
- Escreva em Markdown normal; use `[[nome-da-nota]]` para linkar.
- Toda nota nova entra no grafo automaticamente.
- Veja o grafo em **Graph View** (ícone de grafo na barra lateral).
