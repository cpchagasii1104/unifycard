# DECISION-0130 — Materialização da política de aprovação de payout (aprovador material, substrato Core, faixa segura MVP)

**Status:** **PROMULGADA / NORMATIVA.** Runtime da política material **NÃO implementado** — sua implementação fica
**AUTORIZADA** (D12) em frente executora própria (`F-PAYOUT-APPROVAL-POLICY-MATERIALIZATION`). Esta DECISION
**concretiza** o que a DECISION-0129 deixou aberto: o **aprovador material**, o **substrato no Core Financeiro** e a
**faixa segura de valor** (a lacuna que mantém o approve endpoint em `PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED`).

**Data:** 2026-06-14 · **Branch:** `rescue-structural` · **Tipo:** arquitetural / produto / autoridade financeira
· **Frente:** DECISION-PAYOUT-APPROVAL-POLICY-MATERIALIZATION (cartório)

**Precedência:** `AUTHORITY_LAW` / `AUTHORITY_PRECEDENCE` (vence a trava mais restritiva; responsabilidade no CPF) ·
`SSOT_EXCLUSIVE_BANK_RULE` (Bank = única SSOT financeira) · **DECISION-0128** (Core de Aprovação Financeira; grants
comuns não executam dinheiro) · **DECISION-0129** (autoridade de aprovação de payout: D1 solicita, D2 aprova=Core, D3
requester≠approver, D4 MVP 1-aprovação/faixa segura, **D6 valores=Clayton/sem hardcode**, D10 HTTP nunca executa) ·
**DECISION-0058** (actor_wallet payout, trilho canônico) · **DECISION-0053** (recovery pós-D-money) ·
**DECISION-0125/0126** (`company_users`/`tenant_operator_grants` = grants comuns, **não** autoridade financeira final).

**Relação com 0129:** esta DECISION **não revoga** a 0129 — **concretiza** seus pontos abertos. Em particular,
**0130 D4 fixa os valores de faixa** que **0129 D6** deferira a Clayton; **0130 D1/D2** materializam o aprovador e o
substrato que **0129 D2** exigia "no Core". Em conflito de leitura, prevalece a trava **mais restritiva**.

---

## 1. Contexto

A cadeia de payout está selada: **request-only** (`POST /api/payouts/requests`, CLOSED), **executor selado**
(`executeActorWalletPayout`, Core-aprovado, CLOSED), **worker canônico system-only default-off** (CLOSED), **approve
endpoint FAIL-CLOSED** (`POST /api/payouts/requests/:id/decision` → `PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED`,
F-PAYOUT-APPROVE-ENDPOINT-CORE-AUTHORITY / CAMINHO B), Bank como único trilho de ledger, DECISION-0113 baseline=0. O
READ-FIRST do approve endpoint provou de 1ª mão que **não existia política/faixa material nem autoridade Core de
aprovação** (tabelas `financial_approval_policies/financial_approval_authorities/financial_approvers` ausentes;
`bank_policies` vazia; sem `financial:approve_payout`; `organization_members` ausente). Por isso o approve **não aprova
ninguém** hoje. Esta DECISION registra a decisão de Clayton que **materializa** essa política — definindo aprovador,
substrato e faixa segura MVP — para destravar a frente de implementação.

## 2. Decisão (D1–D12)

### D1 — Aprovador material
A aprovação material de payout pertence a **operador financeiro institucional** cadastrado no **Core Financeiro**.
**NÃO são aprovadores finais:** dono da empresa automaticamente; tenant admin comum; `company_users`;
`tenant_operator_grants` comum; `organization_members` legado; role genérica; `financial:execute_payout`;
`can_execute_*`; `actionContext`; `x-actor-id`; `body`/`query` `actorId`. A autoridade é **própria** do Core Financeiro:
`financial_approval_operator` / `financial_approval_authority` (ou nomenclatura equivalente canônica no Core Financeiro).

### D2 — Substrato material no Core Financeiro
Autoridade e política **vivem no Core Financeiro**, não no RBAC comum. Tabelas/políticas recomendadas (ou nomes
equivalentes, desde que semanticamente canônicos):
- `financial_approval_policies`
- `financial_approval_authorities`
- `financial_approval_policy_events`

**Requisitos mínimos:** `tenant_id`; `global_user_id` ou `user_id` **resolvido server-side**; `scope = actor_wallet_payout`;
`max_amount_cents`; `daily_limit_cents`; `requires_second_approval`; `is_active`; `created_at TIMESTAMPTZ`;
`revoked_at TIMESTAMPTZ`; `created_by`; `revoked_by`; `reason`; **trilha append-only/auditável**.

### D3 — Segregação de função
No MVP, **sem exceção:** `requested_by_user_id != approved_by_user_id`.

### D4 — Faixa segura MVP (enterprise/piloto)
- Payout **máximo por aprovação:** **R$ 500,00** → `amount_cents <= 50000` (`max_amount_cents = 50000`).
- **Limite diário por actor:** **R$ 1.500,00** → `daily_limit_cents <= 150000` (`daily_limit_cents = 150000`).

Estes são **limites de MVP controlado**, **não** o limite final do produto. (Concretiza DECISION-0129 D6: o código deixa
de ser fail-closed por valor-ausente quando esta faixa for materializada — e somente dentro dela.)

### D5 — Acima da faixa segura
**Não aprovar. Não executar. Não colocar em fila efetiva de execução.** Retornar/bloquear como
**`APPROVAL_POLICY_REQUIRES_MULTI_APPROVAL`**. Multi-approval/quórum é **frente futura** — **não improvisar** aprovação
manual acima da faixa.

### D6 — PF e PJ
Ambos podem **solicitar** payout, com **políticas e elegibilidade distintas**.
- **PF:** KYC pessoal aprovado; ATL limpo; destino bancário próprio/verificado; limite MVP baixo.
- **PJ:** KYB aprovado; **representante autorizado solicita**; **operador financeiro institucional aprova**; destino
  bancário da empresa ou beneficiário autorizado; mesmo teto MVP inicial até maturidade maior.

### D7 — Travas absolutas
Bloqueiam sempre ou reduzem elegibilidade a zero no MVP: ATL restritivo; KYC/KYB não aprovado; recovery obligation ativa;
dispute/reversal pendente; risco alto; destino bancário não verificado; valor acima da política; **solicitante igual
aprovador**. Em conflito, **vence a trava mais restritiva: ATL > KYC/KYB > Guarda/recovery > IA/Sistemas > Produto.**

### D8 — `availableBalanceCents`
**Nunca autoriza payout.** É leitura/projeção. Approve pode consultar contexto, mas a **execução revalida no Bank**, com
locks, recovery obligations e ledger.

### D9 — Auditoria
Cada decisão de aprovação gera **trilha append-only** com, no mínimo: `approval_request_id`; `payout_request_id`;
`decision = approved/rejected/blocked`; `approved_by_user_id`; `requested_by_user_id`; `policy_id`; `amount_cents`;
`reason`; `created_at`; `risk_snapshot`; `kyc_status_snapshot`; `recovery_snapshot`; `idempotency_key`. **Decisão
terminal não é apagada.**

### D10 — Execução
**HTTP approve:** registra decisão; muda approval → `approved`; muda payout → `approved`; retorna `executed:false`.
**HTTP approve NUNCA:** chama Bank; chama worker; chama `executeActorWalletPayout`; move ledger; marca `completed`.
**Worker:** system-only; default-off até ativação explícita; processa `approved`. **Executor:** move dinheiro via
**BankTransactionPort**; Bank registra `bank_transactions`/`bank_ledger`/`bank_splits`.

### D11 — Grants comuns proibidos
Proibido usar como **autoridade final:** `company_users.can_execute_payout`; `tenant_operator_grants.can_execute_payout`;
role genérica; `financial:execute_payout`; `organization_members` legado.

### D12 — Próxima frente autorizada
Após **promulgação + reseal**, fica AUTORIZADA uma frente executora (`F-PAYOUT-APPROVAL-POLICY-MATERIALIZATION`) para
materializar: `financial_approval_policies`; `financial_approval_authorities`; `financial_approval_policy_events`; o
**policy resolver `configured:true`** para `actor_wallet_payout`; o **approve endpoint real dentro da faixa MVP**;
`requester != approver`; **bloqueio acima da faixa** (`APPROVAL_POLICY_REQUIRES_MULTI_APPROVAL`); **auditoria
append-only**.

## 3. Consequências

- **approve endpoint deixa de ser autoridade indefinida materialmente possível:** há aprovador (D1), substrato (D2),
  faixa (D4) e travas (D7). O CAMINHO B atual (fail-closed) converge para CAMINHO A **somente após** a frente D12.
- **a faixa de valor deixa de ser "valor ausente":** D4 fixa o teto MVP (`50000`/`150000`); acima → `MULTI_APPROVAL`
  (D5), nunca execução improvisada.
- **execução/worker permanecem selados** (D10); **Bank continua SSOT financeiro**; `availableBalanceCents` nunca
  autoriza (D8).
- **grants comuns permanecem proibidos como autoridade final** (D1/D11); a autoridade é própria do Core (D2).
- **request-only / executor / worker / approve-bridge** permanecem como estão — esta DECISION **não** altera runtime.

## 4. Modelo (resumo normativo)

```
SOLICITA   representante autorizado (canRepresentActor; req.user server-side)     → pending_approval (executed:false)
APROVA     operador financeiro institucional do Core (financial_approval_authority; política explícita;
           requester≠approver; dentro da faixa MVP: amount_cents<=50000 e diário<=150000;
           ATL/KYC/KYB/Guarda/recovery/risco/destino verificados)                 → approved (executed:false)
ACIMA      amount_cents > faixa  → APPROVAL_POLICY_REQUIRES_MULTI_APPROVAL (não aprova, não enfileira)
EXECUTA    worker system-only default-off → executor → BankTransactionPort         (HTTP nunca executa)
REGISTRA   Bank (bank_transactions/bank_ledger/bank_splits = SSOT)
AUDITA     trilha append-only da decisão (D9) — terminal não apagável
```

## 5. Estado

DECISION-0130 **PROMULGADA / NORMATIVA**. Política material de aprovação de payout **definida**: aprovador institucional
no Core (D1/D2), faixa segura MVP `max_amount_cents=50000` / `daily_limit_cents=150000` (D4), `requester != approver`
(D3), fail-closed acima da faixa via `APPROVAL_POLICY_REQUIRES_MULTI_APPROVAL` (D5), auditoria append-only (D9).
Implementação **AUTORIZADA** (D12) na frente `F-PAYOUT-APPROVAL-POLICY-MATERIALIZATION`. **Fora:** multi-approval/quórum,
PIX/TED, dispute/reversal, cartão, `seller_available`. **Sem código/migration/runtime nesta DECISION (docs-only).**
