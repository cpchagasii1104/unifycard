# Execução — F-PJ-CONCEPT-LABELS-WIZARD-MINIMAL (fecha a cadeia)

**Data:** 2026-06-05 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `0091f6c2` · **Governança:** `DECISION-0107` · **Esteira:** eu (escritora); par verifica.

## Objetivo
Última fatia: a UI renderiza `displayName ?? slug` em vez de slug técnico. **Frontend mínimo** (sem backend/migration/seed/refactor). Fecha `DT-PJ-CONCEPT-DISPLAY-NAME-MISSING`.

## Regra
`displayName` = apresentação; `slug` = fallback técnico; `conceptId`/slug = identidade (ativação). Não resolver concept por displayName; não enviar displayName na ativação; UI mostra humano, backend decide por identificador canônico.

## Implementação
- **`frontend/src/components/company/CompanyOnboardingWizard.tsx:300`** — `<h3>{c.slug}</h3>` → `<h3>{c.displayName ?? c.slug}</h3>` (único ponto que exibia slug como título de atividade). `c.conceptId` segue como identidade; submit inalterado (`conceptId: selectedConceptId`).
- **`frontend/src/api/companies.ts`** — `AllowedOperationalConcept` ganhou `displayName?: string | null` + `shortLabel?: string | null` (apresentação; podem ser null → UI faz `displayName ?? slug`). Comentário atualizado.
- Sem alterar payload de submit, fluxo de ativação, CNAE endpoint, seed, schema. Sem refactor do wizard. Não há render de CNAE-suggestion neste wizard (nada a ajustar lá).

## Prova
- **Frontend tsc limpo** (o novo campo + `?? c.slug` typecheck; `concepts: AllowedOperationalConcept[]`).
- Backend **untouched** → gates: actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK · arch `--strict` exit=0 (`critical_new=0`; `warning_new=1`=c3). **Dev 363→363** (zero migration). Bank intocado.
- Comportamento: os 7 concepts MVP renderizam label ("Supermercado", "Hortifruti", "Açougue / Varejo de Carnes", "Padaria", "Farmácia", "Salão de Beleza / Estética", "Restaurante"); concepts sem label → slug por fallback honesto (endpoints provados na fatia anterior — e2e suggestion 18/18 com `displayName=null`; flow 22/22 confirma identidade/ativação por conceptId).
- **Identidade preservada:** submit usa `selectedConceptId` (conceptId) — `displayName` nunca no payload nem em WHERE/identidade.

## DT
- `DT-PJ-CONCEPT-DISPLAY-NAME-MISSING` → **CLOSED** (cadeia completa: schema + seed + endpoints + frontend; critério §13 atingido — UI não exibe mais slug quando há label).
- Resíduo (não reabre): só os 7 MVP têm label; os 130 demais concepts mostram slug por fallback honesto — enriquecimento futuro de labels.

## Não-toque confirmado
backend (lógica) · migration/schema (363) · seed · CNAE endpoint · ativação operacional · labels seed · Trilhos A/B · Bank · refactor do wizard · nova tela · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Cadeia completa (DECISION-0107)
`F-PJ-CONCEPT-DISPLAY-NAME` (DECISION) → `...-SCHEMA-MIGRATION` (concept_labels) → `...-SEED-MVP` (7 pt-BR) → `...-EXPOSE-ENDPOINTS` (JOIN displayName) → `...-WIZARD-MINIMAL` (UI `displayName ?? slug`). **DT fechada.**

## Próximo passo
Trilhos A/B (Estágio 4, governado pela DT do catálogo canônico) · decisão peixaria · enriquecimento de labels dos demais concepts (opcional). Espera go do Clayton.
