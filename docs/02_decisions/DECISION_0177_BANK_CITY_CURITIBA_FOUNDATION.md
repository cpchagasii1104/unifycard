# DECISION-0177 — Fundação Bank City Curitiba: residência actor-scoped, provisionamento municipal inerte, Curitiba-only e bloqueio fiscal da ativação monetária

**Status:** DECIDIDA · DOCS-ONLY · MATERIAL NÃO INICIADO · ATIVAÇÃO MONETÁRIA BLOQUEADA · AGUARDA AUDITORIA YALA
**Data:** 2026-07-14
**Frente:** F-CURITIBA-OPERACIONAL · Ato B-CITY-D
**Base:** `rescue-structural @ 4a3c1836d` (S-CITY-1 selado)
**Insumo:** GATE B-CITY-0 (read-only consolidado, Veredito B, 2026-07-14 — ratificado pela Diretora)

**Deriva explicitamente de:** DECISION-0114 (autoridade inicial do fundo regional = fundador; fundo é da plataforma; delegação futura aberta) · DECISION-0165 (pipeline financeiro canônico único `economic_policy_engine` → `createTransactionWithExplicitSplitLines`; jurisdição = endereço cadastral do comprador; D6 sem retarget retroativo) · DECISION-0166 (origem regional D0 payer-residence; `regional_level` D2; `regional_fund_accounts` por FK D3; snapshot imutável + `policy_version_id` D5; cascata fiscal D7; Lei do Contador D9 e trava D9.7) · DECISION-0167 (motor de provisão fiscal; bases `gross_transaction`/`commission_gross`/`commission_distributable`; 4d TRANCADA por GO próprio) · DECISION-0175 (nacional trancada; IBGE fonte primária; fronteira Territory×Bank) · DECISION-0176 (Social City; fronteira negativa Social×Bank; padrão Curitiba-only por ID canônico) · arco selado Address/onboarding actor-scoped (casa `ACTOR_RESIDENCE` + `resolveActorTerritory`) · SSOT Bank/ledger (SSOT_REGISTRY §5; LEI §4.6-4.7) · Location Core (countries/states/cities FK canônica) · 08_AUTORIDADE_CANONICA + ACTOR_TRACEABILITY_CONTRACT (§4.8.5 actors de sistema) · PROHIBITED_STRUCTURES (autoridade não emerge de estrutura).

---

## D0 — Escopo

Esta DECISION governa **somente**: Curitiba; nível territorial `city`; o fundo municipal **da plataforma**; conta e mapping **inertes**; e a preparação normativa do pipeline futuro.

**Não governa:** bairro; outras cidades; expansão nacional; policy regional ativa; split; ledger; saldo; payout; gasto comunitário; representantes; painel administrativo; frontend.

**Schema genérico ≠ ativação nacional.** A existência de `regional_fund_accounts` com `scope_level` extensível não ativa nenhum território. DECISION-0175 permanece trancada.

## D1 — SSOTs e jurisdições

| Verdade | Casa soberana |
|---|---|
| Actor comprador | `actors` |
| Residência vigente | `addresses` + `address_assignments` (`owner_type='actor'`, purpose `ACTOR_RESIDENCE`) |
| Cidade | Location Core / `cities` |
| Mapping cidade→conta | `regional_fund_accounts` |
| Conta e saldo | `bank_accounts` + `bank_ledger` |
| Policy | `economic_policies` + `economic_policy_lines` (versão ativa imutável) |
| Snapshot financeiro | `bank_splits.jurisdiction_snapshot` |

**Proibições vinculantes:** `profile` como autoridade financeira; Social como autoridade financeira; `posts.audience_city_id` como origem do fundo; `owner_id` textual como verdade territorial; frontend escolhendo cidade ou conta; Address writer chamando Bank; trigger Territory→Bank.

## D2 — Origem regional do comprador

Para comprador PF: `regional_origin_basis='payer_identity_residence'` (reusa vocabulário DECISION-0049/0166 D0; nada novo).

Resolução canônica futura (a materializar em B-CITY-1):

```
tenantId + payerActorId
→ resolveActorTerritory(tenantId, payerActorId, 'ACTOR_RESIDENCE')
→ city_id canônico
```

**Cravado:** `payerActorId` explícito no pipeline; a origem é o **comprador**, nunca o vendedor; residência **vigente no instante da operação**; **sem** fallback `profile`; **sem** `actor_active_location`; **sem** endereço textual; **sem** CEP; **sem** sessão; **sem** cidade declarada pelo cliente; erro de infraestrutura **propaga** (nunca vira ausência silenciosa).

Comprador sem residência actor-scoped: `POLICY_REGIONAL_ORIGIN_UNRESOLVABLE` → **a operação inteira falha antes de qualquer write** financeiro (preserva o fail-closed já vivo). Não criar suspense nem fallback nesta fase.

## D3 — Legado profile/RESIDENCE

Os 2 registros `profile/RESIDENCE` existentes (DECISION-0074) são **legado preservado, não SSOT financeiro**. Decidido: **não migrar** nesta DECISION; **não backfillar** automaticamente; **não** migrate-on-read; **não aposentar destrutivamente**; **não usar no money path**; **não usar como fallback**; preservar para compatibilidade histórica e testes legados.

O onboarding PF vigente continua criando residência **actor-scoped** (arco selado). A ausência atual de linhas `actor/RESIDENCE` no sistema virgem (0 linhas provadas no GATE) é **estado legítimo e fail-closed** — não é autorização para recorrer ao profile.

**Nova DT registrada:** `DT-BANK-REGIONAL-ORIGIN-PROFILE-ACTOR-DIVERGENCE` — o money path vivo (`resolveRegionalFundDestination`) ainda lê `findPrimaryAddressByOwner('profile', …, 'RESIDENCE')`; o Social lê `ACTOR_RESIDENCE`. Status: **DECIDIDA NORMATIVAMENTE · MATERIALMENTE ABERTA · BLOCKING B-CITY-1**. Fechamento previsto no envelope de fundação inerte.

## D4 — Provisionamento prévio e inerte

**Escolha vinculante: a conta municipal deve ser provisionada ANTES do money path.** O money path futuro é **lookup-only**:

```
Curitiba city_id → regional_fund_accounts → bank_account_id
```

Ausência de mapping: `REGIONAL_FUND_ACCOUNT_NOT_PROVISIONED` → falha **antes** de `bank_transactions`/`bank_ledger`/`bank_splits`.

**Proibido:** auto-create durante pagamento; get-or-create no money path; criação silenciosa por policy; criação automática por Address; criação automática por residência; criação automática por frontend.

**Nova DT registrada:** `DT-BANK-REGIONAL-FUND-AUTOPROVISION-IN-MONEY-PATH` — `ensureRegionalFundAccount` hoje faz get-or-create dentro de `resolveRegionalFundDestination` (provado no GATE). Status: **DECIDIDA NORMATIVAMENTE · MATERIALMENTE ABERTA · BLOCKING B-CITY-1**.

## D5 — Forma da conta municipal

A conta de Curitiba: `owner_type='system'`, `actor_id=NULL` (coerente com ACTOR_TRACEABILITY §4.8.5 e o padrão vivo das 11 contas system).

O `owner_id` é **rótulo técnico determinístico**: não decide território; não decide autoridade; não decide saldo; não substitui `regional_fund_accounts`.

Mapping canônico: `tenant + scope_level='city' + country_id (Brasil) + state_id (Paraná) + city_id (Curitiba) → bank_account_id`. Uma cidade tem no máximo **uma** conta regional (`uq_rfa_scope`); uma conta regional pertence a no máximo **um** território (`uq_rfa_bank_account`).

A conta **nasce com saldo zero** porque não existe ledger. **Não semear saldo.**

## D6 — Autoridade do provisionamento inicial

Ratifica DECISION-0114: o fundo é **da plataforma/sistema**; nenhuma empresa é proprietária; nenhum morador é proprietário; nenhum representante territorial controla a conta; **residência não concede autoridade financeira**.

Para o MVP Curitiba, o primeiro provisionamento é um **ato único** com `authority_source='platform_bootstrap'`. Responsabilidade humana: **fundador/criador Clayton**, resolvido pelo SSOT Identity + Actor já existente; **sem CPF hardcoded; sem criar identidade ou Actor; sem `admin=true`; sem role textual**. O one-shot futuro é **mecanismo, não autoridade soberana**.

Esse bootstrap autoriza **somente**: criar uma conta system inerte; criar exatamente **um** mapping Curitiba→conta; registrar prova e cartório.

**Não autoriza:** movimentar dinheiro; ler saldo privilegiado; configurar policy; abrir sink; executar split; aprovar gastos; pagar fornecedor; **delegar autoridade**.

`DT-REGION-FUND-DELEGATION-MODEL-PENDING` **permanece OPEN** (não bloqueia o bootstrap inerte único; bloqueia delegação e governança futura). Não criar capability genérica ou delegação financeira nesta fundação. Provisionamentos futuros de outras cidades exigem nova decisão ou modelo de delegação selado.

## D7 — Curitiba-only

O piloto aceita **exclusivamente** o `city_id` canônico de Curitiba: `9d431002-1fd3-4b34-ae82-678f28f64288`.

A futura fundação deve ter: constante **server-side**; validação explícita; guard anti-expansão; mutation trocando Curitiba por outra cidade; **proibição de allowlist por env**; proibição de "qualquer cidade com mapping"; proibição de policy genérica liberar todas as cidades.

`regional_level='city'` **não significa** ativação de todas as cidades (hoje nada restringe a cidade — provado no GATE). DECISION-0175 permanece trancada.

**Nova DT registrada:** `DT-BANK-CITY-CURITIBA-ACTIVATION-MISSING` — mecanismo Curitiba-only inexistente no pipeline financeiro. Status: **DECIDIDA NORMATIVAMENTE · MATERIALMENTE ABERTA · BLOCKING B-CITY-1**.

## D8 — Snapshot financeiro

Quando uma operação tiver **qualquer** linha regional: **todas** as linhas de `bank_splits` da mesma transação carregam a mesma `policy_version_id` **e o mesmo** `jurisdiction_snapshot`. O snapshot representa o **contexto territorial original da operação**, não apenas o destino regional. (Resolve a ambiguidade do estado atual, onde só a linha regional o carrega.)

Shape mínimo: `basis · level · countryId · stateId · cityId` — **somente IDs canônicos**; sem endereço, CEP ou texto livre.

Quando a policy **não** tiver linha regional: `jurisdiction_snapshot=NULL` em todas as linhas.

Mudança posterior de residência: **não retargeta** operação; **não reescreve** split; **não move** saldo passado (0165 D6). Reversal/refund interno: **reutiliza** policy e legs originais; **reutiliza** o snapshot original; **nunca** resolve residência novamente (mecânica já provada no GATE — `loadSplitLegsForReversal`).

A materialização desta regra pertence à **ativação monetária** (F2), não à conta inerte.

## D9 — Base econômica e fiscal

A linha municipal futura deve usar:

```
line_type='regional_fund'
destination_type='regional_fund'
regional_origin_basis='payer_identity_residence'
regional_level='city'
applies_to='commission_distributable'
```

**Proibido para linha regional:** `applies_to='gross'` e `applies_to='net'` — não podem ser usados como solução provisória (hoje o CHECK só tem gross|net e o guard 4c-3 proíbe os valores fiscais **de propósito**; a extensão é a fatia 4d-2).

A ativação monetária **permanece bloqueada** até: (1) motor fiscal 4d (GO próprio D9.7); (2) materialização de `commission_gross`; (3) materialização de `tax_reserve`; (4) materialização de `commission_distributable`; (5) extensão governada de `applies_to`; (6) fiscal 4e end-to-end; (7) abertura específica da PORTA financeira; (8) policy real ativa e auditada.

**Sistema virgem não elimina essa dependência.** Nenhuma policy regional pode ser criada ou ativada no envelope inerte.

## D10 — Resolver por string e paralelos

`regional_fund_accounts` é a **única** casa cidade→conta. O resolver por string `getSystemAccount('regional_fund')` (tenant-level, sem território) **não pode participar** de: Bank City; policy regional; relatórios territoriais; destino de split; provisionamento.

O futuro envelope inerte deverá: remover ou aposentar seu uso regional; convergir leitores de transparência para `regional_fund_accounts`; impedir revival; manter workers e split engine legados default-off. **Não transformar `owner_id` em segunda verdade territorial.**

## D11 — Duas famílias materiais

**F1 — B-CITY-1 · FUNDAÇÃO MUNICIPAL INERTE** — elegível **somente após selo desta DECISION**. Envelope único: convergir money resolver profile→actor-scoped; remover fallback profile; tornar resolver regional lookup-only; remover auto-create do money path; adicionar Curitiba-only; criar one-shot governado; provisionar **uma** conta system inerte; criar **um** mapping Curitiba→conta; convergir/excisar resolver regional por string; integrar guards existentes ao runner; criar guard dedicado e mutations; provar saldo zero e Δbank=0.

F1 **não cria**: policy ativa; transaction; ledger; split; saldo; sink aberto; worker ativo.

**F2 — B-CITY-2 · ATIVAÇÃO MONETÁRIA** — **BLOQUEADA.** Dependências: fiscal 4d; fiscal 4e; `commission_distributable`; `applies_to` material; PORTA financeira; policy regional real; snapshot uniforme (D8); reversals; E2E financeiro completo. F2 exige outro GATE, outra decisão se necessário e **GO próprio**.

## D12 — Guards e provas futuras (contrato de F1)

F1 deverá integrar ao runner os guards standalone existentes: `audit-regional-fund-fk-canonical`; `audit-policy-immutability-and-split-snapshot`; `audit-bank-split-pipeline-consolidation`.

Criar guard dedicado Bank City que prove: actor-scoped only; sem profile fallback; sem auto-provision no money path; Curitiba-only; conta system/`actor_id` NULL; mapping FK único; zero saldo; zero policy; zero split; zero ledger; string resolver fora; N1/bairro/nacional fora; Bank sink fechado.

Mutations hostis mínimas: restaurar profile residence; restaurar get-or-create no pagamento; liberar outra cidade; criar conta ao resolver; usar `owner_id` como cidade; adicionar `actor_id` à conta; semear saldo; criar policy regional; abrir sink; usar gross/net; reviver string regional; tocar bairro.

## D13 — Estado das DTs

```
DT-BANK-REGIONAL-ORIGIN-PROFILE-ACTOR-DIVERGENCE
  DECIDIDA NORMATIVAMENTE · MATERIALMENTE ABERTA · BLOCKING B-CITY-1

DT-BANK-REGIONAL-FUND-AUTOPROVISION-IN-MONEY-PATH
  DECIDIDA NORMATIVAMENTE · MATERIALMENTE ABERTA · BLOCKING B-CITY-1

DT-BANK-CITY-CURITIBA-ACTIVATION-MISSING
  DECIDIDA NORMATIVAMENTE · MATERIALMENTE ABERTA · BLOCKING B-CITY-1

DT-REGION-FUND-DELEGATION-MODEL-PENDING
  PERMANECE OPEN · NÃO BLOQUEIA BOOTSTRAP INERTE ÚNICO
  · BLOQUEIA DELEGAÇÃO E GOVERNANÇA FUTURA

DT-INVOICING-HARDCODED-TAX-RATE
  PERMANECE OPEN EM FRENTE PRÓPRIA
```

A **ativação monetária** fica registrada como **bloqueada por fiscal 4d/4e e pela PORTA financeira**.

---

## Escopo negativo (vinculante)

Zero código · zero migration · zero DDL/DML · zero conta criada · zero policy criada/ativada · zero split · zero ledger · zero seed · zero frontend · Address intocado · Social intocado · bairro/N5 bloqueado · nacional trancado · **Δbank=0**. Material B-CITY-1 TRANCADO até o selo Yala desta DECISION.
