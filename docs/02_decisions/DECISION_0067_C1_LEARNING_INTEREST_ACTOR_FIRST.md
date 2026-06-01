# DECISION-0067 — C1_LEARNING_INTEREST_ACTOR_FIRST

**Status:** RATIFICADA — DECISÃO DE ARQUITETURA/DESENHO; IMPLEMENTAÇÃO (MIGRATION/BACKEND/FRONTEND) NÃO AUTORIZADA NESTA DECISION (2026-06-01).
**Sessão:** 2026-06-01 (pós-desenho read-only do C1 Learning/Interest, pós-Migrations A+B).
**Decisor:** Clayton (escolha Opção C + campos + ordem de fatias + vetos).
**Commit âncora:** documental. HEAD de origem do desenho: `ff7495c5`.
**Documento canônico:** este arquivo.
**Deriva de / subordinada a:** DECISION-0063 (padrão C1 profissional — template material), DECISION-0064 (Opção C híbrida governada), 0065 (Learning), 0066+ADENDO A (Interest).
**Vinculada a:** DTs `DT-LEARNING-INTEREST-BLOB-SSOT`, `DT-LEARNING-CATEGORIES-MISSING-CONCEPT-ID`, `DT-INTEREST-SCOPE-EMPTY`, `DT-PROFILE-FRONTEND-DRIVES-TAXONOMY`, `DT-LIFESTYLE-SENSITIVE-IN-BLOB`.

---

## 1. Contexto

Learning e Interest já têm **substrato semântico governado** (Migration A `6d9e9a29`: 36 concepts +
associação `scope='learning'`; Migration B `ff7495c5`: 11 concepts novos + árvore `scope='interest'`). As
abas salvam (`/profile/learning` e `/profile/physical` → 200). **Porém a persistência ainda é o blob
`global_users.metadata` (global-user-keyed)** — `DT-LEARNING-INTEREST-BLOB-SSOT` OPEN. O C1 precisa tornar
as abas **porta de entrada para SSOT actor-first**: gravar declarações em substrato próprio
`tenant_id + actor_id + concept_id` (+ `source_category_id` breadcrumb), espelhando o C1 profissional
selado (DECISION-0063 / `actor_professional_concepts`).

**Material verificado (read-only):** `actor_learning_concepts`/`actor_interest_concepts`/
`actor_concept_declarations_v` **AUSENTES** (build limpo); `actor_professional_concepts` EXISTE (template);
**0 global_users com learnings/interests no blob** (dev) → migração de dados é no-op seguro. `actors` tem
invariante `chk_actors_actor_id_equals_id` (actor_id = id).

## 2. Opções consideradas

- **A** — duas tabelas separadas (`actor_learning_concepts`, `actor_interest_concepts`).
- **B** — tabela genérica `actor_concept_declarations(..., declaration_type)`.
- **C** — duas tabelas separadas para escrita + view read-only unificada.

## 3. Escolha

**OPÇÃO C — duas tabelas separadas (escrita) + view read-only unificada.**
- Tabelas futuras: **`actor_learning_concepts`** · **`actor_interest_concepts`**.
- View futura: **`actor_concept_declarations_v`** (UNION read-only de professional + learning + interest).

## 4. Justificativa

- **Espelha o C1 profissional** (que é tabela própria, não genérica) → coerência manda learning/interest
  serem tabelas próprias.
- **Evita re-blob:** os atributos de declaração divergem (professional: skill_level/years; learning:
  progress; interest: nenhum). Tabela genérica exigiria `attrs jsonb` (re-blob, vetado) ou colunas nullable
  misturadas (ambiguidade). Tabelas próprias mantêm cada declaração **tipada e auditável por linha**.
- Mantém **Learning ≠ Professional ≠ Interest** semanticamente separados.
- A **view** dá leitura agregada (matching/feed/grafo futuro) **sem criar SSOT paralelo** (read-only).

## 5. DDL conceitual (NÃO criar nesta DECISION)

**`actor_learning_concepts`** (1:N declarações de aprendizado):
`id UUID PK · tenant_id UUID NOT NULL FK→tenants(id) · actor_id UUID NOT NULL FK→actors(id) ·
concept_id UUID NOT NULL FK→concepts(concept_id) · source_category_id UUID NULL FK→categories(category_id) ·
progress SMALLINT NULL CHECK (NULL OR 1..3) · is_active BOOLEAN NOT NULL DEFAULT true ·
declared_at/updated_at TIMESTAMPTZ NOT NULL · retired_at TIMESTAMPTZ NULL ·
UNIQUE(tenant_id, actor_id, concept_id) · CHECK lifecycle (is_active XOR retired_at) ·
INDEX (tenant_id, concept_id)`.

**`actor_interest_concepts`** (1:N declarações de interesse — binário):
mesmas colunas **sem `progress`** (interest MVP é binário). Mesmas FKs/UNIQUE/CHECK/INDEX.

**`actor_concept_declarations_v`** (view read-only): `UNION ALL` de
`actor_professional_concepts`/`actor_learning_concepts`/`actor_interest_concepts` projetando
`kind, tenant_id, actor_id, concept_id, source_category_id, is_active, declared_at`.

**Campos:**
- `progress` em Learning = **estágio de exploração (1..3), NÃO competência** (Learning ≠ Professional; sem
  skill_level/years_experience).
- Interest **binário** no MVP — sem `weight`/`priority`/atributo adicional.
- **Sem tabela de bio/profile** para Learning/Interest nesta fase (não existe bio nesses contratos).

## 6. Contrato futuro de API (espelha C1 profissional)

- **`/profile/learning/c1`:** `GET` → `{ concepts: [{ conceptId, sourceCategoryId, progress, isActive,
  declaredAt, updatedAt, retiredAt }] }` · `POST /concepts {conceptId, sourceCategoryId?, progress?}` ·
  `PATCH /concepts/:conceptId {progress?, reactivate?}` · `DELETE /concepts/:conceptId` (desativação lógica).
- **`/profile/interest/c1`:** `GET` → `{ concepts: [{ conceptId, sourceCategoryId, isActive, declaredAt,
  updatedAt, retiredAt }] }` · `POST /concepts {conceptId, sourceCategoryId?}` · `DELETE /concepts/:conceptId`
  (PATCH só `reactivate`, se necessário).
- **READ camelCase / WRITE camelCase (inputs) / interno snake_case.** `concept_id` obrigatório;
  `actor_id` resolvido via writer §4.8.1 (não `global_user_id` solto); `source_category_id` só breadcrumb.

## 7. Vetos (vinculantes)

- ❌ Tabela genérica com `attrs jsonb` (re-blob).
- ❌ `global_user_id` como identidade operacional (identidade operacional = `actor_id` via writer §4.8.1).
- ❌ `categoryId` como identidade semântica (identidade = `concept_id`).
- ❌ Lifestyle sensível nesta frente (`DT-LIFESTYLE-SENSITIVE-IN-BLOB` — frente própria, LGPD).
- ❌ Inferred profile na mesma tabela (declarado ≠ inferido; inferência = GRAPH, substrato separado).
- ❌ Professional/capability/authority/oferta/agenda/financeiro no C1 Learning/Interest.
- ❌ `global_users.metadata` como destino (dívida transitória).

## 8. Ordem das fatias (decidida)

1. **Fatia 1 — schema migration:** criar `actor_learning_concepts` + `actor_interest_concepts` + view
   `actor_concept_declarations_v` (additive, 0 rows, forward-only/fail-closed). Zero backend/frontend.
2. **Fatia 2 — backend C1:** repository/service/routes `/profile/learning/c1` e `/profile/interest/c1`
   (espelhar `professional-c1.*`).
3. **Fatia 3 — backfill:** migrar `global_users.metadata` → C1, idempotente (DEV: 0 dados → no-op seguro).
4. **Fatia 4 — frontend:** migrar abas Learning/Interest para o C1 (conceptId).
5. **Fatia 5 — cleanup:** remover persistência learning/interests do blob, **mantendo Lifestyle fora**.

Cada fatia = prompt executor próprio com ratificação. O C1 profissional permanece **selado e intocado**.

## 9. Impacto nas DTs (nenhuma fechada nesta DECISION)

- `DT-LEARNING-INTEREST-BLOB-SSOT`: CLOSE só **após a Fatia 5** (persistência sai do blob).
- `DT-PROFILE-FRONTEND-DRIVES-TAXONOMY`: CLOSE só **após a Fatia 4** (frontend).
- `DT-LEARNING-CATEGORIES-MISSING-CONCEPT-ID` / `DT-INTEREST-SCOPE-EMPTY`: já PARTIALLY MITIGATED por
  substrato (Migrations A/B); CLOSE quando o C1 for o destino de gravação.
- `DT-LIFESTYLE-SENSITIVE-IN-BLOB`: permanece **fora** (frente própria).

## 10. Escopo / próxima frente

**Esta DECISION NÃO autoriza migration/backend/frontend** — fixa modelo (Opção C), campos, contrato, vetos
e ordem. Próxima fatia material = **Fatia 1 (schema migration C1 Learning/Interest)**, prompt executor
próprio com ratificação, ciclo fechado (migration + validação + gates + STATUS/opus/DTs).
