# Unificard

Sistema financeiro e social com arquitetura baseada em contratos de domínio.

## 🏗️ Arquitetura

Monorepo com três packages principais:

- **`@unificard/contracts`** - Tipos de domínio compartilhados (fonte única de verdade)
- **`backend`** - API Fastify + PostgreSQL
- **`frontend`** - React + Vite

## 🚀 Início Rápido

```bash
# Instalar dependências
npm install

# Build contracts (sempre primeiro)
npm run build:contracts

# Validar tudo
npm run typecheck

# Desenvolvimento
npm run dev -w unificard-backend
npm run dev -w unificard-frontend
```

## 📦 Scripts Principais

```bash
# Build
npm run build:contracts    # Build contracts
npm run build:backend       # Build backend
npm run build:frontend      # Build frontend
npm run build:all           # Build tudo

# Validação
npm run typecheck           # Type check em tudo
npm run validate:contracts  # Valida apenas contracts
npm run validate:all        # Valida contracts + type check
```

## 🔒 Contratos de Domínio

**Regra absoluta:** Tipos que cruzam frontend ↔ backend NUNCA são definidos localmente.

Eles vão em `@unificard/contracts` ou não vão.

### Exemplo

```ts
// ❌ ERRADO
export type CategoryContext = 'professional' | 'interest';

// ✅ CORRETO
import { CategoryContext } from '@unificard/contracts';
```

Veja [docs/architecture/CONTRACTS.md](./docs/architecture/CONTRACTS.md) para detalhes completos.

## 🧪 CI/CD

O CI valida automaticamente:

- ✅ Build de contracts
- ✅ Type check (contracts, backend, frontend)
- ✅ Ausência de tipos de domínio duplicados
- ✅ Lint (quando aplicável)

## 📚 Documentação

- [Arquitetura de Contratos](./docs/architecture/CONTRACTS.md)
- [Guia de Contribuição](./CONTRIBUTING.md)

## 🛠️ Tecnologias

- **Backend:** Fastify, PostgreSQL, TypeScript
- **Frontend:** React, Vite, TypeScript
- **Contratos:** TypeScript (monorepo workspace)

## 📝 Licença

AGPL-3.0

---

**Última atualização:** FASE 3A (2024)
























