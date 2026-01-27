# 🔧 CORREÇÕES PRÁTICAS — UnifiCard
**Data:** 03/01/2025
**Prioridade:** BLOQUEADORES DE PRODUÇÃO

---

## 🚨 CORREÇÃO 1: Renumerar Migrations Duplicadas

### Problema
Existem 2 pares de migrations com números duplicados:
- `100_add_years_experience_and_hourly_rate.sql` e `100_fix_post_migration_issues.sql`
- `103_consolidation_fix_all_issues.sql` e `103_consolidation_fix_all_issues_IMPROVED.sql`

### Solução

```bash
cd backend/migrations

# Renumerar para evitar conflitos
mv 100_fix_post_migration_issues.sql 102_fix_post_migration_issues.sql
mv 103_consolidation_fix_all_issues_IMPROVED.sql 106_consolidation_fix_all_issues_IMPROVED.sql
```

### Verificação
```bash
# Confirmar que não há mais duplicatas
ls -la | cut -d'_' -f1 | sort | uniq -d
# Deve retornar vazio
```

---

## 🚨 CORREÇÃO 2: Resolver Conflito de Categories

### Problema
Migration 118 cria tabela `categories` com estrutura conflitante com migration 040.

### Opção A: Se Migration 118 NÃO foi executada ainda

```bash
# Mover para pasta de backup
mkdir -p backend/migrations/_deprecated
mv backend/migrations/118_category_core.sql backend/migrations/_deprecated/
```

### Opção B: Se Migration 118 JÁ foi executada

Criar migration de correção:

```sql
-- backend/migrations/120_fix_category_conflicts.sql

BEGIN;

-- 1. Verificar qual constraint existe
DO $$
BEGIN
  -- Se categories_slug_unique existe (do 118), converter para o formato do 040
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'categories_slug_unique' 
    AND conrelid = 'categories'::regclass
  ) THEN
    ALTER TABLE categories DROP CONSTRAINT categories_slug_unique;
    ALTER TABLE categories ADD CONSTRAINT categories_unique_slug_per_parent 
      UNIQUE (parent_id, slug);
  END IF;
END $$;

-- 2. Adicionar colunas faltantes se não existirem
ALTER TABLE categories 
  ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS path TEXT[] DEFAULT '{}';

-- 3. Recalcular path e level para registros existentes
UPDATE categories c
SET 
  level = CASE 
    WHEN parent_id IS NULL THEN 0
    ELSE (SELECT level + 1 FROM categories p WHERE p.category_id = c.parent_id)
  END,
  path = CASE
    WHEN parent_id IS NULL THEN ARRAY[slug]
    ELSE (SELECT path || c.slug FROM categories p WHERE p.category_id = c.parent_id)
  END
WHERE level = 0 OR path = '{}';

COMMIT;
```

---

## 🚨 CORREÇÃO 3: Limpar Duplicidade de API no Frontend

### Problema
Frontend tem 2 arquivos de API para categories:
- `src/api/categories.ts` (legado, usado para profissionais)
- `src/api/category.ts` (Category Core, NÃO usado)

### Solução

1. **Deletar api/category.ts:**
```bash
rm frontend/src/api/category.ts
```

2. **Verificar imports:**
```bash
grep -rn "from.*category" frontend/src --include="*.ts" --include="*.tsx"
# Se houver, substituir por "from './categories'" ou remover
```

3. **Manter api/groups.ts** com `getGroupCategories()` que está correto.

---

## ✅ VERIFICAÇÃO DO FLUXO DE GRUPOS

### Diagnóstico Rápido

1. **Abrir DevTools (F12) → Network**
2. **Navegar para /grupos/novo**
3. **Procurar chamada para `/groups/categories`**

### Cenários:

| Status | Significado | Ação |
|--------|-------------|------|
| 200 OK | Endpoint funciona | Verificar se dados estão corretos |
| 401 Unauthorized | Token não enviado | Verificar se usuário está logado |
| 404 Not Found | Rota não existe | Verificar se módulo está registrado |
| 500 Error | Erro no servidor | Verificar logs do backend |

### Se 200 mas categorias não aparecem:

```typescript
// Adicionar log em CreateGroupWizard.tsx linha 76
const cats = await getGroupCategories();
console.log('[DEBUG] Categorias recebidas:', cats);
setCategories(cats);
```

---

## 📋 CHECKLIST PRÉ-DEPLOY

### Migrations
- [ ] Renumerar 100 e 103 duplicadas
- [ ] Verificar se 118 está causando conflito
- [ ] Executar `SELECT * FROM schema_migrations ORDER BY version`

### Categories
- [ ] `group_categories` tem 9 registros de seed
- [ ] `categories` tem scope e is_active configurados
- [ ] Frontend só usa uma API de categories

### CPF
- [ ] Nenhum CPF em `profiles.metadata`
- [ ] Todos os CPFs em `user_profiles.cpf`
- [ ] Trigger `prevent_cpf_in_metadata` ativo

### Grupos
- [ ] Endpoint `/groups/categories` retorna 200
- [ ] Criação de grupo funciona (testar manualmente)
- [ ] Location está sendo salva corretamente

---

## 🔄 ORDEM DE EXECUÇÃO DAS CORREÇÕES

```
1. Renumerar migrations (PRIMEIRO - sem isso, deploy é instável)
       ↓
2. Verificar estado do banco com DIAGNOSTICO_SQL.sql
       ↓
3. Resolver conflito de categories (se houver)
       ↓
4. Limpar frontend (deletar api/category.ts)
       ↓
5. Testar fluxo de criação de grupo
       ↓
6. Deploy
```

---

## 🆘 TROUBLESHOOTING

### "Categorias não aparecem no select"

1. Verificar se `group_categories` tem dados:
```sql
SELECT * FROM group_categories;
```

2. Se vazio, executar seed manualmente:
```sql
INSERT INTO group_categories (name, slug, icon, description) VALUES
  ('Bandas & Música', 'bandas-musica', '🎵', 'Grupos de música, bandas e artistas'),
  ('Motoclubes', 'motoclubes', '🏍️', 'Clubes de motociclistas'),
  ('Igrejas & Fé', 'igrejas-fe', '⛪', 'Comunidades religiosas')
ON CONFLICT (slug) DO NOTHING;
```

### "Erro 401 ao buscar categorias"

1. Verificar se usuário está logado
2. Verificar se token JWT está válido
3. Verificar se `protectedScope` está correto no server.ts

### "Erro ao criar grupo"

1. Verificar se todos os campos obrigatórios estão preenchidos
2. Verificar se `category_id` é UUID válido
3. Verificar se `country_id` existe em `countries`

---

*Documento de correções criado em 03/01/2025*
*Usar junto com AUDITORIA_PROFUNDA_2025-01-03.md*
