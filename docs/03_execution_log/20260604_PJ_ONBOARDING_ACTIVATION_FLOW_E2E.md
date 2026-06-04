# Execução — F-PJ-ONBOARDING-ACTIVATION-FLOW-E2E-PERMANENT (E2E encadeado do fluxo do par)

**Data:** 2026-06-04 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `e0cc89c0` · **Governança:** `DECISION-0098` (D1/D2) + `DECISION-0097` (D6)

## Objetivo
Transformar a prova (até então partida em read-endpoints + write-pair + seam por grep) em **um teste permanente** que valida, em UMA execução, a cadeia que o onboarding exercita: GET catálogo governado → escolher um par REAL permitido → POST ativação operacional com esse par → `companies.primary_*` persistido + invariantes de não-toque. **Fatia de teste/evidência — não altera runtime de produto (backend/frontend/schema/migration), Bank/KYB/marketplace/offering.**

## SSOT / NÃO-SSOT
SSOT: CONCEPT; par `(primary_company_type_id, primary_concept_id)` (ativação); `company_type_allowed_concepts` (validação); `actors(id)`/page-actor (operacional); `company_users` (autoridade contextual). NÃO-SSOT: businessType/businessCategory/serviceCategories/hybrid/metadata/frontend/marketplace. Fronteiras negativas: Bank/KYB/marketplace/hybrid/`tenant_concept_offerings`. Precedência: Constituição > Leis > SSOT Registry > Ontologia > 0097 > 0098 > código.

## Implementação (arquivos — só teste)
- **`backend/src/scripts/validate-pipeline-e2e-pj-onboarding-activation-flow.ts`** (novo) — E2E encadeado. App mínimo via `app.inject` (sensible+auth+tenant+actionContext+rbac+companiesModule), `mintToken`, seed de chain identity + empresa inerte + `company_users` owner, reusando o molde dos E2Es PJ. **O par é escolhido a partir das respostas do catálogo** (não por SQL): itera os company_types, chama o endpoint de concepts e pega o 1º type com concepts + o 1º concept (sem hardcode de UUID).
- **`scripts/run-pj-onboarding-activation-flow-ephemeral.ps1`** (novo) — wrapper (CREATE → migrate FULL → tsx → DROP; guard `NUNCA unificard_dev`).

## Cobertura (22 asserções)
1. GET company-types → 200; catálogo não-vazio; **sem** businessType/businessCategory/serviceCategories/hybrid/metadata.
2/3. Escolhe companyTypeId real do catálogo (sem hardcode); escolhe conceptId real permitido; concepts `{conceptId,slug,domain}` sem legado; par escolhido ∈ `company_type_allowed_concepts`.
6/8. POST ativação → 200; response `primaryCompanyTypeId`/`primaryConceptId` = par escolhido; `alreadyActive=false`; `pageActorId` presente.
9. Repetição com o mesmo par → 200 `alreadyActive=true` (idempotência).
10. Persistência + não-toque: `companies.primary_company_type_id`/`primary_concept_id` persistidos; `company_status` inalterado; `fiscal_identity_id` inalterado (kyb intocado); `tenant_concept_offerings` = 0 (não escrito); `bank_transactions` inalterado (Bank não tocado); `fiscal_identities` não escrito.
12. Owner sem membership numa 2ª empresa → **403** `COMPANY_OPERATIONAL_ACTIVATION_FORBIDDEN`.
13. Body sem `conceptId` → **400** `INVALID_BODY`.

## Prova
- **E2E encadeado: 22/22** (DB efêmera, migrate FULL, `app.inject`, teardown DROP).
- **Backend tsc:** só os 2 baseline `geo-enrichment.service.ts` (o novo teste compila limpo).
- **Frontend typecheck:** limpo (sem mudança de frontend).
- **4 gates:** actor-writer OK · bank-ledger OK · regression OK (357) · arch --strict exit 0 (critical_new=0, warning_new=1 = c3 pré-existente).

## Correção durante a fatia (disco vence narrativa)
Primeira execução falhou ao ler `companies.metadata` — a tabela `companies` **não tem coluna `metadata`**. A verdade operacional é o par; `metadata`/`businessType` é preocupação do **frontend** (coberta por greps na fatia de onboarding), e a rota de ativação toca **apenas** `primary_*` + `updated_at`. A asserção misplaced foi removida; os demais invariantes (company_status/fiscal/tco/Bank) provam o não-toque.

## Invariantes provados
- `companies.primary_company_type_id` + `primary_concept_id` gravados pelo par escolhido no catálogo.
- Par sempre ∈ `company_type_allowed_concepts` (validação soberana).
- `metadata` não virou SSOT (companies sequer tem a coluna; rota não escreve metadata).
- `tenant_concept_offerings` não escrito (=0).
- Bank/KYB/fiscal intocados (`bank_transactions`/`fiscal_identities`/`fiscal_identity_id`/`company_status` inalterados).

## DTs
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → permanece **PARTIALLY MITIGATED / GOVERNED** (agora com E2E encadeado permanente; resíduo = eixo A N0 "ambos" + `tenant_concept_offerings`).
- `DT-PJ-OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT` → PARTIALLY MITIGATED / GOVERNED.
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` → OPEN.
- `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` → CLOSED.

## Não-toque confirmado
runtime backend (service/routes) · frontend · schema/migrations · `tenant_concept_offerings` writer · marketplace/hybrid · Bank · KYB/fiscal · `createCompany`/nascimento inerte · `company_status` · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
READ-ONLY `tenant_concept_offerings` (desenho do writer: tensão tenant×page-actor + risco de publicação automática) OU READ-ONLY marketplace `hybrid`→trilhos. Esta fatia transformou a prova do fluxo em teste permanente; não mudou o fluxo.
