# 🚀 Executar Migration 089 - token_version

## ⚠️ PROBLEMA ATUAL
O erro `coluna "token_version" não existe` ocorre porque a migration ainda não foi aplicada ao banco de dados.

## ✅ SOLUÇÃO
Execute a migration `089_add_token_version_to_users.sql` para adicionar a coluna `token_version` à tabela `users`.

## 📋 OPÇÕES DE EXECUÇÃO

### Opção 1: Executar todas as migrations pendentes (RECOMENDADO)
```bash
cd backend
pnpm run migrate
# ou
npm run migrate
```

### Opção 2: Executar apenas a migration 089 via psql
```bash
# Conectar ao banco
psql -U seu_usuario -d seu_banco

# Executar a migration
\i migrations/089_add_token_version_to_users.sql

# Ou executar diretamente:
psql -U seu_usuario -d seu_banco -f migrations/089_add_token_version_to_users.sql
```

### Opção 3: Executar SQL diretamente
```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN users.token_version IS 'Versão do token JWT para invalidação de sessões (logout global)';
```

## ✅ VALIDAÇÃO PÓS-MIGRATION

Após executar a migration, valide:

```sql
-- 1. Verificar se a coluna existe
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'token_version';

-- 2. Verificar valores existentes
SELECT user_id, email, token_version FROM users LIMIT 5;

-- 3. Testar que DEFAULT funciona
INSERT INTO users (tenant_id, email, password_hash)
VALUES ('00000000-0000-0000-0000-000000000000', 'test@test.com', 'hash')
RETURNING user_id, token_version;
-- Deve retornar token_version = 0
```

## 🎯 RESULTADO ESPERADO

Após a migration:
- ✅ Coluna `token_version` existe na tabela `users`
- ✅ Todos os usuários existentes têm `token_version = 0`
- ✅ Novos usuários recebem `token_version = 0` automaticamente
- ✅ POST `/auth/login` retorna 200 OK
- ✅ JWT contém `tokenVersion` no payload















