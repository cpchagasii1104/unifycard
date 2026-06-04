# Execução — Higiene de teste: verification-display alinhado ao kyb_status SSOT

**Data:** 2026-06-04 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `d104e647` · **Frente:** `F-PJ-TEST-HYGIENE`

## Objetivo
Higienizar o teste obsoleto `validate-pipeline-e2e-pj-verification-display.ts`, que representava a era pré-3.3 (inseria `company_status='VERIFIED'` + `is_verified`, ambos inválidos pós-3.3-A/B2). Sem tocar runtime de produto/schema/migration.

## Prova normativa
Pilar: teste/evidência de verificação fiscal PJ. SSOT: verificação fiscal PJ = `fiscal_identities.kyb_status`. NÃO-verificação: company_status/is_verified/isVerified/verifiedAt/frontend. Pós-3.3: company_status lifecycle-only; is_verified dropado; **sem alias** isVerified←kyb_status. Precedência: Constituição > Leis > SSOT Registry > DECISION-0097/0093 > código/runtime.

## Decisão: OPÇÃO A (reescrever, não remover)
Justificativa: o teste prova um invariante VIVO e valioso — o read-model (`listCompanies`/`getCompanyById`) deriva `kybStatus`/`isKybApproved` de `fiscal_identities.kyb_status` e IGNORA `company_status`/`isVerified` (DECISION-0089 Fase 1). Esse caminho NÃO é coberto pelos testes B1/B2 (que provam schema/payload). O script tem orquestrador próprio (`run-pj-verification-display-ephemeral.ps1`) e NÃO está em gate obrigatório. Logo: reescrever, não deletar.

## O que mudou (só o teste)
- `seedCompany`: removido param/coluna `is_verified` do INSERT.
- Casos "VERIFIED+pending"/"no_fiscal" → `company_status='ACTIVE'` (lifecycle válido) + kyb pending (em vez de 'VERIFIED' bloqueado).
- Var `idVerifiedButPending` → `idActiveButPending`.
- Removido bloco morto "compat preservado" (Fase 3.3-B1) + `void v; void nf; void a;` (v/nf/a são usados nos checks 1/2/3).
- JSDoc/labels atualizados (display ignora lifecycle; pós-3.3 company_status lifecycle-only, is_verified dropado).
- Semântica melhor: prova que o display ignora QUALQUER company_status (usa 'ACTIVE'), não só 'VERIFIED'.

## Arquivos alterados
- `backend/src/scripts/validate-pipeline-e2e-pj-verification-display.ts` (reescrito).
- Docs: `STATUS_EXECUCAO_GLOBAL.md`, `opus.md`, `REMEDIATION_DT_LOG.md` (nota de resíduo resolvido, DT segue CLOSED), este execution log.
- NÃO tocado: runtime companies (service/routes/types), schema, migrations, frontend, Bank, KYB writer, social gate, profile progress, onboarding/vocabulário, domínios alheios.

## Provas
- Teste reescrito **7/7** (DB efêmera, guard anti-dev): approved→isKybApproved=true; ACTIVE+kyb pending→false (ignora lifecycle); sem fiscal→false; rejected→false; getCompanyById idêntico; zero Bank.
- Grep: única menção a VERIFIED no script é comentário; zero is_verified.
- Typecheck backend escopo **0** (2 `geo-enrichment` baseline); frontend não tocado.
- Re-rodado `is-verified-drop` **7/7**.
- 4 gates: actor-writer OK · bank-ledger OK · regression PASSOU (357) · arch --strict exit 0 (warning_new=1 = c3 pré-existente).

## DT
`DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` permanece **CLOSED** (não reaberta). O resíduo de teste flagado na B2 está RESOLVIDO.

## Próximo passo (sem execução)
`F-PJ-OPERATIONAL-ACTIVATION-VOCAB-DECISION` em modo READ-ONLY primeiro (blast radius de businessType×businessCategory×hybrid×par primary_company_type_id/primary_concept_id).
