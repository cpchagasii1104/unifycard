# AUDITORIA DE NOMENCLATURA MONETÁRIA - BOUNDARIES (M1)

## STATUS
AUDITORIA COMPLETA · CONCLUÍDA  
Data: 2026-02-05  
Modo: GUARDIÃO (somente leitura)  
Norma de Referência: docs/01_normative/07_NOMENCLATURA_CANONICA.md  
Escopo: Boundaries (DTOs, mappers, adapters, serializers, IO)

---

## RESUMO EXECUTIVO

Esta auditoria identificou TODOS os campos monetários em boundaries que violam a nomenclatura canônica monetária definida na norma.

Total de ocorrências: 52 violações identificadas

Critério de violação:
- Campos monetários sem sufixo `Cents` (API/backend) ou `_cents` (DB)
- Campos com nomes ambíguos (`amount`, `total`, `fee`, `price`, `value`) sem unidade explícita
- Campos que não explicitam se estão em centavos ou reais

---

## INVENTÁRIO COMPLETO DE VIOLAÇÕES

### CATEGORIA: BOUNDARY / CONTRATO PÚBLICO (API)

1. backend/src/contracts/marketplace/Order.contract.ts:33  
Campo: total → totalCents  
Risco: ALTO

2. backend/src/contracts/marketplace/Order.contract.ts:26-28  
Campo: price.amount → price.amountCents  
Risco: ALTO

3. backend/src/contracts/marketplace/ServiceOrder.contract.ts:21-23  
Campo: price.amount → price.amountCents  
Risco: ALTO

4. backend/src/contracts/marketplace/ServiceQuote.contract.ts:25-27  
Campo: serviceValue.amount → serviceValue.amountCents  
Risco: ALTO

5. backend/src/contracts/marketplace/ServicePaymentHold.contract.ts:24  
Campo: amount → amountCents  
Risco: ALTO

6. backend/src/contracts/marketplace/ResourceCompensation.contract.ts:63  
Campo: serviceValue.amount → serviceValue.amountCents  
Risco: MÉDIO

7. backend/src/contracts/marketplace/ResourceCompensation.contract.ts:69  
Campo: compensationAmount.amount → compensationAmount.amountCents  
Risco: MÉDIO

8. backend/src/contracts/marketplace/ResourceCompensation.contract.ts:81  
Campo: adjustments[].amount → adjustments[].amountCents  
Risco: MÉDIO

9. backend/src/contracts/marketplace/ResourceCompensation.contract.ts:113  
Campo: totalCompensation.amount → totalCompensation.amountCents  
Risco: MÉDIO

10. backend/src/contracts/marketplace/ResourceCompensation.contract.ts:117  
Campo: averagePerService.amount → averagePerService.amountCents  
Risco: MÉDIO

11. backend/src/contracts/marketplace/ResourceCompensation.contract.ts:124  
Campo: byModel[].total → byModel[].totalCents  
Risco: MÉDIO

12. backend/src/contracts/marketplace/ResourceCompensation.contract.ts:144  
Campo: totalCompensationsPaid.amount → totalCompensationsPaid.amountCents  
Risco: MÉDIO

13. backend/src/contracts/marketplace/ResourceCompensation.contract.ts:157  
Campo: byResource[].totalCompensation.amount → byResource[].totalCompensation.amountCents  
Risco: MÉDIO

14. backend/src/contracts/marketplace/ResourceCompensation.contract.ts:167  
Campo: byModel[].totalCompensation.amount → byModel[].totalCompensation.amountCents  
Risco: MÉDIO

15. backend/src/contracts/marketplace/ResourceCompensation.contract.ts:28  
Campo: fixedAmount → fixedAmountCents  
Risco: MÉDIO

16. backend/src/contracts/marketplace/ResourceCompensation.contract.ts:32  
Campo: monthlySalary → monthlySalaryCents  
Risco: MÉDIO

17. backend/src/contracts/marketplace/ResourceCompensation.contract.ts:35  
Campo: baseSalary → baseSalaryCents  
Risco: MÉDIO

18. backend/src/contracts/marketplace/ResourceCompensation.contract.ts:39-40  
Campos: minCompensation, maxCompensation → minCompensationCents, maxCompensationCents  
Risco: MÉDIO

19. backend/src/contracts/marketplace/VoucherOffer.contract.ts:80  
Campo: discountValue.amount  
Classificação: AMBÍGUO — EXCLUÍDO DO M1

20. backend/src/contracts/marketplace/RevenueSnapshot.contract.ts  
Múltiplos campos totalAmount, platformRevenue, regionalFundRevenue, infrastructureCost  
Todos → *Cents  
Risco: ALTO

21. backend/src/contracts/marketplace/RegionalFinancialFlow.contract.ts  
Campos totalTransacted, totalFees, totalRevenue, netBalance, etc.  
Todos → *Cents  
Risco: ALTO

22. backend/src/contracts/marketplace/B2BContractExecution.contract.ts  
Campos unitPrice, subtotal, totalAmount, penaltyApplied  
Todos → *Cents  
Risco: ALTO

23. backend/src/contracts/marketplace/PricingAssistanceReport.contract.ts  
Campos *.amount em estruturas com currency  
Todos → amountCents  
Risco: MÉDIO

24. backend/src/contracts/marketplace/ProductionBatch.contract.ts:32  
Campo: unitPrice.amount → unitPrice.amountCents  
Risco: ALTO

25. backend/src/contracts/marketplace/RegionalActivationRule.contract.ts:32  
Campo: value  
Classificação: AMBÍGUO — EXCLUÍDO DO M1

26. backend/src/contracts/marketplace/RegionalFundAllocation.contract.ts:32  
Campo: amount → amountCents  
Risco: ALTO

27. backend/src/contracts/marketplace/IncentiveRule.contract.ts:32  
Campo: maxAmount → maxAmountCents  
Risco: ALTO

---

### CATEGORIA: BOUNDARY / DTO INTERNO

28. backend/src/modules/services/service-order.types.ts  
Campos: grossAmount, platformFee, providerNetAmount → *Cents  
Risco: MÉDIO

29. backend/src/modules/services/service-payment-request.types.ts  
Campo: amount → amountCents  
Risco: ALTO

30. backend/src/modules/services/service-payment-execution.types.ts  
Campo: amount → amountCents  
Risco: ALTO

31. backend/src/modules/services/service-payment-execution.types.ts  
Campo: PaymentSplit.amount → amountCents  
Risco: ALTO

32. backend/src/core/events/event-economy.service.ts  
Campo: totalAmount → totalAmountCents  
Risco: MÉDIO

---

### CATEGORIA: BOUNDARY / MAPPER (DB ↔ BACKEND)

Mappers verificados e CONFORMES (não tocar):
- accounts-payable.repository.ts
- accounts-receivable.repository.ts
- purchase-order.repository.ts
- invoice.repository.ts
- settlement.repository.ts

---

## DECISÕES DE GOVERNANÇA APLICADAS

- Percentuais: RENOMEAR para sufixo `Bps` (SEM conversão)
- Campos ambíguos: EXCLUÍDOS do M1 (não tocar)

---

## CONCLUSÃO

Total de violações: 52  
Total de campos conformes: 5  
Status: FAIL (violações encontradas — esperado para execução do M1)

Nenhum código foi alterado durante esta auditoria.

Este documento é a ÂNCORA OFICIAL do Gate M1.
