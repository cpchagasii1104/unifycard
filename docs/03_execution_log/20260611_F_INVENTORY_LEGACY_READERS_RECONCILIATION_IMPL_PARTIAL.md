# Execution Log — F-INVENTORY-LEGACY-READERS-RECONCILIATION-IMPL-PARTIAL

**Data:** 2026-06-11
**Frente:** `F-INVENTORY-LEGACY-READERS-RECONCILIATION-IMPL-PARTIAL`
**HEAD origem:** `ebde8984` · **Branch:** `rescue-structural` · **dev:** 366 (sem migration)
**Modo:** BACKEND + FRONTEND + E2E + GATE BASELINED + DOCUMENTAÇÃO
**Governado por:** DECISION-0116 (ACTOR_PRIVATE) + DECISION-0113 + DEC-A/B/C/D da IA Diretora (pós HARD STOP)

---

## 1. HARD STOP (Checkpoint 0)

A enumeração mandatória (workflow READ-ONLY de 6 agentes Explore + verificação 1ª mão de gates/SQL) provou que o galho inventory tem readers tenant-wide de `inventory_movements` ALÉM das 2 nomeadas:

| Reader / rota | Gate | Verdito |
|---|---|---|
| `/marketplace/inventory/balance` (calculateBalance) | require-permission.guard LIVE | **leak nomeado** (alvo) |
| `/marketplace/inventory/movements` sem actorId | require-permission.guard LIVE | **leak nomeado** (alvo) |
| `/marketplace/products/visible` | **auth-only (sem permissão)** | **LIVE leak** (SUM tenant-wide como availableQuantity) |
| `/admin/metrics/reconciliation/summary`+`/drift` | auth-only, tenantId client-supplied | **LIVE sub-gated + cross-tenant** |
| `/reports/inventory`+`/aging`+`/holding-costs`+`/suggestions`+`/transfers/sla` | `fastify.requirePermission` → `actor_has_permission`=**STUB FALSE** | **stub-dead** (reactivation-trap FASE 6) |
| inventory-reservation.service / rebuild-inventory-balances | sem rota | INTERNAL_NOT_EXPOSED |

Reportei à IA Diretora (não declarar galho fechado; classificar; parar). **Decisão DEC-A:** fechar SÓ as 2 nomeadas; galho PARCIAL/OPEN; products/visible (DEC-B), reconciliation (DEC-C), reports (DEC-D) em frentes próprias.

## 2. Folha 1 — balance tenant-wide → tombstone 501

`marketplace-inventory.routes.ts` `GET /inventory/balance`: removido o `requirePermission` preHandler e o `getCurrentBalance`; retorna **501 `INVENTORY_TENANT_WIDE_BALANCE_DISABLED`** (auth+tenant preservados pela scope; sem service/query/estado). Mensagem orienta para by-actor / consolidado empresarial. Não reaproveitada com companyId/actorId.

## 3. Folha 2 — movements actorId obrigatório

`GET /inventory/movements`: `actorId` agora OBRIGATÓRIO. Ausente → **400 `INVENTORY_ACTOR_ID_REQUIRED`**; inválido (não-UUID) → 400; presente → `canRepresentActor(req.user.userId, actorId)` ANTES do service; 401 sem user; 403 fail-closed. Sem fallback (actionContext/companyId/actor ativo/LIMIT 1/tenant inteiro). Filtros (movementType/referenceType/referenceId/datas), limit/offset, ordenação e shape preservados.

## 4. Frontend

- `api/marketplace.ts`: `getMovements(actorId, variantId, filtros?)` — actorId obrigatório no tipo+URL (URLSearchParams). `getBalance` marcado `@deprecated`, sem caller interno, sem fallback.
- `MarketplaceInventory.tsx`: removido import de `getBalance`; `loadInventoryData` early-return sem actorId (sem fallback tenant-wide); guard de render "Estoque indisponível sem unidade operacional"; `getMovements(actorId, variantId)`.
- `MarketplacePage.tsx`: aba pública "Estoque" REMOVIDA (botão + render + import); `TabType` sem `'inventory'`; `?tab=inventory` cai na aba pública válida padrão (home) sem montar estoque nem disparar request.
- `CompanyInventoryTab.tsx`: inalterado — já passa `actorId={companyActor.actor_id}` (page-actor), que agora flui aos dois readers.
- Frontend tsc: 0 erros.

## 5. Gate G1 (baselined, honesto)

`backend/scripts/audit-inventory-reader-scope.mjs` + script `validate:inventory-reader-scope`, integrado a `validate:regression-guards`.
- Inventário de readers de `inventory_movements` via manifesto (3 categorias): `SCOPED_APPROVED` (repo by-actor/consolidado; reservation interna), `KNOWN_OPEN` (products/visible, reconciliation, reports — dívida, NÃO aprovação).
- **NEW_UNCLASSIFIED** (reader não-classificado) → FALHA.
- **FORBIDDEN_REGRESSION:** balance volta a chamar getCurrentBalance / movements deixa de exigir actorId / reader do manifesto some.
- Output: `KNOWN_OPEN=4 NEW_UNCLASSIFIED=0 FIXED_REGRESSION=2`. Nunca imprime "fully safe"; declara galho PARCIAL/OPEN enquanto KNOWN_OPEN>0.
- Provas: negativa (reader sintético tenant-only → gate falha) + positiva (readers escopados passam) no E2E.

## 6. Prova (E2E)

`validate-pipeline-e2e-inventory-legacy-readers-reconciliation.ts` — **32/32** HTTP real (auth+tenant+actionContext+rbac+marketplace). Fixtures: empresas E/F; A admin de E (is_primary + actor_registry do page-actor p/ requirePermission); B membro de E (não-gestor); D admin de F; actors EA1/EA2(E)/FB1(F)/H(solto); variante; movimentos EA1=10/EA2=7/FB1=100/H=55.
- Balance: 401 sem auth; 501 autenticado; código; sem estado; by-actor 200(10); consolidado 200(17, exclui F/H).
- Movements: 400 sem actorId; 400 inválido; 200 representável (A→EA1); só linhas de EA1; 403 cross-empresa (A→FB1); 403 solto (A→H); 401 sem auth; filtros/paginação 200; sem estado; M11 capability não supera representação (B→EA1 403).
- Estrutural frontend: getMovements exige actorId; MarketplaceInventory sem getBalance + early-return; MarketplacePage sem import/JSX/tab inventory; CompanyInventoryTab passa actorId.
- Gate G1: passa exit 0; baseline nominal; KNOWN_OPEN>0/NEW_UNCLASSIFIED=0; FIXED_REGRESSION=2; sem "fully safe"; prova negativa.

`marketplace-inventory-actorid-authority-f6-5-c3` **atualizado 12/12** (B3/B4/B7 ao novo contrato: movements actorId obrigatório; balance tombstone 501; sem perda de cobertura).

## 7. Gates e regressões

| Gate | Resultado |
|---|---|
| tsc backend | OK (2 geo baseline) |
| tsc frontend | 0 erros |
| validate:actor-writer-boundaries | OK |
| validate:bank-ledger-boundaries | OK |
| validate:regression-guards (inclui G1) | OK (KNOWN_OPEN=4/NEW_UNCLASSIFIED=0/FIXED_REGRESSION=2) |
| validate-architectural --strict | critical_new=0 (warning_new=4 = falsos-positivos "balance" em nome de rota) |
| validate:system-state:strict | PASS |

Regressões: legacy-readers 32/32 · f6-5-c3 12/12 · consolidado 39/39 · self-escalation 33/33 · marketplace actor-target 16/16 · members 7/7 · role-vocab 7/7 · x-actor-id 9/9 · groups-mine 26/26.

## 8. Cartório

- `DT-INVENTORY-MOVEMENTS-ITEMIZED-CROSSCOMPANY-SCOPE` → **CLOSED** (com prova; balance tombstone + movements actorId).
- **NOVAS OPEN:** `DT-INVENTORY-PRODUCT-VISIBILITY-TENANT-WIDE-STOCK-PROJECTION`, `DT-INVENTORY-RECONCILIATION-METRICS-INSTITUTIONAL-AUTHORITY-MISSING`.
- **Atualizada:** `DT-RBAC-FAIL-CLOSED-STUB-FASE6-REACTIVATION-TRAP` (reports/inventory* + transfers/sla).
- `MAPA_DENOMINADOR`: inventory **PARCIAL** (proibido FECHADO-NO-CLUSTER); 2 folhas FECHADO, 2 LIVE OPEN, reports trap; denominador global OPEN; C1 bloqueado.
- `DECISION-0116`: ADENDO A1 item 11 atualizado + **ADENDO A2** no DECISIONS_LOG.
- **Reconciliação cartorial self-escalation:** DECISIONS_LOG nota (descoberta `c6bbcae1` → CLOSED `ebde8984`, PASS Yala; sem reescrever histórico).

## 9. Escopo intocado / STOPs

products/visible NÃO corrigido; reconciliation metrics SEM gate simples; reports stub-dead NÃO patchados; movements consolidado NÃO criado; query consolidada/company_users/migration intocados; Bank/suppliers/PO/contacts/groups/escrow/finance-agenda/daily-metrics intocados; unidade heterogênea/eligibility-KYB não tocadas; tmpschema.ts NÃO removido (autoria não-provável). **inventory NÃO declarado fechado; mapa NÃO FECHADO-NO-CLUSTER; C1/tenant compartilhado/R2/FASE 6 NÃO liberados; DECISION-0113 NÃO fechada; denominador global NÃO fechado.**

## 10. Estado / próximas 3 frentes

- Galho inventory: **PARCIAL** (2 folhas fechadas; 2 LIVE + reports OPEN).
- Denominador global: **OPEN**. C1/tenant compartilhado: **BLOQUEADOS**.
- **B** — products/visible: estoque por merchant/oferta (`product_offers.merchant_id`), não SUM tenant-wide.
- **C** — reconciliation metrics: autoridade institucional + tenant server-side (provar não-money antes).
- **D** — reports/*: escopar readers de inventory antes de ligar a FASE 6.

HOLD — aguardando reseal da Yala.
