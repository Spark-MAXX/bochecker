---
title: Supabase
tags: [backend, infra]
---

# Supabase

Banco de dados + **Realtime** (atualização ao vivo do dashboard).

## Setup
Rode `supabase_migration.sql` no **SQL Editor** do projeto Supabase para criar o schema.

## Clientes
- Browser: `src/lib/supabase.ts` (chave anon) → usado pelo [[Frontend]]
- Server: usa `SUPABASE_SERVICE_ROLE_KEY` no [[Backend-Server]]

## Realtime
O [[Frontend]] assina mudanças nas tabelas de alertas, então novos registros gravados pela [[API-Endpoints]] aparecem sem refresh.

## Configuração
Ver [[Variaveis-de-Ambiente]]: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Relacionado
- [[Arquitetura]] · [[Backend-Server]] · [[Frontend]]
