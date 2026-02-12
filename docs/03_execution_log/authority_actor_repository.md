# CORREÇÃO DE AUTORIDADE - actor.repository.ts

**Data:** 2026-02-06  
**Modo:** EXECUTOR  
**Escopo:** Remover `user_identity_links` do fluxo de resolução de membership para actors de empresas, mantendo exatamente o mesmo comportamento

## OBJETIVO

Remover `user_identity_links` do fluxo de resolução de membership para actors de empresas, mantendo exatamente o mesmo comportamento.

## CONTEXTO CANÔNICO

Neste arquivo, `user_identity_links` era usado apenas para:
- ligar `company_users.global_user_id` ao `user_id` local do tenant

A tabela `users` já contém:
- `global_user_id`
- `user_id`
- `tenant_id`

## SUBSTITUIÇÃO REALIZADA

### Método `findAvailableActors` (linha ~318)

**Antes:**
```sql
SELECT 
  a.*,
  cu.role,
  cu.can_manage_company,
  c.company_status
FROM actors a
INNER JOIN companies c ON a.company_id = c.company_id
INNER JOIN company_users cu ON c.company_id = cu.company_id
INNER JOIN user_identity_links uil ON cu.global_user_id = uil.global_user_id
WHERE a.tenant_id = $1
  AND a.actor_type = 'page'
  AND uil.user_id = $2
  AND uil.tenant_id = $1
  AND cu.is_active = true
  AND c.status != 'suspended'
ORDER BY cu.is_primary DESC, c.createdAt DESC
```

**Depois:**
```sql
SELECT 
  a.*,
  cu.role,
  cu.can_manage_company,
  c.company_status
FROM actors a
INNER JOIN companies c ON a.company_id = c.company_id
INNER JOIN company_users cu ON c.company_id = cu.company_id
INNER JOIN users u ON cu.global_user_id = u.global_user_id
WHERE a.tenant_id = $1
  AND a.actor_type = 'page'
  AND u.user_id = $2
  AND u.tenant_id = $1
  AND cu.is_active = true
  AND c.status != 'suspended'
ORDER BY cu.is_primary DESC, c.createdAt DESC
```

**Localização:** Linha 307-328

**Comentário atualizado:** Linha 306 - removida referência a `user_identity_links`

## RESULTADO

- ✅ **Nenhuma referência a `user_identity_links` no arquivo**
- ✅ **JOIN direto entre `company_users` e `users` usando `global_user_id`**
- ✅ **Filtros mantidos: `users.user_id` e `users.tenant_id`**
- ✅ **Retorno de actors idêntico**
- ✅ **Critérios de visibilidade mantidos**
- ✅ **Filtros de status mantidos**
- ✅ **Regras de permissão mantidas**

## VERIFICAÇÕES

- **Contagem de referências a `user_identity_links`:** 0
- **Queries corrigidas:** 1
- **Comportamento funcional:** Mantido exatamente como antes
- **Permissões:** Não expandidas nem reduzidas

## OBSERVAÇÕES

- A query foi simplificada, removendo JOIN desnecessário com `user_identity_links`
- O JOIN direto entre `company_users` e `users` usa `global_user_id` como chave
- Filtros por `users.user_id` e `users.tenant_id` garantem tenant isolation
- Nenhum critério de visibilidade foi alterado
- Nenhum filtro de status foi alterado
- Nenhuma regra de permissão foi alterada

## STATUS

✅ **CONCLUÍDO**

Arquivo não contém mais nenhuma referência a `user_identity_links`.






