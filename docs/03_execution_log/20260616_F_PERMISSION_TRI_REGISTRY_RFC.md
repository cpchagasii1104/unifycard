# 2026-06-16 — F-PERMISSION-TRI-REGISTRY-RFC

RFC **docs-only** que define o papel canônico dos **três** vocabulários de permissão vivos antes do Slice 1C
(enforcement de grant em rota). Promulga DECISION-0137. **Nada material tocado.**

## Anchor / Pré-flight

HEAD `fad9a854` · branch `rescue-structural` · superfícies materiais (backend/src, frontend/src, migrations,
scripts, `permission-keys.ts`, `business-permissions.types.ts`, `rbac.plugin.ts`/`rbac.types.ts`) **LIMPAS** ·
dev 391. STOP não disparado.

## READ-FIRST (Evidence Pack)

Lidos 1ª mão: `permission-keys.ts` · `business-permissions.types.ts` · `rbac.types.ts`/`rbac.plugin.ts` ·
`require-permission.guard.ts` · `authorization.service` · `actor_capability_grants` service/repository/types/routes
+ migration · DECISION-0134/0135/0136 · execution logs Slice 1A/1A1/1B · STATUS · DT_LOG · DECISIONS_LOG.

## Achados (tri-registry confirmada)

1. **`permission-keys.ts`** — `PermissionKey` union + `PERMISSION_CAPABILITIES: Record<PermissionKey, string|null>`
   (contém `can_hold_assets`). Registry; **já consumido pelo Slice 1A/1B** (allowlist + guard CHECK ⊆ registry).
2. **`business-permissions.types.ts`** — `BUSINESS_PERMISSION_MAP: Record<BusinessAction, OrganizationRoleKey[]>`
   (matriz **role→action**, não registry plano; inclui `financial:`/`split:`); `import type OrganizationRoleKey`
   = **type-only** (não reativa organization).
3. **`rbac.types.ts`** — `type PermissionString = \`${string}:${string}\`` (template literal qualquer `x:y`,
   usado por `fastify.requirePermission`; ex.: `roles:assign`). Vocabulário legado/FASE 6.

## Decisões (DECISION-0137)

`permission-keys.ts` = **SSOT** de capability keys p/ grants · `business-permissions.types.ts` = **role-map**
(não registry) · `PermissionString`/`rbac` = **legado/FASE 6** (não authority de grant) · grants usam só
`actor_id`/`scope_actor_id`/`capability_key` do `permission-keys.ts` (não BusinessAction/PermissionString/
OrganizationRoleKey/referral) · enforcement 1C só após **decisão de composição de rota** · financeiro CRITICAL fora
(3 paralelas) · organization não reativada.

## Tabela de classificação

| Vocabulário | Papel | Grants? | Bloqueia 1B? | Bloqueia 1C? |
| --- | --- | --- | --- | --- |
| `permission-keys.ts` | SSOT capability registry | SIM | NÃO | necessário |
| `business-permissions.types.ts` | role-map / context matrix | NÃO diretamente | NÃO | precisa composição |
| `PermissionString` / `rbac.plugin` | FASE 6 / legacy HTTP string | NÃO | NÃO | precisa RFC/cutover próprio |

## Pendências / bloqueios

- Cutover material dos vocabulários = futuro (não feito).
- **Slice 1C bloqueado** por `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION` (OPEN) + decisão de composição de rota.
- `DT-PERMISSION-TRI-REGISTRY-RECONCILIATION` → **IMPLEMENTED_AS_RFC_BASELINE / HOLD YALA** (CLOSED só no seal pós-Yala).

## Provas / escopo negativo / gates

- `git diff` = **5 .md** (DECISION-0137 + este log + STATUS + REMEDIATION_DECISIONS_LOG + REMEDIATION_DT_LOG).
  **ZERO** `.ts`/`.sql`/`.mjs`/`.ps1`/migration/backend-src/frontend.
- Gate: `node scripts/validate-architectural-patterns.mjs --strict` → critical_new=0.
- NÃO tocado: `permission-keys.ts` · `business-permissions.types.ts` · `rbac.plugin`/`rbac.types` ·
  `requirePermission` · migration/endpoint/enforcement · availability/calendar · frontend · financeiro/`bank_ledger` ·
  votes/organization/contextual-thread.

## Estado

**CLOSED / YALA PASS.** Fecha SÓ como **F-PERMISSION-TRI-REGISTRY-RFC**: papel canônico dos 3 vocabulários
promulgado (DECISION-0137); `permission-keys.ts`=SSOT de grants; business-permissions e PermissionString NÃO são
registry; Slice 1B intacto; Slice 1C bloqueado até composição; financeiro fora. `DT-PERMISSION-TRI-REGISTRY-RECONCILIATION`
→ CLOSED_AS_RFC_BASELINE / YALA PASS. dev 391.

## YALA RESEAL — PASS (2026-06-16, adversarial READ-ONLY)

- **Veredito:** **PASS** (reseal adversarial READ-ONLY). Commit material `3224d6f8` · branch `rescue-structural` · dev 391.
- **Confirmado:** DECISION-0137 existe; commit **docs-only puro**; `permission-keys.ts` = **SSOT** de capability
  keys p/ actor grants; `business-permissions.types.ts` = **role-map/context matrix** (não registry);
  `PermissionString`/`rbac` = **legado/FASE 6 separado**; `PermissionString` grafado como `${string}:${string}`;
  grants **não usam** BusinessAction/PermissionString/OrganizationRoleKey/`users.referral_code`; **Slice 1B não
  alterado**; **Slice 1C continua bloqueado**; financeiro **CRITICAL / 3 paralelas**; organization **não reativada**;
  zero runtime/código/schema/frontend/migration.
- **DT:** `DT-PERMISSION-TRI-REGISTRY-RECONCILIATION` → **CLOSED_AS_RFC_BASELINE / YALA PASS** (classificação fechada;
  cutover material continua futuro). `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION` permanece **OPEN /
  PRODUCT_AUTHORITY_DECISION_REQUIRED**.
- **Pendências:** decisão de composição de rota (Slice 1C) · cutover material futuro dos vocabulários · UI de
  checkboxes · financeiro fora / 3 paralelas · operador de agenda (DT-CALENDAR) ainda não decidido.
- **Frase canônica:** "DECISION-0137 fecha a classificação da tri-registry como baseline documental:
  permission-keys.ts é o SSOT de capability keys para actor grants; business-permissions.types.ts é matriz
  role→action; PermissionString/rbac é legado/FASE 6 separado. Nenhum enforcement nasce deste RFC."
- **Selo:** commit docs-only `docs: seal permission tri-registry baseline`. Estado final: **CLOSED / YALA PASS**.
