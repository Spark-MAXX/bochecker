---
title: Discord
tags: [integracao]
---

# Discord — Notificações

Alertas são disparados automaticamente para o canal `#alertas-fluxo` via **Webhook**.

- Implementação: `src/lib/discord.ts`
- Disparado pela [[API-Endpoints]] quando chega um lead incompleto ou erro técnico
- Config: `DISCORD_WEBHOOK_ALERTAS` em [[Variaveis-de-Ambiente]]

## Relacionado
- [[API-Endpoints]] · [[Backend-Server]]
