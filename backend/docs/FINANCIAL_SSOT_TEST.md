# Financial SSOT Architectural Test - Anti-Regression Guard

## Objetivo

Garantir por teste automático que nenhum módulo fora do Bank:
- cria saldo
- cria ledger
- cria transação
- cria split
- mantém estado financeiro próprio

## Autoridade

- `docs/01_normative/01_SSOT.md`
- `docs/01_normative/07_NOMENCLATURA_CANONICA.md`
- `CORE_FINANCIAL_CONTRACT.md`
- `AUDIT_SQL_FINANCIAL_SEMANTIC.md`

## Regras Arquiteturais (Obrigatórias)

### 1. PROIBIÇÃO DE ESTRUTURA

Fora de `src/core/bank/**` é **PROIBIDO** existir:

- **Classes ou arquivos** com nomes contendo:
  - `Ledger`
  - `Transaction`
  - `Split`
  - `Balance`
  - `Account` (quando financeiro - verificado por contexto)

- **Repositories** que escrevem dinheiro

### 2. PROIBIÇÃO DE DEPENDÊNCIA

Nenhum módulo fora do Bank pode:

- **Persistir valores monetários** (INSERT/UPDATE em tabelas financeiras)
- **Ter repository financeiro próprio**
- **Agregar valores financeiros**

### 3. TESTE BLOQUEANTE

Se qualquer regra acima for violada:
- **Falhar build**
- Erro deve conter: `FINANCIAL_SSOT_PARALLEL_STRUCTURE_FORBIDDEN`

## Escopo

- **Verificado**: Todo o codebase em `src/**`
- **Exceção permitida**: 
  - `src/core/bank/**` (domínio Bank)
  - `src/modules/bank/**` (implementação do Bank)
- **Ignorado**: 
  - `node_modules/`
  - `dist/`
  - `migrations/` (SQL)
  - Arquivos `.d.ts`
  - Arquivos de teste (`.test.ts`, `.spec.ts`)

## Uso

### Executar teste localmente

```bash
npm run validate:financial-ssot
```

### Integração CI

O teste é executado automaticamente no CI (GitHub Actions) como parte do pipeline de validação do backend.

## Tipos de Violações Detectadas

### 1. PROHIBITED_STRUCTURE_NAME

Arquivo com nome que contém padrão financeiro proibido.

**Exemplo:**
```
❌ src/modules/marketplace/payment-transaction.repository.ts
   - Arquivo: payment-transaction.repository.ts
   - Padrão: transaction
```

**Correção:** Mover para `src/core/bank/` ou renomear para não usar vocabulário financeiro.

### 2. PROHIBITED_CLASS_NAME

Classe/Interface/Type com nome que contém padrão financeiro proibido.

**Exemplo:**
```typescript
❌ src/modules/marketplace/payment.service.ts
   class PaymentTransactionService {
     // Violação: classe com nome "Transaction"
   }
```

**Correção:** Usar serviços do Bank ou renomear para não usar vocabulário financeiro.

### 3. FINANCIAL_REPOSITORY

Repository financeiro detectado fora do Bank.

**Exemplo:**
```
❌ src/modules/marketplace/ledger.repository.ts
   - Repository financeiro detectado
```

**Correção:** Mover para `src/core/bank/` ou usar repositories do Bank.

### 4. FINANCIAL_PERSISTENCE

Persistência financeira (INSERT/UPDATE) detectada fora do Bank.

**Exemplo:**
```typescript
❌ src/modules/marketplace/payment.service.ts
   await db.query(`
     INSERT INTO payment_transactions (amount_cents, ...)
     VALUES ($1, ...)
   `);
```

**Correção:** Usar serviços do Bank para persistir dados financeiros.

## Mensagem de Erro

Quando uma violação é encontrada, o teste exibe:

```
❌ FINANCIAL_SSOT_PARALLEL_STRUCTURE_FORBIDDEN

Encontradas N violação(ões) de SSOT financeiro fora de src/core/bank:

📋 PROHIBITED_STRUCTURE_NAME (X violação(ões)):
   📄 src/path/to/file.ts
      - Arquivo: payment-transaction.repository.ts
      - Padrão: transaction

❌ BUILD FALHOU: Estruturas financeiras paralelas fora do domínio Bank são proibidas.
   Exceção permitida: src/core/bank/**
```

## Exemplos de Correção

### ❌ Violação: Repository Financeiro

```typescript
// src/modules/marketplace/payment-transaction.repository.ts
class PaymentTransactionRepository {
  async createTransaction(...) {
    // Violação: repository financeiro fora do Bank
  }
}
```

### ✅ Correção: Usar Bank

```typescript
// src/modules/marketplace/payment.service.ts
import { bankTransactionService } from '@modules/bank/bank-transaction.service';

class PaymentService {
  async processPayment(...) {
    // Usar serviço do Bank
    const transaction = await bankTransactionService.createTransaction(...);
  }
}
```

### ❌ Violação: Classe com Nome Financeiro

```typescript
// src/modules/marketplace/ledger.service.ts
class LedgerService {
  // Violação: classe com nome "Ledger" fora do Bank
}
```

### ✅ Correção: Mover para Bank

```typescript
// src/core/bank/ledger.service.ts
class LedgerService {
  // Permitido: está em src/core/bank/**
}
```

## Notas

- O teste é **bloqueante**: falha o build se encontrar violações.
- Não há allowlist além de `src/core/bank/**` e `src/modules/bank/**`.
- Arquivos de teste são ignorados.
- O teste verifica tanto estrutura (nomes) quanto comportamento (persistência).

## Relação com Outros Testes

Este teste complementa:

- **`validate:financial-vocabulary`**: Verifica vocabulário financeiro no código
- **`validate:financial-ssot`**: Verifica estruturas financeiras paralelas

Ambos trabalham juntos para prevenir regressão arquitetural financeira.




