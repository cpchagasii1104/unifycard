# IA-04 — Autoridade

> RAIO X READ-FIRST do eixo 04 (Autoridade/Representação/Writers). Insumo READ-ONLY para IA-DIRETORA/Clayton — **não é GO, não é cartório, não é norma**. Disco vence narrativa.

## 1. Carimbo

* **HEAD:** `aaeb50b5` (`aaeb50b5182120888a72418775a9d211e33bff4d`) · branch `rescue-structural`.
* **Data/hora:** 2026-06-21.
* **Git status:** árvore com modificações de memórias/docs e artefatos `?? ` (não-versionados); **nenhum** arquivo de código/migration tocado por esta auditoria.
* **READ-ONLY confirmado:** SIM — nenhuma edição de backend/frontend/migration/norma/cartório; só leitura + SELECT/count(*) com colunas explícitas no banco vivo (jamais SELECT *, jamais mutação). Sem commit.
* **Arquivo criado/atualizado:** este (`docs/memorias/IA-04-AUTORIDADE.md`) — único arquivo escrito.
* **Memória lida:** `docs/memorias/MINHA_MEMORIA_AUTORIDADE.md` **ENCONTRADA** e lida (âncora histórica RODADA 1, HEAD `dd270f41`); usada como histórico, não como verdade final. Divergências vs. vivo na §3.
* **Banco/schema consultado:** `unificard_dev` (localhost:5432, cred. `backend/.env`), via `psql 17` — `to_regclass` + `count(*)` exatos + `relrowsecurity`/`pg_get_functiondef`. Números reais na §3/§5.
* **Comandos/probes usados:** `git rev-parse`/`git status`; Grep/Read amplos em `backend/src` (canRepresentActor, canManageCompany, actionContext, ensureUserActor, actorId/actor_id, owner_id, provider_actor_id, company_id, tenant_id, *_actor_id, member/membership/grants/roles/permission, validate:actor-*); leitura de `authorization.service.ts`, `companies.service.ts`, `action-context.middleware.ts`, `service(-offering).service.ts`, `events-sprint76.routes.ts`, controllers `/internal/*`, payout/bank/escrow; `pg_get_functiondef('actor_has_permission')`; orquestração de 8 auditores + 2 verificadores adversariais (workflow `wf_0ff64124`).

## 2. Escopo

**Auditado (eixo 04):** modelo de autoridade (subject/target/actor-ativo/actionContext/tenant); `canRepresentActor` (impl+ramos+callers+bypass); `canManageCompany` (impl+callers+KYB+bypass); `actionContext` (origem/hint-vs-autoridade); body-spoof (todos os `*_actor_id`/`company_id`/`tenant_id` do body); writers materiais por eixo + rotas tenant-only; grants/memberships (superficial); autoridade em oferta/marketplace (createService/createOffering/ativação draft→active/discovery/availability/booking); autoridade em dinheiro (raio-x/handoff, sem implementação financeira); gate `validate:actor-*`.

**Fora (handoff):** cadastro/auth completo, perfil/SSOT, actor model completo, PJ completo, semântica, marketplace UX, produtos/locações/assinaturas em profundidade, ledger/split/payout em profundidade, booking/conflito temporal, frontend. Achados desses eixos → §8.

## 3. Memória histórica vs estado vivo

`MINHA_MEMORIA_AUTORIDADE.md` (HEAD histórico `dd270f41`) vs vivo `aaeb50b5`:

| Item da memória | Estado vivo (1ª mão) | Classificação |
|---|---|---|
| `actor_capability_grants` materializado mas INERTE (zero enforcement, allowlist não-financeira) | Confirmado: tabela existe, **0 rows**; `hasCapabilityGrant` definido (`actor-capability-grant.service.ts:113`) mas **nenhum reader de negócio** (só e2e). Allowlist `calendar:*`/`services:*` (`actor-capability-grant.types.ts:6-12`). | **CONFIRMADA** |
| `actor_has_permission` = stub `RETURN FALSE` (deny-all) | Confirmado em runtime: `pg_get_functiondef` = `RETURN FALSE`. Caller `rbac.service.ts:124`. | **CONFIRMADA** |
| `financial_approval_*` = 0/0/0 (seed=ato soberano) | Confirmado no banco vivo: policies/authorities/policy_events = **0/0/0**. | **CONFIRMADA** |
| `actor_delegations` 9 / 0-ativas / 9-revogadas | Banco vivo: **9 rows**; reader VIVO (`findActiveByUserActor` em `authorization.service.ts:563`). Distribuição ativa/revogada não reconfirmada nesta sonda. | **CONFIRMADA (parcial)** |
| `tenant_operator_grants` materializado | Vivo, **0 rows**. | **CONFIRMADA** |
| RLS assimetria `service_payment_requests` vs `executions` | Confirmado no banco: requests `relrowsecurity=f`; executions `relrowsecurity=t` + FORCE. | **CONFIRMADA** |
| `assertActorRepresentable` = invariante anti-spoof | Confirmado: `actor.utils.ts:18-33` + `rbac.plugin.ts:108-141`, fail-closed 401/403. | **CONFIRMADA** |
| (não na memória) `actor_has_any_role` = stub? | **NOVO/CONTRADITA implícita:** `actor_has_any_role` **NÃO** é stub — body vivo faz `EXISTS` real sobre `actors⋈user_roles⋈roles` (`20260530551000_restore_actor_has_any_role.sql:45`). A via "role" do RBAC V2 está **VIVA** e leria 8 roles/1 user_role legados como autoridade se chamada. | **PARCIAL (novo risco)** |

Memória **não está stale** no núcleo; o vivo apenas a estende. `actor_users` e `company_members` **não existem** como tabelas (to_regclass NULL) — vínculo é `company_users` (2 rows) + `actor_delegations`.

## 4. Mapa macro da autoridade

```
IDENTIDADE → ACTOR → REPRESENTAÇÃO → AUTORIDADE SERVER-SIDE → WRITER → ESTADO MATERIAL
  user(req.user)   actors        canRepresentActor /        (gate na rota/      (DB)
  global_user_id   (FK)          canManageCompany           service)
```

| Elo | Estado | Evidência |
|---|---|---|
| IDENTIDADE (`req.user.userId`/`globalUserId` server-side) | **FECHA** | auth plugin; `actionContext` NÃO infere de req.user (`action-context.middleware.ts:27-36`) |
| ACTOR (`actors`, FK; `ensureUserActor` self/idempotente) | **FECHA_COM_RISCO** | `actor-writer.service.ts:18`; write-in-read latente em GET (idempotente/self) `actor.helpers.ts:25`, `actor.utils.ts:104` |
| REPRESENTAÇÃO (`actionContext.actorId` = hint client-declared) | **FECHA_COM_RISCO** | hint puro (`action-context.middleware.ts:54-103`); só vira autoridade se a rota chamar `canRepresentActor` — nem todas chamam |
| AUTORIDADE server-side (`canRepresentActor`/`canManageCompany`) | **FECHA_COM_RISCO** | primitivos fail-closed (`authorization.service.ts:333`; `companies.service.ts:982`); ramo-4 legado amplia (AUTH-02) |
| WRITER autorizado | **NÃO_FECHA (parcial)** | maioria gateada; **furos vivos:** internal financial controllers (BODY-01), events-sprint76 (ACTIONCTX-01), services/:id/availability (TENANT-01), booking requester (AUTH-03) |
| ESTADO material (DB; catálogo vazio hoje) | **FECHA_COM_RISCO** | services=0/offerings=0/financial_approval=0; RLS assimétrica em payment (`requests` sem RLS) |

## 5. Matriz do eixo

| item | fecha/não-fecha | evidência viva (arquivo:linha) | blocker | risco | próxima frente | modo |
|---|---|---|---|---|---|---|
| actionContext | fecha-no-middleware / **não-fecha-em-writers-legados** | `action-context.middleware.ts:27-36,54-103` (hint); `events-sprint76.routes.ts:68,88-89` (autoridade) | público/MTP | ALTO | conter sprint76 | MODO B |
| ensureUserActor | fecha (self/idempotente) | `actor-writer.service.ts:18-21`; write-in-read `actor.helpers.ts:25` | não | BAIXO (DT latente) | — | FAST-PATH |
| canRepresentActor | fecha-com-risco | `authorization.service.ts:333-391` | não | MÉDIO (ramo-4) | cleanup ramo-4 | MODO B |
| canManageCompany | fecha | `companies.service.ts:982-993` | não | BAIXO | — | FAST-PATH |
| actor_id no body | fecha (hint gateado) | offerings/PO/supplier = HINT+canRep | não | BAIXO | — | FAST-PATH |
| company_id no body | fecha (derivado server-side) | `service-offering.service.ts:131-135,153` (G4) | não | BAIXO | — | FAST-PATH |
| owner_id no body | fecha (hint gateado) | `purchase-order.routes.ts:71-82`; `supplier.routes.ts:72` | não | BAIXO | — | FAST-PATH |
| provider_actor_id no body | fecha (hint gateado) | `service-offering.service.ts:97-101` | não | BAIXO | — | FAST-PATH |
| **tenant_id no body** | **NÃO_FECHA** | `financial-freeze.controller.ts:24,70,89`; `treasury-account.controller.ts:20`; `governance-proposal.controller.ts:22,52` (pré-auth) | **público+dinheiro+MTP** | **CRÍTICO** | conter /internal | MODO B/C |
| tenant-only writers | não-fecha (parcial) | `services.service.ts:445` (availability); /internal controllers | MTP | ALTO | binding owner | MODO B |
| createService | **fecha** | `services.service.ts:110,159` (canRep + eligibility 0144) | não | BAIXO | — | FAST-PATH |
| createOffering | **fecha** | `service-offering.service.ts:97,115-128,150` (canRep+service_id+draft) | não | BAIXO | — | FAST-PATH |
| **activation draft→active** | **NÃO_FECHA (público)** | `service-offering.service.ts:174-187` (só canRep, sem KYB/trust/revalidação) | público | ALTO | régua de ativação | DECISION/MODO B |
| availability writer (oferta/core) | fecha | `availability-owner-authority.ts:72-80,139-157`; `service-offering.service.ts:204` | não | BAIXO | — | FAST-PATH |
| **booking writer (requester)** | **NÃO_FECHA** | `unified-availability.service.ts:165-178` (sem canRep no requester) | MTP | MÉDIO/ALTO | gate requester | MODO B |
| company/PJ writer | fecha | `companies.service.ts:1931,2211,1124,1137`; publications `canManageCompany`+KYB | não | BAIXO | — | FAST-PATH |
| profile writer | fecha | professional-c1/lifestyle `resolveActorGuarded`→canRep | não | BAIXO | — | FAST-PATH |
| **money writer handoff** | **HOLD/fail-open-se-flag** | `service-payment-execution.routes.ts:37-78` (sem canRep payer/receiver; flag-OFF) | dinheiro | ALTO (condicional) | revalidar authz pós-flag | MODO C / HANDOFF_DINHEIRO |
| grants/memberships | fecha (dormant/inerte) | grants 0 rows/0 reader; `company_members` inexistente (adapter); deleg. reader vivo | não | BAIXO | — | HOLD |
| tests negativos | fecha (amplos, não-executados aqui) | 41 e2e `*authority*`; `authority-escalation-gate.ts:16-17` | não | BAIXO | rodar suíte | FAST-PATH |
| validate:actor-writer-boundaries | fecha (escopo estreito) | `audit-actor-writer-boundaries.mjs` (disciplina de criação de actor) + `audit-actor-authority-boundary.mjs` (sela 0113, baseline 0) | não | BAIXO | — | FAST-PATH |

## 6. Achados críticos

### BODY-01 — `/internal/*` financeiro pré-auth confia em `tenant_id` do body (NÃO contido como o R19)
* **Descrição:** três controllers registrados na RAIZ do app **antes** do `protectedScope` (auth/tenant/actionContext/rbac em `app.builder.ts:291`) aceitam `tenant_id` do body/query como autoridade, **sem auth, sem req.user, sem req.tenant** — espelho exato da classe do dispute controller que **foi** contido (R19), mas estes três ficaram abertos.
* **Evidência:** `financial-freeze.controller.ts:24,70,89` (POST freeze / PATCH release / PATCH cancel — escreve `financial_freezes`/`financial_alerts`); `treasury-account.controller.ts:20,41` (cria/lista conta de tesouraria institucional); `governance-proposal.controller.ts:22,52,69` (cria proposta / vota / lista). Registro pré-auth: `app.builder.ts:179-184`. Irmão contido p/ comparação: `financial-dispute.controller.ts:3-14,25-33` (403 + comentário documentando a classe da vuln / DECISION-0113).
* **Impacto:** congelar/liberar/cancelar saldo e criar conta de tesouraria / forjar proposta+voto de governança **cross-tenant por usuário não autenticado** que declare `tenant_id`. Substrato financeiro + governança (que move funding via `governance-funding-commitment-worker`).
* **Bloqueia MTP?** SIM. **Bloqueia público?** SIM. **Bloqueia dinheiro?** SIM (substrato freeze/treasury, não o ledger core).
* **Exige DECISION?** Não (contenção = padrão R19). **Exige YALA?** SIM (reseal da contenção).
* **Modo:** MODO B (contenção 403 espelhando R19) → se mexer em substrato financeiro vivo, MODO C. **Handoff:** IA-BANCO/IA-DINHEIRO confirmam exploitabilidade em runtime (podem 500 se repo exigir FK de tenant válida — **INCONCLUSIVE estático**; prova = POST não-autenticado com tenant alheio + rowcount antes/depois, fora do read-only).

### ACTIONCTX-01 — `events-sprint76.routes.ts` usa `actionContext.actorId` como autoridade/autoria direta
* **Descrição:** writer legado de eventos consome `actionContext.actorId` (client-declared) com **só presence-check**, sem `canRepresentActor`, sem RBAC, sem preHandler.
* **Evidência:** `POST /events` (`:61-100`, grava `createdByActorId/createdByUserId = actionContext.actorId` `:88-89`; `organizerActorId` cru `:82`) → persiste autoria `event.repository.ts:111`; `POST /events/:id/tickets` (`:240-263`); `POST /tickets/:id/reserve` (`:269-292`, **cria PaymentIntent** = dinheiro); `POST /tickets/:id/cancel` (`:313-336`). Montado em produção `events.module.ts:12,27`, **sem** cobertura de binding (E2E só audita o GET de visibilidade).
* **Impacto:** spoof de autoria/organizador e de actor numa rota que cria PaymentIntent — qualquer autenticado declara outro actorId.
* **Bloqueia MTP?** SIM. **Público?** SIM. **Dinheiro?** PARCIAL (reserve toca PaymentIntent).
* **DECISION?** Não (é o 6º canal da DECISION-0113, já normado). **YALA?** SIM. **Modo:** MODO B (bind canRepresentActor OU conter 403 + guard). **Handoff:** IA-ACTOR (canal 0113) + IA-DINHEIRO (PaymentIntent).

### TENANT-01 — `POST/PUT /services/:serviceId/availability` autoriza por `actionContext.actorId` sem `canRepresentActor`
* **Descrição:** única autoridade é `requireServiceOwnedByActor` = `service.actorId === actionContext.actorId` (client-supplied). Sem `req.user`, sem `canRepresentActor`. Contraste gritante com o core `unified-availability.routes.ts` (req.user 401 + canRep).
* **Evidência:** `services.routes.ts:311,373` → `services.service.ts:436-501` (`requireServiceOwnedByActor` `:445`).
* **Impacto:** quem conhecer o `actorId` dono do serviço forja `actionContext.actorId` igual e cria/edita a agenda do serviço alheio (escreve `availability` owner_type='service'). Bank-free, mas escrita operacional cross-actor.
* **MTP?** SIM (blocker-MTP). **Público?** parcial. **Dinheiro?** Não. **DECISION?** Não. **YALA?** SIM. **Modo:** MODO B (bind req.user+canRepresentActor). Sem teste negativo localizado para esta sub-rota (INCONCLUSIVE).

### ACTIVATION-01 — transição draft→active gateada SÓ por `canRepresentActor(provider)`, sem revalidar KYB/trust
* **Descrição:** `createOffering` é **sólido** (status nasce `'draft'` `:150`, exige `service_id` vinculado `:115-128`, `company_id` derivado server-side `:131-135`, `professional_actor_id` descartado `:154` — as hipóteses "nasce active / sem service_id / carimba body" foram **REFUTADAS** adversarialmente). **O ponto frágil é a ATIVAÇÃO:** `updateOwnOffering` faz `status = COALESCE(...)` com único gate `canRepresentActor(provider)`, **sem** re-checar KYB/trust/declaração ACTIVE/availability.
* **Evidência:** `service-offering.service.ts:174-187`; rota `service-offerings.routes.ts:69-90` (schema aceita `status:'active'` `:27`). DECISION-0145 §A.12 reservou "ativação = régua própria revalidada" — **não materializada**. Discovery público sem autoridade `service-offering.service.ts:222-230`.
* **Impacto:** **PJ** tem proteção transitiva (service só existe com publicação KYB-approved upstream — `services.service.ts:48-60`, `company-publications.service.ts:185-187`); **PF** NÃO tem KYB algum — basta `actor_professional_concepts.is_active` autodeclarado → ativa → fica publicamente descobrível. Sem cascata provada de KYB-revoke→suspende oferta active (**INCONCLUSIVE**).
* **MTP?** parcial. **Público?** SIM. **Dinheiro?** Não (oferta ≠ liquidação). **DECISION?** SIM (régua de ativação PF — DECISION-0145 §A.12 reservada / KYC-lite PF DECISION-0144 §A.11 FORA). **YALA?** SIM. **Modo:** DECISION + MODO B. **Handoff:** IA-OFERTA (forma) + Clayton (régua).

### MONEY-AUTH-01 — `POST /services/payments/:id/execute` move dinheiro real sem `canRepresentActor` (contido só por flag)
* **Descrição:** único gate = flag `SERVICE_FINANCIAL_RUNTIME_ENABLED` (default OFF) + auth + tenant. **Nenhum `canRepresentActor` sobre payer/receiver.** O GET da mesma rota EXIGE canRep — o writer não. O próprio firewall doc admite que a authz "deve ser revalidada quando o flag for reaberto".
* **Evidência:** `service-payment-execution.routes.ts:37-78`; service `service-payment-execution.service.ts:411,641` (grep canRep/canManage = 0); `service-financial-firewall.ts:12-13,18`. Mesma classe: `service-hire.routes.ts:42-44`.
* **Impacto:** se a flag for ligada, qualquer autenticado do tenant executa pagamento de qualquer payment_request → `bank_transactions`/`bank_ledger`/`bank_splits`. **Fail-open de autoridade, condicional a flag.**
* **MTP?** parcial. **Público?** Não. **Dinheiro?** SIM (condicional). **DECISION?** Não (correção de authz). **YALA?** SIM. **Modo:** MODO C. **Handoff:** **IA-DINHEIRO** (dono) — eu sou a autoridade do gate. **INCONCLUSIVE:** valor efetivo da flag em prod (não-alcançável read-only).

### AUTH-02 — `canRepresentActor` ramo-4 (registry-bônus) amplia representação de company-actor além de `canManageCompany`
* **Descrição:** o ramo 2 (company) usa só `canManageCompany`; mas o ramo 4 registry-bônus chama `checkOwnership('companies')`, que tem caminhos legados aditivos (`is_primary=true` OU `role='admin' AND member_status='active'`) — um membro `role='admin'` SEM `can_manage_company`/owner cai FORA de `canManageCompany` mas DENTRO do legado.
* **Evidência:** `authorization.service.ts:376-383` (gatilho) + `:462-476,481-497` (poder legado); `canManageCompany` `companies.service.ts:982-993`. Mitigante: ramo-4 só dispara se `actor_registry` tiver linha p/ a company (populado lazy). **INCONCLUSIVE:** `count(*) FROM actor_registry WHERE entity_table='companies'` (runtime).
* **MTP?** parcial. **Dinheiro?** indireto. **DECISION?** já reconhecida — **DECISION-0144 §B (D3-6 Parte B) DEFERE explicitamente "conter ramo-4 legado" como cleanup separado.** **YALA?** SIM no cleanup. **Modo:** MODO B (cleanup de autoridade). **Handoff:** IA-ACTOR (membership).

### AUTH-03 — `createBooking` não chama `canRepresentActor(requesterActorId)`
* **Descrição:** valida que o requester actor **existe**, mas não que o caller pode **representá-lo**; `userId` só vai para effects/logging.
* **Evidência:** `unified-availability.service.ts:165-178`. (As demais superfícies de booking — confirm/cancel/check-in — são gateadas, `unified-availability.routes.ts:979,997,1005,1074,1149`.)
* **Impacto:** qualquer autenticado cria booking em nome de qualquer requesterActorId (cross-actor). **MTP?** SIM. **Dinheiro?** Não (booking ≠ pagamento). **DECISION?** Não. **YALA?** SIM. **Modo:** MODO B. **Handoff:** IA-TEMPO (dono do booking) + IA-ACTOR.

### GRANT-01 — `actor_has_any_role` VIVO (não-stub) é via legada de autoridade por role
* **Descrição:** enquanto `actor_has_permission` é stub deny-all, `actor_has_any_role` (`rbac.service.ts:210`) faz `EXISTS` real sobre `actors⋈user_roles⋈roles` — a via "role" do RBAC V2 está VIVA e leria 8 roles/1 user_role legados como autoridade se chamada.
* **Evidência:** `20260530551000_restore_actor_has_any_role.sql:45`; banco vivo `roles`=8/`permissions`=76/`user_roles`=1. **DECISION?** toca FASE 6 (congelada por 0113). **Modo:** HOLD + vigilância (`validate:rbac-stub-and-tombstones`). **Handoff:** IA-DECISOES-DT.

## 7. Gaps de conexão

* **actionContext ↔ autoridade:** o middleware propaga `actorId` mas NÃO o vincula a `req.user`; o vínculo depende de cada rota chamar `canRepresentActor`. Onde a rota esquece (sprint76, services/:id/availability), o hint vira autoridade. Gap estrutural: não há um guard global que recuse `actionContext.actorId ≠ representável`.
* **service ↔ offering ↔ ativação:** criação re-gateada (0144/createOffering sólidos), mas a **transição de status** não tem régua própria — gap entre "criar (gateado)" e "publicar (livre)".
* **authority ↔ dinheiro:** `/services/payments/execute` e `/internal/financial/*` têm gate por flag/registro-pré-auth em vez de autoridade de actor — gap entre firewall-por-flag e gate-por-representação.
* **gate de fronteira ↔ runtime:** `validate:actor-authority-boundary` sela 0113 (baseline 0) mas o sprint76/availability-de-serviço/internal-controllers ou escapam do padrão auditado ou são superfícies pré-auth não cobertas — gap de cobertura do próprio gate.
* **catálogo vazio:** services=0/offerings=0 hoje → muitos achados são latentes-mas-reais (estrutura sem dado); não confundir "0 rows" com "fechado".

## 8. Handoffs para outras IAs

* **IA-CADASTRO-ONBOARDING:** —
* **IA-PERFIL-SSOT:** `actor_professional_concepts.is_active` autodeclarado como único insumo PF p/ ativar oferta (ACTIVATION-01).
* **IA-ACTOR:** ACTIONCTX-01 (canal-6 sprint76), AUTH-02 (membership role='admin'/is_primary no ramo-4), AUTH-03 (requester); `ensureUserActor` write-in-read latente.
* **IA-EMPRESA-PJ:** `company_members` inexistente (adapter sobre `company_users`=2 rows); KYB upstream em publicações (não na ativação de oferta).
* **IA-OFERTA:** ACTIVATION-01 (régua de ativação draft→active); discovery público sem autoridade.
* **IA-TEMPO:** AUTH-03 (booking requester sem gate); TENANT-01 escreve `availability owner_type='service'`.
* **IA-FRONTEND-UX-CONTRATOS:** —
* **IA-BANCO:** BODY-01 (exploitabilidade runtime dos /internal controllers + rowcount `financial_freezes`); RLS `service_payment_requests` sem RLS; `count(*) actor_registry WHERE entity_table='companies'` (AUTH-02).
* **IA-DINHEIRO:** MONEY-AUTH-01 (dona: `/services/payments/execute` fail-open-se-flag); BODY-01 substrato freeze/treasury; valor das flags `SERVICE_FINANCIAL_RUNTIME_ENABLED`/`ENABLE_PAYOUT_WORKER`.
* **IA-DECISOES-DT:** GRANT-01 (FASE 6/role-path vivo); DECISION-0144 §B (ramo-4 cleanup deferido); régua de ativação (DECISION-0145 §A.12).

## 9. Riscos para MTP

* **Bloqueia MTP (corrigir antes):** BODY-01 (/internal financeiro pré-auth, cross-tenant) · ACTIONCTX-01 (sprint76) · TENANT-01 (services/:id/availability) · AUTH-03 (booking requester).
* **Não bloqueia mas corrigir:** AUTH-02 (ramo-4 legado — só com `actor_registry` populado) · `ensureUserActor` write-in-read (DT latente).
* **Cleanup:** subscriptions (rota não-montada) · marketplace-legacy-memory (flag-OFF→410) · `companies/:id/domains` (stub no-op).
* **Decisão de produto/arquitetura:** ACTIVATION-01 (régua de ativação PF, KYB/trust) · GRANT-01 (FASE 6).

## 10. Riscos para público e dinheiro

* **Blockers antes de PÚBLICO:** ACTIVATION-01 (PF autodeclarado ativa oferta publicamente descobrível sem KYB/trust) · ACTIONCTX-01 (autoria forjável) · BODY-01 (enumeração/escrita cross-tenant).
* **Blockers antes de DINHEIRO:** BODY-01 (freeze/treasury substrato) · MONEY-AUTH-01 (execute sem canRep, condicional a flag).
* **Blockers financeiros MODO C:** MONEY-AUTH-01 (revalidar authz de payer/receiver antes de reabrir a flag) · BODY-01 se tocar substrato financeiro vivo.
* **Permanece HOLD:** payout chain (request-only→approve fail-closed D3→executor selado só-worker DEFAULT-OFF→HTTP-execution 403; aprovar≠executar **RESPEITADO**, confirmado adversarialmente) · `releaseFundsToActorWalletForOrder` (sem caller de produção) · accounts-payable/unifycard/dispute-reversal (403 contidos) · `actor_has_any_role`/FASE 6 (congelado por 0113).

## 11. Veredito final

**NÃO_FECHA.**

Justificativa: o **núcleo** do modelo de autoridade é sólido e fecha para a maioria dos writers — `canRepresentActor`/`canManageCompany` são fail-closed, `actionContext.actorId` é tratado como hint nos resolvers canônicos, `createService`/`createOffering` já carregam elegibilidade (0144) e `company_id`/`professional_actor_id` do body são neutralizados server-side; o payout chain está selado e `aprovar≠executar` é respeitado (verificado adversarialmente). **Porém** há superfícies VIVAS que furam o eixo e não estão contidas: (1) três controllers `/internal` financeiros **pré-auth** confiam em `tenant_id` do body (BODY-01, classe do R19 deixada aberta); (2) `events-sprint76` usa `actionContext.actorId` como autoridade/autoria incluindo rota que cria PaymentIntent (ACTIONCTX-01); (3) `services/:serviceId/availability` autoriza por `actionContext.actorId` sem `canRepresentActor` (TENANT-01); (4) `createBooking` sem gate no requester (AUTH-03); (5) ativação draft→active sem revalidar KYB/trust para PF (ACTIVATION-01); (6) `/services/payments/execute` sem `canRepresentActor` contido só por flag (MONEY-AUTH-01). Enquanto BODY-01/ACTIONCTX-01/TENANT-01 existirem, o eixo **não fecha** para público nem para dinheiro.

## 12. Próxima frente recomendada

**FAST-PATH_AUTH_GUARD** (contenção imediata das superfícies vivas de spoof), sequenciada assim:

1. **FAST-PATH/MODO B — conter BODY-01:** espelhar a contenção R19 (403 `*_HTTP_DISABLED` ou mover `/internal/financial|treasury|governance` para dentro do `protectedScope` com auth+tenant server-side). É o achado mais grave (pré-auth cross-tenant financeiro). **Handoff IA-BANCO/IA-DINHEIRO** confirma exploitabilidade antes.
2. **MODO B — conter ACTIONCTX-01 + TENANT-01 + AUTH-03:** bind `req.user`+`canRepresentActor` (ou 403+guard) em sprint76 / services-availability / booking-requester; estender `validate:actor-authority-boundary` para cobri-las.
3. **MODO_B_ACTIVATION_AUTHORITY + DECISION:** régua de ativação draft→active (DECISION-0145 §A.12) — KYB/trust ou contenção da transição PF. **Clayton/IA-OFERTA.**
4. **MODO C / HANDOFF_DINHEIRO:** MONEY-AUTH-01 — revalidar authz payer/receiver como pré-condição de reabrir `SERVICE_FINANCIAL_RUNTIME_ENABLED`. **IA-DINHEIRO dona.**
5. **MODO B (deferido) / HOLD:** AUTH-02 ramo-4 cleanup (já deferido em DECISION-0144 §B) · GRANT-01/FASE 6 (congelado por 0113).

Cada fatia: três paralelas + E2E fail-first + gates + reseal YALA + GO ChatGPT + promulgação Clayton. **Nada executa por esta auditoria.**

## 13. Resumo executivo

* HEAD vivo `aaeb50b5`; auditoria READ-ONLY de 1ª mão (disco + `unificard_dev`), sem edição/commit.
* **Núcleo sólido:** `canRepresentActor`/`canManageCompany` fail-closed; `actionContext.actorId` = hint no middleware (não infere de req.user); `createService`/`createOffering` gateados + elegibilidade 0144; `company_id`/`professional_actor_id` do body neutralizados server-side.
* **🔴 BODY-01 (CRÍTICO):** `/internal/financial|treasury|governance` registrados **pré-auth** confiam em `tenant_id` do body — escrita/enumeração financeira+governança cross-tenant não-autenticada; mesma classe do R19, deixada aberta.
* **🔴 ACTIONCTX-01:** `events-sprint76` usa `actionContext.actorId` como autoria/autoridade (inclui rota que cria PaymentIntent), sem `canRepresentActor`, montado em produção.
* **🔴 TENANT-01:** `services/:serviceId/availability` autoriza por `actionContext.actorId` (client) sem `canRepresentActor` — spoof de agenda de serviço alheio.
* **AUTH-03:** `createBooking` sem `canRepresentActor` no requester (cross-actor). **ACTIVATION-01:** draft→active gateado só por `canRepresentActor`, sem KYB/trust (inseguro p/ PF autodeclarado).
* **MONEY-AUTH-01:** `/services/payments/execute` move dinheiro sem `canRepresentActor` em payer/receiver — fail-open contido só por flag default-OFF (handoff IA-DINHEIRO). Payout chain selada; aprovar≠executar respeitado (verificado adversarialmente).
* **Banco vivo:** company_users=2; actor_delegations=9; actor_capability_grants=0 (dormant); financial_approval_*=0/0/0; services=0; service_offerings=0; `actor_users`/`company_members` inexistentes; RLS OFF em `service_payment_requests` (ON+FORCE em `executions`).
* **AUTH-02/GRANT-01 (vigilância):** ramo-4 legado (`is_primary`/`role='admin'`) amplia rep. de company-actor além de canManageCompany (cleanup deferido 0144 §B); `actor_has_any_role` é via legada VIVA (FASE 6 congelada por 0113); `actor_has_permission` = stub deny-all confirmado em runtime.
* **Veredito: NÃO_FECHA** → próxima frente **FAST-PATH_AUTH_GUARD** (conter BODY-01 espelhando R19; depois sprint76/availability/booking; depois DECISION de ativação; MONEY-AUTH-01 → IA-DINHEIRO). Insumo, não GO.

---

**Respostas obrigatórias (10):** 1) actorId do cliente é só hint? **PARCIAL** (sim nos resolvers; não em sprint76/services-availability). 2) actionContext.actorId usado como autoridade soberana em algum writer? **SIM** (sprint76; services/:id/availability). 3) canRepresentActor cobre os principais writers por actor? **PARCIAL** (cobre maioria; gaps booking-requester/sprint76/services-availability). 4) canManageCompany cobre os writers de PJ? **SIM**. 5) writers tenant-only onde deveria haver owner/actor binding? **SIM** (services/:id/availability; /internal controllers). 6) rotas aceitando provider/owner/company_id do body sem derivação server-side? **RISCO** (offerings/PO/supplier OK; mas /internal aceita `tenant_id` do body como autoridade; sprint76 `organizerActorId` cru). 7) ativação draft→active segura p/ público? **NÃO** (PARCIAL p/ PJ via KYB transitivo; inseguro p/ PF). 8) ativação exige KYB/trust aprovado? **PARCIAL** (KYB upstream na publicação PJ; ativação não revalida; PF nenhum). 9) eixo bloqueia MTP? **BLOQUEIA_PARCIAL**. 10) eixo bloqueia dinheiro? **BLOQUEIA_PARCIAL** (+ HOLD_FINANCEIRO no payout chain selado).

*Carimbo final: HEAD `aaeb50b5` · branch `rescue-structural` · 2026-06-21 · READ-ONLY (sem código/migration/commit) · memória `MINHA_MEMORIA_AUTORIDADE.md` lida · banco `unificard_dev` consultado read-only · 8 auditores + 2 verificadores adversariais. — IA-AUTORIDADE / IA-04, insumo para IA-DIRETORA/Clayton.*
