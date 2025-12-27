# ✅ Baseline Automático de Migrations - Implementado

## 📋 Resumo Executivo

**Status:** ✅ **IMPLEMENTADO E PRONTO PARA USO**

Sistema de baseline automático que detecta quando o banco já possui tabelas mas `schema_migrations` está vazio, e marca migrations antigas (001-088) como executadas automaticamente.

---

## 🎯 O Que Foi Implementado

### 1️⃣ Detecção Automática de Banco Populado

**Função:** `hasMainTables()`

- Verifica se tabelas principais (`users`, `tenants`) existem
- Indica que o banco já foi populado no passado
- Usado para decidir se baseline é necessário

### 2️⃣ Baseline Automático

**Função:** `performAutoBaseline()`

**Lógica:**
1. Verifica se tabelas principais existem
2. Verifica se `schema_migrations` está vazio ou quase vazio (≤ 5 migrations)
3. Se sim, marca automaticamente migrations 001-088 como executadas
4. **NÃO executa** o SQL das migrations, apenas marca no controle
5. Migrations 089+ são **ignoradas** no baseline (serão executadas normalmente)

**Características:**
- ✅ Idempotente (pode executar múltiplas vezes)
- ✅ Não destrutivo (não executa SQL)
- ✅ Seguro (não altera dados)
- ✅ Automático (sem intervenção manual)

### 3️⃣ Fluxo Completo

```
1. Conectar ao banco
2. Criar schema_migrations (se não existir)
3. Verificar se tabelas principais existem
4. Se sim E schema_migrations vazio:
   → Baseline automático (marca 001-088)
5. Verificar migrations executadas
6. Filtrar apenas pendentes
7. Executar apenas pendentes (ex: 089+)
```

---

## 🔍 Como Funciona

### Cenário 1: Banco Novo (Vazio)

```
1. hasMainTables() → false
2. Baseline NÃO executado
3. Todas as migrations executadas normalmente
4. Migration 000 cria schema_migrations
5. Migrations seguintes são marcadas automaticamente
```

### Cenário 2: Banco Existente (Com Tabelas, Sem Controle)

```
1. hasMainTables() → true
2. schema_migrations vazio (count = 0)
3. Baseline AUTOMÁTICO executado:
   → Marca 001-088 como executadas
4. Verifica pendentes:
   → Apenas 089+ estão pendentes
5. Executa apenas 089_add_token_version_to_users.sql
```

### Cenário 3: Banco Sincronizado

```
1. hasMainTables() → true
2. schema_migrations tem > 5 migrations
3. Baseline NÃO executado (já sincronizado)
4. Executa apenas migrations realmente pendentes
```

---

## 📝 Código Implementado

### Função `hasMainTables()`

```typescript
async function hasMainTables(): Promise<boolean> {
  // Verifica se users E tenants existem
  // Indica banco populado
}
```

### Função `performAutoBaseline()`

```typescript
async function performAutoBaseline(allMigrations: MigrationFile[]): Promise<void> {
  // 1. Verifica se tabelas principais existem
  // 2. Verifica se schema_migrations está vazio
  // 3. Marca migrations 001-088 como executadas
  // 4. Ignora migration 000 (executada normalmente)
  // 5. Ignora migrations 089+ (executadas normalmente)
}
```

### Integração no `main()`

```typescript
// Garante que tabela de controle existe
await ensureMigrationsTable();

// Obtém todas as migrations
const allMigrations = await getMigrationFiles();

// BASELINE AUTOMÁTICO (antes de verificar executadas)
await performAutoBaseline(allMigrations);

// Agora verifica executadas (após baseline)
const executedMigrations = await getExecutedMigrations();

// Filtra apenas pendentes
const pendingMigrations = allMigrations.filter(
  (m) => !executedMigrations.has(m.filename)
);

// Executa apenas pendentes
```

---

## ✅ Validações e Segurança

### ✅ Idempotência

- Baseline pode ser executado múltiplas vezes
- Migrations já marcadas são ignoradas
- `ON CONFLICT DO NOTHING` previne duplicatas

### ✅ Não Destrutivo

- Baseline **não executa** SQL das migrations
- Apenas marca como executadas no controle
- Não altera dados existentes

### ✅ Compatibilidade

- Funciona com bancos novos (baseline não executado)
- Funciona com bancos existentes (baseline automático)
- Não quebra migrations antigas (001-088)

### ✅ Threshold de Segurança

- Baseline só executa se `schema_migrations` tem ≤ 5 migrations
- Se já tem > 5, assume que está sincronizado
- Previne baseline acidental em bancos já sincronizados

---

## 🎯 Resultado Esperado

### Para Banco Existente (Situação Atual):

```bash
$ pnpm run migrate

🚀 Iniciando processo de migração...
✔ Conexão com banco de dados estabelecida
📋 Criando tabela de controle de migrations...
✅ Tabela schema_migrations criada

🔍 Detectado: Banco já possui tabelas principais mas schema_migrations está vazio
📋 Executando baseline automático...

📌 Marcando 88 migration(s) como executadas (baseline automático):
  ✅ 001_initial_schema.sql
  ✅ 002_rbac.sql
  ...
  ✅ 088_votes_system.sql

✨ Baseline automático concluído: 88 migration(s) marcadas

📊 Migrations já executadas: 88

📋 Encontradas 1 migração(ões) pendente(s) de 89 total:
  1. 089_add_token_version_to_users.sql

[1/1]
📦 Executando migração: 089_add_token_version_to_users.sql
✅ Migração concluída: 089_add_token_version_to_users.sql (45ms)

✨ Todas as migrações pendentes foram aplicadas com sucesso!
```

### Para Banco Novo:

```bash
$ pnpm run migrate

🚀 Iniciando processo de migração...
✔ Conexão com banco de dados estabelecida
📋 Criando tabela de controle de migrations...
✅ Tabela schema_migrations criada

📊 Migrations já executadas: 0

📋 Encontradas 89 migração(ões) pendente(s) de 89 total:
  1. 000_schema_migrations.sql
  2. 001_initial_schema.sql
  ...
  89. 089_add_token_version_to_users.sql

[1/89]
📦 Executando migração: 000_schema_migrations.sql
✅ Migração concluída: 000_schema_migrations.sql (12ms)
...
```

---

## 📊 Arquivos Modificados

### ✅ `backend/src/core/db/migrate.ts`

**Adicionado:**
- `hasMainTables()` - Detecta banco populado
- `performAutoBaseline()` - Baseline automático
- Integração no fluxo principal

**Modificado:**
- `main()` - Chama baseline antes de verificar executadas

---

## 🛡️ Garantias

### ✅ Não Apaga Banco
- Baseline apenas marca, não executa SQL
- Não remove dados

### ✅ Não Pede Reset
- Tudo automático
- Sem intervenção manual

### ✅ Não Assume Banco Vazio
- Detecta automaticamente
- Adapta comportamento

### ✅ Não Exige SQL Manual
- Tudo via `pnpm run migrate`
- Sem comandos SQL manuais

### ✅ Não Quebra Ambientes Novos
- Banco vazio funciona normalmente
- Baseline não executa se não necessário

---

## ✅ Confirmação Final

**A migration 089 (`089_add_token_version_to_users.sql`) será executada corretamente após o baseline automático!**

**Sistema está pronto para uso imediato.**

---

**Última atualização:** 2024-12-19


