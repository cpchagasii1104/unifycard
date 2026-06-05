# Execução — F-PJ-CONCEPT-DISPLAY-NAME (DECISION-0107, docs-only)

**Data:** 2026-06-05 · **Modo:** EXECUTOR DOCS-ONLY CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `7725a13f` · **Esteira:** Batedora montou o menu read-only; Clayton decidiu B; eu escrevi a DECISION.

## Objetivo
Promulgar (docs-only) **onde mora o display name de concept**, antes de implementar. Clayton decidiu **Opção B — tabela governada `concept_labels`**. **Só a DECISION** nesta fatia — sem migration/seed/endpoint/frontend.

## Decisão (DECISION-0107)
- **B — `concept_labels`** (apresentação localizada governada), **não** coluna em `concepts`.
- `concepts` fica **seco** (concept_id/slug/domain); **não** ganha `display_name`.
- Label = **read-model/apresentação**; nunca chave de identidade (proibido resolver concept por label / WHERE-JOIN de identidade). `concept_id`/`slug` = SSOT.
- Aterra `18_DOMAIN_ONTOLOGY §5.2.2` (`display_names: LocalizedName[]`).
- **Shape mínimo:** id, concept_id FK→concepts, locale (default 'pt-BR'), context_key (default 'default'), label (NOT NULL), short_label (NULL), is_primary (default true), source (NOT NULL), created_at/updated_at. CHECKs não-vazios (label/locale/context_key); UNIQUE parcial 1-primary por `(concept_id, locale, context_key) WHERE is_primary`.
- **Exposição** futura por JOIN nos endpoints (`suggestConceptForCnae`, `listAllowedConceptsForCompanyType`), fallback honesto (sem label → null → frontend mostra slug).
- **Sem i18n runtime** agora (só coluna locale preparada).
- **Labels MVP curados** (D10): Supermercado · Hortifruti · "Açougue / Varejo de Carnes" · Padaria · Farmácia · "Salão de Beleza / Estética" · Restaurante.

## Evidência material (auditoria read-only `F-PJ-CONCEPT-DISPLAY-NAME`)
- `concepts` = concept_id/slug/domain/created_at — sem campo legível; sem tabela `concept_labels`.
- UI vaza slug: `CompanyOnboardingWizard.tsx:300` → `<h3>{c.slug}</h3>`.
- Endpoints expõem slug sem label (`listAllowedConceptsForCompanyType`, `suggestConceptForCnae` → `displayName=null`).
- Norma `18_DOMAIN_ONTOLOGY §5.2.2` modela `display_names` localizado (camada de apresentação separada).

## DTs
- `DT-PJ-CONCEPT-DISPLAY-NAME-MISSING` → **GOVERNED / DECISIONED** (não CLOSED — fecha após schema+seed+endpoints+frontend mínimo verificados, D11/§13).

## Gates (docs-only)
git diff = só markdown autorizado (DECISION nova + DECISIONS_LOG + DT_LOG + STATUS + opus + execution log). actor-writer/bank-ledger/regression-guards OK; `validate-architectural-patterns.mjs --strict` exit=0 (`critical_new=0`; `warning_new=1`=c3 baseline).

## Não-toque confirmado
schema/migration · seed · endpoint · frontend · runtime · CNAE (além de, depois, expor displayName por JOIN) · Trilhos A/B · Bank · coluna em `concepts` · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Sequência autorizada (execução futura, fatias separadas; espera go do Clayton)
1. **Esta DECISION** (docs-only) ✓.
2. `F-PJ-CONCEPT-LABELS-SCHEMA-MIGRATION` — schema-only `concept_labels` + e2e schema (CHECK/FK/UNIQUE-parcial).
3. `F-PJ-CONCEPT-LABELS-SEED-MVP` — seed pt-BR curado dos 7 (D10).
4. `F-PJ-CONCEPT-LABELS-EXPOSE-ENDPOINTS` — JOIN em `listAllowedConceptsForCompanyType` + `suggestConceptForCnae` (displayName, fallback null) + e2e.
5. `F-PJ-CONCEPT-LABELS-WIZARD` — frontend `displayName ?? slug`.

## Próximo passo
Clayton autorizou **só a DECISION**. A próxima fatia (schema migration) espera o "go" dele. Critério de fechamento da DT: UI não exibe mais slug quando há label; endpoints retornam displayName; fallback honesto; verificado ponta a ponta.
