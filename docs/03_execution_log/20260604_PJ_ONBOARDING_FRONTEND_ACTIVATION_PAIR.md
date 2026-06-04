# Execução — F-PJ-ONBOARDING-FRONTEND-ACTIVATION-PAIR (wizard escreve o par via backend)

**Data:** 2026-06-04 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `e9fc1b00` · **Governança:** `DECISION-0098` (D1/D2/D10) + `DECISION-0097` (D6)

## Objetivo
Migrar o onboarding frontend de empresa para usar o catálogo governado e a rota viva de ativação operacional PJ, gravando o par `(primary_company_type_id, primary_concept_id)` via backend — e **parar de gravar `businessType` em `metadata` como verdade operacional**. **Sem backend/schema/migration/marketplace/tenant_concept_offerings/Bank/KYB/createCompany.**

## SSOT / NÃO-SSOT
SSOT: CONCEPT (semântica); par `(primary_company_type_id, primary_concept_id)` (ativação, gravado pelo backend); `company_type_allowed_concepts` (validação, no backend); `actors(id)`/page-actor (operacional); autoridade contextual = `company_users` (no backend); `bank_ledger` (fronteira negativa). NÃO-SSOT: businessType/businessCategory/serviceCategories/hybrid/metadata/**frontend**/marketplace orchestration. Precedência: Constituição > Leis > SSOT Registry > Ontologia > 0097 > 0098 > código. **Esta fatia só troca a coleta frontend para usar catálogo governado + rota do par; não publica empresa, não resolve marketplace, não escreve ontologia em metadata.**

## Implementação (arquivos — só frontend)
- **`frontend/src/api/companies.ts`** — 3 tipos (`OperationalCompanyType`, `AllowedOperationalConcept`, `OperationalActivationResponse`) + 3 funções: `getOperationalCompanyTypes()`, `getAllowedConceptsForCompanyType(companyTypeId)`, `activateCompanyOperationally(companyId, { companyTypeId, conceptId })`. camelCase; não expõem businessType/hybrid; extraem `result.data`.
- **`frontend/src/components/company/CompanyOnboardingWizard.tsx`** — Step 1 reescrito: estado `companyTypes`/`selectedCompanyTypeId`/`concepts`/`selectedConceptId` (+ loading/error por lista); `useEffect` carrega company_types ao montar e concepts ao escolher o type (reseta concept). `handleNext` Step 1 exige type+concept. `handleSubmit`: chama `activateCompanyOperationally` **primeiro** (trata 400/403/409 com mensagem honesta; falha aborta) e só então grava `metadata.onboarding` com **config de UX** (módulos/papéis/agenda) + `onboardingCompleted`. Summary mostra name do type + slug/domain do concept.
- **`frontend/src/components/company/CompanyOnboardingWizard.css`** — `.concept-selection` (separação visual da seleção dependente).
- **`frontend/src/types/company-onboarding.ts`** — removidos o enum legado `CompanyBusinessType` e o campo `businessType` de `CompanyOnboardingConfig` (eram usados SÓ no wizard + neste arquivo; grep confirmou). Config agora é UX-only.

## Action-context / auth (infra existente, sem invenção)
`apiFetch` (`frontend/src/api/client.ts`) injeta automaticamente `Authorization` (JWT), `x-tenant-id` (do storage/JWT) e `x-action-context` — este montado a partir de `unificard_active_actor_id` no localStorage (`{actorId, intent:'user_action', source:'frontend', scope:'tenant:<id>'}`). **O frontend NÃO inventa actorId.** Rotas protegidas sem actor disparam enforcement do próprio client. Nenhuma infra nova foi criada.

## Tratamento de erros (UI honesta)
`apiFetch` preserva `error.code` do corpo do backend. O submit mapeia: 400 `COMPANY_TYPE_CONCEPT_NOT_ALLOWED` → "combinação tipo+atividade não permitida"; 403 `COMPANY_OPERATIONAL_ACTIVATION_FORBIDDEN` → "sem autoridade"; 409 `COMPANY_ALREADY_OPERATIONAL_WITH_DIFFERENT_CLASSIFICATION` → "já ativada com outra classificação". Falha NÃO é mascarada como sucesso; a UX não é salva se a ativação falhar.

## Prova
- **Frontend typecheck:** `pnpm --dir frontend run typecheck` (tsc --noEmit) **limpo, 0 erros**.
- **Greps finais:** `businessType`/`CompanyBusinessType` só sobrevivem em COMENTÁRIOS (zero uso operacional); wizard chama `getOperationalCompanyTypes`/`getAllowedConceptsForCompanyType`/`activateCompanyOperationally`; `metadata.onboarding` guarda só UX + `onboardingCompleted`; `selectedConceptId` só recebe `c.conceptId` de itens vindos do backend (frontend não inventa concept); `CompanyCreationPage` sem nenhuma referência a type/concept/operational-activation (inerte).
- **Backend runtime NÃO tocado** (typecheck backend não obrigatório nesta fatia).
- **4 gates:** actor-writer OK · bank-ledger OK · regression OK (357) · arch --strict exit 0 (critical_new=0, warning_new=1 = c3 pré-existente).

## DTs
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → **PARTIALLY MITIGATED / GOVERNED** (wizard consome catálogo + chama rota; resíduo = eixo A N0 "ambos" + `tenant_concept_offerings`).
- `DT-PJ-OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT` → permanece **PARTIALLY MITIGATED / GOVERNED** (+ onboarding parou de gravar `businessType`; resíduo = `businessCategory`/createCompany + `hybrid`).
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` → OPEN.
- `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` → permanece CLOSED.

## Não-toque confirmado
backend · schema/migrations · write-pair (backend) · `tenant_concept_offerings` · marketplace/hybrid · `StoreOnboardingWizard` · `createCompany`/nascimento inerte (`CompanyCreationPage`) · Bank · KYB/fiscal · social gate · profile progress · `company_status` · `businessCategory` no backend · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
Validação manual/E2E do fluxo UI; depois frentes próprias: `tenant_concept_offerings` writer (tensão tenant×page-actor + risco de publicação automática), read-only marketplace `hybrid`→trilhos, e eixo A (produtos/serviços/ambos) explícito no onboarding. Esta fatia ensina a UI a escolher pelo catálogo soberano — não deixa a UI escrever ontologia em metadata.
