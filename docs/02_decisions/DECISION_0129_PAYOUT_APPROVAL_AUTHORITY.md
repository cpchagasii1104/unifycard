# DECISION-0129 — Autoridade de aprovação de payout (quem solicita, quem aprova, segregação de função)

**Status:** **PROMULGADA / NORMATIVA.** Runtime do **approve endpoint NÃO implementado** — sua implementação
fica **autorizada** por esta DECISION (D14), em frente executora própria. Esta DECISION fecha a **autoridade de
aprovação de payout** (a lacuna que tornava o approve endpoint "autoridade por ausência").

**Data:** 2026-06-14 · **Branch:** `rescue-structural` · **Tipo:** arquitetural / produto / autoridade financeira
· **Frente:** DECISION-PAYOUT-APPROVAL-AUTHORITY (cartório)

**Precedência:** `AUTHORITY_LAW` / `AUTHORITY_PRECEDENCE` (vence a trava mais restritiva; responsabilidade no CPF) ·
`SSOT_EXCLUSIVE_BANK_RULE` (Bank = única SSOT financeira) · **DECISION-0128** (Core de Aprovação Financeira;
grants comuns não executam dinheiro; cartão usa o Core) · **DECISION-0113** (actorId/tenant client-declared = HINT) ·
**DECISION-0125** (`company_users.can_*` company-scoped) · **DECISION-0126** (`tenant_operator_grants.can_*` tenant-scoped) ·
**DECISION-0058** (actor_wallet payout, trilho canônico) · **DECISION-0053** (recovery pós-D-money).

---

## 1. Contexto

A cadeia de payout já está selada: **request-only endpoint** (`POST /api/payouts/requests`, F-PAYOUT-REQUEST-ONLY-
ENTRYPOINT), **executor selado** (`executeActorWalletPayout`, Core-aprovado), **worker canônico system-only default-off**
(F-PAYOUT-WORKER-SYSTEM-ONLY-SEAL), Bank como **único trilho de ledger**, DECISION-0113 baseline=0. O READ-FIRST
`F-PAYOUT-PRODUCTION-ENTRYPOINT-AUTHORITY` confirmou materialmente que **não existe autoridade para APROVAR payout**:
sem `financial:approve_payout`, role-chain `organization_members` **ausente**, `company_users`/`tenant_operator_grants`
insuficientes, sem 4-olhos. Implementar approve sem decisão = **autoridade por ausência** (qualquer autenticado
aprovaria, inclusive a si mesmo). Esta DECISION resolve isso.

## 2. Decisão (D1–D14)

### D1 — Solicitação de payout
Representante autorizado do actor/wallet pode **solicitar**. Prova material: `req.user.id` server-side · `req.tenant.id`
server-side · `actorId` apenas alvo/HINT · `canRepresentActor(tenantId, req.user.id, actorId)` (fail-closed).
Efeito: cria `actor_wallet_payout_requests.pending_approval` + `approval_requests.pending`; retorna `executed:false`;
**não move dinheiro**. *(Já IMPLEMENTADO — F-PAYOUT-REQUEST-ONLY-ENTRYPOINT.)*

### D2 — Aprovação de payout
Aprovação pertence ao **Core Financeiro institucional**, resolvida por **política financeira explícita**.
**NÃO são autoridade suficiente:** `company_users.can_*`; `tenant_operator_grants` comum; `canRepresentActor` sozinho;
role genérica; `organization_members` legado; `actionContext.actorId`; `x-actor-id`; `body/query actorId`.
O Core valida elegibilidade, **registra a decisão** e **preserva trilha de autoridade** (auditoria).

### D3 — Autoaprovação (segregação de função)
No MVP seguro, o solicitante **NÃO** pode aprovar o próprio payout. **Regra vinculante:**
`requested_by_user_id != approved_by_user_id` (4-olhos mínimo).

### D4 — MVP de aprovação
MVP = **1 aprovação institucional** para **faixa segura**. Acima da faixa segura: **não executar** — bloquear/retornar
como política que exige revisão reforçada ou multi-approval futura.

### D5 — Multi-approval
Multi-approval/quórum é **frente futura**. **Não fingir suporte** enquanto o modelo for single-approval (o bridge
`approveActorWalletPayout` é single-shot por construção; `approval_type` parallel/sequential é só rótulo hoje).

### D6 — Faixas de valor
**Clayton define os valores.** Código **NÃO hardcoda teto** sem DECISION específica. Todos os valores: `amount_cents` **BIGINT**.

### D7 — PF e PJ
Ambos podem **solicitar**, com políticas diferentes.
- **PF:** KYC pessoal compatível; destino próprio/autorizado; ATL limpo.
- **PJ:** representante autorizado; empresa/KYB apta; destino autorizado; **aprovação financeira obrigatória**.

### D8 — Travas sempre restritivas
Em conflito, **vence a trava mais restritiva**. Ordem: **ATL → KYC → Guarda/recovery → IA/Sistemas → Produto.**
Bloqueiam ou exigem revisão reforçada: ATL restritivo; KYC restritivo; **recovery obligation ativa**; dispute/reversal
pendente; risco alto; limite excedido; destino não autorizado.

### D9 — `availableBalanceCents`
**Nunca autoriza payout.** É leitura/projeção. Payout **revalida dentro da transação** usando Bank/ledger, locks e
recovery obligations. *(Já enforçado pelos selos: filtro de criação não-bypassável; F3 recomputa sob FOR UPDATE.)*

### D10 — Execução
Execução é **trilho financeiro interno/system**: usuário **solicita** → Core Financeiro **aprova/registra decisão** →
**worker system-only** processa `approved` → **executor** move via **BankTransactionPort** → Bank registra em
`bank_transactions`/`bank_ledger` → **evento/auditoria nasce depois**. **HTTP nunca executa.**

### D11 — Trilho canônico
Payout usa `actor_wallet_payout_requests` + `actor_wallet`. **Não** usar `seller_available`/`seller_payout` como trilho
novo. **Não** usar `payout_requests` legado.

### D12 — Grants proibidos
**Não criar:** `company_users.can_execute_payout`; `tenant_operator_grants.can_execute_payout`; role genérica
`financial:execute_payout` como poder econômico final. Qualquer permissão financeira de aprovação **pertence ao Core
Financeiro** e respeita: `req.user` server-side; política financeira; KYC; ATL; Guarda; recovery; risco; **segregação
de função**; auditoria.

### D13 — Fora desta decisão
**Não** reabrir dispute/reversal · **não** reabrir card authorization · **não** implementar PIX/TED externo · **não**
implementar multi-approval nesta decisão · **não** transformar HTTP em executor.

### D14 — Próxima implementação autorizada
Implementar o **approve endpoint** **somente após esta DECISION registrada** (agora satisfeito). O approve endpoint
futuro **deve:** registrar aprovação **via Core**; exigir **autoridade server-side**; impedir **requester == approver**
(D3); **não** mover dinheiro; **não** chamar Bank; **não** chamar worker; **não** executar payout; retornar `executed:false`.

## 3. Consequências

- **request-only permanece fechado** (D1, já implementado).
- **approve deixa de ser autoridade indefinida** — agora há política explícita (D2) + 4-olhos (D3) + faixa/MVP (D4).
- **execução/worker permanecem selados** (D10/D11); **Bank continua SSOT financeiro**.
- O **aprovador material** (D2) — quem é o "Core Financeiro institucional" em termos de coluna/permissão/política — é
  o objeto da **frente executora futura** (F-PAYOUT-APPROVE-ENDPOINT): materializar a permissão de aprovação NO Core
  Financeiro (não em `company_users`/`tenant_operator_grants`), com segregação de função, faixa segura e auditoria.

## 4. Modelo (resumo normativo)

```
SOLICITA   usuário/empresa (canRepresentActor; req.user server-side)        → pending_approval (executed:false)
APROVA     Core Financeiro institucional (política explícita; requester≠approver; faixa segura; ATL/KYC/Guarda/recovery/risco)
EXECUTA    worker system-only default-off → executor → BankTransactionPort  (HTTP nunca executa)
REGISTRA   Bank (bank_transactions/bank_ledger = SSOT)
AUDITA     evento/trilha de autoridade nasce DEPOIS do financeiro
```

## 5. Estado

DECISION-0129 **PROMULGADA / NORMATIVA**. Autoridade de aprovação de payout **definida**. Approve endpoint
**AUTORIZADO a implementar** (frente própria) sob: Core Financeiro · server-side · requester≠approver · faixa segura
(MVP 1 aprovação) · sem mover dinheiro/Bank/worker · `executed:false`. Multi-approval/quórum, faixas de valor concretas,
PIX/TED, dispute/reversal, cartão = fora. Sem código/migration nesta DECISION (docs-only).
