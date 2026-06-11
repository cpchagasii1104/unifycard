# Execution Log — F-COMPANY-USERS-SELF-UPDATE-AUTHORITY-ESCALATION-CLOSURE

**Data:** 2026-06-10
**Frente:** `F-COMPANY-USERS-SELF-UPDATE-AUTHORITY-ESCALATION-CLOSURE`
**HEAD origem:** `c6bbcae1` · **Branch:** `rescue-structural` · **dev:** 366 (sem migration nova)
**Modo:** BACKEND + E2E HTTP + DOCUMENTAÇÃO
**Governado por:** DECISION-0113 (autoria ≠ autoridade) + DECISION-0116 (COMPANY_INTERNAL)
**Gatilho:** Yala **PASS BLOQUEADO** à fatia de inventory consolidado — bloqueador na rota genérica preexistente.

---

## 1. Endpoint vulnerável

`PUT /companies/:companyId/users/:companyUserId` (companies.routes.ts) → `companiesService.updateCompanyUser`.

UPDATE dinâmico self-scoped (`WHERE cu.id=$ AND cu.global_user_id=caller`) que aceitava: `role`, `roleDescription`, `permissions.{canManageCompany,canManageFinancial,canManageEmployees,canViewReports,canManageServices}`, `isActive`, `isPrimary`. Sem gate `canManageCompany` do caller.

## 2. Exploit (root-cause probe, pré-patch)

```
PUT /companies/:id/users/:cuid  body { permissions: { canManageCompany: true } }
→ HTTP 200
banco ANTES:  { can_manage_company: false, role: 'member' }
banco DEPOIS: { can_manage_company: true,  role: 'member' }
GET /marketplace/inventory/company/:id/balance → 200 (qty=42)
```
Membro comum auto-promovido a admin acessou projeção COMPANY_INTERNAL.

## 3. Causa-raiz

Não é "faltou guard no inventory". É **um writer self-scoped aceitava campos de autoridade**. O filtro `global_user_id = caller` prova apenas que o usuário edita a própria linha — **não** o autoriza a mudar o poder daquela linha. **Autoria da atualização ≠ autoridade para conceder privilégios** (mesmo princípio da DECISION-0113: declarar ≠ autorizar).

## 4. Correção (allowlist, causa-raiz)

Princípio: `SELF UPDATE = allowlist explícita de campos não-autoritativos. ADMIN UPDATE = writer administrativo gateado.`

| Camada | Arquivo | Mudança |
|--------|---------|---------|
| Rota (anteparo 1) | `companies.routes.ts` | `SELF_EDITABLE_COMPANY_USER_FIELDS=['roleDescription']`; inspeção de chaves cruas do body → qualquer chave fora → **403** (`COMPANY_USER_SELF_UPDATE_FIELD_FORBIDDEN`). Rejeição por allowlist, não blacklist. |
| Rota (anteparo 2) | `companies.routes.ts` | `selfUpdateCompanyUserSchema` `.strict()` (chaves extras → erro 400, não drop). |
| Service | `companies.service.ts` | `updateCompanyUser` (mass-assignment) **REMOVIDO**; novo `selfUpdateCompanyUser` com SQL de coluna FIXA `SET role_description=$1`, self-scoped. |
| Tipo | `companies.types.ts` | `UpdateCompanyUserInput` (autoridade) → `SelfUpdateCompanyUserInput={roleDescription?}`. |

`role_description` é rótulo livre — não alimenta `canManageCompany` (`can_manage_company OR role='owner'`).

## 5. Allowlist final / campos bloqueados

- **Self-editable (allowlist):** `roleDescription`.
- **Bloqueados (→403):** `role`, `permissions` (objeto inteiro e qualquer `can*`), `isActive`, `isPrimary`, `memberStatus`, `can_view_consolidated_inventory`, aliases snake_case, objetos aninhados, chaves desconhecidas.

## 6. Writers administrativos preservados

- `PUT /companies/:companyId/members/:memberId` (company-members) — gate `requireCompanyManage` (→`canManageCompany`). Altera role/member_status/metadata de outro membro. **Intacto.**
- `PUT /companies/:companyId/users/:companyUserId/consolidated-inventory-permission` → `setConsolidatedInventoryPermission` — gate `canManageCompany(caller)`. **Intacto.**

## 7. role='owner'

Auditado. `owner` é atribuído no **nascimento** (`createCompany`, server-side). É fallback de autoridade em `canManageCompany` (`OR role='owner'`). Após o fechamento, **o membro não pode setar o próprio `role`** (403) → o fallback permanece seguro. O writer admin de members pode alterar role mas é gateado. Grep de `UPDATE/INSERT company_users` confirma: nascimento + admin-gated + self-update (agora só role_description). **Nenhum outro writer não-gateado define owner.**

## 8. Blast radius

Leitores das flags: `canManageCompany` (→`requireCompanyManage` para members/delegações; →`canRepresentActor` do page-actor → recursos do actor; →`canViewConsolidatedInventory`) + GETs financeiros/admin via `can_manage_financial`/`can_manage_employees`/`can_view_reports`/`can_manage_services`. Todos dependiam da integridade das flags. **Fechar o único writer self-scoped inseguro na raiz** fecha a credencial forjável — sem re-gatear cada consumidor. Writers auditados: `createCompany` INSERT/unset-is_primary (server-side) = seguro; `setConsolidatedInventoryPermission` (admin) = seguro; `company-members.repository.update` (`requireCompanyManage`) = seguro; `updateCompanyUser` self = **removido**.

## 9. Prova (E2E HTTP 33/33)

`validate-pipeline-e2e-company-users-self-escalation-closure.ts`:
- **Baseline:** C sem autoridade; 403 no consolidado.
- **P1–P14:** cada campo de autoridade (permissions.*, role, isActive, memberStatus, isPrimary) + misto + alias snake + permissions.foo + campo desconhecido → **403**.
- **Banco:** linha de C inalterada; C continua 403 após todas as tentativas.
- **Positivas:** C altera `roleDescription` (200); role_description muda sem autoridade junto; C ainda 403 no consolidado.
- **Writers admin:** A concede/revoga flag (200/200; C vê/perde); C não se autoconcede pela rota específica (403); D (admin de F) não altera linha de E; C não altera linha de B.
- **Estado:** GET não cria linha company_users.
- **Estrutural:** rota usa `selfUpdateCompanyUser` (não `updateCompanyUser`); allowlist presente; `updateCompanyUser` removido; SQL só `role_description`.

Root-cause antes/depois: 200/banco-mudado/consolidado-200 → **403/inalterado/403**.

## 10. Gates e regressões

| Gate | Resultado |
|------|-----------|
| tsc | OK (2 pré-existentes geo-enrichment) |
| validate:actor-writer-boundaries | GATE OK [§4.8.1] |
| validate:bank-ledger-boundaries | GATE OK [§4.6] |
| validate:regression-guards | OK (366 migrations) |
| validate-architectural --strict | critical_new=0 |
| validate:system-state:strict | PASS |

Regressões: self-escalation 33/33 · inventory consolidado 39/39 · inventory f6-5-c3 12/12 · marketplace actor-target 16/16 · company-members f6-5-5 7/7 · role-vocabulary 7/7 · x-actor-id 9/9 · groups-mine 26/26.

## 11. Documentação

- **DECISION-0116 ADENDO A1 item 12 corrigido com honestidade:** a redação original ("auto-concessão vedada por desenho") era enganosa. O writer da flag nova era admin-gated, mas a rota genérica preexistente permitia autoelevação a `can_manage_company` (que dá o consolidado). O risco existiu, foi provado por HTTP, e foi fechado nesta fatia — registrado sem reescrever a história.
- **DTs:** `DT-COMPANY-USERS-SELF-UPDATE-PERMISSION-ESCALATION` **CLOSED** (com prova). **NOVAS** (resíduos separados, não corrigidos): `DT-INVENTORY-CONSOLIDATED-HETEROGENEOUS-UNIT-AGGREGATION` (SUM+MAX(unit)), `DT-INVENTORY-ELIGIBILITY-IGNORES-COMPANY-OPERATIONAL-STATE` (eligibility não gateia company_status/KYB).

## 12. Escopo intocado / STOPs

Migration 366 · schema/query de inventory · readers legados de inventory · frontend · Bank/ledger/wallet/payout/split/settlement · suppliers · contacts · purchase-orders · escrow · finance-agenda · daily-metrics · /groups/mine · R2/actor_delegations · FASE 6 · C1/register · tenant compartilhado · DECISION-0113 · 8 classes da 0116. **Não toquei `MAX(unit)` nem eligibility-por-status** (DTs próprias). **C1/tenant compartilhado NÃO liberado. DECISION-0113 OPEN.**

## 13. Estado / próxima fatia

Inventory consolidado (`c6bbcae1`) **DESBLOQUEADO** após esta prova (Yala reseal pendente). Próxima: readers tenant-wide legados de inventory (migrar callers + tombstone) · DTs de unidade heterogênea e eligibility-por-status (frentes próprias).

HOLD — aguardando reseal da Yala.
