# Pontos obrigatórios — `requireFinancialRiskClearance` (Prompt 53.1)

Todo fluxo que **move dinheiro a partir de conta de actor** ou **inicia pagamento / payout / reversal request** deve passar pelo **único gate**:

`requireFinancialRiskClearance(tenantId, { actorId, action, amountCents? })`

**Arquivo canônico:** `backend/src/modules/risk-identity/risk-financial-gate.ts`

| Fluxo | Arquivo | Ação | Notas |
|-------|---------|------|--------|
| Transferência interna (débito actor/company) | `bank-transaction.service.ts` | `financial_transfer` | Ignora `system` / `escrow` |
| P2P | `bank-p2p-transfer.service.ts` | `financial_transfer` | |
| Pagamento marketplace | `payment-execution.service.ts` | `financial_payment` | Comprador |
| Batch payout (criação de order) | `payout.service.ts` | `financial_payout` | Por actor; blocked pula order |
| Execução payout manual | `payout.service.ts` | `financial_payout` | Beneficiário |
| Reversal request | `reversal.service.ts` | `financial_reversal_request` | `requestReversal` + sync path |
| Treasury → escrow (governança) | — | — | Débito **system**; sem gate no actor |

**Score:** `evaluateActorRisk` no gate + worker `risk-identity-reconcile.worker.ts`.

**Limites:** tabela `risk_financial_limits_by_level` (migration 0057).

**Contas:** `bank_accounts` actor exige `actor_id` (0057 backfill + `VALIDATE`).
