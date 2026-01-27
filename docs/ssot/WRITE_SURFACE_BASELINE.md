# WRITE SURFACE BASELINE — SSOT UnifiCard

Este documento registra **todas as superfícies de escrita identificadas**
no sistema em relação a estruturas críticas (financeiras e de estado).

Ele é usado para:
- estabelecer o **baseline inicial** (Gate 0)
- provar **remoção de escritas proibidas** (Gate 3 em diante)
- impedir **regressão silenciosa de SSOT**

Regra de ouro:
> Se uma escrita não está registrada aqui, ela **não é permitida**.

---

## COMO ESTE DOCUMENTO FUNCIONA

Cada tabela crítica possui sua própria seção.

Para cada ponto de escrita, registramos:
- arquivo
- operação (INSERT / UPDATE / DELETE)
- origem (rota, job, serviço, teste)
- classificação SSOT

Classificação possível:
- **PERMITIDA (SSOT)** → autoridade única declarada no SSOT_REGISTRY
- **PROIBIDA** → concorrente direto de SSOT
- **AMBÍGUA** → tratada como PROIBIDA até prova em contrário

---

## BASELINE — ESTADO INICIAL (GATE 0)

> Fonte: grep com regex sobre o backend  
> Evidência bruta: `docs/ssot/baseline/write_surface_grep.txt`

Este baseline representa o **estado do sistema antes de qualquer correção**.

Nenhuma escrita listada abaixo é considerada válida após os Gates,
a menos que explicitamente reclassificada como **PERMITIDA (SSOT)**.

---

## TABELA: accounts (LEGACY)

| Arquivo | Operação | Origem | Classificação |
|-------|----------|--------|---------------|
| src/core/db.ts | UPDATE accounts.balance | exemplo / doc | PROIBIDA |
| src/core/economy/accounts/account.service.ts | INSERT INTO accounts | service | PROIBIDA |
| src/modules/marketplace/accounts-payable.repository.ts | INSERT/UPDATE accounts_payable | marketplace | PROIBIDA |
| src/modules/marketplace/accounts-receivable.repository.ts | INSERT/UPDATE accounts_receivable | marketplace | PROIBIDA |

---

## TABELA: transactions (LEGACY)

| Arquivo | Operação | Origem | Classificação |
|-------|----------|--------|---------------|
| src/core/economy/transactions/transaction.service.ts | INSERT INTO transactions | service | PROIBIDA |

---

## TABELA: ledger (LEGACY)

| Arquivo | Operação | Origem | Classificação |
|-------|----------|--------|---------------|
| src/core/economy/transactions/transaction.service.ts | INSERT INTO ledger | service | PROIBIDA |
| src/core/economy/referral-split.service.ts | INSERT INTO ledger | referral | PROIBIDA |
| src/modules/ledger/ledger.repository.ts | INSERT INTO ledger | repository | PROIBIDA |

---

## TABELA: payment_transactions

| Arquivo | Operação | Origem | Classificação |
|-------|----------|--------|---------------|
| src/modules/marketplace/payment-transaction.repository.ts | INSERT/UPDATE payment_transactions | marketplace | PROIBIDA |

---

## TABELA: payout_transactions

| Arquivo | Operação | Origem | Classificação |
|-------|----------|--------|---------------|
| src/modules/marketplace/payout-transaction.repository.ts | INSERT/UPDATE payout_transactions | marketplace | PROIBIDA |

---

## TABELA: escrow_transactions

| Arquivo | Operação | Origem | Classificação |
|-------|----------|--------|---------------|
| src/modules/escrow/escrow.repository.ts | INSERT INTO escrow_transactions | escrow | PROIBIDA |

---

## TABELA: payment_splits

| Arquivo | Operação | Origem | Classificação |
|-------|----------|--------|---------------|
| src/modules/marketplace/payment-split.repository.ts | INSERT / DELETE payment_splits | marketplace | PROIBIDA |
| src/modules/services/service-payment-execution.repository.ts | INSERT INTO payment_splits | services | PROIBIDA |

---

## TABELA: unifycard_transactions

| Arquivo | Operação | Origem | Classificação |
|-------|----------|--------|---------------|
| src/modules/marketplace/unifycard.repository.ts | INSERT/UPDATE unifycard_transactions | marketplace | PROIBIDA (não-SSOT) |

> Nota: UnifyCard é **operacional/adquirente**.  
> Escritas aqui **não podem decidir saldo nem estado financeiro final**.

---

## TABELA: region_accounts

| Arquivo | Operação | Origem | Classificação |
|-------|----------|--------|---------------|
| src/modules/marketplace/region-account.repository.ts | INSERT/UPDATE region_accounts | marketplace | PROIBIDA |

---

## TABELA: settlements

| Arquivo | Operação | Origem | Classificação |
|-------|----------|--------|---------------|
| src/modules/marketplace/settlement.repository.ts | INSERT/UPDATE settlements | marketplace | PROIBIDA |

---

## TABELA: service_payment_*

| Arquivo | Operação | Origem | Classificação |
|-------|----------|--------|---------------|
| src/modules/services/service-payment-request.repository.ts | INSERT/UPDATE service_payment_requests | services | PROIBIDA |
| src/modules/services/service-payment-execution.repository.ts | INSERT INTO service_payment_executions | services | PROIBIDA |

---

## OBSERVAÇÕES IMPORTANTES

1. Este documento **não justifica** escritas — apenas registra evidência.
2. Escrita **AMBÍGUA** é tratada como **PROIBIDA** por padrão.
3. Escritas **PERMITIDAS (SSOT)** só podem existir após:
   - SSOT_REGISTRY definido
   - Gate correspondente aprovado
4. A cada Gate:
   - este documento deve ser **atualizado**
   - alterações devem ser **rastreáveis por evidência**
   - nunca reescrito silenciosamente

---

## STATUS

- **Gate 0:** BASELINE REGISTRADO
- **Gate 3:** PENDENTE — remoção de escritas proibidas
- **Gate 4+:** A VALIDAR

---

## EVIDÊNCIA — write_surface_grep.txt (Gate 0)

O arquivo `baseline/write_surface_grep.txt` foi gerado via `findstr` com regex
para INSERT / UPDATE / DELETE em SQL inline.

Resultado:
- Arquivo gerado com sucesso
- **Nenhuma ocorrência encontrada**

Interpretação:
- O backend **não contém SQL inline**
  OU
- As escritas ocorrem via ORM / abstração (repositories, query builders, etc.)

Este resultado **não invalida o Gate 0**, mas indica que:
- A identificação de superfícies de escrita deve ocorrer
  via análise de repositórios, serviços e adapters,
  conforme já documentado na Matriz de Impacto.


FIM DO WRITE SURFACE BASELINE
