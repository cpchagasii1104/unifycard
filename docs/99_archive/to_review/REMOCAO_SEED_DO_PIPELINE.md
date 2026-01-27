# 🌱 Remoção de Seed Demo do Pipeline Padrão de Migrations

## 📋 Resumo Executivo

Seed de demonstração (`035_seed_demo_city_nova_beauty.sql`) foi **movido** para pasta `seeds/` e **removido** do pipeline padrão de migrations.

Seeds agora só executam com flag explícita `RUN_SEEDS=true`.

---

## ✅ Implementação

### Arquivos Modificados

1. **`backend/src/core/db/migrate.ts`**
   - Adicionada função `getSeedFiles()` que lê diretório `seeds/`
   - Seeds só são executados se `RUN_SEEDS=true`
   - Seeds são executados **após** migrations (se flag estiver presente)

2. **`backend/migrations/035_seed_demo_city_nova_beauty.sql`**
   - ❌ **Removido** de `migrations/`
   - ✅ **Movido** para `backend/seeds/035_seed_demo_city_nova_beauty.sql`

### Arquivos Criados

1. **`backend/seeds/035_seed_demo_city_nova_beauty.sql`**
   - Seed de demonstração movido para pasta dedicada
   - Comentários atualizados (não é mais "migration")

2. **`backend/seeds/README.md`**
   - Documentação sobre seeds
   - Instruções de uso

---

## 🚀 Como Usar

### Executar Seeds (Desenvolvimento/Staging)

```bash
# Definir flag no .env
RUN_SEEDS=true

# Ou via linha de comando
RUN_SEEDS=true pnpm migrate
```

**Resultado**: Seeds são executados após migrations.

### Não Executar Seeds (Padrão/Produção)

```bash
# Seeds não são executados por padrão
pnpm migrate
```

**Resultado**: Apenas migrations são executadas, seeds são ignorados.

---

## ✅ Critérios de Aceite Atendidos

✅ **Subir banco sem flag NÃO cria dados demo**:
- Seeds não são executados por padrão
- Apenas migrations são executadas

✅ **Com flag explícita, seed roda normalmente**:
- `RUN_SEEDS=true` executa seeds após migrations
- Seeds são executados em ordem alfabética

✅ **Dados já existentes não são removidos**:
- Seed é idempotente (pode rodar múltiplas vezes)
- Usa `ON CONFLICT DO NOTHING` e verificações de existência

✅ **Sem hardcode de environment**:
- Usa variável de ambiente `RUN_SEEDS`
- Não verifica `NODE_ENV` ou outros ambientes

---

## 📊 Comportamento do Sistema

### Pipeline Padrão (sem RUN_SEEDS)

1. Executa migrations de `migrations/`
2. Ignora diretório `seeds/`
3. Log: "⏭️ Seeds ignorados (RUN_SEEDS não está definido como true)"

### Pipeline com RUN_SEEDS=true

1. Executa migrations de `migrations/`
2. Executa seeds de `seeds/` (após migrations)
3. Log: "🌱 Executando seeds (RUN_SEEDS=true)..."

---

## 🔍 Verificação

### Verificar se Seed Foi Executado

```sql
-- Verificar tenant demo
SELECT * FROM tenants WHERE slug = 'cidade-nova-demo';

-- Verificar usuária demo
SELECT * FROM users WHERE email = 'maria.manicure@cidadenova.demo';
```

### Verificar se Seed NÃO Foi Executado (Padrão)

```sql
-- Não deve existir
SELECT * FROM tenants WHERE slug = 'cidade-nova-demo';
-- Resultado esperado: 0 linhas
```

---

## ⚠️ Regras Importantes

1. **Seeds não são migrations**: Seeds estão em pasta separada
2. **Execução controlada**: Seeds só rodam com flag explícita
3. **Idempotência**: Seeds podem rodar múltiplas vezes sem duplicar dados
4. **Baseline**: Seeds não são incluídos no baseline automático

---

## 📁 Estrutura de Diretórios

```
backend/
├── migrations/          # Migrations de schema (sempre executadas)
│   ├── 001_*.sql
│   ├── 002_*.sql
│   └── ...
└── seeds/              # Seeds de demonstração (execução controlada)
    ├── 035_seed_demo_city_nova_beauty.sql
    └── README.md
```

---

## 🧪 Teste de Validação

### Teste 1: Pipeline Padrão (sem RUN_SEEDS)

```bash
# Resetar banco
pnpm reset:database

# Executar migrations (padrão)
pnpm migrate

# Verificar: Seed NÃO deve ter sido executado
psql $DATABASE_URL -c "SELECT * FROM tenants WHERE slug = 'cidade-nova-demo';"
```

**Resultado esperado**: 0 linhas (seed não executado).

### Teste 2: Pipeline com RUN_SEEDS=true

```bash
# Resetar banco
pnpm reset:database

# Executar migrations + seeds
RUN_SEEDS=true pnpm migrate

# Verificar: Seed deve ter sido executado
psql $DATABASE_URL -c "SELECT * FROM tenants WHERE slug = 'cidade-nova-demo';"
```

**Resultado esperado**: 1 linha (seed executado).

---

**Status**: ✅ Implementado e validado  
**Data**: 2024














