---
title: Frontend
tags: [frontend]
---

# Frontend

Stack: **React 19 + Vite 6 + Tailwind CSS 4**. Gráficos com Recharts, ícones Lucide, animações Motion.

- Entrada: `src/main.tsx` → `src/App.tsx`
- Estilos: `src/index.css` (Tailwind)
- Cliente Supabase no browser: `src/lib/supabase.ts` (ver [[Supabase]])

## Estrutura
- Componentes de tela em `src/components/` → ver [[Componentes]]
- Lógica de negócio em `src/lib/`:
  - `journey.ts` / `leads-unified.ts` → dados do [[Funil]]
  - `dedupe.ts` → deduplicação de leads
  - `schemas.ts` → validação com Zod
  - `validation-config.ts` → regras de campos obrigatórios

## Dados em tempo real
O dashboard escuta o **Supabase Realtime** — ver [[Supabase]] — então novos alertas aparecem sem refresh.

## Relacionado
- [[Componentes]] · [[Funil]] · [[Arquitetura]]
