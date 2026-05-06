# Relatório Fase 3 — TS2551 e TS2339 (Coerência Estrutural)

**Data:** 2026-02-22  
**Fonte:** `npx tsc --noEmit` em `backend/` (tsc_backend.txt)  
**Objetivo:** Top 10 por código + 15 erros reais do maior cluster para regra de correção em lote.

---

## 1. Top 10 arquivos — TS2551

| Count | Arquivo (relativo a backend/) |
|------:|-------------------------------|
| **476** | **src/modules/marketplace/marketplace.service.ts** |
| 26 | src/modules/marketplace/marketplace.routes.ts |
| 10 | src/core/pilot/pilot-human-observation.routes.ts |
| 4 | src/core/identity/identity.routes.ts |
| 4 | src/core/pilot/institutional-memory.routes.ts |
| 3 | src/core/pilot/pilot-events.routes.ts |
| 3 | src/core/pilot/pilot-invites.routes.ts |
| 2 | src/core/events/event.service.ts |
| 1 | src/modules/social/social-work-payment.service.ts |

**Total TS2551 (backend):** 529

---

## 2. Top 10 arquivos — TS2339

| Count | Arquivo (relativo a backend/) |
|------:|-------------------------------|
| **91** | **src/modules/marketplace/marketplace.service.ts** |
| 35 | src/modules/marketplace/marketplace.routes.ts |
| 16 | src/core/events/specs/event-spec.service.ts |
| 13 | src/modules/marketplace/payment-execution.service.ts |
| 13 | src/modules/marketplace/marketplace-public.routes.ts |
| 8 | src/core/events/operational-commitments.service.ts |
| 7 | src/core/events/event-custody.service.ts |
| 7 | src/modules/bank/bank-split-engine.service.ts |
| 7 | src/modules/marketplace/payment-split.service.ts |
| 6 | src/modules/loyalty/loyalty.service.ts |

**Total TS2339 (backend):** 409

---

## 3. 15 erros reais do maior arquivo TS2551 — `marketplace.service.ts`

```
src/modules/marketplace/marketplace.service.ts(842,49): error TS2551: Property 'store_id' does not exist on type '{ storeId: string; ... }'. Did you mean 'storeId'?
src/modules/marketplace/marketplace.service.ts(857,42): error TS2551: Property 'template_id' does not exist on type '{ storeId: string; ... }'. Did you mean 'templateId'?
src/modules/marketplace/marketplace.service.ts(874,22): error TS2551: Property 'store_id' does not exist on type '{ storeId: string; ... }'. Did you mean 'storeId'?
src/modules/marketplace/marketplace.service.ts(876,25): error TS2551: Property 'template_id' does not exist on type '{ storeId: string; ... }'. Did you mean 'templateId'?
src/modules/marketplace/marketplace.service.ts(1185,49): error TS2551: Property 'store_id' does not exist on type '{ storeId: string; ... }'. Did you mean 'storeId'?
src/modules/marketplace/marketplace.service.ts(1270,17): error TS2551: Property 'category_id' does not exist on type '{ id: string; name: string; ... categoryId: string; ... }'. Did you mean 'categoryId'?
src/modules/marketplace/marketplace.service.ts(1281,29): error TS2551: Property 'category_id' does not exist on type '{ id: string; name: string; ... categoryId: string; }'. Did you mean 'categoryId'?
src/modules/marketplace/marketplace.service.ts(1325,49): error TS2551: Property 'store_id' does not exist on type '{ storeId: string; ... }'. Did you mean 'storeId'?
src/modules/marketplace/marketplace.service.ts(1362,49): error TS2551: Property 'store_id' does not exist on type '{ storeId: string; ... }'. Did you mean 'storeId'?
src/modules/marketplace/marketplace.service.ts(1362,68): error TS2551: Property 'store_id' does not exist on type '{ storeId: string; items: { ... }; customer_id?: string; }'. Did you mean 'storeId'?
src/modules/marketplace/marketplace.service.ts(1372,55): error TS2551: Property 'store_id' does not exist on type '{ storeId: string; items: { ... }; customer_id?: string; }'. Did you mean 'storeId'?
src/modules/marketplace/marketplace.service.ts(1382,58): error TS2551: Property 'product_id' does not exist on type '{ productId: string; name: string; ... }'. Did you mean 'productId'?
src/modules/marketplace/marketplace.service.ts(1382,83): error TS2551: Property 'product_id' does not exist on type '{ productId: string; quantity: number; }'. Did you mean 'productId'?
src/modules/marketplace/marketplace.service.ts(1385,46): error TS2551: Property 'product_id' does not exist on type '{ productId: string; quantity: number; }'. Did you mean 'productId'?
src/modules/marketplace/marketplace.service.ts(1420,28): error TS2551: Property 'product_id' does not exist on type '{ productId: string; name: string; ... }'. Did you mean 'productId'?
```

---

## 4. Padrão dominante (marketplace.service.ts)

- **TS2551:** Uso de **snake_case** em objetos cujo tipo já está em **camelCase** (contratos/DTOs).
- Mapeamento direto sugerido pelo compilador:
  - `store_id` → `storeId`
  - `template_id` → `templateId`
  - `category_id` → `categoryId`
  - `product_id` → `productId`
  - (e equivalentes para outros `*_id`, `*_at`, etc. no mesmo arquivo)
- **Causa provável:** código que ainda acessa propriedades como no banco (snake_case) enquanto os tipos/contratos já foram migrados para camelCase (07_NOMENCLATURA_CANONICA / M1).

---

## 5. Observações

- **Backend:** `tsconfig` está em `backend/`; não há `tsconfig.json` na raiz do monorepo. Comando usado: `cd backend && npx tsc --noEmit`.
- **Frontend:** rodado à parte; erros não contabilizados neste relatório (podem ser agregados depois).
- **Artefato de entrada:** `c:\unificard\tsc_backend.txt` (output completo do tsc no backend).

---

---

## 6. EXECUÇÃO — Correção em lote (2026-02-22)

**Norma:** docs/01_normative/07_NOMENCLATURA_CANONICA.md + boundary M1.  
**Escopo:** Apenas acessos a propriedade em objetos tipados como DTO/domínio (camelCase). Não alterado: rows de SQL, boundary snake_case.

### Substituições aplicadas em `backend/src/modules/marketplace/marketplace.service.ts`

| snake_case (acesso) | camelCase |
|---------------------|-----------|
| .store_id | .storeId |
| .template_id | .templateId |
| .category_id | .categoryId |
| .product_id | .productId |
| .industry_id | .industryId |
| .authorized_hubs | .authorizedHubs |
| .billing_cycle | .billingCycle |
| .categories_supported | .categoriesSupported |
| .default_margin_rules | .defaultMarginRules |
| .supported_products | .supportedProducts |
| .fulfillment_type | .fulfillmentType |
| .logistics_profile | .logisticsProfile |
| .actor_type | .actorType |
| .snapshot_id | .snapshotId |
| .order_id | .orderId |
| .actor_involved | .actorInvolved |
| .checkout_id | .checkoutId |
| .ledger_entry_id | .ledgerEntryId |
| .incentive_type | .incentiveType |
| .rule_id | .ruleId |
| .requires_trust_level | .requiresTrustLevel |
| .target_percentage | .targetPercentage |
| .dispute_rate | .disputeRate |
| .fulfillment_time_hours | .fulfillmentTimeHours |
| .cancellation_rate_percentage | .cancellationRatePercentage |
| .fulfillment_time_violation | .fulfillmentTimeViolation |
| .cancellation_rate_violation | .cancellationRateViolation |
| .disputeRate_percentage (parcial) | .disputeRatePercentage |
| .disputeRate_violation (parcial) | .disputeRateViolation |
| .supported_vehicles | .supportedVehicles |
| .base_cost | .baseCost |
| .default_eta_minutes | .defaultEtaMinutes |
| .redirect_to | .redirectTo |
| .max_per_actor | .maxPerActor |

### Resultado tsc (backend)

| Métrica | Antes | Depois |
|---------|-------|--------|
| TS2551 total (backend) | 529 | 368 |
| TS2551 em marketplace.service.ts | 476 | ~315 |

**Observação:** Os TS2551 restantes em `marketplace.service.ts` incluem (a) tipos que ainda declaram snake_case opcional (ex.: `industry_id?`, `checkout_id?`) — alinhar tipos aos contratos camelCase; (b) outros acessos snake_case a corrigir em próxima leva.

---

## 7. FASE 3A — Limpeza mecânica (2026-02-22)

**Regra:** Trocar somente `obj.snake_case` onde o tipo já é camelCase (contrato/domínio). Não tocar em row, literal, nem tipo inline.

### Substituições 3A aplicadas

| Acesso | Substituído por |
|--------|------------------|
| .minimum_quantity | .minimumQuantity |
| .maximum_quantity | .maximumQuantity |
| .unit_price | .unitPrice |
| .payment_terms | .paymentTerms |
| .payment_due_date | .paymentDueDate |
| .supplier_id | .supplierId |
| .execution_id | .executionId |
| .contract_id | .contractId |
| .max_per_period | .maxPerPeriod |
| .delivery_id | .deliveryId |
| .subscription_id | .subscriptionId |
| .grant_id | .grantId |
| slaStatus.cancellation_rate | slaStatus.cancellationRate (seletivo) |

### Resultado pós-3A (tsc_post_3a.txt)

| Métrica | Pré-3A | Pós-3A | Delta |
|---------|--------|--------|-------|
| TS2551 total (backend) | 368 | **335** | −33 |
| TS2551 em marketplace.service.ts | ~315 | **282** | −33 |
| TS2339 total (backend) | 409 | 409 | — |

Os restantes são predominantemente **3B**: tipo inline/input em snake_case (código já em camelCase) ou acessos residuais em objetos com tipo ainda snake_case.

### 10 exemplos restantes (marketplace.service.ts) para plano 3B

1. **(1401, 1544)** `industryId` não existe; tipo tem `industry_id?` — **3B: corrigir tipo** (produto inline).
2. **(1939)** `baseCost` não existe; tipo tem `base_cost` — **3B: tipo inline** (logistics).
3. **(3231)** `authorizedHubs` não existe; tipo tem `authorized_hubs?` — **3B: corrigir tipo**.
4. **(3547)** `disputeRate` não existe; tipo tem `dispute_rate` — **3B: tipo inline** (métricas SLA).
5. **(3644–3663)** `fulfillmentTimeHours` não existe; tipo tem `fulfillment_time_hours?` — **3B: corrigir tipo** (evento).
6. **(3941)** `checkoutId` não existe; input tem `checkout_id?` — **3B: corrigir tipo** (createDisputeCase).
7. **(4085–4088)** `maxPerActor`, `maxPerPeriod`, `requiresTrustLevel` não existem; tipo tem `max_per_actor`, `max_per_period`, `requires_trust_level` — **3B: corrigir tipo** (input regra incentivo).
8. **(4425, 4444, 4461)** `supplierId` não existe; tipo tem `supplier_id` — **3B: tipo inline** (B2B contract).
9. **(4502, 4578, 4594)** `contractId` não existe; tipo tem `contract_id` — **3B: tipo inline** (input execution).
10. **(4737)** `buyer_id` em B2BCommercialContract — **acesso residual** (contrato já tem buyerId) ou **3B** conforme definição do contrato.

Além disso: `min_quantity`, `commit_deadline`, `regions_allowed`, `batch_id`, `total_committed_quantity`, `max_quantity` em ProductionBatch e objetos relacionados — parte é tipo inline snake_case (3B), parte é acesso residual (tipo já camelCase).

---

## 8. FASE 3B — Tipos inline/inputs (2026-02-22)

**Regra:** Corrigir tipos inline/input de domínio (retorno/parâmetro de método) de snake_case para camelCase. Zero alteração de row, zero alteração indevida de contrato externo, domínio camelCase, SLA isolado (linhas 3522, 3527 não alteradas), sem `as`/sem `!`.

### Blocos aplicados

| Bloco | Escopo | Alterações |
|-------|--------|------------|
| 1 | Produto (getStoreProducts) | Retorno: `industry_id?` → `industryId?`, `hub_id?` → `hubId?`, `is_industrial?` → `isIndustrial?` |
| 2 | createIndustryAccount | Service: parâmetro `authorized_hubs?` → `authorizedHubs?`. Rota: mapeamento `authorizedHubs: body.authorized_hubs` |
| 3 | createDisputeCase | Service: input `checkout_id?` → `checkoutId?`. Rota: objeto ao service em camelCase (orderId, checkoutId, actorInvolved) |
| 4 | createIncentiveRule | Service: input `max_amount`→`maxAmountCents`, `max_per_actor`→`maxPerActor`, `max_per_period`→`maxPerPeriod`, `requires_trust_level`→`requiresTrustLevel`; literal da rule em camelCase. Rota: mapeamento body → camelCase |
| 5 | orderEvents + recordOrderEvent | Map/input: `event_type`→`eventType`, `fulfillment_time_hours?`→`fulfillmentTimeHours?`; literais e leituras ajustados. SLA não tocado. |

**Fix pós-3B:** Acessos residuais `product.is_industrial` → `product.isIndustrial` (linhas 1401, 1544).

### Resultado tsc pós-3B (tsc_post_3b_fix.txt)

| Métrica | Pós-3A | Pós-3B (+ fix is_industrial) | Delta |
|---------|--------|------------------------------|-------|
| TS2551 total (backend) | 335 | **323** | −12 |
| TS2339 total (backend) | 409 | **409** | — |

### 5 exemplos de TS2551 restantes em marketplace.service.ts

1. **(1939)** `baseCost` não existe; tipo inline tem `base_cost` (logistics).
2. **(3547)** `disputeRate` não existe; tipo tem `dispute_rate` (métricas SLA).
3. **(4425, 4444, 4461)** `supplierId` não existe; tipo tem `supplier_id` (B2B contract inline).
4. **(4502, 4578, 4594)** `contractId` não existe; tipo tem `contract_id` (input execution).
5. **(4737 e outros)** Contrato B2BCommercialContract / ProductionBatch: `buyer_id`, `min_quantity`, `max_quantity`, etc. — tipos inline ou acessos residuais.

Próximo passo: atacar esses clusters (tipos inline snake_case ou acessos onde o tipo já é camelCase) em levas cirúrgicas; manter TS2339 para fase dedicada.

---

## 9. Cluster ProductionBatch / BatchCommitment (2026-02-22)

**Regra:** Contratos já camelCase; apenas acessos errados + 1 chave de tipo inline no service. Zero row, zero alteração de contrato.

### Patch aplicado (5 blocos)

| Bloco | Alteração |
|-------|-----------|
| 1 | Tipo input `createProductionBatch`: `max_quantity?` → `maxQuantity?` |
| 2 | Acessos ao input: `input.min_quantity` → `input.minQuantity`, `input.max_quantity` → `input.maxQuantity`, `input.commit_deadline` → `input.commitDeadline`, `input.regions_allowed` → `input.regionsAllowed` |
| 3 | Acessos a `ProductionBatch`: `batch.commit_deadline` → `batch.commitDeadline`, `batch.regions_allowed` → `batch.regionsAllowed`, `batch.total_committed_quantity` → `batch.totalCommittedQuantity`, `batch.max_quantity` → `batch.maxQuantity`, `batch.min_quantity` → `batch.minQuantity`; `a.commit_deadline`/`b.commit_deadline` → camelCase; logs `committed_quantity` → `committedQuantity` |
| 4 | `commitToBatch`: `input.batch_id` → `input.batchId` |
| 5 | `BatchCommitment`: `commitment.commitment_id` → `commitment.commitmentId`, `commitment.batch_id` → `commitment.batchId`; `c.commitment_id`/`c.batch_id` → camelCase |

### Resultado tsc (tsc_post_production_batch.txt)

| Métrica | Antes (pós-3B) | Depois (pós-ProductionBatch) | Delta |
|---------|----------------|-------------------------------|-------|
| TS2551 total (backend) | 323 | **289** | −34 |
| TS2339 total (backend) | 409 | **409** | — |

### 5 exemplos de TS2551 restantes em marketplace.service.ts (pós-patch)

1. **(1939)** `baseCost` não existe; tipo inline tem `base_cost` (logistics).
2. **(3547)** `disputeRate` não existe; tipo tem `dispute_rate` (métricas SLA).
3. **(4425, 4444, 4461)** `supplierId` não existe; tipo tem `supplier_id` (B2B contract inline).
4. **(4502, 4578, 4594)** `contractId` não existe; tipo tem `contract_id` (input execution).
5. **(4737 e outros)** B2BCommercialContract: `buyer_id` vs `buyerId`; CompanyOnboarding e outros clusters.

Próximo alvo sugerido: B2B Contracts, depois CompanyOnboarding, depois SLA snapshot.

---

## 10. Cluster B2B (createB2BContract / executeB2BContract / getB2BContractsByActor) (2026-02-22)

**Regra:** Tipos inline e literais em camelCase; shape alinhado aos contratos B2BCommercialContract e B2BContractExecution. Boundary nas rotas: body snake_case mapeado para camelCase antes de chamar o service. Zero alteração nos contratos (já camelCase).

### Patch aplicado (5 blocos + rotas)

| Bloco | Alteração |
|-------|-----------|
| 1 | createB2BContract: tipo do input → supplierId, supplierType, buyerId, buyerType, products[].minimumQuantity/maximumQuantity, terms.volumeCommitment, deliverySchedule, paymentTerms, penaltyRate?, startDate, endDate |
| 2 | createB2BContract: literal do contract → contractId, supplierId, buyerId, startDate, endDate; terms construído com volumeCommitment, deliverySchedule, paymentTerms, penaltyRate; logs com contractId, supplierId, buyerId |
| 3 | executeB2BContract: tipo do input → contractId, deliveredAt |
| 4 | executeB2BContract: literal da execution → executionId, contractId, deliveryDate, paymentDueDate, deliveredAt; products com unitPriceCents/subtotalCents; totalAmountCents; logs executionId, contractId |
| 5 | getB2BContractsByActor: contract.buyer_id → contract.buyerId; signB2BContract log contractId |
| Rotas | POST /b2b-contracts: mapeamento body (supplier_id, products[].product_id, terms.volume_commitment, etc.) → camelCase. POST .../execute: contractId, products[].productId, deliveredAt. Logs com contractId, executionId. |

### Resultado tsc (tsc_post_b2b.txt)

| Métrica | Antes (pós-ProductionBatch) | Depois (pós-B2B) | Delta |
|---------|-----------------------------|------------------|-------|
| TS2551 total (backend) | 289 | **280** | −9 |
| TS2339 total (backend) | 409 | **409** | — |

### 5 exemplos de TS2551 restantes em marketplace.service.ts (pós-B2B)

1. **(1939)** Logistics: `baseCost` vs tipo com `base_cost`.
2. **(3547)** SLA: `disputeRate` vs `dispute_rate`.
3. **(5717, 5718, 5723, 5724…)** CompanyOnboarding: `company_type`, `company_name`, `bank_account`, `marketplace_enabled` vs camelCase do tipo.
4. (Outros) CompanyOnboarding / CompanyProfile e clusters restantes.
5. SLA snapshot (revisão contextual).

Próximo alvo sugerido: CompanyOnboarding, depois SLA (com cuidado).

---

**FIM DO RELATÓRIO** — Cluster B2B aplicado; TS2551 289→280.
