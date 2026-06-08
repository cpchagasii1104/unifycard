# Execução — F-X-ACTOR-ID-RESOLVER-BIND (DECISION-0113, 2º vetor) — backend

**Data:** 2026-06-08 · **Modo:** EXECUÇÃO CONTROLADA · **Branch:** `rescue-structural` · **HEAD origem:** `f8e820e7`
**Decisor:** Clayton (GO "primitivo primeiro", após achado da Yala na verificação da F6.5.6a) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Fechar o **segundo vetor de spoof de actor** (`x-actor-id`/`actor_id`) que a campanha DECISION-0113 nunca tocou — no **primitivo central** `resolveActiveActorFromRequest`, não rota a rota.

## READ-FIRST (com a condição de STOP do Clayton)
- `resolveActiveActorFromRequest` (`actor.utils.ts`) resolvia o actor do header `x-actor-id`/`x-acting-actor-id` (prioridade 1) ou query `actor_id` (prioridade 2) via `findById` **sem `canRepresentActor`**; `userId` só fallback. Leak: `GET /my-orders` via `x-actor-id:<vítima>` lista `service_orders` da vítima.
- **Consumidores reais = 5** (crm/my-orders/presence/subscriptions/venue); live-chat/loyalty/services **importam mas não chamam**.
- **Nenhum é público:** `auth.plugin` (`core/auth/auth.plugin.ts:13-14`) lança 401 sem Bearer token no **protectedScope**; os 5 callers estão no protectedScope (`req.user` garantido); rotas públicas (`venuePublicRoutes`/`marketplacePublicRoutes`) **não** chamam o resolver. → **SEM STOP**.

## Implementação (backend; 1 primitivo; sem migration/Bank/frontend/write)
Helper `assertActorRepresentable(req, tenantId, declaredActorId)`: `(req.user).userId` ausente → **401** (`UnauthorizedError`); `canRepresentActor(tenantId, callerUserId, declaredActorId)` false → **403** (`ForbiddenError`). Aplicado nas prioridades 1 (header) e 2 (query) **antes** de retornar o actor. O erro de não-achado virou **"Actor não acessível"** (403 não-leak) — o anterior `"Actor não encontrado: <id>"` **vazava o id**. Fallback self (prioridade 3, `ensureUserActor` derivado de `req.user`) **intocado** (não precisa de gate — é o próprio).

## Regra
- `x-actor-id`/`actor_id` = HINT, não autoridade (igual `actionContext.actorId`).
- Header/query só resolve o actor se `req.user` puder representá-lo. Sem `req.user` → 401. Não representável → 403 não-leak.
- Representação legítima (page-actor/company via header) **passa** (canRepresentActor cobre company/group/delegação); só o spoof cai.
- Fallback self derivado de `req.user`, não do header.

## Prova — BEHAVIORAL REAL (sem caveat de tabela vazia)
- **e2e novo** `validate-pipeline-e2e-x-actor-id-resolver-bind` **9/9**: chama o primitivo **de verdade** com requests mock — (1) self fallback resolve o actor do dev; (2) `x-actor-id` próprio (representável) passa; (3) `x-actor-id` alheio + caller estranho → **403**; (4) query `actor_id` spoof → 403; (5) header sem `req.user` → **401**; (6) my-orders-like (x-actor-id da vítima) → 403; estrutural: gate no primitivo + 5 consumidores ainda chamam. _(Sem N/A: o primitivo só precisa de actor + `canRepresentActor`, presentes em DEV.)_
- **Backend tsc** fora de geo = **0**. **4 gates OK** (dev **365**).
- **Núcleo 0113 + F6.5.1–6a intactos (primitivo compartilhado não regrediu):** rbac 13/13 · escalation 16/16 · money-live 12/12 · plan-identity 9/9 · profile-c1 16/16 · lifestyle 10/10 · money-read-f6-1 8/8 · reads-f6-2-3 8/8 · groups-f6-4 10/10 · inbox-commitments-f6-5-1 8/8 · ledger-f6-5-2 7/7 · contextual-thread-f6-5-3 8/8 · feed-f6-5-4 8/8 · company-members-f6-5-5 7/7 · service-order-f6-5-6a 11/11.

## O que NÃO foi tocado
Fallback self · rotas dos consumidores (gate é central no primitivo) · writes de service-order/events · R2 · Bank · migration · frontend.

## DTs
- `DT-X-ACTOR-ID-RESOLVER-OWNERSHIP-UNVALIDATED` → **PRIMITIVO FECHADO / SWEEP RESIDUAL** (severidade de SISTÊMICO-ABERTO → residual). DT-mãe OPEN (dois vetores; vetor 2 agora com gate central).

## Próximo passo (espera go + selo Yala)
Sweep de confirmação das superfícies dos 5 callers (read+write via resolver) + `social-2.0`; depois retomar fila actionContext (F6.5.6b events → 6.5.7/8/9). **R2 congelado.**
