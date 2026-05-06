# Regras do domínio Bank (UnifyBank)

Documento de **âmbito financeiro**: invariantes e fronteiras que **reforçam** `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §**4.6**–§**4.7** e `SSOT_REGISTRY_UNIFICARD.md` (secções 5.2–5.5). Em caso de conflito, prevalece a Lei e o SSOT_REGISTRY.

## 1. SSOT de runtime

* **Conta:** `bank_accounts`
* **Transação económica:** `bank_transactions`
* **Verdade contábil / saldo canónico:** `bank_ledger`
* **Split final ligado ao fluxo canónico:** `bank_splits` (quando aplicável ao desenho em vigor)

Nenhum outro módulo de aplicação **persiste** estado financeiro canónico duplicando estas tabelas.

## 2. Invariantes (resumo)

* Movimentos contábeis seguem **dupla entrada** e **rastreabilidade** à transação bancária quando a norma o exige.
* **Saldo** derivado de colunas auxiliares (ex. *cache*) **não** substitui o ledger como fonte de verdade para decisões canónicas.
* **Reversão** e operações semelhantes **não** contornam o Bank: locking, ordem de contas e escrita no ledger/transações **concentram-se** no domínio Bank.

## 3. Operações permitidas (fora do Bank)

Módulos externos **só** podem:

* invocar **serviços públicos** ou contratos expostos pelo Bank;
* receber **read models** ou IDs já resolvidos (ex. `bank_transaction_id` como referência), sem SQL directo às tabelas acima.

## 4. Concorrência

`SELECT … FOR UPDATE`, ordenação determinística de contas na mesma transação que grava movimento, e política anti-*deadlock* **pertencem** ao Bank (§**4.7** da Lei).

---

*Última sincronização conceitual: alinhado ao refactor de reversão com `getTransactionLockedForReversal` e serviços no módulo Bank.*

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md
- SSOT_REGISTRY_UNIFICARD.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
<!-- AUTO-GENERATED-END -->