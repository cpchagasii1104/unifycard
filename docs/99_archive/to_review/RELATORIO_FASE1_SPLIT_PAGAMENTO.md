# RELATÓRIO FASE 1 — MAPEAMENTO DE SPLIT DE PAGAMENTO

**Data:** 2026-01-XX  
**Objetivo:** Mapear call sites e referências de split de pagamento  
**Escopo:** Apenas mapeamento, sem modificações

---

## 1. CALL SITES DE split.service.ts

### 1.1 Importações de splitEngineService

1. **Arquivo:** `backend/src/core/catalog/catalog-payment.service.ts`
   - **Linha:** 15
   - **Função:** `processOrderPayment`
   - **Contexto:** Economy (Catalog)
   - **Uso:** Linha 112 — `splitEngineService.applySplits(splitContext)`

2. **Arquivo:** `backend/src/core/events/event-economy.service.ts`
   - **Linha:** 6
   - **Função:** `validateEventEconomy` (linha 45), `createSplitTemplate` (linha 221), `processCheckout` (linha 299)
   - **Contexto:** Economy (Events)
   - **Uso:** 
     - Linha 110 — `splitEngineService.calculateSplits(splitContext)`
     - Linha 275 — `splitEngineService.calculateSplits(splitContext)`

3. **Arquivo:** `backend/src/jobs/post-event-split.job.ts`
   - **Linha:** 9
   - **Função:** `distributeRemainder` (linha 179)
   - **Contexto:** Economy (Events)
   - **Uso:** Linha 211 — `splitEngineService.calculateSplits(splitContext)`

4. **Arquivo:** `backend/src/modules/work/assignments/assignment.service.ts`
   - **Linha:** 10
   - **Função:** `markAsCompleted` (linha 194)
   - **Contexto:** Economy (Work)
   - **Uso:** Linha 344 — `splitEngineService.applySplits(splitContext)`

---

## 2. CALL SITES DE service-payment-execution.service.ts

### 2.1 Importações de servicePaymentExecutionService

1. **Arquivo:** `backend/src/modules/services/service-payment-execution.routes.ts`
   - **Linha:** 6
   - **Função:** Rotas HTTP
   - **Contexto:** Services
   - **Uso:** 
     - Linha 53 — `servicePaymentExecutionService.createExecution(...)` (POST /:paymentRequestId/execute)
     - Linha 89 — `servicePaymentExecutionService.getExecutionByPaymentRequest(...)` (GET /:paymentRequestId/execution)

### 2.2 Importações dinâmicas de paymentExecutionService (Marketplace)

1. **Arquivo:** `backend/src/modules/subscriptions/subscription.service.ts`
   - **Linha:** 334
   - **Função:** (função não identificada no escopo)
   - **Contexto:** Marketplace
   - **Uso:** Import dinâmico — `await import('../marketplace/payment-execution.service')`

2. **Arquivo:** `backend/src/modules/payments/pix.routes.ts`
   - **Linha:** 115
   - **Função:** (handler de rota)
   - **Contexto:** Marketplace
   - **Uso:** Import dinâmico — `await import('../marketplace/payment-execution.service')`

3. **Arquivo:** `backend/src/modules/automation/scheduled-action.service.ts`
   - **Linha:** 296
   - **Função:** (função não identificada no escopo)
   - **Contexto:** Marketplace
   - **Uso:** Import dinâmico — `await import('../marketplace/payment-execution.service')`

4. **Arquivo:** `backend/src/modules/pdv/pdv.service.ts`
   - **Linha:** 242
   - **Função:** (função não identificada no escopo)
   - **Contexto:** Marketplace
   - **Uso:** Import dinâmico — `await import('../marketplace/payment-execution.service')`

### 2.3 Importações estáticas de paymentExecutionService

1. **Arquivo:** `backend/src/modules/marketplace/marketplace.routes.ts`
   - **Linha:** 17
   - **Função:** Rotas HTTP
   - **Contexto:** Marketplace
   - **Uso:** (uso não identificado no escopo)

2. **Arquivo:** `backend/src/modules/venue/venue.routes.ts`
   - **Linha:** 11
   - **Função:** Rotas HTTP
   - **Contexto:** Marketplace
   - **Uso:** (uso não identificado no escopo)

---

## 3. REFERÊNCIAS A payment_splits (Tabela)

### 3.1 Referências em Código TypeScript

1. **Arquivo:** `backend/src/modules/marketplace/payment-split.repository.ts`
   - **Linha:** 49 — `INSERT INTO payment_splits`
   - **Linha:** 86 — `FROM payment_splits`
   - **Linha:** 107 — `DELETE FROM payment_splits`
   - **Linha:** 125 — `FROM payment_splits`
   - **Função:** `createSplit`, `listSplitsByIntent`, `deleteSplitsByIntent`, `calculateTotalByIntent`
   - **Contexto:** Marketplace

2. **Arquivo:** `backend/src/modules/services/service-payment-execution.repository.ts`
   - **Linha:** 113 — `FROM payment_splits`
   - **Linha:** 203 — `INSERT INTO payment_splits`
   - **Função:** `findSplitsByExecutionId`, `createSplit`
   - **Contexto:** Services

3. **Arquivo:** `backend/src/modules/groups/groups-closure.routes.ts`
   - **Linha:** 63 — `FROM payment_splits ps`
   - **Função:** (handler de rota)
   - **Contexto:** Groups

4. **Arquivo:** `backend/src/modules/economy/economic-overview.projector.ts`
   - **Linha:** 81 — `FROM payment_splits ps`
   - **Linha:** 198 — `FROM payment_splits ps`
   - **Função:** (projeções/read-models)
   - **Contexto:** Economy

### 3.2 Referências em Migrations SQL

1. **Arquivo:** `backend/migrations/141_service_payment_execution.sql`
   - **Linha:** 65 — `CREATE TABLE IF NOT EXISTS payment_splits`
   - **Linha:** 86 — Constraint `payment_splits_amount_positive`
   - **Linha:** 87 — Constraint `payment_splits_percentage_valid`
   - **Linha:** 104 — `CREATE INDEX IF NOT EXISTS idx_payment_splits_execution_id`
   - **Linha:** 105 — `CREATE INDEX IF NOT EXISTS idx_payment_splits_receiver_actor_id`
   - **Linha:** 106 — `CREATE INDEX IF NOT EXISTS idx_payment_splits_tenant_id`
   - **Linha:** 129 — `CREATE OR REPLACE FUNCTION update_payment_splits_updated_at()`
   - **Linha:** 137 — `CREATE TRIGGER trg_payment_splits_updated_at`
   - **Linha:** 138 — `BEFORE UPDATE ON payment_splits`
   - **Linha:** 146 — `CREATE OR REPLACE FUNCTION validate_payment_splits_sum()`
   - **Linha:** 159 — `FROM payment_splits`
   - **Linha:** 172 — `CREATE TRIGGER trg_validate_payment_splits_sum`
   - **Linha:** 173 — `AFTER INSERT OR UPDATE ON payment_splits`
   - **Linha:** 178 — `CREATE TRIGGER trg_validate_payment_splits_sum_delete`
   - **Linha:** 179 — `AFTER DELETE ON payment_splits`
   - **Contexto:** Services (Migration)

---

## 4. CÁLCULOS INLINE EM marketplace.service.ts

### 4.1 Função: createPaymentPlan

**Arquivo:** `backend/src/modules/marketplace/marketplace.service.ts`  
**Função:** `createPaymentPlan` (linha 1732)  
**Contexto:** Marketplace

**Linhas de cálculo:**

1. **Linha 1776:** `const PLATFORM_FEE_PERCENTAGE = 5;` — Constante 5% para plataforma
2. **Linha 1777:** `const REGIONAL_FUND_PERCENTAGE = 1;` — Constante 1% para fundo regional
3. **Linha 1778:** `const DEFAULT_AFFILIATE_COMMISSION_PERCENTAGE = 2;` — Constante 2% para afiliado padrão
4. **Linha 1792:** `const platformFee = (storeSubtotal * PLATFORM_FEE_PERCENTAGE) / 100;` — Cálculo de taxa da plataforma
5. **Linha 1793:** `const regionalFundFee = (storeSubtotal * REGIONAL_FUND_PERCENTAGE) / 100;` — Cálculo de taxa regional
6. **Linha 1822:** `affiliateCommission = (storeSubtotal * attribution.commission.value) / 100;` — Cálculo de comissão de afiliado (percentage)
7. **Linha 1828:** `affiliateCommission = (storeSubtotal * DEFAULT_AFFILIATE_COMMISSION_PERCENTAGE) / 100;` — Cálculo de comissão padrão de afiliado
8. **Linha 1832:** `const sellerAmount = storeSubtotal - platformFee - regionalFundFee - affiliateCommission;` — Cálculo de valor líquido para seller
9. **Linha 1897:** `const splitsTotal = finalSplits.reduce((sum, split) => sum + split.amount, 0);` — Soma total dos splits
10. **Linha 1898:** `const difference = Math.abs(splitsTotal - checkout.total);` — Diferença entre splits e total

**Observações:**
- Cálculos são inline, não usam split.service.ts
- Percentuais são hardcoded (5%, 1%, 2%)
- Validação de soma ocorre na linha ~1901

---

## 5. RESUMO POR CONTEXTO

### 5.1 Contexto: Economy (Core)

- **split.service.ts:** 4 call sites
  - catalog-payment.service.ts (1 uso)
  - event-economy.service.ts (2 usos)
  - post-event-split.job.ts (1 uso)
  - assignment.service.ts (1 uso)

### 5.2 Contexto: Services

- **service-payment-execution.service.ts:** 1 call site direto
  - service-payment-execution.routes.ts (2 métodos)
- **payment_splits (tabela):** 2 referências
  - service-payment-execution.repository.ts (2 queries)

### 5.3 Contexto: Marketplace

- **payment-split.service.ts:** 2 call sites
  - marketplace.routes.ts linha 657 (defineSplits — POST /payment-splits/define)
  - payout.service.ts linha 58 (getSplitsByIntent)
- **payment-execution.service.ts:** 4 imports dinâmicos + 2 imports estáticos
- **payment_splits (tabela):** 1 referência
  - payment-split.repository.ts (4 queries: INSERT, SELECT, DELETE, SELECT)
- **Cálculos inline:** 1 função
  - marketplace.service.ts — createPaymentPlan (linhas 1776-1898, 10 linhas de cálculo)

### 5.4 Contexto: Groups

- **payment_splits (tabela):** 1 referência
  - groups-closure.routes.ts (1 query)

### 5.5 Contexto: Economy (Read-Models)

- **payment_splits (tabela):** 2 referências
  - economic-overview.projector.ts (2 queries)

---

## 6. OBSERVAÇÕES TÉCNICAS

1. **split.service.ts** é usado exclusivamente no Core Economy (catalog, events, work)
2. **service-payment-execution.service.ts** é usado no domínio Services
3. **payment-split.service.ts** é usado no domínio Marketplace
4. **payment-execution.service.ts** (marketplace) tem imports dinâmicos em múltiplos módulos
5. **Cálculos inline** existem apenas em `marketplace.service.ts` (função `createPaymentPlan`)
6. **payment_splits** é referenciada em 4 arquivos TypeScript e 1 migration

---

**FIM DO RELATÓRIO**

