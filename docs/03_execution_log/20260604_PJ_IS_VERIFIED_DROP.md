# Execução — Fase 3.3-B2 (drop de companies.is_verified)

**Data:** 2026-06-04 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `f1e7d811` · **Frente:** `F-PJ-3.3-B2` · **Deriva de:** DECISION-0097 (D3/D4) + DECISION-0093 §4.3

## Objetivo
Remover fisicamente a coluna vestigial `companies.is_verified` (após a 3.3-B1 já ter removido `isVerified` de payload/código/tipos), fechando a `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH`. Sem alias, sem tocar runtime além de ajustar scripts.

## Prova normativa
Pilares: schema PJ · remoção de compat vestigial · verificação fiscal (fronteira) · lifecycle (fronteira). SSOT: verificação PJ = `fiscal_identities.kyb_status`; lifecycle = `company_status` (CHECK 3.3-A); operacional = `actors(id)`; financeiro = `bank_ledger` (fronteira negativa). NÃO-verificação: is_verified/isVerified/verifiedAt/company_status/frontend. Precedência: Constituição > Leis > SSOT Registry > DECISION-0097/0093 > código/runtime. DECISION-0093 §4.3: drop, não alias.

## Read-first material (psql)
`companies.is_verified` existe (boolean, nullable, default false); **zero deps de schema** (sem índice/constraint/view/trigger); `verified_at` ausente; CHECK `chk_companies_company_status_lifecycle` existe; `fiscal_identities.kyb_status` existe. → drop seguro.

## Arquivos alterados
- **Migration (criada):** `backend/migrations/20260604130000_drop_companies_is_verified.sql` (`ALTER TABLE companies DROP COLUMN IF EXISTS is_verified`; forward-only/transacional/idempotente).
- **Teste (criado):** `backend/src/scripts/validate-pipeline-e2e-pj-is-verified-drop.ts` + orquestrador `scripts/run-pj-is-verified-drop-ephemeral.ps1`.
- **Scripts ajustados (SQL sem is_verified):** `validate-pipeline-e2e-atomic-company-birth.ts`, `validate-pipeline-e2e-company.ts`, `validate-pipeline-e2e-pj-adminoverride-disabled.ts`, `validate-pipeline-e2e-pj-capability-kyb.ts`, `validate-pipeline-e2e-pj-inperson-disabled.ts`, `validate-pipeline-e2e-pj-social-kyb-gate.ts`, `validate-pipeline-e2e-pj-updatecompany-no-status.ts`, `validate-pipeline-e2e-pj-company-status-lifecycle.ts` (check-8 invertido p/ ausência).
- **Docs:** `REMEDIATION_DT_LOG.md` (DT → CLOSED), `STATUS_EXECUCAO_GLOBAL.md`, `opus.md`, este execution log.
- **NÃO tocado:** frontend (zero), `companies.status`, `company_status` (CHECK 3.3-A intacto), `fiscal_identities`, `kyb_status`, Bank, KYB writer, social gate, profile progress, onboarding/vocabulário. `validate-pipeline-e2e-pj-verification-display.ts` (obsoleto, deixado — flagado).

## Resultado / Provas
- Migration aplicada (357 migrations). `companies.is_verified` AUSENTE em `unificard_dev`. CHECK lifecycle + kyb_status intactos.
- `validate-pipeline-e2e-pj-is-verified-drop` **7/7** (coluna ausente; verified_at ausente; kyb_status intacto; CHECK existe; INSERT sem is_verified OK; INSERT com is_verified FALHA 42703; VERIFIED bloqueado 23514).
- Re-rodados pós-drop: `updatecompany-no-status` **6/6**, `company-status-lifecycle` **13/13**.
- Typecheck backend escopo **0** (2 `geo-enrichment` baseline). Frontend não tocado.
- 4 gates: actor-writer OK · bank-ledger OK · regression PASSOU (357) · arch --strict exit 0 (critical_new=0; warning_new=1 = c3 pré-existente).

## DT
`DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` → **CLOSED**. 2ª-verdade fiscal PJ materialmente extinta. Resíduo só cosmético (VERIFIED/APPROVED @deprecated no tipo, bloqueados por CHECK).

## Resíduo flagado (fora de B2)
`validate-pipeline-e2e-pj-verification-display.ts` obsoleto (insere company_status='VERIFIED' → runtime-broken pós-3.3-A; referencia is_verified dropado). Retirada/reescrita = fatia de higiene de testes própria.

## Próximo passo (sem execução)
(1) Higiene do teste `verification-display` obsoleto; ou (2) `F-PJ-OPERATIONAL-ACTIVATION-VOCAB-DECISION` (businessType×businessCategory×hybrid×par primary_*).
