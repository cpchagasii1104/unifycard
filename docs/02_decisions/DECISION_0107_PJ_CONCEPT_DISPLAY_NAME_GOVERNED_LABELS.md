# DECISION-0107 — Display name de concept mora em `concept_labels` (apresentação governada, não identidade)

**Data:** 2026-06-05
**Tipo:** Arquitetura / Ontologia / Apresentação (UX) PJ
**Status:** PROMULGADA (docs-only — não autoriza código/schema/migration/seed/endpoint/frontend)
**Frente:** `F-PJ-CONCEPT-DISPLAY-NAME`
**HEAD de origem:** `7725a13f`
**Decisor:** Clayton (Opção B — tabela governada de labels; sem coluna em `concepts`)

---

## 1. Título
O **nome legível** (display name / label) de um CONCEPT mora numa **tabela governada `concept_labels`** —
camada de **apresentação**, **não** identidade. `concepts` permanece **seco** (`concept_id`, `slug`, `domain`); o
label nunca é chave de identidade. Decide **onde mora o label** — não cria schema/seed/endpoint ainda.

## 2. Data
2026-06-05.

## 3. Tipo
Arquitetura / Ontologia / Apresentação PJ. Docs-only.

## 4. Status
PROMULGADA. Não autoriza migration, seed, endpoint, frontend ou qualquer runtime. Só fixa **onde** e **como** o
label deve morar, e a sequência de execução futura.

## 5. Contexto
O read endpoint CNAE→concept (`DECISION-0104` / `F-PJ-CNAE-TO-CONCEPT-SUGGESTION-READ-ENDPOINT`) e o catálogo de
ativação (`listAllowedConceptsForCompanyType`) devolvem o **slug técnico** do concept; o
`CompanyOnboardingWizard.tsx:300` renderiza esse slug (`<h3>{c.slug}</h3>`) — o usuário vê
`varejo-alimentar-especializado-carnes` em vez de "Açougue". A auditoria read-only `F-PJ-CONCEPT-DISPLAY-NAME`
comparou três opções (A coluna em `concepts` · B tabela `concept_labels` · C reutilizar campo existente) e Clayton
decidiu **B**.

## 6. Problema
`concepts` não tem nome legível (só `slug`/`domain`). A UI vaza slug técnico. Onde colocar o label sem corromper a
separação **identidade × apresentação**? Coluna em `concepts` (A) é barata hoje mas mistura apresentação na
identidade e força re-migração quando vier locale/contexto (falso barato). Reutilizar campo (C) é impossível — não
existe campo legível vivo.

## 7. Evidência material (auditoria read-only `F-PJ-CONCEPT-DISPLAY-NAME`; banco/código vivos, HEAD `7725a13f`)
1. `concepts` = `concept_id` (uuid PK), `slug` (text), `domain` (FK `domains`), `created_at`. **Nenhum** campo legível.
2. **Não existe** tabela `concept_labels`/`concept_names` nem campo `name`/`label`/`display_name` vivo.
3. UI mostra slug HOJE: `frontend/src/components/company/CompanyOnboardingWizard.tsx:300` → `<h3>{c.slug}</h3>` + `<p>{c.domain}</p>`.
4. Endpoints expõem slug sem label: `companiesService.listAllowedConceptsForCompanyType` (slug/domain) e
   `companiesService.suggestConceptForCnae` (devolve `suggestedConceptDisplayName=null` por design honesto).
5. **Norma:** `18_DOMAIN_ONTOLOGY_UNIFICARD §5.2.2` modela o CONCEPT com `display_names: LocalizedName[]`
   (value/locale/priority/context) — label é **camada localizada de apresentação**, separada de identity
   (canonical_id/slug/aliases). A tabela governada é o aterramento desse modelo.

## 8. Decisão
O display name de concept mora em **`concept_labels`** (tabela governada). `concepts` **não** ganha `display_name`.
O label é **read-model/apresentação governada**; `concept_id`/`slug` seguem como identidade técnica/semântica (SSOT).
Locale fica **preparado** (`locale='pt-BR'` default) sem i18n runtime agora. **Sem schema/seed/endpoint nesta DECISION.**

## 9. Decisões D1–D12

**D1 — Label não é identidade.** O display name é apresentação; nunca chave de identidade. Proibido resolver concept
**por** label; proibido usar label em `WHERE`/`JOIN` de identidade.

**D2 — `concepts` fica seco.** `concepts` **não** ganha `display_name`/`name`/`label`. Permanece `concept_id`, `slug`,
`domain` (+ timestamps). Identidade ≠ apresentação.

**D3 — `slug` continua técnico/canônico.** O slug é o identificador técnico estável; não vira "nome bonito".

**D4 — Casa do label: `concept_labels` (governada).** Camada de apresentação localizada, ancorada em
`concepts(concept_id)`.

**D5 — Shape mínimo aprovado** (a DESENHAR/implementar em frente futura, não agora):
  - `id UUID PRIMARY KEY`
  - `concept_id UUID NOT NULL REFERENCES concepts(concept_id)`
  - `locale TEXT NOT NULL DEFAULT 'pt-BR'`
  - `context_key TEXT NOT NULL DEFAULT 'default'`
  - `label TEXT NOT NULL`
  - `short_label TEXT NULL`
  - `is_primary BOOLEAN NOT NULL DEFAULT true`
  - `source TEXT NOT NULL`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

**D6 — Constraints mínimas:** FK → `concepts(concept_id)`; `label` não-vazio; `locale` não-vazio; `context_key`
não-vazio; **um primary por concept/locale/context** via índice único parcial
`UNIQUE (concept_id, locale, context_key) WHERE is_primary = true` (ou equivalente PostgreSQL válido).

**D7 — Label é read-model.** Apresentação governada; nunca SSOT semântico; nunca auto-derivado do slug **como
verdade** (de-kebab é fallback fraco; preferir curado; auto-derivação só para não-MVP, marcada `source='auto'`).

**D8 — Sem i18n runtime agora.** Apenas a coluna `locale` (default `'pt-BR'`) preparada; nenhuma máquina de tradução.

**D9 — Exposição por JOIN.** Os endpoints (`listAllowedConceptsForCompanyType`, `suggestConceptForCnae`) expõem
`displayName` por **JOIN/projeção** (1 round-trip), com **fallback honesto**: sem label → `null` no backend; o
frontend mostra o slug (`displayName ?? slug`).

**D10 — Labels MVP curados (seed inicial, em fatia futura):**
  - `varejo-alimentar-integrado` → **"Supermercado"**
  - `varejo-alimentar-especializado-hortifruti` → **"Hortifruti"**
  - `varejo-alimentar-especializado-carnes` → **"Açougue / Varejo de Carnes"**
  - `varejo-alimentar-especializado-padaria` → **"Padaria"**
  - `saude-varejo-farmaceutico` → **"Farmácia"**
  - `servicos-pessoais-beleza` → **"Salão de Beleza / Estética"**
  - `alimentacao-servico-preparado` → **"Restaurante"**
  (Se houver candidato secundário de salão/estética no CNAE, usar o **mesmo** concept `servicos-pessoais-beleza` /
  mesmo label primário — não duplicar concept.)

**D11 — Sequência autorizada (execução futura, em fatias separadas):**
  1. **Esta DECISION** (docs-only) — ratifica B; `concept_labels` = apresentação governada; `concepts` não ganha
     `display_name`; label nunca é chave de identidade; registra o shape mínimo.
  2. `F-PJ-CONCEPT-LABELS-SCHEMA-MIGRATION` — schema-only `concept_labels` + e2e schema (CHECK/FK/UNIQUE-parcial).
  3. `F-PJ-CONCEPT-LABELS-SEED-MVP` — seed pt-BR curado dos concepts MVP (D10).
  4. `F-PJ-CONCEPT-LABELS-EXPOSE-ENDPOINTS` — JOIN em `listAllowedConceptsForCompanyType` + `suggestConceptForCnae`
     (`displayName`, fallback null).
  5. `F-PJ-CONCEPT-LABELS-WIZARD` — frontend renderiza `displayName ?? slug`.

**D12 — Bloqueios.** Esta DECISION NÃO autoriza: migration; seed; endpoint; frontend; i18n runtime; mexer em CNAE
(além de, depois, expor `displayName` por JOIN); Trilhos A/B; Bank; coluna em `concepts`.

## 10. O que esta DECISION ratifica
- **Separação identidade × apresentação** (Lei 7 — CONCEPT = SSOT semântico; label = projeção governada), aterrando
  o `display_names` localizado de `18_DOMAIN_ONTOLOGY §5.2.2`.
- **Ratifica** `project_frontend_nunca_cria_verdade` (label é apresentação, não verdade nova) e a disciplina
  "identidade ≠ apresentação" (mesma do "CNAE é sinal, não identidade" — DECISION-0104).

## 11. O que NÃO está autorizado
Ver D12. Em particular: nenhuma `concept_labels` criada agora; nenhum seed; nenhum endpoint/JOIN; nenhuma coluna em
`concepts`; nenhuma resolução de concept por label.

## 12. Impacto em DTs
- `DT-PJ-CONCEPT-DISPLAY-NAME-MISSING` → **GOVERNED / DECISIONED** (casa/shape definidos; **não CLOSED** — só fecha
  após schema + seed + endpoints + frontend mínimo verificados, conforme D11/critério de fechamento).

## 13. Critério de fechamento (da DT, em frentes futuras)
- UI não exibe mais slug técnico quando existir label.
- `suggestConceptForCnae` pode retornar `suggestedConceptDisplayName`.
- `listAllowedConceptsForCompanyType` pode retornar `displayName`.
- Fallback honesto: sem label → `null` no backend; frontend mostra slug.
- DT só fecha após **schema + seed + endpoints + frontend mínimo** verificados.

## 14. Referências normativas
`18_DOMAIN_ONTOLOGY_UNIFICARD §5.2.2` (display_names localizado) · `LEIS_OPERACIONAIS` (Lei 7 — CONCEPT = SSOT) ·
`SSOT_REGISTRY` · `07_NOMENCLATURA` · `project_frontend_nunca_cria_verdade` · `DECISION-0098` (par = SSOT ativação) ·
`DECISION-0104` (CNAE sinal não identidade) · `DECISION-0105` (concepts.domain multi-camada).

## 15. Referências de estado/commits
HEAD origem `7725a13f`. Substrato vivo: `concepts` (concept_id/slug/domain/created_at, sem legível); sem
`concept_labels`; `CompanyOnboardingWizard.tsx:300` renderiza slug; `suggestConceptForCnae`/
`listAllowedConceptsForCompanyType` expõem slug. Auditoria read-only `F-PJ-CONCEPT-DISPLAY-NAME`.
