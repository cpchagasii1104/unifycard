Status: SUBORDINATED
Domain: Financial
Governing Contract: CORE_FINANCIAL_CONTRACT.md
# CORE DE APROVAÇÃO FINANCEIRA CANÔNICO — UNIFICARD

**Status:** IMUTÁVEL  
**Autoridade:** NÍVEL 1 (CORE / LEI DO SISTEMA)  
**Escopo:** Todo o sistema financeiro do UnifiCard  
**Aplicação:** Código, banco, serviços, IAs e decisões humanas  

---

## DEFINIÇÃO ABSOLUTA

O **CORE DE APROVAÇÃO FINANCEIRA** é a estrutura única, não duplicável e não substituível que define **se uma operação financeira crítica pode ou não prosseguir** no UnifiCard.

**Aprovação financeira** é a **decisão explícita** que ocorre:
- **ANTES** da execução financeira
- **ANTES** do ledger
- **ANTES** do split
- **ANTES** do estorno manual

**Regra absoluta:**  
**Nenhuma operação financeira crítica ocorre sem decisão explícita de aprovação.**  
**Aprovação NÃO altera saldo.**  
**Aprovação NÃO cria transação.**  
**Aprovação NÃO cria ledger.**  
**Toda aprovação é auditável.**  
**Toda reprovação é auditável.**

---

## 1. DEFINIÇÃO CANÔNICA

### 1.1 O Que É Aprovação Financeira

**Aprovação financeira** é o processo de **decisão explícita** que determina se uma operação financeira crítica pode ser executada.

**Aprovação financeira:**
- Decide **SE** uma operação pode prosseguir
- Não executa a operação
- Não altera saldo
- Não cria transação
- Não cria ledger
- Gera registro imutável de decisão
- É auditável e rastreável

### 1.2 O Que NÃO É Aprovação Financeira

**Aprovação financeira NÃO é:**
- Permissão (verificação de quem pode executar)
- Execução (realização da operação)
- Validação (verificação de dados)
- Autorização (verificação de permissões)
- Split (distribuição de valores)
- Ledger (registro contábil)

### 1.3 Diferença Entre Permissão, Aprovação e Execução

**PERMISSÃO:**
- Verifica **SE** um operador tem direito de executar
- Ocorre via `authorization.service.canActAs()`
- Verifica `permission_key` no `MAPA_CANONICO_PERMISSIONS_v1.md`
- Não decide se a operação prossegue, apenas se o operador pode solicitar

**APROVAÇÃO:**
- Decide **SE** uma operação específica pode prosseguir
- Ocorre após verificação de permissão
- Verifica limites, políticas e regras de negócio
- Gera `approval_request` e coleta aprovações necessárias
- Decisão final: `approved` / `rejected` / `expired`

**EXECUÇÃO:**
- **FAZ** a operação após aprovação
- Cria transação no `bank_transactions`
- Cria entradas no `bank_ledger`
- Cria splits no `bank_splits`
- Altera saldos

**Regra absoluta:**  
**Permissão verifica QUEM pode solicitar.**  
**Aprovação decide SE a operação prossegue.**  
**Execução FAZ a operação após aprovação.**

**Ordem obrigatória:**
1. Verificar permissão (`authorization.service.canActAs()`)
2. Avaliar limites e políticas
3. Gerar `approval_request` (se necessário)
4. Coletar aprovações (se necessário)
5. Decisão final de aprovação
6. Executar operação financeira (apenas se `approved`)

---

## 2. PRINCÍPIOS INQUEBRÁVEIS

### 2.1 Nenhuma Operação Financeira Crítica Ocorre Sem Decisão Explícita

**Regra absoluta:**  
**Toda operação financeira crítica requer decisão explícita de aprovação antes da execução.**

**O que isso significa:**
- Operações críticas não podem ser executadas sem aprovação
- Aprovação deve ser explícita e rastreável
- Não há "auto-approve" sem política explícita
- Não há aprovação implícita

**Exceções:**
- Operações abaixo de limite mínimo (definido por política)
- Operações do sistema (jobs internos, com `authority_source='system'`)
- Estornos externos (reversão automática de transação externa)

### 2.2 Aprovação NÃO Altera Saldo

**Regra absoluta:**  
**Aprovação financeira NÃO altera saldo de contas.**

**O que isso significa:**
- Aprovação não cria transação
- Aprovação não cria ledger
- Aprovação não altera `cached_balance`
- Aprovação apenas registra decisão

**Saldo só é alterado após:**
- Aprovação concedida
- Execução financeira realizada
- Ledger criado

### 2.3 Aprovação NÃO Cria Transação

**Regra absoluta:**  
**Aprovação financeira NÃO cria transação no `bank_transactions`.**

**O que isso significa:**
- `approval_request` não é transação
- Aprovação não cria transação
- Transação só é criada após aprovação e execução

### 2.4 Aprovação NÃO Cria Ledger

**Regra absoluta:**  
**Aprovação financeira NÃO cria entrada no `bank_ledger`.**

**O que isso significa:**
- Aprovação não altera ledger
- Ledger só é criado após aprovação e execução
- Ledger é imutável e append-only

### 2.5 Toda Aprovação É Auditável

**Regra absoluta:**  
**Toda decisão de aprovação deve ser rastreável e auditável.**

**O que isso significa:**
- Toda aprovação registra quem aprovou
- Toda aprovação registra quando foi aprovada
- Toda aprovação registra qual regra foi aplicada
- Toda aprovação registra qual limite foi verificado
- Toda aprovação registra snapshot da política

### 2.6 Toda Reprovação É Auditável

**Regra absoluta:**  
**Toda decisão de reprovação deve ser rastreável e auditável.**

**O que isso significa:**
- Toda reprovação registra quem rejeitou
- Toda reprovação registra quando foi rejeitada
- Toda reprovação registra motivo da rejeição
- Toda reprovação registra qual regra foi violada
- Toda reprovação registra qual limite foi excedido

---

## 3. TIPOS DE OPERAÇÕES SUJEITAS À APROVAÇÃO

### 3.1 Operações Obrigatoriamente Sujeitas à Aprovação

**Lista explícita de operações que SEMPRE requerem aprovação:**

1. **Transferência**
   - Transferência entre contas
   - Transferência acima de limite configurado
   - Transferência para conta externa (se política exigir)

2. **Pagamento**
   - Pagamento acima de limite configurado
   - Pagamento para beneficiário não cadastrado (se política exigir)
   - Pagamento via Pix (se política exigir)

3. **Estorno Manual**
   - Estorno manual de transação
   - Estorno acima de limite configurado
   - Estorno de transação antiga (acima de X dias)

4. **Alteração de Beneficiários**
   - Adicionar beneficiário
   - Remover beneficiário
   - Alterar dados de beneficiário

5. **Alteração de Limites**
   - Alterar limite por transação
   - Alterar limite por período
   - Alterar limite por operador

6. **Alteração de Políticas**
   - Ativar/desativar política condicional
   - Alterar regra de 4 olhos
   - Alterar regra de beneficiários

7. **Operações Acima de Limite**
   - Qualquer operação acima do limite configurado
   - Operação que excede limite por período

8. **Operações Cross-Account**
   - Transferência entre contas de Actors diferentes
   - Transferência entre contas de CPFs diferentes

9. **Operações Cross-Actor**
   - Operação em nome de Actor diferente do operador
   - Operação com delegação

10. **Operações Cross-Tenant**
    - Operação entre tenants (se existir)
    - Operação com tenant externo

### 3.2 Operações NÃO Sujeitas à Aprovação

**Lista explícita de operações que NÃO requerem aprovação:**

1. **Estornos Externos**
   - Reversão automática de transação externa
   - Estorno de gateway de pagamento
   - Estorno de banco externo

2. **Operações do Sistema**
   - Jobs internos (com `authority_source='system'`)
   - Processamento automático de splits
   - Processamento automático de fees

3. **Operações Abaixo de Limite Mínimo**
   - Operações abaixo do limite mínimo configurado
   - Operações com `auto_approve` ativo (se política permitir)

**Regra absoluta:**  
**Operações não sujeitas à aprovação ainda requerem verificação de permissão via `authorization.service.canActAs()`.**

---

## 4. MODELO DE LIMITES

### 4.1 Definição de Limites

**Limites** são valores máximos configuráveis que restringem operações financeiras.

**Limites podem ser configurados por:**
- Conta (`bank_accounts.account_id`)
- Actor (`actors.actor_id`)
- Usuário operador (`users.user_id`)
- Tipo de operação (`transaction_type`)
- Canal de pagamento (`channel`: Pix, TED, interno)
- Destino (`to_account_id`: beneficiário interno vs externo)

### 4.2 Tipos de Limites

**1. Limite por Transação**
- Valor máximo por operação única
- Configurável por conta, operador, tipo de operação
- Exemplo: R$ 10.000,00 por transferência

**2. Limite por Período**
- Valor máximo acumulado em período
- Períodos: diário, semanal, mensal
- Configurável por conta, operador, tipo de operação
- Exemplo: R$ 50.000,00 por dia

**3. Limite por Canal**
- Valor máximo por canal de pagamento
- Canais: Pix, TED, transferência interna
- Configurável por conta, operador
- Exemplo: R$ 5.000,00 por Pix

**4. Limite por Destino**
- Valor máximo para beneficiário específico
- Valor máximo para beneficiários externos
- Configurável por conta
- Exemplo: R$ 20.000,00 para beneficiário externo

### 4.3 Hierarquia de Limites

**Regra absoluta:**  
**Sempre vale o MENOR limite aplicável.**

**Hierarquia (do mais restritivo ao menos restritivo):**
1. **Limite do Sistema** (global, não configurável)
2. **Limite da Conta** (`bank_account_policies.transaction_limits`)
3. **Limite do Operador** (`bank_account_operators.operator_limits`)
4. **Limite do Tipo de Operação** (`bank_account_policies.operation_limits`)
5. **Limite do Canal** (`bank_account_policies.channel_limits`)
6. **Limite do Destino** (`bank_account_policies.destination_limits`)

**Exemplo:**
- Limite do sistema: R$ 1.000.000,00
- Limite da conta: R$ 100.000,00
- Limite do operador: R$ 50.000,00
- Limite por transação: R$ 10.000,00

**Resultado:** Operação de R$ 15.000,00 é **NEGADA** (excede limite por transação de R$ 10.000,00).

### 4.4 Estrutura de Limites

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

**Exemplo de `policy_value` para limites:**

```json
{
  "limit_per_transaction": 10000.00,
  "limit_per_day": 50000.00,
  "limit_per_week": 200000.00,
  "limit_per_month": 500000.00,
  "limit_per_channel": {
    "pix": 5000.00,
    "ted": 100000.00,
    "internal": 1000000.00
  },
  "limit_per_destination": {
    "internal": 1000000.00,
    "external": 20000.00
  }
}
```

**Regra absoluta:**  
**Limites são obrigatórios e não podem ser contornados.**  
**Operação acima de limite requer aprovação explícita.**

---

## 5. MODELO DE APROVAÇÃO

### 5.1 Aprovação Simples

**Aprovação simples** requer **uma única aprovação** de um aprovador autorizado.

**Características:**
- Uma aprovação é suficiente
- Aprovador deve ter permissão `financial:approve_transfer` ou `financial:approve_payment`
- Aprovação é imediata (sem timeout)
- Aprovação pode ser revogada antes da execução

**Aplicação:**
- Operações abaixo de limite de 4 olhos
- Operações com política de aprovação simples

### 5.2 Aprovação Múltipla (4 Olhos)

**Aprovação múltipla** requer **múltiplas aprovações** de aprovadores diferentes.

**Características:**
- Requer N aprovações (configurável, mínimo 2)
- Cada aprovador deve ser diferente
- Cada aprovador deve ter permissão `financial:approve_transfer` ou `financial:approve_payment`
- Aprovações podem ser sequenciais ou paralelas (configurável)

**Aplicação:**
- Operações acima de limite de 4 olhos
- Operações com política `require_dual_approval_above_amount`

### 5.3 Regra de 4 Olhos

**Regra de 4 olhos** é um caso especial de aprovação múltipla que requer **exatamente 2 aprovações** de aprovadores diferentes.

**Características:**
- Requer exatamente 2 aprovações
- Cada aprovador deve ser diferente
- Cada aprovador deve ter permissão `financial:approve_transfer` ou `financial:approve_payment`
- Aprovações podem ser sequenciais ou paralelas (configurável)

**Aplicação:**
- Operações acima de valor configurado (ex: R$ 50.000,00)
- Operações críticas definidas por política

### 5.4 Aprovação Sequencial vs Paralela

**Aprovação Sequencial:**
- Aprovações devem ocorrer em ordem
- Segunda aprovação só pode ocorrer após primeira
- Cada aprovador vê aprovações anteriores

**Aprovação Paralela:**
- Aprovações podem ocorrer em qualquer ordem
- Aprovadores não veem aprovações de outros até todas serem coletadas
- Todas as aprovações devem ser coletadas

**Regra absoluta:**  
**Tipo de aprovação (sequencial vs paralela) é configurável por política.**  
**Padrão: sequencial.**

### 5.5 Timeout de Aprovação

**Timeout de aprovação** é o tempo máximo que uma solicitação de aprovação permanece pendente.

**Características:**
- Timeout configurável por política
- Padrão: 24 horas
- Após timeout, solicitação expira automaticamente
- Solicitação expirada não pode ser aprovada
- Solicitação expirada deve ser recriada

**Regra absoluta:**  
**Solicitação de aprovação expirada NÃO pode ser executada.**  
**Solicitação expirada deve ser recriada.**

### 5.6 Cancelamento Automático

**Cancelamento automático** ocorre quando:
- Solicitação de aprovação expira (timeout)
- Operação é cancelada pelo solicitante
- Operação é rejeitada por aprovador

**Regra absoluta:**  
**Solicitação cancelada NÃO pode ser executada.**  
**Solicitação cancelada NÃO pode ser aprovada.**

---

## 6. MATRIZ DE AUTORIDADE

### 6.1 Definição de Papéis

**SOLICITANTE:**
- Usuário que solicita a operação financeira
- Deve ter permissão para solicitar (`financial:create_transfer`, `financial:create_payment`)
- Registrado em `approval_request.requested_by_user_id`

**APROVADOR:**
- Usuário que aprova a operação financeira
- Deve ter permissão para aprovar (`financial:approve_transfer`, `financial:approve_payment`)
- Registrado em `approval_request.approved_by_user_id[]`

**EXECUTOR:**
- Sistema que executa a operação financeira após aprovação
- Não é usuário, é o próprio sistema
- Registrado em `bank_transactions.performed_by_user_id` (pode ser o solicitante ou aprovador)

**DONO:**
- Actor que possui a conta financeira
- Não executa diretamente, mas é responsável legal
- Registrado em `bank_accounts.owner_id` + `owner_type`

### 6.2 Separação de Responsabilidades

**Regra absoluta:**  
**Solicitante, aprovador e executor podem ser pessoas diferentes.**

**Exemplo:**
- Solicitante: Funcionário (user-123)
- Aprovador 1: Gerente (user-456)
- Aprovador 2: Diretor (user-789)
- Executor: Sistema (executa após aprovação)
- Dono: Empresa (actor-company-abc)

### 6.3 Conexão com Authority Source

**Aprovação financeira conecta com `authority_source`:**

- **`ownership`**: Solicitante é dono da conta
- **`delegation`**: Solicitante tem delegação do Actor
- **`account_acl`**: Solicitante tem permissão via ACL da conta
- **`system`**: Operação do sistema (não requer aprovação)

**Regra absoluta:**  
**Aprovação financeira NÃO altera `authority_source`.**  
**`authority_source` é determinado pela permissão, não pela aprovação.**

### 6.4 Conexão com Acting For

**Aprovação financeira conecta com `acting_for_actor_id` e `acting_for_account_id`:**

- **`acting_for_actor_id`**: Actor em nome do qual a operação é executada
- **`acting_for_account_id`**: Conta em nome da qual a operação é executada

**Regra absoluta:**  
**Aprovação financeira valida se solicitante pode operar em nome do Actor/Conta.**  
**Aprovação financeira NÃO altera `acting_for_actor_id` ou `acting_for_account_id`.**

---

## 7. FLUXO CANÔNICO DE APROVAÇÃO

### 7.1 Fluxo Completo

```
1. SOLICITAÇÃO DE OPERAÇÃO
   └─> POST /bank/transfers
   └─> Body: { from_account_id, to_account_id, amount, ... }
   └─> User: user-123 (solicitante)
   └─> Actor: actor-company-abc (dono da conta)

2. VERIFICAR PERMISSÃO
   └─> authorizationService.canActAs(tenantId, userId, actorId, 'financial:create_transfer')
   └─> Retorna: { allowed: true, authoritySource: 'delegation', reason: '...' }
   └─> Se NEGADO → ERRO 403 (sem aprovação)

3. AVALIAR LIMITES
   └─> Verificar limite por transação
   └─> Verificar limite por período
   └─> Verificar limite por canal
   └─> Verificar limite por destino
   └─> Se EXCEDE LIMITE → Requer aprovação
   └─> Se DENTRO DO LIMITE → Pode prosseguir (se política permitir auto-approve)

4. AVALIAR POLÍTICAS
   └─> Verificar política de beneficiários (se aplicável)
   └─> Verificar política de 4 olhos (se aplicável)
   └─> Verificar política de canal (se aplicável)
   └─> Se POLÍTICA EXIGE APROVAÇÃO → Requer aprovação
   └─> Se POLÍTICA PERMITE AUTO-APPROVE → Pode prosseguir

5. GERAR APPROVAL_REQUEST
   └─> INSERT INTO approval_requests (
         requested_by_user_id,
         acting_for_actor_id,
         acting_for_account_id,
         operation_type,
         operation_data,
         required_approvals,
         status = 'pending',
         expires_at
       )
   └─> Retorna: approval_request_id

6. COLETAR APROVAÇÕES
   └─> Se aprovação simples:
         └─> Aguardar 1 aprovação
   └─> Se aprovação múltipla (4 olhos):
         └─> Aguardar N aprovações (mínimo 2)
   └─> Se aprovação sequencial:
         └─> Aguardar aprovações em ordem
   └─> Se aprovação paralela:
         └─> Aguardar todas as aprovações (qualquer ordem)

7. DECISÃO FINAL
   └─> Se todas as aprovações coletadas:
         └─> status = 'approved'
   └─> Se timeout expirado:
         └─> status = 'expired'
   └─> Se rejeitado por aprovador:
         └─> status = 'rejected'

8. LIBERAÇÃO PARA EXECUÇÃO FINANCEIRA
   └─> Se status = 'approved':
         └─> Executar operação financeira
         └─> Criar transação em bank_transactions
         └─> Criar entradas em bank_ledger
         └─> Criar splits em bank_splits
         └─> Registrar autoria (performed_by_user_id, acting_for_actor_id, ...)
   └─> Se status != 'approved':
         └─> NÃO executar operação
         └─> Retornar erro ao solicitante
```

### 7.2 Estrutura de Approval Request

**Tabela canônica:** `approval_requests`

```sql
approval_requests (
    approval_request_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    requested_by_user_id UUID NOT NULL REFERENCES users(user_id),
    acting_for_actor_id UUID NOT NULL REFERENCES actors(actor_id),
    acting_for_account_id UUID NOT NULL REFERENCES bank_accounts(account_id),
    operation_type VARCHAR(50) NOT NULL CHECK (operation_type IN (
        'transfer', 'payment', 'manual_refund', 
        'add_beneficiary', 'remove_beneficiary',
        'change_limit', 'change_policy'
    )),
    operation_data JSONB NOT NULL,
    required_approvals INTEGER NOT NULL DEFAULT 1 CHECK (required_approvals >= 1),
    approval_type VARCHAR(20) NOT NULL DEFAULT 'sequential' CHECK (approval_type IN ('sequential', 'parallel')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
)
```

**Tabela canônica:** `approval_votes`

```sql
approval_votes (
    vote_id UUID PRIMARY KEY,
    approval_request_id UUID NOT NULL REFERENCES approval_requests(approval_request_id),
    voted_by_user_id UUID NOT NULL REFERENCES users(user_id),
    vote_type VARCHAR(20) NOT NULL CHECK (vote_type IN ('approve', 'reject')),
    reason TEXT,
    permission_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
)
```

**Regra absoluta:**  
**Toda aprovação registra quem aprovou, quando aprovou e qual permissão autorizou.**

---

## 8. INTEGRAÇÃO COM ESTORNOS

### 8.1 Estorno Externo

**Estorno externo** é a reversão automática de transação originada em sistema externo (gateway, banco, etc).

**Características:**
- Não passa por aprovação
- É automático e imediato
- Replica split original (invertido)
- Não altera transação original
- Registra `authority_source='system'`

**Regra absoluta:**  
**Estorno externo NÃO requer aprovação.**  
**Estorno externo é automático e imediato.**

### 8.2 Estorno Manual

**Estorno manual** é a reversão manual de transação originada no próprio sistema.

**Características:**
- **SEMPRE** passa por aprovação
- Requer permissão `financial:create_refund`
- Requer aprovação (com limites próprios)
- Replica split original (invertido)
- Não altera transação original
- Registra `authority_source` do aprovador

**Regra absoluta:**  
**Estorno manual SEMPRE requer aprovação.**  
**Estorno manual tem limites próprios (configuráveis).**

### 8.3 Limites de Estorno

**Limites de estorno** são configuráveis e independentes dos limites de operação normal.

**Características:**
- Limite por transação de estorno
- Limite por período de estorno
- Limite por idade da transação original (ex: não estornar transação com mais de 30 dias)
- Configurável por conta

**Regra absoluta:**  
**Estorno manual acima de limite requer aprovação múltipla (4 olhos).**

### 8.4 Replicação de Split

**Regra absoluta:**  
**Estorno replica split original (invertido).**

**O que isso significa:**
- Estorno cria splits inversos aos splits originais
- Estorno não altera splits originais
- Estorno mantém rastreabilidade completa

**Exemplo:**
- Transação original: R$ 1.000,00
  - Split 1: R$ 800,00 para conta A
  - Split 2: R$ 200,00 para conta B
- Estorno: R$ 1.000,00
  - Split 1: -R$ 800,00 para conta A (invertido)
  - Split 2: -R$ 200,00 para conta B (invertido)

---

## 9. AUDITORIA E COMPLIANCE

### 9.1 Campos Auditáveis Obrigatórios

**Toda aprovação financeira deve registrar:**

1. **Quem Solicitou**
   - `approval_request.requested_by_user_id`
   - `approval_request.requested_at` (timestamp)

2. **Quem Aprovou**
   - `approval_votes.voted_by_user_id[]`
   - `approval_votes.vote_type` ('approve' ou 'reject')
   - `approval_votes.created_at` (timestamp)

3. **Quem Rejeitou**
   - `approval_votes.voted_by_user_id` (se `vote_type='reject'`)
   - `approval_votes.reason` (motivo da rejeição)
   - `approval_votes.created_at` (timestamp)

4. **Quando**
   - `approval_request.created_at`
   - `approval_request.updated_at`
   - `approval_votes.created_at`

5. **Por Qual Regra**
   - `approval_request.operation_type`
   - `approval_request.required_approvals`
   - `approval_request.approval_type`

6. **Qual Limite Foi Aplicado**
   - `approval_request.operation_data.limit_applied` (snapshot do limite)
   - `approval_request.operation_data.limit_exceeded` (se excedeu)

7. **Snapshot da Política**
   - `approval_request.operation_data.policy_snapshot` (snapshot da política no momento da solicitação)

### 9.2 Rastreabilidade Completa

**Regra absoluta:**  
**Toda aprovação financeira deve ser rastreável do início ao fim.**

**Rastreabilidade inclui:**
- Quem solicitou a operação
- Quem aprovou a operação
- Quem executou a operação
- Qual permissão autorizou
- Qual política foi aplicada
- Qual limite foi verificado
- Quando cada etapa ocorreu

### 9.3 Relatórios de Auditoria

**Sistema deve permitir gerar relatórios de auditoria por:**
- Aprovador (todas as aprovações de um usuário)
- Solicitante (todas as solicitações de um usuário)
- Conta (todas as aprovações de uma conta)
- Actor (todas as aprovações de um Actor)
- Período (todas as aprovações em um período)
- Tipo de operação (todas as aprovações de um tipo)
- Status (aprovadas, rejeitadas, expiradas)

**Regra absoluta:**  
**Relatórios de auditoria devem ser geráveis sem violar modelo de Actor ou misturar saldos.**

---

## 10. PROIBIÇÕES ABSOLUTAS

### 10.1 Executar Pagamento Sem Decisão de Aprovação

**PROIBIDO:** Executar pagamento sem decisão explícita de aprovação.

**O que isso significa:**
- Não pode executar pagamento com `status='pending'`
- Não pode executar pagamento sem `approval_request_id`
- Não pode executar pagamento com `approval_request.status != 'approved'`

**Exceção:** Operações abaixo de limite mínimo com `auto_approve` ativo (se política permitir).

### 10.2 Alterar Decisão Após Execução

**PROIBIDO:** Alterar decisão de aprovação após execução financeira.

**O que isso significa:**
- Não pode alterar `approval_request.status` após execução
- Não pode adicionar/remover `approval_votes` após execução
- Não pode alterar `approval_request.operation_data` após execução

**Regra absoluta:**  
**Decisão de aprovação é imutável após execução.**

### 10.3 Aprovar Operação Sem Rastreabilidade

**PROIBIDO:** Aprovar operação sem registro completo de rastreabilidade.

**O que isso significa:**
- Não pode aprovar sem registrar `voted_by_user_id`
- Não pode aprovar sem registrar `permission_snapshot`
- Não pode aprovar sem registrar `policy_snapshot`
- Não pode aprovar sem registrar `created_at`

**Regra absoluta:**  
**Toda aprovação deve ser rastreável e auditável.**

### 10.4 Aprovação Implícita

**PROIBIDO:** Aprovação implícita ou automática sem política explícita.

**O que isso significa:**
- Não pode "assumir" aprovação
- Não pode "inferir" aprovação
- Não pode "auto-aprovar" sem política explícita
- Não pode "pular" aprovação por conveniência

**Exceção:** Operações abaixo de limite mínimo com `auto_approve` ativo (se política permitir).

### 10.5 Auto-Approve Sem Política Explícita

**PROIBIDO:** Auto-approve sem política explícita configurada.

**O que isso significa:**
- Não pode auto-aprovar sem `bank_account_policies.auto_approve_enabled = true`
- Não pode auto-aprovar sem `bank_account_policies.auto_approve_limit` configurado
- Não pode auto-aprovar acima do limite configurado

**Regra absoluta:**  
**Auto-approve requer política explícita e configurada.**

### 10.6 Aprovação Sem Verificação de Permissão

**PROIBIDO:** Aprovar operação sem verificar permissão do aprovador.

**O que isso significa:**
- Não pode aprovar sem verificar `authorization.service.canActAs(..., 'financial:approve_transfer')`
- Não pode aprovar sem verificar `authorization.service.canActAs(..., 'financial:approve_payment')`
- Não pode aprovar sem `permission_snapshot`

**Regra absoluta:**  
**Toda aprovação requer verificação de permissão explícita.**

### 10.7 Executar Operação Com Aprovação Expirada

**PROIBIDO:** Executar operação com aprovação expirada.

**O que isso significa:**
- Não pode executar com `approval_request.status = 'expired'`
- Não pode executar com `approval_request.expires_at < NOW()`
- Não pode "renovar" aprovação expirada

**Regra absoluta:**  
**Aprovação expirada requer nova solicitação.**

### 10.8 Aprovar Operação Acima de Limite Sem Aprovação Múltipla

**PROIBIDO:** Aprovar operação acima de limite de 4 olhos sem aprovação múltipla.

**O que isso significa:**
- Não pode aprovar operação acima de `require_dual_approval_above_amount` com apenas 1 aprovação
- Não pode "pular" aprovação múltipla por conveniência
- Não pode "assumir" segunda aprovação

**Regra absoluta:**  
**Operação acima de limite de 4 olhos requer aprovação múltipla obrigatória.**

---

## 11. CHECKLIST INSTITUCIONAL

### 11.1 Antes de Criar Nova Operação Financeira

**Checklist obrigatório:**

- [ ] **Operação requer aprovação?**
  - Resposta obrigatória: Sim ou Não (com justificativa)
  - Se Sim, definir tipo de aprovação (simples, múltipla, 4 olhos)
  - Se Não, justificar por que não requer

- [ ] **Limites configurados?**
  - Resposta obrigatória: Sim, limites definidos em `bank_account_policies`
  - Definir limite por transação
  - Definir limite por período
  - Definir limite por canal (se aplicável)

- [ ] **Políticas configuradas?**
  - Resposta obrigatória: Sim, políticas definidas em `bank_account_policies`
  - Definir política de beneficiários (se aplicável)
  - Definir política de 4 olhos (se aplicável)
  - Definir política de auto-approve (se aplicável)

- [ ] **Permissões definidas?**
  - Resposta obrigatória: Sim, permissões definidas em `MAPA_CANONICO_PERMISSIONS_v1.md`
  - Definir `financial:create_<operation>`
  - Definir `financial:approve_<operation>`
  - Definir `financial:execute_<operation>`

- [ ] **Fluxo de aprovação documentado?**
  - Resposta obrigatória: Sim, fluxo documentado
  - Documentar quando requer aprovação
  - Documentar quantas aprovações requer
  - Documentar timeout de aprovação

- [ ] **Auditoria implementada?**
  - Resposta obrigatória: Sim, auditoria implementada
  - Registrar quem solicitou
  - Registrar quem aprovou
  - Registrar quando aprovou
  - Registrar qual regra foi aplicada

**Se qualquer item não for atendido, a proposta é PROIBIDA.**

### 11.2 Antes de Criar Novo Tipo de Estorno

**Checklist obrigatório:**

- [ ] **Estorno é manual ou externo?**
  - Resposta obrigatória: Manual ou Externo
  - Se Manual, requer aprovação
  - Se Externo, não requer aprovação

- [ ] **Limites de estorno configurados?**
  - Resposta obrigatória: Sim, limites definidos
  - Definir limite por transação de estorno
  - Definir limite por período de estorno
  - Definir limite por idade da transação original

- [ ] **Replicação de split implementada?**
  - Resposta obrigatória: Sim, split replicado (invertido)
  - Garantir que split original não é alterado
  - Garantir que split de estorno é invertido

- [ ] **Rastreabilidade implementada?**
  - Resposta obrigatória: Sim, rastreabilidade implementada
  - Registrar quem solicitou estorno
  - Registrar quem aprovou estorno (se manual)
  - Registrar transação original

**Se qualquer item não for atendido, a proposta é PROIBIDA.**

### 11.3 Antes de Criar Novo Canal de Pagamento

**Checklist obrigatório:**

- [ ] **Canal requer aprovação?**
  - Resposta obrigatória: Sim ou Não (com justificativa)
  - Se Sim, definir tipo de aprovação
  - Se Não, justificar por que não requer

- [ ] **Limites por canal configurados?**
  - Resposta obrigatória: Sim, limites definidos em `bank_account_policies.channel_limits`
  - Definir limite por transação no canal
  - Definir limite por período no canal

- [ ] **Políticas por canal configuradas?**
  - Resposta obrigatória: Sim, políticas definidas
  - Definir política de beneficiários (se aplicável)
  - Definir política de 4 olhos (se aplicável)

- [ ] **Permissões por canal definidas?**
  - Resposta obrigatória: Sim, permissões definidas
  - Definir `financial:create_<channel>_payment`
  - Definir `financial:approve_<channel>_payment`
  - Definir `financial:execute_<channel>_payment`

**Se qualquer item não for atendido, a proposta é PROIBIDA.**

### 11.4 Antes de Criar Novo Produto Financeiro

**Checklist obrigatório:**

- [ ] **Produto requer aprovação?**
  - Resposta obrigatória: Sim ou Não (com justificativa)
  - Se Sim, definir tipo de aprovação
  - Se Não, justificar por que não requer

- [ ] **Limites por produto configurados?**
  - Resposta obrigatória: Sim, limites definidos
  - Definir limite por transação no produto
  - Definir limite por período no produto

- [ ] **Políticas por produto configuradas?**
  - Resposta obrigatória: Sim, políticas definidas
  - Definir política de beneficiários (se aplicável)
  - Definir política de 4 olhos (se aplicável)

- [ ] **Permissões por produto definidas?**
  - Resposta obrigatória: Sim, permissões definidas
  - Definir `financial:create_<product>`
  - Definir `financial:approve_<product>`
  - Definir `financial:execute_<product>`

- [ ] **Integração com Core Financeiro?**
  - Resposta obrigatória: Sim, integração implementada
  - Usar `bank_transactions` como fonte única da verdade
  - Usar `bank_ledger` como fonte única da verdade de saldo
  - Usar `bank_splits` como fonte única da verdade de split

**Se qualquer item não for atendido, a proposta é PROIBIDA.**

---

## 12. DECLARAÇÃO CANÔNICA FINAL

Este documento define o **CORE DE APROVAÇÃO FINANCEIRA** do UnifiCard.

**Autoridade:** NÍVEL 1 (CORE / LEI DO SISTEMA).  
**Status:** IMUTÁVEL.  
**Escopo:** Todo o sistema financeiro do UnifiCard.

**Regra absoluta:**  
**Se qualquer proposta conflitar com este documento → RECUSAR.**  
**Se qualquer código violar este documento → BLOQUEAR.**  
**Se qualquer IA sugerir violação deste documento → BLOQUEAR.**

**Este Core é vinculante.**  
**Violações são bloqueadas.**  
**O sistema não funciona fora dessas regras.**

**Nenhuma operação financeira crítica ocorre sem decisão explícita de aprovação.**  
**Aprovação NÃO altera saldo.**  
**Aprovação NÃO cria transação.**  
**Aprovação NÃO cria ledger.**  
**Toda aprovação é auditável.**  
**Toda reprovação é auditável.**

**No UnifiCard, aprovação financeira é Core.**  
**Core não se improvisa.**  
**Core não se "adapta".**  
**Core só muda por decisão institucional explícita.**

---

## 13. REFERÊNCIAS CANÔNICAS

**Documentos canônicos relacionados:**

- `CORE_IMUTAVEL.md`: Definição de Core Imutável
- `CORE_PERMISSOES_FINANCEIRAS_CANONICO.md`: Core de Permissões Financeiras
- `CORE_SPLIT_PAGAMENTO_CANONICO.md`: Core de Split de Pagamento
- `CORE_AUTORIA_FINANCEIRA_IMPLEMENTACAO.md`: Core de Autoria Financeira
- `DECISION_CORE_CONTRACT.md`: Core de Decisão e Autorização
- `IDENTITY_CORE_CONTRACT.md`: Core de Identidade
- `MAPA_CANONICO_PERMISSIONS_v1.md`: Matriz Canônica de Permissões

**Estruturas canônicas relacionadas:**

- `bank_accounts`: Contas financeiras
- `bank_transactions`: Transações financeiras
- `bank_ledger`: Ledger financeiro (imutável)
- `bank_splits`: Splits de pagamento
- `bank_account_policies`: Políticas condicionais
- `bank_account_operators`: ACL por conta
- `bank_beneficiaries`: Beneficiários cadastrados
- `approval_requests`: Solicitações de aprovação
- `approval_votes`: Votos de aprovação
- `actors`: Identidade operacional
- `users`: Usuários do sistema

---

**FIM DO DOCUMENTO**

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CORE_FINANCIAL_CONTRACT.md
- CORE_IMUTAVEL.md
- CORE_PERMISSOES_FINANCEIRAS_CANONICO.md
- CORE_SPLIT_PAGAMENTO_CANONICO.md
- IDENTITY_CORE_CONTRACT.md
- MAPA_CANONICO_PERMISSIONS_v1.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
- CORE_ESTORNOS_FINANCEIROS_CANONICO.md
- HARDENING_CYCLE_CLOSURE.md
<!-- AUTO-GENERATED-END -->