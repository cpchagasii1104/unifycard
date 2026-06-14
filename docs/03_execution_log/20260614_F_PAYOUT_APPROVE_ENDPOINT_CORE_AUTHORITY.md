# 2026-06-14 — F-PAYOUT-APPROVE-ENDPOINT-CORE-AUTHORITY (MODO: EXECUTOR / CAMINHO B FAIL-CLOSED)

Materializa o **approve endpoint** autorizado por DECISION-0129 (D14) no modo **FAIL-CLOSED** (CAMINHO B):
`POST /api/payouts/requests/:payoutRequestId/decision` existe, resolve o payout_request + approval_request,
valida tenant/tipo/estado, exige **requester != approver** (D3) e então detecta que **não há política/faixa
de aprovação material promulgada** (D2/D4/D6) → retorna **`PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED`**. A aprovação
**NÃO acontece**: approval continua `pending`, payout continua `pending_approval`, `executed:false`. **Zero Bank,
zero worker, zero approveActorWalletPayout, zero recordFinancialApprovalDecision.** Parent `6259c51b` · branch
`rescue-structural` · dev 384 (sem migration).

## READ-FIRST — determinantes do CAMINHO (verificado em unificard_dev, dev 384)

| Pergunta | Evidência material | Resultado |
| --- | --- | --- |
| Existe política/faixa segura material e promulgada? | `information_schema`: tabelas `payout_policies/financial_approval_policies/financial_approvers` AUSENTES; `bank_policies` existe mas **0 linhas**; nenhuma faixa em DECISION (D6 difere a Clayton). | **NÃO** |
| Onde vive a autoridade Core Financeiro de aprovação? | Core de aprovação (`approval_requests`/`approval_votes` + `financial-approval.service/repository`) é **NÃO-EXECUTOR**; não há coluna/permção de *poder de aprovar*. | Modelo de decisão existe; **autoridade de aprovar NÃO materializada** |
| Existe approver materialmente autorizado pelo Core? | Sem `financial:approve_payout` (só `financial:execute_payout`→`can_hold_assets`); `organization_members` AUSENTE; sem `can_approve_*`/`approve_payout` em qualquer tabela. | **NÃO** |
| Como provar requester != approver? | `approval_requests.requested_by_user_id` (server-side) vs `req.user.id` (server-side). | Provável e implementado (D3) |
| ATL/KYC/Guarda/recovery/risco têm checagem material? | Sem substrato de elegibilidade de aprovação; recovery/locks só no executor selado (F3). | **fail-closed** (não fingir) |
| Dá para aprovar sem hardcode arbitrário? | D6 proíbe teto sem DECISION; nenhuma DECISION define faixa. | **NÃO** → não aprovar |
| Dá para preservar baseline 0113=0? | Rota nova resolve por `:payoutRequestId` (recurso) + tenant server-side; **zero canal client-declared** (sem `params.actorId`/`body.actorId`/`x-actor-id`/`query.actorId`/`actionContext`). | **SIM** |

**Decisão de caminho: CAMINHO B — FAIL-CLOSED IMPLEMENTED.** CAMINHO A é impossível sem fabricar approver / hardcodar
faixa (proibido D6/D12). CAMINHO C desnecessário: a porta fail-closed é criável sem confusão semântica.

## Patch

- **`src/modules/payout/payout-approval-policy.ts` (NOVO):** resolvedor **fail-closed** `resolvePayoutApprovalPolicy()`.
  Sempre `{ configured:false, code:'PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED', reason }`. **NÃO** hardcoda faixa, **NÃO** lê
  grant comum, **NÃO** usa saldo. Costura de tipo `configured:true` (`code:'..._CONFIGURED'`) para CAMINHO A — nunca
  produzida hoje. Discriminante string-literal `code` (narrowing estável sob `tsconfig.build strict:false`).
- **`src/modules/payout/payout-decision.routes.ts` (NOVO):** `POST /payouts/requests/:payoutRequestId/decision`.
  subject(aprovador)=`req.user.id`, tenant=`req.tenant.id` server-side; body zod `.strip()` (`decision:'approve'`, `reason?`;
  ignora approvedByUserId/tenantId/status/operationType/approvalRequestId/availableBalanceCents). Resolve payout via
  reader read-only; resolve approval via Core `findApprovalRequestById`; valida `operation_type=actor_wallet_payout`,
  status pendente; **403 PAYOUT_APPROVER_CANNOT_BE_REQUESTER** se `requested_by_user_id == req.user.id`; senão **422
  PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED** (`executed:false`). **NÃO** importa/chama approveActorWalletPayout/
  recordFinancialApprovalDecision/executeActorWalletPayout/worker/Bank.
- **`src/modules/wallet/actor-wallet-payout.service.ts`:** + `getActorWalletPayoutRequestById(tenantId, id)` — **reader
  read-only** (SELECT por id+tenant; zero lock/mutação/dinheiro). Não toca o executor/approve bridge selados.
- **`payout.module.ts`:** registra `payoutDecisionRoutes` em `/api`. **Rotas antigas intocadas (403).**

## Decision flow

```
POST /api/payouts/requests/:payoutRequestId/decision  (protectedScope: auth+tenant)
  approverUserId=req.user.id · tenantId=req.tenant.id   (server-side; body subject/tenant ignorados)
  → getActorWalletPayoutRequestById(tenantId, id)  → null ? 404
  → payout.status == 'pending_approval' ? senão 409
  → findApprovalRequestById(tenantId, payout.approvalRequestId)  (Core)  → null ? 404
  → approval.operation_type == 'actor_wallet_payout' ? senão 422 WRONG_TYPE
  → approval.status == 'pending' ? senão 409
  → approval.requested_by_user_id == approverUserId ? 403 PAYOUT_APPROVER_CANNOT_BE_REQUESTER
  → resolvePayoutApprovalPolicy(...) → fail-closed → 422 PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED
       approval permanece 'pending' · payout permanece 'pending_approval' · executed:false
APROVAÇÃO REAL / EXECUÇÃO = fora desta frente (CAMINHO A futuro depende de DECISION de faixa/autoridade).
```

## Guard + provas

- **Guard NOVO** `audit-payout-approve-endpoint.mjs` no `validate:regression-guards`: FALHA se a rota chamar
  approve/execute/worker/Bank/recordDecision, escrever bank_*/approval_* direto, retornar executed:true, usar
  availableBalanceCents/seller_available/payout_requests/company_users/tenant_operator_grants/organization_members/
  businessAuthorizationService/can_execute_/can_approve_/financial:(execute|approve)_payout, ler canal client-declared
  ou aceitar spoof de body; ou faltar resolvePayoutApprovalPolicy/policy.code/PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED/
  PAYOUT_APPROVER_CANNOT_BE_REQUESTER/requested_by_user_id/findApprovalRequestById/executed:false/subject+tenant
  server-side; ou se o resolvedor deixar de ser fail-closed (sem `configured:false`, ou retornar `configured:true`, ou
  ler grant/saldo); ou se rotas antigas/baseline 0113 regredirem.
- **Negative proof** `negative-proof-payout-approve-endpoint.ps1`: 5 mutações (approve real, executed:true, remoção da
  segregação, remoção da política, resolvedor `configured:true`) → guard FALHA nas 5 → restauração **byte-idêntica**
  (SHA256 de rota + policy).
- **E2E** `validate-pipeline-e2e-payout-approve-endpoint.ts` (DB efêmera, stub-auth, **zero dinheiro**): **25/25** (CAMINHO B
  T1–T25) — 422 NOT_CONFIGURED/approval pending/payout pending_approval/executed:false · bank_ledger/transactions/splits
  intocados · approveActorWalletPayout não chamado · zero approval_votes · requester==approver→403 · spoof ignorado ·
  wrong tenant→404 · wrong operation_type→422 · autoridade comum ausente · availableBalanceCents não autoriza · guards
  verdes · rotas antigas 403 · worker default-off · bank-http request-only · baseline 0113=0 · zero can_execute_* ·
  nenhum approved/ledger nasce.

| Prova | Resultado |
| --- | --- |
| e2e (DB efêmera, zero dinheiro) | **25/25** |
| negative proof | morde approve/executed:true/sem-segregação/sem-política/configured:true; restauração byte-idêntica |
| payout-approve-endpoint guard | GATE OK (no chain) |
| actor-writer §4.8 / bank-ledger §4.6 | GATE OK / GATE OK |
| regression-guards (chain completa) | rc=0 (0113 `flagged=0 baseline=0 safe_subject_recognized=6`) |
| arch --strict | `critical_new=0` exit 0 (4 warning_new pré-existentes, nenhum nos arquivos da frente) |
| tsc backend | **25** (baseline arc-0113; zero erro nos arquivos tocados) |

## Hard stops respeitados

Não chamou approveActorWalletPayout/recordFinancialApprovalDecision/executeActorWalletPayout/worker/Bank ·
`bank_ledger`/`bank_transactions`/`bank_splits` intocados · rotas antigas fail-closed (403) · worker default-off ·
bank-http request-only · **baseline 0113=0** · `seller_available`/`payout_requests` legado não usados ·
`availableBalanceCents` não autoriza · `company_users`/`tenant_operator_grants`/`organization_members`/
`businessAuthorizationService` não aprovam · `can_execute_*`/`can_approve_*` não criados · faixa de valor não hardcodada ·
requester não aprova o próprio payout · **nenhum approved real nasce** (política ausente) · executor/worker/approve-bridge
selados intocados.

## Ressalvas (fora desta frente)

- **CAMINHO A (aprovação real)** depende de Clayton promulgar, via DECISION: (a) o modelo de **autoridade Core Financeiro**
  de aprovação (D2) e (b) a **faixa segura de valor** (D4/D6). Até lá, fail-closed.
- **Multi-approval/quórum** fora (D5); **PIX/TED** fora; **dispute/reversal/card** fora; **ATL/KYC/Guarda/recovery/risco**
  como gate de aprovação = materializar na frente CAMINHO A; **observabilidade** de tentativas de aprovação = futuro.

## Estado

F-PAYOUT-APPROVE-ENDPOINT-CORE-AUTHORITY: **FAIL-CLOSED IMPLEMENTED / HOLD PARA RESEAL**. O approve endpoint existe e
**falha fechado** por política/faixa ausente — não aprova, não move dinheiro, `executed:false`. baseline 0113=0;
request-only/executor/worker/approve-bridge selados intocados. Próxima: decisão de Clayton sobre faixa/autoridade (CAMINHO A).
