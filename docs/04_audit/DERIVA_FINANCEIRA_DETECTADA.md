# DERIVA FINANCEIRA DETECTADA

## Status
ABORT HARD — Violação de SSOT financeiro

---

## Estruturas Violadoras

### payment_splits
- Tipo: Split financeiro paralelo
- Violação: Lei operacional — splits fora de bank_splits
- Localização:
  - economic-overview.projector.ts
  - service-payment-execution.repository.ts
  - groups-closure.routes.ts

### social_ledger
- Tipo: Ledger paralelo
- Violação: Estrutura proibida (plano v7)
- Localização:
  - social-ledger.service.ts
  - social-2.0.service.ts

---

## Fluxos Afetados

### Serviços (payment execution)
- Distribuição de pagamentos
- Multi-beneficiário

### Social / Feed
- Impacto financeiro por post
- Profit share
- Ledger de usuário

---

## Natureza da Violação

- Existência de múltiplas fontes de verdade financeira
- Quebra de determinismo
- Risco de divergência de saldo
- Violação de precedência causal

---

## Mapeamento para SSOT

### payment_splits → bank_splits
- execution_id → transaction_id
- amount → amount_cents
- receiver → target_actor_id

### social_ledger → bank_ledger
- amount_cents → amount_cents
- type → purpose
- actor_id → actor_id

---

## Impacto

- Reconciliation comprometida
- Reversal inconsistente
- Auditoria impossível
- Sistema não determinístico

---

## Próximo Passo

- Criar plano de migração para:
  - eliminar estruturas paralelas
  - centralizar em bank_*

---

## Status Final

EXECUÇÃO ABORTADA — correção estrutural obrigatória antes de qualquer avanço
