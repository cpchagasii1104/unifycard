# Validação Frontend: Categorias de Perfil do Usuário

## Checklist de Validação

### 1. Endpoints de Busca de Categorias

#### ✅ GET /categories com filtro de scope
- **Endpoint:** `GET /api/categories?scope={scope}`
- **Scopes válidos:** `professional`, `interest`, `learning`, `cause`
- **Status:** ✅ Backend aceita scopes de perfil

**Exemplo de uso:**
```typescript
// Perfil profissional
const response = await fetch('/api/categories?scope=professional');

// Interesses / físico
const response = await fetch('/api/categories?scope=interest');

// Aprendizado
const response = await fetch('/api/categories?scope=learning');

// Causas (somente leitura)
const response = await fetch('/api/categories?scope=cause');
```

### 2. Filtro de Scope por Contexto

#### ⚠️ Verificar implementação no frontend

**Perfil Profissional:**
- Deve usar `scope=professional`
- Arquivos prováveis: `src/pages/ProfileProfessionalPage.tsx`, `src/components/profile/ProfessionalForm.tsx`

**Interesses / Físico:**
- Deve usar `scope=interest`
- Arquivos prováveis: `src/pages/ProfilePhysicalPage.tsx`, `src/components/profile/PhysicalForm.tsx`

**Aprendizado:**
- Deve usar `scope=learning`
- Arquivos prováveis: `src/pages/ProfileLearningPage.tsx`, `src/components/profile/LearningForm.tsx`

**Causas:**
- Deve usar `scope=cause` (somente leitura)
- Arquivos prováveis: `src/pages/ProfileCausePage.tsx` (se existir)

### 3. Regras Obrigatórias

#### ✅ Múltiplas Categorias
- **Status:** ✅ Backend suporta múltiplas categorias
- **Verificar:** Frontend deve permitir seleção múltipla ou array de categorias

#### ✅ Categoria NÃO precisa ser leaf
- **Status:** ✅ Backend aceita qualquer categoria (raiz ou filha)
- **Verificar:** Frontend não deve filtrar por `level === 0` ou `parent_id IS NULL`

#### ✅ NÃO usa escopo geográfico
- **Status:** ✅ Backend não exige `country_id`, `state_id`, `city_id`
- **Verificar:** Frontend não deve enviar campos geográficos no payload de perfil

### 4. Hardcode de Categorias de Grupo

#### ⚠️ Verificar hardcode antigo

**Buscar por:**
- `scope=group` em chamadas de categorias de perfil
- Arrays hardcoded de categorias
- Imports de categorias de grupo em componentes de perfil

**Arquivos a verificar:**
- `src/api/profile.ts` ou `src/api/categories.ts`
- `src/components/profile/**/*.tsx`
- `src/pages/Profile*.tsx`

### 5. Estrutura de Dados

#### ✅ Resposta do Backend
```typescript
// GET /api/categories?scope=professional
{
  "categories": [
    {
      "id": "uuid",
      "slug": "construcao-reformas",
      "name": "Construção e Reformas",
      "description": "...",
      "parentId": null,
      "scope": "professional",
      "isActive": true,
      "icon": "🔨",
      "color": null,
      "metadata": {},
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### ✅ Payload de Envio (Professional)
```typescript
// PUT /api/profile/professional
{
  "skills": [
    {
      "categoryId": "uuid",
      "skillLevel": 80,
      "yearsExperience": 5,
      "hourlyRate": 50.00,
      "pricingType": "hourly",
      "serviceType": "service",
      "chargeVisit": false,
      "visitPrice": null
    }
  ]
}
```

#### ✅ Payload de Envio (Physical)
```typescript
// PUT /api/profile/physical
{
  "interests": ["uuid1", "uuid2", "uuid3"], // Array de categoryIds
  "lifestyle": { ... },
  "preferences": { ... }
}
```

#### ✅ Payload de Envio (Learning)
```typescript
// PUT /api/profile/learning
{
  "learnings": ["uuid1", "uuid2"], // Array de categoryIds
  "preferences": { ... }
}
```

## Arquivos Afetados (Prováveis)

### APIs
- `src/api/profile.ts` ou `src/api/categories.ts`
- Verificar se há função `getProfileCategories(scope: string)`

### Componentes de Perfil
- `src/components/profile/ProfessionalForm.tsx`
- `src/components/profile/PhysicalForm.tsx`
- `src/components/profile/LearningForm.tsx`
- `src/components/profile/CategorySelector.tsx` (se existir)

### Páginas
- `src/pages/ProfileProfessionalPage.tsx`
- `src/pages/ProfilePhysicalPage.tsx`
- `src/pages/ProfileLearningPage.tsx`

## Ajustes Mínimos Necessários (se houver)

### 1. Adicionar filtro de scope na busca de categorias
```typescript
// ANTES (se existir)
const response = await fetch('/api/categories');

// DEPOIS
const response = await fetch(`/api/categories?scope=${scope}`);
```

### 2. Remover hardcode de categorias de grupo
```typescript
// ❌ REMOVER se existir
const GROUP_CATEGORIES = ['social', 'musica', 'educacao'];

// ✅ USAR busca dinâmica
const categories = await getCategories({ scope: 'professional' });
```

### 3. Garantir múltiplas categorias
```typescript
// ✅ Permitir seleção múltipla
<MultiSelect
  options={categories}
  value={selectedCategoryIds} // Array
  onChange={setSelectedCategoryIds}
/>
```

## Confirmação

**Frontend de perfil pronto para integração:** ⚠️ **PENDENTE VALIDAÇÃO**

**Próximos passos:**
1. Verificar arquivos listados acima
2. Aplicar ajustes mínimos se necessário
3. Testar cada contexto de perfil (professional, interest, learning)
4. Confirmar que não há hardcode de categorias de grupo





