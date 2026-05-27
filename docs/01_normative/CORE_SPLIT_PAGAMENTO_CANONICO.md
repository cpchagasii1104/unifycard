Status: SUBORDINATED
Domain: Financial
Governing Contract: CORE_IMUTAVEL.md
Authority Level: 1
Canonical Scope: Payment Split Core
# CORE SPLIT DE PAGAMENTO CANÔNICO — UNIFICARD

**Status:** CORE  
**Autoridade:** NÍVEL 1 (CORE / LEI DO SISTEMA)  
**Escopo:** Todo o sistema financeiro do UnifiCard  
**Aplicação:** Código, banco, serviços, IAs e decisões humanas  

---

## DEFINIÇÃO ABSOLUTA

O **CORE DE SPLIT DE PAGAMENTO** é a estrutura única, não duplicável e não substituível que define como valores financeiros são distribuídos no UnifiCard.

**UnifyBank** é a **ÚNICA fonte da verdade financeira** do sistema.  
**bank_splits** é a **ÚNICA tabela canônica** de split.  
**bank_ledger** é a **ÚNICA fonte da verdade** de saldo.  

Nenhum split é calculado fora do UnifyBank.  
Nenhuma estrutura paralela é permitida.  
Nenhuma inferência implícita é aceita.  

---

## 1. VISÃO GERAL DO SPLIT DE PAGAMENTO NO ECOSSISTEMA UNIFICARD

### 1.1 O Que É Split de Pagamento

Split de pagamento é a distribuição de um valor financeiro entre múltiplas contas, seguindo regras de negócio definidas por políticas configuráveis.

Cada pagamento recebido no sistema é dividido em:
- **Revenue Share**: participação na receita (organizador, worker, fornecedor, etc)
- **Fee**: taxa da plataforma
- **Regional Fund**: fundo regional
- **Reserve**: reserva do sistema
- **Escrow**: custódia temporária
- **Referral**: comissão de indicação

### 1.2 Princípios Fundamentais

1. **Fonte Única da Verdade**: UnifyBank é o único motor de split
2. **Imutabilidade**: Splits são imutáveis após criação
3. **Auditabilidade**: Todo split é rastreável e auditável
4. **Flexibilidade via Policy**: Regras de split são configuráveis, não hardcoded
5. **Separação de Camadas**: Configuração, execução e persistência são separadas
6. **Core Imutável**: O Core Financeiro não muda, apenas as políticas

---

## 2. FONTE ÚNICA DA VERDADE

### 2.1 Estruturas Canônicas

| Estrutura | Tabela | Responsabilidade | Status |
|-----------|--------|-----------------|--------|
| **Split (persistência)** | `bank_splits` | Persistência canônica de split materializado | CORE |
| **Ledger** | `bank_ledger` | Fonte única de verdade de saldo | CORE |
| **Transação** | `bank_transactions` | Movimentação financeira | CORE |
| **Conta** | `bank_accounts` | Contas financeiras | CORE |
| **Executor financeiro** | `bank-transaction.service` (`createTransactionWithSplit` / `createTransactionWithExplicitSplitLines`) | Único orquestrador que materializa dinheiro | CORE |
| **Policy (decisão/cálculo)** | `economic_policies` + `economic_policy_lines` + `access_pass_products` + `actor_access_passes` + `economic_policy_resolution_logs` + `economicPolicyEngineService` | Resolvedor canônico ÚNICO de policy econômica + cálculo BPS integer | CONFIGURAÇÃO (canônica desde DECISION-0047 + DECISION-0048, 2026-05-26) |
| **Calculador legacy (cutover gradual)** | `bankSplitEngineService.calculateSplits()` | Defaults hardcoded por contexto para event_ticket / ride / p2p / group / service_booking até cutover PE-3+ | SUBORDINADO (sem fonte alternativa de policy desde DECISION-0048) |
| **Policy hard-deprecated** | `bank_policies` | Chave-valor JSONB; `resolveSplitPolicy`/`setPolicy` removidos (DECISION-0048); apenas `getPolicy<T>()` preservado para `bank-limit.service` | HARD-DEPRECATED (remoção física rastreada em `DT-BANK-POLICIES-PHYSICAL-REMOVAL`) |

### 2.2 Regra Absoluta

**Toda distribuição financeira passa por `bank_splits`.**  
**Todo saldo é calculado de `bank_ledger`.**  
**Toda política é resolvida pelo Economic Policy Engine (`economic_policies` + `economic_policy_lines`) — ver DECISION-0047.**  

Não há exceções.  
Não há representações alternativas.  
Não há "atalhos técnicos".

### 2.3 O Que NÃO É Fonte da Verdade

- `payment_splits` (legado, não deve ser usado)
- `payment_intent_splits` (read-model, não é verdade)
- `split_configuration` (legado, não deve ser usado)
- `bank_policies` (hard-deprecated — `resolveSplitPolicy`/`setPolicy` REMOVIDOS via DECISION-0048; tabela COMMENT'd; preservada APENAS porque `bank-limit.service` lê limites operacionais via `getPolicy<T>()`; remoção física rastreada em `DT-BANK-POLICIES-PHYSICAL-REMOVAL`)
- Cálculos inline em services (proibido — toda decisão de policy passa por `economicPolicyEngineService.resolveEconomicPolicy(...)` em fluxos novos)
- Lógica de split em módulos externos (proibido)
- Hardcoded percentual em fluxo novo (proibido — fail-closed institucional via DECISION-0048)

### 2.4 Camadas DECISÃO × EXECUÇÃO × PERSISTÊNCIA (DECISION-0047 + DECISION-0048)

| Camada | Responsabilidade | Componentes canônicos |
|--------|------------------|----------------------|
| **DECISÃO** (resolução de regra) | Quais splits aplicar a este contexto (regra, %, destino, vigência, pass override) | `economic_policies` + `economic_policy_lines` + `access_pass_products` + `actor_access_passes` + `economicPolicyEngineService.resolveEconomicPolicy()` |
| **CÁLCULO** (aritmética determinística) | BPS integer (sem float), drift para `revenue_share[0]`, fail-closed em ambiguidade | `economicPolicyEngineService.calculatePolicySplits()` |
| **EXECUÇÃO** (materialização monetária) | Orquestrador único que escreve `bank_transactions` + `bank_splits` + `bank_ledger` na mesma transação | `bank-transaction.service` (`createTransactionWithSplit` / `createTransactionWithExplicitSplitLines`) |
| **PERSISTÊNCIA** (SSOT) | Registro irreversível append-only | `bank_transactions` + `bank_splits` + `bank_ledger` |
| **DESTINOS** | Contas que recebem | `bank_accounts` — `actor_wallet` (DECISION-0046) + system accounts |
| **AUDIT** | Trilha append-only de cada resolução de policy | `economic_policy_resolution_logs` |

**Princípios inegociáveis (DECISION-0048):**

1. DECISÃO e EXECUÇÃO são camadas **separadas**. `economic_policy_engine` resolve regra; `bank-transaction.service` materializa.
2. `economic_policy_engine` **NÃO importa, NÃO escreve** em `bank_ledger`/`bank_splits`/`bank_transactions`. Guardrail material via `validate-architectural-patterns.mjs` (regra `NO_BANK_EXECUTOR_IMPORT_IN_POLICY_ENGINE`).
3. Novos fluxos econômicos usam BPS integer via `economic_policy_engine` + `createTransactionWithExplicitSplitLines`. Hardcoded percentual em fluxo novo é violação.
4. Fail-closed: `POLICY_NOT_FOUND` / `POLICY_AMBIGUITY` em fluxo novo **bloqueia pagamento**. Sem fallback hardcoded.
5. `bankSplitEngineService` permanece calculador para fluxos legacy (event_ticket / ride / p2p / group) com defaults hardcoded — sem fonte alternativa de policy. Cutover gradual.
6. **`service_execution` plugado em PE-3 (2026-05-26):** `service-payment-execution.service.createExecution` resolve policy quando `input.splits` ausente. `actor_wallet` recebe APENAS revenue_share via D-money. Fee/reserve/etc. caem nos destinos finais na execução, NUNCA passam por `actor_wallet`.

---

## 3. PAPEL DO UNIFYBANK

### 3.1 Definição

**UnifyBank** é a infraestrutura financeira canônica do UnifiCard.  
É o **ÚNICO motor** de split de pagamento do sistema.

### 3.2 Responsabilidades

1. **Calcular splits**: `bank-split-engine.service.ts` calcula distribuições
2. **Persistir splits**: `bank_splits` armazena splits canônicos
3. **Registrar no ledger**: `bank_ledger` registra movimentações
4. **Gerenciar contas**: `bank_accounts` gerencia contas financeiras
5. **Resolver políticas**: `bank-policy.service.ts` resolve regras de split

### 3.3 O Que UnifyBank NÃO É

- UnifyBank não é método de pagamento
- UnifyBank não é gateway de pagamento
- UnifyBank não é processador de cartão
- UnifyBank não é integração com banco externo

### 3.4 Estruturas do UnifyBank

- **Engine**: `backend/src/modules/bank/bank-split-engine.service.ts`
- **Policy Service**: `backend/src/modules/bank/bank-policy.service.ts`
- **Transaction Service**: `backend/src/modules/bank/bank-transaction.service.ts`
- **Account Service**: `backend/src/modules/bank/bank-account.service.ts`
- **Repositories**: `bank-split.repository.ts`, `bank-ledger.repository.ts`, `bank-transaction.repository.ts`

---

## 4. PAPEL DO UNIFYCARD

### 4.1 Definição

**UnifyCard** é um **MÉTODO DE PAGAMENTO**, não motor de split.

### 4.2 Responsabilidades

1. **Processar pagamentos**: Receber pagamentos de clientes
2. **Criar transações**: Criar `bank_transactions` no UnifyBank
3. **Acionar split**: Chamar `bank-split-engine.service.ts` após pagamento

### 4.3 O Que UnifyCard NÃO É

- UnifyCard não calcula splits
- UnifyCard não define regras de split
- UnifyCard não persiste splits
- UnifyCard não gerencia ledger

### 4.4 Fluxo de Integração

1. Cliente paga via UnifyCard
2. UnifyCard cria `bank_transaction` no UnifyBank
3. UnifyCard chama `bank-split-engine.service.ts.calculateSplits()`
4. Engine calcula splits baseado em políticas
5. Engine persiste splits em `bank_splits`
6. Engine registra movimentações em `bank_ledger`

---

## 5. FLUXO CANÔNICO END-TO-END (PASSO A PASSO)

### 5.1 Fluxo Completo

```
1. PAGAMENTO RECEBIDO
   └─> Cliente paga R$ 100,00 via UnifyCard
   
2. TRANSAÇÃO CRIADA
   └─> UnifyCard cria bank_transaction
   └─> transaction_id: uuid-123
   └─> amount: 100.00
   └─> context: 'service_booking'
   └─> metadata: { cityId, regionId, actorId, productType, serviceType, ... }
   └─> ⚠️ NOTA: metadata.category existe mas NÃO é usado para split (viola contratos canônicos)
   
3. POLICY RESOLVIDA
   └─> bank-policy.service.resolveSplitPolicy(tenantId, context, metadata)
   └─> Busca policy hierárquica:
       ├─> split.service_booking.curitiba.store_123 (específica)
       ├─> split.service_booking.curitiba (regional)
       ├─> split.service_booking (contextual)
       └─> default hardcoded (fallback)
   
4. SPLITS CALCULADOS
   └─> bank-split-engine.service.calculateSplits()
   └─> Aplica regras da policy:
       ├─> revenue_share: 97% → R$ 97,00 (worker)
       └─> fee: 3% → R$ 3,00 (platform)
   
5. SPLITS PERSISTIDOS
   └─> bank-split.repository.create()
   └─> Insere em bank_splits:
       ├─> split_id: uuid-456, target_account_id: worker_account, amount: 97.00
       └─> split_id: uuid-789, target_account_id: fee_account, amount: 3.00
   
6. LEDGER ATUALIZADO
   └─> bank-ledger.repository.create()
   └─> Insere em bank_ledger (double-entry):
       ├─> Debit: worker_account, amount: 97.00
       ├─> Credit: fee_account, amount: 3.00
       └─> Calcula balance_before e balance_after
   
7. SALDOS ATUALIZADOS
   └─> Saldo é SEMPRE calculado de bank_ledger
   └─> SELECT SUM(...) FROM bank_ledger WHERE account_id = ...
```

### 5.2 Pontos de Integração Obrigatórios

1. **Criação de Transação**: Todo pagamento cria `bank_transaction`
2. **Chamada ao Engine**: Todo pagamento chama `calculateSplits()`
3. **Persistência de Splits**: Todo split é persistido em `bank_splits`
4. **Registro no Ledger**: Toda movimentação é registrada em `bank_ledger`

### 5.3 Validações Obrigatórias

1. Soma de splits = valor total da transação (tolerância: 0.01)
2. Todas as contas de destino existem
3. Todas as políticas são válidas
4. Ledger mantém invariante double-entry

---

## 6. MODELO DE SPLIT (bank_splits)

### 6.1 Estrutura da Tabela

```sql
bank_splits (
    split_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    transaction_id UUID NOT NULL,
    target_account_id UUID NOT NULL,
    amount NUMERIC(20, 2) NOT NULL,
    percentage NUMERIC(5, 2),
    split_type VARCHAR(50) NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
)
```

### 6.2 Tipos de Split

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| `revenue_share` | Participação na receita | Worker, organizador, fornecedor |
| `fee` | Taxa da plataforma | Taxa de 3% |
| `regional_fund` | Fundo regional | 10% para fundo regional |
| `reserve` | Reserva do sistema | 17% para reserva |
| `escrow` | Custódia temporária | Valores em custódia |
| `referral` | Comissão de indicação | 5% para referrer |

### 6.3 Regras de Split

1. **Imutabilidade**: Splits não podem ser alterados após criação
2. **Soma Total**: Soma de todos os splits = valor da transação
3. **Conta Destino**: Todo split tem `target_account_id` válido
4. **Tipo Obrigatório**: Todo split tem `split_type` válido
5. **Metadata Opcional**: `metadata` pode conter informações contextuais

### 6.4 Relacionamentos

- `transaction_id` → `bank_transactions.transaction_id` (FK)
- `target_account_id` → `bank_accounts.account_id` (FK)
- `tenant_id` → `tenants.tenant_id` (FK)

---

## 7. ENGINE CANÔNICO DE SPLIT

### 7.1 Localização

**Arquivo**: `backend/src/modules/bank/bank-split-engine.service.ts`  
**Classe**: `BankSplitEngineService`  
**Método Principal**: `calculateSplits()`

### 7.2 Responsabilidades

1. **Resolver Policy**: Buscar regras de split do Policy Registry
2. **Calcular Splits**: Aplicar regras e calcular distribuições
3. **Validar Resultado**: Garantir que soma = total
4. **Retornar Cálculo**: Retornar `BankSplitCalculation`

### 7.3 Fluxo Interno

```
calculateSplits(tenantId, context, totalAmount, currency, revenueShareAccountId, fromUserId)
  │
  ├─> getSplitConfig(tenantId, context)
  │   ├─> bankPolicyService.resolveSplitPolicy(tenantId, context)
  │   └─> Fallback para defaults hardcoded se não houver policy
  │
  ├─> Aplicar splits padrão do contexto
  │   ├─> Calcular amount = totalAmount * percentage
  │   ├─> Resolver target_account_id (sistema ou específica)
  │   └─> Deduzir fees do profit
  │
  ├─> Aplicar referral split (se válido, sobre profit)
  │   ├─> getActiveReferral(tenantId, fromUserId)
  │   └─> Calcular referralAmount = profitAmount * 0.05
  │
  ├─> Aplicar group allocation (sobre remainder após referral)
  │   ├─> userGroupAllocationRepository.findByUserId(tenantId, fromUserId)
  │   └─> Calcular groupAmount = profitAmount * (percentage / 100)
  │
  ├─> Enviar remainder para Regional Fund
  │   └─> Se profitAmount > 0.01, criar split para regional_fund
  │
  └─> Ajustar diferença por arredondamento
      └─> Ajustar primeiro split (revenue_share) se necessário
```

### 7.4 Ordem de Aplicação

1. **System Fee**: Taxas do sistema são deduzidas primeiro
2. **Referral Split**: Comissão de indicação sobre profit
3. **Group Allocation**: Alocação para grupos sobre remainder
4. **Regional Fund**: Remainder vai para fundo regional

### 7.5 Validações Internas

1. Soma de splits = totalAmount (tolerância: 0.01)
2. Todas as contas de destino existem
3. Percentuais são válidos (0 <= percentage <= 1)
4. Amounts são positivos

---

## 8. POLICY REGISTRY E RESOLUÇÃO HIERÁRQUICA

### 8.1 Estrutura da Tabela

```sql
bank_policies (
    policy_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    key VARCHAR(100) NOT NULL,
    version INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    value_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
)
```

### 8.2 Formato da Policy

```json
{
  "splits": [
    {
      "splitType": "revenue_share",
      "percentage": 0.97,
      "targetAccountId": null
    },
    {
      "splitType": "fee",
      "percentage": 0.03,
      "targetAccountName": "fee"
    }
  ]
}
```

### 8.3 Resolução Hierárquica

A resolução de policy segue hierarquia de especificidade:

```
1. Policy Específica (mais específica)
   └─> split.service_booking.curitiba.supermercado
   
2. Policy Regional
   └─> split.service_booking.curitiba
   
3. Policy Contextual
   └─> split.service_booking
   
4. Default Hardcoded (fallback)
   └─> Valores hardcoded no engine
```

### 8.4 Chaves de Policy

Formato: `split.{context}[.{region}][.{city}][.{storeId}]`

⚠️ **NOTA INSTITUCIONAL**: Categoria NÃO é usada em chaves de policy (viola `Category_System_Contract_UnifiCard.md`). Use `metadata.productType` ou `metadata.serviceType` se necessário para variação por tipo de produto/serviço.

Exemplos:
- `split.service_booking`
- `split.service_booking.curitiba`
- `split.service_booking.curitiba.store_123`
- `split.event_ticket.sao_paulo`
- `split.ride_payment.parana`

### 8.5 Versionamento

1. **Versão Ativa**: Última versão com `status='active'`
2. **Versões Antigas**: Mantidas para auditoria
3. **Deprecação**: Versões antigas marcadas como `status='deprecated'`
4. **Draft**: Versões em teste marcadas como `status='draft'`

### 8.6 Resolução com Metadata

O engine deve passar `metadata` da transação para resolução:

```typescript
resolveSplitPolicy(tenantId, context, metadata?: {
  cityId?: string;
  regionId?: string;
  stateId?: string;
  category?: string; // ⚠️ DEPRECATED: Não usado na resolução de split (viola Category_System_Contract_UnifiCard.md)
  productType?: string; // Alternativa neutra para variação por tipo de produto
  serviceType?: string; // Alternativa neutra para variação por tipo de serviço
  cnpj?: string;
  storeId?: string;
  actorId?: string;
})
```

A resolução usa metadata para construir chaves hierárquicas.

---

## 9. VARIAÇÕES SUPORTADAS (CIDADE, ESTADO, LOJA, CNPJ)

### 9.1 Variação por Cidade

**Suporte**: Sim, via Policy Registry hierárquico.

**Como Funciona**:
1. Transação inclui `metadata.cityId`
2. Engine busca policy: `split.{context}.{cityId}`
3. Se não encontrar, busca: `split.{context}`
4. Se não encontrar, usa default hardcoded

**Exemplo**:
- Curitiba: `split.service_booking.curitiba` → fee 3%
- São Paulo: `split.service_booking.sao_paulo` → fee 5%

### 9.2 Variação por Estado

**Suporte**: Sim, via Policy Registry hierárquico.

**Como Funciona**:
1. Transação inclui `metadata.stateId`
2. Engine busca policy: `split.{context}.{stateId}`
3. Se não encontrar, busca: `split.{context}`
4. Se não encontrar, usa default hardcoded

**Exemplo**:
- Paraná: `split.service_booking.parana` → fee 3%
- São Paulo: `split.service_booking.sao_paulo` → fee 5%

### 9.4 Origem regional do fundo (regional_origin_basis) — DT-REGIONAL-ORIGIN-BASIS-POLICY (2026-05-26)

Quando `destination_type='regional_fund'` SEM `destination_key` explícito, o
resolver dinâmico (frente PE-4 futura) DEVE consultar `regional_origin_basis`
da policy line. Valores conceituais previstos:

| Basis                            | Resolução                                                              |
|----------------------------------|------------------------------------------------------------------------|
| `payer_identity_residence`       | RESIDENCE do CPF do payer (via `address_assignments`)                  |
| `receiver_identity_residence`    | RESIDENCE do CPF do receiver                                           |
| `receiver_company_hq`            | HQ do CNPJ do receiver (via `companies` + `address_assignments`)       |
| `receiver_company_operational`   | OPERATIONAL do CNPJ do receiver                                        |
| `service_location`               | Endereço do `service`/`service_order`/`booking`                        |
| `transaction_location`           | Endereço do canal/loja onde a transação ocorreu                        |
| `explicit_economic_region`       | Policy carrega `destination_key=<economic_region_id>`; engine não resolve |
| `mixed_policy`                   | Múltiplas linhas `regional_fund` na MESMA policy, cada uma com basis e share próprios |

**Regras inegociáveis:**

1. PF NÃO assume HQ. Se actor é PF, basis válidos são `*_identity_residence` ou `service_location` / `transaction_location` / `explicit_economic_region` / `mixed_policy`.
2. PJ NÃO assume RESIDENCE do CPF responsável como default. Se actor é PJ, basis válidos são `*_company_*` ou outros sem origem PF.
3. **mixed_policy** representa "X% para região do CPF + Y% para região do CNPJ" via múltiplas policy lines `regional_fund` — NÃO via heurística no resolver.
4. **Fail-closed** quando regional_fund dinâmico ativa sem `regional_origin_basis` definido: `REGIONAL_ORIGIN_BASIS_REQUIRED`.
5. `destination_key` explícito continua override admin (ignora basis).
6. `category` / `city` / `bairro` / `economic_region` continuam seletores da policy (selecionam QUAL regra aplica) — não substituem basis (decide ORIGEM da região).
7. `address_assignments` é fonte material de qual endereço é RESIDENCE/HQ/OPERATIONAL (DECISION-0020).

**Status atual:** contrato DOCUMENTADO; **não implementado**. Resolver dinâmico
de `regional_fund` continua FAIL-CLOSED em PE-3 / `resolveSplitDestinationFromPolicy`.
Rastreado em `DT-REGIONAL-ORIGIN-BASIS-POLICY` (OPEN HIGH).

---

### 9.3 Variação por Categoria — ATUALIZADO por DECISION-0048

**Status**: ✅ **PERMITIDA como seletor de policy** (não como calculador de split)

**Norma anterior (2025 pré-DECISION-0048):** "Categorias são descritivas e NÃO influenciam preço, split ou impacto financeiro" — vetava qualquer uso de categoria em split.

**Norma atual (DECISION-0048, 2026-05-26):** categorias continuam **descritivas** para identidade do produto/serviço (CONCEPT continua identidade canônica), MAS **podem selecionar policy econômica** quando houver `economic_policy` ativa, versionada, auditável e vigente.

**Distinção crítica:**

- ✅ Categoria **seleciona** policy (via `category_id` como seletor de specificity em `economic_policies`).
- ❌ Categoria **NÃO calcula** split sozinha. Cálculo é exclusivo do `economic_policy_engine` (BPS integer) e materialização do UnifyBank (`bank_splits`/`bank_ledger`).
- ❌ Categoria **NÃO substitui** CONCEPT como identidade semântica do produto.

**Requisitos para usar category_id como seletor:**

1. `economic_policy` deve existir, estar `status='active'`, versionada, com vigência (`effective_from`/`effective_until`) cobrindo a transação.
2. Specificity natural: policy com `category_id` específico vence policy sem categoria no mesmo contexto.
3. Auditoria via `economic_policy_resolution_logs` registra qual policy + qual categoria foram aplicadas em cada transação.
4. `categories` permanece tabela GLOBAL (sem `tenant_id`); FK em `economic_policies.category_id` com `ON DELETE SET NULL` previne policy quebrada se categoria for apagada.

**Histórico:**

- `bank-policy.service.ts:30` (legado) tinha `category` marcada como DEPRECATED — REMOVIDO junto com `resolveSplitPolicy` via DECISION-0048.
- Esta § foi reescrita por DECISION-0048 reconhecendo que o veto anterior era apropriado para o modelo chave-valor antigo (onde categoria viraria fator escondido no string da chave), mas é desnecessário no modelo relacional do `economic_policies` onde categoria é coluna explícita, auditável e nunca calcula sozinha.

### 9.3 Variação por Loja

**Suporte**: Sim, via Policy Registry hierárquico.

**Como Funciona**:
1. Transação inclui `metadata.storeId`
2. Engine busca policy: `split.{context}.{storeId}`
3. Se não encontrar, busca: `split.{context}`
4. Se não encontrar, usa default hardcoded

**Exemplo**:
- Loja A: `split.service_booking.store_a` → fee 3%
- Loja B: `split.service_booking.store_b` → fee 4%

### 9.4 Variação por CNPJ

**Suporte**: Sim, via Policy Registry hierárquico.

**Como Funciona**:
1. Transação inclui `metadata.cnpj`
2. Engine busca policy: `split.{context}.{cnpj}`
3. Se não encontrar, busca: `split.{context}`
4. Se não encontrar, usa default hardcoded

**Exemplo**:
- CNPJ A: `split.service_booking.cnpj_12345678000190` → fee 3%
- CNPJ B: `split.service_booking.cnpj_98765432000110` → fee 4%

### 9.5 Combinações de Variações

**Suporte**: Sim, via Policy Registry hierárquico.

**Como Funciona**:
1. Transação inclui múltiplos metadados
2. Engine busca policy mais específica primeiro
3. Se não encontrar, busca menos específica
4. Se não encontrar, usa default hardcoded

**Exemplo**:
- `split.service_booking.curitiba.store_123` (mais específica)
- `split.service_booking.curitiba` (menos específica)
- `split.service_booking` (genérica)
- Default hardcoded (fallback)

⚠️ **NOTA**: Categoria NÃO é usada em combinações (viola contratos canônicos). Use `productType` ou `serviceType` se necessário.

---

## 10. MULTI-CNPJ, MULTI-LOJA, MULTI-ACTOR

### 10.1 Múltiplos CNPJs por CPF

**Suporte**: Sim, via Actor e Policy Registry.

**Como Funciona**:
1. Cada CNPJ é um Actor distinto
2. Cada Actor tem sua própria conta financeira
3. Splits são calculados por Actor, não por CPF
4. Policies podem variar por CNPJ via `metadata.cnpj`

**Regra Absoluta**:  
**Saldos são separados por Actor, não por CPF.**  
**Um CPF pode controlar múltiplos Actors, mas cada Actor tem saldo próprio.**

### 10.2 Múltiplas Lojas por Empresa

**Suporte**: Sim, via Actor e Policy Registry.

**Como Funciona**:
1. Cada loja pode ser um Actor distinto
2. Cada loja tem sua própria conta financeira
3. Splits são calculados por loja, não por empresa
4. Policies podem variar por loja via `metadata.storeId`

**Regra Absoluta**:  
**Saldos são separados por loja, não por empresa.**  
**Uma empresa pode ter múltiplas lojas, mas cada loja tem saldo próprio.**

### 10.3 Múltiplos Actors por CPF

**Suporte**: Sim, via Identity Core.

**Como Funciona**:
1. Um CPF pode controlar múltiplos Actors (PF, PJ, banda, grupo, etc)
2. Cada Actor tem sua própria conta financeira
3. Splits são calculados por Actor, não por CPF
4. Compliance e auditoria podem consolidar por CPF sem misturar saldos

**Regra Absoluta**:  
**Saldos são separados por Actor, não por CPF.**  
**Compliance consolida por CPF, mas saldos permanecem separados.**

### 10.4 Separação de Saldos

**Regra Absoluta**:  
**Nunca misturar saldos entre Actors distintos, mesmo que pertençam ao mesmo CPF.**

**Como Garantir**:
1. Cada Actor tem `account_id` único
2. Cada split referencia `target_account_id` específico
3. Ledger registra movimentações por conta, não por CPF
4. Auditoria consolida por CPF sem alterar saldos

---

## 11. AUDITORIA, COMPLIANCE E RECEITA FEDERAL

### 11.1 Auditoria Financeira

**Fonte Única**: `bank_ledger` e `bank_splits`.

**Regras**:
1. Toda movimentação é registrada em `bank_ledger`
2. Todo split é registrado em `bank_splits`
3. Saldos são calculados de `bank_ledger`, nunca armazenados
4. Histórico é imutável (append-only)

### 11.2 Compliance por CPF

**Suporte**: Sim, via consultas consolidadas.

**Como Funciona**:
1. Buscar todos os Actors de um CPF
2. Buscar todas as contas desses Actors
3. Consolidar movimentações por CPF
4. Gerar relatórios sem misturar saldos

**Regra Absoluta**:  
**Compliance consolida por CPF, mas saldos permanecem separados por Actor.**

### 11.3 Relatórios para Receita Federal

**Suporte**: Sim, via consultas consolidadas.

**Relatórios Obrigatórios**:
1. **Por CPF**: Todas as movimentações de um CPF
2. **Por CNPJ**: Todas as movimentações de um CNPJ
3. **Por Período**: Movimentações em um intervalo de datas
4. **Por Categoria**: Movimentações por categoria de produto/serviço (⚠️ READ-MODEL apenas, não usado para decisão)
5. **Por Região**: Movimentações por cidade/estado

**Como Gerar**:
1. Consultar `bank_ledger` e `bank_splits`
2. Consolidar por CPF/CNPJ via Actors
3. Filtrar por período, categoria, região (⚠️ Filtro é READ-MODEL, não influencia split)
4. Gerar relatório sem alterar dados

⚠️ **NOTA INSTITUCIONAL**: Filtrar relatórios por categoria é permitido (read-model), mas categoria NÃO pode influenciar cálculo de split ou decisão financeira.

### 11.4 Rastreabilidade

**Regra Absoluta**:  
**Toda movimentação financeira é rastreável até a transação original.**

**Como Garantir**:
1. `bank_splits.transaction_id` referencia `bank_transactions.transaction_id`
2. `bank_ledger.transaction_id` referencia `bank_transactions.transaction_id`
3. `bank_transactions.metadata` contém contexto completo
4. Histórico é imutável (append-only)

---

## 12. PROIBIÇÕES ABSOLUTAS

### 12.1 Proibições Estruturais

1. **NÃO criar tabelas paralelas de split**
   - Proibido: `payment_splits`, `service_splits`, `event_splits`
   - Permitido: Apenas `bank_splits`

2. **NÃO calcular splits fora do UnifyBank**
   - Proibido: Cálculos inline em services
   - Permitido: Apenas `bank-split-engine.service.ts`

3. **NÃO criar engines paralelos de split**
   - Proibido: `marketplace-split-engine`, `service-split-engine`
   - Permitido: Apenas `bank-split-engine.service.ts`

4. **NÃO armazenar saldo calculado**
   - Proibido: Campo `balance` em `bank_accounts`
   - Permitido: Saldo sempre calculado de `bank_ledger`

5. **NÃO alterar splits após criação**
   - Proibido: UPDATE ou DELETE em `bank_splits`
   - Permitido: Apenas INSERT (imutável)

### 12.2 Proibições de Lógica

1. **NÃO inferir splits implicitamente**
   - Proibido: "Se não houver policy, assume X"
   - Permitido: Fallback explícito para defaults hardcoded

2. **NÃO misturar saldos entre Actors**
   - Proibido: Consolidar saldos por CPF na camada contábil
   - Permitido: Consolidar apenas em relatórios (read-model)

3. **NÃO criar exceções temporárias**
   - Proibido: "Só neste caso, use split diferente"
   - Permitido: Criar policy específica no Policy Registry

4. **NÃO hardcodar regras de split**
   - Proibido: Valores fixos no código sem fallback
   - Permitido: Defaults hardcoded apenas como fallback

### 12.3 Proibições de Integração

1. **NÃO pular o engine de split**
   - Proibido: Criar splits diretamente em `bank_splits`
   - Permitido: Apenas via `bank-split-engine.service.ts`

2. **NÃO pular o ledger**
   - Proibido: Atualizar saldo sem registrar no ledger
   - Permitido: Apenas via `bank-ledger.repository.ts`

3. **NÃO criar transações sem split**
   - Proibido: Transações que não geram splits quando deveriam
   - Permitido: Transações sem split apenas se explicitamente permitido (ex: deposit, withdrawal)

---

## 13. INVARIANTES DO CORE

### 13.1 Invariantes Financeiros

1. **Soma de Splits = Valor da Transação**
   ```
   SUM(bank_splits.amount WHERE transaction_id = X) = bank_transactions.amount
   ```
   Tolerância: 0.01 (arredondamento)

2. **Ledger Double-Entry**
   ```
   SUM(credits) - SUM(debits) = saldo da conta
   ```
   Toda transação tem pelo menos 2 entradas (debit + credit)

3. **Saldo Calculado do Ledger**
   ```
   saldo = SUM(credits) - SUM(debits) FROM bank_ledger WHERE account_id = X
   ```
   Saldo nunca é armazenado, sempre calculado

4. **Splits Imutáveis**
   ```
   Não existe UPDATE ou DELETE em bank_splits
   ```
   Splits são append-only

### 13.2 Invariantes de Policy

1. **Policy Única Ativa**
   ```
   COUNT(*) WHERE tenant_id = X AND key = Y AND status = 'active' <= 1
   ```
   Apenas uma versão ativa por tenant+key

2. **Resolução Hierárquica**
   ```
   Se policy específica não existe, busca menos específica
   Se policy contextual não existe, usa default hardcoded
   ```
   Sempre há uma policy válida (mesmo que default)

### 13.3 Invariantes de Actor

1. **Actor Explícito**
   ```
   Toda transação tem actor_id explícito (via metadata ou account)
   ```
   Nunca inferir actor implicitamente

2. **Separação de Saldos**
   ```
   Saldos são separados por Actor, não por CPF
   ```
   Um CPF pode ter múltiplos Actors, cada um com saldo próprio

---

## 14. ERROS COMUNS QUE NÃO PODEM SER COMETIDOS

### 14.1 Erros Estruturais

1. **Criar tabela paralela de split**
   - ❌ Errado: Criar `payment_splits` para pagamentos
   - ✅ Correto: Usar `bank_splits` para todos os splits

2. **Calcular split inline**
   - ❌ Errado: `const split = amount * 0.03` em service
   - ✅ Correto: Chamar `bank-split-engine.service.ts.calculateSplits()`

3. **Armazenar saldo calculado**
   - ❌ Errado: Campo `balance` em `bank_accounts`
   - ✅ Correto: Calcular saldo de `bank_ledger` sempre

4. **Alterar split após criação**
   - ❌ Errado: `UPDATE bank_splits SET amount = ...`
   - ✅ Correto: Criar nova transação reversa

### 14.2 Erros de Lógica

1. **Inferir split implicitamente**
   - ❌ Errado: "Se não houver policy, assume 50/50"
   - ✅ Correto: Usar fallback explícito para defaults hardcoded

2. **Misturar saldos por CPF**
   - ❌ Errado: Consolidar saldos na camada contábil
   - ✅ Correto: Consolidar apenas em relatórios (read-model)

3. **Criar exceção temporária**
   - ❌ Errado: "Só neste caso, use split diferente"
   - ✅ Correto: Criar policy específica no Policy Registry

4. **Hardcodar regra de split**
   - ❌ Errado: `const fee = 0.03` hardcoded no código
   - ✅ Correto: Buscar de Policy Registry, com fallback hardcoded

### 14.3 Erros de Integração

1. **Pular engine de split**
   - ❌ Errado: `INSERT INTO bank_splits ...` diretamente
   - ✅ Correto: Chamar `bank-split-engine.service.ts.calculateSplits()`

2. **Pular ledger**
   - ❌ Errado: Atualizar saldo sem registrar no ledger
   - ✅ Correto: Registrar no ledger sempre

3. **Criar transação sem split**
   - ❌ Errado: Transação que deveria ter split mas não tem
   - ✅ Correto: Sempre chamar engine de split quando necessário

---

## 15. CHECKLIST PARA IAs E HUMANOS ANTES DE ALTERAR O SISTEMA

### 15.1 Checklist Obrigatório

Antes de criar, alterar ou sugerir qualquer coisa relacionada a split de pagamento, responder explicitamente:

#### 15.1.1 Estrutura

- [ ] **Qual é a fonte canônica de split?**
  - Resposta obrigatória: `bank_splits`
  - Se não for `bank_splits`, a proposta é **PROIBIDA**

- [ ] **Existe estrutura equivalente no código/banco?**
  - Verificar: `payment_splits`, `service_splits`, `event_splits`
  - Se existir, a proposta é **PROIBIDA** (duplicação)

- [ ] **Isso cria caminho paralelo de split?**
  - Se sim, a proposta é **PROIBIDA**

#### 15.1.2 Engine

- [ ] **Onde o split é calculado?**
  - Resposta obrigatória: `bank-split-engine.service.ts`
  - Se não for, a proposta é **PROIBIDA**

- [ ] **Existe engine paralelo de split?**
  - Verificar: `marketplace-split-engine`, `service-split-engine`
  - Se existir, a proposta é **PROIBIDA** (duplicação)

#### 15.1.3 Policy

- [ ] **A regra de split é configurável?**
  - Resposta obrigatória: Sim, via `bank_policies`
  - Se não for, a proposta é **PROIBIDA** (hardcode)

- [ ] **A policy suporta variações necessárias?**
  - Verificar: cidade, estado, loja, CNPJ, productType, serviceType
  - ⚠️ NOTA: Categoria NÃO é suportada para variação de split (viola contratos canônicos)
  - Se não suportar, a proposta precisa de ajuste

#### 15.1.4 Ledger

- [ ] **A movimentação é registrada no ledger?**
  - Resposta obrigatória: Sim, em `bank_ledger`
  - Se não for, a proposta é **PROIBIDA**

- [ ] **O saldo é calculado do ledger?**
  - Resposta obrigatória: Sim, sempre calculado
  - Se não for, a proposta é **PROIBIDA** (armazenar saldo)

#### 15.1.5 Actor

- [ ] **O split referencia Actor explícito?**
  - Resposta obrigatória: Sim, via `target_account_id`
  - Se não for, a proposta é **PROIBIDA** (inferência implícita)

- [ ] **Os saldos são separados por Actor?**
  - Resposta obrigatória: Sim, nunca misturar
  - Se não for, a proposta é **PROIBIDA**

### 15.2 Condições de Bloqueio Automático

A proposta é **AUTOMATICAMENTE BLOQUEADA** se:

1. Criar tabela paralela de split
2. Calcular split fora do UnifyBank
3. Criar engine paralelo de split
4. Armazenar saldo calculado
5. Alterar split após criação
6. Inferir split implicitamente
7. Misturar saldos entre Actors
8. Criar exceção temporária
9. Hardcodar regra de split sem fallback
10. Pular engine de split
11. Pular ledger
12. Criar transação sem split quando deveria ter

### 15.3 Validação Final

Antes de aprovar qualquer proposta:

1. **Verificar conformidade com este documento**
   - Se conflitar, **RECUSAR**

2. **Verificar conformidade com CORE_IMUTAVEL.md**
   - Se conflitar, **RECUSAR**

3. **Verificar conformidade com IDENTITY_CORE_CONTRACT.md**
   - Se conflitar, **RECUSAR**

4. **Verificar conformidade com MATRIZ_FONTES_DE_VERDADE.md**
   - Se conflitar, **RECUSAR**

---

## DECLARAÇÃO INSTITUCIONAL FINAL

**No UnifiCard, o split de pagamento é Core.**  
**UnifyBank é a única fonte da verdade financeira.**  
**bank_splits é a única tabela canônica de split.**  
**bank_ledger é a única fonte da verdade de saldo.**  

**Nenhum split é calculado fora do UnifyBank.**  
**Nenhuma estrutura paralela é permitida.**  
**Nenhuma inferência implícita é aceita.**  

**Flexibilidade vem de Policy, nunca de código.**  
**Core Financeiro é imutável.**  
**Saldos são separados por Actor, não por CPF.**  

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
- CORE_IMUTAVEL.md
- IDENTITY_CORE_CONTRACT.md
- MATRIZ_FONTES_DE_VERDADE.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
- CORE_APROVACAO_FINANCEIRA_CANONICO.md
- CORE_ESTORNOS_FINANCEIROS_CANONICO.md
- CORE_FINANCIAL_CONTRACT.md
- CORE_PERMISSOES_FINANCEIRAS_CANONICO.md
- HARDENING_CYCLE_CLOSURE.md
<!-- AUTO-GENERATED-END -->