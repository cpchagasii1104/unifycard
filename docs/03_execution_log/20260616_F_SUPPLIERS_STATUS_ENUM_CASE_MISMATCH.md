# 2026-06-16 — F-SUPPLIERS-STATUS-ENUM-CASE-MISMATCH

Pequena/local: alinha o `status` de suppliers ao **CHECK físico canônico lowercase**, corrigindo o resíduo
pré-existente (ressalva R2 da Yala) exposto ao energizar suppliers. Parent `d8bf869b` · branch `rescue-structural`
· dev **390 (ZERO migration — DB já correto)**. Bug de alinhamento runtime/types ↔ CHECK; sem decisão de produto,
sem ownership, sem AP/PO/Bank.

## Causa (prova pré-patch, material)

- **CHECK físico (dev, read-only):** `suppliers_status_check = CHECK ((status = ANY (ARRAY['active','inactive'])))`
  → **DB canônico lowercase, correto** (alvo é runtime/types, NÃO o DB). DB column default já = `'active'`.
- **Runtime/type (errados):** `supplier.types.ts:7` = `SupplierStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'` (uppercase
  + 'SUSPENDED' que o DB nem aceita); `supplier.service.ts` default `status: input.status || 'ACTIVE'`.
- **Efeito:** POST /suppliers SEM status → service grava `'ACTIVE'` → viola o CHECK → 500. Latente (row_count era 0).
- **Local:** nenhuma necessidade de tocar owner_actor_id / AP / PO / migration (DB já aceita active/inactive).

## Correção (runtime/types only — ZERO migration)

- **`supplier.types.ts`:** `SupplierStatus = 'active' | 'inactive'` (lowercase canônico; 'SUSPENDED' removido — não
  existe no DB).
- **`supplier.service.ts`:** novo `normalizeSupplierStatus(raw)` + const `SUPPLIER_STATUSES=['active','inactive']`:
  ausente/vazio → `'active'`; `'ACTIVE'`/`'Active'` → normalizado `'active'`; valor fora do canônico → **rejeitado**
  (`SUPPLIER_STATUS_INVALID`, falha honesta antes do CHECK). `createSupplier` usa o status normalizado (default
  'active'). `listSuppliers` normaliza o filtro `status` p/ lowercase (senão `?status=ACTIVE` retornaria vazio).
- **Escolha documentada (E2E #4):** `status='ACTIVE'` é **NORMALIZADO** para `'active'` (forgiving), não rejeitado;
  só valores fora de {active,inactive} (ex.: 'pending') são rejeitados.
- **DB CHECK NÃO alterado** (já correto). **PRESERVADOS:** owner_actor_id · canRepresentActor(owner_actor_id) ·
  created_by_actor_id (audit) · tenant_id (escopo).

## Provas

| Prova | Resultado |
| --- | --- |
| backend typecheck (build) | **25** (baseline; 0 em supplier) |
| e2e efêmero `validate-pipeline-e2e-supplier-owner-authority.ts` | **17/17** |
| guard `audit-supplier-owner-authority.mjs` (estendido) | GATE OK |
| negative-proof | **8 mordidas** byte-idêntico (incl. status-uppercase) |
| validate:actor-writer-boundaries / bank-ledger-boundaries | GATE OK / GATE OK |
| validate:regression-guards | rc=0 |
| validate-architectural-patterns --strict | exit 0 · critical_new=0 |

E2E (status, sem regressão de owner): T1 create **SEM status** → 201 + `status=active` (default canônico) + owner/
created_by intactos · T11 `active`→active · T12 `inactive`→inactive · T13 `ACTIVE`→**normalizado** active · T14
`pending`→rejeitado (não 201; não vaza CHECK/42P01) · T15 zero suppliers fora de {active,inactive}. Owner-authority
(T2–T10) verde — sem regressão.

## Escopo negativo (confirmado)

ZERO migration · ZERO alteração do CHECK físico (já correto) · ZERO owner_actor_id/DECISION-0133/migration de owner ·
ZERO contacts · ZERO Bank/Core/ledger/payout/split/recovery · ZERO AP/PO/purchase_orders · ZERO RLS · ZERO RBAC/FASE 6
· ZERO delegação/cargo.

## DT

- **DT-SUPPLIERS-STATUS-ENUM-CASE-MISMATCH → CLOSED** (corrigido + provado).

## Estado

**IMPLEMENTED / HOLD PARA RESEAL.** Fecha SÓ como **F-SUPPLIERS-STATUS-ENUM-CASE-MISMATCH**: o status de suppliers
está alinhado ao CHECK físico lowercase (`active`/`inactive`); createSupplier sem status funciona (default `active`);
input `ACTIVE` normalizado; inválido rejeitado; owner authority e DECISION-0133 intocados; zero migration. dev 390.
