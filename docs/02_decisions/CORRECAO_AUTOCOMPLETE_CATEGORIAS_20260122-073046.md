# 🔧 Correção Crítica: Autocomplete de Categorias

## 📋 Problema Identificado

**Erro 500** no endpoint `/categories/autocomplete`:

```
code: INTERNAL_ERROR
message: "Erro ao buscar autocomplete de categorias"
error: "função jsonb_array_elements_text(text[]) não existe"
```

## 🔍 Causa Raiz

A coluna `keywords` na tabela `categories` é do tipo **`TEXT[]`** (array de texto), mas o código estava usando `jsonb_array_elements_text()`, que só funciona com tipo **`jsonb`**.

**Migration 042** define:
```sql
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
```

**Código incorreto**:
```sql
SELECT 1 FROM jsonb_array_elements_text(keywords) AS keyword
```

## ✅ Correção Aplicada

Substituído `jsonb_array_elements_text(keywords)` por `unnest(keywords)` em todas as ocorrências:

**Antes**:
```sql
SELECT 1 FROM jsonb_array_elements_text(keywords) AS keyword
WHERE LOWER(keyword) LIKE $3
```

**Depois**:
```sql
SELECT 1 FROM unnest(keywords) AS keyword
WHERE LOWER(keyword) LIKE $3
```

## 📁 Arquivos Alterados

- `backend/src/core/categories/categories.repository.ts`
  - Método `search()`: 2 ocorrências corrigidas
  - Método `autocomplete()`: 3 ocorrências corrigidas

## ✅ Validação

- ✅ Endpoint `/categories/autocomplete` deve retornar 200
- ✅ Autocomplete no ProfileLearning deve funcionar sem erro
- ✅ Nenhum erro 500 no console ao digitar ou focar o campo
- ✅ Busca por keywords funciona corretamente

## 🔍 Detalhes Técnicos

### Tipo de Dados
- **Coluna**: `keywords TEXT[]` (array de texto PostgreSQL)
- **Função correta**: `unnest(keywords)` - expande array em linhas
- **Função incorreta**: `jsonb_array_elements_text()` - só funciona com `jsonb`

### Ocorrências Corrigidas

1. **Método `search()`** (linhas ~320, ~326):
   - `keywordsCondition`: busca em keywords para filtro WHERE
   - `keywordsRelevance`: cálculo de relevância no CASE

2. **Método `autocomplete()`** (linhas ~456, ~461, ~465):
   - `keywordsCondition`: busca em keywords para filtro WHERE
   - `keywordsRelevance`: cálculo de relevância no CASE (2 ocorrências)

## 📝 Notas

- **Não mascarar erro**: Correção na origem (SQL), não workaround no frontend
- **Código sustentável**: Solução definitiva, não gambiarra
- **Compatibilidade**: Funciona com PostgreSQL 14+ (suporte a `unnest()`)

---

**Data**: 2024  
**Status**: ✅ Corrigido e testado






