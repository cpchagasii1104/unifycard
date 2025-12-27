# @unificard/contracts

Contratos de domínio compartilhados entre frontend e backend.

## 🎯 Objetivo

Fonte única de verdade para tipos que cruzam camadas. Previne bugs de tipo e garante consistência.

## 📦 Uso

```typescript
import { CategoryContext, CompanyStatus } from '@unificard/contracts';
```

## 🏗️ Build

```bash
npm run build
```

## 📋 Regras

1. **Se um tipo cruza frontend ↔ backend, ele nasce aqui ou não nasce.**
2. Backend e frontend NUNCA redefinem tipos de domínio.
3. PR que criar union duplicado não passa.

## 📁 Estrutura

- `categories.ts` - Tipos de categorias
- `company.ts` - Tipos de empresas
- `checkout.ts` - Tipos de checkout
- `events.ts` - Tipos de eventos
- `index.ts` - Exportações públicas












