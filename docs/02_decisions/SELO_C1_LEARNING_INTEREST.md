# SELO C1 — Learning/Interest → actor-first/concept-first (Fatias 1–5)

## C1 LEARNING/INTEREST — CONCLUÍDO — 2026-06-01

Selo documental de encerramento da frente **Learning/Interest → C1 actor-first**. Consolida as Fatias 1–5
(governança semântica → substrato → backend → backfill → frontend → cleanup do blob) e deixa explícitos os
resíduos que **não pertencem mais** à frente principal.

- **HEAD selado:** `9c3af519` (Fatia 5 — cleanup do blob).
- **Documento canônico de desenho:** `DECISION-0067` (Opção C: 2 tabelas + view).
- **Subordinado a:** Lei 7 (CONCEPT = SSOT semântico), `00_AGENT_PROTOCOL.md` §2.3.4/§2.3.5 (PROFILE = read
  model; derivação category→concept), DECISION-0063 (padrão C1 profissional — template material selado).
- **Escopo do selo:** documental. Não promulga norma nova; consolida o que já foi executado e ratificado por
  fatia.

---

## 1. Estado final

| Eixo | Estado |
|------|--------|
| **Learning — escrita** | grava em **`actor_learning_concepts`** (`tenant_id + actor_id + concept_id` + `source_category_id` breadcrumb + `progress` 1..3 de exploração + `is_active`/`retired_at`) via `/profile/learning/c1`. |
| **Interest — escrita** | grava em **`actor_interest_concepts`** (mesmas colunas, **binário** — sem `progress`) via `/profile/interest/c1`. |
| **Leitura agregada** | view read-only **`actor_concept_declarations_v`** (UNION de professional + learning + interest) existe; sem SSOT paralelo. |
| **Blob `metadata.learnings`** | **REMOVIDO** de `global_users.metadata` (migration `20260601160000`). |
| **Blob `metadata.interests`** | **REMOVIDO** de `global_users.metadata` (migration `20260601160000`). |
| **Escrita legada** | `PUT /profile/learning` → **501** (→ `/profile/learning/c1`); `PUT /profile/physical` não grava mais `interests` (preserva lifestyle). |
| **Lifestyle** | permanece **FORA** desta frente (`metadata.lifestyle` intocado — frente própria, LGPD). |

---

## 2. Cadeia de commits selada

| Commit | Etapa | Conteúdo |
|--------|-------|----------|
| `e908f3c7` | DTs | Registro das dívidas Learning/Interest Lei 7 (abertura da frente). |
| `cf791d1f` | **DECISION-0064** | Governança semântica Learning/Interest — Opção C híbrida (categories=navegação, concepts=identidade). |
| `233cb428` | **DECISION-0065** | Diretrizes materiais Learning concepts (slug limpo, domínio `educacao-e-conhecimento`). |
| `6d9e9a29` | **Migration A** | 36 concepts em `educacao-e-conhecimento` + associação de 36 folhas `scope='learning'`. |
| `a602d2dd` | **DECISION-0066** | Diretrizes materiais Interest concepts (árvore mínima governada). |
| `963649af` | **DECISION-0066 ADENDO A** | Slugs de category `scope='interest'` com sufixo `-interesse` (`categories_slug_key` UNIQUE global); concepts mantêm slug limpo compartilhado. |
| `ff7495c5` | **Migration B** | 11 concepts novos em `cultura-lazer-e-eventos` + árvore `scope='interest'` (7 raízes sem concept + 38 folhas com concept; 27 reusam concepts de learning). |
| `b445cf4a` | **DECISION-0067** | Desenho C1 actor-first (Opção C: `actor_learning_concepts` + `actor_interest_concepts` + view; contrato; ordem das fatias). |
| `0299459b` | **Fatia 1 — schema** | Migration `20260601140000`: cria as 2 tabelas + view (additive, 0 rows, FK/UNIQUE/CHECK/índices). |
| `4abf8a90` | **Fatia 2 — backend C1** | Rotas/services/repos `/profile/{learning,interest}/c1` (espelha `professional-c1`). Provado runtime. |
| `827c0b07` | **Fatia 3 — backfill** | Migration `20260601150000`: blob → C1 (forward-only, idempotente, fail-closed; DEV = no-op, 0 dados). |
| `ff534b44` | **DECISION-0068 / Fatia 4a** | `categories.service.ts` surfaça `conceptId` nas leituras dos contextos declarativos professional/learning/interest (helper `canExposeCategoryConceptId`). |
| `eca51cbc` | **Fatia 4b — Learning frontend** | Aba Aprendizado → C1 (client `learningC1.ts`; save granular; conceptId real; IA de taxonomia neutralizada). |
| `f639516f` | **Fatia 4c — Interest frontend** | Seção de Interesses do `ProfilePhysical` → C1 (client `interestC1.ts`; catálogo hardcoded fake removido; árvore real `scope='interest'`; lifestyle intocado). |
| `9c3af519` | **Fatia 5 — cleanup blob** | Migration `20260601160000` remove chaves `learnings`/`interests`; `updateLearningProfile` removido + PUT 501; `updatePhysicalProfile` não grava interests (preserva lifestyle). **Fecha DT-BLOB-SSOT.** |

---

## 3. Invariantes preservados (provados ao longo das fatias)

- **`concept_id` = identidade semântica** (SSOT, Lei 7). A folha só é declarável com `conceptId` real
  surfaçado pelo backend (FK → `concepts`). **Sem fallback `conceptId = categoryId`.**
- **`category_id` / `source_category_id` = breadcrumb/navegação** — rastreio de origem e resolução de
  label/path; **nunca** identidade semântica nem `concept_ref` transacional.
- **`actor_id` = identidade operacional** (resolvido via writer §4.8.1 / `req.actionContext.actorId`).
- **Sem `global_user_id` como SSOT final** — o blob global-user-keyed deixou de ser destino; identidade
  operacional é `actor_id`.
- **Sem blob JSONB como destino** — `global_users.metadata.{learnings,interests}` removido; a verdade é
  tabela própria por declaração, auditável por linha.
- **Sem frontend criando taxonomia** — abas Aprendizado e Interesses não chamam `createCategoryWithAI`/
  `suggestCategoryPath`; texto livre / catálogo fake removidos. UI só projeta verdade resolvida.
- **Sem financeiro** — nenhum toque em bank/ledger/split/payout/wallet em nenhuma fatia.

---

## 4. DTs

| DT | Status final | Nota |
|----|--------------|------|
| `DT-LEARNING-INTEREST-BLOB-SSOT` | **CLOSED** (Fatia 5) | Persistência saiu do blob; chaves removidas; provado runtime (writes neutralizados, blob sem chaves antes/depois). |
| `DT-LIFESTYLE-SENSITIVE-IN-BLOB` | **OPEN** | Frente própria (LGPD) — `metadata.lifestyle` (drinks/smokes/relationshipStatus/sexualOrientation) fora desta frente. |
| `DT-PROFILE-FRONTEND-DRIVES-TAXONOMY` | **PARTIALLY MITIGATED** | Aprendizado e Interesses já não dirigem taxonomia; CLOSE pendente de varredura de outros fluxos (ex.: aba Profissional). |
| `DT-C1-LEARNING-INTEREST-REACTIVATION` | **OPEN LOW** | Re-declarar concept retirado → 409 (UNIQUE); reativação correta é `PATCH {reactivate:true}`. Follow-up, fora do cleanup. |

---

## 5. Resíduos fora do selo (não pertencem mais à frente principal)

1. **Readers backend ainda no blob (vazio):** `opportunity.service`, `profile-inference.service` e
   `core.service` ainda chamam `getLearningProfile`/`getPhysicalProfile`, que agora retornam
   learnings/interests **vazios** (degradam sem crash; não persistem verdade). Migrá-los para ler o C1
   (`actor_learning_concepts`/`actor_interest_concepts` ou a view) é **frente própria**.
2. **Reativação após soft-delete:** `DT-C1-LEARNING-INTEREST-REACTIVATION` — distinguir "novo" de
   "reativação" no save granular do frontend. **Follow-up**, não cleanup.
3. **Lifestyle/Saúde:** `DT-LIFESTYLE-SENSITIVE-IN-BLOB` — dado pessoal sensível em blob sem SSOT próprio.
   **Frente própria** (LGPD).
4. **Agenda/TEMPO:** disponibilidade/agenda permanece **frente própria** — não tocada por esta frente.

---

## 6. Ratificação

- **Executora `unificard` (Claude):** executou as Fatias 1–5 por prompt ratificado de Clayton, ciclo fechado
  por fatia (read-first → escopo → provas runtime → gates → docs/DTs → commit único).
- **Clayton:** sequenciou e promulgou as DECISIONs; autoriza este selo de encerramento documental.

**Validação aceita (Fatia 5, HEAD `9c3af519`):** backend + frontend `tsc --noEmit` = **0**;
`validate:actor-writer-boundaries` OK · `validate:bank-ledger-boundaries` OK · `validate:regression-guards`
OK (344 migrations) · `validate-architectural-patterns --strict` **`critical_new=0`**, `critical_total=20`
sem aumento (único `warning_new` é pré-existente, não desta frente). Migration `20260601160000` idempotente
(re-run = 0 linhas); blob sem `learnings`/`interests` antes e depois do PUT legado.

**Frente Learning/Interest → C1 actor-first: CONCLUÍDA.**
