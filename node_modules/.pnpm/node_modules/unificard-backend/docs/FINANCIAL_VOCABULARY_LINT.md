# Financial Vocabulary Lint - Anti-Regression Guard

## Objetivo

Impedir, por regra automática, que qualquer código fora do domínio Bank volte a falar, calcular ou decidir dinheiro.

## Autoridade

- `docs/01_normative/07_NOMENCLATURA_CANONICA.md`
- `docs/01_normative/01_SSOT.md`
- `CORE_FINANCIAL_CONTRACT.md`

## Palavras Proibidas

As seguintes palavras são **proibidas** fora de `src/core/bank/**` (case-insensitive):

- `balance`
- `available`
- `saldo`
- `paid`
- `settled`
- `refunded`
- `refund`
- `payout`
- `receivable`
- `payable`
- `ledger`
- `split`
- `transaction`
- `amount`
- `value_cents`
- `total_cents`

## Escopo

- **Verificado**: Todo o codebase em `src/**`
- **Exceção permitida**: `src/core/bank/**`
- **Ignorado**: 
  - `node_modules/`
  - `dist/`
  - `migrations/` (SQL)
  - Arquivos `.d.ts`
  - Arquivos de teste (`.test.ts`, `.spec.ts`) - **opcional, atualmente bloqueado**

## Uso

### Executar validação localmente

```bash
npm run validate:financial-vocabulary
```

### Integração CI

O script é executado automaticamente no CI (GitHub Actions) como parte do pipeline de validação do backend.

## Mensagem de Erro

Quando uma violação é encontrada, o script exibe:

```
❌ FINANCIAL_VOCABULARY_OUTSIDE_BANK_FORBIDDEN

Encontradas N violação(ões) de vocabulário financeiro fora de src/core/bank:

📄 src/path/to/file.ts
   Linha X, coluna Y: "palavra_proibida"
   [linha do código]

❌ BUILD FALHOU: Vocabulário financeiro fora do domínio Bank é proibido.
   Exceção permitida: src/core/bank/**
```

## Correção de Violações

1. **Mover código para `src/core/bank/**`**: Se o código realmente precisa lidar com finanças, ele deve estar no domínio Bank.

2. **Renomear variáveis/propriedades**: Use vocabulário não-financeiro quando possível.

3. **Usar abstrações do Bank**: Em vez de calcular saldos diretamente, use os serviços do Bank.

## Exemplos

### ❌ Violação

```typescript
// src/modules/marketplace/payment.service.ts
async getPaymentBalance(userId: string): Promise<number> {
  // Violação: "balance" fora de src/core/bank/**
  return await this.calculateBalance(userId);
}
```

### ✅ Correção

```typescript
// src/modules/marketplace/payment.service.ts
import { bankAccountService } from '@core/bank/bank-account.service';

async getPaymentBalance(userId: string): Promise<number> {
  // Usar serviço do Bank
  const account = await bankAccountService.getAccountByOwner(tenantId, userId, 'user', 'BRL');
  return account.balance;
}
```

Ou mover para `src/core/bank/`:

```typescript
// src/core/bank/payment-balance.service.ts
async getPaymentBalance(userId: string): Promise<number> {
  // Permitido: está em src/core/bank/**
  return await this.calculateBalance(userId);
}
```

## Notas

- O lint é **bloqueante**: falha o build se encontrar violações.
- Não há allowlist além de `src/core/bank/**`.
- Arquivos de teste também são verificados (pode ser ajustado no futuro).
- Comentários são verificados (documentação deve usar vocabulário não-financeiro quando possível).




