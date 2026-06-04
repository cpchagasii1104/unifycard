# Execução — F-PJ-PUBLICATION-OFFERING-SCHEMA-MIGRATION (tabela company_concept_publications)

**Data:** 2026-06-04 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `7b634bec` · **Governança:** `DECISION-0099` + `DECISION-0100`

## Objetivo
Criar a migration **schema-only** da tabela soberana de publicação/oferta PJ `company_concept_publications` (granularidade company/page-actor×concept). **Sem writer/rota/backfill/dados.** Não alterar `tenant_concept_offerings`, marketplace, hybrid, companies, fiscal/KYB, Bank, frontend/backend runtime.

## SSOT / NÃO-SSOT
SSOT publicação futura = `company_concept_publications`; CONCEPT (semântica); par `primary_*` (ativação); `actors(id)`/page-actor; `company_users` (autoridade futura); `fiscal_identities.kyb_status` (gate futuro); `bank_ledger` (fronteira negativa). NÃO-SSOT de publicação: `tenant_concept_offerings` atual · metadata · businessType · businessCategory · hybrid · frontend · marketplace orchestration. Precedência: Constituição > Leis > SSOT Registry > Ontologia > 0097 > 0098 > 0099 > 0100 > código.

## READ-FIRST (schema vivo)
PKs reais: `companies(company_id)`, `tenants(id)`, `concepts(concept_id)`, `actors(id)` (id===actor_id). `company_concept_publications` ausente em migrations e no banco. `gen_random_uuid` disponível. Runner canônico envolve cada arquivo em tx; convenção dos arquivos inclui `BEGIN;…COMMIT;` (mirror).

## Migration criada
`backend/migrations/20260604140000_create_company_concept_publications.sql` (timestamp > última `20260604130000`). Forward-only / transacional / idempotente (`CREATE TABLE IF NOT EXISTS` + `CREATE [UNIQUE] INDEX IF NOT EXISTS`).
- **Colunas:** id(uuid PK gen_random_uuid), tenant_id, company_id, page_actor_id, concept_id, status(text def 'active'), published_at(tstz def now), retired_at(tstz null), created_by_actor_id, retired_by_actor_id(null), source(text def 'manual'), intent(null), created_at, updated_at.
- **FK:** tenant_id→tenants(id) · company_id→companies(company_id) · page_actor_id/created_by_actor_id/retired_by_actor_id→actors(id) · concept_id→concepts(concept_id). ON DELETE default (NO ACTION) — publicação não é apagada em cascata silenciosa; lifecycle = retirement.
- **CHECK:** `chk_ccp_status` (active|retired) · `chk_ccp_lifecycle` (active⇒retired_at/by NULL; retired⇒retired_at NOT NULL) · `chk_ccp_published_at`.
- **UNIQUE parcial:** `uq_ccp_active_company_concept (company_id, concept_id) WHERE status='active'` (D8).
- **Índices:** `idx_ccp_active_tenant_concept` (tenant_id,concept_id WHERE active) · `idx_ccp_active_page_actor` (page_actor_id WHERE active) · `idx_ccp_company` · `idx_ccp_concept`.
- **COMMENTs:** SSOT de publicação ≠ ativação; tco = read-model/compat; writer gated é frente própria.

## Aplicação
Runner canônico `tsx src/core/db/migrate.ts` (EXPECTED_DATABASE_NAME=unificard_dev, MIGRATION_PROFILE=FULL). **Dev 357 → 358** migrations. Verificado em dev: 6 FKs + 3 CHECKs + UNIQUE-partial-active + 4 índices; **0 linhas** (sem backfill/auto-publicação); `tenant_concept_offerings` inalterada (6 cols tenant×concept, 0 linhas).

## Prova
`backend/src/scripts/validate-pipeline-e2e-pj-publication-schema.ts` + `scripts/run-pj-publication-schema-ephemeral.ps1` → **25/25** (DB efêmera, migrate FULL, BEGIN/ROLLBACK num client dedicado, teardown DROP):
- tabela + 13 colunas/tipos; status active(default)/retired válido OK; status inválido → 23514;
- lifecycle: active com retired_at → 23514; retired sem retired_at → 23514;
- UNIQUE: 2ª active mesmo (company,concept) → 23505; histórico: retired + nova active coexistem;
- FK company/page_actor/concept inválida → 23503; tco inalterada; zero dado persistido (ROLLBACK).
Correções na fatia: (1) `chk_actor_requires_identity` exige `global_user_id` p/ actor 'user' → seed de chain identity (global_users→identities); (2) FK de page_actor era mascarada pela UNIQUE ativa → concept distinto p/ isolar.
Backend tsc: só os 2 baseline `geo-enrichment.service.ts`. 4 gates OK (regression 358 unique; arch warning_new=1 = c3 pré-existente).

## DTs
- `DT-PJ-PUBLICATION-OFFERING-SOVEREIGN-SHAPE-MISSING` → **PARTIALLY MITIGATED** (tabela criada; falta o writer — **não CLOSED**).
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` → OPEN.
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → PARTIALLY MITIGATED / GOVERNED.
- `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` → CLOSED.

## Não-toque confirmado
backend runtime (service/routes) · frontend · `tenant_concept_offerings` · marketplace/hybrid · onboarding · Bank · KYB/fiscal writer · `createCompany` · `company_status` · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`. (Só schema + scripts de teste tocados.)

## Próximo passo
`F-PJ-PUBLICATION-OFFERING-WRITER` (publish/unpublish gated: KYB approved via `authority-decision.evaluateKybLayer` + `companiesService.canManageCompany` + page-actor; concept = `companies.primary_concept_id`; idempotente; audit inline) — recomenda-se READ-ONLY/desenho antes. Ortogonal: read-only marketplace `hybrid`. Esta fatia cravou o poste; ainda não pendura placa.
