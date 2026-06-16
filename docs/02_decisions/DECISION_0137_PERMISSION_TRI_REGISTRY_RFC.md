# DECISION-0137 — RFC da tri-registry de permissões (papel canônico de cada vocabulário)

**Status:** **PROMULGADA / NORMATIVA (RFC docs-only) — IMPLEMENTED / HOLD YALA.** **ZERO** código, migration,
schema, runtime, endpoint, enforcement, frontend, financeiro. Define o **papel canônico** dos três vocabulários
de permissão vivos **antes** do Slice 1C (enforcement de grant em rota). NÃO faz cutover material nem decide
composição de rota. Fecha a classificação da `DT-PERMISSION-TRI-REGISTRY-RECONCILIATION` como **baseline**
(IMPLEMENTED_AS_RFC_BASELINE; CLOSED só no seal pós-Yala PASS).

**Data:** 2026-06-16 · **Branch:** `rescue-structural` · **HEAD:** `fad9a854` · **dev:** 391 (sem migration) ·
**Tipo:** arquitetural / autoridade / RFC · **Frente:** F-PERMISSION-TRI-REGISTRY-RFC ·
**Responsável:** Clayton / IA Diretora (executor: Claude) · **Validação prévia:** Clayton.

**Deriva de:** `07_NOMENCLATURA_CANONICA` (§3 regra suprema; §3.2 ordem SSOT) · **DECISION-0135** (key `domain:action`) ·
**DECISION-0136** (`actor_capability_grants`) · **DECISION-0134** (referral=lookup) · `DT-PERMISSION-TRI-REGISTRY-RECONCILIATION`.

---

## §1 — Vocabulário VIVO encontrado (READ-FIRST 1ª mão)

| # | Arquivo | Forma material | Natureza |
| --- | --- | --- | --- |
| 1 | `core/authorization/permission-keys.ts` | `type PermissionKey` (union `domain:action`) + `PERMISSION_CAPABILITIES: Record<PermissionKey, string \| null>` (contém `can_hold_assets`) | **registry de capability keys** (SSOT-candidato; já consumido pelo Slice 1A/1B) |
| 2 | `core/authorization/business-permissions.types.ts` | `type BusinessAction` (segundo enum `domain:action`, inclui `financial:`/`split:`/`financial_terms:`) + `BUSINESS_PERMISSION_MAP: Record<BusinessAction, OrganizationRoleKey[]>` (`import type` de `OrganizationRoleKey` = type-only) | **matriz role→action** (não registry plano) |
| 3 | `core/rbac/rbac.types.ts` (`rbac.plugin.ts`) | `type PermissionString = \`${string}:${string}\`` (template literal qualquer `x:y`, usado por `fastify.requirePermission`; ex.: `roles:assign`) | **vocabulário legado / FASE 6 / superfície HTTP** (não curado) |

Não há **dualidade simples**: são **três** vocabulários, sem SSOT declarado. Risco: enforcement futuro escolher o
vocabulário errado ou reanimar superfície contida (organization via `OrganizationRoleKey`).

---

## §2 — Decisões promulgadas

1. **`permission-keys.ts` = SSOT canônico** das capability keys usadas por `actor_capability_grants`. É a fonte de
   existência canônica de capability; o guard `audit-actor-capability-grants-nonfinancial.mjs` já trava
   `allowlist (CHECK) ⊆ permission-keys.ts`.
2. **`business-permissions.types.ts` = matriz role→action/contexto**, **NÃO** registry de capability. Pode mapear
   papéis → actions; **não** define a existência canônica de uma capability; **não** é usado pelo Slice 1B; só
   entra no Slice 1C **se** a composição de rota for explicitamente decidida.
3. **`PermissionString` / `rbac.plugin` = vocabulário legado / FASE 6 / separado.** **NÃO** alimenta
   `actor_capability_grants`; **NÃO** é authority de grant; qualquer alinhamento com `permission-keys.ts` é
   **frente futura própria** (RFC/cutover dedicado).
4. **Actor capability grants usam:** `actor_id` · `scope_actor_id` · `capability_key` do `permission-keys.ts` ·
   allowlist não-financeira do Slice 1A/1B. **NÃO usam:** `BusinessAction` · `PermissionString` ·
   `OrganizationRoleKey` · `users.referral_code`.
5. **Enforcement (Slice 1C)** só nasce após **decisão de composição de rota**: owner authority + `canRepresentActor`
   + actor capability grant + (business role-map, se aplicável) + (`requirePermission`, se aplicável). **Sem essa
   composição, nenhum grant é plugado em rota de negócio.**
6. **Financeiro CRITICAL fora.** `financial:`/`financial_terms:`/`split:`/`payout`/`ledger`/`bank_ledger`/`payment`/
   `refund`/`cash_drawer`/`cards`/`customer_credit`: **não vira checkbox executável**, **não vira enforcement
   simples**; **3 paralelas READ-ONLY antes de qualquer alteração material**.
7. **Organization ghost.** `OrganizationRoleKey` é **type-only** neste contexto; este RFC **NÃO reativa**
   organization (runtime segue contido/OPEN por `DT-ORGANIZATION-SCHEMA-GHOST`).

---

## §3 — Classificação canônica (tabela)

| Vocabulário | Papel canônico | Usável por actor grants? | Bloqueia Slice 1B? | Bloqueia Slice 1C? | Observação |
| --- | --- | --- | --- | --- | --- |
| `permission-keys.ts` | **SSOT capability registry** | **SIM** | **NÃO** | **necessário** | já consumido pelo 1A/1B; guard CHECK ⊆ registry; contém `can_hold_assets` |
| `business-permissions.types.ts` | **role-map / context matrix** | **NÃO diretamente** | **NÃO** | **precisa composição antes do 1C** | `import type` only (não reativa organization); financeiro = CRITICAL |
| `PermissionString` / `rbac.plugin` | **FASE 6 / legacy HTTP permission string** | **NÃO** | **NÃO** | **precisa RFC/cutover próprio** | template `${string}:${string}`; não curado; usado por `requirePermission` |

---

## §4 — Pendências e bloqueios remanescentes

- **Cutover/alinhamento material** dos vocabulários (ex.: `business-permissions` → mapper/deprecação; `PermissionString`
  → FASE 6 separada) = **futuro** (NÃO feito por este RFC docs-only).
- **Slice 1C continua BLOQUEADO** por: (a) `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION` (OPEN — decisão de
  produto sobre owner-only em agenda) **+** (b) **decisão de composição de rota** (§2.5). Este RFC **NÃO** decide
  se operador de agenda fura owner-only — apenas prepara a linguagem.
- `DT-PERMISSION-TRI-REGISTRY-RECONCILIATION` → **IMPLEMENTED_AS_RFC_BASELINE / HOLD YALA** (CLOSED_AS_RFC_BASELINE
  só no seal pós-Yala PASS).

## §5 — Escopo negativo (verificado)

ZERO `permission-keys.ts` · `business-permissions.types.ts` · `rbac.plugin.ts`/`rbac.types.ts` · `requirePermission` ·
`actor-capability-grant.*`/endpoints · `app.builder.ts` · migration · availability/calendar · frontend · financeiro/
`bank_ledger` · votes/organization/contextual-thread · cutover de aliases · runtime. **Nada material tocado (docs-only).**

## §6 — Referências

`permission-keys.ts` · `business-permissions.types.ts` (`BUSINESS_PERMISSION_MAP`) · `rbac.types.ts`
(`PermissionString`) · `require-permission.guard.ts` · `business-authorization.service.ts` ·
`authorization.service` (`canActAs`/`canRepresentActor`) · `actor_capability_grants` (mig 20260616210000) ·
`DECISION-0134`/`0135`/`0136` · `DT-PERMISSION-TRI-REGISTRY-RECONCILIATION` · `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION`.
