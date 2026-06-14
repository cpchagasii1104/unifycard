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

## Estado

DECISION-0125 PROMULGADA. DT-0113-CLASSIC-CHANNEL-READERS: PARTIAL (baseline 4→3). Restam DECISION_REQUIRED
(frentes próprias): escopo per-empresa das platform reads; deprecação do `businessAuthorizationService`/
RBAC v1 órfão; trust R2.4; disputa/reversão.
