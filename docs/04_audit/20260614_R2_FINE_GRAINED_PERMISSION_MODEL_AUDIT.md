# AUDITORIA R2 — Fine-Grained Permission Model (READ-FIRST / DECISION REQUIRED)

**Frente:** F-R2-FINE-GRAINED-PERMISSION-MODEL · **Data:** 2026-06-14 · **HEAD:** `d8c7d1ee` · branch `rescue-structural` · dev 380/380 · **READ-FIRST CONTROLADO (zero código de produção).**

## 1. O que foi lido

`authorization.service.ts` (canActAs/canRepresentActor), `business-authorization.service.ts`
(requirePermission/checkPermission), `authority.service.ts` (fachada), `permission-keys.ts`,
`rbac.service.ts`/`rbac.plugin.ts` (requireRole/fastify.requirePermission), os 7 route files
baselineados, `audit-actor-authority-boundary.mjs`, DECISION-0113/0124, DT_LOG. Schema vivo
introspeccionado.

## 2. Mapa de permission keys (`permission-keys.ts`)

- **62 keys canônicas** em 11 famílias: FEED(2), BANK/financial(13), EVENTS(3), GROUPS(3),
  SERVICES(17), RIDES(3), COMPANIES(1), VOTES(2), INSTITUTIONAL(5), MARKETPLACE(14), REPORTS(3).
- **~15 keys realmente usadas** (admin:view_audit_logs, financial:view_all_ledger, financial:view_ledger,
  financial:execute_payout, dashboard:view, reports:view_operational, service_order:*, rfq:*, quote:*,
  bundle:*, calendar:*, split:*, financial_terms:*). **~30+ keys = catálogo morto.** **~50 keys usadas em
  rotas NÃO estão declaradas** (work:*/rides:*/notify:*/social:* — namespace paralelo órfão).
- **NÃO existem famílias `risk:*`/`dispute:*`/`audit:*`/`reconciliation:*`.** Risk-dashboard e policy
  REUSAM `financial:view_all_ledger`; business-audit usa `admin:view_audit_logs`; reconciliation/trust são
  all-or-nothing admin via DECISION-0113/requireRole.

## 3. Mapa das fontes MATERIAIS de autoridade (estado vivo)

| Fonte | Estado | Papel |
| --- | --- | --- |
| **`authorizationService.canActAs`** (via `authority.service` + quarentena) | **CANÔNICO/VIVO** | ownership (`actors.user_id`) · delegação (`actor_delegations`=9) · empresa (`company_users` WHERE `can_manage_company` OR role owner/admin) · `actor_registry.capabilities_json` (=9 rows) p/ permissões sensíveis |
| **`actor_delegations`** (9) | VIVO | delegação com scopes |
| **`actor_registry.capabilities_json`** (9) | VIVO | gate de capability p/ permissões sensíveis (marketplace_*) |
| **`company_users.can_manage_company`** (2 rows) | VIVO | único `can_*` consultado (via `canManageCompany`) |
| **`company_users.can_manage_financial`/`employees`/`services`/`view_consolidated_inventory`/`view_reports`** | **DECORATIVO** | colunas existem (migrations 0530520500/0610120000), **NÃO consultadas** por `authorization.service` (cargo-cult) |
| **`businessAuthorizationService.requirePermission`** (reporting/risk-dashboard/account/invoicing) | **LEGADO/QUEBRADO** | marcado "🔴 PROIBIDO USAR COMO DECISÃO FINAL"; resolve via `OrganizationAuthorizationHelper.getUserRole` → tabelas **`organization_member`/`organization_role` AUSENTES** → efetivamente fail-closed/incerto |
| **`fastify.requirePermission([...])`** (rbac.plugin preHandler; business-audit/payout) | INTERINO | subject = `req.user` server-side |
| **`roles`/`permissions`/`role_permissions`/`user_roles`** (8/76/136/**1**) | **ÓRFÃO** | bootstrapados (`seed_default_rbac`), NÃO consultados em gates; `user_has_permission()` SQL existe mas não chamado |
| **`actor_has_permission()`** SQL | STUB FAIL-CLOSED | retorna FALSE sempre (RBAC V2 dormente) |
| **`actor_roles`/`business_permissions`/`rbac` table** | **AUSENTES** | RBAC V2 não ativado |
| **`authority_trust_levels`/`authority_roots`** (0/0) | VAZIOS | ATL dormente |

**Estado real do RBAC:** FRAGMENTADO. O caminho vivo é `canActAs` (ownership/delegação/empresa/capability).
`requirePermission` legado depende de tabelas ausentes (`organization_member`) → meio-quebrado.
`company_users.can_*` é o **SSOT material declarado** (actor-capabilities.service) mas só 1 de 6 flags é
consultada. RBAC v1 (user_roles) e v2 (actor_roles) são órfão/ausente.

## 4. Matriz dos 7 resíduos baselineados (R2)

**ACHADO-CHAVE:** após o fix do spoof do risk-dashboard, **NENHUM dos 7 usa `actionContext.actorId` como
subject** — todos têm subject server-side (req.user via requirePermission/fastify.requirePermission/req.user.id).
Ficam baselineados APENAS porque o guard 0113 não reconhece `requirePermission`/`requireRole` como binding
helper. **Não há spoof remanescente.**

| Arquivo | rotas/método | dados/sensibilidade | actorId | primitive atual | risco | binding ideal R2 | decisão? | migration? | corrigir agora? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **reporting** | GET financial-kpis/revenue/commission/export | agregados financeiros tenant (D) | filtro | `businessAuthorizationService.requirePermission(view_all_ledger)`, subject=`req.user.id` | LEGADO quebrado (org tables ausentes) | trocar p/ canActAs OU company_users.can_view_reports | NÃO | NÃO | SIM (swap primitive) |
| **payout** | GET orders/batches; POST execute-manual/fail (writer) | payout financeiro (D) | filtro | `fastify.requirePermission(execute_payout)` preHandler | Bank/payout HARD-STOP nos writers | manter; reads = company_users.can_manage_financial | PARCIAL | NÃO | reads sim / writers NÃO |
| **bank-http** | GET /balance; POST transactions (writer) | saldo/tx (D) | filtro | `actorCapabilitiesService.resolveForUser` (GET) | BANK HARD-STOP | manter (resolveForUser já seguro) | NÃO | NÃO | NÃO (Bank) |
| **business-audit** | GET /business-audit-logs[?actorId] | logs financ/trust/risk (D, CRÍTICO) | filtro | `fastify.requirePermission(admin:view_audit_logs)` | filtro cross-actor sob admin | manter + (opcional) canRepresentActor se filtro por actorId específico exigir escopo | VERIFICAR | NÃO | conditional |
| **policy** | GET reads + POST mutations | policy/sanction (D) | params/query | `requirePolicyPermission` (admin) | mutations sem permission fina | reads OK; mutations = can_manage_company interim OU nova key `policy:manage` | SIM (mutations) | talvez (nova key) | reads sim / mutations decisão |
| **trust** | GET/POST trust | trust/fraud (D) | params/query | `requireRole(['admin'])` INTERINO (assertActorRepresentActor interno) | interino congelado | DEFERIR (R2.4) | SIM | — | NÃO (congelado) |
| **risk-dashboard** | GET overview/actors[/:actorId][/timeline] | risco/financeiro (D) | params=alvo; subject=req.user | `requirePermission(view_all_ledger)`, subject=`req.user.userId` (SPOOF FECHADO) | spoof CLOSED; admin grant | manter (subject server-side) OU canActAs | NÃO | NÃO | já corrigido |

## 5. Proposta de modelo R2 MÍNIMO (sem RBAC V2, sem migration)

**Princípio (DECISION-0113):** subject SEMPRE server-side (`req.user.userId`/globalUserId); `actorId` é
alvo/contexto/hint. Fail-closed.

**Primitiva mínima segura p/ admin cross-actor:** `companiesService.canManageCompany(tenantId, companyId,
globalUserId)` — já viva, usa `company_users.can_*` (existe desde 2026-05-30), **sem migration, sem RBAC V2**.
Para granularidade (financeiro/relatórios) **ligar os flags JÁ EXISTENTES** `can_manage_financial`/
`can_view_reports` (hoje decorativos) — code-only, sem migration.

**Substrato canônico:** consolidar em `canActAs` (ownership/delegação/empresa via company_users.can_*/
capability). **Deprecar** `businessAuthorizationService.requirePermission` (legado quebrado — depende de
`organization_member` ausente). **Aposentar** RBAC v1 órfão (user_roles/role_permissions) com tombstone OU
ressuscitar conscientemente (decisão).

**Reconhecimento pelo guard 0113 (futuro):** estender BINDING_HELPERS para reconhecer
`requirePermission`/`fastify.requirePermission`/`canActAs` **SOMENTE quando o subject for provadamente
`req.user`** (server-side), mantendo o hard-check `SUBJECT_EQUALS_TARGET`. Assim os 6 readers admin
(subject server-side) saem do baseline honestamente.

## 6. Decisões que Clayton precisa tomar

1. **Fonte de grant R2:** ligar `company_users.can_*` (financial/reports) como SSOT de permissão de empresa
   **OU** ativar RBAC v1 (`user_roles`) **OU** RBAC V2 (`actor_roles`)? (Recomendação: company_users.can_*,
   já material, menor blast radius.)
2. **Famílias de permission-key ausentes:** criar `risk:*`/`dispute:*`/`audit:*`/`reconciliation:*` **OU**
   consolidar em `financial:view_all_ledger`/`admin:view_audit_logs`?
3. **Policy mutations:** `can_manage_company` interino **OU** nova key `policy:manage`?
4. **Trust:** quando descongelar R2.4?
5. **Legado:** deprecar `businessAuthorizationService.requirePermission` (org tables ausentes) e tombstone
   do RBAC v1 órfão?

## 7. Fatias implementáveis recomendadas (em ordem, sem quebrar produção)

- **FATIA A (guard-only, sem runtime):** estender o guard 0113 para reconhecer binding seguro
  (subject=req.user) em requirePermission/fastify.requirePermission/canActAs + manter SUBJECT_EQUALS_TARGET.
  Resultado: baseline 7 → ~2 (só payout/bank-http financeiro hard-stop ficam, justificados). **Não exige
  decisão de produto** (os 6 já têm subject server-side). RISCO: médio (mudança de semântica do guard; exige
  e2e + prova negativa cuidadosa para não criar falso-verde).
- **FATIA B (runtime, reseal):** trocar `businessAuthorizationService.requirePermission` (legado quebrado)
  por `canActAs` em reporting/risk-dashboard. Pequena, fecha a dependência de `organization_member` ausente.
- **FATIA C (decisão):** ligar `company_users.can_view_reports`/`can_manage_financial` como grant fino
  (reporting/payout-read) — exige decisão (1).
- **FATIA D (decisão/produto):** famílias de permission-key + policy mutations + trust R2.4.

## 8. Riscos

- Reconhecer requirePermission no guard SEM provar subject=req.user reintroduziria falso-verde (o legado
  quebrado passaria) — por isso FATIA A deve casar `req.user` literalmente + manter SUBJECT_EQUALS_TARGET.
- `businessAuthorizationService.requirePermission` depende de `organization_member` AUSENTE → pode estar
  negando/permitindo de forma incerta hoje (auditar comportamento antes de FATIA B).
- Ligar flags decorativos (`can_*`) muda comportamento de autorização → exige e2e de não-regressão de
  operadores legítimos.

## 9. Gates/E2Es futuros para selar R2

- e2e: subject server-side em TODAS as rotas admin; actorId divergente nunca autoriza; operador com
  `company_users.can_*` correto passa; sem o flag → 403; SUBJECT_EQUALS_TARGET hard-fail; Bank intocado.
- guard: novo reconhecimento de binding seguro + prova negativa (subject=actionContext → fail).

## 10. Recomendação de próxima frente executável

**FATIA A** (guard reconhece binding seguro subject=req.user) — é a única **sem decisão de produto** e fecha
honestamente 4 dos 7 (reporting/business-audit/policy-reads/risk-dashboard), deixando baseline só com os
financeiros hard-stop (payout/bank-http) + trust congelado. Requer GO executor próprio (mexe no guard +
e2e + prova negativa). As FATIAS C/D exigem decisão do Clayton (item 6).

---

**STATUS: F-R2-FINE-GRAINED-PERMISSION-MODEL — READ-FIRST COMPLETE / DECISION REQUIRED.**
