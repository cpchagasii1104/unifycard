# 2026-06-15 — ONDA DECISION-0131 · E2 (TEMPORAL TOMBSTONE / LEGACY WRITE-PATH REGRESSION LOCK)

Pós-PASS E1 (commit `b985ba1b`). E2 **NÃO** corrige agenda/availability/booking. E2 garante que o trilho temporal LEGADO
(`schedules`/`schedule_slots`, DECISION-0014/C63) **continue morto** — tombstone/regression-lock. **ZERO runtime change**
(só guard .mjs + neg-proof .ps1 + package.json + cartório; nenhum `.ts`/migration tocado). Parent `b985ba1b` · branch
`rescue-structural` · dev **385/385**.

## READ-FIRST (workflow read-only de 3 mappers + DB vivo + leitura 1ª mão)

**Estado do legado temporal (confirmado de 1ª mão):**
- `schedules` e `schedule_slots` EXISTEM, **0 linhas**.
- **Zero writer de runtime**: grep raw-SQL (`INSERT INTO/UPDATE/DELETE FROM (schedules|schedule_slots)`) e query-builder
  (`'schedule_slots'`+`.insert/.update/.delete`) em todo `src` = **vazio** (2×). Workflow confirmou `writesSchedulesTable=NONE`
  nos 3 clusters (8 arquivos candidatos).
- **3 serviços-tombstone** (C63 FASE 1/2A): `SlotGenerator`, `EventScheduleService`, `EmployeeService` — cada método
  lança `*LegacyError`, **zero acesso a DB**, **sem callers** em todo `src`. `CheckoutTicketService` = re-export tombstone.
- `checkout-ticket.service.ts` migrado p/ unified_availability (`slotId = null`); `weekly-template-materializer` grava
  SÓ em `availability` (blindagem "NUNCA em schedules/schedule_slots"); `social-work-schedule.service` lança 501
  ('temporarily disabled'); `EventAvailabilityPreviewService` **LÊ** `schedule_slots` (read-model, read-only).
- **REVOKE aplicado:** migration `20260428200000_schedules_revoke_write.sql` (REVOKE INSERT,UPDATE ON schedules/schedule_slots
  FROM PUBLIC) **está em `schema_migrations`**; `has_table_privilege('public', …, INSERT/UPDATE/DELETE)` = **FALSE** (PUBLIC
  negado nas 3 operações).
- **SSOT temporal canônico vivo** = unified_availability + unified_bookings (E1).

**Brakes:** #1 (writer vivo real) → NÃO disparado (zero writer). #2 (REVOKE não aplicado) → NÃO disparado (aplicado +
PUBLIC negado). Frente segue como tombstone/lock (não vira frente de correção).

## Lacuna objetiva (o que justifica o guard)

Não havia guard impedindo um **writer NOVO** de código contra schedules/schedule_slots, nem pinando o REVOKE migration.
A única defesa era o REVOKE no banco — e o app conecta como `postgres` (OWNER), que **bypassa** REVOKE. Logo a garantia
EFETIVA é CÓDIGO (zero writer). Sem guard, um writer novo passaria silenciosamente.

## Patch (só guard, ZERO runtime)

- **`scripts/audit-temporal-legacy-tombstone.mjs`** (novo, no `validate:regression-guards`; mirror do
  `audit-bank-ledger-boundaries`): (a) zero `INSERT/UPDATE/DELETE` de runtime contra schedules/schedule_slots (comment-
  stripped; exclui `scripts/`+tests; **LEITURA SELECT/FROM NÃO casa** → preview legado preservado); (b) migration de
  REVOKE presente + revogando schedules E schedule_slots FROM PUBLIC; (c) os 3 serviços continuam lançando `*LegacyError`.
- **`scripts/negative-proof-temporal-legacy-tombstone.ps1`** (novo): 5 mordidas.
- **`package.json`:** guard encadeado ao fim de `validate:regression-guards`.
- **NÃO tocado:** nenhum `.ts` de runtime · nenhuma migration · os 3 tombstones · availability/booking/agenda · a leitura
  legada legítima.

## Provas

- **Guard** `audit-temporal-legacy-tombstone.mjs`: GATE OK (CLOSED=5, writers=0).
- **Negative-proof**: **5 mordidas** byte-idêntico — (1) INSERT INTO schedules novo · (2) UPDATE schedule_slots novo ·
  (3) DELETE FROM schedules novo · (4) REVOKE de schedule_slots removido da migration · (5) SlotGenerator deixa de lançar
  *LegacyError. Probe temporário removido; migration/serviço restaurados byte-idêntico (SHA256).
- **Sem e2e novo:** frente é guard estrutural + neg-proof, zero runtime. O e2e pré-existente
  `validate-pipeline-e2e-transversal.ts` já checa o REVOKE de `schedule_slots` em runtime (B4-struct).

| Prova | Resultado |
| --- | --- |
| audit-temporal-legacy-tombstone guard | GATE OK (CLOSED=5, writers=0) |
| negative-proof | 5 mordidas; byte-idêntico; probe removido |
| validate:actor-writer-boundaries / bank-ledger-boundaries | GATE OK / GATE OK |
| validate:regression-guards (chain) | rc=0 (+1 guard) |
| validate-architectural-patterns --strict | exit 0 · critical_new=0 (0 atribuível) |
| tsc | build **25** · strict **43** (INALTERADO — zero `.ts` tocado) |

## DT (DT-TEMPORAL-LEGACY-DECOMMISSION-RESIDUES — resíduos, NÃO corrigidos)

R1 leitura legada viva (`EventAvailabilityPreviewService` SELECT FROM schedule_slots) · R2 coluna morta
`event_tickets.schedule_slot_id=null` · R3 rota `social-work-schedule` 501 montada · R4 doc "não aplicada" stale vs DB
(REVOKE aplicado + PUBLIC negado) · obs owner-bypass (app=owner bypassa REVOKE → garantia é código).

## NÃO FECHADO (proibições do GO respeitadas)

agenda inteira · availability inteiro · booking · participants · conflicts · weekly-template · list/by-id · temporal
lifecycle · availability owner-authority (E1) · canal-1 baseline (B1f) · PDV/groups-mine/reversal · Bank/Core · RLS ·
mapper · cargo-template · RBAC/FASE 6 · actor_delegations/R2. Nenhuma migration criada. Nenhum `.ts` tocado.

## Estado

E2 **IMPLEMENTED / HOLD PARA RESEAL**. Fecha SÓ como **TEMPORAL TOMBSTONE / LEGACY WRITE-PATH REGRESSION LOCK**: o trilho
legado schedules/schedule_slots segue morto (0 linhas, tombstones que lançam, REVOKE aplicado) e agora TRAVADO contra
ressuscitação de write-path por guard estrutural no chain (neg-proof 5 mordidas). dev 385; ZERO runtime; SSOT temporal =
unified_availability (DECISION-0014/C63).
