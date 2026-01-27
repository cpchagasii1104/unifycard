# Setup do Category Input Gate

## Pré-requisitos

1. PostgreSQL com extensão `pg_trgm` habilitada
2. Migration `059_create_occupations_reference.sql` aplicada
3. Node.js >= 20

## Passo 1: Habilitar Extensão pg_trgm

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Verificar se está habilitado:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
```

## Passo 2: Aplicar Migration 059

```bash
cd backend
# Aplicar migration manualmente ou via script de migração
psql $DATABASE_URL -f migrations/059_create_occupations_reference.sql
```

Verificar tabelas criadas:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('occupations_reference', 'embeddings_cache', 'category_input_audit');
```

Verificar índices:
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('occupations_reference', 'category_input_audit')
ORDER BY tablename, indexname;
```

## Passo 3: Importar CBO

### 3.1 Gerar arquivo JSON (fetch)

```bash
npm run cbo:fetch
```

Isso gera `docs/seed/cbo-occupations.json` com ocupações de exemplo.

**Nota:** Em produção, você precisará baixar o CBO oficial do governo brasileiro e converter para este formato.

### 3.2 Popular banco de dados (seed)

```bash
npm run cbo:seed
```

Isso faz UPSERT em `occupations_reference` com todas as ocupações do JSON.

## Passo 4: Validar Setup

```sql
-- Verificar total de ocupações
SELECT COUNT(*) FROM occupations_reference;

-- Verificar índices trgm
SELECT indexname FROM pg_indexes 
WHERE tablename = 'occupations_reference' 
AND indexdef LIKE '%trgm%';

-- Testar busca fuzzy
SELECT title, similarity(normalized_title, 'dentista') AS sim
FROM occupations_reference
WHERE normalized_title % 'dentista'
ORDER BY sim DESC
LIMIT 5;
```

## Troubleshooting

### Erro: "extension pg_trgm does not exist"

```sql
-- Instalar extensão (requer privilégios de superuser)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Erro: "relation occupations_reference does not exist"

Aplicar migration 059:
```bash
psql $DATABASE_URL -f migrations/059_create_occupations_reference.sql
```

### Erro: "arquivo cbo-occupations.json não encontrado"

Executar primeiro:
```bash
npm run cbo:fetch
```

## Verificação Final

Após setup completo, você deve ter:

- ✅ Extensão `pg_trgm` habilitada
- ✅ Tabela `occupations_reference` criada
- ✅ Tabela `category_input_audit` criada
- ✅ Índices GIN/trgm criados
- ✅ Pelo menos algumas ocupações no banco (via seed)

Teste rápido:
```bash
# Testar criação de categoria via IA (deve passar pelo gate)
curl -X POST http://localhost:3000/categories/ai-create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"text": "Dentista", "context": "professional"}'
```




























