# LOG DE EXECUÇÃO — FASE 5B (marketplace.routes)

**Data:** 2026-02-22  
**Modo:** EXECUTOR  
**Normas:** PLANO_MESTRE_UNIFICADO_v5, 07_NOMENCLATURA_CANONICA, 00_AGENT_PROTOCOL, M1_boundary_naming  
**Micro-batch:** Consolidação nominal final do módulo marketplace — apenas `marketplace.routes.ts`

---

## OBJETIVO

Eliminar o cluster restante de TS2551 em `marketplace.routes.ts`: acessos em camelCase a objetos de domínio (retornados pelo service), correção de nomes de métodos chamados no service e mapeamento explícito onde aplicável. Nenhuma alteração de contrato público (request/response).

---

## ARQUIVO ALTERADO

**Único arquivo:** `backend/src/modules/marketplace/marketplace.routes.ts`

---

## ENDPOINTS / BLOCOS ALTERADOS

| Endpoint / contexto | Alteração |
|---------------------|-----------|
| POST industry account | Log: `industry.industry_id` → `industry.industryId` |
| POST distribution hub | Log: `hub.hub_id` → `hub.hubId` |
| POST payment-plan/dropship | Log: `paymentPlan.payment_plan_id` → `paymentPlan.paymentPlanId` |
| POST delivery/from-hub | Log: `delivery.delivery_id` → `delivery.deliveryId` |
| POST reputation-snapshots/generate | Log: `snapshot.snapshot_id` → `snapshot.snapshotId` |
| POST disputes | Log: `dispute.dispute_id` → `dispute.disputeId` |
| POST regional-impact/generate | Chamada: `generateRegionalImpactSnapshot` → `generateRegionalCapacitySnapshot` com `regionId`, `period`, `periodType`; log: `snapshot.snapshot_id` → `snapshot.snapshotId` |
| GET regional-impact/snapshots | Chamada: `getRegionalImpactSnapshots` → `listRegionalCapacitySnapshots` com `{ regionId }` |
| POST incentives/grant | Log: `grant.grant_id` → `grant.grantId` |
| POST economic-sustainability/generate | Log: `snapshot.snapshot_id` → `snapshot.snapshotId` |
| POST production-batches | Log: `batch.batch_id` → `batch.batchId` |
| POST production-batches/commit | Log: `commitment.commitment_id` → `commitment.commitmentId` |
| POST services/requests | Log: `request.request_id` → `request.requestId` |
| POST services/requests/:requestId/dispatch | Log: `dispatch.dispatch_id` → `dispatch.dispatchId` |
| Outros (order, quote, providers/eligible) | `order.order_id` → `order.orderId`; `quote.quote_id` → `quote.quoteId`; `c.provider_actor_id` → `c.providerActorId` |
| GET stores/:storeId/imported-products | Chamada: `getImportedProducts` → `getStoreProducts` |
| GET services/requests/:requestId/evaluations | Chamada: `getServiceEvaluationsByRequest` → `getServiceQuotesByRequest` |
| POST resources/:resourceId/compensation-config | Input: `body.is_active` → `body.active` (conforme tipo Body que declara `active`) |

---

## PROPRIEDADES CORRIGIDAS (acesso a domínio em camelCase)

- `industry.industryId`, `hub.hubId`, `paymentPlan.paymentPlanId`, `delivery.deliveryId`
- `snapshot.snapshotId` (reputation e economic sustainability)
- `dispute.disputeId`, `grant.grantId`, `batch.batchId`, `commitment.commitmentId`
- `request.requestId`, `dispatch.dispatchId`, `order.orderId`, `quote.quoteId`
- `c.providerActorId` (candidato em dispatch)
- `snapshot.snapshotId` (regional capacity)
- Input compensação: leitura `body.active` em vez de `body.is_active` (tipo Body já com `active`)

---

## RESULTADO TSC (backend)

| Métrica | Antes | Depois | Delta |
|---------|-------|--------|-------|
| **TS2551 total** | 192 | 172 | **−20** |
| **TS2339 total** | 403 | 403 | 0 |

**TS2551 em marketplace.routes.ts:** 20 → **0**.

---

## CONFIRMAÇÕES

- [x] Nenhum contrato público alterado (chaves de request/response mantidas; apenas RHS em logs e chamadas ao service).
- [x] Nenhum cast introduzido (`as`, `!`).
- [x] Nenhuma lógica de negócio alterada (apenas nomes de propriedades e métodos).
- [x] Nenhum arquivo fora do escopo alterado (apenas `marketplace.routes.ts`).
- [x] Nenhuma alteração em `marketplace.service.ts`, SLA, Terminal, Plan Limits ou BusinessTemplate.

---

## CRITÉRIO DE SUCESSO

- [x] TS2551 reduziu (192 → 172; −20 no total; 0 restantes em marketplace.routes).
- [x] TS2339 não aumentou (403 mantido).
- [x] Nenhum contrato público alterado.
- [x] Nenhum erro novo fora do marketplace introduzido por estas alterações.

---

## ARTEFATOS

- Tsc pós-execução: `c:\unificard\tsc_post_5b_marketplace_routes.txt`

---

**STATUS: SUCESSO**

Consolidação nominal do módulo marketplace (marketplace.routes) concluída. TS2551 em marketplace.routes.ts zerado.
