# Execução — F-PJ-KYB-DOCUMENTS-ADMIN-REVIEW-UI (DECISION-0112 §10 A2/A4) — backend, sem migration

**Data:** 2026-06-06 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `57a145ea` · **Decisão:** Clayton — primeiro o balcão de análise, depois o wizard · **Esteira:** eu (escritora); par verifica.

## Objetivo
Backend/admin review mínimo sobre o SSOT `fiscal_identity_documents`, com **download protegido** e **policy clean-only**, sem aprovar KYB.

## READ-FIRST (confirmado)
- Rotas admin de documento KYB **já existem** (`identity.routes`): submit, list-by-fiscal, **review** (accepted/rejected), supersede — todas `requireRole(['admin'])`. `reviewFiscalIdentityDocument` muda **só `document_status`** (NÃO `kyb_status`).
- SSOT service tinha submit/list/review/supersede; **faltavam** `getById` e `listPending`.
- **Faltava DOWNLOAD** (a rota de arquivo legada foi tombstonada). Sem `scan_status` persistido em `fiscal_identity_documents` (`mime_type`/`size_bytes` também ausentes). `DocumentStoragePort.readDocument` devolve buffer+mime+size+hash; policy `assertDocumentSafeToExpose`/`canExposeDocumentToHuman` prontas.
- **Sem STOP:** a ausência de scan persistido resolve-se **RE-ESCANEANDO no download** (não inventei coluna).

## Implementação (backend, code-only, sem migration)
- `fiscal-identity-document.service.ts` — `getFiscalIdentityDocumentById(documentId)` + `listPendingFiscalIdentityDocuments()` (status `submitted`, cross-fiscal). Leitura sobre o SSOT.
- `core/kyb-documents/kyb-document-download.service.ts` (novo) — `downloadKybDocument(documentId, {scanTenantId}, deps?)`: getById → `DocumentStoragePort.readDocument(file_reference)` (410 se ausente) → **valida hash** (read vs SSOT; 409 se divergir) → **RE-SCAN** `MalwareScanPort` → `canExposeDocumentToHuman` (422 se não-clean) → bytes. `deps` = test seam.
- `identity.routes.ts` — `GET /pj/kyb/documents/pending` (fila) + `GET /pj/kyb/documents/:documentId/file` (download → `reply.type(mime).send(buffer)`, sem path/URL). Ambas `requireRole(['admin'])`.
- **Review** = reuso do canônico `PATCH …/review` (sem rota nova).

## NÃO implementado (escopo travado)
frontend/admin UI (seria frente grande) · wizard user-facing · release gate · KYB approval · provider produção (storage/scanner) · migration · `company_status`/`kyb_status` · Bank · `company_documents` · PROVISIONAL→ACTIVE.

## Download: como prova clean (sem scan persistido)
**Re-escaneia na hora.** O `file_hash` do SSOT garante integridade (hash do conteúdo lido DEVE bater; senão 409). O scan é refeito a cada download via `MalwareScanPort`: **dev (Noop) → clean**; **produção sem scanner → fail-closed**. Documento legado/desconhecido recebe o mesmo tratamento — só passa se `clean` agora. Nenhuma confiança em "foi clean no submit".

## Prova
- **e2e** `validate-pipeline-e2e-pj-kyb-documents-admin-review` **13/13**: A1 fila · A2 fila usa `fiscal_identity_documents` · A3 getById · A4 download buffer+mime · A6 policy clean-only · **A7 hash divergente 409** · **A8 scan infected 422 sem expor** · A9 review accept (só document_status) · A10 review reject · **A11 kyb_status imóvel** · **A12 company_status imóvel** · A13 estrutural (download service sem kyb/company/Bank/company_documents/uploads; rotas admin-gated).
- **Sem regressão:** storage 17/17 · scan 12/12 · user-submit 19/19 · tombstones 7/7+9/9 · cnpj 6/6 · lifecycle 7/7 · role 4/4 · vocab 7/7.
- **tsc real** fora de geo = **0** (`grep "error TS" | grep -v geo-enrichment.service.ts`). 4 gates OK; arch `--strict` `critical_new=0`/`warning_new=1`=c3. **dev 365.**

## DTs
- `DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING` → **PARTIALLY MITIGATED** (submit + balcão backend; falta wizard/frontend + release gate).
- `DT-PJ-DOCUMENT-PRODUCTION-STORAGE-PROVIDER-MISSING` / `DT-PJ-DOCUMENT-PRODUCTION-MALWARE-SCANNER-MISSING` → OPEN (download real em prod gated por eles).

## Próximo passo recomendado
`F-PJ-KYB-RELEASE-GATE` (aprovar KYB com lastro documental — `reviewFiscalKybRequest` já exige cnpj_registration+articles_of_association `accepted`) **ou** `F-PJ-KYB-DOCUMENTS-WIZARD-FRONTEND` (etapa documental + UI de review). Paralelo seguro não-documental: `F-PJ-DELETE-GUARD-BANK-PORT`.
