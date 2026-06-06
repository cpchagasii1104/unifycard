# Execução — F-PJ-DOCUMENT-STORAGE-PORT (DECISION-0112) — backend, sem migration

**Data:** 2026-06-06 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `a312174a` · **Decisão:** Clayton — substrato técnico mínimo de storage documental seguro (1ª fatia do Pilar 1 KYB) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Substrato técnico mínimo e seguro de storage documental KYB — port + provider local-dev privado — destravando (sem ainda implementar) o fluxo documental. **Não** é upload/wizard/review/KYB approval/Bank.

## READ-FIRST (confirmado)
- HEAD `a312174a`, tree limpo (3 autorais + `docs/memorias/` quarentena, nada staged).
- DECISION-0112 + ADENDO §10 verificados. `/uploads/` é `@fastify/static` público (`app.builder.ts:224-230`) → documento KYB jamais ali.
- `fiscal_identity_documents` tem `file_reference`/`file_hash`; **não** tem `mime_type`/`size_bytes` (adição futura — não fingida).
- **Greenfield:** nenhum port/provider de documento existente. `media`=placeholder fake, `group-image`=imagem local — não-canônicos. Precedente de port: `pix-provider.interface`; resolução por env: `pix.service` (`process.env.PIX_PROVIDER`). Prod fail-closed: `NODE_ENV==='production'`.

## Implementação (backend, code-only, sem migration)
- `core/document-storage/document-storage.types.ts` — `StoreDocumentInput`/`StoredDocument`/`ReadDocumentResult`, allowlist MIME (`application/pdf`,`image/jpeg`,`image/png`), `MAX_BYTES=10MB`, `DocumentStorageError` + códigos fail-closed.
- `document-storage.port.ts` — interface `DocumentStoragePort` (`storeDocument`/`readDocument`).
- `local-private-document-storage.provider.ts` — provider **dev** privado: grava em `<cwd>/.private/document-storage` (FORA de `/uploads`; guard recusa baseDir sob uploads); `file_reference` OPACO (32 hex via `randomUUID`, não-path, não-derivado-de-filename); SHA-256; valida MIME/tamanho/não-vazio; sidecar `.meta.json` (mime/size/hash/tenant); `readDocument` valida ref opaco (regex + within-dir anti-traversal); filename do usuário sanitizado só p/ registro, nunca path.
- `document-storage.provider.ts` — factory `resolveDocumentStorageProvider`: dev→Local; **produção sem provider explícito = fail-closed** (`DOCUMENT_STORAGE_PROVIDER_REQUIRED`; `local` proibido em prod; provider desconhecido → `NOT_IMPLEMENTED`). Sem fallback silencioso para local/público.
- `.gitignore` — `backend/.private/` + `.private/` (documento sensível nunca versionado).

## NÃO implementado (escopo travado)
upload user-facing · endpoint multipart · wizard · download/review admin · **MalwareScanPort** (frente própria — nenhum seam foi inevitável) · provider produção real (S3/GCS/MinIO) · KYB approval · release financeiro · delete guard · writer PROVISIONAL→ACTIVE · migration · alteração de `company_status`/`kyb_status` · `fiscal_identity_documents` · Bank · `company_documents`.

## Prova
- **e2e** `validate-pipeline-e2e-pj-document-storage-port` **17/17** (store em dir privado fora de /uploads; ref opaco; SHA-256/mime/size batem; MIME fora da allowlist/vazio/acima-do-limite rejeitados; filename `../` não controla path; read recupera; ref inválido/inexistente fail-closed; **produção sem provider = fail-closed**; factory dev→Local; **estrutural: fontes do port não tocam DB/Bank/SSOT/lifecycle**). DB-free; cleanup do dir privado.
- **Sem regressão:** upload-tombstone 7/7 · readers-tombstone 9/9 · cnpj 6/6 · lifecycle 7/7 · role 4/4 · vocab 7/7.
- **tsc:** backend (escopo) **0** (2 `geo-enrichment` baseline). 
- **4 gates:** actor-writer OK · bank-ledger OK · regression-guards OK (365) · arch `--strict` exit 0 (`critical_new=0`; `warning_new=1`=c3). **dev 365 (zero migration; zero Bank).**

## Diretório privado / fail-closed
- Storage local-dev: `<cwd>/.private/document-storage` (override `DOCUMENT_STORAGE_LOCAL_DIR`). **Nunca** servido por Fastify static; gitignored.
- Fail-closed prod: `NODE_ENV=production` sem `DOCUMENT_STORAGE_PROVIDER` (ou `=local`) → erro `DOCUMENT_STORAGE_PROVIDER_REQUIRED`; provider real não implementado → `NOT_IMPLEMENTED`. Nunca cai para local/público em produção.

## DTs
- `DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING` → **PARTIALLY MITIGATED** (port + provider local-dev + fail-closed vivos; resta produção + wiring).
- `DT-PJ-DOCUMENT-PRODUCTION-STORAGE-PROVIDER-MISSING` → **OPEN** (nova; provider de produção real ausente — prod fail-closed por ora).
- `DT-PJ-DOCUMENT-MALWARE-SCAN-MISSING` → OPEN · `DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING` → OPEN.

## Próximo passo recomendado
`F-PJ-DOCUMENT-MALWARE-SCAN-PORT` (MalwareScanPort + Noop dev + quarantine), antes de qualquer download humano de documento real. Depois: `F-PJ-KYB-DOCUMENTS-USER-SUBMIT`. Em paralelo seguro (não-documental): `F-PJ-DELETE-GUARD-BANK-PORT`.
