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
- [[Variaveis-de-Ambiente]] — configuração (`.env`)

## 🔗 Fluxo em uma frase
`[[n8n]]` dispara eventos → `[[API-Endpoints]]` valida e grava no `[[Supabase]]` → dispara `[[Discord]]` → `[[Frontend]]` mostra em tempo real via Realtime.

## ✅ Como manter isso
- Escreva em Markdown normal; use `[[nome-da-nota]]` para linkar.
- Toda nota nova entra no grafo automaticamente.
- Veja o grafo em **Graph View** (ícone de grafo na barra lateral).
