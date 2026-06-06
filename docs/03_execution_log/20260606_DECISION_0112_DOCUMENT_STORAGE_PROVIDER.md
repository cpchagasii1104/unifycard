# Execução — D-PJ-DOCUMENT-STORAGE-PROVIDER (DECISION-0112) — docs-only / design-first

**Data:** 2026-06-06 · **Modo:** EXECUTOR CONTROLADO (docs-only) · **Branch:** `rescue-structural`
**HEAD antes:** `81fd4d8e` · **Decisão:** Clayton — storage documental antes de qualquer wizard · **Esteira:** eu (escritora); par verifica.

## Objetivo
Promulgar (docs-only) o desenho canônico do **provider de storage documental KYB/PJ** — o gargalo real que deixou `F-PJ-KYB-DOCUMENTS-CANONICAL-FLOW` PARTIAL/STOPPED. Sem código.

## READ-FIRST (material, READ-ONLY)
- SSOT `fiscal_identity_documents` vivo (mig `20260603140000`), `file_reference` OPACO + `file_hash`; writer/gate KYB vivos; **nenhum provider real**.
- **Achado central de segurança:** `app.builder.ts` registra `@fastify/static` com `root=process.cwd()/uploads`, `prefix='/uploads/'` — **`uploads/` é público sem auth**. O caminho legado `/uploads/companies/...` era **baixável por URL** (vazamento). `media`=placeholder fake (`storage.example.com`); `group-image`=imagem local — nenhum é provider de documento legal.
- **Arquivo bruto NÃO entra no banco** (sem colunas blob/base64/bytea; e2e F2-B confirma). Invariante mantido.
- `fiscal_identity_documents` **não tem** `mime_type`/`size_bytes` → adição futura (não agora).
- `COMPLIANCE_REGULATORIO_UNIFYBANK` já marca "Armazenamento de documentos ❌ — sem gestão documental probatória".
- `DECISION-0112` livre. Precedente de port: `pix-provider.interface.ts`.

## STOP / disciplina aplicada
- **Nenhum STOP duro:** provider não existe (não assumir), sem migration imediata, sem conflito com 0087.
- **STOP#5 do envelope respeitado:** itens dependentes de **produto** NÃO promulgados como técnica — listados como perguntas (§7 da DECISION): provider de produção; antivírus no MVP; retenção; porta de submit (dono vs admin). A **arquitetura** (D1–D13) é promulgada; os **parâmetros** ficam abertos.

## Entregável
`docs/02_decisions/DECISION_0112_PJ_DOCUMENT_STORAGE_PROVIDER.md` — D1–D13 técnicos + §7 parâmetros de produto (não promulgados) + plano de execução futuro (`F-PJ-DOCUMENT-STORAGE-PORT` → `USER-SUBMIT` → `ADMIN-REVIEW-UI` → `KYB-RELEASE-GATE`). Invariantes: `file_reference` opaco (nunca `/uploads/` público), arquivo bruto fora do banco, provider por PORT, prod fail-closed, autoridade de submit/download separada e auditada, documento não verifica empresa, retenção/segurança/auditoria.

## Prova
- **docs-only** — runtime intocado. 4 gates: actor-writer / bank-ledger / regression-guards OK (365); arch `--strict` exit 0 (`critical_new=0`; `warning_new=1`=c3). **Migrations 365→365.**

## Não-toque confirmado
Código/runtime · migration · Bank · `fiscal_identity_documents`/SSOT · provider/upload/download/wizard/endpoint · `company_documents` (não recriar) · parâmetros de produto (não promulgados).

## DTs
- `DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING` → **GOVERNED/DECIDED** (desenho cravado; OPEN até `F-PJ-DOCUMENT-STORAGE-PORT`).
- `DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING` → **OPEN**.

## Próximo passo
Clayton responde os 4 parâmetros de produto (§7) → `F-PJ-DOCUMENT-STORAGE-PORT` (port + provider local-dev privado, fail-closed; eventual `mime_type`/`size_bytes`). Só depois upload/UI. Eixos paralelos não-documentais: delete-guard via Bank port; KYB release gate.
