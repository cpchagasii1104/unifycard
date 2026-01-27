# 🔧 CORREÇÕES NECESSÁRIAS - UNIFICARD
## Guia Prático de Implementação | 23/12/2025

---

## 🔴 CORREÇÃO 1: Migrações Duplicadas

### Problema
Existem 2 pares de migrações com mesmo número:
- `048_expand_pricing_type.sql` + `048_user_plan.sql`
- `057_add_auto_active_status.sql` + `057_unifybank_test_currency.sql`

### Solução

```powershell
# No diretório backend/migrations/

# Opção A: Renumerar para sequência correta
Rename-Item "048_user_plan.sql" "077_user_plan.sql"
Rename-Item "057_unifybank_test_currency.sql" "078_unifybank_test_currency.sql"

# OU Opção B: Usar sufixo (menos recomendado)
Rename-Item "048_user_plan.sql" "048b_user_plan.sql"
Rename-Item "057_unifybank_test_currency.sql" "057b_unifybank_test_currency.sql"
```

### Verificação
```powershell
# Listar migrações ordenadas
Get-ChildItem migrations/*.sql | Sort-Object Name | Select-Object Name
```

---

## 🔴 CORREÇÃO 2: Wallet.tsx - Propriedade 'governance' faltando

### Arquivo
`frontend/src/components/Wallet.tsx` (linha 74)

### Erro
```
error TS2741: Property 'governance' is missing in type...
```

### Correção
```typescript
// ANTES (linha ~74)
const categoryLabels = {
  p2p: 'P2P',
  donation: 'Doação',
  split: 'Split',
  compensation: 'Compensação',
  other: 'Outro',
};

// DEPOIS
const categoryLabels: Record<'split' | 'other' | 'p2p' | 'donation' | 'compensation' | 'governance', string> = {
  p2p: 'P2P',
  donation: 'Doação',
  split: 'Split',
  compensation: 'Compensação',
  governance: 'Governança',  // ← ADICIONAR
  other: 'Outro',
};
```

---

## 🔴 CORREÇÃO 3: EventPage.tsx - Identificador duplicado

### Arquivo
`frontend/src/components/events/EventPage.tsx` (linhas 5, 8)

### Erro
```
error TS2300: Duplicate identifier 'AvailabilityPreview'
```

### Correção
```typescript
// ANTES
import { AvailabilityPreview } from './AvailabilityPreview';
// ...
import type { AvailabilityPreview } from './types';

// DEPOIS
import { AvailabilityPreview } from './AvailabilityPreview';
// ...
import type { AvailabilityPreview as AvailabilityPreviewType } from './types';

// E atualizar uso do tipo:
// De: const data: AvailabilityPreview = ...
// Para: const data: AvailabilityPreviewType = ...
```

---

## 🔴 CORREÇÃO 4: EventPage.tsx - Campo 'actor' faltando

### Arquivo
`frontend/src/components/events/EventPage.tsx` (linha 66)

### Erro
```
error TS2322: Property 'actor' is missing in type...
```

### Correção
```typescript
// ANTES (provavelmente)
const posts = data.map(item => ({
  post_id: item.id,
  content: item.content,
  // ... outros campos
}));

// DEPOIS
const posts: PostCardData[] = data.map(item => ({
  post_id: item.id,
  content: item.content,
  // ... outros campos
  actor: {
    id: item.global_user_id,
    name: item.user_name || 'Usuário',
    avatar: item.user_avatar || undefined,
  },  // ← ADICIONAR
}));
```

---

## 🟡 CORREÇÃO 5: Instalar @types/luxon

### Comando
```bash
cd frontend
npm install --save-dev @types/luxon
```

---

## 🟡 CORREÇÃO 6: EventPage.tsx - Valores possivelmente undefined

### Arquivo
`frontend/src/components/events/EventPage.tsx` (linha 141)

### Erro
```
error TS18048: 'event.currentOccupancy' is possibly 'undefined'
error TS18047: 'event' is possibly 'null'
```

### Correção
```typescript
// ANTES
const occupancyPercent = (event.currentOccupancy / event.capacity) * 100;

// DEPOIS
const occupancyPercent = event && event.currentOccupancy && event.capacity
  ? (event.currentOccupancy / event.capacity) * 100
  : 0;

// OU com optional chaining
const occupancyPercent = ((event?.currentOccupancy ?? 0) / (event?.capacity ?? 1)) * 100;
```

---

## 🟢 CORREÇÃO 7: Limpar imports não usados (17 arquivos)

### Lista de arquivos
```
src/api/feed.ts                    → remover: FeedItem
src/components/CompaniesManager.tsx → remover: validateCNPJ, cleanNumber, hasProtocol
src/components/CompanyValidationBackoffice.tsx → remover: Company
src/components/ContextualSuggestion.tsx → remover: dismissedIds
src/components/MatchSuggestion.tsx  → remover: formatUsers
src/components/Profile.tsx          → remover: validateCEP
src/components/ProfileLearning.tsx  → remover: LearningProfile, addDetail, removeDetail
src/components/events/EventCard.tsx → remover: acceptsConsumption, loadingAvailability
src/components/events/OrganizerPlans.tsx → remover: getOrganizerPlan
src/components/mfibank/MFIBankSummary.tsx → remover: RegionalFundView
src/pages/FeedPage.tsx              → remover: imports não usados
```

### Comando automático (ESLint)
```bash
cd frontend
npx eslint --fix "src/**/*.{ts,tsx}"
```

---

## ✅ VERIFICAÇÃO FINAL

### Após aplicar correções:
```bash
# Backend
cd backend
npx tsc --noEmit

# Frontend  
cd frontend
npx tsc --noEmit
```

### Resultado esperado:
```
# Backend: 0 erros (ou apenas erros de tipos externos)
# Frontend: 0 erros
```

---

## 📋 CHECKLIST

- [ ] Renumerar migrations 048 e 057
- [ ] Corrigir Wallet.tsx (governance)
- [ ] Corrigir EventPage.tsx (AvailabilityPreview tipo)
- [ ] Corrigir EventPage.tsx (actor)
- [ ] Instalar @types/luxon
- [ ] Corrigir EventPage.tsx (undefined check)
- [ ] Limpar imports não usados
- [ ] Rodar `npx tsc --noEmit` em ambos projetos
- [ ] Testar fluxo de checkout
- [ ] Testar fluxo de eventos

---

*Guia de correções gerado por Claude em 23/12/2025*
