# Execução — F-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-SCHEMA-MIGRATION

**Data:** 2026-06-04 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `e6783578` · **Governança:** `DECISION-0104`

## Objetivo
Criar o **quadro** (schema-only) da matriz governada CNAE → `suggested_concept_id`, conforme DECISION-0104. Tabela global, multi-candidato, com confidence/rationale/source/catalog_version/review_status. **Cria o quadro; não escreve nenhuma sugestão nele.** Sem seed/writer/endpoint/frontend.

## Prova normativa
CNAE é **sinal/evidência, não autoridade**. CONCEPT é a identidade semântica (SSOT). A matriz **sugere** `concept_id`; **não** decide o par soberano, **não** ativa empresa, **não** publica, **não** escolhe domínio. Frontend não cria taxonomia. Esta fatia cria **apenas schema**. Precedência: Constituição > Leis > SSOT Registry > Ontologia > 0102 > 0103 > **0104** > código.

## SSOT / NÃO-SSOT
SSOT semântico = CONCEPT (`concepts.concept_id`). A matriz é um **read-model de sugestão** (sinal), não SSOT. company_type **não** mora na matriz — é derivável via `company_type_allowed_concepts` (D4). `MarketplaceDomain`/N0 **não** são alvo (D3).

## Implementação
**Migration `backend/migrations/20260604160000_create_cnae_concept_suggestions.sql`** (forward-only / transacional / idempotente):
- Tabela GLOBAL `cnae_concept_suggestions`: `id` (uuid PK gen_random_uuid()), `cnae_code` (text NOT NULL), `suggested_concept_id` (uuid NOT NULL **REFERENCES concepts(concept_id) ON DELETE CASCADE**), `confidence` (text NOT NULL), `rationale` (text NOT NULL), `source` (text NOT NULL), `catalog_version` (text NOT NULL), `review_status` (text NOT NULL DEFAULT `'proposed'`), `is_active` (boolean NOT NULL DEFAULT true), `created_at`/`updated_at` (timestamptz NOT NULL DEFAULT now()).
- CHECKs: `chk_ccs_cnae_code`/`chk_ccs_rationale`/`chk_ccs_source`/`chk_ccs_catalog_version` (`length(btrim(x)) > 0`); `chk_ccs_confidence` (`IN ('low','medium','high')` — D6); `chk_ccs_review_status` (`IN ('proposed','approved','retired')` — D8).
- `uq_ccs_cnae_concept` UNIQUE(`cnae_code`, `suggested_concept_id`) — D5: N candidatos por CNAE, sem duplicar o par.
- Índices: `idx_cnae_concept_suggestions_cnae_code`, `idx_cnae_concept_suggestions_concept`, parcial `idx_ccs_active_approved (cnae_code) WHERE is_active = true AND review_status = 'approved'`.
- COMMENTs cravam: CNAE = sinal/evidência; matriz de sugestão; **não** ativa empresa, **não** substitui CONCEPT, **não** escreve `primary_*`, **não** publica, **não** mapeia MarketplaceDomain; seed futuro/seletivo.
- **Sem seed/writer/endpoint/frontend.** **NÃO** toca companies/fiscal_identities/Bank/marketplace.

**Validação `backend/src/scripts/validate-pipeline-e2e-pj-cnae-concept-suggestion-schema.ts`** + orquestrador `scripts/run-pj-cnae-concept-suggestion-schema-ephemeral.ps1` (DB efêmera, guard contra `unificard_dev` + `EXPECTED_DATABASE_NAME` + nome efêmero; BEGIN/ROLLBACK em client dedicado; FK satisfeita por 2 concepts seedados).

### Bug corrigido durante a fatia
O cabeçalho JSDoc do e2e continha `companies.primary_*/company_concept_publications` — a sequência `*/` **fechava o comentário de bloco** prematuramente → `TransformError: Unexpected "*"`. Corrigido para `companies.primary_ · company_concept_publications` (sem `*/`).

## Prova
- **e2e schema efêmero 27/27 verde** (CREATE DB → migrate FULL 360 → BEGIN/ROLLBACK → DROP): tabela existe; 9 colunas/tipos/nullability; FK `suggested_concept_id` inválido→**23503**; **N candidatos para o mesmo CNAE** OK; dup(cnae_code,concept)→**23505**; CHECKs vazio (cnae_code/rationale/source/catalog_version)→**23514**; confidence inválido→**23514**; review_status inválido→**23514**; default `review_status='proposed'`; default `is_active=true`; nenhuma `companies.primary_*` escrita; `company_concept_publications`/`tenant_concept_offerings`/Bank intocados (0); **sem seed**; ROLLBACK zero-resíduo (tabela vazia após).
- **Aplicação em `unificard_dev`** pelo runner canônico (`tsx src/core/db/migrate.ts`, EXPECTED=unificard_dev): **359 → 360** migrations. `\d cnae_concept_suggestions` confirmou PK / FK ON DELETE CASCADE / 6 CHECK / 2 UNIQUE (incl. `idx_ccs_active_approved` partial) / 3 índices; **0 linhas** (sem seed).
- **Backend tsc:** só os 2 baseline `geo-enrichment.service.ts` (schema-only não toca TS de runtime).
- **Gates:** actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards (financial/sql-lint/numbering 360) OK · `validate-architectural-patterns.mjs --strict` exit=0, `critical_new=0`. `warning_new=1` = `validate-pipeline-e2e-c3-actor-wallet-debit-recovery.ts:334` — baseline pré-existente (c3), fora desta fatia.

## DTs
- `DT-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-MISSING` → **PARTIALLY MITIGATED / GOVERNED** (quadro criado; **não CLOSED** — falta seed MVP + read endpoint).
- `DT-PJ-CONCEPT-DISPLAY-NAME-MISSING` → permanece OPEN.

## Não-toque confirmado
seed (não criado; quadro vazio) · endpoint · writer · frontend · CNAE writer (`fiscal-identity-economic-activity.service`) · activation route · publication · marketplace/hybrid · Bank · colunas em `companies`/`fiscal_identities` · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`. Nenhuma importação de CNAE oficial; nenhum MarketplaceDomain; nenhuma derivação de domínios elegíveis.

## Próximo passo
`F-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-SEED-MVP`: seed **seletivo/curado** dos CNAEs das 7 verticais vivas (açougue/farmácia/hortifruti/padaria/restaurante/salão/supermercado) → `suggested_concept_id` correspondente, `review_status='approved'`, `catalog_version='v1'`; **proibido importar o CNAE oficial inteiro** (D9). **Recomendado precedê-lo** de um read-only que mapeie os CNAEs reais das 7 verticais antes de cravar o seed (curadoria auditável). Depois: `...-READ-ENDPOINT` (sugestão read-only, proposta `pending`) → wizard suggestion (pré-seleção com confirmação). Esta fatia cria o quadro; não escreve nenhuma sugestão nele ainda.
