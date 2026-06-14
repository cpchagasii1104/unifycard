# DECISION-0125 — Fonte material dos grants finos R2: `company_users.can_*`

**Status:** PROMULGADA · **Data:** 2026-06-13 · **Branch:** `rescue-structural` · **Frente:** F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION

**Precedência:** DECISION-0113 (actorId client-declared = HINT, nunca autoridade) · DECISION-0116 (autoridade contextual em `company_users`, ex. `can_view_consolidated_inventory`) · DECISION-0124 (classificação dos classic-channel readers) · DECISION-0042 (MEMBERSHIP SSOT = `company_users`).

## Decisão

A **fonte material de permissão fina** do R2 mínimo é **`company_users.can_*`** — o vínculo vivo
usuário↔empresa com flags booleanas de capability. NÃO são fonte soberana: RBAC v1 órfão
(`organization_members` vive só em `migrations_archive` ⇒ ausente em runtime), RBAC V2 (ausente/
dormente), `requireRole` genérico, actorId vindo do cliente, `actionContext` como prova, ou catálogo
de permissões decorativo.

Modelo de autoridade (invariante):

```text
req.user.id (server-side)  → SUBJECT real da permissão (resolvido p/ global_user_id via JOIN canônico users.global_user_id)
company_users.can_*        → fonte material do grant
target actor/company       → alvo/filtro
actorId de params/query/body/actionContext → NUNCA subject; no máximo target/filtro
```

## O que foi materializado

Primitivo central **`companiesService.canUserPerformCompanyCapability(tenantId, userId, capability, { companyId? })`**
(`src/core/companies/companies.service.ts`) — generaliza `canManageCompany`/`canViewConsolidatedInventory`:
resolve `users.global_user_id` por JOIN, exige vínculo ATIVO (`is_active` + `member_status='active'`),
autoriza por `(can_manage_company OR role='owner' OR <coluna whitelisted>)`. A coluna vem de whitelist
fixa (`COMPANY_CAPABILITY_COLUMNS`) — NUNCA interpola string de cliente. Fail-closed.

Migration `20260613170000_add_company_users_r2_fine_grants.sql` — 4 colunas booleanas NOT NULL DEFAULT
false (não-financeira, só `company_users`): `can_view_audit_logs`, `can_view_risk`, `can_manage_risk`
(RESERVADA — sem runtime hoje), `can_manage_policy`.

Rotas migradas do chain legado quebrado (businessAuthorizationService→organization_members ⇒ 403 sempre)
para o primitivo:

| Superfície | Capability | Natureza |
| --- | --- | --- |
| reporting | `can_view_reports` (pré-existente) | reads + POST /export |
| business-audit | `can_view_audit_logs` (nova) | reads (logs imutáveis) |
| risk-dashboard | `can_view_risk` (nova) | reads (GET overview/actors/timeline) |
| policy-engine | `can_manage_policy` (nova) | reads + mutations (gate único) |

## Propriedade conhecida (honestidade)

As 4 superfícies são leituras/admin **tenant-wide** (`financial:view_all_ledger` era cross-actor por
design; agregam o tenant), NÃO têm empresa-alvo única. Logo o grant é satisfeito por QUALQUER vínculo
ATIVO no tenant com a capability (ou can_manage_company/owner). Em tenant multi-empresa isso habilita a
leitura agregada do tenant — o escopo per-empresa das superfícies platform-level é **refino futuro**
(fora desta frente). Como o caminho legado já NEGAVA (403), nenhum acesso EXISTENTE é ampliado: a
permissão só passa a existir quando um admin (`canManageCompany`) concede o grant (default false).

**policy-engine — decisão consciente:** arquivo MIXED (reads+mutations) num único `*.routes.ts`. Em vez
de mantê-lo baselineado no guard 0113, TODAS as rotas passam pelo MESMO gate `can_manage_policy`.
Unificar reads sob a capability das mutations é MAIS restritivo (sem perda de segurança) e torna o
arquivo INTEIRO provável (subject server-side em toda rota) → reconhecido honestamente pelo guard.

## Guard

`audit-actor-authority-boundary.mjs` ganhou a **Forma C** em `safeSubjectProof`: reconhece
`canUserPerformCompanyCapability(tenantId, <subj=req.user>, '<can_*>')` como safe-binding (subject
server-side, autoridade = `company_users.can_*`), gated pelo allowlist auditado `SAFE_SUBJECT_READERS`.
Baseline 4 → 3 (policy-engine removido; restam bank-http + payout = financeiro HARD STOP, e trust =
requireRole interino R2.4 congelado). `SUBJECT_EQUALS_TARGET` segue hard-fail.

## Hard stops respeitados

Zero Bank/ledger/transactions/payout writer/reversal/dispute/booking/order/service_offering; migration
só `company_users` (não-financeira); sem RBAC V2/FASE 6; sem `actor_roles`/`company_roles`/grants
genéricos fora de `company_users`; sem frontend; sem decisão de política financeira de reversão; sem
trust R2.4; sem `service_id` nullable. Flags futuras `can_review_disputes`/`can_execute_dispute_action`
NÃO criadas (dependem de política de disputa/Core financeiro — frente própria).

## Prova

e2e `validate-pipeline-e2e-company-users-fine-grants` (DB efêmera, runner próprio, **15/15**): T0 migration;
T1/T3/T5 negado sem grant → 403; T2/T4/T6 concedido com grant → passa o gate; T7 actorId-alvo nunca vira
subject (não-membro declarando actorId autorizado → 403); T8 SUBJECT_EQUALS_TARGET hard-fail; T9 policy
read/mutation no mesmo gate; T10 bank-http/payout baselineados/intocados; T11 dispute contido; T12
service-orders contido; T13 event/public-profiles bindings intactos; T14 Bank intocado. Guard
flagged=3/baseline=3/new=0/safe_subject_recognized=4; prova negativa 12/12 (4 casos Forma C). Gates
verdes; tsc 25; migration count 380→381.

## Adendo §escopo — F-R2-FINE-GRANTS-ANCHOR-AND-SCOPE-CLOSURE (2026-06-14, reseal Yala / decisão Clayton)

O reseal apontou (a) âncora: migration `20260613170000` commitada mas não aplicada ao dev (380≠381);
(b) escopo: o primitivo autorizava leitura tenant-wide por QUALQUER `company_users` ativo com grant.

**Correções (promulgadas):**
- **Âncora:** migration aplicada ao `unificard_dev` via runner canônico (`npm run migrate`) → **dev 381/381**;
  4 colunas presentes (boolean NOT NULL default false). Sem nova migration.
- **Escopo (regra vinculante):** `company_users.can_*` vale para a **empresa/actor-alvo resolvível**. Grant em
  uma empresa **NÃO** autoriza leitura tenant-wide. **Leitura tenant-wide/platform-admin ampla = DECISION_REQUIRED**
  (sem modelo de grant tenant-level/platform-operator).
  - `canUserPerformCompanyCapability` agora é **fail-closed sem `companyId`** (`reason='company_scope_required'`);
    com `companyId` checa o vínculo NAQUELA empresa. `owner`/`can_manage_company` = supergrant SÓ dentro da empresa
    escopada — **nunca** tenant-wide.
  - Novo `resolveCompanyIdForActor(tenantId, actorId)` (via `actors.company_id`, server-side, fail-closed).
  - **Rotas tenant-wide → FAIL-CLOSED** (`COMPANY_SCOPE_REQUIRED`): reporting (todas — dados tenant-wide irredutíveis,
    `actorId` removido por ser morto), risk `/overview` + `/actors` (lista), business-audit `/:logId`, policy lista/
    mutations. **Rotas actor-scoped → company-scoped** (resolvem `actors.company_id` do alvo): risk `/actors/:actorId`
    [`/timeline`], business-audit `?actorId=`, policy `/policies/evaluate/:actorId` + `/policy-decisions/actor/:actorId/active`.
- **Guard:** Forma C agora exige prova de company-scope (`resolveCompanyIdForActor` no arquivo) para reconhecer.
  reporting saiu do allowlist (sem canal). baseline 0113 inalterado (3: bank-http/payout/trust); recognized=3.
- **Prova:** e2e `validate-pipeline-e2e-company-users-fine-grants` **20/20** (T-PRIM fail-closed/scoped; T2/T7 company-scoped
  passa; T3 cross-company 403; T4/T8/T10/T-reporting tenant-wide → COMPANY_SCOPE_REQUIRED; T11 owner não tenant-wide;
  T12/T12b alvo não vira subject / company não-resolvível). neg-proof 13/13 (incl. reject Forma-C sem company-scope).

## Estado

DECISION-0125 PROMULGADA (incl. §escopo). dev **381/381**. DT-0113-CLASSIC-CHANNEL-READERS: PARTIAL (baseline 3).
Restam DECISION_REQUIRED (frentes próprias): **modelo platform-admin / tenant-level grant** (destrava reads tenant-wide
hoje fail-closed); deprecar `businessAuthorizationService`/RBAC v1 órfão; trust R2.4; disputa/reversão.
