# Execução — F-INBOX-COMMITMENTS-AUTHORSHIP-GATE-F6_5_1 (DECISION-0113 fatia 6.5.1) — backend

**Data:** 2026-06-08 · **Modo:** EXECUÇÃO CONTROLADA · **Branch:** `rescue-structural` · **HEAD origem:** `a9e8ca6b`
**Decisor:** Clayton/diretora (GO F6.5.1; ordem por dano) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Primeiro cluster do resíduo `DT-OPERATIONAL-READ-ACTORID-UNVALIDATED` — o de maior dano: IDOR direto no inbox + o agregador `/me/*` que a F6.3 deixou passar.

## READ-FIRST (lido handler por handler — não esqueleto)
- `social-inbox.routes.ts` `GET /actors/:id` (l.30) → `getInboxItems(tenant, req.params.id, filters)`; `/actors/:id/counter` (l.86) → `getInboxCounter(tenant, req.params.id)`. **`req.params.id` é o actor ALVO** do inbox. **Zero gate** e **sem checagem de `req.user`** (faltava 401). Os POSTs `/:itemId/read`/`/archive` são WRITES (usam `actionContext.actorId`) — fora de escopo.
- `commitments.routes.ts` `GET /me/commitments` (l.22) é **HÍBRIDO**: itens 1-3 (eventos participando/organizando, grupos) usam `req.user.id` (self, ok); itens 4-6 (bookings via `requester_actor_id`, inbox counter, resumo econômico) usam `actor.actor_id` resolvido de `req.actionContext.actorId` (spoofável) → vaza agenda/inbox/economia de outro actor.

## Implementação (backend; 2 arquivos de rota; sem Bank/migration/frontend)
- **inbox (OWN-PARAMS):** em ambos os GET, após validar actionContext/tenant — `if (!req.user?.userId) → 401`; depois gate fail-closed `canRepresentActor(req.tenant.id, req.user.userId, req.params.id)` → 403 ANTES de `getInboxItems`/`getInboxCounter`. O caller precisa poder representar o actor da URL.
- **commitments (CRA):** após resolver `actorId = req.actionContext.actorId`, gate fail-closed `canRepresentActor(tenantId, req.user.userId, actorId)` → 403 ANTES do `findById`/queries. Mantidos os itens self (eventos/grupos via `req.user.id`).
- **Writes do inbox intocados** (markAsRead/archive) — disciplina Clayton: "leitura é leitura, escrita é escrita". _(O write-spoof de autoria fica em DTs próprias: `DT-SERVICE-ORDER-WRITE-AUTHORSHIP-SPOOF` + sweep de write-authorship.)_

## Padrão de gate (por item, conforme classificação F6.5.0)
- inbox = **OWN-PARAMS** (recurso da URL = actor alvo → representabilidade sobre `params.id`).
- commitments = **CRA** (sujeito = `actionContext.actorId` declarado).

## Prova
- **e2e novo** `validate-pipeline-e2e-inbox-commitments-authorship-f6-5-1` **8/8**: **A behavioral** primitivo nega cross-user (dev=true/estranho=false); **B estrutural** gate `canRepresentActor` ANTES da leitura nos 3 handlers + 401 fail-closed no inbox + `actorId` do actionContext em commitments + writes do inbox intocados.
- **Backend tsc** fora de geo = **0**. **4 gates OK** (`bank-ledger` verde; `critical_new=0`/`warning_new=1`=c3; dev **365**).
- **Núcleo 0113 intacto:** rbac 13/13 · escalation 16/16 · money-live 12/12 · plan-identity 9/9 · profile-c1 16/16 · lifestyle 10/10 · money-read-f6-1 8/8 · reads-f6-2-3 8/8 · groups-f6-4 10/10.

## O que NÃO foi tocado
ledger · feed · events · service-order · contextual-thread · writes do inbox · R2 · Bank · migration · frontend · `canActAs`/`checkOwnership` · `docs/memorias/`/autorais.

## DTs
- `DT-OPERATIONAL-READ-ACTORID-UNVALIDATED` segue **OPEN** (F6.5.1 fechada; restam F6.5.2–6.5.9). DT-mãe **OPEN**.

## Próximo passo (espera go)
**F6.5.2 — ledger financeiro:** IDOR em `GET /ledger/accounts/:accountId/balance` (OWN-PARAMS) + substituir o `requireLedgerPermission` (gate FALSO — só seta accessLevel, nunca bloqueia). Depois 6.5.3 contextual-thread → 6.5.4 feed → … → 6.5.9 ERP/marketplace.
