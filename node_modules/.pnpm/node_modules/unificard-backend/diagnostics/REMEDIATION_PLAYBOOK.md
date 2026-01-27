# Playbook de Remediação - Duplicidades em Categorias

## Objetivo
Guia para corrigir duplicidades e inconsistências detectadas pela auditoria SQL.

---

## ANTES DE COMEÇAR

⚠️ **IMPORTANTE:**
- Sempre faça backup do banco antes de executar remediações
- Teste as queries em ambiente de desenvolvimento primeiro
- Documente todas as alterações
- Execute uma auditoria completa ANTES e DEPOIS da remediação

---

## CENÁRIO 1: Duplicidade por (slug, country_code)

### Problema
Query (1) do `AUDIT_CATEGORIES_DUPLICATES.sql` retornou linhas.

### Impacto
- Inserts podem falhar com erro de constraint UNIQUE
- Seeds podem ser bloqueados silenciosamente
- Pode haver confusão sobre qual categoria usar

### Remediação

#### Passo 1: Identificar o registro canônico
```sql
-- Para cada grupo de duplicados, identificar qual manter
-- Regra sugerida: manter o mais antigo (created_at) ou o que tem status='active'
SELECT 
    category_id,
    slug,
    country_code,
    scope,
    name,
    created_at,
    status,
    ROW_NUMBER() OVER (
        PARTITION BY slug, country_code 
        ORDER BY 
            CASE WHEN status = 'active' THEN 1 ELSE 2 END,
            created_at ASC
    ) AS rn
FROM categories
WHERE (slug, country_code) IN (
    SELECT slug, country_code 
    FROM categories 
    GROUP BY slug, country_code 
    HAVING COUNT(*) > 1
)
ORDER BY slug, country_code, rn;
```

#### Passo 2: Migrar referências (parent_id)
```sql
-- ATENÇÃO: Ajuste os IDs conforme resultado do Passo 1
-- Substitua OLD_ID pelos IDs dos duplicados
-- Substitua CANONICAL_ID pelo ID do registro canônico

BEGIN;

-- Atualizar parent_id de categorias filhas
UPDATE categories
SET parent_id = 'CANONICAL_ID'
WHERE parent_id IN ('OLD_ID_1', 'OLD_ID_2', ...);

-- Atualizar referências em outras tabelas (ajuste conforme seu schema)
-- Exemplo: se houver tabela user_skills ou similar
-- UPDATE user_skills SET category_id = 'CANONICAL_ID' WHERE category_id IN ('OLD_ID_1', ...);

COMMIT;
```

#### Passo 3: Remover duplicados
```sql
BEGIN;

-- Remover duplicados (manter apenas o canônico)
DELETE FROM categories
WHERE category_id IN ('OLD_ID_1', 'OLD_ID_2', ...)
  AND category_id != 'CANONICAL_ID';

COMMIT;
```

#### Passo 4: Validar
```sql
-- Executar novamente a query (1) da auditoria
-- Deve retornar 0 linhas
SELECT slug, country_code, COUNT(*) 
FROM categories
GROUP BY slug, country_code
HAVING COUNT(*) > 1;
```

---

## CENÁRIO 2: Duplicidade Semântica (mesmo name + parent + scope)

### Problema
Query (2) retornou linhas.

### Impacto
- Categorias idênticas semanticamente mas com IDs diferentes
- Pode confundir usuários e sistemas

### Remediação

Similar ao CENÁRIO 1, mas agrupar por `(scope, parent_id, name)`:

```sql
-- Identificar canônico
SELECT 
    category_id,
    scope,
    parent_id,
    name,
    slug,
    created_at,
    ROW_NUMBER() OVER (
        PARTITION BY scope, parent_id, name
        ORDER BY created_at ASC
    ) AS rn
FROM categories
WHERE (scope, parent_id, name) IN (
    SELECT scope, parent_id, name
    FROM categories
    GROUP BY scope, parent_id, name
    HAVING COUNT(*) > 1
)
ORDER BY scope, parent_id, name, rn;
```

Depois, migrar referências e remover duplicados (mesmo processo do CENÁRIO 1).

---

## CENÁRIO 3: Conflito Silencioso de Slug (mesmo slug em scopes diferentes)

### Problema
Query (3) retornou linhas - mesmo slug usado em scopes diferentes.

### Impacto
- Não bloqueia inserts (constraint permite)
- Mas pode causar confusão
- Se mudar constraint para incluir scope, pode quebrar

### Opções de Remediação

#### Opção A: Padronizar Slugs (Conservador)
Adicionar prefixo do scope ao slug:

```sql
BEGIN;

-- Exemplo: "programacao" vira "programacao-learning" se scope='learning'
UPDATE categories
SET slug = slug || '-' || scope
WHERE (slug, country_code) IN (
    SELECT slug, country_code
    FROM categories
    GROUP BY slug, country_code
    HAVING COUNT(DISTINCT scope) > 1
)
AND scope IN ('learning', 'professional');

COMMIT;
```

⚠️ **ATENÇÃO:** Isso pode quebrar URLs ou referências externas que usam o slug antigo.

#### Opção B: Mudar Constraint (Estrutural)
Alterar constraint UNIQUE para incluir scope:

```sql
BEGIN;

-- Remover constraint antiga
ALTER TABLE categories
DROP CONSTRAINT IF EXISTS categories_slug_country_unique;

-- Criar nova constraint incluindo scope
ALTER TABLE categories
ADD CONSTRAINT categories_slug_country_scope_unique
UNIQUE (slug, country_code, scope);

COMMIT;
```

⚠️ **ATENÇÃO:** Isso é mudança estrutural. Verificar se não quebra contratos ou APIs externas.

#### Opção C: Aceitar e Documentar (Mais Seguro)
Se o comportamento atual não causa problemas reais, apenas documentar:

```sql
-- Apenas monitorar
-- Não fazer alterações estruturais
```

---

## CENÁRIO 4: Vazamento Estrutural (filho com parent de outro scope)

### Problema
Query (7) retornou linhas - categoria com parent_id apontando para categoria de scope diferente.

### Impacto
- **CRÍTICO:** Vazamento de contexto
- Categoria learning pode aparecer na árvore de professional
- Quebra isolamento de contexts

### Remediação

#### Passo 1: Identificar categorias afetadas
```sql
SELECT 
    child.category_id,
    child.slug,
    child.scope AS child_scope,
    child.parent_id,
    parent.scope AS parent_scope
FROM categories child
JOIN categories parent ON parent.category_id = child.parent_id
WHERE child.scope IN ('learning', 'professional')
  AND parent.scope <> child.scope;
```

#### Passo 2: Encontrar parent correto no mesmo scope
```sql
-- Para cada categoria afetada, encontrar parent correto no mesmo scope
-- Exemplo: se child.scope='learning' e parent.scope='professional',
-- procurar categoria equivalente em scope='learning'

-- Estratégia: buscar por mesmo nome e mesmo nível
SELECT 
    c.category_id,
    c.slug,
    c.scope,
    c.name,
    c.level
FROM categories c
WHERE c.scope = 'learning'  -- scope correto
  AND c.name = 'NOME_DO_PARENT_ERRADO'
  AND c.level = (
      SELECT level FROM categories WHERE category_id = 'PARENT_ID_ERRADO'
  ) - 1;
```

#### Passo 3: Corrigir parent_id
```sql
BEGIN;

-- Atualizar parent_id para o correto
UPDATE categories
SET parent_id = 'PARENT_ID_CORRETO'
WHERE category_id = 'CHILD_ID'
  AND scope = 'SCOPE_CORRETO';

COMMIT;
```

#### Passo 4: Se não houver parent correto, tornar raiz
```sql
BEGIN;

-- Se não encontrar parent correto, tornar categoria raiz
UPDATE categories
SET parent_id = NULL,
    level = 0,
    path = ARRAY[name]
WHERE category_id = 'CHILD_ID'
  AND scope = 'SCOPE_CORRETO';

COMMIT;
```

---

## CENÁRIO 5: Path/Level Inconsistente

### Problema
Query (6) retornou linhas - path não corresponde ao level.

### Impacto
- Navegação na árvore pode quebrar
- Autocomplete pode falhar
- Path display pode estar errado

### Remediação

#### Opção A: Reconstruir Path (Recomendado)
```sql
-- Função recursiva para reconstruir path
WITH RECURSIVE category_paths AS (
    -- Raízes
    SELECT 
        category_id,
        name,
        parent_id,
        scope,
        0 AS level,
        ARRAY[name] AS path
    FROM categories
    WHERE parent_id IS NULL
    
    UNION ALL
    
    -- Filhos
    SELECT 
        c.category_id,
        c.name,
        c.parent_id,
        c.scope,
        cp.level + 1,
        cp.path || c.name
    FROM categories c
    JOIN category_paths cp ON cp.category_id = c.parent_id
)
UPDATE categories c
SET 
    path = cp.path,
    level = cp.level
FROM category_paths cp
WHERE c.category_id = cp.category_id
  AND (c.path IS DISTINCT FROM cp.path OR c.level IS DISTINCT FROM cp.level);
```

#### Opção B: Corrigir Level baseado em Path
```sql
BEGIN;

UPDATE categories
SET level = array_length(path, 1) - 1
WHERE array_length(path, 1) IS NOT NULL
  AND level IS DISTINCT FROM (array_length(path, 1) - 1);

COMMIT;
```

---

## CENÁRIO 6: Categorias Órfãs

### Problema
Query (8) retornou linhas - categorias com parent_id inexistente.

### Impacto
- Árvore quebrada
- Navegação falha
- Pode indicar deleção acidental

### Remediação

#### Opção A: Tornar Raiz
```sql
BEGIN;

UPDATE categories
SET 
    parent_id = NULL,
    level = 0,
    path = ARRAY[name]
WHERE parent_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM categories p 
      WHERE p.category_id = categories.parent_id
  );

COMMIT;
```

#### Opção B: Deletar (se não houver referências)
```sql
-- ATENÇÃO: Verificar se não há referências antes de deletar
BEGIN;

-- Verificar referências
SELECT COUNT(*) FROM user_skills WHERE category_id IN (
    SELECT category_id FROM categories
    WHERE parent_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM categories p 
          WHERE p.category_id = categories.parent_id
      )
);

-- Se retornar 0, pode deletar
DELETE FROM categories
WHERE parent_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM categories p 
      WHERE p.category_id = categories.parent_id
  );

COMMIT;
```

---

## VALIDAÇÃO PÓS-REMEDIAÇÃO

Após executar qualquer remediação:

1. **Re-executar todas as queries de auditoria**
2. **Verificar que não há mais duplicidades**
3. **Testar endpoints:**
   - `GET /categories/tree?context=learning`
   - `GET /categories/tree?context=professional`
4. **Testar UI:**
   - Aba Aprendizado deve carregar corretamente
   - Aba Profissional deve carregar corretamente
   - Navegação na árvore deve funcionar

---

## NOTAS FINAIS

- Sempre documente qual cenário foi aplicado
- Mantenha log das queries executadas
- Se houver dúvida, prefira não fazer alteração
- Em caso de mudança estrutural (constraints), validar com time antes





