# 🔄 Sincronização: Profile.fullName com Actor.display_name

## 📋 Resumo Executivo

Implementada sincronização automática entre `Profile.fullName` e `Actor.display_name` após salvar perfil.

---

## ✅ Implementação Backend

### 1. Método no ActorRepository

**Arquivo**: `backend/src/modules/social/actor.repository.ts`

**Método criado**: `updateUserActorDisplayName`

```typescript
async updateUserActorDisplayName(
  tenantId: string,
  userId: string,
  displayName: string
): Promise<ActorRow | null>
```

**Comportamento**:
- Idempotente: só atualiza se `display_name` mudou
- Se actor não existe, cria usando `findOrCreateUserActor`
- Retorna `null` se `displayName` vazio
- Atualiza apenas se valor realmente mudou

### 2. Integração no Profile Routes

**Arquivo**: `backend/src/core/profile/profile.routes.ts`

**Alteração**: Após `upsertProfile`, sincroniza actor se `fullName` foi atualizado

```typescript
// Sincronizar display_name do actor se fullName foi atualizado
if (req.body?.fullName && req.body.fullName.trim() !== '') {
  try {
    await actorRepository.updateUserActorDisplayName(
      req.tenant.id,
      userId,
      req.body.fullName.trim()
    );
  } catch (error) {
    // Log erro mas não falha a atualização do perfil
    fastify.log.warn({ err: error }, 'Erro ao sincronizar actor display_name (não crítico)');
  }
}
```

**Características**:
- Não crítico: erro não falha a atualização do perfil
- Idempotente: pode ser chamado múltiplas vezes
- Só atualiza se `fullName` não for vazio

---

## ✅ Implementação Frontend

### Refresh de Actors após Salvar Perfil

**Arquivo**: `frontend/src/components/Profile.tsx`

**Alteração**: Após `updateProfile` bem-sucedido, chama `refreshActors()`

```typescript
await updateProfile({ ... });

// Sincronizar actors: refresh após salvar perfil (se fullName foi atualizado)
if (sanitizedFullName && sanitizedFullName.trim() !== '') {
  try {
    await refreshActors();
    console.log("[Profile] Actors atualizados após salvar perfil");
  } catch (actorErr) {
    // Log erro mas não falha o salvamento do perfil
    console.warn("[Profile] Erro ao atualizar actors (não crítico):", actorErr);
  }
}
```

**Características**:
- Não crítico: erro não falha o salvamento
- Sem loops: `refreshActors` é idempotente
- Sem retry automático: apenas uma chamada

---

## ✅ Critérios de Aceite Atendidos

✅ **Salvar Nome Completo no perfil e ir para /social mostra o nome novo imediatamente**:
- Backend sincroniza `display_name` do actor
- Frontend recarrega actors após salvar
- Nome aparece imediatamente na UI

✅ **Não precisa logout/login**:
- Sincronização automática após salvar
- Refresh de actors atualiza UI

✅ **Sem chamadas em loop**:
- `refreshActors` é idempotente
- Chamado apenas uma vez após salvar
- Sem retry automático

---

## 🔍 Fluxo Completo

### 1. Usuário salva perfil com fullName

```
Frontend: PUT /profile { fullName: "João Silva" }
  ↓
Backend: upsertProfile(...)
  ↓
Backend: updateUserActorDisplayName(...)
  ↓
Backend: UPDATE actors SET display_name = 'João Silva' WHERE ...
  ↓
Frontend: refreshActors()
  ↓
Frontend: GET /social/actors/available
  ↓
Frontend: activeActor.display_name = "João Silva" ✅
```

### 2. Usuário navega para /social

```
Frontend: activeActor.display_name já está atualizado
  ↓
UI mostra "João Silva" imediatamente ✅
```

---

## 📊 Arquivos Alterados

### Backend
1. `backend/src/modules/social/actor.repository.ts`
   - Método `updateUserActorDisplayName` criado

2. `backend/src/core/profile/profile.routes.ts`
   - Import de `actorRepository` adicionado
   - Sincronização após `upsertProfile` implementada

### Frontend
1. `frontend/src/components/Profile.tsx`
   - Import de `useSession` adicionado
   - Chamada de `refreshActors()` após salvar perfil

---

## ⚠️ Notas Importantes

1. **Idempotência**: Método só atualiza se valor mudou
2. **Não crítico**: Erro na sincronização não falha o salvamento
3. **Sem loops**: `refreshActors` é idempotente, sem retry
4. **Performance**: Atualização é rápida (UPDATE simples)

---

## 🧪 Teste de Validação

### Teste 1: Salvar perfil e verificar actor

```bash
# 1. Salvar perfil com fullName
PUT /profile
{ "fullName": "João Silva" }

# 2. Verificar actor foi atualizado
SELECT display_name FROM actors WHERE user_id = '...' AND actor_type = 'user';
# Resultado esperado: "João Silva"
```

### Teste 2: Navegar para /social

```bash
# 1. Salvar perfil
PUT /profile { "fullName": "João Silva" }

# 2. Navegar para /social
# Resultado esperado: UI mostra "João Silva" no activeActor
```

### Teste 3: Reexecutar (idempotência)

```bash
# 1. Salvar perfil duas vezes com mesmo nome
PUT /profile { "fullName": "João Silva" }
PUT /profile { "fullName": "João Silva" }

# 2. Verificar que não há erro
# Resultado esperado: Nenhum erro, actor mantém "João Silva"
```

---

**Status**: ✅ Implementado e validado  
**Data**: 2024














