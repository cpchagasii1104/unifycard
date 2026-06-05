# Execução — DECISION-0108 (governança de produto PJ por categoria/ramo) — docs-only

**Data:** 2026-06-05 · **Modo:** EXECUTOR DOCS-ONLY CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `28131866` · **Decisão:** Clayton — Op-i (governar por categoria/ramo; trocar a régua errada, não desligar a segurança) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Promulgar a norma que resolve o STOP da Op2: a materialização de produto PJ é governada por **categoria/ramo pré-moldado** do `company_type` (recorte do store-onboarding), **não** por comparação `canonical_products.concept_id` (item-comercial) × `company_type_allowed_concepts.concept_id` (vendor) — comparação que a `DECISION-0105` tornou inválida (camadas distintas). **Docs-only:** não toca guard/código/schema/migration/seed/Op2/Bank.

## Antecedente (STOP da Op2)
Op1 (`F-PJ-STAGE4-COMPANY-TYPE-BRIDGE`, `28131866`) ligou o Stage 4 na empresa classificada (`companies.primary_company_type_id`). Ao exercer a ponte (Op2 supermercado), o `product-concept-guard` (`assertProductConceptAllowedForTenant`, em `product.repository.createProduct:102`) **rejeitou** a materialização. Conforme a regra de STOP do envelope, **não** se deixou `tenants.company_type_id` NULL para "passar" (falso-verde); reverteu-se o Op2 não-committado e escalou-se. Clayton confirmou o STOP e autorizou a DECISION-0108.

## Auditoria read-only `F-PJ-PRODUCT-CONCEPT-GUARD` (código/banco vivos, HEAD `28131866`)
1. `product-concept-guard.ts` l.33-36 compara `canonical_products.concept_id` × allowed do `company_type` lido de `tenants.company_type_id`; bypass l.53 (allowed vazio/null); throw l.55. **1º commit `14111f7c` 2026-05-04** (pré-0105, que é de 2026-06-05).
2. `canonical_products.concept_id`: **35/35 domain `item-comercial`** (camada item/SKU).
3. `company_type_allowed_concepts.concept_id`: `produtos-e-comercio`(5) + `servicos`(2) (camada vendor/atuação). **Interseção com item-comercial = 0.**
4. `tenants.company_type_id` hoje NULL → guard só não dispara por bypass; setar o tipo → rejeita todo o catálogo industrial.
5. **Recorte por categoria já existe e é a governança certa:** `store-onboarding.validateMarketplaceCategories` (l.320) + `findCatalogProductsByCategories(selectedIds)` (l.358) materializa só canonicals nas categorias = ramos pré-moldados do `company_type` (`default_*_slugs`). 0105-alinhado.
6. Callers de `createProduct` (todos passam pelo guard): `store-onboarding.service:379` e `marketplace-templates.service:773`.
7. "Farmácia vende banana": sob governança por categoria, **não** — hortifruti fora dos ramos da farmácia.

## Decisão promulgada (resumo — íntegra em `DECISION_0108`)
- Elegibilidade de produto por **categoria/ramo pré-moldado**, não por igualdade de concept (D1–D8).
- `company_type_allowed_concepts` permanece **vendor-only**; **proibido** popular item-concepts nele (D7).
- Fonte de company_type no fluxo PJ novo = `companies.primary_company_type_id` (Op1); **não popular** `tenants.company_type_id` (D8).
- **D9 (nuance Clayton):** NÃO é no-op global — produto ainda passa pelo recorte de categoria/ramo quando há contexto de company/company_type; sem recorte e sem contexto → legado/compat ou **fail-closed**, nunca liberação ampla. "Trocar a régua errada, não desligar a segurança."
- D10 blast radius (`marketplace-templates` a verificar antes do code-fix); D11 critérios do code-fix; D12 bloqueios.

## Artefatos
- `docs/02_decisions/DECISION_0108_PJ_PRODUCT_GOVERNANCE_BY_CATEGORY_BRANCH.md` (novo).
- `REMEDIATION_DT_LOG.md` — **criada** `DT-PJ-PRODUCT-CONCEPT-GUARD-PRE-0105-LAYER-CONFLATION` (OPEN).
- `REMEDIATION_DECISIONS_LOG.md` — entrada DECISION-0108.
- `STATUS_EXECUCAO_GLOBAL.md`, `opus.md`, este log.

## Prova
Docs-only — runtime intocado. 4 gates: actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK · arch `--strict` exit=0 (`critical_new=0`; `warning_new=1`=c3 baseline). **Migrations 363→363** (zero migration).

## DT
- **Criada** `DT-PJ-PRODUCT-CONCEPT-GUARD-PRE-0105-LAYER-CONFLATION` (OPEN) — mitigação = code-only `F-PJ-PRODUCT-CONCEPT-GUARD-LAYER-FIX` (D11).
- `DT-PJ-STAGE4-COMPANY-TYPE-SOURCE-DISCONNECT` → permanece PARTIALLY MITIGATED (guard é segundo leitor de `tenants`; entra no guard-fix).
- `DT-PJ-CANONICAL-CATALOG-SHARED-ITEMS-NOT-PER-VERTICAL` → inalterada (a 0108 aplica-a ao guard).

## Não-toque confirmado
`product-concept-guard.ts` (não alterado) · `product.repository.ts` · `store-onboarding.*` · `marketplace-templates.*` · `canonical_products`/`product_offers` · `tenants.company_type_id` (não populado) · `company_type_allowed_concepts` (não populado) · migration/schema (363) · Bank · Op2 · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Sequência autorizável (sem execução nesta fatia — espera Clayton)
1. Esta DECISION (docs-only) — **feita**.
2. `F-PJ-PRODUCT-CONCEPT-GUARD-LAYER-FIX` (code-only) — D11.
3. `F-PJ-STAGE4-TRILHO-A-SUPERMERCADO` (Op2). **Op2 só volta após 0108 + guard-fix.**
