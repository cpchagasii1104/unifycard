# 🚨 CORREÇÕES URGENTES - UNIFICARD
## Itens que Bloqueiam Produção

---

## 1. ERROS DE TYPESCRIPT A CORRIGIR

### Frontend - Erros Críticos

#### 1.1 ServicePostCard.tsx - Exports Faltantes
```typescript
// Arquivo: frontend/src/components/ServicePostCard.tsx
// Erro: Module '"../api/social"' has no exported member 'Post', 'scheduleServiceFromPost', 'payServiceFromPost'

// SOLUÇÃO: Adicionar em api/social.ts:
export interface Post {
  id: string;
  content: string;
  // ... outros campos
}

export async function scheduleServiceFromPost(postId: string): Promise<void> {
  // implementar
}

export async function payServiceFromPost(postId: string): Promise<void> {
  // implementar
}
```

#### 1.2 SocialFeed.tsx - Exports Faltantes
```typescript
// Arquivo: frontend/src/components/SocialFeed.tsx
// Erro: Module has no exported member 'getFeed', 'createPost', 'Post', 'CreatePostInput'

// SOLUÇÃO: Verificar api/social.ts e adicionar exports
export { getFeed, createPost } from './social-2.0';
export type { Post, CreatePostInput } from './types';
```

#### 1.3 IntentComposer.tsx - Propriedade Inexistente
```typescript
// Arquivo: frontend/src/components/social/IntentComposer.tsx
// Erro: Property 'occupancyModel' does not exist on type 'ClassifiedIntent'

// SOLUÇÃO 1: Adicionar ao tipo
interface ClassifiedIntent {
  // campos existentes...
  occupancyModel?: 'FREE' | 'PAID' | 'CONSUMPTION';
}

// SOLUÇÃO 2: Usar type guard
if ('occupancyModel' in intent) {
  // usar intent.occupancyModel
}
```

#### 1.4 HeaderGlobal.tsx - Variável Não Declarada
```typescript
// Arquivo: frontend/src/components/layout/HeaderGlobal.tsx
// Linha: 94, 108
// Erro: Cannot find name 'setIsLoading'

// SOLUÇÃO: Declarar o state
const [isLoading, setIsLoading] = useState(false);
```

#### 1.5 ContextualSuggestion.tsx - Variável Não Declarada
```typescript
// Arquivo: frontend/src/components/ContextualSuggestion.tsx
// Linha: 68
// Erro: Cannot find name 'setDismissedIds'

// SOLUÇÃO: Declarar o state
const [dismissedIds, setDismissedIds] = useState<string[]>([]);
```

#### 1.6 CulturalProfilesManager.tsx - Comparação de Tipos
```typescript
// Arquivo: frontend/src/components/CulturalProfilesManager.tsx
// Linhas: 78, 86
// Erro: Comparison appears unintentional - types '"group" | "user" | "page" | "channel"' and '"PERSON"' have no overlap

// SOLUÇÃO: Verificar enum/tipo correto
// Provavelmente deve usar 'user' em vez de 'PERSON'
if (actorType === 'user') { // não 'PERSON'
```

#### 1.7 Layouts - Tipo Implícito 'any'
```typescript
// Arquivos: AdminLayout.tsx, AppLayout.tsx, BankLayout.tsx, SocialLayout.tsx
// Erro: Binding element 'isActive' implicitly has an 'any' type

// SOLUÇÃO: Tipar o parâmetro
interface NavLinkRenderProps {
  isActive: boolean;
  isPending: boolean;
}

// Uso:
<NavLink>
  {({ isActive }: NavLinkRenderProps) => (
    // ...
  )}
</NavLink>
```

#### 1.8 CompanyPage.tsx e ProfilePage.tsx - Bio Undefined
```typescript
// Arquivos: frontend/src/components/social/CompanyPage.tsx, ProfilePage.tsx
// Linha: 41
// Erro: Type 'undefined' is not assignable to type 'string | null'

// SOLUÇÃO: Converter undefined para null
setActorData({
  ...data,
  bio: data.bio ?? null, // converter undefined para null
});
```

---

## 2. CONSOLE.LOG PARA REMOVER (TOP 10 ARQUIVOS)

### Backend - Priorizar Remoção
```bash
# Comando para encontrar
grep -rn "console.log" backend/src --include="*.ts" | cut -d: -f1 | sort | uniq -c | sort -rn | head -10
```

### Substituição Padrão
```typescript
// DE:
console.log('Processing order:', orderId);

// PARA:
fastify.log.info({ orderId }, 'Processing order');
```

---

## 3. MIGRATIONS PENDENTES

### Renumerar ou Documentar
Os seguintes números estão ausentes na sequência de migrations:
- **007, 008** - Entre 006 e 009
- **018** - Entre 017 e 019
- **040, 041** - Entre 039 e 042

**Ação**: Criar arquivo `migrations/MISSING_MIGRATIONS.md` documentando por que foram removidas ou renumerar se necessário.

---

## 4. TIPOS `any` CRÍTICOS A CORRIGIR

### Prioridade Alta (Services Financeiros)
```bash
# Encontrar usos de any em services críticos
grep -rn ": any" backend/src/core/economy --include="*.ts"
grep -rn ": any" backend/src/core/checkout --include="*.ts"
grep -rn ": any" backend/src/core/auth --include="*.ts"
```

### Padrão de Correção
```typescript
// DE:
async function processPayment(data: any): Promise<any> {

// PARA:
interface PaymentInput {
  amount: number;
  currency: string;
  userId: string;
}

interface PaymentResult {
  transactionId: string;
  status: 'success' | 'failed';
}

async function processPayment(data: PaymentInput): Promise<PaymentResult> {
```

---

## 5. ARQUIVOS PARA DIVIDIR

### Backend - Rotas Grandes
| Arquivo | Linhas | Ação |
|---------|--------|------|
| social-2.0.routes.ts | 1.070 | Dividir em: feed.routes + posts.routes + actors.routes + ledger.routes |
| categories.routes.ts | 865 | Dividir em: categories.routes + search.routes + admin.routes |
| organizers.routes.ts | 752 | Dividir em: organizers.routes + billing.routes + events.routes |

### Frontend - Componentes Grandes
| Componente | Linhas | Ação |
|------------|--------|------|
| Profile.tsx | 1.831 | Extrair: ProfileHeader, ProfileTabs, ProfileEducation, ProfileWork, ProfileSettings |
| ProfileProfessional.tsx | 1.330 | Extrair: SkillsSection, ExperienceSection, ServicesSection |
| CompaniesManager.tsx | 1.234 | Extrair: CompanyList, CompanyForm, CompanyDetails, CompanyActions |

---

## 6. SCRIPT DE VERIFICAÇÃO

Criar script para verificar estado do projeto:

```bash
#!/bin/bash
# verify-project.sh

echo "=== VERIFICAÇÃO UNIFICARD ==="

echo -n "Erros TypeScript Backend: "
cd backend && npx tsc --noEmit 2>&1 | grep -c "error TS"

echo -n "Erros TypeScript Frontend: "
cd ../frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"

echo -n "Console.log Backend: "
grep -rn "console.log" ../backend/src --include="*.ts" | wc -l

echo -n "Console.log Frontend: "
grep -rn "console.log" src --include="*.ts" --include="*.tsx" | wc -l

echo -n "Usos de any: "
grep -rn ": any" ../backend/src --include="*.ts" | wc -l

echo "=== FIM ==="
```

---

## 7. ORDEM DE EXECUÇÃO RECOMENDADA

1. **Dia 1**: Corrigir erros de TypeScript críticos (1.1 a 1.8)
2. **Dia 2**: Tipar layouts e remover `any` de auth
3. **Dia 3**: Dividir social-2.0.routes.ts
4. **Dia 4**: Migrar 50% dos console.log para logger
5. **Dia 5**: Dividir Profile.tsx

---

*Lista gerada como parte da Auditoria de Dezembro/2024*
