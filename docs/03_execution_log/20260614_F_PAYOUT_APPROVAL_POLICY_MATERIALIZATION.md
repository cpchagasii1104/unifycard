# 2026-06-14 — F-PAYOUT-APPROVAL-POLICY-MATERIALIZATION (MODO: EXECUTOR / CAMINHO A — IMPLEMENTED)

Materializa a **DECISION-0130** no Core Financeiro: o approve endpoint deixa de ser fail-closed e passa a
**APROVAR DE VERDADE payouts DENTRO da faixa MVP** (policy + authority do operador financeiro institucional +
travas D7 + limite diário + segregação), registrando a decisão append-only e mudando approval/payout →
`approved`. **APROVAR NÃO EXECUTA** (`executed:false`; zero Bank/worker/ledger). Parent `fc139481` · branch
`rescue-structural` · **dev 384 → 385** (migration `20260614150000`).

## READ-FIRST — determinantes (verificado em unificard_dev, dev 384/385)

| Pergunta | Evidência | Resposta |
| --- | --- | --- |
| FK do aprovador? | `approval_requests.requested_by_user_id → users.id`; bridge `approveActorWalletPayout(...,approvedByUserId)` = users.id; `users` é tenant-scoped (`users.tenant_id`). | **`users.id`** (tenant-scoped; casa a segregação) |
| Vincular authority ao tenant sem body spoof? | `financial_approval_authorities.tenant_id` + `user_id`; tenantId/approverUserId server-side (req.tenant/req.user). | tenant_id explícito + user_id server-side |
| Vincular policy ao scope? | coluna `scope CHECK ('actor_wallet_payout')`. | scope canônico |
| daily limit sem corrida? | `pg_advisory_xact_lock(hashtext(tenant),hashtext(actor))` na TX da decisão + idempotency_key por payout + active-gate (1 payout ativo/actor). | advisory lock + idempotência |
| requester != approver? | `approval.requested_by_user_id` (server-side) vs `req.user.id`; barrado na rota E no Core (defesa-em-profundidade). | provado |
| company_users/tenant_operator_grants não aprovam? | autoridade SÓ via `financial_approval_authorities`; guard proíbe os grants comuns em route/core. | provado |
| Travas D7 com substrato? | **TODAS materiais:** `identities.kyc_status`, `atl_blocked_actors`, `actor_wallet_recovery_obligations` (status pending_approval/approved/partially_recovered), `actor_risk_profile.risk_level` (high/blocked), destino (`internal_settlement`). | KYC/ATL/recovery/risco/destino = material |
| Travas D7 fail-closed? | **KYB**: aplica a payout EXTERNO PJ; o MVP é `internal_settlement` (sem destino externo) → KYB fora do MVP (DT). Destino não-internal → bloqueado. | KYB deferido (DT); destino fail-closed |
| Auditoria append-only? | `financial_approval_policy_events` + trigger `trg_fap_events_no_mutate` (UPDATE/DELETE proibidos). | D9 garantido |
| baseline 0113=0? | rota resolve por `:payoutRequestId` (recurso) + tenant server-side → zero canal client-declared. | preservado |

**Caminho: CAMINHO A — IMPLEMENTED.** Substrato criado, policy/authority materiais, requester≠approver, faixa
MVP travada (banco + resolver), D7 materiais (KYB deferido por escopo internal), aprovação muda estado sem mover
dinheiro, `executed:false`.

## Patch

- **Migration `migrations/20260614150000_financial_approval_policy_materialization.sql` (dev 385):**
  `financial_approval_policies` / `financial_approval_authorities` / `financial_approval_policy_events`. Dinheiro
  **BIGINT**; tempo **TIMESTAMPTZ**; `requires_second_approval`/`is_active` booleanos; **CHECK MVP ceiling**
  (`max_amount_cents<=50000 AND daily_limit_cents<=150000` — ratifica D4); índices (tenant/scope/active; uso diário
  por actor; idempotency parcial); **append-only** via trigger (UPDATE/DELETE → exception, D9). Sem backfill; sem
  autoridade automática p/ owner/admin.
- **`src/core/financial-approval/payout-approval-policy.constants.ts` (NOVO):** `PAYOUT_APPROVAL_SCOPE`,
  `PAYOUT_MVP_MAX_AMOUNT_CENTS=50000`, `PAYOUT_MVP_DAILY_LIMIT_CENTS=150000`, códigos de bloqueio.
- **`src/core/financial-approval/payout-approval-policy.service.ts` (NOVO):** `decidePayoutApproval` — TX com
  advisory lock por (tenant, actor); idempotente; resolve policy + authority do aprovador; aplica faixa
  `min(policy,authority,teto)`, multi-approval (>50000 / requires_second_approval), cap, **D7** (destino/KYC/ATL/
  recovery/risco), **limite diário** (eventos approved de hoje); grava evento append-only (approved/blocked).
  **NÃO importa @modules; NÃO move dinheiro; NÃO chama executor/worker/Bank.**
- **`src/modules/payout/payout-approval.service.ts` (NOVO — orquestrador):** chama a decisão Core; se aprovado,
  chama o **bridge selado** `approveActorWalletPayout` (registra voto Core + flip pending_approval→approved, sem
  dinheiro). Vive no módulo p/ a ROTA nunca referenciar o bridge (execution-seal permanece verde).
- **`src/modules/payout/payout-decision.routes.ts` (REESCRITO):** pré-checagens (resolve payout/approval, tipo/
  estado, requester≠approver) + delega ao orquestrador. 200 `{approvalStatus:'approved', payoutStatus:'approved',
  executed:false}` se aprovado; senão o código de bloqueio + `executed:false`. **Não chama bridge/executor/worker/Bank.**
- **REMOVIDO:** `src/modules/payout/payout-approval-policy.ts` (stub fail-closed da frente anterior, substituído pelo Core material).
- **Guard `audit-financial-approval-core-boundary.mjs`:** token de import de execução `\/payout` (substring cru,
  amplo demais — casava arquivos internos do Core nomeados `payout-*`) **precisado para `modules\/payout`**. Imports
  de execução seguem barrados (`modules/payout`, `payout.service`, `actor-wallet-payout`, `bank-transaction`,
  `bank-ledger`, `unifybank`, `reversal.service`). **Tightening (não loosening): o Core continua proibido de importar
  o módulo de payout/Bank.**

## Approval flow

```
POST /api/payouts/requests/:id/decision  (auth+tenant; subject/tenant server-side)
  → resolve payout (tenant) → pending_approval ? → approval (Core findApprovalRequestById) → type/status ?
  → requested_by_user_id != req.user.id ? senão 403 PAYOUT_APPROVER_CANNOT_BE_REQUESTER
  → payoutApprovalService.approvePayoutDecision → Core decidePayoutApproval (TX + advisory lock):
       policy ativa ? · authority ativa do aprovador ? · amount<=min(policy,auth,50000) (>50000→MULTI_APPROVAL) ·
       requires_second_approval→MULTI_APPROVAL · cap · D7(destino/KYC/ATL/recovery/risco) · diário<=min(...,150000)
       → APROVADO: grava evento append-only (idempotente por payout; ledger diário)
  → se aprovado: bridge approveActorWalletPayout (voto Core + flip → approved; sem dinheiro)
  → 200 { approvalStatus:'approved', payoutStatus:'approved', executed:false }   (execução = worker system-only)
```

## Provas

- **E2E** `validate-pipeline-e2e-payout-approve-endpoint.ts` (DB efêmera, **zero dinheiro**): **37/37** — T1–T5 policy
  ausente→NOT_CONFIGURED/pending; T6–T13 approve real (approval+payout→approved, bank intocado, executed:false, não
  completed, worker não chamado); T14 requester==approver→403; T15 sem authority→403; T16/T17 grants comuns ausentes;
  T18 cross-tenant authority→403; T19 authority revogada→403; T20 policy revogada→NOT_CONFIGURED; T21 amount>50000→
  MULTI_APPROVAL; T22 daily>150000→DAILY_LIMIT_EXCEEDED; T23 dentro da faixa→approve; T24 spoof body não empresta
  autoridade; T25–T34 seller_available/payout_requests não usados, rotas antigas 403, worker default-off, bank-http
  request-only, baseline 0113=0, can_execute_* não criado, request-only intacto, approve não marca completed, executor/
  worker selados; **T35 2 aprovações concorrentes → 1 evento, daily contado 1× (advisory lock)**; **T36 D7 KYC/ATL/
  RISCO/RECOVERY (HTTP) + DESTINO (core) bloqueiam, payouts seguem pending**; +selo bank_ledger imutável no run.
- **Negative proof** (4 arquivos route/orch/core/const): 6 mordidas (route chama bridge · executed:true · sem
  segregação · core sem authority · faixa divergente · orch sem bridge) + restauração **byte-idêntica** (SHA256).
- **Guard** `audit-payout-approve-endpoint.mjs` (route+orch+core+const) no `validate:regression-guards`.

| Prova | Resultado |
| --- | --- |
| e2e (efêmero, zero dinheiro) | **37/37** |
| negative proof | 6 mordidas; restauração byte-idêntica |
| payout-approve-endpoint guard | GATE OK |
| financial-approval-core boundary | GATE OK (5 arquivos Core, NÃO-EXECUTOR) |
| actor-writer §4.8 / bank-ledger §4.6 | GATE OK / GATE OK |
| regression-guards (chain) | rc=0 (0113 `flagged=0 baseline=0 safe_subject_recognized=6`; migrations 385) |
| arch --strict | `critical_new=0` (4 warning_new pré-existentes, nenhum meu) |
| arch:core (depcruise) | 0 violações envolvendo os novos arquivos Core |
| tsc backend | **25** (baseline arc-0113; zero erro nos arquivos tocados) |

## Hard stops respeitados

HTTP NÃO chama executeActorWalletPayout/worker/Bank · `bank_ledger`/`bank_transactions`/`bank_splits` intocados no
approve · rotas antigas 403 · worker default-off · bank-http request-only · **baseline 0113=0** · `seller_available`/
`payout_requests` legado não usados · `availableBalanceCents` não autoriza · `can_execute_*`/`can_approve_*` não criados ·
`company_users`/`tenant_operator_grants`/`organization_members` não aprovam (autoridade só via `financial_approval_
authorities`) · requester não aprova o próprio payout · amount>50000 não aprova · daily>150000 não aprova · faixa não
hardcodada arbitrariamente (ratifica D4 no banco+resolver) · executor/worker/bridge selados intocados (bridge só chamado
pelo orquestrador, não pela rota).

## Ressalvas (DTs / fora do MVP)

- **KYB** (D7): aplica a payout EXTERNO PJ; o MVP é `internal_settlement` (sem destino externo) → KYB **deferido** para
  a frente de destino externo (DT-PAYOUT-APPROVAL-KYB-DEFERRED-INTERNAL-MVP). Destino não-internal é **bloqueado**.
- **Auditoria de blocked**: o evento append-only registra `approved` (sempre) e `blocked` (quando há policy+authority);
  pré-autoridade (sem policy/authority/segregação) não gera evento. Auditoria completa de rejected/blocked = evolução.
- **Multi-approval/quórum** fora (D5); **PIX/TED** fora; **dispute/reversal/cartão** fora; **observabilidade** futura.

## Estado

F-PAYOUT-APPROVAL-POLICY-MATERIALIZATION: **IMPLEMENTED / HOLD PARA RESEAL**. Aprovação material de payout viva
DENTRO da faixa MVP (50000/150000), operador financeiro institucional no Core, segregação, D7 materiais, auditoria
append-only, limite diário race-safe; HTTP aprova sem executar (`executed:false`). dev 385; baseline 0113=0; executor/
worker/bridge selados intocados. DT-PAYOUT-APPROVAL-POLICY-NOT-CONFIGURED → **CLOSED**. Próximas: ativar worker
(decisão própria), destino externo + KYB, multi-approval.
