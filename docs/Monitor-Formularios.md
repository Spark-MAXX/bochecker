---
title: Monitor Sintético de Formulários
tags: [monitoramento, qa, playwright, n8n, framer, supabase, ci, alertas]
---

# 🩺 Monitor Sintético de Formulários

Submete **de verdade** os 9 formulários do site a cada 4 horas e prova que o lead chegou no n8n. Vive no repo **central-leads** (`monitoring/`), não no bochecker.

> **Por que existe.** O [[QA-Formularios-Leads-2026-07]] descobriu um modo de falha que nenhum alerta do pipeline pega: o Framer responde **201** (guardou a submissão) e **não dispara o webhook** para o [[n8n]]. O lead desaparece sem erro em lugar nenhum — [[Discord]] e [[API-Endpoints]] nunca são acionados, porque o pipeline nunca começa. Foi descoberto submetendo formulário à mão, um por um. Ninguém sabia desde quando estava quebrado.

## Como funciona

```
GitHub Actions (cron)
  └─▶ Playwright preenche e envia o formulário no site publicado
        └─▶ Framer armazena (201) e dispara o webhook
              └─▶ n8n: IF "É ping do monitor?"   ← desvio
                    ├── e-mail @sparkmaxx-qa.com ─▶ monitor_pings (Supabase) · PARA AQUI
                    └── qualquer outro ──────────▶ Processar dados da LP (fluxo original)
        └─▶ o job consulta monitor_pings: ping chegou = formulário saudável
```

A prova não é o 201 do Framer — é a **linha em `monitor_pings`**. Justamente porque o 201 é o que já funcionava enquanto o lead se perdia.

## O desvio no n8n

Dois nós novos no `Leads LP - Framer` ([[Workflow-Leads-LP-Framer]], id `J2rdIrv7C7gILmpk`), inseridos **entre** o `Webhook Greatpages` e o `Processar dados da LP`:

| Nó | O que faz |
|---|---|
| **É ping do monitor?** (IF) | Procura `@sparkmaxx-qa.com` no payload. Saída `true` = ping sintético; `false` = caminho original, intocado. |
| **Registrar monitor_ping** (Supabase) | Grava em `public.monitor_pings`. Credencial `Supabase_Spark_MAXX` (`dBug7ogyVJ5J6Jlu`). |

**Consequência:** submissão sintética **não** gera conversão no RD, deal no [[Workflow-RD-Pipedrive|Pipedrive]], linha em `leads_framer` nem ruído no [[Discord]]. Verificado: após 9 submissões reais, `leads_framer`, `leads`, `alerts` e `leads_rd_pipedrive` ficaram com **0** registros `@sparkmaxx-qa.com`.

- Versão publicada com o desvio: `a6f47a13-9300-4082-8127-2f34d2aa1408`
- **Revert:** restaurar `883bf8ca-1995-414f-857f-de827bdb983c` no histórico do n8n

## O protocolo do e-mail

```
mon.<form_key>.<run_id>@sparkmaxx-qa.com
```

O IF reconhece pelo domínio; o nó Supabase fatia o local part por `.` para recuperar `form_key` e `run_id`. **Nem `form_key` nem `run_id` podem conter ponto.** Mudar `MONITOR_EMAIL_DOMAIN` exige mudar a condição do IF no n8n.

## Alerta

Falha vira linha em `public.alerts` com `tipo = 'form_quebrado'`, `severity = 'critical'` — aparece no dashboard do **central-leads** junto dos outros alertas, via Realtime.

| Comportamento | Regra |
|---|---|
| Não duplica | Se já existe alerta `open` para o mesmo `form_key`, não abre outro. Form quebrado há 3 dias = 1 alerta, não 12. |
| Auto-resolve | Formulário que volta a funcionar fecha os alertas abertos dele (`resolved_by = 'monitor-sintetico'`). |
| Reabre | Se quebrar de novo depois de resolvido, abre alerta novo. |

Modos de falha distinguidos: `pagina_nao_carregou` · `form_nao_encontrado` · `submit_sem_201` · **`nao_encaminhou`** (o bug que motivou tudo).

> Foi preciso estender o CHECK constraint `alerts_tipo_check` para aceitar `form_quebrado` (migration `alerts_tipo_check_add_form_quebrado`).

## Decisões de projeto

- **GitHub Actions, não Checkly.** O repo já existia e não tinha CI. Playwright no Actions é grátis e roda o mesmo motor que o Checkly usa por baixo. Checkly só ganharia em multi-região e alerta próprio — nada que justifique conta nova nesta escala. Os testes migram sem reescrever se um dia precisar.
- **Nenhum seletor fixo por `name` de campo.** O QA mostrou que os formulários são recriados com frequência (o `/sobre-nos` ganhou id novo em 14/07). Monitor amarrado a seletor quebraria a cada republish e viraria alarme falso — que é pior que não ter monitor. O preenchimento é heurístico, por rótulo/placeholder do campo, como um usuário faria.
- **Uma consulta, não nove esperas.** Todas as submissões de uma rodada compartilham o `run_id`, então a verificação é uma query só. O tempo de espera é o de um formulário, não a soma dos nove.
- **Retention de 30 dias** nos pings (limpeza no fim de cada rodada). São ~13k linhas/ano de dado descartável.

## Rodando

```bash
cd lead-central
npm run monitor:forms                      # rodada completa, grava alertas
MONITOR_DRY_RUN=true npm run monitor:forms # submete e verifica, sem gravar alerta
```

Env: reusa `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. O resto tem default — ver `.env.example`.

No GitHub Actions (`.github/workflows/monitor-forms.yml`): cron às **08h, 12h, 16h e 20h de Brasília** + `workflow_dispatch` manual com opção de dry run. Secrets necessários no repo `Caiogss19/central-leads`: `VITE_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.

## Inventário monitorado

Fonte: [[QA-Formularios-Leads-2026-07]]. Configurado em `monitoring/forms.config.ts`.

| `form_key` | Página | Tipo |
|---|---|---|
| `home-contato` | `/` | contato |
| `hometeste-meio` | `/home-teste` (meio) | contato |
| `hometeste-rodape` | `/home-teste` (rodapé) | contato |
| `hometeste-news` | `/home-teste` | newsletter |
| `sobrenos-contato` | `/sobre-nos` | contato |
| `sobrenos-news` | `/sobre-nos` | newsletter |
| `blog-inline` | `/blog` (inline) | newsletter |
| `blog-news` | `/blog` (rodapé) | newsletter |
| `lp-sprout` | LP Sprout | contato |

## Primeira rodada — 29/07/2026

**9/9 encaminharam.** Dois achados:

1. 🎉 **O form do meio do `/home-teste` (`03c65a6f`) voltou a encaminhar.** O [[QA-Formularios-Leads-2026-07]] o registrou como quebrado em 13-14/07 (testado 4×, inclusive após republish). Em 29/07 o ping chegou com `page_url` correta. O bug foi corrigido em algum momento entre as duas datas — **sem ninguém registrar quando ou como**. É exatamente o tipo de coisa que o monitor passa a datar.
2. ⚠️ **`blog-inline` e `hometeste-rodape` chegaram com `page_url` vazia.** Pode ser limitação da extração do monitor (a expressão só olha `page_url`/`url` minúsculo, enquanto o `Processar dados da LP` tolera `Page_url`/`PAGE_URL`) — ou os forms realmente não mandam a URL. **Vale confirmar**, porque a atribuição de origem no n8n depende de `page_url` (regra `isProdutoLpUrl` / `isSiteContato`). Não afeta o veredito do monitor.

## Relacionado
- [[QA-Formularios-Leads-2026-07]] · [[Workflow-Leads-LP-Framer]] · [[n8n]] · [[Supabase]] · [[Funil]] · [[Home]]
