# C.27 — testes de integração T1–T4

**Data:** 2026-04-11  
**Ficheiro (supersedido):** `backend/tests/integration/canonical-resolution.test.ts` — ver `2026-04-09_c27_t1_t4.md`.  
**Comando:** `cd backend && pnpm run test:integration:canonical-resolution`

## Resultado

**PASS** (4 testes) — requer `DATABASE_URL`, `domains`, `categories`, migrations `canonical_products.scope`.

## Mapeamento matriz / comportamento real

| ID | Plano (cenário) | O que o teste verifica |
|----|-----------------|-------------------------|
| T1 | C.11 global vs scoped (mesmo GTIN) | `resolveRefsFromVariant` com `canonical_product_id` global → `concept_ref` do global. |
| T2 | C.2 Escopo B (GTIN) | `canonicalProductRepository.findByTenantAndGtin` → linha **scoped** primeiro. |
| T3 | C.18 sem fallback | Canónico de **outro tenant**: `getProductById` sem `includeNonReady` oculta o produto → adapter `PRODUCT_NOT_FOUND` (não há fallback GTIN). |
| T4 | C.5 / 5C observabilidade | Canónico `unresolved`: mesmo gate → `PRODUCT_NOT_FOUND`; causas finas `CANONICAL_*` em **unit** `concept-offer-refs.adapter.test.ts`. |

## Nota normativa

T3/T4 reflectem o **contrato actual** do `product.repository` (filtro READY/visível antes do adapter). Se o produto quiser falha `failureReason` canónica com produto ainda listável, seria mudança de contrato (fora deste patch).
