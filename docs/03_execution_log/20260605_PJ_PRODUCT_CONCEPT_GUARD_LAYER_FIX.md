# Execução — F-PJ-PRODUCT-CONCEPT-GUARD-LAYER-FIX (DECISION-0108) — code-only

**Data:** 2026-06-05 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `0958d6a3` · **Decisão:** Clayton — DECISION-0108 (trocar a régua errada, não desligar a segurança) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Corrigir o `product-concept-guard` pré-0105, que comparava `canonical_products.concept_id` (camada item-comercial/SKU) contra `company_type_allowed_concepts.concept_id` (camada vendor/atuação) — interseção zero, rejeitando todo produto industrial com `company_type` setado. Trocar a régua para **categoria/ramo pré-moldado** do `company_type` (a régua certa), **sem** virar no-op global. Code-only.

## READ-FIRST (achado crucial)
- `product-concept-guard.assertProductConceptAllowedForTenant(tenantId, canonicalProductId)` lia `tenants.company_type_id` → allowlist vendor × `canonical.concept_id`; `if(!canonicalProductId) return` na 1ª linha.
- `product.repository.createProduct:102` chama o guard antes do INSERT.
- **Callers de `createProduct`:** `store-onboarding.service:379` (passa `canonicalProductId` — caminho governado, **e já faz recorte por categoria** via `validateMarketplaceCategories`+`findCatalogProductsByCategories(selectedIds)`); `marketplace-templates.service:773` e `smoke-supply-chain-2026-05-17.ts:86` (**não** passam canônico → bypass na 1ª linha do guard).
- **Conclusão:** o único caller que aciona a comparação é o store-onboarding (já recortado). A comparação vendor é redundante-e-quebrada. A governança correta (recorte por categoria/ramo) já existe e é 0105-alinhada.
- Fonte do company_type correta = `companies.primary_company_type_id` (Op1), não `tenants.company_type_id`.

## Implementação (code-only)
- **`product-concept-guard.ts` (reescrito):** `assertProductConceptAllowedForTenant` → **`assertProductCategoryAllowedForCompany(tenantId, canonicalProductId, companyId?)`**.
  - Lê `canonical_products.category_id`.
  - `resolveGuardCompanyTypeId(tenantId, companyId?)`: `companyId` → `companies.primary_company_type_id` (empresa vence); senão `tenants.company_type_id` (legado/compat). **Nunca** o tenant como autoridade quando há `companyId`.
  - `resolveCompanyTypeBranchCategoryIds(tenantId, companyTypeId)`: `default_department_slugs`+`default_branch_slugs` → `categories.category_id` (is_active).
  - Recorte: `category_id` do canônico ∈ categorias dos ramos → OK; senão **ForbiddenError** (fail-closed).
  - **Bypass documentado (compat, D9 — não no-op silencioso):** sem `canonicalProductId` (templates); canônico inexistente (deixa FK falhar); canônico sem `category_id`; sem `company_type` resolvível (legado sem classificação); `company_type` sem ramos.
- **`product.repository.ts`:** import + `assertProductCategoryAllowedForCompany(tenantId, canonicalProductId, input.companyId)`.
- **`product-catalog.types.ts`:** `CreateProductInput.companyId?: string | null` (aditivo, **não** persistido em `products` — só contextualiza o guard).
- **`store-onboarding.service.ts:379`:** passa `companyId: resolvedInput.companyId` (empresa classificada governa o recorte).
- **`product-catalog.service.createProduct`** repassa `input` inteiro → `companyId` flui sem mudança.

## Prova
- **e2e efêmero `validate-pipeline-e2e-pj-product-concept-guard-layer-fix.ts` 13/13 verde:**
  1. supermercado materializa banana (hortifruti ∈ ramos) — `createProduct` OK + `products` persistido.
  2b. farmácia materializa analgésico (medicamentos ∈ ramos).
  3a/3b. farmácia REJEITA banana (hortifruti ∉ ramos da farmácia) — guard direto + `createProduct` ForbiddenError, sem persistir.
  4a/4b. **guard não compara item × vendor:** banana.concept ∉ vendor allowlist do supermercado, ainda assim PASSA (régua antiga rejeitaria).
  5. sem canônico (templates) → bypass.
  6a. **empresa VENCE tenant:** `tenants=supermercado`, mas `companyId=farmácia`+banana → REJEITA. 6b. legado (sem companyId) lê tenant=supermercado → PASSA (compat).
  7a/7b. empresa não classificada / canônico inexistente → bypass compat.
  8. zero `product_offers`; Bank intocado.
- Backend tsc só os 2 baseline geo. 4 gates: actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK · arch `--strict` exit=0 (`critical_new=0`; `warning_new=1`=c3). **Migrations 363→363** (zero migration).

## DT
- **`DT-PJ-PRODUCT-CONCEPT-GUARD-PRE-0105-LAYER-CONFLATION` → CLOSED** (régua trocada e provada).
- `DT-PJ-STAGE4-COMPANY-TYPE-SOURCE-DISCONNECT` → PARTIALLY MITIGATED (sub-problema "segundo leitor de tenants" resolvido; falta caller vivo passar `companyId` = Op2).

## Não-toque confirmado
`tenants.company_type_id` (não populado) · `company_type_allowed_concepts` (não alterado/não populado) · `canonical_products` · `product_offers` (Op2) · migration/schema (363) · Bank · `marketplace-templates.service` (bypass, intocado) · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
Op2 — `F-PJ-STAGE4-TRILHO-A-SUPERMERCADO`: onboarding PJ passa `companyId` ao store-onboarding (exerce a ponte ponta a ponta → fecha a DT-STAGE4) + empresa ativa mix (`product_offers`). Espera go do Clayton.
