# 2026-06-15 — ONDA DECISION-0131 · E1 (AVAILABILITY OWNER-AUTHORITY — EXEMPLAR + REGRESSION LOCK)

Pós-PASS B1f (commit `365d1b2b`). E1 **NÃO** corrige agenda/booking/availability. E1 **registra** o padrão bom de
autoridade server-side da Unified Availability como **exemplar canônico da DECISION-0131** e **trava** o que faltava
(contrato fail-closed do resolver). **ZERO runtime change** (só guard .mjs + neg-proof .ps1 + cartório; nenhum `.ts`
tocado). Parent `365d1b2b` · branch `rescue-structural` · dev **385/385**.

## O PADRÃO CANÔNICO (copiável)

> **client declares target/owner → server resolves owner policy → server binds authority → only then read/write/booking**

Materializa a LEI §4.9 (autoridade = decisão determinística server-side; o pedido só **declara** o actor como contexto)
+ PROHIBITED_STRUCTURES (todo gate de autoridade é fail-closed) + AUTHORITY_ENFORCEMENT_MODEL (availability é soberania
do TEMPO, nunca do dinheiro). Quatro passos, todos no resolver `core/availability/availability-owner-authority.ts`:

1. **O cliente declara um RECURSO, não um actor.** `(owner_type, owner_id)` identificam a janela temporal —
   `owner_type` é enum fechado de 6 valores (`user/page/service/event/group/service_offering`), parseado por
   `z.nativeEnum`; `owner_id` é ponteiro de recurso, **HINT**, nunca autoridade.
2. **O servidor resolve a POLICY do owner_type.** `OWNER_AUTHORITY_POLICIES: Record<AvailabilityOwnerType, OwnerPolicy>`
   — o `Record` tipado força COBERTURA 100% (o TS não compila sem uma entrada por membro do enum). Cada policy prova que
   o recurso EXISTE no tenant e **deriva o authority actor do schema vivo** (actors.actor_type · services.actor_id ·
   service_offerings.provider_actor_id · events.actor_id · groups.COALESCE(owner_actor_id, actor_id)).
3. **O servidor vincula a autoridade.** `resolveAvailabilityOwnerAuthority` →
   `canRepresentActor(req.tenant.id, req.user.userId, authorityActorId)` server-side. `actionContext.actorId` (canal-1)
   é comparado ao authority actor **RESOLVIDO**, nunca ao `owner_id` cru.
4. **Só então read/write/booking.** As 5 escritas de availability (POST/PUT/weekly-template/participants/check-in-out)
   passam pelo resolver + canRepresentActor; booking-create gateia o **requester** (cliente pode reservar slot de
   terceiro — por design), ainda server-side.

### Os três fail-closed (o coração do exemplar)

- **400 `AVAILABILITY_OWNER_TYPE_UNKNOWN`** — owner_type fora do vocabulário (sem policy) → deny.
- **404 `AVAILABILITY_OWNER_NOT_FOUND`** — recurso inexistente no tenant OU `owner_id` incompatível com o tipo
  (UUID coincidente de outro tipo JAMAIS autoriza); erro de policy → `authorityActorId = null` → deny.
- **403 `AVAILABILITY_OWNER_NOT_REPRESENTABLE`** — `canRepresentActor` falso/erro → `canRep = false` → deny.

## Por que é exemplar copiável (PDV / CRM / ERP / social)

| Problema recorrente | Como o availability resolve | Onde aplicar |
| --- | --- | --- |
| "resource owner = authority actor" (conflation) | `(owner_type, owner_id)` é RECURSO; authority é DERIVADA por policy | PDV (sessão→operador), CRM/ERP (documento→empresa), social (post→autor) |
| actor declarado pelo cliente vira autoridade | actionContext/body actorId = HINT; compara com authority RESOLVIDO | todo canal-1 (ver B1f) |
| tipo novo entra sem regra | `Record<enum, policy>` (TS) + CHECK físico + guard parity → tipo novo SEM policy não compila/não passa | qualquer enum polimórfico de owner |
| fail-open silencioso | 3 throws fail-closed (400/404/403) + catches que viram deny | toda superfície sensível |
| autoridade só em middleware | resolver é serviço de domínio testável (LEI §4.9.7) | substituir gates ad-hoc |

O **PDV-F2A/F2B** já copiou a essência (canRepresentActor sobre o seller/operador resolvido); o availability é a forma
mais COMPLETA (polimórfica por owner_type) — referência para as próximas frentes de autoridade.

## E1 — o que foi travado (guard-lock, ZERO runtime)

O gate `audit-availability-owner-authority.mjs` já provava COBERTURA (enum↔CHECK↔policy 1:1, sem `as never`, sem actor
cure, rotas usam resolver, sem ownerId cru como actor). **Faltava pinar a REJEIÇÃO** (os 3 throws). E1 adicionou
(bloco 4b): `temporal:resolver-failclosed-{unknown-owner-type,owner-not-found,not-representable}` — o gate FALHA se o
resolver perder qualquer um dos 3 fail-closed (throw + código + catch→deny). CLOSED 23→26.

## Provas

| Prova | Resultado |
| --- | --- |
| audit-availability-owner-authority guard | GATE OK (CLOSED=26, +3 fail-closed checks) |
| negative-proofs-contextual-temporal.ps1 | **19/19** byte-idêntico (P-T7/8/9 = E1: remover cada fail-closed → gate FALHA) |
| validate:actor-writer-boundaries / bank-ledger-boundaries | GATE OK / GATE OK |
| validate:regression-guards (chain) | rc=0 |
| validate-architectural-patterns --strict | exit 0 · critical_new=0 (0 atribuível) |
| tsc | build **25** · strict **43** (INALTERADO — zero `.ts` tocado) |

## READ-FIRST (confirmado de 1ª mão; workflow read-only + leitura direta)

owner_types=6 (enum fechado) · policy 100% (Record tipado + CHECK + guard) · unknown→400 · not-found→404 · !canRep→403 ·
cliente=HINT · authority server-side via canRepresentActor(req.user.userId) · resolver é o ponto de entrada · e2e prova
spoof/403, UUID-mismatch/404, matriz por owner_type, CHECK físico, zero Bank, zero actor cure · guard standing no chain.

## Resíduos (DT-AVAILABILITY-OWNER-AUTHORITY-EXEMPLAR-RESIDUES — NÃO corrigidos em E1)

- **R1** runner efêmero do e2e exemplar AUSENTE (prova órfã) · **R2** gate não cobre writer fora de core/availability ·
- **R3** negative-guards de raw-ownerId por nome-fixo · **R4** rotas reimplementam helpers (não importam o primitivo
  combinado) · observações normativas (headers stale CORE_TEMPORAL_HARDENING / AUTHORITY_LAW.md inexistente).

## NÃO FECHADO (proibições do GO respeitadas)

availability inteiro · agenda · booking · participants · conflicts · weekly-template · list/by-id público×privado ·
temporal lifecycle · delegation/R2 · RBAC/FASE 6 · canal-1 baseline · financeiro · ERP/CRM/PDV · C63 tombstone ·
actor_delegations · RLS · mapper · cargo-template · Bank/Core. Nenhum `.ts` tocado. **Agenda nunca autoriza dinheiro.**

## Estado

E1 **IMPLEMENTED / HOLD PARA RESEAL**. Fecha SÓ como **AVAILABILITY OWNER-AUTHORITY EXEMPLAR / REGRESSION LOCK**: o
padrão server-side (resource≠authority, policy por owner_type, canRepresentActor, triplo fail-closed) registrado como
exemplar canônico da DECISION-0131 e travado contra regressão (guard +3 checks, neg-proof 19/19). dev 385; ZERO runtime.
