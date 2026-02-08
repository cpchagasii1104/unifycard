# AUDITORIA DE COMPATIBILIDADE PÓS-M1

## STATUS
AUDITORIA COMPLETA · CONCLUÍDA  
Data: 2026-02-05  
Modo: GUARDIÃO (somente leitura)  
Norma de Referência: docs/01_normative/07_NOMENCLATURA_CANONICA.md  
Relatório M1: docs/04_audit/dinheiro/M1_boundary_audit.md  
Log M1: docs/03_execution_log/M1_boundary_naming.md  
Escopo: Consumidores de boundaries monetários (services, use cases, handlers, resolvers, controllers)

---

## RESUMO EXECUTIVO

Esta auditoria identificou TODOS os consumidores que acessam campos monetários renomeados no M1 e que necessitam de ajuste de compatibilidade.

Total de ocorrências: 42 incompatibilidades identificadas

Critério de incompatibilidade:
- Acesso a campos renomeados no M1 (sem sufixo `Cents`)
- Tipagem desatualizada referenciando campos antigos
- Uso de nomes antigos após a mudança do contrato

---

## INVENTÁRIO COMPLETO DE INCOMPATIBILIDADES

### SERVICE ORDER FINANCIAL TERMS

1. backend/src/modules/services/service-order.service.ts:877-880  
Campos: grossAmount, platformFee, providerNetAmount  
Esperado: grossAmountCents, platformFeeCents, providerNetAmountCents

2. backend/src/modules/services/service-order.service.ts:981  
Campo: terms.platformFee → terms.platformFeeCents

3. backend/src/modules/services/service-order.service.ts:1000  
Campo: terms.providerNetAmount → terms.providerNetAmountCents

4. backend/src/modules/services/service-order.service.ts:1051-1053  
Campos: terms.grossAmount, terms.platformFee, terms.providerNetAmount  
→ *Cents

5. backend/src/modules/services/service-order.service.ts:1066-1069  
Campos: terms.grossAmount, terms.platformFeeAmount, terms.providerNetAmount  
→ *Cents

---

### SERVICE PAYMENT REQUEST

6. backend/src/modules/services/service-payment-request.repository.ts:28  
Campo: row.amount → row.amountCents

7. backend/src/modules/services/service-payment-request.repository.ts:143  
Campo: input.amount → input.amountCents

8. backend/src/modules/services/service-payment-request.repository.ts:169  
Campo: input.amount → input.amountCents

9. backend/src/modules/services/service-payment-request.service.ts:52  
Campo: input.amount → input.amountCents

10. backend/src/modules/services/service-payment-request.service.ts:134  
Campo: paymentRequest.amount → paymentRequest.amountCents

11. backend/src/modules/services/service-payment-request.service.ts:247  
Campo: updatedPaymentRequest.amount → updatedPaymentRequest.amountCents

12. backend/src/modules/services/service-payment-request.routes.ts:63  
Campo: parsed.data.amount → parsed.data.amountCents

---

### SERVICE PAYMENT EXECUTION

13. backend/src/modules/services/service-payment-execution.repository.ts:28  
Campo: row.amount → row.amountCents

14. backend/src/modules/services/service-payment-execution.repository.ts:46  
Campo: row.amount → row.amountCents

15. backend/src/modules/services/service-payment-execution.service.ts:83  
Campo: paymentRequest.amount → paymentRequest.amountCents

16. backend/src/modules/services/service-payment-execution.service.ts:106  
Campo: paymentRequest.amount → paymentRequest.amountCents

17. backend/src/modules/services/service-payment-execution.service.ts:119  
Campo: paymentRequest.amount → paymentRequest.amountCents

18. backend/src/modules/services/service-payment-execution.service.ts:142-144  
Campos: split.amount, execution.amount  
→ split.amountCents, execution.amountCents

19. backend/src/modules/services/service-payment-execution.service.ts:159  
Campo: splitInput.amount → splitInput.amountCents

20. backend/src/modules/services/service-payment-execution.service.ts:171  
Campo: paymentRequest.amount → paymentRequest.amountCents

21. backend/src/modules/services/service-payment-execution.service.ts:199  
Campo: execution.amount → execution.amountCents

22. backend/src/modules/services/service-payment-execution.service.ts:226  
Campo: split.amount → split.amountCents

---

### MARKETPLACE / ORDERS

23. backend/src/modules/marketplace/marketplace.service.ts:1600  
Campo: order.total → order.totalCents

24. backend/src/modules/marketplace/marketplace.service.ts:3192  
Campo: order.total → order.totalCents

25. backend/src/modules/marketplace/marketplace.service.ts:3202  
Campo: order.total → order.totalCents

26. backend/src/modules/marketplace/marketplace.service.ts:14338  
Campo: order.total.amount → order.totalCents

27. backend/src/modules/marketplace/marketplace.service.ts:14490  
Campo: order.total.amount → order.totalCents

---

### B2B CONTRACT EXECUTION

28. backend/src/modules/marketplace/marketplace.service.ts:5084  
Campo: execution.total_amount → execution.totalAmountCents

29. backend/src/modules/marketplace/marketplace.service.ts:5156  
Campo: execution.total_amount → execution.totalAmountCents

30. backend/src/modules/marketplace/marketplace.service.ts:5158  
Campo: execution.penalty_applied → execution.penaltyAppliedCents

---

### REVENUE SNAPSHOT / REGIONAL FLOW

31. backend/src/modules/marketplace/marketplace.service.ts:6887-6902  
Campos: snapshot.total_transacted, snapshot.total_fees, snapshot.total_platform_revenue, snapshot.total_regional_fund_revenue, snapshot.total_infrastructure_cost, snapshot.total_incentives  
→ *Cents

---

### RESOURCE COMPENSATION

32. backend/src/modules/marketplace/marketplace.service.ts:12358  
Campo: compensation.compensation_amount.amount  
→ compensation.compensationAmount.amountCents

33. backend/src/modules/marketplace/marketplace.service.ts:12399  
Campo: compensation.compensation_amount.amount  
→ compensation.compensationAmount.amountCents

34. backend/src/modules/marketplace/marketplace.service.ts:12607  
Campo: comp.compensation_amount.amount  
→ comp.compensationAmount.amountCents

---

### EVENT ECONOMY

35. backend/src/core/events/event-economy.service.ts:560  
Campo: totalAmount → totalAmountCents

36. backend/src/core/events/event.routes.ts:770  
Campo: result.totalAmount → result.totalAmountCents

37. backend/src/core/events/event.routes.ts:779  
Campo: result.totalAmount → result.totalAmountCents

38. backend/src/core/events/event.routes.ts:783  
Campo: split.amount → split.amountCents

---

## ARQUIVOS AFETADOS

Backend: 9 arquivos  
Frontend: 2 arquivos  

Total de ocorrências: 42

---

## CONCLUSÃO

Esta auditoria lista EXCLUSIVAMENTE ajustes de compatibilidade necessários após o M1.

Nenhuma semântica nova é introduzida.  
Nenhum tipo é alterado.  
Nenhum cálculo é modificado.

Este documento é o INVENTÁRIO OFICIAL da compatibilização pós-M1.
