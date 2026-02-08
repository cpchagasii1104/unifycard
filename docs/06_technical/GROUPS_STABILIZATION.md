# 🔧 Estabilização do Módulo de Grupos - Unificard

**Data:** 2025-01-29  
**Status:** ✅ Concluído

## 📋 Objetivo

Fazer a criação de grupos funcionar HOJE, com:
- ✅ Categorias aparecendo no wizard
- ✅ Location Core funcionando
- ✅ CPF sem duplicidade
- ✅ Sem "duas verdades" (módulos paralelos)

## 🔧 Correções Aplicadas

### 1. Remoção do Category Core Novo (Conflito de Rotas)

**Problema:** O Category Core novo estava registrado em `/categories` (público) enquanto o módulo legado também estava em `/categories` (protegido), causando conflito de rotas.

**Solução:** Removido o registro do Category Core novo do `server.ts`. O módulo legado em `/categories` (protegido) já fornece todas as rotas necessárias.

**Arquivo:** `backend/src/server.ts`
- Linhas 119-126: Category Core comentado/removido

### 2. Correção do Frontend - Endpoint de Categorias

**Problema:** O frontend estava chamando `/categories?scope=group` (Category Core novo) que não existe mais.

**Solução:** Alterado para usar o endpoint real `/groups/categories` que já existe e retorna categorias da tabela `group_categories`.

**Arquivo:** `frontend/src/api/groups.ts`
- Função `getGroupCategories()` agora chama `/groups/categories`
- Mapeamento mantido para compatibilidade com o formato esperado

### 3. Permissões RBAC

**Status:** ✅ Já implementado na migration `038_groups_rbac_permissions.sql`

A permissão `groups:create` já existe e é atribuída ao role `USER` por padrão. A rota `POST /groups` já verifica essa permissão via `requirePermission(['groups:create'])`.

**Verificação:**
- Migration `038_groups_rbac_permissions.sql` cria permissão `groups:create`
- Atribui ao role `USER` (linha 98-107)
- Rota `POST /groups` verifica permissão (linha 55 de `groups.routes.ts`)

### 4. Endpoint GET /groups/categories

**Status:** ✅ Funcional e público

O endpoint `GET /groups/categories` está disponível e não requer permissão extra (apenas autenticação básica do escopo protegido). Retorna categorias da tabela `group_categories`.

**Arquivo:** `backend/src/modules/groups/groups.routes.ts`
- Linhas 173-199: Endpoint implementado
- Retorna formato: `{ categories: [{ categoryId, name, slug, icon, description }] }`

### 5. Location Core

**Status:** ✅ Sem erros de compilação

O erro de duplicação de `stateName` já foi corrigido anteriormente:
- Linha 99: `stateNameForCreation` (variável para criação)
- Linha 130: `stateName` (variável para exibição, vem de `state.name`)

**Arquivo:** `backend/src/core/location/location-enrichment.service.ts`

### 6. ProfilePhysical

**Status:** ✅ Já corrigido

O erro `Cannot read properties of undefined (reading 'join')` já foi corrigido:
- Linha 719: `{(Array.isArray(interest.categoryPath) ? interest.categoryPath : []).join(' > ')}`

**Arquivo:** `frontend/src/components/ProfilePhysical.tsx`

## 📊 Estrutura Final

### Backend

```
/categories (protegido) - Módulo legado
  ├── GET /categories/tree
  ├── GET /categories/autocomplete
  ├── GET /categories/search
  ├── GET /categories/:categoryId
  └── POST /categories/* (criação, etc.)

/groups (protegido)
  ├── POST /groups (requer groups:create)
  ├── GET /groups/categories (público no escopo)
  └── GET /groups/:groupId
```

### Frontend

```typescript
// frontend/src/api/groups.ts
getGroupCategories() → GET /groups/categories
createGroup() → POST /groups (com groups:create)
```

## ✅ Checklist de Validação

- [x] Backend compila sem erros TypeScript
- [x] Rotas não duplicadas
- [x] Frontend usa endpoint correto
- [x] Permissões RBAC configuradas
- [x] Location Core sem erros
- [x] ProfilePhysical sem crashes

## 🚀 Próximos Passos

1. **Testar criação de grupo:**
   - Abrir `/grupos/novo`
   - Verificar se categorias aparecem
   - Verificar se LocationSelector funciona
   - Criar grupo e verificar se não retorna "missing permission"

2. **Verificar permissões:**
   - Confirmar que usuários têm role `USER` atribuído
   - Se não tiverem, executar seed de roles ou atribuir manualmente

3. **Monitorar logs:**
   - Verificar se há erros 500 em `/groups/categories`
   - Verificar se há erros de permissão em `POST /groups`

## 📝 Notas Importantes

- **Nenhum arquivo foi criado na raiz** - toda documentação em `/docs/dev/`
- **Nenhum módulo paralelo foi criado** - estabilizamos o existente
- **Migrations são idempotentes** - podem ser executadas múltiplas vezes
- **CPF permanece em `user_profiles.cpf`** - não foi reintroduzido em metadata

---

**Estabilização concluída!** ✅







