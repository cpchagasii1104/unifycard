# Execução — Fase 3.3-B1 (isVerified payload compat / desacoplamento)

**Data:** 2026-06-04 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `a333de27` · **Frente:** `F-PJ-3.3-B1` · **Deriva de:** DECISION-0097 (D3) + DECISION-0093 §4.3

## Objetivo
Remover `companies.is_verified` / `isVerified` de código, payload e tipos no domínio companies, **sem dropar a coluna** (drop = B2) e **sem aliasar** para `isKybApproved` (DECISION-0093 §4.3 proíbe projetar is_verified de kyb_status).

## Prova normativa
Pilares: compat payload/API · verificação fiscal PJ (fronteira) · frontend (projeção) · schema vestigial intocado. SSOT: verificação PJ = `fiscal_identities.kyb_status`; lifecycle = `company_status` (preso no CHECK 3.3-A); operacional = `actors(id)`; financeiro = `bank_ledger` (fronteira negativa). NÃO-verificação: is_verified/isVerified/verifiedAt/company_status/frontend. Precedência: Constituição > Leis > SSOT Registry > DECISION-0097/0093 > código/runtime. DECISION-0093 §4.3 lida e confirmada (linhas 48-50: "is_verified não deve ser projetado para kyb_status").

## Arquivos alterados
- **Backend:** `companies.service.ts` (INSERT createCompany sem is_verified + var local removida; 5 row-types + 3 maps de payload limpos), `companies.types.ts` (campo `isVerified` fora do DTO `Company`), `core.service.ts` (SELECT `c.is_verified` + row-type + map removidos).
- **Frontend:** `api/companies.ts` (campo `isVerified` fora do tipo), `social/AuthorCard.tsx` (vestígio morto comentado removido).
- **Tests ajustados (compile):** `validate-pipeline-e2e-pj-updatecompany-no-status.ts` (asserção DTO isVerified → nível de banco), `validate-pipeline-e2e-pj-verification-display.ts` (bloco "compat preservado" marcado obsoleto + `void`).
- **Docs:** `REMEDIATION_DT_LOG.md`, `STATUS_EXECUCAO_GLOBAL.md`, `opus.md`, este execution log.
- **NÃO tocado:** coluna `companies.is_verified` (não dropada), nenhuma migration, schema, `fiscal_identities`, `kyb_status`, `companies.status`, Bank, KYB writer, social gate, profile progress, onboarding/vocabulário.

## Resultado / Provas
- Grep: zero `is_verified`/`isVerified` vivo no domínio companies (só comentário/JSDoc). `isKybApproved`/`kybStatus` intactos.
- Typecheck backend escopo **0** (2 `geo-enrichment.service.ts` = baseline pré-existente) + frontend **0**.
- e2e `validate-pipeline-e2e-pj-updatecompany-no-status` **6/6** (createCompany funciona sem is_verified; banco company_status=PROVISIONAL & is_verified=false; kyb read-model intacto; zero Bank).
- 4 gates: actor-writer OK · bank-ledger OK · regression PASSOU (356) · arch --strict exit 0 (critical_new=0; warning_new=1 = c3 pré-existente).

## Resíduo flagado (fora de B1)
`validate-pipeline-e2e-pj-verification-display.ts` insere `company_status='VERIFIED'` no setup → quebra em runtime pós-3.3-A (CHECK 23514). É teste da era pré-3.3; retirada/reescrita = fatia de higiene de testes própria (aqui só foi feito compilar).

## DT
`DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` → segue **PARTIALLY MITIGATED** (coluna `is_verified` órfã; B2 fecha).

## Próximo passo (sem execução)
**Fase 3.3-B2** (migration drop de `companies.is_verified` — zero deps de schema; fecha a DT) · ou higiene do teste display obsoleto · ou `F-PJ-OPERATIONAL-ACTIVATION-VOCAB-DECISION`.
