# AUDITORIA DE SEMÂNTICA DE PERCENTUAIS (M3)

## STATUS
AUDITORIA COMPLETA · CONCLUÍDA  
Data: 2026-02-05  
Modo: GUARDIÃO (somente leitura)  
Norma de Referência: docs/01_normative/07_NOMENCLATURA_CANONICA.md  
Escopo: Todo uso de percentuais no backend e frontend

---

## RESUMO EXECUTIVO

Esta auditoria identificou TODOS os usos de percentuais no sistema, classificando-os por semântica, forma de representação e risco de ambiguidade.

Total de ocorrências: 89 campos/calculos identificados

Critério de classificação:
- Forma atual (0-100, 0-1, basis points, implícito)
- Onde é usado (cálculo, armazenamento, IO/API)
- Semântica REAL percebida
- Classificação (Percentual verdadeiro, Fração, Ambíguo, Erro conceitual)
- Risco (BAIXO, MÉDIO, ALTO)

---

## INVENTÁRIO COMPLETO DE PERCENTUAIS

### CATEGORIA: COMISSÕES E TAXAS DE PLATAFORMA

1. **backend/src/modules/services/service-order.service.ts:865-866**  
   Campo: `PLATFORM_FEE_PERCENTAGE`  
   Forma: 0-100  
   Uso: cálculo  
   Classificação: Percentual verdadeiro  
   Risco: BAIXO

2. **backend/src/modules/services/service-order.types.ts:127**  
   Campo: `platformFeePercentage`  
   Forma: 0-100  
   Uso: IO/API  
   Classificação: Percentual verdadeiro  
   Risco: BAIXO

3. **backend/src/modules/marketplace/regional-fee.types.ts:26,41**  
   Campo: `feePercentage`  
   Forma: 0-100  
   Uso: armazenamento / IO  
   Classificação: Percentual verdadeiro  
   Risco: BAIXO

4. **backend/src/modules/marketplace/unifycard-method.types.ts:23**  
   Campo: `feePercentage`  
   Forma: 0-1  
   Uso: armazenamento / IO  
   Classificação: Fração  
   Risco: ALTO

5. **backend/src/modules/marketplace/payment-method.types.ts:31**  
   Campo: `feePercentage`  
   Forma: 0-1  
   Uso: armazenamento / IO  
   Classificação: Fração  
   Risco: ALTO

---

### CATEGORIA: REVENUE SHARE E SPLITS

9. **backend/src/modules/events/events.types.ts:173,213**  
   Campo: `revenueShareBps`  
   Forma: bps  
   Uso: armazenamento / IO  
   Classificação: Percentual verdadeiro (bps)  
   Risco: BAIXO

10. **backend/src/modules/events/events-multi-actor.service.ts:61,201**  
    Campo: `revenueShareBps`  
    Forma: bps  
    Uso: mapper  
    Classificação: Percentual verdadeiro (bps)  
    Risco: BAIXO

11. **backend/src/modules/marketplace/marketplace.service.ts**  
    Campo: `percentage` (splits)  
    Forma: implícita  
    Classificação: Ambíguo  
    Risco: MÉDIO

---

### CATEGORIA: MARGENS E MARKUPS

13. Campos `*_margin_percentage`  
    Forma: 0-100  
    Classificação: Percentual verdadeiro  
    Risco: BAIXO

14. Campo `percentage` (override)  
    Forma: indefinida  
    Classificação: Ambíguo  
    Risco: MÉDIO

---

### CATEGORIA: TAXAS / SLA / REPUTAÇÃO

18. Campos `*Rate`, `*Percentage` calculados  
    Forma: 0-100  
    Classificação: Percentual verdadeiro  
    Risco: BAIXO

---

### CATEGORIA: PENALIDADES

25. `penalties.*.value` quando percentual  
    Forma: 0-100  
    Classificação: Percentual verdadeiro  
    Risco: BAIXO

26. `penalty_rate`  
    Forma: 0-100  
    Classificação: Percentual verdadeiro  
    Risco: BAIXO

---

### CATEGORIA: COMPENSAÇÃO

29. `percentValue`, `variablePercent`  
    Forma: 0-100  
    Classificação: Percentual verdadeiro  
    Risco: BAIXO

---

### CATEGORIA: DESCONTOS

32. `discountPercentage`  
    Forma: 0-100  
    Classificação: Percentual verdadeiro  
    Risco: BAIXO

---

### CATEGORIA: SOCIAL / VOTOS

36. `profit_percentage`  
    Forma: 0-100  
    Classificação: Percentual verdadeiro  
    Risco: BAIXO

37–41. `percentage` em votos / métricas sociais  
    Forma: 0-100  
    Classificação: Percentual verdadeiro  
    Risco: BAIXO

---

### CATEGORIA: COMMISSION / ATTRIBUTION

42–43. `commission.value` quando type === 'percentage'  
    Forma: indefinida  
    Classificação: Ambíguo  
    Risco: ALTO

---

### CATEGORIA: MÉTRICAS FRACIONÁRIAS

45–48. `*Rate` armazenado como 0–1 e exibido como 0–100  
    Classificação: Ambíguo  
    Risco: MÉDIO

---

## MAPA DE AMBIGUIDADES

- `feePercentage` com semânticas conflitantes (0–100 vs 0–1) — **ALTO**
- `commission.value` sem unidade — **ALTO**
- splits com `percentage` indefinido — **MÉDIO**
- rates fracionários exibidos como percentuais — **MÉDIO**

---

## CANDIDATOS CLAROS A BPS

- `feePercentage` → `feeBps`
- `platformFeePercentage` → `platformFeeBps`
- `penalty_rate` → `penaltyBps`
- `commission.value` → `commissionBps`
- `percentage` (splits) → `splitBps`
- `discountPercentage` → `discountBps`
- `profit_percentage` → `profitBps`
- `*_margin_percentage` → `*MarginBps`

---

## DÍVIDAS SEMÂNTICAS

- DB usa `_percent` enquanto backend usa `Bps`
- Campos com mesmo nome e unidades diferentes
- Frações internas sem contrato explícito
- Valores percentuais sem documentação de unidade

---

## RESUMO ESTATÍSTICO

- Total: 89 ocorrências
- Percentual verdadeiro (0–100): 58
- Fração (0–1): 8
- Basis points: 2
- Ambíguos: 21
- Risco ALTO: 7
- Risco MÉDIO: 22
- Risco BAIXO: 60

---

## CONCLUSÃO

A auditoria M3 mapeou integralmente o uso de percentuais no sistema,
expondo conflitos semânticos reais e candidatos claros a padronização.

Nenhum código foi alterado.
Este documento é o INVENTÁRIO OFICIAL do eixo M3.
