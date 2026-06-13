# 2026-06-13 — F-0113-CLASSIC-CHANNEL-READERS-BINDING (MODO: EXECUTOR)

Classifica e trata os 9 readers baselineados (params/query.actorId) da DECISION-0113 via matriz A-E.
Parent `3331ad96` · branch `rescue-structural` · dev **380 (inalterado, sem migration)** · zero Bank.
DECISION-0124.

## READ-FIRST (workflow, 9 leitores) + matriz A-E

Achado central: nem todo actorId em params/query é violação — em rotas admin/financeiro o actorId é
**filtro autorizado por permissão cross-actor** (operador já vê tudo); bindar canRepresentActor quebraria
o legítimo. As violações reais são ESCRITAS self/representado sem binding.

| Arquivo | Classe | Tratamento |
| --- | --- | --- |
| public-profiles | B | **FECHADO** — writes bindados (canRepresentActor) + lista força PUBLIC |
| marketplace-categories | A/B | **FECHADO** — /import substitui self-check por canRepresentActor; GET público |
| reporting | D | baselineado — view_all_ledger cross-actor = filtro autorizado (F-OK) |
| payout | D | baselineado — FINANCIAL hard-stop (execute_payout); writers não tocar |
| bank-http | D | baselineado — BANK hard-stop; GET /balance tem resolveForUser |
| business-audit | D | baselineado — admin:view_audit_logs; escopo = DECISION_REQUIRED |
| policy | D | baselineado — requirePolicyPermission; per-actor = R2 DECISION_REQUIRED |
| trust | D | baselineado — requireRole admin INTERINO (R2.4); assertActorRepresentActor interno |
| risk-dashboard | D | baselineado — RESÍDUO PRIORITÁRIO: requirePermission(actorId,actorId) spoofável → fix modelo de permissão (R2) |

## Arquivos alterados

| Arquivo | Mudança |
| --- | --- |
| `modules/public-profiles/public-profile.routes.ts` | helper `assertRepresentsActor` (canRepresentActor) em 3 writes; lista força visibility=PUBLIC |
| `modules/marketplace/marketplace-categories.routes.ts` | /import: canRepresentActor substitui `actor.actor_id !== actorId` |
| `scripts/audit-actor-authority-boundary.mjs` | baseline 9→7 (2 removidos; 7 com nota A-E justificada) |
| `src/scripts/validate-pipeline-e2e-classic-channel-readers-binding.ts` (novo) + wrapper (novo) | e2e 9/9 |
| DECISION-0124 + DECISIONS_LOG + DT_LOG + STATUS | cartório |

## Provas

| Prova | Resultado |
| --- | --- |
| e2e `classic-channel-readers-binding` (DB efêmera) | **9/9** |
| canRepresentActor truth (ownership) | ✅ |
| T2 POST /public-profiles não-representante → 403 | ✅ |
| T3 representante passa (≠403) | ✅ |
| T-struct writes bindados + lista PUBLIC + marketplace /import bindado | ✅ |
| T5 baseline 9→7 (2 removidos, 7 justificados A-E) | ✅ |
| T7 Bank intocado · T8 contenções/bindings anteriores intactos | ✅ |
| Guard 0113 | flagged=7 baseline=7 **new=0 stale=0** + prova negativa OK |
| Gates | actor-writer OK · bank-ledger OK · regression-guards rc=0 · arch --strict critical_new=0 |
| tsc backend | 25 (baseline arco 0113), zero novo nos 2 arquivos | sem migration · dev 380 |

## Hard stops respeitados

Zero Bank/ledger/transactions/reversal/payout writer; sem migration; sem RBAC V2/FASE6/R2; sem inventar
política admin/financeiro (DECISION_REQUIRED registrada); requireRole/requirePermission não promovidos a
soberanos; recurso público não virou privado; privado não vazou em rota pública; dispute/service-order/event
bindings intactos.

## Cartório

- DECISION-0124 + REMEDIATION_DECISIONS_LOG.
- `DT-0113-CLASSIC-CHANNEL-READERS`: OPEN → **PARTIAL** (baseline 9→7; 5 DECISION_REQUIRED + 2 financeiro hard-stop).
- `DT-0113-AUTHORITY-CLIENT-DECLARED-ACTOR-BOUNDARY`: baseline 9 → 7.

## Estado

F-0113-CLASSIC-CHANNEL-READERS-BINDING: **IMPLEMENTED / HOLD PARA RESEAL**.
