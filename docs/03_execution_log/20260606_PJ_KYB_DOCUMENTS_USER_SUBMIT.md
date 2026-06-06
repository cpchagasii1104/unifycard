# Execução — F-PJ-KYB-DOCUMENTS-USER-SUBMIT (DECISION-0112 §10 A4) — backend, sem migration

**Data:** 2026-06-06 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `dec7057a` · **Decisão:** Clayton — primeiro autentica o humano, depois prova que ele manda na PJ · **Esteira:** eu (escritora); par verifica.

## Autoridade: STOP → veredito B (IA-DECISOES)
Antes de codar, STOP de autoridade material: o prompt #3 do Clayton instruía usar `req.actionContext.actorId`, mas o READ-FIRST achou que `action-context.middleware.ts` **não valida ownership** do actorId contra `req.user` (lê de header/body/query, fallback `body.actorId`, zero SELECT em actors) → **spoofável**. Escrevi PEDIDO bloqueante na memória da IA-DECISOES; Clayton ratificou **B**; IA-DECISOES confirmou **B como aplicação da norma vigente** (SSOT_REGISTRY §5.16/§5.1, AUTHORITY_PRECEDENCE, AUTHORITY_LAW §4.8/§4.9, DECISION-0112 §10 A4, 0088/0094) — **sem DECISION nova**. Autoria passa a ser **auth-derived**.

## Implementação (backend, code-only, sem migration)
- `core/kyb-documents/kyb-document-validation.ts` — `isKybMimeAllowed` (allowlist do storage) + `magicBytesMatchMime` (PDF `%PDF-` / JPEG `FF D8 FF` / PNG `89 50 4E 47 0D 0A 1A 0A`). Filename/extensão NÃO são autoridade.
- `core/kyb-documents/kyb-document-submit.service.ts` — `submitKybDocument(input, deps?)`. Ordem: **(1) autoria** `ensureUserActor(tenantId, req.user.userId)` (NÃO actionContext) → **(2)** `companyId → fiscal_identity_id` (404 se company ausente; 422 se fiscal NULL) → **(3) autoridade** `canManageCompany` (403; posse de companyId não basta) → **(4)** `document_type` válido (0087 §3.9) → **(5)** validar vazio/limite/MIME/magic → **(6)** `MalwareScanPort` clean-only (não-clean → 422, SEM store/SSOT) → **(7)** `DocumentStoragePort` privado → **(8)** `submitFiscalIdentityDocument` (grava `fiscal_identity_documents`, status `submitted`) → **(9)** resposta segura (sem path/URL). `deps` = test seam de DI (scanner/storage fake).
- `core/companies/companies.routes.ts` — `POST /:companyId/kyb/documents` (multipart → buffer; `documentType` por querystring/campo; mapeia `KybDocumentSubmitError.statusCode`). Autoria/autoridade do `req.user`.

## NÃO implementado (escopo travado)
frontend/wizard · admin review UI · download · KYB approval · release gate · provider produção (storage/scanner) · migration · `company_status`/`kyb_status` · Bank · `company_documents` · writer PROVISIONAL→ACTIVE · uso de `actionContext.actorId` como autoria.

## Prova
- **e2e** `validate-pipeline-e2e-pj-kyb-documents-user-submit` **19/19**: U1 submit válido grava SSOT (submitted) · U2 fiscal_identity_id da empresa · **U3 submitted_by_actor_id = ensureUserActor(userId) (auth-derived)** · U4 ref opaco · U5 hash sha256 · U6 magic incompatível 400 · U7 MIME não-allowlist 400 · U8 vazio · U9 limite · U10 filename `../` não controla path · **U11 scan infected → 422 SEM gravar** · **U12 sem autoridade → 403** · U13 company 404 · U14 fiscal ausente 422 · U15 company_status imóvel · U16 kyb_status imóvel · U17 estrutural (serviço sem actionContext, usa ensureUserActor, sem company_documents/Bank/status). create→assert→delete por empresa (robusto ao anti-fraude); cleanup DEV intacto.
- **Sem regressão:** storage-port 17/17 · scan-port 12/12 · upload-tombstone 7/7 · readers-tombstone 9/9 · cnpj 6/6 · lifecycle 7/7 · role 4/4 · vocab 7/7.
- **tsc:** backend (escopo) **0**. 4 gates OK; arch `--strict` exit 0 (`critical_new=0`; `warning_new=1`=c3). **dev 365.**

## DTs
- `DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING` → **PARTIALLY MITIGATED** (submit backend existe; falta wizard/frontend + admin review UI + providers de produção).
- Achado `DT-PJ-ACTIONCONTEXT-ACTOR-OWNERSHIP-UNVALIDATED` → registrado em `MINHA_MEMORIA_DT.md` (achado, NÃO DT oficial).
- `DT-PJ-DOCUMENT-PRODUCTION-STORAGE-PROVIDER-MISSING` / `DT-PJ-DOCUMENT-PRODUCTION-MALWARE-SCANNER-MISSING` → OPEN.

## Próximo passo recomendado
`F-PJ-KYB-DOCUMENTS-ADMIN-REVIEW-UI` (review admin sobre o SSOT + download protegido, atravessando a policy clean-only — gated pelos providers de produção) **ou** a etapa documental no **wizard** (frontend), conforme prioridade do Clayton. Paralelo seguro não-documental: `F-PJ-DELETE-GUARD-BANK-PORT`.
