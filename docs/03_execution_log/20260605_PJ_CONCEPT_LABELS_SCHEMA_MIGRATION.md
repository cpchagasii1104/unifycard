# Execução — F-PJ-CONCEPT-LABELS-SCHEMA-MIGRATION

**Data:** 2026-06-05 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `debc7e6f` · **Governança:** `DECISION-0107` (D4/D5/D6/D12) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Criar o substrato **schema-only** da apresentação governada de concept: tabela `concept_labels` (DECISION-0107 Opção B). **Sem seed dos 7 labels, sem endpoints, sem frontend, sem CNAE/Trilhos/Bank/runtime novo.** Só substrato.

## Regra de processo (lição da γ aplicada)
Migration aplicada no dev **pelo runner canônico** (`tsx src/core/db/migrate.ts`, EXPECTED_DATABASE_NAME=unificard_dev) — **nunca `psql -f`**. Confirmado: arquivos 362 / **registradas 362** (`new_reg=1`, registrada + checksum), **zero migration fantasma** (antes 361/361).

## SSOT / NÃO-SSOT
`concept_id`/`slug` = identidade (SSOT semântico, Lei 7). `concept_labels` = **apresentação governada** (read-model), NÃO identidade. Proibido resolver concept por label / usar label em WHERE/JOIN de identidade (D1). `concepts` fica **seco** (não ganha display_name).

## Implementação
**Migration `backend/migrations/20260605170000_create_concept_labels.sql`** (forward-only/transacional/idempotente):
- Tabela GLOBAL `concept_labels` (sem tenant_id): `id` PK `uuid_generate_v4()` (= o default de `concepts.concept_id`), `concept_id` NOT NULL **REFERENCES concepts(concept_id)**, `locale` NOT NULL DEFAULT `'pt-BR'`, `context_key` NOT NULL DEFAULT `'default'`, `label` NOT NULL, `short_label` NULL, `is_primary` NOT NULL DEFAULT true, `source` NOT NULL, `created_at`/`updated_at`.
- CHECKs `chk_cl_locale`/`chk_cl_context_key`/`chk_cl_label`/`chk_cl_source` (`length(btrim(x)) > 0`).
- **`uq_concept_labels_one_primary`** UNIQUE parcial `(concept_id, locale, context_key) WHERE is_primary = true` (D6 — ≤1 primária; N alternativas livres com is_primary=false).
- Índices: `idx_concept_labels_concept (concept_id)`, `idx_concept_labels_locale_context (locale, context_key)`.
- COMMENTs cravam: apresentação ≠ identidade; proibido resolver concept por label / WHERE-JOIN; concepts não ganha display_name; read-model com fallback honesto.
- **SEM seed/endpoint/frontend** (D12). NÃO altera `concepts`.

**Validação `backend/src/scripts/validate-pipeline-e2e-pj-concept-labels-schema.ts`** + wrapper `scripts/run-pj-concept-labels-schema-ephemeral.ps1` (DB efêmera, BEGIN/ROLLBACK, guard contra unificard_dev + EXPECTED + nome efêmero).

## Prova
- **e2e schema efêmero 21/21 verde** (CREATE→migrate FULL→BEGIN/ROLLBACK→DROP): tabela existe; 8 colunas/tipos/nullability; FK concept inválido→**23503**; 1 primária OK + defaults (pt-BR/default/true); 2ª primária mesmo (concept,locale,context)→**23505**; múltiplas NÃO-primárias OK; CHECKs vazio (locale/context_key/label/source)→**23514**; `concepts` seco (0 colunas display_name/name/label); zero seed; Bank intocado; ROLLBACK zero-resíduo.
- **Aplicação em `unificard_dev`** pelo runner canônico: **361→362** registradas (`new_reg=1`, checksum, **zero fantasma**). `\d concept_labels` confirmou PK `uuid_generate_v4()` / FK→concepts / 4 CHECK / `uq_concept_labels_one_primary` partial / 2 índices / defaults.
- Backend tsc: só os 2 baseline `geo-enrichment.service.ts`. Gates: actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK (numeração única, 362) · arch `--strict` exit=0 (`critical_new=0`; `warning_new=1`=c3 baseline).

## DT
- `DT-PJ-CONCEPT-DISPLAY-NAME-MISSING` → GOVERNED/DECISIONED, **schema entregue** (não CLOSED — falta seed MVP + endpoints + frontend; D11/§13).

## Não-toque confirmado
seed (não criado; tabela vazia) · endpoints (CNAE/allowed-concepts não tocados) · frontend/wizard · `concepts` (não ganhou display_name) · CNAE seed · Trilhos A/B · Bank · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
`F-PJ-CONCEPT-LABELS-SEED-MVP` (seed pt-BR curado dos 7: Supermercado/Hortifruti/"Açougue / Varejo de Carnes"/Padaria/Farmácia/"Salão de Beleza / Estética"/Restaurante) → `...-EXPOSE-ENDPOINTS` (JOIN em `suggestConceptForCnae` + `listAllowedConceptsForCompanyType`, displayName, fallback null) → `...-WIZARD` (frontend `displayName ?? slug`). Espera go do Clayton.
