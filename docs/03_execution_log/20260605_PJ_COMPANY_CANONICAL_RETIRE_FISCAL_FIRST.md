# Execução — F-PJ-COMPANY-CANONICAL-RETIRE-FISCAL-FIRST (β.1)

**Data:** 2026-06-05 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `71f430aa` · **Governança:** `DECISION-0081/0085` + decisão de produto de Clayton (β.1)

## Objetivo
Aposentar o fluxo legado `POST /api/companies/canonical` e a página frontend viva que o chama (`CompanyCreationPage`), **sem quebrar** o nascimento PJ fiscal-first. Decisão de produto: **CPF não vira empresa** pelo caminho canonical; criação PJ segue CPF responsável → `fiscal_identity`/CNPJ → KYB → page-actor (via `createCompany` / `POST /companies`).

## Diagnóstico (READ-FIRST)
- **Backend:** `app.builder.ts:262-264` registrava `companyCanonicalRoutes` (prefix `/api`). `company-canonical.routes.ts` importava `company-canonical.service.ts` (INSERT com colunas-fantasma `legal_name`/`document_number`/`country`/`state` inexistentes em `companies` → quebrado em runtime). **Callers:** só o app.builder usa a rota; só a rota usa o service. Zero outro caller.
- **Frontend:** `CompanyCreationPage.tsx` chamava `POST /api/companies/canonical` (linha 104), aceitava `document_type: CPF|CNPJ` (CPF-como-empresa) e navegava para `/companies/:id` (rota inexistente). Roteada em `App.tsx:287-288` (`companies/new`, `empresas/nova`). Import em `App.tsx:82`.
- **Fluxo fiscal-first vivo (destino):** `App.tsx:286` → `empresas` → `EmpresasPage` → `CompaniesManager` → `POST /companies` (`createCompany`, fiscal-first, CNPJ-only). É a UX viva que recebe o usuário.
- Lição do ciclo anterior (2026-06-04): a remoção backend-only foi revertida porque o acoplamento frontend era pela **STRING** `/api/companies/canonical`, não por símbolo. Por isso esta fatia é **front+back atômica**.

## Implementação
**Backend:**
- `app.builder.ts`: removido o bloco de registro `companyCanonicalRoutes` (comentário + import + `app.register`), preservando o register de reporting e o log. Nota explicativa no lugar.
- **Deletados** `backend/src/core/companies/company-canonical.routes.ts` e `company-canonical.service.ts` (dead após remoção do registro; zero caller).

**Frontend:**
- `App.tsx`: removido o import de `CompanyCreationPage`; rotas `companies/new` e `empresas/nova` agora `<Navigate to="/empresas" replace />` (redirect para o fluxo fiscal-first vivo).
- **Deletadas** `frontend/src/pages/CompanyCreationPage.tsx` e `CompanyCreationPage.css` (dead após remoção do import/rota; zero outro import).

**CPF-como-empresa:** fica **fora** (não suportado pelo modelo fiscal-first / DECISION-0085 = CNPJ). Se um dia houver MEI/autônomo, é frente própria — não esta página quebrada.

## Prova
- **Grep** `company-canonical` / `companies/canonical` / `CompanyCreationPage` em `backend/src` + `frontend/src` = **só comentários explicativos** (zero caller/import/rota viva).
- **Backend tsc:** só os 2 baseline `geo-enrichment.service.ts`.
- **Frontend tsc:** **limpo** (zero erro — import removido + Navigate redirect + página deletada sem refs pendentes).
- **e2e `F-ATOMIC-COMPANY-BIRTH` 18/18** (efêmero): nascimento fiscal-first (`createCompany`) intacto — fiscal_identity pending + company + company_user + page-actor + rollbacks + CNPJ-DV + zero Bank.
- **Gates:** actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK · `validate-architectural-patterns.mjs --strict` exit=0 (`critical_new=0`; `warning_new=1`=c3 baseline pré-existente).

## DT
- `DT-COMPANY-CANONICAL-SERVICE-SCHEMA-DRIFT` → **CLOSED** (aposentadoria front+back provada; nenhuma porta aponta pra parede).

## Não-toque confirmado
Bank · KYB writer (revokeFiscalKybApproval/review intactos) · publication · marketplace/hybrid · CNAE seed · schema/migration (zero) · `companies.service.createCompany` (fiscal-first preservado) · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`. Não inventado fluxo CPF-as-company; não reaberto DomainSelector; não criado onboarding novo.

## Próximo passo
Fundação (Estágio 1 do fluxograma) praticamente fechada: canonical aposentado + revogação KYB viva (β.2). Resíduo opcional: `DT-PJ-KYB-REVOCATION-READER-DEFENSE-MISSING` (filtro KYB no reader contextual). γ/CNAE bloqueada em fonte oficial (Clayton). Profundidade (Trilhos A/B, display name de concept) depois.
