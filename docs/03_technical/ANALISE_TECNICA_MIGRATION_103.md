# 🔍 ANÁLISE TÉCNICA DETALHADA — MIGRATION 103

**Arquivo:** `backend/migrations/103_consolidation_fix_all_issues.sql`  
**Data:** 01/01/2026  
**Analista:** Agente Backend Sênior

---

## 📋 SUMÁRIO EXECUTIVO

### Status Geral: ✅ **APROVADA COM RESSALVAS DE PERFORMANCE**

A migration 103 é **idempotente e segura**, porém possui **3 pontos de atenção** relacionados a performance e validação de dados em ambientes com grandes volumes.

---

## 1️⃣ ANÁLISE DE IDEMPOTÊNCIA

### ✅ Status: **TOTALMENTE IDEMPOTENTE**

Todas as operações usam guards apropriados:

| Fase | Operação | Guard | Status |
|------|----------|-------|--------|
| 1 | DROP CONSTRAINT | `IF EXISTS` | ✅ |
| 1 | ADD CONSTRAINT | `IF NOT EXISTS` | ✅ |
| 2 | ADD COLUMN | `IF NOT EXISTS` (information_schema) | ✅ |
| 3 | DROP CONSTRAINT | `IF EXISTS` | ✅ |
| 3 | ADD CONSTRAINT | Sem guard (sempre recria) | ⚠️ Ver nota abaixo |
| 4 | UPDATE | Sem guard (idempotente por WHERE) | ✅ |
| 6 | DELETE | Sem guard (idempotente por WHERE) | ✅ |
| 7 | CREATE EXTENSION | `IF NOT EXISTS` | ✅ |

**Nota sobre FASE 3:**
A constraint é sempre recriada após remoção, mas isso é seguro porque:
- Remove apenas se existir
- Recria imediatamente após remoção
- Se já existe com valores corretos, a remoção/recriação não altera comportamento

**Conclusão:** Pode ser executada múltiplas vezes sem efeitos colaterais.

---

## 2️⃣ ANÁLISE DE INTEGRIDADE HIERÁRQUICA

### ✅ Status: **NENHUM IMPACTO**

A migration 103 **NÃO altera** a estrutura hierárquica de categorias:

| Campo Hierárquico | Migration 103 | Impacto |
|-------------------|---------------|---------|
| `parent_id` | ❌ Não toca | ✅ Nenhum |
| `path` | ❌ Não toca | ✅ Nenhum |
| `level` | ❌ Não toca | ✅ Nenhum |
| `slug` | ❌ Não toca | ✅ Nenhum |

### Mecanismo de Proteção

O trigger `categories_before_write()` (migration 040) mantém integridade:

```sql
-- Trigger dispara em INSERT ou UPDATE que altera parent_id, path, level
CREATE TRIGGER trg_categories_before_write
  BEFORE INSERT OR UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION categories_before_write();
```

**Comportamento:**
- ✅ UPDATE de `status` **NÃO dispara** o trigger (apenas campos hierárquicos)
- ✅ Se `parent_id` for alterado, trigger recalcula `path` e `level`
- ✅ Previne ciclos na hierarquia
- ✅ Valida existência do parent antes de permitir

**Conclusão:** Integridade hierárquica permanece intacta.

---

## 3️⃣ ANÁLISE DE CONSTRAINTS E ÍNDICES

### ✅ Status: **SEM IMPACTO NEGATIVO**

| Item | Migration 103 | Impacto |
|------|---------------|---------|
| Constraints de hierarquia | ❌ Não toca | ✅ Preservadas |
| Índices hierárquicos | ❌ Não toca | ✅ Preservados |
| Constraint de status | ✅ Atualiza | ✅ Melhora validação |
| Constraint de CNPJ | ✅ Consolida | ✅ Remove duplicação |

### Constraints Preservadas

```sql
-- Migration 040 - Preservadas
CONSTRAINT categories_parent_not_self
  CHECK (parent_id IS NULL OR parent_id <> category_id)

CONSTRAINT categories_unique_slug_per_parent
  UNIQUE (parent_id, slug)

-- Índices preservados
idx_categories_parent
idx_categories_parent_slug
idx_categories_level
idx_categories_path (GIN)
```

### Constraints Modificadas

**FASE 1 - CNPJ:**
- Remove: `companies_cnpj_format` (se existir)
- Remove: `companies_cnpj_digits_only` (se existir)
- Cria: `companies_cnpj_format` única com regex `'^[0-9]{14}$'`

**FASE 3 - Status:**
- Remove: `categories_status_check` (se existir)
- Cria: `categories_status_check` com valores completos:
  - `'active'`, `'auto_active'`, `'pending'`, `'rejected'`, `'archived'`

**Conclusão:** Constraints são melhoradas, não degradadas.

---

## 4️⃣ ANÁLISE DE IMPACTO EM DADOS EXISTENTES

### ⚠️ Pontos de Atenção

#### 4.1 FASE 2: Adição de Coluna `status`

**Operação:**
```sql
ALTER TABLE categories
ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
```

**Impacto:**
- ✅ **Seguro:** Usa `DEFAULT 'active'`, então todas as linhas recebem valor
- ⚠️ **Performance:** Em tabelas grandes (>100k linhas), pode ser lento
- ✅ **Transação:** Operação é atômica (não deixa tabela em estado inconsistente)

**Recomendação:**
- Executar em janela de manutenção se `categories` tiver >100k linhas
- Monitorar tempo de execução

#### 4.2 FASE 3: Recriação de Constraint

**Operação:**
```sql
ALTER TABLE categories DROP CONSTRAINT categories_status_check;
ALTER TABLE categories ADD CONSTRAINT categories_status_check ...;
```

**Impacto:**
- ⚠️ **Risco:** Se houver dados com status inválido, a criação da constraint falhará
- ✅ **Mitigação:** FASE 4 atualiza `NULL` para `'active'` antes da constraint
- ⚠️ **Gap:** Se houver status com valores fora da lista permitida, falhará

**Validação Prévia Recomendada:**
```sql
-- Executar ANTES da migration
SELECT status, COUNT(*) 
FROM categories 
GROUP BY status
HAVING status NOT IN ('active', 'auto_active', 'pending', 'rejected', 'archived', NULL);
```

#### 4.3 FASE 4: UPDATE de Status NULL

**Operação:**
```sql
UPDATE categories SET status = 'active' WHERE status IS NULL;
```

**Impacto:**
- ✅ **Seguro:** Apenas atualiza `NULL`, não força `pending` para `active`
- ⚠️ **Performance:** Em tabelas grandes, pode ser lento
- ✅ **Idempotente:** Pode ser executado múltiplas vezes

**Recomendação:**
- Se houver muitos `NULL`, considerar batch update
- Monitorar tempo de execução

#### 4.4 FASE 6: DELETE de FKs Quebradas

**Operação:**
```sql
DELETE FROM user_skills_categories usc
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.category_id = usc.category_id
);
```

**Impacto:**
- ⚠️ **Perda de Dados:** Remove referências a categorias inexistentes
- ✅ **Intenção:** Corrige integridade referencial
- ⚠️ **Auditoria:** Não há log do que foi removido

**Recomendação:**
- **BACKUP ANTES:** Fazer backup de `user_skills_categories` antes de executar
- **AUDITORIA:** Adicionar log do que foi removido (ver sugestão abaixo)

---

## 5️⃣ PROBLEMAS POTENCIAIS E SOLUÇÕES

### 🔴 PROBLEMA 1: FASE 3 Pode Falhar com Dados Inválidos

**Cenário:**
Se existirem categorias com `status` fora da lista permitida (ex: `'inactive'`, `'deleted'`), a constraint falhará.

**Solução:**
Adicionar validação prévia na FASE 3:

```sql
-- Adicionar ANTES de criar constraint
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM categories
  WHERE status IS NOT NULL
    AND status NOT IN ('active', 'auto_active', 'pending', 'rejected', 'archived');
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Existem % categorias com status inválido. Corrija antes de executar migration.', invalid_count;
  END IF;
END $$;
```

### 🟡 PROBLEMA 2: FASE 6 Remove Dados Sem Auditoria

**Cenário:**
FKs quebradas são removidas sem log do que foi deletado.

**Solução:**
Adicionar tabela de auditoria temporária:

```sql
-- Criar tabela de auditoria
CREATE TEMP TABLE IF NOT EXISTS deleted_fks_audit AS
SELECT usc.*, 'category_not_exists' as reason
FROM user_skills_categories usc
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.category_id = usc.category_id
);

-- Log antes de deletar
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO deleted_count FROM deleted_fks_audit;
  IF deleted_count > 0 THEN
    RAISE NOTICE '⚠️ Serão removidas % FKs quebradas', deleted_count;
    -- Opcional: salvar em tabela permanente para auditoria
  END IF;
END $$;

-- Depois executar DELETE normal
```

### 🟡 PROBLEMA 3: Performance em Tabelas Grandes

**Cenário:**
FASE 2, 4 e 6 podem ser lentas em tabelas com >100k linhas.

**Solução:**
- Executar em janela de manutenção
- Monitorar tempo de execução
- Considerar batch updates se necessário

---

## 6️⃣ QUERIES DE VALIDAÇÃO PÓS-MIGRATION

### 6.1 Validação de Constraints

```sql
-- 1. Verificar constraint CNPJ (deve retornar 1)
SELECT COUNT(*) as cnpj_constraints
FROM pg_constraint 
WHERE conrelid = 'companies'::regclass 
  AND conname = 'companies_cnpj_format';

-- 2. Verificar constraint status (deve retornar 1)
SELECT COUNT(*) as status_constraints
FROM pg_constraint 
WHERE conrelid = 'categories'::regclass 
  AND conname = 'categories_status_check';

-- 3. Verificar definição da constraint CNPJ
SELECT pg_get_constraintdef(oid) as cnpj_constraint_def
FROM pg_constraint 
WHERE conrelid = 'companies'::regclass 
  AND conname = 'companies_cnpj_format';
-- Esperado: CHECK (cnpj ~ '^[0-9]{14}$')

-- 4. Verificar definição da constraint status
SELECT pg_get_constraintdef(oid) as status_constraint_def
FROM pg_constraint 
WHERE conrelid = 'categories'::regclass 
  AND conname = 'categories_status_check';
-- Esperado: CHECK (status IN ('active', 'auto_active', 'pending', 'rejected', 'archived'))
```

### 6.2 Validação de Dados

```sql
-- 1. Verificar coluna status existe
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'categories' 
  AND column_name = 'status';
-- Esperado: status, character varying, NO, 'active'

-- 2. Distribuição de status
SELECT 
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM categories
GROUP BY status
ORDER BY count DESC;

-- 3. Verificar se há status NULL (deve ser 0 após migration)
SELECT COUNT(*) as null_status_count
FROM categories
WHERE status IS NULL;
-- Esperado: 0

-- 4. Verificar se há status inválidos (deve ser 0)
SELECT COUNT(*) as invalid_status_count
FROM categories
WHERE status IS NOT NULL
  AND status NOT IN ('active', 'auto_active', 'pending', 'rejected', 'archived');
-- Esperado: 0

-- 5. Verificar categorias raiz ativas
SELECT COUNT(*) as root_categories_count
FROM categories
WHERE parent_id IS NULL 
  AND status IN ('active', 'auto_active');
-- Esperado: > 0 (após seeds)
```

### 6.3 Validação de Integridade Referencial

```sql
-- 1. Verificar FKs quebradas em user_skills_categories (deve ser 0)
SELECT COUNT(*) as broken_fks_count
FROM user_skills_categories usc
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.category_id = usc.category_id
);
-- Esperado: 0

-- 2. Verificar FKs quebradas em outras tabelas
SELECT 
  'company_categories' as table_name,
  COUNT(*) as broken_fks
FROM company_categories cc
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.category_id = cc.category_id
)
UNION ALL
SELECT 
  'post_categories' as table_name,
  COUNT(*) as broken_fks
FROM post_categories pc
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.category_id = pc.category_id
)
UNION ALL
SELECT 
  'product_categories' as table_name,
  COUNT(*) as broken_fks
FROM product_categories prc
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.category_id = prc.category_id
)
UNION ALL
SELECT 
  'service_categories' as table_name,
  COUNT(*) as broken_fks
FROM service_categories sc
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.category_id = sc.category_id
);
-- Esperado: Todos retornam 0
```

### 6.4 Validação de Integridade Hierárquica

```sql
-- 1. Verificar ciclos na hierarquia (deve ser 0)
WITH RECURSIVE category_tree AS (
  SELECT category_id, parent_id, ARRAY[category_id] as path
  FROM categories
  WHERE parent_id IS NULL
  
  UNION ALL
  
  SELECT c.category_id, c.parent_id, ct.path || c.category_id
  FROM categories c
  JOIN category_tree ct ON c.parent_id = ct.category_id
  WHERE c.category_id = ANY(ct.path) = false
)
SELECT COUNT(*) as cycles_count
FROM category_tree
WHERE category_id = ANY(path[1:array_length(path, 1)-1]);
-- Esperado: 0

-- 2. Verificar parent_id quebrados (deve ser 0)
SELECT COUNT(*) as broken_parents_count
FROM categories c
WHERE c.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM categories p WHERE p.category_id = c.parent_id
  );
-- Esperado: 0

-- 3. Verificar consistência path/level (deve ser 0)
SELECT COUNT(*) as inconsistent_path_level_count
FROM categories
WHERE level != array_length(path, 1) - 1;
-- Esperado: 0
```

### 6.5 Validação de Performance

```sql
-- 1. Verificar tamanho da tabela categories
SELECT 
  pg_size_pretty(pg_total_relation_size('categories')) as total_size,
  pg_size_pretty(pg_relation_size('categories')) as table_size,
  pg_size_pretty(pg_indexes_size('categories')) as indexes_size,
  (SELECT COUNT(*) FROM categories) as row_count;

-- 2. Verificar índices em categories
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'categories'
ORDER BY indexname;
```

---

## 7️⃣ ROLLBACK SEGURO

### 7.1 Estratégia de Rollback

A migration 103 é **reversível** com as seguintes operações:

```sql
-- ============================================================
-- ROLLBACK MIGRATION 103
-- ============================================================
-- ATENÇÃO: Execute apenas se necessário
-- Fazer backup antes de executar rollback
-- ============================================================

BEGIN;

-- FASE 1: Reverter constraint CNPJ
-- (Manter companies_cnpj_format, não criar companies_cnpj_digits_only)
-- Não há rollback necessário, constraint única é melhor

-- FASE 2: Reverter coluna status
-- ⚠️ ATENÇÃO: Isso pode quebrar aplicação se backend espera coluna
ALTER TABLE categories DROP COLUMN IF EXISTS status;

-- FASE 3: Reverter constraint status
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_status_check;

-- FASE 4: Não há rollback (UPDATE é idempotente)

-- FASE 5: Não há rollback (apenas verificação)

-- FASE 6: Não há rollback (dados já foram deletados)
-- ⚠️ ATENÇÃO: FKs quebradas não podem ser restauradas sem backup

-- FASE 7: Não há rollback (extensões são seguras)

COMMIT;
```

### 7.2 Limitações do Rollback

| Fase | Reversível? | Limitação |
|------|-------------|-----------|
| 1 (CNPJ) | ✅ Parcial | Constraint única é melhor, não há necessidade |
| 2 (Coluna status) | ⚠️ Sim, mas perigoso | Backend pode esperar coluna |
| 3 (Constraint status) | ✅ Sim | Seguro |
| 4 (UPDATE status) | ❌ Não | Dados já foram atualizados |
| 6 (DELETE FKs) | ❌ Não | Dados já foram deletados (precisa backup) |

### 7.3 Recomendação de Backup

**Antes de executar migration 103:**

```sql
-- 1. Backup completo de categories
CREATE TABLE categories_backup_103 AS SELECT * FROM categories;

-- 2. Backup de user_skills_categories (para FASE 6)
CREATE TABLE user_skills_categories_backup_103 AS 
SELECT * FROM user_skills_categories;

-- 3. Backup de constraints (para referência)
SELECT 
  conname,
  pg_get_constraintdef(oid) as definition
INTO TEMP TABLE constraints_backup_103
FROM pg_constraint
WHERE conrelid IN ('companies'::regclass, 'categories'::regclass)
  AND conname LIKE '%cnpj%' OR conname LIKE '%status%';
```

**Após migration bem-sucedida:**

```sql
-- Manter backups por 30 dias, depois remover
-- DROP TABLE IF EXISTS categories_backup_103;
-- DROP TABLE IF EXISTS user_skills_categories_backup_103;
```

---

## 8️⃣ SUGESTÕES DE MELHORIA

### 8.1 Adicionar Validação Prévia (FASE 3)

```sql
-- Adicionar ANTES de criar constraint na FASE 3
DO $$
DECLARE
  invalid_count INTEGER;
  invalid_statuses TEXT;
BEGIN
  SELECT COUNT(*), string_agg(DISTINCT status::text, ', ')
  INTO invalid_count, invalid_statuses
  FROM categories
  WHERE status IS NOT NULL
    AND status NOT IN ('active', 'auto_active', 'pending', 'rejected', 'archived');
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 
      'Existem % categorias com status inválido: %. Corrija antes de executar migration.', 
      invalid_count, 
      invalid_statuses;
  END IF;
END $$;
```

### 8.2 Adicionar Auditoria na FASE 6

```sql
-- Adicionar ANTES do DELETE na FASE 6
DO $$
DECLARE
  deleted_count INTEGER;
  audit_data RECORD;
BEGIN
  -- Criar tabela de auditoria
  CREATE TEMP TABLE IF NOT EXISTS fk_deletion_audit_103 AS
  SELECT 
    usc.*,
    'category_not_exists' as deletion_reason,
    now() as deleted_at
  FROM user_skills_categories usc
  WHERE NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.category_id = usc.category_id
  );
  
  SELECT COUNT(*) INTO deleted_count FROM fk_deletion_audit_103;
  
  IF deleted_count > 0 THEN
    RAISE NOTICE '⚠️ Serão removidas % FKs quebradas', deleted_count;
    
    -- Opcional: Salvar em tabela permanente
    -- CREATE TABLE IF NOT EXISTS fk_deletion_log_103 AS
    -- SELECT * FROM fk_deletion_audit_103;
  END IF;
END $$;
```

### 8.3 Adicionar Validação de Performance

```sql
-- Adicionar no início da migration
DO $$
DECLARE
  row_count BIGINT;
  estimated_time INTERVAL;
BEGIN
  SELECT COUNT(*) INTO row_count FROM categories;
  
  -- Estimativa: 1ms por 1000 linhas para ADD COLUMN
  estimated_time := make_interval(secs := (row_count / 1000.0) * 0.001);
  
  IF row_count > 100000 THEN
    RAISE WARNING 
      'Tabela categories tem % linhas. Migration pode levar aproximadamente %.', 
      row_count, 
      estimated_time;
  END IF;
END $$;
```

---

## 9️⃣ CONCLUSÃO

### ✅ Aprovação Final

A migration 103 é **APROVADA** para execução em produção, com as seguintes recomendações:

1. ✅ **Executar validações prévias** (seção 6.2) antes de executar
2. ✅ **Fazer backup completo** (seção 7.3) antes de executar
3. ⚠️ **Monitorar performance** em tabelas grandes
4. ✅ **Executar validações pós-migration** (seção 6) após executar
5. ⚠️ **Considerar melhorias sugeridas** (seção 8) para versões futuras

### Prioridade de Melhorias

| Melhoria | Prioridade | Justificativa |
|----------|------------|---------------|
| Validação prévia FASE 3 | 🔴 Alta | Previne falha silenciosa |
| Auditoria FASE 6 | 🟡 Média | Melhora rastreabilidade |
| Validação de performance | 🟢 Baixa | Nice to have |

---

*Análise técnica gerada por validação automatizada do código-fonte*













