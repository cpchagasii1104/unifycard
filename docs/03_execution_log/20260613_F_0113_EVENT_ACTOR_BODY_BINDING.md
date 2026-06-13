# 2026-06-13 — F-0113-EVENT-ACTOR-BODY-BINDING (MODO: EXECUTOR)

Corrige o resíduo P1 baselineado da DECISION-0113 em `core/events/event.routes.ts`: handlers de
escrita liam `actor_id`/`actor_type` (e `responsible_actor_id`/`observed_by_actor_id`/`attendee_actor_id`)
do BODY como ator-de-atuação sem binding de representabilidade. Parent `5e82fb68` · branch
`rescue-structural` · dev **380 (inalterado, sem migration)** · zero Bank.

## Bootstrap normativo (incremental §4.2)

Mesmo domínio AUTORIDADE/0113 das frentes desta sessão. Âncora: DECISION-0113 (actorId client-declared =
hint; autoridade via canRepresentActor/canActAs/authority.service). Lidos: `event.routes.ts` (2954 l),
`audit-actor-authority-boundary.mjs`, `authorization.service` (canRepresentActor), DT-0113.

## Achado (READ-FIRST workflow)

`getAuthenticatedUserActor(tenantId, req.actionContext.actorId)` deriva o "userActor" do **actionContext
client-declared** → o "user-match" (`body.actor_id === userActor.actor_id`) comparava dois valores
client-declared = **não era autoridade**. Para `actor_type='page'`/não-user, só existência (`findById`),
com TODOs "validar ownership de page via companies". Rotas economic (authorize/refund/execute) usam
ActionContext server-resolved (safe; não leem body actor).

## Modelo de binding adotado

Helper `userRepresentsActor(tenantId, req.user.userId, bodyActorId)` → `authorizationService.
canRepresentActor` (ownership do actor 'user' · gestão da empresa do 'page' via company_users · grupo ·
delegação), **fail-closed**. Aplicado a TODOS os handlers que liam ator do body: **POST /events**,
**/events/v2/draft**, **/events/v2/create**, **/events/:id/v2/commitments**, **check-in**, **check-out**,
**/events/:id/checkout** (gate ANTES de `eventEconomyService.processCheckout` — motor financeiro intocado).
`body.actor_*` / `actionContext` = HINT, nunca autoridade. Não usou requireRole/requirePermission.

## Provas

| Prova | Resultado |
| --- | --- |
| e2e `validate-pipeline-e2e-event-actor-body-binding` (DB efêmera) | **12/12** |
| canRepresentActor truth: ownership/company true; não-representante false (4) | ✅ |
| T2 HTTP POST /events (Bob não-representa Alice) → 403 | ✅ |
| T1/T3 HTTP (Alice representa) → passa o gate (≠403) | ✅ |
| T4 helper + ≥7 gates `userRepresentsActor(req.tenant.id, req.user.userId,...)` | ✅ |
| T-struct page existence-only/TODO removidos | ✅ |
| T6 checkout: gate ANTES de processCheckout | ✅ |
| T5 event.routes removido do baseline 0113 (sem maquiagem) | ✅ |
| T7 Bank intocado · T8 contenções (dispute/service-order) intactas | ✅ |
| Guard 0113 | flagged=9 baseline=9 **new=0 stale=0** + prova negativa OK |
| Gates | actor-writer OK · bank-ledger OK · regression-guards rc=0 · arch --strict critical_new=0 |
| tsc backend | 25 (baseline arco 0113), zero novo em event.routes | sem migration · dev 380 |

## Hard stops respeitados

Zero Bank/ledger/transactions; motor de checkout (`eventEconomyService`) **não editado** (só gate de
autorização antes da chamada); dispute/reversal e POST /service-orders containments intactos; booking/order/
service_offering não tocados; RBAC V2/FASE6/R2/PJ/CNAE/frontend não tocados; sem migration.

## Cartório

- `DT-0113-EVENT-ACTOR-BODY-BINDING`: **CLOSED** (binding server-side em todos os handlers body-actor).
- `DT-0113-AUTHORITY-CLIENT-DECLARED-ACTOR-BOUNDARY`: baseline reduzido **10 → 9** (event.routes saiu).

## Estado

F-0113-EVENT-ACTOR-BODY-BINDING: **IMPLEMENTED / HOLD PARA RESEAL**.
