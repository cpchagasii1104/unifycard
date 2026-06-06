# Execução — F-PJ-ONBOARDING-ROLE-DEDUP — frontend + projeção backend isolada

**Data:** 2026-06-06 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `0e66e1b2` · **Decisão:** Clayton — remover a duplicidade de cargo/papel no onboarding PJ, confirmando o vínculo formal em vez de reperguntar · **Esteira:** eu (escritora); par verifica.

## Objetivo
Fechar a reclamação "Está me perguntando duas vezes se eu sou dono, gerente, etc." O papel é pedido no **cadastro** (vínculo formal `company_users.role`) e **de novo** no wizard (metadata de UX). Dedup: o wizard deve **confirmar** o papel já definido, não recriar.

## READ-FIRST (confirmado contra código vivo)
1. Etapa de papel no wizard: `CompanyOnboardingWizard.tsx` Etapa 3 "Quais papéis você quer configurar?" — checkboxes Owner/Manager/Staff (`initialRoles`, tipo `CompanyInitialRoles`).
2/3. Payload do submit: `activateCompanyOperationally` (par soberano) **+** `updateCompany({ metadata: { onboarding: { modules, initialRoles, calendarConfig, ... } } })` — `initialRoles` vai para `companies.metadata.onboarding`, rotulado "Config de UX (NÃO é verdade operacional)".
4. `roles`/cargo no onboarding = **metadata**, não tabela formal.
5/6. O papel **formal** já é definido na **criação**: `CompaniesManagerForm` "Seu Cargo na Empresa" (`formData.role`: owner/partner/director/manager/employee/other) → `createCompany` → **`company_users.role`** (SSOT).
7. `activateCompanyOperationally` **não** consome cargo/papel (só companyTypeId/conceptId + page-actor).
8. **Nenhum runtime lê `metadata.onboarding.roles` como autoridade** (grep backend vazio) → é ruído paralelo.
9. Metadata de role = só UX → tratada como compat.
10. **Ambiguidade encontrada (achado lateral):** o tipo/contrato `CompanyUserRole` e o cadastro usam `owner/partner/director/manager/employee/other`, mas o CHECK vivo `chk_company_users_role_valid` aceita `owner/admin/staff/contractor/member`. Registrado como DT própria; **não corrigido aqui** (fora de escopo).

## Implementação
- **Backend (projeção isolada — exceção do envelope):** `getCompanyById` passou a projetar `userRole` (vínculo `company_users` do chamador) via helper `projectCallerCompanyUser` — leitura PURA do SSOT, mesmo shape de `listCompanies`. O tipo `Company` já **declarava** `userRole` (required) e `listCompanies` já o entregava; `getCompanyById` o omitia (retornava undefined). É gap de projeção, não autoridade nova. Sem escrita, sem migration.
- **Frontend:** `CompanyOnboardingPage` passa `company.userRole.role`/`roleDescription` ao wizard. No wizard: novo prop `initialRole`/`initialRoleDescription`; mapa `COMPANY_ROLE_LABEL` (rótulo PT, defensivo p/ vocabulário do banco); **Etapa 3** virou confirmação — "Você está configurando esta empresa como **[papel]**… definido no cadastro" + nota de que papéis da equipe são geridos depois; **Etapa 5** mostra o papel formal; checkboxes e `handleRoleToggle` removidos. `initialRoles` permanece no payload **só como compat** (derivado do papel formal via `useEffect`; owner=true p/ o responsável), nunca autoridade.

## Prova
- **e2e** `validate-pipeline-e2e-pj-company-userrole-projection` (efêmero, DEV intacto): **4/4** — R1 owner · R2 admin · R3 `userRole.role` espelha `company_users` (SSOT) · R4 projeção é leitura (lifecycle segue DRAFT). _(create→assert→delete um a um p/ ser robusto ao anti-fraude; usei `admin` em R2 porque o CHECK rejeita `manager` — ver DT de vocabulário.)_
- **Sem regressão:** lifecycle **7/7**, CNPJ on-entry **6/6**.
- **tsc:** frontend **0**; backend (escopo) 0 (2 `geo-enrichment` baseline).
- **4 gates:** actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK (365) · arch `--strict` exit 0 (`critical_new=0`; `warning_new=1`=c3). **dev 365 (zero migration; zero Bank).**

## Não-toque confirmado
Bank/`bank_*` · migration/schema (365) · `actor_delegations`/permissões formais (só leitura de `company_users` para projeção) · KYB/documentos · lifecycle (preservado: submit usa o par soberano e promove DRAFT→PROVISIONAL) · CNPJ on-entry (preservado) · delete-guard · marketplace/publicação · DECISIONs. Vocabulário de papel (achado) **não** alterado.

## DTs
- `DT-PJ-ONBOARDING-ROLE-DUPLICATE` → **CLOSED**.
- `DT-PJ-COMPANY-USER-ROLE-VOCABULARY-MISMATCH` → **OPEN** (achado lateral; frente própria).

## Próximo passo recomendado (ordem Clayton)
1. KYB documents SSOT writer/read-only ou design (substrato `fiscal_identity_documents` 0087 — não deixar tarde); 2. delete guard via Bank port; 3. KYB release gate financeiro. Adicional: reconciliar o vocabulário de `company_users.role` (DT acima).
