# Execução — F-PJ-STAGE4-COMPANY-TYPE-BRIDGE (Op1)

**Data:** 2026-06-05 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `adbffb26` · **Decisão:** Clayton — Op1 (fonte = `companies.primary_company_type_id`) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Ponte mínima entre a Classificação PJ (Estágio 3) e o Stage 4 (store-onboarding): o Stage 4 deve derivar o company_type da **empresa CLASSIFICADA** (`companies.primary_company_type_id`), não de `tenants.company_type_id`. **Code-only**, sem catálogo/seed/product_offers/Trilho B/Bank/migration, sem popular `tenants.company_type_id`, sem reescrever store-onboarding.

## Diagnóstico (READ-FIRST)
- `store-onboarding.service.resolveOnboardingCategories(tenantId)` lia `tenants.company_type_id` (linha ~154) → `company_types.default_*_slugs` → categorias; `loadTenantOnboardingAuditContext(tenantId)` idem (logs).
- O Estágio 3 grava `companies.primary_company_type_id`/`primary_concept_id` (ativação). **Desconexão:** empresa classificada não pré-moldava a loja; popular `tenants.company_type_id` recriaria segunda verdade (tenant ≠ empresa).
- `StoreOnboardingInput.actorId` = page-actor da loja; **sem companyId**. → mudança de contrato mínima (adicionar `companyId?`).

## Implementação (`backend/src/modules/marketplace/store-onboarding.*`)
- **`resolveStage4CompanyTypeId(tenantId, companyId?)`** (novo, privado): com `companyId` → `SELECT primary_company_type_id FROM companies WHERE company_id=$1 AND tenant_id=$2` (a empresa **vence**; sem classificação → `null`, **sem fallback p/ tenant**); sem `companyId` → `SELECT company_type_id FROM tenants` (path **legado/compat**).
- **`resolveOnboardingCategories(tenantId, companyId?)`**: passa a usar `resolveStage4CompanyTypeId` (mesma derivação de categorias por `default_*_slugs`).
- **`loadTenantOnboardingAuditContext(tenantId, companyId?)`**: com `companyId` → company_type + `primary_concept_id` da empresa; sem → tenant (legado).
- **`createStoreOnboarding`**: passa `input.companyId` a ambos.
- **`StoreOnboardingInput`** (`types`): `companyId?: string` (aditivo). **Rota** POST `/marketplace/store-onboarding`: body schema + input ganharam `companyId?` (uuid optional).
- **NÃO** popula `tenants.company_type_id`; **NÃO** reescreve store-onboarding; **NÃO** cria product_offers nesta fatia.

## Prova
- **e2e efêmero `validate-pipeline-e2e-pj-stage4-company-type-bridge.ts` 9/9 verde:**
  1. `companyId` → `companies.primary_company_type_id` (supermercado).
  1b. sem `companyId` (legado) → `tenants.company_type_id` (null aqui).
  2. **empresa VENCE o tenant:** `tenants.company_type_id=farmacia`, mas com `companyId` resolve **supermercado** (ignora tenant) — o coração da regra (sem segunda verdade).
  2b. legado (sem `companyId`) lê `tenants=farmacia` (compat preservado).
  3. audit context (`companyId`): companyType=supermercado + conceptId=`primary_concept_id`.
  4. empresa **não classificada** + `companyId` → `null` (NÃO cai no `tenant=farmacia`).
  5. isolamento: `companyId` do tenant A sob tenant B → `null`.
  6. zero product_offers criados pela ponte; Bank intocado.
- Backend tsc só os 2 baseline geo. Gates: actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK · arch `--strict` exit=0 (`critical_new=0`; `warning_new=1`=c3). **Migrations 363→363** (zero migration).

## DT
- **Criada** `DT-PJ-STAGE4-COMPANY-TYPE-SOURCE-DISCONNECT` → **PARTIALLY MITIGATED** (ponte construída e provada na resolução; **não CLOSED** — falta caller vivo passar `companyId` no fluxo PJ fiscal-first, i.e. o onboarding chamar store-onboarding com a empresa → exerce ponta a ponta).

## Não-toque confirmado
`tenants.company_type_id` (NÃO populado) · canonical_products · catálogo/seed · product_offers (não criados) · Trilho B (services/availability) · migration/schema (363) · Bank · reescrita de store-onboarding · peixaria · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
Op2 — Trilho A MVP (produtos, supermercado): o onboarding PJ passa `companyId` ao store-onboarding (exerce a ponte ponta a ponta → fecha a DT) e a empresa ativa seu mix (`product_offers`) a partir de `canonical_products` (regra do catálogo canônico: global não-duplicado; preço/estoque = projeção). Op3 serviços depois; peixaria fora. Espera go do Clayton.
