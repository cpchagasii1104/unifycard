# MAPA MONETÁRIO ARQUITETURAL — VALOR COMO DADO (MonetaryDomain)

## Classificação
Campos monetários persistidos, contratos, DTOs, entidades e metadata.
Aqui o dinheiro **é dado**, não cálculo nem formatação.

---

### 1. backend/src/modules/groups/groups.repository.ts:24
**Campo:** `profit_percentage`  
**Tipo observado:** number | null (DB), number (DTO)  
**Camada:** repository / DTO  
**Contexto:** Percentual de lucro persistido em tabela `groups`.  
**Observação:** Percentual sem sufixo de unidade (não usa `_bps`).

---

### 2. backend/src/modules/groups/groups.repository.ts:81
**Campo:** `profitPercentage`  
**Tipo observado:** number  
**Camada:** repository (Row → DTO)  
**Contexto:** Conversão de `profit_percentage` para camelCase no DTO.

---

### 3. backend/src/modules/cultural/cultural-event.service.ts:48
**Campo:** `ticket_price_cents`  
**Tipo observado:** number | null  
**Camada:** Row (DB)  
**Contexto:** Preço de ingresso persistido explicitamente em centavos.

---

### 4. backend/src/modules/cultural/cultural-event.service.ts:65
**Campo:** `ticket_price_cents`  
**Tipo observado:** number | null  
**Camada:** DTO (input)  
**Contexto:** Valor recebido na criação de evento cultural.

---

### 5. backend/src/modules/cultural/cultural-event.service.ts:168
**Campo:** `ticket_price_cents`  
**Tipo observado:** number | null  
**Camada:** Row (query SQL)  
**Contexto:** Valor retornado diretamente do banco.

---

### 6. backend/src/modules/cultural/cultural-event.service.ts:246
**Campo:** `ticket_price_cents`  
**Tipo observado:** number | null  
**Camada:** DTO (retorno)  
**Contexto:** Valor monetário exposto no objeto `CulturalEvent`.

---

### 7. backend/src/modules/cultural/cultural-event.service.ts:299, 415, 509, 647, 740
**Campo:** `ticket_price_cents`  
**Tipo observado:** number | null  
**Camada:** Row  
**Contexto:** Uso recorrente do mesmo campo monetário persistido.

---

### 8. backend/src/modules/cultural/cultural-event.service.ts:29
**Campo:** `percentage` (RevenueSplit)  
**Tipo observado:** number  
**Camada:** domínio  
**Contexto:** Percentual de divisão de receita (sem unidade explícita).

---

### 9. backend/src/modules/work/workers/worker.service.ts:37
**Campo:** `hourlyRate`  
**Tipo observado:** number | undefined  
**Camada:** DTO  
**Contexto:** Conversão de `hourly_rate` do banco.  
**Observação:** Unidade monetária não explícita (centavos? reais?).

---

### 10. backend/src/modules/work/workers/worker.service.ts:45
**Campo:** `totalEarnings`  
**Tipo observado:** number  
**Camada:** DTO  
**Contexto:** Total de ganhos acumulados do worker.

---

### 11. backend/src/modules/work/assignments/assignment.service.ts:30
**Campo:** `agreedRate`  
**Tipo observado:** number  
**Camada:** DTO  
**Contexto:** Valor acordado para a tarefa.  
**Observação:** Unidade monetária não explícita.

---

### 12. backend/src/modules/work/applications/application.service.ts:21
**Campo:** `proposedRate`  
**Tipo observado:** number  
**Camada:** DTO  
**Contexto:** Valor proposto em candidatura de trabalho.

---

### 13. backend/src/modules/services/services.repository.ts:25
**Campo:** `priceCents`  
**Tipo observado:** number  
**Camada:** DTO  
**Contexto:** Preço de serviço persistido explicitamente em centavos.

---

### 14. backend/src/modules/services/services.repository.ts:159
**Campo:** `priceCents`  
**Tipo observado:** number | null  
**Camada:** DTO (input)  
**Contexto:** Valor monetário opcional na criação de serviço.

---

### 15. backend/src/core/events/event.service.ts:40
**Campo:** `ticket_price_cents`  
**Tipo observado:** number | null  
**Camada:** Row (DB)  
**Contexto:** Preço do ingresso em eventos (centavos).

---

### 16. backend/src/core/events/event.service.ts:66
**Campo:** `ticketPriceCents`  
**Tipo observado:** number | null  
**Camada:** DTO  
**Contexto:** Conversão de snake_case para camelCase.

---

### 17. backend/src/modules/events/events-multi-actor.service.ts:61
**Campo:** `revenueSharePercent`  
**Tipo observado:** number | null  
**Camada:** DTO  
**Contexto:** Percentual de participação na receita.  
**Observação:** Percentual sem padronização de unidade.

---

### 18. backend/src/modules/social/social-group.repository.ts:166
**Campo:** `splitAmount` (metadata)  
**Tipo observado:** number  
**Camada:** metadata (JSONB)  
**Contexto:** Valor monetário associado a posts/grupos.

---

### 19. backend/src/modules/marketplace/purchase-order.service.ts:259-265
**Campo:** `unitPriceCents`, `totalPriceCents`  
**Tipo observado:** number  
**Camada:** DTO  
**Contexto:** Valores monetários de itens de ordem de compra.

---

### 20. backend/src/modules/services/service-order.service.ts:859
**Campo:** `priceCents`, `amountCents` (metadata)  
**Tipo observado:** number  
**Camada:** DTO / metadata  
**Contexto:** Valores monetários associados a pedidos de serviço.

---

## TOTAL
**20 ocorrências classificadas como MonetaryDomain**

---

## Observações gerais

- Campos com sufixo `_cents` estão claros e corretos.
- Campos sem sufixo (`rate`, `earnings`, `percentage`) **não explicitam unidade**.
- Percentuais não usam `_bps`.
- Metadata monetária existe (JSONB), o que aumenta ambiguidade sem contrato explícito.

Este documento **não propõe correções**.
Ele define o **mapa canônico do dinheiro como dado** no sistema.

**FIM DO DOCUMENTO**
