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

---

# RATCHET 0189C — INVENTÁRIO CORRIGIDO (writers financeiros + projeções)

HEAD `b05a1bd49`. Correção do overclaim: `financial_terms:confirm` CRIA splits; reporting/risk
projetam agregados; publication-engine é writer-irmão de reactions; o runner 197 NÃO incluía
`red-gates-baseline` (financial-ssot 592>591 por script infrator em backend/src).

## Matriz: writers de escrita financeira

| Caller | Rota/job | Chave | Tabela escrita | Recurso | HOLD | Resposta sob PORTA 01 (após 0189C) |
|---|---|---|---|---|---|---|
| `bank-transaction.service` | núcleo Bank | — | bank_splits/bank_transactions/bank_ledger | — | núcleo | pipeline canônico (fora do escopo do HOLD de membros) |
| `confirmFinancialTerms` (`service-order.service:1884/1903`) | services (financial_terms:confirm) | `financial_terms:confirm` | bank_splits | service order | **HOLD (D1)+barreira service (D2)** | `PORTA_01_CLOSED`; 0 split; sem parcial |
| `payment-split.service:87` (`paymentSplitRepository.createSplit`) | marketplace | — | payment_splits (GHOST/to_regclass NULL) | — | Proxy MORTO ('migrated to Bank') | rejeita — contido, sem caller de rota vivo |
| `settlement.routes` settle/credit/debit | marketplace | — | — | — | 403 hard (sink morto) | inalterado |
| `payout.routes` batches/exec/fail | payout | financial:execute_payout (HOLD) | — | — | HOLD + 403/503 | GET /payouts/orders 503 PORTA_01_CLOSED |

## Matriz: writers da tabela `reactions`

| Caller | Rota | Governança | Estado (após 0189C) |
|---|---|---|---|
| `social-2.0.routes` toggleReaction/createComment | POST /social/posts/:id/reactions|comments | `canActAs('interact_feed')` + post server-side | CANÔNICO (mantido) |
| `publication-engine.routes` upsertReaction/removeReaction | POST\|DELETE /publication/:entityType/:entityId/reactions | POLIMÓRFICA sem autoridade | **410 GENERIC_REACTIONS_NOT_GOVERNED (D4)** antes de qualquer efeito |

## Matriz: projeções financeiras (readers de agregados)

| Reader | Chama | Projeta | Estado (após 0189C) |
|---|---|---|---|
| `reporting.service` | `payoutService.listOrders` + `invoiceService.listInvoices` | valor pago, invoices count/total | **redação/503 (D5)** — sem valores; `financialDataStatus:'PORTA_01_CLOSED'` |
| `risk-dashboard.service` | `payoutService.listOrders` (×N) | payouts bloqueados/falhos, indicadores | **redação/503 (D5)** — sem agregados financeiros |
| `payout.routes` | (era listOrders) | — | 503 PORTA_01_CLOSED (0189B) |
| `invoice.routes` | listInvoices por-parte | por parte autorizada | porta de ativação fechada (0189B) |

## receive_funds
Sem caller runtime (grep vazio fora de registry/tests). D8: guard impede novo caller sem decisão.

## financial-ssot
Baseline 591 (DECISION-0158). O script `validate-yala-final-overview-data.ts` em `backend/src/scripts`
subiu para 592 (INSERT cru em bank_*). Etapa B move a fixture para suporte de teste fora de
`backend/src`/build → volta a 591. Baseline NUNCA sobe; sem allowlist.
