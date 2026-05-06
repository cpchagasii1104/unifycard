# Runbook — Validação de orquestração (Order × Inventory × Payment × Fulfillment)

**Estado:** suíte **implementada** (`pnpm test:integration:marketplace-orchestration`); cenário **F** skipped até API/RFC de ship parcial. Pagamento PSP end-to-end continua **simulado** via `releaseReservation` onde aplicável (alinhado ao runbook).  
**Diagramas:** `docs/diagrams/inventory-order-payment-fulfillment.mmd`, `docs/diagrams/inventory-prod7-ssot.mmd`  
**Inventário isolado:** `docs/runbooks/inventory-semantics.md` §7 — `pnpm test:integration:prod7-inventory`

## 1. Objetivo

Garantir que **a coordenação entre módulos** não quebra invariantes que o inventário já fixou:

- reserva e item de pedido **atomicamente** na criação;
- falha de pagamento **liberta** reserva;
- envio **OUT + consume** na mesma transação;
- **Drift-2** permanece 0 após cada cenário (reserva nunca excede Σ movements).

Não substitui INFRA-4 (saga/outbox); define **o que** a suíte deve provar quando a saga existir ou quando se simula compensação.

## 2. Pré-requisitos

- `DATABASE_URL`, migrations aplicadas.
- Dados mínimos: tenant, categorias, produto, variante, preço resolvível por `pricingService` (ou seed alinhado ao e2e de catálogo).
- Movimento `IN` de stock para variantes usadas nos testes.
- Pagamento end-to-end pode exigir contas Bank + intent `AUTHORIZED` — cenários de pagamento podem ficar **atrás de flag** ou mock até o trilho Bank estar estável no CI.

## 3. Critérios globais PASS/FAIL

| ID | Critério | PASS |
|----|-----------|------|
| G1 | Após criar pedido com linhas, existe reserva `ACTIVE` por `order_id` coerente com quantidades | Query / serviço |
| G2 | `sum(reservations ACTIVE qty)` por variante ≤ soma canónica de `inventory_movements` (Drift-2) | Mesma SQL que §7 PROD-7 |
| G3 | Após cancelar/expirar pedido (`order.service`), reservas desse pedido não permanecem `ACTIVE` | Query |
| G4 | Após `ship` de fulfillment, existem `OUT` por item e reservas do pedido `CONSUMED` (ou política documentada) | Query + estado pedido/fulfillment |
| G5 | Não existe decisão de “pode vender?” só com `inventory_balances` sem cruzar movements + reservas | Revisão estática / teste de serviço |

## 4. Cenários (ordem sugerida)

### Cenário A — Feliz: pedido + reserva + cancelamento manual

1. `createOrderWithItemsAndReservations` com 1 linha, stock suficiente.  
2. **PASS:** pedido `draft`, item criado, reserva `ACTIVE`, Drift-2 = 0.  
3. `cancelOrder`.  
4. **PASS:** sem `ACTIVE` para esse `order_id`, Drift-2 = 0.

**Falha típica:** reserva criada sem item (transação mal fechada) — hoje mitigado pelo código em `order.service.ts` (TX única).

### Cenário B — Stock insuficiente na criação

1. Stock 0 ou inferior à linha.  
2. **PASS:** erro claro (`InsufficientStockError` ou equivalente), **sem** pedido persistido **sem** reserva órfã (rollback).

### Cenário C — Pagamento falha → liberta reserva

1. Pedido com reserva + fluxo até `executePayment` falhar (Bank simulado ou ambiente de teste).  
2. **PASS:** após falha, `releaseReservation` efectivo (ver `payment-execution.service.ts`), sem `ACTIVE` para o pedido, Drift-2 = 0.

**Nota:** depende de intent/transação Bank; pode ser `describe.skip` até harness existir.

### Cenário D — Fulfillment: OUT antes de consume na mesma TX

1. Pedido pago (ou atalho de teste que cria fulfillment elegível conforme API interna).  
2. Chamar fluxo de envio (`fulfillment.service` — ship).  
3. **PASS:** numa única transação: movimentos `OUT` com referência ao fulfillment; depois `consume` das reservas; Drift-2 = 0; `recalculateBalance` opcionalmente consistente (Drift-1).

**Falha típica:** consume sem OUT ou OUT duplicado — quebra física / auditoria.

### Cenário E — Timeout de saga (placeholder INFRA-4)

1. Simular reserva `ACTIVE` + pagamento pendente; disparar compensação (handler de timeout).  
2. **PASS:** idempotência de `release`; segundo release não corrompe estado; Drift-2 = 0.

### Cenário F — “Pagamento OK sem fulfillment” (detector)

1. Estado injectado ou log de produção: intent `SUCCESS` mas sem fulfillment `SHIPPED` dentro de SLA (definir SLA no teste como constante).  
2. **PASS (suíte de detecção):** alerta ou query operacional retorna linhas; em suíte de regressão pode ser view/SQL + expect > 0 em ambiente de caos.

Este cenário valida **governança**, não o happy path.

## 5. Implementação sugerida no repo

| Peça | Proposta |
|------|----------|
| Ficheiro | `backend/tests/integration/marketplace-orchestration.integration.test.ts` |
| Comando | `cd backend && pnpm test:integration:marketplace-orchestration` (`--runInBand --forceExit`) |
| Fixture | Reutilizar padrão de `inventory-semantics-prod7.integration.test.ts` (tenant, variant, `IN`, actors) + `product_prices` se necessário |
| Teardown | Mesmo padrão e2e: `DISABLE TRIGGER` reservations/movements só para limpeza do tenant de teste |

## 6. Relação com testes existentes

- `tests/e2e/catalog-order-ledger.e2e.test.ts` — já cruza catálogo, pedido e ledger; usar como referência de **harness** (JWT, tenant, variant).  
- `tests/unit/marketplace-order-partial-flow.test.ts` — mocks; não prova cross-module real.  
- PROD-7 — prova **inventário**; esta suíte prova **fronteira**.

## 7. O que não está neste runbook

- Detalhe de split/payout e settlement (outro documento).  
- Substituir auditoria humana de Drift em produção (SQLs em `backend/scripts/sql/` continuam válidas).

---

**Frase de encerramento:** inventário deixou de ser o elo fraco; a suíte acima é o elo seguinte obrigatório antes de escalar tráfego real.
