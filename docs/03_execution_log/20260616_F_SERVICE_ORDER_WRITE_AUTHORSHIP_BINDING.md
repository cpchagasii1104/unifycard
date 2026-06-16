# 2026-06-16 — F-SERVICE-ORDER-WRITE-AUTHORSHIP-BINDING

Fix material de autoridade (DECISION-0113), **não-financeiro**, escopo local: corrige o spoof de
autoria/autoridade nas ESCRITAS de transição de estado de service-order. Fecha
`DT-SERVICE-ORDER-WRITE-AUTHORSHIP-SPOOF`.

## Pré-flight

HEAD `2173d60c` · branch `rescue-structural` · superfícies materiais (backend/src, frontend/src,
migrations, scripts, docs/02_decisions) **LIMPAS** · dev/migration **390**. Sujeira = baseline
(memorias/notas/opus.md/untracked). STOP não disparado.

## Achado (READ-FIRST de 1ª mão)

`modules/services/service-order.routes.ts` passava `actionContext.actorId` como **AMBOS** os campos
`*ByActorId` E `*ByUserId` nos 5 writes não-financeiros (`confirm` l.215-216, `start` l.240-241,
`complete` l.266-267, `buyer-confirm` l.302-303, `cancel` l.327-328). Efeito duplo: (a) autoria da
transição forjada a partir de um actor cliente-declarado e não-validado; (b) o gate de serviço
`authorityService.canPerformAction(actorId, action, { userId })` era alimentado com um **actor-UUID no
lugar do userId** — nunca rodava contra o principal real. Zero `canRepresentActor`. `confirm-booking` e
o create direto (403) já estavam bindados/contidos (frentes anteriores) — intocados.

## Correção

- **`bindOrderWriteActor` (route layer)** — espelha `assertOrderParty` do read F6.5.6a + precedente
  PO/suppliers. Exige `req.user.userId` REAL (401) + `actionContext.actorId` (400) + actor declarado
  **PARTE** (`customerActorId` OU `workerActorId`; senão **403 não-leak**, cobre inexistente + não-parte)
  + `canRepresentActor(tenantId, userId, actorId)` (senão **403**). Retorna `{ userId, actorId }` BINDADO.
- **5 writes** passam a gravar `*ByActorId = bound.actorId` e **`*ByUserId = bound.userId` REAL**. 403
  honesto ANTES do write (sem write parcial). A regra fina "só o customer confirma" do `buyer-confirm`
  (service) **preservada** (defesa em profundidade).
- **Regularização adjacente (mesma família authority, não-financeira):** `service_order:confirm_completion`
  era referenciado com `as any` no service e **ausente do mapa canônico** → `canPerformAction` lançava
  `PERMISSION_RESOLUTION_ERROR`/500 em QUALQUER buyer-confirm com `buyerUserId` (defeito **pré-existente
  latente** — o caminho nunca fora exercido por e2e com ordem semeada). **Registrado** em
  `permission-keys.ts` com capability `null` ("ownership suficiente", idêntico aos 6 irmãos
  `service_order:*`); `as any` removido. **NÃO** ativa RBAC/FASE 6 — completa o vocabulário de uma ação
  já referenciada no modelo ATIVO (mapa canônico).
- **Resíduo CONSCIENTE (fora de escopo, documentado no código):** `confirm-financial-terms` segue com
  `confirmedBy* = actionContext.actorId` — FINANCEIRO (cria split), atrás de `isFinancialEnabled()`→503.
  Entra na frente financeira própria (3 paralelas read-only).

## Provas

| Prova | Resultado |
| --- | --- |
| tsc build (`tsconfig.build.json`) | **25** (baseline; zero novo; meus arquivos limpos) |
| tsc strict (`tsconfig.json`) | **43** (baseline; zero novo) |
| guard `audit-service-order-write-authorship-binding.mjs` (na chain regression-guards) | **GATE OK** |
| neg-proof `negative-proof-service-order-write-authorship-binding.ps1` | **5 mordidas** mordem + restauração **byte-idêntica SHA256** |
| e2e efêmero `service-order-write-authorship-binding` (DB throwaway, FULL) | **22/22** |
| GATE actor-writer-boundaries | OK |
| GATE bank-ledger-boundaries | OK |
| GATE regression-guards | rc=0 (inclui novo guard + rbac-stub OK) |
| GATE architectural-patterns --strict | critical_new=0 (warning_new=4 pré-existentes inventory-legacy) |
| read e2e F6.5.6a C6 | atualizado (writes BINDADOS, não mais "intocados") |

**e2e (12 comportamentais + 6 estruturais):** T1/T4 confirm legítimo (worker/customer) → confirmed +
`confirmed_by_actor_id` = actor real; T2 spoof (atacante declara worker) → 403 + draft; T3 não-parte →
403 não-leak; T5 start / T7 complete / T9 cancel / T11 buyer-confirm legítimos; T6/T8/T10/T12 spoof →
403 + estado inalterado; T13 worker tenta buyer-confirm (parte, mas service exige customer) → 403; T14
sem actorId → 400; T15 não-auth → 401; **Bank intocado**.

## NÃO TOCADO

Bank/Core/`bank_ledger`/payout/split/recovery/payment execution/invoice/AP-AR · migration · schema ·
banco · RLS/RBAC tables/FASE 6 · `confirm-booking` · create direto (403) · `confirm-financial-terms`
(resíduo financeiro documentado) · frontend.

## Estado

**CLOSED / YALA PASS.** Fecha SÓ como **F-SERVICE-ORDER-WRITE-AUTHORSHIP-BINDING**: os 5 writes
não-financeiros de service-order bindam a autoria ao actor representável e parte (canRepresentActor),
gravam o userId REAL, e rejeitam spoof com 403 honesto sem write parcial; `service_order:confirm_completion`
regularizado no mapa canônico; resíduo financeiro documentado. `DT-SERVICE-ORDER-WRITE-AUTHORSHIP-SPOOF`
→ CLOSED. dev 390.

## YALA RESEAL — PASS (2026-06-16, READ-ONLY)

- **Veredito:** **PASS** (reseal READ-ONLY). Commit material `c53330e0` · branch `rescue-structural` · dev 390.
- **Confirmado:** os 5 writes não-financeiros (confirm/start/complete/cancel/buyer-confirm) bindados —
  `actionContext.actorId` não é mais authority crua; actor declarado precisa ser **PARTE** da ordem
  **E** representável (`canRepresentActor`); `req.user.userId` REAL usado como userId; `*ByActorId`
  grava actor validado, `*ByUserId` grava user real; **403 ANTES do write, sem write parcial**;
  e2e **22/22**; guard **GATE OK**; negative-proof **morde** (5 mordidas + SHA256 byte-idêntico);
  **4 gates verdes**; **Bank intocado**.
- **Aceite específico:** a regularização de `service_order:confirm_completion` em `permission-keys.ts`
  (capability `null`) foi **ACEITA** como correção de vocabulário canônico **já referenciado** pelo
  service — **sem ativar RBAC/FASE 6**.
- **Ressalvas NÃO bloqueantes (carregadas como futuras):**
  1. `confirm-financial-terms` permanece conflado **por design** (FINANCEIRO/split, 503) → frente
     financeira própria com **3 paralelas READ-ONLY**; **NÃO fechar**.
  2. `service-bundle` write-authorship = superfície IRMÃ pré-existente (mesmo padrão) → frente futura
     **F-SERVICE-BUNDLE-WRITE-AUTHORSHIP-BINDING** (`DT-SERVICE-BUNDLE-WRITE-AUTHORSHIP-SPOOF` OPEN);
     **não bloqueia** este fechamento.
- **Selo:** commit docs-only `docs: seal service-order write authority binding`. Estado final:
  **CLOSED / YALA PASS**.
