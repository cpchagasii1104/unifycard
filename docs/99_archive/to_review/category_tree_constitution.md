# CATEGORY_TREE_CONSTITUTION

## 1. Propósito

Este documento define **a constituição canônica da árvore de categorias** do sistema Unificard.

Ele existe para **impedir a criação de árvores paralelas**, **eliminar regras silenciosas**, e **garantir previsibilidade** para:
- backend
- frontend
- IA
- seeds
- migrações
- buscas e autocomplete

> Se algo não estiver definido aqui, **não pode ser inferido no código**.

---

## 2. Princípio Fundamental (SSOT)

> **Existe UMA ÚNICA árvore de categorias no sistema.**

Essa árvore é **estrutural**, **imutável em forma**, e **independente de contexto**.

A árvore **NÃO MUDA** com base em:
- context (`professional`, `interest`, etc)
- scope (`global`, `company`, `government`, etc)
- país
- tenant
- tipo de usuário
- IA

Tudo isso **apenas filtra a leitura**.

---

## 3. Definição Canônica de Árvore

A árvore é definida **exclusivamente** pelos seguintes campos:

- `category_id`
- `parent_id`
- `level`
- `path`

### Regras:

1. `parent_id` define hierarquia
2. `level` é derivado de `parent_id`
3. `path` representa o caminho completo desde a raiz
4. **Nenhuma outra coluna pode redefinir hierarquia**

❌ Proibido usar para definir estrutura:
- `context`
- `scope`
- `metadata`
- `status`
- `country_code`

---

## 4. O que NÃO é árvore (proibições explícitas)

É **expressamente proibido** criar árvores implícitas usando:

- `level >= X` como definição semântica
- `NOT EXISTS(children)` como definição estrutural
- `scope` para mudar hierarquia
- `metadata` para excluir ou incluir ramos
- `context` para reinterpretar estrutura

Esses padrões são considerados **VIOLAÇÕES CONSTITUCIONAIS**.

---

## 5. Contexto (VISÃO, não estrutura)

`CategoryContext` **NÃO DEFINE árvore**.

Ele define apenas **VISÃO DE LEITURA**.

Exemplos:
- `professional`
- `interest`
- `education`
- `health`

### Regra:

> Contexto **filtra o que pode ser exibido ou selecionado**,
> **nunca redefine hierarquia**.

---

## 6. Scope (origem, não hierarquia)

`scope` define **origem e domínio**, não estrutura.

Exemplos:
- `global`
- `company`
- `government`

### Regra:

- Categorias de qualquer `scope` **podem coexistir na mesma árvore**
- `scope` **nunca cria árvore paralela**

---

## 7. País (filtro, não fork)

`country_code` **NUNCA cria uma nova árvore**.

Regra canônica:
```
(country_code = :countryCode OR country_code IS NULL)
```

Categorias globais (`NULL`) sempre coexistem com categorias locais.

---

## 8. Status (visibilidade, não existência)

`status` controla **visibilidade**, não existência estrutural.

- `active`
- `auto_active`
- `pending`

### Regra:

- Categorias `pending` **existem na árvore**
- Apenas filtros de leitura podem ocultá-las

---

## 9. IA (proposição, não criação estrutural)

A IA:
- ❌ NÃO pode criar root implícito
- ❌ NÃO pode redefinir hierarquia
- ❌ NÃO pode criar árvore nova

A IA:
- ✅ propõe categorias
- ✅ sugere posicionamento
- ✅ depende de aprovação

---

## 10. Regras para Repository

O `CategoryRepository`:

- ❌ NÃO define semântica de profissão
- ❌ NÃO decide o que é leaf
- ❌ NÃO aplica regras de negócio por contexto

Ele **DEVE**:
- usar `buildCanonicalReadFilter`
- aplicar filtros de forma explícita
- respeitar esta constituição

Qualquer leitura **sem context** é uma violação.

---

## 11. Autocomplete

Autocomplete:
- ❌ NÃO redefine árvore
- ❌ NÃO usa `level >= X` como semântica

Ele apenas:
- evita ROOT (`parent_id IS NOT NULL`)
- aplica filtros canônicos

---

## 12. Seeds e Migrations

Seeds:
- DEVEM ser idempotentes
- DEVEM respeitar `(slug, parent_id)`
- NUNCA podem inferir estrutura por contexto

Migrations:
- NUNCA criam árvore paralela
- DEVEM adaptar dados à árvore canônica

---

## 13. Violação Constitucional

Qualquer código que:
- crie árvore implícita
- use `if (context === ...)` para mudar estrutura
- altere hierarquia via SQL

Deve ser tratado como **BUG CRÍTICO**.

---

## 14. Regra Final

> **Se não está aqui, não é permitido.**

Esta constituição é a fonte suprema da verdade da árvore de categorias.

---

**Status:** ATIVA

**Alterações futuras:** exigem revisão explícita

