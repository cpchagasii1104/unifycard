# 2026-06-15 — ONDA DECISION-0131 · F-C1-MONEY-SPR-SCHEMA-INTEGRITY-FK-INDEX

Integridade material mínima de `service_payment_requests` (FK + índices), tratando o DT-SPR-READ-AUTHORITY-RESIDUES R3
(parte FK/índice). **SCHEMA-only** (migration); SEM RLS, SEM runtime, SEM fluxo financeiro. Parent `3d2115bc` · branch
`rescue-structural` · **dev 385→386**. Primeira frente da onda 0131 que cria migration.

## READ-FIRST (SELECT/catálogo — provas obrigatórias PRÉ-migration)

| Prova | Resultado |
| --- | --- |
| `service_payment_requests` existe; payer/receiver/tenant uuid NOT NULL | ✅ |
| `actors.id` tipo | uuid (PK `actors_pkey`) → FK válido |
| FK existentes em service_payment_requests | **0** (nenhuma) |
| índices existentes | pkey, booking_id unique, (tenant_id,booking_id), (tenant_id,service_id) |
| índice em payer_actor_id / receiver_actor_id | **ausente** (a criar) |
| row_count | **0** |
| órfãos payer_actor_id / receiver_actor_id vs actors | **0 / 0** |
| numeração migration | timestamp 14-díg (check-migration-numbering ignora 14-díg) |

⇒ Todas as condições do GO satisfeitas (0 FK, 0 órfãos, tipos compatíveis, sem índice equivalente) → **criar migration**.

## Migration (`20260615200000_service_payment_requests_fk_index.sql`)

Forward-only · idempotente (guard `DO $$ IF NOT EXISTS pg_constraint ... ADD CONSTRAINT` p/ FK; `CREATE INDEX IF NOT
EXISTS` p/ índice) · **sem DROP · sem alterar dados/status/lifecycle · sem RLS/policy · sem trigger · sem mexer em
`amount`/naming**:
- FK `fk_service_payment_requests_payer_actor`: `payer_actor_id` → `actors(id)`
- FK `fk_service_payment_requests_receiver_actor`: `receiver_actor_id` → `actors(id)`
- índice `idx_service_payment_requests_tenant_payer` (tenant_id, payer_actor_id)
- índice `idx_service_payment_requests_tenant_receiver` (tenant_id, receiver_actor_id)
- (tenant_id,booking_id) e (tenant_id,service_id) JÁ existem → **NÃO recriados**.

## Provas pós-migration

- **Aplicada em dev** (CORE_ONLY default; `EXPECTED_DATABASE_NAME=unificard_dev`): 1 pendente → executada (131ms);
  catálogo confirma **2 FKs + 2 índices novos**; **dev = 386**.
- **e2es SPR com FK ativa** (ephemeral FULL aplica a migration; seeding cria actors ANTES do payment request → FK
  satisfeita): read **9/9**, create **10/10**. Runtime não quebrou.
- **Gates:** actor-writer/bank-ledger OK · regression-guards rc=0 (check-migration-numbering + sql-regression-lint
  passam) · arch critical_new=0 · tsc build **25**/strict **43** (INALTERADO — zero `.ts` tocado).

## DT

- **DT-SPR-READ-AUTHORITY-RESIDUES R3:** FK + índices **✅ RESOLVIDOS**. **RLS continua OPEN** (frente/decisão própria —
  NÃO incluída nesta frente; R3 NÃO está totalmente fechado enquanto RLS ficar fora).

## NÃO FECHADO / NÃO TOCADO

RLS de service_payment_requests · C1_MONEY inteiro · POST execute · firewall DECISION-0110 · Bank/Core/ledger/split ·
payout/settlement/reversal · purchase-order/AP-AR · payer-initiated payment · naming amount/amount_cents ·
service_payment_executions · 30 rotas canal-1 restantes · RBAC/FASE 6 · delegação R2. Zero `.ts`; GETs/POST selados
intocados.

## Estado

**IMPLEMENTED / HOLD PARA RESEAL**. Fecha SÓ como **F-C1-MONEY-SPR-SCHEMA-INTEGRITY-FK-INDEX**: integridade material
mínima (FK payer/receiver→actors + índices de lookup) materializada por migration idempotente; dev 385→386; RLS segue
como resíduo próprio. Zero runtime/Bank/financeiro.
