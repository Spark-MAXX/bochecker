---
title: Funil
tags: [frontend, dominio]
---

# Funil (conversão)

Conversão calculada **por execução do n8n** (`execution_id`). Origem dos leads: Framer / Passagem.

## Lógica (em `src/lib/`)
- `journey.ts` — jornada / etapas do lead
- `leads-unified.ts` — unificação das fontes de lead
- `dedupe.ts` — deduplicação

## Regras conhecidas (do histórico)
- Contagem **monotônica** (origem Framer) + coluna de etapa atual
- Filtro de data **único** (De → Até) linkado ao funil e à lista — ver `Filters.tsx` em [[Componentes]]
- [[Overview]] alinhada ao funil por execução do n8n

> Nota: `[[Overview]]` ainda não tem nota própria — clique no link para criá-la quando quiser detalhar a tela.

## Relacionado
- [[Componentes]] · [[n8n]] · [[Frontend]]
