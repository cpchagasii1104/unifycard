# DECISION-0066 — INTEREST_TREE_MATERIAL_DIRECTIVES

**Status:** RATIFICADA — DIRETRIZES MATERIAIS PRÉ-MIGRATION B; IMPLEMENTAÇÃO (MIGRATION) NÃO AUTORIZADA NESTA DECISION (2026-06-01).
**Sessão:** 2026-06-01 (pós-desenho read-only de Interest, pós-Migration A).
**Decisor:** Clayton (árvore + reuso + domínio + fronteiras).
**Commit âncora:** documental. HEAD de origem: `6d9e9a29`.
**Documento canônico:** este arquivo.
**Deriva de / subordinada a:** **DECISION-0064** (Opção C híbrida governada) e **DECISION-0065** (diretrizes Learning). Não altera 0064/0065; materializa as diretrizes de Interest.
**Vinculada a:** DTs `DT-INTEREST-SCOPE-EMPTY`, `DT-LEARNING-INTEREST-BLOB-SSOT`, `DT-PROFILE-FRONTEND-DRIVES-TAXONOMY`, `DT-LIFESTYLE-SENSITIVE-IN-BLOB`; Migration A (`20260601120000`).

---

## 1. Contexto

A Migration A (`6d9e9a29`) criou 36 concepts de Learning em `educacao-e-conhecimento` e associou 36 folhas
`scope='learning'`. `scope='interest'` permanece **vazio** (0 categorias). A auditoria read-only confirmou
que `/profile/physical` lê e escreve interests usando `scope='interest'`:
- read: `enrichCategoryNavigationByIds(..., 'interest')` (`profile-physical.service.ts:55/:218`);
- write: `requireCategoriesWithConceptForScope(..., 'interest')` (`profile-physical.service.ts:188`).
Ambos exigem categorias `scope='interest'` **com `concept_id`** → hoje qualquer save dá 400 "fora do
escopo". O `categories_scope_check` **já permite** `'interest'` (sem alteração de schema). O `lifestyle`
sensível (drinks/smokes/relationshipStatus/sexualOrientation) está **enredado no mesmo blob
`global_users.metadata` e endpoint** (`:67/:140/:194-196/:234`) — fora do escopo desta decisão.

## 2. Opções consideradas

- **A** — árvore mínima governada `scope='interest'` (raízes agregadoras + folhas com concept).
- **B** — árvore ampla desde o início.
- **C** — navegar direto por `concepts` (sem árvore).
- **D** — adiar Interest.

## 3. Escolha

**OPÇÃO A — ÁRVORE MÍNIMA GOVERNADA `scope='interest'`.** (Mesma disciplina da Migration A: mínimo
primeiro, expansão governada depois.)

## 4. Justificativa

- **Satisfaz o guard** `requireCategoriesWithConceptForScope(...,'interest')` (dá substrato válido).
- **Respeita CONCEPT como SSOT** (Lei 7); `categories` segue navegação.
- **Preserva UX** de navegação por áreas (espelha learning).
- **Evita misturar Interest com Lifestyle** (Migration B não toca lifestyle).
- **Prepara o C1 sem reabrir o blob** (substrato semântico agora; persistência migra no C1).

## 5. Regras decididas (vinculantes)

1. Interest terá **árvore própria `scope='interest'`**.
2. Árvore inicial **mínima e governada**.
3. **Raízes = agregadores `level=0`, SEM `concept_id`.**
4. **Folhas = tópicos declaráveis `level=1`, COM `concept_id`.**
5. Quando o significado for **idêntico**, Interest **reutiliza `concept_id`** já criado em Learning
   (mesma CONCEPT; coexistência entre scopes é permitida — `ux_category_concept_scope` é por scope no
   level 2; folhas interest são level 1).
6. **Concepts novos** criados **apenas** para interesses/lazer/afinidades **não cobertos** por Learning,
   **só via governança** (`app.concept_governance` + INSERT ON CONFLICT; nunca frontend, nunca ad-hoc).
7. **Lifestyle sensível fica FORA da Migration B** — continua rastreado por `DT-LIFESTYLE-SENSITIVE-IN-BLOB`
   (frente própria).
8. **Persistência em `global_users.metadata` continua temporária até o C1 actor-first** — **NÃO fechar**
   `DT-LEARNING-INTEREST-BLOB-SSOT`.
9. **C1 Learning/Interest só vem depois** do substrato semântico de Interest.

## 6. Árvore inicial (registrada — ajustável por Clayton em expansão governada)

**Raízes `scope='interest'` (level 0, sem concept):**
`cultura-e-arte` · `esporte-e-bem-estar` · `tecnologia-e-jogos` · `gastronomia` · `casa-e-mao-na-massa` ·
`negocios-e-financas` · `mundo-e-pessoas`.

**Folhas que REUTILIZAM concepts existentes de Learning (`educacao-e-conhecimento`):**
`musica` · `fotografia` · `desenho-ilustracao` · `design` · `atividade-fisica` · `nutricao` ·
`saude-mental` · `games` · `programacao` · `inteligencia-artificial` · `ferramentas-digitais` ·
`culinaria` · `confeitaria` · `panificacao` · `jardinagem` · `marcenaria` · `diy` · `decoracao` ·
`manutencao-basica` · `empreendedorismo` · `financas-pessoais` · `gestao` · `marketing-digital` ·
`idiomas` · `historia` · `filosofia` · `ciencias`.

**Folhas/concepts NOVOS candidatos (lazer/afinidade não cobertos por Learning):**
`cinema-e-series` · `leitura` · `teatro` · `futebol` · `corrida` · `yoga` · `gadgets` ·
`vinhos-e-bebidas` · `cafe` · `viagens` · `pets`.

> O agrupamento exato de cada folha sob cada raiz é detalhe da Migration B; esta DECISION fixa o conjunto
> e a separação reuso/novo, não o mapa raiz→folha definitivo.

## 7. Domínio dos concepts novos — RESOLVIDO

**`cultura-lazer-e-eventos`** — verificado por SELECT read-only: **EXISTE** em `domains` (domínio N0
canônico, 18_DOMAIN_ONTOLOGY §7). É o domínio recomendado para os concepts novos de lazer/afinidade.
Tópicos de conhecimento reutilizam `educacao-e-conhecimento` (regra 5). **O domínio NÃO está ambíguo** →
não há bloqueio de domínio para a Migration B.

> Refinamento opcional (não bloqueante): se algum candidato novo for melhor classificado noutro domínio
> vivo (ex.: `pets`/`viagens` poderiam debater `mobilidade`/`servicos`), isso é ajuste de classificação no
> prompt da Migration B, dentro de domínios existentes — **nunca** inventar domínio novo sem fatia própria.

## 8. Vetos

Sem `lifestyle` nesta migration · sem frontend criando taxonomia · sem `categoryId` como identidade · sem
SQL ad-hoc (só migration governada com mapping literal, como na Migration A) · sem C1 antes da Migration B ·
sem fechar `DT-LEARNING-INTEREST-BLOB-SSOT` (persistência segue blob até C1) · guard
`requireCategoriesWithConceptForScope` permanece.

## 9. Escopo / próxima frente

- **Esta DECISION NÃO autoriza migration.** Fixa árvore + reuso + domínio + fronteiras.
- **Domínio dos concepts novos está DECIDIDO** (`cultura-lazer-e-eventos` existe) → a próxima fatia material
  **pode** ser a **Migration B — Interest concepts + árvore + associação** (criar concepts novos governados
  + categorias `scope='interest'` raízes/folhas + associar `concept_id`, reusando learning quando comum),
  com prompt executor próprio e ratificação (executor não se autoriza).
- **Interest declarado ≠ inferido** (declarado = futuro C1; inferido = GRAPH/inference, substrato separado).
- **C1 Learning/Interest** só **depois** do substrato de Interest existir.

---

## ADENDO A — SLUGS DE CATEGORIES INTEREST COM SUFIXO `-interesse` (2026-06-01)

**Status:** RATIFICADO — refinamento material desta DECISION; vinculante para a Migration B.
**Origem:** auditoria read-only de duplicidade/arqueologia de Interesses (HEAD `a602d2dd`).

### Contexto da auditoria
Auditoria read-only confirmou, antes da Migration B: **NÃO existe duplicidade material** de substrato de
Interest — 0 tabelas/colunas de interest/hobby/preference no schema vivo; `scope='interest'`=0; 0 dos 11
concepts novos planejados; nenhuma migration **aplicada** anterior de Interest (archive `0682/0875/0078`
nunca aplicado — tabelas AUSENTES vivas); `'interest'` é **slot canônico declarado mas vazio**; domínio
`cultura-lazer-e-eventos` existe; histórico Git **sem** implementação anterior de Interest removida.

### Veredito
**Sem duplicidade material → Migration B pode seguir.** Não há nada a reaproveitar além dos 27 concepts de
Learning (reuso já previsto na §6). O único leitor adjacente é o módulo **human-mvp dormente** (lê context
'interest', tabelas AUSENTES) — não bloqueia.

### Achado material (BLOQUEADOR de slug, agora resolvido por este adendo)
`categories_slug_key` = **`UNIQUE (slug)` GLOBAL** (verificado). Os slugs **limpos** planejados na §6 para
as **categorias** de interest colidem com categorias existentes (11 colisões: `programacao`, `idiomas`,
`ciencias`, `decoracao`, `panificacao`, `manutencao-basica`, `desenho-ilustracao`, `ferramentas-digitais`,
`financas-pessoais`, `inteligencia-artificial` em learning; `gastronomia` em professional). Os **concepts**
NÃO colidem (`concepts` é `UNIQUE(domain, slug)`).

### Regra (vinculante para a Migration B)
1. **Concepts mantêm slug LIMPO** (ex.: `fotografia`, `musica`, `programacao`, `cinema-e-series`).
2. **Categories `scope='interest'` usam sufixo `-interesse`** (raízes E folhas): ex.: raiz
   `cultura-e-arte-interesse`, `gastronomia-interesse`; folha `fotografia-interesse`, `programacao-interesse`,
   `cinema-e-series-interesse`.
3. O sufixo `-interesse` é **navegação/contexto, NÃO identidade**.
4. `concept_id` continua sendo a **identidade semântica**; `source_category_id` futuro continua **breadcrumb**.
5. O esquema **não duplica concept** — apenas evita colisão de **category** (slug global único).
6. **Mapping literal da Migration B:** category slug `*-interesse` → concept slug **limpo** (reuso de
   `educacao-e-conhecimento` quando o significado for comum; concept novo em `cultura-lazer-e-eventos`
   para lazer/afinidade).

> Observação: as folhas que **reutilizam** concept de Learning (educacao-e-conhecimento) e as **novas**
> (cultura-lazer-e-eventos) seguem o **mesmo** esquema de category slug `-interesse`. Folha interest e folha
> learning **compartilham o mesmo `concept_id`** (slugs de categoria distintos; concept único).

### Vetos mantidos (de 0064/0065/0066)
Sem SQL ad-hoc (só migration governada com mapping) · sem frontend criando taxonomia · sem `categoryId`
como identidade · sem C1 antes da Migration B · sem lifestyle nesta migration · guard
`requireCategoriesWithConceptForScope` permanece.

### Impacto / próxima frente
Migration B passa a usar **category slugs `-interesse` + concepts limpos**. Este adendo **não autoriza**
migration; a Migration B continua sendo fatia executora própria com ratificação.
