# CORREÇÃO DE AUTORIDADE - identity.service.ts

**Data:** 2026-02-06  
**Modo:** EXECUTOR  
**Escopo:** Eliminar completamente o uso de `user_identity_links` neste arquivo, aplicando a regra tenant-scoped para resolução de identidade

## OBJETIVO

Eliminar completamente o uso de `user_identity_links` neste arquivo, aplicando a regra tenant-scoped para resolução de identidade.

## DECISÃO CANÔNICA

As regras de perfil são DECIDIDAS POR TENANT.
Nenhuma decisão de perfil pode ser tomada sem `tenantId`.

## ALTERAÇÕES REALIZADAS

### 1. Assinatura do método `updateGlobalIdentity`

**Antes:**
```typescript
async updateGlobalIdentity(
  globalUserId: string,
  updates: UpdateGlobalIdentityInput
): Promise<GlobalUser>
```

**Depois:**
```typescript
async updateGlobalIdentity(
  tenantId: string,
  globalUserId: string,
  updates: UpdateGlobalIdentityInput
): Promise<GlobalUser>
```

**Localização:** Linha 151-154

### 2. Resolução de identidade (linha ~174)

**Antes:**
```sql
SELECT user_id, tenant_id FROM user_identity_links WHERE global_user_id = $1 LIMIT 1
```

**Depois:**
```sql
SELECT user_id FROM users WHERE global_user_id = $1 AND tenant_id = $2 LIMIT 1
```

**Localização:** Linha 173-176

**Mudanças:**
- Removida dependência de `user_identity_links`
- Adicionado `tenantId` como parâmetro obrigatório
- Query agora usa `runQueryWithTenant` com `tenantId` explícito
- Validação explícita: se não encontrar usuário, lança erro claro

### 3. Comportamento

**Antes:**
- Buscava `user_id` e `tenant_id` de `user_identity_links`
- Se não encontrasse, assumia `canEditBirthdate = false` silenciosamente

**Depois:**
- Busca `user_id` diretamente de `users` usando `global_user_id` e `tenant_id`
- Se não encontrar usuário para `(global_user_id, tenant_id)`, falha explicitamente com erro claro
- Não escolhe "primeiro resultado"
- Não infere tenant
- Não cria fallback
- Não resolve cross-tenant

## RESULTADO

- ✅ **Nenhuma referência a `user_identity_links` no arquivo**
- ✅ **Toda decisão de perfil exige `tenantId`**
- ✅ **Resolução feita exclusivamente via `users`**
- ✅ **Comportamento previsível e determinístico**
- ✅ **Falha explícita quando usuário não encontrado**

## VERIFICAÇÕES

- **Contagem de referências a `user_identity_links`:** 0 (apenas comentário documentando que não é autoridade)
- **Métodos corrigidos:** 1 (`updateGlobalIdentity`)
- **Queries corrigidas:** 1
- **Comportamento funcional:** Mantido, mas agora tenant-scoped

## OBSERVAÇÕES

- A assinatura do método foi alterada para incluir `tenantId` como primeiro parâmetro
- A query foi simplificada, removendo dependência de `user_identity_links`
- A validação agora é explícita: se não encontrar usuário, lança erro claro
- Nenhuma regra de negócio foi alterada
- Nenhum contrato fora deste método foi alterado
- Nenhuma heurística foi criada
- Nenhuma regra de precedência foi inventada

## IMPACTO EM OUTROS ARQUIVOS

⚠️ **ATENÇÃO:** A mudança na assinatura de `updateGlobalIdentity` pode quebrar chamadas existentes. É necessário atualizar todos os lugares que chamam este método para incluir `tenantId` como primeiro parâmetro.

## STATUS

✅ **CONCLUÍDO**

Arquivo não contém mais nenhuma referência a `user_identity_links` (exceto comentário documentando que não é autoridade) e toda decisão de perfil é tenant-scoped.


