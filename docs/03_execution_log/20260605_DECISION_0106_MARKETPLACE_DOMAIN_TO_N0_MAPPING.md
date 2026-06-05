# Execution Log — DECISION-0106: mapa `MarketplaceDomain → N0` (FRENTE α, docs-only)

**Data:** 2026-06-05
**Modo:** EXECUTOR DOCS-ONLY CONTROLADO
**Branch:** `rescue-structural`
**HEAD origem:** `44e44f34`
**Frente:** `F-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK-DECISION` (α — esteira)
**Decisor:** Clayton (ratificação do menu α + decisão vehicles=b)

---

## Objetivo
Promulgar o mapa `MarketplaceDomain → N0`, fechando o fork de vocabulário (`DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK`). **Docs-only; zero código/schema/frontend/runtime/DML.**

## Mapa promulgado (D1–D6 na DECISION-0106)
- `market` → `produtos-e-comercio` (+ `item-comercial` = catálogo/SKU)
- `services` → `servicos`
- `events` → `cultura-lazer-e-eventos`
- `jobs` → capability transversal (não domínio; 0102 D12)
- `real_estate` → regulado, sem alvo vivo (imóveis ausente)
- `vehicles` → **regulado, sem alvo (opção b)** — não mapear `mobilidade-e-logistica` (load-bearing do rides)

## Evidência (banco vivo + código)
- produtos-e-comercio=5, servicos=5, cultura-lazer-e-eventos=11 concepts (3 alvos N0 limpos).
- imóveis: grep `imov/imobil/real` em domains/concepts = vazio → `real_estate` sem alvo.
- `mobilidade-e-logistica` = 12 concepts de tipos de veículo (carro/moto/van…), **consumidos por** `backend/src/modules/rides/drivers/vehicles/vehicles.service.ts:17,89` (`concept_id`) + `report-rides-vehicles-concept-mapping.ts` → load-bearing; mapear `vehicles` conflataria vender↔operar.

## Processo (esteira — loop convergente)
1. Batedora montou o menu (5 limpos + vehicles "sem alvo, mobilidade=rides-abstrato").
2. Executora verificou contra banco vivo → **erro**: mobilidade são tipos de veículo, não rides-abstrato.
3. Batedora reconheceu + trouxe evidência decisiva (rides consome os concepts → load-bearing).
4. Executora confirmou → recomendação (b) com evidência.
5. Clayton ratificou (5 + vehicles=b).

## Ações realizadas (docs-only)
1. `docs/02_decisions/DECISION_0106_MARKETPLACE_DOMAIN_TO_N0_MAPPING.md` (criada).
2. `REMEDIATION_DECISIONS_LOG.md` (entry 0106).
3. `REMEDIATION_DT_LOG.md` (`DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK` → GOVERNED/DECISIONED).
4. `STATUS_EXECUCAO_GLOBAL.md` (entrada).
5. `opus.md` (cont.68).
6. Este execution log.

## DTs
- `DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK` → **GOVERNED/DECISIONED** (não CLOSED — resta allowed domains 0102 D5, DomainSelector derivar de N0, remover hybrid).
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` → OPEN.

## Não-toque
- Zero código/schema/migration/frontend/backend/rides/DML.
- 3 autorais intocados.

## Próximo (serializado por Clayton)
β em **série** (nada paralelo editando código): β.1 aposentar `company-canonical` front+back atômico (prova do caller vivo; substituir por fiscal-first; não remover backend sozinho) → depois β.2 writer revogação KYB (`approved→suspended/closed` + cascata 0101; Batedora especifica, execução única controlada). Regras: 1 fatia/1 commit/gates/relatório; parar/reverter se β.1 revelar caller novo; parar/reportar se β.2 revelar lacuna authority/audit/reviewer. γ/CNAE bloqueado até fonte curada.
