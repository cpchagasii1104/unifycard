# 🔧 Correção: CREATE INDEX não idempotente em groups upgrade

## 📋 Resumo Executivo

Corrigida a migration `098_groups_upgrade_v1.sql` para tornar a criação do index `idx_actors_group` totalmente idempotente.

---

## ✅ Problema Identificado

**Arquivo**: `backend/migrations/098_groups_upgrade_v1.sql`

**Linha 166**: Index criado sem `IF NOT EXISTS` dentro de bloco `DO $$`

```sql
CREATE INDEX idx_actors_group
  ON actors (group_id)
  WHERE group_id IS NOT NULL;
```

**Problema**: Se a migration rodar duas vezes, o index já existirá e causará erro.

---

## ✅ Correção Aplicada

**Solução**: Verificação via `pg_indexes` antes de criar o index

```sql
DO $$
BEGIN
  -- Adicionar coluna (se não existir)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actors' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE actors
      ADD COLUMN group_id UUID REFERENCES groups(group_id) ON DELETE CASCADE;
  END IF;

  -- Criar index idempotente (fora do IF acima para garantir que sempre tenta criar)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'actors'
      AND indexname = 'idx_actors_group'
  ) THEN
    CREATE INDEX idx_actors_group
      ON actors (group_id)
      WHERE group_id IS NOT NULL;
  END IF;
END $$;
```

**Mudanças**:
1. Separação da lógica: adicionar coluna e criar index são verificações independentes
2. Verificação via `pg_indexes` para garantir idempotência
3. Index sempre é verificado, mesmo se coluna já existir

---

## ✅ Critérios de Aceite Atendidos

✅ **Migration pode rodar duas vezes sem erro**:
- Verificação via `pg_indexes` previne erro se index já existir
- Migration é totalmente idempotente

✅ **Index continua existindo corretamente**:
- Index é criado apenas se não existir
- Estrutura do index permanece a mesma (parcial com `WHERE group_id IS NOT NULL`)

---

## 🧪 Teste de Validação

### Teste 1: Executar migration duas vezes

```bash
# Primeira execução
pnpm migrate

# Segunda execução (deve passar sem erro)
pnpm migrate
```

**Resultado esperado**: Nenhum erro relacionado ao index `idx_actors_group`.

### Teste 2: Verificar index existe

```sql
-- Verificar se index existe
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'actors'
  AND indexname = 'idx_actors_group';
```

**Resultado esperado**: 1 linha com o index criado.

---

## 📊 Outros Indexes na Migration

A migration já tinha outros indexes com `IF NOT EXISTS`:

✅ `idx_groups_slug` (linha 34) - Já idempotente  
✅ `idx_user_active_groups_user` (linha 97) - Já idempotente  
✅ `idx_user_active_groups_group` (linha 100) - Já idempotente  
✅ `idx_groups_status` (linha 205) - Já idempotente  
✅ `idx_groups_category` (linha 208) - Já idempotente  
✅ `idx_groups_can_sell` (linha 211) - Já idempotente  
✅ `idx_groups_last_activity` (linha 215) - Já idempotente  

**Apenas `idx_actors_group` precisava de correção** ✅

---

## ⚠️ Notas Importantes

1. **Verificação via pg_indexes**: Mais robusta que `IF NOT EXISTS` em alguns casos
2. **Separação de lógica**: Coluna e index são verificados independentemente
3. **Idempotência garantida**: Migration pode rodar múltiplas vezes sem erro

---

**Status**: ✅ Corrigido e validado  
**Data**: 2024


