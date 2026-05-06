# Mapa arquitetural UnifiCard

Visão de sistema que conecta **banco**, **marketplace**, **governança**, **rede social** e **economia** em camadas reutilizáveis, sem duplicação de regras.

---

## 1. Princípio central

- **Core** contém regras e invariantes (bank, actors, identity, observability).
- **Módulos** (marketplace, governance, social) **usam** o core; não duplicam lógica financeira nem de identidade.
- **Interfaces** (API, jobs, webhooks) expõem e disparam fluxos; não implementam regras de negócio.

---

## 2. Camadas

```
┌─────────────────────────────────────────────────────────────────────────┐
│  INTERFACES                                                              │
│  api • jobs • webhooks • eventos externos                               │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  MÓDULOS                                                                 │
│  marketplace • governance • social • (futuros)                           │
│  Orquestram fluxos e chamam o core.                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  CORE                                                                   │
│  bank • actors • identity • observability                                │
│  Regras canônicas, ledger, idempotência, reconciliação.                 │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PERSISTÊNCIA (Genesis)                                                 │
│  bank_accounts • bank_transactions • bank_ledger • actors • tenants …   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Núcleos do Core

### 3.1 Bank (motor financeiro)

- **Ledger:** append-only; UPDATE/DELETE bloqueados (trigger 0027).
- **Transações:** idempotência por `(tenant_id, reference_type, reference_id)`; retry em concorrência.
- **Proteções:** INSUFFICIENT_FUNDS, AMOUNT_OVERFLOW, limite de cobertura (ex.: 80%).
- **Reconciliação:** discrepâncias gateway/ledger/banco; ajustes via transações reais.

**Usado por:** marketplace (pagamento, settlement, payout), governança (alocações), doações, P2P.

### 3.2 Actors

- **Entidade unificada:** person, company, system (e variantes por migration).
- **Consistência:** FK e constraints (ex.: actor_consistency); uma conta system por tenant.
- **Identificação:** tenant_id + actor_id como base para permissões e contas.

**Usado por:** bank (owner/actor das contas), marketplace (buyer/seller), identity, governance.

### 3.3 Identity

- **Autenticação e contexto:** usuário, sessão, tenant.
- **Autoridade canônica:** quem pode executar operações; integração com actors e bank (authorship).

**Usado por:** todos os módulos que precisam de “quem está fazendo” e “em nome de quem”.

### 3.4 Observability

- **Logs estruturados:** financial_event, transaction_id, reference_type, account_id, amount_cents, actor_id, tenant_id.
- **Métricas sugeridas:** ledger_drift, duplicate_reference_attempt, settlement_latency, payout_queue, coverage_usage.
- **Dashboard de integridade:** saúde do ledger, uso de cobertura, status de reconciliação.

**Usado por:** operação, alertas, auditoria; não implementa regras de negócio.

---

## 4. Módulos

### 4.1 Marketplace

- **Fluxo de pagamento:** user → escrow → clearing → seller_pending → seller_available → seller_payout → bank_settlement.
- **Serviços:** executePayment, settlePaymentToSeller, releaseSellerFunds, requestSellerPayout, confirmBankPayout.
- **Regras:** não define ledger nem saldo; usa **bank** para transferências e **actors** para buyer/seller.

### 4.2 Governance

- **Alocações, votação, fundos regionais:** decisões e alocações que resultam em movimentação de valor.
- **Regras:** políticas e permissões; execução financeira delegada ao **bank** e **actors**.

### 4.3 Social (rede social / coordenação)

- **Rede de relações, grupos, conteúdo:** coordenação e identidade social.
- **Economia e materialização:** quando uma ação social gera valor ou pagamento, chama **marketplace** e **bank**, sem duplicar lógica financeira.

---

## 5. Fluxos entre domínios

```text
                    ┌─────────────┐
                    │   Identity  │
                    │  (quem)    │
                    └──────┬──────┘
                           │
     ┌─────────────┐       │       ┌─────────────┐
     │  Marketplace│◄──────┼──────►│   Bank     │
     │  (pagamento)│       │       │  (ledger)  │
     └──────┬──────┘       │       └──────┬─────┘
            │              │              │
            │              │              │
            ▼              ▼              ▼
     ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
     │  Governance │ │   Actors    │ │Observability│
     │  (alocação) │ │  (quem é)   │ │ (logs/metrics)│
     └─────────────┘ └─────────────┘ └─────────────┘
```

- **Identity** alimenta “quem” em toda operação.
- **Marketplace** e **Governance** orquestram; **Bank** executa movimentação e garante invariantes.
- **Actors** são a base de contas e papéis (buyer, seller, system).
- **Observability** apenas registra e mede.

---

## 6. Economia e “materialização”

- **Economia:** resultado da circulação de valor no **bank** (ledger, contas, transações) e das regras de **marketplace** e **governance**.
- **Materialização:** quando uma decisão (governance) ou uma interação (social/marketplace) vira valor, o fluxo termina em chamadas ao **bank** (e eventualmente em **bank_settlement** / reconhecimento externo).
- Nenhum módulo mantém “saldo” próprio; saldo é sempre derivado do ledger no core.

---

## 7. Contratos entre camadas

| De          | Para        | Contrato resumido |
|------------|-------------|--------------------|
| Marketplace| Bank        | transfer, idempotência por reference; contas via actors. |
| Marketplace| Actors      | buyer/seller/company; criação de contas lifecycle. |
| Governance | Bank        | transferências/alocações com authorship e reference. |
| Governance | Actors      | quem recebe/aloca. |
| Social     | Marketplace | disparo de pagamentos/benefícios quando ação social gera valor. |
| Social     | Identity    | quem está agindo. |
| API/Jobs   | Módulos     | chamadas de serviço; não implementam regras de negócio. |

---

## 8. Onde não duplicar

- **Saldo / ledger:** só no **bank** (ledger + cálculo de saldo).
- **Idempotência por referência:** só no **bank** (transfer/create com reference_type + reference_id).
- **Definição de “quem é” (actor):** só em **actors** (e identity para usuário → actor).
- **Reconciliação e ajustes:** só no **bank** + engine de reconciliação no core.

---

## 9. Próximos passos sugeridos

1. **Observability financeira:** logs estruturados e métricas (ledger_drift, duplicate_attempt, settlement_latency, coverage).
2. **Dashboard de integridade:** ledger health, uso de cobertura, reconciliação.
3. **Testes adicionais:** double spend, replay attack, fragmentação, ledger drift (invariantes).
4. **CI:** banco do zero (reset + migrate) ou migrate em DB limpo; remover `continue-on-error` em migrate para não esconder falhas.

Este mapa deve ser atualizado quando novos núcleos (core) ou módulos forem introduzidos.
