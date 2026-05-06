# Execution log — Orchestrator: remoção de fallback `vehicleType`

**Data:** 2026-04-13  
**Modo:** EXECUTOR  
**Base normativa (proposta / RFC):** `RFC_UNIFIED_LOGISTICS_MODEL.md`, `RFC_LEI_LOGISTICA_UNIFICARD.md` (rascunho; decisão de meio fora de logistics)

## Alteração

- **Ficheiro:** `backend/src/core/orchestrator/orchestrator.executors.ts` — `executeRequestRide`
- **Removido:** `vehicleType: parameters.vehicleType || 'car'`
- **Novo comportamento:** se `vehicleType` estiver ausente, vazio ou só espaços → `ExecutorResult` com `ok: false` e mensagem explícita (sem integração com `modules/logistics` neste passo).

## Impacto esperado

- Qualquer chamada ao executor de `request_ride` **sem** `vehicleType` deixa de “suceder” silenciosamente com `car`.
- Chamadas que já enviam `vehicleType` comportam-se como antes.
- Integração futura: parâmetro pode passar a ser preenchido pelo planner de logistics (RFC).

## Integração logistics

- **Não** realizada neste commit (conforme instrução).
