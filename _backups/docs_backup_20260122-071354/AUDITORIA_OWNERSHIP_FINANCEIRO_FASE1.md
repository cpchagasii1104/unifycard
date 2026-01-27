# AUDITORIA DE OWNERSHIP FINANCEIRO (FASE 1)

**Data:** 2026-01-XX  
**Tipo:** MAPEAMENTO INSTITUCIONAL  
**Objetivo:** Mapear ownership financeiro sem propor mudanças

---

## 1) MAPEAMENTO DE ACCOUNT_ID → OWNER

### TABLE: bank_accounts
**account_id:** `account_id` (UUID)  
**owner_definition:**
- explicit_actor_id: **NÃO**
- via_account_table: **SIM** (owner_id + owner_type)
- via_code_convention: **SIM** (convenção: user_id ou company_id ou system identifier)
- inferred_only: **NÃO**

**evidence:**
- migration: `130_create_bank_accounts.sql`
- service: `backend/src/modules/bank/bank-account.repository.ts`
- comment/reference: 
  - `owner_id`: "ID do dono da conta (user_id, company_id, ou system account identifier)"
  - `owner_type`: "Tipo do dono: user, company, ou system"
  - UNIQUE constraint: `(tenant_id, owner_id, owner_type, currency)`

**Observação:** Ownership é explícito via `owner_id` + `owner_type`, mas NÃO há FK direta para `actors`. A resolução de `actor_id` → `account_id` é feita via código:
- `actor_type='user'` → busca `user_id` do actor → `bank_accounts.owner_id = user_id` e `owner_type='user'`
- `actor_type='page'` → busca `company_id` do actor → `bank_accounts.owner_id = company_id` e `owner_type='company'`
- `actor_type='system'` → `owner_id` é UUID determinístico gerado a partir de string (ex: 'fee', 'regional_fund')

---

### TABLE: escrow_accounts
**account_id:** `escrow_id` (UUID) - NÃO é account_id de bank_accounts  
**owner_definition:**
- explicit_actor_id: **NÃO**
- via_account_table: **NÃO**
- via_code_convention: **SIM** (via agreement_id → provider/requester actors)
- inferred_only: **SIM**

**evidence:**
- migration: `263_create_escrow_accounts.sql`
- service: `backend/src/modules/escrow/escrow.service.ts`
- comment/reference:
  - `agreement_id`: FK obrigatória para `agreements`
  - `service_order_id`: FK opcional para `service_orders`
  - Ownership é inferido via `agreement.providerActorId` e `agreement.requesterActorId`

**Observação:** `escrow_accounts` NÃO tem `account_id` de `bank_accounts`. É uma estrutura separada. O ownership é inferido via `agreement` que referencia `providerActorId` e `requesterActorId`.

---

### TABLE: group_balance
**account_id:** NÃO TEM account_id  
**owner_definition:**
- explicit_actor_id: **NÃO**
- via_account_table: **NÃO**
- via_code_convention: **SIM** (via group_id → group → actors)
- inferred_only: **SIM**

**evidence:**
- migration: `120_groups_community_governance.sql`
- service: N/A (tabela de saldo calculado)
- comment/reference:
  - `group_id`: FK para `groups`
  - `current_balance`: Saldo calculado (não é account_id)

**Observação:** `group_balance` NÃO tem `account_id`. É uma tabela de saldo calculado. O ownership é inferido via `group_id` → `groups` → `actors` (se houver actor do tipo 'group').

---

### TABLE: event_escrow
**account_id:** NÃO TEM account_id  
**owner_definition:**
- explicit_actor_id: **NÃO**
- via_account_table: **NÃO**
- via_code_convention: **SIM** (via event_id → events → actor_id)
- inferred_only: **SIM**

**evidence:**
- migration: `092_event_escrow.sql`
- service: `backend/src/core/events/event-economy.service.ts`
- comment/reference:
  - `event_id`: FK para `events`
  - Ownership é inferido via `events.actor_id` e `events.actor_type`

**Observação:** `event_escrow` NÃO tem `account_id`. É uma estrutura de escrow por evento. O ownership é inferido via `event.actor_id` → resolve para `bank_accounts` via código.

---

### TABLE: bank_ledger
**account_id:** `account_id` (UUID) - FK para `bank_accounts`  
**owner_definition:**
- explicit_actor_id: **NÃO**
- via_account_table: **SIM** (via FK para bank_accounts → owner_id + owner_type)
- via_code_convention: **NÃO**
- inferred_only: **NÃO**

**evidence:**
- migration: `131_create_bank_ledger.sql`
- service: `backend/src/modules/bank/bank-ledger.repository.ts`
- comment/reference:
  - `account_id`: FK para `bank_accounts(account_id)`
  - Ownership é resolvido via `bank_accounts.owner_id` + `bank_accounts.owner_type`

**Observação:** `bank_ledger.account_id` referencia `bank_accounts.account_id`, então ownership é resolvido via `bank_accounts`.

---

### TABLE: ledger_entries
**account_id:** `debit_account_id` e `credit_account_id` (VARCHAR(255)) - NÃO são UUIDs  
**owner_definition:**
- explicit_actor_id: **NÃO**
- via_account_table: **NÃO** (não há FK)
- via_code_convention: **SIM** (formato: UUID ou `actor:{actorId}`)
- inferred_only: **SIM**

**evidence:**
- migration: `268_create_ledger_entries.sql`
- service: `backend/src/modules/ledger/ledger.service.ts`
- comment/reference:
  - `debit_account_id`: VARCHAR(255) - "Conta que recebe débito (double-entry)"
  - `credit_account_id`: VARCHAR(255) - "Conta que recebe crédito (double-entry)"
  - Formato pode ser: UUID (account_id de bank_accounts) ou `actor:{actorId}`

**Observação:** `ledger_entries` usa VARCHAR(255) para account_id, não UUID. Pode conter:
- UUID de `bank_accounts.account_id`
- String no formato `actor:{actorId}` (ex: `actor:abc-123`)
- Ownership é inferido via parsing da string ou lookup em `bank_accounts`

---

### TABLE: bank_transactions
**account_id:** `from_account_id` e `to_account_id` (UUID) - FK para `bank_accounts`  
**owner_definition:**
- explicit_actor_id: **NÃO**
- via_account_table: **SIM** (via FK para bank_accounts → owner_id + owner_type)
- via_code_convention: **NÃO**
- inferred_only: **NÃO**

**evidence:**
- migration: `132_create_bank_transactions.sql`
- service: `backend/src/modules/bank/bank-transaction.service.ts`
- comment/reference:
  - `from_account_id`: FK para `bank_accounts(account_id)`
  - `to_account_id`: FK para `bank_accounts(account_id)`
  - Ownership é resolvido via `bank_accounts.owner_id` + `bank_accounts.owner_type`

**Observação:** `bank_transactions` referencia `bank_accounts` via FK, então ownership é resolvido via `bank_accounts`.

---

### TABLE: escrow_transactions
**account_id:** NÃO TEM account_id direto  
**owner_definition:**
- explicit_actor_id: **NÃO**
- via_account_table: **NÃO**
- via_code_convention: **SIM** (via escrow_id → escrow_accounts → agreement → actors)
- inferred_only: **SIM**

**evidence:**
- migration: `263_create_escrow_accounts.sql`
- service: `backend/src/modules/escrow/escrow.service.ts`
- comment/reference:
  - `escrow_id`: FK para `escrow_accounts(escrow_id)`
  - Ownership é inferido via `escrow_accounts.agreement_id` → `agreements` → `providerActorId` / `requesterActorId`

**Observação:** `escrow_transactions` não tem `account_id` direto. Ownership é inferido via `escrow_accounts`.

---

### TABLE: event_escrow_transactions
**account_id:** `source_account_id` e `destination_account_id` (UUID) - opcionais  
**owner_definition:**
- explicit_actor_id: **NÃO**
- via_account_table: **SIM** (se não NULL, FK para bank_accounts)
- via_code_convention: **SIM** (se NULL, inferido via event_id)
- inferred_only: **SIM** (quando NULL)

**evidence:**
- migration: `092_event_escrow.sql`
- service: `backend/src/core/events/event-economy.service.ts`
- comment/reference:
  - `source_account_id`: UUID opcional
  - `destination_account_id`: UUID opcional
  - Se NULL, ownership é inferido via `escrow_id` → `event_escrow.event_id` → `events.actor_id`

**Observação:** `event_escrow_transactions` tem `account_id` opcionais. Se NULL, ownership é inferido via evento.

---

## 2) QUEM PODE RECEBER DINHEIRO

### DESTINATION: Payout
**receives_money:** SIM  
**identity_used:**
- actor_id: **SIM** (`payout_orders.actor_id` VARCHAR(255))
- account_id: **NÃO** (resolvido via código: `resolveActorAccount()`)
- other: N/A

**ownership_clarity:** IMPLÍCITO  
**evidence:**
- migration: `269_create_payouts.sql`
- service: `backend/src/modules/payout/payout.service.ts`
- code: `payout_orders.actor_id` → `resolveActorAccount()` → `bank_accounts` via `actor.user_id` ou `actor.company_id`

---

### DESTINATION: Split
**receives_money:** SIM  
**identity_used:**
- actor_id: **NÃO** (usa `target_account_id` UUID)
- account_id: **SIM** (`bank_splits.target_account_id` FK para `bank_accounts`)
- other: N/A

**ownership_clarity:** CLARO  
**evidence:**
- migration: `133_create_bank_splits.sql`
- service: `backend/src/modules/bank/bank-split-engine.service.ts`
- code: `bank_splits.target_account_id` → `bank_accounts.account_id` → `owner_id` + `owner_type`

---

### DESTINATION: Transferência
**receives_money:** SIM  
**identity_used:**
- actor_id: **NÃO** (usa `to_account_id` UUID)
- account_id: **SIM** (`bank_transactions.to_account_id` FK para `bank_accounts`)
- other: N/A

**ownership_clarity:** CLARO  
**evidence:**
- migration: `132_create_bank_transactions.sql`
- service: `backend/src/modules/bank/bank-transaction.service.ts`
- code: `bank_transactions.to_account_id` → `bank_accounts.account_id` → `owner_id` + `owner_type`

---

### DESTINATION: Escrow release
**receives_money:** SIM  
**identity_used:**
- actor_id: **SIM** (inferido via `escrow_accounts.agreement_id` → `agreements.providerActorId`)
- account_id: **NÃO** (resolvido via código: `actor:{actorId}` ou UUID)
- other: N/A

**ownership_clarity:** IMPLÍCITO  
**evidence:**
- migration: `263_create_escrow_accounts.sql`
- service: `backend/src/modules/escrow/escrow.service.ts`
- code: `escrow_accounts.agreement_id` → `agreements.providerActorId` → resolve para `bank_accounts` ou usa `actor:{actorId}` em `ledger_entries`

---

### DESTINATION: Fee
**receives_money:** SIM  
**identity_used:**
- actor_id: **NÃO**
- account_id: **SIM** (system account: `bank_accounts.owner_type='system'` e `owner_id` = UUID determinístico de 'fee')
- other: system account name ('fee')

**ownership_clarity:** CLARO  
**evidence:**
- migration: `134_create_system_accounts.sql`
- service: `backend/src/modules/bank/bank-account.service.ts` → `getSystemAccount('fee')`
- code: System account criada automaticamente com `owner_type='system'` e `owner_id` = UUID determinístico de 'system:fee:{tenant_id}'

---

### DESTINATION: Regional fee
**receives_money:** SIM  
**identity_used:**
- actor_id: **NÃO**
- account_id: **SIM** (system account: `bank_accounts.owner_type='system'` e `owner_id` = UUID determinístico de 'regional_fund')
- other: system account name ('regional_fund')

**ownership_clarity:** CLARO  
**evidence:**
- migration: `134_create_system_accounts.sql`
- service: `backend/src/modules/bank/bank-account.service.ts` → `getSystemAccount('regional_fund')`
- code: System account criada automaticamente com `owner_type='system'` e `owner_id` = UUID determinístico de 'system:regional_fund:{tenant_id}'

---

### DESTINATION: Referral
**receives_money:** SIM  
**identity_used:**
- actor_id: **SIM** (inferido via referral code → user_id → actor)
- account_id: **NÃO** (resolvido via código)
- other: referral code

**ownership_clarity:** IMPLÍCITO  
**evidence:**
- migration: `153_create_referrals.sql`
- service: `backend/src/core/economy/split.service.ts` → referral split
- code: Referral code → `user_id` → `actor` → resolve para `bank_accounts` via `owner_id=user_id` e `owner_type='user'`

---

## 3) QUEM PODE ENVIAR DINHEIRO

### ORIGIN: Pagamento externo
**sends_money:** SIM  
**identity_used:**
- actor_id: **SIM** (buyer/payer actor_id)
- account_id: **NÃO** (resolvido via código)
- other: payment method (card, PIX, etc.)

**ownership_clarity:** IMPLÍCITO  
**evidence:**
- service: `backend/src/modules/marketplace/payment-execution.service.ts`
- code: `buyerActorId` → `resolveActorAccount()` → `bank_accounts` via `actor.user_id` ou `actor.company_id`

---

### ORIGIN: Usuário
**sends_money:** SIM  
**identity_used:**
- actor_id: **SIM** (user actor)
- account_id: **NÃO** (resolvido via código)
- other: N/A

**ownership_clarity:** IMPLÍCITO  
**evidence:**
- service: `backend/src/modules/bank/bank-account.service.ts` → `getOrCreateUserPrimaryAccount()`
- code: `user_id` → `bank_accounts.owner_id=user_id` e `owner_type='user'`

---

### ORIGIN: Grupo
**sends_money:** SIM  
**identity_used:**
- actor_id: **SIM** (group actor, se existir)
- account_id: **NÃO** (resolvido via código ou `group_balance`)
- other: group_id

**ownership_clarity:** IMPLÍCITO  
**evidence:**
- migration: `120_groups_community_governance.sql` → `group_balance`
- service: N/A (saldo calculado, não há account_id direto)
- code: `group_id` → `groups` → `actors` (se houver) → resolve para `bank_accounts` ou usa `group_balance`

---

### ORIGIN: Evento
**sends_money:** SIM  
**identity_used:**
- actor_id: **SIM** (event.actor_id)
- account_id: **NÃO** (resolvido via código)
- other: event_id

**ownership_clarity:** IMPLÍCITO  
**evidence:**
- service: `backend/src/core/events/event-economy.service.ts` → `resolveOrganizerAccount()`
- code: `event.actor_id` + `event.actor_type` → resolve para `bank_accounts` via `owner_id` (user_id ou company_id) e `owner_type`

---

### ORIGIN: Sistema
**sends_money:** SIM  
**identity_used:**
- actor_id: **NÃO**
- account_id: **SIM** (system accounts: fee, regional_fund, reserve, escrow)
- other: system account name

**ownership_clarity:** CLARO  
**evidence:**
- migration: `134_create_system_accounts.sql`
- service: `backend/src/modules/bank/bank-account.service.ts` → `getSystemAccount()`
- code: System accounts com `owner_type='system'` e `owner_id` = UUID determinístico

---

### ORIGIN: Reserva
**sends_money:** SIM  
**identity_used:**
- actor_id: **NÃO**
- account_id: **SIM** (system account: 'reserve')
- other: system account name ('reserve')

**ownership_clarity:** CLARO  
**evidence:**
- migration: `134_create_system_accounts.sql`
- service: `backend/src/modules/bank/bank-account.service.ts` → `getSystemAccount('reserve')`
- code: System account com `owner_type='system'` e `owner_id` = UUID determinístico de 'system:reserve:{tenant_id}'

---

### ORIGIN: Escrow
**sends_money:** SIM  
**identity_used:**
- actor_id: **SIM** (inferido via `escrow_accounts.agreement_id` → `agreements.requesterActorId`)
- account_id: **NÃO** (resolvido via código)
- other: escrow_id

**ownership_clarity:** IMPLÍCITO  
**evidence:**
- migration: `263_create_escrow_accounts.sql`
- service: `backend/src/modules/escrow/escrow.service.ts`
- code: `escrow_accounts.agreement_id` → `agreements.requesterActorId` → resolve para `bank_accounts` ou usa `actor:{actorId}` em `ledger_entries`

---

## 4) RELAÇÃO ACTOR ↔ ACCOUNT

### Todo actor tem uma ou mais account_id?
**Resposta:** NÃO (não é automático)  
**Evidência:**
- `bank_accounts` é criado sob demanda via `getOrCreateAccount()` ou `getOrCreateUserPrimaryAccount()`
- Não há trigger ou constraint que force criação de account para cada actor
- `actors` não tem FK para `bank_accounts`

**Código de resolução:**
- `backend/src/core/events/event-economy.service.ts` → `resolveOrganizerAccount()`: busca ou cria account
- `backend/src/modules/marketplace/payment-execution.service.ts` → `resolveActorAccount()`: busca ou cria account
- `backend/src/modules/payout/payout.service.ts` → `resolveActorAccount()`: busca ou cria account

---

### Uma account_id pode pertencer a mais de um actor?
**Resposta:** NÃO (constraint UNIQUE)  
**Evidência:**
- `bank_accounts` tem UNIQUE constraint: `(tenant_id, owner_id, owner_type, currency)`
- Uma account é única por `(owner_id, owner_type, currency, tenant_id)`
- Um `owner_id` + `owner_type` pode ter múltiplas accounts (uma por moeda)

**Observação:** Um actor pode ter múltiplas accounts (uma por moeda: BRL, USD, EUR, TEST), mas cada account pertence a um único `(owner_id, owner_type)`.

---

### Existem account_id sem owner institucional definido?
**Resposta:** NÃO (constraint NOT NULL)  
**Evidência:**
- `bank_accounts.owner_id` é NOT NULL
- `bank_accounts.owner_type` é NOT NULL com CHECK constraint: `('user', 'company', 'system')`
- System accounts têm `owner_id` = UUID determinístico (não é NULL, mas não referencia entidade real)

**Observação:** System accounts (`owner_type='system'`) têm `owner_id` = UUID determinístico gerado a partir de string (ex: 'system:fee:{tenant_id}'). Não há entidade "system" real, mas o UUID é determinístico e único.

---

## 5) STATUS FINAL

### OWNERSHIP_STATUS:
- explicit_and_consistent: **NÃO**
- implicit_but_consistent: **SIM**
- ambiguous: **NÃO**

**Justificativa:**
- `bank_accounts` tem ownership explícito via `owner_id` + `owner_type`, mas NÃO há FK direta para `actors`
- Resolução de `actor_id` → `account_id` é feita via código (implicit)
- `ledger_entries` usa VARCHAR(255) para account_id (pode ser UUID ou `actor:{actorId}`), aumentando ambiguidade
- `escrow_accounts`, `event_escrow`, `group_balance` não têm `account_id` direto, ownership é inferido
- System accounts têm ownership claro (owner_type='system', owner_id=UUID determinístico)
- Padrão geral: ownership é resolvido via código, não via FK direta

---

### UNOWNED_ACCOUNTS:
**NONE** (todas as accounts têm `owner_id` NOT NULL)

**Observação:** System accounts têm `owner_id` = UUID determinístico, que não referencia entidade real, mas é tecnicamente "owned" pelo sistema (owner_type='system').

---

## RESUMO EXECUTIVO

1. **bank_accounts**: Ownership explícito via `owner_id` + `owner_type`, mas sem FK para `actors`. Resolução via código.

2. **escrow_accounts, event_escrow, group_balance**: Não têm `account_id` de `bank_accounts`. Ownership inferido via relacionamentos (agreement, event, group).

3. **ledger_entries**: Usa VARCHAR(255) para account_id (pode ser UUID ou `actor:{actorId}`), aumentando ambiguidade.

4. **bank_transactions, bank_splits, bank_ledger**: Referenciam `bank_accounts` via FK, ownership claro.

5. **Payouts, Escrow releases**: Usam `actor_id` e resolvem para `account_id` via código.

6. **Splits, Transfers, Fees**: Usam `account_id` diretamente (FK para `bank_accounts`), ownership claro.

7. **System accounts**: Ownership claro (owner_type='system', owner_id=UUID determinístico).

8. **Actor → Account**: Não é automático. Accounts são criadas sob demanda via `getOrCreateAccount()`.

9. **Account → Actor**: Não há FK direta. Resolução via código baseada em `owner_id` + `owner_type` + lookup em `actors`.

---

**FIM DO RELATÓRIO**


