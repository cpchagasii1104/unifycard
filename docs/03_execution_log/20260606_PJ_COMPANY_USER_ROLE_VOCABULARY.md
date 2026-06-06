# Execução — F-PJ-COMPANY-USER-ROLE-VOCABULARY-MISMATCH — code-only (Opção A), sem migration

**Data:** 2026-06-06 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `ed5ad174` · **Decisão:** Clayton — reordenou: corrigir o vocabulário de cargo ANTES de KYB docs (porta de entrada PJ pode falhar) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Resolver a divergência entre o vocabulário de cargo oferecido no frontend/API e o CHECK real do banco em `company_users.role`. O usuário escolhe "Gerente/Diretor/Sócio/Funcionário" → `createCompany` insere → CHECK `chk_company_users_role_valid` rejeita (só `owner` passava) → criação PJ básica quebra.

## READ-FIRST (confirmado contra schema/código vivos)
1. CHECK definido em migration `20260530541000` (`company_users_membership_expansion`): `role IN ('owner','admin','staff','contractor','member')`. **Nenhuma migration posterior o redefine.** Live: CHECK confirmado, **default `'member'`**, valores vivos só `owner` (2).
2. Contrato `CompanyUserRole` (`packages/contracts/src/company.ts`): `owner/partner/director/manager/employee/other`.
3. `createCompany` grava `company_users.role` = `input.role`; e **deriva permissões** (`can_manage_*`) do `role` (l.455-459).
4. Uso de `company_users.role`: API zod (`companies.routes.ts:41,107`), permissões (service), UI (form/wizard), projeção (`getCompanyById`/`listCompanies`). `'manager'` em marketplace/ActorRole/EmployeeService é **outro** conceito (não tocar).
5. Live: só `owner`.
6/7. `role` **não** é autoridade granular — a autoridade material vive em `can_manage_*` (preferência Clayton). `soft-block.validateCompanyRole` é gated por `isSoftBlockEnabled()` (OFF; por isso owner existe live).
8/9. Resolver sem schema é possível (Opção A) → **preferido**; CHECK **não** alterado (sem STOP de migration).

## Decisão: Opção A (vocabulário ÚNICO = o do banco)
Em vez de mapear na borda (Opção B, que esconderia semântica/criaria vocabulário paralelo — anti-ethos do projeto) ou evoluir o CHECK (Opção C, migration), **alinhei o contrato/API/UI ao conjunto do banco**. Uma só verdade de vocabulário.

## Implementação (code-only)
- **Contrato** `packages/contracts/src/company.ts`: `CompanyUserRole = owner|admin|staff|contractor|member` (doc cita o CHECK). **dist rebuildado** (`pnpm --dir packages/contracts build`).
- **API** `companies.routes.ts`: ambos `z.enum` (create/update) → vocab do banco.
- **Permissões** `companies.service.ts`: `isManagerTier = owner||admin`; `canManageCompany=owner`; financial/employees/services = `isManagerTier`; staff/contractor/member sem manage.
- **Frontend** `CompaniesManagerForm.tsx`: 5 opções do banco (rótulos PT); "Descrição do cargo" (texto livre) p/ qualquer papel ≠ owner (captura sócio/diretor/gerente sem fingir autoridade). `CompanyOnboardingWizard.tsx`: `COMPANY_ROLE_LABEL` alinhado; label usa `roleDescription` quando presente em não-owner; derive `initialRoles` (compat) atualizado.

## Prova
- **e2e** `validate-pipeline-e2e-pj-company-user-role-vocabulary` **7/7** — V1..V5: cada papel visível (owner/admin/staff/contractor/member) **grava + projeta + tier de permissão** correto; N1: papel legado `manager` **rejeitado** pelo banco, **nada criado**; cleanup.
- **Sem regressão:** projection 4/4, lifecycle 7/7, CNPJ 6/6.
- **tsc:** frontend **0**; backend (escopo) 0 (2 `geo-enrichment` baseline).
- **4 gates:** actor-writer OK · bank-ledger OK · regression-guards OK (365) · arch `--strict` exit 0 (`critical_new=0`; `warning_new=1`=c3). **dev 365 (zero migration; zero Bank).**

## Não-toque confirmado
CHECK/schema/migration (Opção C rejeitada) · Bank · KYB/documentos · delete-guard · `actor_delegations` · lifecycle (DRAFT→PROVISIONAL preservado) · CNPJ on-entry · marketplace ActorRole/EmployeeService (outro conceito de role) · `soft-block` (OFF; observabilidade).

## DT
- `DT-PJ-COMPANY-USER-ROLE-VOCABULARY-MISMATCH` → **CLOSED**. Residual de produto (sócio/diretor/procurações como autoridade governada) → frente de **authorized links/delegations** (`actor_delegations`); por ora é `roleDescription` texto livre.

## Próximo passo (ordem Clayton)
3. KYB documents SSOT writer/read-only ou design; 4. delete guard via Bank port; 5. KYB release gate financeiro.
