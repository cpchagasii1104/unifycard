# Execução — F-PJ-KYB-RELEASE-GATE (DECISION-0112 §3.10 / 0087 / 0088) — backend, PROVA-ONLY

**Data:** 2026-06-07 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `ddb4a0e5` · **Decisão:** Clayton — fechar o motor (release gate) antes de pintar o painel (wizard) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Garantir/provar que uma fiscal identity/PJ só vai para `kyb_status='approved'` quando os documentos mínimos obrigatórios estão **aceitos** no SSOT documental.

## READ-FIRST (confirmado)
- `fiscalIdentityKybService.reviewFiscalKybRequest('approved')` **já existe** e **já aplica o gate** (DECISION-0087 §3.10): exige `cnpj_registration` + `articles_of_association` ambos `document_status='accepted'` na mesma `fiscal_identity_id`; falta qualquer um → `KYB_APPROVAL_REQUIRES_DOCUMENTS` + **rollback total** (request e `kyb_status` seguem `pending`).
- Aprovação é **atômica**: UPDATE da request + `UPDATE fiscal_identities SET kyb_status` na mesma tx. **NÃO** toca `companies.company_status` (comentário l.14 + grep: kyb service só lê `companies` no revoke). **NÃO** toca Bank.
- `reject` não exige docs. `submitFiscalKybRequest` exige `kyb_status='pending'` (one-pending unique).
- `revokeFiscalKybApproval` (approved→suspended/closed + cascata de publicações) **EXISTE** — `DT-PJ-KYB-APPROVED-REVOCATION-WRITER-MISSING` já **CLOSED** (2026-06-05).
- `fiscal_identities` nasce `kyb_status='pending'` (createCompany l.504).
- **Conclusão:** o gate está completo. Esta fatia **NÃO reescreve** — **PROVA** com e2e e confirma invariantes. Nenhum STOP.

## Implementação
- **Nenhuma mudança de service/runtime.** Apenas o e2e `validate-pipeline-e2e-pj-kyb-release-gate.ts` (novo) + docs. Setup do e2e usa `submitFiscalIdentityDocument` (fileReference dummy) + `reviewFiscalIdentityDocument('accepted')` para preparar o lastro — testa o **gate de status**, não o pipeline de arquivo (já coberto).

## Gate de docs mínimos aplicado (confirmado)
`approved` ⇔ existe `cnpj_registration` **accepted** E `articles_of_association` **accepted** para a `fiscal_identity_id`. Caso contrário, fail-closed (sem transição). `submitted`/`rejected` não contam; docs de outra fiscal não contam.

## Prova
- **e2e** `validate-pipeline-e2e-pj-kyb-release-gate` **10/10**: R1 0 docs→falha + kyb pending · R2 só cnpj→falha · R3 cnpj aceito + articles SUBMITTED→falha (submitted não conta) · R4 ambos aceitos→**approve + kyb='approved'** · R5 **company_status imóvel** · R6 só articles→falha · R7 reject sem docs→kyb='rejected' · R8 estrutural (kyb service sem `company_status`/Bank + revoke writer existe).
- **Sem regressão:** user-submit 19/19 · admin-review 13/13 · storage 17/17 · scan 12/12 · tombstones 7/7+9/9 · cnpj 6/6 · lifecycle 7/7 · role 4/4 · vocab 7/7.
- **tsc real** fora de geo = **0**. 4 gates OK; arch `--strict` `critical_new=0`/`warning_new=1`=c3. **dev 365.**

## O que já existia e só foi testado / o que NÃO foi feito
- **Já existia (testado):** o gate de docs mínimos no `reviewFiscalKybRequest`; o revoke writer.
- **NÃO feito (escopo):** frontend/wizard · UI admin · provider produção (storage/scanner) · KYB approval automático/por-submit · company_status · ACTIVE writer · Bank · migration · revocation cascade (já existia, fora de escopo).

## DTs
- `DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING` → **PARTIALLY MITIGATED** (backend KYB documental COMPLETO: submit + balcão + release-gate provados; resta **wizard/frontend** + providers de produção).
- `DT-PJ-KYB-APPROVED-REVOCATION-WRITER-MISSING` → permanece **CLOSED** (confirmado: writer existe).
- `DT-PJ-DOCUMENT-PRODUCTION-STORAGE/MALWARE-...` → OPEN.

## Próximo passo recomendado
`F-PJ-KYB-DOCUMENTS-WIZARD-FRONTEND` (tornar usável pela pessoa; conectar onboarding ao backend pronto) **ou** `F-PJ-DELETE-GUARD-BANK-PORT` (paralelo seguro, não-documental). O eixo **backend** do KYB documental está fechado.
