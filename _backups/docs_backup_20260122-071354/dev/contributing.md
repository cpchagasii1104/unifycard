# Contribuindo para o Unificard

## 🚀 Início Rápido

```bash
# Instalar dependências
npm install

# Build contracts (sempre primeiro)
npm run build:contracts

# Validar tudo
npm run typecheck
```

---

## 📦 Estrutura do Monorepo

```
unificard/
├── packages/contracts/    # Tipos de domínio compartilhados
├── backend/              # Backend (Fastify + PostgreSQL)
├── frontend/             # Frontend (React + Vite)
└── docs/                 # Documentação
```

---

## 🔒 Regra Absoluta: Contratos de Domínio

**Tipos que cruzam frontend ↔ backend NUNCA são definidos localmente.**

Eles vão em `@unificard/contracts` ou não vão.

### Exemplos

```ts
// ❌ ERRADO
// backend/src/core/categories/types.ts
export type CategoryContext = 'professional' | 'interest';

// ✅ CORRETO
// packages/contracts/src/categories.ts
export type CategoryContext = 'professional' | 'interest';

// backend/src/core/categories/service.ts
import { CategoryContext } from '@unificard/contracts';
```

Veja [docs/architecture/CONTRACTS.md](./docs/architecture/CONTRACTS.md) para detalhes.

---

## 🧪 Validação Local

Antes de commitar:

```bash
# 1. Build contracts
npm run build:contracts

# 2. Type check tudo
npm run typecheck

# 3. Build completo (opcional, mais lento)
npm run build:all
```

---

## 📝 Commits

Use mensagens claras:

```
feat(contracts): add CompanyOperationalStatus
fix(backend): use CompanyStatus from contracts
refactor(frontend): migrate to CheckoutResult from contracts
```

---

## 🚫 O Que NÃO Fazer

1. **NÃO** definir tipos de domínio localmente
2. **NÃO** fazer bypass do CI
3. **NÃO** commitar sem `npm run typecheck` passar

---

## ✅ Checklist de PR

- [ ] Código segue padrões
- [ ] `npm run typecheck` passa
- [ ] Tipos de domínio estão em `@unificard/contracts`
- [ ] CI passa
- [ ] Documentação atualizada (se necessário)

---

**Dúvidas?** Veja [docs/architecture/CONTRACTS.md](./docs/architecture/CONTRACTS.md)


















