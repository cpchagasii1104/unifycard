# Correções Backend - Fluxo Primeiro Acesso (DEFINITIVAS)

## ✅ Correções Implementadas

### 1. PUT /profile - Aceita PATCH Parcial e Metadata Undefined/Null

**Arquivo:** `src/core/profile/profile.service.ts`

**Correções:**
- ✅ Aceita `metadata: undefined` ou `metadata: null` sem quebrar
- ✅ Aceita payload vazio (preserva dados existentes)
- ✅ Faz merge correto com metadata existente
- ✅ Não sobrescreve campos ausentes com null
- ✅ Remove validação desnecessária que poderia causar erro

**Código:**
```typescript
// Aceita metadata undefined/null
if (input.metadata !== undefined && input.metadata !== null && typeof input.metadata === 'object') {
  // Processar metadata
}

// Sempre preserva metadata existente
const mergedMetadata = metadataWithoutImmutables 
  ? deepMerge(existingMetadata, metadataWithoutImmutables)
  : existingMetadata;
```

### 2. GET /identity/me - Sempre Retorna Dados do Cadastro

**Arquivo:** `src/core/identity/identity.routes.ts`

**Correções:**
- ✅ Quando `global_user` existe mas `getIdentityProfile` falha, busca dados diretamente do `global_users`
- ✅ Retorna `fullName` e `birthdate` do cadastro mesmo quando profile não existe
- ✅ Inclui `profile` completo na resposta (com `metadata.gender`)
- ✅ Nunca retorna 500 (sempre retorna estrutura válida)
- ✅ Cria profile automaticamente se não existir

**Código:**
```typescript
// Se getIdentityProfile falhar, buscar dados do cadastro diretamente
if (localUser.global_user_id) {
  const globalUserResult = await pool.query(/* buscar global_user */);
  if (globalUserResult.rows.length > 0) {
    // Retornar dados do cadastro
    profile = {
      global: {
        fullName: globalUserData.full_name,
        birthdate: globalUserData.birthdate,
        // ...
      }
    };
  }
}

// Incluir profile completo na resposta
const serializedProfile = {
  ...profile,
  profile: userProfile ? {
    metadata: profileMetadata, // Inclui gender do cadastro
    // ...
  } : null,
};
```

### 3. POST /profile/confirm-first-access - Aceita Body Vazio

**Arquivo:** `src/core/profile/profile.routes.ts`

**Correções:**
- ✅ Schema aceita `['object', 'null']`
- ✅ `preHandler` normaliza body vazio para `{}`
- ✅ Não retorna 400 quando body está vazio

### 4. POST /identity/confirm-first-access - Aceita Body Vazio

**Arquivo:** `src/core/identity/identity.routes.ts`

**Correções:**
- ✅ Schema aceita `['object', 'null']`
- ✅ `preHandler` normaliza body vazio para `{}`
- ✅ Não retorna 400 quando body está vazio

### 5. profile_personal_confirmed - Fonte Única da Verdade

**Arquivo:** `src/core/profile/profile.service.ts`, `src/core/identity/identity.routes.ts`

**Correções:**
- ✅ `profile_personal_confirmed` controla modal e cadeado
- ✅ `can_edit_personal_data = !profile_personal_confirmed` (calculado automaticamente)
- ✅ Sempre retornado em GET /identity/me
- ✅ Nunca alterado via PUT /profile (só via confirm-first-access)

## Resumo das Correções

### Backend - 100% Corrigido

1. ✅ PUT /profile aceita PATCH parcial (metadata undefined/null não quebra)
2. ✅ GET /identity/me sempre retorna dados do cadastro (fullName, birthdate, gender)
3. ✅ POST /profile/confirm-first-access aceita body vazio
4. ✅ POST /identity/confirm-first-access aceita body vazio
5. ✅ profile_personal_confirmed é fonte única da verdade
6. ✅ Nunca retorna 500 para casos esperados
7. ✅ Logs detalhados para diagnóstico

## O Que o Frontend Precisa Fazer

### 1. apiFetch - Não Enviar Content-Type Sem Body

```typescript
export async function apiFetch(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  const hasBody = options.body !== undefined && 
                  options.body !== null && 
                  !(typeof options.body === "string" && options.body.length === 0);
  
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  
  const finalOptions: RequestInit = { ...options, headers };
  if (!hasBody) delete finalOptions.body;
  
  return fetch(url, finalOptions);
}
```

### 2. Hidratação - Não Resetar Campos

```typescript
// ✅ CORRETO
useEffect(() => {
  if (data?.global?.fullName) setFullName(data.global.fullName);
  if (data?.global?.birthdate) setBirthdate(data.global.birthdate);
  if (data?.profile?.metadata?.gender) setGender(data.profile.metadata.gender);
}, [data]);
```

### 3. handleSavePersonal - Ordem Correta

```typescript
// 1. updateIdentity primeiro
await updateIdentity({ fullName, birthdate });

// 2. updateProfile depois (apenas campos que mudaram)
await updateProfile({ phone, metadata: { gender, address } });

// 3. Só então mostrar modal
if (!profile.profile_personal_confirmed) {
  setShowOnboardingModal(true);
}
```

### 4. Controle de Cadeado - Usar Flag do Backend

```typescript
const canEditPersonal = !profile?.profile_personal_confirmed;
```

## Status Final

✅ **Backend:** 100% corrigido e pronto
⏳ **Frontend:** Aguardando correções acima

O backend agora:
- Aceita qualquer payload parcial
- Sempre retorna dados do cadastro
- Nunca retorna 500 para casos esperados
- Usa `profile_personal_confirmed` como fonte única da verdade

