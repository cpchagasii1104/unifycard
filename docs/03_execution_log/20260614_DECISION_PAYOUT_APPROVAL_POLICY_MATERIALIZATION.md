# 2026-06-14 — DECISION-PAYOUT-APPROVAL-POLICY-MATERIALIZATION (MODO: EXECUTOR / DOCS-ONLY CARTÓRIO)

Registra a decisão de Clayton sobre a **política material enterprise de aprovação de payout** como nova DECISION
soberana **DECISION-0130**, sem implementar código, sem migration, sem tocar runtime. Parent `538898b9` · branch
`rescue-structural` · dev **384/384** (inalterado).

## Numeração (confirmada antes de criar)

- Maior DECISION existente em `docs/02_decisions/`: **0129** (`DECISION_0129_PAYOUT_APPROVAL_AUTHORITY.md`).
- **0130 livre** — sem arquivo `*0130*` em `docs/02_decisions/`; sem entrada `0130` em `REMEDIATION_DECISIONS_LOG.md`.
- Numeração **contínua, sem colisão**.

## Decisão registrada (DECISION-0130 — D1–D12)

**Concretiza** a lacuna que mantém o approve endpoint em `PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED` (CAMINHO B da
F-PAYOUT-APPROVE-ENDPOINT-CORE-AUTHORITY). Não revoga a 0129 — fixa o que a 0129 D2/D6 deixou aberto.

- **D1** aprovador material = **operador financeiro institucional no Core Financeiro** (`financial_approval_operator`/
  `financial_approval_authority`). NÃO valem: dono automático; tenant admin comum; `company_users`;
  `tenant_operator_grants` comum; `organization_members`; role genérica; `financial:execute_payout`; `can_execute_*`;
  actionContext; x-actor-id; body|query actorId.
- **D2** substrato no **Core Financeiro** (não RBAC comum): `financial_approval_policies` / `financial_approval_authorities`
  / `financial_approval_policy_events` (ou equivalentes canônicos). Mín.: tenant_id; global_user_id/user_id server-side;
  scope=actor_wallet_payout; max_amount_cents; daily_limit_cents; requires_second_approval; is_active; created_at/
  revoked_at TIMESTAMPTZ; created_by/revoked_by; reason; trilha append-only.
- **D3** `requested_by_user_id != approved_by_user_id` (sem exceção).
- **D4** faixa MVP: **max_amount_cents = 50000** (R$ 500,00) e **daily_limit_cents = 150000** (R$ 1.500,00) — MVP
  controlado, não final (concretiza 0129 D6).
- **D5** acima da faixa → não aprovar/executar/enfileirar → `APPROVAL_POLICY_REQUIRES_MULTI_APPROVAL` (multi-approval = futuro).
- **D6** PF (KYC/ATL/destino próprio, teto baixo) e PJ (KYB/representante solicita/operador institucional aprova) com
  políticas distintas, mesmo teto MVP inicial.
- **D7** travas absolutas (ATL/KYC-KYB/recovery ativa/dispute/risco/destino não verificado/valor acima/auto-aprovação)
  reduzem elegibilidade a zero; precedência **ATL > KYC/KYB > Guarda/recovery > IA/Sistemas > Produto**.
- **D8** `availableBalanceCents` nunca autoriza (execução revalida no Bank, com locks/obligations/ledger).
- **D9** auditoria append-only por decisão (approval/payout ids, decision, approver/requester, policy_id, amount, reason,
  snapshots risk/kyc/recovery, idempotency); decisão terminal não apagável.
- **D10** HTTP approve registra/aprova e retorna `executed:false`; nunca Bank/worker/`executeActorWalletPayout`/ledger/
  completed; worker system-only default-off; executor via BankTransactionPort.
- **D11** grants comuns proibidos como autoridade final.
- **D12** frente futura **AUTORIZADA** `F-PAYOUT-APPROVAL-POLICY-MATERIALIZATION` (substrato + policy resolver
  `configured:true` na faixa + approve real + requester≠approver + bloqueio acima da faixa + auditoria).

## Cartório atualizado

- **`docs/02_decisions/DECISION_0130_PAYOUT_APPROVAL_POLICY_MATERIALIZATION.md`** (NOVO).
- **`REMEDIATION_DECISIONS_LOG.md`** (+entrada compacta DECISION-0130).
- **`STATUS_EXECUCAO_GLOBAL.md`** (+seção docs-only no topo).
- **`REMEDIATION_DT_LOG.md`** — `DT-PAYOUT-APPROVAL-POLICY-NOT-CONFIGURED`: **OPEN → DECIDIDO / IMPLEMENTATION_AUTHORIZED**
  (NÃO CLOSED runtime; approve segue fail-closed até a frente D12 executar).
- **`docs/03_execution_log/20260614_DECISION_PAYOUT_APPROVAL_POLICY_MATERIALIZATION.md`** (este arquivo).

## Hard stops (docs-only)

Zero código; zero migration; zero tabela; zero Bank; zero worker; zero executor; zero endpoint; zero approval real; zero
`can_execute_*`; `company_users`/`tenant_operator_grants` não viram autoridade. Nenhum `.ts/.mjs/.sql/.json/package`
alterado; `git diff --check` limpo; **dev migrations 384/384 inalterado**.

## Ressalvas

Implementação = futura (frente D12). **NÃO** declarado implementado: política material; approve real; multi-approval;
PIX/TED; dispute/reversal; cartão; `seller_available`.

## Estado

DECISION-0130 **PROMULGADA / NORMATIVA — HOLD PARA RESEAL**. Política material de aprovação de payout **definida**
(aprovador institucional Core, substrato Core, faixa MVP 50000/150000, requester≠approver, fail-closed acima da faixa,
auditoria append-only). Implementação AUTORIZADA na frente `F-PAYOUT-APPROVAL-POLICY-MATERIALIZATION`. Sem runtime nesta frente.
