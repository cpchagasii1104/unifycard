# DECISION-0068 — CONCEPTID_SURFACING_DECLARATIVE_CONTEXTS

**Status:** RATIFICADA — EXECUTADA (código + provas) (2026-06-01).
**Sessão:** 2026-06-01 (desbloqueio da Fatia 4 frontend Learning/Interest → C1).
**Decisor:** Clayton.
**Commit âncora:** HEAD de origem `827c0b07`.
**Documento canônico:** este arquivo.
**Complementa (não altera retroativamente):** DECISION-0064 (modelo Opção C) e DECISION-0067 (C1
Learning/Interest). Estende a aplicação de OPÇÃO B (07_NOMENCLATURA §4262/4278) sem revogar a proibição
transacional.

---

## 1. Contexto

A Fatia 4 (frontend Learning/Interest → C1) foi **corretamente parada** no READ-FIRST porque o frontend
não tinha como enviar `conceptId` real ao C1:
1. `ProfileLearning` carrega `getCategoryTree('learning')` e mantém só `categoryId` (sem `conceptId`).
2. `ProfilePhysical` usa catálogo hardcoded de interesses com `conceptId` textual fake (`'leisure.cinema'`).
3. `categories.service.ts` **removia `conceptId`** de toda leitura cujo `context !== 'professional'`
   (OPÇÃO B), incluindo `learning` e `interest`.
4. O C1 Learning/Interest exige `conceptId` UUID real (FK → `concepts`); não há fallback
   `conceptId ← categoryId` (vetado).

→ Sem surfacing de `conceptId` para `learning`/`interest`, o frontend declarativo não consegue alimentar
o C1.

## 2. Decisão

**`conceptId` é exposto nas LEITURAS de categoria APENAS para contextos DECLARATIVOS de perfil:**
- `professional`
- `learning`
- `interest`

Implementado por helper único `canExposeCategoryConceptId(context?)` em `categories.service.ts`, aplicado
nos 3 pontos de surfacing (`getCategoriesForTenant` / tree, `getChildren`, `autocompleteCategories`).
Contexto **omitido (undefined) ⇒ NÃO surfaçar** (default seguro; decide pelo `context` explícito, não pelo
fallback interno `effectiveContext`).

## 3. Justificativa (Lei 7 / 07 §4262/4278)

`professional`/`learning`/`interest` são **declaração de perfil actor-first/concept-first** — o actor
declara "competência/aprendizado/interesse no concept X". **Não** são `intent`, `offer`, `checkout`,
pagamento, marketplace transacional, serviço financeiro nem `concept_ref` transacional. A proibição de
07 §4262/4278 / Lei 7 é sobre derivar `concept_ref` **transacional** de `categories.concept_id`
(intent/offer/pricing/checkout) — **não se aplica** à exposição do `concept_id` para **declaração**.
`category_id` continua sendo navegação/breadcrumb; `concept_id` continua sendo identidade semântica.

## 4. Vetos

`conceptId` **NÃO** é exposto para contextos **não-declarativos**: `event`, `campaign`, `company`,
`health`/lifestyle, `group`, marketplace, checkout, offer, intent, pagamento, financeiro, nem qualquer
contexto transacional. Contexto **omitido** também não surfaça. Não transforma `categoryId` em identidade
(apenas deixa o frontend ver o `concept_id` real já associado).

## 5. Consequência

Desbloqueia a **Fatia 4b** (frontend Learning → C1: capturar `conceptId` da folha learning surfaçada) e a
**Fatia 4c** (redesenhar a seção de interesses do `ProfilePhysical` para navegar a árvore `scope='interest'`
com `conceptId` real). Nenhum dado/identidade nova criada; nenhuma alteração de schema, migration, C1
backend selado, frontend, financeiro ou blob.

## 6. Provas (executadas, HEAD pós-edição)

| Cenário | Resultado |
|---|---|
| tree `context=professional` | 3 folhas com conceptId (médicos) — preservado |
| tree `context=learning` | **36/36 folhas com conceptId UUID real** (antes 0) |
| tree `context=interest` | **38/38 folhas com conceptId UUID real** |
| children **sem context** (parent Medicina, 3 filhos) | **0 conceptId** (default seguro) |
| children `context=professional` (controle) | 3/3 conceptId |
| tree `context=event` / `context=company` | 0 conceptId (não-declarativo) |

## 7. Escopo

Esta DECISION + código alteram **apenas** `backend/src/core/categories/categories.service.ts`
(surfacing de leitura). **Não** tocam frontend, migration, schema, C1 backend, Profissional C1, Agenda,
Saúde/Lifestyle, financeiro nem blob. Próxima fatia: **4b (frontend Learning → C1)**.
