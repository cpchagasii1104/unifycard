# 🛠️ PROMPT PARA CORREÇÃO DE ERROS TYPESCRIPT
**Total:** 84 erros (39 backend + 45 frontend)

---

## CONTEXTO

O sistema Unificard tem 84 erros de compilação TypeScript que bloqueiam produção. Este prompt contém patches organizados por arquivo para correção sistemática.

---

## PARTE 1: BACKEND (39 erros)

### 1.1 Instalar Dependência

```bash
cd backend
npm install --save-dev @types/luxon
```

### 1.2 Corrigir CategoryType

**Arquivo:** `src/core/categories/categories.types.ts`

Localizar todas as unions que definem tipos de categoria e adicionar `'learning'`:

```typescript
// ANTES (exemplo)
type CategoryContext = 'professional' | 'interest' | 'education' | 'hobby';

// DEPOIS
type CategoryContext = 'professional' | 'interest' | 'education' | 'hobby' | 'learning';
```

Fazer isso para TODAS as ocorrências de unions similares no arquivo.

### 1.3 Corrigir Checkout Routes

**Arquivo:** `src/core/checkout/checkout.routes.ts`

```typescript
// Linha 21-22: Adicionar type assertion
fastify.post<{
  Body: {
    eventId: string;
    idempotencyKey?: string;
  };
}>('/event-ticket', async (req: FastifyRequest, reply) => {
  // ADICIONAR no início do handler:
  const body = req.body as { eventId: string; idempotencyKey?: string };
  
  // Usar body.eventId em vez de req.body.eventId
```

### 1.4 Corrigir CheckoutService Return Type

**Arquivo:** `src/core/checkout/CheckoutService.ts`

```typescript
// Linha 130: Mudar null para undefined
return {
  success: true,
  transactionId: mainTransactionId ?? undefined,  // era: mainTransactionId
};
```

### 1.5 Corrigir Identity Service

**Arquivo:** `src/core/identity/identity.service.ts`

Múltiplos erros de narrowing. Verificar cada linha com erro e adicionar type guards apropriados ou type assertions.

### 1.6 Corrigir Companies Routes

**Arquivo:** `src/core/companies/companies.routes.ts`

Linha 366, 372: Adicionar `fileName` ao tipo de retorno ou ajustar interface.

### 1.7 Corrigir Companies Service

**Arquivo:** `src/core/companies/companies.service.ts`

Linha 1148: Remover `fileName` do objeto se não está no tipo.

### 1.8 Corrigir Server

**Arquivo:** `src/server.ts`

Linha 209: Adicionar type guard para `address.port`:
```typescript
const actualPort = typeof address === 'string' ? PORT : (address as any).port || PORT;
```

### 1.9 Corrigir Opportunity Service

**Arquivo:** `src/core/opportunity/opportunity.service.ts`

Linha 43: Verificar se `LearningCategory` tem a propriedade `preferences`.

### 1.10 Corrigir Profile Inference

**Arquivo:** `src/core/profile/profile-inference.service.ts`

Linha 107: Verificar se `LearningCategory` tem a propriedade `progress`.

---

## PARTE 2: FRONTEND (45 erros)

### 2.1 Instalar Dependência

```bash
cd frontend
npm install --save-dev @types/luxon
```

### 2.2 Corrigir App.tsx

**Arquivo:** `src/App.tsx`

```typescript
// Linha 1-17: ADICIONAR import
import CompanyValidationBackoffice from './components/CompanyValidationBackoffice';

// Linha 19: ADICIONAR 'validation' ao tipo
type View = 'login' | 'register' | 'dashboard' | 'social' | 'profile' | 'company' | 'ledger' | 'wallet' | 'transaction' | 'validation';
```

### 2.3 Corrigir Interface Company

**Arquivo:** `src/api/companies.ts`

```typescript
export interface Company {
  companyId: string;
  globalUserId: string;
  cnpj: string;
  companyName: string;
  tradeName?: string;
  registrationDate?: string;
  address: CompanyAddress;
  contact: CompanyContact;
  activity: CompanyActivity;
  revenueData?: Record<string, any>;
  status: 'active' | 'inactive' | 'suspended' | 'closed';
  companyStatus?: 'draft' | 'manual' | 'pending_doc' | 'validated';  // ADICIONAR
  isVerified: boolean;
  // ... resto igual
}
```

### 2.4 Corrigir API Categories

**Arquivo:** `src/api/categories.ts`

Localizar todas as funções que aceitam `context` e adicionar `'learning'`:

```typescript
// ANTES
context?: 'professional' | 'interest' | 'education';

// DEPOIS  
context?: 'professional' | 'interest' | 'education' | 'learning';
```

### 2.5 Corrigir ContextualSuggestion

**Arquivo:** `src/components/ContextualSuggestion.tsx`

```typescript
interface ContextualSuggestionProps {
  // Adicionar prop faltando:
  onNavigate?: (tab: string) => void;
}
```

### 2.6 Corrigir EventCard (imports duplicados)

**Arquivo:** `src/components/events/EventCard.tsx`

Remover uma das linhas de import duplicadas:
```typescript
// MANTER apenas UMA destas linhas
import AvailabilityPreview from './AvailabilityPreview';
// OU
import { AvailabilityPreview } from './AvailabilityPreview';
```

### 2.7 Corrigir EventPage (mesmo problema)

**Arquivo:** `src/components/events/EventPage.tsx`

Mesmo fix do EventCard.

### 2.8 Corrigir Wallet

**Arquivo:** `src/components/Wallet.tsx`

Linha 74: Adicionar `governance` ao objeto de cores:
```typescript
const TYPE_COLORS: Record<'split' | 'other' | 'p2p' | 'donation' | 'compensation' | 'governance', string> = {
  p2p: '#4CAF50',
  donation: '#2196F3',
  split: '#FF9800',
  compensation: '#9C27B0',
  governance: '#607D8B',  // ADICIONAR
  other: '#757575',
};
```

### 2.9 Remover Imports Não Usados

Execute em cada arquivo com warning TS6133:
- `CompaniesManager.tsx`: remover `validateCNPJ`, `cleanNumber`, `hasProtocol`
- `CompanyValidationBackoffice.tsx`: remover `Company`
- `ContextualSuggestion.tsx`: remover `dismissedIds`
- `MatchSuggestion.tsx`: remover `formatUsers`
- `Profile.tsx`: remover `validateCEP`
- `ProfileLearning.tsx`: remover `LearningProfile`, `addDetail`, `removeDetail`
- `MFIBankSummary.tsx`: remover `RegionalFundView`
- `FeedPage.tsx`: remover todos os imports não usados
- `EventCard.tsx`: remover `acceptsConsumption`, `loadingAvailability`

---

## PARTE 3: MIGRATIONS

### 3.1 Renumerar Migrations Duplicadas

```bash
cd backend/migrations

# Backup primeiro
cp 048_user_plan.sql 048_user_plan.sql.bak
cp 057_add_auto_active_status.sql 057_add_auto_active_status.sql.bak
cp 057_unifybank_test_currency.sql 057_unifybank_test_currency.sql.bak

# Renumerar
mv 048_user_plan.sql 074_user_plan.sql
mv 057_add_auto_active_status.sql 075_add_auto_active_status.sql
mv 057_unifybank_test_currency.sql 076_unifybank_test_currency.sql
```

### 3.2 Remover Arquivo Duplicado

```bash
cd backend
rm scripts/validate-database.ts
# Manter apenas src/scripts/validate-database.ts
```

---

## VALIDAÇÃO

Após todas as correções, executar:

```bash
# Backend
cd backend
npx tsc --noEmit
# Esperado: 0 erros

# Frontend
cd frontend
npx tsc --noEmit
# Esperado: 0 erros
```

---

## ORDEM DE EXECUÇÃO RECOMENDADA

1. Instalar `@types/luxon` (ambos)
2. Corrigir tipos centrais (CategoryType, Company interface)
3. Corrigir App.tsx (View + import)
4. Corrigir APIs (context types)
5. Corrigir componentes individuais
6. Remover imports não usados
7. Renumerar migrations
8. Validar compilação

---

*Prompt gerado em 22/12/2025 para Cursor/ChatGPT*
