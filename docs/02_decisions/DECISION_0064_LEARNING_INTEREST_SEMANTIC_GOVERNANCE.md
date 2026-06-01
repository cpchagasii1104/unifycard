# DECISION-0064 — LEARNING_INTEREST_SEMANTIC_GOVERNANCE

**Status:** RATIFICADA — DECISÃO DE GOVERNANÇA/DESENHO; IMPLEMENTAÇÃO (MIGRATION/C1) NÃO AUTORIZADA NESTA DECISION (2026-06-01).
**Sessão:** 2026-06-01 (promulgação documental pós-auditoria read-only Learning/Interest Lei 7).
**Decisor:** Clayton (escolha de Opção C + vetos).
**Ratificação acumulada:** auditoria read-only (executora `unificard`) + decisão de Clayton.
**Commit âncora:** documental (sem código). HEAD de origem da auditoria: `e908f3c7`.
**Natureza:** DECISION de GOVERNANÇA SEMÂNTICA + DESENHO. **NÃO** implementa schema, **NÃO** cria concepts, **NÃO** associa categories, **NÃO** é migration.

---

## 1. Contexto

As abas **Aprendizado** e **Interesses** do perfil estão **mortas**: mostram opções, mas não salvam. Diagnóstico material da auditoria read-only (HEAD `e908f3c7`, DTs registradas `DT-LEARNING-INTEREST-BLOB-SSOT`, `DT-LEARNING-CATEGORIES-MISSING-CONCEPT-ID`, `DT-INTEREST-SCOPE-EMPTY`, `DT-PROFILE-FRONTEND-DRIVES-TAXONOMY`, `DT-LIFESTYLE-SENSITIVE-IN-BLOB`):

- Persistência atual = blob `global_users.metadata` (`learnings`/`interests` como arrays de `categoryId`, global-user-keyed, sem `concept_id`).
- Os guards Lei 7 (`category-navigation-bridge.ts`, `requireCategoriesWithConceptForScope`) **bloqueiam corretamente** a deriva semântica (falham fechado): Aprendizado → 44 categorias `scope='learning'` com `concept_id=NULL` → save 400 "concept_id obrigatório"; Interesses → `scope='interest'` com 0 categorias → save 400 "fora do escopo".
- **O problema NÃO é bug de frontend nem guard errado: é ausência de vocabulário semântico governado.** Verificação read-only: dos 90 concepts existentes, ~0 servem Learning/Interest (são financeiros/comerciais/mobilidade + 3 médicos + 5 produtos/5 serviços); `educacao-e-conhecimento` tem 0 concepts; 0 overlap entre `learning.slug` e `concept.slug`.
- Infraestrutura de governança **existe e é robusta**: `core/ontology/concept-governance.service.ts` (trigger `0075`), `core_invariant.create_category_from_concept` (mig. `0110`/`0097`), `n1/n2-governance.service.ts`. Falta **dado** (concepts) e **associação governada**.
- Padrão de referência já provado: **C1 profissional** (`actor_professional_concepts`, DECISION-0063): actor-first + concept-anchored, `source_category_id` como breadcrumb.

## 2. Opções consideradas

- **Opção A** — `categories` learning/interest com `concept_id` obrigatório (UI navega por categories; folha só declarável se tiver concept).
- **Opção B** — UI navega direto por `concepts` (categories secundárias/inexistentes).
- **Opção C** — híbrido governado: `categories` para navegação, `concepts` para identidade, sugestão do usuário entra em fila governada, concept-governance associa/cria concept antes de a folha virar declarável.

## 3. Escolha

**OPÇÃO C — HÍBRIDO GOVERNADO.**

## 4. Regras decididas (vinculantes)

1. `categories` servem para **navegação/UX**; **`concepts` são a identidade semântica** (SSOT — Lei 7, §20 ONTOLOGIA, §8 LEI_COERENCIA).
2. A UI pode **navegar** por `categories`, mas **só folha com `concept_id` governado pode virar declaração**.
3. `source_category_id` é **breadcrumb/rastro de navegação, nunca identidade** (espelha C1 profissional).
4. Learning e Interest **podem compartilhar `concept_id`** quando o significado for comum (a CONCEPT é uma só), **mas a declaração é diferente**: Aprendizado = direção/exploração (progresso `beginner|intermediate|advanced`, não competência); Interesse = afinidade declarada (binária).
5. **Learning NÃO vira Professional** — mesma `concept_id` pode existir nos dois, mas a declaração de aprendizado não concede skill/competência/oferta/capability/authority.
6. **Interesse declarado NÃO vira interesse inferido** — declaração explícita (C1 actor-first) é substrato distinto de inferência (GRAPH/inference); nunca na mesma tabela/origem.
7. **Sugestão do usuário NÃO cria concept/category automaticamente** — entra em **fila governada / revisão**; criação de concept só via `concept-governance` (§5.5 ONTOLOGIA; trigger 0075).

## 5. Domínios

- **Learning concepts:** domínio **`educacao-e-conhecimento`** — domínio N0 canônico (18_DOMAIN_ONTOLOGY §7), **verificado presente na tabela `domains` (1 linha; 0 concepts hoje)**. Não inventado.
- **Interest:** criar/usar **árvore própria governada `scope='interest'`** (hoje inexistente), **compartilhando `concept_id`** quando o significado for comum a Learning/Professional/Global. **Não existe domínio `interesse`** — interesse é contexto/scope de navegação + declaração; a identidade vem dos concepts de domínios existentes (educacao, servicos, etc.). A correspondência exata concept↔folha de interest é **material da migration/desenho**, não fixada aqui.

## 6. Justificativa

- Preserva a **UX de navegação** por áreas (que a UI atual já usa).
- Mantém **CONCEPT como SSOT semântico** (Lei 7 intacta).
- **Repete o padrão C1 profissional** já selado (DECISION-0063) — actor-first + concept-anchored + breadcrumb.
- **Impede o frontend de criar taxonomia/semântica** (fila governada substitui `createCategoryWithAI`/`suggestCategoryPath` no fluxo de perfil).
- **Evita blob como SSOT** (sai de `global_users.metadata`).
- Permite **mesma `concept_id` em declarações distintas** sem misturar verdades.

## 7. Consequências

- **Curto prazo:** é necessário **criar/associar concepts de Learning/Interest via pipeline governado ANTES do C1** (frente material própria). Sem substrato semântico, o C1 nasce vazio igual ao atual. Magnitude real: criar o motor semântico de educação/interesse (~36+ concepts de learning + concepts/árvore de interest), não fricção local.
- **Médio prazo:** **C1 Learning/Interest actor-first + concept-first** (espelhar `actor_professional_concepts`), com modelo de tabela(s) a definir no DESENHO C1 (duas tabelas vs genérica — ver as 5 DTs).
- **Longo prazo:** perfil vira **porta de entrada para os SSOTs por actor**, não depósito JSONB.

## 8. Vetos explícitos (vinculantes)

- ❌ **SQL direto** para popular `categories.concept_id` (qualquer associação concept↔category só via pipeline governado: `concept-governance` + `create_category_from_concept`; §3 PLANO_N2).
- ❌ Remover/afrouxar `requireCategoriesWithConceptForScope` (guard Lei 7 correto, **permanece**; falha fechada é o comportamento desejado).
- ❌ `categoryId` como identidade semântica.
- ❌ Frontend criando concept/taxonomia (sugestão → fila governada).
- ❌ Abrir **C1 antes do substrato semântico governado** existir.
- ❌ Tocar Saúde/Lifestyle (`DT-LIFESTYLE-SENSITIVE-IN-BLOB` é frente própria), financeiro, Agenda.

## 9. Próxima frente recomendada (sequência)

1. **DESENHO/MIGRATION governada** de concepts/categories Learning/Interest: criar concepts via `concept-governance` (domínio `educacao-e-conhecimento` p/ learning; reuso para interest) + associar/projetar às 44 learning categories e criar árvore `scope='interest'` — **READ-FIRST** de `concept-governance.service.ts` e `core_invariant.create_category_from_concept`; sem frontend, sem blob, sem destravar guard via SQL direto.
2. **DESENHO C1 Learning/Interest** actor-first + concept-first (após o substrato semântico existir).

**Esta DECISION não autoriza a migration nem o C1 — apenas fixa o modelo (Opção C), os domínios e os vetos.** A migration de governança semântica e o DESENHO C1 são fatias separadas, com ratificação própria.
