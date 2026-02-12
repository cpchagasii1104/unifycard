# ═══════════════════════════════════════════════════════════════════════════
# SEÇÃO V — SSOT REGISTRY COMPLETO
# ═══════════════════════════════════════════════════════════════════════════

## 5.1 Identity / Actor

```yaml
Domínio: identity
Conceito: ator econômico (quem paga/recebe)
Autoridade: actors
Chave: actor_id
Escritor: módulo de identidade
Leitores: bank, payments, splits, events, marketplace, services
Proibidos: global_user_id como chave final em dinheiro
Tipo: Primário
```

## 5.2 Bank Core — Conta

```yaml
Domínio: bank
Conceito: conta econômica
Autoridade: bank_accounts
Chave: account_id
Escritor: bank-account service
Proibidos: accounts (legacy), region_accounts, group_accounts como primária
Tipo: Primário
```

## 5.3 Bank Core — Transação

```yaml
Domínio: bank
Conceito: transação econômica
Autoridade: bank_transactions
Chave: bank_transaction_id
Escritor: bank-transaction service
Proibidos: transactions, payment_transactions, payout_transactions, escrow_transactions, group_transactions
Tipo: Primário
Estado Final: bank_transactions
```

## 5.4 Bank Core — Ledger

```yaml
Domínio: bank
Conceito: verdade contábil e saldo
Autoridade: bank_ledger
Chave: ledger_entry_id
Escritor: bank-ledger service
Proibidos: ledger, ledger_entries, qualquer coluna balance como primária
Tipo: Primário
Estado Final: bank_ledger
```

## 5.5 Bank Core — Split

```yaml
Domínio: bank
Conceito: split final de transação
Autoridade: bank_splits
Chave: split_id
Escritor: bank-splits service
Proibidos: payment_splits, payment_intent_splits, event_split_declarative, ledger_referral_splits, event_revenue_split
Tipo: Primário
Estado Final: bank_splits
```

## 5.6 Payments — Ciclo

```yaml
Domínio: payments
Conceito: intenção de pagamento
Autoridade: payment_intents
Chave: payment_intent_id
Escritor: payments module
Tipo: Primário (pré-financeiro)
Estado Final: NUNCA (não decide dinheiro)
```

## 5.7 Refund/Chargeback

```yaml
Domínio: bank/payments
Conceito: reversão financeira
Autoridade: bank_ledger + bank_transactions
Chave: bank_transaction_id (âncora)
Proibidos: event_refund, event_chargeback sem âncora no banco
Tipo: Primário (no banco), Derivado (no evento)
```

## 5.8 UnifyCard

```yaml
Domínio: unifycard
Conceito: captura/autorização/settlement
Autoridade: unifycard_transactions (OPERACIONAL)
Chave: unifycard_tx_id
Regra: NÃO decide saldo, NÃO decide estado final
Tipo: Log/Operacional
Estado Final: UnifyBank (bank_transactions/bank_ledger)
```

---

## 5.9 Estruturas PROIBIDAS

### Financeiro Legacy
- ❌ accounts
- ❌ transactions
- ❌ ledger

### Splits Concorrentes
- ❌ ledger_referral_splits
- ❌ payment_splits
- ❌ payment_intent_splits
- ❌ event_split_declarative
- ❌ event_revenue_split

### Transações Paralelas
- ❌ payment_transactions (como autoridade)
- ❌ escrow_transactions (como autoridade)
- ❌ group_transactions (como autoridade)
- ❌ payout_transactions (como autoridade)

### Saldos Primários Proibidos
- ❌ accounts.balance
- ❌ group_balance.current_balance
- ❌ region_accounts.balance_cents
- ❌ bank_accounts.cached_balance (só derivado)

### Eventos sem Âncora
- ❌ event_refund sem bank_transaction_id
- ❌ event_chargeback sem bank_transaction_id

---

