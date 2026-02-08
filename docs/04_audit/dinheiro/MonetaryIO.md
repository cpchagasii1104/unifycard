# MAPA MONETÁRIO ARQUITETURAL — VALOR COMO APRESENTAÇÃO (MonetaryIO)

## Classificação
Uso de valores monetários **na borda externa do sistema**:
respostas HTTP, mensagens, logs, DTOs públicos e formatação para consumo.
Aqui o dinheiro **não é regra nem persistência** — é **exposição**.

---

### 1. backend/src/modules/services/service-order.service.ts:875-884
**Tipo de saída:** Resposta HTTP (`ServiceOrderFinancialTerms`)  
**Forma:** `number` (centavos)  
**Campos:** `grossAmount`, `platformFee`, `providerNetAmount`  
**Observação:** Valores retornam em centavos, sem formatação.

---

### 2. backend/src/modules/marketplace/marketplace.service.ts:12147
**Tipo de saída:** DTO (`ResourceCompensation`)  
**Forma:** `number`  
**Observação:** Valor calculado retornado cru, sem unidade explícita.

---

### 3. backend/src/modules/marketplace/marketplace.service.ts:12234
**Tipo de saída:** Mensagem de texto (string)  
**Forma:** `${config.min_compensation / 100} ${serviceValue.currency}`  
**Observação:** ÚNICO caso de conversão explícita centavos → valor exibido.

---

### 4. backend/src/modules/social/social-group.repository.ts:60
**Tipo de saída:** DTO (`GroupInsights`)  
**Forma:** `number`  
**Campo:** `totalReceived`  
**Observação:** Saldo retornado sem indicação de unidade.

---

### 5. backend/src/modules/social/social-group.repository.ts:217
**Tipo de saída:** DTO (`GroupFeed`)  
**Forma:** `number`  
**Campo:** `totalReceived`  
**Observação:** Mesmo padrão do insights.

---

### 6. backend/src/modules/social/social-group.repository.ts:166
**Tipo de saída:** Metadata de post  
**Forma:** `number`  
**Campo:** `splitAmount`  
**Observação:** Valor monetário em metadata JSON, sem contrato explícito.

---

### 7. backend/src/modules/social/social-group.repository.ts:264
**Tipo de saída:** Array `{ month: string; amount: number }`  
**Forma:** `number`  
**Observação:** Resultado de agregação mensal, valor já convertido.

---

### 8. backend/src/modules/work/workers/worker.service.ts:45
**Tipo de saída:** DTO (`Worker`)  
**Forma:** `number`  
**Campo:** `totalEarnings`  
**Observação:** Valor acumulado exposto sem unidade explícita.

---

### 9. backend/src/modules/work/assignments/assignment.service.ts:313, 322, 369, 411
**Tipo de saída:** Logs e objetos de split  
**Forma:** `number`  
**Campo:** `amount`  
**Observação:** Valores monetários aparecem em logs sem formatação.

---

### 10. backend/src/modules/work/assignments/assignment.service.ts:268, 283, 323
**Tipo de saída:** Configuração de transação  
**Forma:** string  
**Campo:** `currency`  
**Observação:** Moeda hardcoded como `'BRL'`.

---

## TOTAL
**10 ocorrências classificadas como MonetaryIO**

---

## Observações gerais

- A maioria das respostas retorna valores **em centavos**, sem conversão.
- Apenas **um** ponto formata valor para exibição humana.
- Unidade monetária raramente é explícita no contrato.
- Logs e mensagens expõem valores crus.
- Moeda aparece como string fixa, sem estratégia global.

Este documento **não corrige**.  
Ele **define onde o dinheiro sai do sistema**.

**FIM DO DOCUMENTO**
