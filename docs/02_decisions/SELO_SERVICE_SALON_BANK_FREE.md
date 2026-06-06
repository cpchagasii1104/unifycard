# SELO — Trilho B salão Bank-free (DECISION-0109: taxonomia → guard → agenda)

**Tipo:** SELO documental de encerramento de marco (DOCS-ONLY).
**Data:** 2026-06-05.
**Marco:** fundação **Bank-free** do Trilho B (serviços), piloto **salão** — SELADA por este selo.
**Branch:** `rescue-structural`. **HEAD selado:** `8bee2b49` (o commit do selo avança a partir daqui).
**Decisão-mãe:** [`DECISION_0109_SERVICE_TRACK_B_TAXONOMY_BANKFREE_FOUNDATION.md`](DECISION_0109_SERVICE_TRACK_B_TAXONOMY_BANKFREE_FOUNDATION.md).
**Ratificação:** Clayton (DECISION-0109 + cada fatia + go do selo) · Opus (execução, esteira escritora) · auditoria read-only da cadeia (esteira verificadora).
**Subordinado a:** Constituição / LEIS, LEI_DE_COERÊNCIA §4.8 (actor-first), SSOT_REGISTRY, `CORE_IMUTAVEL.md`, LEI 5 (Bank `bank_ledger` soberano) e LEI 7 (CONCEPT/semântica).

> O Trilho B (serviços) era **scaffold nunca exercido** (tabelas com 0 linhas), com três defeitos travados:
> um **fork de taxonomia** (o `company_type` de salão pré-moldava ramos de **marketplace/produto**, enquanto
> existia uma taxonomia `domain='servicos'` paralela e órfã, sem ponte); **endpoints fantasma** de agenda que
> o frontend chamava e o backend não servia; e um **fluxo comercial acoplado a Bank** (booking/order/payment
> com escrow). Este marco fixou a **fundação Bank-free**: o salão pode existir, ser classificado, criar serviço
> do seu **ramo de serviço** e ter **agenda** — sem tocar dinheiro. Booking/order/payment ficaram **atrás da
> porta corta-fogo do Bank**, que só abre por decisão financeira própria.

---

## 1. Estado final material

```text
Salão (company_type='salao') pode CRIAR SERVIÇO VÁLIDO por categoria domain='servicos'
  governada pela ponte company_type_service_categories (ramos do seu tipo de empresa).
Serviço pode ter AVAILABILITY Bank-free, gravada no CORE availability (owner_type='service').
`availability` é a ÚNICA verdade temporal (core soberano) — NÃO há SSOT temporal paralelo.
Autoridade de ramo = empresa do page-actor dono (actor → actors.company_id → companies.primary_company_type_id).
  O tenant é ESCOPO, NÃO autoridade.

BLOQUEADOS (porta corta-fogo do Bank):
  booking / service_order / payment / escrow / settlement — NÃO implementados nesta fundação.
  Cruzam causalidade financeira → exigem frente financeira própria (DECISION antes de código).

Restaurante: ADIADO (híbrido produto+serviço — dobra a complexidade; fora deste marco).
Peixaria: FORA (decisão de produto pendente).
```

## 2. Cadeia de commits (decisão antes do código, fatia a fatia)

| Fatia | Descrição | Commit |
|-------|-----------|--------|
| **DECISION-0109** | Fundação do Trilho B serviços; ratifica Opção A (ponte dedicada) (docs-only) | `8efd82c0` |
| **Bridge schema** | Tabela `company_type_service_categories` (schema-only; sem CHECK congelando domínio) | `407c7fb4` |
| **Seed salão** | 5 categorias `domain='servicos'` (1 depto + 4 ramos), fail-closed + idempotente | `446add0d` |
| **Guard de criação** | `assertServiceCategoryAllowedForCompany` em `createService`/`updateService` (code-only) | `76c5899b` |
| **Availability adapter** | Agenda de serviço sobre o CORE `availability` (adapter fino, Bank-free) | `8bee2b49` |

## 3. Invariantes preservados

```text
TAXONOMIA (semântica/categoria):
  serviço usa taxonomia domain='servicos' (NUNCA marketplace).
  ponte company_type_service_categories é dedicada (NÃO repinta default_*_slugs de produto,
    NÃO reusa company_type_allowed_concepts — que é camada de atuação/concept, não categoria).
  invariante de domínio NÃO cravado por CHECK SQL (evita congelar evolução) — validado por seed + guard.

GUARD (criação/edição de serviço):
  service_type='service' (event/job/rental fora da DECISION-0109).
  categoria domain≠'servicos' → Forbidden. categoria ∉ ponte do company_type → Forbidden.
  empresa não classificada (sem primary_company_type_id) → Forbidden.
  PF/legado sem company → domínio sim, ramo não (compat). empresa = actor dono (page-actor), não tenant.

AGENDA (tempo):
  availability gravada SÓ pelo core unifiedAvailabilityService (owner_type='service', owner_id=serviceId).
  ZERO INSERT/UPDATE cru em `availability` fora do core. ZERO SSOT temporal paralelo.
  escrita = dono do serviço (service.actorId === callerActorId); não-dono → Forbidden. leitura pública (descoberta).
  adapter FINO: nenhuma lógica temporal própria; projeção sem campo de verdade novo.

DINHEIRO (Bank):
  criação + agenda 100% Bank-free. booking/order/payment/escrow/settlement NÃO tocados.
  separação limpa: tempo (availability) ≠ semântica (categoria/ramo) ≠ dinheiro (Bank fora).
```

## 4. Provas materiais

- **DECISION antes do código:** cada fatia de código foi precedida por sua norma (DECISION-0109 docs-only `8efd82c0` antes de qualquer schema/runtime).
- **Bridge + seed (dev 363→364→365, via runner canônico, sem fantasma):** `company_type_service_categories` com FK→`company_types`/`categories`, unique do par, `chk_ctsc_source`; salão = **5 linhas** `domain='servicos'` (1 `is_department=true` + 4 ramos), seed **fail-closed** (RAISE sem parcial) e **idempotente** (ON CONFLICT no par).
- **Guard (e2e `validate-pipeline-e2e-service-category-ramo-guard.ts` 14/14):** salão+4 ramos OK; marketplace-cabelo/servicos-encanador(fora ponte)/supermercado/empresa-não-classificada → Forbidden; PF compat (domínio sim, ramo não); zero availability/booking/Bank.
- **Availability (e2e `validate-pipeline-e2e-service-salon-availability-bank-free.ts` 10/10):** availability via adapter → **1 linha no core `availability` com `owner_type=service`, `owner_id=service_id`**; list delega ao core; escrita=dono (não-dono → Forbidden); supermercado segue barrado pelo guard; **zero booking/order/payment, Bank intocado**; única verdade temporal no core.
- **Gates (cada fatia de código):** actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK (365, numeração única) · `architectural-patterns --strict` `critical_new=0`, `warning_new=1` (baseline c3, pré-existente).
- **Frontend:** **não** precisou mudar (já chamava `/services/:serviceId/availability`); compila (tsc exit 0). O fantasma virou real-e-fino delegando ao core, **sem segunda verdade**.

## 5. Estado das DTs

```text
DT-SERVICE-RAMO-TAXONOMY-FORK:
  CLOSED (2026-06-05) — schema + seed + guard provados (ponte dedicada governa o ramo de serviço).

DT-SERVICE-AVAILABILITY-ENDPOINT-DISCONNECT:
  PARTIALLY MITIGATED (2026-06-05) — metade AVAILABILITY reconciliada (adapter→core, sem SSOT paralelo).
  Metade BOOKINGS segue FANTASMA e bloqueada (puxa Bank).

DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED:
  OPEN (2026-06-05) — booking/order/payment/escrow/settlement atrás da porta corta-fogo do Bank.
  Só abre por frente financeira própria (DECISION antes de código).

DT-SERVICE-NO-COMPANY-RAMO-BRIDGE:
  PARTIALLY MITIGATED — autoridade da empresa via page-actor; resíduo: não exige PJ=page-actor.
```

## 6. Proibições seladas (NÃO autorizadas aqui — exigem frente própria)

```text
NADA de booking/payment/escrow/settlement sem frente FINANCEIRA própria (DECISION antes de código).
  service_orders (settlement_flow/escrow), service_discovery pay, service_payment_execution, Bank: INTOCÁVEIS até lá.
NADA de endpoint fantasma virar SSOT paralelo — toda agenda delega ao core availability.
NADA de Bank por conveniência de UX — dinheiro só cruza por causalidade decidida, nunca por atalho de tela.
NADA de taxonomia de marketplace governar serviço — serviço vive em domain='servicos'.
```

## 7. Resíduos e futuro (frentes próprias — NÃO autorizadas por este selo)

```text
Fluxo comercial de serviço (booking→order→payment):
  frente financeira própria. Desenha escrow/settlement/splits ANTES de código.
  É a porta corta-fogo do Bank (DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED).

Metade bookings dos endpoints fantasma:
  segue bloqueada — vem junto com a frente comercial (booking puxa Bank).

salao.default_*_slugs ainda marketplace-*:
  resíduo benigno — é pré-moldagem de PRODUTO (Trilho A); salão é serviço-only e não roda product onboarding.
  Concern separado, NÃO a fresta da taxonomia de serviço (essa está fechada).

Hardening: exigir PJ=page-actor na oferta de serviço (DT-SERVICE-NO-COMPANY-RAMO-BRIDGE).
Outras verticais de serviço (além de salão); restaurante (híbrido); peixaria (produto pendente de decisão).
```

---

**Selo emitido.** A fundação **Bank-free** do Trilho B (piloto salão) está consolidada: a taxonomia de serviço
ganhou ponte dedicada (`company_type_service_categories`), o seed do salão a preencheu com categorias
`domain='servicos'`, o guard passou a governar criação/edição por categoria+ramo, e a agenda virou **adapter
fino sobre o core `availability`** — sem SSOT paralelo, sem Bank. Tempo, semântica e dinheiro ficaram
**separados**. Booking/order/payment seguem **atrás da porta corta-fogo do Bank**
(`DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED` **OPEN**), que só abre por frente financeira própria com decisão
antes de código. `DT-SERVICE-RAMO-TAXONOMY-FORK` **CLOSED**; `DT-SERVICE-AVAILABILITY-ENDPOINT-DISCONNECT`
**PARTIALLY MITIGATED**.
