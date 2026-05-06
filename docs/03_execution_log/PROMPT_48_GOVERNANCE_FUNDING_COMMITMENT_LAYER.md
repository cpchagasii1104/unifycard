# Execução — Prompt 48 — Governance Funding Commitment Layer

**Data:** 2026-03-17  
**Modo:** EXECUTOR  
**Status:** SUCESSO

## Objetivo

Introduzir a camada de commitment (intenção auditável) entre Governance → Commitment → Execution (Bank), garantindo:
- Nenhum saldo fora do ledger
- Nenhum ledger paralelo
- Nenhuma execução sem verificação real no bank

## Artefatos criados/alterados

| Artefato | Ação |
|----------|------|
| `backend/migrations/0048_governance_funding_commitments.sql` | Criado — tabela governance_funding_commitments (id, tenant_id, proposal_id, treasury_account_id, amount_cents, currency, project_reference, status, created_at, processed_at), UNIQUE(proposal_id), índices pending e tenant_status |
| `backend/src/modules/governance-funding-commitment/governance-funding-commitment.repository.ts` | Criado — createCommitment, getByProposalId, listPendingCommitments, markProcessing, markExecuted, markFailed |
| `backend/src/workers/governance-execution-worker.ts` | Alterado — createFundingRequest substituído por createCommitment (payload: treasury_account_id, amount_cents, currency, project_reference) |
| `backend/src/workers/governance-funding-commitment-worker.ts` | Criado — intervalo 30s; fluxo: list pending → markProcessing → validar saldo (bankLedgerRepository.calculateBalance) → se insuficiente markFailed → senão transfer(treasury→escrow) → createPaymentIntent → markExecuted |
| `backend/BOOT.ts` | Alterado — registro de startGovernanceFundingCommitmentWorker() e log “[BOOT] Governance Funding Commitment Worker iniciado” |
| `backend/tests/unit/governance-funding-commitment.test.ts` | Criado — criação, idempotência por proposal_id, markProcessing/Executed/Failed, listPendingCommitments |

## Regras garantidas

- Commitment NÃO move dinheiro; NÃO representa saldo.
- Execução SEMPRE valida saldo real via `bankLedgerRepository.calculateBalance(tenantId, treasuryBankAccountId)` antes de qualquer ação.
- Movimento financeiro via `bankTransactionService.transfer` (treasury_account → escrow_account).
- PaymentIntent criado somente após execução financeira real.
- Idempotência por proposal_id (UNIQUE + ON CONFLICT DO NOTHING).
- Nenhuma escrita direta em bank_ledger (apenas via transfer).

## Build

- `pnpm build` no backend: concluído com sucesso.
