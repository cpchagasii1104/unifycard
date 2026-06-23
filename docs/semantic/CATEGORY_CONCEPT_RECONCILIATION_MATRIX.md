# Matriz de Reconciliação Categoria ↔ Concept — F-CATEGORY-CONCEPT-ORPHANS-RECONCILIATION

**Data:** 2026-06-23 · **HEAD:** `1ac06eda` · **Tipo:** semântico / pré-money (READ-FIRST + guard; **sem migration**) · **Branch:** `rescue-structural`
**Regra central:** CONCEPT é o SSOT semântico (Lei 7 / 18_DOMAIN_ONTOLOGY §5). Categoria = navegação/organização. Slug **não** é identidade semântica. `categories.concept_id` ajuda navegação mas **não substitui** `concept_ref` em fluxo transacional.

## Contagem (de 1ª mão, runtime `unificard_dev`)
```
categorias total ......... 147
com concept_id ........... 77
SEM concept_id (órfãs) ... 70
  ├─ level 0 (raízes) .... 24  (todas órfãs)
  ├─ level 1 ............. 46  (74 com concept)
  └─ level 2 ............. 0   (3 com concept)
folhas órfãs (sem filhos)  45
todas as 70: status=active · is_active=t · is_created_by_ai=f · requires_review=f
```

## Matriz de classificação (READ-FIRST adversarial, 3 ângulos + verificação 1ª mão)
| Grupo | Qtd | Classificação | Evidência | Veredito |
|---|---|---|---|---|
| Raízes N0 (level 0) | 24 | `SHOULD_REMAIN_ORPHAN_NAV_ONLY` | marketplace-categories.service.ts:52 (rootCategories=!parentId); ONTOLOGIA §5.11 | Âncoras de domínio — categoria navega, não define identidade. Órfã é **correto**. |
| Folhas órfãs | 45 | `LIVE_NAVIGATION_ONLY` | product-visibility.service.ts:68-70 (categoryIds **opcional**); marketplace-search.service.ts:45-47 | Filtro/navegação. Services discovery daria 403 (CATEGORY_REQUIRES_LEAF_CONCEPT) se recebesse uma — fail-closed correto; marketplace não exige. |
| Intermediárias órfãs | 1 | `LIVE_NAVIGATION_ONLY` | árvore de navegação | Nó de navegação. |

**Nenhuma das 70 é `LIVE_BLOCKING`.** Nenhuma trava fluxo transacional.

## Por que NÃO há migration (Cenário A)
- **DECISION-0142** (folha→concept obrigatório) é enforçada **só em services discovery** (services-discovery.service.ts:376-381; services.service.ts:312-321). 403 fail-closed se folha sem concept.
- **Produto/marketplace** tira identidade de `canonical_products.concept_id` (concept-offer-refs.adapter.ts:131-141 — "sem categoria"), **nunca** de categoria/slug. `category_id` no canonical é só **DECISION-0108** (ramo/elegibilidade de company_type), não identidade.
- **Zero fallback transacional** category/slug→concept_ref (verificado). (profile-inference usa slug como recomendação de **navegação**, policy-gated + logado, nunca p/ concept_ref transacional.)
- Norma confirma: concept=SSOT (Lei 7), categoria=navegação (ONTOLOGIA §5.11); raízes/domínios podem ser órfãs legitimamente. Frontend usa slug **só** p/ navegação visual.
- **Não inventar conceito por slug** — criar concept p/ as 45 folhas seria fabricar significado. Permanecem nav até (se algum dia) entrarem em fluxo transacional próprio, quando o concept nascerá pela via canônica.

## Gap fechado (deliverable)
Os guards existentes cobrem **services** (`audit-discovery-concept-rekey` + `audit-service-concept-mandatory-fk-restrict`). Faltava proteger o **caminho produto/marketplace**. Novo guard **`audit-marketplace-concept-no-category-fallback.mjs`** (na cadeia regression-guards): morde se o resolver de concept do marketplace (`concept-offer-refs.adapter`) passar a derivar `concept_ref` de categoria/slug, ou se product-visibility virar categoria em gate de identidade. **NP:** `concept_ref: String(row.category_id)` → mordeu.

## Resíduo / futuro
- As 45 folhas órfãs permanecem `LIVE_NAVIGATION_ONLY`. Se uma entrar em fluxo transacional (ex.: produto vendável daquele nó), o concept nasce pela via canônica (canonical_products.concept_id), nunca por slug.
- Guard anti-categoria-viva-nova-sem-concept em fluxo transacional: coberto indiretamente (services 403 + produto via canonical). Não foi criado guard de "nova categoria sem classificação" por não haver fluxo que a consuma como identidade.
