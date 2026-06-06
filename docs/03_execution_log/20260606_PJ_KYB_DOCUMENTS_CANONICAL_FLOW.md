# Execução — F-PJ-KYB-DOCUMENTS-CANONICAL-FLOW — code+frontend, sem migration

**Data:** 2026-06-06 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `8180a493` · **Decisão:** Clayton — fechar a tubulação documental (matar o circuito fantasma) antes de qualquer UI de upload · **Esteira:** eu (escritora); par verifica.

## Objetivo
Substituir o circuito documental fantasma (`company_documents`) pelo SSOT canônico (`fiscal_identity_documents`, DECISION-0087), matando os readers/admin legados que sobraram após o tombstone do upload.

## READ-FIRST (confirmado contra schema/código vivos)
1–5. `fiscal-identity-document.service.ts` (submit/list/review/supersede; `fileReference` OPACO, não mexe kyb_status) e as rotas canônicas `/identity/pj/kyb/*` **já existem e estão vivas**, **todas `requireRole(['admin'])`**. `fiscal_identity_documents` existe (CHECK type/status/final-audit; 0 linhas).
6. Rotas legadas vivas que liam o fantasma: `GET /:companyId/documents`, `GET /:companyId/documents/:docId/file`, `GET /admin/documents/pending`, `PATCH /admin/documents/:docId/status` → service `listCompanyDocuments`/`listPendingDocuments`/`updateDocumentStatus` (todos `FROM company_documents`, tabela **ausente** → dead-on-arrival).
7. Callers frontend: `CompanyValidationBackoffice` (chama pending+status no mount + linka o file-route), `api/companies.ts` (4 helpers), `CompaniesManager` (handler órfão `uploadCompanyDocument`). `listCompanyDocuments` (api) já não era importado.
8. UI viva de review = `CompanyValidationBackoffice` (rota `/validation`) — dead-on-arrival + carregava "aprovar documento = empresa validada".
9. Upload canônico existe mas é **admin** e usa `fileReference` opaco (sem pipeline de upload).
10. `uploads/companies` (storage local) era usado só pelo file-route legado (tombstonado).

## STOP reportados (não implementei)
- **Submit user-facing no wizard:** as rotas canônicas são **admin-only**; não há rota do dono da empresa (precisa `companyId→fiscal_identity_id` + `canManageCompany`) — **autoridade não decidida**. STOP.
- **Storage provider:** `fileReference` opaco, **sem pipeline de upload/download** (`DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING` OPEN). Sem ele, nem a porta do usuário nem a UI de revisão admin mostram/recebem arquivo real. STOP.
→ Por isso esta frente fez a metade **segura e completa** (matar o circuito fantasma) e **não** fingiu construir o upload do usuário.

## Implementação
- **Backend rotas** (`companies.routes.ts`): as 4 rotas legadas retornam **501 `PJ_LEGACY_COMPANY_DOCUMENTS_READERS_DISABLED`** como 1ª instrução (corpos legados removidos).
- **Backend serviço** (`companies.service.ts`): `listCompanyDocuments`/`listPendingDocuments`/`updateDocumentStatus` viram stubs que **throw** o mesmo código (defesa em profundidade; corpos ghost removidos, −215 linhas). `company_documents` agora só em comentário.
- **Frontend:** `CompanyValidationBackoffice.tsx` reescrito para mensagem honesta do estado canônico (sem chamar endpoints legados, sem file-link fantasma, sem anti-padrão de aprovação). `api/companies.ts`: os 4 helpers viram stubs que lançam (não constroem request legada).

## Prova
- **e2e** `validate-pipeline-e2e-pj-legacy-doc-readers-tombstone` **9/9** (C1–C4 rotas 501 via inject; C5–C7 serviços throw; C8 `company_documents` fantasma; C9 SSOT `fiscal_identity_documents` intocado).
- **Sem regressão:** cnpj 6/6 · lifecycle 7/7 · role 4/4 · vocab 7/7 · upload-tombstone 7/7.
- **tsc:** backend (escopo) e frontend **0** (2 `geo-enrichment` baseline).
- **4 gates:** actor-writer OK · bank-ledger OK · regression-guards OK (365) · arch `--strict` exit 0 (`critical_new=0`; `warning_new=1`=c3). **dev 365 (zero migration; zero Bank).**

## Não-toque confirmado
SSOT `fiscal_identity_documents` + writer/rotas canônicas (`fiscal-identity-document.service.ts`/`fiscal-identity-kyb.service.ts`/`identity.routes.ts`) — intocados. Bank · migration/schema · `company_status`/`kyb_status` (caminho legado não os movia; agora morto) · lifecycle/CNPJ/role/vocab · `actor_delegations` · presencial (`company_validation_requests`, DECISION-0096) · marketplace `fiscalDocumentRepository.updateDocumentStatus` (outro conceito).

## DTs
- `DT-PJ-LEGACY-COMPANY-DOCUMENTS-READERS-GHOST` → **CLOSED**.
- `DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING` → **OPEN** (gated por storage provider + autoridade user-facing).
- `DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING` → **OPEN** (pré-requisito material da UI canônica).

## Próximo passo recomendado
**Provider de storage** (fatia própria) — destrava tanto a porta do usuário quanto a UI de revisão admin sobre o SSOT. Depois: decisão de autoridade (quem submete no onboarding) + wizard documental canônico. Em paralelo, frentes não-documentais: delete guard via Bank port; KYB release gate financeiro.
