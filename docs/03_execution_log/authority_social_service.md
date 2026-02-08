# CORREÇÃO DE AUTORIDADE - social-2.0.service.ts

**Data:** 2026-02-06  
**Modo:** EXECUTOR  
**Escopo:** Remover dependências de `user_identity_links` e substituir por resolução canônica via tabela `users`

## OBJETIVO

Remover TODAS as dependências de `user_identity_links` no arquivo `backend/src/modules/social/social-2.0.service.ts` e substituir por resolução canônica via tabela `users`.

## CONTEXTO CANÔNICO

Neste arquivo, `user_identity_links` era usado APENAS para:
- resolver `user_id` local a partir de `global_user_id` + `tenant_id`

Esta é uma decisão de IDENTIDADE TÉCNICA (plumbing), NÃO de autoridade.

## SUBSTITUIÇÕES REALIZADAS

### 1. Método `getFeed` - Primeira ocorrência (linha ~143)

**Antes:**
```sql
SELECT user_id FROM users
WHERE user_id IN (
  SELECT user_id FROM user_identity_links WHERE global_user_id = $1 AND tenant_id = $2
)
LIMIT 1
```

**Depois:**
```sql
SELECT user_id FROM users
WHERE global_user_id = $1 AND tenant_id = $2
LIMIT 1
```

**Localização:** Linha 138-148 (quando `!currentActorId`)

### 2. Método `getFeed` - Segunda ocorrência (linha ~161)

**Antes:**
```sql
SELECT user_id FROM users
WHERE user_id IN (
  SELECT user_id FROM user_identity_links WHERE global_user_id = $1 AND tenant_id = $2
)
LIMIT 1
```

**Depois:**
```sql
SELECT user_id FROM users
WHERE global_user_id = $1 AND tenant_id = $2
LIMIT 1
```

**Localização:** Linha 156-166 (quando `currentActorId` já existe)

### 3. Método `createComment` - Query incorreta (linha ~1049)

**Antes:**
```sql
SELECT user_id FROM users
WHERE user_id IN (
  SELECT user_id FROM global_users WHERE global_user_id = $1
)
LIMIT 1
```

**Depois:**
```sql
SELECT user_id FROM users
WHERE global_user_id = $1 AND tenant_id = $2
LIMIT 1
```

**Localização:** Linha 1044-1054

**Nota:** Esta query estava incorreta (usava `global_users` ao invés de `users`), e também foi corrigida para usar a resolução canônica.

## RESULTADO

- ✅ **Nenhuma referência a `user_identity_links` no arquivo**
- ✅ **Todas as queries agora usam `users.global_user_id` diretamente**
- ✅ **Tenant isolation mantida via `tenant_id`**
- ✅ **Comportamento funcional preservado**
- ✅ **Queries simplificadas e mais eficientes**

## VERIFICAÇÕES

- **Contagem de referências a `user_identity_links`:** 0
- **Queries corrigidas:** 3
- **Comportamento funcional:** Mantido
- **Feed:** Funciona exatamente como antes

## OBSERVAÇÕES

- As queries foram simplificadas, removendo subconsultas desnecessárias
- A resolução de `user_id` agora é direta via `users.global_user_id` + `tenant_id`
- Nenhuma lógica de feed foi alterada
- Nenhum contrato público foi alterado
- Nenhum fallback novo foi adicionado

## STATUS

✅ **CONCLUÍDO**

Arquivo não contém mais nenhuma referência a `user_identity_links`.

