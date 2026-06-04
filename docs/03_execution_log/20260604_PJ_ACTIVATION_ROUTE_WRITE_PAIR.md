# Execução — F-PJ-ACTIVATION-ROUTE-WRITE-PAIR (rota viva de ativação operacional PJ)

**Data:** 2026-06-04 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `9f0b5c43` · **Governança:** `DECISION-0098` (D1/D2) + `DECISION-0097` (D6/D7)

## Objetivo
Expor um caminho backend **vivo e autorizado** para a ativação operacional PJ (Momento 2), chamando o writer soberano existente `activateCompanyOperationally`, que grava o par `(primary_company_type_id, primary_concept_id)` validado por `company_type_allowed_concepts`. Fechar a lacuna de autoridade contextual (o writer não verifica se o chamador pode gerir ESTA empresa). **Sem schema/migration/frontend/marketplace/tenant_concept_offerings/Bank/KYB/company_status.**

## SSOT / NÃO-SSOT
SSOT: CONCEPT (semântica); par `(primary_company_type_id, primary_concept_id)` (ativação); `company_type_allowed_concepts` (validação); `actors(id)`/page-actor (operacional); `company_users` (autoridade contextual sobre a empresa); `bank_ledger` (fronteira negativa). NÃO-SSOT: businessType/businessCategory/serviceCategories/hybrid/metadata/frontend/marketplace orchestration. Precedência: Constituição > Leis > SSOT Registry > Ontologia > 0097 > 0098 > código.

## Implementação (arquivos)
- **`backend/src/core/companies/companies.routes.ts`** — `POST /:companyId/operational-activation` (mount real `/companies/...` no `protectedScope`). Body zod `operationalActivationSchema { companyTypeId: uuid, conceptId: uuid }`. Fluxo: 401 sem auth → 400 sem tenant → 400 companyId não-uuid (`INVALID_COMPANY_ID`) → 400 body inválido (`INVALID_BODY`) → **guard contextual** → writer → mapeamento de erro pelo `statusCode` do `HttpError`. Não aceita businessType/businessCategory/serviceCategories/hybrid/metadata.
- **`backend/src/core/companies/companies.service.ts`** — novo `canManageCompany(tenantId, companyId, globalUserId): Promise<boolean>` (query `company_users`: `is_active AND member_status='active' AND (can_manage_company OR role='owner')`, fail-closed). Writer `activateCompanyOperationally` **inalterado**.
- **`backend/src/scripts/validate-pipeline-e2e-pj-activation-route.ts`** — e2e de rota (novo).
- **`scripts/run-pj-activation-route-ephemeral.ps1`** — wrapper efêmero (CREATE → migrate FULL → tsx → DROP; guard `NUNCA unificard_dev`).

## Identidade resolvida (disco vence narrativa)
- `users.id === users.user_id` em todas as rows (dev) → `req.user.userId` (=`sub` do JWT) é o `responsibleUserId` esperado pelo writer (`findOrCreateUserActor` busca por `users.user_id`).
- `req.user.globalUserId` é a chave de `company_users.global_user_id` (FK→`global_users`) usada no guard.
- A rota herda o `action-context.plugin` do `protectedScope`: toda mutação protegida exige header `x-action-context` (JSON `{actorId,intent,source,scope}` com `scope` contendo o tenantId). Requisito de produção, honrado no teste.

## Erros (contrato)
`COMPANY_NOT_FOUND`→404 · `COMPANY_TYPE_NOT_FOUND`→404 · `CONCEPT_NOT_FOUND`→404 · `COMPANY_TYPE_CONCEPT_NOT_ALLOWED`→400 · `COMPANY_ALREADY_OPERATIONAL_WITH_DIFFERENT_CLASSIFICATION`→409 · `RESPONSIBLE_ACTOR_NOT_FOUND`→404 · `PAGE_ACTOR_AMBIGUOUS`→500 (writer) · **`COMPANY_OPERATIONAL_ACTIVATION_FORBIDDEN`→403** (novo, guard) · `INVALID_COMPANY_ID`/`INVALID_BODY`→400 (validação).

## Prova
- **e2e de rota: 15/15** (DB efêmera, `app.inject` em app mínimo = sensible+auth+tenant+actionContext+rbac+companiesModule; teardown DROP). T1 par válido→200+par gravado+pageActorId; T2 idempotente→200 alreadyActive; T3 não-permitido→400 (`COMPANY_TYPE_CONCEPT_NOT_ALLOWED`); T4 troca→409; T5 membro sem manage→403; T6 não-membro→403; T7 body inválido→400 `INVALID_BODY`; T8 companyId inválido→400 `INVALID_COMPANY_ID`; T9 sem auth→401; T10 `tenant_concept_offerings`=0; T11 actors só user/page.
- **two-moments (writer):** bloco M (schema) 7/7; bloco A abortou na flakiness **pré-existente** do `randomCnpj()` (dígito verificador) — não-regressão; o writer é provado ponta-a-ponta pela rota (T1–T4). Teste fora de escopo, não tocado.
- **Typecheck backend:** só os 2 baseline `geo-enrichment.service.ts` (não-regressão).
- **4 gates:** actor-writer OK · bank-ledger OK · regression OK (357) · arch --strict exit 0 (critical_new=0, warning_new=1 = c3 pré-existente).

## DTs
- `DT-PJ-OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT` → **PARTIALLY MITIGATED / GOVERNED** (rota do par viva; gap = onboarding ainda grava metadata).
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → OPEN.
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` → OPEN.
- `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` → permanece CLOSED.

## Não-toque confirmado
schema · migrations · frontend · `tenant_concept_offerings` (writer) · marketplace/hybrid · businessType/businessCategory/serviceCategories/metadata · `createCompany`/nascimento inerte · Bank · KYB/fiscal · social gate · profile progress · `company_status` · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
(1) read-endpoints `company_types` + concepts permitidos por type; (2) onboarding frontend chama a rota do par (para de gravar metadata); (3) `tenant_concept_offerings` writer só em frente própria (tensão tenant×page-actor + risco de publicação automática). A rota não publica a empresa nem resolve marketplace.
