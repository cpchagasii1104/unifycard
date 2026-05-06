# Execução — Prompt 50 — Treasury Isolation & Execution Boundaries

**Data:** 2026-03-17  
**Modo:** EXECUTOR  
**Status:** SUCESSO

## Objetivo

Garantir isolamento total da tesouraria (treasury), impedindo interferência entre fluxos financeiros distintos e estabelecendo limites explícitos de execução para proteger integridade financeira.

## Regras absolutas respeitadas

- NÃO alterada estrutura de bank_ledger
- NÃO criada nova fonte de saldo
- NÃO alterado fluxo PaymentIntent
- NÃO permitido acesso direto ao bank fora dos serviços oficiais
- Toda movimentação continua via bankTransactionService

## Escopo

- treasury_accounts
- treasury_distributions
- governance funding
- payout
- settlement
- split engine

## Implementação

### 1. Isolamento de contas de tesouraria

- Contas com `owner_type = 'system'` (treasury) não podem ser usadas por fluxos não autorizados.
- Validação no `bankTransactionService.transfer`: se `source_account.owner_type === 'system'`, exige tag de origem válida (`treasurySource`).

### 2. Execution boundaries

**Permitido:**

- treasury_distribution
- governance_funding_execution
- settlement_internal_operations

**Proibido:**

- payout direto da treasury sem tag (ou com tag inválida)
- transferências arbitrárias sem tag
- qualquer operação fora do pipeline autorizado

### 3. Tag de origem obrigatória

Toda operação financeira envolvendo treasury inclui:

- `treasurySource`: `'treasury:distribution'` | `'treasury:governance'` | `'treasury:settlement'` | `'treasury:simulation'` (só não-produção; simulador financeiro)

Se conta de origem for system e `treasurySource` não definido ou inválido → ABORTAR com `TREASURY_ACCESS_VIOLATION`.

### 4. Validação de destino

- Para `treasury:distribution` e `treasury:governance`: destino deve ser conta system (escrow ou system-controlled).
- Bloqueio: envio direto treasury → conta de usuário com distribution/governance.
- `treasury:settlement`: permitido para fluxos de settlement (incl. destinos controlados pelo pipeline).

### 5. Proteção contra bypass

- Nenhum módulo chama bankLedger diretamente para criar transações; uso apenas via bankTransactionService.
- Se tentativa de usar treasury fora dos fluxos permitidos → lançar `TREASURY_ACCESS_VIOLATION`.

### 6. Log e auditoria

- Toda operação envolvendo treasury é registrada via `logTreasuryOperation` (observabilidade):
  - tenant_id, source, destination, amount_cents, operation_type, timestamp.

### 7. Callers atualizados com `treasurySource`

| Módulo | Fluxo | treasurySource |
|--------|--------|----------------|
| governance-funding-commitment-worker | treasury → escrow | treasury:governance |
| payment-event-resolver | settle / release / PIX | treasury:settlement |
| payout-worker | seller_available → seller_payout | treasury:settlement |
| bank-settlement-worker | payout / settlement | treasury:settlement |
| treasury-split.service | regional_fund, community_fund, system_reserve, governance_pool | treasury:distribution |
| payment-execution.service | escrow→clearing, clearing→seller_pending, dispute release, payout request, bank payout | treasury:settlement |
| payout.service | platform (fee) → recipient | treasury:settlement |
| financial-simulator.controller | systemReserve → buyerWallet | `treasury:simulation` (rota 403 em produção; transfer com essa tag também bloqueada em produção) |
| Testes chaos (security, ledger-integrity, idempotency, reconciliation, real-payment-flow, race-conditions) | seed system → user/escrow | treasury:settlement |

### 8. Testes

- `tests/financial-chaos/treasury-isolation.spec.ts`:
  1. Transferência a partir de conta system sem `treasurySource` → bloqueada (`TREASURY_ACCESS_VIOLATION`).
  2. `treasury:distribution` para conta de usuário → bloqueada.
  3. `treasury:governance` para conta de usuário → bloqueada.
  4. `treasury:governance` system → system → permitido.
  5. `treasury:settlement` system → user → permitido.

## Resultado

- Treasury completamente isolada por tag de origem.
- Nenhum acesso indevido possível sem tag válida.
- Fluxos financeiros com fronteiras explícitas (distribution, governance, settlement).
- Sistema protegido contra uso incorreto interno.
