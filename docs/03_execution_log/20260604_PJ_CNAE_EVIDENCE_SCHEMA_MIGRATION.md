# Execução — F-PJ-CNAE-EVIDENCE-SCHEMA-MIGRATION

**Data:** 2026-06-04 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `1484ff1f` · **Governança:** `DECISION-0103` (D2/D3/D4/D5/D14)

## Objetivo
Instalar o substrato **schema-only** para persistir CNAE/atividade econômica como **evidência fiscal auditável** da PJ — a "tomada fiscal". Criar `fiscal_identity_economic_activities` ancorada em `fiscal_identities`, com 1 CNAE principal + N secundários, registrando `source`/`fetched_at`. **Sem writer, sem provider, sem frontend/marketplace/Bank.** Esta fatia instala a tomada; não liga nenhum aparelho nela ainda.

## SSOT / NÃO-SSOT
SSOT: CONCEPT (identidade semântica); par `(primary_company_type_id, primary_concept_id)` (ativação); `fiscal_identities.kyb_status` (verificação). **CNAE = evidência fiscal, NÃO SSOT** — não substitui CONCEPT/par, não autoriza publicação/domínio por si só (DECISION-0102/0103); apenas sugere/reforça. A evidência mora na **casa fiscal** (`fiscal_identities`), nunca em `companies` (projeção). `archive não é SSOT vigente`. Precedência: Constituição > Leis > SSOT Registry > Ontologia > 0097…0103 > código.

## Implementação
**Migration `backend/migrations/20260604150000_create_fiscal_identity_economic_activities.sql`** (forward-only / transacional / idempotente):
- Tabela `fiscal_identity_economic_activities`: `id` (uuid PK gen_random_uuid()), `fiscal_identity_id` (uuid NOT NULL **REFERENCES fiscal_identities(fiscal_identity_id) ON DELETE CASCADE**), `cnae_code`/`cnae_description`/`source` (text NOT NULL), `is_primary` (boolean NOT NULL DEFAULT false), `fetched_at` (timestamptz NOT NULL), `created_at`/`updated_at` (timestamptz NOT NULL DEFAULT now()).
- CHECKs `chk_fiea_cnae_code`/`chk_fiea_cnae_description`/`chk_fiea_source` (`length(btrim(x)) > 0`).
- `uq_fiea_fiscal_cnae` UNIQUE(`fiscal_identity_id`, `cnae_code`) — D3, sem duplicar o mesmo CNAE na mesma identidade.
- `uq_fiea_one_primary` partial-unique `(fiscal_identity_id) WHERE is_primary = true` — D4, ≤1 principal (zero ou um); N secundários livres.
- `idx_fiea_fiscal_identity`, `idx_fiea_cnae_code`.
- COMMENTs fixando: evidência ≠ identidade; sem QSA/dados pessoais (LGPD D5); `source`/`fetched_at` obrigatórios.
- **Sem writer** (D14). **NÃO** guarda QSA/sócios/CPF. **NÃO** toca `companies`/`fiscal_identities`/Bank/marketplace.

**Validação `backend/src/scripts/validate-pipeline-e2e-pj-cnae-evidence-schema.ts`** + orquestrador `scripts/run-pj-cnae-evidence-schema-ephemeral.ps1` (DB efêmera, guard contra `unificard_dev` + `EXPECTED_DATABASE_NAME` + nome efêmero; BEGIN/ROLLBACK em client dedicado). Corrigido o teste-16 (query convolutada `count ?? n` → query única com alias `n`).

## Prova
- **e2e schema efêmero 24/24 verde** (CREATE DB → migrate FULL 359 → BEGIN/ROLLBACK → DROP): tabela existe; 7 colunas/tipos/nullability; FK inválida→**23503**; 1 principal OK; N secundários OK; dup(fiscal,cnae)→**23505**; 2º principal→**23505**; zero principal OK; cnae_code/cnae_description/source vazio→**23514**; fetched_at NULL→**23502**; sem QSA (tabela/coluna); `companies` sem colunas de atividade; Bank `bank_transactions`=0; `tenant_concept_offerings`+`company_concept_publications`=0; ROLLBACK zero-resíduo (+ tabela vazia após).
- **Aplicação em `unificard_dev`** pelo runner canônico (`tsx src/core/db/migrate.ts`, EXPECTED_DATABASE_NAME=unificard_dev): **358 → 359** migrations. `\d fiscal_identity_economic_activities` confirmou PK / FK ON DELETE CASCADE / 3 CHECK / 2 UNIQUE (incl. `uq_fiea_one_primary` partial) / 2 índices.
- **Backend tsc:** só os 2 baseline `geo-enrichment.service.ts` (schema-only não toca TS).
- **Gates:** actor-writer §4.8.1 OK · bank-ledger §4.6 OK · financial-regression OK · sql-regression-lint OK · migration-numbering OK (359 únicas). `validate-architectural-rules.ts` exit-1 = **baseline USER_PROFILE_CONTRACT** (`profile.routes.ts`/`human-mvp-*`/`core.service.ts`) — arquivos **NÃO tocados** nesta fatia; `git status` confirma só migration+e2e+ps1 alterados. Schema-only não pode introduzir violação de perfil.

## DTs
- `DT-PJ-CNAE-EVIDENCE-NOT-PERSISTED` → **PARTIALLY MITIGATED / GOVERNED** (tomada instalada; **NÃO CLOSED** — falta writer).
- `DT-PJ-COMPANY-ACTIVITY-COLUMNS-GHOST` → CLOSED (fatia anterior).
- `DT-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-MISSING` → OPEN.

## Não-toque confirmado
writer (não criado) · provider Receita/BrasilAPI · `fetchCNPJFromRevenue` · `companies`/`fiscal_identities` (estrutura) · KYB · marketplace · publication · Bank · frontend · `CompanyOnboardingWizard` · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
`F-PJ-CNAE-EVIDENCE-WRITER`: persistir CNAE/atividade do `fetchCNPJFromRevenue` já existente no nascimento da PJ — fail-open (D8), sem QSA (D5), idempotente sobre `uq_fiea_fiscal_cnae` e `uq_fiea_one_primary`. Depois `DT-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-MISSING` (matriz CNAE→suggested concept, sugestão governada, nunca autoridade) e a elegibilidade de 6 camadas (DECISION-0102). Esta fatia instalou a tomada; nenhum aparelho ligado nela ainda.
