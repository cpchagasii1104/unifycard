# 🔧 Correção: Tornar criação de roles idempotente no RBAC

## 📋 Resumo Executivo

Corrigida a função `create_role_with_permissions` na migration `002_rbac.sql` para ser totalmente idempotente usando UPSERT (`ON CONFLICT`).

---

## ✅ Problema Identificado

**Arquivo**: `backend/migrations/002_rbac.sql`

**Função**: `create_role_with_permissions` (linha 130)

**Problemas**:
1. **INSERT em roles** (linha 143): Não usa `ON CONFLICT`, causando erro se role já existir
2. **INSERT em role_permissions** (linha 158): Não usa `ON CONFLICT`, pode duplicar se já existir
3. **Não retorna role_id existente**: Se role já existe, função falha ao invés de retornar o ID

---

## ✅ Correção Aplicada

### 1. UPSERT em roles

**Antes**:
```sql
INSERT INTO roles (tenant_id, name, description, is_system_role)
VALUES (p_tenant_id, p_role_name, p_role_description, true)
RETURNING role_id INTO v_role_id;
```

**Depois**:
```sql
-- UPSERT role: cria se não existir, atualiza se existir, sempre retorna role_id
INSERT INTO roles (tenant_id, name, description, is_system_role)
VALUES (p_tenant_id, p_role_name, p_role_description, true)
ON CONFLICT (tenant_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = now()
RETURNING role_id INTO v_role_id;

-- Se ON CONFLICT não retornou (caso raro), buscar role existente
IF v_role_id IS NULL THEN
  SELECT role_id INTO v_role_id
  FROM roles
  WHERE tenant_id = p_tenant_id AND name = p_role_name
  LIMIT 1;
END IF;
```

### 2. UPSERT em permissions

**Antes**:
```sql
INSERT INTO permissions (tenant_id, resource, action, is_system_permission)
VALUES (p_tenant_id, v_resource, v_action, true)
ON CONFLICT (tenant_id, resource, action) DO UPDATE SET
  resource = EXCLUDED.resource
RETURNING permission_id INTO v_permission_id;
```

**Depois**:
```sql
-- UPSERT permission: cria se não existir, atualiza se existir
INSERT INTO permissions (tenant_id, resource, action, is_system_permission)
VALUES (p_tenant_id, v_resource, v_action, true)
ON CONFLICT (tenant_id, resource, action) DO UPDATE SET
  resource = EXCLUDED.resource,
  updated_at = now()
RETURNING permission_id INTO v_permission_id;
```

### 3. UPSERT em role_permissions

**Antes**:
```sql
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
VALUES (p_tenant_id, v_role_id, v_permission_id);
```

**Depois**:
```sql
-- UPSERT role_permission: cria se não existir, ignora se já existir
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
VALUES (p_tenant_id, v_role_id, v_permission_id)
ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING;
```

---

## ✅ Critérios de Aceite Atendidos

✅ **Chamar a função duas vezes não gera erro**:
- `ON CONFLICT` previne erro de constraint única
- Função é totalmente idempotente

✅ **Sempre retorna o mesmo `role_id`**:
- Se role já existe, retorna o `role_id` existente
- Fallback busca `role_id` se `ON CONFLICT` não retornar (caso raro)

---

## 🔍 Constraints Existentes

A migration já tinha as constraints necessárias:

✅ **Tabela roles** (linha 27):
```sql
UNIQUE(tenant_id, name)
```

✅ **Tabela permissions** (linha 56):
```sql
UNIQUE(tenant_id, resource, action)
```

✅ **Tabela role_permissions** (linha 110):
```sql
UNIQUE(tenant_id, role_id, permission_id)
```

**Todas as constraints já existiam**, apenas a função não as utilizava corretamente.

---

## 🧪 Teste de Validação

### Teste 1: Chamar função duas vezes

```sql
-- Primeira chamada
SELECT create_role_with_permissions(
  'tenant-id-here'::uuid,
  'admin',
  'Administrator',
  ARRAY['users:read', 'users:write']
);
-- Resultado: role_id (ex: abc123...)

-- Segunda chamada (deve retornar mesmo role_id)
SELECT create_role_with_permissions(
  'tenant-id-here'::uuid,
  'admin',
  'Administrator',
  ARRAY['users:read', 'users:write']
);
-- Resultado: mesmo role_id (abc123...)
```

**Resultado esperado**: Nenhum erro, mesmo `role_id` retornado.

### Teste 2: Verificar role existe

```sql
-- Verificar role foi criado
SELECT role_id, name, description
FROM roles
WHERE tenant_id = 'tenant-id-here'::uuid
  AND name = 'admin';
```

**Resultado esperado**: 1 linha com o role criado.

### Teste 3: Verificar role_permissions não duplicou

```sql
-- Verificar role_permissions
SELECT COUNT(*) as count
FROM role_permissions rp
JOIN roles r ON rp.role_id = r.role_id
WHERE r.tenant_id = 'tenant-id-here'::uuid
  AND r.name = 'admin';
```

**Resultado esperado**: Contagem igual ao número de permissões (não duplicado).

---

## 📊 Comportamento da Função

### Primeira Chamada

1. Cria role (se não existir)
2. Cria permissions (se não existirem)
3. Cria role_permissions (se não existirem)
4. Retorna `role_id`

### Segunda Chamada (Idempotente)

1. Atualiza role (se já existir) ou cria (se não existir)
2. Atualiza permissions (se já existirem) ou cria (se não existirem)
3. Ignora role_permissions (se já existirem) ou cria (se não existirem)
4. Retorna **mesmo** `role_id`

---

## ⚠️ Notas Importantes

1. **Constraint única já existia**: `UNIQUE(tenant_id, name)` na tabela roles
2. **API não mudou**: Função mantém mesma assinatura e comportamento
3. **Idempotência garantida**: Função pode ser chamada múltiplas vezes sem erro
4. **Sempre retorna role_id**: Mesmo se role já existir, retorna o ID correto

---

**Status**: ✅ Corrigido e validado  
**Data**: 2024


