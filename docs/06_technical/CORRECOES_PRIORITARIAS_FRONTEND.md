# 🔧 CORREÇÕES PRIORITÁRIAS - UNIFICARD

**Data:** 24/12/2025  
**Objetivo:** Resolver os 113 erros TypeScript do frontend

---

## 🔴 CORREÇÃO 1: apiFetch Genérico

**Arquivo:** `frontend/src/api/client.ts`

### Problema Atual (linha 13):
```typescript
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response>
```

### Solução - Criar versão genérica:

Adicione esta nova função após a `apiFetch` existente:

```typescript
/**
 * Fetch tipado que retorna JSON parseado
 * Use esta função quando precisar do corpo da resposta tipado
 */
export async function apiFetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, options);
  return response.json() as Promise<T>;
}
```

---

## 🔴 CORREÇÃO 2: cultural.ts

**Arquivo:** `frontend/src/api/cultural.ts`

### Substituições necessárias:

Encontre todas as ocorrências de:
```typescript
return apiFetch<SomeTipo>('/path', { ... });
```

Substitua por:
```typescript
import { apiFetchJson } from './client';
// ...
return apiFetchJson<SomeTipo>('/path', { ... });
```

### Ou alternativa inline:
```typescript
const response = await apiFetch('/cultural/profiles', { method: 'POST', body: JSON.stringify(input) });
return response.json() as CulturalProfile;
```

---

## 🔴 CORREÇÃO 3: social.ts - Exportar membros

**Arquivo:** `frontend/src/api/social.ts`

Verifique se estas funções/tipos estão exportados:

```typescript
export interface Post { /* ... */ }
export interface CreatePostInput { /* ... */ }
export async function getFeed() { /* ... */ }
export async function createPost(input: CreatePostInput) { /* ... */ }
export async function scheduleServiceFromPost(postId: string) { /* ... */ }
export async function payServiceFromPost(postId: string) { /* ... */ }
```

Se não existirem, criar stubs ou importar de outro arquivo.

---

## 🟡 CORREÇÃO 4: Parâmetros `isActive` nos Layouts

**Arquivos afetados:**
- `frontend/src/components/layout/AdminLayout.tsx`
- `frontend/src/components/layout/AppLayout.tsx`
- `frontend/src/components/layout/BankLayout.tsx`
- `frontend/src/components/layout/SocialLayout.tsx`

### Problema:
```typescript
({ isActive }) => // TS7031: implicitly has 'any' type
```

### Solução:
```typescript
({ isActive }: { isActive: boolean }) =>
```

---

## 🟡 CORREÇÃO 5: CompaniesManager.tsx - Status comparisons

**Arquivo:** `frontend/src/components/CompaniesManager.tsx`

### Problema (linhas ~1134-1178):
```typescript
// Comparações com valores que não existem no tipo
status === 'pending_doc'  // ❌ não existe
status === 'validated'    // ❌ não existe
status === 'manual'       // ❌ não existe
status === 'draft'        // ❌ (é 'DRAFT' maiúsculo)
```

### Solução:
Verificar o tipo `CompanyStatus` em `@unificard/contracts` e usar os valores corretos:
```typescript
type CompanyStatus = 'DRAFT' | 'PROVISIONAL' | 'APPROVED' | 'SUSPENDED';
```

---

## 🟡 CORREÇÃO 6: CulturalEventsManager e CulturalProfilesManager

**Problema:**
```typescript
// Comparação com 'PERSON' que não existe no tipo
owner_actor_type === 'PERSON' // ❌
```

### Verificar o tipo correto:
```typescript
type ActorType = 'user' | 'page' | 'group' | 'channel';
// Provavelmente deveria ser 'user' ao invés de 'PERSON'
```

---

## 🟡 CORREÇÃO 7: Variáveis não utilizadas (TS6133)

Remover ou comentar variáveis declaradas mas não usadas:

```typescript
// Exemplos encontrados:
const [loadingAvailability, setLoadingAvailability] = useState(false); // não usado
const cleanNumber = (str: string) => str.replace(/\D/g, ''); // não usado
```

---

## 🟡 CORREÇÃO 8: IntentComposer.tsx

**Arquivo:** `frontend/src/components/social/IntentComposer.tsx`

### Problema (linhas 382-383):
```typescript
intent.occupancyModel // ❌ propriedade não existe em ClassifiedIntent
```

### Solução:
Adicionar ao tipo `ClassifiedIntent`:
```typescript
interface ClassifiedIntent {
  // ... outras props
  occupancyModel?: OccupancyModelType;
}
```

---

## 📋 SCRIPT DE VERIFICAÇÃO

Execute após as correções:

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
# Objetivo: 0 erros
```

---

## ✅ CHECKLIST DE CORREÇÕES

- [ ] Criar `apiFetchJson` em `client.ts`
- [ ] Atualizar todas as chamadas em `cultural.ts`
- [ ] Exportar membros faltantes em `social.ts`
- [ ] Tipar `isActive` em 5 layouts
- [ ] Corrigir comparações de status em `CompaniesManager.tsx`
- [ ] Corrigir `PERSON` → `user` em Cultural managers
- [ ] Remover variáveis não utilizadas
- [ ] Adicionar `occupancyModel` ao tipo `ClassifiedIntent`
- [ ] Rodar `npx tsc --noEmit` até zero erros

---

**Tempo estimado:** 2-4 horas para resolver todos os erros
