# DECISION-0065 — LEARNING_CONCEPTS_MATERIAL_DIRECTIVES

**Status:** RATIFICADA — DIRETRIZES MATERIAIS PRÉ-MIGRATION; IMPLEMENTAÇÃO (MIGRATION) NÃO AUTORIZADA NESTA DECISION (2026-06-01).
**Sessão:** 2026-06-01 (pós-desenho read-only da migration governada Learning/Interest).
**Decisor:** Clayton (6 decisões materiais).
**Commit âncora:** documental. HEAD de origem do desenho: `cf791d1f`.
**Documento canônico:** este arquivo.
**Deriva de / subordinada a:** **DECISION-0064** (modelo Opção C híbrida governada). Esta DECISION **não** altera 0064; materializa as decisões operacionais isoladas pelo desenho read-only.
**Vinculada a:** DTs `DT-LEARNING-INTEREST-BLOB-SSOT`, `DT-LEARNING-CATEGORIES-MISSING-CONCEPT-ID`, `DT-INTEREST-SCOPE-EMPTY`, `DT-PROFILE-FRONTEND-DRIVES-TAXONOMY`, `DT-LIFESTYLE-SENSITIVE-IN-BLOB`; DECISION-0063 (padrão C1 profissional).

---

## Contexto

DECISION-0064 fixou o modelo semântico Learning/Interest (Opção C: `categories`=navegação, `concepts`=SSOT
semântico). O desenho material read-only (HEAD `cf791d1f`) confirmou o pipeline governado vivo
(`concept-governance.service` / trigger `0075` / `core_invariant.create_category_from_concept` 0097/0110;
constraints `concepts UNIQUE(domain,slug)`, FK `domain→domains`, `categories.concept_id` FK→concepts
ON DELETE SET NULL, CHECK `chk_n2_requires_concept` só exige concept em level 2; `categories` SEM triggers
vivos) e isolou 6 decisões operacionais necessárias **antes** da Migration A de Learning. Esta DECISION as
registra.

## Decisões materiais

### 1. Slug do concept — tópico limpo
- Concepts de Learning usam o **slug limpo do tópico** (ex.: `fotografia`, `musica`, `programacao`),
  **sem** sufixo de contexto (`-aprendizado`).
- O contexto "aprendizado" pertence à **declaração futura** (C1 / scope), **não** à identidade semântica.
- As categorias existentes mantêm seus slugs de navegação (ex.: `fotografia-aprendizado`); o `concept_id`
  associado aponta para o concept de slug limpo.

### 2. Domínio da Migration A — `educacao-e-conhecimento`
- Os concepts de Learning desta fatia ficam no domínio **`educacao-e-conhecimento`** (N0 canônico, vivo
  em `domains`), seguindo DECISION-0064.
- A Migration A **NÃO** resolve o compartilhamento automático com Professional/Serviços.
- Se, no futuro, Professional precisar do mesmo tópico, **abrir decisão específica de ontologia/mapeamento**
  (não improvisar nesta migration).

### 3. Estratégia de associação — migration governada, árvore preservada
- **Preservar a árvore learning existente** (44 categorias, ids e slugs atuais).
- Criar os concepts pelo **caminho governado** (`set_config('app.concept_governance','true')` + INSERT
  ON CONFLICT, padrão migration 0094 / serviço `concept-governance`).
- Associar `concept_id` às **folhas learning existentes** por **migration governada**, com **mapping
  literal** (folha→concept) e **transação** única.
- **Explicitação normativa:** isto **NÃO é "SQL direto ad-hoc para destravar save"**. É **migration
  governada**, forward-only (Lei 2/Lei 6), documentada, com validação e ratificação. O veto da
  DECISION-0064 **continua valendo** contra UPDATE **manual, runtime, improvisado ou fora de migration
  governada**. A associação só é legítima dentro de uma migration revisada com mapping explícito.

### 4. Nível declarável — manter level 1
- Manter as folhas atuais de Learning em **`level=1`** como declaráveis.
- **NÃO** reestruturar para level 2 nesta fatia.
- **NÃO** usar `create_category_from_concept` se isso reestruturar a árvore e quebrar UX sem necessidade
  (a função cria level-2 com slug=concept.slug; reestruturaria a tree learning atual).
- Critério declarável = **folha com `concept_id` governado**, não o número do level isoladamente. (O guard
  `requireCategoriesWithConceptForScope` não checa level; exige scope + ativo + concept_id.)

### 5. Interest — fatia própria
- **NÃO** criar árvore `scope='interest'` na Migration A.
- Interest permanece para **fatia própria de desenho/migration** (hoje não há árvore nem decisão de
  produto suficiente).
- Learning e Interest **poderão compartilhar concepts** quando o significado for igual.

### 6. Compartilhamento de concept
- **Learning ↔ Interest:** permitido compartilhar `concept_id` quando o significado for comum.
- **Learning ↔ Professional/Serviços:** **NÃO** compartilhar automaticamente nesta etapa.
- Professional/Serviços = exercício/oferta/capability potencial; Learning = desejo de aprender. **Mesma
  palavra não implica mesma verdade operacional** (Learning ≠ Professional, reafirmando DECISION-0064).

## Vetos reafirmados (de 0064, vigentes)
Sem UPDATE manual/runtime/ad-hoc de `categories.concept_id` (só migration governada com mapping) · guard
`requireCategoriesWithConceptForScope` permanece · sem `categoryId` como identidade · sem frontend criando
concept/taxonomia · **sem C1 antes do substrato semântico**.

## Escopo desta DECISION (limites)
- **Esta fatia NÃO autoriza migration ainda.** Apenas fixa as diretrizes materiais.
- **Próxima fatia material:** **Migration A — Learning concepts + associação governada** (criar 36 concepts
  em `educacao-e-conhecimento` via pipeline governado + associar `concept_id` às folhas learning existentes
  por migration governada com mapping literal). Exige prompt executor próprio com ratificação (executor não
  se autoriza).
- **Interest** continua para **fatia própria** (desenho + migration).
- **C1 Learning/Interest** só vem **depois** do substrato semântico governado existir.
