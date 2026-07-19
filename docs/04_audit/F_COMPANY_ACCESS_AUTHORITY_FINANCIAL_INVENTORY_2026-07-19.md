# INVENTÁRIO FINANCEIRO — DECISION-0189B (Etapa A)

HEAD: `6f9e4d969`. Levantamento first-hand de PermissionKey × rota/caller × leitura/escrita ×
recurso × policy handler × estado sob PORTA 01. Objetivo: nenhuma operação financeira viva conhecida
fica fora da matriz.

## Matriz das chaves monetárias e superfícies

| Chave / superfície | Rota / caller vivo | R/W | Recurso | Handler / gate | Estado sob PORTA 01 (após 0189B) |
|---|---|---|---|---|---|
| `financial:execute_payout` | `payout.routes.ts` (`requirePayoutPermission`) — gate de GET readers + POST exec | gate | payout | `businessAuthorizationService.requirePermission` → `canActAs` | **HOLD** (D3): reads gateados por ela → deny; POST exec já 403 disabled |
| `GET /payouts/orders` | `payout.routes.ts:118` | R | orders | (era `execute_payout`) | **503 `PORTA_01_CLOSED`** (D2), com/sem `actorId`; `listOrders` fora do caminho vivo |
| `GET /payouts/batches`, `/batches/:id`, `/orders/:id` | `payout.routes.ts` | R | batches/orders | `execute_payout` (agora HOLD) | **deny 403** (fail-closed via HOLD) |
| `POST /payouts/batches`, `/orders/:id/execute-manual`, `/orders/:id/fail` | `payout.routes.ts` | W | — | hard 403 `PAYOUT_HTTP_EXECUTION_DISABLED` | contido (403), inalterado |
| `marketplace_execute_payments` | `marketplace-sla.routes.ts:202` (apply-sla-penalties); `pdv.routes.ts:344` (`/orders/:id/pay`) | W (dinheiro) | payment_plan / order | `requirePermission(...)` → `canActAs` | **HOLD** (D3) → 403 |
| `split:create` | (sem caller vivo — só registry) | — | — | registry | **HOLD** (D3) |
| `marketplace_execute_payouts` | (sem caller vivo) | — | — | registry | HOLD (0189A D7) |
| `marketplace_manage_splits` | (sem caller vivo) | — | — | registry | HOLD (0189A D7) |
| `financial:view_all_ledger` | `account.routes.ts` (list/one), `invoice.routes.ts`, `ledger.routes.ts`, `payment-method.routes.ts` | R | ledger/list | `businessAuthorizationService.requirePermission` / `canActAs` | HOLD (0189A D7) → deny |
| `POST /settlements/:id/settle`, `/regions/:id/account/credit`, `/debit` | `settlement.routes.ts` | W | — | hard 403 `SETTLEMENT_/REGION_ACCOUNT_HTTP_EXECUTION_DISABLED` (sink morto) | contido (403), inalterado |
| `economic-overview` (actor) | `economic-overview.routes.ts` | R | actor | `authorizeActorFinancialRead` + `view_financial` terminal + audit + no-store | resource-aware; **endurecido em Etapa C** (503 sanitizado em indisponibilidade) |
| `economic-overview` (grupo) | `economic-overview.routes.ts` | R | grupo | fail-closed `GROUP_FINANCIAL_READ_HELD` | fechado |
| `invoices` | `invoice.routes.ts` | R | party | `hasActorFinancialReadAuthority` por parte + `view_all_ledger` (HOLD) na lista admin | substrato ghost → **porta de ativação fechada por default (Etapa C)** |

## Chaves financeiras NÃO postas em HOLD (justificativa)
- `manage_financial` — gestão financeira terminal (inclui leitura/gestão de config); não é endpoint
  de movimento. Pôr em HOLD bloquearia leitura/gestão legítima. Fora do HOLD.
- `financial_terms:confirm` — confirma termos, não move dinheiro. Fora.
- `receive_funds` — recepção passiva (conta da empresa recebe), não é ação de membro. Fora.
- `view_financial` / `financial:view_ledger` / `split:view` / `financial_terms:view` — leitura
  privada legítima sob grant terminal; preservadas (transparência regional também preservada, fora
  do domínio privado).

## Callers diretos que contornam canActAs/businessAuthorizationService
- Nenhum caller vivo de `payoutService.executeX` / `settlementService.settle` /
  `regionAccountService.credit|debit` a partir de rotas — os sinks estão mortos por contenção 403
  hard. Os únicos service-calls vivos em rotas são READ (`listSettlements`/`getSettlementById`/
  `getAccount`/`listOrders`→removido do caminho vivo em D2). Guard da Etapa B trava reintrodução.

## Conclusão
As chaves de MOVIMENTO/CAPTURA/PAGAMENTO/LIQUIDAÇÃO/SPLIT vivas são exatamente:
`financial:execute_payout`, `marketplace_execute_payments`, `split:create`,
`marketplace_execute_payouts`, `marketplace_manage_splits` (+ leitura consolidada
`financial:view_all_ledger`). Todas sob HOLD terminal após 0189B. Nenhuma operação financeira viva
conhecida fica fora da matriz.
