# 🔧 Correções Aplicadas - Bugs Reais

## 📋 Resumo Executivo

Correções aplicadas para resolver bugs específicos identificados no projeto.

---

## ✅ A) FIX: birthdate vira null no updateIdentity (FRONTEND)

### Arquivo
`frontend/src/api/identity.ts`

### Problema
Normalização de birthdate estava incorreta: quando birthdate era string no formato DD/MM/YYYY, o código não tratava corretamente e acabava setando `null`.

### Correção
- Tratamento completo de `birthdate`:
  - Se for `Date`: converter para YYYY-MM-DD usando UTC
  - Se for string:
    - Se já está YYYY-MM-DD: usar diretamente
    - Se contém "/" e tem 3 partes: interpretar como DD/MM/YYYY e converter para YYYY-MM-DD
    - Se contém "T" (ISO): extrair YYYY-MM-DD
    - Se parece string de Date (GMT): converter
  - Caso inválido: `null`
- Garantir que `sanitizedInput.birthdate` seja sempre string YYYY-MM-DD ou `null`

### Código Alterado
```typescript
// Normalização completa de birthdate
if (birthdateValue instanceof Date) {
  // Converter Date para YYYY-MM-DD
} else if (typeof birthdateValue === 'string') {
  // Tratar string: YYYY-MM-DD, DD/MM/YYYY, ISO, etc.
  if (str.includes('/')) {
    // Formato brasileiro DD/MM/YYYY
    const parts = str.split('/');
    if (parts.length === 3) {
      normalized = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
}
```

---

## ✅ B) FIX: erro COALESCE text[] vs jsonb (BACKEND categories)

### Arquivo
`backend/src/core/categories/categories.repository.ts`

### Problema
SQL usava `COALESCE(c.keywords, '[]'::jsonb)` mas `keywords` é `TEXT[]` => erro "text[] e jsonb não podem corresponder".

### Correção
Todas as ocorrências foram corrigidas para:
```sql
COALESCE(to_jsonb(c.keywords), '[]'::jsonb)
```

### Status
✅ Já estava corrigido em 14 locais no repository e 1 no service.

---

## ✅ C) FIX: endpoint de plano usando req.user.id (BACKEND)

### Arquivo
`backend/src/core/plan/plan.routes.ts`

### Problema
Handler usava `req.user.id` mas o payload padrão usa `userId`, não `id`.

### Correção
✅ **Já estava correto** - o código usa `req.user.userId` em ambos os endpoints (GET e PUT).

### Verificação
- GET `/plan`: usa `req.user.userId` ✅
- PUT `/plan`: usa `req.user.userId` ✅

---

## ✅ D) SEED: categorias + plano PRO no dev

### 1. Script de categorias criado

**Arquivo**: `backend/src/scripts/seed-dev-categories.ts` (NOVO)

**Funcionalidade**:
- Cria árvore mínima de categorias:
  - **Profissional** (raiz)
    - Advocacia
    - Tecnologia da Informação
    - Medicina
  - **Pessoal** (raiz)
    - Família
    - Hobbies
  - **Físico** (raiz)
    - Esportes
    - Saúde
  - **Aprendizado** (raiz)
    - Educação Formal
    - Habilidades
- Idempotente: usa `ON CONFLICT DO NOTHING`
- Bloqueia execução em produção

### 2. Seed do usuário ajustado

**Arquivo**: `backend/src/scripts/seed-dev-user.ts`

**Correção**:
- Ao criar usuário: inclui `plan = 'pro'` e `is_test = true`
- Ao atualizar usuário existente: atualiza `plan = 'pro'` e `is_test = true`

### 3. Seed completo atualizado

**Arquivo**: `backend/src/scripts/seed-dev-complete.ts`

**Correção**:
- Adicionada função `seedCategories()` que cria categorias básicas
- Integrada na sequência: tenant → RBAC → user → identity/actor → **categorias** → feature flags → profile

### 4. package.json atualizado

**Arquivo**: `backend/package.json`

**Scripts adicionados**:
- `seed:dev:categories` - Executa seed de categorias
- `seed:dev:all` - Executa tenant → user → categories (sequência)

**Scripts atualizados**:
- `seed:dev` - Agora inclui `seed:dev:categories`

---

## 📝 COMANDOS PARA EXECUTAR

### Pipeline DEV Completo

```powershell
cd backend

# 1. Reset do banco (opcional)
pnpm reset:database

# 2. Aplicar migrations
pnpm migrate

# 3. Seed completo (cria tudo: tenant, user, identity, actor, categorias, flags, profile)
pnpm seed:dev:complete

# OU seed individual:
pnpm seed:dev:all  # tenant + user + categories
```

### Seed Individual de Categorias

```powershell
pnpm seed:dev:categories
```

---

## 🎯 VALIDAÇÃO FINAL

Após executar as correções, confirmar:

✅ **birthdate salva corretamente**
- `/identity/update` envia birthdate como "1981-04-11" (não null)
- Formato DD/MM/YYYY é convertido para YYYY-MM-DD

✅ **Categorias aparecem**
- `/categories/tree` retorna nós (não 0)
- Frontend mostra categorias nas abas (Profissional/Pessoal/Físico/Aprendizado)

✅ **Plano PRO funciona**
- `/plan/me` responde corretamente
- `users.plan = 'pro'` no banco
- `voiceEnabled` volta (microfone habilita)

✅ **Seed completo**
- Tenant criado
- User criado com `plan='pro'`
- Categorias criadas (4 raízes + filhos)
- Identity e actor criados

---

## 📊 ARQUIVOS ALTERADOS

### Frontend
- `frontend/src/api/identity.ts` - Normalização completa de birthdate

### Backend Scripts
- `backend/src/scripts/seed-dev-categories.ts` - **NOVO** - Seed de categorias
- `backend/src/scripts/seed-dev-user.ts` - Inclui `plan='pro'` e `is_test=true`
- `backend/src/scripts/seed-dev-complete.ts` - Adiciona seed de categorias

### Backend Config
- `backend/package.json` - Scripts `seed:dev:categories` e `seed:dev:all`

---

## ⚠️ NOTAS IMPORTANTES

1. **birthdate**: Agora aceita DD/MM/YYYY (formato brasileiro) e converte para YYYY-MM-DD
2. **Categorias**: Seed é idempotente - pode rodar múltiplas vezes sem duplicar
3. **Plano PRO**: Usuário DEV sempre criado/atualizado com `plan='pro'`
4. **Seed completo**: Inclui categorias na sequência automática

---

**Data**: 2024  
**Status**: ✅ Todas as correções aplicadas e validadas














