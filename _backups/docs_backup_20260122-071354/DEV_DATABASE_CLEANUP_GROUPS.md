# Limpeza de Banco de Dados — Grupos (DEV ONLY)

**⚠️ ATENÇÃO: Este documento contém queries SQL para ambiente de DESENVOLVIMENTO apenas.**

**NUNCA execute estas queries em produção sem backup e autorização explícita.**

---

## 📋 Contexto do Problema

Durante o desenvolvimento e testes, usuários de teste podem criar grupos no banco de dados.
Isso deixa o estado do banco "sujo" e pode bloquear novas criações devido à regra de negócio:
**"Um usuário pode criar no máximo 1 grupo"** (conforme `GROUP_CREATION_POLICY.md`).

Este documento fornece:
1. **Queries de AUDITORIA** para diagnosticar o estado atual
2. **Queries de LIMPEZA** para remover grupos e memberships de teste (DEV ONLY)

---

## 🔍 PARTE 1 — AUDITORIA

Use estas queries para entender o estado atual do banco antes de limpar.

### 1.1 Listar Usuários

```sql
-- Listar todos os usuários do tenant
SELECT 
  user_id,
  email,
  full_name,
  created_at
FROM users
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1)
ORDER BY created_at DESC;
```

### 1.2 Listar Grupos por Usuário

```sql
-- Listar todos os grupos e seus criadores
SELECT 
  g.group_id,
  g.name,
  g.owner_user_id,
  u.email AS owner_email,
  g.created_at,
  g.is_active
FROM groups g
LEFT JOIN users u ON u.user_id = g.owner_user_id AND u.tenant_id = g.tenant_id
WHERE g.tenant_id = (SELECT id FROM tenants LIMIT 1)
ORDER BY g.created_at DESC;
```

### 1.3 Listar Memberships (group_members) por Usuário

```sql
-- Listar todos os memberships e seus grupos
SELECT 
  gm.group_id,
  gm.user_id,
  gm.role,
  g.name AS group_name,
  u.email AS user_email,
  gm.joined_at
FROM group_members gm
INNER JOIN groups g ON g.group_id = gm.group_id
LEFT JOIN users u ON u.user_id = gm.user_id AND u.tenant_id = gm.tenant_id
WHERE gm.tenant_id = (SELECT id FROM tenants LIMIT 1)
ORDER BY gm.joined_at DESC;
```

### 1.4 Contar Grupos por Usuário

```sql
-- Contar quantos grupos cada usuário criou
SELECT 
  g.owner_user_id,
  u.email,
  COUNT(*) as groups_created
FROM groups g
LEFT JOIN users u ON u.user_id = g.owner_user_id AND u.tenant_id = g.tenant_id
WHERE g.tenant_id = (SELECT id FROM tenants LIMIT 1)
GROUP BY g.owner_user_id, u.email
ORDER BY groups_created DESC;
```

---

## 🧹 PARTE 2 — LIMPEZA CONTROLADA (DEV ONLY)

**⚠️ EXECUTAR APENAS EM AMBIENTE DE DESENVOLVIMENTO**

**⚠️ SEMPRE dentro de uma transação para poder reverter se necessário**

### 2.1 Identificar Usuários de Teste

Antes de limpar, identifique os usuários de teste:

```sql
-- Listar usuários que criaram grupos (candidatos a limpeza)
SELECT 
  g.owner_user_id,
  u.email,
  COUNT(*) as groups_created
FROM groups g
LEFT JOIN users u ON u.user_id = g.owner_user_id AND u.tenant_id = g.tenant_id
WHERE g.tenant_id = (SELECT id FROM tenants LIMIT 1)
GROUP BY g.owner_user_id, u.email
HAVING COUNT(*) > 0
ORDER BY groups_created DESC;
```

### 2.2 Limpeza Completa (Transação)

**Substitua `'USER_ID_1'` e `'USER_ID_2'` pelos IDs reais dos usuários de teste.**

```sql
BEGIN;

-- 1. Remover memberships dos usuários de teste
DELETE FROM group_members
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1)
  AND user_id IN ('USER_ID_1', 'USER_ID_2');

-- 2. Remover grupos criados por esses usuários
DELETE FROM groups
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1)
  AND owner_user_id IN ('USER_ID_1', 'USER_ID_2');

-- 3. Verificar resultado (antes de COMMIT)
SELECT 
  'groups_remaining' AS table_name,
  COUNT(*) AS count
FROM groups
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1)
UNION ALL
SELECT 
  'group_members_remaining' AS table_name,
  COUNT(*) AS count
FROM group_members
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1);

-- Se estiver tudo certo, execute:
-- COMMIT;

-- Se algo estiver errado, execute:
-- ROLLBACK;
```

### 2.3 Limpeza Parcial (Apenas Grupos de um Usuário Específico)

Se quiser limpar apenas os grupos de um usuário específico:

```sql
BEGIN;

-- Substitua 'USER_ID_ESPECIFICO' pelo ID real
DECLARE @target_user_id UUID := 'USER_ID_ESPECIFICO';

-- 1. Remover memberships desse usuário
DELETE FROM group_members
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1)
  AND user_id = @target_user_id;

-- 2. Remover grupos criados por esse usuário
DELETE FROM groups
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1)
  AND owner_user_id = @target_user_id;

-- Verificar antes de COMMIT
SELECT 
  'groups_remaining' AS table_name,
  COUNT(*) AS count
FROM groups
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1)
  AND owner_user_id = @target_user_id;

-- Se estiver tudo certo:
-- COMMIT;
-- Se algo estiver errado:
-- ROLLBACK;
```

### 2.4 Limpeza Total (Todos os Grupos)

**⚠️ CUIDADO: Remove TODOS os grupos do tenant (apenas DEV)**

```sql
BEGIN;

-- 1. Remover todos os memberships
DELETE FROM group_members
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1);

-- 2. Remover todos os grupos
DELETE FROM groups
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1);

-- Verificar resultado
SELECT 
  'groups_remaining' AS table_name,
  COUNT(*) AS count
FROM groups
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1)
UNION ALL
SELECT 
  'group_members_remaining' AS table_name,
  COUNT(*) AS count
FROM group_members
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1);

-- Se estiver tudo certo:
-- COMMIT;
-- Se algo estiver errado:
-- ROLLBACK;
```

---

## ✅ Validação Pós-Limpeza

Após executar a limpeza, valide que tudo está correto:

```sql
-- 1. Verificar que não há grupos órfãos (sem owner)
SELECT 
  'groups_without_owner' AS check_name,
  COUNT(*) AS count
FROM groups g
LEFT JOIN users u ON u.user_id = g.owner_user_id AND u.tenant_id = g.tenant_id
WHERE g.tenant_id = (SELECT id FROM tenants LIMIT 1)
  AND u.user_id IS NULL;

-- 2. Verificar que não há memberships órfãos (sem grupo)
SELECT 
  'memberships_without_group' AS check_name,
  COUNT(*) AS count
FROM group_members gm
LEFT JOIN groups g ON g.group_id = gm.group_id AND g.tenant_id = gm.tenant_id
WHERE gm.tenant_id = (SELECT id FROM tenants LIMIT 1)
  AND g.group_id IS NULL;

-- 3. Verificar que não há memberships órfãos (sem usuário)
SELECT 
  'memberships_without_user' AS check_name,
  COUNT(*) AS count
FROM group_members gm
LEFT JOIN users u ON u.user_id = gm.user_id AND u.tenant_id = gm.tenant_id
WHERE gm.tenant_id = (SELECT id FROM tenants LIMIT 1)
  AND u.user_id IS NULL;

-- Todos os resultados devem ser 0
```

---

## 📝 Notas Importantes

1. **Sempre use transações**: `BEGIN` antes, `COMMIT` se tudo estiver certo, `ROLLBACK` se algo estiver errado.

2. **Verifique antes de deletar**: Use as queries de auditoria para identificar exatamente o que será removido.

3. **Backup**: Em ambiente de desenvolvimento, considere fazer backup antes de limpar (mesmo que seja DEV).

4. **Tenant ID**: As queries assumem um único tenant. Se houver múltiplos tenants, ajuste o filtro `WHERE tenant_id = ...`.

5. **Integridade Referencial**: 
   - `group_members` tem FK para `groups` (ON DELETE CASCADE pode estar configurado)
   - `groups` tem FK para `users` (owner_user_id)
   - Verifique constraints antes de deletar

---

## 🔗 Documentos Relacionados

- `/docs/GROUP_CREATION_POLICY.md` - Regra de negócio de criação de grupos
- `/backend/src/modules/groups/policies/GroupCreationPolicy.ts` - Implementação da policy

---

**Status**: Documento de referência para desenvolvimento  
**Última atualização**: 2025-01-XX  
**Ambiente**: Desenvolvimento apenas






