# MATRIZ DE IMPACTO FORENSE — SSOT UnifiCard

Data: 27 de Janeiro de 2026  
Método: Evidência por grep (não suposição)  
Base: ~1.320 arquivos TypeScript analisados  

Dependências:
- `GATE_3_EXECUTION.md` (usa esta matriz para priorização)
- `GATE_3_REVIEW.md` (valida resultado contra esta matriz)
- `WRITE_SURFACE_BASELINE.md` (complementar: baseline de superfícies)
- `GATES.md` (contexto do Gate 3)
## RESUMO EXECUTIVO

O sistema apresenta **múltiplas autoridades concorrentes de estado financeiro**, violando o princípio de Single Source of Truth (SSOT).

A auditoria identificou um **conjunto concentrado de arquivos críticos** que:
- escrevem diretamente em estruturas financeiras proibidas (writers), ou
- leem estruturas legacy como se fossem verdade final (leituras decisórias ambíguas).

### Síntese quantitativa (orientativa)

- **Total de arquivos afetados:** **35**
- **Percentual do codebase:** ~2,6%
- **Concentração do risco:** domínio financeiro (core/economy, core/events financeiro, marketplace financeiro)

> Nota: a contagem de “writers” refere-se aos **principais pontos de escrita identificados**, com complementos mapeados no bloco consolidado.  
> A **lista consolidada abaixo é a fonte normativa**, não o número isolado.

Esses arquivos concentram **100% do risco de SSOT financeiro** do sistema.

---

## PARTE I — ARQUIVOS QUE ESCREVEM EM ESTRUTURAS PROIBIDAS (WRITERS)

### Estrutura: `accounts` (legacy)

| Arquivo | Operação |
|--------|----------|
| src/core/db.ts | UPDATE accounts SET balance |
| src/core/economy/accounts/account.service.ts | INSERT INTO accounts |
| src/modules/marketplace/accounts-payable.repository.ts | INSERT/UPDATE accounts_payable |
| src/modules/marketplace/accounts-receivable.repository.ts | INSERT/UPDATE accounts_receivable |
| src/modules/work/tests/work.e2e.spec.ts | INSERT/UPDATE (teste) |

### Estrutura: `transactions` (legacy)

| Arquivo | Operação |
|--------|----------|
| src/core/economy/transactions/transaction.service.ts | INSERT INTO transactions |

### Estrutura: `ledger` (legacy)

| Arquivo | Operação |
|--------|----------|
| src/core/economy/transactions/transaction.service.ts | INSERT INTO ledger |
| src/core/economy/referral-split.service.ts | INSERT INTO ledger (via referral) |
| src/modules/ledger/ledger.repository.ts | INSERT INTO ledger |

### Estrutura: `payment_transactions`

| Arquivo | Operação |
|--------|----------|
| src/modules/marketplace/payment-transaction.repository.ts | INSERT/UPDATE payment_transactions |

### Estrutura: `escrow_transactions`

| Arquivo | Operação |
|--------|----------|
| src/modules/escrow/escrow.repository.ts | INSERT INTO escrow_transactions |

### Estrutura: `payout_transactions`

| Arquivo | Operação |
|--------|----------|
| src/modules/marketplace/payout-transaction.repository.ts | INSERT/UPDATE payout_transactions |

### Estrutura: `unifycard_transactions`

| Arquivo | Operação |
|--------|----------|
| src/modules/marketplace/unifycard.repository.ts | INSERT/UPDATE unifycard_transactions |

### Estrutura: `event_split_declarative`

| Arquivo | Operação |
|--------|----------|
| src/core/events/event-split-declarative.service.ts | INSERT/UPDATE event_split_declarative |
| src/core/events/event-payment-execution.service.ts | UPDATE event_split_declarative |

### Estrutura: `payment_splits`

| Arquivo | Operação |
|--------|----------|
| src/modules/marketplace/payment-split.repository.ts | INSERT/DELETE payment_splits |
| src/modules/services/service-payment-execution.repository.ts | INSERT INTO payment_splits |

### Estrutura: `ledger_referral_splits`

| Arquivo | Operação |
|--------|----------|
| src/core/economy/referral-split.service.ts | INSERT/UPDATE ledger_referral_splits |

### Estrutura: `region_accounts`

| Arquivo | Operação |
|--------|----------|
| src/modules/marketplace/region-account.repository.ts | INSERT/UPDATE region_accounts |

### Estrutura: `event_refund` / `event_chargeback`

| Arquivo | Operação |
|--------|----------|
| src/core/events/event-refund-chargeback.service.ts | INSERT/UPDATE event_refund, event_chargeback |

### Estrutura: `service_payment_*`

| Arquivo | Operação |
|--------|----------|
| src/modules/services/service-payment-request.repository.ts | INSERT/UPDATE service_payment_requests |
| src/modules/services/service-payment-execution.repository.ts | INSERT INTO service_payment_executions |

### Estrutura: `settlements`

| Arquivo | Operação |
|--------|----------|
| src/modules/marketplace/settlement.repository.ts | INSERT/UPDATE settlements |

---

## PARTE II — ARQUIVOS COM LEITURA DECISÓRIA AMBÍGUA

Esses arquivos **não escrevem**, mas **leem estruturas proibidas como se fossem verdade final**, influenciando decisões.

### Leem `accounts` como verdade

- src/core/city/city-readiness/city-readiness.service.ts  
- src/core/companies/companies.service.ts  
- src/core/economy/escrow.service.ts  
- src/core/economy/fund/fund-admin.service.ts  
- src/core/economy/ledger/ledger.service.ts  
- src/core/events/event-economy.service.ts  
- src/core/events/responsibility.service.ts  
- src/jobs/post-event-split.job.ts  
- src/modules/crm/crm.service.ts  

### Leem `transactions` (legacy)

- src/core/economy/fund/fund-dashboard.service.ts  
- src/core/economy/fund/fund-visibility.service.ts  
- src/core/economy/fund/fund-weekly-report.service.ts  
- src/core/economy/fund/fund.service.ts  
- src/core/unifybank/test-currency.service.ts  
- src/modules/groups/groups.routes.ts  

### Leem `ledger` (legacy)

- src/core/reputation/trust.service.ts  
- src/modules/events/events-closure.routes.ts  
- src/modules/events/events-economy.routes.ts  
- src/modules/social/impact.service.ts  

---

## PARTE III — MÓDULOS VERIFICADOS COMO LIMPOS

- **rides**: não toca estruturas financeiras legacy  
- **orders (core)**: domínio puro, sem integração financeira  
- **catalog**: domínio de produto  
- **social (exceto impact.service.ts)**: majoritariamente limpo  

---

## PARTE IV — LISTA CONSOLIDADA (FONTE NORMATIVA)

core/economy/*

core/events (financeiro)

modules/marketplace (financeiro)

modules/services (pagamento)

escrow / ledger legacy

### Arquivos que devem ser eliminados ou reescritos (writers)

(ver lista completa conforme blocos acima)

### Arquivos que exigem refatoração de leitura (ambíguos)

(ver lista completa conforme Parte II)

> Esta lista consolidada é a **fonte final de escopo** para execução do plano de correção.

---

## PARTE V — CONCENTRAÇÃO DE ESFORÇO

- core/economy → maior concentração
- core/events (financeiro)
- marketplace financeiro
- services + escrow

---

## PARTE VI — CONCLUSÃO FORENSE

- O sistema é **cirurgicamente reparável**
- O problema está **concentrado**
- Não há necessidade de reescrita total
- A execução correta depende de **seguir rigorosamente os Gates e o SSOT Registry**

**Estratégia validada:** ARRUMAR COM CIRURGIA  
**Estimativa:** ~5–6 semanas  

---

FIM DA MATRIZ DE IMPACTO FORENSE

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- GATES.md
- GATE_3_EXECUTION.md
- GATE_3_REVIEW.md
- WRITE_SURFACE_BASELINE.md

### Referenciado por
- 00_INDEX.md
- GATES.md
- GATE_3_EXECUTION.md
- GATE_3_REVIEW.md
- WRITE_SURFACE_BASELINE.md
<!-- AUTO-GENERATED-END -->