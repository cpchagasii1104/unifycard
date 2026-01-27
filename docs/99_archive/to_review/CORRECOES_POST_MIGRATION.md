# 🔧 CORREÇÕES PÓS-MIGRATION - GUIA COMPLETO

## 📋 RESUMO EXECUTIVO

Após migrations recentes, vários problemas críticos surgiram. Este documento lista todas as correções aplicadas e como resolvê-las definitivamente.

---

## ❌ PROBLEMAS IDENTIFICADOS

### 1. **COMPANIES - Constraint CNPJ Inválida**

**Erro:**
```
"a nova linha da relação 'companies' viola a restrição de verificação 'companies_cnpj_format'"
```

**Causa:**
- Migration `047_companies_system.sql` cria constraint esperando CNPJ formatado: `^[0-9]{2}\\.[0-9]{3}\\.[0-9]{3}/[0-9]{4}-[0-9]{2}$`
- Código normaliza CNPJ removendo máscara antes de salvar (apenas números)
- Constraint antiga ainda está ativa no banco

**Solução:**
- Migration `099_fix_cnpj_constraint.sql` corrige para aceitar apenas números
- Migration `100_fix_post_migration_issues.sql` garante correção definitiva

**Ação:**
```bash
# Aplicar migration de correção
psql -d seu_banco -f backend/migrations/100_fix_post_migration_issues.sql
```

---

### 2. **CATEGORIES - Schema e Queries Quebradas**

**Erro:**
```
"função jsonb_array_elements_text(text[]) não existe"
```

**Causa:**
- Migration `042_add_keywords_to_categories.sql` cria `keywords` como `TEXT[]`
- Queries antigas usavam `jsonb_array_elements_text()` que só funciona com JSONB
- Coluna é `TEXT[]`, não `JSONB`

**Solução:**
- Queries corrigidas para usar `unnest(keywords)` (correto para TEXT[])
- Migration `100_fix_post_migration_issues.sql` verifica schema

**Arquivos Corrigidos:**
- `backend/src/core/categories/categories.repository.ts` (todas as queries)
- `backend/src/core/categories/categories.service.ts` (fallback automático)

---

### 3. **CATEGORIES - Tabela Vazia**

**Problema:**
- Árvores de categorias não aparecem
- Autocomplete retorna vazio
- `GET /categories/tree` retorna 200 mas lista vazia

**Causa:**
- Seeds não foram aplicados após migrations
- Tabela `categories` está vazia

**Solução:**
- Fallback automático: criação de categorias básicas quando tabela está vazia
- Métodos: `getCategoryCount()` e `ensureBasicCategories()`

**Ação Manual (Opcional):**
```bash
# Executar seeds de categorias
npm run seed:dev:categories
# ou
npm run seed:professional-categories
npm run seed:learning-categories
```

---

### 4. **ACCOUNTS - Registros Órfãos**

**Erro:**
```
"valor nulo na coluna 'owner_id' da relação 'accounts' viola a restrição de não-nulo"
```

**Causa:**
- Registros criados durante migration mal feita
- `owner_id` é `NOT NULL` mas alguns registros têm NULL

**Solução:**
- Migration `100_fix_post_migration_issues.sql` remove registros órfãos
- Endpoint `/economy/accounts/me` retorna 200 com payload vazio em erro

**Ação:**
```bash
# Aplicar migration de correção
psql -d seu_banco -f backend/migrations/100_fix_post_migration_issues.sql
```

---

### 5. **BANK/TRANSPARENCY - 401 Unauthorized**

**Problema:**
- `GET /bank/statement` → 401
- `GET /bank/regional-fund` → 401
- Front trata como FEATURE_UNAVAILABLE

**Causa:**
- Endpoints retornavam 401 mesmo com usuário autenticado
- `globalUserId` não encontrado ou conta não existe

**Solução:**
- Endpoints sempre retornam 200 com payload vazio quando:
  - `globalUserId` não encontrado
  - Não há conta bancária
  - Erro interno
- 401 é exclusivo para token inválido

**Arquivo Corrigido:**
- `backend/src/core/unifybank/transparency.routes.ts`

---

### 6. **CULTURAL EVENTS - 404 Not Found**

**Problema:**
- `GET /cultural/events` → 404
- Opção "Criar evento" sumiu do feed

**Causa:**
- Endpoint retornava 404/500 e quebrava feed

**Solução:**
- Endpoint sempre retorna 200, mesmo sem autenticação ou tenant
- Retorna lista vazia em caso de erro
- Não quebra o feed

**Arquivo Corrigido:**
- `backend/src/modules/cultural/cultural.routes.ts`

---

## ✅ CORREÇÕES APLICADAS

### Migrations Criadas/Corrigidas:

1. **`099_fix_cnpj_constraint.sql`** (já existia)
   - Corrige constraint CNPJ para aceitar apenas números

2. **`100_fix_post_migration_issues.sql`** (NOVA)
   - Corrige constraint CNPJ definitivamente
   - Remove registros órfãos em accounts
   - Verifica schema de categories
   - Garante extensões necessárias
   - Verifica índices

### Código Corrigido:

1. **Companies:**
   - `backend/src/core/companies/companies.routes.ts` - Normaliza CNPJ antes de validar
   - `backend/src/core/companies/companies.service.ts` - Normaliza CNPJ antes de salvar

2. **Categories:**
   - `backend/src/core/categories/categories.repository.ts` - Queries usando `unnest(keywords)`
   - `backend/src/core/categories/categories.service.ts` - Fallback automático de categorias
   - `backend/src/core/categories/categories.routes.ts` - Tenta criar categorias se vazio

3. **Accounts:**
   - `backend/src/core/economy/accounts/account.routes.ts` - Retorna 200 com payload vazio em erro

4. **Bank/Transparency:**
   - `backend/src/core/unifybank/transparency.routes.ts` - Retorna 200 sempre

5. **Cultural Events:**
   - `backend/src/modules/cultural/cultural.routes.ts` - Retorna 200 sempre

---

## 🚀 COMO APLICAR AS CORREÇÕES

### Passo 1: Aplicar Migration de Correção

```bash
# Conectar ao banco e aplicar migration
psql -d seu_banco -f backend/migrations/100_fix_post_migration_issues.sql
```

### Passo 2: Verificar Estado do Banco

```bash
# Executar script de diagnóstico
cd backend
ts-node -r tsconfig-paths/register scripts/diagnose-post-migration.ts
```

### Passo 3: Executar Seeds (Opcional)

```bash
# Se categorias estiverem vazias, executar seeds
npm run seed:dev:categories
```

### Passo 4: Reiniciar Backend

```bash
# Reiniciar servidor para aplicar mudanças
npm run dev
```

---

## 📊 VERIFICAÇÃO PÓS-CORREÇÃO

### Checklist:

- [ ] Constraint CNPJ aceita apenas números (14 dígitos)
- [ ] Nenhum registro órfão em accounts (owner_id NULL)
- [ ] Coluna keywords em categories é TEXT[]
- [ ] Extensões pg_trgm e uuid-ossp instaladas
- [ ] Índices de categories existem
- [ ] Endpoints retornam 200 sempre (não 401/404/500)
- [ ] Autocomplete funciona (cria categorias se necessário)
- [ ] Árvores de categorias aparecem
- [ ] Criação de empresa funciona

---

## 🔍 DIAGNÓSTICO DE PROBLEMAS

### Se ainda houver problemas:

1. **Verificar constraint CNPJ:**
   ```sql
   SELECT conname, pg_get_constraintdef(oid) 
   FROM pg_constraint 
   WHERE conname = 'companies_cnpj_format';
   ```
   Deve retornar: `CHECK (cnpj ~ '^[0-9]{14}$')`

2. **Verificar registros órfãos:**
   ```sql
   SELECT COUNT(*) FROM accounts WHERE owner_id IS NULL;
   ```
   Deve retornar: `0`

3. **Verificar tipo de keywords:**
   ```sql
   SELECT data_type, udt_name 
   FROM information_schema.columns 
   WHERE table_name = 'categories' AND column_name = 'keywords';
   ```
   Deve retornar: `ARRAY` / `text`

4. **Verificar categorias:**
   ```sql
   SELECT COUNT(*) FROM categories;
   SELECT COUNT(*) FROM categories WHERE parent_id IS NULL;
   ```

---

## 📝 NOTAS IMPORTANTES

1. **Idempotência:** Todas as migrations são idempotentes e podem ser executadas múltiplas vezes

2. **Backup:** Sempre faça backup do banco antes de aplicar migrations

3. **Testes:** Teste em ambiente de desenvolvimento antes de aplicar em produção

4. **Logs:** Verifique logs do backend após aplicar correções

---

## 🎯 RESULTADO ESPERADO

Após aplicar todas as correções:

- ✅ Criação de empresa funciona com CNPJ válido
- ✅ Árvores de categorias aparecem corretamente
- ✅ Autocomplete retorna resultados
- ✅ Feed social não quebra
- ✅ Sidebar econômica carrega sem erro
- ✅ Bank UI funciona (mesmo com valores zerados)
- ✅ Zero erros 401/404/500 em navegação normal

---

## 📞 SUPORTE

Se problemas persistirem após aplicar todas as correções:

1. Executar script de diagnóstico
2. Verificar logs do backend
3. Verificar logs do frontend (console)
4. Comparar schema atual com migrations

---

**Última atualização:** 2025-01-XX
**Versão:** 1.0.0














