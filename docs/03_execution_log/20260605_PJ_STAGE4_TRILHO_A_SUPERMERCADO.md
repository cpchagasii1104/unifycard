# Execução — F-PJ-STAGE4-TRILHO-A-SUPERMERCADO (Op2, DECISION-0108 + Op1)

**Data:** 2026-06-05 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `3a1dabac` · **Decisão:** Clayton — Op2 (caller vivo passa companyId; **não inventar preço/estoque**) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Exercitar o caller vivo do Stage 4 ponta a ponta: o onboarding passa `companyId` ao store-onboarding; a empresa CLASSIFICADA (`companies.primary_company_type_id`) pré-molda a loja; a máquina existente materializa o mix do supermercado. **Trava dura:** `product_offers` só com FONTE REAL de preço — sem preço, produto nasce na prateleira, **nunca** etiqueta fabricada. Code-only (+ frontend de projeção).

## READ-FIRST (conclusões)
1. **Caller vivo** = rota POST `/marketplace/store-onboarding` (`store-onboarding.routes.ts:219`), alimentada por `frontend/src/api/store-onboarding.ts` ← `StoreOnboardingWizard.tsx`. Único caller de `createStoreOnboarding`.
2. **Contrato:** `StoreOnboardingInput` já tem `companyId?`/`defaultSalePrice?`/`defaultStock?` (Op1). A rota já aceita e propaga `companyId` (Op1). **Backend já estava ligado ponta a ponta**; faltava o **frontend** projetar `companyId`.
3. **merchant_id** (`product_offers.merchant_id → actors.id`) = `resolvedInput.actorId` = page-actor da loja. **Correto** (não é company_id/store_id).
4. **Fonte de price_cents/available_quantity** = `input.defaultSalePrice`/`defaultStock` (request, **opcional**). `price_cents` é `bigint NOT NULL`; `available_quantity` nullable.
5. **VÍRUS (Clayton antecipou):** o loop criava offer **incondicional** com `priceCents = (defaultSalePrice ?? 0) * 100` → **preço-zero fabricado** sem preço informado. A fonte EXISTE (`defaultSalePrice`); logo **não é STOP** — basta **deixar de fabricar** (gate na presença de preço real).
6. **Reuso sem duplicar:** `getProductByCanonicalId` antes de `createProduct` + UIDX `uidx_products_tenant_canonical` → product por (tenant, canonical) único.
7. **Isolamento:** tudo `runQueryWithTenant`; resolver casa `companies.company_id=$1 AND tenant_id=$2`.

## Implementação
- **Backend (`store-onboarding.service.ts`, loop CANONICAL→PRODUCT→OFFER):** offer só quando `defaultSalePrice` é número finito ≥ 0 (`hasRealPrice`). Sem preço real → **não** cria `product_offer` (produto materializado na prateleira). Removido o `?? 0` que fabricava preço-zero. Único call site de `createProductOffer`.
- **Frontend (projeção, não cria verdade):** `store-onboarding.ts` → `StoreOnboardingInput.companyId?`; `StoreOnboardingWizard.tsx` → `companyId: activeActor?.company_id ?? undefined` nos dois call sites (`AvailableActor.company_id` já vem do backend = `actors.company_id`). Ausente = legado (backend lê tenant).
- **NÃO** popula `tenants.company_type_id`; **NÃO** cria canônico/seed/migration; **NÃO** toca `company_type_allowed_concepts`/`canonical_products`/Bank.

## Prova
- **e2e efêmero `validate-pipeline-e2e-pj-stage4-trilho-a-supermercado.ts` 16/16 verde:**
  1a–1e. `tenants.company_type_id=farmácia` divergente, mas com `companyId`(super) o onboarding materializa os **ramos do SUPERMERCADO** (22 canônicos branches) via `companies.primary_company_type_id`; COM `defaultSalePrice=4.5` → 22 offers `price_cents=450` (preço REAL); products = 22; **nenhum** fora dos ramos.
  2a–2d. 2ª empresa super, **SEM** preço → **ZERO offers**; products **reusados** (contagem inalterada, sem duplicar); **zero** `price_cents=0` em todo o tenant.
  3/3b/3c. Farmácia em **tenant próprio** (em produção tenant≈empresa): + hortifruti → **ForbiddenError** (guard); zero offers; zero products de hortifruti.
  4a–4d. zero canônico novo; `company_type_allowed_concepts` intocado; `tenants.company_type_id` não populado pelo fluxo; **Bank intocado**.
- Backend tsc só baseline geo; **frontend tsc exit 0**. 4 gates: actor-writer/bank-ledger/regression-guards OK; arch `--strict` exit=0 (`critical_new=0`; `warning_new=1`=c3; o `salePrice*100` **não** adicionou warning). **Migrations 363→363.**

### Armadilhas do e2e (registradas)
- **Tenant compartilhado contamina o teste do guard:** o super materializa hortifruti primeiro; a farmácia no MESMO tenant **reusa** o product (`getProductByCanonicalId` pula `createProduct`→guard). O guard governa a **materialização** (products), não a oferta. Em produção **tenant≈empresa** → rodei a farmácia em **tenant próprio** para provar o caminho governado limpo.
- `uq_actors_company_page` = **1 page-actor por empresa** (usei 2 empresas super para o teste de reuso).
- `actors.global_user_id → identities` (não `global_users`); `chk_companies_primary_classification_paired` exige `primary_company_type_id`+`primary_concept_id` juntos; identidade exige `tax_id_type='cpf'` + 11 dígitos + `kyc_status/kyc_level` enums.
- Ruído `42P01` no `recordBusinessAuditSafely` (tabela de auditoria ausente no FULL efêmero) é **engolido com segurança** — não afeta o resultado do onboarding (orthogonal ao Op2).

## DT
- **`DT-PJ-STAGE4-COMPANY-TYPE-SOURCE-DISCONNECT` → CLOSED** (caller vivo exercita a ponte ponta a ponta; provado).
- **`DT-PJ-STORE-ONBOARDING-FABRICATED-ZERO-PRICE-OFFER` → CLOSED** (criada+resolvida: offer só com preço real).

## Não-toque confirmado
`tenants.company_type_id` (não populado) · `canonical_products` (zero novo) · `company_type_allowed_concepts` · migration/schema (363) · Bank · `marketplace-templates.service` · peixaria · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
Op3 — Trilho A serviços (`servicos`), análogo. Peixaria FORA (decisão de produto pendente). Espera go do Clayton.
