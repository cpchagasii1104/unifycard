# DECOMPOSIÇÃO DAS 1928 VIOLAÇÕES DO GATE `schema-coherence`

**Produzido pela DIREÇÃO em 2026-07-30, por medição de 1ª mão** contra o `unificard_dev` e o
JSON `docs/_reports/schema-coherence-violations-2026-07-30.json` (commit `01c54f53e`).

> **Por que este arquivo existe:** o número "1928 violações" paralisou a decisão de religar o
> gate por semanas, porque ninguém sabia do que ele era feito — o gate escondia a própria
> lista. Com a lista aberta, o número se decompõe em **um evento histórico** e três resíduos.
> **Não são 136 problemas. É um só, com cauda longa.**

## O corte, número a número

| bucket | ocorrências | o que é |
|---|---|---|
| Harnesses (`backend/src/scripts/`) | **1173** | Não é superfície de escrita viva. **Medido, não decidido** — excluir diretório por nome muda o que o gate significa. Campo `inScripts` existe para isso. |
| 🔴 **Código órfão do `REBASE-03`** | **591** | 136 nomes cujas tabelas estão definidas nas **313 migrations arquivadas**. Ver abaixo. |
| `C13` + `C3` (fronteira de módulo) | **41** | `bank_splits` 11 · `bank_transactions` 10 · `bank_ledger` 6 · `bank_settlements` 6 · `bank_accounts` 4 · `actors` 4. **As tabelas EXISTEM** — o defeito é o acesso fora do módulo. **Dívida já catalogada**, dono Clayton, prazo 2026-09-30. |
| Bugs de parser ainda no gate | **~25** | Funções SQL chamadas via `FROM` (`unnest`, `fn_grant_actor_capability`, `fn_revoke_actor_capability_grant`, `get_user_permissions`, `detect_availability_conflicts`, `rides_find_nearby_drivers`, `rides_calculate_realtime_earnings`, `rides_check_driving_limit`, `rides_calculate_zone_pressure`) e palavras-chave/aliases (`lateral`, `now`, `public`, `created_at`, `u`, `com`). **Terceira classe de bug do próprio gate**, depois de catálogo do sistema e alias de CTE. |
| **Genuinamente sem explicação** | **~49** | ~19 nomes: `reports` 7 · `accounts` 5 · `risk_flags` 4 · `payment_intent_splits` 3 · `payout_transactions` 3 · `media_context_dimension_norm` 2 · `report_events` 2 · `transactions` 1 · e tabelas `rides_*` que **não** estão no arquivo. |

⚠️ O campo `type` do JSON vale `table` para **todos** os 706 fora de harnesses — ele **não
distingue motivo**. A separação entre "tabela fantasma" e "fronteira de módulo" foi feita
pela direção consultando `information_schema` nome a nome. Quem for usar o JSON precisa
refazer esse cruzamento, não confiar no `type`.

## 🔴 A raiz: `[REBASE-03] Fechamento Constitucional`

```
commit 705792271   Clayton Pereira Chagas   2026-02-11 23:58:18 -0300
[REBASE-03] Fechamento Constitucional
```

Esse commit **criou** `backend/migrations_archive/` com **313 arquivos `.sql`** — todos
versionados, nenhum aplicado. É a terceira reconstrução do sistema, a que produziu a tag
`GENESIS_CONSTITUCIONAL_v1`. Hoje o conjunto vivo tem 549 migrations.

**O schema foi reconstruído; o código que usava o schema antigo ficou onde estava.** Daí
os 591: `rides_*`, `organization_*`, `payout_orders`, `notify_queue`,
`user_group_allocations`, `cultural_*`, `human_mvp_*`, `pilot_*`, `loyalty_*`,
`user_memory_*`, `observability_*` e mais.

**Isso NÃO é 136 dívidas. É uma decisão de fevereiro cuja cauda nunca foi varrida.**

## O que já foi contido — e prova que o padrão existe

`docs/03_execution_log/20260616_F_ORGANIZATION_SCHEMA_GHOST_FAIL_CLOSED_CONTAINMENT.md`
(2026-06-16) tratou exatamente disto para `organization_*`: constatou *"zero `CREATE TABLE`
… organization_invites/members/units/roles"*, provou `to_regclass=NULL` em DB efêmera FULL,
registrou que *"toda rota emitiria 42P01"*, e marcou **`organization_members` como TOMBSTONE
conhecido** (`DECISION_0131_AUTHORITY_GRAMMAR.md:137`), com guard
`audit-rbac-stub-and-tombstones.mjs`.

🔴 **Ou seja: parte da cauda JÁ foi contida com rito próprio, e parte não.** A pergunta certa
não é *"o que fazer com 136 tabelas"* — é **"quais dos 136 já têm contenção/tombstone e quais
estão nus"**. É pergunta de inventário documental, não de arquitetura.

## 🔬 SEGUNDA PASSAGEM DA DIREÇÃO (2026-07-30) — a cauda tem dono, e ele é o RBAC

### 1 · O encerramento do REBASE-03 existe, é rigoroso com o schema, e MUDO sobre o código

| documento | estado |
|---|---|
| `docs/04_audit/MIGRATIONS_ARCHIVE_MANIFEST.md` | ✅ completo — **313 arquivos com SHA256 cada**, data `2026-02-11 21:53:49` |
| `docs/04_audit/REBASE_CLOSURE_DECLARATION.md` | ✅ preenchido — `2026-02-11T23:32:01Z`, commit `bee2d606…`, `schema_version` + trigger anti-downgrade |
| `docs/04_audit/GENESIS_DETERMINISM_PROOF.md` | ✅ existe |
| `docs/03_execution_log/GENESIS_REBASE_CLOSURE.md` | ⚠️ **TEMPLATE NÃO PREENCHIDO** — `[PREENCHER DATA UTC]`, `[PREENCHER HASH DO COMMIT]` |

🔴 **Os quatro juntos não dizem UMA palavra sobre o código da aplicação.** O rebase foi
executado com rigor cirúrgico de um lado (hash por arquivo, determinismo provado 3×,
regime forward-only) e **zero do outro**. *"Regime legacy encerrado"* significou schema,
nunca código. **É essa assimetria — não um descuido — que produziu os 591.**

### 2 · A prova de que a cauda morde: `auth_rate_limit_logs` era a **#298 de 313**

```
| 298 | 0929_auth_rate_limit_logs.sql | 6ED09799C680A91DC958A23AB496FC838703E393E849FF341294CBAE9F74DBC8 |
```

A `DT-AUTH-RATE-LIMIT-FAIL-OPEN-SUBSTRATE-AUSENTE`, fechada em `090711185`, **não era
defeito aleatório**: era um item nomeado do manifesto. Proteção de força bruta ausente por
**5 meses e meio** porque a migration que criava a tabela foi arquivada e o código ficou.
Estão no mesmo manifesto: `0216_bank_reconciliation_history`, `0671_event_custody`,
`0059_organization_members`, `0051_user_group_allocations`, `0009_notify_system`, os
`rides_*` (0716-0722, 0865-0867), `cultural_*`, `human_mvp_*`, `pilot_*`, `loyalty_*`.

### 3 · Alcançabilidade medida — o maior balde está INALCANÇÁVEL

`modules/rides` concentra **91** das 706. Medição de 1ª mão:

- `rides.module.ts` registra 9 rotas e **comenta 6** (`// TODO: refatorar`): `rides`,
  `matching`, `pricing`, `lifecycle`, `promotions`, `referrals` → **mortas**.
- As 5 vivas com violação (`safety` 7 · `availability` 3 · `demand` 3 · `service-types` 3 ·
  `drivers` 1 = **17**) usam **`requirePermission` em TODOS os handlers** (contagem bate com
  a de `preHandler`).
- `vehicle-compliance` e `analytics` **não são registradas em lugar nenhum**.

**Conclusão: as 91 de rides não são alcançáveis hoje.** Mesmo padrão de
`bank_reconciliation_history`.

🧨 **Isso confirma a tese: o `RETURN FALSE` de `actor_has_permission` é a contenção que
sustenta TODA a cauda do REBASE-03 na superfície autenticada.** Só 47 ocorrências vivem em
`.routes.ts` (14 arquivos), e as autenticadas morrem no 403 antes de chegar no 42P01.

### 4 · Quem morde HOJE é só o que está ANTES da autenticação

Os plugins `authPlugin`/`tenantPlugin`/`rbacPlugin` são registrados **exclusivamente**
dentro do `protectedScope` (`app.builder.ts:289-292`). Tudo registrado antes da linha 288 é
pré-autenticação — e é lá, e só lá, que a cauda tem dentes. Foi exatamente o caso do
rate-limit (`/auth`, linha 160).

🔴 **ACHADO NOVO — `DT-REPORTING-CHANNEL-DEAD-PUBLIC-SCOPE`:** `/reports`
(*"Reporting Core (denúncias)"*, `app.builder.ts:257`) é registrado **fora** do
`protectedScope`. Seu `preHandler` (`reporting.routes.ts:25-29`) exige `req.tenant?.id` e
`req.user?.id` — campos que **nunca são populados** ali, porque os plugins que os preenchem
vivem só no escopo protegido. **Todo request recebe 401.** E atrás desse 401 há três tabelas
que não existem **nem no arquivo do REBASE-03**: `reports`, `report_events`, `risk_flags`
(13 violações, `reporting.repository.ts`, 5 delas BLOCKER de escrita).

**O canal de denúncia de abuso, fraude, assédio e falsidade ideológica do UnifiCard não
funciona — e falharia duas vezes se funcionasse.** Falha FECHADA (401), então não é buraco
de segurança; é funcionalidade de segurança **inexistente**.

### 5 · A varredura pelo padrão do rate-limit deu ZERO

Todos os **138** arquivos de produção com referência a tabela fantasma foram varridos atrás
do padrão que escondeu o rate-limit — `catch` engolindo erro e devolvendo permissivo
(`return 0` / `true` / `[]` / `allowed: true`). **Zero ocorrências.** O rate-limit era o
único fail-open silencioso dessa forma. Registrado como resultado NEGATIVO com denominador
declarado: não é ausência de busca, é busca que deu vazio.

## ✅ TERCEIRA PASSAGEM — O BALDE "SEM DEFINIÇÃO EM LUGAR NENHUM" ESTÁ FECHADO

**Medido pela direção em 2026-07-30, contra o JSON pós-correções de parser (1847 itens) e o
`unificard_dev`.** Recomposição dos 679 fora de harnesses:

| balde | ocorrências | nomes |
|---|---|---|
| tabela **EXISTE** (fronteira de módulo — `C3`/`C13`) | 41 | 6 |
| definida em `migrations_archive` (cauda do REBASE-03) | 591 | 136 |
| criada por migration viva | **0** | 0 |
| 🔍 **sem definição em lugar nenhum** | **47** | **16** |

**Os 47 foram adjudicados um a um. Nenhum sobrou sem explicação:**

| grupo | oc. | veredito |
|---|---|---|
| `reports` · `report_events` · `risk_flags` | 13 | **NORMA ÓRFÃ.** Desenho existe (`REPORTING_CORE.md` + `REPORTING_DATA_MODEL.md`, em `99_archive/to_review`), nunca promulgado. Adjudicado em `DECISION-0195` (**não-selada**). Inalcançável: 401 por escopo. |
| `accounts` · `transactions` | 6 | **SUBSTRATO SUBSTITUÍDO + CÓDIGO MORTO.** `city-readiness.service.ts` consulta nomes genéricos; o schema vivo tem `bank_accounts`/`bank_transactions`/`group_accounts`/`treasury_accounts`. **Cadeia morta provada:** `city-readiness.module.ts` **não é registrado**, e `dynamicPricingService`/`productDemandService` — únicos que importam o serviço — **não têm caller nenhum**. |
| `payout_transactions` · `payment_intent_splits` | 6 | **SUBSTRATO SUBSTITUÍDO.** `modules/reports/financial-report.service.ts`; o vivo é `payment_transactions`/`bank_splits`/`payment_intents`. Alcançável via `/reports` (protegido), **mascarado pelo 403 do RBAC**. |
| `rides_*` (9 nomes) | 22 | Mesma contenção já provada para as outras 91 de rides: rota comentada em `rides.module.ts` ou atrás de `requirePermission`. |

🔴 **A categoria mais perigosa é SUBSTRATO SUBSTITUÍDO** — 12 ocorrências. Não é código morto:
**é função viva chamando o nome errado.** Parece fantasma e não é; o dado existe, com outro
nome. Quem "limpar" isso apagando o código apaga funcionalidade; quem religar sem trocar o
nome liga no vazio. É a categoria que o mandato de DOCUMENTOS deve caçar na cauda dos 136.

### 🔴 ACHADO NOVO — `DT-REPORTS-PREFIX-COLLISION`

**`/reports` está registrado DUAS VEZES, para produtos diferentes e em escopos diferentes:**

```
app.builder.ts:257   core/reporting    (denúncia/abuso)     → escopo PÚBLICO
app.builder.ts:716   modules/reports   (relatório financeiro) → protectedScope, prefix '/reports'
```

Os caminhos internos hoje não colidem exatamente — `core/reporting` expõe `POST /`, `GET /`,
`GET /:id`, `PATCH /:id`; `modules/reports` expõe `/sales`, `/inventory`, `/financial`,
`/inventory/aging`, `/transfers/sla`, `/inventory/suggestions` — então o boot não quebra.
**Mas o mesmo namespace serve denúncia de assédio e relatório de vendas, um público e outro
protegido.** `POST /reports` cria denúncia; `GET /reports/financial` lê faturamento.

⚠️ **`GET /reports/:id` (denúncia, público) casa com qualquer segmento** — a única razão de
`/reports/financial` não ser capturado é a ordem de registro e o escopo. É frágil por
construção: basta alguém adicionar uma rota nova para virar colisão real ou vazamento de
rota protegida para o escopo público.

Confirma o diagnóstico do `PLANO_RECUPERACAO.md` §2 (*"o runtime está amplo demais… comentários
no próprio código admitindo possíveis conflitos de rotas"*). **Não é a mesma dívida do canal de
denúncia** — esta é de namespace HTTP, e sobrevive mesmo depois que a `DECISION-0195` for selada.

## 🔬 QUARTA PASSAGEM — CAÇANDO `SUBSTRATO SUBSTITUÍDO` NOS 136

**Método declarado:** cruzar os 136 nomes fantasma da cauda contra as **333 tabelas vivas** do
`unificard_dev`, sinalizando quando um nome vivo **contém** o fantasma ou é **contido** por ele.
⚠️ **Isso produz CANDIDATOS, não veredito.** Coincidência de substring não é substituição —
só comparação de COLUNAS decide. A direção verificou **2 em profundidade** e declara os outros
22 como fila de trabalho, não como conclusão.

**Resultado: 24 nomes · 134 ocorrências têm candidato vivo.**

| oc. | fantasma | candidato(s) vivo(s) |
|---|---|---|
| 17 | `rides_driver_availability` | `availability` |
| 10 | `subscriptions` | `organizer_subscriptions` |
| 10 | `cultural_events` | `events` |
| 10 | `payout_orders` | `orders` |
| 9 | `cultural_profiles` | `profiles` |
| 8 | `votes` | `post_votes` · `approval_votes` · `group_votes` |
| 8 | `rides_ride_events` | `events` |
| 7 | `user_skills_categories` | `categories` |
| 7 | `human_mvp_events` | `events` |
| 6 | `predefined_services` | `services` |
| 5 | `cultural_event_checkins` · `checkins` | `event_checkins` |
| 5 | `alerts` | `financial_alerts` |
| 4 | `pilot_events` | `events` |
| 4 | `local_products` | `products` |
| 4 | `social_chat_messages` | `chat_messages` |
| 3 | `rides_driver_services` | `services` |
| 3 | `organization_roles` | `roles` |
| 2 | `vote_responses` | `group_vote_responses` |
| 2 | `referral_codes` | `actor_referral_codes` |
| 2 | `tab_orders` | `orders` |
| 1 | `event_rsvp_counts` · `service_bookings` · `vote_options` | `event_rsvp` · `bookings` · `group_vote_options` |

### ✅ VERIFICADO 1 — `referral_codes` → `actor_referral_codes`: **SUBSTITUIÇÃO LIMPA**

```
código (marketplace/referral.repository.ts:50) insere : tenant_id, code, owner_actor_id, group_id, …
actor_referral_codes (vivo)                     tem   : tenant_id, code, owner_actor_id, code_status,
                                                        created_by_actor_id, created_by_user_id, revoked_at, metadata
```

`owner_actor_id` bate — é a assinatura do refactor **Actor-first**. O dado sobreviveu com
prefixo `actor_`. **É rename, e toca dinheiro** (indicação). O `group_id` do INSERT não existe
no vivo; provavelmente foi para `metadata`, **não confirmado**.

### ⚠️ VERIFICADO 2 — `votes` → `group_votes`: **NÃO é rename. É ESTREITAMENTO DE ESCOPO.**

```
código (modules/votes/votes.repository.ts:114) espera : tenant_id, title, description, status,
                                                        created_by_actor_id, starts_at, ends_at  (PK vote_id)
group_votes (vivo)                              tem   : tenant_id, title, description, status,
                                                        created_by_actor_id, closes_at, group_id,
                                                        is_anonymous, metadata                   (PK id)
```

Sete campos batem — mas o fantasma era **votação do tenant inteiro** (sem `group_id`) e o vivo é
**votação de grupo** (`group_id`, `is_anonymous`). Também troca `starts_at`+`ends_at` por
`closes_at` e `vote_id` por `id`.

🔴 **Renomear aqui seria decidir, no código, que votação do tenant vira votação de grupo.** Isso
é decisão de produto e de norma, **jamais de executora**.

E confirma, com evidência, o aviso do `CLAUDE.md`: *"Já existem **3** substratos de votação…
não crie o 4º."* Os três vivos são exatamente **`post_votes` · `approval_votes` ·
`group_votes`** — e `modules/votes` escreve num **quarto**, que morreu no `REBASE-03`.

### 🎯 O QUE ESTA PASSAGEM ENSINA PARA A VARREDURA DOS 136

**As duas verificações deram resultados de naturezas diferentes** — uma é rename, a outra é
mudança de escopo disfarçada de rename. **Só a comparação de colunas distingue**, e a diferença
decide quem pode agir:

| natureza | quem resolve |
|---|---|
| **rename limpo** (mesmas colunas, nome novo) | executora, com pacote fechado |
| **estreitamento/mudança de escopo** | **exige DECISION** — é produto, não refactor |

⛔ **Nenhum dos 22 restantes pode ser tratado como rename sem essa comparação.** Um "refactor de
nome" que na verdade estreita escopo apaga funcionalidade em silêncio — e no caso de `votes`
apagaria a votação de tenant inteiro.

## Ordem recomendada pela direção

1. **Mapa de cobertura da cauda do REBASE-03** (read-only, instância DOCUMENTOS): cruzar os
   136 nomes contra os documentos de encerramento/contenção existentes. Converte 591 em
   *"já decidido"* × *"nunca contido"*.
2. **Terceira classe de bug do parser** (~25): mesma natureza objetiva das duas já
   consertadas em `01c54f53e`. Fatia pequena.
3. **Os ~49 sem explicação**: só depois de 1 e 2, quando for a única coisa que sobrou.

⛔ **NÃO religar o gate no runner antes de 1 e 2.** Com 1802 vermelhos, ele entra como guard
permanentemente vermelho — a armadilha que a própria Yala tem no mandato para caçar.

⚠️ Lembrete de ordem geral: **ninguém encosta na FASE 6 do RBAC** antes de a cauda estar
mapeada — o `RETURN FALSE` de `actor_has_permission` mascara 176 chamadas em 44 arquivos de
rota, e pelo menos uma escreve em tabela que não existe. Ver
`PAINEL_DIVIDA_VIVA.md`.
