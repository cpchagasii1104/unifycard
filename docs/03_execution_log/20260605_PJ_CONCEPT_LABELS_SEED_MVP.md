# Execução — F-PJ-CONCEPT-LABELS-SEED-MVP

**Data:** 2026-06-05 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `19057507` · **Governança:** `DECISION-0107` (D10) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Semear os **7 labels primários pt-BR** curados das verticais MVP em `concept_labels` (criada em `19057507`). Apenas DML governado/idempotente. **Sem endpoint, sem frontend, sem CNAE novo, sem Trilhos/Bank, sem alterar `concepts`.**

## Regra de processo
Aplicada no dev **pelo runner canônico** (`tsx src/core/db/migrate.ts`), nunca `psql -f`. Confirmado: **362→363** registradas (`new_reg=1`, registrada + checksum, **zero fantasma**).

## Implementação
**Migration `backend/migrations/20260605180000_seed_concept_labels_mvp.sql`** (forward-only/idempotente):
- `INSERT INTO concept_labels (...) SELECT c.concept_id, 'pt-BR', 'default', v.label, v.short_label, true, 'clayton_curated_mvp_2026_06_05' FROM (VALUES ...) v JOIN concepts c ON c.slug = v.concept_slug` — **resolução por slug** (não UUID hardcode).
- `ON CONFLICT (concept_id, locale, context_key) WHERE is_primary = true DO UPDATE SET label/short_label/source/updated_at` — idempotente, atualiza no re-apply (índice parcial `uq_concept_labels_one_primary`).
- **Gate fail-closed:** `DO $$ ... IF COUNT(source=clayton, pt-BR, default, is_primary) <> 7 THEN RAISE EXCEPTION`.
- Labels: Supermercado · Hortifruti · "Açougue / Varejo de Carnes" (short Açougue) · Padaria · Farmácia · "Salão de Beleza / Estética" (short Beleza) · Restaurante.
- NÃO altera `concepts`; NÃO deriva label do slug automaticamente; NÃO cria endpoint/frontend.

**Validação `backend/src/scripts/validate-pipeline-e2e-pj-concept-labels-seed.ts`** + wrapper `scripts/run-pj-concept-labels-seed-ephemeral.ps1` (DB efêmera; o seed roda como migration FULL).

## Prova
- **e2e seed efêmero 6/6 verde:** (1) exatamente 7 labels primárias pt-BR/default curadas; (2) cada uma resolve o concept correto por slug + label/short_label corretos; (3) **idempotência** — re-aplicar o seed continua 7 (ON CONFLICT, sem duplicar); (4) índice parcial impede 2ª primária→**23505**; (5) `concepts` seco; (6) Bank intocado.
- **Aplicação em `unificard_dev`** pelo runner canônico: **362→363** (`new_reg=1`, registrada, zero fantasma); query confirmou as 7 labels → concepts corretos por slug.
- Gates: actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK (numeração única, 363) · arch `--strict` exit=0 (`critical_new=0`; `warning_new=1`=c3 baseline).

## DT
- `DT-PJ-CONCEPT-DISPLAY-NAME-MISSING` → GOVERNED/DECISIONED, **schema + seed entregues** (não CLOSED — só fecha após **endpoints (JOIN displayName) + frontend (wizard `displayName ?? slug`)** verificados, DECISION-0107 §13).

## Não-toque confirmado
endpoints (CNAE/allowed-concepts não tocados) · frontend/wizard · `concepts` (não alterado; sem display_name) · CNAE seed · Trilhos A/B · Bank · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
`F-PJ-CONCEPT-LABELS-EXPOSE-ENDPOINTS`: JOIN `concept_labels` (primary, pt-BR/default) em `suggestConceptForCnae` (preenche `suggestedConceptDisplayName`) e `listAllowedConceptsForCompanyType` (adiciona `displayName`); fallback honesto (sem label → null). Depois `...-WIZARD` (frontend `displayName ?? slug`). Espera go do Clayton.
