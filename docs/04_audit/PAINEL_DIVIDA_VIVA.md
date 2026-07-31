# PAINEL ÚNICO DE DÍVIDA VIVA — **O PLACAR**

> ## 🔴 ESTE É O PLACAR ÚNICO. LEIA ISTO PRIMEIRO, ATUALIZE ISTO SEMPRE.
>
> **Decisão de Clayton, 2026-07-30.** Existiam **nove** arquivos rastreando dívida, e eles
> divergiam. O que se declarava obrigatório (`dividatecnica.md`) tinha placar de **06/07**
> dizendo *163 guards* quando já eram **227** — e três sessões seguidas fecharam dívida sem
> atualizá-lo, inclusive a direção, quatro vezes num único dia.
>
> **Um arquivo por papel, sem sobreposição:**
>
> | papel | arquivo |
> |---|---|
> | **PLACAR** — o que está vivo HOJE, cabe na cabeça | 🔴 **este arquivo** |
> | **CARTÓRIO** — história append-only, causa-raiz, provas | `REMEDIATION_DT_LOG.md` (topo = recente) |
> | **HISTÓRICO** — evidência antiga, não é placar | `dividatecnica.md`, `PLANO_ZERAGEM_DT.md` |
> | **PLANO** — estratégia das 6 fases | `PLANO_RECUPERACAO.md` |
>
> **Nome sem data, de propósito.** A versão anterior chamava-se `..._2026-07-29.md`, e nome
> datado em documento vivo é convite para a próxima instância criar um segundo. **Nunca
> versione este arquivo por nome — atualize-o.**
>
> **Toda fatia que fechar dívida atualiza o PLACAR abaixo e o REGISTRO DE SESSÕES.** Não é
> burocracia: é o que impede que a próxima instância meça o sistema por um número de 24 dias
> atrás.

## 📊 PLACAR — última medição **2026-07-30**, toda ela de 1ª mão pela direção

| métrica | valor | como foi medido |
|---|---|---|
| `validate:regression-guards` | ✅ **227 COMMANDS OK** · drift **0** | `npm run`, banco `unificard_dev` |
| `typecheck` backend | ✅ **0 erros** | `tsc -p tsconfig.build.json --noEmit` |
| Gate `schema-coherence` | ❌ **FAIL 1794** (376 BLOCKER · 1418 CORRUPTOR · 53 DEBT) | **fora do runner e do CI** — ver decomposição |
| `schema_migrations` (`unificard_dev`) | **548** aplicadas · 549 arquivos · 1 skip governado | query direta |
| Banco oficial | **`unificard_dev`** · trava fail-closed viva | `6414b3404` |
| `unificard_local` | **aposentado**, ainda vivo só pelo catálogo de veículos (16 marcas) | 334 tabelas · 547 migrations |

⚠️ **Números que NÃO foram remedidos nesta sessão** (não confie sem reconferir): contagem de
DTs abertas · `bank_ledger`/`transactions`/`splits` = 0 · estado da PORTA-01.

## 🔢 QUANTAS DTs EXISTEM — medido 2026-07-30, com o denominador declarado

| medida | valor | o que significa |
|---|---|---|
| IDs `DT-*` distintos na história do cartório | **556** | tudo que já foi nomeado como dívida, desde sempre |
| IDs `F-*` distintos (frentes, não dívidas) | 113 | campanhas, não débitos |
| `DT-*` **sem marcador de fechamento no cabeçalho** | **314** | varredura estrita — **teto**, não realidade |
| 🔴 **VIVAS E DEMONSTRADAS hoje** | **10** | alguém provou que quebra. **É este o número acionável.** Foi 7 → 11 após a auditoria Yala (2 reclassificações derrubadas + 1 divergência FE + 1 nova) → **10** com `event_custody` contida no mesmo dia |
| superfície contida (`501`) | **125** em 50 arquivos | **1 só declara prazo** — ver `DT-CONTAINMENT-WITHOUT-DEADLINE` |

> ### 🧭 REGRA DE DECISÃO — quando conter, consertar ou apagar (Clayton, 2026-07-30)
> A direção recomendou **conter** o `service_bookings` "seguindo o precedente do repo". Clayton
> devolveu: ***"contenção não é adiar o problema?"*** — e estava certo. A medição que veio
> depois deu razão a ele: **125 contenções, 1 prazo.**
>
> **Contenção NÃO é a resposta padrão. A pergunta que decide vem antes:**
>
> | a funcionalidade é pedida? | resposta |
> |---|---|
> | **sim** — há tela/API chamando | **CONSERTAR.** Conter aqui mata produto vivo |
> | **não** — nada chama | **APAGAR** (exige autorização de Clayton, CLAUDE.md §5) |
> | **não se sabe ainda** | conter — **com PRAZO e DONO**, nunca sem |
>
> 🔴 **Contenção sem prazo é abandono com status code melhor.** E o `REBASE-03` prova o custo:
> foi a maior contenção da história do projeto, sem prazo, e a conta chegou hoje.
| allowlist do gate (`C-*`) | 2 | `C3` e `C13`, prazo 2026-09-30, dono Clayton |

> ### ⚠️ POR QUE "314" NÃO É A RESPOSTA
> **O inteiro exato não é derivável por query, e isso já foi auditado** (Fable 5, 2026-07-06):
> o cartório fecha DT de formas heterogêneas — `CLOSED` · `CONTAINED` · `CONTIDO` · `FROZEN` ·
> `501` · tombstone · **fechamento no corpo sem re-carimbar o cabeçalho**. Na época a varredura
> estrita deu **301** e a reconciliação manual deu **~156**. Hoje a estrita dá **314**.
>
> **A diferença entre 314 e ~156 não é dívida: é convenção antiga.** Contar cabeçalho conta
> duas vezes o que foi fechado sem re-carimbo.
>
> 🔴 **Por isso o número que dirige o trabalho é o de VIVAS E DEMONSTRADAS**, não o histórico.
> 556 mede quanto o projeto já nomeou; 8 mede o que está quebrado agora.

## 🗓️ REGISTRO DE SESSÕES — o que cada fatia mudou no placar

**2026-07-30 · 6 commits, 3 DTs fechadas, nenhuma selada.**

| commit | o que era | efeito no placar |
|---|---|---|
| `6414b3404` | ausência de `EXPECTED_DATABASE_NAME` valia como **permissão** para migrar qualquer banco | runner 225 → **226** |
| `090711185` | **proteção de força bruta não existia desde a gênese** — `auth_rate_limit_logs` nunca criada, `catch` devolvia 0 | runner 226 → **227** · migrations 547 → **548** |
| `01c54f53e` | gate escondia a própria lista (`slice(0,5)`); 165 acusações eram bugs dele | gate 1928 → **1802** |
| `c245b6112` | decomposição: as 1928 são **um commit de fevereiro**, não 136 problemas | — |
| `25aa17223` | +6 classes de bug do gate; a correção ingênua teria **cegado 220 escritas** | gate 1802 → **1794** |
| `d1e74cc62` | nove rastreadores → um placar | — |
| `3496f57d4`+4 | `DECISION-0195` — canal unificado de denúncia (17 cláusulas, **não-selada**) | — |
| (este) | balde "sem definição em lugar nenhum" **fechado**: 47/47 adjudicados | — |

**🔴 Categoria nova, e é a que a direção mais quer vigiar: `SUBSTRATO SUBSTITUÍDO`.** Não é
código morto — **é função viva chamando o nome errado**. Achados hoje: `accounts`/`transactions`
(o vivo é `bank_accounts`/`bank_transactions`) · `payout_transactions`/`payment_intent_splits`
(o vivo é `payment_transactions`/`bank_splits`) · `reputation_scores`/`actor_scores`/`reviews`
(o vivo é `actor_reputation`/`trust_score_snapshots`). **Parece fantasma e não é.** Quem
"limpa" apagando o código apaga funcionalidade; quem religa sem trocar o nome liga no vazio.

**Padrão das três dívidas fechadas hoje, que vale mais que os números:** nenhuma gritava.
Ausência de env var passava calada · `catch` devolvia zero calado · `slice(0,5)` cortava
calado. **O sistema não estava mentindo — estava mudo.** É por isso que *"guard que nunca
falha é decoração"* é lei aqui, e por que cada guard desta sessão foi atacado por ângulo
independente antes de ser aceito.

---

## Origem deste documento

**Produzido pela instância especialista DÍVIDAS TÉCNICAS.** Verificação de 1ª mão da direção: `DT-RBAC-V2-…-STRUCTURALLY-DEAD` reconfirmado (cadeia até `RETURN FALSE` na migration, 59 arquivos de rota usando `requirePermission` hoje).

> **POR QUE ESTE PAINEL EXISTE:** o `PLANO_RECUPERACAO.md` abre com o diagnóstico *"o cartório virou memória, não painel executivo"* — sendo append-only, a mesma frente aparece várias vezes com estados diferentes. Este arquivo é o corte transversal que faltava. **É índice, não fonte:** a verdade de cada item continua no cartório e nas normas.

---

## ✅ RESOLVIDO NO MESMO DIA — a Lei que mandava apagar o banco oficial

**`DT-LAW-MANDATES-DROPPING-OFFICIAL-DATABASE`** · achado pela instância GUARDIÃO em
2026-07-30, confirmado de 1ª mão pela direção, **corrigido com autorização de Clayton no mesmo
dia**. A regra passou a nomear **banco EFÊMERO** e a proibir explicitamente o oficial; o
histórico da correção ficou dentro da própria Lei.

⏳ **PENDENTE:** a Lei segue **sem enforcement** — nenhum guard verifica a REGRA DE AMBIENTE.
Invariante proposta: *todo `.ps1` que faz `CREATE DATABASE` declara `EXPECTED_DATABASE_NAME`*
(2 violações reais achadas em 2026-07-29, uma delas quebrando harness). Sem isso, a Lei é texto.

<details><summary>Registro do que a Lei dizia antes (histórico)</summary>

`docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md:196-206` — nível 2 de precedência, abaixo
apenas da Constituição:

```powershell
## REGRA DE AMBIENTE (CRÍTICA)
> OBRIGATÓRIO: Execução de migrations somente em ambiente recriado do zero.

# SEMPRE antes de rodar migrations
dropdb -h localhost -U postgres unificard_dev
createdb -h localhost -U postgres -E UTF8 unificard_dev

Execução fora de ambiente recriado = VIOLAÇÃO
```

🔴 **A Lei NOMEIA o banco oficial.** Um agente **cumprindo a norma** — que é exatamente o que o
protocolo exige dele — destrói:

| dado | medido em 2026-07-30 |
|---|---|
| bairros oficiais de Curitiba (N3 selada, *"NUNCA recarregar"*) | **75** |
| `economic_policies` | **48** |
| `actor_capability_grants` | **3** |
| `regional_fund_accounts` | **1** |

⚠️ **Colide frontalmente com `DT-OFFICIAL-DATABASE-LOCK-FAIL-CLOSED`** (selado em 2026-07-29),
que fez de `unificard_dev` o banco **oficial e protegido**, com trava fail-closed em `migrate.ts`
e no boot. **Duas normas, sentidos opostos, e a mais antiga manda destruir.**

🔴 **NÃO é a direção quem corrige.** Alterar Lei é ato de Clayton. A direção **não editou** a
norma — registrou, escalou e apontou daqui e do `CLAUDE.md`.

**Correção aplicada em 2026-07-30** (autorizada por Clayton): a regra passou a valer para
**banco efêmero**, com proibição explícita do oficial. **Não houve regressão** — `unificard_dev`
tinha 548 migrations acumuladas e os 75 bairros vivos, o que prova que o texto **já não era
seguido**; e a garantia protegida (schema determinístico do zero) é exercida pelos **216
harnesses** e vigiada por `audit-migration-runner-isolation.mjs`, dentro do runner.

</details>

## 🔴 VIVA E DEMONSTRADA — alguém provou que quebra hoje

| ID | O que é | Tipo | Prova |
|---|---|---|---|
| **Gate `schema-coherence` nunca verde** | 🔄 **remedido 2026-07-30: 1928**, não 1978. `scripts/validate-schema-code-coherence.mjs`, cabeado em `backend/package.json:146`, **fora do runner e do CI**. 🔴 **O gate ESCONDE a própria lista** (`slice(0,5)` + *"e mais N"*, linhas 853-874) — não há flag, env nem modo que mostre tudo; auditá-lo exige reescrever o script. 🔴 `CORRUPTOR` reprova igual a `BLOCKER` (`:903-905`), o nome engana. Composição: **1241 (64%) em `backend/src/scripts/`** (harnesses, não superfície viva) · ~80 são **bugs do próprio parser** (`information_schema`, CTE) · ~600 candidatos reais. **"Religar custa ~zero — só wiring" é FALSO** | **CAUSA-RAIZ** de C3/C13 seguirem vivas sem ninguém notar | medido pela direção 2026-07-30 |
| ~~**`DT-RBAC-V2-REQUIRE-PERMISSION-DECORATOR-STRUCTURALLY-DEAD`**~~ | 🔄 **RECLASSIFICADO 2026-07-30 → DESENHO, NÃO DÍVIDA.** Ver seção dedicada abaixo | — | — |
| ~~**`DT-SOCIAL-IMPACT-BALANCE-UPSERT-42P10`**~~ | ✅ **RESOLVIDA** no commit `66cf49eee` — linha estava desatualizada aqui até 2026-07-30 | — | ver "JÁ RESOLVIDAS" |
| ~~**`event_custody` sem tabela**~~ | ✅ **CONTIDA 2026-07-30** — as 3 rotas que faltavam (`POST /advance` `:2639` · `GET /custody` `:2822` · `GET /split` `:2977`) ganharam o 501 da `DECISION-0190`; **11/11 agora**, verificado pela direção com o mesmo script que achou as lacunas. ⚠️ **NÃO é conserto — é contenção de decisão já selada.** A tabela segue inexistente; religar `economic/v2` exige GO próprio. 🔎 **Bônus:** o `POST /advance` tinha um **segundo** defeito não previsto no pacote — `coluna "status" não existe` em `payment_intents` — agora atrás do 501, **drift de schema NÃO resolvido** | — | Yala achou · executora conteve |
| <details><summary>histórico da derrubada</summary> | ⚠️ **RECLASSIFICAÇÃO DA DIREÇÃO DERRUBADA PELA YALA (2026-07-30), confirmada de 1ª mão.** A direção conferiu o 501 do **POST** `custody` e **generalizou para as 11**. Errado: **`GET /:eventId/economic/v2/custody` (`event.routes.ts:2812`) NÃO tem 501 e NÃO tem `preHandler`** — chama `listCustodiesByEvent` (`:2834`) → `SELECT * FROM event_custody` → tabela inexistente → **500 para qualquer autenticado do tenant**. `event_custody` **É dívida viva** </details> | — | Yala, 2026-07-30 |
| **Painel econômico A-1** | 🔄 **CORRIGIDO 2026-07-30 — a alegação estava meio errada, e a metade errada era a que assustava.** ❌ **NÃO "paga mais que o total"**: o resolver lança `CALCULATION_INVALID` quando o split fica negativo (`economic-policy-engine.service.ts:292-298`) — **provado por execução**, 4 cenários. ✅ **Verdadeiro:** policy inválida **publica limpa** e só falha em tempo de PAGAMENTO. ✅ Parte já consertada: a exigência de linha `revenue_share` **saiu** do `if (hasBpsLine)` (`economic-policy-write-validation.ts:209`). ⚠️ **O resíduo não é conserto de código — é DECISÃO**: soma de linhas fixas contra o total **não é validável na escrita**, porque o valor da transação é desconhecido ali. ⚠️ FE **não** reverificado | **FALHA TARDIA**, não perda de dinheiro | provado 2026-07-30 |
| **`C3-actors-insert-fora-writer`** | `identity.service.ts:313` faz `INSERT INTO actors` fora do writer canônico. Alcance hoje **baixo** | CAUSA | `allowlist:8-16` |
| **`C13-bank-reads-fora-modulo`** | ~15 arquivos leem `bank_*` fora de `modules/bank`. Escopo **CRESCEU** em 28/07 | CAUSA | `allowlist:18-26` |
| ~~**`F-EVENT-CREATION-CONTRACT-SWEEP`** (metade-rota)~~ | ✅ **RESOLVIDA 2026-07-31** — os 2 `navigate` passaram a apontar para `/events/:id` (rota real). A executora achou que **um dos dois era MINA, não caminho**: `Step7FinalSummary` só desestruturava `onAdvanceToEconomic`, então `handleStep7Complete` nunca era clicado — o footer fixo só tem Cancelar/Voltar. Corrigidos os dois. Prop renomeada `onAdvanceToEconomic` → `onFinish`; CTA *"Avançar para Fase Econômica"* → *"Ver Evento"*; e o aviso ao usuário **deixou de prometer** *"criar custódia, calcular split e autorizar pagamentos"* — exatamente o que a `DECISION-0190` recusa com 501. Guard `audit-economic-v2-containment.mjs` ganhou cross-check de frontend; vermelha independente da direção pelo **outro** arquivo confirmou. ⚠️ **Validação visual final continua com Clayton** — não há infra de teste de navegador no projeto | — | 2026-07-31 |
| <details><summary>histórico da derrubada</summary> | ⚠️ **DERRUBADA PELA YALA (2026-07-30), confirmada de 1ª mão.** A direção disse *"varredura do `frontend/src` não achou nenhum caller"* — **a varredura foi TRUNCADA** (`Select-Object -First 10`) e a conclusão saiu de lista parcial. Existem **DOIS callers vivos**: `EventCreationGuidedFlow.tsx:399` (botão Finalizar da etapa 7) e `:619` (`Step7FinalSummary`), ambos `navigate('/events/${id}/economic')`. `App.tsx` registra `events/:id` (`:343`) e `events/new` (`:344`), **NÃO** registra `events/:id/economic`, e **não há catch-all** → **TELA BRANCA no fim do fluxo guiado de criação** </details> | — | Yala, 2026-07-30 |
| ~~`F-EVENT-…` (metade-coluna `event_type`)~~ | ⚪ **DESENHO** — reclassificação **mantida de pé pela Yala**: `event_type` órfão é **desenho** (Lei 7, `event.service.ts:188`, F-EVENT-CONCEPT-FIRST-MODEL). ⚠️ Yala mediu migração **parcial**: `event_format_concept_id` em 5/20 eventos, `event_type` em 9/20 | — | — |
| 🆕🟡 **`DT-ECONOMIC-POLICY-PANEL-FE-BE-DIVERGENCE`** | Yala auditou a metade FRONTEND que a direção declarara **não auditada**. `EconomicPoliciesPage.tsx:464` — `sumOk = bpsLines.length===0 \|\| …` e `canSubmit` exige `sumOk`: policy **só-fixa sem `revenue_share` mostra VERDE e é submetível**, e o backend rejeita com 400 (exigência incondicional em `economic-policy-write-validation.ts:209`). **Fail-closed**, mas o painel promete o que o backend recusa | SINTOMA | Yala, 2026-07-30 |
| 🆕🔴 **`DT-ALERTS-SUBSTRATE-MISSING-BREAKS-ARTIGO-II`** | **A cadeia constitucional do conflito está SEM SUBSTRATO.** `ARTIGO II` exige *conflito → fato → alerta → humano*; `modules/automation/alert.repository.ts` escreve em `alerts` (`:61` INSERT · `:112` UPDATE · `:154,:173,:231` FROM) e a tabela vive **só em `migrations_archive/0850`**. ⚠️ **`financial_alerts` NÃO é substituto** — está em `migrations/0033`, é 800 migrations **mais antiga** e sempre existiu; são coisas diferentes que coexistiram. Achado pela instância GUARDIÃO; a direção havia classificado errado como "estreitamento de domínio" | CAUSA | confirmado 2026-07-30 |
| ~~**`DT-DB-RESET-SCRIPT-TARGETS-OFFICIAL-DATABASE`**~~ | ✅ **RESOLVIDA 2026-07-30** (`3b695efd1`) — recusa fail-closed em duas camadas ANTES de conectar: nome oficial rejeitado + alvo sem `EXPECTED_DATABASE_NAME` rejeitado, reaproveitando `OFFICIAL_DATABASE_NAME`. Direção rodou o script contra o banco oficial de verdade: recusou, `exit 1`, dado idêntico antes/depois (`75 · 48 · 3 · 1`). Guard `audit-environment-rule-enforcement.mjs` no runner | — | — |
| 🆕🔴 **`DT-SERVICE-BUNDLE-READ-ROUTES-NO-AUTHORIZATION`** | **AUTORIDADE.** `service-bundle.routes.ts` tem **4 rotas e ZERO `preHandler`/`requirePermission`**. A checagem (`authorityService.canPerformAction`) vive **dentro do service, só nos 2 POSTs**. Os 2 GETs (`/service-bundles/:bundleId/bookings` `:107` e `/can-confirm` `:129`) filtram **apenas por `tenant_id` + `bundleId`** — **não verificam se quem pede participa do bundle**. Qualquer autenticado do tenant que obtenha um `bundleId` lê os bookings alheios (`serviceId`, `status`). O UUID não é adivinhável, mas **ID opaco não é autorização** — e no fluxo RFQ esses IDs circulam entre atores. Achado pela executora, confirmado de 1ª mão | CAUSA | 2026-07-30 |
| 🆕🔴 **`DT-CONTAINMENT-WITHOUT-DEADLINE`** | **125 respostas `501` em 50 arquivos** de backend (marketplace 22 · eventos 21 · unifybank 7 · companies 6 · profile 5). **De 43 arquivos com 501, apenas 1 declara PRAZO.** Contenção sem data não é contenção — é **abandono com status code melhor**. O `REBASE-03` foi a maior delas: arquivou 313 migrations e adiou a varredura do código; **a conta chegou 5 meses e meio depois** | **CAUSA-RAIZ de processo** | medido 2026-07-30 |
| ~~**`DT-SERVICE-BUNDLE-BOOKINGS-GHOST-TABLE-LIVE`**~~ | ✅ **RESOLVIDA 2026-07-30** — relocação pura, 2 linhas: `getBundleBookings` passou a ler de `bookings` com `metadata->>'serviceId'`. Prova de ida-e-volta 5/5 reexecutada pela direção. Guard `audit-service-bundle-write-authorship-binding.mjs` estendido (§7), vermelha independente confirmada. ⚠️ **CONTER ERA PROIBIDO AQUI — o frontend usa.** `frontend/src/api/service-bundles.ts:100` chama `/service-bundles/:id/bookings`, consumido por `ServiceBundleBookingModal.tsx` e pelo fluxo RFQ (`EventRFQConvertToBundleModal`, `EventRFQQuotesPage`). Funcionalidade **montada ponta a ponta** que devolve 500. **O ÚNICO da cauda do REBASE-03 que NÃO está mascarado.** `GET /services/service-bundles/:bundleId/bookings` (`service-bundle.routes.ts:107-114`) → `getBundleBookings` → `SELECT … FROM service_bookings` (`service-bundle.service.ts:290`). Tabela **não existe**. Módulo registrado em `app.builder.ts:569` (`protectedScope`, prefix `/services`), **ZERO `requirePermission`, ZERO contenção** → **qualquer usuário autenticado recebe 500 (42P01)**. ⚠️ `bookings` (vivo) **não serve de substituto**: não tem `service_id`. Os outros 3 endpoints do arquivo não tocam a tabela | CAUSA | verificado de 1ª mão 2026-07-30 |
| 🆕 **`DT-REPORTS-PREFIX-COLLISION`** | **`/reports` registrado 2×**: `core/reporting` (denúncia) em escopo **PÚBLICO** (`app.builder.ts:257`) e `modules/reports` (financeiro) em **protectedScope** (`:716`). Não quebra o boot hoje, mas `GET /reports/:id` público casa com qualquer segmento | CAUSA | medido 2026-07-30 |
| 🆕 **`DT-REPORTING-CHANNEL-DEAD-PUBLIC-SCOPE`** | Canal de denúncia **100% morto**: fora do `protectedScope`, `preHandler` exige `req.user`/`req.tenant` que só existem lá → **401 sempre**. Atrás dele, 3 tabelas que nunca existiram | CAUSA | `DECISION-0195` (não-selada) |

## 🧨 A CONTENÇÃO QUE SUSTENTA O PESO — `actor_has_permission` e a FASE 6

**Verificado de 1ª mão pela direção em 2026-07-30, contra o `unificard_dev` e o código vivo.**

A função SQL `actor_has_permission` no banco oficial faz **`RETURN FALSE` incondicional**.
Cadeia completa, cada elo lido:

```
fastify.requirePermission([...])        plugins/rbac.plugin.ts:145
  → rbacService.actorHasAllPermissions  core/rbac/rbac.service.ts:165
    → actorHasPermission                core/rbac/rbac.service.ts:173
      → SELECT actor_has_permission()   core/rbac/rbac.service.ts:124
        → RETURN FALSE  (incondicional) unificard_dev, função viva
          → throw forbidden             plugins/rbac.plugin.ts:181
```

**Alcance medido: 176 chamadas em 44 arquivos de rota** (fora de `scripts/`).

🔄 **ISTO É DESENHO, NÃO DÍVIDA.** A própria função documenta: *"FAIL-CLOSED: sem
implementação real de permissões, nenhuma permissão é concedida"*, citando
`AUTHORITY_PRECEDENCE.md §4.4` e nomeando a **FASE 6** como quem substitui. Pela regra do
vocabulário de dívida (*dormente por decisão não é dívida — procure a decisão antes*), a
classificação anterior como CAUSA/dívida viva estava **errada**. Corrigido aqui.

🧨 **MAS É CONTENÇÃO QUE SUSTENTA O PESO, E ISSO É O QUE IMPORTA.** Enquanto ela nega tudo,
qualquer defeito atrás daquelas 44 rotas fica **mascarado**. Caso concreto e provado:
`modules/bank/bank-reconciliation-history.repository.ts:87` faz `INSERT INTO
bank_reconciliation_history` — **tabela que não existe** (0 em `pg_class`, zero
`CREATE TABLE` nas migrations) — alcançável por
`core/unifybank/bank-balance-consolidation.routes.ts:167`, registrada em
`unifybank.module.ts:62` sob `/finance`, exigindo `admin:view_consolidated_balance`, que
**NÃO está** em `PORTA_HOLD_KEYS`. Hoje dá 403 antes do 500. **No dia em que a FASE 6
entregar o RBAC real, isso vira 500 vivo** — junto com o que mais estiver atrás das outras
43 rotas, que ninguém inventariou.

⚠️ Agravante: três harnesses e2e substituem `requirePermission` por um no-op que **libera
tudo** (`validate-pipeline-e2e-events-reputation-locations-ghost-containment.ts:141`,
`...-social-work-payment-ownership.ts:76`, `...-reports-transfers-sla-representation.ts:54`).
É o **fixture que exclui o problema por construção** — a suíte é estruturalmente incapaz de
pegar defeito de autorização nessas rotas.

🔴 **REGRA OPERACIONAL:** **ninguém encosta na FASE 6 do RBAC antes do
`F-SCHEMA-GHOST-REACHABILITY-SWEEP`.** Implementar o RBAC real sem saber o que está atrás
daquelas 44 rotas acende tudo de uma vez, em produção, sem inventário.

## 🟠 VIVA MAS CONTIDA — e **por quê** está contida

**Cluster PORTA-1** — contido por **ledger vazio + firewall default-OFF**, *não* por desenho à prova de semeadura. Dentro: sink `executePayment` sem firewall interno (4 callers) · **Core de Aprovação Financeira** com MODEL vivo e EXECUTION HOLD, embora `DECISION-0128` o exija para todo movimento · split-engine stub · **≥8 callers do sink sem firewall** · e o vão `DECISION-0194` selada × código (sem trava de base única, motor ignora `applies_to`, allowlist vazia, agrupador multi-base vivo).

**`DT-BANK-SPLIT-ENGINE-LEGACY-NATIONAL-FUND-LANDMINE`** — 70/3/10/17 num fundo nacional único, sem território. Contido por **tripwire guard**, não por decisão.
**`DT-UNIFYBANK-CORE-DIRECT-BANK-LEDGER-SQL`** — ⚠️ **é o MESMO defeito que `C13`**, rastreado em dois sistemas.
**`H3` regional-fund-governance** — motor de voto lê fundo nacional legado, não os territoriais. **O comentário MENTE:** alega filtrar por região e a query não filtra.
**`neighborhood` como base de fundo** — HOLD 501 com justificativa **parcialmente vencida** (N3 selou os 75 bairros), mas o resolver nunca foi religado.
Mais: `DT-ACTOR-EFFECT-INBOX-PROJECTOR-UNSUBSCRIBED` · `DT-NOTIFY-SUBSTRATE-SCHEMA-GHOST` · `DT-GROUP-EVENTS-BINDING-DRIFT-SILENT-FAILURE` · `DT-EVENTS-SPRINT76-TICKET-SALE-REPOSITORY-SCHEMA-DRIFT` · `DT-EVENT-ENGINE-NAMING-CONVERGENCE-RESIDUAL`.

## ⚪ DORMENTE POR DECISÃO — **não é dívida**

> ### ⚖️ AUDITORIA YALA — 2026-07-30 · VEREDITO **B** · DUAS RECLASSIFICAÇÕES CAÍRAM
>
> A direção tirou 4 itens da lista viva. Clayton advertiu: *"resolver as dívidas, não varrer
> para debaixo do tapete."* A Yala foi mandatada a **derrubar**, e derrubou **2**:
>
> | item | veredito |
> |---|---|
> | ① RBAC `requirePermission` = desenho | **DE PÉ** — atacou o `SHADOW_DENY_LEGACY_ALLOW` e provou ser ruído esperado, não bypass |
> | ② `event_custody` = dormente | 🔴 **DERRUBADA** — o **GET** custody não tem 501; 500 vivo |
> | ③ Painel A-1 = falha tardia, não perda | **DE PÉ (dinheiro)** — refez a aritmética do zero com fixtures hostis; a plataforma nunca paga a mais |
> | ④ `F-EVENT-SWEEP` = desenho | 🔴 **DERRUBADA na metade-rota** — 2 callers vivos, tela branca. Metade-coluna de pé |
>
> 🔴 **AS DUAS QUEDAS SÃO O MESMO ERRO DA DIREÇÃO — E É O ERRO QUE ELA PASSOU O DIA
> CRITICANDO NOS OUTROS:** em ②, contou 11 rotas e 16 ocorrências da string `501` e
> **generalizou sem abrir as 11**; em ④, rodou um grep com `Select-Object -First 10` e
> **concluiu "nenhum caller" a partir de lista truncada**. Nos dois casos: **amostrou e
> generalizou.**
>
> ⚠️ **Achado adicional da Yala, que o painel omitia:** `requireRole` usa **outra** função —
> `actor_has_any_role` — que é query **real e CONCEDE** (1 admin vivo em `user_roles`, 10 rotas
> usam). A seção *"contenção que sustenta o peso"* descrevia só `requirePermission` e por isso
> **subestima o alcance quando a FASE 6 religar**.
>
> **Não auditado pela Yala (declarado):** backend/HTTP real não subiu — o 500 e a tela branca
> vêm de caminho de código + query real + registro de rotas; ~8 rotas `economic/v2` não foram
> abertas quanto a efeito antes do 501.
>
> ### 🔴🔴 QUATRO DAS SETE ALEGAÇÕES DO PAINEL NÃO SOBREVIVERAM À CONFERÊNCIA (2026-07-30)
>
> | alegação original | o que a verificação achou |
> |---|---|
> | `DT-RBAC-V2` — *"44 arquivos de rota o usam"* | **desenho** — fail-closed documentado, FASE 6 nomeada |
> | `event_custody` — *"500 garantido em qualquer caminho vivo"* | **11 rotas com 501** como primeira instrução |
> | `Painel A-1` — *"paga mais que o total"* | resolver **recusa split negativo**; falha tardia, não perda |
> | `F-EVENT-CREATION-CONTRACT-SWEEP` — rota ausente + coluna órfã | rota **sem caller**; coluna **superada por Lei 7** |
>
> 🔴 **As quatro eram alegações sobre CONSEQUÊNCIA, e as quatro foram escritas parando no
> `INSERT`, na chamada ou na ausência** — sem seguir até o guard, o 501, a validação final ou o
> caller. **Ler até a query prova que a query existe; não prova o que acontece quando ela roda.**
>
> ⚠️ **Isto é achado sobre o PAINEL, não sobre o código.** Uma taxa de 4 em 7 significa que
> nenhuma linha daqui deve virar fatia sem reconferência — e que a coluna "Prova" precisa citar
> **o caminho até o efeito**, não o `arquivo:linha` da query.
>
> ### 🔴 RECLASSIFICAÇÕES — o que saiu da lista viva
> `DT-RBAC-V2-…-STRUCTURALLY-DEAD` e `event_custody sem tabela` estavam listadas como **VIVAS E
> DEMONSTRADAS**. Ambas são **DESENHO**: a primeira é fail-closed documentado, a segunda é
> contenção 501 selada pela `DECISION-0190`.
>
> **As duas tinham alegação de alcance no painel — *"44 arquivos de rota o usam"*, *"500
> garantido em qualquer caminho vivo"* — e as duas alegações eram FALSAS.** Ninguém tinha
> seguido a cadeia até o fim; seguiram até o `INSERT` e pararam.
>
> ⚠️ **"Referencia tabela que não existe" não é alcance. Alcance é rota registrada, sem 501 e
> sem deny antes da chamada.** Enquanto o painel não separar as duas coisas, ele vai continuar
> inflando o número que dirige o trabalho — e fatia gasta em dívida inexistente é fatia que não
> foi gasta na real.

Migration N1 `20260713140000` (`IGNORED_MIGRATIONS`) · `group_actor_memberships`/`group_institutional_bindings` (D9.2-A selada; cutover = D9.2-B) · **4e** `tax_reserve` (firewall OFF, caller 0) · `economic/v2` 501 (`DECISION-0190` selada) · **B-CITY-2** (aguarda GATE registrado) · `/cta` + `social_ledger` (hard-block por desenho) · semear saldo (Clayton: *"só mecanismo por ora"*) · L2.4 (adiada por Clayton) · `DECISION-0192/0193` (não-seladas — doutrina pendente, não dívida de código).

## ✅ JÁ RESOLVIDAS — não reabra

**2026-07-30 · `DT-AUTH-RATE-LIMIT-FAIL-OPEN-SUBSTRATE-AUSENTE`** — `auth_rate_limit_logs`
**nunca existiu**; o `catch` de `countByKey` engolia o 42P01 e devolvia 0 → `allowed:true`
sempre. Login, registro, check-cpf, check-referral, webauthn e refresh estavam **sem
proteção de força bruta**, em rota **pública** (não passa por `requirePermission`, nada os
continha). Migration `20260729160000`, colunas em `attempted_at` (o código usava
`attemptedAt` não-quotado, que Postgres dobra), `catch` agora **loga alto** mantendo
fail-open, guard `audit-auth-rate-limit-substrate.mjs` no runner. **Prova comportamental
verificada de 1ª mão pela direção: HTTP 429 na 6ª tentativa**, 5 linhas gravadas, harness
efêmero PASS 6/6, zero resíduo. ⚠️ Tabela **sem RLS de propósito** — com RLS a contagem
voltaria 0 sob `pool` cru e o fail-open continuaria invisível; razão gravada no
`COMMENT ON TABLE`.

**2026-07-29 · `DT-OFFICIAL-DATABASE-LOCK-FAIL-CLOSED`** (commit `6414b3404`) — ausência de
`EXPECTED_DATABASE_NAME` era tratada como permissão. Agora recai em `unificard_dev` e
aborta. Fechou também a porta deliberada (`setup-local-demo-db.mjs` recusa) e o convite por
escrito (`RODAR_LOCAL.md`).

`DT-EPHEMERAL-MIGRATION-PROFILE-UNGOVERNED` **(a)+(b)** — ⚠️ **(c) segue OPEN e é o que permite (a)/(b) reincidirem** · **`C4`** paga (⚠️ data real **28/07**, não 29/07 — a instância corrigiu o mandato da direção) · **selo falso nº1** re-fechado de verdade (`3ca1df864`) · **selo falso nº2** fechado via `K_pe_7` — ⚠️ **sub-caso (b) `bps=10000` + linha fixa SEGUE aberto**, atrás do motor byte-pinado · `DT-EVENT-PUBLISHED-UPDATE-ALLOWLIST-CASE-MISMATCH` · `DT-EVENT-CREATE-TIMEZONE-DEFAULTS-UTC` · `DT-EVENT-GUARDS-UNWIRED-FROM-RUNNER`.

## ⏰ PRAZO

**Nenhum item ativo vencido hoje.** `C3`/`C13` com prazo fresco (2026-09-30, owner Clayton).
🔴 **PADRÃO DE RISCO A VIGIAR:** o gate que cobraria esse prazo **não está no runner nem no CI**. Nada cobra automaticamente — é o mesmo mecanismo que deixou 10 entradas vencerem 57–89 dias sem ninguém notar.

## 🔗 MESMA CAUSA, NOMES DIFERENTES

1. **`C13` ≡ `DT-UNIFYBANK-CORE-DIRECT-BANK-LEDGER-SQL`** — mesmo defeito, dois sistemas de rastreio (JSON × cartório). **Fundir ou linkar.**
2. **`C4` ≡ `DT-BANK-BALANCE-BY-REGION-READMODEL-METADATA-DESALINHADO`** — mesma coisa, duas etiquetas. Confirmar se o header da segunda foi re-carimbado.
3. `AUDIT-004` **é** a 6ª ocorrência que `ROOT-004` previa — agrupamento por causa-raiz funcionando (`§B.10`), não duplicata.
4. **Processo, não código:** os dois selos falsos compartilham a mesma causa — selo sem reprodução adversarial independente e sem entrada cartorial da correção.

---

## ⚠️ NÃO CLASSIFICADO (declarado, não inferido)

`REMEDIATION_DT_LOG.md` linhas **~1460–21654** (~20 mil) não lidas narrativamente. Três clusters densos de `DT-*` nomeados: **(a)** RLS/tenant-isolation · **(b)** ERP/CRM/marketplace · **(c)** payout E2E (aparentam CLOSED pelos cabeçalhos, não confirmado). A memória sugere que (a) e (b) já têm frentes fechadas — **NÃO reverificado**. Painel 100% completo exige passada dedicada a partir da linha 1461.

Também fora: `dividatecnica.md` linhas 300–2534.
