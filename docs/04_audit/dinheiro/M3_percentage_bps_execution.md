# EXECUTION LOG — M3 PERCENTAGE BPS NAMING

## STATUS
EXECUÇÃO CONCLUÍDA · SUCESSO  
Data: 2026-02-05  
Modo: IA EXECUTORA  
Eixo: Dinheiro — M3 (Semântica de Percentuais)

---

## REFERÊNCIAS

- Auditoria M3:
  docs/04_audit/dinheiro/M3_percentage_semantics_audit.md
- Parecer de autorização:
  docs/04_audit/dinheiro/M3_execution_clearance.md
- Norma vigente:
  docs/01_normative/07_NOMENCLATURA_CANONICA.md

---

## OBJETIVO DA EXECUÇÃO

Aplicar a DECISÃO M3 aprovada, promovendo:
- Basis Points (BPS) como padrão canônico para percentuais configuráveis
- Renomeação mecânica de identificadores
- Ajuste de consumidores diretos

Esta execução NÃO realiza:
- conversão de valores
- alteração de tipo
- alteração de cálculo
- refactor estrutural
- tratamento de campos ambíguos

---

## RESUMO DA EXECUÇÃO

- Total de arquivos modificados: 11
- Total de campos renomeados: 11
- Natureza das mudanças: renomeação mecânica (`*Percentage` → `*Bps`)
- Escopo: backend e frontend (contracts, types, services, routes)

---

## ARQUIVOS MODIFICADOS

### CONTRACTS / TYPES

1. backend/src/modules/services/service-order.types.ts  
   - platformFeePercentage → platformFeeBps

2. backend/src/modules/marketplace/regional-fee.types.ts  
   - feePercentage → feeBps (2 ocorrências)

3. backend/src/contracts/marketplace/ResourceCompensation.contract.ts  
   - percentValue → percentValueBps  
   - variablePercent → variablePercentBps

---

### SERVICES

4. backend/src/modules/services/service-order.service.ts  
   - PLATFORM_FEE_PERCENTAGE → PLATFORM_FEE_BPS  
   - Ajustes de consumo correspondentes (5 ocorrências)

5. backend/src/modules/marketplace/regional-fee.service.ts  
   - Ajustes de consumo de feeBps (2 ocorrências)

6. backend/src/modules/marketplace/marketplace.service.ts  
   - penalty_rate → penaltyBps  
   - hub_margin_percentage → hubMarginBps  
   - store_margin_percentage → storeMarginBps  
   - profit_percentage → profitBps  
   - Ajustes de consumo correspondentes (5 ocorrências)

7. backend/src/modules/decision-simulation/decision-simulation.service.ts  
   - discountPercentage → discountBps

---

### REPOSITORIES / ROUTES / TYPES

8. backend/src/modules/groups/groups.repository.ts  
   - profit_percentage → profitBps  
   - Ajuste de mapper correspondente (2 ocorrências)

9. backend/src/modules/groups/groups.routes.ts  
   - Ajuste de consumo de profitBps (1 ocorrência)

10. backend/src/modules/groups/groups.types.ts  
    - profitPercentage → profitBps (2 ocorrências)

11. backend/src/modules/decision-simulation/decision-simulation.types.ts  
    - discountPercentage → discountBps

---

## CAMPOS RENOMEADOS (LISTA CONSOLIDADA)

- PLATFORM_FEE_PERCENTAGE → PLATFORM_FEE_BPS
- platformFeePercentage → platformFeeBps
- feePercentage → feeBps
- penalty_rate → penaltyBps
- percentValue → percentValueBps
- variablePercent → variablePercentBps
- profit_percentage / profitPercentage → profitBps
- discountPercentage → discountBps
- hub_margin_percentage → hubMarginBps
- store_margin_percentage → storeMarginBps

---

## EXCLUSÕES EXPLÍCITAS (CONFORME PARECER)

NÃO foram tocados:

- Frações (0–1):
  - unifycard-method.types.ts
  - payment-method.types.ts

- Campos ambíguos:
  - percentage em splits
  - commission.value
  - rates sem unidade explícita

- Métricas calculadas:
  - acceptanceRate
  - cancellationRate
  - marginPercentage
  - quaisquer percentuais derivados

---

## CONFIRMAÇÕES FORMAIS

- Nenhuma conversão de valores foi realizada
- Nenhum tipo de dado foi alterado
- Nenhum cálculo foi alterado
- Nenhuma métrica derivada foi modificada
- Nenhum campo ambíguo foi incluído
- Execução limitada a renomeações mecânicas autorizadas

---

## CONCLUSÃO

A execução do M3 foi realizada com sucesso,
respeitando integralmente as decisões de governança
e o parecer de autorização.

O sistema passa a ter:
- percentuais configuráveis explicitados em BPS
- semântica clara e auditável
- base sólida para evolução de tipo monetário (M2)

Este documento é o REGISTRO OFICIAL da execução do M3.
