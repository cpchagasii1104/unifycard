# Execução — F-PJ-PUBLICATION-OFFERING-WRITER-NO-PROJECTION (writer publish/unpublish da oferta PJ)

**Data:** 2026-06-04 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `ac064c01` · **Governança:** `DECISION-0099` + `DECISION-0100`

## Objetivo
Implementar o writer backend de publicação/despublicação PJ sobre `company_concept_publications`, **sem** atualizar `tenant_concept_offerings` (projeção/discovery = frente própria). Escreve a placa no cadastro soberano; não a acende no discovery.

## SSOT / NÃO-SSOT
SSOT publicação = `company_concept_publications`; CONCEPT (semântica); par `primary_*` (ativação); `actors(id)`/page-actor; `company_users` (autoridade); `fiscal_identities.kyb_status` (gate); `bank_ledger` (fronteira negativa). NÃO-SSOT de publicação: `tenant_concept_offerings` · metadata · businessType · businessCategory · hybrid · frontend · marketplace orchestration. Precedência: Constituição > Leis > SSOT Registry > Ontologia > 0097 > 0098 > 0099 > 0100 > código.

## Implementação (arquivos)
- **`backend/src/core/compliance/authority-decision.service.ts`** — novo método público `evaluatePageActorKybApproved(tenantId, pageActorId)`: reusa a camada interna `evaluateKybLayer` (cadeia page-actor→company→`fiscal_identities.kyb_status='approved'`, fail-closed) SEM o stack financeiro (ATL/KYC/risco). Single-source do KYB (evita 3ª cópia da cadeia).
- **`backend/src/core/companies/company-publications.service.ts`** (novo) — `publishCompanyConcept` / `retireCompanyConceptPublication`. Fluxo publish: autoridade (`canManageCompany`) → empresa existente → operacional (primary_* not null) → concept=`primary_concept_id` → page-actor (derivado de `actors` page) → KYB approved → ensureUserActor (audit humano) → BEGIN + SELECT…FOR UPDATE da active + idempotência/INSERT → COMMIT. Retire: autoridade → ensureUserActor → BEGIN + SELECT…FOR UPDATE active + idempotência/UPDATE status='retired' (retired_at/by) → COMMIT (sem KYB; isola por company_id).
- **`backend/src/core/companies/companies.routes.ts`** — `POST /:companyId/publications` + `POST /:companyId/publications/:conceptId/retire` (zod body; uuid guards; mapeamento de erro pelo statusCode do HttpError).
- **`backend/src/scripts/validate-pipeline-e2e-pj-publication-writer.ts`** + **`scripts/run-pj-publication-writer-ephemeral.ps1`** (novos).

## Contrato de erros
403 PUBLICATION_FORBIDDEN · 404 COMPANY_NOT_FOUND/RESPONSIBLE_ACTOR_NOT_FOUND · 409 COMPANY_NOT_OPERATIONAL / PAGE_ACTOR_MISSING / KYB_NOT_APPROVED · 400 CONCEPT_NOT_ACTIVATED / INVALID_BODY / INVALID_COMPANY_ID / INVALID_CONCEPT_ID · 401 não autenticado.

## Audit (DECISION-0100 D9)
`created_by_actor_id` (publish) e `retired_by_actor_id` (retire) = **actor humano do chamador**, resolvido backend-side por `ensureUserActor(tenantId, req.user.userId)` — NÃO confia em actorId do frontend/localStorage. `page_actor_id` = page-actor da empresa (em-nome-de). `published_at`/`retired_at` automáticos.

## Prova
e2e **20/20** (DB efêmera, migrate FULL, `app.inject`, teardown DROP): publish válido (200 + active + audit + page_actor + concept=primary); idempotência (alreadyPublished, sem duplicar); KYB pending→409; sem autoridade→403; não-operacional→409; concept divergente→400; sem page-actor→409; retire→retired (retired_at/by); retire idempotente; re-publish pós-retire (nova active + histórico ≥2); tco inalterada; Bank intocado; actors só user/page; company_status inalterado. Correção na fatia: `chk_fiscal_identities_approved_audit` exige reviewed_by/reviewed_at p/ `kyb='approved'` (seed ajustado). Backend tsc: só os 2 baseline geo-enrichment. **4 gates OK** (actor-writer OK confirma uso do `ensureUserActor` sancionado, sem INSERT direto em actors; arch warning_new=1 = c3 pré-existente).

## DTs
- `DT-PJ-PUBLICATION-OFFERING-SOVEREIGN-SHAPE-MISSING` → **PARTIALLY MITIGATED** (schema + writer prontos; **NÃO CLOSED** — publicação grava no SSOT mas não acende no discovery: falta projeção `tenant_concept_offerings`).
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` → OPEN.
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → PARTIALLY MITIGATED / GOVERNED.
- `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` → CLOSED.

## Não-toque confirmado
schema/migrations · frontend · `tenant_concept_offerings` · marketplace/hybrid · Bank · KYB/fiscal schema/writer · `createCompany`/nascimento inerte · `company_status` · onboarding · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
`F-PJ-PUBLICATION-OFFERING-PROJECTION` (read-only/desenho → derivar `tenant_concept_offerings` de publicações `active` company-level; religar o reader marketplace-contextual ao discovery governado) OU read-only marketplace `hybrid` (ortogonal). Esta fatia escreveu a placa no cadastro soberano; ainda não a acendeu no discovery.
