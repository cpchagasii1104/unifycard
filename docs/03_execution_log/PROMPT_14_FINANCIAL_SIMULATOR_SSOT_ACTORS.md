# Execução — Prompt 14: Correção Financial Simulator (SSOT + Ontologia Actors)

**Data:** 2026-03-16  
**Modo:** EXECUTOR  
**Referência:** Prompt 14 (auditoria técnica Clayton) + docs/01_normative/00_AGENT_PROTOCOL.md

---

## Objetivo

Corrigir o simulador financeiro para:
1. Respeitar o SSOT financeiro (nenhum INSERT direto em bank_transactions / bank_ledger).
2. Usar ontologia canônica de actors: person, company, system.

---

## Ações realizadas

### 1) Remoção de SQL direto em ledger/transactions

- **Removido:** bloco que fazia `INSERT INTO bank_transactions` e `INSERT INTO bank_ledger` para seed de escrow.
- **Substituído por:** depósito via `bankTransactionService.transfer(systemReserve.accountId → buyerWallet.accountId)` com `referenceType: 'simulation_deposit'`.
- Nenhum outro ponto do controller escreve em `bank_transactions` ou `bank_ledger`; a única leitura é `SELECT ... FROM bank_ledger` para montar a resposta.

### 2) Ajuste da criação de actors

- **Antes:** actor_type `user`, `page`, `person` (e colunas user_id/company_id).
- **Depois:** Genesis 0002 — apenas `id`, `tenant_id`, `actor_type`, `display_name`, `created_at`, `updated_at`:
  - buyer: `actor_type = 'person'`
  - seller: `actor_type = 'company'`
  - terceiro actor (referência system): `actor_type = 'system'`
- Coluna usada nos INSERTs: `id` (PK do Genesis), não `actor_id`.

### 3) Seed inicial

- Financiamento do buyer: `bankTransactionService.transfer(systemReserve → buyerWallet)`, `referenceType: 'simulation_deposit'`.
- Conta de origem: `bankAccountService.getSystemAccount(tenantId, 'reserve', 'BRL')`.
- **Requisito operacional:** a conta system `reserve` do tenant deve estar previamente financiada (ex.: seed que use o serviço); caso contrário o transfer falha por saldo insuficiente.

### 4) Confirmação

- Não permanece no código nenhum `INSERT`/`UPDATE`/`DELETE` em `bank_transactions` ou `bank_ledger`.
- Movimentações financeiras apenas via `bankTransactionService.transfer`.

---

## Arquivos alterados

| Arquivo | Alteração |
|--------|-----------|
| `backend/src/modules/observability/financial-simulator.controller.ts` | Reescrito: sem SQL direto em ledger/transactions; actors person/company/system; deposit via transfer(reserve → buyerWallet). |

---

## Validação

- **Chaos Suite:** `pnpm run test:financial-chaos`  
  - **Resultado:** 6 test suites passed, 21 tests passed.  
  - **Status:** SUCESSO.

---

## Status

**SUCESSO** — Simulador alinhado ao SSOT financeiro e à ontologia de actors do Genesis.
