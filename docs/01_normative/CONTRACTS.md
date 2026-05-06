Status: SUBORDINATED
Domain: Contracts
Governing Contract: CORE_IMUTAVEL.md
Authority Level: 1
Canonical Scope: Cross-Layer Contract Governance

# @unificard/contracts — Arquitetura de Contratos

## 🎯 Princípio Fundamental

**Tipos de domínio que cruzam frontend ↔ backend NUNCA são definidos localmente.**

Eles nascem em `@unificard/contracts` ou **não nascem**.

Este princípio é **canônico, obrigatório e não negociável**.

---

## 📦 O Que Vai no Contracts

### ✅ VAI

- Tipos de domínio compartilhados:
  - `CategoryContext`, `CategoryStatus`
  - `CompanyStatus`, `CompanyUserRole`, `CompanyOperationalStatus`
  - `CheckoutRequest`, `CheckoutResult`, `CheckoutContext`
  - `EventStatus`, `EventType` (quando aplicável)

- Interfaces que representam **contratos formais entre camadas**

Esses tipos:
- são consumidos por frontend e backend
- definem semântica comum
- **não pertencem a nenhuma camada isoladamente**

---

### ❌ NÃO VAI

- Tipos de resposta de API específicos  
  (ex: `CheckoutTicketResponse` com `qrCode`, `ticketId`)

- Tipos de UI  
  (ex: `ButtonProps`, `ModalState`)

- Tipos de implementação interna  
  (ex: `DatabaseConfig`, `CacheStrategy`)

Contracts **não conhece implementação**.  
Contracts **define linguagem comum**.

---

## 🔒 Regras de Ouro

### 1️⃣ Backend e Frontend NUNCA Redefinem Tipos de Domínio

```ts
// ❌ ERRADO
// backend/src/core/categories/types.ts
export type CategoryContext = 'professional' | 'interest';

// ✅ CORRETO
// backend/src/core/categories/service.ts
import { CategoryContext } from '@unificard/contracts';
Redefinir tipo de domínio localmente é violação de contrato.

2️⃣ Se Algo Não Encaixar, o Contrato Ajusta
NÃO o frontend.
NÃO o backend.

Se você precisa de um novo valor em CategoryContext,
ele é adicionado no contrato primeiro.

Depois:

backend se ajusta

frontend se ajusta

TypeScript garante consistência

3️⃣ Compatibilidade Reversa via Re-export (Permitido)
ts
Copiar código
// ✅ ACEITÁVEL (compatibilidade reversa)
import { CategoryContext } from '@unificard/contracts';
export type { CategoryContext };
Isso é ponte, não duplicação.

🏗️ Estrutura Canônica
bash
Copiar código
packages/contracts/
├── src/
│   ├── categories.ts    # CategoryContext, CategoryStatus
│   ├── company.ts       # CompanyStatus, CompanyUserRole, etc.
│   ├── checkout.ts      # CheckoutRequest, CheckoutResult, etc.
│   ├── events.ts        # EventStatus, EventType
│   └── index.ts         # Re-exports centralizados
├── dist/                # Build output
└── package.json
Nada fora dessa estrutura é contrato.

🚀 Workflow de Mudança (Obrigatório)
1️⃣ Mudança no domínio?
Editar: packages/contracts/src/[domain].ts

Build: npm run build:contracts

Commit:

scss
Copiar código
feat(contracts): add X to CategoryContext
2️⃣ Uso em backend / frontend
ts
Copiar código
import { X } from '@unificard/contracts';
Se não compilar → o contrato não existe.

3️⃣ CI valida automaticamente
Type check em contracts

Type check em backend (depende de contracts)

Type check em frontend (depende de contracts)

Verificação de tipos duplicados

Contrato quebrado não passa CI.

✅ Checklist de PR (Obrigatório)
Antes de abrir PR que toca em tipos de domínio:

 Tipo está em @unificard/contracts?

 Backend importa do contrato?

 Frontend importa do contrato?

 npm run typecheck passa?

 CI passa?

Se algum item for “não” → PR inválido.

🐛 Debugging Canônico
“Tipo não encontrado”
bash
Copiar código
npm run build:contracts
cat packages/contracts/src/index.ts
grep -r "from '@unificard/contracts'" src/
“Tipo duplicado”
bash
Copiar código
grep -r "type CategoryContext" src/ --include="*.ts"
O resultado não pode conter definições locais.

📚 Referências Técnicas
TypeScript Handbook — Module Resolution

Monorepo Best Practices

🏛️ Precedência Institucional
Este documento prevalece sobre:

decisões de implementação

conveniências de frontend

conveniências de backend

sugestões de IA

pressões de prazo

Se houver conflito:

➡️ corrige-se o código
➡️ NUNCA o contrato

🧠 Frase Canônica Final
No UnifiCard:

Contrato é linguagem comum.
Linguagem comum não se duplica.

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CORE_IMUTAVEL.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
<!-- AUTO-GENERATED-END -->