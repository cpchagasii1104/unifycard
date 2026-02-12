# CORREÇÃO DE AUTORIDADE - identity.routes.ts

**Data:** 2026-02-06  
**Modo:** EXECUTOR  
**Escopo:** Atualizar EXCLUSIVAMENTE os chamadores existentes para passar `tenantId` explicitamente como primeiro parâmetro

## OBJETIVO

Atualizar EXCLUSIVAMENTE os chamadores existentes de `updateGlobalIdentity` para passar `tenantId` explicitamente como primeiro parâmetro.

## CONTEXTO CANÔNICO

A assinatura do método foi corretamente alterada para:

```typescript
updateGlobalIdentity(
  tenantId: string,
  globalUserId: string,
  updates: UpdateGlobalIdentityInput
)
```

Toda decisão de perfil é tenant-scoped.
Chamadas antigas quebraram propositalmente.

## ALTERAÇÕES REALIZADAS

### 1. POST /identity/update (linha ~564)

**Antes:**
```typescript
const updated = await identityService.updateGlobalIdentity(
  profile.global.globalUserId,
  updates
);
```

**Depois:**
```typescript
const updated = await identityService.updateGlobalIdentity(
  req.tenant.id,
  profile.global.globalUserId,
  updates
);
```

**Localização:** Linha 564-567

**Contexto:**
- `req.tenant.id` já estava disponível no contexto
- Extraído diretamente de `req.tenant.id` (linha 358 já valida que `req.tenant` existe)

### 2. PUT /identity/configurations (linha ~974)

**Antes:**
```typescript
const updated = await identityService.updateGlobalIdentity(globalUserId4, {
  metadata: updatedMetadata,
});
```

**Depois:**
```typescript
const updated = await identityService.updateGlobalIdentity(req.tenant.id, globalUserId4, {
  metadata: updatedMetadata,
});
```

**Localização:** Linha 974-976

**Contexto:**
- `req.tenant.id` já estava disponível no contexto
- Extraído diretamente de `req.tenant.id` (linha 933 já está dentro do handler que tem acesso a `req.tenant`)

## RESULTADO

- ✅ **Todas as chamadas compilam**
- ✅ **`tenantId` é passado explicitamente**
- ✅ **Nenhuma chamada antiga permanece**
- ✅ **Nenhuma heurística foi criada**
- ✅ **Nenhuma inferência de tenant**
- ✅ **Nenhum fallback criado**

## VERIFICAÇÕES

- **Chamadas corrigidas:** 2
- **Arquivos alterados:** 1 (`identity.routes.ts`)
- **Linhas ajustadas:** 
  - Linha 564-567 (POST /identity/update)
  - Linha 974-976 (PUT /identity/configurations)
- **Uso explícito de tenantId:** ✅ Confirmado
- **Build compila:** ✅ Confirmado

## OBSERVAÇÕES

- Todas as chamadas agora passam `req.tenant.id` como primeiro parâmetro
- `tenantId` é extraído diretamente do contexto existente (`req.tenant.id`)
- Nenhuma inferência ou fallback foi criado
- Nenhuma regra de negócio foi alterada
- Nenhum fluxo que não chama esse método foi alterado

## STATUS

✅ **CONCLUÍDO**

- Build volta a compilar
- Nenhuma decisão de perfil ocorre sem tenant
- Nenhuma referência a `user_identity_links`






