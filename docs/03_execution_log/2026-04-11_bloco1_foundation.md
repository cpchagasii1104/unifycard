# Bloco 1 — Fundação (verificação contínua 2026-04-11)

| # | Verificação | Evidência | PASS |
|---|-------------|-----------|------|
| 1 | `fetchCategoryConceptId` removido | `grep` no adapter → 0 ocorrências | [✓] |
| 2 | `toArchitecturalRefs` / `ToArchitecturalRefsInput` removidos | 0 ocorrências | [✓] |
| 3 | `categories.concept_id` ausente no adapter | 0 ocorrências | [✓] |
| 4 | Funções principais | `resolveRefsFromVariant`, `resolveRefsBatchFromVariants`, `resolveConceptFromProduct` presentes; `canonical_product_id` referenciado | [✓] |
| 5 | Predicado READY | Equivalente TS em `resolveVisibleCanonicalToConceptRef` + classificação batch (confirmed, concept_id, name, category_id, INDUSTRIAL) | [✓] |
| 6 | 1B migration aplicada | **Pendente ambiente:** ficheiros `20260501100000_*`, `20260513100000_*` existem no repo; `psql`/`pnpm migrate` não corridos nesta sessão (sem `DATABASE_URL` fiável) | [ ] |
| 7–9 | 2A schema aplicado | **Pendente ambiente:** `20260502100000_*` existe; queries `information_schema` não executadas aqui | [ ] |
| 10 | E2E | `concept-offer-refs.adapter.test.ts` (unit) 11/11 PASS; E2E catálogo não reexecutado | [~] |

**Resultado bloco 1 (estático):** PASS com pendências **6–9** em BD.
