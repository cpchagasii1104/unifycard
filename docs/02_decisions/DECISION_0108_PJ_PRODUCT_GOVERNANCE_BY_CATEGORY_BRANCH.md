# DECISION-0108 — Governança de produto PJ por categoria/ramo pré-moldado (não por vendor-concept)

**Data:** 2026-06-05
**Tipo:** Arquitetura / Ontologia / Marketplace (Trilho A) PJ
**Status:** PROMULGADA (docs-only — não autoriza código/schema/migration/guard-fix)
**Frente:** `F-PJ-PRODUCT-GOVERNANCE-BY-CATEGORY-BRANCH`
**HEAD de origem:** `28131866`
**Decisor:** Clayton (Op-i — governar por categoria/ramo; **trocar a régua errada**, não desligar a segurança)

---

## 1. Título
A materialização de produto PJ é governada por **categoria/ramo pré-moldado** do `company_type` (o recorte que o
store-onboarding já faz), **não** por comparação de `canonical_products.concept_id` (camada **item-comercial**)
contra `company_type_allowed_concepts.concept_id` (camada **vendor/atuação**) — comparação que `DECISION-0105`
tornou inválida (camadas distintas). **Troca-se a régua errada (vendor mede SKU) pela régua certa (categoria/ramo
mede SKU); a segurança permanece — não é no-op global.** Decide a norma; não toca código (guard-fix é frente própria).

## 2. Data
2026-06-05.

## 3. Tipo
Arquitetura / Ontologia / Marketplace PJ. Docs-only.

## 4. Status
PROMULGADA. Não autoriza alterar o guard, código, migration, seed, ou Op2. Só crava a norma de governança e a
sequência de execução futura.

## 5. Contexto
Op1 (`F-PJ-STAGE4-COMPANY-TYPE-BRIDGE`, `28131866`) ligou o Stage 4 na empresa classificada
(`companies.primary_company_type_id`). Ao exercer a ponte (Op2 supermercado), o `product-concept-guard`
(`assertProductConceptAllowedForTenant`, em `product.repository.createProduct`) rejeitou a materialização. A
auditoria read-only `F-PJ-PRODUCT-CONCEPT-GUARD` mostrou que o guard **nasceu antes da DECISION-0105** (1º commit
2026-05-04; 0105 em 2026-06-05) e **reconflata camadas**.

## 6. Problema
O guard compara `canonical_products.concept_id` (camada **item-comercial**, SKU) contra
`company_type_allowed_concepts.concept_id` (camada **vendor/atuação**). Por `DECISION-0105` são camadas distintas →
**interseção zero** → o guard rejeita **todo** produto industrial quando há `company_type` setado; só "passa" pelo
bypass quando `tenants.company_type_id` é NULL (falso-verde). Além disso lê `tenants.company_type_id` (segundo
leitor do disconnect que a Op1 corrigiu no resolver).

## 7. Evidência material (auditoria read-only `F-PJ-PRODUCT-CONCEPT-GUARD`; código/banco vivos, HEAD `28131866`)
1. `product-concept-guard.ts` (§7.3-7.5 PLANO_FASE_ATUAL) compara `canonical_products.concept_id` × allowed do
   `company_type` lido de `tenants.company_type_id` (l.33-36). 1º commit **2026-05-04** (pré-0105).
2. `canonical_products.concept_id`: **35/35 domain `item-comercial`** (camada item/SKU).
3. `company_type_allowed_concepts.concept_id`: `produtos-e-comercio`(5) + `servicos`(2) (camada vendor/atuação).
   **Interseção com item-comercial = 0.**
4. `tenants` hoje: company_type_id NULL → o guard só não dispara por bypass (l.53). Setar o tipo → rejeita.
5. **Recorte por categoria já existe:** `store-onboarding.validateMarketplaceCategories` (l.320) +
   `findCatalogProductsByCategories(selectedIds)` (l.358) → materializa **só** canonicals nas categorias = **ramos
   pré-moldados** do `company_type` (`default_department/branch_slugs`). É governança por ramo (0105-alinhada).
6. `canonical_products` têm `category_id` confiável (35/35); supermercado = **22 canonicals** nos seus ramos.
7. **Callers de `createProduct`** (via `product.repository:102`, todos passam pelo guard): `store-onboarding.service:379`
   e `marketplace-templates.service:773`.
8. **Risco "farmácia vende banana":** sob governança por categoria, **não** — ramos da farmácia
   (medicamentos/higiene/cosmeticos) não incluem hortifruti → banana fora do recorte.

## 8. Decisão
A elegibilidade de produto industrial/global para uma PJ é governada por **categoria/ramo pré-moldado** do
`company_type` (o recorte por categoria), **não** por igualdade entre `canonical.concept_id` (item-comercial) e
`company_type_allowed_concepts` (vendor). `company_type_allowed_concepts` permanece **vendor-only**. **NÃO** é
liberação ampla: o produto **continua** precisando passar pelo recorte de categoria/ramo quando houver contexto de
company/company_type; sem prova de recorte e sem contexto suficiente → **legado/compat** ou **fail-closed**, nunca
liberação geral. **Sem código/guard-fix nesta DECISION.**

## 9. Decisões D1–D12

**D1 — `item-comercial` é camada de item/SKU/mercadoria.** É o catálogo de itens (lastro de `canonical_products`).

**D2 — `produtos-e-comercio` e os concepts de `company_type` são camada vendor/atuação (tipo de negócio).**

**D3 — As camadas NÃO são comparáveis por igualdade de `concept_id`.** Vendor não mede SKU. Comparar
`canonical.concept_id` (item) com `company_type_allowed_concepts` (vendor) é inválido (DECISION-0105).

**D4 — Produto industrial/global entra pelo catálogo canônico e é elegível por CATEGORIA/RAMO.** A elegibilidade
do item para a loja = a categoria do canonical ∈ ramos pré-moldados do `company_type`
(`default_department/branch_slugs`). O recorte do store-onboarding já é essa governança.

**D5 — Empresa ativa mix via `product_offers`.** A loja ativa um subconjunto do catálogo (preço/estoque/disponibilidade).

**D6 — Preço/estoque/disponibilidade são projeções operacionais da empresa** (`product_offers`), não identidade do
produto. `canonical_products.concept_id` continua identidade semântica do item.

**D7 — `company_type_allowed_concepts` NÃO vira matriz SKU por company_type.** Proibido popular item-concepts nele
(reconflataria vendor×SKU; escala monstruosa). Permanece vendor-only/atuação.

**D8 — Fonte de `company_type` no fluxo PJ novo = `companies.primary_company_type_id`** (Op1). `tenants.company_type_id`
**não** é fonte do fluxo PJ fiscal-first; quando muito, path legado/compat. **Não popular** `tenants.company_type_id`.

**D9 — NÃO é no-op global (a nuance de Clayton — "troca a régua, não desliga a segurança").** Para canonical de
camada `item-comercial`, o guard **não** valida por match de concept vendor; **mas** o produto **ainda** precisa passar
pelo recorte de categoria/ramo quando houver contexto de company/company_type. **Se um caller não prova recorte por
categoria/ramo e não fornece contexto suficiente → legado/compat ou fail-closed**, nunca liberação ampla. O recorte do
store-onboarding **é** governança válida e deve ser reconhecido como tal.

**D10 — Blast radius (a verificar no code-fix, não agora):** `product.repository.createProduct` é infra
**compartilhada**; callers `store-onboarding.service:379` e `marketplace-templates.service:773` passam pelo guard. O
guard-fix deve preservar a governança para ambos (store-onboarding via recorte; **marketplace-templates a verificar
antes** de qualquer mudança).

**D11 — Critérios do code-fix futuro (`F-PJ-PRODUCT-CONCEPT-GUARD-LAYER-FIX`):** remover a comparação
item-comercial × vendor; preservar segurança por recorte de categoria/ramo; verificar callers (store-onboarding,
marketplace-templates); provar que **banana não entra em farmácia**; que **supermercado materializa itens dos seus
ramos**; que **canonical não duplica**; **zero Bank**. Qualquer leitura de company_type que reste → `companies.primary_company_type_id`.

**D12 — Bloqueios.** Esta DECISION NÃO autoriza: alterar o guard/código; migration; seed; popular
`tenants.company_type_id`; popular item-concepts em `company_type_allowed_concepts`; abrir Op2 supermercado; mexer em
`product_offers`/`canonical_products`; Bank.

## 10. O que esta DECISION ratifica
- Aplica `DECISION-0105` (camadas multi-natureza de `concepts.domain`) à governança de produto: item-comercial ≠
  vendor; não comparar por igualdade.
- Ratifica a regra do catálogo canônico (`DT-PJ-CANONICAL-CATALOG-SHARED-ITEMS-NOT-PER-VERTICAL`: canonical global,
  empresa ativa mix) e a Op1 (`companies.primary_company_type_id` como fonte; tenant não vence).
- Ratifica Lei 7 (CONCEPT = identidade; o concept do item segue identidade, só não é régua de elegibilidade vendor).

## 11. O que NÃO está autorizado
Ver D12. Em particular: nenhum guard-fix/código nesta fatia; nenhuma população de `tenants.company_type_id` ou de
item-concepts em `company_type_allowed_concepts`; nenhum Op2.

## 12. Impacto em DTs
- **Criada** `DT-PJ-PRODUCT-CONCEPT-GUARD-PRE-0105-LAYER-CONFLATION` (OPEN) — guard pré-0105 reconflata
  item-comercial × vendor + lê `tenants.company_type_id`; mitigação prevista = code-only guard-fix (D11) após esta DECISION.
- `DT-PJ-STAGE4-COMPANY-TYPE-SOURCE-DISCONNECT` → permanece **PARTIALLY MITIGATED** (a ponte do resolver está provada;
  o guard é segundo leitor de tenants — entra no guard-fix).
- `DT-PJ-CANONICAL-CATALOG-SHARED-ITEMS-NOT-PER-VERTICAL` → inalterada (governa o catálogo; esta DECISION aplica-a ao guard).

## 13. Sequência autorizável (sem execução nesta DECISION)
1. **Esta DECISION** (docs-only).
2. **`F-PJ-PRODUCT-CONCEPT-GUARD-LAYER-FIX`** (code-only) — D11: remove a comparação errada, preserva o recorte por
   categoria/ramo, verifica `marketplace-templates`, fonte de company_type → companies, fail-closed sem contexto.
3. **`F-PJ-STAGE4-TRILHO-A-SUPERMERCADO`** (Op2) — retomar: supermercado ativa mix em `product_offers`.
**Critério:** Op2 só volta após a 0108 + o guard-fix.

## 14. Referências normativas
`18_DOMAIN_ONTOLOGY §5/§7` · `DECISION-0105` (camadas de `concepts.domain`) · `DECISION-0104` (CNAE sinal) ·
`DECISION-0107` (label apresentação) · `DT-PJ-CANONICAL-CATALOG-SHARED-ITEMS-NOT-PER-VERTICAL` · Lei 7 (CONCEPT=SSOT)
· `PLANO_FASE_ATUAL §7.3-7.5` (intenção original do guard).

## 15. Referências de estado/commits
HEAD origem `28131866` (ponte Op1). Evidência: `product-concept-guard.ts` (1º commit `14111f7c` 2026-05-04),
`canonical_products` (35/35 item-comercial), `company_type_allowed_concepts` (vendor-only), `store-onboarding`
(recorte por categoria), callers `store-onboarding.service:379`/`marketplace-templates.service:773`. Auditoria
read-only `F-PJ-PRODUCT-CONCEPT-GUARD`.
