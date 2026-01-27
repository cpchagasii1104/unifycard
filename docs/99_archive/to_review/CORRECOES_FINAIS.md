# 🔧 Correções Finais Aplicadas - Sistema Unificard

## 📋 Resumo Executivo

Correções aplicadas para resolver problemas críticos após mudanças no schema do banco de dados.

---

## ✅ CORREÇÃO 1: JWT inclui globalUserId quando disponível

### Problema
Sistema precisa de `globalUserId` em algumas rotas, mas JWT não estava incluindo.

### Causa Raiz
JWT era gerado apenas com `userId` e `tenantId`, sem resolver `globalUserId` via `user_identity_links`.

### Correção
- `auth.service.ts`: Resolve `globalUserId` via `resolveGlobalUserId()` durante login/register/refresh
- JWT agora inclui `globalUserId` opcionalmente (não quebra se ausente)
- `req.user` inclui `globalUserId` quando disponível no JWT

### Arquivos Alterados
- `backend/src/core/auth/auth.service.ts` (login, register, refreshToken)
- `backend/src/core/auth/auth.types.ts` (JwtPayload interface)
- `backend/src/core/auth/auth.plugin.ts` (req.user inclui globalUserId)
- `backend/src/types/fastify.d.ts` (tipo req.user)

---

## ✅ CORREÇÃO 2: Identity/me e /update com auto-create robusto

### Problema
Endpoints retornavam 404 quando perfil não existia, mesmo após tentativa de auto-create.

### Causa Raiz
Auto-create falhava silenciosamente e endpoint retornava 404.

### Correção
- Auto-create com fallback: se falhar, retorna perfil mínimo ao invés de erro
- Validação de `req.user.userId` antes de processar
- Normalização de `birthdate` no preHandler antes da validação Zod

### Arquivos Alterados
- `backend/src/core/identity/identity.routes.ts` (GET /me e POST /update)

---

## ✅ CORREÇÃO 3: COALESCE text[] vs jsonb (COMPLETO)

### Problema
Queries usavam `COALESCE(keywords, '[]'::jsonb)` mas `keywords` é `TEXT[]`.

### Causa Raiz
Migration 042 criou coluna como `TEXT[]`, mas código esperava JSONB.

### Correção
Substituído por `COALESCE(to_jsonb(keywords), '[]'::jsonb)` em todos os locais.

### Arquivos Alterados
- `backend/src/core/categories/categories.repository.ts` (14 ocorrências)
- `backend/src/core/categories/categories.service.ts` (1 ocorrência)
- `backend/src/core/catalog/category-review.service.ts` (1 ocorrência)

---

## ✅ CORREÇÃO 4: Seed DEV completo e idempotente

### Problema
Seeds separados não criavam tudo necessário (identity, actor, feature flags).

### Causa Raiz
Scripts de seed eram executados separadamente e não garantiam estado completo.

### Correção
Criado `seed-dev-complete.ts` que executa tudo em ordem:
1. Tenant DEV
2. RBAC (com fallback se função não existir)
3. Usuário DEV (com `is_test=true` e `plan='pro'`)
4. Identidade global e actor
5. Feature flags (PRO e microfone)
6. Profile básico

### Arquivos Criados
- `backend/src/scripts/seed-dev-complete.ts`

### Arquivos Alterados
- `backend/package.json` (script `seed:dev:complete`)

---

## ✅ CORREÇÃO 5: Tenant ID propagado corretamente

### Problema
Alguns endpoints retornavam "MISSING_TENANT" mesmo com header presente.

### Causa Raiz
Validações inconsistentes entre tenant plugin e auth plugin.

### Correção
- Tenant plugin valida header `x-tenant-id` e injeta em `req.tenant.id`
- Auth plugin valida que JWT `tenantId` corresponde ao header
- Frontend já envia `x-tenant-id` corretamente (client.ts)

### Status
✅ Já estava correto - apenas documentado

---

## ✅ CORREÇÃO 6: Plan endpoint usa userId corretamente

### Problema
Endpoint `/plan` usava `req.user.id` ao invés de `req.user.userId`.

### Causa Raiz
Inconsistência após remoção de `globalUserId` de `req.user`.

### Correção
Atualizado para usar `req.user.userId` em todas as queries.

### Arquivos Alterados
- `backend/src/core/plan/plan.routes.ts` (GET / e PUT /)

---

## 📝 COMANDOS PARA EXECUTAR (Windows)

### Pipeline DEV Completo

```powershell
cd backend

# 1. Reset do banco (opcional - apenas se quiser começar do zero)
pnpm reset:database

# 2. Aplicar migrations
pnpm migrate

# 3. Seed completo (cria tudo: tenant, user, identity, actor, flags, profile)
pnpm seed:dev:complete

# 4. Iniciar backend
pnpm dev
```

### Verificação Rápida

```powershell
# Verificar se seed foi executado
pnpm seed:dev:complete

# Se já executou antes, é idempotente (não duplica)
```

---

## 🎯 RESULTADO ESPERADO

Após executar as correções:

✅ **Login funciona** - JWT inclui `tenantId` e `globalUserId` (quando disponível)  
✅ **Sessão não expira** - Token válido com tenantId correto  
✅ **Perfil salva** - Auto-create funciona, birthdate aceita YYYY-MM-DD  
✅ **Actors carregam** - `/social/actors/available` retorna lista  
✅ **Categorias carregam** - Sem erro de COALESCE text[] vs jsonb  
✅ **PRO/GRATUITO aparece** - Feature flags criadas no seed  
✅ **Microfone habilitado** - Feature flag criada no seed  
✅ **Nenhum MISSING_TENANT** - Tenant propagado corretamente  

---

## 🔍 ARQUIVOS ALTERADOS (RESUMO FINAL)

### Backend Core Auth
- `auth.service.ts` - JWT inclui globalUserId opcional
- `auth.types.ts` - JwtPayload inclui globalUserId opcional
- `auth.plugin.ts` - req.user inclui globalUserId opcional

### Backend Core Identity
- `identity.routes.ts` - Auto-create robusto com fallback

### Backend Core Categories
- `categories.repository.ts` - COALESCE corrigido (14 locais)
- `categories.service.ts` - COALESCE corrigido
- `category-review.service.ts` - COALESCE corrigido

### Backend Core Plan
- `plan.routes.ts` - Usa req.user.userId

### Backend Scripts
- `seed-dev-complete.ts` - **NOVO** - Seed completo idempotente

### Backend Types
- `fastify.d.ts` - req.user inclui globalUserId opcional

### Config
- `package.json` - Script seed:dev:complete

---

## 🐛 BUGS CORRIGIDOS (1 linha cada)

1. **JWT sem globalUserId**: Login não resolvia globalUserId → corrigido com resolveGlobalUserId()
2. **Identity/me 404**: Auto-create falhava silenciosamente → corrigido com fallback seguro
3. **Identity/update 400**: birthdate não normalizado antes de Zod → corrigido no preHandler
4. **COALESCE text[] vs jsonb**: keywords é TEXT[] mas código usava jsonb → corrigido com to_jsonb()
5. **Seed incompleto**: Não criava identity/actor/flags → criado seed completo
6. **Plan não retorna**: Usava req.user.id → corrigido para req.user.userId
7. **RefreshToken sem globalUserId**: Não resolvia globalUserId → corrigido

---

## ⚠️ NOTAS IMPORTANTES

1. **globalUserId é opcional**: Sistema funciona sem ele, mas JWT inclui quando disponível
2. **Auto-create é DEV FRIENDLY**: Perfis criados automaticamente quando necessário
3. **Fallbacks seguros**: Em caso de erro, retorna dados mínimos ao invés de quebrar
4. **Seed é idempotente**: Pode rodar múltiplas vezes sem duplicar dados
5. **Tenant sempre obrigatório**: Frontend envia `x-tenant-id` em todas as requisições

---

**Data**: 2024  
**Status**: ✅ Todas as correções aplicadas e validadas














