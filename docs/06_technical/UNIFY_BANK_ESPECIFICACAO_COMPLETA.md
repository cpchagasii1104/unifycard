# UNIFY BANK - NÚCLEO FINANCEIRO OPERANTE
## Motor Econômico Central - Especificação Técnica Completa

**Data:** 12 de Janeiro de 2026  
**Status:** EXECUTÁVEL  
**Prioridade:** P0 (bloqueia tudo)  
**Estimativa:** 3-4 semanas  

---

## CONCEITO CENTRAL

### O que é Unify Bank

```
Unify Bank NÃO é:
❌ Banco real regulado
❌ Fintech com licença
❌ Intermediador financeiro

Unify Bank É:
✅ Livro-razão (ledger) imutável
✅ Sistema de contas virtuais
✅ Motor de split automático
✅ Fonte única de verdade econômica
✅ Ponte entre módulos e dinheiro
```

**Analogia:**
- Stripe = processamento de pagamentos
- PayPal = carteira digital
- **Unify Bank = contabilidade sistêmica interna**

---

## ARQUITETURA

### Modelo de Dados

#### 1. Tabela: `bank_accounts`

```sql
CREATE TABLE bank_accounts (
  account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Dono da conta
  owner_type VARCHAR(20) NOT NULL, -- user, group, event, system
  owner_id UUID NOT NULL,
  
  -- Tipo de conta
  account_type VARCHAR(20) NOT NULL, -- personal, business, system, escrow
  
  -- Moeda
  currency VARCHAR(3) NOT NULL DEFAULT 'MFI',
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, frozen, closed
  
  -- Saldo (DERIVADO, não autoritativo)
  cached_balance_cents BIGINT DEFAULT 0,
  last_balance_update TIMESTAMPTZ,
  
  -- Limites (opcional)
  daily_limit_cents BIGINT,
  transaction_limit_cents BIGINT,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT bank_accounts_owner_unique UNIQUE(tenant_id, owner_type, owner_id, currency),
  CONSTRAINT bank_accounts_balance_check CHECK(cached_balance_cents >= 0)
);

-- Índices
CREATE INDEX idx_bank_accounts_owner ON bank_accounts(owner_type, owner_id);
CREATE INDEX idx_bank_accounts_status ON bank_accounts(status);
CREATE INDEX idx_bank_accounts_tenant ON bank_accounts(tenant_id);
```

**Regras:**
- 1 conta por (owner_type, owner_id, currency)
- Saldo NUNCA é atualizado diretamente
- Saldo é SEMPRE derivado do ledger
- `cached_balance_cents` é cache apenas (pode rebuild)

---

#### 2. Tabela: `bank_ledger`

```sql
CREATE TABLE bank_ledger (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Timestamp
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Conta origem
  from_account_id UUID REFERENCES bank_accounts(account_id),
  
  -- Conta destino
  to_account_id UUID NOT NULL REFERENCES bank_accounts(account_id),
  
  -- Valor (sempre positivo)
  amount_cents BIGINT NOT NULL,
  
  -- Moeda
  currency VARCHAR(3) NOT NULL DEFAULT 'MFI',
  
  -- Tipo de transação
  transaction_type VARCHAR(50) NOT NULL,
  -- Valores: deposit, withdrawal, transfer, payment, refund, split, fee, fund
  
  -- Referência externa
  reference_type VARCHAR(50), -- event, booking, service, etc
  reference_id UUID,
  
  -- Descrição
  description TEXT,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'completed', -- pending, completed, failed, reversed
  
  -- Reversão
  reversed_by UUID REFERENCES bank_ledger(entry_id),
  reverses UUID REFERENCES bank_ledger(entry_id),
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  -- Constraints
  CONSTRAINT bank_ledger_amount_positive CHECK(amount_cents > 0),
  CONSTRAINT bank_ledger_different_accounts CHECK(from_account_id IS NULL OR from_account_id != to_account_id)
);

-- Índices
CREATE INDEX idx_bank_ledger_timestamp ON bank_ledger(timestamp DESC);
CREATE INDEX idx_bank_ledger_from ON bank_ledger(from_account_id);
CREATE INDEX idx_bank_ledger_to ON bank_ledger(to_account_id);
CREATE INDEX idx_bank_ledger_reference ON bank_ledger(reference_type, reference_id);
CREATE INDEX idx_bank_ledger_status ON bank_ledger(status);
CREATE INDEX idx_bank_ledger_tenant ON bank_ledger(tenant_id);
```

**Regras:**
- Entradas são IMUTÁVEIS (never UPDATE)
- Reversão cria nova entrada (com `reverses`)
- `from_account_id` NULL = depósito externo
- `to_account_id` sempre presente
- Cada entrada = movimento atômico

---

#### 3. Tabela: `bank_transactions`

```sql
CREATE TABLE bank_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Timestamp
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Tipo
  transaction_type VARCHAR(50) NOT NULL,
  -- payment, ticket_purchase, service_booking, transfer, deposit, withdrawal
  
  -- Valor total
  total_amount_cents BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'MFI',
  
  -- Pagador
  payer_account_id UUID NOT NULL REFERENCES bank_accounts(account_id),
  
  -- Receptor principal
  recipient_account_id UUID NOT NULL REFERENCES bank_accounts(account_id),
  
  -- Referência externa
  reference_type VARCHAR(50), -- event, booking, service, etc
  reference_id UUID,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending, processing, completed, failed, reversed
  
  -- Splits (se aplicável)
  has_splits BOOLEAN DEFAULT false,
  
  -- Descrição
  description TEXT,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT bank_transactions_amount_positive CHECK(total_amount_cents > 0)
);

-- Índices
CREATE INDEX idx_bank_transactions_timestamp ON bank_transactions(timestamp DESC);
CREATE INDEX idx_bank_transactions_payer ON bank_transactions(payer_account_id);
CREATE INDEX idx_bank_transactions_recipient ON bank_transactions(recipient_account_id);
CREATE INDEX idx_bank_transactions_reference ON bank_transactions(reference_type, reference_id);
CREATE INDEX idx_bank_transactions_status ON bank_transactions(status);
```

**Função:**
- Agrupa múltiplas entradas do ledger
- Representa operação do ponto de vista do usuário
- 1 transaction = 1+ ledger entries (com splits)

---

#### 4. Tabela: `bank_splits`

```sql
CREATE TABLE bank_splits (
  split_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Transação pai
  transaction_id UUID NOT NULL REFERENCES bank_transactions(transaction_id),
  
  -- Entrada do ledger correspondente
  ledger_entry_id UUID NOT NULL REFERENCES bank_ledger(entry_id),
  
  -- Receptor
  recipient_account_id UUID NOT NULL REFERENCES bank_accounts(account_id),
  
  -- Valor
  amount_cents BIGINT NOT NULL,
  
  -- Tipo de split
  split_type VARCHAR(50) NOT NULL,
  -- recipient, system_fee, regional_fund, platform, other
  
  -- Porcentagem original (opcional)
  percentage NUMERIC(5,2),
  
  -- Descrição
  description TEXT,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT bank_splits_amount_positive CHECK(amount_cents > 0)
);

-- Índices
CREATE INDEX idx_bank_splits_transaction ON bank_splits(transaction_id);
CREATE INDEX idx_bank_splits_recipient ON bank_splits(recipient_account_id);
CREATE INDEX idx_bank_splits_type ON bank_splits(split_type);
```

**Função:**
- Detalha como uma transação foi dividida
- Auditoria de splits
- Relatórios de taxas/fundos

---

### Contas do Sistema (Especiais)

```sql
-- Contas criadas automaticamente por tenant

1. system:fee (taxa administrativa)
   - Recebe splits de taxas
   - Balance = receita total do sistema

2. system:regional_fund (fundo regional)
   - Recebe splits de fundo
   - Balance = total disponível para projetos

3. system:reserve (reserva emergencial)
   - Recebe parte das taxas
   - Nunca diminui (só cresce)

4. system:escrow (custódia)
   - Retenções temporárias
   - Pagamentos em disputa
   - Saldo deve tender a zero
```

---

## LÓGICA DE NEGÓCIO

### Serviço: BankAccountService

```typescript
interface BankAccountService {
  // Criar conta
  createAccount(params: {
    tenantId: string;
    ownerType: 'user' | 'group' | 'event' | 'system';
    ownerId: string;
    accountType: 'personal' | 'business' | 'system' | 'escrow';
    currency?: string;
  }): Promise<BankAccount>;
  
  // Buscar ou criar conta (idempotente)
  findOrCreateAccount(params: {
    tenantId: string;
    ownerType: string;
    ownerId: string;
    currency?: string;
  }): Promise<BankAccount>;
  
  // Calcular saldo real (do ledger)
  calculateBalance(accountId: string): Promise<{
    balance: number;
    lastTransaction: Date;
  }>;
  
  // Atualizar cache de saldo
  refreshBalanceCache(accountId: string): Promise<void>;
  
  // Obter extrato
  getStatement(accountId: string, params: {
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<LedgerEntry[]>;
  
  // Congelar conta
  freezeAccount(accountId: string, reason: string): Promise<void>;
  
  // Descongelar conta
  unfreezeAccount(accountId: string): Promise<void>;
  
  // Fechar conta
  closeAccount(accountId: string): Promise<void>;
}
```

---

### Serviço: BankTransactionService

```typescript
interface BankTransactionService {
  // Criar transação simples (sem split)
  createSimpleTransaction(params: {
    tenantId: string;
    transactionType: string;
    fromAccountId: string;
    toAccountId: string;
    amountCents: number;
    currency?: string;
    referenceType?: string;
    referenceId?: string;
    description?: string;
    metadata?: any;
  }): Promise<Transaction>;
  
  // Criar transação com split
  createTransactionWithSplit(params: {
    tenantId: string;
    transactionType: string;
    payerAccountId: string;
    recipientAccountId: string;
    totalAmountCents: number;
    currency?: string;
    splits: Array<{
      recipientAccountId: string;
      amountCents?: number;
      percentage?: number;
      splitType: string;
      description?: string;
    }>;
    referenceType?: string;
    referenceId?: string;
    description?: string;
    metadata?: any;
  }): Promise<Transaction>;
  
  // Reverter transação
  reverseTransaction(transactionId: string, reason: string): Promise<Transaction>;
  
  // Obter detalhes da transação
  getTransaction(transactionId: string): Promise<{
    transaction: Transaction;
    ledgerEntries: LedgerEntry[];
    splits: Split[];
  }>;
  
  // Listar transações
  listTransactions(params: {
    tenantId: string;
    accountId?: string;
    status?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<Transaction[]>;
}
```

---

### Regras de Split (Automático)

#### Evento (Ingresso)

```typescript
// Exemplo: Ingresso R$ 100,00 (10.000 centavos)

Total: 10.000 centavos
├─ 9.700 (97%) → Organizador do evento
├─ 180 (1.8%) → Taxa administrativa
│  ├─ 72 (40%) → system:fee (infraestrutura)
│  ├─ 54 (30%) → system:regional_fund
│  ├─ 36 (20%) → system:fee (desenvolvimento)
│  └─ 18 (10%) → system:reserve
└─ 120 (1.2%) → Espaço/venue (se aplicável)

Taxa total efetiva: 3%
Split automático: Sim
Configurável: Apenas o split com venue
```

**Código:**

```typescript
async function splitTicketPurchase(params: {
  eventId: string;
  totalAmountCents: number;
  organizerAccountId: string;
  venueAccountId?: string;
}) {
  const total = params.totalAmountCents;
  
  // Taxa administrativa 3%
  const feeAmount = Math.floor(total * 0.03);
  
  // Venue split (se aplicável)
  const venueAmount = params.venueAccountId 
    ? Math.floor(total * 0.012) // 1.2%
    : 0;
  
  // Organizador recebe o resto
  const organizerAmount = total - feeAmount - venueAmount;
  
  // Distribuição da taxa
  const feeDistribution = {
    infrastructure: Math.floor(feeAmount * 0.4),
    regionalFund: Math.floor(feeAmount * 0.3),
    development: Math.floor(feeAmount * 0.2),
    reserve: Math.floor(feeAmount * 0.1),
  };
  
  // Ajustar centavos perdidos no arredondamento (vai para reserve)
  const totalDistributed = 
    feeDistribution.infrastructure +
    feeDistribution.regionalFund +
    feeDistribution.development +
    feeDistribution.reserve;
  
  feeDistribution.reserve += (feeAmount - totalDistributed);
  
  return {
    organizerAmount,
    venueAmount,
    feeDistribution,
  };
}
```

---

#### Serviço (Agendamento)

```typescript
// Exemplo: Consulta R$ 200,00 (20.000 centavos)

Total: 20.000 centavos
├─ 19.400 (97%) → Prestador do serviço
└─ 600 (3%) → Taxa administrativa
   ├─ 240 (40%) → system:fee
   ├─ 180 (30%) → system:regional_fund
   ├─ 120 (20%) → system:fee
   └─ 60 (10%) → system:reserve

Taxa total efetiva: 3%
Split automático: Sim
Configurável: Não (simples)
```

---

#### Transferência P2P

```typescript
// Exemplo: Usuário A envia R$ 50,00 para Usuário B

Total: 5.000 centavos
└─ 5.000 (100%) → Usuário B

Taxa: 0%
Split: Não aplicável
Motivação: Incentivar economia interna
```

---

#### Grupo (Contribuição)

```typescript
// Exemplo: Membro contribui R$ 100,00 para grupo

Total: 10.000 centavos
└─ 10.000 (100%) → Conta do grupo

Taxa: 0%
Split: Não aplicável
Motivação: Não taxar organização comunitária
```

---

## FLUXOS DE INTEGRAÇÃO

### Evento → Compra de Ingresso

```typescript
// 1. Usuário clica "Comprar Ingresso"
// Frontend chama: POST /events/:eventId/purchase

// 2. Backend (events.service.ts)
async function purchaseTicket(params: {
  eventId: string;
  userId: string;
  quantity: number;
}) {
  // 2.1 Validar evento
  const event = await eventsService.getEvent(params.eventId);
  if (!event) throw new Error('Evento não encontrado');
  if (event.status !== 'published') throw new Error('Evento não disponível');
  
  // 2.2 Verificar disponibilidade
  const availability = await checkAvailability(params.eventId, params.quantity);
  if (!availability.available) throw new Error('Sem vagas');
  
  // 2.3 Calcular valor
  const totalAmount = event.ticketPriceCents * params.quantity;
  
  // 2.4 Obter/criar contas
  const buyerAccount = await bankAccountService.findOrCreateAccount({
    tenantId: event.tenantId,
    ownerType: 'user',
    ownerId: params.userId,
  });
  
  const eventAccount = await bankAccountService.findOrCreateAccount({
    tenantId: event.tenantId,
    ownerType: 'event',
    ownerId: params.eventId,
  });
  
  // 2.5 Criar transação com split
  const transaction = await bankTransactionService.createTransactionWithSplit({
    tenantId: event.tenantId,
    transactionType: 'ticket_purchase',
    payerAccountId: buyerAccount.accountId,
    recipientAccountId: eventAccount.accountId,
    totalAmountCents: totalAmount,
    splits: await calculateEventSplits(event, totalAmount),
    referenceType: 'event',
    referenceId: params.eventId,
    description: `Ingresso - ${event.title}`,
  });
  
  // 2.6 Criar registro de participante
  await eventAttendeesService.create({
    eventId: params.eventId,
    userId: params.userId,
    quantity: params.quantity,
    transactionId: transaction.transactionId,
  });
  
  return { transaction, event };
}
```

---

### Serviço → Agendamento

```typescript
// 1. Usuário agenda serviço
// Frontend chama: POST /bookings

// 2. Backend (bookings.service.ts)
async function createBooking(params: {
  serviceId: string;
  availabilityId: string;
  requesterId: string;
}) {
  // 2.1 Validar serviço e disponibilidade
  const service = await servicesService.getService(params.serviceId);
  const availability = await availabilityService.get(params.availabilityId);
  
  // 2.2 Criar booking (status: requested)
  const booking = await bookingsRepository.create({
    serviceId: params.serviceId,
    availabilityId: params.availabilityId,
    requesterId: params.requesterId,
    status: 'requested',
  });
  
  return { booking, requiresPayment: service.priceCents > 0 };
}

// 3. Prestador aceita
async function acceptBooking(bookingId: string) {
  const booking = await bookingsRepository.findById(bookingId);
  const service = await servicesService.getService(booking.serviceId);
  
  // 3.1 Atualizar status
  await bookingsRepository.update(bookingId, { status: 'confirmed' });
  
  // 3.2 Se serviço é pago, criar transação
  if (service.priceCents > 0) {
    const requesterAccount = await bankAccountService.findOrCreateAccount({
      tenantId: booking.tenantId,
      ownerType: 'user',
      ownerId: booking.requesterId,
    });
    
    const providerAccount = await bankAccountService.findOrCreateAccount({
      tenantId: booking.tenantId,
      ownerType: 'user',
      ownerId: service.providerId,
    });
    
    const transaction = await bankTransactionService.createTransactionWithSplit({
      tenantId: booking.tenantId,
      transactionType: 'service_booking',
      payerAccountId: requesterAccount.accountId,
      recipientAccountId: providerAccount.accountId,
      totalAmountCents: service.priceCents,
      splits: await calculateServiceSplits(service.priceCents),
      referenceType: 'booking',
      referenceId: bookingId,
      description: `Serviço - ${service.title}`,
    });
    
    await bookingsRepository.update(bookingId, {
      transactionId: transaction.transactionId,
    });
  }
  
  return booking;
}
```

---

### Grupo → Contribuição

```typescript
// 1. Membro contribui para grupo
// Frontend chama: POST /groups/:groupId/contribute

async function contributeToGroup(params: {
  groupId: string;
  userId: string;
  amountCents: number;
}) {
  // 1.1 Validar grupo e membro
  const group = await groupsService.getGroup(params.groupId);
  const isMember = await groupsService.isMember(params.groupId, params.userId);
  if (!isMember) throw new Error('Usuário não é membro');
  
  // 1.2 Obter contas
  const userAccount = await bankAccountService.findOrCreateAccount({
    tenantId: group.tenantId,
    ownerType: 'user',
    ownerId: params.userId,
  });
  
  const groupAccount = await bankAccountService.findOrCreateAccount({
    tenantId: group.tenantId,
    ownerType: 'group',
    ownerId: params.groupId,
  });
  
  // 1.3 Criar transação (SEM taxa)
  const transaction = await bankTransactionService.createSimpleTransaction({
    tenantId: group.tenantId,
    transactionType: 'group_contribution',
    fromAccountId: userAccount.accountId,
    toAccountId: groupAccount.accountId,
    amountCents: params.amountCents,
    referenceType: 'group',
    referenceId: params.groupId,
    description: `Contribuição - ${group.name}`,
  });
  
  return { transaction, group };
}
```

---

## ENDPOINTS DA API

### Contas

```typescript
// Obter conta do usuário logado
GET /api/bank/accounts/me
Response: {
  accountId: string;
  balance: number;
  currency: string;
  lastTransaction: string;
}

// Obter extrato
GET /api/bank/accounts/me/statement?from=2026-01-01&to=2026-01-31&limit=50
Response: {
  entries: Array<{
    entryId: string;
    timestamp: string;
    type: string;
    amount: number;
    from: string | null;
    to: string;
    description: string;
    referenceType: string;
    referenceId: string;
  }>;
  total: number;
}

// Obter conta de entidade (evento, grupo)
GET /api/bank/accounts/:ownerType/:ownerId
Response: { ... }
```

---

### Transações

```typescript
// Transferir para outro usuário (P2P)
POST /api/bank/transactions/transfer
Body: {
  toUserId: string;
  amountCents: number;
  description?: string;
}
Response: {
  transactionId: string;
  status: string;
}

// Obter detalhes da transação
GET /api/bank/transactions/:transactionId
Response: {
  transaction: { ... };
  ledgerEntries: [ ... ];
  splits: [ ... ];
}

// Listar transações do usuário
GET /api/bank/transactions/me?from=2026-01-01&limit=20
Response: {
  transactions: [ ... ];
  total: number;
}
```

---

### Sistema (Admin/Reports)

```typescript
// Relatório de taxas coletadas
GET /api/bank/system/fees?from=2026-01-01&to=2026-01-31
Response: {
  totalCollected: number;
  distribution: {
    infrastructure: number;
    regionalFund: number;
    development: number;
    reserve: number;
  };
}

// Saldo do fundo regional
GET /api/bank/system/regional-fund
Response: {
  balance: number;
  lastContribution: string;
  projectsCount: number;
}
```

---

## TESTES OBRIGATÓRIOS

### Unidade

```typescript
describe('BankTransactionService', () => {
  it('deve criar transação simples', async () => {
    const tx = await service.createSimpleTransaction({
      tenantId: 'tenant-1',
      transactionType: 'transfer',
      fromAccountId: 'account-a',
      toAccountId: 'account-b',
      amountCents: 10000,
    });
    
    expect(tx.status).toBe('completed');
    expect(tx.totalAmountCents).toBe(10000);
  });
  
  it('deve criar transação com split', async () => {
    const tx = await service.createTransactionWithSplit({
      tenantId: 'tenant-1',
      transactionType: 'ticket_purchase',
      payerAccountId: 'buyer',
      recipientAccountId: 'organizer',
      totalAmountCents: 10000,
      splits: [
        { recipientAccountId: 'system-fee', percentage: 3 },
        { recipientAccountId: 'organizer', percentage: 97 },
      ],
    });
    
    expect(tx.has_splits).toBe(true);
    
    const splits = await service.getSplits(tx.transactionId);
    expect(splits).toHaveLength(2);
    expect(splits.find(s => s.recipientAccountId === 'system-fee').amountCents).toBe(300);
    expect(splits.find(s => s.recipientAccountId === 'organizer').amountCents).toBe(9700);
  });
  
  it('deve reverter transação', async () => {
    const tx = await service.createSimpleTransaction({ ... });
    const reversed = await service.reverseTransaction(tx.transactionId, 'cancelamento');
    
    expect(reversed.status).toBe('reversed');
    
    const balanceA = await accountService.calculateBalance('account-a');
    const balanceB = await accountService.calculateBalance('account-b');
    
    expect(balanceA.balance).toBe(initialBalanceA);
    expect(balanceB.balance).toBe(initialBalanceB);
  });
  
  it('deve rejeitar saldo negativo', async () => {
    await expect(
      service.createSimpleTransaction({
        fromAccountId: 'empty-account', // saldo = 0
        toAccountId: 'account-b',
        amountCents: 10000,
      })
    ).rejects.toThrow('Saldo insuficiente');
  });
});
```

---

### Integração

```typescript
describe('Evento → Compra Ingresso → Split', () => {
  it('deve processar compra com split correto', async () => {
    // Setup
    const event = await createTestEvent({ ticketPriceCents: 10000 });
    const buyer = await createTestUser();
    await fundAccount(buyer.accountId, 20000); // Depositar saldo fictício
    
    // Execute
    const result = await purchaseTicket({
      eventId: event.id,
      userId: buyer.id,
      quantity: 1,
    });
    
    // Assert
    expect(result.transaction.status).toBe('completed');
    
    // Verificar saldos
    const buyerBalance = await getBalance(buyer.accountId);
    const organizerBalance = await getBalance(event.organizerAccountId);
    const feeBalance = await getBalance('system-fee');
    const fundBalance = await getBalance('system-regional-fund');
    
    expect(buyerBalance).toBe(10000); // 20000 - 10000
    expect(organizerBalance).toBe(9700); // 97%
    expect(feeBalance).toBe(210); // 2.1% (40% + 20% da taxa)
    expect(fundBalance).toBe(90); // 0.9% (30% da taxa)
  });
});
```

---

## DASHBOARD/UI

### Carteira do Usuário

```tsx
<Wallet>
  <Balance>
    <Value>R$ 487,50</Value>
    <Currency>MFI</Currency>
  </Balance>
  
  <Actions>
    <Button>Transferir</Button>
    <Button>Extrato</Button>
  </Actions>
  
  <RecentTransactions>
    {transactions.map(tx => (
      <TransactionItem key={tx.id}>
        <Icon type={tx.type} />
        <Info>
          <Description>{tx.description}</Description>
          <Date>{formatDate(tx.timestamp)}</Date>
        </Info>
        <Amount negative={tx.fromMe}>
          {tx.fromMe ? '-' : '+'} R$ {tx.amount / 100}
        </Amount>
      </TransactionItem>
    ))}
  </RecentTransactions>
</Wallet>
```

---

### Dashboard do Evento (Organizador)

```tsx
<EventFinancials>
  <Summary>
    <Stat>
      <Label>Total Coletado</Label>
      <Value>R$ {totalCollected / 100}</Value>
    </Stat>
    
    <Stat>
      <Label>Líquido (após taxas)</Label>
      <Value>R$ {netAmount / 100}</Value>
    </Stat>
    
    <Stat>
      <Label>Taxa Sistema</Label>
      <Value>R$ {feeAmount / 100} (3%)</Value>
    </Stat>
  </Summary>
  
  <Breakdown>
    <h3>Distribuição</h3>
    <Item>
      <Label>Você (organizador)</Label>
      <Value>R$ {organizerAmount / 100}</Value>
      <Percentage>97%</Percentage>
    </Item>
    
    <Item>
      <Label>Taxa Administrativa</Label>
      <Value>R$ {feeAmount / 100}</Value>
      <Percentage>3%</Percentage>
    </Item>
  </Breakdown>
  
  <TransactionsList>
    <h3>Transações</h3>
    {transactions.map(tx => (
      <Transaction key={tx.id}>
        <User>{tx.buyerName}</User>
        <Description>{tx.ticketsCount} ingresso(s)</Description>
        <Amount>R$ {tx.amount / 100}</Amount>
        <Date>{formatDate(tx.timestamp)}</Date>
      </Transaction>
    ))}
  </TransactionsList>
</EventFinancials>
```

---

## SEGURANÇA

### Validações

```typescript
// Antes de QUALQUER transação
async function validateTransaction(params: {
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
}) {
  // 1. Contas existem?
  const fromAccount = await accountService.get(params.fromAccountId);
  const toAccount = await accountService.get(params.toAccountId);
  
  if (!fromAccount || !toAccount) {
    throw new Error('Conta não encontrada');
  }
  
  // 2. Contas ativas?
  if (fromAccount.status !== 'active') {
    throw new Error('Conta de origem não está ativa');
  }
  
  if (toAccount.status !== 'active') {
    throw new Error('Conta de destino não está ativa');
  }
  
  // 3. Valor válido?
  if (params.amountCents <= 0) {
    throw new Error('Valor inválido');
  }
  
  // 4. Saldo suficiente?
  const balance = await accountService.calculateBalance(params.fromAccountId);
  if (balance.balance < params.amountCents) {
    throw new Error('Saldo insuficiente');
  }
  
  // 5. Limites?
  if (fromAccount.transactionLimitCents && params.amountCents > fromAccount.transactionLimitCents) {
    throw new Error('Valor excede limite de transação');
  }
  
  return true;
}
```

---

### Autorização

```typescript
// Antes de ACESSAR qualquer conta
async function authorizeAccountAccess(params: {
  userId: string;
  accountId: string;
  action: 'read' | 'write';
}) {
  const account = await accountService.get(params.accountId);
  
  // Sistema pode acessar qualquer conta (read)
  if (params.action === 'read' && isSystemUser(params.userId)) {
    return true;
  }
  
  // Usuário pode acessar sua própria conta
  if (account.ownerType === 'user' && account.ownerId === params.userId) {
    return true;
  }
  
  // Admin de grupo pode acessar conta do grupo
  if (account.ownerType === 'group') {
    const isAdmin = await groupsService.isAdmin(account.ownerId, params.userId);
    if (isAdmin) return true;
  }
  
  // Organizador pode acessar conta do evento
  if (account.ownerType === 'event') {
    const event = await eventsService.getEvent(account.ownerId);
    if (event.organizerId === params.userId) return true;
  }
  
  throw new Error('Não autorizado');
}
```

---

### Auditoria

```typescript
// Log de TODAS as operações sensíveis
async function logBankOperation(params: {
  operationType: string;
  userId: string;
  accountId?: string;
  transactionId?: string;
  metadata?: any;
}) {
  await auditLogRepository.create({
    timestamp: new Date(),
    operationType: params.operationType,
    userId: params.userId,
    accountId: params.accountId,
    transactionId: params.transactionId,
    metadata: params.metadata,
  });
}

// Exemplos de logs:
// - account_accessed
// - transaction_created
// - transaction_reversed
// - balance_calculated
// - account_frozen
```

---

## MIGRAÇÃO

### Migration: Criar tabelas

```sql
-- migrations/130_create_bank_tables.sql

BEGIN;

-- 1. Contas
CREATE TABLE bank_accounts ( ... );

-- 2. Ledger
CREATE TABLE bank_ledger ( ... );

-- 3. Transações
CREATE TABLE bank_transactions ( ... );

-- 4. Splits
CREATE TABLE bank_splits ( ... );

-- 5. Criar contas do sistema para cada tenant
INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, account_type, currency)
SELECT 
  id as tenant_id,
  'system' as owner_type,
  'fee' as owner_id,
  'system' as account_type,
  'MFI' as currency
FROM tenants;

-- Repetir para: regional_fund, reserve, escrow

COMMIT;
```

---

### Seed: Dados de teste

```typescript
// seeds/bank-test-data.ts

async function seedBankTestData() {
  const tenant = await getTenant('default');
  
  // Criar contas de teste
  const accounts = await Promise.all([
    createAccount({ ownerType: 'user', ownerId: 'user-1' }),
    createAccount({ ownerType: 'user', ownerId: 'user-2' }),
    createAccount({ ownerType: 'event', ownerId: 'event-1' }),
    createAccount({ ownerType: 'group', ownerId: 'group-1' }),
  ]);
  
  // Depositar saldo fictício
  await Promise.all(
    accounts.slice(0, 2).map(acc =>
      createLedgerEntry({
        toAccountId: acc.accountId,
        amountCents: 100000, // R$ 1.000,00
        transactionType: 'deposit',
        description: 'Saldo inicial (teste)',
      })
    )
  );
  
  // Criar transações de exemplo
  await createSimpleTransaction({
    fromAccountId: accounts[0].accountId,
    toAccountId: accounts[1].accountId,
    amountCents: 5000,
    description: 'Transferência de teste',
  });
}
```

---

## ORDEM DE IMPLEMENTAÇÃO

### Sprint 1 (Semana 1): Fundação

```
[ ] Migration 130: Criar tabelas
[ ] BankAccountService: CRUD básico
[ ] BankAccountService: calculateBalance()
[ ] Testes unitários: BankAccountService
[ ] Seed: Criar contas do sistema
[ ] Seed: Dados de teste
```

---

### Sprint 2 (Semana 2): Transações

```
[ ] BankTransactionService: createSimpleTransaction()
[ ] BankTransactionService: createTransactionWithSplit()
[ ] BankTransactionService: reverseTransaction()
[ ] Lógica de split: calculateEventSplits()
[ ] Lógica de split: calculateServiceSplits()
[ ] Testes unitários: BankTransactionService
[ ] Testes integração: Fluxo completo simples
```

---

### Sprint 3 (Semana 3): Integração

```
[ ] Eventos: Integrar purchaseTicket() com banco
[ ] Serviços: Integrar acceptBooking() com banco
[ ] Grupos: Integrar contributeToGroup() com banco
[ ] Testes integração: Cada módulo
[ ] Validações e segurança
[ ] Auditoria e logs
```

---

### Sprint 4 (Semana 4): API e UI

```
[ ] Endpoints: /api/bank/accounts/*
[ ] Endpoints: /api/bank/transactions/*
[ ] Endpoints: /api/bank/system/*
[ ] Frontend: Componente Wallet
[ ] Frontend: Dashboard financeiro do evento
[ ] Frontend: Extrato de transações
[ ] Testes E2E: Fluxo completo com UI
```

---

## BLINDAGENS ÉTICAS (MANTIDAS)

```
✅ Todas as transações são auditáveis
✅ Ledger é imutável
✅ Saldo é sempre derivado (não inventado)
✅ Split é transparente e documentado
✅ Taxa administrativa limitada (3% máximo na fase)
✅ Fundo regional obrigatório (30% da taxa)
✅ Zero manipulação de valores
✅ Zero taxas ocultas
✅ Zero lock-in (usuário pode sair e levar histórico)
```

---

## DOCUMENTAÇÃO OBRIGATÓRIA

```
[ ] docs/UNIFY_BANK.md (este arquivo)
[ ] docs/BANK_API.md (endpoints detalhados)
[ ] docs/BANK_SPLITS.md (regras de split por tipo)
[ ] docs/BANK_SECURITY.md (autorizações e validações)
[ ] README do módulo bank/
[ ] JSDoc em todos os serviços
```

---

## CHECKLIST DE CONCLUSÃO

### Funcional
```
[ ] Contas criadas automaticamente
[ ] Transações simples funcionando
[ ] Transações com split funcionando
[ ] Reversões funcionando
[ ] Saldos calculados corretamente
[ ] Extrato exibindo histórico
```

### Integração
```
[ ] Eventos conectados ao banco
[ ] Serviços conectados ao banco
[ ] Grupos conectados ao banco
[ ] Splits automáticos funcionando
[ ] Taxa administrativa sendo coletada
[ ] Fundo regional acumulando
```

### Qualidade
```
[ ] Cobertura de testes >80%
[ ] Todas as validações implementadas
[ ] Autorização em todos os endpoints
[ ] Logs de auditoria funcionando
[ ] Documentação completa
[ ] Zero bugs críticos
```

### UI
```
[ ] Wallet exibindo saldo
[ ] Extrato de transações
[ ] Dashboard financeiro de evento
[ ] Dashboard financeiro de grupo
[ ] Transferência P2P funcional
```

---

**Status:** ✅ ESPECIFICAÇÃO COMPLETA  
**Pronto para:** IMPLEMENTAÇÃO IMEDIATA  
**Estimativa:** 3-4 semanas (4 sprints)  
**Bloqueador:** NENHUM  

**Este é o motor que tudo acopla. Sem ele, sistema não é sistema.** 🏦
