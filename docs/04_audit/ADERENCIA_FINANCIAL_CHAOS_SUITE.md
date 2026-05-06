# Validação de aderência — Financial Chaos Test Suite

**Data:** 2025-03-14  
**Referência:** docs/03_execution_log/EXECUTION_FINANCIAL_CHAOS_TEST_SUITE.md  
**Normativa:** docs/01_normative/ (00_AGENT_PROTOCOL, SSOT_EXCLUSIVE_BANK_RULE, SSOT_CONTRACT, PROHIBITED_STRUCTURES, 07_NOMENCLATURA_CANONICA)

---

## 1. SSOT Bank Rules (SSOT_EXCLUSIVE_BANK_RULE.md)

**Pergunta:** O código da suite mantém UnifyBank como única fonte de verdade? Usa apenas estruturas permitidas?

**Verificação:**

- **Leitura/escrita financeira:** Os testes usam exclusivamente:
  - `bankTransactionService` (transfer, idempotência por reference_type/reference_id)
  - `bankLedgerRepository` (getEntriesByTransaction, calculateBalance implícito via service)
  - `bankAccountService` (getPlatformLifecycleAccount, getOrCreateAccount, ensureLifecycleAccountsForOwner, getAccountById)
  - `paymentExecutionService` (settlePaymentToSeller, releaseSellerFunds, requestSellerPayout, confirmBankPayout)
  - `reconciliationService` (recordDiscrepancy, getOpenDiscrepancies, markResolved)
- **Tabelas tocadas:** Apenas as permitidas: `bank_accounts`, `bank_transactions`, `bank_ledger`, `bank_splits`, `reconciliation_discrepancies` (e `tenants` para dados de teste).
- **Saldo:** Não há cálculo de saldo fora do UnifyBank; uso de `cachedBalance` apenas para assertivas, não como decisão de valor.
- **Settlement:** Nenhum uso de `settledAt = NOW()` sem confirmação; testes de settlement usam os serviços canônicos.

**Resultado:** **ADERENTE.**

---

## 2. Nomenclatura canônica (07_NOMENCLATURA_CANONICA.md)

**Pergunta:** Backend/API em camelCase? Identificadores com sufixo `Id`? Banco em snake_case quando aplicável?

**Verificação:**

- **Arquivos em TypeScript (backend/tests/):** Uso de camelCase (tenantId, accountId1, referenceType, referenceId, transactionId, amountCents, etc.). Identificadores com `Id` onde aplicável.
- **Queries SQL nos testes:** Uso de snake_case para colunas (`tenant_id`, `reference_type`, `reference_id`, `entry_id`, `account_id`) conforme banco.
- **Contratos/APIs:** Os specs não expõem API pública; consomem serviços internos já sob convenção do projeto.

**Resultado:** **ADERENTE.**

---

## 3. Estruturas proibidas (PROHIBITED_STRUCTURES.md)

**Pergunta:** Há uso de tabelas ou padrões proibidos como fonte de verdade ou decisão?

**Verificação:**

- **Tabelas proibidas como autoridade:** Nenhum uso de `accounts`, `ledger` (legacy), `transactions` (legacy), `region_accounts`, `wallets`, `payment_transactions`, `payment_splits`, `escrow_transactions`, `payout_transactions` como SSOT.
- **Decisão financeira:** Toda decisão de valor/estado passa por serviços do UnifyBank ou por reconciliation (reconciliation_discrepancies como registro de divergência, não como saldo).
- **Padrões proibidos:** Nenhum UPDATE em ledger (teste 12 verifica que UPDATE é rejeitado); nenhum cálculo de saldo fora do bank; nenhuma decisão baseada em `cached_balance` como verdade primária.

**Resultado:** **ADERENTE.**

---

## 4. Resumo

| Critério              | Status    |
|-----------------------|-----------|
| SSOT Bank Rules       | ADERENTE |
| Nomenclatura canônica | ADERENTE |
| Estruturas proibidas  | ADERENTE |

**Conclusão:** A Financial Chaos Test Suite, no estado atual do código, está aderente à normativa verificada. O trabalho permanece válido do ponto de vista institucional após regularização (bootstrap + registro de execução).

---

FIM DA VALIDAÇÃO
