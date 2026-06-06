# Execução — F-SERVICE-TAXONOMY-BRIDGE-SCHEMA-MIGRATION (DECISION-0109 D3 / Opção A) — schema-only

**Data:** 2026-06-05 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `8efd82c0` · **Ratificação:** Clayton — Opção A (tabela-ponte dedicada) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Criar a ponte **explícita e governada** entre `company_type` e categorias de **serviço** (`domain='servicos'`), resolvendo estruturalmente o `DT-SERVICE-RAMO-TAXONOMY-FORK`. **Schema-only:** sem seed, runtime, serviço, availability, booking, Bank, frontend; sem repontar `default_*_slugs`, sem alterar `company_type_allowed_concepts` nem `services.category_id`.

## READ-FIRST
- PKs vivos confirmados (**não assumir**, conforme Clayton): `company_types.id`, `categories.category_id`.
- Tabela `company_type_service_categories` inexistente; 363 migrations (files=registered, sem fantasma).
- Template: `20260605170000_create_concept_labels.sql` (create-table governado, transacional, idempotente).

## Implementação
- **`backend/migrations/20260605190000_create_company_type_service_categories.sql`** (forward-only, BEGIN/COMMIT, `IF NOT EXISTS`):
  - `id UUID PK DEFAULT uuid_generate_v4()`
  - `company_type_id UUID NOT NULL REFERENCES company_types(id)`
  - `service_category_id UUID NOT NULL REFERENCES categories(category_id)`
  - `is_department BOOLEAN NOT NULL DEFAULT false`
  - `source TEXT NOT NULL` + `CHECK (length(btrim(source)) > 0)`
  - `created_at`/`updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `CONSTRAINT uq_ctsc_type_category UNIQUE (company_type_id, service_category_id)`
  - índices `idx_ctsc_company_type (company_type_id)`, `idx_ctsc_service_category (service_category_id)`
  - COMMENTs documentando: pré-moldagem de serviço separada da de produto; `service_category_id` DEVE apontar `domain='servicos'`; não reusar `company_type_allowed_concepts`.
- **Decisão de design:** **SEM** CHECK SQL congelando `domain='servicos'` — exigiria subquery em `categories.metadata` e congelaria evolução (`feedback_enforcement_vs_decision`). Invariante documentado em COMMENT; validação fica para **seed curado + guard/teste** de fatia posterior.

## Prova
- Aplicada pelo **runner canônico** (`tsx src/core/db/migrate.ts`, `EXPECTED_DATABASE_NAME=unificard_dev`, `MIGRATION_PROFILE=FULL`) — **não** `psql -f` (lição γ).
- Tabela existe ✓; FKs `company_type_id→company_types(id)` / `service_category_id→categories(category_id)` ✓; `uq_ctsc_type_category` **bloqueia par duplicado** (INSERT duplo em transação rolled-back → `23505`) ✓; **0 linhas** (sem seed) ✓.
- Não-toque: `company_type_allowed_concepts` (7) intocado; `salao.default_*_slugs` (marketplace-*) intocado; nenhum `.ts`/frontend/Bank.
- `schema_migrations` **363→364**, migration registrada, **files (364) = registered (364)** → **sem fantasma**.
- 4 gates: actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK (364, numeração única) · arch `--strict` exit=0 (`critical_new=0`; `warning_new=1`=c3).

## DT
- **`DT-SERVICE-RAMO-TAXONOMY-FORK` → PARTIALLY MITIGATED** (estrutura criada; falta seed salão + guard de domínio).
- `DT-SERVICE-NO-COMPANY-RAMO-BRIDGE` / `DT-SERVICE-AVAILABILITY-ENDPOINT-DISCONNECT` / `DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED` → intocadas (frentes próprias).

## Não-toque confirmado
seed · runtime/`.ts` · serviço/availability/booking · Bank · frontend · `services.category_id` · `company_type_allowed_concepts` · `company_types.default_*_slugs` · restaurante · peixaria · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
`F-SERVICE-TAXONOMY-BRIDGE-SEED-SALON` — 5 linhas: `servicos-estetica-bem-estar` (is_department=true) + `servicos-cabeleireiro`/`servicos-barbearia`/`servicos-manicure`/`servicos-estetica-facial`. Depois: guard de domínio + companyId na criação de serviço (Bank-free). Booking/payment/Bank seguem bloqueados. Espera go do Clayton.
