# 2026-06-14 — F-R2-TRUST-TENANT-GRANTS-R24-UNFREEZE (MODO: EXECUTOR / macrofrente única)

Fecha o resíduo `trust` do baseline 0113: substitui `requireRole(['admin'])` interino (R2.4 congelado) por
grant material tenant-level. Parent `427765fa` · branch `rescue-structural` · dev 382 → **383**. DECISION-0127.
Zero Bank. Baseline 0113 **3 → 2**.

## READ-FIRST (respostas)

1. **Rotas trust:** GET /trust/profile/:actorId · GET /trust/profiles · GET /trust/events · POST /trust/can-proceed · POST /trust/events · POST /trust/recalculate/:actorId.
2. **Reads:** profile/:actorId, profiles, events, can-proceed (avaliação read-only, sem mutação).
3. **Writes/mutations:** POST /trust/events (createEvent/updateScore/createSnapshot), POST /trust/recalculate/:actorId (recompute).
4. **Dados expostos:** trust profiles/scores/events (mapa de compliance/risco/anti-fraude do tenant).
5. **Escopo:** TENANT-SCOPED (todos os métodos tomam tenantId; actorId é alvo/filtro).
6. **requireRole(['admin']):** linha 15 (`adminOnly`), usado pelos 6 preHandlers — REMOVIDO.
7. **Toca dinheiro/Bank/payout/reversal/ledger?** NÃO — refs a "dispute" são só TIPOS DE EVENTO de score; nenhum bank_*/ledger/payout/transaction.
8. **Capabilities necessárias:** `can_view_tenant_trust` (reads) + `can_manage_tenant_trust` (mutations/recalculate).
9. **Trust fechável sem RBAC V2?** SIM — via tenant_operator_grants (modelo material já existente, DECISION-0126).
10. **Guard reconhece:** Forma D (canUserPerformTenantCapability; subject server-side; tenant-scoped; sem actorId cliente; não Bank/payout).

## Mudança

- migration `20260614130000_add_tenant_trust_grants.sql` (+2 booleanas em tenant_operator_grants). dev → **383**.
- `companies.service.ts`: `TenantCapabilityKey` + whitelist += `can_view_tenant_trust`/`can_manage_tenant_trust`.
- `trust.routes.ts`: `requireRole(['admin'])` REMOVIDO → `requireTrustView` (4 reads) + `requireTrustManage` (POST events + recalculate).
- **guard**: trust REMOVIDO do BASELINE → SAFE_SUBJECT_READERS (Forma D). Baseline **3→2**.
- **neg-proof**: recognized 3→**4**. **e2e** += trust (TR1–TR9) + T18 ajustado. (Forma D já tinha unit asserts da frente anterior.)

## Provas

| Prova | Resultado |
| --- | --- |
| e2e (DB efêmera 383) | **32/32** (incl. TR1–TR9: view/manage separados, company não abre trust, A≠B, view não autoriza mutation) |
| guard | `flagged=2 baseline=2 new=0 stale=0 safe_subject_recognized=4` rc=0 |
| prova negativa | **17/17** (incl. Forma D) |
| canal3 B3 + spoof T-struct | verdes (inalterados) |
| Gates | actor-writer OK · bank-ledger OK · regression-guards rc=0 · arch --strict critical_new=0 |
| tsc backend | 25 (baseline arco 0113, zero novo) |
| dev migration | 382 → **383** (runner canônico) |

## Hard stops respeitados

Zero bank_ledger/bank_transactions/payout writer/reversal/dispute; sem reabrir POST /service-orders; sem RBAC V2;
sem actor_roles/company_roles genéricos; company_users.can_* NÃO abre trust tenant-level; sem frontend; sem
service_id nullable; sem permissão financeira; bank-http/payout NÃO removidos do baseline.

## Estado

F-R2-TRUST-TENANT-GRANTS-R24-UNFREEZE: **IMPLEMENTED / HOLD PARA RESEAL**. DECISION-0127 promulgada.
**Baseline 0113: 2** (bank-http, payout). dev **383/383**. Restam DECISION_REQUIRED: bank-http/payout (Core de
Aprovação Financeira); platform-wide/cross-tenant; deprecar legado/RBAC v1.
