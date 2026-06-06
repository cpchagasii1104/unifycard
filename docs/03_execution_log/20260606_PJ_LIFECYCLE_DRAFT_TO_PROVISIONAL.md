# Execução — F-PJ-LIFECYCLE-DRAFT-TO-PROVISIONAL-AND-KYB-DOCS — code + frontend

**Data:** 2026-06-06 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `e7c142f1` · **Decisão:** Clayton — **Caminho 1** (empresa nasce `DRAFT`; "Finalizar Configuração" promove `DRAFT → PROVISIONAL`) · **Esteira:** eu (escritora); a outra instância verifica READ-ONLY.

## Objetivo
Fechar a reclamação concreta: *"Reforma Rápida — só marquei como empresa principal, mas não salvei ou finalizei e agora aparece como cadastrada. Uma empresa só deve aparecer se a pessoa finalizar o cadastro."* O lifecycle PJ já estava decidido (cluster 0092/0093/0098 + `DRAFT` no enum/contrato/CHECK), mas o código nascia `PROVISIONAL` e a UI não separava "em configuração" de "pronta/provisória".

## READ-FIRST (confirmado contra schema/código vivos)
- `DRAFT` existe no enum (`packages/contracts/src/company.ts`: "Criada, invisível"), no tipo do backend e no CHECK vivo `chk_companies_company_status_lifecycle` (`DRAFT/PROVISIONAL/ACTIVE/SUSPENDED` — migration `20260604120000`). **STOP "DRAFT não existe" → NÃO disparado.**
- `createCompany` nascia `company_status='PROVISIONAL'` (l.~333/376/379/384/388); anti-fraude contava só PROVISIONAL.
- `activateCompanyOperationally` (Momento 2, rota `POST /companies/:companyId/operational-activation`) gravava o par soberano (`primary_company_type_id`/`primary_concept_id`) mas **não** mexia em `company_status`. Único caminho de finalização (route caller confirmado).
- Frontend `CompaniesManagerForm.tsx` já renderizava bloco DRAFT, mas mostrava o botão "Enviar comprovante" para DRAFT (upload é pós-finalização) e não tinha CTA de continuar.

## Implementação
- **A — nasce DRAFT** (`backend/src/core/companies/companies.service.ts`): `createCompany` passa a nascer **`company_status='DRAFT'`** (prefill da Receita NÃO promove). Anti-fraude de onboarding passa a contar **`company_status IN ('DRAFT','PROVISIONAL')`** (limite `MAX_PROVISIONAL_PER_CPF=3` cobre rascunhos).
- **B — finalizar promove** (mesma service): no UPDATE atômico da FASE 3 de `activateCompanyOperationally`, além do par soberano, **`company_status = CASE WHEN company_status='DRAFT' THEN 'PROVISIONAL' ELSE company_status END`** — promove só DRAFT, não regride PROVISIONAL/ACTIVE/SUSPENDED, não confere KYB. Reativação idempotente (par igual) faz COMMIT sem mexer no status.
- **C — UI separa** (`frontend/src/components/CompaniesManagerForm.tsx`): empresa DRAFT mostra **"📝 Em configuração — Cadastro ainda não finalizado…"** + CTA **"📝 Continuar configuração"** (→ `/empresas/:companyId/onboarding`, `CompanyOnboardingPage`/wizard cujo submit finaliza via par soberano). O botão "Enviar comprovante (PDF)" deixou de aparecer para DRAFT (documentos são pós-finalização).
- **D — etapa de documentos KYB no wizard → PAROU** (STOP de substrato — ver abaixo).

## STOP — Parte D (documentos KYB no wizard)
`uploadCompanyDocument` grava em **`company_documents` (legado)**, mas o SSOT promulgado (DECISION-0087) é **`fiscal_identity_documents`** (ancorado em `fiscal_identity_id`). Adicionar a etapa contra o legado criaria SSOT paralelo; contra o 0087 exigiria writer novo (fora do escopo code/frontend-only). **Parei conforme o critério do envelope.** Registrado em `DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING` (OPEN). Achado lateral: `uploadCompanyDocument` ainda promove qualquer não-VERIFIED → PROVISIONAL no upload (inócuo no fluxo feliz, mas rota reachable promoveria DRAFT sem par) → residual em `DT-PJ-COMPANY-LIFECYCLE-STATUS-CONFLATION`.

## Prova
- **e2e** `validate-pipeline-e2e-pj-lifecycle-draft-to-provisional` (efêmero, DEV intacto): **7/7 verdes** — L1 nasce DRAFT · L2 finaliza → PROVISIONAL · L3 promoção atômica com o par · L4 reativação idempotente mantém PROVISIONAL · L5 anti-fraude conta DRAFT no limite · cleanup DEV intacto.
- **tsc:** backend (escopo) e frontend **exit 0** (2 erros `geo-enrichment.service.ts` baseline pré-existentes, comprovados por stash).
- **4 gates:** actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK (365) · arch `--strict` exit 0 (`critical_new=0`; `warning_new=1`=c3). **Migrations 365→365 (zero migration).**

## Não-toque confirmado
Bank/`bank_*`/escrow/payment/booking · `fiscal_identities`/`kyb_status` (eixo de verificação separado; promoção não confere KYB) · `companies.status` (eixo operacional intacto) · substrato documental (não criei SSOT paralelo; parei) · delete-guard (frente Bank-port futura) · CNPJ on-entry · cargo/roles dedup · migration/schema (365) · DECISION nova (lifecycle já decidido).

## DTs
- `DT-PJ-COMPANY-APPEARS-BEFORE-ONBOARDING-FINALIZED` → **CLOSED**.
- `DT-PJ-COMPANY-LIFECYCLE-STATUS-CONFLATION` → **PARTIALLY MITIGATED** (residual: upload legado promove).
- `DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING` → **OPEN** (STOP de substrato — frente própria).

## Próximo passo
Conforme ordem do envelope: 2. CNPJ on-entry · 3. cargo/roles dedup · 4. delete-guard via Bank-port · 5. KYB release gate financeiro. A etapa de documentos KYB no wizard depende da frente que canonize o substrato (`fiscal_identity_documents` 0087).
