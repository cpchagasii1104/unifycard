# Execution Log — DECISION-0105: semântica de `concepts.domain` (docs-only)

**Data:** 2026-06-04
**Modo:** EXECUTOR DOCS-ONLY CONTROLADO
**Branch:** `rescue-structural`
**HEAD origem:** `970a208d`
**Frente:** `F-CONCEPTS-DOMAIN-LAYER-SEMANTICS-DECISION`
**Decisor:** Clayton (Opção 1 + Opção 2, sem rename e sem schema)

---

## Objetivo
Registrar, em docs-only, a DECISION que promulga a semântica de `concepts.domain` como dimensão multi-camada legítima, e atualizar a DT correspondente. **Zero schema/runtime/Bank/marketplace/CNAE/publication/frontend/DML.**

## Decisão promulgada (resumo — D1–D10 na DECISION)
1. `concepts.domain` é oficialmente **dimensão semântica multi-camada**.
2. Camadas legítimas: (a) N0 de atuação; (b) `financeiro-*` (RFC C2); (c) item/SKU comercial (`item-comercial`).
3. `financeiro-*` intocado (RFC C2 + load-bearing no Bank).
4. `item-comercial` legitimado como camada de item/SKU.
5. `item-comercial` NÃO absorvido em `produtos-e-comercio`.
6. `produtos-e-comercio` = tipo de comércio/vendedor.
7. `item-comercial` = mercadoria/produto/SKU.
8. Sem `layer`/`n0_domain`/schema agora.
9. Sem renomear `item-comercial`.
10. Sem tocar runtime/migrations/Bank/marketplace/CNAE/publication/frontend.

## Evidência-base (reconciliada)
- `financeiro-*`: RFC C2 (`docs/02_decisions/RFC_C2_seed_concepts_financeiros.md`) + hardcode Bank (`bank-integration.service.ts:635`, `concept-financial-resolver.service.ts:17-54`).
- `item-comercial`: 35 concepts SKU (`arroz-branco-tipo-1`, `banana-prata`…); 35 `canonical_products` via concept_id (UUID, sem string-coupling); legado em `concept-resolution-context.ts:3`.
- `produtos-e-comercio`: 5 concepts de tipo-de-negócio (varejo alimentar/farmacêutico); usado pelos 7 company_types.
- `unificard`: inerte (0/0).

## Ações realizadas (docs-only)
1. `docs/02_decisions/DECISION_0105_CONCEPTS_DOMAIN_SEMANTIC_LAYERS.md` — DECISION (criada).
2. `REMEDIATION_DECISIONS_LOG.md` — entry DECISION-0105 (append; série file-per-decision = 0105).
3. `REMEDIATION_DT_LOG.md` — `DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD` → PARTIALLY MITIGATED / GOVERNED.
4. `STATUS_EXECUCAO_GLOBAL.md` — entrada de status.
5. `opus.md` — memória (cont.66).
6. Este execution log.

## DTs
- `DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD` → **PARTIALLY MITIGATED / GOVERNED** (não CLOSED — falta reflexo formal em `18_DOMAIN_ONTOLOGY`/RFC).
- `DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK` → OPEN, **DESBLOQUEADA**.

## Não-toque (confirmado)
- Zero schema/migration/backend/frontend/DML/Bank/marketplace/CNAE/publication.
- 3 autorais intocados (`CRIACAO_DE_EMPRESAS.md`, `criacao-de-empresa.png`, `fluxo-empresa.png`).

## Próximo passo recomendado
`F-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK-DECISION` — mapear `MarketplaceDomain` com a semântica promulgada. Resíduo: emenda normativa das 3 camadas em `18_DOMAIN_ONTOLOGY` (fecha a DT).

## Regra final
Decidir a semântica. Não mexer na estrutura.
