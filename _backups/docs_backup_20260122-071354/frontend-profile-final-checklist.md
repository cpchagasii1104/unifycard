# Checklist Final: Frontend - Categorias de Perfil

## 1. Endpoints de Busca de Categorias

### ✅ GET /categories com scope
- **Endpoint:** `GET /api/categories?scope={scope}`
- **Scopes válidos:** `professional`, `interest`, `learning`, `cause`
- **Status:** ✅ Backend implementado

## 2. Filtro de Scope por Contexto

### ⚠️ Verificar no Frontend

- [ ] **Perfil Profissional** → `scope=professional`
- [ ] **Interesses / Físico** → `scope=interest`
- [ ] **Aprendizado** → `scope=learning`
- [ ] **Causas** → `scope=cause` (somente leitura)

## 3. Regras Obrigatórias

- [ ] ✅ Aceita múltiplas categorias por perfil
- [ ] ✅ NÃO exige categoria leaf (aceita qualquer categoria)
- [ ] ✅ NÃO usa escopo geográfico (não envia country/state/city)

## 4. Hardcode de Categorias de Grupo

- [ ] ❌ Não há chamadas `/categories?scope=group` em componentes de perfil
- [ ] ❌ Não há arrays hardcoded de categorias de grupo
- [ ] ❌ Não há imports de categorias de grupo em componentes de perfil

## Arquivos Afetados (Prováveis)

### APIs
- `src/api/profile.ts`
- `src/api/categories.ts`

### Componentes
- `src/components/profile/ProfessionalForm.tsx`
- `src/components/profile/PhysicalForm.tsx`
- `src/components/profile/LearningForm.tsx`

### Páginas
- `src/pages/ProfileProfessionalPage.tsx`
- `src/pages/ProfilePhysicalPage.tsx`
- `src/pages/ProfileLearningPage.tsx`

## Ajuste Mínimo (se necessário)

### Adicionar filtro de scope na busca
```typescript
// ANTES (se não tiver scope)
const response = await fetch('/api/categories');

// DEPOIS
const response = await fetch(`/api/categories?scope=${scope}`);
```

## Confirmação

**Frontend de perfil pronto para integração:** ⚠️ **PENDENTE VALIDAÇÃO DOS ARQUIVOS LISTADOS**





