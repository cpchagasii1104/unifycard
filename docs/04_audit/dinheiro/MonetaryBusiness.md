# MAPA MONETÁRIO ARQUITETURAL — VALOR COMO REGRA (MonetaryBusiness)

## Classificação
Uso de valores monetários em **cálculo**, **validação**, **distribuição**, **arredondamento** e **regras financeiras**.
Aqui o dinheiro **é lógica**, não armazenamento nem formatação.

---

### 1. backend/src/modules/cultural/cultural-event.service.ts:75-76
**Trecho:** `const total = split.reduce((sum, s) => sum + s.percentage, 0); if (total !== 100)`  
**Regra:** Validação de soma de percentuais  
**Observação:** Percentual tratado como número “puro” (0–100), sem `_bps`.

---

### 2. backend/src/modules/cultural/cultural-event.service.ts:82-83
**Trecho:** `if (s.percentage < 0 || s.percentage > 100)`  
**Regra:** Validação de faixa percentual  
**Observação:** Percentual sem unidade explícita.

---

### 3. backend/src/modules/services/service-order.service.ts:859
**Trecho:** `const grossAmountCents = service.priceCents || order.metadata?.amountCents || 0;`  
**Regra:** Seleção de valor bruto por prioridade  
**Observação:** Cadeia de fallback pode mascarar ausência de dado.

---

### 4. backend/src/modules/services/service-order.service.ts:865-867
**Trecho:**  
`const PLATFORM_FEE_PERCENTAGE = 3;  
const platformFeeCents = Math.round((grossAmountCents * PLATFORM_FEE_PERCENTAGE) / 100);  
const providerNetAmountCents = grossAmountCents - platformFeeCents;`  
**Regra:** Cálculo de comissão e valor líquido  
**Observação:** Percentual hardcoded; arredondamento aplicado.

---

### 5. backend/src/core/economy/distribution/distribution.service.ts:39-41
**Trecho:**  
`const platformFee = (amount * finalConfig.platformFeePercent) / 100;  
const communityFee = (amount * finalConfig.communityFeePercent) / 100;  
const groupFee = (amount * finalConfig.groupFeePercent) / 100;`  
**Regra:** Distribuição percentual de valores  
**Observação:** Percentuais tratados como 0–100.

---

### 6. backend/src/core/economy/distribution/distribution.service.ts:44
**Trecho:** `const totalFees = platformFee + communityFee + groupFee;`  
**Regra:** Soma de taxas  
**Observação:** Risco de acúmulo de erro de ponto flutuante.

---

### 7. backend/src/core/economy/distribution/distribution.service.ts:47
**Trecho:** `const netAmount = amount - totalFees;`  
**Regra:** Cálculo de valor líquido  
**Observação:** Dependente da precisão dos cálculos anteriores.

---

### 8. backend/src/core/economy/distribution/distribution.service.ts:51-55
**Trecho:**  
`Math.round(value * 100) / 100` (aplicado a todos os valores)  
**Regra:** Arredondamento para duas casas decimais  
**Observação:** Indica possível mistura entre centavos e valores “reais”.

---

### 9. backend/src/modules/marketplace/marketplace.service.ts:12197
**Trecho:** `compensationAmount = Math.round((serviceValue.amount * config.percent_value) / 100);`  
**Regra:** Cálculo de compensação percentual (fixed_percent)

---

### 10. backend/src/modules/marketplace/marketplace.service.ts:12220
**Trecho:** `const variableAmount = Math.round((serviceValue.amount * config.variable_percent) / 100);`  
**Regra:** Cálculo de parcela variável (modelo misto)

---

### 11. backend/src/modules/marketplace/marketplace.service.ts:12228-12230
**Trecho:**  
`if (config.min_compensation && compensationAmount < config.min_compensation) { ... }`  
**Regra:** Aplicação de limite mínimo de compensação

---

### 12. backend/src/modules/marketplace/marketplace.service.ts:12238
**Trecho:** `if (config.max_compensation && compensationAmount > config.max_compensation)`  
**Regra:** Aplicação de limite máximo de compensação

---

### 13. backend/src/modules/marketplace/purchase-order.service.ts:254-265
**Trecho:**  
Soma de itens com proporção por quantidade recebida  
**Regra:** Cálculo de total de ordem de compra  
**Observação:** Uso de `Math.round` por item.

---

### 14. backend/src/modules/social/social-group.repository.ts:249
**Trecho:** `SUM((metadata->>'splitAmount')::numeric) as amount`  
**Regra:** Agregação monetária em SQL  
**Observação:** Valor monetário armazenado em metadata JSONB.

---

### 15. backend/src/modules/social/social-group.repository.ts:52
**Trecho:** `avgPostPerMember: memberCount > 0 ? recentPosts / memberCount : 0`  
**Regra:** Cálculo aritmético simples  
**Observação:** Não monetário, mas lógica numérica semelhante.

---

## TOTAL
**15 ocorrências classificadas como MonetaryBusiness**

---

## Observações gerais

- Percentuais tratados como 0–100, não `_bps`.
- Uso frequente de `Math.round()` em pontos críticos.
- Possível mistura conceitual entre centavos e valores decimais.
- Regras financeiras estão espalhadas entre modules, core e marketplace.

Este documento **não corrige**.
Ele **delimita onde o dinheiro vira regra de negócio**.

**FIM DO DOCUMENTO**
