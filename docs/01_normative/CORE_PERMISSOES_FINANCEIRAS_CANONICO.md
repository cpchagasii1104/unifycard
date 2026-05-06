Status: SUBORDINATED
Domain: Financial
Governing Contract: CORE_FINANCIAL_CONTRACT.md
# CORE DE PERMISSÕES FINANCEIRAS CANÔNICO — UNIFICARD

**Status:** IMUTÁVEL  
**Autoridade:** NÍVEL 1 (CORE / LEI DO SISTEMA)  
**Escopo:** Todo o sistema financeiro do UnifiCard  
**Aplicação:** Código, banco, serviços, IAs e decisões humanas  

---

## DEFINIÇÃO ABSOLUTA

O **CORE DE PERMISSÕES FINANCEIRAS** é a estrutura única, não duplicável e não substituível que define **quem pode operar contas financeiras** no UnifiCard.

**Permissões financeiras** controlam:
- Quem pode executar transações
- Quem pode autorizar operações
- Quem pode visualizar saldos e extratos
- Quem pode configurar limites e políticas
- Como o sistema rastreia autoria de operações financeiras

**Regra absoluta:**  
**Toda operação financeira deve ter autoria rastreável.**  
**Nenhuma transação pode ocorrer sem registro de quem executou.**  
**Nenhuma permissão pode ser inferida implicitamente.**

---

## 1. VISÃO GERAL DO CORE DE PERMISSÕES FINANCEIRAS

### 1.1 O Que É Permissão Financeira

Permissão financeira é o direito de um **operador** (usuário) de executar ações financeiras em nome de um **dono** (Actor).

**Conceitos fundamentais:**
- **Dono da Conta**: Actor que possui a conta financeira (`bank_accounts.owner_id` + `owner_type`)
- **Operador da Conta**: Usuário que executa ações financeiras em nome do Actor
- **Autoria**: Registro de quem executou uma operação financeira
- **Delegação**: Mecanismo que permite usuário operar em nome de Actor

### 1.2 Princípios Fundamentais

1. **Separação Dono/Operador**: Actor é dono, User é operador
2. **Autoria Rastreável**: Toda transação registra quem executou
3. **Permissões Explícitas**: Nenhuma permissão é inferida
4. **Revogação Sem Afetar Histórico**: Revogar acesso não altera transações passadas
5. **Auditoria Completa**: Todas as ações são auditáveis por operador
6. **Core Imutável**: Permissões financeiras são Core, não podem ser duplicadas

---

## 2. FONTE ÚNICA DA VERDADE

### 2.1 Estruturas Canônicas

| Estrutura | Tabela | Responsabilidade | Status |
|-----------|--------|-----------------|--------|
| **Permissões** | `MAPA_CANONICO_PERMISSIONS_v1.md` | Definição de permissões financeiras | CORE |
| **Autorização** | `authorization.service.ts` | Verificação de permissões | CORE |
| **Delegação** | `actor_delegations` | Delegação de permissões | CORE |
| **ACL por Conta** | `bank_account_operators` | Operadores específicos por conta | CORE |
| **Políticas** | `bank_account_policies` | Políticas condicionais por conta | CORE |
| **Beneficiários** | `bank_beneficiaries` | Favorecidos cadastrados por conta | CORE |
| **Autoria** | `bank_transactions.performed_by_user_id` | Registro de quem executou | CORE (a ser implementado) |
| **Actor** | `actors` | Identidade operacional | CORE |
| **Conta** | `bank_accounts` | Contas financeiras | CORE |

### 2.2 Regra Absoluta

**Toda verificação de permissão financeira passa por `authorization.service.canActAs()`.**  
**Toda transação financeira registra `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`, `permission_snapshot`.**  
**Toda delegação é armazenada em `actor_delegations`.**  
**Toda ACL por conta é armazenada em `bank_account_operators`.**  
**Toda política condicional é armazenada em `bank_account_policies`.**  
**Todo beneficiário é armazenado em `bank_beneficiaries`.**  

Não há exceções.  
Não há representações alternativas.  
Não há "atalhos técnicos".

### 2.3 O Que NÃO É Fonte da Verdade

- Lógica de permissão inline em services (proibido)
- Verificações de ownership diretas sem passar por `authorization.service` (proibido)
- Inferência de permissão por contexto (proibido)
- Armazenamento de permissões em cache sem validação (proibido)
- Políticas condicionais hardcoded no código (proibido)
- Lista de beneficiários em estrutura não canônica (proibido)
- ACL em estrutura não canônica (proibido)

---

## 3. SEPARAÇÃO DONO/OPERADOR

### 3.1 Definição

**Dono da Conta (Actor):**
- Actor que possui a conta financeira
- Definido por `bank_accounts.owner_id` + `owner_type`
- Responsável legal pela conta
- Não executa ações diretamente (Actor é conceitual)

**Operador da Conta (User):**
- Usuário que executa ações financeiras
- Identificado por `user_id`
- Pode operar via:
  - Ownership (é o próprio Actor, se Actor for `user`)
  - Delegação (tem delegação ativa do Actor)
- Registrado em `bank_transactions.executed_by_user_id`

### 3.2 Regra Absoluta

**Actor é dono, User é operador.**  
**Nenhuma transação pode ocorrer sem operador explícito.**  
**Nenhuma permissão pode ser inferida do contexto.**

### 3.3 Exemplos

**Exemplo 1: User opera própria conta**
- Dono: Actor `user-123` (vinculado a `user_id=123`)
- Operador: User `123`
- Autoria: `executed_by_user_id=123`
- Permissão: Ownership (user é o próprio Actor)

**Exemplo 2: Funcionário opera conta da empresa**
- Dono: Actor `company-456` (vinculado a `company_id=456`)
- Operador: User `789` (funcionário)
- Autoria: `executed_by_user_id=789`
- Permissão: Delegação (user tem delegação ativa para `company-456`)

**Exemplo 3: Sistema executa split automático**
- Dono: Actor `system` (conta do sistema)
- Operador: User `system` (usuário do sistema)
- Autoria: `executed_by_user_id=system`
- Permissão: System (sistema tem permissão implícita)

---

## 4. AUTORIA RASTREÁVEL

### 4.1 Definição

**Autoria** é o registro de quem executou uma operação financeira.

**Regra absoluta:**  
**Toda transação financeira deve registrar `executed_by_user_id`.**  
**Toda entrada no ledger deve registrar `executed_by_user_id`.**  
**Todo split deve registrar `executed_by_user_id`.**

### 4.2 Estrutura de Autoria

**Campos obrigatórios:**
- `executed_by_user_id`: User que executou a operação
- `executed_by_actor_id`: Actor em nome do qual a operação foi executada
- `authority_source`: Fonte da autorização (`ownership`, `delegation`, `system`)

**Campos opcionais:**
- `authorized_by_user_id`: User que autorizou (se diferente do executor)
- `delegation_id`: ID da delegação usada (se aplicável)

### 4.3 Onde Registrar Autoria

1. **`bank_transactions`**: Campo `executed_by_user_id` (obrigatório)
2. **`bank_ledger`**: Campo `executed_by_user_id` (obrigatório)
3. **`bank_splits`**: Campo `executed_by_user_id` (obrigatório)

### 4.4 Regra Absoluta

**Nenhuma transação pode ser criada sem `executed_by_user_id`.**  
**Nenhuma entrada no ledger pode ser criada sem `executed_by_user_id`.**  
**Nenhum split pode ser criado sem `executed_by_user_id`.**

---

## 5. PERMISSÕES FINANCEIRAS CANÔNICAS

### 5.1 Permissões Definidas

| Permission Key | Descrição | Capability Requerida | Aplica-se a |
|----------------|-----------|---------------------|-------------|
| `manage_financial` | Executar transações financeiras | `can_hold_assets` | POST /bank/transfer, POST /bank/withdraw, POST /bank/deposit |
| `receive_funds` | Receber pagamentos/transferências | `can_receive_funds` | Implicit (ser destinatário de transação) |
| `view_financial` | Ver extratos e saldos | (nenhuma - ownership suficiente) | GET /bank/balance, GET /bank/statement |
| `financial_terms:view` | Visualizar termos financeiros | (nenhuma - ownership suficiente) | GET /services/orders/:orderId/financial-terms |
| `financial_terms:confirm` | Confirmar termos financeiros | `can_hold_assets` | POST /services/orders/:orderId/financial-terms/confirm |
| `split:view` | Visualizar splits | (nenhuma - ownership suficiente) | GET /bank/splits |
| `split:create` | Criar splits | `can_hold_assets` | POST /bank/splits |
| `financial:execute_payout` | Executar payout | `can_hold_assets` | POST /bank/payouts |
| `financial:view_ledger` | Visualizar ledger | (nenhuma - ownership suficiente) | GET /bank/ledger |
| `financial:view_all_ledger` | Visualizar todo o ledger | (atribuição manual apenas) | GET /bank/ledger/all |

### 5.2 Matriz de Decisão

**Como determinar se user pode executar ação financeira:**

```
1. Ação requer permission? (consultar MAPA_CANONICO_PERMISSIONS_v1.md)
   SIM → continuar
   NÃO → permitir (ação pública - raro em financeiro)

2. Permission requer capability?
   SIM → verificar se actor tem capability (via actor_registry)
   NÃO → continuar (ownership suficiente)

3. User tem ownership do actor?
   SIM → PERMITIR (authority_source = 'ownership')
   NÃO → verificar delegação

4. User tem delegação ativa?
   SIM → verificar se scopes contém permission
     SIM → PERMITIR (authority_source = 'delegation')
     NÃO → NEGAR
   NÃO → NEGAR
```

### 5.3 Regra Absoluta

**Toda verificação de permissão financeira passa por `authorization.service.canActAs()`.**  
**Nenhuma permissão pode ser verificada inline em services.**  
**Nenhuma permissão pode ser inferida do contexto.**

---

## 6. DELEGAÇÃO DE PERMISSÕES FINANCEIRAS

### 6.1 Definição

**Delegação** é o mecanismo que permite um usuário (PF) operar em nome de um Actor institucional.

**Estrutura:**
- `actor_delegations.user_actor_id`: Actor do usuário que recebe delegação
- `actor_delegations.institutional_actor_id`: Actor institucional que delega
- `actor_delegations.scopes_json`: Permissões delegadas (array de PermissionKey)
- `actor_delegations.status`: Status da delegação (`active`, `revoked`, `expired`)

### 6.2 Regras de Delegação

1. **Delegação não é transitiva por padrão**: `is_transitive=false`
2. **Escopos explícitos**: Apenas permissões listadas em `scopes_json` são delegadas
3. **Expiração opcional**: Delegação pode ter `expires_at`
4. **Revogação sem afetar histórico**: Revogar delegação não altera transações passadas

### 6.3 Exemplo de Delegação

**Funcionário pode visualizar extratos, mas não pode transferir:**

```json
{
  "user_actor_id": "user-789",
  "institutional_actor_id": "company-456",
  "scopes_json": ["view_financial"],
  "status": "active"
}
```

**Resultado:**
- ✅ User pode visualizar extratos (`view_financial` está em scopes)
- ❌ User não pode transferir (`manage_financial` não está em scopes)

### 6.4 Regra Absoluta

**Delegação não permite operações financeiras por padrão.**  
**Apenas permissões explícitas em `scopes_json` são delegadas.**  
**Revogar delegação não afeta transações passadas.**

---

## 6.5 ACL POR CONTA (ACCESS CONTROL LIST)

### 6.5.1 Definição

**ACL por Conta** é o mecanismo que permite definir operadores específicos para cada conta financeira, independentemente do Actor dono.

**Regra absoluta:**  
**Um Actor pode ter múltiplas contas, cada uma com sua própria lista de operadores.**  
**Operadores são definidos por `account_id`, não apenas por `actor_id`.**

### 6.5.2 Estrutura de ACL

**Tabela canônica:** `bank_account_operators`

```sql
bank_account_operators (
    operator_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    account_id UUID NOT NULL REFERENCES bank_accounts(account_id),
    user_id UUID NOT NULL REFERENCES users(user_id),
    permissions_json JSONB NOT NULL, -- Array de PermissionKey
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'revoked', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
)
```

### 6.5.3 Regras de ACL

1. **ACL é específica por conta**: Cada conta tem sua própria lista de operadores
2. **Permissões granulares**: Cada operador tem permissões específicas (`permissions_json`)
3. **Revogação sem afetar histórico**: Revogar operador não altera transações passadas
4. **Expiração opcional**: Operador pode ter `expires_at`

### 6.5.4 Exemplo de ACL

**Empresa tem duas contas (CNPJ A e CNPJ B), cada uma com operadores diferentes:**

```json
// Conta CNPJ A
{
  "account_id": "account-cnpj-a",
  "operators": [
    {
      "user_id": "user-789",
      "permissions": ["view_financial", "create_transfer", "approve_transfer"]
    },
    {
      "user_id": "user-790",
      "permissions": ["view_financial"]
    }
  ]
}

// Conta CNPJ B
{
  "account_id": "account-cnpj-b",
  "operators": [
    {
      "user_id": "user-791",
      "permissions": ["view_financial", "create_transfer", "approve_transfer", "manage_beneficiaries"]
    }
  ]
}
```

**Resultado:**
- User 789 pode operar apenas conta CNPJ A
- User 790 pode apenas visualizar conta CNPJ A
- User 791 pode operar apenas conta CNPJ B
- Cada conta tem controle independente de operadores

### 6.5.5 Hierarquia de Verificação

**Ordem de verificação de permissão:**

```
1. Verificar ACL da conta (bank_account_operators)
   └─> Se user está na lista de operadores da conta
   └─> Se permission está em permissions_json
   └─> Se status = 'active'
   └─> Se expires_at não passou
   └─> SIM → PERMITIR (authority_source = 'account_acl')

2. Verificar delegação do Actor (actor_delegations)
   └─> Se user tem delegação para actor dono da conta
   └─> Se permission está em scopes_json
   └─> SIM → PERMITIR (authority_source = 'delegation')

3. Verificar ownership do Actor
   └─> Se user é owner do Actor
   └─> SIM → PERMITIR (authority_source = 'ownership')

4. NEGAR
```

### 6.5.6 Regra Absoluta

**ACL por conta tem precedência sobre delegação do Actor.**  
**Cada conta pode ter operadores independentes.**  
**Revogar operador não afeta transações passadas.**

---

## 6.6 PERMISSÕES GRANULARES POR OPERAÇÃO

### 6.6.1 Definição

**Permissões granulares** são permissões específicas para cada tipo de operação financeira.

**Regra absoluta:**  
**Cada operação financeira tem sua própria permissão.**  
**Nenhuma permissão genérica permite todas as operações.**

### 6.6.2 Permissões Granulares Definidas

| Permission Key | Descrição | Aplica-se a |
|----------------|-----------|-------------|
| `financial:view_balance` | Visualizar saldo | GET /bank/accounts/:accountId/balance |
| `financial:view_statement` | Visualizar extrato | GET /bank/accounts/:accountId/statement |
| `financial:create_transfer` | Criar transferência (pendente de aprovação) | POST /bank/transfers (status=pending) |
| `financial:approve_transfer` | Aprovar transferência pendente | POST /bank/transfers/:transferId/approve |
| `financial:execute_transfer` | Executar transferência diretamente (sem aprovação) | POST /bank/transfers (status=completed) |
| `financial:create_payment` | Criar pagamento (pendente de aprovação) | POST /bank/payments (status=pending) |
| `financial:approve_payment` | Aprovar pagamento pendente | POST /bank/payments/:paymentId/approve |
| `financial:execute_payment` | Executar pagamento diretamente (sem aprovação) | POST /bank/payments (status=completed) |
| `financial:manage_beneficiaries` | Gerenciar favorecidos | POST /bank/beneficiaries, DELETE /bank/beneficiaries/:id |
| `financial:manage_limits` | Gerenciar limites e políticas | POST /bank/accounts/:accountId/limits |
| `financial:manage_policies` | Gerenciar políticas condicionais | POST /bank/accounts/:accountId/policies |

### 6.6.3 Regras de Permissões Granulares

1. **Criar vs Aprovar vs Executar são separados**
   - `create_transfer` permite criar, mas não executar
   - `approve_transfer` permite aprovar, mas não criar
   - `execute_transfer` permite executar diretamente (sem aprovação)

2. **Visualização é separada de operação**
   - `view_balance` permite apenas visualizar
   - `view_statement` permite apenas visualizar
   - Não permite criar ou executar transações

3. **Gerenciamento é separado de operação**
   - `manage_beneficiaries` permite gerenciar favorecidos
   - `manage_limits` permite gerenciar limites
   - Não permite executar transações

### 6.6.4 Exemplo de Permissões Granulares

**Funcionário pode criar transferências, mas não pode aprovar:**

```json
{
  "user_id": "user-789",
  "account_id": "account-cnpj-a",
  "permissions": [
    "financial:view_balance",
    "financial:view_statement",
    "financial:create_transfer"
  ]
}
```

**Resultado:**
- ✅ User pode visualizar saldo e extrato
- ✅ User pode criar transferências (pendentes de aprovação)
- ❌ User não pode aprovar transferências
- ❌ User não pode executar transferências diretamente

### 6.6.5 Regra Absoluta

**Cada operação financeira requer permissão específica.**  
**Nenhuma permissão genérica permite todas as operações.**  
**Criar, aprovar e executar são permissões separadas.**

---

## 6.7 POLÍTICAS CONDICIONAIS OBRIGATÓRIAS

### 6.7.1 Definição

**Políticas condicionais** são regras de negócio que restringem operações financeiras baseadas em condições específicas.

**Regra absoluta:**  
**Toda política condicional é obrigatória e não pode ser contornada.**  
**Políticas são verificadas após verificação de permissão.**

### 6.7.2 Políticas Condicionais Definidas

| Política | Descrição | Verificação |
|----------|-----------|------------|
| `allow_transfers_to_beneficiaries_only` | Permitir transferências apenas para favorecidos cadastrados | Verificar se `to_account_id` está em `bank_beneficiaries` |
| `allow_transfers_to_internal_only` | Permitir transferências apenas para contas internas do ecossistema | Verificar se `to_account_id` pertence ao mesmo tenant |
| `allow_pix_to_any_key` | Permitir Pix para qualquer chave (sim/não) | Verificar se `transaction_type = 'pix'` e política permite |
| `transaction_limit_per_transaction` | Limite por transação | Verificar se `amount <= limit_per_transaction` |
| `transaction_limit_per_period` | Limite por período (diário, semanal, mensal) | Verificar se soma de transações no período <= limit_per_period |
| `require_dual_approval_above_amount` | Regra de múltiplas aprovações (4 olhos) acima de valor | Verificar se `amount > threshold`, então requer 2 aprovações |

### 6.7.3 Estrutura de Políticas

**Tabela canônica:** `bank_account_policies`

```sql
bank_account_policies (
    policy_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    account_id UUID NOT NULL REFERENCES bank_accounts(account_id),
    policy_key VARCHAR(100) NOT NULL,
    policy_value JSONB NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'disabled')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
)
```

**Tabela canônica de beneficiários:** `bank_beneficiaries`

```sql
bank_beneficiaries (
    beneficiary_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    account_id UUID NOT NULL REFERENCES bank_accounts(account_id),
    beneficiary_account_id UUID NOT NULL REFERENCES bank_accounts(account_id),
    beneficiary_name VARCHAR(255) NOT NULL,
    beneficiary_type VARCHAR(50) NOT NULL CHECK (beneficiary_type IN ('internal', 'external', 'pix')),
    pix_key VARCHAR(255), -- Se beneficiary_type = 'pix'
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'revoked')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_by_user_id UUID NOT NULL REFERENCES users(user_id)
)
```

**Regra absoluta:**  
**Beneficiários são específicos por conta.**  
**Apenas beneficiários cadastrados podem receber transferências se política `allow_transfers_to_beneficiaries_only` estiver ativa.**

### 6.7.4 Exemplos de Políticas

**Política 1: Transferências apenas para favorecidos**

```json
{
  "account_id": "account-cnpj-a",
  "policy_key": "allow_transfers_to_beneficiaries_only",
  "policy_value": {
    "enabled": true
  },
  "status": "active"
}
```

**Resultado:**
- ✅ Transferência para favorecido cadastrado → PERMITIDO
- ❌ Transferência para conta não cadastrada → NEGADO

**Política 2: Limite por transação e período**

```json
{
  "account_id": "account-cnpj-a",
  "policy_key": "transaction_limits",
  "policy_value": {
    "limit_per_transaction": 10000.00,
    "limit_per_day": 50000.00,
    "limit_per_week": 200000.00,
    "limit_per_month": 500000.00
  },
  "status": "active"
}
```

**Resultado:**
- ✅ Transferência de R$ 5.000,00 → PERMITIDO
- ❌ Transferência de R$ 15.000,00 → NEGADO (excede limite por transação)
- ❌ Transferência de R$ 3.000,00 após já ter transferido R$ 48.000,00 no dia → NEGADO (excede limite diário)

**Política 3: Múltiplas aprovações (4 olhos)**

```json
{
  "account_id": "account-cnpj-a",
  "policy_key": "require_dual_approval_above_amount",
  "policy_value": {
    "enabled": true,
    "threshold": 50000.00,
    "required_approvals": 2
  },
  "status": "active"
}
```

**Resultado:**
- ✅ Transferência de R$ 30.000,00 → PERMITIDO (1 aprovação suficiente)
- ⚠️ Transferência de R$ 60.000,00 → PENDENTE (requer 2 aprovações)
- ✅ Após 2 aprovações → PERMITIDO

**Política 4: Pix para qualquer chave**

```json
{
  "account_id": "account-cnpj-a",
  "policy_key": "allow_pix_to_any_key",
  "policy_value": {
    "enabled": true
  },
  "status": "active"
}
```

**Resultado:**
- ✅ Pix para qualquer chave → PERMITIDO
- ❌ Pix desabilitado → NEGADO (política não existe ou `enabled: false`)

### 6.7.5 Fluxo de Verificação de Políticas

```
1. VERIFICAR PERMISSÃO
   └─> authorization.service.canActAs(tenantId, userId, actorId, permissionKey)
   └─> Se NEGADO → BLOQUEAR
   └─> Se PERMITIDO → continuar

2. VERIFICAR POLÍTICAS CONDICIONAIS
   └─> Buscar políticas ativas da conta (bank_account_policies)
   └─> Para cada política ativa:
       ├─> allow_transfers_to_beneficiaries_only
       │   └─> Verificar se to_account_id está em bank_beneficiaries
       ├─> allow_transfers_to_internal_only
       │   └─> Verificar se to_account_id pertence ao mesmo tenant
       ├─> allow_pix_to_any_key
       │   └─> Verificar se transaction_type = 'pix' e política permite
       ├─> transaction_limit_per_transaction
       │   └─> Verificar se amount <= limit_per_transaction
       ├─> transaction_limit_per_period
       │   └─> Verificar se soma de transações no período <= limit_per_period
       └─> require_dual_approval_above_amount
           └─> Verificar se amount > threshold, então requer N aprovações

3. SE TODAS AS POLÍTICAS PASSAREM → PERMITIR
4. SE QUALQUER POLÍTICA FALHAR → NEGAR
```

### 6.7.6 Regra Absoluta

**Toda política condicional é obrigatória e não pode ser contornada.**  
**Políticas são verificadas após verificação de permissão.**  
**Nenhuma transação pode ocorrer se violar política ativa.**

---

## 7. AUDITORIA OBRIGATÓRIA

### 7.1 Definição

**Auditoria obrigatória** é o registro imutável de todas as informações relevantes de uma operação financeira.

**Regra absoluta:**  
**Toda ação financeira deve registrar informações completas de auditoria.**  
**Nenhuma informação de auditoria pode ser omitida ou inferida.**

### 7.2 Campos de Auditoria Obrigatórios

**Campos obrigatórios em `bank_transactions`:**

```sql
performed_by_user_id UUID NOT NULL REFERENCES users(user_id),
acting_for_actor_id UUID NOT NULL REFERENCES actors(actor_id),
acting_for_account_id UUID NOT NULL REFERENCES bank_accounts(account_id),
authority_source VARCHAR(20) NOT NULL CHECK (authority_source IN ('ownership', 'delegation', 'account_acl', 'system')),
permission_snapshot JSONB NOT NULL, -- Snapshot da permissão que autorizou
policy_snapshot JSONB, -- Snapshot das políticas que foram verificadas
delegation_id UUID REFERENCES actor_delegations(delegation_id),
account_operator_id UUID REFERENCES bank_account_operators(operator_id)
```

**Campos obrigatórios em `bank_ledger`:**

```sql
performed_by_user_id UUID NOT NULL REFERENCES users(user_id),
acting_for_actor_id UUID NOT NULL REFERENCES actors(actor_id),
acting_for_account_id UUID NOT NULL REFERENCES bank_accounts(account_id)
```

**Campos obrigatórios em `bank_splits`:**

```sql
performed_by_user_id UUID NOT NULL REFERENCES users(user_id),
acting_for_actor_id UUID NOT NULL REFERENCES actors(actor_id),
acting_for_account_id UUID NOT NULL REFERENCES bank_accounts(account_id)
```

### 7.3 Estrutura de Permission Snapshot

**Permission Snapshot** é um registro imutável da permissão que autorizou a operação.

```json
{
  "permission_key": "financial:execute_transfer",
  "authority_source": "account_acl",
  "verified_at": "2024-01-15T10:30:00Z",
  "delegation_id": null,
  "account_operator_id": "operator-123",
  "actor_id": "company-456",
  "account_id": "account-cnpj-a"
}
```

### 7.4 Estrutura de Policy Snapshot

**Policy Snapshot** é um registro imutável das políticas que foram verificadas.

```json
{
  "policies_checked": [
    {
      "policy_key": "allow_transfers_to_beneficiaries_only",
      "result": "passed",
      "checked_at": "2024-01-15T10:30:00Z"
    },
    {
      "policy_key": "transaction_limit_per_transaction",
      "result": "passed",
      "limit": 10000.00,
      "amount": 5000.00,
      "checked_at": "2024-01-15T10:30:00Z"
    },
    {
      "policy_key": "require_dual_approval_above_amount",
      "result": "passed",
      "threshold": 50000.00,
      "amount": 30000.00,
      "required_approvals": 2,
      "current_approvals": 0,
      "checked_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### 7.5 Rastreabilidade Completa

**Regra absoluta:**  
**Toda operação financeira é rastreável até o operador que executou, em nome de qual Actor, em qual conta, com qual permissão e quais políticas foram verificadas.**

**Como rastrear:**
1. Buscar `bank_transactions.performed_by_user_id` → Quem executou
2. Buscar `bank_transactions.acting_for_actor_id` → Em nome de qual Actor
3. Buscar `bank_transactions.acting_for_account_id` → Em qual conta
4. Buscar `bank_transactions.permission_snapshot` → Qual permissão autorizou
5. Buscar `bank_transactions.policy_snapshot` → Quais políticas foram verificadas
6. Buscar `bank_transactions.delegation_id` → Qual delegação foi usada (se aplicável)
7. Buscar `bank_transactions.account_operator_id` → Qual operador da conta foi usado (se aplicável)

### 7.6 Auditoria por Operador

**Relatórios obrigatórios:**
1. **Por Operador**: Todas as transações executadas por um usuário (`performed_by_user_id`)
2. **Por Actor**: Todas as transações executadas em nome de um Actor (`acting_for_actor_id`)
3. **Por Conta**: Todas as transações executadas em uma conta (`acting_for_account_id`)
4. **Por Permissão**: Todas as transações autorizadas por uma permissão (`permission_snapshot.permission_key`)
5. **Por Política**: Todas as transações que passaram/falharam uma política (`policy_snapshot`)
6. **Por Período**: Todas as transações em um intervalo de datas
7. **Por Tipo**: Todas as transações de um tipo específico
8. **Por Delegação**: Todas as transações executadas via delegação (`delegation_id`)
9. **Por Operador de Conta**: Todas as transações executadas por um operador de conta (`account_operator_id`)

### 7.7 Compliance e Receita Federal

**Suporte:**
- Rastreabilidade completa de quem executou cada transação (`performed_by_user_id`)
- Separação clara entre dono (Actor) e operador (User)
- Registro de qual permissão autorizou (`permission_snapshot`)
- Registro de quais políticas foram verificadas (`policy_snapshot`)
- Histórico imutável de todas as operações
- Relatórios consolidadas por CPF/CNPJ sem misturar saldos

**Regra absoluta:**  
**Compliance consolida por CPF/CNPJ, mas saldos permanecem separados por Actor.**  
**Auditoria rastreia por operador, não por CPF.**  
**Toda informação de auditoria é imutável após registro.**

---

## 8. COMPLIANCE E RECEITA FEDERAL

### 7.1 Rastreabilidade

**Regra absoluta:**  
**Toda operação financeira é rastreável até o operador que executou.**

**Como rastrear:**
1. Buscar `bank_transactions.executed_by_user_id`
2. Buscar `bank_ledger.executed_by_user_id`
3. Buscar `bank_splits.executed_by_user_id`
4. Buscar `actor_delegations` para verificar delegação usada

---

## 8. VEREDITO INSTITUCIONAL

### 8.1 Estado Atual

**VEREDITO: EM VIOLAÇÃO — AUSÊNCIA DE AUTORIA RASTREÁVEL E CAPACIDADES DE MERCADO**

O sistema atual apresenta as seguintes violações:

1. **Transações não registram quem executou**
   - `bank_transactions` não tem campos `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`, `permission_snapshot`, `policy_snapshot`
   - `bank_ledger` não tem campos `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`
   - `bank_splits` não tem campos `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`

2. **Permissões são verificadas, mas não registradas**
   - Sistema usa `authorization.service.canActAs()` para verificar
   - Mas não registra quem executou na transação
   - Não é possível auditar ações por operador

3. **Delegação existe, mas não é rastreável**
   - `actor_delegations` permite delegação
   - Mas transações não registram se foram executadas via delegação
   - Não é possível saber qual delegação foi usada

4. **Separação dono/operador não está registrada**
   - Conceitualmente existe (Actor é dono, User é operador)
   - Mas não está registrada nas transações
   - Não é possível distinguir quem executou vs em nome de quem

5. **ACL por conta não existe**
   - Não há estrutura `bank_account_operators`
   - Não é possível ter operadores diferentes por conta
   - Não é possível ter múltiplas contas (CNPJ A, CNPJ B) com operadores independentes

6. **Permissões granulares não existem**
   - Não há separação entre `create_transfer`, `approve_transfer`, `execute_transfer`
   - Não há separação entre `create_payment`, `approve_payment`, `execute_payment`
   - Não há permissões específicas para `manage_beneficiaries`, `manage_limits`, `manage_policies`

7. **Políticas condicionais não existem**
   - Não há estrutura `bank_account_policies`
   - Não é possível restringir transferências apenas para favorecidos
   - Não é possível implementar limites por transação e período
   - Não é possível implementar regra de múltiplas aprovações (4 olhos)

8. **Beneficiários não existem**
   - Não há estrutura `bank_beneficiaries`
   - Não é possível cadastrar favorecidos por conta
   - Não é possível restringir transferências apenas para beneficiários cadastrados

### 8.2 Riscos Identificados

1. **Impossibilidade de auditoria por operador**
   - Não é possível saber quem executou cada transação
   - Não é possível gerar relatórios por operador
   - Não é possível rastrear ações de funcionários

2. **Impossibilidade de revogar acesso sem afetar histórico**
   - Delegação pode ser revogada
   - Mas transações passadas não registram quem executou
   - Não é possível saber quais transações foram executadas por usuário revogado

3. **Falhas de auditoria interna ou regulatória**
   - Receita Federal pode exigir rastreabilidade
   - Auditoria interna não consegue rastrear operadores
   - Compliance não consegue gerar relatórios necessários

4. **Modelo não suporta contabilidade corporativa real**
   - Empresas precisam rastrear quem executou cada transação
   - Funcionários precisam ter permissões explícitas
   - Não é possível implementar controles internos adequados

5. **Impossibilidade de operar múltiplas contas com operadores diferentes**
   - Empresas com múltiplos CNPJs não podem ter operadores independentes por conta
   - Não é possível implementar ACL por conta
   - Não é possível ter controles granulares por conta

6. **Impossibilidade de implementar políticas de segurança**
   - Não é possível restringir transferências apenas para favorecidos
   - Não é possível implementar limites por transação e período
   - Não é possível implementar regra de múltiplas aprovações (4 olhos)
   - Não é possível controlar Pix para qualquer chave

### 8.3 Classificação do Core

**Permissões financeiras pertencem ao CORE DE AUTORIZAÇÃO, não ao Core Financeiro.**

**Justificativa:**
- Permissões são verificadas via `authorization.service.canActAs()`
- Delegação é gerenciada via `actor_delegations`
- Autoria é registrada em estruturas financeiras, mas a lógica de permissão é do Core de Autorização

**Regra absoluta:**  
**Permissões financeiras são parte do Core de Autorização.**  
**Autoria financeira é parte do Core Financeiro.**  
**Ambos são Core Imutável.**

---

## 9. MODELO CANÔNICO PROPOSTO

### 9.1 Estrutura de Autoria

**Campos obrigatórios em `bank_transactions`:**
```sql
performed_by_user_id UUID NOT NULL REFERENCES users(user_id),
acting_for_actor_id UUID NOT NULL REFERENCES actors(actor_id),
acting_for_account_id UUID NOT NULL REFERENCES bank_accounts(account_id),
authority_source VARCHAR(20) NOT NULL CHECK (authority_source IN ('ownership', 'delegation', 'account_acl', 'system')),
permission_snapshot JSONB NOT NULL,
policy_snapshot JSONB
```

**Campos opcionais em `bank_transactions`:**
```sql
authorized_by_user_id UUID REFERENCES users(user_id),
delegation_id UUID REFERENCES actor_delegations(delegation_id),
account_operator_id UUID REFERENCES bank_account_operators(operator_id)
```

**Campos obrigatórios em `bank_ledger`:**
```sql
performed_by_user_id UUID NOT NULL REFERENCES users(user_id),
acting_for_actor_id UUID NOT NULL REFERENCES actors(actor_id),
acting_for_account_id UUID NOT NULL REFERENCES bank_accounts(account_id)
```

**Campos obrigatórios em `bank_splits`:**
```sql
performed_by_user_id UUID NOT NULL REFERENCES users(user_id),
acting_for_actor_id UUID NOT NULL REFERENCES actors(actor_id),
acting_for_account_id UUID NOT NULL REFERENCES bank_accounts(account_id)
```

### 9.2 Fluxo Canônico

```
1. USER SOLICITA OPERAÇÃO
   └─> POST /bank/transfer
   └─> Body: { actingActorId: 'company-456', amount: 1000 }
   
2. VERIFICAR PERMISSÃO
   └─> authorization.service.canActAs(tenantId, userId, actorId, 'manage_financial')
   └─> Retorna: { allowed: true, authoritySource: 'delegation', delegationId: 'deleg-123' }
   
3. VERIFICAR POLÍTICAS CONDICIONAIS
   └─> bank-policy.service.verifyPolicies(accountId, transaction)
   └─> Retorna: { passed: true, policies_checked: [...] }
   
4. CRIAR TRANSAÇÃO COM AUTORIA COMPLETA
   └─> bank-transaction.service.transfer()
   └─> Inclui: performed_by_user_id, acting_for_actor_id, acting_for_account_id, 
       authority_source, permission_snapshot, policy_snapshot, delegation_id, account_operator_id
   
5. REGISTRAR NO LEDGER COM AUTORIA
   └─> bank-ledger.repository.createEntry()
   └─> Inclui: performed_by_user_id, acting_for_actor_id, acting_for_account_id
   
6. CRIAR SPLITS COM AUTORIA
   └─> bank-split.repository.create()
   └─> Inclui: performed_by_user_id, acting_for_actor_id, acting_for_account_id
```

### 9.3 Regras de Autoria

1. **Sistema executa split automático**
   - `performed_by_user_id`: `system` (usuário do sistema)
   - `acting_for_actor_id`: `system` (actor do sistema)
   - `acting_for_account_id`: `account-system-fee`
   - `authority_source`: `system`
   - `permission_snapshot`: `{ permission_key: "system:execute_split", authority_source: "system" }`

2. **User executa em nome próprio**
   - `performed_by_user_id`: `user-123`
   - `acting_for_actor_id`: `user-123` (próprio Actor)
   - `acting_for_account_id`: `account-user-123`
   - `authority_source`: `ownership`
   - `permission_snapshot`: `{ permission_key: "financial:execute_transfer", authority_source: "ownership" }`

3. **Funcionário executa em nome da empresa via delegação**
   - `performed_by_user_id`: `user-789`
   - `acting_for_actor_id`: `company-456`
   - `acting_for_account_id`: `account-cnpj-a`
   - `authority_source`: `delegation`
   - `delegation_id`: `deleg-123`
   - `permission_snapshot`: `{ permission_key: "financial:execute_transfer", authority_source: "delegation", delegation_id: "deleg-123" }`

4. **Funcionário executa via ACL da conta**
   - `performed_by_user_id`: `user-789`
   - `acting_for_actor_id`: `company-456`
   - `acting_for_account_id`: `account-cnpj-a`
   - `authority_source`: `account_acl`
   - `account_operator_id`: `operator-123`
   - `permission_snapshot`: `{ permission_key: "financial:execute_transfer", authority_source: "account_acl", account_operator_id: "operator-123" }`
   - `policy_snapshot`: `{ policies_checked: [{ policy_key: "allow_transfers_to_beneficiaries_only", result: "passed" }, ...] }`

---

## 10. INVARIANTES OBRIGATÓRIOS

### 10.1 Invariantes de Autoria

1. **Toda transação tem autoria completa**
   ```
   bank_transactions.performed_by_user_id IS NOT NULL
   bank_transactions.acting_for_actor_id IS NOT NULL
   bank_transactions.acting_for_account_id IS NOT NULL
   bank_transactions.authority_source IS NOT NULL
   bank_transactions.permission_snapshot IS NOT NULL
   ```

2. **Toda entrada no ledger tem autoria**
   ```
   bank_ledger.performed_by_user_id IS NOT NULL
   bank_ledger.acting_for_actor_id IS NOT NULL
   bank_ledger.acting_for_account_id IS NOT NULL
   ```

3. **Todo split tem autoria**
   ```
   bank_splits.performed_by_user_id IS NOT NULL
   bank_splits.acting_for_actor_id IS NOT NULL
   bank_splits.acting_for_account_id IS NOT NULL
   ```

### 10.4 Invariantes de ACL

1. **ACL tem precedência sobre delegação**
   ```
   Se user está em bank_account_operators para account_id
   E permission está em permissions_json
   Então usar ACL, não delegação do Actor
   ```

2. **Cada conta tem operadores independentes**
   ```
   bank_account_operators.account_id define escopo de operadores
   Operadores de account-A não podem operar account-B sem ACL explícita
   ```

### 10.5 Invariantes de Políticas

1. **Toda política ativa é verificada**
   ```
   Se bank_account_policies.status = 'active'
   E policy_key aplica-se à operação
   Então política DEVE ser verificada
   ```

2. **Nenhuma política pode ser contornada**
   ```
   Se política falhar, operação é NEGADA
   Não existe "bypass" ou "exceção" para políticas
   ```

3. **Policy snapshot é imutável**
   ```
   policy_snapshot registra estado no momento da verificação
   Não pode ser alterado após registro
   ```

### 10.2 Invariantes de Permissão

1. **Toda verificação passa por authorization.service**
   ```
   authorization.service.canActAs() é chamado antes de toda operação financeira
   ```

2. **Nenhuma permissão é inferida**
   ```
   Não existe lógica de permissão inline em services
   Não existe verificação de ownership direta sem authorization.service
   ```

3. **Delegação não permite operações por padrão**
   ```
   Apenas permissões explícitas em scopes_json são delegadas
   manage_financial não é delegado por padrão
   ```

### 10.3 Invariantes de Separação

1. **Actor é dono, User é operador**
   ```
   bank_accounts.owner_id + owner_type define dono (Actor)
   bank_transactions.executed_by_user_id define operador (User)
   ```

2. **Saldos são separados por Actor**
   ```
   Saldos são calculados por account_id, não por user_id
   Um CPF pode ter múltiplos Actors, cada um com saldo próprio
   ```

---

## 11. PROIBIÇÕES ABSOLUTAS

### 11.1 Proibições Estruturais

1. **NÃO criar transação sem autoria completa**
   - Proibido: Criar `bank_transaction` sem `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`, `permission_snapshot`
   - Permitido: Apenas com todos os campos de autoria explícitos

2. **NÃO criar ledger sem autoria**
   - Proibido: Criar `bank_ledger` sem `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`
   - Permitido: Apenas com todos os campos de autoria explícitos

3. **NÃO criar split sem autoria**
   - Proibido: Criar `bank_splits` sem `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`
   - Permitido: Apenas com todos os campos de autoria explícitos

4. **NÃO pular verificação de políticas**
   - Proibido: Criar transação sem verificar políticas ativas da conta
   - Permitido: Apenas após verificação explícita de todas as políticas aplicáveis

### 11.2 Proibições de Lógica

1. **NÃO verificar permissão inline**
   - Proibido: `if (user.id === account.owner_id) { allow }`
   - Permitido: Apenas via `authorization.service.canActAs()`

2. **NÃO inferir permissão do contexto**
   - Proibido: "Se user é funcionário, assume permissão"
   - Permitido: Apenas verificação explícita via `authorization.service`

3. **NÃO delegar operações financeiras por padrão**
   - Proibido: Delegar `manage_financial` automaticamente
   - Permitido: Apenas se explicitamente incluído em `scopes_json`

### 11.3 Proibições de Integração

1. **NÃO pular verificação de permissão**
   - Proibido: Criar transação sem verificar `canActAs()`
   - Permitido: Apenas após verificação explícita

2. **NÃO pular registro de autoria**
   - Proibido: Criar transação sem `executed_by_user_id`
   - Permitido: Apenas com autoria explícita

3. **NÃO misturar dono e operador**
   - Proibido: Usar `owner_id` como `executed_by_user_id`
   - Permitido: Apenas separação explícita (Actor vs User)

---

## 12. ERROS COMUNS QUE NÃO PODEM SER COMETIDOS

### 12.1 Erros Estruturais

1. **Criar transação sem autoria completa**
   - ❌ Errado: `INSERT INTO bank_transactions (...) VALUES (...)` sem `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`, `permission_snapshot`
   - ✅ Correto: Incluir todos os campos de autoria: `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`, `authority_source`, `permission_snapshot`, `policy_snapshot`

2. **Criar ledger sem autoria**
   - ❌ Errado: `INSERT INTO bank_ledger (...) VALUES (...)` sem `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`
   - ✅ Correto: Incluir todos os campos de autoria: `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`

3. **Criar split sem autoria**
   - ❌ Errado: `INSERT INTO bank_splits (...) VALUES (...)` sem `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`
   - ✅ Correto: Incluir todos os campos de autoria: `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`

4. **Pular verificação de políticas**
   - ❌ Errado: Criar transação sem verificar políticas ativas da conta
   - ✅ Correto: Verificar todas as políticas ativas antes de criar transação

### 12.2 Erros de Lógica

1. **Verificar permissão inline**
   - ❌ Errado: `if (user.id === account.owner_id) { allow }`
   - ✅ Correto: `await authorization.service.canActAs(tenantId, userId, actorId, 'manage_financial')`

2. **Inferir permissão do contexto**
   - ❌ Errado: "Se user é funcionário, assume permissão"
   - ✅ Correto: Verificar delegação explícita via `authorization.service`

3. **Delegar operações financeiras por padrão**
   - ❌ Errado: Delegar `manage_financial` automaticamente
   - ✅ Correto: Apenas se explicitamente incluído em `scopes_json`

### 12.3 Erros de Integração

1. **Pular verificação de permissão**
   - ❌ Errado: Criar transação sem verificar `canActAs()`
   - ✅ Correto: Verificar antes de criar transação

2. **Pular registro de autoria**
   - ❌ Errado: Criar transação sem `executed_by_user_id`
   - ✅ Correto: Incluir autoria em toda transação

3. **Misturar dono e operador**
   - ❌ Errado: Usar `owner_id` como `executed_by_user_id`
   - ✅ Correto: Separar explicitamente (Actor vs User)

---

## 13. CHECKLIST PARA IAs E HUMANOS ANTES DE ALTERAR O SISTEMA

### 13.1 Checklist Obrigatório

Antes de criar, alterar ou sugerir qualquer coisa relacionada a permissões financeiras, responder explicitamente:

#### 13.1.1 Autoria

- [ ] **Toda transação registra autoria completa?**
  - Resposta obrigatória: Sim, via `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`, `permission_snapshot`
  - Se não, a proposta é **PROIBIDA**

- [ ] **Toda entrada no ledger registra autoria?**
  - Resposta obrigatória: Sim, via `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`
  - Se não, a proposta é **PROIBIDA**

- [ ] **Todo split registra autoria?**
  - Resposta obrigatória: Sim, via `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`
  - Se não, a proposta é **PROIBIDA**

- [ ] **Toda transação registra permission snapshot?**
  - Resposta obrigatória: Sim, via `permission_snapshot`
  - Se não, a proposta é **PROIBIDA**

- [ ] **Toda transação registra policy snapshot?**
  - Resposta obrigatória: Sim, via `policy_snapshot` (se políticas foram verificadas)
  - Se não, a proposta é **PROIBIDA**

#### 13.1.2 Permissões

- [ ] **Toda verificação de permissão passa por authorization.service?**
  - Resposta obrigatória: Sim, via `authorization.service.canActAs()`
  - Se não, a proposta é **PROIBIDA**

- [ ] **Nenhuma permissão é inferida do contexto?**
  - Resposta obrigatória: Não, todas são explícitas
  - Se sim, a proposta é **PROIBIDA**

- [ ] **Delegação não permite operações financeiras por padrão?**
  - Resposta obrigatória: Não, apenas se explicitamente incluído
  - Se sim, a proposta é **PROIBIDA**

#### 13.1.3 Separação

- [ ] **Actor é dono, User é operador?**
  - Resposta obrigatória: Sim, separação explícita
  - Se não, a proposta é **PROIBIDA**

- [ ] **Saldos são separados por Actor?**
  - Resposta obrigatória: Sim, nunca misturar
  - Se não, a proposta é **PROIBIDA**

#### 13.1.4 ACL e Políticas

- [ ] **ACL por conta é suportada?**
  - Resposta obrigatória: Sim, via `bank_account_operators`
  - Se não, a proposta é **PROIBIDA**

- [ ] **Permissões granulares são suportadas?**
  - Resposta obrigatória: Sim, cada operação tem sua própria permissão
  - Se não, a proposta é **PROIBIDA**

- [ ] **Políticas condicionais são verificadas?**
  - Resposta obrigatória: Sim, todas as políticas ativas são verificadas
  - Se não, a proposta é **PROIBIDA**

### 13.2 Condições de Bloqueio Automático

A proposta é **AUTOMATICAMENTE BLOQUEADA** se:

1. Criar transação sem `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`, `permission_snapshot`
2. Criar ledger sem `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`
3. Criar split sem `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`
4. Verificar permissão inline em services
5. Inferir permissão do contexto
6. Delegar operações financeiras por padrão
7. Pular verificação de permissão
8. Pular registro de autoria
9. Misturar dono e operador
10. Pular verificação de políticas condicionais
11. Contornar política ativa
12. Usar permissão genérica para todas as operações

### 13.3 Validação Final

Antes de aprovar qualquer proposta:

1. **Verificar conformidade com este documento**
   - Se conflitar, **RECUSAR**

2. **Verificar conformidade com CORE_IMUTAVEL.md**
   - Se conflitar, **RECUSAR**

3. **Verificar conformidade com IDENTITY_CORE_CONTRACT.md**
   - Se conflitar, **RECUSAR**

4. **Verificar conformidade com DECISION_CORE_CONTRACT.md**
   - Se conflitar, **RECUSAR**

5. **Verificar conformidade com CORE_SPLIT_PAGAMENTO_CANONICO.md**
   - Se conflitar, **RECUSAR**

---

## DECLARAÇÃO INSTITUCIONAL FINAL

**No UnifiCard, permissões financeiras são Core.**  
**Toda operação financeira deve ter autoria rastreável.**  
**Actor é dono, User é operador.**  
**Nenhuma permissão pode ser inferida implicitamente.**  

**Permissões financeiras pertencem ao Core de Autorização.**  
**Autoria financeira é parte do Core Financeiro.**  
**ACL por conta, políticas condicionais e beneficiários são parte do Core Financeiro.**  
**Ambos são Core Imutável.**  

**O Core deve suportar cenários reais de mercado:**
- **Operadores diferentes por conta**: Um Actor pode ter múltiplas contas, cada uma com sua própria lista de operadores
- **Permissões granulares**: Cada operação financeira tem sua própria permissão (criar, aprovar, executar)
- **Políticas condicionais obrigatórias**: Transferências apenas para favorecidos, limites por transação/período, múltiplas aprovações (4 olhos)
- **Auditoria obrigatória completa**: Toda ação registra quem executou, em nome de quem, qual permissão autorizou e quais políticas foram verificadas

**Se qualquer proposta conflitar com este documento:**  
**➡️ RECUSAR**  
**➡️ NUNCA flexibilizar o Core**

---

**Este documento prevalece sobre:**
- Documentação técnica
- Decisões de produto
- Decisões de negócio
- Pressões comerciais
- Otimizações de performance
- Sugestões de IA
- Conveniências de implementação

**Se algo conflitar com este CORE:**
**➡️ elimina-se a proposta**  
**➡️ NUNCA o CORE**

---

**Fim do Documento Canônico**

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CORE_FINANCIAL_CONTRACT.md
- CORE_IMUTAVEL.md
- CORE_SPLIT_PAGAMENTO_CANONICO.md
- IDENTITY_CORE_CONTRACT.md
- MAPA_CANONICO_PERMISSIONS_v1.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
- CORE_APROVACAO_FINANCEIRA_CANONICO.md
- CORE_FINANCIAL_CONTRACT.md
- HARDENING_CYCLE_CLOSURE.md
<!-- AUTO-GENERATED-END -->