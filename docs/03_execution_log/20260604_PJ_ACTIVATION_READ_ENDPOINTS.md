# Execução — F-PJ-ACTIVATION-READ-ENDPOINTS (catálogo governado de seleção do par)

**Data:** 2026-06-04 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `4af65168` · **Governança:** `DECISION-0098` (D1/D2) + `DECISION-0097` (D6)

## Objetivo
Expor read-models backend que alimentam o futuro onboarding a montar o par soberano `(primary_company_type_id, primary_concept_id)`: listar `company_types` e os concepts PERMITIDOS por type (`company_type_allowed_concepts ⋈ concepts`). **Read-only: não grava o par, sem schema/migration/frontend/marketplace/tenant_concept_offerings/Bank/KYB/company_status.**

## SSOT / NÃO-SSOT
SSOT: CONCEPT (semântica); par `(primary_company_type_id, primary_concept_id)` (ativação); `company_type_allowed_concepts` (validação/catálogo de compatibilidade); `actors(id)`/page-actor (operacional); `bank_ledger` (fronteira negativa). NÃO-SSOT: businessType/businessCategory/serviceCategories/hybrid/metadata/frontend/marketplace orchestration. Precedência: Constituição > Leis > SSOT Registry > Ontologia > 0097 > 0098 > código. **Esta fatia expõe catálogo governado de seleção — não ativa empresa, não cria verdade nova.**

## Implementação (arquivos)
- **`backend/src/core/companies/companies.routes.ts`** — 2 rotas GET estáticas (segmento literal `operational-activation`; Fastify prioriza estático sobre `:companyId`):
  - `GET /companies/operational-activation/company-types`
  - `GET /companies/operational-activation/company-types/:companyTypeId/concepts` (400 `INVALID_COMPANY_TYPE_ID` se não-uuid; 404 `COMPANY_TYPE_NOT_FOUND`; 200 `[]` se sem pares).
  - Auth: padrão `req.user?.globalUserId` → 401; tenant → 400. **Sem** guard de autoridade sobre company específica (catálogo global). Sem `ensureUserActor`, sem actor, sem DML.
- **`backend/src/core/companies/companies.service.ts`** — `listOperationalCompanyTypes(tenantId)` e `listAllowedConceptsForCompanyType(tenantId, companyTypeId)` (`runQueriesWithTenant` → `T[]`; snake_case no SQL, camelCase no payload; sem `SELECT *`; sem metadata/businessType). `listAllowedConceptsForCompanyType` retorna `null` se o type não existe (→ 404).

## Como os dados são lidos
- **company-types:** `SELECT id, name, slug, default_department_slugs, default_branch_slugs FROM company_types ORDER BY name ASC` → `{ companyTypeId, slug, name, defaultDepartmentSlugs, defaultBranchSlugs }`.
- **concepts permitidos:** `company_type_allowed_concepts a JOIN concepts c ON c.concept_id=a.concept_id WHERE a.company_type_id=$1 ORDER BY c.domain, c.slug` → `{ conceptId, slug, domain }`. `concepts` **não tem display name** → expõe `slug`/`domain` (DECISION-0098: até existir display name governado).
- **Sem** metadata, **sem** businessType/businessCategory/serviceCategories/hybrid.

## Correção factual (disco vence narrativa)
A auditoria read-only da fatia anterior afirmou que `company_type_allowed_concepts` **não** era migration-seeded (miss de grep literal `INSERT INTO`). **É seedado** por `backend/migrations/20260416125000_concepts_estabelecimento.sql` via `INSERT...SELECT`. O e2e foi reescrito para **ler os pares vivos** (não semear) e criar um `company_type` fresco sem pares para provar o branch `200 []`.

## Descoberta
Rotas GET sob `protectedScope` herdam o `action-context.plugin` (exige header `x-action-context` mesmo em GET, exceto `/social/actors/available`). Honrado no teste.

## Prova
- **e2e: 13/13** (`validate-pipeline-e2e-pj-activation-read-endpoints.ts` + wrapper `run-pj-activation-read-endpoints-ephemeral.ps1`; DB efêmera, `app.inject`, teardown DROP): T1 company-types→200/≥7/shape/sem-legado; T2 concepts(typeWithPairs)→200/set EXATO/conceptId+slug+domain; T3 type sem pares→200 []; T4 não-uuid→400; T5 inexistente→404; T6 estática não capturada por `GET /:companyId`; T7 sem DML (companies/tco inalterados).
- **Regressão:** `F-PJ-ACTIVATION-ROUTE-WRITE-PAIR` re-rodado **15/15**.
- **Typecheck backend:** só os 2 baseline `geo-enrichment.service.ts`.
- **4 gates:** actor-writer OK · bank-ledger OK · regression OK (357) · arch --strict exit 0 (critical_new=0, warning_new=1 = c3 pré-existente).

## DTs
- `DT-PJ-OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT` → **PARTIALLY MITIGATED / GOVERNED** (+ catálogo governado exposto; gap = onboarding frontend).
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → **OPEN** (mitigação parcial: backend fornece catálogo + rota; falta o wizard consumir).
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` → OPEN.
- `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` → permanece CLOSED.

## Não-toque confirmado
frontend · schema/migrations · write-pair · `tenant_concept_offerings` · marketplace/hybrid · businessType/businessCategory/serviceCategories/metadata · `createCompany`/nascimento inerte · Bank · KYB/fiscal · social gate · profile progress · `company_status` · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
Onboarding frontend consome `GET company-types` + `GET .../concepts` (frontend NÃO inventa concept — envia o que o backend expôs) e chama `POST /:companyId/operational-activation`. `tenant_concept_offerings` writer + reconciliação hybrid→trilhos seguem frentes próprias. Esta fatia entrega o cardápio governado; não escolhe o prato pelo usuário, não escreve o par.
