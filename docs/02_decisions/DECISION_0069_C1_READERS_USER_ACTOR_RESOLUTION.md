# DECISION-0069 — Readers user-scoped resolvem declarações C1 pelo actor user

**Status:** RATIFICADA — EXECUTADA (F1: helper de leitura + provas) (2026-06-01).
**Sessão:** 2026-06-01 (pós-selo `SELO_C1_LEARNING_INTEREST.md`; auditoria read-only dos readers backend).
**Decisor:** Clayton (escolha da regra de resolução de actor + abertura da fatia F1).
**Commit âncora:** HEAD origem `392cd68b`.
**Documento canônico:** este arquivo.
**Complementa (sem revogar):** DECISION-0067 (C1 actor-first), DECISION-0068 (surfacing de conceptId),
`SELO_C1_LEARNING_INTEREST.md` (§5.1 resíduo "readers backend → C1").
**Vinculada a:** `DT-C1-READERS-BLOB-TO-C1` (OPEN), `DT-C1-LEARNING-INTEREST-REACTIVATION` (não tocada).

---

## 1. Contexto

A frente Learning/Interest → C1 está selada: a escrita e o frontend usam o C1 actor-first
(`actor_learning_concepts` / `actor_interest_concepts`), e o blob `global_users.metadata.{learnings,interests}`
foi removido. **Porém os readers backend** (`profile-inference.service`, `opportunity.service`,
`core.service`) ainda chamam os leitores legados (`getLearningProfile` / `getPhysicalProfile`), que hoje
retornam **vazio** (o blob não guarda mais essas chaves). Esses readers operam por **`userId`**, mas o C1 é
**actor-first** (leitura por `actor_id`). É preciso uma ponte de resolução `userId → actor` antes de migrar
os consumidores.

## 2. Decisão

**Readers user-scoped resolvem `userId → actors.actor_id`** com a query explícita:
`tenant_id = $1 AND user_id = $2 AND actor_type = 'user'`.

- **Sem criação:** o helper **NUNCA** chama `ensureUserActor`, **NUNCA** cria actor por leitura.
- **Sem fallback de identidade:** **não** usar `global_user_id` como identidade operacional final.
- **Sem actor (0 linhas):** retornar **vazio controlado** (`{ actorId: null, learning: [], interests: [] }`),
  **nunca** 500.
- **Ambiguidade (>1 linha):** **falha fechada** com erro explícito
  **`USER_ACTOR_AMBIGUOUS_FOR_C1_DECLARATIONS`** (não escolher arbitrariamente).
- **Fonte de leitura:** view read-only **`actor_concept_declarations_v`** (UNION C1), filtrando
  `declaration_kind IN ('learning','interest')` e `is_active = true`. **`concept_id` = identidade.**
- **`source_category_id`** é **breadcrumb opcional** (LEFT JOIN `categories` para `name`/`path`); se nulo ou
  irresolúvel, **não inventar categoria** (categoryName=null, categoryPath=[]). **Sem** fallback
  `conceptId ← categoryId`.

## 3. Escopo desta fatia (F1)

Entregar **somente a infraestrutura de leitura** reutilizável; **não** migrar consumidores.
- `backend/src/core/profile/profile-c1-declarations-read.service.ts` (+ `.repository.ts`).
- API: `getUserActorConceptDeclarationsForProfile(tenantId, userId)` (+ wrappers só-learning / só-interest)
  e `resolveUserActorId(tenantId, userId)`.
- Shape de saída: `{ actorId, learning: [{conceptId, sourceCategoryId, categoryName, categoryPath,
  progress, progressLevel}], interests: [{conceptId, sourceCategoryId, categoryName, categoryPath}] }`.
- Mapeamento de progress: `1→beginner`, `2→intermediate`, `3→advanced`, `null→null`.

## 4. Vetos (vinculantes)

- ❌ `ensureUserActor` / qualquer criação de actor em leitura.
- ❌ `global_user_id` como identidade operacional final.
- ❌ `SELECT *`; ❌ leitura de `global_users.metadata`.
- ❌ fallback `conceptId ← categoryId`; ❌ inventar categoria quando `source_category_id` é nulo.
- ❌ misturar Professional (`declaration_kind='professional'` é excluído da leitura).
- ❌ Lifestyle/Saúde; ❌ financeiro; ❌ escrita; ❌ Agenda.
- ❌ migrar `profile-inference`/`opportunity`/`core.service` nesta fatia.

## 5. Consequência / Provas (F1)

Helper provado runtime (actor dev resolvido dinamicamente; declarações C1 reais seedadas via services C1 e
removidas ao fim): CASE1 actorId = actor user (match) + learning=3/interests=1; CASE2 progress 1/2/3 →
beginner/intermediate/advanced (conceptId real, name/path do breadcrumb); CASE3 interest com conceptId +
sourceCategoryId; CASE4 user sem actor → vazio controlado (não 500); ambiguidade coberta por
`rows.length > 1 → USER_ACTOR_AMBIGUOUS_FOR_C1_DECLARATIONS`. Gates: typecheck 0; actor-writer/bank-ledger/
regression OK; architectural-patterns `critical_new=0`. Zero consumidor migrado; zero frontend/migration/
schema/financeiro/Lifestyle/Saúde/Agenda/Professional.

## 6. Próximas fatias (não autorizadas aqui)

- **F2 — `profile-inference.service.ts`** → usar o helper (concept-first; adaptar REGRA A/B para resolver
  grafo a partir do `conceptId`; mapear progress). Conserta feed/matching/opportunity/inference-routes.
- **F3 — `opportunity.service.ts`** → remover a leitura direta legada (gate vira count do helper/inferência).
- **F4 — `core.service.getCompleteProfile`** → `physical_profile.interests` ← helper (lifestyle/health
  permanecem legado).

## 7. Superada por

(em aberto — decisão vigente)
