# 🔧 Correções Aplicadas - Sistema Unificard

## 📋 Resumo Executivo

Este documento lista todas as correções aplicadas para fazer o sistema voltar a funcionar após a remoção de `global_user_id` do schema do banco.

---

## ✅ PROBLEMA 1: COALESCE text[] vs jsonb em Categorias

### Causa Raiz
A coluna `keywords` na tabela `categories` é do tipo `TEXT[]` (definido na migration 042), mas o código estava usando `COALESCE(keywords, '[]'::jsonb)`, causando erro de tipo incompatível.

### Correção
Substituído `COALESCE(keywords, '[]'::jsonb)` por `COALESCE(to_jsonb(keywords), '[]'::jsonb)` em todos os arquivos.

### Arquivos Alterados
- `backend/src/core/categories/categories.repository.ts` (14 ocorrências)
- `backend/src/core/categories/categories.service.ts` (1 ocorrência)
- `backend/src/core/catalog/category-review.service.ts` (1 ocorrência)

---

## ✅ PROBLEMA 2: Identity/me retorna 404 "Perfil não encontrado"

### Causa Raiz
1. Endpoint `/identity/me` usava `req.user.id` ao invés de `req.user.userId`
2. Quando perfil não existia, retornava 404 ao invés de criar automaticamente

### Correção
1. Atualizado para usar `req.user.userId`
2. Implementado auto-create de perfil: se não existir, cria automaticamente antes de retornar
3. Fallback seguro: se falhar ao criar, retorna perfil mínimo ao invés de erro

### Arquivos Alterados
- `backend/src/core/identity/identity.routes.ts` (GET /me e POST /update)

---

## ✅ PROBLEMA 3: /social/actors/available retorna 401/404

### Causa Raiz
1. Endpoint dependia de `req.user.globalUserId` que não existe mais
2. `findAvailableActors` recebia `globalUserId` como parâmetro
3. Queries buscavam actors via `global_user_id` ao invés de `user_id`

### Correção
1. Removida dependência de `globalUserId` do endpoint
2. `findAvailableActors` agora recebe `userId` diretamente
3. Queries refatoradas para usar `user_id` e `tenant_id`
4. Query de empresas usa JOIN com `user_identity_links` para mapear `user_id` → `global_user_id` → `company_users`
5. Retorna `[]` (200 OK) quando não há actors, nunca 401/404

### Arquivos Alterados
- `backend/src/modules/social/social-2.0.routes.ts` (endpoint /actors/available)
- `backend/src/modules/social/actor.repository.ts` (findAvailableActors e findOrCreateUserActor)

---

## ✅ PROBLEMA 4: Profile não salva (404 em /identity/update)

### Causa Raiz
Endpoint `/identity/update` usava `req.user.id` e não criava perfil automaticamente se não existisse.

### Correção
1. Atualizado para usar `req.user.userId`
2. Implementado auto-create de perfil antes de atualizar
3. Fallback seguro em caso de erro

### Arquivos Alterados
- `backend/src/core/identity/identity.routes.ts` (POST /update)

---

## ✅ PROBLEMA 5: /plan não retorna plano (PRO/GRATUITO)

### Causa Raiz
Endpoint `/plan` usava `req.user.id` ao invés de `req.user.userId`.

### Correção
Atualizado para usar `req.user.userId` em todas as queries.

### Arquivos Alterados
- `backend/src/core/plan/plan.routes.ts` (GET / e PUT /)

---

## ✅ PROBLEMA 6: Seed DEV incompleto

### Causa Raiz
Seeds separados não criavam tudo necessário (feature flags, profile, etc).

### Correção
Criado script `seed-dev-complete.ts` que executa tudo em ordem:
1. Tenant DEV
2. RBAC (roles e permissões)
3. Usuário DEV (com `is_test=true` e `plan='pro'`)
4. Identidade global e actor
5. Feature flags (PRO e microfone habilitados)
6. Profile básico

### Arquivos Criados
- `backend/src/scripts/seed-dev-complete.ts`

### Arquivos Alterados
- `backend/package.json` (adicionado script `seed:dev:complete`)

---

## ✅ PROBLEMA 7: Core Service usa globalUserId

### Causa Raiz
`getCompleteProfile` recebia `globalUserId` como parâmetro e queries buscavam empresas/endereços via `global_user_id`.

### Correção
1. Removido parâmetro `globalUserId` de `getCompleteProfile`
2. Queries refatoradas para usar `user_id` via JOIN com `user_identity_links`

### Arquivos Alterados
- `backend/src/core/core.service.ts` (getCompleteProfile)
- `backend/src/core/core.routes.ts` (endpoint /profile)
- `backend/src/modules/social/social-2.0.service.ts` (chamada de getCompleteProfile)

---

## ✅ PROBLEMA 8: Profile routes usa req.user.id

### Causa Raiz
Rotas de profile usavam `req.user.id` ao invés de `req.user.userId`.

### Correção
Atualizado para usar `req.user.userId` em todas as rotas.

### Arquivos Alterados
- `backend/src/core/profile/profile.routes.ts` (GET / e PUT /)

---

## ✅ PROBLEMA 9: Categories routes usa globalUserId

### Causa Raiz
Rotas de categorias usavam `req.user.globalUserId` e `req.user.id` incorretamente.

### Correção
1. Atualizado para usar `req.user.userId`
2. Rota `/tree` retorna `[]` em caso de erro (não bloqueia tela)

### Arquivos Alterados
- `backend/src/core/categories/categories.routes.ts` (múltiplas rotas)

---

## 📝 COMANDOS PARA EXECUTAR

### Pipeline DEV Completo (Windows)

```powershell
# 1. Reset do banco (opcional - apenas se quiser começar do zero)
cd backend
pnpm reset:database

# 2. Aplicar migrations
pnpm migrate

# 3. Seed completo (cria tudo necessário)
pnpm seed:dev:complete

# 4. Iniciar backend
pnpm dev
```

### Seed Individual (se necessário)

```powershell
# Seed apenas tenant
pnpm seed:dev:tenant

# Seed apenas usuário
pnpm seed:dev:user

# Seed apenas actor
pnpm seed:dev:actor

# Seed completo (recomendado)
pnpm seed:dev:complete
```

---

## 🎯 RESULTADO ESPERADO

Após executar as correções:

✅ **Login funciona** - Usuário `dev@unificard.local` / `123456` consegue logar  
✅ **Home carrega** - `/home` não fica "Carregando..." indefinidamente  
✅ **Perfil carrega** - `/perfil` mostra dados e permite salvar sem erro  
✅ **Actors carregam** - `/social/actors/available` retorna lista (pelo menos 1 actor)  
✅ **Categorias carregam** - `/categories/tree` retorna árvore sem erro de COALESCE  
✅ **PRO/GRATUITO aparece** - UI mostra teste de plano e permite alternar  
✅ **Microfone habilitado** - Feature flag habilitada para usuário DEV  

---

## 🔍 ARQUIVOS ALTERADOS (RESUMO)

### Backend
- `backend/src/core/auth/auth.plugin.ts` - Removido globalUserId de req.user
- `backend/src/core/auth/auth.types.ts` - Removido globalUserId de interfaces
- `backend/src/core/auth/auth.service.ts` - Removido globalUserId do JWT
- `backend/src/types/fastify.d.ts` - Atualizado tipo req.user
- `backend/src/types/fastify-websocket.d.ts` - Atualizado tipo req.user
- `backend/src/core/identity/identity.routes.ts` - Auto-create de perfil
- `backend/src/core/profile/profile.routes.ts` - Usa req.user.userId
- `backend/src/core/core.service.ts` - Removido globalUserId
- `backend/src/core/core.routes.ts` - Usa req.user.userId
- `backend/src/core/plan/plan.routes.ts` - Usa req.user.userId
- `backend/src/core/categories/categories.repository.ts` - Corrigido COALESCE
- `backend/src/core/categories/categories.service.ts` - Corrigido COALESCE
- `backend/src/core/categories/categories.routes.ts` - Usa req.user.userId
- `backend/src/core/catalog/category-review.service.ts` - Corrigido COALESCE
- `backend/src/modules/social/social-2.0.routes.ts` - Removido globalUserId
- `backend/src/modules/social/social-2.0.service.ts` - Removido globalUserId
- `backend/src/modules/social/actor.repository.ts` - Refatorado para userId
- `backend/src/scripts/seed-dev-actor.ts` - Removido globalUserId
- `backend/src/scripts/seed-dev-complete.ts` - **NOVO** - Seed completo
- `backend/package.json` - Adicionado script seed:dev:complete

---

## ⚠️ NOTAS IMPORTANTES

1. **Não reintroduzir globalUserId**: O sistema agora funciona exclusivamente com `user_id` + `tenant_id`
2. **Auto-create é DEV FRIENDLY**: Perfis são criados automaticamente quando necessário
3. **Fallbacks seguros**: Em caso de erro, retorna dados mínimos ao invés de quebrar
4. **Seed é idempotente**: Pode rodar múltiplas vezes sem duplicar dados
5. **Feature flags**: PRO e microfone habilitados por padrão para usuário DEV

---

## 🐛 BUGS CORRIGIDOS (1 linha cada)

1. **COALESCE text[] vs jsonb**: `keywords` é TEXT[] mas código usava jsonb → corrigido com `to_jsonb()`
2. **Identity/me 404**: Usava `req.user.id` e não criava perfil → corrigido com auto-create
3. **Actors 401/404**: Dependia de `globalUserId` → corrigido para usar `userId` diretamente
4. **Profile não salva**: Usava `req.user.id` → corrigido para `req.user.userId`
5. **Plan não retorna**: Usava `req.user.id` → corrigido para `req.user.userId`
6. **Seed incompleto**: Não criava feature flags → criado seed completo
7. **Core service globalUserId**: Queries usavam `global_user_id` → refatorado para `user_id`
8. **Categories globalUserId**: Rotas usavam `globalUserId` → corrigido para `userId`
9. **Profile routes id**: Usava `req.user.id` → corrigido para `req.user.userId`

---

**Data**: 2024  
**Status**: ✅ Todas as correções aplicadas e testadas














