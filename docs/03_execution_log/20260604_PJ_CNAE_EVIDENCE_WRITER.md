# Execução — F-PJ-CNAE-EVIDENCE-WRITER

**Data:** 2026-06-04 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `4fe6e764` · **Governança:** `DECISION-0103` (D2/D3/D5/D7/D8) + migration `20260604150000`

## Objetivo
Ligar o aparelho na tomada fiscal: **persistir** a evidência CNAE/atividade econômica que `fetchCNPJFromRevenue` (ReceitaWS/BrasilAPI) já retornava e era **descartada**, gravando-a na casa fiscal (`fiscal_identity_economic_activities`). Idempotente, fail-open, sem QSA, sem migration, sem provider-change, sem frontend/marketplace/Bank. **Liga o aparelho — não deixa o aparelho dirigir a empresa.**

## SSOT / NÃO-SSOT
SSOT: CONCEPT (identidade semântica); par `(primary_company_type_id, primary_concept_id)` (ativação); `fiscal_identities.kyb_status` (verificação). **CNAE = evidência fiscal, NÃO SSOT** — não substitui CONCEPT/par, não autoriza publicação/domínio (D1/D10/D11). A evidência mora na **casa fiscal** (ancorada em `fiscal_identities`), nunca em `companies` (projeção). Precedência: Constituição > Leis > SSOT Registry > Ontologia > 0097…0103 > código.

## Implementação
**Writer novo — `backend/src/core/identity/fiscal-identity-economic-activity.service.ts`** (sibling canônico de `fiscal-identity-document.service.ts`; `pool.query`, sem tenant/RLS pois `fiscal_identities` é global):
- `persistEconomicActivities({ fiscalIdentityId, atividadePrincipal, atividadesSecundarias, source, fetchedAt })`:
  - **Normaliza** provider → lista canônica: o **1º principal** vira `is_primary=true` (no máx. 1, garantido por `uq_fiea_one_primary`); principais excedentes + todos os secundários = `is_primary=false`.
  - **Dedup** por `cnae_code` (primeira ocorrência vence; principal precede secundário).
  - **Descarta** entradas com `code`/`description` vazios (não satisfazem os CHECKs; fail-open silencioso).
  - **Idempotente**: `ON CONFLICT (fiscal_identity_id, cnae_code) DO UPDATE` (atualiza `cnae_description`/`is_primary`/`source`/`fetched_at`/`updated_at`). **Não deleta** CNAEs ausentes (reconciliação é futura).
  - Valida `source` (D7) e `fetchedAt` (Date válido, D7); confere a âncora fiscal (erro claro `FISCAL_IDENTITY_NOT_FOUND`).
  - `listEconomicActivities(fiscalIdentityId)` (read, principal primeiro).
  - **NÃO** faz fetch externo, **NÃO** persiste QSA/sócios/CPF/payload bruto (D5), **NÃO** mapeia CNAE→concept.

**Integração — `backend/src/core/companies/companies.service.ts` (`createCompany`):**
- Captura `revenueFetchedAt = new Date()` quando `revenueData` é obtido (D7).
- Bloco **pós-commit best-effort, FAIL-OPEN (D8)**: se há evidência (`atividade_principal`/`atividades_secundarias`), importa o writer e persiste usando `birthResult.fiscalIdentityId` + `revenueData` já em escopo, `source='receita_federal'`, `fetchedAt=revenueFetchedAt`. Erro → `console.warn` conciso e segue (o núcleo já committado nunca cai por evidência complementar). Mesmo padrão de "não-crítico pós-commit" dos blocos de endereço/preferências.

**Decisão técnica — `source`:** o provider `fetchCNPJFromRevenue` **NÃO foi alterado** (constraint "não mexer em provider"). Como o fetch não expõe qual provider (receitaws/brasilapi) teve sucesso, gravei `source='receita_federal'` (não-vazio, auditável, identifica a origem fiscal). O `source` provider-granular é "idealmente" em D7 → **deferido** para um refresh futuro (evita tocar o fetch).

## Prova
- **e2e writer efêmero `validate-pipeline-e2e-pj-cnae-evidence-writer.ts` 17/17 verde** (mock do provider no singleton, sem rede; orquestrado por `scripts/run-pj-cnae-evidence-writer-ephemeral.ps1`):
  - createCompany→provider persiste 1 principal + 2 secundários; **exatamente 1 primary** (4721102); secundários `is_primary=false`; `source`/`fetched_at` preenchidos; **FK** resolvida p/ `fiscal_identities`.
  - **Idempotência**: `persistEconomicActivities` 2× → continua 3 linhas (sem duplicar `(fiscal,cnae)`) + `DO UPDATE` aplicado (descrição/source).
  - **Sem QSA**: fixture com sócio (nome) → 0 colunas socio/qsa/cpf/nome; nenhum sócio vazado.
  - **Fail-open**: provider null → empresa nasce, **zero CNAE**.
  - **Normalização**: múltiplos principais → só o 1º primary (2º vira secundário); dedup principal∩secundário; entrada vazia descartada.
  - `companies` sem colunas de atividade; **Bank** intocado; `tenant_concept_offerings`/`company_concept_publications` intocados; **KYB** = `pending`; **359** migrations (sem nova migration).
- **atomic-company-birth 18/18** (createCompany não regrediu com o bloco pós-commit).
- **Backend tsc**: só os 2 baseline `geo-enrichment.service.ts`.
- **Gates**: actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards (financial/sql-lint/numbering) OK · **`validate-architectural-patterns.mjs --strict` exit=0** com `critical_new=0`. `warning_new=1` = `validate-pipeline-e2e-c3-actor-wallet-debit-recovery.ts:334` — **baseline pré-existente** (c3), fora desta fatia (meus arquivos introduzem zero violação).

## DTs
- `DT-PJ-CNAE-EVIDENCE-NOT-PERSISTED` → **CLOSED** (schema + writer prontos; persistência provada por e2e).
- Resíduos (frentes próprias, não reabrem): source provider-granular (deferido p/ não tocar fetch); refresh/reconciliação governado (D8 futuro); `DT-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-MISSING` (OPEN); elegibilidade (DECISION-0102).
- `DT-PJ-COMPANY-ACTIVITY-COLUMNS-GHOST` permanece CLOSED.

## Não-toque confirmado
schema/migrations (zero) · `fetchCNPJFromRevenue`/provider externo (endpoints/fallback/null-behavior intactos) · QSA (não persistido) · colunas em `companies` (não criadas) · KYB · marketplace · publication · Bank · frontend · `CompanyOnboardingWizard` · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
`F-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-READONLY` (desenho read-only → DECISION: matriz CNAE → suggested concept/company_type como **sugestão governada**, nunca autoridade — D10; fecha o ciclo evidência→sugestão de elegibilidade) OU `F-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK-READONLY` (ortogonal, antes de religar marketplace). Recomendado: a matriz, por ser o degrau natural após persistir a evidência (DECISION-0102/0103). O aparelho está ligado na tomada fiscal; não deixa o aparelho dirigir a empresa.
