# PR Checklist Financeiro — Guia de Referência

## Objetivo

Este checklist garante que Pull Requests que tocam em código financeiro respeitem o SSOT (Single Source of Truth) financeiro definido no Unificard.

## Quando Usar

Este checklist é **obrigatório** para PRs que:

- Tocam em código do backend
- Tocam em domínio Bank (`src/core/bank/**`, `src/modules/bank/**`)
- Tocam em migrations SQL
- Tocam em contratos canônicos financeiros
- Adicionam ou modificam funcionalidades financeiras

## Checklist Completo

### 1. Este PR NÃO cria saldo fora do Bank

**O que verificar:**
- Nenhum cálculo de saldo em módulos fora de `src/core/bank/**`
- Nenhuma persistência de saldo em repositories fora do Bank
- Nenhuma variável `balance` calculada fora do Bank

**Exemplo de violação:**
```typescript
// ❌ src/modules/marketplace/payment.service.ts
async getBalance(userId: string): Promise<number> {
  // Violação: cálculo de saldo fora do Bank
  return await this.calculateBalance(userId);
}
```

**Correção:**
```typescript
// ✅ src/modules/marketplace/payment.service.ts
import { bankAccountService } from '@modules/bank/bank-account.service';

async getBalance(userId: string): Promise<number> {
  // Usar serviço do Bank
  const account = await bankAccountService.getAccountByOwner(tenantId, userId, 'user', 'BRL');
  return account.balance;
}
```

### 2. Este PR NÃO calcula dinheiro fora do Bank

**O que verificar:**
- Nenhum cálculo de valores monetários em módulos fora do Bank
- Nenhuma agregação financeira fora do Bank
- Nenhuma soma/subtração de valores monetários fora do Bank

**Exemplo de violação:**
```typescript
// ❌ src/modules/marketplace/payment.service.ts
async calculateTotal(transactions: Transaction[]): Promise<number> {
  // Violação: agregação financeira fora do Bank
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}
```

**Correção:** Usar serviços do Bank para cálculos financeiros.

### 3. Este PR NÃO cria ledger fora do Bank

**O que verificar:**
- Nenhum arquivo/classe com nome contendo "ledger" fora de `src/core/bank/**`
- Nenhum repository de ledger fora do Bank
- Nenhuma tabela `ledger` criada fora do Bank

**Exemplo de violação:**
```typescript
// ❌ src/modules/marketplace/payment-ledger.repository.ts
class PaymentLedgerRepository {
  // Violação: repository de ledger fora do Bank
}
```

**Correção:** Mover para `src/core/bank/` ou usar ledger do Bank.

### 4. Este PR NÃO cria transaction fora do Bank

**O que verificar:**
- Nenhum arquivo/classe com nome contendo "transaction" fora de `src/core/bank/**`
- Nenhum repository de transaction fora do Bank
- Nenhuma tabela `transaction` criada fora do Bank

**Exemplo de violação:**
```typescript
// ❌ src/modules/marketplace/payment-transaction.repository.ts
class PaymentTransactionRepository {
  // Violação: repository de transaction fora do Bank
}
```

**Correção:** Mover para `src/core/bank/` ou usar transaction do Bank.

### 5. Este PR NÃO cria split fora do Bank

**O que verificar:**
- Nenhum arquivo/classe com nome contendo "split" fora de `src/core/bank/**`
- Nenhum cálculo de split fora do Bank
- Nenhuma tabela `split` criada fora do Bank

**Exemplo de violação:**
```typescript
// ❌ src/modules/marketplace/payment-split.service.ts
class PaymentSplitService {
  // Violação: serviço de split fora do Bank
}
```

**Correção:** Mover para `src/core/bank/` ou usar split do Bank.

### 6. Este PR NÃO adiciona vocabulário financeiro fora do Bank

**O que verificar:**
- Nenhuma variável/propriedade com nomes financeiros proibidos:
  - `balance`, `available`, `saldo`
  - `paid`, `settled`, `refunded`, `refund`, `payout`
  - `receivable`, `payable`
  - `ledger`, `split`, `transaction`
  - `amount`, `value_cents`, `total_cents`

**Verificação automática:**
```bash
npm run validate:financial-vocabulary
```

**Exemplo de violação:**
```typescript
// ❌ src/modules/marketplace/payment.service.ts
interface PaymentData {
  amount: number;        // Violação: "amount"
  balance: number;       // Violação: "balance"
  total_cents: number;   // Violação: "total_cents"
}
```

**Correção:** Renomear ou usar tipos do Bank.

### 7. Este PR respeita o SSOT financeiro definido em docs/01_normative/

**O que verificar:**
- Todas as operações financeiras passam exclusivamente pelo Bank
- Nenhuma estrutura financeira paralela criada
- Nenhum repository financeiro próprio criado

**Verificação automática:**
```bash
npm run validate:financial-ssot
```

**Referências obrigatórias:**
- [`docs/01_normative/01_SSOT.md`](../../01_normative/01_SSOT.md)
- [`docs/01_normative/07_NOMENCLATURA_CANONICA.md`](../../01_normative/07_NOMENCLATURA_CANONICA.md)
- [`CORE_FINANCIAL_CONTRACT.md`](../../CORE_FINANCIAL_CONTRACT.md)

### 8. Se toca em dinheiro, passa EXCLUSIVAMENTE pelo Bank

**O que verificar:**
- Qualquer operação financeira usa `@core/bank/**` ou `@modules/bank/**`
- Nenhum código financeiro fora do domínio Bank
- Nenhuma persistência financeira direta (INSERT/UPDATE) fora do Bank

**Exemplo de violação:**
```typescript
// ❌ src/modules/marketplace/payment.service.ts
async processPayment(amount: number) {
  // Violação: persistência financeira direta
  await db.query(`
    INSERT INTO payment_transactions (amount_cents, ...)
    VALUES ($1, ...)
  `);
}
```

**Correção:**
```typescript
// ✅ src/modules/marketplace/payment.service.ts
import { bankTransactionService } from '@modules/bank/bank-transaction.service';

async processPayment(amount: number) {
  // Usar serviço do Bank
  const transaction = await bankTransactionService.createTransaction(...);
}
```

## Verificações Automáticas

O CI executa automaticamente:

1. **`validate:financial-vocabulary`**
   - Detecta vocabulário financeiro proibido
   - Falha se encontrar palavras financeiras fora do Bank

2. **`validate:financial-ssot`**
   - Detecta estruturas financeiras paralelas
   - Falha se encontrar classes/repositories financeiros fora do Bank

**Se qualquer verificação falhar, o PR será bloqueado.**

## Gate Bloqueante

- ✅ Checklist é **obrigatório** para merge
- ✅ PR **não pode** ser aprovado se algum item estiver desmarcado
- ✅ GitHub Actions verifica automaticamente o checklist
- ✅ Branch protection pode bloquear merge se checklist incompleto

## Consequências de Violação

Se um PR violar o SSOT financeiro:

1. **CI falha** — Build bloqueado
2. **Checklist incompleto** — Merge bloqueado
3. **Comentário automático** — GitHub Actions alerta sobre checklist incompleto
4. **Review obrigatório** — CODEOWNER deve revisar e aprovar

## Referências

- [Financial Vocabulary Lint](../../../backend/docs/FINANCIAL_VOCABULARY_LINT.md)
- [Financial SSOT Test](../../../backend/docs/FINANCIAL_SSOT_TEST.md)
- [SSOT Documentation](../../01_normative/01_SSOT.md)
- [Nomenclatura Canônica](../../01_normative/07_NOMENCLATURA_CANONICA.md)




