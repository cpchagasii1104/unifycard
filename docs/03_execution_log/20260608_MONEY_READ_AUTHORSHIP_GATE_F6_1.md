# Execução — F-MONEY-READ-AUTHORSHIP-GATE-F6_1 (DECISION-0113 fatia 6.1 — leitura cross-user, money) — backend

**Data:** 2026-06-08 · **Modo:** EXECUÇÃO CONTROLADA · **Branch:** `rescue-structural` · **HEAD origem:** `e85d9f8b`
**Decisor:** Clayton ("pode executar; siga as normas") · **Esteira:** eu (escritora); par verifica.

## Objetivo
Abrir a **fatia 6 (leitura cross-user)** da DECISION-0113 pelo cluster de **maior risco** (money): 5 reads financeiros liam dado keyed em `req.actionContext.actorId` (spoofável) **sem gate** → leitura cross-user de ledger/wallet alheio.

## READ-FIRST + mapa (Explore agent + releitura do source)
7 superfícies de leitura usam `actionContext.actorId` como sujeito SEM gate. Classificadas por norma (igual fatias 5.1 self vs 5.2 actor-keyed):
- **F6.1 money (5):** `social-2.0 /social/ledger` + `/social/ledger/summary`; `identity /identity/wallet/actor-statement` + `/identity/wallet` + `/identity/ledger`.
- **F6.2 self:** `identity /identity/configurations` GET (espelho do PUT que virou self na F5.1).
- **F6.3 /me/* agregadores:** `me-active-location`, `impact-overview`, `pending-responsibilities`.
- **F6.4 cross-user:** `core.service.getCompleteProfile` (lê lifestyle; chamado por groups/social com `userId` de terceiro — achado da F5.3).

_(Nota: o mapa do agente listou 3 identity reads; a releitura do source achou 5, mais o `/ledger/summary` irmão do social. Em money, reler o arquivo > confiar no resumo.)_

## Implementação (backend; 2 arquivos de rota; sem migration/Bank/frontend)
Em cada um dos 5 handlers, **após** as validações `req.user`/`actionContext`/`tenant` e **antes** da leitura:
```ts
let canRead… = false;
try {
  const { authorizationService } = await import('@core/authorization/authorization.service');
  canRead… = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId);
} catch { canRead… = false; }
if (!canRead…) return reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
```
Assinatura confirmada no source (`authorization.service.ts:333` → `canRepresentActor(tenantId, userId, actorId)`) **antes** de tocar código financeiro.

## Decisão de classificação
**canRepresentActor (actor-keyed), não self-only** — esses reads podem legitimamente ser de actor representável (empresa/grupo/delegação), não só do próprio user. Self continua passando (ownership direto = true); só leitura alheia spoofada → 403. Behavior-preserving para uso legítimo.

## Prova
- **e2e novo** `validate-pipeline-e2e-money-read-authorship-f6-1` **8/8**: **A behavioral** — o primitivo nega cross-user (`canRepresentActor(dev→próprio)=true`; `(estranho→actor do dev)=false`); **B estrutural** — gate `canRepresentActor` ANTES da chamada de leitura nos 5 handlers (ordenação por `indexOf`) + assinatura canônica nos 2 arquivos.
- **Backend tsc** fora de geo = **0**. **4 gates OK** (`bank-ledger §4.6` **verde** — `/identity/ledger` lê via bank read port, zero `bank_*` novo; `critical_new=0`/`warning_new=1`=c3; dev **365**).
- **Sem regressão:** rbac 13/13 · escalation 16/16 · money-live 12/12 · plan-identity 9/9 · profile-c1 16/16 · lifestyle 10/10 · professional-c1 16/16.

## O que NÃO foi tocado
`/identity/configurations` GET (F6.2) · `/me/*` agregadores (F6.3) · `getCompleteProfile` (F6.4) · `canActAs`/`checkOwnership` · money latente · Bank/escrita · migration · frontend · `docs/memorias/`/autorais.

## DTs
- Abre `DT-CROSS-USER-READ-ACTORID-UNVALIDATED` (**PARTIALLY MITIGATED** — F6.1 fechada). **DT-mãe `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` segue OPEN** (fecha só com F6.4).

## Próximo passo
**F6.2** `/identity/configurations` GET (self-only) → **F6.3** `/me/*` (canRepresentActor) → **F6.4** `getCompleteProfile` cross-user. Só com F6.4 a DT-mãe fecha e o arco DECISION-0113 está completo.
