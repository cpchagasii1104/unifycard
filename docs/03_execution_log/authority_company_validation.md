# CORREÇÃO DE AUTORIDADE - company-validation.service.ts

**Data:** 2026-02-06  
**Modo:** EXECUTOR  
**Escopo:** Eliminar uso de `user_identity_links` na validação de empresas, substituindo por fonte canônica correta de escopo organizacional

## OBJETIVO

Eliminar o uso de `user_identity_links` na validação de empresas, substituindo por validação direta usando `companies.tenant_id`.

## CONTEXTO CANÔNICO

Neste arquivo, `user_identity_links` era usado como MUDAÇA para validar se uma empresa pertence ao tenant correto.

A fonte de verdade JÁ EXISTE:
- `companies.tenant_id`

## SUBSTITUIÇÕES REALIZADAS

### 1. Método `requestValidation` (linha ~72)

**Antes:**
```sql
SELECT c.company_id, c.company_status
FROM companies c
JOIN user_identity_links uil
  ON uil.global_user_id = c.global_user_id
WHERE c.company_id = $1
  AND uil.tenant_id = $2
LIMIT 1
```

**Depois:**
```sql
SELECT c.company_id, c.company_status
FROM companies c
WHERE c.company_id = $1
  AND c.tenant_id = $2
LIMIT 1
```

**Localização:** Linha 66-77

### 2. Método `validateInPerson` (linha ~180)

**Antes:**
```sql
SELECT c.company_id, c.company_status
FROM companies c
JOIN user_identity_links uil
  ON uil.global_user_id = c.global_user_id
WHERE c.company_id = $1
  AND uil.tenant_id = $2
LIMIT 1
```

**Depois:**
```sql
SELECT c.company_id, c.company_status
FROM companies c
WHERE c.company_id = $1
  AND c.tenant_id = $2
LIMIT 1
```

**Localização:** Linha 174-185

## RESULTADO

- ✅ **Nenhuma referência a `user_identity_links` no arquivo**
- ✅ **Todas as validações agora usam `companies.tenant_id` diretamente**
- ✅ **Validação de tenant mantida e simplificada**
- ✅ **Comportamento funcional preservado**
- ✅ **Queries simplificadas e mais eficientes**

## VERIFICAÇÕES

- **Contagem de referências a `user_identity_links`:** 0
- **Queries corrigidas:** 2
- **Validação de tenant:** Mantida via `companies.tenant_id`
- **Comportamento funcional:** Preservado

## OBSERVAÇÕES

- As queries foram simplificadas, removendo JOINs desnecessários
- A validação de tenant agora é direta via `companies.tenant_id`
- Nenhuma semântica de validação foi alterada
- Nenhuma regra de permissão foi alterada
- A validação continua bloqueando empresas fora do tenant

## STATUS

✅ **CONCLUÍDO**

Arquivo não contém mais nenhuma referência a `user_identity_links`.


