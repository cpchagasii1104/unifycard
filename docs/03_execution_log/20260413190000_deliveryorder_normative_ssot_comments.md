# Execution log — DeliveryOrder: comentários SSOT / UnifiedDemand (sem lógica)

**Data:** 2026-04-13  
**Modo:** EXECUTOR  
**Base:** `RFC_UNIFIED_LOGISTICS_MODEL.md`, `RFC_LEI_LOGISTICA_UNIFICARD.md`

## Objetivo

Documentar que `DeliveryOrder` **não** é SSOT de logística nem substitui `UnifiedDemand` / `TransportPlan`; marcar pontos de criação com TODO para geração futura de `UnifiedDemand`.

## Ficheiros alterados

| Ficheiro | Alteração |
|----------|-----------|
| `backend/src/modules/marketplace/domain/orders/marketplace-orders.service.ts` | Bloco normativo no topo; `// TODO` em `createDeliveryFromCheckout` |
| `backend/src/modules/marketplace/services/marketplace-orders.service.ts` | Bloco normativo; `// TODO` em `createDeliveryFromCheckout` |
| `backend/src/modules/marketplace/routes/marketplace-delivery.routes.ts` | Bloco normativo; `// TODO` antes de `createDeliveryFromCheckout` e `createDeliveryFromHub` |
| `backend/src/contracts/marketplace/DeliveryOrder.contract.ts` | Parágrafo no JSDoc da interface |

## Não feito (fora de escopo)

- `createDeliveryFromHub` no `marketplace-industry.service.ts` — implementação do hub não estava na lista de ficheiros; rotas cobrem o fluxo com TODO na chamada.

## Código

Sem alteração de comportamento nem integração com `modules/logistics`.
