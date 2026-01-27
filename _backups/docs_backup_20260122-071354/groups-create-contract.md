# Contrato de Criação de Grupos

## Schema Real da Tabela `groups`

### Colunas OBRIGATÓRIAS (NOT NULL sem DEFAULT)
- `tenant_id` (UUID) - ID do tenant
- `name` (VARCHAR(255)) - Nome do grupo
- `owner_user_id` (UUID) - ID do usuário dono do grupo

### Colunas OPCIONAIS (com DEFAULT ou NULL)
- `group_id` (UUID) - Gerado automaticamente
- `description` (TEXT) - Default: ''
- `is_active` (BOOLEAN) - Default: true
- `metadata` (JSONB) - Default: '{}'
- `created_at` (TIMESTAMPTZ) - Default: now()
- `updated_at` (TIMESTAMPTZ) - Default: now()
- `profit_percentage` (NUMERIC) - Default: 0.00
- `profit_config_metadata` (JSONB) - Default: '{}'
- `slug` (VARCHAR(100)) - Gerado automaticamente se não fornecido
- `category` (VARCHAR(50)) - Default: 'other' (legado)
- `category_id` (UUID) - FK para group_categories (NOVO)
- `visibility` (group_visibility enum) - Default: 'public'
- `subtype` (VARCHAR(100)) - NULL
- `status` (VARCHAR(20)) - Default: 'draft'
- `join_type` (VARCHAR(20)) - Default: 'open'
- `max_members` (INTEGER) - NULL
- `avatar_url` (TEXT) - NULL
- `cover_url` (TEXT) - NULL
- `account_id` (UUID) - FK para accounts
- `can_sell` (BOOLEAN) - Default: false
- `qualified_at` (TIMESTAMPTZ) - NULL
- `last_activity_at` (TIMESTAMPTZ) - NULL
- `member_count` (INTEGER) - Default: 0

### Colunas que NÃO EXISTEM (remover do código)
- ❌ `scope` - NÃO EXISTE (usar metadata.scope)
- ❌ `country_id` - NÃO EXISTE (usar metadata.location.country_id)
- ❌ `state_id` - NÃO EXISTE (usar metadata.location.state_id)
- ❌ `city_id` - NÃO EXISTE (usar metadata.location.city_id)
- ❌ `neighborhood` - NÃO EXISTE (usar metadata.location.neighborhood)
- ❌ `rules_text` - NÃO EXISTE (usar metadata.rules_text)

## Contrato de Criação (INSERT)

### Campos Mínimos Obrigatórios
```typescript
{
  tenant_id: UUID,        // $1
  name: string,            // $2
  owner_user_id: UUID     // $9
}
```

### Campos Opcionais Suportados
```typescript
{
  slug?: string,          // $3 (ou gerado automaticamente)
  description?: string,   // $4 (default: '')
  category_id?: UUID,     // $5 (FK para group_categories)
  visibility?: enum,      // $6 (default: 'public')
  avatar_url?: string,    // $7
  cover_url?: string,     // $8
  metadata?: JSONB        // $10 (pode conter scope, location, rules_text)
}
```

### Estrutura de Metadata Recomendada
```json
{
  "scope": "national" | "state" | "city" | "neighborhood",
  "location": {
    "country_id": "uuid",
    "state_id": "uuid",
    "city_id": "uuid",
    "neighborhood": "string"
  },
  "rules_text": "string"
}
```

## INSERT Statement Correto

```sql
INSERT INTO groups (
  tenant_id,           -- $1 (OBRIGATÓRIO)
  name,                -- $2 (OBRIGATÓRIO)
  slug,                -- $3 (opcional, gerado separadamente se não fornecido)
  description,         -- $4 (opcional, default '')
  category_id,         -- $5 (opcional, FK)
  visibility,          -- $6 (opcional, default 'public', precisa cast ::group_visibility)
  avatar_url,          -- $7 (opcional)
  cover_url,           -- $8 (opcional)
  owner_user_id,       -- $9 (OBRIGATÓRIO)
  metadata             -- $10 (opcional, default '{}')
)
VALUES (
  $1, $2, $3, $4, $5, 
  COALESCE($6::group_visibility, 'public'::group_visibility), 
  $7, $8, 
  $9, 
  $10
)
RETURNING group_id, tenant_id, name, slug, description, category_id, visibility,
  avatar_url, cover_url,
  owner_user_id, is_active, profit_percentage, metadata, created_at, updated_at
```

### ⚠️ Observações Importantes

1. **Slug**: Deve ser gerado separadamente antes do INSERT usando `generate_group_slug($1::text, $2::uuid)` para evitar erro de tipo
2. **Visibility**: Precisa de cast explícito `::group_visibility` quando usando COALESCE
3. **Description**: Pode ser NULL ou string vazia (default é '')
4. **Metadata**: Deve ser JSONB válido (usar JSON.stringify no código)

## Mapeamento de Parâmetros Atual

| Parâmetro | Valor | Tipo | Obrigatório | Observação |
|-----------|-------|------|-------------|------------|
| $1 | tenantId | UUID | ✅ Sim | - |
| $2 | input.name | string | ✅ Sim | - |
| $3 | finalSlug (gerado ou fornecido) | string \| null | ❌ Não | Gerado separadamente se não fornecido |
| $4 | input.description \|\| '' | string | ❌ Não | Default '' se não fornecido |
| $5 | input.category_id \|\| null | UUID \| null | ❌ Não | FK para group_categories |
| $6 | input.visibility \|\| 'public' | group_visibility enum | ❌ Não | Precisa cast ::group_visibility |
| $7 | input.avatar_url \|\| null | string \| null | ❌ Não | - |
| $8 | input.cover_url \|\| null | string \| null | ❌ Não | - |
| $9 | ownerUserId | UUID | ✅ Sim | - |
| $10 | JSON.stringify(metadata) | JSONB | ❌ Não | Default '{}', contém scope/location/rules_text |

## Validações de Negócio

### Validações que DEVEM ser mantidas (em memória, não no banco)
- `scope` deve ser validado (national, state, city, neighborhood)
- Se `scope !== 'national'`, `state_id` é obrigatório
- Se `scope === 'city' || scope === 'neighborhood'`, `city_id` é obrigatório
- Se `scope === 'neighborhood'`, `neighborhood` é obrigatório

Essas validações devem ser feitas ANTES do INSERT e os dados armazenados em `metadata`.

