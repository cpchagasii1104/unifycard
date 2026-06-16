# 2026-06-16 — F-SERVICE-BUNDLE-WRITE-AUTHORSHIP-BINDING

Fix material de autoridade (DECISION-0113), **não-financeiro**, escopo local: corrige o write-authorship-spoof
dos 2 writes de service-bundle. Fecha `DT-SERVICE-BUNDLE-WRITE-AUTHORSHIP-SPOOF`. Espelha o precedente
`F-SERVICE-ORDER-WRITE-AUTHORSHIP-BINDING` (CLOSED/YALA PASS · material `c53330e0` · seal `3a309b83`).

## Pré-flight

HEAD `3a309b83` · branch `rescue-structural` · superfícies materiais LIMPAS · dev/migration **390**.
STOP não disparado.

## READ-FIRST (Evidence Pack)

Lidos 1ª mão: STATUS · DT_LOG · service-order.routes.ts (precedente pós-`c53330e0`) ·
action-context/`canRepresentActor`/`canActAs`/`denyIfMissingRequiredRegistryCapability` ·
`permission-keys.ts` (`bundle:create`/`bundle:confirm` = capability `null`, registradas) ·
`service-bundle.routes.ts` · `service-bundle.service.ts` · `service-bundle.types.ts` ·
`availability-owner-authority.ts` (`resolveAvailabilityOwner` resolve `owner_type='service'` → actor do serviço) ·
`services.module.ts` (registro das rotas).

## Achado

`service-bundle.routes.ts` tinha 2 writes com autoria/autoridade a partir de actor cliente-declarado cru:
- **`POST /service-bundles/book`** (l.45 pré-fix): passava `actionContext.actorId` como `userId` ao
  `createBundleBookings` e `requesterActorId` vinha do **body** sem binding → spoof: declarar
  `requesterActorId=vítima` cria bookings em nome dela; e o gate de serviço `canActAs` recebia um actor-UUID
  no lugar do userId.
- **`POST /service-bundles/confirm`** (l.133-134 pré-fix): `confirmedByActorId/confirmedByUserId =
  actionContext.actorId` (mesma conflação corrigida no service-order).
Nenhum `canRepresentActor`.

## Correção

- **`bindWriteActor` (route layer)** — espelha `bindOrderWriteActor`: `req.user.userId` REAL (401) + actor
  declarado presente (400) + `canRepresentActor(tenantId, userId, declaredActorId)` (403). Retorna
  `{ userId, actorId }`. 403 honesto ANTES do write (sem write parcial).
- **`book`**: binda `body.requesterActorId` (a PARTE) e passa o **userId REAL** ao service; grava
  `requesterActorId: bound.actorId` (override depois do `...body` → cliente não sobrescreve).
- **`confirm`**: binda `actionContext.actorId`; grava `confirmedByActorId=bound.actorId` e
  `confirmedByUserId=bound.userId` REAL. A autoridade fina por-booking (dono soberano da availability)
  segue reforçada downstream por `confirmBookingFromDecision` (defesa em profundidade).
- **Sem permission-key nova:** `bundle:create`/`bundle:confirm` já existem no mapa canônico (capability
  `null`, ownership suficiente) → sem trap de 500/over-gate (confirmado por revisão adversarial).

## Provas

| Prova | Resultado |
| --- | --- |
| tsc build (`tsconfig.build.json`) | **25** (baseline; zero novo; arquivos bundle limpos) |
| tsc strict (`tsconfig.json`) | **43** (baseline) |
| guard `audit-service-bundle-write-authorship-binding.mjs` (na chain regression-guards) | **GATE OK** |
| neg-proof `negative-proof-service-bundle-write-authorship-binding.ps1` | **7 mordidas** mordem + restauração **byte-idêntica SHA256** |
| e2e efêmero `service-bundle-write-authorship-binding` (DB throwaway, FULL) | **14/14** |
| GATE actor-writer-boundaries | OK |
| GATE bank-ledger-boundaries | OK |
| GATE regression-guards | rc=0 (inclui novo guard) |
| GATE architectural-patterns --strict | critical_new=0 (warning_new=4 pré-existentes inventory-legacy) |
| Revisão adversarial (subagente READ-ONLY) | SECURE (sem write sem binding, sem over-gate, spread order ok, zero financeiro) |

**e2e (fluxo REAL ponta-a-ponta):** T1 book legítimo (Carol representa próprio actor) → 201 + 2 bookings
requester=Carol; T2 book spoof (atacante declara requester=Carol) → 403 + zero booking; T3 sem requester →
400; T4 não-auth → 401; setup: 2 decisões ACCEPTED (Alice, dona soberana das service-availabilities);
T5 confirm spoof (atacante declara confirmedBy=Alice) → 403 + zero order; T6 sem actorId → 400; T7 não-auth
→ 401; T8 confirm legítimo (Alice) → 201 + 2 orders; **Bank intocado**; 4 estruturais.

## NÃO TOCADO

service-order · confirm-financial-terms · Bank/Core/`bank_ledger`/payout/split/recovery/payment exec/invoice/
AP-AR · migration · schema · `permission-keys` (nenhuma chave nova; as duas já existiam) · RLS/RBAC/FASE 6 ·
contacts · suppliers · agenda · frontend · sweep votes/organizers.

## Escopo negativo (verificado)

`git diff` = service-bundle.routes.ts + 3 artefatos de prova novos + package.json (guard na chain) +
DT/STATUS/log. ZERO migration/schema/banco; ZERO service-order; ZERO financeiro.

## Estado

**CLOSED / YALA PASS.** Fecha SÓ como **F-SERVICE-BUNDLE-WRITE-AUTHORSHIP-BINDING**: os 2 writes de
service-bundle bindam a autoria ao actor representável (canRepresentActor), gravam o userId REAL, e rejeitam
spoof com 403 honesto sem write parcial. `DT-SERVICE-BUNDLE-WRITE-AUTHORSHIP-SPOOF` → CLOSED. dev 390.

## YALA RESEAL — PASS (2026-06-16, READ-ONLY)

- **Veredito:** **PASS** (reseal READ-ONLY). Commit material `380981ea` · branch `rescue-structural` · dev 390.
- **Confirmado:** os 2 writes (book/confirm) bindados — `actionContext.actorId` não é mais authority crua;
  `requesterActorId`/`confirmedByActorId` passam por binding; `req.user.userId` REAL usado; `canRepresentActor`
  antes do write; spoof → **403 antes de qualquer write, sem write parcial**; body injection neutralizada por
  override após `...body`; ownership fino do confirm permanece downstream em `confirmBookingFromDecision`;
  **reads intocados**; e2e **14/14**; guard **GATE OK**; neg-proof **7 mordidas** + SHA256 byte-idêntico;
  **4 gates verdes**; **Bank intocado**; revisão adversarial = **SECURE**.
- **Sem permission-key nova:** `bundle:create`/`bundle:confirm` já existiam no mapa canônico (capability `null`).
- **Ressalva NÃO bloqueante (carregada como futura):** o **sweep votes/organizers** da família write-authorship
  permanece **OPEN** na DT-mãe (`DT-SERVICE-ORDER-WRITE-AUTHORSHIP-SPOOF` / `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED`);
  **NÃO fechado** nesta frente.
- **Selo:** commit docs-only `docs: seal service-bundle write authority binding`. Estado final: **CLOSED / YALA PASS**.
