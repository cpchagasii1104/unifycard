# Execução — F6.5-CANAL3-MONEY (DECISION-0113, 3º padrão — direct-query money readers) — backend

**Data:** 2026-06-08 · **Modo:** EXECUÇÃO CONTROLADA · **Branch:** `rescue-structural` · **HEAD origem:** `f50dce81`
**Decisor:** Clayton (GO "canal 3 primeiro, money prioritário") · **Esteira:** eu (escritora); par verifica.

## Objetivo
Fechar o cluster **money** do 3º padrão (handlers que leem `req.query.actorId`/`owner_actor_id` direto, fora do primitivo `resolveActiveActorFromRequest`) — achado pela Yala no sweep do x-actor-id.

## READ-FIRST de 1ª mão (money à mão — agente é breadth)
- **`bank-http GET /bank/balance?actorId` → B (JÁ GATEADO CORRETO):** quando `actorId` presente, `actorCapabilitiesService.resolveForUser(tenantId, actorIdParam, userId)` valida autoridade sobre o actorId ESPECÍFICO (null → 403 "no authority over this actor") + checa capability (`bank.view_balance`/...). **NÃO é leak; NÃO tocado.** _(A Yala marcou como direct-reader — correto — mas disse "precisa inspeção por-handler"; à mão está protegido. Confirma a regra: classe sensível exige 1ª mão, não grep/agente.)_
- **`invoice` / `payout` / `reporting` → A:** o preHandler `require*Permission` resolve `getActiveActor(tenantId, userId)` (actor do **CALLER**) e chama `requirePermission(actor.actor_id, ...)` — **RBAC-only no actor do caller**; NÃO valida o `actorId`/`recipientActorId` declarado no FILTRO da query. **Mesma armadilha do ledger** (`requireLedgerPermission`). → `?actorId=<vítima>` vaza dado financeiro alheio.

## Implementação (backend; 3 arquivos; sem Bank-write/migration/frontend)
Em `invoice /invoices`, `payout /payouts/orders`, `reporting /reporting/financial-kpis`: se a query declara actor de parte (`actorId`, e `recipientActorId` no invoice), exige `canRepresentActor(req.tenant.id, req.user.userId, partyId)` **antes** de listar; sem `req.user` → 401; não representável → 403. **Sem actorId** → o preHandler financeiro governa o agregado (admin view — NÃO é o vetor; não over-gateado). `bank-http` intocado (já B).

## Padrão de gate (classificação canal 3 money)
- actor-owned filter = **canRepresentActor sobre o actorId da query** (precisão cirúrgica: só o filtro cross-user, não o agregado).
- bank-http = **B** (modelo correto via `actorCapabilitiesService.resolveForUser` — 4º primitivo de autoridade material no código, a mapear no R2.0).

## Prova
- **e2e novo** `validate-pipeline-e2e-canal3-money-direct-query-f6-5-c3m` **7/7**: **A** behavioral REAL (canRepresentActor nega cross-user — sem caveat, o gate só precisa de actor+canRepresentActor, presentes em DEV); **B** estrutural gate-antes-da-leitura nos 3 (invoice/payout/reporting) + 403 "Sem autoridade sobre o actor filtrado" + bank-http=B confirmado (`resolveForUser`).
- **Backend tsc** fora de geo = **0**. **4 gates OK** (**bank-ledger §4.6 verde**; dev **365**).
- **Núcleo 0113 + F6.5.x intactos (16 regressões):** rbac 13/13 · escalation 16/16 · money-live 12/12 · profile-c1 16/16 · lifestyle 10/10 · money-read-f6-1 8/8 · reads-f6-2-3 8/8 · groups-f6-4 10/10 · inbox-commitments-f6-5-1 8/8 · ledger-f6-5-2 7/7 · contextual-thread-f6-5-3 8/8 · feed-f6-5-4 8/8 · company-members-f6-5-5 7/7 · service-order-f6-5-6a 11/11 · x-actor-id-resolver-bind 9/9.

## O que NÃO foi tocado
`bank-http` (já B) · o agregado sem filtro (preHandler financeiro governa) · writes · canal 3 não-money (próxima fatia) · events (6.5.6b) · R2 · Bank-write · migration · frontend · money movement · Fundo Regional/AP-AR.

## DTs
- `DT-DIRECT-QUERY-ACTOR-READERS-UNVALIDATED` — **money DONE**; resta o não-money (social-2.0/events-spec/cultural/trust/policy/audit/marketplace-categories/public-profiles). DT-mãe OPEN.

## Próximo passo (espera go)
Canal 3 **não-money** (READ-FIRST → gatear os A, deixar os B públicos como `public-profiles`) → F6.5.6b events → 6.5.7/8/9 → selo final Yala (grep dos 5 canais).
