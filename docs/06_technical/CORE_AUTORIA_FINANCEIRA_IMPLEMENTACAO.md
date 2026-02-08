# CORE DE PERMISSÕES FINANCEIRAS — IMPLEMENTAÇÃO (FASE 1)

## STATUS CANONICAL · BINDING · CORE

Este documento define a **IMPLEMENTAÇÃO DE AUTORIA RASTREÁVEL E TRILHA DE DECISÃO** em operações financeiras do UnifiCard.

**Versão:** Fase 1 (Campos NULLABLE, Hard Fail no Código)  
**Data:** 2024  
**Próxima Fase:** Fase 2 (NOT NULL no banco, remoção de fallbacks)

---

## 1. PORQUÊ (RECEITA, AUDITORIA, RASTREABILIDADE)

### 1.1 Problema Identificado

Hoje o sistema autoriza operações financeiras, mas **não registra "quem fez"**. Isso é uma **violação institucional** porque:

1. **Receita:** Não é possível rastrear quem executou cada operação financeira
2. **Auditoria:** Impossível investigar transações suspeitas sem saber quem as executou
3. **Rastreabilidade:** Não há trilha de decisão (permissões, políticas) no momento da criação
4. **Separação dono/operador:** Não há distinção entre quem é dono da conta e quem executou a operação

### 1.2 Solução Implementada

**FASE 1:** Adicionar campos de autoria e trilha de decisão em:
- `bank_transactions`
- `bank_ledger`
- `bank_splits`

**Regras:**
- Campos são **NULLABLE** nesta fase (para backfill seguro)
- No código: **obrigatório preencher** para qualquer INSERT novo
- **Hard fail** no código se não fornecido (exceto jobs internos/system)
- Snapshots capturam estado da decisão no momento da criação

---

## 2. CAMPOS E SIGNIFICADO

### 2.1 Campos de Autoria

Cada tabela financeira (`bank_transactions`, `bank_ledger`, `bank_splits`) possui os seguintes campos:

#### `performed_by_user_id` (UUID, NULLABLE)
- **Significado:** ID do usuário que executou a operação (quem fez)
- **Valores:**
  - UUID do usuário que executou
  - `NULL` apenas para operações do sistema (authoritySource='system')
- **Exemplo:** `"550e8400-e29b-41d4-a716-446655440000"`

#### `acting_for_actor_id` (UUID, NULLABLE)
- **Significado:** ID do actor em nome do qual a operação foi executada (em nome de quem)
- **Valores:**
  - UUID do actor (user, page, group)
  - Geralmente o mesmo que o dono da conta origem
- **Exemplo:** `"actor-123"` (representa uma empresa, usuário ou grupo)

#### `acting_for_account_id` (UUID, NULLABLE na Fase 1, NOT NULL na Fase 2)
- **Significado:** ID da conta em nome da qual a operação foi executada
- **Valores:**
  - UUID da conta
  - **OBRIGATÓRIO** segundo o Core Canônico (autoria sempre vinculada a uma conta específica)
- **Nota Fase 1:**
  - Em Fase 1, o código pode inferir `acting_for_account_id` quando ausente (ex: do `from_account_id`).
  - Em Fase 2, este campo será NOT NULL e obrigatório em todos os fluxos.
- **Exemplo:** `"account-456"`

#### `authority_source` (VARCHAR(32), NULLABLE)
- **Significado:** Fonte da autoridade para executar a operação
- **Valores permitidos:**
  - `'ownership'`: Dono da conta (ownership direto)
  - `'delegation'`: Delegação explícita (via authorization service)
  - `'account_acl'`: Permissão explícita via ACL da conta
  - `'system'`: Operação do sistema (jobs, processos internos)
- **Exemplo:** `"delegation"`

#### `permission_snapshot` (JSONB, NULLABLE)
- **Significado:** Snapshot da decisão de permissão no momento da criação
- **Estrutura mínima:**
  ```json
  {
    "permissionKey": "manage_financial",
    "allowed": true,
    "reason": "Delegation active",
    "actorId": "actor-123",
    "userId": "user-456",
    "decidedAt": "2024-01-15T10:30:00Z"
  }
  ```
- **Campos obrigatórios:**
  - `permissionKey`: Chave da permissão verificada
  - `allowed`: Se a permissão foi concedida
  - `reason`: Motivo da decisão (opcional)
  - `actorId`: Actor verificado
  - `userId`: Usuário que solicitou
  - `decidedAt`: Timestamp ISO 8601 da decisão

#### `policy_snapshot` (JSONB, NULLABLE)
- **Significado:** Snapshot da resolução de policy no momento da criação
- **Estrutura mínima:**
  ```json
  {
    "policyKeyResolved": "split.service_booking.curitiba",
    "resolutionPath": [
      "split.service_booking.curitiba",
      "split.service_booking"
    ],
    "inputsUsed": {
      "cityId": "curitiba",
      "productType": "supermarket" // ⚠️ NOTA: category é DEPRECATED, use productType ou serviceType
    },
    "decidedAt": "2024-01-15T10:30:00Z"
  }
  ```
- **Se não houver policy neste fluxo:**
  ```json
  {
    "policyKeyResolved": null,
    "decidedAt": "2024-01-15T10:30:00Z"
  }
  ```

---

## 3. FLUXO CANÔNICO

### 3.1 Fluxo Completo

```
1. USER SOLICITA OPERAÇÃO
   └─> POST /bank/transfer
   └─> Body: { actingActorId: 'company-456', amount: 1000 }

2. VERIFICAR PERMISSÃO
   └─> authorizationService.canActAs(tenantId, userId, actorId, 'manage_financial')
   └─> Retorna: { allowed: true, authoritySource: 'delegation', reason: '...' }

3. CAPTURAR SNAPSHOT DE PERMISSÃO
   └─> permissionSnapshot = {
         permissionKey: 'manage_financial',
         allowed: true,
         reason: 'Delegation active',
         actorId: 'actor-123',
         userId: 'user-456',
         decidedAt: new Date().toISOString()
       }

4. RESOLVER POLICY (se aplicável)
   └─> bankPolicyService.resolveSplitPolicy(tenantId, context, metadata)
   └─> Retorna: SplitPolicy | null

5. CAPTURAR SNAPSHOT DE POLICY
   └─> policySnapshot = {
         policyKeyResolved: 'split.service_booking.curitiba',
         resolutionPath: ['split.service_booking.curitiba', 'split.service_booking'],
         inputsUsed: { cityId: 'curitiba', productType: 'supermarket' }, // ⚠️ NOTA: category é DEPRECATED
         decidedAt: new Date().toISOString()
       }

6. CRIAR CONTEXTO DE AUTORIA
   └─> authorship = {
         performedByUserId: userId,
         actingForActorId: actorId,
         actingForAccountId: fromAccountId,
         authoritySource: 'delegation',
         permissionSnapshot: permissionSnapshot,
         policySnapshot: policySnapshot
       }

7. CRIAR TRANSAÇÃO COM AUTORIA
   └─> bankTransactionService.createTransactionWithSplit(..., { authorship })
   └─> INSERT INTO bank_transactions (..., performed_by_user_id, acting_for_actor_id, ...)

8. REGISTRAR NO LEDGER COM AUTORIA
   └─> bankLedgerRepository.createEntry(..., { authorship })
   └─> INSERT INTO bank_ledger (..., performed_by_user_id, acting_for_actor_id, ...)

9. CRIAR SPLITS COM AUTORIA
   └─> bankSplitRepository.createSplit(..., { authorship })
   └─> INSERT INTO bank_splits (..., performed_by_user_id, acting_for_actor_id, ...)
```

### 3.2 Hard Fail no Código

**REGRA:** Toda criação de transação/ledger/split **DEVE** incluir `authorship`.

**Exceção:** Jobs internos/system podem usar `authoritySource='system'` e `performedByUserId=null`.

**Implementação (Fase 1):**
- Se `authorship` não fornecido → **WARNING log** + fallback temporário com `authoritySource='system'`
- Fallback será **removido na Fase 2** (NOT NULL no banco)

**Código de exemplo:**
```typescript
if (!authorship) {
  console.warn('[MISSING_AUTHORSHIP_FALLBACK_USED] Transação criada sem autoria. Será bloqueado na Fase 2.');
  // Fallback temporário (Fase 1)
  const fallbackAuthorship: FinancialAuthorshipContext = {
    performedByUserId: null,
    actingForActorId: 'system',
    authoritySource: 'system',
    permissionSnapshot: { ... },
    policySnapshot: { ... }
  };
  // Usar fallback
}
```

---

## 4. EXEMPLOS DE CONSULTA

### 4.1 Listar Transações por Usuário

```sql
SELECT 
  transaction_id,
  amount,
  currency,
  transaction_type,
  created_at,
  performed_by_user_id,
  acting_for_actor_id,
  authority_source
FROM bank_transactions
WHERE performed_by_user_id = 'user-123'
ORDER BY created_at DESC;
```

### 4.2 Listar Transações por Actor

```sql
SELECT 
  transaction_id,
  amount,
  currency,
  transaction_type,
  created_at,
  performed_by_user_id,
  acting_for_actor_id,
  authority_source
FROM bank_transactions
WHERE acting_for_actor_id = 'actor-456'
ORDER BY created_at DESC;
```

### 4.3 Listar Transações por Período e CPF (READ-MODEL)

```sql
-- Exemplo: Transações de um usuário específico por CPF
SELECT 
  bt.transaction_id,
  bt.amount,
  bt.currency,
  bt.created_at,
  bt.performed_by_user_id,
  bt.acting_for_actor_id,
  bt.authority_source,
  u.cpf,
  u.name
FROM bank_transactions bt
JOIN users u ON u.user_id = bt.performed_by_user_id
WHERE u.cpf = '123.456.789-00'
  AND bt.created_at >= '2024-01-01'
  AND bt.created_at < '2024-02-01'
ORDER BY bt.created_at DESC;
```

### 4.4 Auditoria Completa de uma Transação

```sql
-- Transação com todos os detalhes de autoria
SELECT 
  bt.transaction_id,
  bt.amount,
  bt.performed_by_user_id,
  bt.acting_for_actor_id,
  bt.authority_source,
  bt.permission_snapshot,
  bt.policy_snapshot,
  -- Entradas do ledger
  bl.entry_id,
  bl.entry_type,
  bl.amount as ledger_amount,
  bl.performed_by_user_id as ledger_performed_by,
  -- Splits
  bs.split_id,
  bs.split_type,
  bs.amount as split_amount,
  bs.performed_by_user_id as split_performed_by
FROM bank_transactions bt
LEFT JOIN bank_ledger bl ON bl.transaction_id = bt.transaction_id
LEFT JOIN bank_splits bs ON bs.transaction_id = bt.transaction_id
WHERE bt.transaction_id = 'transaction-123';
```

---

## 5. INVARIANTES

### 5.1 Invariantes Obrigatórias

1. **Nenhuma criação de transação sem autoria (no código)**
   - ✅ Hard fail implementado (com fallback temporário na Fase 1)
   - ⚠️ Fase 2: NOT NULL no banco (remover fallback)

2. **Snapshots sempre serializáveis**
   - ✅ `permission_snapshot` e `policy_snapshot` são JSONB
   - ✅ Sempre incluir `decidedAt` (ISO 8601)

3. **Autoria consistente entre transação, ledger e splits**
   - ✅ Mesmo `authorship` passado para todos os INSERTs
   - ✅ Mesmos valores de `performed_by_user_id`, `acting_for_actor_id`, `authority_source`

4. **Authority source válido**
   - ✅ CHECK constraint no banco: `authority_source IN ('ownership', 'delegation', 'account_acl', 'system')`

### 5.2 Invariantes Futuras (Fase 2)

1. **NOT NULL em todos os campos de autoria**
   - ⚠️ Fase 2: Remover NULLABLE e fallbacks

2. **performed_by_user_id não NULL para operações não-system**
   - ⚠️ Fase 2: Validar que apenas `authoritySource='system'` pode ter `performed_by_user_id=NULL`

---

## 6. CHECKLIST PARA FUTURAS MUDANÇAS

### 6.1 Antes de Criar/Alterar Operação Financeira

- [ ] **Autoria incluída?**
  - Resposta obrigatória: Sim, via `FinancialAuthorshipContext`
  - Se não, a proposta é **PROIBIDA**

- [ ] **Permission snapshot capturado?**
  - Resposta obrigatória: Sim, via `authorizationService.canActAs()` antes de criar transação
  - Se não, a proposta é **PROIBIDA**

- [ ] **Policy snapshot capturado?**
  - Resposta obrigatória: Sim, via `bankPolicyService.resolveSplitPolicy()` (se aplicável)
  - Se não houver policy, registrar `{ policyKeyResolved: null, decidedAt: ... }`

- [ ] **Autoria passada para todos os INSERTs?**
  - Resposta obrigatória: Sim, para `bank_transactions`, `bank_ledger`, `bank_splits`
  - Se não, a proposta é **PROIBIDA**

- [ ] **Authority source válido?**
  - Resposta obrigatória: Sim, um de: `'ownership'`, `'delegation'`, `'account_acl'`, `'system'`
  - Se não, a proposta é **PROIBIDA**

### 6.2 Antes de Migração

- [ ] **Campos adicionados são NULLABLE (Fase 1)?**
  - Resposta obrigatória: Sim, nesta fase
  - Fase 2: Mudar para NOT NULL

- [ ] **Índices criados?**
  - Resposta obrigatória: Sim, para `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`
  - Incluir índices compostos com `tenant_id` quando fizer sentido

- [ ] **CHECK constraints adicionados?**
  - Resposta obrigatória: Sim, para `authority_source IN (...)` 

---

## 7. SCHEMA FINAL

### 7.1 bank_transactions

```sql
ALTER TABLE bank_transactions
  ADD COLUMN performed_by_user_id UUID NULL,
  ADD COLUMN acting_for_actor_id UUID NULL,
  ADD COLUMN acting_for_account_id UUID NULL,
  ADD COLUMN authority_source VARCHAR(32) NULL
    CHECK (authority_source IS NULL OR authority_source IN ('ownership', 'delegation', 'account_acl', 'system')),
  ADD COLUMN permission_snapshot JSONB NULL,
  ADD COLUMN policy_snapshot JSONB NULL;
```

### 7.2 bank_ledger

```sql
ALTER TABLE bank_ledger
  ADD COLUMN performed_by_user_id UUID NULL,
  ADD COLUMN acting_for_actor_id UUID NULL,
  ADD COLUMN acting_for_account_id UUID NULL,
  ADD COLUMN authority_source VARCHAR(32) NULL
    CHECK (authority_source IS NULL OR authority_source IN ('ownership', 'delegation', 'account_acl', 'system')),
  ADD COLUMN permission_snapshot JSONB NULL,
  ADD COLUMN policy_snapshot JSONB NULL;
```

### 7.3 bank_splits

```sql
ALTER TABLE bank_splits
  ADD COLUMN performed_by_user_id UUID NULL,
  ADD COLUMN acting_for_actor_id UUID NULL,
  ADD COLUMN acting_for_account_id UUID NULL,
  ADD COLUMN authority_source VARCHAR(32) NULL
    CHECK (authority_source IS NULL OR authority_source IN ('ownership', 'delegation', 'account_acl', 'system')),
  ADD COLUMN permission_snapshot JSONB NULL,
  ADD COLUMN policy_snapshot JSONB NULL;
```

---

## 8. TIPOS NO CÓDIGO

### 8.1 FinancialAuthorshipContext

```typescript
export interface FinancialAuthorshipContext {
  performedByUserId: string | null;
  actingForActorId: string;
  /**
   * OBRIGATÓRIO segundo o Core Canônico.
   * Em Fase 1: código pode inferir quando ausente (ex: do from_account_id).
   * Em Fase 2: será NOT NULL e obrigatório em todos os fluxos.
   */
  actingForAccountId: string;
  authoritySource: 'ownership' | 'delegation' | 'account_acl' | 'system';
  permissionSnapshot?: PermissionSnapshot;
  policySnapshot?: PolicySnapshot;
}
```

### 8.2 PermissionSnapshot

```typescript
export interface PermissionSnapshot {
  permissionKey: string;
  allowed: boolean;
  reason?: string;
  actorId: string;
  userId: string;
  decidedAt: string; // ISO 8601
  [key: string]: any;
}
```

### 8.3 PolicySnapshot

```typescript
export interface PolicySnapshot {
  policyKeyResolved?: string | null;
  resolutionPath?: string[];
  inputsUsed?: Record<string, any>;
  decidedAt: string; // ISO 8601
  [key: string]: any;
}
```

---

## 9. PRÓXIMAS FASES

### Fase 2 (Futuro)

1. **NOT NULL em todos os campos de autoria**
   - Remover NULLABLE
   - Remover fallbacks temporários
   - Hard fail real (sem fallback)

2. **Validação de performed_by_user_id**
   - Apenas `authoritySource='system'` pode ter `performed_by_user_id=NULL`
   - Outros casos: obrigatório

3. **Foreign keys (se aplicável)**
   - `performed_by_user_id REFERENCES users(user_id)`
   - `acting_for_actor_id REFERENCES actors(actor_id)`

---

## 10. REFERÊNCIAS

- **Migration:** `backend/migrations/285_add_financial_authorship.sql`
- **Tipos:** `backend/src/modules/bank/financial-authorship.types.ts`
- **Repositórios atualizados:**
  - `backend/src/modules/bank/bank-transaction.service.ts`
  - `backend/src/modules/bank/bank-ledger.repository.ts`
  - `backend/src/modules/bank/bank-split.repository.ts`

---

**FIM DO DOCUMENTO**

