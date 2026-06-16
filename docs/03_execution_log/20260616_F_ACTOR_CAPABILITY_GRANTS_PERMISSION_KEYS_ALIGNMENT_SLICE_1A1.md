# 2026-06-16 — F-ACTOR-CAPABILITY-GRANTS-PERMISSION-KEYS-ALIGNMENT-SLICE-1A1

Fecha o **warning W1** do Slice 1A: registra no SSOT vivo `permission-keys.ts` as capability keys não-financeiras
que a migration `actor_capability_grants` já permitia, para o CHECK do banco **não virar registry paralelo**.
Material mínimo. Não-financeiro, sem enforcement, sem endpoint, sem UI.

## Anchor / Pré-flight

HEAD inicial `b0e6f297` · branch `rescue-structural` · superfícies materiais LIMPAS · dev 391. STOP não disparado.

## READ-FIRST

DECISION-0134/0135/0136 + execution log do Slice 1A · STATUS · DT_LOG · `permission-keys.ts` (union +
`PERMISSION_CAPABILITIES`) · `business-permissions.types.ts` (confirmado: **NÃO** precisa ser tocado) · migration
`20260616210000` · guard `audit-actor-capability-grants-nonfinancial.mjs`. Estado das 5 keys da allowlist:
`calendar:block`/`calendar:unblock` **PRESENTES**; `services:create`/`services:edit`/`services:disable` **AUSENTES**.

## Patch (mínimo)

- **`permission-keys.ts`**: adicionadas `services:create` · `services:edit` · `services:disable` ao **union**
  `PermissionKey` E ao map `PERMISSION_CAPABILITIES` com **capability `null`** ("ownership suficiente", idêntico
  aos irmãos `calendar:*`/`service_order:*`). DECISION-0135 (`domain:action`, verbo simples, lowercase snake_case).
  **Vocabulário apenas — sem enforcement.** Nenhuma key existente renomeada; zero key financeira; zero alias.
- **Guard** `audit-actor-capability-grants-nonfinancial.mjs`: **estendido** (check 5) — toda capability da allowlist
  do CHECK da migration DEVE existir em `permission-keys.ts`; allowlist sem key financeira; `permission-keys.ts` sem
  `finance:*` (canônico é `financial:`). Mantém-se UM guard (sem terceiro registry).
- **NÃO tocado:** `business-permissions.types.ts` · migration (intocada) · service/repository/types do grant ·
  availability/calendar · frontend · financeiro · aliases · `financial:execute_payout`/`all_ledger_view`/`booking:`/`products:`.

## Provas

| Prova | Resultado |
| --- | --- |
| tsc build / strict | **25 / 43** (baseline; keys `null` não quebram) |
| 3 keys em union + map | services:create/edit/disable OK; calendar:block/unblock preservadas |
| guard (estendido, na chain regression-guards) | **GATE OK** (checked=5) — alignment CHECK↔registry |
| neg-proof `negative-proof-...ps1` | **6 mordidas** (allowlist-financial · scope-global · drop-grantee-actor · types-financial · lookup-referral · **pk-misalign**) + restauração byte-idêntica SHA256 |
| GATE actor-writer / bank-ledger | OK / OK |
| GATE regression-guards | rc=0 (rbac-stub-and-tombstones OK — adicionar services:* não perturbou tombstones) |
| GATE architectural-patterns --strict | critical_new=0 (warning_new=4 pré-existentes inventory-legacy) |

(e2e do Slice 1A não re-rodado: o caminho de grant é inalterado — esta frente só adiciona vocabulário; o
alinhamento CHECK↔registry agora é coberto pelo guard.)

## Cartório / pendências

- **W1 FECHADO:** allowlist da migration ⊆ `permission-keys.ts`; CHECK alinhado ao SSOT vivo.
- **W2 permanece como orientação:** o CHECK de `capability_key` é **trava defensiva temporária**, **NÃO** registry,
  **NÃO** substitui `permission-keys.ts`; expandir allowlist = nova migration/frente.
- **Pendente (fora deste Slice):** reconciliação ampla `permission-keys.ts` × `business-permissions.types.ts` ·
  endpoints (Slice 1B) · enforcement (Slice 1C, `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION`) · UI · financeiro
  (sempre 3 paralelas).

## Estado

**IMPLEMENTED / HOLD YALA.** Fecha SÓ como **F-ACTOR-CAPABILITY-GRANTS-PERMISSION-KEYS-ALIGNMENT-SLICE-1A1**:
`services:create/edit/disable` registradas em `permission-keys.ts` (capability null); guard alinha CHECK↔registry;
`business-permissions.types.ts`/migration intocados; zero enforcement/endpoint/financeiro. dev 391. **Aguarda reseal Yala.**
