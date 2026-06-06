# Execution Log — F-PJ-LEGACY-DOC-UPLOAD-TOMBSTONE

**Data:** 2026-06-06
**Modo:** EXECUTOR CONTROLADO (esteira: eu escritora; par verifica READ-ONLY; Clayton serializa)
**Branch:** `rescue-structural` · **HEAD origem:** `21a6aa18`
**Frente:** `F-PJ-LEGACY-DOC-UPLOAD-TOMBSTONE`
**Norma-mãe:** DECISION-0087 (`fiscal_identity_documents` = SSOT documental KYB)

---

## Objetivo
Neutralizar o upload legado de documento PJ que gravava em `company_documents` (caminho não-SSOT), porque o SSOT documental KYB decidido é `fiscal_identity_documents` (DECISION-0087). Code-only; sem migration/Bank/KYB approval; sem wizard documental novo; sem writer canônico novo.

## READ-FIRST (achados material)
1. **Rota:** `POST /companies/:companyId/documents` (`companies.routes.ts:410`) → `companiesService.uploadCompanyDocument` (`companies.service.ts:2060`). Storage de arquivo é **local** (`uploads/companies/`), não externo.
2. **Tabela destino:** `company_documents` (legado), **não** `fiscal_identity_documents`.
3. **`company_documents` NÃO EXISTE** no schema vivo (`to_regclass` = null) **nem há migration** que a crie (grep vazio). A tabela é **fantasma**.
4. **Promoção:** `uploadCompanyDocument` promovia `company_status` **depois** do INSERT — como o INSERT na tabela fantasma falha primeiro, a promoção **nunca rodava**. Risco de SSOT paralelo = **zero** (não dá pra gravar em tabela inexistente); o que havia era **erro de runtime opaco**.
5. **Caller frontend:** `CompaniesManager.tsx:456` (`handleUploadDocument` → `uploadCompanyDocument` API), botão "Enviar comprovante" em `CompaniesManagerForm.tsx`.
6/7. **Canônico já existe:** writer `fiscal-identity-document.service.ts` + rota `identity.routes.ts` + e2e `validate-pipeline-e2e-pj-kyb-documents.ts`. `fiscal_identity_documents` existe (0 linhas).
8/9. Não redirecionei para o canônico (fora do escopo); storage local não tocado.

**Nenhum critério de STOP disparado:** o endpoint não usa o SSOT; não há dependência *viva* (tabela inexistente); o tombstone não quebra fluxo que funcione (já estava quebrado); não exige migration/storage. É o caso "erro runtime" que o próprio envelope previu.

## Implementação
- **Rota** (`companies.routes.ts`): retorna **501 `PJ_LEGACY_COMPANY_DOCUMENT_UPLOAD_DISABLED`** como **1ª instrução** (antes de auth/arquivo/disco/service), com mensagem honesta apontando o fluxo fiscal. Corpo legado removido.
- **Serviço** (`companies.service.ts`): `uploadCompanyDocument` faz **throw** do mesmo código como **1ª instrução** (defesa em profundidade — impede escrita mesmo se chamado direto). Corpo legado removido.
- **Decisão sobre dead code:** tentei deixar o legado inalcançável (early return/throw), mas o TS perde o narrowing dos guards e gera erros de tipo no bloco morto. Removi o corpo legado limpo — **o histórico fica preservado em git** (não é "apagar histórico" no sentido de dados/auditoria).
- **Frontend** (`CompaniesManagerForm.tsx`): botão/input "Enviar comprovante" trocado por nota "📄 Documentos KYB serão enviados pelo fluxo documental fiscal."

## Provas (e2e 7/7)
`validate-pipeline-e2e-pj-legacy-doc-upload-tombstone.ts`:
- **T1** rota `POST /companies/:id/documents` → 501 `PJ_LEGACY_COMPANY_DOCUMENT_UPLOAD_DISABLED` (via `fastify.inject`; `requireRole` stubbed só p/ registrar o plugin).
- **T2** `uploadCompanyDocument` → throw `PJ_LEGACY_COMPANY_DOCUMENT_UPLOAD_DISABLED`.
- **T3** `company_status` segue `DRAFT` (não promovido). **T4** `kyb_status` inalterado. **T5** `fiscal_identity_documents` intocado. **T6** `company_documents` fantasma (`to_regclass` null).
- Regressão: cnpj 6/6 · lifecycle 7/7 · role-projection 4/4 · vocabulary 7/7.
- tsc backend+frontend 0 (escopo; 2 `geo-enrichment` baseline). 4 gates OK; arch `--strict` `critical_new=0` `warning_new=1` (c3). dev 365.

## DTs
- `DT-PJ-LEGACY-COMPANY-DOCUMENT-UPLOAD-USES-NON-SSOT` → **CLOSED** (upload tombstoned).
- `DT-PJ-LEGACY-COMPANY-DOCUMENTS-READERS-GHOST` → **OPEN** (achado: list/get/admin-validate ainda no fantasma).
- `DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING` → **OPEN** (fluxo canônico ainda não no wizard).

## Não-toque
Bank/`bank_*`/escrow/payment; migration/schema; `fiscal_identity_documents` (só leitura/checagem); lifecycle/CNPJ/role/vocabulary (regressões verdes); storage local; o flag `SERVICE_FINANCIAL_RUNTIME_ENABLED`.

## Próximo
Writer/UX canônico de `fiscal_identity_documents` (etapa documental KYB no wizard + migração dos leitores/backoffice legados para o SSOT 0087).
