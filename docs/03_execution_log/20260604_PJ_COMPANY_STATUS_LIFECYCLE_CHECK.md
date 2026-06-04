# Execução — Fase 3.3-A (company_status preso no lifecycle / CHECK)

**Data:** 2026-06-04 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `0d866f16` · **Frente:** `F-PJ-3.3-A` · **Deriva de:** DECISION-0097 (D3/D4) + SELO_DECISION_0097_ONTOLOGY_FULL_READ

## Objetivo
Transformar `companies.company_status` em campo de lifecycle compatível e impedir valores fantasmas de verificação fiscal (`VERIFIED`/`APPROVED`) por CHECK, **sem tocar `is_verified`**, frontend, contrato, KYB writer ou Bank.

## Documentos lidos
18_DOMAIN_ONTOLOGY (full, conversa), DECISION-0097, SELO_DECISION_0097_ONTOLOGY_FULL_READ, CONSTITUICAO, LEIS (1–7), EMPRESA_NASCIMENTO_CANONICO, 02_ACTORS_SSOT, DT_LOG/STATUS/opus. Contrato `packages/contracts/src/company.ts` (CompanyStatus). Migration `0065` (origem company_status). Runner `src/core/db/migrate.ts`.

## Pilar / SSOT
Estado/lifecycle PJ + identidade/KYB como fronteira + schema compat. SSOT: verificação fiscal PJ = `fiscal_identities.kyb_status` (ÚNICO); `company_status` = projeção/compat lifecycle subordinada à DECISION-0097; NÃO-verificação: company_status/status/is_verified/verifiedAt/frontend. Precedência: Constituição > Leis > SSOT Registry > Ontologia > DECISION-0097 > código/runtime.

## Read-first material (psql + grep)
- companies=0 em `unificard_dev`; ghost VERIFIED/APPROVED=0; `verified_at` não existe; `is_verified` existe (fora de escopo).
- `company_status` sem CHECK, default 'ACTIVE'; `status` com `chk_companies_status` (active/inactive/suspended/closed).
- Contrato `CompanyStatus` = DRAFT/PROVISIONAL/VERIFIED(@deprecated)/APPROVED(@deprecated)/SUSPENDED.
- Re-confirmado: ZERO writer vivo de `company_status='VERIFIED'/'APPROVED'` (só comentário/JSDoc); ZERO reader decisório vivo.
- Conjunto lifecycle vivo escolhido (menor compat): **DRAFT, PROVISIONAL, ACTIVE, SUSPENDED** (default da coluna 'ACTIVE' incluído). BLOCKED/CLOSED/REJECTED fora (não vivos).

## Arquivos alterados
- **Criado:** `backend/migrations/20260604120000_constrain_company_status_lifecycle.sql` (forward-only, transacional, idempotente, fail-closed).
- **Criado:** `backend/src/scripts/validate-pipeline-e2e-pj-company-status-lifecycle.ts` (teste efêmero, guard anti-dev).
- **Criado:** `scripts/run-pj-company-status-lifecycle-ephemeral.ps1` (orquestrador efêmero).
- **Criado:** este execution log.
- **Editado:** `REMEDIATION_DT_LOG.md` (SECOND-TRUTH → PARTIALLY MITIGATED), `STATUS_EXECUCAO_GLOBAL.md`, `opus.md`.

## Resultado / Provas
- Migration aplicada via runner canônico em `unificard_dev` (356 migrations). CHECK `chk_companies_company_status_lifecycle` = `company_status IS NULL OR IN (DRAFT,PROVISIONAL,ACTIVE,SUSPENDED)`. `chk_companies_status` intocado.
- E2E `validate-pipeline-e2e-pj-company-status-lifecycle` **13/13** verde (DB efêmera): permite lifecycle; bloqueia VERIFIED/APPROVED/desconhecido (23514); normalização VERIFIED→ACTIVE; kyb_status intacto; is_verified intocado.
- Typecheck backend escopo **0** (2 `geo-enrichment.service.ts` = baseline pré-existente).

## Gates
actor-writer OK · bank-ledger OK · regression PASSOU (356) · arch --strict exit 0 (critical_new=0; warning_new=1 = c3 pré-existente).

## Não-toque confirmado
frontend · contrato/payload · `is_verified` · `fiscal_identities`/`kyb_status` · `companies.status` · Bank · KYB writer · social gate · profile progress · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo (sem execução)
Fase 3.3-B (`is_verified` compat/drop após migrar consumidores → `isKybApproved`); ou `F-PJ-OPERATIONAL-ACTIVATION-VOCAB-DECISION`; ou onboarding domain-selection.
