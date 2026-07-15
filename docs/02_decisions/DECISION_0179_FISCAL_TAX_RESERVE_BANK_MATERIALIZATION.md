# DECISION-0179 — Fiscal Tax Reserve Bank Materialization Foundation: casa financeira da reserva fiscal, conservação por bucket, cabeçalho fiscal estável, atomicidade e dormência governada

**Status:** DECIDIDA POR CLAYTON · PROMULGADA DOCS-ONLY · NÃO SELADA · MATERIAL 4E NÃO INICIADO · AGUARDA UMA ÚNICA AUDITORIA YALA
**Data:** 2026-07-15
**Frente:** F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION · Fase Fiscal · Ato DECISION FISCAL-4E
**Base:** `rescue-structural @ c3df312b4` (FISCAL 4D-2 selada)
**Insumo:** GATE FISCAL-4E-0 (read-only consolidado, **Veredito B**, 2026-07-15 — ratificado por Clayton com 2 correções, 13 escolhas, 7 afinações A–G e 3 lembretes L1–L3)

**Deriva explicitamente de:** DECISION-0165 (pipeline canônico D8 `economic_policy_engine` DECIDE → `createTransactionWithExplicitSplitLines` EXECUTA → `bank_transactions`/`bank_splits`/`bank_ledger` PERSISTEM; D6 snapshot+`policy_version_id` por split; base = comissão, nunca bruto) · DECISION-0166 (D7 cascata do valor; D9 Lei do Contador; D9.5.13 `tax_reserve` como materialização futura; D9.7 GO próprio por fatia) · DECISION-0167 (§5 bases; §12 sequência 4d-1→4d-2→**4e**→4f) · DECISION-0178 (4d-2: `applies_to` físico 5 / gravável 3 / legado 2; `FiscalEconomicPolicyCompositionService` evaluation/read-only; `commission_gross = tax_reserve + commission_distributable`) · DECISION-0177 (B-CITY-1 conta system inerte por FK; territórios fiscal×comprador distintos) · DECISION-0052 (estorno split-aware determinístico por snapshot, full-only) · CORE_SPLIT_PAGAMENTO_CANONICO · CORE_ESTORNOS_FINANCEIROS · CORE_PERMISSOES_FINANCEIRAS · SSOT_EXCLUSIVE_BANK_RULE · LEI DE COERÊNCIA §4.6-4.7/§7 · PROHIBITED_STRUCTURES.

---

## PROVA DE RASTREABILIDADE NORMATIVA (00_AGENT_PROTOCOL §2.2.2)

**Domínios tocados (união cautelosa §2.2.6):** FISCAL · FINANCEIRO · POLICY/CONTEXTO · AUTHORITY · ACTOR/IDENTIDADE · TERRITÓRIO · PERSISTÊNCIA · EVENTO/AUDITORIA · NOMENCLATURA · IDEMPOTÊNCIA · REVERSAL · TREASURY.

**Documentos lidos e suficientes:** `00_AGENT_PROTOCOL.md`, `CONSTITUICAO_UNIFICARD.md`, `LEIS_OPERACIONAIS_UNIFICARD.md` (Lei 5 SSOT financeiro; Lei 7 semântica), `SSOT_REGISTRY_UNIFICARD.md` (§5 Bank; §5.16 Authority), `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` (§4.6-4.7 fronteira financeira; §7 composição), `SSOT_EXCLUSIVE_BANK_RULE.md`, `PROHIBITED_STRUCTURES.md`, `CORE_SPLIT_PAGAMENTO_CANONICO.md`, `CORE_ESTORNOS_FINANCEIROS_CANONICO.md`, `CORE_PERMISSOES_FINANCEIRAS_CANONICO.md`, DECISION-0165/0166/0167/0177/0178/0052, e o cartório `REMEDIATION_DT_LOG.md`.

**Precedência aplicada:** Constituição > Leis > SSOT Registry > Ontologia > normas de domínio > decisions > cartório > código > conveniência.

**Pilares afetados:** FINANCEIRO (materialização de split/reserva) · FISCAL (provisão→evidência) · AUTHORITY (treasury-source) · TERRITÓRIO (jurisdição fiscal do contribuinte). **Autoridade legítima do dinheiro** = domínio Bank (SSOT_REGISTRY §5; SSOT_EXCLUSIVE_BANK_RULE).

**Casas e SSOTs:**

| Verdade | Casa soberana |
|---|---|
| Dinheiro (saldo contábil) | `bank_ledger` / UnifyBank |
| Contas | `bank_accounts` (domínio Bank) |
| Transações | `bank_transactions` |
| Splits | `bank_splits` |
| Policy econômica / versão | `economic_policies` (versão = `economic_policies.id`) + `economic_policy_lines` |
| Cálculo fiscal | `modules/fiscal-provision` |
| Logs fiscais por regra | `fiscal_provision_logs` (classe LOG) |
| Perfil fiscal | `actor_fiscal_profiles` |
| Identidade fiscal | `fiscal_identities` (global) |
| Catálogo fiscal | `tax_types` / `tax_rules` |
| Território | Location Core (FK canônica) |
| Autoridade financeira | `actors` · treasury-source governado no sink |

**Declarados NÃO-SSOT financeiro (evidência/prova/causalidade, NUNCA saldo):** `fiscal_reserve_accounts` (mapa por FK, sem saldo) · `fiscal_provision_events` (cabeçalho de execução, append-only) · `fiscal_provision_logs` · fiscal snapshot · `economic_policy_resolution_logs` · composition result · `jurisdiction_snapshot` · invoice · frontend · guard · orquestrador · JSON de evidência.

---

## D0 — ESCOPO DESTA DECISION

Esta DECISION é **docs-only** e promulga a **forma institucional futura** da materialização financeira da reserva fiscal (`tax_reserve`) e da religação canônica do pipeline. Ela **ratifica escolhas**; **não autoriza material 4e**, que exige GO material próprio (D9.7) após o selo Yala desta DECISION.

**Não governa e não autoriza:** código · migration · DDL · DML · criação de `fiscal_reserve_accounts` / `fiscal_provision_events` / conta fiscal / transaction / split / ledger · alteração de `bank_accounts` / `bank_splits` · movimentação de saldo · ativação do firewall · caller monetário · rota · worker · one-shot · fiscal profile real · tax rule real · policy regional · policy admin · PORTA · B-CITY-2 · invoicing · frontend · remittance · refund parcial.

---

## FATOS MATERIAIS DO GATE (fundamento probatório, read-only 2026-07-15)

`tax_types=0 · tax_rules=0 · actor_fiscal_profiles=0 · fiscal_provision_logs=0 · fiscal_identities=4 · bank_accounts=16 · regional_fund_accounts=1 · bank_transactions=0 · bank_ledger=0 · bank_splits=0 · saldo Curitiba=0 · Δbank=0`.

- Único sink monetário = `BankTransactionService`; pipeline canônico de service payment existe mas está **hibernado** por `BANK_TRANSACTION_SINK_FIREWALL_ENABLED` (default-OFF, fail-closed).
- `FiscalEconomicPolicyCompositionService` (4d-2) **sem caller monetário vivo**.
- `bank_splits.split_type` é **TEXT LIVRE, sem CHECK**; `bank_accounts.account_type` tem **CHECK físico de 14 valores**; **nenhuma conta fiscal** e **nenhum token `tax_reserve`** existem no vocabulário Bank; `reserve`/`risk_reserve` são semanticamente **risco**, não fiscal.
- `bank_transactions.reference_id` é **UUID** (não TEXT); `bank_accounts` **não tem coluna currency**.
- `createTransactionWithExplicitSplitLines` **já aceita `existingClient`** (uma tx atômica) e **impõe `Σsplits == amountCents`**; `fiscal-provision`/`appendRows` **abrem conexão própria** hoje.
- Reversal canônico (`reversal.service`) é **split-aware, por snapshot, full-only** (`REVERSAL_AMOUNT_MISMATCH` bloqueia parcial).
- Contribuinte da provisão = **PLATAFORMA por-tenant** (`actor_fiscal_profiles` ativo → `fiscal_identities`); `contributorActorId` nullable/null.

---

## D1 — NATUREZA CONTÁBIL DE TAX_RESERVE

**`tax_reserve` = segregação interna de uma obrigação fiscal estimada.** É **decomposição interna de `commission_gross`**, nunca cobrança adicional; NÃO aumenta `gross_transaction`; NÃO é saldo operacional livre; NÃO é `economic_policy_line`; NÃO é policy configurável; NÃO é imposto pago / recolhimento / remittance / settlement / conta governamental; NÃO usa taxa do invoicing.

Equação vinculante: **`commission_gross = tax_reserve + commission_distributable`**. Apuração definitiva, ajuste, pagamento ao Fisco e conciliação permanecem em frente futura própria.

---

## D2 — CONSERVAÇÃO GLOBAL E POR BUCKET

Duas conservações **cumulativas**:

```text
gross_transaction = seller_or_provider_entitlement + commission_gross
                    + componentes externos explicitamente governados
commission_gross  = tax_reserve + commission_distributable
```

- **`Σ bank_splits = bank_transaction.amount`** preserva **somente a conservação global** (garantida pelo Bank: `createTransactionWithExplicitSplitLines` + trigger `validate_split_total`).
- Essa igualdade **NÃO impede dupla alocação interna da comissão**. A **conservação por bucket** (2ª igualdade + não-consumo do mesmo centavo por linha sobre `commission_gross` e por linha sobre `commission_distributable`) deve ser validada **na camada de composição/conservação, ANTES do sink**, e **provada por guard dedicado**.
- Responsabilidades: o **Bank** garante a conservação global; a **composição fiscal/econômica** garante a interna da comissão.

**Proibido:** reserva por cima da comissão · `commission_gross` materializada integralmente E também decomposta · mesma unidade consumida por linha sobre `commission_gross` e por linha sobre `commission_distributable` · seller/provider absorvendo silenciosamente excesso de alocação da plataforma · clamp para caber · centavos órfãos.

---

## D3 — CONTA FISCAL E TITULARIDADE

Conta futura: **`owner_type='system'` · `actor_id=NULL` · `account_type='fiscal_reserve'`**. É conta system segregada; NÃO é conta de Actor, regional, `risk_reserve`, carteira livre ou settlement externo; NÃO pode ser movimentada manualmente; NÃO atribui ao sistema a responsabilidade fiscal material; responsabilidade econômica permanece **rastreável à identidade fiscal**.

Resolver próprio: **`fiscal_reserve_accounts`** (molde `regional_fund_accounts`: mapa por FK, `UNIQUE(bank_account_id)`, RLS FORCE, **sem saldo**). Chave institucional: **`(tenant_id, fiscal_identity_id, currency)`** com **exatamente um mapping vigente**.

Fixa-se: `currency` vive em `fiscal_reserve_accounts` (**`bank_accounts` não tem coluna currency**); MVP=BRL mas a chave é currency-aware; **a jurisdição fiscal NÃO entra na unicidade da conta** (vive no snapshot da operação — uma identidade fiscal pode mudar perfil/regra sem perder continuidade contábil da reserva); o mapping guarda FK para `bank_account_id`, nunca saldo; cross-tenant proibido; conta não pode ser mapeada ambiguamente a identidades incompatíveis. **Sem lifecycle de remittance nesta tabela.**

---

## D4 — PROVISIONAMENTO LOOKUP-ONLY

No money path: **lookup-only**. Conta/resolver ausente → **`FISCAL_RESERVE_ACCOUNT_MISSING`** ANTES de advisory lock monetário / account lock / transaction / split / ledger / outbox.

**Proibido:** `getOrCreate` · auto-provision · criação durante pagamento · fallback para `reserve` / `risk_reserve` / conta de plataforma / conta regional.

A conta real só poderá ser criada futuramente por **one-shot governado separado** (identidade fiscal válida + perfil fiscal ativo + manifest hash-fixo + token literal + advisory lock + dry-run/rollback + apply único + rerun fail-closed + auditoria própria). **Como o sistema real tem catálogo/perfis vazios, o material 4e NÃO criará conta fiscal real.**

---

## D5 — VOCABULÁRIO DE `bank_splits.split_type`

Novo valor: **`tax_reserve`**. O CHECK futuro de `bank_splits.split_type` = a **união exata do vocabulário `BankSplitType` vivo + `tax_reserve`** (conferido de 1ª mão no schema vivo):

```text
fee · regional_fund · reserve · escrow · revenue_share · referral · tax_reserve
```

**Antes do material, reconfirmar todos os sites reais de INSERT.** Nenhum valor existente pode ser removido; nenhum 8º valor sem nova DECISION; `tax_reserve` é distinto de `reserve` e de `risk_reserve`; free-text deixa de ser autoridade (governança por **CHECK + manifesto + nomenclatura + guard**); `bank_splits=0` hoje torna a adição livre de migração de dados, **mas não dispensa governança**. `tax_reserve` nasce **exclusivamente do motor fiscal** e é materializado pelo Bank — **não pode ser fornecido por policy admin ou caller externo**.

---

## D6 — `account_type='fiscal_reserve'`

Extensão **consciente** do CHECK físico atual de **14 valores** (conferidos de 1ª mão, a preservar exatamente):

```text
credit · user_wallet · escrow_payments · escrow_disputes · seller_pending ·
seller_available · seller_payout · platform_revenue · platform_fees · clearing ·
bank_settlement · adjustment · risk_reserve · actor_wallet
```

O material adicionará **somente `fiscal_reserve`** (15º valor). Não reutiliza `risk_reserve`/`credit`/conta regional; não é conta movimentável por usuário; deve ser registrado em manifesto, nomenclatura e guard. Ao listar os 14 no material, copiá-los **literalmente** do schema vivo.

---

## D7 — `fiscal_provision_events`

Casa futura: **`fiscal_provision_events`** — cabeçalho estável da execução fiscal; append-only; idempotente; evidência fiscal; **não-SSOT financeiro**; **não conhece Bank**; não guarda saldo; não substitui `fiscal_provision_logs`.

Cardinalidade: **`1 bank_transaction → 1 fiscal_provision_event → N fiscal_provision_logs`**.

**Justificativa canônica:** uma referência fiscal **estável** para o Bank + **idempotência no nível da execução** + uniformidade para evolução futura. **NÃO** usar a justificativa incorreta de "provisão válida com zero logs" (não ocorre no substrato atual: missing grava 1 linha; found grava ≥1).

Direções de FK:

```text
bank_transactions.fiscal_provision_event_id → fiscal_provision_events.id
fiscal_provision_logs.fiscal_provision_event_id → fiscal_provision_events.id
```

**Proibido:** `fiscal_provision_events → bank_*` e `fiscal_provision_logs → bank_*`. O domínio fiscal **nunca** conhece tabelas Bank. Uma transaction fiscal obrigatória **não pode existir sem referência fiscal estável**.

---

## D8 — ATOMICIDADE

`fiscal-provision` **e** `appendRows` deverão aceitar **`existingClient`**. A operação futura usará **uma única conexão e uma única transação**:

```text
resolve contributor/profile → create-or-reuse fiscal_provision_event →
calculate fiscal provision → append fiscal logs → resolve economic policy →
compose immutable context → validate global AND bucket conservation →
resolve accounts (lookup-only) → Bank advisory lock → Bank account locks
(canonical order) → bank transaction → bank splits → bank ledger →
snapshots → outbox/event → COMMIT
```

Qualquer falha → **ROLLBACK integral**. **Proibido:** conexão própria no meio da operação · fiscal log/event órfão · Bank transaction sem event fiscal · split/ledger parcial · evento antes do dinheiro (respeitar Mutation→Estado→Dinheiro→Evento) · lock de `bank_accounts` fora do Bank · harness com múltiplas conexões desnecessárias. Fixtures futuras usam savepoint/rollback e provam **zero PID/lock residual**.

---

## D9 — SNAPSHOT UNIFORME

Snapshot **imutável, versionado e não recomputável**, com no mínimo: `fiscalProvisionEventId` · `economicPolicyId (= economic_policies.id)` · fiscal identity id · actor fiscal profile id + version · tax regime · taxpayer kind · revenue stream · tax rule ids+versões · fiscal calculation version · gross_transaction · commission_gross · tax_reserve · commission_distributable · selected `applies_to` · selected base amount · policy line id · bps/fixed original · calculated amount · contributor identity · `occurredAt` · `effectiveAt` · currency · source account · destination account · context fingerprint · warning/status.

Territórios **nomeados por papel**: **`fiscalJurisdiction`** e **`buyerTerritory`**. 4e materializa **somente `fiscalJurisdiction`** (linha fiscal); `buyerTerritory` reservado a B-CITY-2. Nenhum campo genérico mistura território fiscal e regional. Snapshot é **evidência, nunca saldo**; reversal e retry reutilizam o snapshot original; **zero recomputação** com regra/policy/território atuais. Shape JSON com **versão explícita** e contrato governado.

---

## D10 — ALLOWLIST GOVERNADA `line_type × applies_to`

Vocabulário governado **fechado e versionável**: `line_type × applies_to × fase × materializável_no_Bank`. No material 4e inicial, **só entram no Bank**: `tax_reserve` **e** economic policy lines explicitamente originadas de **`commission_distributable`**. Linhas avaliadas sobre `gross_transaction` / `commission_gross` **permanecem fora** da materialização Bank até nova allowlist decidida.

A executora deverá **inventariar de 1ª mão os `line_type` vivos** e enumerar na matriz somente os já fundamentados institucionalmente para `commission_distributable`. **Se a lista não puder ser fechada sem decisão adicional → STOP antes do material.**

**Proibido:** lista local solta · `if` ad hoc · allowlist só em comentário · qualquer `line_type` sobre `gross_transaction` materializado por conveniência · qualquer `line_type` sobre `commission_gross` concorrendo com `tax_reserve` · `tax_reserve` como economic policy line · ampliação sem nova DECISION/versionamento. Registrar em manifesto + `07_NOMENCLATURA_CANONICA` + guard + testes/mutations.

---

## D11 — IDEMPOTÊNCIA E FINGERPRINT

Raiz canônica: `(tenant_id, reference_type, reference_id)` + **fingerprint imutável** do contexto fiscal/econômico. Como `reference_id` é UUID, o fingerprint **não** pode ser embutido nele. Promulga-se coluna dedicada **`bank_transactions.fiscal_economic_context_fingerprint`** (ou nome físico canônico equivalente): dedicada · imutável após criação · comparável no retry · indexável · não escondida em JSON mutável · nullable apenas para histórico/transactions não fiscalizadas · **obrigatória no caminho fiscal 4e**.

Contrato: mesma reference tuple + mesmo fingerprint → devolve transaction, event fiscal e splits **originais**; mesma reference tuple + fingerprint diferente → **`IDEMPOTENCY_PAYLOAD_MISMATCH`**. Retry **não** recalcula para substituir snapshot anterior. O fingerprint cobre os fatos econômicos/fiscais que alterariam a materialização, sem dados voláteis irrelevantes.

---

## D12 — AUTHORITY E TREASURY SOURCE FISCAL

Fonte canônica: **`treasury:fiscal_reserve`**. **Não reutilizar `treasury:settlement`** (4e não recolhe). Se o enum persistido usa só o sufixo, o valor material pode ser `fiscal_reserve`, mas a nomenclatura institucional permanece namespaced `treasury:fiscal_reserve`.

Movimentos admitidos: pipeline fiscal interno governado · full reversal · simulation/test **exclusivamente sob rollback**. **Proibidos:** admin manual · policy admin · frontend · representante territorial · regional treasury source · job como autoridade soberana · user/session como fonte de poder · movimentação avulsa · settlement externo. `DT-REGION-FUND-DELEGATION-MODEL-PENDING` permanece OPEN, **mas não governa a reserva fiscal**; nenhum representante regional move/aprova/controla `fiscal_reserve`.

---

## D13 — 4E DORMENTE

O material 4e será **estritamente dormente**. Poderá criar **somente**: migrations de substrato · `fiscal_reserve_accounts` · resolver lookup-only · extensão dos vocabulários · `fiscal_provision_events` · vínculo dos logs ao event · extensão read-only do orquestrador · contratos Bank internos · snapshot/fingerprint · conservação por bucket · treasury-source fiscal · guard dedicado · mutations · provas DB/E2E sob rollback.

**Não poderá:** criar conta fiscal real · fiscal profile real · tax rule · policy · ligar firewall · religar caller · criar rota · acordar worker · executar transaction persistente · criar split/ledger real · alterar saldo. O one-shot da conta só ocorrerá após: perfil fiscal ativo + identidade fiscal válida + material 4e selado + GO próprio + auditoria própria. Ativação futura exige: configuração fiscal real + conta fiscal bootstrapada + matriz de caller elegível + GATE de ativação + PORTA separada.

---

## D14 — PRIMEIRA PASSADA FISCAL

4e abre **somente a passada fiscal PLATFORM**. Permanecem fechados: seller · provider · marketplace participant · driver · event organizer · advertising beneficiary · demais contribuintes. **Não ligar genericamente todos os pagamentos.** Nenhum primeiro caller vivo é escolhido nesta DECISION — a escolha exige GATE posterior (revenue stream + contributor + concept + transaction kind + fiscal profile + tax catalog + policy context + account readiness).

---

## D15 — COMPONENTES EXTERNOS AO MVP

Por **omissão consciente**: adquirência, frete e outros componentes externos governados permanecem **modelados** na equação de `gross_transaction`, mas **fora do MVP 4e** (0165 D7). O material 4e não os cria/materializa/distribui. A ausência deles **não** autoriza absorção silenciosa pelo seller entitlement ou pela comissão. Materialização futura exige allowlist e decisão próprias.

---

## D16 — FULL REVERSAL ONLY

4e suporta **somente full reversal**. O reversal deverá: carregar splits/contas/amounts/snapshot **originais**; reverter o leg `tax_reserve`; preservar a transaction original; ser idempotente; **não** recomputar fiscal/policy/território; **não** consultar taxa atual. Refund/reversal **parcial permanece fora**. **Proibido:** rateio proporcional silencioso · recálculo de centavos · partial reserve release · usar regra fiscal atual · usar `commission_distributable` atual. `REVERSAL_AMOUNT_MISMATCH` (ou equivalente) continua bloqueando parcial.

---

## D17 — SEM LIFECYCLE OU REMITTANCE

4e **não** cria estados `remitted` / `released` / `adjusted` / `settled` / `paid_to_tax_authority`. 4e **somente segrega saldo**. Ficam para frente futura: apuração definitiva · ajuste · liberação · recolhimento · settlement externo · conciliação · autoridade tributária · comprovante · tratamento pós-remittance. **Não** usar `treasury:settlement` para antecipar.

---

## D18 — VETORES YALA 24/36/38

O material 4e deverá conter mutations hostis **dedicadas, independentes e reproduzíveis** que **mordem diretamente** (sem depender só de ausência/estado DB): **Vetor 24** — catch de infra convertido em missing; **Vetor 36** — tentativa de criar/seedar/ativar/migrar policy regional ou produzir split regional real em 4e; **Vetor 38** — frontend introduzindo taxa/base fiscal/`tax_reserve`/`applies_to`/account type/treasury source/decisão fiscal. Não reabrem 4d-2; obrigatórios; não autorizam frontend nem policy regional.

---

## D19 — PRESERVAÇÃO DOS SELOS

O material 4e deverá preservar integralmente: **FISCAL 4D-1 · 4D-1-R · DECISION-0178 · 4D-2 · B-CITY-1**. Hash selado do guard 4c-3 = **`942142f3c49676e7ba651ee21e12516cf803a0e82b6da66526f3ace654953eaa`**. Preservar `audit-fiscal-tax-catalog.mjs`; `audit-fiscal-provision-engine.mjs` (salvo extensão estritamente necessária e previamente delimitada por esta DECISION); `audit-fiscal-economic-policy-composition.mjs`; arquivos protegidos B-CITY-1 (`economic-policy-engine.service.ts`, `service-payment-execution.service.ts`, `audit-bank-city-curitiba-foundation.mjs`); migration e hashes 4d-2; semântica 5/3/2 de `applies_to`. Criar novo guard `audit-fiscal-tax-reserve-bank-materialization.mjs`; runner futuro **185 → 186**. Qualquer divergência de baseline ou necessidade de alterar arquivo selado não autorizada → **STOP e retornar ao GATE**.

---

## D20 — GUARD 4E (projeção, sem criar)

O guard dedicado futuro deverá provar, no mínimo: `tax_reserve` decomposição interna · conservação global · conservação por bucket · zero double charge · `tax_reserve` não configurável por policy · split type governado · account type governado · resolver+uniqueness exatos · currency no resolver · jurisdição fora da unicidade · zero auto-provision · lookup-only · contributor/fiscal identity rastreáveis · `fiscal_provision_events` · cardinalidade 1 tx→1 event→N logs · FK Bank→fiscal · zero FK fiscal→Bank · `existingClient` em fiscal-provision e appendRows · transação única · zero log/event órfão · policy version correta · snapshot uniforme · territórios nomeados · zero recomputação · fingerprint dedicado · retry determinístico · payload mismatch fail-closed · allowlist `line_type×applies_to` · somente PLATFORM · componentes externos fora · zero `tax_rules` read no Bank · zero invoice fallback · negativo fail-closed · zero split omitido · missing fail-closed · infra propaga · lock order no Bank · full reversal por snapshot · partial reversal bloqueado · zero SQL Bank fora do Bank · zero conta real · zero caller vivo · firewall OFF · zero policy regional · zero frontend fiscal · B-CITY-1 intacta · 4d-2 intacta · vetores 24/36/38 mordendo. Comment-aware + liveness.

---

## D21 — ENVELOPE MATERIAL 4E FUTURO (registrado; NÃO autorizado)

Elegível **somente após** DECISION selada pela Yala **+** GO MATERIAL FISCAL-4E explícito. Escopo futuro consolidado: migrations de substrato · `fiscal_reserve_accounts` · CHECK de split type · CHECK de account type · manifestos · nomenclatura · `fiscal_provision_events` · FK logs→event · FK Bank→event · fingerprint · snapshot versionado · `existingClient` · resolver lookup-only · composição/conservação por bucket · treasury-source fiscal · Bank internals dormentes · guard 4e · mutations · DB/E2E rollback · runner 186. **Fora do material:** conta fiscal real · one-shot apply · perfil fiscal real · catálogo real · caller vivo · firewall ON · route · worker · remittance · refund parcial · policy regional · B-CITY-2 · invoicing · frontend/admin. **Nenhuma autorização automática.**

---

## SEQUÊNCIA INSTITUCIONAL

1 DECISION FISCAL-4E docs-only → 2 auditoria Yala da DECISION → 3 selo docs-only → 4 GO material FISCAL-4E → 5 material 4e interno/dormente → 6 auditoria Yala do material → 7 selo 4e → 8 configuração fiscal real governada → 9 one-shot da conta fiscal → 10 GATE de ativação + 1º caller → 11 PORTA de ativação. **Nenhuma etapa autoriza automaticamente a seguinte.**

---

## FRONTEIRAS ABSOLUTAS · DTs

Manter OPEN: `DT-INVOICING-HARDCODED-TAX-RATE` (invoicing não fornece taxa nem snapshot; não é fechada aqui) · `DT-REGION-FUND-DELEGATION-MODEL-PENDING` (**não governa a reserva fiscal**). B-CITY-2 bloqueada · policy regional não criada · partial refund fora · remittance fora · frontend/admin fora · seller/provider pass fora. **Preservados e intactos:** 4d-1 · 4d-1-R · DECISION-0178 · 4d-2 · B-CITY-1 · fiscal-provision · fiscal_provision_logs · Bank · frontend · perfil · conexões · endereço · Social · bairro/N5 · nacional.

---

## INVARIANTES QUE ESTA DECISION PRESERVA

- Dinheiro **sempre** no Bank; `fiscal_reserve_accounts`/`fiscal_provision_events` são evidência por FK, nunca saldo (Lei 5; SSOT_REGISTRY §5; SSOT_EXCLUSIVE_BANK_RULE).
- UM pipeline (policy engine DECIDE → Bank EXECUTA → splits/ledger PERSISTEM); o motor fiscal é ESTÁGIO composto, nunca serviço avulso por vertical (0167 §2).
- Fiscal nunca conhece Bank (FK só Bank→fiscal); `bank_*` SQL só no domínio Bank (LEI §4.6-4.7).
- `tax_reserve` é decomposição interna da comissão, materializada pelo Bank, jamais policy configurável (Lei do Contador; 0166 D9).
- Reversal por snapshot original, determinístico (CORE_ESTORNOS; 0052).
- Ativação econômica só por PORTA governada; sink firewall permanece fail-closed OFF.

---

**STATUS: DECISION-0179 PROMULGADA DOCS-ONLY · NÃO SELADA · AGUARDA UMA ÚNICA AUDITORIA YALA. Não autoriza material 4e (D9.7 exige GO próprio).**
