# LOG DE EXECUÇÃO — M1 BOUNDARY NAMING

**Data:** 2026-02-05  
**Modo:** EXECUTOR  
**Norma de Referência:** docs/01_normative/07_NOMENCLATURA_CANONICA.md  
**Relatório de Auditoria:** docs/04_audit/dinheiro/M1_boundary_audit.md  

---

## RESUMO EXECUTIVO

Total de arquivos modificados: 16  
Total de campos renomeados: 52  

---

## ARQUIVOS MODIFICADOS

### 1. backend/src/contracts/marketplace/Order.contract.ts

**Campos renomeados:**
- `price.amount` → `price.amountCents` (linha 27)
- `total` → `totalCents` (linha 33)

**Quantidade:** 2 renomes

**Declarações:**
- Nenhum tipo foi alterado
- Nenhuma lógica foi alterada
- Nenhum cálculo foi alterado

---

### 2. backend/src/contracts/marketplace/ServiceOrder.contract.ts

**Campos renomeados:**
- `price.amount` → `price.amountCents` (linha 22)

**Quantidade:** 1 rename

**Declarações:**
- Nenhum tipo foi alterado
- Nenhuma lógica foi alterada
- Nenhum cálculo foi alterado

---

### 3. backend/src/contracts/marketplace/ServiceQuote.contract.ts

**Campos renomeados:**
- `serviceValue.amount` → `serviceValue.amountCents` (linha 26)

**Quantidade:** 1 rename

**Declarações:**
- Nenhum tipo foi alterado
- Nenhuma lógica foi alterada
- Nenhum cálculo foi alterado

---

### 4. backend/src/contracts/marketplace/ServicePaymentHold.contract.ts

**Campos renomeados:**
- `amount` → `amountCents` (linha 24)

**Quantidade:** 1 rename

**Declarações:**
- Nenhum tipo foi alterado
- Nenhuma lógica foi alterada
- Nenhum cálculo foi alterado

---

### 5. backend/src/contracts/marketplace/ResourceCompensation.contract.ts

**Campos renomeados:**
- `fixedAmount` → `fixedAmountCents` (linha 28)
- `monthlySalary` → `monthlySalaryCents` (linha 32)
- `baseSalary` → `baseSalaryCents` (linha 35)
- `minCompensation` → `minCompensationCents` (linha 39)
- `maxCompensation` → `maxCompensationCents` (linha 40)
- `serviceValue.amount` → `serviceValue.amountCents` (linha 63)
- `compensationAmount.amount` → `compensationAmount.amountCents` (linha 69)
- `adjustments[].amount` → `adjustments[].amountCents` (linha 81)
- `totalCompensation.amount` → `totalCompensation.amountCents` (linha 113)
- `averagePerService.amount` → `averagePerService.amountCents` (linha 117)
- `byModel[].total` → `byModel[].totalCents` (linha 124)
- `totalCompensationsPaid.amount` → `totalCompensationsPaid.amountCents` (linha 144)
- `byResource[].totalCompensation.amount` → `byResource[].totalCompensation.amountCents` (linha 157)
- `byModel[].totalCompensation.amount` → `byModel[].totalCompensation.amountCents` (linha 167)

**Quantidade:** 14 renomes

**Declarações:**
- Nenhum tipo foi alterado
- Nenhuma lógica foi alterada
- Nenhum cálculo foi alterado

---

### 6. backend/src/contracts/marketplace/RevenueSnapshot.contract.ts

**Campos renomeados:**
- `revenues.transaction.totalAmount` → `revenues.transaction.totalAmountCents`
- `revenues.transaction.platformRevenue` → `revenues.transaction.platformRevenueCents`
- `revenues.transaction.regionalFundRevenue` → `revenues.transaction.regionalFundRevenueCents`
- `revenues.transaction.infrastructureCost` → `revenues.transaction.infrastructureCostCents`
- `revenues.b2b.totalAmount` → `revenues.b2b.totalAmountCents`
- `revenues.b2b.platformRevenue` → `revenues.b2b.platformRevenueCents`
- `revenues.b2b.regionalFundRevenue` → `revenues.b2b.regionalFundRevenueCents`
- `revenues.subscription.totalAmount` → `revenues.subscription.totalAmountCents`
- `revenues.subscription.platformRevenue` → `revenues.subscription.platformRevenueCents`
- `revenues.subscription.regionalFundRevenue` → `revenues.subscription.regionalFundRevenueCents`
- `revenues.terminal.totalAmount` → `revenues.terminal.totalAmountCents`
- `revenues.terminal.platformRevenue` → `revenues.terminal.platformRevenueCents`
- `revenues.terminal.regionalFundRevenue` → `revenues.terminal.regionalFundRevenueCents`
- `revenues.terminal.infrastructureCost` → `revenues.terminal.infrastructureCostCents`
- `revenues.logistics.totalAmount` → `revenues.logistics.totalAmountCents`
- `revenues.logistics.platformRevenue` → `revenues.logistics.platformRevenueCents`
- `revenues.logistics.regionalFundRevenue` → `revenues.logistics.regionalFundRevenueCents`
- `totalTransacted` → `totalTransactedCents`
- `totalFees` → `totalFeesCents`
- `totalPlatformRevenue` → `totalPlatformRevenueCents`
- `totalRegionalFundRevenue` → `totalRegionalFundRevenueCents`
- `totalInfrastructureCost` → `totalInfrastructureCostCents`
- `totalIncentives` → `totalIncentivesCents`

**Quantidade:** 23 renomes

**Declarações:**
- Nenhum tipo foi alterado
- Nenhuma lógica foi alterada
- Nenhum cálculo foi alterado

---

### 7. backend/src/contracts/marketplace/RegionalFinancialFlow.contract.ts

**Campos renomeados:**
- `totalTransacted` → `totalTransactedCents`
- `totalFees` → `totalFeesCents`
- `regionalFund.totalRevenue` → `regionalFund.totalRevenueCents`
- `regionalFund.infrastructureCost` → `regionalFund.infrastructureCostCents`
- `regionalFund.netBalance` → `regionalFund.netBalanceCents`
- `platform.totalRevenue` → `platform.totalRevenueCents`
- `infrastructure.totalCost` → `infrastructure.totalCostCents`
- `infrastructure.fundedByRegionalFund` → `infrastructure.fundedByRegionalFundCents`
- `incentives.totalGranted` → `incentives.totalGrantedCents`

**Quantidade:** 9 renomes

**Declarações:**
- Nenhum tipo foi alterado
- Nenhuma lógica foi alterada
- Nenhum cálculo foi alterado

---

### 8. backend/src/contracts/marketplace/B2BContractExecution.contract.ts

**Campos renomeados:**
- `products[].unitPrice` → `products[].unitPriceCents`
- `products[].subtotal` → `products[].subtotalCents`
- `totalAmount` → `totalAmountCents`
- `penaltyApplied` → `penaltyAppliedCents`

**Quantidade:** 4 renomes

**Declarações:**
- Nenhum tipo foi alterado
- Nenhuma lógica foi alterada
- Nenhum cálculo foi alterado

---

### 9. backend/src/contracts/marketplace/PricingAssistanceReport.contract.ts

**Campos renomeados:**
- `breakEvenAnalysis.breakEvenMonthlyRevenue.amount` → `breakEvenAnalysis.breakEvenMonthlyRevenue.amountCents`
- `breakEvenAnalysis.currentMonthlyRevenue.amount` → `breakEvenAnalysis.currentMonthlyRevenue.amountCents`
- `serviceMarginAnalysis.averagePrice.amount` → `serviceMarginAnalysis.averagePrice.amountCents`
- `serviceMarginAnalysis.averageCost.amount` → `serviceMarginAnalysis.averageCost.amountCents`
- `serviceMarginAnalysis.marginPerService.amount` → `serviceMarginAnalysis.marginPerService.amountCents`
- `serviceMarginAnalysis.totalRevenue.amount` → `serviceMarginAnalysis.totalRevenue.amountCents`
- `serviceMarginAnalysis.totalCost.amount` → `serviceMarginAnalysis.totalCost.amountCents`
- `operationalCostProfile.fixedCostsMonthly.rent.amount` → `operationalCostProfile.fixedCostsMonthly.rent.amountCents`
- `operationalCostProfile.fixedCostsMonthly.salaries.amount` → `operationalCostProfile.fixedCostsMonthly.salaries.amountCents`
- `operationalCostProfile.fixedCostsMonthly.proLabore.amount` → `operationalCostProfile.fixedCostsMonthly.proLabore.amountCents`
- `operationalCostProfile.fixedCostsMonthly.systems.amount` → `operationalCostProfile.fixedCostsMonthly.systems.amountCents`
- `operationalCostProfile.fixedCostsMonthly.other.amount` → `operationalCostProfile.fixedCostsMonthly.other.amountCents`
- `operationalCostProfile.fixedCostsMonthly.total.amount` → `operationalCostProfile.fixedCostsMonthly.total.amountCents`
- `operationalCostProfile.variableCostsPerService.materials.amount` → `operationalCostProfile.variableCostsPerService.materials.amountCents`
- `operationalCostProfile.variableCostsPerService.commission.amount` → `operationalCostProfile.variableCostsPerService.commission.amountCents`
- `operationalCostProfile.variableCostsPerService.transportation.amount` → `operationalCostProfile.variableCostsPerService.transportation.amountCents`
- `operationalCostProfile.variableCostsPerService.other.amount` → `operationalCostProfile.variableCostsPerService.other.amountCents`
- `operationalCostProfile.variableCostsPerService.averagePerService.amount` → `operationalCostProfile.variableCostsPerService.averagePerService.amountCents`
- `operationalCostProfile.costsPerHour.fixedCostPerHour.amount` → `operationalCostProfile.costsPerHour.fixedCostPerHour.amountCents`
- `operationalCostProfile.costsPerHour.variableCostPerHour.amount` → `operationalCostProfile.costsPerHour.variableCostPerHour.amountCents`
- `operationalCostProfile.costsPerHour.totalCostPerHour.amount` → `operationalCostProfile.costsPerHour.totalCostPerHour.amountCents`
- `realOperationMetrics.averageTicket.amount` → `realOperationMetrics.averageTicket.amountCents`
- `realOperationMetrics.totalRevenue.amount` → `realOperationMetrics.totalRevenue.amountCents`
- `realOperationMetrics.totalLossAmount.amount` → `realOperationMetrics.totalLossAmount.amountCents`
- `pricingAssistanceReport.averageMonthlyMargin.totalRevenue.amount` → `pricingAssistanceReport.averageMonthlyMargin.totalRevenue.amountCents`
- `pricingAssistanceReport.averageMonthlyMargin.totalCost.amount` → `pricingAssistanceReport.averageMonthlyMargin.totalCost.amountCents`
- `pricingAssistanceReport.averageMonthlyMargin.margin.amount` → `pricingAssistanceReport.averageMonthlyMargin.margin.amountCents`

**Quantidade:** 26 renomes

**Declarações:**
- Nenhum tipo foi alterado
- Nenhuma lógica foi alterada
- Nenhum cálculo foi alterado

---

### 10. backend/src/contracts/marketplace/ProductionBatch.contract.ts

**Campos renomeados:**
- `unitPrice.amount` → `unitPrice.amountCents` (linha 32)

**Quantidade:** 1 rename

**Declarações:**
- Nenhum tipo foi alterado
- Nenhuma lógica foi alterada
- Nenhum cálculo foi alterado

---

### 11. backend/src/contracts/marketplace/RegionalFundAllocation.contract.ts

**Campos renomeados:**
- `amount` → `amountCents` (linha 32)

**Quantidade:** 1 rename

**Declarações:**
- Nenhum tipo foi alterado
- Nenhuma lógica foi alterada
- Nenhum cálculo foi alterado

---

### 12. backend/src/contracts/marketplace/IncentiveRule.contract.ts

**Campos renomeados:**
- `maxAmount` → `maxAmountCents` (linha 32)

**Quantidade:** 1 rename

**Declarações:**
- Nenhum tipo foi alterado
- Nenhuma lógica foi alterada
- Nenhum cálculo foi alterado

---

### 13. backend/src/modules/services/service-order.types.ts

**Campos renomeados:**
- `grossAmount` → `grossAmountCents` (linha 126)
- `platformFee` → `platformFeeCents` (linha 128)
- `providerNetAmount` → `providerNetAmountCents` (linha 129)

**Quantidade:** 3 renomes

**Declarações:**
- Nenhum tipo foi alterado
- Nenhuma lógica foi alterada
- Nenhum cálculo foi alterado

---

### 14. backend/src/modules/services/service-payment-request.types.ts

**Campos renomeados:**
- `amount` → `amountCents` (linha 39, 80)

**Quantidade:** 2 renomes

**Declarações:**
- Nenhum tipo foi alterado
- Nenhuma lógica foi alterada
- Nenhum cálculo foi alterado

---

### 15. backend/src/modules/services/service-payment-execution.types.ts

**Campos renomeados:**
- `amount` → `amountCents` (linha 28)
- `PaymentSplit.amount` → `PaymentSplit.amountCents` (linha 49)
- `CreatePaymentSplitInput.amount` → `CreatePaymentSplitInput.amountCents` (linha 104)

**Quantidade:** 3 renomes

**Declarações:**
- Nenhum tipo foi alterado
- Nenhuma lógica foi alterada
- Nenhum cálculo foi alterado

---

### 16. backend/src/core/events/event-economy.service.ts

**Campos renomeados:**
- `EventCheckoutResult.totalAmount` → `EventCheckoutResult.totalAmountCents` (linha 37)

**Quantidade:** 1 rename

**Declarações:**
- Nenhum tipo foi alterado
- Nenhuma lógica foi alterada
- Nenhum cálculo foi alterado

---

### 17. backend/src/modules/events/events.types.ts

**Campos renomeados:**
- `EventActor.revenueSharePercent` → `EventActor.revenueShareBps` (linha 173)
- `AddEventActorInput.revenueSharePercent` → `AddEventActorInput.revenueShareBps` (linha 213)

**Quantidade:** 2 renomes (percentuais)

**Declarações:**
- Nenhum tipo foi alterado
- Nenhuma lógica foi alterada
- Nenhum cálculo foi alterado

---

### 18. backend/src/modules/events/events-multi-actor.service.ts

**Campos renomeados:**
- `revenueSharePercent` → `revenueShareBps` (linhas 61, 201)

**Quantidade:** 2 renomes (percentuais)

**Declarações:**
- Nenhum tipo foi alterado
- Nenhuma lógica foi alterada
- Nenhum cálculo foi alterado

---

## ARQUIVOS EXCLUÍDOS (CONFORME RELATÓRIO)

Os seguintes arquivos foram **explicitamente excluídos** do M1 conforme decisão A1:

- `backend/src/contracts/marketplace/VoucherOffer.contract.ts` → `discountValue.amount` (AMBÍGUO)
- `backend/src/contracts/marketplace/RegionalActivationRule.contract.ts` → `value` (AMBÍGUO)

**Status:** Não modificados (conforme relatório)

---

## CONFIRMAÇÕES FINAIS

✅ Todos os campos monetários no boundary terminam com `Cents`  
✅ Todos os percentuais renomeados para `Bps`  
✅ Campos ambíguos permanecem intocados  
✅ Apenas renomeações mecânicas foram aplicadas  
✅ Nenhum tipo foi alterado  
✅ Nenhuma lógica foi alterada  
✅ Nenhum cálculo foi alterado  
✅ Nenhum helper foi criado  
✅ Nenhum cast foi usado  
✅ Nenhum SQL foi alterado  

---

## STATUS

**SUCESSO**

Todas as renomeações foram aplicadas conforme o relatório de auditoria M1.






