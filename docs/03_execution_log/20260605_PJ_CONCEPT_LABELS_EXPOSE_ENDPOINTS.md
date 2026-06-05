# Execução — F-PJ-CONCEPT-LABELS-EXPOSE-ENDPOINTS

**Data:** 2026-06-05 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `a4c2c5e2` · **Governança:** `DECISION-0107` (D9) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Expor o `displayName` (apresentação governada de `concept_labels`) nos 2 endpoints read-only — para o wizard consumir depois. **Backend read-only, sem migration/seed/frontend/CNAE/Trilhos/Bank, sem alterar `concepts`.**

## Regra
`concept_id` = identidade; `slug` = técnico/canônico; `label/displayName` = apresentação governada. Nunca resolver concept por label; nunca usar label em WHERE/JOIN de identidade; nunca como fallback de autorização/ativação/publicação. O JOIN é **projeção**.

## Implementação (`backend/src/core/companies/companies.service.ts`)
Em ambos, **LEFT JOIN** `concept_labels cl ON cl.concept_id = c.concept_id AND cl.locale='pt-BR' AND cl.context_key='default' AND cl.is_primary=true`:
- **`listAllowedConceptsForCompanyType`** — passa a retornar `{ conceptId, slug, domain, displayName, shortLabel }` (`cl.label`/`cl.short_label`; null se não houver). DTO atualizado.
- **`suggestConceptForCnae`** — `suggestedConceptDisplayName` agora vem de `cl.label` (antes null hardcoded); demais campos preservados; lookup do concept continua por `cnae_code`/`concept_id`/`slug` (label não entra no WHERE/ORDER).
- **Fallback honesto:** sem label → `null` (frontend fará `displayName ?? slug`). Sem auto-derivação do slug.

## Prova
- **e2e `validate-pipeline-e2e-pj-cnae-suggestion-read-endpoint.ts` 18/18 verde** (app.inject + JWT):
  - CNAE 4711302 → `suggestedConceptDisplayName="Supermercado"` (JOIN); 9602-5/01 → "Salão de Beleza / Estética".
  - `listAllowedConceptsForCompanyType` (supermercado) → concept `varejo-alimentar-integrado` com `displayName="Supermercado"` + `shortLabel="Supermercado"`.
  - **fallback honesto:** seed de teste (cnae '1234567' → concept SEM label) → `suggestedConceptDisplayName=null` (sem derivar do slug; `suggestedConceptId` presente).
  - máscara=sem-máscara mesma sugestão; 400 inválido; válido-sem-sugestão `data=null`; zero escrita em `primary_*`/ccp/tco/`concept_labels`; Bank intocado.
- **onboarding-activation-flow 22/22** (a mudança de shape — `displayName`/`shortLabel` extras — não quebrou o consumidor; ele checa `conceptId/slug/domain` + ausência de legado).
- Backend tsc só os 2 baseline geo. Gates: actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK · arch `--strict` exit=0 (`critical_new=0`; `warning_new=1`=c3). **Migrations 363→363** (zero migration).

## DT
- `DT-PJ-CONCEPT-DISPLAY-NAME-MISSING` → GOVERNED, **schema + seed + endpoints entregues** (não CLOSED — falta só o **frontend/wizard**, DECISION-0107 §13).

## Não-toque confirmado
migration/schema (zero; 363) · seed · frontend/wizard · `concepts` (não alterado) · `concept_labels` (não escrito) · `primary_*` · publicação · CNAE seed · Trilhos A/B · Bank · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
`F-PJ-CONCEPT-LABELS-WIZARD` (frontend mínimo): `frontend/src/components/company/CompanyOnboardingWizard.tsx:300` renderiza `displayName ?? slug` (em vez de `{c.slug}`). Fecha `DT-PJ-CONCEPT-DISPLAY-NAME-MISSING` (UI não exibe mais slug técnico quando há label). Espera go do Clayton.
