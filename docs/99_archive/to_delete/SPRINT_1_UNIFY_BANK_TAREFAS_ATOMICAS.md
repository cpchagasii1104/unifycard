# SPRINT 1: FUNDAÇÃO DO UNIFY BANK
## Tarefas Atômicas Executáveis - Semana 1

**Objetivo:** Criar fundação contábil sólida  
**Resultado:** Contas existem, saldo calcula, ledger é imutável  
**Critério sucesso:** Os números batem (testes passam)  

---

## DIA 1: MIGRATIONS + SCHEMA

### Tarefa 1.1: Migration 130 - Tabela `bank_accounts`

**Arquivo:** `backend/migrations/130_create_bank_accounts.sql`

```sql
-- migrations/130_create_bank_accounts.sql
-- 🔴 BLINDAGEM: Saldo é DERIVADO, não autoritativo
-- 🔴 BLINDAGEM: 1 conta por (owner_type, owner_id, currency)

BEGIN;

CREATE TABLE bank_accounts (
  account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Dono da conta
  owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('user', 'group', 'event', 'system')),
  owner_id VARCHAR(100) NOT NULL, -- Pode ser 'fee', 'regional_fund', etc para system
  
  -- Tipo de conta
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('personal', 'business', 'system', 'escrow')),
  
  -- Moeda
  currency VARCHAR(3) NOT NULL DEFAULT 'MFI',
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'closed')),
  
  -- Saldo (CACHE apenas, não autoritativo)
  cached_balance_cents BIGINT NOT NULL DEFAULT 0,
  last_balance_update TIMESTAMPTZ,
  
  -- Limites (opcional)
  daily_limit_cents BIGINT,
  transaction_limit_cents BIGINT,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT bank_accounts_owner_unique UNIQUE(tenant_id, owner_type, owner_id, currency),
  CONSTRAINT bank_accounts_balance_non_negative CHECK(cached_balance_cents >= 0)
);

-- Índices
CREATE INDEX idx_bank_accounts_owner ON bank_accounts(tenant_id, owner_type, owner_id);
CREATE INDEX idx_bank_accounts_status ON bank_accounts(status) WHERE status = 'active';
CREATE INDEX idx_bank_accounts_tenant ON bank_accounts(tenant_id);

-- Trigger: Atualizar updated_at
CREATE TRIGGER trg_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE bank_accounts IS 'Contas virtuais do Unify Bank';
COMMENT ON COLUMN bank_accounts.cached_balance_cents IS 'CACHE apenas - saldo real vem do ledger';
COMMENT ON COLUMN bank_accounts.owner_id IS 'Para system: fee, regional_fund, reserve, escrow';

COMMIT;
```

**Teste manual:**
```sql
-- Deve criar conta
INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, account_type)
VALUES ('tenant-123', 'user', 'user-456', 'personal')
RETURNING account_id;

-- Deve rejeitar duplicata
INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, account_type)
VALUES ('tenant-123', 'user', 'user-456', 'personal'); -- ERRO

-- Deve rejeitar saldo negativo
UPDATE bank_accounts SET cached_balance_cents = -100; -- ERRO
```

---

### Tarefa 1.2: Migration 131 - Tabela `bank_ledger`

**Arquivo:** `backend/migrations/131_create_bank_ledger.sql`

```sql
-- migrations/131_create_bank_ledger.sql
-- 🔴 BLINDAGEM: Ledger é IMUTÁVEL (append-only)
-- 🔴 BLINDAGEM: Entradas NUNCA são atualizadas ou deletadas

BEGIN;

CREATE TABLE bank_ledger (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Timestamp (ordenação)
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Conta origem (NULL = depósito externo)
  from_account_id UUID REFERENCES bank_accounts(account_id),
  
  -- Conta destino (sempre presente)
  to_account_id UUID NOT NULL REFERENCES bank_accounts(account_id),
  
  -- Valor (sempre positivo)
  amount_cents BIGINT NOT NULL,
  
  -- Moeda
  currency VARCHAR(3) NOT NULL DEFAULT 'MFI',
  
  -- Tipo de transação
  transaction_type VARCHAR(50) NOT NULL,
  -- deposit, withdrawal, transfer, payment, refund, split, fee, fund
  
  -- Referência externa
  reference_type VARCHAR(50), -- event, booking, service, group
  reference_id UUID,
  
  -- Descrição
  description TEXT,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  
  -- Reversão (se aplicável)
  reversed_by UUID REFERENCES bank_ledger(entry_id),
  reverses UUID REFERENCES bank_ledger(entry_id),
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  -- Constraints
  CONSTRAINT bank_ledger_amount_positive CHECK(amount_cents > 0),
  CONSTRAINT bank_ledger_different_accounts CHECK(from_account_id IS NULL OR from_account_id != to_account_id),
  CONSTRAINT bank_ledger_reversal_consistency CHECK(
    (reversed_by IS NULL AND reverses IS NULL) OR
    (reversed_by IS NOT NULL AND reverses IS NULL) OR
    (reversed_by IS NULL AND reverses IS NOT NULL)
  )
);

-- Índices
CREATE INDEX idx_bank_ledger_timestamp ON bank_ledger(timestamp DESC);
CREATE INDEX idx_bank_ledger_from ON bank_ledger(from_account_id) WHERE from_account_id IS NOT NULL;
CREATE INDEX idx_bank_ledger_to ON bank_ledger(to_account_id);
CREATE INDEX idx_bank_ledger_reference ON bank_ledger(reference_type, reference_id) WHERE reference_type IS NOT NULL;
CREATE INDEX idx_bank_ledger_status ON bank_ledger(status);
CREATE INDEX idx_bank_ledger_tenant ON bank_ledger(tenant_id);

-- Comentários
COMMENT ON TABLE bank_ledger IS 'Ledger imutável - NUNCA UPDATE ou DELETE';
COMMENT ON COLUMN bank_ledger.from_account_id IS 'NULL = depósito externo';
COMMENT ON COLUMN bank_ledger.reversed_by IS 'Entry que reverteu esta entrada';
COMMENT ON COLUMN bank_ledger.reverses IS 'Entry que esta entrada reverte';

COMMIT;
```

**Teste manual:**
```sql
-- Deve criar entrada
INSERT INTO bank_ledger (tenant_id, to_account_id, amount_cents, transaction_type, description)
VALUES ('tenant-123', 'account-456', 10000, 'deposit', 'Depósito inicial')
RETURNING entry_id;

-- Deve rejeitar valor negativo
INSERT INTO bank_ledger (tenant_id, to_account_id, amount_cents, transaction_type)
VALUES ('tenant-123', 'account-456', -100, 'deposit'); -- ERRO

-- Deve rejeitar mesma conta origem/destino
INSERT INTO bank_ledger (tenant_id, from_account_id, to_account_id, amount_cents, transaction_type)
VALUES ('tenant-123', 'account-456', 'account-456', 100, 'transfer'); -- ERRO
```

---

### Tarefa 1.3: Migration 132 - Tabela `bank_transactions`

**Arquivo:** `backend/migrations/132_create_bank_transactions.sql`

```sql
-- migrations/132_create_bank_transactions.sql
-- 🔴 BLINDAGEM: Transaction agrupa múltiplas entradas do ledger

BEGIN;

CREATE TABLE bank_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Timestamp
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Tipo
  transaction_type VARCHAR(50) NOT NULL,
  -- payment, ticket_purchase, service_booking, transfer, deposit, withdrawal, contribution
  
  -- Valor total
  total_amount_cents BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'MFI',
  
  -- Pagador
  payer_account_id UUID NOT NULL REFERENCES bank_accounts(account_id),
  
  -- Receptor principal
  recipient_account_id UUID NOT NULL REFERENCES bank_accounts(account_id),
  
  -- Referência externa
  reference_type VARCHAR(50), -- event, booking, service, group
  reference_id UUID,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'reversed')),
  
  -- Splits (se aplicável)
  has_splits BOOLEAN NOT NULL DEFAULT false,
  
  -- Descrição
  description TEXT,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps de status
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT bank_transactions_amount_positive CHECK(total_amount_cents > 0),
  CONSTRAINT bank_transactions_status_timestamps CHECK(
    (status != 'completed' OR completed_at IS NOT NULL) AND
    (status != 'failed' OR failed_at IS NOT NULL) AND
    (status != 'reversed' OR reversed_at IS NOT NULL)
  )
);

-- Índices
CREATE INDEX idx_bank_transactions_timestamp ON bank_transactions(timestamp DESC);
CREATE INDEX idx_bank_transactions_payer ON bank_transactions(payer_account_id);
CREATE INDEX idx_bank_transactions_recipient ON bank_transactions(recipient_account_id);
CREATE INDEX idx_bank_transactions_reference ON bank_transactions(reference_type, reference_id) WHERE reference_type IS NOT NULL;
CREATE INDEX idx_bank_transactions_status ON bank_transactions(status);
CREATE INDEX idx_bank_transactions_tenant ON bank_transactions(tenant_id);

-- Comentários
COMMENT ON TABLE bank_transactions IS 'Transações (agrupa 1+ ledger entries)';
COMMENT ON COLUMN bank_transactions.has_splits IS 'true se transaction tem múltiplos recipients';

COMMIT;
```

---

### Tarefa 1.4: Migration 133 - Tabela `bank_splits`

**Arquivo:** `backend/migrations/133_create_bank_splits.sql`

```sql
-- migrations/133_create_bank_splits.sql
-- 🔴 BLINDAGEM: Split detalha distribuição de transação

BEGIN;

CREATE TABLE bank_splits (
  split_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Transação pai
  transaction_id UUID NOT NULL REFERENCES bank_transactions(transaction_id) ON DELETE CASCADE,
  
  -- Entrada do ledger correspondente
  ledger_entry_id UUID NOT NULL REFERENCES bank_ledger(entry_id) ON DELETE CASCADE,
  
  -- Receptor
  recipient_account_id UUID NOT NULL REFERENCES bank_accounts(account_id),
  
  -- Valor
  amount_cents BIGINT NOT NULL,
  
  -- Tipo de split
  split_type VARCHAR(50) NOT NULL,
  -- recipient, system_fee, regional_fund, reserve, venue, platform
  
  -- Porcentagem original (opcional)
  percentage NUMERIC(5,2),
  
  -- Descrição
  description TEXT,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT bank_splits_amount_positive CHECK(amount_cents > 0)
);

-- Índices
CREATE INDEX idx_bank_splits_transaction ON bank_splits(transaction_id);
CREATE INDEX idx_bank_splits_ledger_entry ON bank_splits(ledger_entry_id);
CREATE INDEX idx_bank_splits_recipient ON bank_splits(recipient_account_id);
CREATE INDEX idx_bank_splits_type ON bank_splits(split_type);
CREATE INDEX idx_bank_splits_tenant ON bank_splits(tenant_id);

-- Comentários
COMMENT ON TABLE bank_splits IS 'Detalhamento de como transação foi dividida';

COMMIT;
```

---

### Tarefa 1.5: Migration 134 - Criar Contas do Sistema

**Arquivo:** `backend/migrations/134_create_system_accounts.sql`

```sql
-- migrations/134_create_system_accounts.sql
-- 🔴 BLINDAGEM: Contas do sistema criadas automaticamente por tenant

BEGIN;

-- Função para criar contas do sistema
CREATE OR REPLACE FUNCTION create_system_accounts_for_tenant(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
  -- 1. system:fee (taxa administrativa)
  INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, account_type, currency)
  VALUES (p_tenant_id, 'system', 'fee', 'system', 'MFI')
  ON CONFLICT (tenant_id, owner_type, owner_id, currency) DO NOTHING;
  
  -- 2. system:regional_fund (fundo regional)
  INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, account_type, currency)
  VALUES (p_tenant_id, 'system', 'regional_fund', 'system', 'MFI')
  ON CONFLICT (tenant_id, owner_type, owner_id, currency) DO NOTHING;
  
  -- 3. system:reserve (reserva emergencial)
  INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, account_type, currency)
  VALUES (p_tenant_id, 'system', 'reserve', 'system', 'MFI')
  ON CONFLICT (tenant_id, owner_type, owner_id, currency) DO NOTHING;
  
  -- 4. system:escrow (custódia temporária)
  INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, account_type, currency)
  VALUES (p_tenant_id, 'system', 'escrow', 'system', 'MFI')
  ON CONFLICT (tenant_id, owner_type, owner_id, currency) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Criar contas para todos os tenants existentes
DO $$
DECLARE
  tenant_record RECORD;
BEGIN
  FOR tenant_record IN SELECT id FROM tenants LOOP
    PERFORM create_system_accounts_for_tenant(tenant_record.id);
  END LOOP;
END $$;

-- Trigger: Criar contas do sistema automaticamente quando novo tenant é criado
CREATE OR REPLACE FUNCTION trg_create_system_accounts_on_tenant()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_system_accounts_for_tenant(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_create_system_accounts
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION trg_create_system_accounts_on_tenant();

COMMIT;
```

**Teste manual:**
```sql
-- Verificar contas do sistema
SELECT owner_id, account_type, currency, cached_balance_cents
FROM bank_accounts
WHERE owner_type = 'system'
ORDER BY owner_id;

-- Deve ter 4 contas por tenant: fee, regional_fund, reserve, escrow
```

---

## DIA 2: SERVIÇOS CORE

### Tarefa 2.1: BankAccount Types & DTOs

**Arquivo:** `backend/src/modules/bank/bank-account.types.ts`

```typescript
// src/modules/bank/bank-account.types.ts
// 🔴 BLINDAGEM: Tipos fortemente tipados para contas

export type OwnerType = 'user' | 'group' | 'event' | 'system';
export type AccountType = 'personal' | 'business' | 'system' | 'escrow';
export type AccountStatus = 'active' | 'frozen' | 'closed';

export interface BankAccount {
  accountId: string;
  tenantId: string;
  
  // Dono
  ownerType: OwnerType;
  ownerId: string;
  
  // Tipo
  accountType: AccountType;
  
  // Moeda
  currency: string;
  
  // Status
  status: AccountStatus;
  
  // Saldo (cache)
  cachedBalanceCents: number;
  lastBalanceUpdate: Date | null;
  
  // Limites
  dailyLimitCents: number | null;
  transactionLimitCents: number | null;
  
  // Metadados
  metadata: Record<string, any>;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

export interface CreateAccountParams {
  tenantId: string;
  ownerType: OwnerType;
  ownerId: string;
  accountType: AccountType;
  currency?: string;
  dailyLimitCents?: number;
  transactionLimitCents?: number;
  metadata?: Record<string, any>;
}

export interface AccountBalance {
  accountId: string;
  balance: number;
  currency: string;
  lastTransaction: Date | null;
  calculatedAt: Date;
}

export interface AccountStatement {
  accountId: string;
  entries: Array<{
    entryId: string;
    timestamp: Date;
    type: string;
    amount: number;
    fromAccountId: string | null;
    toAccountId: string;
    description: string;
    referenceType: string | null;
    referenceId: string | null;
    status: string;
  }>;
  total: number;
  hasMore: boolean;
}
```

---

### Tarefa 2.2: BankAccount Repository

**Arquivo:** `backend/src/modules/bank/bank-account.repository.ts`

```typescript
// src/modules/bank/bank-account.repository.ts
// 🔴 BLINDAGEM: Repository puro (sem lógica de negócio)

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { BankAccount, CreateAccountParams } from './bank-account.types';

export class BankAccountRepository {
  /**
   * Criar conta
   */
  async create(params: CreateAccountParams): Promise<BankAccount> {
    const row = await runQueryWithTenant<any>(
      params.tenantId,
      `
      INSERT INTO bank_accounts (
        tenant_id, owner_type, owner_id, account_type, currency,
        daily_limit_cents, transaction_limit_cents, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        params.tenantId,
        params.ownerType,
        params.ownerId,
        params.accountType,
        params.currency || 'MFI',
        params.dailyLimitCents || null,
        params.transactionLimitCents || null,
        JSON.stringify(params.metadata || {}),
      ]
    );
    
    return this.mapRowToAccount(row);
  }
  
  /**
   * Buscar por ID
   */
  async findById(tenantId: string, accountId: string): Promise<BankAccount | null> {
    const row = await runQueryWithTenant<any>(
      tenantId,
      `SELECT * FROM bank_accounts WHERE account_id = $1 AND tenant_id = $2`,
      [accountId, tenantId]
    );
    
    return row ? this.mapRowToAccount(row) : null;
  }
  
  /**
   * Buscar por owner
   */
  async findByOwner(
    tenantId: string,
    ownerType: string,
    ownerId: string,
    currency: string = 'MFI'
  ): Promise<BankAccount | null> {
    const row = await runQueryWithTenant<any>(
      tenantId,
      `
      SELECT * FROM bank_accounts
      WHERE tenant_id = $1
        AND owner_type = $2
        AND owner_id = $3
        AND currency = $4
      `,
      [tenantId, ownerType, ownerId, currency]
    );
    
    return row ? this.mapRowToAccount(row) : null;
  }
  
  /**
   * Buscar conta do sistema
   */
  async findSystemAccount(
    tenantId: string,
    systemType: 'fee' | 'regional_fund' | 'reserve' | 'escrow',
    currency: string = 'MFI'
  ): Promise<BankAccount | null> {
    return this.findByOwner(tenantId, 'system', systemType, currency);
  }
  
  /**
   * Atualizar cache de saldo
   */
  async updateBalanceCache(
    tenantId: string,
    accountId: string,
    balanceCents: number
  ): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE bank_accounts
      SET cached_balance_cents = $1,
          last_balance_update = now(),
          updated_at = now()
      WHERE account_id = $2 AND tenant_id = $3
      `,
      [balanceCents, accountId, tenantId]
    );
  }
  
  /**
   * Congelar conta
   */
  async freeze(tenantId: string, accountId: string): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE bank_accounts
      SET status = 'frozen', updated_at = now()
      WHERE account_id = $1 AND tenant_id = $2
      `,
      [accountId, tenantId]
    );
  }
  
  /**
   * Descongelar conta
   */
  async unfreeze(tenantId: string, accountId: string): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE bank_accounts
      SET status = 'active', updated_at = now()
      WHERE account_id = $1 AND tenant_id = $2
      `,
      [accountId, tenantId]
    );
  }
  
  /**
   * Fechar conta
   */
  async close(tenantId: string, accountId: string): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE bank_accounts
      SET status = 'closed', closed_at = now(), updated_at = now()
      WHERE account_id = $1 AND tenant_id = $2
      `,
      [accountId, tenantId]
    );
  }
  
  /**
   * Mapear row para BankAccount
   */
  private mapRowToAccount(row: any): BankAccount {
    return {
      accountId: row.account_id,
      tenantId: row.tenant_id,
      ownerType: row.owner_type,
      ownerId: row.owner_id,
      accountType: row.account_type,
      currency: row.currency,
      status: row.status,
      cachedBalanceCents: Number(row.cached_balance_cents),
      lastBalanceUpdate: row.last_balance_update,
      dailyLimitCents: row.daily_limit_cents ? Number(row.daily_limit_cents) : null,
      transactionLimitCents: row.transaction_limit_cents ? Number(row.transaction_limit_cents) : null,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      closedAt: row.closed_at,
    };
  }
}

export const bankAccountRepository = new BankAccountRepository();
```

---

### Tarefa 2.3: BankLedger Repository

**Arquivo:** `backend/src/modules/bank/bank-ledger.repository.ts`

```typescript
// src/modules/bank/bank-ledger.repository.ts
// 🔴 BLINDAGEM: Ledger é imutável (apenas INSERT)

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

export interface LedgerEntry {
  entryId: string;
  tenantId: string;
  timestamp: Date;
  fromAccountId: string | null;
  toAccountId: string;
  amountCents: number;
  currency: string;
  transactionType: string;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  status: string;
  reversedBy: string | null;
  reverses: string | null;
  metadata: Record<string, any>;
}

export interface CreateLedgerEntryParams {
  tenantId: string;
  timestamp?: Date;
  fromAccountId?: string | null;
  toAccountId: string;
  amountCents: number;
  currency?: string;
  transactionType: string;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
  status?: string;
  reverses?: string | null;
  metadata?: Record<string, any>;
}

export class BankLedgerRepository {
  /**
   * Criar entrada no ledger
   * 🔴 BLINDAGEM: ÚNICA operação permitida (append-only)
   */
  async createEntry(params: CreateLedgerEntryParams): Promise<LedgerEntry> {
    const row = await runQueryWithTenant<any>(
      params.tenantId,
      `
      INSERT INTO bank_ledger (
        tenant_id, timestamp, from_account_id, to_account_id,
        amount_cents, currency, transaction_type,
        reference_type, reference_id, description, status, reverses, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
      `,
      [
        params.tenantId,
        params.timestamp || new Date(),
        params.fromAccountId || null,
        params.toAccountId,
        params.amountCents,
        params.currency || 'MFI',
        params.transactionType,
        params.referenceType || null,
        params.referenceId || null,
        params.description || null,
        params.status || 'completed',
        params.reverses || null,
        JSON.stringify(params.metadata || {}),
      ]
    );
    
    return this.mapRowToEntry(row);
  }
  
  /**
   * Buscar entradas por conta
   */
  async findByAccount(
    tenantId: string,
    accountId: string,
    params?: {
      from?: Date;
      to?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<LedgerEntry[]> {
    const { from, to, limit = 50, offset = 0 } = params || {};
    
    let query = `
      SELECT * FROM bank_ledger
      WHERE tenant_id = $1
        AND (from_account_id = $2 OR to_account_id = $2)
    `;
    
    const queryParams: any[] = [tenantId, accountId];
    let paramIndex = 3;
    
    if (from) {
      query += ` AND timestamp >= $${paramIndex}`;
      queryParams.push(from);
      paramIndex++;
    }
    
    if (to) {
      query += ` AND timestamp <= $${paramIndex}`;
      queryParams.push(to);
      paramIndex++;
    }
    
    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);
    
    const rows = await runQueriesWithTenant<any>(tenantId, query, queryParams);
    return rows.map(row => this.mapRowToEntry(row));
  }
  
  /**
   * Calcular saldo real de uma conta
   * 🔴 BLINDAGEM: Saldo SEMPRE vem do ledger, nunca de cache
   */
  async calculateBalance(tenantId: string, accountId: string): Promise<{
    balance: number;
    lastTransaction: Date | null;
  }> {
    const result = await runQueryWithTenant<any>(
      tenantId,
      `
      SELECT
        COALESCE(SUM(
          CASE
            WHEN to_account_id = $2 AND status = 'completed' THEN amount_cents
            WHEN from_account_id = $2 AND status = 'completed' THEN -amount_cents
            ELSE 0
          END
        ), 0) as balance,
        MAX(timestamp) as last_transaction
      FROM bank_ledger
      WHERE tenant_id = $1
        AND (from_account_id = $2 OR to_account_id = $2)
      `,
      [tenantId, accountId]
    );
    
    return {
      balance: Number(result.balance),
      lastTransaction: result.last_transaction,
    };
  }
  
  /**
   * Mapear row para LedgerEntry
   */
  private mapRowToEntry(row: any): LedgerEntry {
    return {
      entryId: row.entry_id,
      tenantId: row.tenant_id,
      timestamp: row.timestamp,
      fromAccountId: row.from_account_id,
      toAccountId: row.to_account_id,
      amountCents: Number(row.amount_cents),
      currency: row.currency,
      transactionType: row.transaction_type,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      description: row.description,
      status: row.status,
      reversedBy: row.reversed_by,
      reverses: row.reverses,
      metadata: row.metadata || {},
    };
  }
}

export const bankLedgerRepository = new BankLedgerRepository();
```

---

## DIA 3: SERVIÇO DE CONTA (Lógica)

### Tarefa 3.1: BankAccount Service

**Arquivo:** `backend/src/modules/bank/bank-account.service.ts`

```typescript
// src/modules/bank/bank-account.service.ts
// 🔴 BLINDAGEM: Lógica de negócio de contas

import { bankAccountRepository } from './bank-account.repository';
import { bankLedgerRepository } from './bank-ledger.repository';
import type { BankAccount, CreateAccountParams, AccountBalance, AccountStatement } from './bank-account.types';

export class BankAccountService {
  /**
   * Criar conta
   */
  async createAccount(params: CreateAccountParams): Promise<BankAccount> {
    // Validar
    if (!params.tenantId) throw new Error('tenantId é obrigatório');
    if (!params.ownerType) throw new Error('ownerType é obrigatório');
    if (!params.ownerId) throw new Error('ownerId é obrigatório');
    if (!params.accountType) throw new Error('accountType é obrigatório');
    
    // Criar
    const account = await bankAccountRepository.create(params);
    
    return account;
  }
  
  /**
   * Buscar ou criar conta (idempotente)
   * 🔴 BLINDAGEM: Método preferencial (garante conta existe)
   */
  async findOrCreateAccount(params: {
    tenantId: string;
    ownerType: string;
    ownerId: string;
    currency?: string;
    accountType?: string;
  }): Promise<BankAccount> {
    const currency = params.currency || 'MFI';
    
    // Tentar buscar
    let account = await bankAccountRepository.findByOwner(
      params.tenantId,
      params.ownerType,
      params.ownerId,
      currency
    );
    
    // Se não existe, criar
    if (!account) {
      const accountType = params.accountType || this.inferAccountType(params.ownerType);
      
      account = await bankAccountRepository.create({
        tenantId: params.tenantId,
        ownerType: params.ownerType as any,
        ownerId: params.ownerId,
        accountType: accountType as any,
        currency,
      });
    }
    
    return account;
  }
  
  /**
   * Calcular saldo real (do ledger)
   * 🔴 BLINDAGEM: Fonte de verdade é o ledger
   */
  async calculateBalance(tenantId: string, accountId: string): Promise<AccountBalance> {
    const account = await bankAccountRepository.findById(tenantId, accountId);
    if (!account) throw new Error('Conta não encontrada');
    
    const { balance, lastTransaction } = await bankLedgerRepository.calculateBalance(tenantId, accountId);
    
    return {
      accountId,
      balance,
      currency: account.currency,
      lastTransaction,
      calculatedAt: new Date(),
    };
  }
  
  /**
   * Atualizar cache de saldo
   */
  async refreshBalanceCache(tenantId: string, accountId: string): Promise<void> {
    const { balance } = await bankLedgerRepository.calculateBalance(tenantId, accountId);
    await bankAccountRepository.updateBalanceCache(tenantId, accountId, balance);
  }
  
  /**
   * Obter extrato
   */
  async getStatement(
    tenantId: string,
    accountId: string,
    params?: {
      from?: Date;
      to?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<AccountStatement> {
    const account = await bankAccountRepository.findById(tenantId, accountId);
    if (!account) throw new Error('Conta não encontrada');
    
    const entries = await bankLedgerRepository.findByAccount(tenantId, accountId, params);
    
    return {
      accountId,
      entries: entries.map(entry => ({
        entryId: entry.entryId,
        timestamp: entry.timestamp,
        type: entry.transactionType,
        amount: entry.amountCents,
        fromAccountId: entry.fromAccountId,
        toAccountId: entry.toAccountId,
        description: entry.description || '',
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
        status: entry.status,
      })),
      total: entries.length,
      hasMore: entries.length === (params?.limit || 50),
    };
  }
  
  /**
   * Congelar conta
   */
  async freezeAccount(tenantId: string, accountId: string, reason: string): Promise<void> {
    const account = await bankAccountRepository.findById(tenantId, accountId);
    if (!account) throw new Error('Conta não encontrada');
    if (account.status === 'frozen') throw new Error('Conta já está congelada');
    
    await bankAccountRepository.freeze(tenantId, accountId);
    
    // Log de auditoria
    console.log(`Conta ${accountId} congelada. Motivo: ${reason}`);
  }
  
  /**
   * Descongelar conta
   */
  async unfreezeAccount(tenantId: string, accountId: string): Promise<void> {
    const account = await bankAccountRepository.findById(tenantId, accountId);
    if (!account) throw new Error('Conta não encontrada');
    if (account.status !== 'frozen') throw new Error('Conta não está congelada');
    
    await bankAccountRepository.unfreeze(tenantId, accountId);
    
    // Log de auditoria
    console.log(`Conta ${accountId} descongelada`);
  }
  
  /**
   * Fechar conta
   */
  async closeAccount(tenantId: string, accountId: string): Promise<void> {
    const account = await bankAccountRepository.findById(tenantId, accountId);
    if (!account) throw new Error('Conta não encontrada');
    if (account.status === 'closed') throw new Error('Conta já está fechada');
    
    // Verificar saldo zero
    const { balance } = await bankLedgerRepository.calculateBalance(tenantId, accountId);
    if (balance !== 0) {
      throw new Error('Conta só pode ser fechada com saldo zero');
    }
    
    await bankAccountRepository.close(tenantId, accountId);
    
    // Log de auditoria
    console.log(`Conta ${accountId} fechada`);
  }
  
  /**
   * Buscar conta do sistema
   */
  async getSystemAccount(
    tenantId: string,
    systemType: 'fee' | 'regional_fund' | 'reserve' | 'escrow',
    currency: string = 'MFI'
  ): Promise<BankAccount> {
    const account = await bankAccountRepository.findSystemAccount(tenantId, systemType, currency);
    if (!account) {
      throw new Error(`Conta do sistema ${systemType} não encontrada`);
    }
    return account;
  }
  
  /**
   * Inferir tipo de conta baseado em owner_type
   */
  private inferAccountType(ownerType: string): string {
    switch (ownerType) {
      case 'user':
        return 'personal';
      case 'group':
      case 'event':
        return 'business';
      case 'system':
        return 'system';
      default:
        return 'personal';
    }
  }
}

export const bankAccountService = new BankAccountService();
```

---

## DIA 4-5: TESTES

### Tarefa 4.1: Testes Unitários - BankAccountService

**Arquivo:** `backend/src/modules/bank/__tests__/bank-account.service.test.ts`

```typescript
// src/modules/bank/__tests__/bank-account.service.test.ts

import { bankAccountService } from '../bank-account.service';
import { bankAccountRepository } from '../bank-account.repository';
import { bankLedgerRepository } from '../bank-ledger.repository';

// Mock repositories
jest.mock('../bank-account.repository');
jest.mock('../bank-ledger.repository');

describe('BankAccountService', () => {
  const mockTenantId = 'tenant-123';
  const mockAccountId = 'account-456';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('createAccount', () => {
    it('deve criar conta com sucesso', async () => {
      const params = {
        tenantId: mockTenantId,
        ownerType: 'user' as const,
        ownerId: 'user-789',
        accountType: 'personal' as const,
      };
      
      const mockAccount = {
        accountId: mockAccountId,
        ...params,
        currency: 'MFI',
        status: 'active' as const,
        cachedBalanceCents: 0,
        lastBalanceUpdate: null,
        dailyLimitCents: null,
        transactionLimitCents: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        closedAt: null,
      };
      
      (bankAccountRepository.create as jest.Mock).mockResolvedValue(mockAccount);
      
      const result = await bankAccountService.createAccount(params);
      
      expect(result).toEqual(mockAccount);
      expect(bankAccountRepository.create).toHaveBeenCalledWith(params);
    });
    
    it('deve rejeitar se tenantId não fornecido', async () => {
      await expect(
        bankAccountService.createAccount({
          tenantId: '',
          ownerType: 'user',
          ownerId: 'user-789',
          accountType: 'personal',
        })
      ).rejects.toThrow('tenantId é obrigatório');
    });
  });
  
  describe('findOrCreateAccount', () => {
    it('deve retornar conta existente', async () => {
      const mockAccount = {
        accountId: mockAccountId,
        tenantId: mockTenantId,
        ownerType: 'user' as const,
        ownerId: 'user-789',
        accountType: 'personal' as const,
        currency: 'MFI',
        status: 'active' as const,
        cachedBalanceCents: 0,
        lastBalanceUpdate: null,
        dailyLimitCents: null,
        transactionLimitCents: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        closedAt: null,
      };
      
      (bankAccountRepository.findByOwner as jest.Mock).mockResolvedValue(mockAccount);
      
      const result = await bankAccountService.findOrCreateAccount({
        tenantId: mockTenantId,
        ownerType: 'user',
        ownerId: 'user-789',
      });
      
      expect(result).toEqual(mockAccount);
      expect(bankAccountRepository.create).not.toHaveBeenCalled();
    });
    
    it('deve criar conta se não existe', async () => {
      (bankAccountRepository.findByOwner as jest.Mock).mockResolvedValue(null);
      
      const mockAccount = {
        accountId: mockAccountId,
        tenantId: mockTenantId,
        ownerType: 'user' as const,
        ownerId: 'user-789',
        accountType: 'personal' as const,
        currency: 'MFI',
        status: 'active' as const,
        cachedBalanceCents: 0,
        lastBalanceUpdate: null,
        dailyLimitCents: null,
        transactionLimitCents: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        closedAt: null,
      };
      
      (bankAccountRepository.create as jest.Mock).mockResolvedValue(mockAccount);
      
      const result = await bankAccountService.findOrCreateAccount({
        tenantId: mockTenantId,
        ownerType: 'user',
        ownerId: 'user-789',
      });
      
      expect(result).toEqual(mockAccount);
      expect(bankAccountRepository.create).toHaveBeenCalled();
    });
  });
  
  describe('calculateBalance', () => {
    it('deve calcular saldo do ledger', async () => {
      const mockAccount = {
        accountId: mockAccountId,
        tenantId: mockTenantId,
        currency: 'MFI',
      };
      
      (bankAccountRepository.findById as jest.Mock).mockResolvedValue(mockAccount);
      (bankLedgerRepository.calculateBalance as jest.Mock).mockResolvedValue({
        balance: 10000,
        lastTransaction: new Date('2026-01-12'),
      });
      
      const result = await bankAccountService.calculateBalance(mockTenantId, mockAccountId);
      
      expect(result.balance).toBe(10000);
      expect(result.accountId).toBe(mockAccountId);
      expect(result.currency).toBe('MFI');
    });
    
    it('deve rejeitar se conta não existe', async () => {
      (bankAccountRepository.findById as jest.Mock).mockResolvedValue(null);
      
      await expect(
        bankAccountService.calculateBalance(mockTenantId, mockAccountId)
      ).rejects.toThrow('Conta não encontrada');
    });
  });
  
  describe('closeAccount', () => {
    it('deve fechar conta com saldo zero', async () => {
      const mockAccount = {
        accountId: mockAccountId,
        status: 'active',
      };
      
      (bankAccountRepository.findById as jest.Mock).mockResolvedValue(mockAccount);
      (bankLedgerRepository.calculateBalance as jest.Mock).mockResolvedValue({ balance: 0 });
      
      await bankAccountService.closeAccount(mockTenantId, mockAccountId);
      
      expect(bankAccountRepository.close).toHaveBeenCalledWith(mockTenantId, mockAccountId);
    });
    
    it('deve rejeitar se saldo não é zero', async () => {
      const mockAccount = {
        accountId: mockAccountId,
        status: 'active',
      };
      
      (bankAccountRepository.findById as jest.Mock).mockResolvedValue(mockAccount);
      (bankLedgerRepository.calculateBalance as jest.Mock).mockResolvedValue({ balance: 10000 });
      
      await expect(
        bankAccountService.closeAccount(mockTenantId, mockAccountId)
      ).rejects.toThrow('Conta só pode ser fechada com saldo zero');
    });
  });
});
```

---

### Tarefa 4.2: Testes de Integração - Ledger

**Arquivo:** `backend/src/modules/bank/__tests__/bank-ledger.integration.test.ts`

```typescript
// src/modules/bank/__tests__/bank-ledger.integration.test.ts

import { bankAccountService } from '../bank-account.service';
import { bankLedgerRepository } from '../bank-ledger.repository';

describe('BankLedger Integration', () => {
  let tenantId: string;
  let account1: any;
  let account2: any;
  
  beforeAll(async () => {
    // Setup test tenant e contas
    tenantId = 'test-tenant-' + Date.now();
    
    account1 = await bankAccountService.createAccount({
      tenantId,
      ownerType: 'user',
      ownerId: 'user-1',
      accountType: 'personal',
    });
    
    account2 = await bankAccountService.createAccount({
      tenantId,
      ownerType: 'user',
      ownerId: 'user-2',
      accountType: 'personal',
    });
  });
  
  it('deve criar entrada e calcular saldo correto', async () => {
    // Depositar 10000 centavos na conta 1
    await bankLedgerRepository.createEntry({
      tenantId,
      toAccountId: account1.accountId,
      amountCents: 10000,
      transactionType: 'deposit',
      description: 'Depósito inicial',
    });
    
    // Calcular saldo
    const balance1 = await bankLedgerRepository.calculateBalance(tenantId, account1.accountId);
    expect(balance1.balance).toBe(10000);
  });
  
  it('deve processar transferência entre contas', async () => {
    // Transferir 5000 centavos de conta1 para conta2
    await bankLedgerRepository.createEntry({
      tenantId,
      fromAccountId: account1.accountId,
      toAccountId: account2.accountId,
      amountCents: 5000,
      transactionType: 'transfer',
      description: 'Transferência teste',
    });
    
    // Verificar saldos
    const balance1 = await bankLedgerRepository.calculateBalance(tenantId, account1.accountId);
    const balance2 = await bankLedgerRepository.calculateBalance(tenantId, account2.accountId);
    
    expect(balance1.balance).toBe(5000); // 10000 - 5000
    expect(balance2.balance).toBe(5000); // 0 + 5000
  });
  
  it('deve reverter transação corretamente', async () => {
    // Criar entrada
    const entry = await bankLedgerRepository.createEntry({
      tenantId,
      fromAccountId: account1.accountId,
      toAccountId: account2.accountId,
      amountCents: 2000,
      transactionType: 'transfer',
    });
    
    // Reverter (criar entrada inversa)
    await bankLedgerRepository.createEntry({
      tenantId,
      fromAccountId: account2.accountId, // Invertido
      toAccountId: account1.accountId,   // Invertido
      amountCents: 2000,
      transactionType: 'refund',
      reverses: entry.entryId,
    });
    
    // Verificar saldos voltaram ao estado anterior
    const balance1 = await bankLedgerRepository.calculateBalance(tenantId, account1.accountId);
    const balance2 = await bankLedgerRepository.calculateBalance(tenantId, account2.accountId);
    
    expect(balance1.balance).toBe(5000); // Voltou ao estado anterior
    expect(balance2.balance).toBe(5000);
  });
  
  it('deve manter integridade em múltiplas transações', async () => {
    // Executar 10 transações
    for (let i = 0; i < 10; i++) {
      await bankLedgerRepository.createEntry({
        tenantId,
        fromAccountId: account1.accountId,
        toAccountId: account2.accountId,
        amountCents: 100,
        transactionType: 'transfer',
      });
    }
    
    // Verificar saldos
    const balance1 = await bankLedgerRepository.calculateBalance(tenantId, account1.accountId);
    const balance2 = await bankLedgerRepository.calculateBalance(tenantId, account2.accountId);
    
    expect(balance1.balance).toBe(4000); // 5000 - (10 * 100)
    expect(balance2.balance).toBe(6000); // 5000 + (10 * 100)
    
    // Verificar que soma é constante
    expect(balance1.balance + balance2.balance).toBe(10000);
  });
});
```

---

## CHECKLIST SPRINT 1

```
[DIA 1] Migrations + Schema
[ ] 1.1 Migration 130: bank_accounts
[ ] 1.2 Migration 131: bank_ledger
[ ] 1.3 Migration 132: bank_transactions
[ ] 1.4 Migration 133: bank_splits
[ ] 1.5 Migration 134: system accounts
[ ] Teste manual: Contas criadas automaticamente

[DIA 2] Repositories
[ ] 2.1 Types & DTOs
[ ] 2.2 BankAccountRepository
[ ] 2.3 BankLedgerRepository
[ ] Teste manual: CRUD funciona

[DIA 3] Services
[ ] 3.1 BankAccountService
[ ] Teste manual: findOrCreate funciona
[ ] Teste manual: calculateBalance funciona

[DIA 4-5] Testes
[ ] 4.1 Testes unitários: BankAccountService
[ ] 4.2 Testes integração: Ledger
[ ] Todos testes passando
[ ] Cobertura >80%

[VALIDAÇÃO FINAL]
[ ] Migrations rodam sem erro
[ ] Contas do sistema criadas automaticamente
[ ] Saldo calculado corretamente do ledger
[ ] Ledger é imutável (sem UPDATE/DELETE)
[ ] Testes passam
[ ] Código documentado
```

---

## CRITÉRIO DE SUCESSO

**Sprint 1 está completa quando:**

1. ✅ Tabelas criadas (4 migrations rodaram)
2. ✅ Contas do sistema existem (fee, regional_fund, reserve, escrow)
3. ✅ Conta pode ser criada programaticamente
4. ✅ Ledger aceita entradas
5. ✅ Saldo é calculado SEMPRE do ledger (não de cache)
6. ✅ Testes unitários passam (>80% cobertura)
7. ✅ Testes integração passam
8. ✅ **Os números batem** (soma de créditos - débitos = saldo)

**Bloqueador:** NENHUM  
**Próximo:** Sprint 2 (Transações + Split)  

---

**Status:** ✅ EXECUTÁVEL  
**Estimativa:** 5 dias úteis  
**Risco:** BAIXO (fundação sólida, sem lógica complexa)  

**Este é o alicerce. Tudo o resto depende disso estar certo.** 🏗️
