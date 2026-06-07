# Execução — F-PJ-KYB-DOCUMENTS-WIZARD-FRONTEND (DECISION-0112 §10 / 0087) — frontend-only

**Data:** 2026-06-07 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**Decisão:** Clayton — conectar o onboarding ao backend KYB já pronto (a pessoa precisa poder enviar o documento). **Esteira:** eu (escritora); par verifica READ-ONLY.

## Objetivo
Tornar usável pela pessoa o eixo documental KYB cujo **backend já estava completo** (substrato → submit → fila → download protegido → review → release-gate): adicionar a etapa de envio documental no `CompanyOnboardingWizard`, batendo na **rota canônica**, sem que o frontend crie verdade.

## READ-FIRST (confirmado)
- Rota viva canônica: `POST /companies/:companyId/kyb/documents` (`companies.routes.ts:437`) — multipart; lê `documentType` de `req.query.documentType` (ou campo multipart); resolve autoria por `req.user.userId → ensureUserActor` (opção B, NÃO `actionContext.actorId`) + autoridade `canManageCompany`; valida MIME/magic, scan clean-only, storage privado, grava `fiscal_identity_documents` (status `submitted`); retorna `201 { ok:true, data:{ documentId, documentType, documentStatus, mimeType, sizeBytes } }`. **NÃO** toca `company_status`/`kyb_status`/Bank.
- `apiFetch` (`api/client.ts`) devolve `Promise<Response>` (não lança em não-2xx; trata FormData pulando Content-Type). O caller precisa checar `response.ok`/`json.ok`.
- Clients legados de documento de empresa (`uploadCompanyDocument`/`listCompanyDocuments`/`listPendingDocuments`/`updateDocumentStatus`, `api/companies.ts`) já eram **stubs tombstone que LANÇAM** (`PJ_LEGACY_COMPANY_DOCUMENTS_DISABLED`), mas ainda havia **caller órfão vivo**: `CompaniesManager.tsx:handleUploadDocument` → `uploadCompanyDocument(companyId, file)`.
- Substrato é `fiscal_identity_documents` (DECISION-0087); `company_documents` é **fantasma**. Tabela não recriada.

## Implementação (frontend-only)
1. **Client canônico** `submitCompanyKybDocument(companyId, documentType, file)` (`frontend/src/api/companies.ts`): monta `FormData` com `file`, chama `POST /companies/:companyId/kyb/documents?documentType=…`, checa `response.ok`/`json.ok`, devolve `data`. Frontend só anexa o arquivo — **não** envia `actorId`/`kyb_status`/`company_status`.
2. **Etapa documental no wizard** (`CompanyOnboardingWizard.tsx`): `TOTAL_STEPS` 5→6; const `KYB_REQUIRED_DOCS` (`cnpj_registration` = Cartão/Comprovante CNPJ; `articles_of_association` = Contrato social/ato constitutivo); estado visual `kybUploading`/`kybSent`/`kybErrors` (NÃO é fonte de verdade — SSOT é o backend); handler `handleKybDocUpload`; **Etapa 5 "Documentos de verificação (KYB)"** com 1 input por doc (`accept .pdf/.jpg/.jpeg/.png`), cópia honesta, sucesso = "✅ Enviado — aguardando análise"; resumo renumerado para Etapa 6 + item "Documentos (KYB)". **Etapa OPCIONAL** — `handleNext` não valida o passo 5; copy diz "Você pode continuar e enviar depois" (obrigatoriedade no finalize é decisão de produto não tomada — STOP respeitado).
3. **Limpeza do legado órfão** (envelope #2 — "remover/impedir qualquer uso de client legado"): removidos `handleUploadDocument`/`handleFileInputChange` de `CompaniesManager.tsx`, o import `uploadCompanyDocument`, a desestruturação `uploadingCompanyId`/`setUploadingCompanyId` e os props passados ao form; removidos `uploadingCompanyId`/`handleFileInputChange` da interface + desestruturação de `CompaniesManagerForm.tsx`. Os clients legados seguem como stubs que LANÇAM, **sem nenhum consumidor vivo** (grep limpo).
4. **CSS** (`CompanyOnboardingWizard.css`): estilos `.kyb-docs-list/.kyb-doc-slot/.kyb-doc-info/.kyb-doc-upload/.kyb-doc-status.kyb-doc-sent`.

## Disciplina (frontend nunca cria verdade)
Frontend só **projeta** o veredito do backend: não monta `submittedByActorId`, não envia `actorId`/`actionContext.actorId`/`kyb_status`/`company_status`, não chama endpoint legado, não exibe "Empresa aprovada". O upload **não aprova KYB** — só registra documento `submitted`.

## O que NÃO foi feito (escopo)
Backend service/runtime · migration · Bank · aprovação KYB · UI admin de review · download por humano · provider de produção (storage/scanner) · `company_status`/`kyb_status` · `company_documents` · endpoint legado · obrigatoriedade da etapa no finalize (produto).

## Prova
- **Frontend tsc** `tsc --noEmit` = **0**.
- **Backend route inalterada, re-provada:** `validate-pipeline-e2e-pj-kyb-documents-user-submit` **19/19** (autoria auth-derived, autoridade 403, fiscal-missing 422, company 404, magic/MIME/vazio/limite, scan-infected não-grava, lifecycle/kyb imóveis, estrutural sem actionContext/ghost/Bank).
- **4 gates OK:** actor-writer OK; bank-ledger OK; regression-guards (365 migrations, numeração única); arch `--strict` `critical_new=0`/`warning_new=1`=c3 (baseline).
- **dev 365** (zero migration); **zero Bank**; **zero backend runtime** tocado.

## DTs
- `DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING` → **CLOSED** (assunto literal resolvido: a coleta documental KYB vive no onboarding, canônica). Resíduos = DTs próprias (não reabrem esta): UI admin de review (frontend nicety); `DT-PJ-DOCUMENT-PRODUCTION-STORAGE-PROVIDER-MISSING` / `DT-PJ-DOCUMENT-PRODUCTION-MALWARE-SCANNER-MISSING` (OPEN); obrigatoriedade da etapa = produto.

## Próximo passo recomendado
Providers de **PRODUÇÃO** (storage/scanner) para download real, **ou** UI admin de review (balcão no frontend), **ou** `F-PJ-DELETE-GUARD-BANK-PORT` (paralelo seguro). O eixo KYB documental PJ — **backend completo + coleta no onboarding** — está fechado.
