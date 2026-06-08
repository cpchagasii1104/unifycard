# Execução — F-PJ-CREATOR-INITIAL-AUTHORITY-ENFORCED (Opção B) — backend

**Data:** 2026-06-07 · **Modo:** EXECUÇÃO CONTROLADA · **Branch:** `rescue-structural` · **HEAD origem:** `95e8cc73`
**Decisor:** Clayton (Opção B + autorização de ajuste do vocab e2e) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Garantir server-side que o criador de uma PJ receba sempre a governança inicial (`can_manage_company=true`), independente do `role` do formulário, sem schema/migration.

## READ-FIRST + respostas ao pré-edit
1. `role=input.role` entra em `company_users` em `companies.service.ts:551`.
2. `defaultPermissions.canManageCompany` = `input.permissions?.canManageCompany ?? (input.role === 'owner')` (`:459`).
3. Roles que deixavam o criador sem `canManageCompany`: **admin/staff/contractor/member** (qualquer ≠ owner sem `permissions`), pois `canManageCompany()` = `(can_manage_company OR role='owner')`.
4. **Não havia** e2e "criação → criador pode gerir" — bug não-coberto.
5. Menor correção = forçar `can_manage_company=true` no membership do criador → **mas colidia** com o `pj-company-user-role-vocabulary` (que assere `admin/staff/member-criador → company=false`). **STOP acionado** → Clayton decidiu **Opção B**.

## STOP → decisão
Conflito real com regressão obrigatória (`pj-company-user-role-vocabulary` codificava o comportamento bugado: criador sem governança). Parei e pedi A (forçar `role='owner'`) vs B (preservar label + forçar flag). **Clayton: B**, + autorização explícita para ajustar o tier `company` do vocab e2e (só onde codifica o bug).

## Implementação (backend, sem migration)
1. **`companies.service.ts`** — `defaultPermissions.canManageCompany` passa de `input.permissions?.canManageCompany ?? (input.role === 'owner')` para **`true`** (imposto server-side; ignora `input.permissions` e o `role`). `company_users.role = input.role` preservado. `financial/employees/services` seguem role-derived. Vale só para o membership inicial do criador neste fluxo. `validateFlags` (soft-block OFF) não lança (o caminho owner já passava `true`).
2. **`pj-company-user-role-vocabulary.ts`** (autorizado) — tier `company` → `true` para todos os roles (criador sempre governa); `financial/employees/services` intactos; comentário citando a frente; asserções de storage/projeção do role label intactas.
3. **`pj-creator-initial-authority.ts`** (novo) — e2e da regra.

## Prova
- **e2e** `validate-pipeline-e2e-pj-creator-initial-authority` **9/9**: C1 owner→canManage=true+role=owner · C2 member→canManage=true + label preservado + flag forçado · C3 `input.permissions.canManageCompany=false` IGNORADO→true · C4 estranho→false · C5 criador passa pelo gate · C6 nascimento = 1 membership ativo = criador (sem fundador automático) · C7 invariante.
- `pj-company-user-role-vocabulary` **7/7** (tier ajustado).
- **Backend tsc** fora de geo = **0**. **4 gates OK** (`critical_new=0`). **dev 365**.
- **Sem regressão:** authority-escalation-gate 16/16 · rbac-actor-binding 13/13 · userrole-projection 4/4 · cnpj 6/6 · lifecycle 7/7 · KYB admin-review 13/13 · release-gate 10/10 · user-submit 19/19. `atomic-company-birth` **17/18** — única falha `1d company PROVISIONAL/pending` **pré-existente** (modo idêntico ao baseline; `DT-PJ-EPHEMERAL-FIXTURES-STALE-VS-BASELINE-365`).

## O que NÃO foi tocado
`company_status`/`kyb_status` · frontend · Bank · migration · `actor_delegations`/actor/delegation extra · autoridade para Clayton/fundador (membership inicial = só o criador) · `company-members`/organization · KYB/fiscal/lifecycle · `docs/memorias/`/autorais.

## DTs
- `DT-PJ-CREATOR-INITIAL-AUTHORITY-NOT-ENFORCED` → **CLOSED** (aberta+fechada nesta fatia).

## Próximo passo
Retomar DECISION-0113 fatia 5/6 — `F-PLAN-IDENTITY-CONFIG-AUTHORSHIP-GATE-F5_1`.
