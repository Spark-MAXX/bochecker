---
title: QA Formulários & Fluxo de Leads — 2026-07
tags: [qa, teste, n8n, rdstation, pipedrive, framer, bug, fix]
---

# QA — Formulários & Fluxo de Leads (2026-07-13)

Sessão de teste end-to-end do fluxo **Framer → [[Workflow-Leads-LP-Framer|RD]] → [[Workflow-RD-Pipedrive|Pipedrive]]**, mapeamento de todos os formulários do site e **correção de um bug de atribuição** (`conversion_identifier`).

> Método: submissão real em cada formulário via browser, rastreando cada lead até o RD Station (contato) e o n8n (execução). Contatos de teste marcados com `teste.claude.*@sparkmaxx-qa.com`.

> [!info] Esta sessão virou monitoramento contínuo — ver [[Monitor-Formularios]]
> Desde 29/07/2026 os 9 formulários deste inventário são submetidos automaticamente a cada 4h (Playwright + GitHub Actions), e a falha silenciosa "201 sem encaminhar" abre alerta `form_quebrado` no dashboard. Submissões sintéticas são desviadas no início do fluxo e **não** poluem RD/Pipedrive/Discord.
>
> **Atualização de status:** na primeira rodada, o form do meio do `/home-teste` (`03c65a6f`), registrado abaixo como 🔴 **não encaminha**, **encaminhou normalmente**. O bug foi corrigido em algum momento entre 14/07 e 29/07. O restante do diagnóstico abaixo segue válido como histórico.

## ✅ Veredito geral
- **Fluxo completo funciona** e passa os dados 100%. Validado com lead real (Augusto/Dadz, exec. `62935`): Pipedrive criou **pessoa + organização (vinculada) + deal** com todos os campos custom (telefone, perfil, solução, frequência, UTMs, URL, lead score). Nó `Validar Lead RD Pipe` → `"Lead completo ✅"`.
- **Perna RD → Pipedrive** dispara quando o **RD marca oportunidade** (automação no RD), ~3 min após a conversão.

## 🧪 Matriz de formulários testados

| Página | Formulário | Framer form id | Chega no RD? |
|---|---|---|---|
| /home-teste | **Contato (meio)** — "O que busca / faz campanha" | `03c65a6f-…-37903419937d` | ❌ **NÃO encaminha** |
| /home-teste | Contato (rodapé) — "Solução de interesse" | `ca82705a-…-6ae0e125e7dc` | ✅ |
| /home-teste | Newsletter (rodapé) | `0e244ed0-…-d50b638c271e` | ✅ |
| /sobre-nos | Contato — recriado c/ "Solução de interesse" | `08d1d8ab-…-f2214c40a5b4` | ✅ **corrigido 14/07** (exec. `64192`) |
| /sobre-nos | ~~Contato antigo "O que busca"~~ | ~~`41b2a1a3-…`~~ | ❌ (substituído) |
| /sobre-nos | Newsletter (rodapé) | `0e244ed0-…` (footer compart.) | ✅ |
| /blog | Inscrição inline "Receba os próximos posts" | `56016ba6-…-3c13205fdb53` | ✅ |
| /blog | Newsletter (rodapé) | `0e244ed0-…` | ✅ |
| LP Sprout | Contato da LP | `8d59cedb-…-12be641b457f` | ✅ (exec. `63861`) |

> Todos os forms retornam **201** na API do Framer (`api.framer.com/forms/v1/...`). O 201 só diz que o Framer **armazenou** a submissão — não garante o encaminhamento do webhook para o n8n.

## 📋 Inventário online verificado (14/07/2026, ~17:30, DOM ao vivo)

Estado **real publicado** de cada página (campos `select` reais + id de submissão do Framer). "Estrutura" = quais perguntas o form tem.

| Página (URL) | Form | Estrutura (selects) | UTMs no form? | Framer id | Encaminha? |
|---|---|---|---|---|---|
| **`/` (home produção)** | Contato (único) | `Voce_e` + `O_que_voce_esta_buscando` + `Frequencia` | ✅ sim | *(não submetido)* | ⚠️ não testado hoje |
| **`/home-teste`** | Contato (meio) | `Voce_e` + `O_que_voce_esta_buscando` + `Frequencia` | ❌ não | `03c65a6f` | 🔴 **NÃO** |
| **`/home-teste`** | Contato (rodapé) | `Voce_e` + `Solucao_de_interesse` | ✅ sim | `ca82705a` | ✅ |
| **`/home-teste`** | Newsletter (rodapé) | só `Email` | ✅ sim | `0e244ed0` | ✅ |
| **`/sobre-nos`** | Contato | `Voce_e` + `Solucao_de_interesse` | ✅ sim | `08d1d8ab` | ✅ |
| **`/sobre-nos`** | Newsletter | só `Email` | ✅ sim | `0e244ed0` | ✅ |
| **`/blog`** | Inscrição inline | só `Email` | ✅ sim | `56016ba6` | ✅ |
| **`/blog`** | Newsletter (rodapé) | só `Email` | ✅ sim | `0e244ed0` | ✅ |
| **LP Sprout** (`/plataforma-sprout-social-influencer-marketing`) | Contato da LP | `Voce_e` + `O_que_voce_esta_buscando` + `Frequencia` | ✅ sim | `8d59cedb` | ✅ (`Sprout - LP`) |

> [!warning] Divergência: form do meio do /home-teste **não** foi atualizado online
> Verificado com cache furado (`?v=cachebust771`) em 14/07 17:30: o form do **meio** do `/home-teste` **ainda tem as perguntas antigas** (`O_que_voce_esta_buscando` + `Frequencia`), **não** "Solução de interesse". Se a edição para "mesmas perguntas do de baixo" foi feita, ela **não está publicada nesta URL** (provável: editado em rascunho ou na home real `/`, que também ainda usa o form antigo). O form do meio (`03c65a6f`) segue **sem encaminhar** ao n8n.
>
> **Observação:** o form do meio (`03c65a6f`) é o **único** que **não tem `page_url` nem UTMs** entre os inputs — além de não encaminhar, mesmo se encaminhasse perderia origem/UTM.

## 🔴 Problema em aberto — form de contato do /home-teste (meio)
O formulário de **contato do /home-teste (meio, `03c65a6f`)** posta no Framer (201) mas **não dispara** o webhook do n8n → lead 404 no RD (perdido silenciosamente). Testado 4× (inclusive com cache limpo e após republish) — não é cache.

**Provável causa:** integração de Webhook ausente/errada no form (ex.: URL de **teste** `/webhook-test/...` em vez da de **produção** `/webhook/greatpages-rd-unificado`, ou webhook não salvo). Os forms `ca82705a` e `08d1d8ab` funcionam → usar como referência e copiar a config exata.

> ✅ **/sobre-nos resolvido (14/07):** o form de contato foi **recriado** (novo id `08d1d8ab`, agora com "Solução de interesse") e passou a encaminhar. Contato chega no RD com `Site - Contato` + dados completos. Único ponto: coleta só Perfil + Solução → `cf_frequencia_de_campanha` e `cf_o_que_busca` ficam vazios (igual ao form do rodapé).

## 🟡 Outros pontos
- **`Alertar Erro Discord1`** ([[Workflow-RD-Pipedrive]]) retorna `{"error":"Unauthorized"}` (401) — a rede de segurança de alerta de erro está com credencial quebrada. Não afeta leads, mas ninguém é avisado se um erro real ocorrer.
- **Dropdown "Solução de interesse"** (form `ca82705a`) tem opções duplicadas + typo `Comunnity Discovery` (deveriam ser 3, aparecem 6). Se escolher o typo, a detecção de produto cai para `generico`.
- Forms de contato do site coletam menos campos que as LPs → `cf_frequencia_de_campanha` e `cf_o_que_busca` ficam vazios (por design).

## 🐛→✅ BUG corrigido: LP de produto virava "Site - Contato"

**Sintoma:** conversões da **LP de Sprout com UTM** (ex.: `google/paid_search`) chegavam no RD como `conversion_identifier = "Site - Contato"` em vez de **`Sprout - LP`**.

**Causa raiz:** o nó `Processar dados da LP` ([[Workflow-Leads-LP-Framer]]) foi editado e a regra `isSiteContato` passou a marcar **qualquer URL do domínio `sparkmaxx.com.br` com nome/perfil** como site-contato — capturando também as LPs de produto (que ficam no mesmo domínio). Ver [[Workflow-Leads-LP-Framer#Análise de origem por URL]].

**Correção (deployada e publicada):** adicionado detector `isProdutoLpUrl` e gate no `isSiteContato`:

```js
// URLs de LP de produto (NAO sao o site institucional) -> mantem identificador da LP
const LP_PRODUTO_SLUGS = ["sprout","community","creator-pulse","creator_pulse","creatorpulse",
  "brand-pulse","brand_pulse","brandpulse","human-data","solucoes-human-data","plataforma-","indicacao"];
const isProdutoLpUrl = LP_PRODUTO_SLUGS.some(k => _pageLower.includes(k));

const isSiteContato = !isProdutoLpUrl && (explContato || temSolucaoNova ||
  (isSiteUrl && !urlNewsletter && (!!output.nome || !!output.telefone || String(_perfilProbe).trim() !== '')));
```

**Validação (código em produção, exec. `63861` — lead real pela LP Sprout com UTM google):**

| Caso | Antes | Depois |
|---|---|---|
| Sprout LP (meta/google) | Site - Contato | **Sprout - LP** ✅ |
| Community LP | Site - Contato | **Community Discovery - LP** ✅ |
| Creator Pulse LP | Site - Contato | **Creator Pulse - LP** ✅ |
| /home-teste (meio/Solução) | Site - Contato | Site - Contato ✅ (sem regressão) |
| /sobre-nos | Site - Contato | Site - Contato ✅ |
| Newsletter | Site - Maxxnews | Site - Maxxnews ✅ |

- Workflow `J2rdIrv7C7gILmpk` — nó `Processar dados da LP` (id `cae881ce-…`).
- Versão ativa publicada: `91e47838-6d78-4bec-9ad3-ad8a66cb78d7`. Versão anterior (para revert via histórico do n8n): `70c0acfa-9d50-456c-8ef7-39512e32db94`.

> ✅ **Confirmado com lead REAL em produção (14/07, exec. `64203`):** `ecommerce@leluclingerie.com.br` ("Leluc Lingerie"), Google Ads na LP Sprout (campanha `BoFu_Search_Sprout_Produto`, `gclid` presente) → classificado como **`Sprout - LP`** (antes do fix teria virado "Site - Contato"). Conversão enviada ao RD com `event_uuid`.

### ⚠️ Ação sugerida no RD
Enquanto o bug esteve ativo (edição do nó ~13/07 → correção 13/07), **conversões de LP podem ter sido gravadas como "Site - Contato"**. Vale revisar/reatribuir esses eventos no RD.

## 🧹 Contatos de teste para apagar no RD
`teste.claude.lpsprout@…` · `teste.claude.blogsub@…` (`c7221b66-…`) · `teste.claude.blogfooter@…` (`dd79e4ba-…`) · `teste.claude.form2@…` (`e7fddbdb-…`) · `teste.claude.newsletter@…`
(os `form1b/1c/1d` e `sobrenos` **não** chegaram no RD — forms quebrados.)

## Relacionado
- [[Workflow-Leads-LP-Framer]] · [[Workflow-RD-Pipedrive]] · [[n8n]] · [[Funil]] · [[Home]]
