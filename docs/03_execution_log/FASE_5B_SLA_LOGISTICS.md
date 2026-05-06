# LOG DE EXECUÇÃO — FASE 5B (SLA / Logistics)

**Data:** 2026-02-22  
**Modo:** EXECUTOR  
**Normas:** PLANO_MESTRE_UNIFICADO_v5, 07_NOMENCLATURA_CANONICA, 00_AGENT_PROTOCOL, M1_boundary_naming  
**Micro-batch:** SLA e Logistics — nomenclatura em domínio (camelCase), boundary explícito nas rotas

---

## OBJETIVO

Eliminar o cluster de TS2551 relacionados a SLA e Logistics no marketplace: domínio em camelCase, mapper explícito na rota de criação de SLA (body snake_case → input camelCase).

---

## ARQUIVOS ALTERADOS

| Arquivo | Alterações |
|---------|------------|
| `backend/src/modules/marketplace/marketplace.service.ts` | Logistics: `storeDeliveryPreferences` (tipo + literais + uso). SLA: `createSLAContract` (tipo de input + objeto construído + leituras `sla.metrics.fulfillmentTime.targetHours`). |
| `backend/src/modules/marketplace/marketplace.routes.ts` | POST `/sla-contracts`: mapper explícito body → input camelCase; log `slaId` em vez de `sla_id`. |

---

## LISTA COMPLETA DE PROPRIEDADES MIGRADAS

### Logistics (storeDeliveryPreferences)
| Antigo (snake_case) | Novo (camelCase) |
|---------------------|------------------|
| `default_vehicle` | `defaultVehicle` |
| `cost_payer` | `costPayer` |
| `base_cost` | `baseCost` |
| `eta_minutes` | `etaMinutes` |

Uso: `preferences.defaultVehicle`, `preferences.etaMinutes`, `preferences.baseCost`, `preferences.costPayer` na construção de `DeliveryOrder`.

### SLA (createSLAContract — input e objeto construído)
| Antigo (snake_case) | Novo (camelCase) |
|---------------------|------------------|
| `fulfilled_at` / `target_hours` / `max_hours` | `fulfillmentTime` / `targetHours` / `maxHours` |
| `dispute_rate` / `target_percentage` / `max_percentage` | `disputeRate` / `targetPercentage` / `maxPercentage` |
| `fulfillment_time_hours` (thresholds) | `fulfillmentTimeHours` |
| `fulfillment_time_violation` / `redirect_to` (penalties) | `fulfillmentTimeViolation` / `redirectTo` |
| `cancellation_rate_violation` | `cancellationRateViolation` |
| `dispute_rate_violation` | `disputeRateViolation` |
| `sla_id` (objeto construído e log) | `slaId` |

Leituras no service: `sla.metrics.fulfilled_at.target_hours` → `sla.metrics.fulfillmentTime.targetHours` (3 ocorrências).

### Boundary (marketplace.routes.ts)
- Contrato de entrada (Body) mantido em snake_case.
- Mapper explícito: `body.actor_type` → `input.actorType`, `body.metrics.fulfilled_at` → `input.metrics.fulfillmentTime` (targetHours, maxHours), `body.metrics.dispute_rate` → `input.metrics.disputeRate`, etc. Nenhum `req.body` passado cru ao service.

---

## RESULTADO TSC (backend)

| Métrica | Antes | Depois | Delta |
|---------|-------|--------|-------|
| **TS2551 total** | 195 | 192 | **−3** |
| **TS2339 total** | 406 | 403 | **−3** |

---

## TS2551 RESTANTES EM marketplace.routes.ts

**20** (antes 21; redução de 1).

---

## CONFIRMAÇÕES

- [x] Nenhum contrato público alterado (Body da API e tipos de resposta mantidos; apenas mapper na rota).
- [x] Nenhum cast introduzido (`as`, `!`) nas alterações deste micro-batch.
- [x] Nenhuma alteração de cálculo financeiro (apenas renomeação).
- [x] Nenhum arquivo fora do escopo alterado (apenas `marketplace.service.ts` e `marketplace.routes.ts` no cluster SLA/Logistics).
- [x] Nenhuma alteração em BusinessTemplate, Plan Limits ou Terminal.
- [x] Boundary: POST `/sla-contracts` passa a usar mapper explícito body (snake_case) → input (camelCase); service não recebe body cru.

---

## CRITÉRIO DE SUCESSO

- [x] TS2551 reduziu (195 → 192).
- [x] Nenhum aumento de erros em marketplace.routes.ts (21 → 20).
- [x] Nenhum erro novo fora do marketplace introduzido.
- [x] Nenhuma alteração estrutural financeira (apenas nominal).

---

## ARTEFATOS

- Tsc pós-execução: `c:\unificard\tsc_post_5b_sla_logistics.txt`

---

**STATUS: SUCESSO**

Micro-batch SLA / Logistics concluído. Próximo passo recomendado: limpeza restante em marketplace (service + routes) ou próximo cluster definido no plano.
