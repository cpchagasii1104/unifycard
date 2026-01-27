# @unificard/contracts - Arquitetura de Contratos

## 🎯 Princípio Fundamental

**Tipos de domínio que cruzam frontend ↔ backend NUNCA são definidos localmente.**

Eles nascem em `@unificard/contracts` ou não nascem.

---

## 📦 O Que Vai no Contracts

### ✅ VAI

- Tipos de domínio compartilhados:
  - `CategoryContext`, `CategoryStatus`
  - `CompanyStatus`, `CompanyUserRole`, `CompanyOperationalStatus`
  - `CheckoutRequest`, `CheckoutResult`, `CheckoutContext`
  - `EventStatus`, `EventType` (se aplicável)

- Interfaces que representam contratos formais entre camadas

### ❌ NÃO VAI

- Tipos de resposta de API específicos (ex: `CheckoutTicketResponse` com `qrCode`, `ticketId`)
- Tipos de UI (ex: `ButtonProps`, `ModalState`)
- Tipos de implementação interna (ex: `DatabaseConfig`, `CacheStrategy`)

---

## 🔒 Regras de Ouro

### 1. Backend e Frontend NUNCA Redefinem Tipos de Domínio

```ts
// ❌ ERRADO
// backend/src/core/categories/types.ts
export type CategoryContext = 'professional' | 'interest';

// ✅ CORRETO
// backend/src/core/categories/service.ts
import { CategoryContext } from '@unificard/contracts';
```

### 2. Se Algo Não Encaixar, o Contrato Ajusta

> **NÃO o frontend, NÃO o backend.**

Se você precisa de um novo valor em `CategoryContext`, ele é adicionado no contrato primeiro.

### 3. Compatibilidade Reversa via Re-export

Se um módulo precisa exportar um tipo do contrato para compatibilidade:

```ts
// ✅ ACEITÁVEL (compatibilidade reversa)
import { CategoryContext } from '@unificard/contracts';
export type { CategoryContext };
```

---

## 🏗️ Estrutura

```
packages/contracts/
├── src/
│   ├── categories.ts    # CategoryContext, CategoryStatus
│   ├── company.ts       # CompanyStatus, CompanyUserRole, etc.
│   ├── checkout.ts      # CheckoutRequest, CheckoutResult, etc.
│   ├── events.ts        # EventStatus, EventType
│   └── index.ts         # Re-exports centralizados
├── dist/                # Build output
└── package.json
```

---

## 🚀 Workflow de Mudança

1. **Mudança no domínio?**
   - Edite `packages/contracts/src/[domain].ts`
   - Build: `npm run build:contracts`
   - Commit: `feat(contracts): add X to CategoryContext`

2. **Usar no backend/frontend?**
   - Import: `import { X } from '@unificard/contracts'`
   - TypeScript vai avisar se não existe

3. **CI valida automaticamente**
   - Type check em contracts
   - Type check em backend (depende de contracts)
   - Type check em frontend (depende de contracts)
   - Verificação de tipos duplicados

---

## ✅ Checklist de PR

Antes de abrir PR que toca em tipos de domínio:

- [ ] Tipo está em `@unificard/contracts`?
- [ ] Backend importa do contrato?
- [ ] Frontend importa do contrato?
- [ ] `npm run typecheck` passa?
- [ ] CI passa?

---

## 🐛 Debugging

### "Tipo não encontrado"

```bash
# 1. Build contracts
npm run build:contracts

# 2. Verifique se o tipo está exportado
cat packages/contracts/src/index.ts

# 3. Verifique se está importando corretamente
grep -r "from '@unificard/contracts'" src/
```

### "Tipo duplicado"

```bash
# Verifique se não há definição local
grep -r "type CategoryContext" src/ --include="*.ts"
# Deve retornar apenas imports, não definições
```

---

## 📚 Referências

- [TypeScript Handbook - Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [Monorepo Best Practices](https://monorepo.tools/)

---

**Última atualização:** FASE 2 (2024)
**Mantenedor:** Time Unificard


























