# Checklist Frontend: Categorias de Perfil

## 1. Endpoints de Busca de Categorias

### ✅ GET /categories aceita scopes de perfil
- **Endpoint:** `GET /api/categories?scope={scope}`
- **Scopes válidos:** `professional`, `interest`, `learning`, `cause`
- **Status:** ✅ Backend implementado

## 2. Filtro de Scope por Contexto

### ⚠️ Verificar implementação

**Perfil Profissional:**
- [ ] Usa `scope=professional` ao buscar categorias
- [ ] Arquivo: `src/api/profile.ts` ou `src/components/profile/ProfessionalForm.tsx`

**Interesses / Físico:**
- [ ] Usa `scope=interest` ao buscar categorias
- [ ] Arquivo: `src/components/profile/PhysicalForm.tsx`

**Aprendizado:**
- [ ] Usa `scope=learning` ao buscar categorias
- [ ] Arquivo: `src/components/profile/LearningForm.tsx`

**Causas:**
- [ ] Usa `scope=cause` ao buscar categorias (somente leitura)
- [ ] Arquivo: `src/components/profile/CauseForm.tsx` (se existir)

## 3. Regras Obrigatórias

### ✅ Múltiplas Categorias
- [ ] Frontend permite seleção múltipla ou array de categorias
- [ ] Não limita a uma única categoria por perfil

### ✅ Categoria NÃO precisa ser leaf
- [ ] Frontend não filtra por `level === 0`
- [ ] Frontend não filtra por `parent_id IS NULL`
- [ ] Aceita qualquer categoria retornada pelo backend

### ✅ NÃO usa escopo geográfico
- [ ] Frontend não envia `country_id`, `state_id`, `city_id` no payload
- [ ] Não há campos geográficos nos formulários de perfil

## 4. Hardcode de Categorias de Grupo

### ⚠️ Verificar e remover

- [ ] Não há chamadas `GET /categories?scope=group` em componentes de perfil
- [ ] Não há arrays hardcoded de categorias de grupo
- [ ] Não há imports de categorias de grupo em componentes de perfil

## 5. Estrutura de Dados

### ✅ Resposta do Backend
- [ ] Frontend espera `{ categories: Category[] }`
- [ ] Frontend usa `category.id` (não `categoryId`)
- [ ] Frontend usa `category.scope` para validação

### ✅ Payload de Envio
- [ ] Professional: `{ skills: [{ categoryId, ... }] }`
- [ ] Physical: `{ interests: string[] }` (array de categoryIds)
- [ ] Learning: `{ learnings: string[] }` (array de categoryIds)

## Arquivos a Verificar

### APIs
- `src/api/profile.ts`
- `src/api/categories.ts`

### Componentes
- `src/components/profile/ProfessionalForm.tsx`
- `src/components/profile/PhysicalForm.tsx`
- `src/components/profile/LearningForm.tsx`
- `src/components/profile/CategorySelector.tsx` (se existir)

### Páginas
- `src/pages/ProfileProfessionalPage.tsx`
- `src/pages/ProfilePhysicalPage.tsx`
- `src/pages/ProfileLearningPage.tsx`

## Ajustes Mínimos (se necessário)

### 1. Adicionar filtro de scope
```typescript
// Adicionar scope na busca
const categories = await fetch(`/api/categories?scope=${scope}`);
```

### 2. Remover hardcode
```typescript
// Remover arrays hardcoded de categorias
```

### 3. Garantir múltiplas categorias
```typescript
// Usar array para seleção múltipla
const [selectedIds, setSelectedIds] = useState<string[]>([]);
```

## Confirmação

**Frontend de perfil pronto para integração:** ⚠️ **PENDENTE VALIDAÇÃO**





