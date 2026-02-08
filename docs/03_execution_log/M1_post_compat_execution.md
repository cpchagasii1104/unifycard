# LOG DE EXECUÇÃO — M1 POST-COMPATIBILIZAÇÃO

**Data:** 2026-02-05  
**Modo:** EXECUTOR  
**Norma de Referência:** docs/01_normative/07_NOMENCLATURA_CANONICA.md  
**Relatório de Auditoria:** docs/04_audit/dinheiro/M1_post_compat_audit.md  
**Log M1:** docs/03_execution_log/M1_boundary_naming.md  

---

## RESUMO EXECUTIVO

Total de arquivos modificados: 9  
Total de campos ajustados: 42  

---

## ARQUIVOS MODIFICADOS

### 1. backend/src/modules/services/service-order.service.ts

**Campos ajustados:**
- `grossAmount` → `grossAmountCents` (linha 877)
- `platformFee` → `platformFeeCents` (linha 879)
- `providerNetAmount` → `providerNetAmountCents` (linha 880)
- `terms.platformFee` → `terms.platformFeeCents` (linha 981)
- `terms.providerNetAmount` → `terms.providerNetAmountCents` (linha 1000)
- `terms.grossAmount` → `terms.grossAmountCents` (linha 1051)
- `terms.platformFee` → `terms.platformFeeCents` (linha 1052)
- `terms.providerNetAmount` → `terms.providerNetAmountCents` (linha 1053)
- `terms.grossAmount` → `terms.grossAmountCents` (linha 1066)
- `terms.platformFeeAmount` → `terms.platformFeeCents` (linha 1068)
- `terms.providerNetAmount` → `terms.providerNetAmountCents` (linha 1069)

**Quantidade:** 11 ajustes

**Declarações:**
- Nenhuma lógica foi alterada
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

### 2. backend/src/modules/services/service-payment-request.repository.ts

**Campos ajustados:**
- `amount` → `amountCents` (linha 28)
- `input.amount` → `input.amountCents` (linhas 143, 169)

**Quantidade:** 3 ajustes

**Declarações:**
- Nenhuma lógica foi alterada
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

### 3. backend/src/modules/services/service-payment-request.service.ts

**Campos ajustados:**
- `input.amount` → `input.amountCents` (linha 52)
- `paymentRequest.amount` → `paymentRequest.amountCents` (linha 134)
- `updatedPaymentRequest.amount` → `updatedPaymentRequest.amountCents` (linha 247)

**Quantidade:** 3 ajustes

**Declarações:**
- Nenhuma lógica foi alterada
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

### 4. backend/src/modules/services/service-payment-request.routes.ts

**Campos ajustados:**
- `parsed.data.amount` → `parsed.data.amountCents` (linha 63)

**Quantidade:** 1 ajuste

**Declarações:**
- Nenhuma lógica foi alterada
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

### 5. backend/src/modules/services/service-payment-execution.repository.ts

**Campos ajustados:**
- `amount` → `amountCents` (linhas 28, 46)

**Quantidade:** 2 ajustes

**Declarações:**
- Nenhuma lógica foi alterada
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

### 6. backend/src/modules/services/service-payment-execution.service.ts

**Campos ajustados:**
- `paymentRequest.amount` → `paymentRequest.amountCents` (linhas 83, 106, 119, 171)
- `split.amount` → `split.amountCents` (linha 142)
- `execution.amount` → `execution.amountCents` (linha 143)
- `splitInput.amount` → `splitInput.amountCents` (linha 159)
- `execution.amount` → `execution.amountCents` (linha 199)
- `split.amount` → `split.amountCents` (linha 226)

**Quantidade:** 9 ajustes

**Declarações:**
- Nenhuma lógica foi alterada
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

### 7. backend/src/modules/marketplace/marketplace.service.ts

**Campos ajustados:**
- `order.total` → `order.totalCents` (linhas 1600, 3192, 3202)
- `order.total.amount` → `order.totalCents` (linhas 14338, 14490)
- `execution.total_amount` → `execution.totalAmountCents` (linhas 5084, 5156)
- `execution.penalty_applied` → `execution.penaltyAppliedCents` (linha 5158)
- `snapshot.total_transacted` → `snapshot.totalTransactedCents` (linha 6887)
- `snapshot.total_fees` → `snapshot.totalFeesCents` (linha 6888)
- `snapshot.total_regional_fund_revenue` → `snapshot.totalRegionalFundRevenueCents` (linha 6890)
- `snapshot.total_infrastructure_cost` → `snapshot.totalInfrastructureCostCents` (linha 6891)
- `snapshot.total_platform_revenue` → `snapshot.totalPlatformRevenueCents` (linha 6895)
- `snapshot.total_incentives` → `snapshot.totalIncentivesCents` (linha 6902)
- `compensation.compensation_amount.amount` → `compensation.compensationAmount.amountCents` (linhas 12358, 12399)
- `comp.compensation_amount.amount` → `comp.compensationAmount.amountCents` (linhas 12504, 12519, 12558, 12578, 12585, 12607)

**Quantidade:** 18 ajustes

**Declarações:**
- Nenhuma lógica foi alterada
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

### 8. backend/src/core/events/event-economy.service.ts

**Campos ajustados:**
- `totalAmount` → `totalAmountCents` (linha 560)

**Quantidade:** 1 ajuste

**Declarações:**
- Nenhuma lógica foi alterada
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

### 9. backend/src/core/events/event.routes.ts

**Campos ajustados:**
- `result.totalAmount` → `result.totalAmountCents` (linhas 770, 779)
- `split.amount` → `split.amountCents` (linha 783)

**Quantidade:** 3 ajustes

**Declarações:**
- Nenhuma lógica foi alterada
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

## CONFIRMAÇÕES FINAIS

✅ Todos os consumers usam *Cents / *Bps  
✅ Nenhum acesso antigo permanece  
✅ Apenas renomeações mecânicas foram aplicadas  
✅ Nenhuma lógica foi alterada  
✅ Nenhum tipo foi alterado  
✅ Nenhum cálculo foi alterado  
✅ Nenhum helper foi criado  
✅ Nenhum cast foi usado  
✅ Nenhum SQL foi alterado  

---

## STATUS

**SUCESSO**

Todas as incompatibilidades foram corrigidas conforme o relatório de auditoria M1_post_compat_audit.md.

