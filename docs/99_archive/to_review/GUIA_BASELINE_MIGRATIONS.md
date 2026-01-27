# 🚀 Guia de Baseline de Migrations

## 📋 Problema

Quando um banco de dados já existe e possui todas as tabelas criadas, executar `pnpm run migrate` tenta rodar **todas** as migrations desde a 001, causando erros como "relação já existe".

## ✅ Solução: Sistema de Baseline

O sistema agora possui:
1. **Tabela de controle** (`schema_migrations`) para rastrear migrations executadas
2. **Script de baseline** para marcar migrations antigas como já executadas
3. **Migrator inteligente** que executa apenas migrations pendentes

---

## 🎯 Passo a Passo para Banco Existente

### 1️⃣ Executar Baseline (Primeira Vez)

Se seu banco já tem todas as tabelas até a migration 088:

```bash
cd backend
pnpm run baseline:migrations
```

**O que isso faz:**
- Cria a tabela `schema_migrations` (se não existir)
- Marca todas as migrations até `088_votes_system.sql` como já executadas
- **NÃO executa** as migrations, apenas marca como executadas

### 2️⃣ Executar Migrations Novas

Após o baseline, execute migrations normalmente:

```bash
pnpm run migrate
```

**O que isso faz:**
- Verifica quais migrations já foram executadas (via `schema_migrations`)
- Executa **apenas** migrations pendentes (ex: `089_add_token_version_to_users.sql`)
- Marca automaticamente como executadas após sucesso

---

## 🔧 Configuração do Baseline

O script `baseline-migrations.ts` está configurado para marcar até `088_votes_system.sql`.

**Para ajustar**, edite `backend/src/scripts/baseline-migrations.ts`:

```typescript
const config: BaselineConfig = {
  lastMigrationToMark: '088_votes_system.sql', // Ajuste aqui
  markAllUpTo: true, // true = marca todas até esta, false = marca apenas esta
};
```

---

## 📊 Verificar Status

### Ver migrations executadas:

```sql
SELECT filename, executed_at 
FROM schema_migrations 
ORDER BY executed_at;
```

### Ver migrations pendentes:

O comando `pnpm run migrate` mostra automaticamente:
- Total de migrations disponíveis
- Quantas já foram executadas
- Quais estão pendentes

---

## ⚠️ Cenários Especiais

### Cenário 1: Banco Novo (Sem Tabelas)

**Não precisa de baseline!** Apenas execute:

```bash
pnpm run migrate
```

A migration `000_schema_migrations.sql` será executada primeiro automaticamente.

### Cenário 2: Banco Existente (Com Tabelas)

**Execute baseline primeiro:**

```bash
# 1. Baseline
pnpm run baseline:migrations

# 2. Migrations novas
pnpm run migrate
```

### Cenário 3: Apenas Uma Migration Específica

Se você quer marcar apenas uma migration específica como executada:

1. Edite `baseline-migrations.ts`:
   ```typescript
   const config: BaselineConfig = {
     lastMigrationToMark: '050_social_2_0.sql',
     markAllUpTo: false, // Marca apenas esta
   };
   ```

2. Execute:
   ```bash
   pnpm run baseline:migrations
   ```

---

## 🛡️ Segurança e Idempotência

### ✅ Características Seguras

1. **Idempotente**: Executar baseline múltiplas vezes é seguro
2. **Não destrutivo**: Baseline apenas marca, não executa SQL
3. **Verificação**: Não marca migrations já marcadas
4. **Isolado**: Não afeta dados existentes

### ✅ Validações

- Verifica se tabela `schema_migrations` existe antes de usar
- Cria automaticamente se não existir
- Não tenta executar migrations já marcadas
- Logs claros de cada operação

---

## 📝 Estrutura da Tabela schema_migrations

```sql
CREATE TABLE schema_migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checksum VARCHAR(64),        -- Hash do SQL (validação)
  execution_time_ms INTEGER    -- Tempo de execução
);
```

---

## 🎯 Resultado Esperado

Após executar baseline + migrate:

```bash
$ pnpm run baseline:migrations
🚀 Iniciando baseline de migrations...
✔ Conexão com banco de dados estabelecida
📋 Marcando 88 migration(s) como executadas...
✅ 001_initial_schema.sql marcada como executada
✅ 002_rbac.sql marcada como executada
...
✅ 088_votes_system.sql marcada como executada
✨ Baseline concluído com sucesso!

$ pnpm run migrate
🚀 Iniciando processo de migração...
✔ Conexão com banco de dados estabelecida
📊 Migrations já executadas: 88
📋 Encontradas 1 migração(ões) pendente(s) de 89 total:
  1. 089_add_token_version_to_users.sql
[1/1]
📦 Executando migração: 089_add_token_version_to_users.sql
✅ Migração concluída: 089_add_token_version_to_users.sql (45ms)
✨ Todas as migrações pendentes foram aplicadas com sucesso!
```

---

## ❓ FAQ

**P: Posso executar baseline múltiplas vezes?**  
R: Sim, é idempotente. Migrations já marcadas são ignoradas.

**P: O baseline executa SQL das migrations?**  
R: Não. Baseline apenas marca como executadas, não executa o SQL.

**P: E se eu marcar uma migration que não foi executada?**  
R: O sistema assume que você executou manualmente. Certifique-se de que o estado do banco está correto.

**P: Como desfazer um baseline?**  
R: Delete os registros da tabela `schema_migrations`:
```sql
DELETE FROM schema_migrations WHERE filename = 'XXX_nome.sql';
```

**P: Posso executar migrations manualmente e depois marcar?**  
R: Sim. Execute manualmente via psql, depois rode baseline para marcar.

---

## 📚 Arquivos Relacionados

- `backend/src/core/db/migrate.ts` - Migrator principal
- `backend/src/scripts/baseline-migrations.ts` - Script de baseline
- `backend/migrations/000_schema_migrations.sql` - Tabela de controle
- `backend/migrations/089_add_token_version_to_users.sql` - Migration exemplo

---

**Última atualização:** 2024-12-19















