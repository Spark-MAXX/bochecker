---
title: Componentes
tags: [frontend]
---

# Componentes (`src/components/`)

Telas e painéis do dashboard. Todos consomem dados do [[Supabase]] e usam a lógica de `src/lib/`.

| Componente | Responsabilidade |
|-----------|------------------|
| `Sidebar.tsx` | Navegação entre as telas |
| `Overview.tsx` | Visão geral alinhada ao [[Funil]] por execução do n8n |
| `Filters.tsx` | Filtro de data único (De → Até) linkado ao [[Funil]] e à lista |
| `AlertsTable.tsx` | Tabela de alertas (leads incompletos / erros técnicos) |
| `LeadsMonitor.tsx` | Monitor de leads |
| `JourneyMonitor.tsx` | Jornada do lead (usa `lib/journey.ts`) |
| `WorkflowsPanel.tsx` | Painel de workflows do [[n8n]] |

## Relacionado
- [[Frontend]] · [[Funil]] · [[Arquitetura]]
