# LOG DE EXECUÇÃO — M3 PERCENTAGE BPS NAMING

**Data:** 2026-02-05  
**Modo:** EXECUTOR  
**Norma de Referência:** docs/01_normative/07_NOMENCLATURA_CANONICA.md  
**Parecer de Autorização:** docs/04_audit/dinheiro/M3_execution_clearance.md  
**Auditoria Base:** docs/04_audit/dinheiro/M3_percentage_semantics_audit.md  

---

## RESUMO EXECUTIVO

Total de arquivos modificados: 9  
Total de campos renomeados: 11  

---

## ARQUIVOS MODIFICADOS

### 1. backend/src/modules/services/service-order.service.ts

**Campos renomeados:**
- `PLATFORM_FEE_PERCENTAGE` → `PLATFORM_FEE_BPS` (linha 865)
- `platformFeePercentage` → `platformFeeBps` (linha 878)
- `terms.platformFeePercentage` → `terms.platformFeeBps` (linhas 982, 1001, 1067)

**Quantidade:** 5 renomes

**Declarações:**
- Nenhuma conversão foi feita
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

### 2. backend/src/modules/services/service-order.types.ts

**Campos renomeados:**
- `platformFeePercentage` → `platformFeeBps` (linha 127)

**Quantidade:** 1 rename

**Declarações:**
- Nenhuma conversão foi feita
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

### 3. backend/src/modules/marketplace/regional-fee.types.ts

**Campos renomeados:**
- `feePercentage` → `feeBps` (linhas 26, 41)

**Quantidade:** 2 renomes

**Declarações:**
- Nenhuma conversão foi feita
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

### 4. backend/src/modules/marketplace/regional-fee.service.ts

**Campos ajustados:**
- `input.feePercentage` → `input.feeBps` (linhas 37, 56)

**Quantidade:** 2 ajustes

**Declarações:**
- Nenhuma conversão foi feita
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

### 5. backend/src/contracts/marketplace/ResourceCompensation.contract.ts

**Campos renomeados:**
- `percentValue` → `percentValueBps` (linha 25)
- `variablePercent` → `variablePercentBps` (linha 36)

**Quantidade:** 2 renomes

**Declarações:**
- Nenhuma conversão foi feita
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

### 6. backend/src/modules/marketplace/marketplace.service.ts

**Campos renomeados:**
- `penalty_rate` → `penaltyBps` (linhas 4914, 5151, 5156)
- `hub_margin_percentage` → `hubMarginBps` (linha 3712)
- `store_margin_percentage` → `storeMarginBps` (linha 3713)

**Quantidade:** 5 renomes

**Declarações:**
- Nenhuma conversão foi feita
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

### 7. backend/src/modules/groups/groups.repository.ts

**Campos ajustados:**
- `profitPercentage` → `profitBps` (linha 81)
- `input.profit_percentage` → `input.profitBps` (linha 369)

**Quantidade:** 2 ajustes

**Declarações:**
- Nenhuma conversão foi feita
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

### 8. backend/src/modules/groups/groups.types.ts

**Campos renomeados:**
- `profitPercentage` → `profitBps` (linha 35)
- `profit_percentage` → `profitBps` (linha 91)

**Quantidade:** 2 renomes

**Declarações:**
- Nenhuma conversão foi feita
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

### 9. backend/src/modules/groups/groups.routes.ts

**Campos ajustados:**
- `profit_percentage` → `profitBps` (linha 64)

**Quantidade:** 1 ajuste

**Declarações:**
- Nenhuma conversão foi feita
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

### 10. backend/src/modules/marketplace/decision-simulation.types.ts

**Campos renomeados:**
- `discountPercentage` → `discountBps` (linha 52)

**Quantidade:** 1 rename

**Declarações:**
- Nenhuma conversão foi feita
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

### 11. backend/src/modules/marketplace/decision-simulation.service.ts

**Campos ajustados:**
- `input.discountPercentage` → `input.discountBps` (linha 183)

**Quantidade:** 1 ajuste

**Declarações:**
- Nenhuma conversão foi feita
- Nenhum tipo foi alterado
- Nenhum cálculo foi alterado

---

## ARQUIVOS EXPLICITAMENTE EXCLUÍDOS (CONFORME PARECER)

### ❌ FRAÇÕES (NÃO SÃO PERCENTUAIS)

- `backend/src/modules/marketplace/unifycard-method.types.ts` → `feePercentage` (Fração 0-1)
- `backend/src/modules/marketplace/payment-method.types.ts` → `feePercentage` (Fração 0-1)

**Status:** Não modificados (conforme parecer)

---

### ❌ AMBÍGUOS (REQUEREM DECISÃO SEMÂNTICA)

- `backend/src/modules/marketplace/marketplace.service.ts` → `percentage` (splits) - Ambíguo
- Campos `percentage` (override) - Ambíguo
- `commission.value` quando type === 'percentage' - Ambíguo
- `*Rate` armazenado como 0–1 e exibido como 0–100 - Ambíguo

**Status:** Não modificados (conforme parecer)

---

### ❌ MÉTRICAS CALCULADAS (NÃO ARMAZENADAS)

- Campos `*Rate`, `*Percentage` calculados dinamicamente
- `current_margin_percentage` (métrica calculada)

**Status:** Não modificados (conforme parecer)

---

## CONFIRMAÇÕES FINAIS

✅ Todos os campos percentuais verdadeiros renomeados para `*Bps`  
✅ Nenhum valor foi convertido  
✅ Nenhum tipo foi alterado  
✅ Nenhum cálculo foi alterado  
✅ Campos ambíguos permanecem intocados  
✅ Frações permanecem intocadas  
✅ Métricas calculadas permanecem intocadas  
✅ Apenas renomeações mecânicas foram aplicadas  
✅ Nenhum helper foi criado  
✅ Nenhum cast foi usado  
✅ Nenhum SQL foi alterado  

---

## DECLARAÇÃO FORMAL

**Nenhuma conversão, tipo ou cálculo foi alterado.**

Todas as alterações foram exclusivamente renomeações de identificadores de campos classificados como "Percentual verdadeiro" conforme o parecer de autorização M3.

---

## STATUS

**SUCESSO**

Todas as renomeações foram aplicadas conforme o parecer de autorização M3_execution_clearance.md.


