# NOMENCLATURA CANÔNICA

Estrutura do Documento:

PARTE I — BANCO DE DADOS (76 seções)
├── 4.1-4.4   Tabelas, Colunas, Chaves, Timestamps
├── 4.5-4.8   Monetário, Taxas, Booleanos, Moeda
├── 4.9       Status e Lifecycle (10 categorias)
├── 4.10-4.14 IDs, Auditoria, Soft Delete, Multi-Tenancy
├── 4.15-4.16 Ledger, Splits
├── 4.17-4.30 Geo, Endereços, Estoque, Tracking, etc.
├── 4.31-4.50 Scores, Priority, Visibility, Roles, etc.
├── 4.51-4.73 Entry Types, Split Types, Scopes, Categories, etc.
├── 4.74-4.75 Segurança e Autenticação, Compliance e Retenção
└── 4.76      Fingerprint operacional (`canonical_products.fingerprint_v1`)

PARTE II — BACKEND E API
├── 5. Backend (classes, propriedades, conversão)
├── 6. API (sufixos, prefixos, enums)
├── 7. Frontend
└── 8. Eventos

PARTE III — INFRAESTRUTURA E OPERAÇÕES (NOVO)
├── 9. API REST (endpoints, versionamento, query params, contratos)
├── 10. Eventos Versionados (v1.domain.action)
├── 11. Mensageria (filas, routing, dlq)
├── 12. Microserviços (nomenclatura, namespaces)
├── 13. Infraestrutura (Docker, variáveis de ambiente)
├── 14. Observabilidade (logs, métricas)
├── 15. Migrações de Banco
├── 16. Testes
└── 17. Git Workflow (gates de auditoria em CI/CD — §17.6; fronteira financeira — §17.6.1)

PARTE IV — TABELAS DE CONVERSÃO
└── 18. Conversão Banco → Backend/API

PARTE V — GOVERNANÇA
├── 19. Proibições (incluindo idioma)
├── 20. Governança
├── 21. Checklist
├── 22. Padrões de Mercado
└── 23. Regra Final

## STATUS

CANÔNICO · VIGENTE · OBRIGATÓRIO · BLINDADO

**Versão:** 3.3.6 — Fonte de Verdade do Ecossistema (Constitucional Final)
**Data:** 2026-04-14
**Cobertura:** 100% dos padrões identificados no código + Infraestrutura + SSOT Financeiro + Nomes Canônicos + Blindagem Constitucional + Fingerprint operacional de catálogo (`fingerprint_v1`)

---

## 1. FINALIDADE

Este documento define a **lei única de nomenclatura** do sistema UnifiCard.

Seu objetivo é:

* eliminar ambiguidade técnica
* impedir trilhos paralelos
* garantir interoperabilidade entre camadas
* bloquear divergência semântica futura
* impedir retrabalho estrutural
* alinhar com padrões de mercado (financeiro, marketplace, ERP, logística, social)

Nomenclatura **não é estética**.
É **mecanismo de controle sistêmico**.

---

## 2. ESCOPO DE APLICAÇÃO

As regras aqui definidas se aplicam **obrigatoriamente** a:

* Banco de dados
* Backend
* APIs públicas e internas
* Frontend
* Eventos e mensageria
* Contratos
* Read models
* DTOs internos
* Persistência estruturada
* Integrações
* Infraestrutura (Docker, CI/CD)
* Observabilidade (logs, métricas)
* Git workflow

Não existem exceções locais, implícitas ou temporárias.

---

## 3. REGRA SUPREMA E NOMES CANÔNICOS

Esta seção define os princípios constitucionais de nomenclatura e os nomes canônicos obrigatórios para conceitos fundamentais do sistema.

**Escopo do Eixo de Nomenclatura:**

Este eixo regula exclusivamente nomenclatura constitucional.
Ele não altera regras de negócio, contratos financeiros ou autoridade de domínio.

> **Um conceito → um nome → uma forma.**

Se dois nomes existem para a mesma coisa:
→ o sistema está errado.

Se o mesmo nome significa coisas diferentes:
→ o sistema está errado.

### 3.1 Hierarquia Canônica de Atores

A hierarquia de autoridade é **imutável**:

1. `actor_human` — raiz constitucional (CPF)
2. `actor_organizational` — empresa, grupo, projeto (CNPJ / persona)
3. `actor_system` — sistema, job, automação, IA

**Regras obrigatórias:**
- `actor_human` é **irrenunciável**
- `actor_organizational` **NUNCA** é soberano
- `actor_system` **NUNCA** cria, delega ou herda autoridade
- Toda ação deve ser rastreável até um `actor_human`

Se não houver ator humano rastreável:
→ a ação é **inválida por definição**

**Mapeamento Ontológico (02_ACTORS_SSOT.md ↔ 07_NOMENCLATURA_CANONICA.md):**

| Ontologia (02_ACTORS_SSOT) | Representação Técnica (07) | Descrição |
|----------------------------|---------------------------|-----------|
| Pessoa Física (CPF) | `actor_human` | Raiz constitucional de autoridade |
| Pessoa Jurídica (CNPJ) ou entidade organizacional formal | `actor_organizational` | Empresa, grupo, projeto (persona operacional) |
| Sistema/Serviço/Automação | `actor_system` | Sistema, job, automação, IA |

**Regra de Equivalência:**
- Todo `actor_human` representa uma Pessoa Física (CPF) conforme definido em `02_ACTORS_SSOT.md`
- Todo `actor_organizational` representa uma Pessoa Jurídica (CNPJ) ou entidade organizacional formal conforme `02_ACTORS_SSOT.md`
- Todo `actor_system` representa sistema, serviço ou automação conforme `02_ACTORS_SSOT.md`
- Não existe mapeamento alternativo ou interpretação divergente entre os dois documentos

### 3.2 Glossário de Nomes Canônicos Constitucionais

**REGRA:** Conceitos constitucionais possuem um único nome canônico obrigatório. Variações não são permitidas.

**Amarração ao SSOT_REGISTRY_UNIFICARD:**

Este Glossário Constitucional deve estar **100% alinhado** com o `SSOT_REGISTRY_UNIFICARD.md` (localizado em `docs/01_normative/`).

**REGRA:** Divergência entre este documento e o SSOT_REGISTRY_UNIFICARD é considerada falha estrutural e exige sincronização imediata antes de qualquer merge.

**Processo de Sincronização:**
- Qualquer atualização no SSOT_REGISTRY_UNIFICARD que afete nomenclatura constitucional **DEVE** ser refletida imediatamente neste documento
- Qualquer atualização neste glossário que afete conceitos do SSOT_REGISTRY_UNIFICARD **DEVE** ser refletida imediatamente no SSOT_REGISTRY_UNIFICARD
- Processo de revisão deve verificar alinhamento entre os dois documentos antes de aprovar merge

**Nomes Canônicos Fixos:**

| Conceito Constitucional | Banco (snake_case) | Backend/API (camelCase) | Contexto |
|------------------------|-------------------|------------------------|----------|
| Identidade Econômica | `actor_id` | `actorId` | SSOT de identidade |
| Transação Financeira | `bank_transaction_id` | `bankTransactionId` | Apenas transações do Bank |
| KYC Nível | `kyc_level` | `kycLevel` | Níveis: 'none', 'basic', 'complete' |
| KYC Status | `kyc_status` | `kycStatus` | Status: 'pending', 'verified', 'rejected' |
| Propósito de Transferência | `purpose` | `purpose` | Obrigatório em transferências |
| Conclusão Interna | `internal_completed_at` | `internalCompletedAt` | Governança interna |
| Liquidação Externa | `external_settled_at` | `externalSettledAt` | SSOT financeiro (parceiro) |
| Referência Settlement | `settlement_reference` | `settlementReference` | ID do parceiro externo |
| Fonte de Autoridade | `authority_source` | `authoritySource` | 'ownership', 'delegation', 'account_acl', 'system' |
| Autoria (em nome de) | `acting_for_actor_id` | `actingForActorId` | Actor em nome do qual age |
| Autoria (conta) | `acting_for_account_id` | `actingForAccountId` | Conta em nome da qual age |

**Política de Evolução do Glossário:**

Novo conceito constitucional só pode ser adicionado após:

1. **Atualização do SSOT_REGISTRY_UNIFICARD** — O conceito deve estar formalmente definido no `SSOT_REGISTRY_UNIFICARD.md` (localizado em `docs/01_normative/`)
2. **Atualização deste documento** — O nome canônico deve ser adicionado nesta tabela
3. **Aprovação formal em Gate correspondente** — Gate 2 (SSOT) ou Gate do Eixo de Nomenclatura conforme o caso
4. **RFC aprovado** — Se o conceito for novo no sistema, requer RFC documentando impacto

**PROIBIÇÃO:** Nenhum nome constitucional pode nascer "no código primeiro" e ser ratificado depois. A ordem é: SSOT_REGISTRY_UNIFICARD → Este documento → Implementação.

**Exceção:** Correções de bugs de nomenclatura existente podem seguir processo acelerado, mas ainda requerem atualização simultânea dos dois documentos.

**Regra de Especificidade:**
- Em contexto financeiro: use `bankTransactionId` (não `transactionId` genérico)
- Transações não-financeiras: `orderTransactionId`, `inventoryTransactionId` (permitido)
- Status sem contexto: use `paymentStatus`, `orderStatus`, `kycStatus` (específico)

**Proteção Contra Enum Paralelo:**

**REGRA:** Nenhum enum constitucional pode existir com nomes distintos representando o mesmo conceito.

**Exemplos de Violação:**

❌ `kycLevel` e `verificationLevel` (mesmo conceito, nomes diferentes)
❌ `authoritySource` e `permissionSource` (mesmo conceito, nomes diferentes)
❌ `complianceTier` e `kycLevel` (se representam o mesmo conceito)

**Validação:**
- Revisão arquitetural deve verificar duplicidade semântica de enums antes de aprovar merge
- Detecção de duplicidade semântica bloqueia merge até resolução
- Apenas um nome canônico pode representar cada conceito constitucional

**Regra de Resolução:**
Em caso de duplicidade detectada, o nome mais antigo no glossário constitucional prevalece. O nome duplicado deve ser removido e todas as referências migradas para o canônico.

### 3.3 SSOT Financeiro e Autoridade

**REGRA CONSTITUCIONAL:** O Bank é a única fonte de verdade (SSOT) para dados financeiros.

**PROIBIÇÃO SEMÂNTICA:**

Nenhuma estrutura pode sugerir autoridade financeira paralela ao Bank.

| Padrão Proibido | Razão | Exceção |
|----------------|-------|---------|
| Estruturas que criam saldo próprio | SSOT: saldo só existe no Bank | Read-models calculados (não persistem) |
| Estruturas que criam ledger próprio | SSOT: ledger só existe no Bank | Nenhuma |
| Estruturas que criam split próprio | SSOT: split só existe no Bank | Nenhuma |
| Estruturas que criam transação financeira | SSOT: transações financeiras só no Bank | Transações não-financeiras permitidas |

**Nomes que Violam SSOT (Fora do Bank):**

❌ `userBalance`, `walletBalance` (sugere saldo próprio)
❌ `paymentLedger`, `marketplaceLedger` (sugere ledger paralelo)
❌ `marketplaceTransaction` (se financeiro, proibido)
❌ `*_balance_cents` (persistido fora do Bank)

**Permitido (Não-Financeiro):**

✔ `orderTransactionId` (transação de pedido, não financeira)
✔ `inventoryTransaction` (transação de estoque)
✔ `auditTransaction` (transação de auditoria)
✔ `stateTransitionTransaction` (transição de estado)

**Validação:**
Foco em autoridade semântica, não em strings literais. Script `validate-financial-ssot.js` valida contexto, não apenas nome.

### 3.4 Proteção Contra Ambiguidade Semântica

**REGRA:** Termos genéricos sem contexto são PROIBIDOS em contratos públicos.

| Termo Genérico | Status | Obrigatório em Contratos Públicos |
|----------------|--------|----------------------------------|
| `status` | ❌ PROIBIDO isolado | `paymentStatus`, `orderStatus`, `kycStatus` |
| `state` | ❌ PROIBIDO isolado | `orderState`, `accountState`, `actorState` |
| `type` | ❌ PROIBIDO isolado | `transactionType`, `entryType`, `splitType` |
| `kind` | ❌ PROIBIDO | Use termo específico ou `transactionType` |
| `category` | ⚠️ Permitido com contexto | `serviceCategory`, `productCategory` |
| `level` | ⚠️ Permitido com contexto | `kycLevel`, `logLevel`, `priorityLevel` |

**Exceções (Termos Canônicos Estabelecidos):**

Estes termos são canônicos e não requerem prefixo:
- `entity_type` (tipos de entidade)
- `actor_type` (tipos de ator)
- `event_type` (tipos de evento)

**Regra de Aplicação:**
- Contratos públicos (API, DTOs): sempre específico
- Código interno: preferir específico, mas não bloqueia se contexto claro
- Banco de dados: sempre específico (ex: `payment_status`, não `status`)

### 3.5 Cláusula de Invalidação Constitucional

**REGRA SUPREMA:** Qualquer introdução de nome que viole este glossário constitucional invalida automaticamente o eixo de nomenclatura, exigindo revisão formal e reexecução dos Gates afetados.

**Processo de Invalidação:**

1. **Detecção:** Mecanismos de validação (automatizados quando existentes) detectam violação de nome canônico
2. **Bloqueio:** Merge bloqueado automaticamente
3. **Notificação:** Gate correspondente marcado como FAIL
4. **Revisão:** Requer RFC explicando a violação e proposta de correção
5. **Revalidação:** Após correção, todos os Gates afetados devem ser reexecutados

**Gates Afetados por Violação:**
- Gate 2 (SSOT) — se violação afeta conceito do SSOT_REGISTRY
- Gate do Eixo de Nomenclatura — sempre afetado
- Gate 4 (Contratos) — se violação afeta contrato público
- Gate 5 (Financeiro) — se violação afeta estrutura financeira

**Exceção:** Nenhuma. Violação constitucional não tem exceção temporária, local ou "para teste".

---

# PARTE I — BANCO DE DADOS

## 4. BANCO DE DADOS (SQL)

### 4.1 Estrutura de Schemas

```sql
{schema}.{tabela}

finance.bank_transactions
logistics.delivery_orders
inventory.stock_movements
social.group_memberships
auth.users
```
Regras:
- Schemas por domínio de negócio (não técnico)
- Nunca usar public em produção
- Tabelas temporárias: prefixo tmp_
- Views materializadas: prefixo mv_
- Tabelas de auditoria: sufixo _audit

### 4.2 Tabelas

`snake_case`
plural
substantivos

✔ `users`
✔ `bank_transactions`
✔ `ledger_entries`
✔ `delivery_orders`
✔ `inventory_items`
❌ `User`
❌ `userTransaction`

### 4.3 Colunas

`snake_case`
nomes explícitos
sem abreviações obscuras

✔ `global_user_id`
✔ `created_at`
✔ `pickup_latitude`
❌ `guid`
❌ `usr_id`
❌ `lat`

### 4.4 Chaves

Chave primária: `id`
Chave estrangeira: `<entidade>_id`

✔ `users.id`
✔ `profiles.user_id`
✔ `deliveries.driver_id`
❌ `userId`
❌ `user_id_id`

### 4.5 Índices e Constraints

```sql
-- Índices:
idx_{tabela}_{coluna}              -- simples
idx_{tabela}_{col1}_{col2}         -- composto
uidx_{tabela}_{coluna}             -- único

-- Constraints:
pk_{tabela}                        -- primary key
fk_{tabela}_{coluna}_{ref_tabela}  -- foreign key
chk_{tabela}_{regra}               -- check
```

**Exemplos:**

✔ `idx_users_email`
✔ `idx_orders_created_at_status`
✔ `uidx_users_cpf`
✔ `fk_transactions_user_id_users`
### 4.6 Timestamps

Sufixo obrigatório: `_at`
Sempre `TIMESTAMPTZ` (com timezone)

**Timestamps Gerais**

✔ `created_at`
✔ `updated_at`
✔ `deleted_at`

**Timestamps Financeiros**

✔ `paid_at`
✔ `settled_at`
✔ `authorized_at`
✔ `captured_at`
✔ `refunded_at`
✔ `cancelled_at`
✔ `expired_at`

**Timestamps de Logística/Operação**

✔ `scheduled_at`
✔ `promised_at`
✔ `deadline_at`
✔ `dispatched_at`
✔ `picked_up_at`
✔ `departed_at`
✔ `arrived_at`
✔ `delivered_at`
✔ `returned_at`
✔ `eta_at` (estimated time of arrival)
✔ `etd_at` (estimated time of departure)

**Timestamps de Agendamento**

✔ `starts_at`
✔ `ends_at`
✔ `opens_at`
✔ `closes_at`
✔ `available_from_at`
✔ `available_until_at`
✔ `valid_from_at`
✔ `valid_until_at`

**Timestamps de Verificação/KYC**

✔ `verified_at`
✔ `approved_at`
✔ `rejected_at`
✔ `submitted_at`
✔ `reviewed_at`

**Timestamps de Comunicação**

✔ `sent_at`
✔ `read_at`
✔ `received_at`
✔ `opened_at`
✔ `clicked_at`

❌ `creation_date`
❌ `date_created`
❌ `timestamp`
❌ `created`
❌ `create_time`
❌ `delivery_date` (usar `delivered_at`)
❌ `start_time` (usar `starts_at`)
❌ `end_time` (usar `ends_at`)

### 4.7 Valores Monetários

Sempre em centavos (inteiro), nunca float/decimal
Sufixo obrigatório: `_cents`
Moeda explícita quando multi-moeda: `_brl_cents`, `_usd_cents`
Tipo: `BIGINT` (não INTEGER — suporta até 92 quatrilhões de centavos)

**Campos Monetários Padrão (Financeiro/Marketplace)**

| Campo | Descrição |
|-------|-----------|
| `amount_cents` | Valor principal da transação |
| `gross_cents` | Valor bruto (antes de taxas) |
| `net_cents` | Valor líquido (após taxas) |
| `fee_cents` | Taxa total cobrada |
| `platform_fee_cents` | Taxa da plataforma |
| `gateway_fee_cents` | Taxa do gateway/adquirente |
| `commission_cents` | Comissão do intermediário |
| `tax_cents` | Imposto em centavos |
| `discount_cents` | Desconto aplicado |
| `refund_cents` | Valor estornado |
| `balance_cents` | Saldo atual |
| `available_cents` | Saldo disponível para saque |
| `pending_cents` | Saldo pendente/bloqueado |
| `reserved_cents` | Saldo reservado (escrow) |
| `current_balance_cents` | Saldo atual da conta |

**Campos Monetários de Logística**

| Campo | Descrição |
|-------|-----------|
| `delivery_fee_cents` | Taxa de entrega |
| `shipping_cents` | Custo de envio |
| `handling_fee_cents` | Taxa de manuseio |
| `insurance_cents` | Valor do seguro |
| `toll_cents` | Valor de pedágios |
| `fuel_surcharge_cents` | Sobretaxa de combustível |
| `tip_cents` | Gorjeta |
| `base_fare_cents` | Tarifa base (ride-hailing) |
| `surge_cents` | Tarifa dinâmica/surge |
| `distance_fare_cents` | Tarifa por distância |
| `time_fare_cents` | Tarifa por tempo |

**Campos Monetários de Subscription**

| Campo | Descrição |
|-------|-----------|
| `subscription_price_cents` | Preço da assinatura |
| `ticket_price_cents` | Preço do ingresso |
| `reservation_price_cents` | Preço da reserva |
| `unit_price_cents` | Preço unitário |
| `total_price_cents` | Preço total |
| `budget_min_cents` | Orçamento mínimo |
| `budget_max_cents` | Orçamento máximo |
| `no_show_penalty_cents` | Multa por no-show |

**É PROIBIDO:**
- Armazenar dinheiro como FLOAT, DOUBLE, DECIMAL, NUMERIC
- Omitir sufixo `_cents`
- Usar nome genérico como `value` ou `amount` sem sufixo
- Armazenar em reais/dólares (sempre centavos)

### 4.8 Taxas e Percentuais

Taxas percentuais em basis points (bps): 1% = 100 bps
Sufixo obrigatório: `_bps` (basis points)
Tipo: `INTEGER`

✔ `tax_rate_bps` (1000 = 10%)
✔ `commission_rate_bps` (250 = 2.5%)
✔ `platform_fee_rate_bps`
✔ `interest_rate_bps`
✔ `surge_multiplier_bps` (1500 = 1.5x)
❌ `tax_rate` (ambíguo: é 0.1 ou 10?)
❌ `commission_percent`
❌ `fee_percentage`

**Tabela de Conversão:**

| Percentual | Basis Points |
|------------|--------------|
| 0.5% | 50 bps |
| 1% | 100 bps |
| 2.5% | 250 bps |
| 10% | 1000 bps |
| 100% | 10000 bps |
| 1.5x (multiplicador) | 15000 bps |
| 2x (multiplicador) | 20000 bps |

### 4.9 Booleanos

Prefixo obrigatório: `is_`, `has_`, `can_`, `should_`, `was_`, `requires_`
Tipo: `BOOLEAN`
Default explícito obrigatório

**Booleanos de Estado**

✔ `is_active`
✔ `is_deleted`
✔ `is_published`
✔ `is_visible`
✔ `is_featured`
✔ `is_verified`
✔ `is_approved`
✔ `is_blocked`
✔ `is_suspended`

**Booleanos de Capacidade**

✔ `can_withdraw`
✔ `can_receive`
✔ `can_edit`
✔ `can_delete`
✔ `can_share`

**Booleanos de Propriedade**

✔ `has_permission`
✔ `has_split`
✔ `has_tracking`
✔ `has_insurance`
✔ `has_subscription`

**Booleanos de Requisitos**

✔ `requires_signature`
✔ `requires_approval`
✔ `requires_verification`
✔ `requires_payment`

**Booleanos de Características**

✔ `is_fragile`
✔ `is_perishable`
✔ `is_refrigerated`
✔ `is_frozen`
✔ `is_hazardous`
✔ `is_open` (estabelecimento)
✔ `is_24h`
✔ `is_available`
✔ `is_refundable`
❌ `active`
❌ `permission`
❌ `deleted`
❌ `processed`
❌ `active_flag`
❌ `fragile`

### 4.10 Moeda (Currency)

Padrão ISO 4217 (3 letras maiúsculas)
Tipo: `VARCHAR(3)` ou `CHAR(3)`
Coluna: `currency` ou `currency_code`

✔ `currency = 'BRL'`
✔ `currency = 'USD'`
✔ `settlement_currency`
❌ `currency = 'R$'`
❌ `currency = 'real'`
❌ `currency = 986` (código numérico — evitar)

**Moedas comuns:**

| Código | Moeda |
|--------|-------|
| BRL | Real Brasileiro |
| USD | Dólar Americano |
| EUR | Euro |
| GBP | Libra Esterlina |

### 4.11 Status e Lifecycle

`snake_case`
Verbos no passado ou estado atual
Coluna: `status`
Tipo: `VARCHAR` ou `ENUM`

**Status de Pagamento (padrão mercado)**

```sql
'pending'           -- Aguardando processamento
'processing'        -- Em processamento
'authorized'        -- Autorizado (pré-captura)
'captured'          -- Capturado (dinheiro movido)
'settled'           -- Liquidado (disponível)
'failed'            -- Falhou
'cancelled'         -- Cancelado antes de captura
'refunded'          -- Estornado totalmente
'partially_refunded'-- Estornado parcialmente
'disputed'          -- Em disputa/chargeback
'expired'           -- Expirado
```

**Status de Pedido/Order (marketplace)**

```sql
'draft'             -- Rascunho
'pending_payment'   -- Aguardando pagamento
'paid'              -- Pago
'processing'        -- Em processamento/preparo
'ready'             -- Pronto para envio/coleta
'shipped'           -- Enviado
'delivered'         -- Entregue
'completed'         -- Concluído
'cancelled'         -- Cancelado
'refunded'          -- Reembolsado
```

**Status de Entrega/Delivery (logística)**

```sql
'pending'           -- Aguardando
'confirmed'         -- Confirmado
'assigned'          -- Atribuído a entregador
'picking_up'        -- Indo buscar
'picked_up'         -- Coletado
'in_transit'        -- Em trânsito
'out_for_delivery'  -- Saiu para entrega
'arriving'          -- Chegando
'arrived'           -- Chegou no destino
'delivered'         -- Entregue
'failed_attempt'    -- Tentativa falhou
'returned'          -- Devolvido
'cancelled'         -- Cancelado
```

**Status de Entregador/Driver**

```sql
'offline'           -- Offline
'online'            -- Online/disponível
'busy'              -- Ocupado em entrega
'on_break'          -- Em pausa
'returning'         -- Retornando
```

**Status de Saque/Payout**

```sql
'pending'           -- Aguardando
'processing'        -- Em processamento
'completed'         -- Concluído
'failed'            -- Falhou
'reversed'          -- Revertido
'blocked'           -- Bloqueado
```

**Status de Estoque/Inventory**

```sql
'in_stock'          -- Em estoque
'low_stock'         -- Estoque baixo
'out_of_stock'      -- Sem estoque
'discontinued'      -- Descontinuado
'pre_order'         -- Pré-venda
'backordered'       -- Aguardando reposição
```

**Status de Verificação/KYC**

```sql
'not_started'       -- Não iniciado
'pending'           -- Aguardando análise
'in_review'         -- Em revisão
'approved'          -- Aprovado
'rejected'          -- Rejeitado
'expired'           -- Expirado
'suspended'         -- Suspenso
'unverified'        -- Não verificado
```

**Status de Subscription**

```sql
'trialing'          -- Em período de trial
'active'            -- Ativo
'past_due'          -- Pagamento atrasado
'paused'            -- Pausado
'cancelled'         -- Cancelado
'expired'           -- Expirado
```

**Status de Conteúdo/Publicação**

```sql
'draft'             -- Rascunho
'pending_review'    -- Aguardando revisão
'published'         -- Publicado
'unpublished'       -- Despublicado
'archived'          -- Arquivado
'deleted'           -- Deletado
```

**Status de Disputa**

```sql
'opened'            -- Aberta
'in_progress'       -- Em andamento
'resolved'          -- Resolvida
'escalated'         -- Escalada
'closed'            -- Fechada
```

**Status Gerais Adicionais**

```sql
'wip'               -- Work in progress
'imported'          -- Importado
'calculated'        -- Calculado
'skipped'           -- Pulado
'revoked'           -- Revogado
'released'          -- Liberado
'reserved'          -- Reservado
'sent'              -- Enviado
'accepted'          -- Aceito
'requested'         -- Solicitado
'healthy'           -- Saudável (health check)
'auto_active'       -- Ativo automaticamente
'available'         -- Disponível
'executed'          -- Executado
'open'              -- Aberto
```

### 4.12 Identificadores Externos e Idempotência

**Idempotency Key (CRÍTICO para pagamentos)**

Coluna: `idempotency_key`
Tipo: `VARCHAR(255)` com `UNIQUE`
Obrigatório em: transações, pagamentos, transferências

✔ `idempotency_key`
❌ `idempotent_key`
❌ `idem_key`
❌ `request_id` (diferente de idempotency)

**External/Reference IDs**

| Campo | Uso |
|-------|-----|
| `external_id` | ID no sistema externo/parceiro |
| `reference_id` | ID de referência para reconciliação |
| `gateway_id` | ID no gateway de pagamento |
| `acquirer_id` | ID na adquirente |
| `provider_id` | ID no provedor de serviço |
| `correlation_id` | ID para rastreamento distribuído |
| `trace_id` | ID de trace (OpenTelemetry) |
| `request_id` | ID da requisição HTTP |
| `tracking_code` | Código de rastreio (logística) |
| `waybill_number` | Número do conhecimento de transporte |
| `shipment_id` | ID do envio |
| `context_id` | ID do contexto de execução |
| `job_id` | ID do job/tarefa |
✔ `gateway_transaction_id`
✔ `stripe_payment_id`
✔ `acquirer_nsu`
✔ `tracking_code`
❌ `ext_id`
❌ `ref`
❌ `third_party_id`

#### 4.12.1 Idempotência de handlers de eventos (efeitos persistidos)

**Âmbito:** processamento de eventos (bus, filas, workers) que **persistem** efeitos — ledger, `inventory_movements`, mudança de estado em entidades, etc. **Não** substitui idempotência de API HTTP (`Idempotency-Key` em §4.12); **complementa** para **replay / retry / reentrega**.

**Implementação de referência:** `backend/src/core/events/idempotency-tracker.ts` — função `withIdempotency`.

**Regra obrigatória**

Todo handler que produz **efeito persistido** idempotente DEVE envolver o trabalho com `withIdempotency` (ou mecanismo equivalente registado na tabela `event_idempotency_tracking`), exceto:

- handlers **puramente informativos** (ex.: notificação push) quando duplicação for aceitável explicitamente.

Inclui, entre outros:

- escritas que acionam ou transitam por `bank_ledger` (via serviços canónicos);
- escritas em `inventory_movements`;
- alterações de estado persistidas derivadas do evento.

**Formato canónico da chave (semântica humana)**

Para **desenho, revisão de PR e documentação**, a chave lógica DEVE seguir:

```text
${event_type}:${reference_id}:${handler_name}
```

Onde:

- `event_type` — tipo do evento de domínio (ex.: `core.review.created`, alinhado a §8 / §10 quando versionado);
- `reference_id` — identificador da **unidade de efeito** do handler (não só o ID do envelope do evento);
- `handler_name` — nome **estável** e **único por efeito** (ver colisões abaixo).

Exemplos:

```text
payment.pix.confirmed:tx_8f3a2:applyPaymentToLedger
inventory.reserved:order_91a7:reserveStock
core.review.created:rev_abc123:reputation.applyReview
```

**Regra crítica — `reference_id`**

`reference_id` DEVE representar a **unidade de efeito** do handler. Se um único evento gera **vários efeitos independentes** (vários movimentos, várias linhas de ledger, vários SKUs), cada efeito DEVE ter `reference_id` distinto **ou** o `handler_name` DEVE diferenciar o efeito (ex.: sufixo estável), de modo que **não** haja colisão na linha de idempotência nem bloqueio indevido.

**Mapeamento para a API atual (`withIdempotency`)**

A função exposta é:

```ts
withIdempotency<T>(
  tenantId: string,
  eventId: string,
  eventType: string,
  handlerName: string,
  payload: unknown,
  handler: () => Promise<T>
): Promise<T>
```

- `eventType` — corresponde a `event_type` (1.º segmento da chave canónica).
- `handlerName` — corresponde ao 3.º segmento; DEVE ser **único por efeito** quando o mesmo `eventId` puder disparar mais do que um efeito persistido distinto.
- `eventId` — identificador estável do **processamento** no bus (ex.: `event.eventId`). Para fluxos não ligados ao bus, usar identificador de negócio estável (ex.: id de autorização) **documentado** no handler.
- `payload` — deve ser **estável** entre retries do mesmo efeito; incluir campos necessários para o 2.º segmento (`reference_id`) quando aplicável (ex.: `reviewId`, `transactionId`).

A coluna `idempotency_key` na base pode armazenar hash derivado; a **forma canónica** acima continua obrigatória para decisões de desenho e revisão.

**Comportamento esperado**

1. Primeira execução com sucesso → processa e regista `success`.
2. Retry com a mesma combinação `(tenant, evento, handler, payload estável)` → devolve resultado anterior sem reexecutar efeitos.
3. Replay → não duplica efeito persistido.
4. Erro → registo de erro; **evolução futura:** política de reprocessamento após erro deve ser explícita para fluxos financeiros multi-passo (compensação / transações).

**Efeitos financeiros irreversíveis — regra de ouro (single effect)**

Idempotência de **evento** evita duplicação em **replay**; não substitui **atomicidade** entre vários passos **dentro** do mesmo handler. Se a primeira execução falhar **a meio** (ex.: ledger já aplicado, passo seguinte falha), o retry pode **reexecutar o callback inteiro** e duplicar o primeiro efeito.

Por isso:

- **Proibido:** no **mesmo** bloco `withIdempotency`, encadear **vários** efeitos financeiros irreversíveis (ex.: `createSimpleTransaction` / transferência **e** libertação de custódia **e** outro estado persistido crítico) como se fossem uma unidade atómica sem compensação.
- **Obrigatório:** **um** efeito financeiro irreversível **por** bloco idempotente (ou **um** `handler_name` distinto por efeito, com `reference_id` adequado). Efeitos adicionais → **outro** handler (outro subscritor / outro job) ou orquestração em que cada passo tenha a sua própria chave de idempotência.

Isto alinha com o formato `${event_type}:${reference_id}:${handler_name}`: cada efeito tem **handler_name** (e, se necessário, **reference_id**) próprios.

**Anti-patterns (proibidos)**

- Usar **apenas** `event_id` como identificador de efeito quando vários handlers ou efeitos partilham o mesmo evento sem distinção.
- Gerar UUID aleatório como única base da chave de idempotência de negócio.
- Reutilizar o mesmo `reference_id` para efeitos distintos.
- Omitir `handler_name` distinto quando dois handlers diferentes reagem ao mesmo evento com efeitos persistidos.
- Encadear **vários** efeitos irreversíveis (ledger + custódia, ledger + estado crítico, etc.) no **mesmo** callback `withIdempotency` sem modelo de compensação explícito.

**Inventário — movimentos múltiplos**

**Recomendação:** **Opção A** — cada movimento (ou linha de efeito) com **seu próprio** `reference_id` (ex.: por linha de movimento / SKU / suboperação). Índices ou `UNIQUE` em `(tenant_id, reference_type, reference_id, movement_type)` são decisão de schema; o essencial é a regra de **unidade de efeito** explícita na norma, para evitar bloqueio indevido ou duplicação.

**Checklist por novo handler**

- [ ] Usa `withIdempotency` (ou equivalente aprovado).
- [ ] `handler_name` estável e único no âmbito do efeito.
- [ ] `reference_id` / payload refletem a unidade de efeito correta.
- [ ] Forma canónica `event_type:reference_id:handler_name` documentada em comentário no handler ou neste documento.
- [ ] Sem efeitos colaterais fora do bloco idempotente que não possam ser repetidos com segurança.
- [ ] (Financeiro) No máximo **um** efeito irreversível por bloco idempotente; vários efeitos → vários handlers ou chaves distintas (ver regra de ouro acima).

**Ligação com gates financeiros:** §17.6.1 — idempotência reduz duplicação de efeito mesmo quando o gate de ledger ainda estiver em modo observação.

### 4.13 Audit Fields (Auditoria)

Toda tabela crítica DEVE ter:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `created_at` | TIMESTAMPTZ | Quando foi criado |
| `created_by` | UUID | Quem criou (actor_id) |
| `updated_at` | TIMESTAMPTZ | Última atualização |
| `updated_by` | UUID | Quem atualizou |
| `deleted_at` | TIMESTAMPTZ | Soft delete timestamp |
| `deleted_by` | UUID | Quem deletou |
| `version` | INTEGER | Versão para optimistic locking |

**Variações com contexto:**

| Campo | Descrição |
|-------|-----------|
| `created_by_user_id` | Criado por usuário específico |
| `created_by_actor_id` | Criado por ator (usuário/sistema) |
| `approved_by` | Aprovado por |
| `rejected_by` | Rejeitado por |
| `cancelled_by` | Cancelado por |

### 4.14 Soft Delete
Usar deleted_at (não is_deleted)
deleted_at IS NULL = ativo
deleted_at IS NOT NULL = deletado
✔ deleted_at
✔ deleted_by
❌ is_deleted (redundante com deleted_at)
❌ removed
❌ inactive

### 4.15 Versionamento e Concorrência

Coluna: `version`
Tipo: `INTEGER`
Incrementa a cada UPDATE
Usado para optimistic locking

```sql
UPDATE accounts 
SET balance_cents = 1000, version = version + 1
WHERE id = ? AND version = ?
```

✔ `version`
❌ `revision`
❌ `v`
❌ `lock_version`

### 4.16 Multi-Tenancy

| Campo | Uso |
|-------|-----|
| `tenant_id` | ID do tenant/inquilino |
| `organization_id` | ID da organização |
| `company_id` | ID da empresa |
| `merchant_id` | ID do lojista (marketplace) |
| `seller_id` | ID do vendedor |
| `buyer_id` | ID do comprador |
| `store_id` | ID da loja |
| `branch_id` | ID da filial |
| `warehouse_id` | ID do armazém |
| `region_id` | ID da região |
| `city_id` | ID da cidade |
| `country_id` | ID do país |

### 4.17 Ledger Double-Entry (Contabilidade)

Para sistemas de ledger com partidas dobradas:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `entry_type` | VARCHAR | 'debit' ou 'credit' |
| `debit_cents` | BIGINT | Valor do débito |
| `credit_cents` | BIGINT | Valor do crédito |
| `account_id` | UUID | Conta afetada |
| `contra_account_id` | UUID | Conta contrapartida |
| `journal_id` | UUID | ID do lançamento |
| `posting_date` | DATE | Data contábil |
| `effective_date` | DATE | Data efetiva |
Regra contábil:

```plain
SUM(debit_cents) = SUM(credit_cents) -- sempre
```

### 4.18 Split de Pagamento (Marketplace)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `split_id` | UUID | ID do split |
| `transaction_id` | UUID | Transação origem |
| `recipient_id` | UUID | Quem recebe |
| `recipient_type` | VARCHAR | 'seller', 'platform', 'referral' |
| `amount_cents` | BIGINT | Valor do split |
| `percentage_bps` | INTEGER | Percentual em basis points |
| `is_liable` | BOOLEAN | Responsável por chargeback |
| `is_charge_processing_fee` | BOOLEAN | Paga taxa de processamento |

### 4.19 Geolocalização

Coordenadas em graus decimais (não DMS)
Tipo: `DECIMAL(10, 7)` para latitude, `DECIMAL(11, 7)` para longitude
Ou tipo `GEOGRAPHY/GEOMETRY` (PostGIS)

**Campos de Coordenadas**

| Campo | Tipo | Descrição | Range |
|-------|------|-----------|-------|
| `latitude` | DECIMAL(10,7) | Latitude | -90 a +90 |
| `longitude` | DECIMAL(11,7) | Longitude | -180 a +180 |
| `altitude_meters` | DECIMAL(8,2) | Altitude em metros | - |
| `accuracy_meters` | DECIMAL(8,2) | Precisão do GPS | - |
| `heading_degrees` | DECIMAL(5,2) | Direção em graus | 0 a 360 |
| `speed_mps` | DECIMAL(6,2) | Velocidade m/s | - |

**Campos com Prefixo de Contexto**

| Campo | Descrição |
|-------|-----------|
| `pickup_latitude` | Latitude do ponto de coleta |
| `pickup_longitude` | Longitude do ponto de coleta |
| `dropoff_latitude` | Latitude do destino |
| `dropoff_longitude` | Longitude do destino |
| `current_latitude` | Latitude atual (tracking) |
| `current_longitude` | Longitude atual (tracking) |
| `origin_latitude` | Latitude de origem |
| `origin_longitude` | Longitude de origem |
| `destination_latitude` | Latitude de destino |
| `destination_longitude` | Longitude de destino |
✔ latitude, longitude
✔ pickup_latitude, pickup_longitude
✔ altitude_meters
❌ lat, lng, lon (abreviações)
❌ geo_lat (redundante)
❌ x, y (ambíguo)
### 4.20 Endereços

**Campos de Endereço (padrão internacional)**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `address_line_1` | VARCHAR(255) | Logradouro + número |
| `address_line_2` | VARCHAR(255) | Complemento |
| `neighborhood` | VARCHAR(100) | Bairro |
| `city` | VARCHAR(100) | Cidade |
| `state` | VARCHAR(100) | Estado/Província |
| `state_code` | VARCHAR(10) | Código do estado (SP, RJ) |
| `postal_code` | VARCHAR(20) | CEP/Código postal |
| `country` | VARCHAR(100) | País |
| `country_code` | CHAR(2) | ISO 3166-1 alpha-2 (BR, US) |

**Campos Específicos Brasil**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `street` | VARCHAR(255) | Logradouro |
| `street_number` | VARCHAR(20) | Número |
| `complement` | VARCHAR(100) | Complemento |
| `reference` | VARCHAR(255) | Ponto de referência |
| `ibge_code` | VARCHAR(10) | Código IBGE da cidade |
✔ address_line_1
✔ postal_code
✔ country_code
❌ addr1
❌ zip (usar postal_code)
❌ zip_code (usar postal_code)

### 4.21 Distância e Duração

Distância em metros (inteiro)
Duração em segundos (inteiro) ou minutos para durações maiores
Sufixos obrigatórios: `_meters`, `_seconds`, `_minutes`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `distance_meters` | INTEGER | Distância em metros |
| `duration_seconds` | INTEGER | Duração em segundos |
| `duration_minutes` | INTEGER | Duração em minutos |
| `radius_meters` | INTEGER | Raio em metros |
| `max_distance_meters` | INTEGER | Distância máxima |
| `walking_duration_seconds` | INTEGER | Tempo a pé |
| `driving_duration_seconds` | INTEGER | Tempo de carro |
| `transit_duration_seconds` | INTEGER | Tempo de transporte público |
| `eta_minutes` | INTEGER | ETA em minutos |
| `preparation_time_minutes` | INTEGER | Tempo de preparo |
| `response_time_minutes` | INTEGER | Tempo de resposta |
✔ distance_meters
✔ duration_seconds
✔ duration_minutes
✔ eta_minutes
❌ distance (sem unidade)
❌ duration (sem unidade)
❌ duration_min (ambíguo: minutos ou mínimo?)
❌ time (ambíguo)
IMPORTANTE: Não usar _min como sufixo para minutos. Usar _minutes.

### 4.22 Zonas e Áreas Geográficas

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `zone_id` | UUID | ID da zona |
| `zone_code` | VARCHAR(50) | Código da zona |
| `zone_name` | VARCHAR(100) | Nome da zona |
| `zone_type` | VARCHAR(50) | 'delivery', 'pricing', 'service' |
| `geofence` | GEOMETRY | Polígono da área (PostGIS) |
| `polygon` | JSONB | Polígono como array de coordenadas |
| `center_latitude` | DECIMAL(10,7) | Centro da zona |
| `center_longitude` | DECIMAL(11,7) | Centro da zona |
| `bounding_box` | BOX | Retângulo delimitador |

### 4.23 Estoque e Inventário

**Identificação de Produto**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `sku` | VARCHAR(100) | Stock Keeping Unit (único) |
| `upc` | VARCHAR(20) | Universal Product Code |
| `ean` | VARCHAR(20) | European Article Number |
| `isbn` | VARCHAR(20) | ISBN (livros) |
| `asin` | VARCHAR(20) | Amazon Standard ID |
| `mpn` | VARCHAR(100) | Manufacturer Part Number |
| `gtin` | VARCHAR(20) | Global Trade Item Number |

**Quantidades**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `quantity` | INTEGER | Quantidade geral |
| `available_quantity` | INTEGER | Disponível para venda |
| `reserved_quantity` | INTEGER | Reservado (em carrinho/pedido) |
| `committed_quantity` | INTEGER | Comprometido (pedido confirmado) |
| `on_hand_quantity` | INTEGER | Em mãos (físico no armazém) |
| `in_transit_quantity` | INTEGER | Em trânsito |
| `damaged_quantity` | INTEGER | Danificado |
| `min_quantity` | INTEGER | Estoque mínimo (alerta) |
| `max_quantity` | INTEGER | Estoque máximo |
| `reorder_quantity` | INTEGER | Quantidade para reposição |
| `reorder_point` | INTEGER | Ponto de reposição |
✔ available_quantity
✔ reserved_quantity
❌ qty (abreviação)
❌ stock (ambíguo)
❌ count (ambíguo)

### 4.24 Unidades de Medida

Sempre usar unidades base do SI quando possível
Sufixo obrigatório com unidade

**Peso**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `weight_grams` | INTEGER | Peso em gramas |
| `weight_kg` | DECIMAL(10,3) | Peso em quilos (quando necessário) |
| `net_weight_grams` | INTEGER | Peso líquido |
| `gross_weight_grams` | INTEGER | Peso bruto |
| `tare_weight_grams` | INTEGER | Tara |

**Volume**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `volume_ml` | INTEGER | Volume em mililitros |
| `volume_liters` | DECIMAL(10,3) | Volume em litros |
| `capacity_ml` | INTEGER | Capacidade |

**Dimensões**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `length_cm` | DECIMAL(10,2) | Comprimento em cm |
| `width_cm` | DECIMAL(10,2) | Largura em cm |
| `height_cm` | DECIMAL(10,2) | Altura em cm |
| `depth_cm` | DECIMAL(10,2) | Profundidade em cm |
| `diameter_cm` | DECIMAL(10,2) | Diâmetro em cm |
| `cubic_meters` | DECIMAL(10,4) | Volume cúbico (m³) |
| `dimensional_weight_grams` | INTEGER | Peso cubado |
✔ weight_grams
✔ length_cm
✔ volume_ml
❌ weight (sem unidade)
❌ size (ambíguo)
❌ dimensions (ambíguo)

### 4.25 Horário de Funcionamento

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `opens_at` | TIME | Hora de abertura |
| `closes_at` | TIME | Hora de fechamento |
| `day_of_week` | INTEGER | Dia da semana (0=Dom, 1=Seg...) |
| `is_open` | BOOLEAN | Está aberto |
| `is_24h` | BOOLEAN | Funciona 24h |
| `timezone` | VARCHAR(50) | Fuso horário IANA |

### 4.26 Fuso Horário

Padrão IANA Time Zone Database
Tipo: `VARCHAR(50)`
Coluna: `timezone`

✔ `timezone = 'America/Sao_Paulo'`
✔ `timezone = 'America/New_York'`
✔ `timezone = 'UTC'`
❌ `timezone = 'BRT'` (abreviação)
❌ `timezone = '-03:00'` (offset, não timezone)
❌ `timezone = 'GMT-3'`

**Timezones Brasil:**

| Timezone | Região |
|----------|--------|
| America/Sao_Paulo | Brasília, SP, RJ, MG, etc. |
| America/Manaus | Amazonas |
| America/Belem | Pará |
| America/Fortaleza | Ceará, RN, PB, etc. |
| America/Recife | Pernambuco |
| America/Cuiaba | Mato Grosso |
| America/Porto_Velho | Rondônia |
| America/Rio_Branco | Acre |

### 4.27 Agendamento e Time Slots

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `scheduled_at` | TIMESTAMPTZ | Data/hora agendada |
| `scheduled_date` | DATE | Data agendada |
| `slot_start_at` | TIMESTAMPTZ | Início do slot |
| `slot_end_at` | TIMESTAMPTZ | Fim do slot |
| `slot_duration_minutes` | INTEGER | Duração do slot |
| `buffer_minutes` | INTEGER | Tempo de preparo/buffer |
| `lead_time_minutes` | INTEGER | Tempo de antecedência |
| `cutoff_time` | TIME | Horário limite |
| `preparation_time_minutes` | INTEGER | Tempo de preparo |

### 4.28 Recorrência (RRULE - RFC 5545)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `rrule` | VARCHAR(500) | Regra de recorrência iCal |
| `frequency` | VARCHAR(20) | 'daily', 'weekly', 'monthly', 'yearly' |
| `interval` | INTEGER | Intervalo (a cada N) |
| `count` | INTEGER | Número de ocorrências |
| `until_at` | TIMESTAMPTZ | Data final |
by_day	VARCHAR(50)	Dias da semana ('MO,WE,FR')
by_month	VARCHAR(50)	Meses ('1,6,12')
by_month_day	VARCHAR(50)	Dias do mês ('1,15')
✔ frequency = 'weekly'
✔ by_day = 'MO,WE,FR'
❌ repeat_type
❌ recurrence_type

### 4.29 SLA e Prazos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `sla_minutes` | INTEGER | SLA em minutos |
| `sla_hours` | INTEGER | SLA em horas |
| `deadline_at` | TIMESTAMPTZ | Prazo final |
| `promised_at` | TIMESTAMPTZ | Data prometida |
| `expected_at` | TIMESTAMPTZ | Data esperada |
| `target_at` | TIMESTAMPTZ | Data alvo |
| `is_sla_breached` | BOOLEAN | SLA foi violado |
| `sla_breached_at` | TIMESTAMPTZ | Quando violou SLA |
| `response_time_seconds` | INTEGER | Tempo de resposta |
| `resolution_time_seconds` | INTEGER | Tempo de resolução |

### 4.30 Rastreamento e Checkpoints (Tracking)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tracking_code` | VARCHAR(100) | Código de rastreio |
| `carrier` | VARCHAR(50) | Transportadora |
| `carrier_code` | VARCHAR(20) | Código da transportadora |
| `service_type` | VARCHAR(50) | Tipo de serviço (SEDEX, PAC) |
| `checkpoint_status` | VARCHAR(50) | Status do checkpoint |
| `checkpoint_at` | TIMESTAMPTZ | Data/hora do checkpoint |
| `checkpoint_location` | VARCHAR(255) | Local do checkpoint |
| `checkpoint_message` | TEXT | Mensagem/descrição |
```

### 4.31 Veículos e Entregadores

#### Entidade: DriverVehicle

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `driver_id` | `UUID` | Identificador único do entregador (`actor_id` quando aplicável) |
| `vehicle_id` | `UUID` | Identificador único do veículo |
| `vehicle_type` | `VARCHAR(30)` | Tipo de veículo (enum controlado) |
| `plate_number` | `VARCHAR(20)` | Placa do veículo |
| `vehicle_model` | `VARCHAR(100)` | Modelo do veículo |
| `vehicle_color` | `VARCHAR(30)` | Cor do veículo |
| `vehicle_year` | `INTEGER` | Ano de fabricação |
| `license_number` | `VARCHAR(50)` | Número da CNH do entregador |
| `license_category` | `VARCHAR(10)` | Categoria da CNH |
| `license_expires_at` | `DATE` | Data de expiração da CNH |

---

#### Enum: vehicle_type (controlado)

```sql
'bicycle'     -- Bicicleta
'motorcycle'  -- Motocicleta
'car'         -- Carro
'van'         -- Van
'truck'       -- Caminhão
'scooter'     -- Patinete
'on_foot'     -- A pé

### 4.32 Temperatura e Condições (Perecíveis)

#### Entidade: PerishableConditions

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `min_temp_celsius` | `DECIMAL(5,2)` | Temperatura mínima permitida |
| `max_temp_celsius` | `DECIMAL(5,2)` | Temperatura máxima permitida |
| `current_temp_celsius` | `DECIMAL(5,2)` | Temperatura atual registrada |
| `humidity_percent` | `INTEGER` | Umidade relativa (%) |
| `is_refrigerated` | `BOOLEAN` | Indica se requer refrigeração |
| `is_frozen` | `BOOLEAN` | Indica se requer congelamento |
| `shelf_life_days` | `INTEGER` | Validade em dias |
| `expires_at` | `DATE` | Data de validade |
| `manufactured_at` | `DATE` | Data de fabricação |
| `batch_number` | `VARCHAR(50)` | Número do lote |

---

### 4.33 Scores e Ratings

#### Regras Constitucionais

- Scores internos: escala de **0 a 10000** (centésimos para precisão)
- Ratings públicos: escala de **0 a 500** (representa 0.0 a 5.0 estrelas)
- Sufixo obrigatório:
  - `_score` para métricas internas
  - `_rating` para métricas públicas
- Proibido uso de float para rating público

---

#### Scores (Internos · 0–10000)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `trust_score` | `INTEGER` | Score de confiança (0–10000) |
| `reputation_score` | `INTEGER` | Score de reputação |
| `quality_score` | `INTEGER` | Score de qualidade |
| `risk_score` | `INTEGER` | Score de risco |
| `relevance_score` | `INTEGER` | Score de relevância |
| `punctuality_score` | `INTEGER` | Score de pontualidade |
| `professionalism_score` | `INTEGER` | Score de profissionalismo |
| `diversity_score` | `INTEGER` | Score de diversidade |
| `global_score` | `INTEGER` | Score global consolidado |
| `actor_score` | `INTEGER` | Score do ator |

---

#### Ratings (Públicos · 0–500 → 0.0 a 5.0)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `rating` | `INTEGER` | Rating individual (0–500) |
| `average_rating` | `INTEGER` | Rating médio consolidado |
| `seller_rating` | `INTEGER` | Rating do vendedor |
| `driver_rating` | `INTEGER` | Rating do motorista |
| `service_rating` | `INTEGER` | Rating do serviço |
| `product_rating` | `INTEGER` | Rating do produto |

---

#### Exemplos Válidos

✔ `trust_score = 8500` → representa 85.00  
✔ `rating = 450` → representa 4.5 estrelas  

#### Proibições

❌ `score` (sem contexto)  
❌ `rating = 4.5` (não usar float)  
❌ `stars` (usar `rating`)


### 4.34 Prioridade e Severidade

Tipo: `VARCHAR(20)`  
Regra: valores padronizados em `UPPER_CASE`  
Proibido misturar case (`HIGH` vs `high` vs `High`)

---

#### Enum: priority

```sql
'BLOCKING'   -- Bloqueante (mais alto)
'CRITICAL'   -- Crítico
'HIGH'       -- Alta
'MEDIUM'     -- Média
'LOW'        -- Baixa
'ATTENTION'  -- Atenção necessária
Enum: severity (alertas/incidentes)
'CRITICAL'   -- Crítico (sistema indisponível)
'ERROR'      -- Erro
'WARNING'    -- Aviso
'INFO'       -- Informação
'AUDIT'      -- Auditoria
Campos
Campo	Tipo	Descrição
priority	VARCHAR(20)	Prioridade do item
severity	VARCHAR(20)	Severidade (alertas/incidentes)
urgency	VARCHAR(20)	Nível de urgência
impact	VARCHAR(20)	Nível de impacto

**Regra:**
`priority` define ordem de tratamento.
`severity` define impacto técnico do evento.
Não são sinônimos.

### 4.35 Visibilidade e Privacidade
Tipo: VARCHAR(20)
Regra: valores padronizados em lowercase

Enum: visibility / privacy
'public'      -- Público (todos podem ver)
'private'     -- Privado (apenas o dono)
'restricted'  -- Restrito (grupo específico)
'followers'   -- Apenas seguidores
'group'       -- Apenas membros do grupo
'unlisted'    -- Não listado (acesso via link)
'internal'    -- Interno (apenas equipe)
'secret'      -- Secreto
Campos
Campo	Tipo	Descrição
visibility	VARCHAR(20)	Visibilidade do conteúdo
privacy	VARCHAR(20)	Configuração de privacidade
access_level	VARCHAR(20)	Nível de acesso
4.36 Canais de Comunicação
Tipo: VARCHAR(20)
Regra: valores padronizados em lowercase

Enum: communication_channel
'push'      -- Push notification
'sms'       -- SMS
'email'     -- E-mail
'whatsapp'  -- WhatsApp
'voice'     -- Ligação de voz
'in_app'    -- Notificação no app
Campos
Campo	Tipo	Descrição
channel	VARCHAR(20)	Canal de comunicação
notification_channel	VARCHAR(20)	Canal de notificação
preferred_channel	VARCHAR(20)	Canal preferido
4.37 Tipos de Entidade
Tipo: VARCHAR(30)
Regra: valores padronizados em lowercase

Enum: entity_type
'user'          -- Usuário pessoa física
'page'          -- Página de negócio
'store'         -- Loja
'group'         -- Grupo
'company'       -- Empresa
'organization'  -- Organização
'system'        -- Sistema
'bot'           -- Bot/automação
Regra Constitucional de Entidade
Entidade NÃO é autoridade soberana.

Entidade NÃO pode blindar responsabilidade humana.

Entidade NÃO pode ser raiz de autoridade econômica ou jurídica.

Tipos como page, group, company, organization existem exclusivamente como persona operacional.

Responsabilidade final sempre recai sobre um actor_human.

Campos
Campo	Tipo	Descrição
entity_type	VARCHAR(30)	Tipo de entidade
owner_type	VARCHAR(30)	Tipo do proprietário
author_type	VARCHAR(30)	Tipo do autor

**Regra:**
`entity_type` representa a natureza estrutural da entidade.
`actor_type` representa o papel operacional do ator dentro do sistema.
Os dois conceitos não são intercambiáveis.

### 4.38 Tipos de Ator (Actor)
Tipo: VARCHAR(30)
Regra: valores padronizados em lowercase

Enum: actor_type
'user'              -- Usuário pessoa física
'page'              -- Página de negócio
'group'             -- Grupo (domínio social / ownership operacional; alinhado ao CHECK de `actors` pós-0064)
'channel'           -- Canal (domínio social / ownership operacional; alinhado ao CHECK de `actors` pós-0064)
'system'            -- Sistema/automação
'service_provider'  -- Prestador de serviço
'driver'            -- Motorista/entregador
'worker'            -- Trabalhador
'customer'          -- Cliente
'seller'            -- Vendedor
'buyer'             -- Comprador
'organizer'         -- Organizador de evento
Campos
Campo	Tipo	Descrição
actor_type	VARCHAR(30)	Tipo de ator
participant_type	VARCHAR(30)	Tipo de participante
recipient_type	VARCHAR(30)	Tipo de destinatário

**Regra de aderência (DDL ↔ 07):** Nenhuma tabela pode definir conjunto de valores de `actor_type` que **diverja** deste §4.38. Onde o runtime já opera com `'group'` e `'channel'` (incluindo `events.actor_type` quando aplicável), a persistência segue **estes** valores operacionais — distintos da hierarquia constitucional §3.1 (`actor_human` / `actor_organizational` / `actor_system`), que **não** substituem nem se misturam na mesma coluna de papel operacional.

### 4.39 Roles (Papéis)

Valores padronizados em `lowercase`
Tipo: `VARCHAR(30)`

```sql
'owner'             -- Proprietário
'admin'             -- Administrador
'manager'           -- Gerente
'member'            -- Membro
'moderator'         -- Moderador
'contributor'       -- Contribuidor
'viewer'            -- Visualizador (somente leitura)
'guest'             -- Convidado
'staff'             -- Equipe
'contractor'        -- Contratado
'assistant'         -- Assistente
'supplier'          -- Fornecedor
'organizer'         -- Organizador
'provider'          -- Provedor
'executor'          -- Executor
'artist'            -- Artista
'accountant'        -- Contador
'seller'            -- Vendedor
'customer'          -- Cliente
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `role` | VARCHAR(30) | Papel do usuário |
| `membership_role` | VARCHAR(30) | Papel na associação |
| `team_role` | VARCHAR(30) | Papel no time |

### 4.40 Source/Origin (Origem)

Valores padronizados em `lowercase`
Tipo: `VARCHAR(50)`

```sql
'marketplace'       -- Marketplace
'pdv'               -- Ponto de venda físico
'app'               -- Aplicativo mobile
'web'               -- Website
'api'               -- Integração API
'automation'        -- Automação
'system'            -- Sistema interno
'manual'            -- Entrada manual
'import'            -- Importação
'instant_mode'      -- Modo instantâneo
'subscription'      -- Assinatura
'referral'          -- Indicação
'store_pdv'         -- PDV da loja
'service'           -- Serviço
'event'             -- Evento
'donation'          -- Doação
'user'              -- Usuário
'other'             -- Outro
'booking_confirmation' -- Confirmação de reserva
'rfq_conversion'    -- Conversão de RFQ
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `source` | VARCHAR(50) | Origem do registro |
| `origin` | VARCHAR(50) | Origem do registro |
| `acquisition_source` | VARCHAR(50) | Origem da aquisição |
| `traffic_source` | VARCHAR(50) | Origem do tráfego |
| `lead_source` | VARCHAR(50) | Origem do lead |

### 4.41 Event Types (Tipos de Evento)

Formato: `domain.entity.action`
Valores em `lowercase` com pontos
Tipo: `VARCHAR(100)`

```sql
-- Pagamentos
'payment.created'
'payment.captured'
'payment.refunded'
'payment.failed'

-- Pedidos
'order.created'
'order.paid'
'order.shipped'
'order.delivered'
'order.cancelled'

-- Entregas
'delivery.assigned'
'delivery.picked_up'
'delivery.in_transit'
'delivery.delivered'

-- Usuários
'user.created'
'user.verified'
'user.suspended'

-- Grupos
'group.created'
'group.member.joined'
'group.member.left'

-- Eventos culturais
'event.created'
'event.published'
'event.cancelled'

-- Sistema
'system.alert.created'
'system.job.completed'

-- Core
'core.review.created'
```

| Campo | Tipo | Descrição |
event_type	VARCHAR(100)	Tipo do evento
action_type	VARCHAR(100)	Tipo da ação
trigger_type	VARCHAR(100)	Tipo do gatilho

### 4.42 Documentos Brasileiros (BR)

| Campo | Tipo | Descrição | Validação |
|-------|------|-----------|-----------|
| `cpf` | VARCHAR(11) | CPF (somente números) | 11 dígitos |
| `cnpj` | VARCHAR(14) | CNPJ (somente números) | 14 dígitos |
| `tax_id` | VARCHAR(14) | CPF ou CNPJ | 11 ou 14 dígitos |
| `rg` | VARCHAR(20) | RG | Varia por estado |
| `pis` | VARCHAR(11) | PIS/PASEP | 11 dígitos |
| `cnh` | VARCHAR(11) | CNH | 11 dígitos |
| `passport` | VARCHAR(20) | Passaporte | - |
| `voter_id` | VARCHAR(12) | Título de eleitor | 12 dígitos |
✔ cpf = '12345678901'
❌ cpf = '123.456.789-01' (sem formatação)

### 4.43 Dados Bancários (BR)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `bank_code` | VARCHAR(3) | Código do banco (ex: '001') |
| `bank_name` | VARCHAR(100) | Nome do banco |
| `branch_number` | VARCHAR(10) | Número da agência |
| `branch_digit` | VARCHAR(2) | Dígito da agência |
| `account_number` | VARCHAR(20) | Número da conta |
| `account_digit` | VARCHAR(2) | Dígito da conta |
| `account_type` | VARCHAR(20) | Tipo: 'checking', 'savings' |
| `pix_key` | VARCHAR(100) | Chave PIX |
| `pix_key_type` | VARCHAR(20) | Tipo: 'cpf', 'cnpj', 'email', 'phone', 'random' |

### 4.44 Mídia e URLs

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `avatar_url` | TEXT | URL do avatar |
| `cover_url` | TEXT | URL da capa |
| `thumbnail_url` | TEXT | URL da miniatura |
| `image_url` | TEXT | URL da imagem |
| `file_url` | TEXT | URL do arquivo |
| `logo_url` | TEXT | URL do logo |
| `icon_url` | TEXT | URL do ícone |
| `video_url` | TEXT | URL do vídeo |
| `audio_url` | TEXT | URL do áudio |
| `share_url` | TEXT | URL para compartilhamento |
✔ avatar_url
✔ cover_url
❌ avatar (usar avatar_url)
❌ img (usar image_url)

### 4.45 Contato

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `phone` | VARCHAR(20) | Telefone (E.164: +5511999999999) |
| `phone_country_code` | VARCHAR(5) | Código do país (+55) |
| `phone_number` | VARCHAR(15) | Número sem código do país |
| `email` | VARCHAR(255) | E-mail |
| `whatsapp` | VARCHAR(20) | WhatsApp (formato E.164) |
| `website` | TEXT | Website |
✔ phone = '+5511999999999'
❌ phone = '(11) 99999-9999' (sem formatação)

### 4.46 Idioma e Localização

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `language` | VARCHAR(5) | Código do idioma (ISO 639-1: pt, en) |
| `locale` | VARCHAR(10) | Locale completo (pt-BR, en-US) |
| `country_code` | CHAR(2) | ISO 3166-1 alpha-2 (BR, US) |
| `region_code` | VARCHAR(10) | Código da região/estado |
| `currency` | CHAR(3) | ISO 4217 (BRL, USD) |
| `timezone` | VARCHAR(50) | IANA timezone |

### 4.47 Subscription e Billing

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `subscription_id` | UUID | ID da assinatura |
| `plan_id` | UUID | ID do plano |
| `billing_cycle` | VARCHAR(20) | 'monthly', 'yearly', 'weekly' |
| `billing_day` | INTEGER | Dia do vencimento (1-31) |
| `trial_days` | INTEGER | Dias de trial |
| `trial_ends_at` | TIMESTAMPTZ | Fim do trial |
| `current_period_start_at` | TIMESTAMPTZ | Início do período atual |
| `current_period_end_at` | TIMESTAMPTZ | Fim do período atual |
| `cancelled_at` | TIMESTAMPTZ | Data do cancelamento |
| `cancel_at_period_end` | BOOLEAN | Cancelar no fim do período |

### 4.48 Limites e Ranges

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `min_quantity` | INTEGER | Quantidade mínima |
| `max_quantity` | INTEGER | Quantidade máxima |
| `min_amount_cents` | BIGINT | Valor mínimo |
| `max_amount_cents` | BIGINT | Valor máximo |
| `min_age` | INTEGER | Idade mínima |
| `max_age` | INTEGER | Idade máxima |
| `min_distance_meters` | INTEGER | Distância mínima |
| `max_distance_meters` | INTEGER | Distância máxima |
| `capacity_min` | INTEGER | Capacidade mínima |
| `capacity_max` | INTEGER | Capacidade máxima |
✔ min_quantity, max_quantity
✔ capacity_min, capacity_max
❌ minQty, maxQty (abreviações)

### 4.49 Métricas e Contadores

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `view_count` | INTEGER | Contagem de visualizações |
| `like_count` | INTEGER | Contagem de likes |
| `share_count` | INTEGER | Contagem de compartilhamentos |
| `comment_count` | INTEGER | Contagem de comentários |
| `order_count` | INTEGER | Contagem de pedidos |
| `total_orders` | INTEGER | Total de pedidos |
| `total_revenue_cents` | BIGINT | Receita total |
| `average_rating` | INTEGER | Rating médio (0-500) |
| `average_response_time_seconds` | INTEGER | Tempo médio de resposta |
✔ view_count
✔ total_orders
❌ views (usar view_count)
❌ total (sem contexto)

### 4.50 Método de Pagamento

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `payment_method` | VARCHAR(30) | Método de pagamento |
| `payment_method_type` | VARCHAR(30) | Tipo do método |

**Valores Padronizados**

```sql
'credit_card'       -- Cartão de crédito
'debit_card'        -- Cartão de débito
'pix'               -- PIX
'boleto'            -- Boleto bancário
'balance'           -- Saldo na plataforma
'bank_transfer'     -- Transferência bancária
'cash'              -- Dinheiro
'voucher'           -- Vale/voucher
'subscription'      -- Via assinatura
'unifycard'         -- UnifyCard
'on_subscription'   -- Via assinatura ativa
```

❌ PROIBIDO: UNIFYCARD, PIX (maiúsculas)

### 4.51 Gênero

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `gender` | VARCHAR(20) | Gênero |

**Valores Padronizados**

```sql
'male'              -- Masculino
'female'            -- Feminino
'non_binary'        -- Não-binário
'other'             -- Outro
'prefer_not_to_say' -- Prefere não dizer
```

❌ Não usar sex (usar gender)
❌ Não usar 'M', 'F' (usar valores completos)

### 4.52 Conteúdo e Categorias

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `content_type` | VARCHAR(30) | Tipo de conteúdo |
| `category` | VARCHAR(50) | Categoria |
| `subcategory` | VARCHAR(50) | Subcategoria |
| `tags` | TEXT[] | Tags/etiquetas |

**Content Types**

```sql
'text'              -- Texto
'image'             -- Imagem
'video'             -- Vídeo
'audio'             -- Áudio
'document'          -- Documento
'link'              -- Link
'poll'              -- Enquete
'event'             -- Evento
'product'           -- Produto

### 4.53 Entry Types (Ledger)

Valores em `lowercase`
Tipo: `VARCHAR(30)`
Coluna: `entry_type`

```sql
'credit'            -- Crédito
'debit'             -- Débito
'escrow_hold'       -- Bloqueio em escrow
'escrow_release'    -- Liberação de escrow
'escrow_refund'     -- Reembolso de escrow
'commission_fee'    -- Taxa de comissão
'split_created'     -- Split criado
'earn'              -- Ganho/Rendimento
```

❌ PROIBIDO: CREDIT, DEBIT (maiúsculas)

### 4.54 Transaction Types

Valores em `lowercase`
Tipo: `VARCHAR(30)`
Coluna: `transaction_type`

```sql
'transfer'          -- Transferência
'deposit'           -- Depósito
'withdrawal'        -- Saque
'payment'           -- Pagamento
'refund'            -- Reembolso
'pix'               -- PIX
'voucher'           -- Voucher
```

❌ PROIBIDO: DEPOSIT, REFUND, PIX (maiúsculas)

### 4.55 Split Types

Valores em `lowercase`
Tipo: `VARCHAR(30)`
Coluna: `split_type`

```sql
'revenue_share'     -- Divisão de receita
'regional_fund'     -- Fundo regional
'fee'               -- Taxa
'reserve'           -- Reserva
'referral'          -- Indicação
'platform'          -- Plataforma
```

### 4.56 System Account Names

Valores em `lowercase`
Tipo: `VARCHAR(30)`
Coluna: `system_account_name`

```sql
'fee'               -- Conta de taxas
'regional_fund'     -- Fundo regional
'reserve'           -- Reserva
'escrow'            -- Conta escrow
'platform'          -- Conta da plataforma
'referral'          -- Conta de indicações
```

### 4.57 Scope Types

Valores em `lowercase`
Tipo: `VARCHAR(30)`
Coluna: `scope`

```sql
-- Geográfico
'global'            -- Global
'national'          -- Nacional
'state'             -- Estadual
'city'              -- Municipal
'local'             -- Local
'neighborhood'      -- Bairro
'local_neighborhood'-- Bairro local

-- Funcional
'professional'      -- Profissional
'health'            -- Saúde
'learning'          -- Aprendizado
'cause'             -- Causa social
'interest'          -- Interesse
'direct'            -- Direto

-- Acesso
'public'            -- Público
'restricted'        -- Restrito
'group'             -- Grupo
```

### 4.58 Context Types

Valores em `lowercase`
Tipo: `VARCHAR(50)`
Coluna: `context`

```sql
-- Perfil/Interesse
'professional'      -- Profissional
'hobby'             -- Hobby
'interest'          -- Interesse
'learning'          -- Aprendizado
'health'            -- Saúde
'education'         -- Educação

-- Transação
'service_booking'   -- Reserva de serviço
'event_ticket'      -- Ingresso de evento
'donation'          -- Doação
'ride_payment'      -- Pagamento de corrida
'group_contribution'-- Contribuição de grupo
'marketplace_payment'-- Pagamento marketplace
'marketplace_payout'-- Payout marketplace
'withdrawal'        -- Saque
'deposit'           -- Depósito
'billing'           -- Cobrança

-- Sistema
'feed'              -- Feed
'events'            -- Eventos
'group'             -- Grupo
'company'           -- Empresa
'auth'              -- Autenticação
```

### 4.59 Action Types

Valores em `lowercase` com underscore
Tipo: `VARCHAR(50)`
Coluna: `action` ou `action_type`

```sql
-- Interações Sociais
'like'              -- Curtir
'join'              -- Entrar
'leave'             -- Sair
'accept'            -- Aceitar
'create'            -- Criar
'create_post'       -- Criar post
'create_group_post' -- Criar post em grupo
'answer_question'   -- Responder pergunta

-- Status
'online'            -- Online
'offline'           -- Offline
'heartbeat'         -- Heartbeat

-- Busca
'search_workers'    -- Buscar trabalhadores
'search_products'   -- Buscar produtos
'search_events'     -- Buscar eventos
'search_restaurants'-- Buscar restaurantes

-- Serviços
'schedule_service'  -- Agendar serviço
'request_ride'      -- Solicitar corrida
'request_delivery'  -- Solicitar entrega
'confirm_completed' -- Confirmar conclusão

-- Grupos
'group_created'     -- Grupo criado
'group_updated'     -- Grupo atualizado
'group_deleted'     -- Grupo deletado
'get_group_feed'    -- Obter feed do grupo
'get_group_social_info' -- Obter info social do grupo

-- Sistema
'permission_denied' -- Permissão negada
'view_worker_profile' -- Visualizar perfil
'view_event_details'  -- Visualizar detalhes
```

### 4.60 Reason Types

Valores em `lowercase` com underscore
Tipo: `VARCHAR(50)`
Coluna: `reason` ou `reason_code`

```sql
-- Cancelamento
'service_not_done'  -- Serviço não realizado
'event_cancelled'   -- Evento cancelado
'dispute_resolution'-- Resolução de disputa
'force_majeure'     -- Força maior

-- Presença
'no_show'           -- Não compareceu
'left_early'        -- Saiu antes
'present'           -- Presente

-- Financeiro
'cancellation'      -- Cancelamento
'cancellation_protection' -- Proteção de cancelamento
'unpaid_debt'       -- Dívida não paga
'insufficient_balance_for_debt' -- Saldo insuficiente

-- Estoque
'stock_transfer_shipped' -- Transferência enviada
'stock_transfer_received' -- Transferência recebida
'fulfillment_shipped' -- Fulfillment enviado

-- Verificação
'upload_document'   -- Upload de documento
'new_user_welcome'  -- Boas-vindas novo usuário
```

### 4.61 Mode Types

Valores em `lowercase`
Tipo: `VARCHAR(30)`
Coluna: `mode`

```sql
'now'               -- Agora
'scheduled'         -- Agendado
'same_neighborhood' -- Mesmo bairro
'home'              -- Em casa
```

❌ **PROIBIDO:** Valores em português. Use apenas os termos canônicos em inglês: `'purchase'`, `'rental'`, `'unknown'`, etc.

### 4.62 Level Types

Valores em `lowercase` ou código (L0, L2)
Tipo: `VARCHAR(20)`
Coluna: `level`

```sql
-- Log Level
'info'              -- Informação
'warn'              -- Aviso
'error'             -- Erro
'audit'             -- Auditoria

-- Trust/Risk Level
'low'               -- Baixo
'L0'                -- Level 0
'L2'                -- Level 2

-- Education Level
'elementary'        -- Fundamental
'high_school'       -- Ensino médio
'bachelor'          -- Graduação
'master'            -- Mestrado
'doctorate'         -- Doutorado
```

### 4.63 Attendance Status

Valores em `UPPER_CASE`
Tipo: `VARCHAR(20)`
Coluna: `attendance_status`

```sql
'PRESENT'           -- Presente
'NO_SHOW'           -- Não compareceu
'LEFT_EARLY'        -- Saiu antes
'CHECKED_IN'        -- Check-in feito
'CHECKED_OUT'       -- Check-out feito
```

### 4.64 Check-in Status

Valores em `UPPER_CASE`
Tipo: `VARCHAR(20)`
Coluna: `checkin_status`

```sql
'PENDING'           -- Pendente
'CONFIRMED'         -- Confirmado
'CANCELLED'         -- Cancelado
```

### 4.65 Dispute Status

Valores em `UPPER_CASE`
Tipo: `VARCHAR(20)`
Coluna: `dispute_status`

```sql
'NONE'              -- Nenhuma disputa
'OPENED'            -- Aberta
'IN_PROGRESS'       -- Em andamento
'RESOLVED'          -- Resolvida
'ESCALATED'         -- Escalada
'CLOSED'            -- Fechada
```

### 4.66 Result Types

Valores em `UPPER_CASE`
Tipo: `VARCHAR(20)`
Coluna: `result`

```sql
'SUCCESS'           -- Sucesso
'FAILED'            -- Falhou
'PARTIAL'           -- Parcial
'SKIPPED'           -- Pulado
```

### 4.67 Order Types

Valores em `lowercase`
Tipo: `VARCHAR(30)`
Coluna: `order_type`

```sql
'service_order'     -- Ordem de serviço
'booking'           -- Reserva
'rfq'               -- Request for Quote
'product_order'     -- Pedido de produto
'subscription'      -- Assinatura
```

### 4.68 Pricing Types

Valores em `lowercase`
Tipo: `VARCHAR(20)`
Coluna: `pricing_type`

```sql
'fixed'             -- Fixo
'hourly'            -- Por hora
'daily'             -- Por dia
'per_unit'          -- Por unidade
'percentage'        -- Percentual
'tiered'            -- Por faixa
```

### 4.69 Discount Types

Valores em `lowercase`
Tipo: `VARCHAR(20)`
Coluna: `discount_type`

```sql
'percent'           -- Percentual
'fixed'             -- Valor fixo
'buy_x_get_y'       -- Compre X leve Y
'first_purchase'    -- Primeira compra
```

### 4.70 Direction Types

Valores em `lowercase`
Tipo: `VARCHAR(10)`
Coluna: `direction`

```sql
'in'                -- Entrada
'out'               -- Saída
'inbound'           -- Entrada (comunicação)
'outbound'          -- Saída (comunicação)
```

### 4.71 Service Categories

Valores em `lowercase` com underscore
Tipo: `VARCHAR(50)`
Coluna: `category` (quando contexto é serviço)

```sql
-- Eventos
'venue_rental'      -- Aluguel de espaço
'photography'       -- Fotografia
'videography'       -- Videografia
'dj_music'          -- DJ/Música
'decoration'        -- Decoração
'catering'          -- Buffet
'waitstaff'         -- Garçons
'security'          -- Segurança
'cleaning'          -- Limpeza
'hospitality'       -- Hospitalidade
'kids_entertainment'-- Entretenimento infantil

-- Geral
'transport'         -- Transporte
'food'              -- Alimentação
'schedule'          -- Agendamento
```

### 4.72 Health Categories

Valores em `lowercase`
Tipo: `VARCHAR(30)`
Coluna: `category` (quando contexto é saúde)

```sql
'vision'            -- Visão
'dental'            -- Odontológico
'mental'            -- Saúde mental
'mobility'          -- Mobilidade
'medications'       -- Medicamentos
'general'           -- Geral
```

### 4.73 System Categories

Valores em `lowercase`
Tipo: `VARCHAR(30)`
Coluna: `category` (quando contexto é sistema)

```sql
'system'            -- Sistema
'core'              -- Core
'commerce'          -- Comércio
'finance'           -- Finanças
'governance'        -- Governança
'social'            -- Social
'business'          -- Negócios
'services'          -- Serviços
'product'           -- Produto
```

### 4.74 Segurança e Autenticação

Tipo: `VARCHAR(255)` para hashes, `VARCHAR(50)` para IDs  
Regra: valores sempre hash no banco, nunca texto puro  
Proibido armazenar tokens, secrets ou keys em texto puro

---

#### Campos Canônicos

| Banco (snake_case) | Backend/API (camelCase) | Descrição |
|-------------------|------------------------|-----------|
| `access_token_hash` | `accessTokenHash` | Hash do token de acesso |
| `refresh_token_hash` | `refreshTokenHash` | Hash do token de refresh |
| `id_token_hash` | `idTokenHash` | Hash do ID token |
| `session_id` | `sessionId` | Identificador de sessão |
| `csrf_token_hash` | `csrfTokenHash` | Hash do token CSRF |
| `api_key_hash` | `apiKeyHash` | Hash da chave de API |
| `client_id` | `clientId` | Identificador do cliente |
| `client_secret_hash` | `clientSecretHash` | Hash do secret do cliente |
| `scope` | `scope` | Escopo OAuth/permissão técnica |
| `permission` | `permission` | Permissão técnica específica |

**Regra de Distinção Semântica:**

- `scope` (Segurança): Escopo OAuth/permissão técnica (ex: `'read:users'`, `'write:orders'`)
- `scope` (Domínio): Escopo geográfico/operacional (ex: `'global'`, `'national'`, `'professional'`)
- `permission` (Segurança): Permissão técnica específica de API (ex: `'api.read'`, `'api.write'`)
- `permission` não deve ser usado isolado em domínio (usar `has_permission`, `role_permission`)
| `rate_limit_bucket` | `rateLimitBucket` | Bucket de rate limiting |
| `rate_limit_remaining` | `rateLimitRemaining` | Requisições restantes |
| `rate_limit_reset_at` | `rateLimitResetAt` | Timestamp de reset do rate limit |
| `ip_address` | `ipAddress` | Endereço IP |

**Regras de Nomenclatura:**

- Tokens sempre sufixo `_token_hash` (nunca `_token` puro, nunca `_key`, `_secret`, `_credential`)
- IDs sempre `_id` (nunca `_identifier`, `_uuid`)
- Hash sempre `_hash` (nunca `_digest`, `_checksum`)
- Expiração sempre `_expires_at` (nunca `_expiry`, `_expiration`)
- Rate limit sempre `rate_limit_*` (nunca `throttle_*`, `quota_*`)
- Bucket sempre `*_bucket` (nunca `*_window`, `*_counter`)

**Proibições:**

❌ `token` isolado (usar `access_token_hash`, `refresh_token_hash`)  
❌ `key` isolado (usar `api_key_hash`, `client_key_hash`)  
❌ `secret` isolado (usar `client_secret_hash`, `app_secret_hash`)  
❌ Armazenar token puro no banco (sempre `*_hash`)

**Nota:** Esta seção define apenas nomenclatura constitucional. Não inclui detalhes de OAuth, JWT, implementação de criptografia ou políticas de segurança.

---

### 4.75 Compliance e Retenção

Tipo: `VARCHAR(50)` para classificações, `INTEGER` para períodos, `TIMESTAMPTZ` para datas  
Regra: valores padronizados conforme domínio  
Proibido usar flags booleanas simplistas para compliance

---

#### Campos Canônicos

| Banco (snake_case) | Backend/API (camelCase) | Descrição |
|-------------------|------------------------|-----------|
| `retention_policy` | `retentionPolicy` | Política de retenção |
| `retention_period_days` | `retentionPeriodDays` | Período de retenção em dias |
| `retention_expires_at` | `retentionExpiresAt` | Data de expiração da retenção |
| `data_classification` | `dataClassification` | Classificação dos dados |
| `legal_basis` | `legalBasis` | Base legal para processamento |
| `consent_given` | `consentGiven` | Consentimento foi dado |

**Regra de Distinção Semântica:**

- `authority_source` (Autoridade): Fonte de autoridade operacional no sistema ('ownership', 'delegation', 'account_acl', 'system')
- `legal_basis` (Compliance): Base legal para processamento de dados conforme regulamentação (LGPD, GDPR)
- `authority_source` define QUEM pode fazer (autoridade operacional)
- `legal_basis` define POR QUE podemos processar (base jurídica)
| `consent_given_at` | `consentGivenAt` | Timestamp do consentimento |
| `consent_withdrawn_at` | `consentWithdrawnAt` | Timestamp de retirada do consentimento |
| `data_retained_until` | `dataRetainedUntil` | Data limite de retenção |
| `audit_retention_days` | `auditRetentionDays` | Período de retenção de auditoria |
| `legal_hold` | `legalHold` | Retenção legal ativa |
| `legal_hold_expires_at` | `legalHoldExpiresAt` | Data de expiração do legal hold |
| `deletion_requested_at` | `deletionRequestedAt` | Timestamp da solicitação de exclusão |
| `deletion_completed_at` | `deletionCompletedAt` | Timestamp da conclusão da exclusão |

**Regras de Nomenclatura:**

- Retenção sempre `retention_*` (nunca `retain_*`, `keep_*`)
- Compliance sempre `legal_*` ou `consent_*` (nunca `comply_*`, `regulatory_*`, `gdpr_*`)
- Classificação sempre `*_classification` (nunca `*_category`, `*_type`)
- Exclusão sempre `deletion_*` (nunca `delete_*`, `remove_*`)
- Legal hold sempre `legal_hold` (nunca `litigation_hold`, `preservation`)
- Consentimento sempre `consent_*` (nunca `permission_*`, `authorization_*`)

**Proibições:**

❌ `retention` isolado (usar `retention_policy`, `retention_period`)  
❌ `compliance` isolado (usar `legal_basis`, `data_classification`)  
❌ Flags booleanas simplistas como `gdpr_applicable` (usar `legal_basis` com valores específicos)  
❌ Detalhes técnicos de criptografia (não é nomenclatura)

**Nota:** Esta seção define apenas nomenclatura constitucional. Não inclui detalhes de LGPD, GDPR, políticas de retenção, implementação de criptografia ou checklist técnico de segurança.

---

### 4.76 Fingerprint Operacional de Canonical Products

**Status:** CANÔNICO · VIGENTE · OBRIGATÓRIO

O `fingerprint_v1` é uma chave **operacional** de deduplicação por tenant para `canonical_products`.

Ele **NÃO** define semântica.  
Ele **NÃO** substitui CONCEPT.  
Ele **NÃO** substitui matching semântico.  
Ele existe exclusivamente para:

- impedir duplicação por concorrência;
- garantir idempotência de reprocessamento;
- estabilizar a identidade operacional do registro.

#### Regra de Autoridade

Se houver conflito entre fingerprint operacional, matching semântico ou conceito de produto, vence sempre a camada semântica superior.

`fingerprint_v1` serve para dedupe técnico.  
Não serve para definir “o que o produto é”.

#### Fórmula Canônica

O `fingerprint_v1` **DEVE** ser calculado exclusivamente pela função de banco `canonical_product_fingerprint_v1(p_gtin TEXT, p_name TEXT, p_brand TEXT, p_attributes JSONB)`.

A serialização de `attributes` dentro dessa fórmula **DEVE** usar unicamente `canonical_json_attrs(JSONB)` (PostgreSQL), definida como agregação determinística `string_agg(key || '=' || to_jsonb(value)::text, '|' ORDER BY key)` sobre `jsonb_each`.

É **PROIBIDO**:

- implementar lógica divergente fora do banco como fonte da verdade;
- usar `JSON.stringify` (ou equivalente no backend) como serialização canônica do fingerprint;
- depender da ordem de chaves enviada pelo cliente para o cálculo do fingerprint;
- criar serializador alternativo de atributos para fingerprint fora do banco.

#### Persistência da coluna `gtin`

Na mesma operação de escrita (`INSERT` / `UPDATE` que toca `gtin`), o valor persistido em `canonical_products.gtin` **DEVE** ser normalizado assim:

- aplicar `btrim`;
- converter string vazia em `NULL` (`NULLIF(btrim(gtin), '')`).

Nesta fase **não** se aplica inferência semântica nem correção heurística sobre GTIN (ex.: dígitos apenas): apenas o acima.

O digest do fingerprint, no ramo GTIN, usa o **mesmo** valor já normalizado (após `btrim` e tratar vazio como ausência).

#### Regra de GTIN (entrada do digest)

Quando, após a normalização da coluna, `gtin` **não** for `NULL` nem vazio:

- o GTIN **domina** a entrada do fingerprint (o digest é `md5` do texto GTIN normalizado);
- o digest permanece **homogéneo** (sempre hash hexadecimal de 32 caracteres no padrão PostgreSQL `md5(text)`).

Quando `gtin` for ausente após normalização, aplica-se o ramo **sem GTIN** abaixo.

#### Regra sem GTIN

Na ausência de GTIN utilizável, a entrada textual **antes** de `md5` **DEVE** ser exatamente a concatenação, com delimitador canónico `|`, destes três segmentos **nesta ordem**:

1. `lower(btrim(coalesce(name, '')))`
2. `lower(btrim(coalesce(brand, '')))`
3. `canonical_json_attrs(coalesce(attributes, '{}'::jsonb))`

Ou seja:

`lower(btrim(coalesce(name, ''))) || '|' || lower(btrim(coalesce(brand, ''))) || '|' || canonical_json_attrs(coalesce(attributes, '{}'::jsonb))`

**Ordem dos atributos:** lexicográfica por **nome de chave** JSON (conforme `ORDER BY key` em `canonical_json_attrs`). Não se usa ordem semântica ad hoc (marca/volume/etc.) nesta versão.

#### Escopo do Fingerprint

`fingerprint_v1` **é válido** para: deduplicação operacional por tenant; concorrência; retries; reprocessamento idempotente.

`fingerprint_v1` **NÃO é válido** para: equivalência semântica entre produtos; agrupamento ontológico; reconciliação de nomes equivalentes “humanos”; inferência de CONCEPT.

#### Trigger e Recálculo

O fingerprint **DEVE** ser recalculado automaticamente em `BEFORE INSERT` e em `BEFORE UPDATE OF gtin, name, brand, attributes` sobre `canonical_products`, atribuindo `NEW.fingerprint_v1` via `canonical_product_fingerprint_v1` (e, na mesma função trigger, aplicando a normalização de `NEW.gtin` definida acima antes do digest).

Mudanças em `category_id`, `images` ou outros campos **fora** da fórmula **NÃO** disparam recálculo pelo trigger (lista explícita: `gtin`, `name`, `brand`, `attributes`).

O `INSERT` pela aplicação **DEVE omitir** a coluna `fingerprint_v1` nos valores enviados; o preenchimento é responsabilidade do trigger (único caminho de escrita da coluna na criação).

#### Índice Único

Deve existir índice único parcial:

`UNIQUE (tenant_id, fingerprint_v1) WHERE fingerprint_v1 IS NOT NULL`

Objetivo: impedir duplicação por concorrência; garantir idempotência por tenant; permitir legado temporário sem fingerprint preenchido (fora do âmbito desta versão quando a cadeia de migrations estiver completa).

#### Proibições

É proibido:

- usar `category_id` na fórmula do fingerprint;
- usar `slug` como identidade do fingerprint;
- usar fingerprint como semântica de produto;
- implementar função paralela no backend como fonte da verdade do `fingerprint_v1`;
- persistir `fingerprint_v1` por regras mistas (ex.: parte digest GTIN, parte regra distinta para o mesmo registo).

#### Exemplos Canônicos

**Com GTIN**

- Entrada de coluna (antes do trigger): `gtin = ' 7891234567890 '`
- Valor persistido após trigger: `7891234567890`
- `fingerprint_v1 = md5('7891234567890')` (hex minúsculo, 32 caracteres, conforme PostgreSQL)

**Sem GTIN**

- `name = 'Coca Cola 350ml Lata'`
- `brand = 'Coca Cola'`
- `attributes = {"package":"lata","volume_ml":350}`

Segmentos:

- Nome/marca: `coca cola 350ml lata|coca cola`
- Atributos (`canonical_json_attrs`): `package="lata"|volume_ml=350`  
  (valor string em forma textual JSON `"lata"` conforme `to_jsonb(value)::text` em PostgreSQL)

String pré-hash:

`coca cola 350ml lata|coca cola|package="lata"|volume_ml=350`

`fingerprint_v1 = md5(<string pré-hash>)`

Dois documentos JSON com as mesmas chaves e valores mas ordem de inserção diferente no objeto **produzem o mesmo** `canonical_json_attrs` e portanto o mesmo fingerprint.

#### Regra Final

Qualquer alteração na fórmula do `fingerprint_v1` exige:

1. atualização **prévia** desta seção do documento 07;
2. migration explícita no repositório;
3. revisão de compatibilidade com dados legados;
4. atualização dos testes determinísticos (golden) associados.

---

# PARTE II — BACKEND E API

## 5. BACKEND

### 5.1 Classes, Entidades e Tipos

PascalCase

✔ `User`
✔ `BankTransaction`
✔ `LedgerEntry`
✔ `PaymentIntent`
✔ `DeliveryOrder`
✔ `InventoryItem`

### 5.2 Propriedades internas (Domínio)

camelCase
✔ userId
✔ globalUserId
✔ amountCents
✔ pickupLatitude
✔ distanceMeters
✔ trustScore
❌ `user_id`
❌ `GlobalUserID`

### 5.3 Conversão Banco → Backend

Toda conversão deve ser explícita:

| Banco | Backend |
|-------|---------|
| `trust_score` | `trustScore` |
| `reputation_score` | `reputationScore` |
| `entity_type` | `entityType` |
| `event_type` | `eventType` |
| `actor_type` | `actorType` |
| `payment_method` | `paymentMethod` |
| `entry_type` | `entryType` |
| `split_type` | `splitType` |
### 5.4 Enums e Literais

Valores de enum em API: `snake_case` (padrão de mercado)
Identificadores de enum em código: `PascalCase`

```typescript
// Código
enum DeliveryStatus {
  Pending = 'pending',
  PickedUp = 'picked_up',
  InTransit = 'in_transit',
  Delivered = 'delivered'
}

enum Priority {
  Critical = 'CRITICAL',
  High = 'HIGH',
  Medium = 'MEDIUM',
  Low = 'LOW'
}

// API retorna
{ "status": "in_transit" }
{ "priority": "HIGH" }
```

### 5.5 Nomenclatura de Arquivos (Backend)

Arquivos do backend devem utilizar kebab-case e seguir o padrão:

<dominio>-<subdominio>.<tipo>.ts
Exemplos
marketplace-orders.service.ts
marketplace-orders.routes.ts
marketplace-orders.repository.ts
marketplace-orders.types.ts
marketplace-orders.job.ts
payment-transaction.repository.ts
store-product.service.ts
Regras obrigatórias
1️⃣ Arquivos devem usar kebab-case

✔ correto

marketplace-orders.service.ts
payment-transaction.repository.ts
store-product.service.ts

❌ proibido

MarketplaceOrders.service.ts
marketplaceOrders.service.ts
marketplace_orders.service.ts
2️⃣ O ponto (.) separa apenas o tipo do arquivo

Formato:

<dominio>-<subdominio>.<tipo>.ts

Exemplos:

marketplace-orders.service.ts
marketplace-orders.routes.ts
marketplace-orders.repository.ts
marketplace-orders.types.ts

❌ proibido

marketplace.service.orders.ts
orders.marketplace.service.ts
marketplace.orders.service.ts
3️⃣ Tipos de arquivo permitidos
tipo	uso
.service.ts	lógica de domínio
.repository.ts	acesso a banco
.routes.ts	endpoints HTTP
.types.ts	tipos e interfaces
.job.ts	jobs/schedulers
.adapter.ts	adaptação de interfaces externas
.mapper.ts	transformação de dados
4️⃣ Ordem obrigatória dos elementos

Sempre:

<dominio>-<subdominio>.<tipo>.ts

Exemplo correto:

marketplace-orders.service.ts

Exemplo incorreto:

orders-marketplace.service.ts
5️⃣ Classes continuam seguindo PascalCase
export class MarketplaceOrdersService {}
export class PaymentTransactionRepository {}

## 6. API (CONTRATO PÚBLICO)

### 6.1 Regra Geral

`camelCase` obrigatório
Nunca refletir `snake_case` do banco

### 6.2 Campos com Sufixos Obrigatórios

| Tipo | Sufixo | Exemplo |
|------|--------|---------|
| Identificador | Id | `userId`, `orderId` |
| Timestamp | At | `createdAt`, `paidAt` |
| Monetário | Cents | `amountCents`, `feeCents` |
| Percentual | Bps | `feeRateBps`, `taxRateBps` |
| Distância | Meters | `distanceMeters` |
| Duração (seg) | Seconds | `durationSeconds` |
| Duração (min) | Minutes | `durationMinutes` |
| Peso | Grams | `weightGrams` |
| URL | Url | `avatarUrl`, `coverUrl` |
| Score | Score | `trustScore`, `riskScore` |
| Rating | Rating | `averageRating` |
| Contagem | Count | `viewCount`, `likeCount` |

### 6.3 Campos com Prefixos Obrigatórios

| Tipo | Prefixo | Exemplo |
|------|---------|---------|
| Booleano estado | is | `isActive`, `isVerified` |
| Booleano capacidade | can | `canWithdraw`, `canEdit` |
| Booleano propriedade | has | `hasPermission`, `hasSplit` |
| Booleano requisito | requires | `requiresSignature` |
| Mínimo | min | `minQuantity`, `minAmount` |
| Máximo | max | `maxQuantity`, `maxAmount` |

### 6.4 Valores de Enum na API

Status, types, roles: mantêm `snake_case` nos valores
Priority, severity: mantêm `UPPER_CASE` nos valores

```json
{
  "status": "in_transit",
  "deliveryStatus": "out_for_delivery",
  "priority": "HIGH",
  "visibility": "public",
  "role": "admin",
  "entityType": "user",
  "eventType": "payment.captured"
}
```

**Regra de Case para Valores de Enum**

| Tipo de Campo | Case | Exemplo |
|---------------|------|---------|
| status | lowercase snake_case | `'in_transit'` |
| type | lowercase snake_case | `'service_order'` |
| role | lowercase | `'admin'` |
| visibility | lowercase | `'public'` |
| scope | lowercase | `'professional'` |
| context | lowercase snake_case | `'service_booking'` |
| action | lowercase snake_case | `'create_post'` |
| origin | lowercase snake_case | `'store_pdv'` |
| mode | lowercase snake_case | `'same_neighborhood'` |
| category | lowercase snake_case | `'venue_rental'` |
| priority | UPPER_CASE | `'HIGH'` |
| severity | UPPER_CASE | `'CRITICAL'` |
| level (log) | lowercase | `'info'` |
| entry_type | lowercase | `'credit'` |
| split_type | lowercase snake_case | `'revenue_share'` |
| result | UPPER_CASE | `'SUCCESS'` |
| attendance_status | UPPER_CASE | `'PRESENT'` |
| checkin_status | UPPER_CASE | `'CONFIRMED'` |
| dispute_status | UPPER_CASE | `'OPENED'` |

---

## 7. FRONTEND

Espelha exatamente o contrato da API
Não cria aliases
Não renomeia campos
Não adapta semântica

---

## 8. EVENTOS E MENSAGERIA (LEGADO - NÃO VERSIONADO)

### 8.1 Nome de evento (Formato Antigo - DEPRECATED)

⚠️ **AVISO:** Este formato será descontinuado na v3.0.
Usar formato versionado `v1.domain.entity.action` (Seção 10).

Formato: `domain.entity.action`
Tudo em `lowercase` com pontos

✔ `payment.captured`
✔ `order.completed`
✔ `delivery.picked_up`
✔ `user.verified`
✔ `group.member.joined`
❌ `PaymentCaptured`
❌ `PAYMENT_CAPTURED`

### 8.2 Payload

Segue contrato da API (`camelCase`)
Inclui `eventType`, `correlationId`, `timestamp`

```json
{
  "eventType": "delivery.picked_up",
  "timestamp": "2026-02-05T14:30:00Z",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "payload": {
    "deliveryId": "...",
    "driverId": "...",
    "pickedUpAt": "2026-02-05T14:30:00Z"
  }
}
```

---

# PARTE III — INFRAESTRUTURA E OPERAÇÕES

## 9. API REST

### 9.1 Estrutura de Endpoints

`{version}/{recurso}/{id}/{sub-recurso}/{acao}`

**Regras:**
- Kebab-case (hífens, não underscores)
- Máximo 3 níveis de nesting
- Recursos em plural
- Ações via métodos HTTP ou sub-recursos
- Versionamento obrigatório no path

✔ `GET    /v1/users/{userId}/bank-accounts`  
✔ `POST   /v1/payments/{paymentId}/refunds`  
✔ `PATCH  /v1/orders/{orderId}/status`  
✔ `GET    /v1/deliveries?status=pending&sort=-createdAt`  
✔ `POST   /v1/batch-processes` (ações em lote)
❌ `GET    /getUsers`  
❌ `POST   /v1/createPayment`  
❌ `/v1/users/123/orders/456/items/789/comments` (muito aninhado)  
❌ `/v1/bank_accounts` (underscore)  
❌ `/api/v1/users` (prefixo /api redundante)

### 9.2 Métodos HTTP

| Método | Uso | Exemplo |
|--------|-----|---------|
| `GET` | Recuperar recurso(s) | `GET /v1/users/{id}` |
| `POST` | Criar recurso | `POST /v1/orders` |
| `PUT` | Atualizar completo | `PUT /v1/users/{id}` |
| `PATCH` | Atualizar parcial | `PATCH /v1/orders/{id}/status` |
| `DELETE` | Remover recurso | `DELETE /v1/items/{id}` |

### 9.3 Query Parameters

| Operação | Padrão | Exemplo |
|----------|--------|---------|
| Filtro | `?{campo}={valor}` | `?status=active` |
| Múltiplos valores | `?{campo}={v1},{v2}` | `?status=pending,processing` |
| Sort ascendente | `?sort={campo}` | `?sort=createdAt` |
| Sort descendente | `?sort=-{campo}` | `?sort=-createdAt` |
| Paginação cursor | `?cursor={token}&limit={n}` | `?cursor=abc123&limit=20` |
| Paginação offset | `?page={n}&limit={n}` | `?page=1&limit=20` (legado) |
| Busca | `?q={termo}` | `?q=joao silva` |
| Expansão | `?expand={relacao}` | `?expand=profile,address` |
| Campos | `?fields={campos}` | `?fields=id,name,email` |
| Inclusão soft-deleted | `?include_deleted=true` | `?include_deleted=true` |

### 9.4 Códigos de Status HTTP

| Código | Uso | Exemplo |
|--------|-----|---------|
| `200` | Sucesso | `GET /v1/users/123` → usuário |
| `201` | Criado | `POST /v1/orders` → pedido criado |
| `204` | Sem conteúdo | `DELETE /v1/items/123` |
| `400` | Requisição inválida | Payload malformado |
| `401` | Não autenticado | Token ausente/inválido |
| `403` | Proibido | Sem permissão |
| `404` | Não encontrado | Recurso não existe |
| `409` | Conflito | Idempotency key repetida |
| `422` | Entidade inválida | Validação de negócio falhou |
| `429` | Rate limit | Muitas requisições |
| `500` | Erro interno | Exceção não tratada |
| `503` | Serviço indisponível | Manutenção |

### 9.5 Estrutura de Resposta

#### Sucesso (200, 201)

```json
{
  "data": {
    "id": "usr_123",
    "name": "João Silva",
    "email": "joao@email.com",
    "createdAt": "2026-01-15T10:30:00Z"
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-02-17T14:30:00Z"
  }
}
```

**Lista (200)**

```json
{
  "data": [
    { "id": "usr_123", "name": "João" },
    { "id": "usr_124", "name": "Maria" }
  ],
  "pagination": {
    "cursor": "next_abc123",
    "hasMore": true,
    "limit": 20
  },
  "meta": {
    "requestId": "req_def456",
    "totalCount": 150
  }
}
```

**Erro (4xx, 5xx)**

```json
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Saldo insuficiente para completar a transação",
    "details": {
      "availableCents": 5000,
      "requiredCents": 10000
    },
    "help": "https://docs.unificard.com/errors/INSUFFICIENT_FUNDS"
  },
  "meta": {
    "requestId": "req_ghi789",
    "timestamp": "2026-02-17T14:30:00Z"
  }
}
```

### 9.6 Códigos de Erro Internos

Formato: `{DOMINIO}_{SUBDOMINIO}_{ERRO}`

```plain
PAYMENT_INSUFFICIENT_FUNDS
PAYMENT_CARD_DECLINED
PAYMENT_EXPIRED_CARD
AUTH_INVALID_TOKEN
AUTH_EXPIRED_TOKEN
USER_NOT_FOUND
USER_ALREADY_EXISTS
ORDER_INVALID_STATUS_TRANSITION
VALIDATION_REQUIRED_FIELD
RATE_LIMIT_EXCEEDED
```

### 9.7 Versionamento de Contratos Públicos

**REGRA:** Contratos públicos (DTOs, interfaces de API) seguem versionamento semântico.

**Política de Breaking Change:**

| Tipo de Mudança | Versão | Exemplo |
|-----------------|--------|---------|
| Remover campo | Major (v2.0.0) | `v1` → `v2` |
| Renomear campo | Major (v2.0.0) | `userId` → `actorId` |
| Mudar tipo | Major (v2.0.0) | `string` → `number` |
| Adicionar campo obrigatório | Major (v2.0.0) | Novo campo `NOT NULL` |
| Adicionar campo opcional | Minor (v1.1.0) | Novo campo `NULLABLE` |

**Nomenclatura de Versões:**

```typescript
// Formato: {Entity}ContractV{version}
export interface PaymentContractV1 {
  paymentId: string;
  amountCents: number;
}

export interface PaymentContractV2 {
  paymentId: string;
  amountCents: number;
  purpose: string; // NOVO - breaking change
}
```

**Referência Completa:**
Para política detalhada de versionamento, deprecation e compatibilidade, consultar documento de Governança de Contratos.

---

## 10. EVENTOS VERSIONADOS

### 10.1 Formato de Nome

```plain
{version}.{domain}.{entity}.{action}
```

**Regras:**
- Sempre versionar no início (v1, v2)
- Past tense obrigatório (created, updated, deleted)
- Lowercase com pontos
- Semântica clara e imutável

✔ `v1.payment.captured`
✔ `v1.order.completed`
✔ `v1.delivery.picked_up`
✔ `v2.user.verified` (nova versão = breaking change)
✔ `v1.group.member.joined`
❌ `payment.captured` (sem versão)
❌ `v1.payment.create` (não é past tense)
❌ `v1.Payment.Captured` (maiúsculas)
❌ `v1-payment-captured` (hífens)

### 10.2 Versionamento Semântico de Eventos

| Versão | Significado | Exemplo |
|--------|-------------|---------|
| v1 | Versão inicial | `v1.payment.captured` |
| v2 | Breaking change no schema | Novo campo obrigatório |
| v1.1 | Adição opcional (não usado) | Não usar - apenas major |

**Regra:** Eventos são imutáveis. Uma vez publicado `v1.payment.captured`, nunca muda. Correções → novo evento ou nova versão.

### 10.3 Qualifiers (Sufixos de Resultado)

Para eventos que podem ter múltiplos resultados:

```plain
{version}.{domain}.{entity}.{action}.{result}
```

**Exemplos:**

- `v1.payment.processed.succeeded`
- `v1.payment.processed.failed`
- `v1.payment.processed.retried`
- `v1.email.sent.delivered`
- `v1.email.sent.bounced`
- `v1.email.sent.spam`

### 10.4 Payload de Evento Versionado

```json
{
  "specversion": "1.0",
  "type": "v1.payment.captured",
  "source": "payment-gateway",
  "id": "evt_550e8400-e29b-41d4-a716-446655440000",
  "time": "2026-02-17T14:30:00Z",
  "datacontenttype": "application/json",
  "data": {
    "paymentId": "pay_123",
    "orderId": "ord_456",
    "amountCents": 10000,
    "currency": "BRL",
    "capturedAt": "2026-02-17T14:30:00Z",
    "gatewayId": "gtw_789"
  },
  "unificard": {
    "correlationId": "corr_abc123",
    "traceId": "trace_def456",
    "actorId": "usr_human_789",
    "tenantId": "ten_xyz"
  }
}
```

### 10.5 Eventos de Sistema

```plain
v1.system.alert.triggered
v1.system.alert.resolved
v1.system.job.completed
v1.system.job.failed
v1.system.maintenance.scheduled
v1.system.dependency.unhealthy
```

---

## 11. MENSAGERIA E FILAS

### 11.1 Nomenclatura de Filas

```plain
Formato: {version}.{domain}.{action}.{suffix}
```

**Sufixos:**
- (sem sufixo) = fila principal
- `.retry` = fila de retry (delay exponencial)
- `.dlq` = dead letter queue (após esgotar retries)
- `.priority` = fila prioritária (processamento urgente)
- `.scheduled` = agendamento futuro
- `.batch` = processamento em lote

✔ `v1.payment.processed`
✔ `v1.payment.processed.retry`
✔ `v1.payment.processed.dlq`
✔ `v1.email.sent.priority`
✔ `v1.report.generated.scheduled`
✔ `v1.statement.generate.batch`
❌ `paymentQueue`
❌ `Payment_Processed`
❌ `queue_payment_v1`
❌ `PAYMENT.PROCESSED`

### 11.2 Exchange e Routing Keys (RabbitMQ)

```plain
Exchange: {domain}.{tipo}
```

**Tipos:**
- `direct` = routing key exata
- `topic` = padrões com wildcard
- `fanout` = broadcast

| Exchange | Tipo | Uso |
|----------|------|-----|
| `payment.direct` | direct | Pagamentos específicos |
| `payment.topic` | topic | `v1.payment.*` |
| `notification.fanout` | fanout | Broadcast para todos os canais |
| `system.topic` | topic | Eventos de sistema |

### 11.3 Dead Letter Queue (DLQ)

Estrutura obrigatória para toda fila com retry:

```plain
Fila Principal → Retry (3x) → DLQ
     ↓              ↓            ↓
  processa      delay        manual
               exponencial   review
```

**Configuração padrão:**
- Retry 1: 5 segundos
- Retry 2: 25 segundos
- Retry 3: 125 segundos
- DLQ: após 3 falhas

### 11.4 Kafka Topics

```plain
{domain}.{context}.{event-type}
```

**Exemplos:**
- `payment.transactions.captured`
- `payment.transactions.failed`
- `user.profiles.updated`
- `order.fulfillment.shipped`

Particionamento: `{domain}-{entity_id}` (ex: `payment-pay_123`)

---

## 12. MICROSERVIÇOS

### 12.1 Nome de Serviços

```plain
Formato: {dominio}-{capacidade}
```

**Regras:**
- Kebab-case obrigatório
- Sem "Service" no nome
- Sem versionamento no nome
- Máximo 3 palavras
- Substantivos, não verbos

✔ `payment-gateway`
✔ `payment-processing`
✔ `user-auth`
✔ `user-profile`
✔ `order-fulfillment`
✔ `inventory-tracking`
✔ `notification-sender`
❌ `PaymentGatewayService`
❌ `payment-service-v2`
❌ `userService`
❌ `process-payment` (verbo)
❌ `payment-gateway-v1-redis` (muito longo)

### 12.2 Namespaces por Domínio

| Namespace | Serviços |
|-----------|----------|
| `auth-*` | `auth-gateway`, `auth-session`, `auth-mfa` |
| `user-*` | `user-profile`, `user-preferences`, `user-search` |
| `payment-*` | `payment-gateway`, `payment-processing`, `payment-reconciliation`, `payment-fraud` |
| `order-*` | `order-management`, `order-fulfillment`, `order-returns` |
| `inventory-*` | `inventory-tracking`, `inventory-reservation`, `inventory-replenishment` |
| `logistics-*` | `logistics-routing`, `logistics-tracking`, `logistics-dispatch` |
| `notification-*` | `notification-email`, `notification-push`, `notification-sms`, `notification-whatsapp` |
| `billing-*` | `billing-subscription`, `billing-invoicing`, `billing-tax` |
| `analytics-*` | `analytics-events`, `analytics-reporting`, `analytics-ml` |

### 12.3 Repositórios Git

```plain
Formato: {namespace}-{servico}
```

**Exemplos:**
- `unificard/payment-gateway`
- `unificard/user-profile`
- `unificard/order-fulfillment`

### 12.4 Containers Docker

```plain
Formato: {servico}-{ambiente}
```

**Exemplos:**
- `payment-gateway-production`
- `payment-gateway-staging`
- `user-auth-development`

### 12.5 Imagens Docker

```plain
Formato: {registry}/{namespace}/{servico}:{tag}
```

**Exemplos:**
- `registry.unificard.com/payment/payment-gateway:v1.2.3`
- `registry.unificard.com/payment/payment-gateway:latest`
- `registry.unificard.com/payment/payment-gateway:sha-a1b2c3d`

**Tags permitidas:**
- `v{major}.{minor}.{patch}` — release estável
- `latest` — última versão (cuidado em prod)
- `sha-{commit}` — build específico
- `rc-{versao}` — release candidate
- `beta-{versao}` — versão beta

❌ `payment-gateway:stable` (vago)
❌ `payment-gateway:2026-02-17` (data não é semântica)

---

## 13. INFRAESTRUTURA

### 13.1 Variáveis de Ambiente

```plain
Formato: {DOMINIO}_{SUBDOMINIO}_{VARIAVEL}_{SUFIXO}
```

**Regras:**
- SCREAMING_SNAKE_CASE
- Sem pontos ou hífens
- Sem prefixo de ambiente no nome (o valor varia)
- Agrupar por domínio

**Banco de Dados**

```plain
DATABASE_HOST
DATABASE_PORT
DATABASE_NAME
DATABASE_USER
DATABASE_PASSWORD
DATABASE_POOL_MAX_CONNECTIONS
DATABASE_POOL_MIN_CONNECTIONS
DATABASE_SSL_MODE
DATABASE_QUERY_TIMEOUT_MS
```

**Redis**

```plain
REDIS_CACHE_HOST
REDIS_CACHE_PORT
REDIS_CACHE_PASSWORD
REDIS_CACHE_DB

REDIS_SESSION_HOST
REDIS_SESSION_PORT
REDIS_SESSION_TTL_SECONDS

REDIS_QUEUE_HOST
REDIS_QUEUE_PORT
REDIS_QUEUE_DB
```

**Serviços Externos**

```plain
STRIPE_API_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PUBLIC_KEY

SENDGRID_API_KEY
SENDGRID_WEBHOOK_SECRET

AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
AWS_S3_BUCKET_NAME

GOOGLE_MAPS_API_KEY
```

**Feature Flags**

```plain
FEATURE_PAYMENT_PIX_ENABLED
FEATURE_PAYMENT_BOLETO_ENABLED
FEATURE_NEW_CHECKOUT_FLOW
FEATURE_BETA_ACCESS
FEATURE_DARK_MODE_DEFAULT
```

**Configuração de Ambiente**

```plain
ENVIRONMENT=production|staging|development|test
LOG_LEVEL=debug|info|warn|error|fatal
TIMEZONE=America/Sao_Paulo
SERVICE_NAME=payment-gateway
SERVICE_VERSION=1.2.3
```

**Segurança**

```plain
JWT_SECRET
JWT_ISSUER
JWT_AUDIENCE
ENCRYPTION_KEY
HASH_SALT_ROUNDS
```

❌ `dbHost`
❌ `redis-host`
❌ `STRIPE.KEY`
❌ `PROD_DATABASE_URL`
❌ `feature-flag-1`

### 13.2 Configuração de Arquivos

```plain
Formato: {servico}.{ambiente}.{extensao}
```

Exemplos:
payment-gateway.production.yaml
payment-gateway.staging.yaml
user-auth.development.yaml
```

### 13.3 Secrets e Credenciais

**Caminho:** `/secrets/{dominio}/{servico}/{chave}`

**Exemplos:**
- `/secrets/payment/gateway/stripe_api_key`
- `/secrets/auth/session/jwt_secret`
- `/secrets/database/main/password`

### 13.4 Networks Docker

```plain
unificard-internal    -- Comunicação entre serviços
unificard-public      -- Exposição externa (gateway)
unificard-monitoring  -- Métricas e logs
unificard-database    -- Acesso a bancos de dados
```

### 13.5 Volumes

```plain
Formato: {servico}-{tipo}-{ambiente}
```

**Exemplos:**
- `payment-gateway-logs-production`
- `user-profile-uploads-staging`
- `analytics-reports-development`
```

---

## 14. OBSERVABILIDADE

### 14.1 Logs Estruturados (JSON)

Todo log deve ser JSON válido com campos obrigatórios:

```json
{
  "timestamp": "2026-02-17T14:30:00.000Z",
  "level": "info",
  "service": "payment-gateway",
  "version": "1.2.3",
  "environment": "production",
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "spanId": "a716-446655440000",
  "parentSpanId": "446655440000",
  "correlationId": "corr_abc123",
  "requestId": "req_def456",
  "actorId": "usr_human_789",
  "tenantId": "ten_xyz",
  "message": "Payment captured successfully",
  "context": {
    "paymentId": "pay_123",
    "orderId": "ord_456",
    "amountCents": 10000,
    "currency": "BRL",
    "gatewayId": "gtw_789"
  },
  "metadata": {
    "durationMs": 145,
    "sourceIp": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "httpMethod": "POST",
    "httpPath": "/v1/payments",
    "statusCode": 201
  },
  "error": null
}
```

### 14.2 Níveis de Log

| Nível | Uso | Exemplo |
|-------|-----|---------|
| debug | Desenvolvimento local apenas | Detalhes de parsing |
| info | Operações normais | Transação processada |
| warn | Alertas, recuperáveis | Retry de conexão |
| error | Falhas, não recuperáveis automaticamente | Banco indisponível |
| fatal | Crash, requer intervenção imediata | Out of memory |
| audit | Eventos de segurança/compliance | Acesso a dados sensíveis |

**Regras:**
- Produção: `info` e acima
- Nunca logar: senhas, tokens, dados de cartão, CPF completo
- Máscara: `cpf=***.456.789-**`

### 14.3 Métricas (Prometheus)

```plain
Formato: unificard_{dominio}_{metrica}_{unidade}
```

**Regras:**
- Prefixo obrigatório: `unificard_`
- Snake case
- Unidade no final (`_total`, `_seconds`, `_bytes`)
- Labels para dimensionalidade

**Métricas de Negócio**

```plain
# Contadores (monotônicos)
unificard_payments_processed_total{status="success",method="pix"}
unificard_payments_processed_total{status="failed",reason="insufficient_funds"}
unificard_orders_created_total{channel="app",region="southeast"}

# Valores (podem subir/descer)
unificard_active_users_count
unificard_pending_payments_count
unificard_fraud_score_average
```

**Métricas de Sistema**

```plain
# Latência (histogram)
unificard_http_request_duration_seconds_bucket{le="0.1",path="/v1/payments"}
unificard_http_request_duration_seconds_bucket{le="0.5",path="/v1/payments"}
unificard_http_request_duration_seconds_count{path="/v1/payments"}
unificard_http_request_duration_seconds_sum{path="/v1/payments"}

# Taxas
unificard_database_connection_pool_active
unificard_database_connection_pool_max
unificard_cache_hit_rate
unificard_queue_depth
```

**Métricas de Infraestrutura**

```plain
unificard_cpu_usage_percent
unificard_memory_usage_bytes
unificard_disk_usage_bytes
unificard_network_io_bytes
```

### 14.4 Tracing (OpenTelemetry)

```plain
Campos obrigatórios:
- traceId: 16 bytes hex (32 chars)
- spanId: 8 bytes hex (16 chars)
- parentSpanId: opcional, mesmo formato
- sampled: true/false
```

**Naming de Spans:**

```plain
{protocol}.{action}
```

**Exemplos:**
- `http.post /v1/payments`
- `db.query SELECT`
- `cache.get user:123`
- `queue.publish v1.payment.processed`
- `grpc.call PaymentService.Capture`

### 14.5 Alertas

```plain
Formato do nome: {dominio}_{condicao}_{severidade}
```

**Exemplos:**
- `payment_gateway_high_error_rate_critical`
- `database_connection_pool_exhausted_warning`
- `queue_dlq_depth_increasing_warning`
- `fraud_detection_latency_high_critical`

**Severidades:**
- `critical` — PagerDuty imediato
- `warning` — Slack/email, responder em 15min
- `info` — Dashboard apenas

---

## 15. MIGRAÇÕES DE BANCO

### 15.1 Nomenclatura de Arquivos

```plain
Formato: {TIMESTAMP}_{DESCRICAO}_{TIPO}.sql
```

**Regras:**
- Timestamp: `YYYYMMDDHHMMSS` (UTC)
- Descrição: `snake_case`, clara e objetiva
- Tipo: `up` (aplicar) ou `down` (reverter)

✔ `20260217103000_create_users_table.up.sql`
✔ `20260217103000_create_users_table.down.sql`
✔ `20260217104500_add_user_status_index.up.sql`
✔ `20260217110000_migrate_legacy_payments.up.sql`
✔ `20260217111500_add_payment_idempotency_key.up.sql`
❌ `migration_1.sql`
❌ `2026-02-17-new-table.sql`
❌ `create_users.sql`
❌ `20260217_fix_bug.sql` (vago)

### 15.2 Conteúdo das Migrações

```sql
-- Up: 20260217103000_create_users_table.up.sql
BEGIN;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

COMMENT ON TABLE users IS 'Tabela de usuários do sistema';

COMMIT;

-- Down: 20260217103000_create_users_table.down.sql
BEGIN;

DROP INDEX IF EXISTS idx_users_email;
DROP TABLE IF EXISTS users;

COMMIT;
```

### 15.3 Seeds e Fixtures

```plain
Formato: {ordem}_{contexto}_{tipo}.sql
```

**Exemplos:**
- `001_system_roles_seed.sql`
- `002_test_users_fixture.sql`
- `003_demo_data_fixture.sql`

### 15.4 Schema Diffs

```plain
Formato: schema_{versao}_to_{versao}.sql
```

**Exemplo:**
- `schema_v2.1.0_to_v2.2.0.sql`

---

## 16. TESTES

### 16.1 Nomenclatura de Arquivos

```plain
Formato: {modulo}.{tipo}.ts
```

**Tipos:**
- `.spec.ts` = teste unitário (isolação)
- `.test.ts` = teste de integração (com dependências)
- `.e2e-spec.ts` = teste end-to-end (fluxo completo)
- `.fixture.ts` = dados de teste
- `.mock.ts` = mocks/stubs

✔ `payment.service.spec.ts`
✔ `payment.controller.test.ts`
✔ `checkout.flow.e2e-spec.ts`
✔ `user.fixture.ts`
✔ `stripe.mock.ts`
❌ `test1.ts`
❌ `paymentTests.js`
❌ `test-payment.ts`
❌ `e2e.test.ts` (sem contexto)

### 16.2 Estrutura de Testes (Describe/It)

```typescript
describe('PaymentService', () => {
  describe('processPayment', () => {
    describe('when payment is authorized', () => {
      it('should capture payment successfully', async () => {});
      it('should update order status to paid', async () => {});
      it('should send confirmation email', async () => {});
    });

    describe('when payment fails', () => {
      it('should return error for insufficient funds', async () => {});
      it('should retry on gateway timeout', async () => {});
      it('should fail permanently after max retries', async () => {});
    });

    describe('idempotency', () => {
      it('should return same result for duplicate idempotency key', async () => {});
      it('should create new payment for different idempotency key', async () => {});
    });
  });

  describe('refundPayment', () => {
    it('should refund full amount when requested', async () => {});
    it('should fail when payment not settled', async () => {});
    it('should support partial refunds', async () => {});
  });
});
```

### 16.3 Nomenclatura de Casos de Teste

```plain
Padrão: should {resultado} when {condição}
        should {ação} for {contexto}
```

**Regras:**
- Começar com "should"
- Descrição clara do comportamento esperado
- Uma asserção por teste (idealmente)

✔ `should capture payment when authorized`
✔ `should fail when amount exceeds limit`
✔ `should retry on gateway timeout`
✔ `should return cached result for repeated calls`
✔ `should emit event after successful save`
❌ `test payment`
❌ `works correctly`
❌ `payment test 1`

### 16.4 Fixtures e Factories

```typescript
// user.fixture.ts
export const validUser = {
  id: 'usr_123',
  email: 'test@example.com',
  name: 'João Teste',
  cpf: '12345678901',
  createdAt: new Date('2026-01-15T10:00:00Z')
};

export const createUser = (overrides = {}) => ({
  ...validUser,
  ...overrides,
  id: `usr_${randomUUID()}`
});
```

### 16.5 Mocks

```typescript
// stripe.mock.ts
export const mockStripeClient = {
  payments: {
    create: jest.fn().mockResolvedValue({ id: 'pi_123', status: 'succeeded' }),
    capture: jest.fn().mockResolvedValue({ id: 'pi_123', status: 'succeeded' })
  }
};
```

### 16.6 Cobertura de Testes

```plain
Mínimos obrigatórios:
- Unitários: 80% lines, 70% branches
- Integração: 60% lines
- E2E: fluxos críticos (payment, auth, order)
```

---

## 17. GIT WORKFLOW

### 17.1 Branches

```plain
Formato: {tipo}/{identificador}-{descricao}
```

**Tipos principais:**
- `main` = produção (protegida)
- `develop` = integração (protegida)
- `feature/` = nova funcionalidade
- `bugfix/` = correção de bug não crítico
- `hotfix/` = correção crítica em produção
- `release/` = preparação de release
- `chore/` = tarefas de manutenção
- `docs/` = documentação
- `refactor/` = refatoração
- `test/` = adição de testes
✔ `main`
✔ `develop`
✔ `feature/PAY-123-pix-integration`
✔ `feature/USER-456-password-reset`
✔ `bugfix/PAY-456-fix-race-condition`
✔ `hotfix/PAY-789-critical-security-fix`
✔ `release/v2.1.0`
✔ `chore/update-dependencies`
✔ `docs/api-endpoints`
❌ `master` (usar `main`)
❌ `dev` (usar `develop`)
❌ `feature-new-stuff` (sem identificador)
❌ `bugfix123` (sem descrição)
❌ `joao-branch` (nome pessoal)

### 17.2 Commits Semânticos

```plain
Formato: {tipo}({escopo}): {descrição}

[corpo opcional]

[rodapé opcional]
```

**Tipos obrigatórios:**

| Tipo | Uso | Exemplo |
|------|-----|---------|
| feat | Nova funcionalidade | `feat(payment): add PIX payment method` |
| fix | Correção de bug | `fix(auth): resolve token expiration` |
| refactor | Refatoração sem mudança de comportamento | `refactor(user): extract validation logic` |
| perf | Melhoria de performance | `perf(query): add index to user_email` |
| docs | Documentação | `docs(api): update endpoint documentation` |
| test | Testes | `test(payment): add unit tests for refunds` |
| chore | Tarefas de build/CI | `chore(ci): update github actions` |
| style | Formatação (espaços, ponto-e-vírgula) | `style(lint): fix eslint warnings` |
| build | Sistema de build | `build(docker): optimize image size` |
| ci | Integração contínua | `ci(pipeline): add staging deployment` |
| revert | Reverter commit anterior | `revert: feat(payment) add PIX` |

**Escopos comuns:**
`payment`, `auth`, `user`, `order`, `inventory`, `notification`, `api`, `ui`, `db`, `ci`, `docs`

**Descrição:**
- Imperativo presente ("add" não "added")
- Sem ponto final
- Máximo 72 caracteres

✔ `feat(payment): add PIX payment method`
✔ `fix(auth): resolve race condition in token refresh`
✔ `refactor(order): extract fulfillment logic to service`
✔ `docs(api): document error codes for payments`
✔ `test(user): add integration tests for registration`
❌ `update code`
❌ `fix bug`
❌ `WIP`
❌ `feat: added new feature` (passado)
✔ `feat: add new feature` (imperativo)

### 17.3 Mensagens de Commit Detalhadas

```plain
feat(payment): add support for split payments

Implementa divisão de pagamentos entre múltiplos recebedores
segundo regras de marketplace. Inclui:

- Cálculo automático de splits por percentual
- Validação de soma total = 100%
- Suporte a splits aninhados (sub-affiliates)

BREAKING CHANGE: remove campo legacy 'split_rules' do payload

Closes: PAY-123
Relates to: PAY-456, PAY-789
```

### 17.4 Pull Requests

```plain
Título: [{tipo}] {descrição breve}

Corpo:
## Descrição
O que este PR faz e por quê.

## Mudanças Principais
- Lista de mudanças significativas

## Breaking Changes
- Lista de breaking changes (se houver)

## Checklist
- [ ] Testes passam
- [ ] Documentação atualizada
- [ ] CHANGELOG.md atualizado
- [ ] Code review aprovado

## Issues Relacionadas
Closes #123
Relates to #456
```

### 17.5 Tags e Releases

```plain
Formato: v{major}.{minor}.{patch}-{prerelease}.{num}
```

**Exemplos:**
- `v2.1.0` — Release estável
- `v2.1.0-rc.1` — Release candidate 1
- `v2.1.0-beta.3` — Beta 3
- `v2.1.0-alpha.1` — Alpha 1 (interno)

- `v2.0.0` — Major (breaking changes)
- `v2.1.0` — Minor (features)
- `v2.1.1` — Patch (fixes)

### 17.6 Gates de auditoria estrutural (CI/CD)

Aplica o **§2 — Escopo de aplicação** (Infraestrutura CI/CD). Objetivo: **regressão estrutural** (bypass de domínio, SSOT paralelo, invariantes), não estética de código.

**Registro central:** `docs/04_audit/GATES.md` — lista gates ativos e ligações.

**Nomenclatura obrigatória dos artefatos** (um domínio por gate; nomes previsíveis para discovery e tooling):

| Artefato | Formato canônico | Exemplo |
|----------|-------------------|---------|
| Norma / protocolo | `docs/04_audit/<DOMINIO>_BOUNDARIES_AUDIT_GATE.md` | `MARKETPLACE_ORDER_BOUNDARIES_AUDIT_GATE.md` |
| Script de detecção | `backend/scripts/audit-<domínio-kebab>-boundaries.sh` | `audit-marketplace-order-boundaries.sh` |
| Workflow GitHub Actions | `.github/workflows/<domínio-kebab>-boundaries-audit.yml` | `marketplace-order-boundaries-audit.yml` |

- `<DOMINIO>` em UPPER_SNAKE no nome do ficheiro `.md` (consistente com títulos de normas existentes).
- `<domínio-kebab>` em minúsculas com hífens (consistente com §13 microserviços / nomes de ficheiro em repo).

**Conteúdo mínimo da norma (ficheiro `.md`):** critério de aprovação binário; o que o revisor **não assume**; ligação a invariantes de produto (ex.: monetário `price_cents` / estoque conforme Parte I — §§4.5–4.7, 4.23, 4.9 onde aplicável).

**Evolução do enforcement:** comentário de roadmap no YAML do workflow; fase **soft** (não bloqueante) até baseline documentada em critérios no próprio `.md` do gate; só então **blocking**.

❌ Nomes ad hoc por PR (`gate-v2.md`, `check-orders.sh`) sem registo em `GATES.md`.  
✔ Novo domínio: criar os três artefatos + linha em `GATES.md` + secção opcional no PR template quando o PR tocar nesse domínio.

#### 17.6.1 Gates de fronteira financeira (ledger / efeitos irreversíveis)

Quando um gate proteger **integridade financeira** (ex.: escrita em `bank_ledger`, efeitos irreversíveis), aplicam-se regras **adicionais** ao molde acima:

1. **Allowlist = decisão de domínio, não um único ficheiro.** Antes de implementar o script, mapear no repositório **todos os writers reais**: SQL direto, repositório canónico do ledger, serviços de execução, liquidação, reconciliação, jobs, reembolsos. A lista permitida no `.md` do gate e no script é **conjunto explícito de caminhos canónicos** obtido desse mapa — não exclusão por um único `--glob` assumindo um único writer.
2. **Duas verificações complementares:** (a) padrões de **persistência** (ex.: `INSERT INTO bank_ledger`) apenas onde o boundary SQL for autorizado; (b) **import ou uso** do módulo/repositório de ledger **fora** da allowlist documentada → falha até revisão. Um módulo pode chamar APIs indiretas; o que importa é **quem tem permissão para causar efeito financeiro**, não uma regex isolada.
3. **Evolução:** qualquer **novo** import do boundary de ledger é alteração de **autoridade** — o PR deve atualizar a allowlist no doc do gate (e no script) ou redirecionar o fluxo para um writer já canónico.
4. **Idempotência de handlers:** escritas e efeitos irreversíveis disparados por eventos devem seguir **§4.12.1** (`withIdempotency`, formato canónico da chave, `reference_id` por unidade de efeito).

**Distinção:** gate de **fluxo operacional** (pedido, reserva, PDV) vs gate de **autoridade financeira** (ledger) têm **objetivos e critérios diferentes**; o **molde** §17.6 (nomenclatura, três artefatos, `GATES.md`, soft → blocking) é o mesmo.

---

# PARTE IV — TABELAS DE CONVERSÃO

## 18. CONVERSÃO BANCO → BACKEND/API

### 18.1 Identificadores

| Banco | Backend/API |
|-------|-------------|
| `user_id` | `userId` |
| `actor_id` | `actorId` |
| `tenant_id` | `tenantId` |
| `organization_id` | `organizationId` |
| `order_id` | `orderId` |
| `payment_id` | `paymentId` |
| `driver_id` | `driverId` |
| `entity_id` | `entityId` |
| `split_id` | `splitId` |
| `entry_id` | `entryId` |
| `transaction_id` | `transactionId` |
| `subscription_id` | `subscriptionId` |
| `product_id` | `productId` |
| `sku` | `sku` (não muda) |
| `external_id` | `externalId` |
| `reference_id` | `referenceId` |
| `gateway_id` | `gatewayId` |
| `correlation_id` | `correlationId` |
| `trace_id` | `traceId` |
| `idempotency_key` | `idempotencyKey` |
| `tracking_code` | `trackingCode` |

### 18.2 Timestamps

| Banco | Backend/API |
|-------|-------------|
| `created_at` | `createdAt` |
| `updated_at` | `updatedAt` |
| `deleted_at` | `deletedAt` |
| `verified_at` | `verifiedAt` |
| `approved_at` | `approvedAt` |
| `paid_at` | `paidAt` |
| `settled_at` | `settledAt` |
| `captured_at` | `capturedAt` |
| `refunded_at` | `refundedAt` |
| `cancelled_at` | `cancelledAt` |
| `delivered_at` | `deliveredAt` |
| `shipped_at` | `shippedAt` |
| `scheduled_at` | `scheduledAt` |
| `starts_at` | `startsAt` |
| `ends_at` | `endsAt` |
| `expires_at` | `expiresAt` |
| `available_from_at` | `availableFromAt` |
| `available_until_at` | `availableUntilAt` |
| `trial_ends_at` | `trialEndsAt` |
| `current_period_start_at` | `currentPeriodStartAt` |
| `current_period_end_at` | `currentPeriodEndAt` |

### 18.3 Monetários

| Banco | Backend/API |
|-------|-------------|
| `amount_cents` | `amountCents` |
| `gross_cents` | `grossCents` |
| `net_cents` | `netCents` |
| `fee_cents` | `feeCents` |
| `platform_fee_cents` | `platformFeeCents` |
| `gateway_fee_cents` | `gatewayFeeCents` |
| `commission_cents` | `commissionCents` |
| `tax_cents` | `taxCents` |
| `discount_cents` | `discountCents` |
| `refund_cents` | `refundCents` |
| `balance_cents` | `balanceCents` |
| `available_cents` | `availableCents` |
| `pending_cents` | `pendingCents` |
| `reserved_cents` | `reservedCents` |
| `current_balance_cents` | `currentBalanceCents` |
| `delivery_fee_cents` | `deliveryFeeCents` |
| `shipping_cents` | `shippingCents` |
| `tip_cents` | `tipCents` |
| `subscription_price_cents` | `subscriptionPriceCents` |
| `unit_price_cents` | `unitPriceCents` |
| `total_price_cents` | `totalPriceCents` |
| `min_amount_cents` | `minAmountCents` |
| `max_amount_cents` | `maxAmountCents` |

### 18.4 Percentuais (Basis Points)

| Banco | Backend/API |
|-------|-------------|
| `tax_rate_bps` | `taxRateBps` |
| `commission_rate_bps` | `commissionRateBps` |
| `platform_fee_rate_bps` | `platformFeeRateBps` |
| `interest_rate_bps` | `interestRateBps` |
| `surge_multiplier_bps` | `surgeMultiplierBps` |
| `percentage_bps` | `percentageBps` |

### 18.5 Booleanos

| Banco | Backend/API |
|-------|-------------|
| `is_active` | `isActive` |
| `is_deleted` | `isDeleted` |
| `is_verified` | `isVerified` |
| `is_approved` | `isApproved` |
| `is_published` | `isPublished` |
| `is_visible` | `isVisible` |
| `is_blocked` | `isBlocked` |
| `is_suspended` | `isSuspended` |
| `is_available` | `isAvailable` |
| `is_refundable` | `isRefundable` |
| `is_fragile` | `isFragile` |
| `is_perishable` | `isPerishable` |
| `is_refrigerated` | `isRefrigerated` |
| `is_frozen` | `isFrozen` |
| `is_24h` | `is24h` |
| `is_open` | `isOpen` |
| `can_withdraw` | `canWithdraw` |
| `can_receive` | `canReceive` |
| `can_edit` | `canEdit` |
| `can_delete` | `canDelete` |
| `can_share` | `canShare` |
| `has_permission` | `hasPermission` |
| `has_split` | `hasSplit` |
| `has_tracking` | `hasTracking` |
| `has_insurance` | `hasInsurance` |
| `has_subscription` | `hasSubscription` |
| `requires_signature` | `requiresSignature` |
| `requires_approval` | `requiresApproval` |
| `requires_verification` | `requiresVerification` |
| `requires_payment` | `requiresPayment` |
| `is_liable` | `isLiable` |
| `is_charge_processing_fee` | `isChargeProcessingFee` |
| `is_sla_breached` | `isSlaBreached` |
| `cancel_at_period_end` | `cancelAtPeriodEnd` |

### 18.6 Scores e Ratings

| Banco | Backend/API |
|-------|-------------|
| `trust_score` | `trustScore` |
| `reputation_score` | `reputationScore` |
| `quality_score` | `qualityScore` |
| `risk_score` | `riskScore` |
| `relevance_score` | `relevanceScore` |
| `punctuality_score` | `punctualityScore` |
| `professionalism_score` | `professionalismScore` |
| `diversity_score` | `diversityScore` |
| `global_score` | `globalScore` |
| `actor_score` | `actorScore` |
| `rating` | `rating` |
| `average_rating` | `averageRating` |
| `seller_rating` | `sellerRating` |
| `driver_rating` | `driverRating` |
| `service_rating` | `serviceRating` |
| `product_rating` | `productRating` |

### 18.7 Tipos e Enums

| Banco | Backend/API |
|-------|-------------|
| `entity_type` | `entityType` |
| `actor_type` | `actorType` |
| `event_type` | `eventType` |
| `payment_method` | `paymentMethod` |
| `payment_method_type` | `paymentMethodType` |
| `entry_type` | `entryType` |
| `split_type` | `splitType` |
| `transaction_type` | `transactionType` |
| `order_type` | `orderType` |
| `pricing_type` | `pricingType` |
| `discount_type` | `discountType` |
| `recipient_type` | `recipientType` |
| `vehicle_type` | `vehicleType` |
| `content_type` | `contentType` |
| `channel` | `channel` |
| `notification_channel` | `notificationChannel` |
| `preferred_channel` | `preferredChannel` |
| `role` | `role` |
| `membership_role` | `membershipRole` |
| `team_role` | `teamRole` |
| `source` | `source` |
| `origin` | `origin` |
| `acquisition_source` | `acquisitionSource` |
| `scope` | `scope` |
| `context` | `context` |
| `action` | `action` |
| `action_type` | `actionType` |
| `reason` | `reason` |
| `reason_code` | `reasonCode` |
| `mode` | `mode` |
| `level` | `level` |
| `direction` | `direction` |
| `category` | `category` |
| `subcategory` | `subcategory` |
| `service_type` | `serviceType` |
| `carrier` | `carrier` |
| `carrier_code` | `carrierCode` |
| `zone_type` | `zoneType` |
| `billing_cycle` | `billingCycle` |
| `account_type` | `accountType` |
| `pix_key_type` | `pixKeyType` |
| `gender` | `gender` |
| `language` | `language` |
| `locale` | `locale` |
| `currency` | `currency` |
| `currency_code` | `currencyCode` |
| `timezone` | `timezone` |
| `country_code` | `countryCode` |
| `region_code` | `regionCode` |
| `state_code` | `stateCode` |
| `postal_code` | `postalCode` |

### 18.8 Métricas e Contadores

| Banco | Backend/API |
|-------|-------------|
| `view_count` | `viewCount` |
| `like_count` | `likeCount` |
| `share_count` | `shareCount` |
| `comment_count` | `commentCount` |
| `order_count` | `orderCount` |
| `total_orders` | `totalOrders` |
| `total_revenue_cents` | `totalRevenueCents` |
| `quantity` | `quantity` |
| `available_quantity` | `availableQuantity` |
| `reserved_quantity` | `reservedQuantity` |
| `committed_quantity` | `committedQuantity` |
| `on_hand_quantity` | `onHandQuantity` |
| `in_transit_quantity` | `inTransitQuantity` |
| `min_quantity` | `minQuantity` |
| `max_quantity` | `maxQuantity` |
| `capacity_min` | `capacityMin` |
| `capacity_max` | `capacityMax` |

### 18.9 Distância, Duração, Peso, Dimensões

| Banco | Backend/API |
|-------|-------------|
| `distance_meters` | `distanceMeters` |
| `duration_seconds` | `durationSeconds` |
| `duration_minutes` | `durationMinutes` |
| `walking_duration_seconds` | `walkingDurationSeconds` |
| `driving_duration_seconds` | `drivingDurationSeconds` |
| `eta_minutes` | `etaMinutes` |
| `sla_minutes` | `slaMinutes` |
| `sla_hours` | `slaHours` |
| `radius_meters` | `radiusMeters` |
| `max_distance_meters` | `maxDistanceMeters` |
| `min_distance_meters` | `minDistanceMeters` |
| `preparation_time_minutes` | `preparationTimeMinutes` |
| `response_time_minutes` | `responseTimeMinutes` |
| `response_time_seconds` | `responseTimeSeconds` |
| `resolution_time_seconds` | `resolutionTimeSeconds` |
| `slot_duration_minutes` | `slotDurationMinutes` |
| `buffer_minutes` | `bufferMinutes` |
| `lead_time_minutes` | `leadTimeMinutes` |
| `weight_grams` | `weightGrams` |
| `net_weight_grams` | `netWeightGrams` |
| `gross_weight_grams` | `grossWeightGrams` |
| `tare_weight_grams` | `tareWeightGrams` |
| `dimensional_weight_grams` | `dimensionalWeightGrams` |
| `length_cm` | `lengthCm` |
| `width_cm` | `widthCm` |
| `height_cm` | `heightCm` |
| `depth_cm` | `depthCm` |
| `diameter_cm` | `diameterCm` |
| `volume_ml` | `volumeMl` |
| `volume_liters` | `volumeLiters` |
| `capacity_ml` | `capacityMl` |
| `cubic_meters` | `cubicMeters` |
| `altitude_meters` | `altitudeMeters` |
| `accuracy_meters` | `accuracyMeters` |
| `heading_degrees` | `headingDegrees` |
| `speed_mps` | `speedMps` |

### 18.10 Geolocalização

| Banco | Backend/API |
|-------|-------------|
| `latitude` | `latitude` |
| `longitude` | `longitude` |
| `pickup_latitude` | `pickupLatitude` |
| `pickup_longitude` | `pickupLongitude` |
| `dropoff_latitude` | `dropoffLatitude` |
| `dropoff_longitude` | `dropoffLongitude` |
| `current_latitude` | `currentLatitude` |
| `current_longitude` | `currentLongitude` |
| `origin_latitude` | `originLatitude` |
| `origin_longitude` | `originLongitude` |
| `destination_latitude` | `destinationLatitude` |
| `destination_longitude` | `destinationLongitude` |
| `center_latitude` | `centerLatitude` |
| `center_longitude` | `centerLongitude` |

### 18.11 Endereços

| Banco | Backend/API |
|-------|-------------|
| `address_line_1` | `addressLine1` |
| `address_line_2` | `addressLine2` |
| `street` | `street` |
| `street_number` | `streetNumber` |
| `complement` | `complement` |
| `reference` | `reference` |
| `neighborhood` | `neighborhood` |
| `city` | `city` |
| `state` | `state` |
| `state_code` | `stateCode` |
| `postal_code` | `postalCode` |
| `country` | `country` |
| `country_code` | `countryCode` |
| `region_code` | `regionCode` |
| `ibge_code` | `ibgeCode` |

### 18.12 Documentos e Dados Bancários

| Banco | Backend/API |
|-------|-------------|
| `cpf` | `cpf` |
| `cnpj` | `cnpj` |
| `tax_id` | `taxId` |
| `rg` | `rg` |
| `pis` | `pis` |
| `cnh` | `cnh` |
| `passport` | `passport` |
| `voter_id` | `voterId` |
| `bank_code` | `bankCode` |
| `bank_name` | `bankName` |
| `branch_number` | `branchNumber` |
| `branch_digit` | `branchDigit` |
| `account_number` | `accountNumber` |
| `account_digit` | `accountDigit` |
| `account_type` | `accountType` |
| `pix_key` | `pixKey` |
| `pix_key_type` | `pixKeyType` |

### 18.13 Mídia e Contato

| Banco | Backend/API |
|-------|-------------|
| `avatar_url` | `avatarUrl` |
| `cover_url` | `coverUrl` |
| `thumbnail_url` | `thumbnailUrl` |
| `image_url` | `imageUrl` |
| `file_url` | `fileUrl` |
| `logo_url` | `logoUrl` |
| `icon_url` | `iconUrl` |
| `video_url` | `videoUrl` |
| `audio_url` | `audioUrl` |
| `share_url` | `shareUrl` |
| `phone` | `phone` |
| `phone_country_code` | `phoneCountryCode` |
| `phone_number` | `phoneNumber` |
| `email` | `email` |
| `whatsapp` | `whatsapp` |
| `website` | `website` |

### 18.14 Produtos e Estoque

**SSOT semântico de produto:** `concepts.concept_id` (única fonte de “o que o item é”).  
`canonical_products.concept_id` é FK obrigatória para significado estável; **slug e nome não são identidade semântica**.  
Enquanto `concept_resolution_status <> 'confirmed'`, `concept_id` pode estar pendente de governança humana, desde que exista fila operacional (`canonical_concept_resolution_queue` pending) na mesma política de persistência — ver migrations de governança e `SSOT_REGISTRY_UNIFICARD.md`.

#### Resolução de `concept_ref` em fluxos transacionais

Nos fluxos de **intent, pedido e oferta**, o campo **`concept_ref`** deve ser resolvido **exclusivamente** a partir de **`canonical_products.concept_id`** (via vínculo do produto tenant com o registo canónico), e não por atalhos na árvore de categorias.

##### Predicado obrigatório (READY)

A resolução só é válida quando o `canonical_product` atende, em conjunto:

- `concept_id IS NOT NULL`
- `concept_resolution_status = 'confirmed'`
- nome preenchido (`btrim(name) <> ''`)
- `category_id IS NOT NULL` (no registo canónico — requisito de prontidão operacional; não substitui a proibição de usar `categories.concept_id` como fonte de `concept_ref`)
- `type = 'INDUSTRIAL'`

Alinhar implementação a `sqlCanonicalIndustrialOperationalReady` / `isCanonicalProductOperationalReady` no código.

##### Fonte proibida

Não é permitido derivar **`concept_ref`** de **`categories.concept_id`**, nem como fallback.

##### Evolução futura (catálogo global)

Quando o sistema suportar **`canonical_products.scope = 'global'`** com **`tenant_id IS NULL`** em linhas globais, os critérios de lookup e os `JOIN` em código **não podem depender exclusivamente** de igualdade `canonical_products.tenant_id = products.tenant_id`; devem admitir registos globais válidos segundo migrations, `SSOT_REGISTRY_UNIFICARD.md` e revisão normativa associada.

##### Nota

Esta subsecção **não altera** a Lei 7 — apenas especifica a sua aplicação no domínio de produto e oferta.

| Banco | Backend/API |
|-------|-------------|
| `sku` | `sku` |
| `upc` | `upc` |
| `ean` | `ean` |
| `isbn` | `isbn` |
| `asin` | `asin` |
| `mpn` | `mpn` |
| `gtin` | `gtin` |
| `fingerprint_v1` | `fingerprintV1` |
| `concept_id` | `conceptId` |
| `concept_resolution_status` | `conceptResolutionStatus` |
| `damaged_quantity` | `damagedQuantity` |
| `reorder_quantity` | `reorderQuantity` |
| `reorder_point` | `reorderPoint` |
| `batch_number` | `batchNumber` |
| `shelf_life_days` | `shelfLifeDays` |
| `expires_at` | `expiresAt` |
| `manufactured_at` | `manufacturedAt` |

### 18.15 Veículos e Temperatura

| Banco | Backend/API |
|-------|-------------|
| `plate_number` | `plateNumber` |
| `vehicle_model` | `vehicleModel` |
| `vehicle_color` | `vehicleColor` |
| `vehicle_year` | `vehicleYear` |
| `license_number` | `licenseNumber` |
| `license_category` | `licenseCategory` |
| `license_expires_at` | `licenseExpiresAt` |
| `min_temp_celsius` | `minTempCelsius` |
| `max_temp_celsius` | `maxTempCelsius` |
| `current_temp_celsius` | `currentTempCelsius` |
| `humidity_percent` | `humidityPercent` |

### 18.16 Tracking e SLA

| Banco | Backend/API |
|-------|-------------|
| `tracking_code` | `trackingCode` |
| `waybill_number` | `waybillNumber` |
| `shipment_id` | `shipmentId` |
| `checkpoint_status` | `checkpointStatus` |
| `checkpoint_at` | `checkpointAt` |
| `checkpoint_location` | `checkpointLocation` |
| `checkpoint_message` | `checkpointMessage` |
| `deadline_at` | `deadlineAt` |
| `promised_at` | `promisedAt` |
| `expected_at` | `expectedAt` |
| `target_at` | `targetAt` |
| `sla_breached_at` | `slaBreachedAt` |

### 18.17 Recorrência e Agendamento

| Banco | Backend/API |
|-------|-------------|
| `rrule` | `rrule` |
| `frequency` | `frequency` |
| `interval` | `interval` |
| `count` | `count` |
| `until_at` | `untilAt` |
| `by_day` | `byDay` |
| `by_month` | `byMonth` |
| `by_month_day` | `byMonthDay` |
| `scheduled_at` | `scheduledAt` |
| `scheduled_date` | `scheduledDate` |
| `slot_start_at` | `slotStartAt` |
| `slot_end_at` | `slotEndAt` |
| `cutoff_time` | `cutoffTime` |
| `opens_at` | `opensAt` |
| `closes_at` | `closesAt` |
| `day_of_week` | `dayOfWeek` |
| `is_open` | `isOpen` |

### 18.18 Auditoria e Versão

| Banco | Backend/API |
|-------|-------------|
| `created_by` | `createdBy` |
| `updated_by` | `updatedBy` |
| `deleted_by` | `deletedBy` |
| `approved_by` | `approvedBy` |
| `rejected_by` | `rejectedBy` |
| `cancelled_by` | `cancelledBy` |
| `created_by_user_id` | `createdByUserId` |
| `created_by_actor_id` | `createdByActorId` |
| `version` | `version` |
| `posting_date` | `postingDate` |
| `effective_date` | `effectiveDate` |

---

**Fim da Parte 4**

Esta parte cobre:
- Seção 14: Observabilidade (logs, métricas, tracing, alertas)
- Seção 15: Migrações de Banco (nomenclatura, seeds, schema diffs)
- Seção 16: Testes (arquivos, estrutura, fixtures, mocks, cobertura)
- Seção 17: Git Workflow (branches, commits, PRs, tags)
- Parte IV completa: Seção 18 — Tabela de Conversão Banco → Backend/API (todas as 150+ conversões)

PARTE 5: PARTE V — GOVERNANÇA E FINALIZAÇÃO

# PARTE V — GOVERNANÇA

## 19. PROIBIÇÕES ABSOLUTAS

### 19.1 Geral

É **ESTRITAMENTE PROIBIDO**:

| # | Proibição | Consequência |
|---|-----------|--------------|
| 1 | Misturar `snake_case` e `camelCase` na mesma camada | Breaking change em todos os clientes |
| 2 | Expor nomes de coluna de banco na API | Vazamento de estrutura interna |
| 3 | Criar aliases "temporários" ou "legado" | Dívida técnica permanente |
| 4 | Manter dois nomes para o mesmo conceito | Ambiguidade semântica |
| 5 | Renomear campo sem Gate formal | Contrato quebrado |
| 6 | Converter formato fora de mapper dedicado | Lógica espalhada |
| 7 | Usar comentários para explicar nome ruim | Nome deve ser autoexplicativo |
| 8 | Abreviações sem contexto universal (`usr`, `qty`, `addr`) | Código ilegível |

### 19.2 Monetário

| # | Proibição | Razão |
|---|-----------|-------|
| 1 | Armazenar dinheiro como `FLOAT`, `DOUBLE`, `DECIMAL`, `NUMERIC` | Perda de precisão |
| 2 | Omitir sufixo `_cents`/`Cents` | Ambiguidade de unidade |
| 3 | Usar `value`, `amount`, `price` sem sufixo | Sem contexto |
| 4 | Armazenar em reais/dólares (ex: `10.99`) | Risco de arredondamento |
| 5 | Usar `INTEGER` para valores monetários | Overflow em grandes volumes |
| 6 | Misturar centavos e unidades no mesmo sistema | Inconsistência |

### 19.3 Percentuais

| # | Proibição | Razão |
|---|-----------|-------|
| 1 | Omitir sufixo `_bps`/`Bps` | Ambiguidade (0.1 = 10% ou 0.1%?) |
| 2 | Usar `_percent`, `_percentage`, `_pct` | Não padronizado |
| 3 | Usar float para percentuais (0.15 para 15%) | Imprecisão |
| 4 | Misturar bps e percentual no mesmo campo | Confusão |

### 19.4 Timestamps

| # | Proibição | Razão |
|---|-----------|-------|
| 1 | Omitir sufixo `_at`/`At` | Ambiguidade com data |
| 2 | Usar `_date` ou `_time` para timestamps | Imprecisão semântica |
| 3 | Usar `TIMESTAMP` sem timezone | Problemas de fuso horário |
| 4 | Usar `DATE` para momentos específicos | Perda de precisão |
| 5 | Nomes como `created`, `modified`, `timestamp` | Vagos |

### 19.5 Duração

| # | Proibição | Razão |
|---|-----------|-------|
| 1 | Usar `_min` como sufixo | Ambíguo (minutos vs. mínimo) |
| 2 | Omitir unidade (`duration`, `time`) | Sem contexto |
| 3 | Usar float para duração (1.5 horas) | Imprecisão |
| 4 | Misturar segundos e minutos sem convenção | Inconsistência |

### 19.6 Booleanos

| # | Proibição | Razão |
|---|-----------|-------|
| 1 | Omitir prefixo `is_`/`is`, `has_`/`has`, `can_`/`can` | Semântica obscura |
| 2 | Usar `flag`, `indicator`, `marker` como sufixo | Jargão técnico |
| 3 | Valores como `Y/N`, `1/0`, `S/N` | Não booleano |
| 4 | Nomes como `active`, `deleted`, `processed` | Verbos, não estados |

### 19.7 Identificadores

| # | Proibição | Razão |
|---|-----------|-------|
| 1 | Abreviações (`usr_id`, `ext_id`, `txn_id`) | Ilegível |
| 2 | Omitir `_id`/`Id` (`user`, `order`) | Ambiguidade com entidade |
| 3 | Usar `id` sozinho em contexto ambíguo | Qual ID? |
| 4 | Misturar UUID, integer, string sem convenção | Inconsistência |
| 5 | Usar `guid` em vez de `id` | Termo obsoleto |

### 19.8 Idioma (CRÍTICO — ZERO TOLERÂNCIA)

**Todos os valores de enum, nomes de campos, e documentação técnica devem ser em INGLÊS.**

**Valores canônicos obrigatórios para enums:**

| Categoria | Valores Canônicos (EN) |
|-----------|------------------------|
| Status de Pagamento | `'pending'`, `'paid'`, `'cancelled'`, `'refunded'`, `'failed'` |
| Status Geral | `'active'`, `'inactive'`, `'suspended'`, `'deleted'` |
| Tipos de Transação | `'purchase'`, `'sale'`, `'rental'`, `'refund'`, `'transfer'` |
| Valores Indefinidos | `'unknown'`, `'other'`, `'none'` |
| Booleanos | `true`/`false` ou `'yes'`/`'no'` (nunca `'SIM'`/`'NAO'`) |

**PROIBIDO:** Qualquer valor em português, incluindo mas não limitado a: termos em maiúsculas em português, abreviações em português, ou qualquer variação que não seja o termo canônico em inglês.

**Nomes de campos proibidos:**
❌ situacao → ✔ status
❌ valor → ✔ amountCents / valueCents
❌ data_criacao → ✔ createdAt
❌ `codigo_rastreio` → ✔ `trackingCode`
❌ `metodo_pagamento` → ✔ `paymentMethod`

---

### 19.9 API REST

| # | Proibição | Razão |
|---|-----------|-------|
| 1 | Verbos em endpoints (`/getUsers`, `/createOrder`) | Não RESTful |
| 2 | Underscore em URLs (`/bank_accounts`) | Kebab-case obrigatório |
| 3 | Mais de 3 níveis de nesting | Acoplamento excessivo |
| 4 | Omitir versionamento (`/users` sem `/v1/`) | Breaking changes imprevisíveis |
| 5 | Query params em camelCase (`?userId=123`) | snake_case obrigatório |
| 6 | Respostas sem envelope (`{ "id": "123" }` direto) | Metadados ausentes |

### 19.10 Eventos

| # | Proibição | Razão |
|---|-----------|-------|
| 1 | Eventos sem versionamento (`payment.captured`) | Evolução impossível |
| 2 | Present tense (`payment.create`) | Não indica conclusão |
| 3 | Maiúsculas (`Payment.Captured`) | Inconsistência |
| 4 | Hífens ou underscores (`payment-captured`, `payment_captured`) | Ponto é padrão |
| 5 | Payload sem `correlationId`/`traceId` | Rastreabilidade perdida |

### 19.11 Infraestrutura

| # | Proibição | Razão |
|---|-----------|-------|
| 1 | Variáveis em camelCase ou kebab-case | SCREAMING_SNAKE_CASE obrigatório |
| 2 | Prefixo de ambiente no nome (`PROD_DATABASE_URL`) | Valor deve variar, não nome |
| 3 | Secrets em código ou logs | Vazamento de segurança |
| 4 | `latest` como tag em produção | Deploys não reproduzíveis |
| 5 | Nomes de serviço com "Service" no nome | Redundante |

### 19.12 Git

| # | Proibição | Razão |
|---|-----------|-------|
| 1 | Commits sem tipo (`update code`) | Semântica obscura |
| 2 | Commits em português | Padronização internacional |
| 3 | `WIP`, `fix`, `test` como mensagem | Vago |
| 4 | Branches sem identificador (`feature-new`) | Rastreabilidade perdida |
| 5 | Force push em branches compartilhadas | Perda de histórico |

### 19.13 Estruturas Financeiras (SSOT)

**PROIBIÇÃO CONSTITUCIONAL:**

| Padrão | Proibido | Permitido |
|--------|----------|-----------|
| `*_ledger*` (financeiro) | Fora de `bank/**` | Apenas `src/core/bank/**`, `src/modules/bank/**` |
| `*_split*` (financeiro) | Fora de `bank/**` | Apenas `src/core/bank/**`, `src/modules/bank/**` |
| `*_transaction*` (financeiro) | Fora de `bank/**` | Apenas `src/core/bank/**`, `src/modules/bank/**` |
| `*_balance*` (persistido) | Fora de `bank/**` | Read-models calculados (não persistem) |

**Validação Automática:**
Script `validate-financial-ssot.js` valida contexto semântico, não apenas strings literais.

**Exceções:**
- Transações não-financeiras: `orderTransaction`, `inventoryTransaction` (permitido)
- Read-models: podem calcular saldo, mas não persistir

---

## 20. GOVERNANÇA

### 20.1 Processo de Mudança (Change Gate)

Qualquer alteração neste documento ou em nomenclatura existente **DEVE** seguir:
┌─────────────────┐
│  1. PROPOSTA    │ → RFC (Request for Comments) no Notion/GitHub
│     (Dia 1-3)   │    Descreve: problema, solução, impacto
└────────┬────────┘
▼
┌─────────────────┐
│  2. REVISÃO     │ → Arquitetura + Domain Experts + Segurança
│     (Dia 4-7)   │    Checklist: breaking change? migração? rollback?
└────────┬────────┘
▼
┌─────────────────┐
│  3. IMPACTO     │ → Mapear todos os sistemas afetados
│     (Dia 8-10)  │    API consumers, event subscribers, relatórios, mobile
└────────┬────────┘
▼
┌─────────────────┐
│  4. MIGRAÇÃO    │ → Plano de transição zero-downtime
│     (Dia 11-14) │    Dual-write, shadow mode, feature flag
└────────┬────────┘
▼
┌─────────────────┐
│  5. APROVAÇÃO   │ → Gate formal com 3 aprovações
│     (Dia 15)    │    Arquiteto + Tech Lead + Product Owner
└────────┬────────┘
▼
┌─────────────────┐
│  6. EXECUÇÃO    │ → Deploy em etapas (canary → 10% → 50% → 100%)
│     (Dia 16+)   │    Monitoramento contínuo, rollback automático
└────────┬────────┘
▼
┌─────────────────┐
│  7. DOCUMENTAÇÃO│ → Atualizar este documento
│     (Dia 16+)   │    Changelog, anúncio, treinamento
└─────────────────┘

### 20.2 Tipos de Mudança

| Tipo | Definição | Processo | Exemplo |
|------|-----------|----------|---------|
| `patch` | Correção de erro no documento | PR direto | Typo, exemplo errado |
| `minor` | Adição de novo padrão | Revisão rápida | Novo campo de estoque |
| `major` | Alteração de padrão existente | Gate completo | Renomear `amount` → `amountCents` |
| `breaking` | Quebra contrato existente | Gate + RFC + migração | Mudar `status` de string para enum |

### 20.3 Versionamento do Documento

Formato: {MAJOR}.{MINOR}.{PATCH}
MAJOR: Breaking change em padrão existente
MINOR: Adição de novo padrão (não breaking)
PATCH: Correção de erro no documento
plain

**Histórico:**
- `1.0.0` — Lançamento inicial
- `2.0.0` — Adição de 71 seções de banco de dados
- `3.0.0` — Adição de Infraestrutura e Operações (Parte III)

### 20.4 Responsabilidades

| Papel | Responsabilidade |
|-------|------------------|
| **Arquiteto de Nomenclatura** | Aprova mudanças, mantém documento, resolve conflitos |
| **Tech Leads** | Implementam e fiscalizam na sua squad |
| **Code Reviewers** | Rejeitam violações em PRs |
| **CI/CD** | Bloqueia deploy com nomenclatura inválida |
| **Todos os Devs** | Consultam documento antes de criar qualquer campo |

### 20.5 Ferramentas de Fiscalização

```yaml
# .github/workflows/nomenclature-check.yml
name: Nomenclature Check

on: [pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Check database columns
        run: |
          # Valida snake_case, sufixos _cents, _at, _id
          ./scripts/validate-db-schema.sh
      
      - name: Check API contracts
        run: |
          # Valida camelCase, sufixos Cents, At, Id
          ./scripts/validate-api-contracts.sh
      
      - name: Check migration files
        run: |
          # Valida formato YYYYMMDDHHMMSS
          ./scripts/validate-migrations.sh
      
      - name: Check for Portuguese enums
        run: |
          # Bloqueia valores em português (valida apenas termos canônicos em inglês)
          ./scripts/validate-english-enums.sh

### 20.6 Derivação semântica CATEGORY → CONCEPT (operação)

Critérios de mapeamento **1:1**, **determinístico** e **estável**; proibição de derivação ambígua; uso de **`concept_id` direto** quando a ponte falhar; e gate operacional recomendado estão **operacionalizados** em `docs/01_normative/00_AGENT_PROTOCOL.md` (secção 2.3.5). Esta subsecção **alinha** nomenclatura e implementação a esse trilho; **não** substitui a Lei 7 em `LEIS_OPERACIONAIS_UNIFICARD.md` nem `18_DOMAIN_ONTOLOGY_UNIFICARD.md`.

### 20.7 Penalidades (Cultura de Qualidade)

| Violação | Consequência |
|----------|--------------|
| 1ª vez | Warning no PR, obrigação de correção |
| 2ª vez | Bloqueio de merge até treinamento |
| 3ª vez | Escalada para Tech Lead e Arquiteto |
| Violação em produção | Post-mortem obrigatório + RFC de prevenção |

---

## 21. CHECKLIST DE VALIDAÇÃO

### 21.1 Antes de Criar Qualquer Campo

| Categoria | Pergunta | Verificação |
|------------|----------|-------------|
| Geral | Está neste documento? | Se não estiver → NÃO CRIAR |
|  | Segue a camada correta? | Banco = snake_case · API = camelCase |
| Identificador | Termina com `_id` / `Id`? | `user_id`, `userId` |
|  | É UUID quando apropriado? | IDs externos = UUID |
| Timestamp | Termina com `_at` / `At`? | `created_at`, `createdAt` |
|  | Usa `TIMESTAMPTZ` no banco? | Sempre com timezone |
| Monetário | Termina com `_cents` / `Cents`? | `amount_cents`, `amountCents` |
|  | É `BIGINT` no banco? | Nunca float/decimal |
|  | Testou overflow? | Máximo 92 quatrilhões de centavos |
| Percentual | Termina com `_bps` / `Bps`? | `tax_rate_bps`, `taxRateBps` |
|  | É `INTEGER` no banco? | Basis points, não float |
| Booleano | Prefixo `is_`, `has_`, `can_`, `requires_`? | `is_active`, `isActive` |
|  | É `BOOLEAN` no banco? | Não string/integer |
| Duração | Termina com `_seconds` ou `_minutes`? | `duration_seconds` |
|  | Nunca `_min`? | Ambíguo |
| Distância | Termina com `_meters`? | `distance_meters` |
|  | É inteiro? | Não float |
| Peso | Termina com `_grams`? | `weight_grams` |
| Dimensão | Termina com `_cm`? | `length_cm` |
| Volume | Termina com `_ml` ou `_liters`? | `volume_ml` |
| Score | Termina com `_score`? | `trust_score` |
|  | Escala 0–10000? | Centésimos |
| Rating | Termina com `_rating`? | `average_rating` |
|  | Escala 0–500? | Representa 0.0–5.0 |
| URL | Termina com `_url` / `Url`? | `avatar_url`, `avatarUrl` |
| Contagem | Termina com `_count` / `Count`? | `view_count` |
| Enum | Valores em inglês? | `pending`, `paid`, `cancelled` |
|  | Case correto? | snake_case ou UPPER_CASE |
| API | Endpoint kebab-case? | `/v1/bank-accounts` |
|  | Versionado? | `/v1/`, `/v2/` |
|  | Sem verbos? | Não `/getUsers` |
| Evento | Versionado? | `v1.payment.captured` |
|  | Past tense? | `captured` |
|  | Tem `correlationId`? | Rastreabilidade |
| Fila | Sufixo correto? | `.retry`, `.dlq`, `.priority` |
| Serviço | Nome reflete domínio? | `payment-gateway` |
|  | Sem "Service" no nome? | ✅ |
| Config | SCREAMING_SNAKE_CASE? | `DATABASE_HOST` |
| Migração | Timestamp correto? | `20260217103000` |
|  | Descrição clara? | `create_users_table` |
| Teste | Nome descritivo? | `should capture when authorized` |
| Commit | Tipo semântico? | `feat(payment): add PIX` |

---

### 21.2 PR Checklist — Nomenclatura

#### Banco de Dados

- [ ] Tabelas: snake_case, plural
- [ ] Colunas: snake_case, sem abreviações
- [ ] Índices: `idx_` / `uidx_` + tabela + coluna(s)
- [ ] Constraints: `pk_`, `fk_`, `chk_`
- [ ] Monetário: `_cents`, `BIGINT`
- [ ] Timestamps: `_at`, `TIMESTAMPTZ`
- [ ] Booleanos: `is_`, `has_`, `can_`, `requires_`
- [ ] IDs: `<entidade>_id`
- [ ] Enums: valores em inglês, case correto

#### API

- [ ] Campos: camelCase
- [ ] Endpoints: kebab-case, versionados
- [ ] Sufixos: `Id`, `At`, `Cents`, `Bps`, `Meters`
- [ ] Prefixos: `is`, `has`, `can`, `requires`, `min`, `max`
- [ ] Enums: mesmos valores do banco
- [ ] Envelope padrão: `{ data, meta }`

#### Eventos

- [ ] Nome: `v{major}.{domain}.{entity}.{action}`
- [ ] Past tense obrigatório
- [ ] Payload: camelCase
- [ ] `correlationId` presente

#### Infraestrutura

- [ ] Variáveis: SCREAMING_SNAKE_CASE
- [ ] Secrets: nunca em código ou logs
- [ ] Docker: kebab-case, tags semânticas
- [ ] Commits: `tipo(escopo): descrição`

#### Documentação

- [ ] Atualizou este documento?
- [ ] Atualizou CHANGELOG?

---

## 22. PADRÕES DE MERCADO REFERENCIADOS

| Fonte | Padrão Adotado | Seção |
|--------|----------------|-------|
| Stripe | Idempotency keys, status lifecycle, centavos | 4.12, 4.11, 4.7 |
| Adyen | Reference IDs, split payments | 4.12, 4.18 |
| ISO 4217 | Códigos de moeda (BRL, USD) | 4.10 |
| ISO 8601 | Timestamps e durações | 4.6, 4.19 |
| ISO 3166-1 | Códigos de país (BR, US) | 4.44 |
| IANA Time Zone | Timezones (America/Sao_Paulo) | 4.26 |
| OpenTelemetry | `trace_id`, `span_id`, `correlation_id` | 4.12, 14.1 |
| Double-Entry Accounting | debit/credit, ledger | 4.17 |
| Google Maps | Coordenadas decimais, distância em metros | 4.19, 4.20 |
| Uber / iFood / DoorDash | Status de delivery | 4.11 |
| Correios / FedEx / DHL | Tracking codes, checkpoints | 4.28 |
| WMS (Warehouse) | SKU, inventory counts | 4.23 |
| RFC 5545 (iCalendar) | RRULE para recorrência | 4.26 |
| SI Units | Gramas, metros, segundos | 4.24, 4.19 |
| E.164 | Formato de telefone (+5511...) | 4.43 |
| Conventional Commits | `tipo(escopo): descrição` | 17.2 |
| CloudEvents | `specversion`, `type`, `source`, `id` | 10.4 |
| Prometheus | `unificard_{dominio}_{metrica}_{unidade}` | 14.3 |
| RESTful API Guidelines (Zalando) | Kebab-case, versionamento | 9.1 |
| Semantic Versioning | `v{major}.{minor}.{patch}` | 10.1, 20.3 |

### 23. REGRA FINAL

### 23.1 Decisão

Se surgir dúvida sobre nomenclatura:

```plain
1. CONSULTAR ESTE DOCUMENTO
   ↓
2. ENCONTROU O PADRÃO?
   ├─ SIM → Aplicar estritamente
   └─ NÃO → Prosseguir para 3
   ↓
3. É SIMILAR A ALGO EXISTENTE?
   ├─ SIM → Adaptar seguindo a mesma lógica
   └─ NÃO → Prosseguir para 4
   ↓
4. ABRIR PROPOSTA (RFC)
   ↓
5. AGUARDAR APROVAÇÃO DO GATE
   ↓
6. SÓ ENTÃO IMPLEMENTAR
```

### 23.2 Princípio da Imutabilidade
"Um padrão publicado é um contrato social.
Quebrar um padrão é quebrar a confiança entre sistemas."
Padrões nunca são "temporários"
Padrões nunca são "só dessa vez"
Padrões nunca são "legado que vamos trocar depois"

### 23.3 Cultura
Nomenclatura é:
Responsabilidade coletiva — todos fiscalizam
Investimento preventivo — 5 min de planejamento evita 5 dias de refactor
Documentação viva — este arquivo é atualizado ou morre
Linguagem ubíqua — devs, product, design, negócio usam os mesmos termos

### 24. APÊNDICES

### 24.1 Glossário de Termos

| Termo | Definição |
|-------|-----------|
| Actor | Entidade que executa uma ação (humano, organizacional, sistema) |
| Basis Point (bps) | 1/100 de 1% = 0.01% = 0.0001 |
| CamelCase | minhaVariavel (sem espaços, próxima palavra maiúscula) |
| Dead Letter Queue (DLQ) | Fila para mensagens que falharam processamento |
| Double-Entry | Sistema contábil onde cada transação afeta duas contas |
| Escrow | Bloqueio de valor até condição ser cumprida |
| Idempotency | Propriedade de operação que pode ser repetida sem efeito colateral |
| Kebab-case | minha-variavel (hífens, usado em URLs) |
| Ledger | Registro contábil de transações |
| PascalCase | MinhaClasse (primeira letra maiúscula) |
| RRULE | Regra de recorrência no formato iCalendar (RFC 5545) |
| Shadow Mode | Executar novo código em paralelo sem afetar produção |
| SLA | Service Level Agreement — acordo de nível de serviço |
| Snake_case | minha_variavel (underscores, usado em banco) |
| Soft Delete | Marcar como deletado sem remover fisicamente |
| Split | Divisão de pagamento entre múltiplos recebedores |
| TIMESTAMPTZ | Timestamp com timezone (PostgreSQL) |

### 24.2 Tabela de Conversão Rápida: Português → Inglês

| Português (NUNCA USE) | Inglês (SEMPRE USE) |
|----------------------|---------------------|
| Código | code |
| Data (calendário) | date |
| Data/hora | at (sufixo) |
| Descrição | description |
| Endereço | address |
| Estoque | inventory, stock |
| Nome | name |
| Número | number |
| Pagamento | payment |
| Pedido | order |
| Preço/Valor | amountCents, priceCents |
| Produto | product |
| Quantidade | quantity |
| Saldo | balanceCents |
| Situação/Status | status |
| Taxa/Juros | feeCents, interestRateBps |
| Telefone | phone |
| Tipo | type |
| Usuário | user |
| Valor | amountCents, valueCents |

### 24.3 Exemplo Completo: Entidade "Pedido"

```typescript
// Banco de dados (SQL)
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(30) NOT NULL, -- 'pending', 'paid', 'shipped'
    amount_cents BIGINT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'BRL',
    shipping_address_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    
    CONSTRAINT fk_orders_user_id_users 
        FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_orders_user_id_created_at 
    ON orders(user_id, created_at);

// Backend (TypeScript)
interface Order {
  id: string;
  userId: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  amountCents: number;
  currency: 'BRL' | 'USD' | 'EUR';
  shippingAddressId: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// API REST
GET /v1/orders/{orderId}
Response: {
  "data": {
    "id": "ord_123",
    "userId": "usr_456",
    "status": "paid",
    "amountCents": 10000,
    "currency": "BRL",
    "shippingAddressId": "addr_789",
    "createdAt": "2026-02-17T14:30:00Z",
    "version": 1
  },
  "meta": {
    "requestId": "req_abc123"
  }
}

// Evento
{
  "specversion": "1.0",
  "type": "v1.order.paid",
  "source": "order-service",
  "id": "evt_def456",
  "time": "2026-02-17T14:30:00Z",
  "data": {
    "orderId": "ord_123",
    "userId": "usr_456",
    "amountCents": 10000,
    "paidAt": "2026-02-17T14:30:00Z"
  }
}

// Log
{
  "timestamp": "2026-02-17T14:30:00.000Z",
  "level": "info",
  "service": "order-service",
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Order paid successfully",
  "context": {
    "orderId": "ord_123",
    "amountCents": 10000
  }
}
```

### 24.4 Contato e Suporte

| Canal | Uso |
|-------|-----|
| #architecture-naming (Slack) | Dúvidas rápidas, discussões |
| rfc-nomenclature@unificard.com | Propostas de mudança (RFCs) |
| architect@unificard.com | Escaladas, conflitos |
| Notion → Nomenclatura Canônica | Documento oficial (source of truth) |

FIM DO DOCUMENTO
Documento consolidado em 2026-02-17
Versão 3.2 — Fonte de Verdade do Ecossistema UnifiCard (Constitucional Final)

Total de seções: 25
Cobertura: 100% (Dados, API, Eventos, Infraestrutura, Operações, Governança)

Status: CANÔNICO · VIGENTE · OBRIGATÓRIO · BLINDADO
"Nomenclatura é a interface entre humanos e máquinas.
Boa nomenclatura é código que se lê como prosa.
Má nomenclatura é dívida técnica camuflada."
— Arquitetura UnifiCard, 2026
```

---

## ✅ DOCUMENTO COMPLETO ENTREGUE

**Resumo das 5 Partes:**

| Parte | Conteúdo | Linhas (est.) |
|-------|----------|---------------|
| 1 | Início + Parte I (1-4.30) | ~500 |
| 2 | Parte I cont. (4.31-4.73) + Parte II | ~600 |
| 3 | Parte III (9-13) — Infraestrutura | ~500 |
| 4 | Parte III cont. (14-17) + Parte IV | ~550 |
| 5 | Parte V (19-24) — Governança + Final | ~450 |
| **Total** | **Documento completo v3.0** | **~2.600** |

**Novidades da v3.2 vs v3.1:**
- ✅ Seção 3.2: Amarração ao SSOT_REGISTRY (sincronização obrigatória)
- ✅ Seção 3.2: Política de Evolução do Glossário (SSOT_REGISTRY → Documento → Implementação)
- ✅ Seção 3.2: Proteção Contra Enum Paralelo (duplicidade semântica bloqueada)
- ✅ Seção 3.5: Cláusula de Invalidação Constitucional (violação = FAIL de Gates)
- ✅ Blindagem completa contra drift silencioso e violações temporárias

**Novidades da v3.1 vs v3.0:**
- ✅ Seção 3.2: Glossário de Nomes Canônicos Constitucionais (actorId, bankTransactionId, kycLevel, purpose, etc.)
- ✅ Seção 3.3: SSOT Financeiro e Autoridade (proteção contra estruturas paralelas)
- ✅ Seção 3.4: Proteção Contra Ambiguidade Semântica (status, type, state isolados)
- ✅ Seção 9.7: Versionamento de Contratos Públicos (política de breaking changes)
- ✅ Seção 19.13: Estruturas Financeiras (SSOT) - reforço de proibições

**Novidades da v3.0 vs v2.0:**
- ✅ Parte III completa (Infraestrutura e Operações)
- ✅ API REST versionada com kebab-case
- ✅ Eventos versionados (v1.domain.action)
- ✅ Mensageria com DLQ, retry, priority
- ✅ Microserviços e namespaces
- ✅ Observabilidade (logs JSON, métricas Prometheus, tracing)
- ✅ Migrações de banco padronizadas
- ✅ Testes com nomenclatura semântica
- ✅ Git workflow (branches, commits convencionais)
- ✅ Checklist ampliado com 50+ verificações
- ✅ Governança com Gate formal de 7 etapas

Monte o arquivo completo concatenando as 5 partes e terá a **Fonte de Verdade v3.2 (Constitucional Final)** do ecossistema UnifiCard! 🚀


NÃO DUPLICAR DAQUI PARA BAIXO E SE FOR INCORPORAR ADOTAR COMO PADRÃO. PRECISAMOS ORGANIZAR ESTE ARQUIVO, MANTER OS PADRÕES DOS NOMES DOS ARQUIVOS, E CAMPOS DE BACKEND, FRONTEND E BANCO DE DADOS:

🔍 ANÁLISE POR DOMÍNIO
1. SAÚDE (Healthcare) — Gaps Reais
O que já existe: health como categoria em 4.72, actor_id para pessoas (3.1)
O que falta (novos campos, seguindo padrões):
Table
Campo	Tipo	Justificativa	Padrão Aplicado
systolic_bp_mmhg	INTEGER	Pressão arterial sistólica	4.24 (unidade no nome)
diastolic_bp_mmhg	INTEGER	Pressão arterial diastólica	4.24
heart_rate_bpm	INTEGER	Frequência cardíaca	4.24
respiratory_rate_rpm	INTEGER	Frequência respiratória	4.24
blood_glucose_mg_dl	INTEGER	Glicemia	4.24
oxygen_saturation_percent	INTEGER	Saturação O2	4.24
body_mass_index	DECIMAL(5,2)	IMC	4.24
icd9_code	VARCHAR(10)	Código CID-9 (legado)	4.42 (extensão)
cpt_code	VARCHAR(5)	Código procedimento médico	4.42
loinc_code	VARCHAR(10)	Código exame laboratorial	4.42
snomed_ct_code	VARCHAR(20)	Código clínico SNOMED	4.42
atc_code	VARCHAR(7)	Código medicamento WHO	4.42
ndc_code	VARCHAR(11)	National Drug Code	4.42
prescription_id	UUID	ID da prescrição médica	4.4 (padrão ID)
prescription_status	VARCHAR(20)	Status da prescrição	4.11
refills_allowed	INTEGER	Quantidade de renovações permitidas	4.48 (limits)
refills_remaining	INTEGER	Quantidade de renovações restantes	4.48
dispensed_at	TIMESTAMPTZ	Data da dispensação	4.6
appointment_id	UUID	ID do agendamento médico	4.4
appointment_type	VARCHAR(30)	Tipo de consulta	4.11
appointment_status	VARCHAR(20)	Status do agendamento	4.11
checked_in_at	TIMESTAMPTZ	Data do check-in	4.6
no_show_at	TIMESTAMPTZ	Data de não comparecimento	4.6
encounter_id	UUID	ID do atendimento (visita)	4.4
encounter_type	VARCHAR(30)	Tipo de atendimento	4.11
encounter_status	VARCHAR(20)	Status do atendimento	4.11
episode_of_care_id	UUID	ID do episódio de cuidado	4.4
care_plan_id	UUID	ID do plano de cuidados	4.4
procedure_id	UUID	ID do procedimento realizado	4.4
diagnostic_report_id	UUID	ID do laudo diagnóstico	4.4
observation_id	UUID	ID da observação clínica	4.4
allergy_intolerance_id	UUID	ID da alergia/intolerância	4.4
immunization_id	UUID	ID da imunização/vacina	4.4
medication_statement_id	UUID	ID da declaração de medicamento	4.4
medication_request_id	UUID	ID da requisição de medicamento	4.4
medication_administration_id	UUID	ID da administração de medicamento	4.4
document_reference_id	UUID	ID da referência de documento	4.4
consent_id	UUID	ID do consentimento do paciente	4.4
consent_status	VARCHAR(20)	Status do consentimento	4.11
Valores de enum novos:
sql
Copy
-- appointment_type (4.11)
'consultation', 'follow_up', 'emergency', 'routine_exam', 'procedure', 'telemedicine'

-- appointment_status (4.11)
'scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'

-- encounter_type (4.11)
'ambulatory', 'emergency', 'home_health', 'virtual', 'field'

-- encounter_status (4.11)
'planned', 'arrived', 'triaged', 'in_progress', 'onleave', 'finished', 'cancelled'

-- prescription_status (4.11)
'draft', 'active', 'on_hold', 'revoked', 'completed', 'stopped'

-- consent_status (4.11)
'draft', 'proposed', 'active', 'rejected', 'inactive', 'entered_in_error'
2. FARMÁCIA (Pharmacy) — Gaps Reais
Table
Campo	Tipo	Justificativa	Padrão Aplicado
drug_code	VARCHAR(20)	Código único do medicamento	4.42
active_ingredient	VARCHAR(255)	Princípio ativo	4.3
concentration_value	DECIMAL(10,4)	Valor da concentração	4.24
concentration_unit	VARCHAR(10)	Unidade: 'mg', 'g', 'ml', 'ui'	4.24
pharmaceutical_form	VARCHAR(50)	Forma: 'tablet', 'capsule', 'syrup'	4.11
dosage_instructions	TEXT	Posologia	4.3
route_of_administration	VARCHAR(50)	Via: 'oral', 'intravenous', 'topical'	4.11
controlled_substance_schedule	VARCHAR(10)	Escalonamento: 'CII', 'CIII', 'CIV', 'CV'	4.11
is_generic	BOOLEAN	É medicamento genérico	4.9
is_reference_drug	BOOLEAN	É medicamento de referência	4.9
is_similar	BOOLEAN	É similar	4.9
is_interchangeable	BOOLEAN	É intercambiável	4.9
therapeutic_class	VARCHAR(100)	Classe terapêutica	4.11
storage_condition	VARCHAR(30)	Condição: 'room_temp', 'refrigerated', 'frozen'	4.11
max_storage_temp_celsius	DECIMAL(5,2)	Temperatura máxima armazenamento	4.24
min_storage_temp_celsius	DECIMAL(5,2)	Temperatura mínima armazenamento	4.24
shelf_life_days	INTEGER	Validade em dias	4.48
batch_lot_number	VARCHAR(50)	Número do lote	4.23 (estende)
batch_expires_at	TIMESTAMPTZ	Validade do lote	4.6
inventory_location_id	UUID	ID da localização no estoque	4.16
bin_location	VARCHAR(20)	Localização física: 'A-12-3'	4.23
reorder_point_quantity	INTEGER	Ponto de pedido	4.23
economic_order_quantity	INTEGER	Quantidade econômica de pedido	4.23
abc_classification	VARCHAR(1)	Classificação ABC: 'A', 'B', 'C'	4.11
turnover_rate	DECIMAL(5,2)	Taxa de giro	4.49 (métricas)
days_on_hand	INTEGER	Dias de cobertura	4.49
3. CARTÃO (Card Issuing) — Gaps Críticos
Nova seção obrigatória — não existe no documento:
Table
Campo	Tipo	Justificativa	Padrão Aplicado
card_id	UUID	ID do cartão	4.4
card_number_token	VARCHAR(255)	Token do PAN (nunca plain)	4.74 (segurança)
card_number_last_four	VARCHAR(4)	Últimos 4 dígitos	4.74
card_number_first_six	VARCHAR(6)	Primeiros 6 dígitos (BIN)	4.74
card_number_hash	VARCHAR(255)	Hash do número do cartão	4.74
card_type	VARCHAR(20)	Tipo: 'physical', 'virtual', 'single_use'	4.11
card_brand	VARCHAR(20)	Bandeira: 'visa', 'mastercard', 'amex', 'elo'	4.11
card_product	VARCHAR(20)	Produto: 'credit', 'debit', 'prepaid', 'fleet'	4.11
card_status	VARCHAR(20)	Status: 'active', 'blocked', 'expired', 'cancelled'	4.11
embossed_name	VARCHAR(26)	Nome impresso no cartão	4.3
expiry_month	INTEGER	Mês de validade (1-12)	4.6 (variante)
expiry_year	INTEGER	Ano de validade (YYYY)	4.6 (variante)
cvv_token	VARCHAR(255)	Token do CVV	4.74
pin_hash	VARCHAR(255)	Hash do PIN	4.74
pin_attempts_remaining	INTEGER	Tentativas de PIN restantes	4.48
is_pin_set	BOOLEAN	PIN já configurado	4.9
is_contactless_enabled	BOOLEAN	Contactless habilitado	4.9
is_online_purchase_enabled	BOOLEAN	Compras online habilitadas	4.9
is_international_enabled	BOOLEAN	Uso internacional habilitado	4.9
is_atm_withdrawal_enabled	BOOLEAN	Saque ATM habilitado	4.9
card_limit_cents	BIGINT	Limite total do cartão	4.7
daily_purchase_limit_cents	BIGINT	Limite diário de compras	4.7
daily_atm_limit_cents	BIGINT	Limite diário de saques	4.7
per_transaction_limit_cents	BIGINT	Limite por transação	4.7
card_issued_at	TIMESTAMPTZ	Data de emissão	4.6
card_activated_at	TIMESTAMPTZ	Data de ativação	4.6
card_expires_at	TIMESTAMPTZ	Data de expiração	4.6
card_reissued_at	TIMESTAMPTZ	Data de reemissão	4.6
previous_card_id	UUID	ID do cartão anterior (reemissão)	4.4
replacement_reason	VARCHAR(30)	Motivo: 'expired', 'lost', 'stolen', 'damaged'	4.11
Transações de cartão:
Table
Campo	Tipo	Justificativa	Padrão Aplicado
authorization_id	UUID	ID da autorização	4.4
authorization_code	VARCHAR(6)	Código de autorização (auth code)	4.12
authorization_type	VARCHAR(20)	Tipo: 'pre_auth', 'final_auth', 'incremental'	4.11
capture_mode	VARCHAR(20)	Modo: 'automatic', 'manual'	4.11
mcc_code	VARCHAR(4)	Merchant Category Code	4.42
merchant_id	UUID	ID do estabelecimento	4.16
merchant_name	VARCHAR(100)	Nome do estabelecimento	4.3
merchant_city	VARCHAR(100)	Cidade do estabelecimento	4.20
merchant_country_code	CHAR(2)	País do estabelecimento	4.46
acquirer_reference_number	VARCHAR(23)	ARN (chargeback)	4.12
retrieval_reference_number	VARCHAR(12)	RRN	4.12
transaction_local_at	TIMESTAMPTZ	Hora local da transação	4.6
transaction_local_timezone	VARCHAR(50)	Timezone local	4.26
original_transaction_id	UUID	ID transação original (estorno)	4.4
is_recurring	BOOLEAN	É transação recorrente	4.9
is_installment	BOOLEAN	É parcelado	4.9
installment_number	INTEGER	Número da parcela	4.48
total_installments	INTEGER	Total de parcelas	4.48
is_3ds_authenticated	BOOLEAN	Autenticado 3D Secure	4.9
three_ds_version	VARCHAR(5)	Versão 3DS: '1.0', '2.1', '2.2'	4.11
three_ds_authentication_status	VARCHAR(20)	Status: 'authenticated', 'attempted', 'failed'	4.11
eci_indicator	VARCHAR(2)	Electronic Commerce Indicator	4.11
is_fraud_suspected	BOOLEAN	Suspeita de fraude	4.9
fraud_score	INTEGER	Score de fraude (0-10000)	4.33
fraud_rule_triggered	VARCHAR(50)	Regra de fraude disparada	4.11
chargeback_id	UUID	ID do chargeback	4.4
chargeback_reason_code	VARCHAR(4)	Código motivo chargeback	4.11
chargeback_amount_cents	BIGINT	Valor do chargeback	4.7
chargeback_filed_at	TIMESTAMPTZ	Data do chargeback	4.6
representment_status	VARCHAR(20)	Status da representação	4.11
representment_amount_cents	BIGINT	Valor da representação	4.7
4. ERP FINANCEIRO (AP/AR/Tesouraria) — Extensão de 4.17
Table
Campo	Tipo	Justificativa	Padrão Aplicado
chart_of_accounts_id	UUID	ID do plano de contas	4.4
account_code	VARCHAR(20)	Código da conta contábil	4.42
account_type	VARCHAR(20)	Tipo: 'asset', 'liability', 'equity', 'revenue', 'expense'	4.11
account_subtype	VARCHAR(30)	Subtipo: 'current_asset', 'fixed_asset'	4.11
fiscal_year	INTEGER	Ano fiscal	4.48
accounting_period_id	UUID	ID do período contábil	4.4
period_start_at	TIMESTAMPTZ	Início do período	4.6
period_end_at	TIMESTAMPTZ	Fim do período	4.6
period_status	VARCHAR(20)	Status: 'open', 'closed', 'locked'	4.11
is_period_closed	BOOLEAN	Período fechado	4.9
is_period_adjusted	BOOLEAN	Ajustado	4.9
journal_entry_id	UUID	ID do lançamento contábil	4.4
journal_entry_line_id	UUID	ID da linha do lançamento	4.4
journal_entry_type	VARCHAR(20)	Tipo: 'regular', 'adjusting', 'closing', 'reversing'	4.11
debit_account_id	UUID	Conta débito	4.4
credit_account_id	UUID	Conta crédito	4.4
debit_cents	BIGINT	Valor débito	4.7, 4.17
credit_cents	BIGINT	Valor crédito	4.7, 4.17
is_balanced	BOOLEAN	Lançamento balanceado	4.9
posting_at	TIMESTAMPTZ	Data de postagem	4.6
accounting_date	DATE	Data contábil	4.17
ap_invoice_id	UUID	ID fatura fornecedor	4.4
ap_invoice_line_id	UUID	ID linha fatura fornecedor	4.4
ar_invoice_id	UUID	ID fatura cliente	4.4
ar_invoice_line_id	UUID	ID linha fatura cliente	4.4
vendor_id	UUID	ID fornecedor (actor_organizational)	4.16
customer_id	UUID	ID cliente (actor_organizational)	4.16
invoice_number	VARCHAR(50)	Número da fatura	4.3
invoice_due_at	TIMESTAMPTZ	Data de vencimento	4.6
invoice_paid_at	TIMESTAMPTZ	Data de pagamento	4.6
is_overdue	BOOLEAN	Está vencido	4.9
overdue_at	TIMESTAMPTZ	Data que venceu	4.6
days_overdue	INTEGER	Dias de atraso	4.48
early_payment_discount_at	TIMESTAMPTZ	Data limite desconto	4.6
early_payment_discount_bps	INTEGER	Desconto antecipado	4.8
credit_limit_cents	BIGINT	Limite de crédito	4.7
is_credit_hold	BOOLEAN	Bloqueio de crédito ativo	4.9
credit_hold_reason	VARCHAR(50)	Motivo do bloqueio	4.11
dunning_level	INTEGER	Nível de cobrança (1-5)	4.48
last_dunning_at	TIMESTAMPTZ	Última cobrança	4.6
bad_debt_reserve_cents	BIGINT	Provisão devedores duvidosos	4.7
bank_statement_id	UUID	ID extrato bancário	4.4
bank_statement_line_id	UUID	ID linha do extrato	4.4
is_reconciled	BOOLEAN	Reconciliado	4.9
reconciled_at	TIMESTAMPTZ	Data reconciliação	4.6
unreconciled_cents	BIGINT	Valor não reconciliado	4.7
transfer_id	UUID	ID transferência entre contas	4.4
treasury_transaction_type	VARCHAR(20)	Tipo: 'inflow', 'outflow', 'transfer'	4.11
fixed_asset_id	UUID	ID ativo fixo	4.4
asset_tag	VARCHAR(50)	Etiqueta do ativo	4.3
asset_category	VARCHAR(30)	Categoria: 'vehicle', 'equipment'	4.11
acquisition_cents	BIGINT	Custo de aquisição	4.7
accumulated_depreciation_cents	BIGINT	Depreciação acumulada	4.7
net_book_value_cents	BIGINT	Valor contábil líquido	4.7
depreciation_method	VARCHAR(20)	Método: 'straight_line', 'declining'	4.11
useful_life_months	INTEGER	Vida útil em meses	4.48
salvage_value_cents	BIGINT	Valor residual	4.7
disposed_at	TIMESTAMPTZ	Data de baixa	4.6
disposal_proceeds_cents	BIGINT	Valor de venda na baixa	4.7
5. CRM — Gaps Reais
Table
Campo	Tipo	Justificativa	Padrão Aplicado
lead_id	UUID	ID do lead (potencial)	4.4
opportunity_id	UUID	ID da oportunidade de venda	4.4
campaign_id	UUID	ID da campanha de marketing	4.4
touchpoint_id	UUID	ID do ponto de contato	4.4
interaction_id	UUID	ID da interação	4.4
lead_source	VARCHAR(50)	Origem do lead	4.40
lead_status	VARCHAR(20)	Status: 'new', 'contacted', 'qualified', 'converted', 'lost'	4.11
lead_score	INTEGER	Pontuação do lead (0-10000)	4.33
conversion_probability_bps	INTEGER	Probabilidade conversão	4.8
estimated_value_cents	BIGINT	Valor estimado oportunidade	4.7
expected_close_at	TIMESTAMPTZ	Data prevista fechamento	4.6
actual_close_at	TIMESTAMPTZ	Data real fechamento	4.6
sales_stage	VARCHAR(30)	Etapa funil: 'prospecting', 'proposal', 'negotiation'	4.11
is_won	BOOLEAN	Oportunidade ganha	4.9
is_lost	BOOLEAN	Oportunidade perdida	4.9
lost_reason	VARCHAR(50)	Motivo da perda	4.11
sales_cycle_days	INTEGER	Dias do ciclo de vendas	4.48
churn_risk_score	INTEGER	Score de risco de churn (0-10000)	4.33
nps_score	INTEGER	Net Promoter Score (-100 a 100)	4.33 (escala diferente)
csat_score	INTEGER	Customer Satisfaction (0-500)	4.33
customer_lifetime_value_cents	BIGINT	LTV do cliente	4.7
customer_acquisition_cost_cents	BIGINT	CAC	4.7
last_contact_at	TIMESTAMPTZ	Último contato	4.6
next_follow_up_at	TIMESTAMPTZ	Próximo acompanhamento	4.6
preferred_contact_channel	VARCHAR(20)	Canal preferido	4.36
is_do_not_contact	BOOLEAN	Não contatar	4.9
marketing_consent_given	BOOLEAN	Consentimento marketing	4.9
marketing_consent_given_at	TIMESTAMPTZ	Data consentimento	4.6
marketing_consent_withdrawn_at	TIMESTAMPTZ	Data revogação	4.6
6. SEGUROS (Insurance) — Gaps Reais
Table
Campo	Tipo	Justificativa	Padrão Aplicado
policy_id	UUID	ID da apólice	4.4
policy_number	VARCHAR(50)	Número da apólice	4.3
policy_type	VARCHAR(20)	Tipo: 'health', 'life', 'auto', 'home'	4.11
policy_status	VARCHAR(20)	Status: 'active', 'suspended', 'expired', 'cancelled'	4.11
premium_cents	BIGINT	Valor do prêmio	4.7
premium_frequency	VARCHAR(20)	Frequência: 'monthly', 'quarterly', 'yearly'	4.11
coverage_amount_cents	BIGINT	Valor da cobertura	4.7
deductible_cents	BIGINT	Franquia	4.7
copay_cents	BIGINT	Copagamento	4.7
coinsurance_bps	INTEGER	Co-seguro percentual	4.8
effective_from_at	TIMESTAMPTZ	Início vigência	4.6
effective_until_at	TIMESTAMPTZ	Fim vigência	4.6
grace_period_days	INTEGER	Período de carência pagamento	4.48
waiting_period_days	INTEGER	Período de carência para sinistros	4.48
beneficiary_id	UUID	ID do beneficiário	4.4
insured_value_cents	BIGINT	Valor segurado	4.7
claim_id	UUID	ID do sinistro	4.4
claim_number	VARCHAR(50)	Número do sinistro	4.3
claim_type	VARCHAR(30)	Tipo: 'medical', 'death', 'disability', 'property'	4.11
claim_status	VARCHAR(20)	Status: 'opened', 'under_review', 'approved', 'paid', 'rejected'	4.11
claim_filed_at	TIMESTAMPTZ	Data do sinistro	4.6
claim_reported_at	TIMESTAMPTZ	Data do aviso	4.6
claim_amount_cents	BIGINT	Valor solicitado	4.7
claim_approved_amount_cents	BIGINT	Valor aprovado	4.7
claim_paid_amount_cents	BIGINT	Valor pago	4.7
claim_paid_at	TIMESTAMPTZ	Data pagamento	4.6
claim_denied_reason	VARCHAR(100)	Motivo da negativa	4.11
exclusion_codes	TEXT[]	Códigos de exclusão	4.52
endorsement_id	UUID	ID do endosso	4.4
endorsement_type	VARCHAR(30)	Tipo de endosso	4.11
endorsement_effective_at	TIMESTAMPTZ	Data efetiva do endosso	4.6
7. MANUFATURA E PRODUÇÃO — Gaps Reais
Table
Campo	Tipo	Justificativa	Padrão Aplicado
bom_id	UUID	ID da lista de materiais	4.4
bom_version	INTEGER	Versão da BOM	4.15
bom_line_id	UUID	ID linha da BOM	4.4
parent_sku	VARCHAR(100)	SKU produto pai	4.23
component_sku	VARCHAR(100)	SKU componente	4.23
component_quantity	DECIMAL(10,4)	Quantidade necessária	4.23
component_unit	VARCHAR(10)	Unidade de medida	4.24
is_optional_component	BOOLEAN	Componente opcional	4.9
yield_bps	INTEGER	Rendimento percentual	4.8
work_order_id	UUID	ID ordem de produção	4.4
production_batch_id	UUID	ID lote de produção	4.4
routing_id	UUID	ID rota de produção	4.4
operation_sequence	INTEGER	Sequência da operação	4.48
work_center_id	UUID	ID centro de trabalho	4.16
setup_time_minutes	INTEGER	Tempo de preparação	4.21
run_time_minutes	INTEGER	Tempo de execução	4.21
teardown_time_minutes	INTEGER	Tempo de desmontagem	4.21
actual_start_at	TIMESTAMPTZ	Início real	4.6
actual_end_at	TIMESTAMPTZ	Término real	4.6
quantity_produced	DECIMAL(10,4)	Quantidade produzida	4.23
quantity_rejected	DECIMAL(10,4)	Quantidade rejeitada	4.23
rejection_reason_code	VARCHAR(20)	Motivo rejeição	4.11
scrap_bps	INTEGER	Percentual de sucata	4.8
quality_control_id	UUID	ID controle de qualidade	4.4
inspection_type	VARCHAR(20)	Tipo inspeção	4.11
inspection_result	VARCHAR(20)	Resultado: 'passed', 'failed', 'conditional'	4.11
non_conformance_id	UUID	ID não-conformidade	4.4
corrective_action_id	UUID	ID ação corretiva	4.4
preventive_action_id	UUID	ID ação preventiva	4.4
8. EDUCAÇÃO E TREINAMENTO (LMS) — Gaps Reais
Table
Campo	Tipo	Justificativa	Padrão Aplicado
course_id	UUID	ID do curso	4.4
course_code	VARCHAR(20)	Código do curso	4.42
course_version	INTEGER	Versão do curso	4.15
module_id	UUID	ID do módulo	4.4
module_sequence	INTEGER	Sequência do módulo	4.48
lesson_id	UUID	ID da aula	4.4
lesson_sequence	INTEGER	Sequência da aula	4.48
content_id	UUID	ID do conteúdo	4.4
content_type	VARCHAR(20)	Tipo: 'video', 'text', 'quiz', 'assignment'	4.52
enrollment_id	UUID	ID da matrícula	4.4
enrollment_status	VARCHAR(20)	Status: 'enrolled', 'in_progress', 'completed', 'dropped'	4.11
progress_percent_bps	INTEGER	Progresso percentual	4.8
started_at	TIMESTAMPTZ	Data de início	4.6
completed_at	TIMESTAMPTZ	Data de conclusão	4.6
certificate_id	UUID	ID do certificado	4.4
certificate_issued_at	TIMESTAMPTZ	Data de emissão	4.6
certificate_expires_at	TIMESTAMPTZ	Data de expiração	4.6
assessment_id	UUID	ID da avaliação	4.4
assessment_type	VARCHAR(20)	Tipo: 'quiz', 'exam', 'project'	4.11
question_id	UUID	ID da questão	4.4
answer_id	UUID	ID da resposta	4.4
score_achieved	INTEGER	Pontuação obtida	4.33
passing_score	INTEGER	Pontuação mínima aprovação	4.33
is_passed	BOOLEAN	Aprovado	4.9
attempt_number	INTEGER	Número da tentativa	4.48
max_attempts_allowed	INTEGER	Máximo de tentativas	4.48
time_spent_seconds	INTEGER	Tempo gasto	4.21
instructor_id	UUID	ID do instrutor (actor_id)	4.4
cohort_id	UUID	ID da turma/cohort	4.4
cohort_starts_at	TIMESTAMPTZ	Início da turma	4.6
cohort_ends_at	TIMESTAMPTZ	Fim da turma	4.6
9. COMPLIANCE E GOVERNANÇA AVANÇADA — Gaps Reais
Table
Campo	Tipo	Justificativa	Padrão Aplicado
data_subject_id	UUID	ID do titular dos dados (LGPD/GDPR)	4.4
consent_id	UUID	ID do consentimento	4.4
consent_type	VARCHAR(30)	Tipo: 'marketing', 'data_processing', 'health_data'	4.11
consent_granted_at	TIMESTAMPTZ	Data do consentimento	4.6
consent_withdrawn_at	TIMESTAMPTZ	Data da revogação	4.6
consent_expires_at	TIMESTAMPTZ	Data de expiração	4.6
processing_purpose	VARCHAR(100)	Finalidade do processamento	4.3
legal_basis	VARCHAR(30)	Base legal: 'consent', 'contract', 'legal_obligation'	4.75
data_classification	VARCHAR(20)	Classificação: 'public', 'internal', 'confidential', 'restricted'	4.75
dpi_assessment_id	UUID	ID avaliação de impacto à privacidade	4.4
breach_notification_id	UUID	ID notificação de vazamento	4.4
breach_detected_at	TIMESTAMPTZ	Detecção do vazamento	4.6
breach_contained_at	TIMESTAMPTZ	Contenção do vazamento	4.6
breach_reported_at	TIMESTAMPTZ	Notificação às autoridades	4.6
affected_data_subjects_count	INTEGER	Quantidade de titulares afetados	4.49
affected_records_count	INTEGER	Quantidade de registros afetados	4.49
sox_control_id	UUID	ID controle SOX	4.4
control_test_id	UUID	ID teste do controle	4.4
control_test_result	VARCHAR(20)	Resultado: 'passed', 'failed', 'exception'	4.11
deficiency_id	UUID	ID da deficiência	4.4
is_material_weakness	BOOLEAN	É fraqueza material	4.9
remediation_plan_id	UUID	ID plano de remediação	4.4
remediation_deadline_at	TIMESTAMPTZ	Prazo remediação	4.6
remediation_completed_at	TIMESTAMPTZ	Conclusão remediação	4.6
is_audit_committee_notified	BOOLEAN	Comitê notificado	4.9
external_auditor_id	UUID	ID auditor externo	4.4
audit_opinion	VARCHAR(20)	Parecer: 'unqualified', 'qualified', 'adverse', 'disclaimer'	4.11
10. MARKETPLACE AVANÇADO — Extensão do Existente
Table
Campo	Tipo	Justificativa	Padrão Aplicado
product_variant_id	UUID	ID da variante (tamanho, cor)	4.4
parent_product_id	UUID	ID do produto pai	4.4
attribute_name	VARCHAR(50)	Nome do atributo	4.3
attribute_value	VARCHAR(255)	Valor do atributo	4.3
attribute_type	VARCHAR(20)	Tipo: 'color', 'size', 'material'	4.11
is_configurable	BOOLEAN	Produto configurável	4.9
bundle_id	UUID	ID do kit/bundle	4.4
bundle_component_sku	VARCHAR(100)	SKU componente	4.23
component_quantity	INTEGER	Quantidade no kit	4.23
supplier_sku	VARCHAR(100)	SKU do fornecedor	4.23
supplier_price_cents	BIGINT	Preço de custo	4.7
msrp_cents	BIGINT	Preço sugerido fabricante	4.7
map_cents	BIGINT	Minimum Advertised Price	4.7
compare_at_price_cents	BIGINT	Preço "de" (desconto)	4.7
cost_method	VARCHAR(20)	Método custo: 'fifo', 'lifo', 'average'	4.11
landed_cost_cents	BIGINT	Custo final (CIF)	4.7
seller_tier	VARCHAR(20)	Tier do vendedor	4.11
commission_tier_id	UUID	ID faixa de comissão	4.4
seller_response_time_minutes	INTEGER	Tempo médio resposta	4.21
seller_cancel_rate_bps	INTEGER	Taxa cancelamento	4.8
seller_on_time_rate_bps	INTEGER	Taxa entrega no prazo	4.8
is_top_rated_seller	BOOLEAN	Vendedor top rated	4.9
is_verified_seller	BOOLEAN	Vendedor verificado	4.9
marketplace_fulfillment_id	UUID	ID fulfillment marketplace	4.4
storage_fee_cents	BIGINT	Taxa de armazenagem	4.7
pick_pack_fee_cents	BIGINT	Taxa separação/embalagem	4.7
return_processing_fee_cents	BIGINT	Taxa processamento devolução	4.7
inventory_turnover_bps	INTEGER	Giro de estoque	4.8
days_of_inventory	INTEGER	Dias de cobertura	4.49
📋 RESUMO EXECUTIVO
Table
Domínio	Campos Novos	Seções Sugeridas	Prioridade
Healthcare	35 campos	4.76-4.78	🔴 Alta (regulado)
Pharmacy	25 campos	4.79-4.81	🔴 Alta (regulado)
Card Issuing	50 campos	4.82-4.85	🔴 Alta (regulado)
ERP AP/AR/Treasury	60 campos	4.86-4.90	🟡 Média
CRM	30 campos	4.91-4.93	🟡 Média
Insurance	35 campos	4.94-4.96	🟡 Média
Manufacturing	30 campos	4.97-4.99	🟢 Baixa
LMS/Education	35 campos	4.100-4.102	🟢 Baixa
Advanced Compliance	30 campos	4.103-4.105	🔴 Alta (regulado)
Marketplace Advanced	30 campos	4.106-4.108	🟡 Média
Total: ~360 novos campos canônicos
Todos seguem rigorosamente:
✅ Hierarquia de atores (3.1): actor_id como raiz
✅ Nomes canônicos constitucionais (3.2)
✅ Timestamps com _at (4.6)
✅ Monetários com _cents e BIGINT (4.7)
✅ Percentuais com _bps (4.8)
✅ Booleanos com is_, has_, can_ (4.9)
✅ Enums em inglês, lowercase snake_case (19.8)
✅ Unidades explícitas (4.24)
✅ IDs com sufixo _id (4.4)

🔴 GAPS REAIS - O QUE DEVE SER INCLUÍDO
1. CARTÃO (Card Issuing) — AUSENTE COMPLETAMENTE
Table
Campo	Tipo	Padrão Aplicado
card_id	UUID	4.4
card_number_token	VARCHAR(255)	4.74
card_number_last_four	VARCHAR(4)	4.74
card_number_first_six	VARCHAR(6)	4.74
card_type	VARCHAR(20)	4.11
card_brand	VARCHAR(20)	4.11
card_product	VARCHAR(20)	4.11
card_status	VARCHAR(20)	4.11
embossed_name	VARCHAR(26)	4.3
expiry_month	INTEGER	4.6
expiry_year	INTEGER	4.6
cvv_token	VARCHAR(255)	4.74
pin_hash	VARCHAR(255)	4.74
pin_attempts_remaining	INTEGER	4.48
is_pin_set	BOOLEAN	4.9
is_contactless_enabled	BOOLEAN	4.9
is_online_purchase_enabled	BOOLEAN	4.9
is_international_enabled	BOOLEAN	4.9
is_atm_withdrawal_enabled	BOOLEAN	4.9
card_limit_cents	BIGINT	4.7
daily_purchase_limit_cents	BIGINT	4.7
daily_atm_limit_cents	BIGINT	4.7
per_transaction_limit_cents	BIGINT	4.7
card_issued_at	TIMESTAMPTZ	4.6
card_activated_at	TIMESTAMPTZ	4.6
card_expires_at	TIMESTAMPTZ	4.6
card_reissued_at	TIMESTAMPTZ	4.6
previous_card_id	UUID	4.4
replacement_reason	VARCHAR(30)	4.11
authorization_id	UUID	4.4
authorization_code	VARCHAR(6)	4.12
authorization_type	VARCHAR(20)	4.11
capture_mode	VARCHAR(20)	4.11
mcc_code	VARCHAR(4)	4.42
acquirer_reference_number	VARCHAR(23)	4.12
retrieval_reference_number	VARCHAR(12)	4.12
transaction_local_at	TIMESTAMPTZ	4.6
transaction_local_timezone	VARCHAR(50)	4.26
is_recurring	BOOLEAN	4.9
is_installment	BOOLEAN	4.9
installment_number	INTEGER	4.48
total_installments	INTEGER	4.48
is_3ds_authenticated	BOOLEAN	4.9
three_ds_version	VARCHAR(5)	4.11
three_ds_authentication_status	VARCHAR(20)	4.11
eci_indicator	VARCHAR(2)	4.11
is_fraud_suspected	BOOLEAN	4.9
fraud_score	INTEGER	4.33
fraud_rule_triggered	VARCHAR(50)	4.11
chargeback_id	UUID	4.4
chargeback_reason_code	VARCHAR(4)	4.11
chargeback_amount_cents	BIGINT	4.7
chargeback_filed_at	TIMESTAMPTZ	4.6
representment_status	VARCHAR(20)	4.11
representment_amount_cents	BIGINT	4.7
Enums novos:
sql
Copy
-- card_type
'physical', 'virtual', 'single_use'

-- card_brand
'visa', 'mastercard', 'amex', 'elo', 'hiper', 'diners'

-- card_product
'credit', 'debit', 'prepaid', 'fleet', 'corporate'

-- card_status
'active', 'blocked', 'expired', 'cancelled', 'suspended'

-- authorization_type
'pre_auth', 'final_auth', 'incremental_auth', 'reversal'

-- capture_mode
'automatic', 'manual'

-- three_ds_authentication_status
'authenticated', 'attempted', 'failed', 'not_enrolled'

-- replacement_reason
'expired', 'lost', 'stolen', 'damaged', 'fraud', 'upgrade'

-- representment_status
'pending', 'submitted', 'won', 'lost'
2. SAÚDE (Healthcare) — AUSENTE (só existe 4.72 básico)
Table
Campo	Tipo	Padrão Aplicado
systolic_bp_mmhg	INTEGER	4.24
diastolic_bp_mmhg	INTEGER	4.24
heart_rate_bpm	INTEGER	4.24
respiratory_rate_rpm	INTEGER	4.24
blood_glucose_mg_dl	INTEGER	4.24
oxygen_saturation_percent	INTEGER	4.24
body_mass_index	DECIMAL(5,2)	4.24
icd9_code	VARCHAR(10)	4.42
cpt_code	VARCHAR(5)	4.42
loinc_code	VARCHAR(10)	4.42
snomed_ct_code	VARCHAR(20)	4.42
atc_code	VARCHAR(7)	4.42
ndc_code	VARCHAR(11)	4.42
prescription_id	UUID	4.4
prescription_status	VARCHAR(20)	4.11
refills_allowed	INTEGER	4.48
refills_remaining	INTEGER	4.48
dispensed_at	TIMESTAMPTZ	4.6
appointment_id	UUID	4.4
appointment_type	VARCHAR(30)	4.11
appointment_status	VARCHAR(20)	4.11
checked_in_at	TIMESTAMPTZ	4.6
no_show_at	TIMESTAMPTZ	4.6
encounter_id	UUID	4.4
encounter_type	VARCHAR(30)	4.11
encounter_status	VARCHAR(20)	4.11
episode_of_care_id	UUID	4.4
care_plan_id	UUID	4.4
procedure_id	UUID	4.4
diagnostic_report_id	UUID	4.4
observation_id	UUID	4.4
allergy_intolerance_id	UUID	4.4
immunization_id	UUID	4.4
medication_statement_id	UUID	4.4
medication_request_id	UUID	4.4
medication_administration_id	UUID	4.4
document_reference_id	UUID	4.4
consent_id	UUID	4.4
consent_status	VARCHAR(20)	4.11
Enums novos:
sql
Copy
-- appointment_type
'consultation', 'follow_up', 'emergency', 'routine_exam', 'procedure', 'telemedicine'

-- appointment_status
'scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'

-- encounter_type
'ambulatory', 'emergency', 'home_health', 'virtual', 'field'

-- encounter_status
'planned', 'arrived', 'triaged', 'in_progress', 'onleave', 'finished', 'cancelled'

-- prescription_status
'draft', 'active', 'on_hold', 'revoked', 'completed', 'stopped'

-- consent_status
'draft', 'proposed', 'active', 'rejected', 'inactive', 'entered_in_error'
3. ERP FINANCEIRO — AUSENTE (só existe 4.17 Ledger básico)
Table
Campo	Tipo	Padrão Aplicado
chart_of_accounts_id	UUID	4.4
account_code	VARCHAR(20)	4.42
account_type	VARCHAR(20)	4.11
account_subtype	VARCHAR(30)	4.11
fiscal_year	INTEGER	4.48
accounting_period_id	UUID	4.4
period_start_at	TIMESTAMPTZ	4.6
period_end_at	TIMESTAMPTZ	4.6
period_status	VARCHAR(20)	4.11
is_period_closed	BOOLEAN	4.9
is_period_adjusted	BOOLEAN	4.9
journal_entry_id	UUID	4.4
journal_entry_line_id	UUID	4.4
journal_entry_type	VARCHAR(20)	4.11
debit_account_id	UUID	4.4
credit_account_id	UUID	4.4
is_balanced	BOOLEAN	4.9
posting_at	TIMESTAMPTZ	4.6
accounting_date	DATE	4.17
ap_invoice_id	UUID	4.4
ap_invoice_line_id	UUID	4.4
ar_invoice_id	UUID	4.4
ar_invoice_line_id	UUID	4.4
vendor_id	UUID	4.16
invoice_number	VARCHAR(50)	4.3
invoice_due_at	TIMESTAMPTZ	4.6
is_overdue	BOOLEAN	4.9
overdue_at	TIMESTAMPTZ	4.6
days_overdue	INTEGER	4.48
early_payment_discount_at	TIMESTAMPTZ	4.6
early_payment_discount_bps	INTEGER	4.8
credit_limit_cents	BIGINT	4.7
is_credit_hold	BOOLEAN	4.9
credit_hold_reason	VARCHAR(50)	4.11
dunning_level	INTEGER	4.48
last_dunning_at	TIMESTAMPTZ	4.6
bad_debt_reserve_cents	BIGINT	4.7
bank_statement_id	UUID	4.4
bank_statement_line_id	UUID	4.4
is_reconciled	BOOLEAN	4.9
reconciled_at	TIMESTAMPTZ	4.6
unreconciled_cents	BIGINT	4.7
transfer_id	UUID	4.4
treasury_transaction_type	VARCHAR(20)	4.11
fixed_asset_id	UUID	4.4
asset_tag	VARCHAR(50)	4.3
asset_category	VARCHAR(30)	4.11
acquisition_cents	BIGINT	4.7
accumulated_depreciation_cents	BIGINT	4.7
net_book_value_cents	BIGINT	4.7
depreciation_method	VARCHAR(20)	4.11
useful_life_months	INTEGER	4.48
salvage_value_cents	BIGINT	4.7
disposed_at	TIMESTAMPTZ	4.6
disposal_proceeds_cents	BIGINT	4.7
Enums novos:
sql
Copy
-- account_type
'asset', 'liability', 'equity', 'revenue', 'expense'

-- account_subtype
'current_asset', 'fixed_asset', 'current_liability', 'long_term_liability', 'equity', 'operating_revenue', 'non_operating_revenue', 'operating_expense', 'non_operating_expense'

-- period_status
'open', 'closed', 'locked'

-- journal_entry_type
'regular', 'adjusting', 'closing', 'reversing'

-- treasury_transaction_type
'inflow', 'outflow', 'transfer'

-- asset_category
'vehicle', 'equipment', 'furniture', 'building', 'land', 'software', 'intangible'

-- depreciation_method
'straight_line', 'declining_balance', 'units_of_production', 'sum_of_years_digits'
4. CRM — AUSENTE COMPLETAMENTE
Table
Campo	Tipo	Padrão Aplicado
lead_id	UUID	4.4
opportunity_id	UUID	4.4
campaign_id	UUID	4.4
touchpoint_id	UUID	4.4
interaction_id	UUID	4.4
lead_status	VARCHAR(20)	4.11
lead_score	INTEGER	4.33
conversion_probability_bps	INTEGER	4.8
estimated_value_cents	BIGINT	4.7
expected_close_at	TIMESTAMPTZ	4.6
actual_close_at	TIMESTAMPTZ	4.6
sales_stage	VARCHAR(30)	4.11
is_won	BOOLEAN	4.9
is_lost	BOOLEAN	4.9
lost_reason	VARCHAR(50)	4.11
sales_cycle_days	INTEGER	4.48
churn_risk_score	INTEGER	4.33
nps_score	INTEGER	4.33
csat_score	INTEGER	4.33
customer_lifetime_value_cents	BIGINT	4.7
customer_acquisition_cost_cents	BIGINT	4.7
last_contact_at	TIMESTAMPTZ	4.6
next_follow_up_at	TIMESTAMPTZ	4.6
is_do_not_contact	BOOLEAN	4.9
marketing_consent_given	BOOLEAN	4.9
marketing_consent_given_at	TIMESTAMPTZ	4.6
marketing_consent_withdrawn_at	TIMESTAMPTZ	4.6
Enums novos:
sql
Copy
-- lead_status
'new', 'contacted', 'qualified', 'converted', 'unqualified', 'lost'

-- sales_stage
'prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'

-- lost_reason
'price', 'competitor', 'no_budget', 'not_qualified', 'timing', 'features'
5. SEGUROS — AUSENTE COMPLETAMENTE
Table
Campo	Tipo	Padrão Aplicado
policy_id	UUID	4.4
policy_number	VARCHAR(50)	4.3
policy_type	VARCHAR(20)	4.11
policy_status	VARCHAR(20)	4.11
premium_cents	BIGINT	4.7
premium_frequency	VARCHAR(20)	4.11
coverage_amount_cents	BIGINT	4.7
deductible_cents	BIGINT	4.7
copay_cents	BIGINT	4.7
coinsurance_bps	INTEGER	4.8
effective_from_at	TIMESTAMPTZ	4.6
effective_until_at	TIMESTAMPTZ	4.6
grace_period_days	INTEGER	4.48
waiting_period_days	INTEGER	4.48
beneficiary_id	UUID	4.4
insured_value_cents	BIGINT	4.7
claim_id	UUID	4.4
claim_number	VARCHAR(50)	4.3
claim_type	VARCHAR(30)	4.11
claim_status	VARCHAR(20)	4.11
claim_filed_at	TIMESTAMPTZ	4.6
claim_reported_at	TIMESTAMPTZ	4.6
claim_amount_cents	BIGINT	4.7
claim_approved_amount_cents	BIGINT	4.7
claim_paid_amount_cents	BIGINT	4.7
claim_paid_at	TIMESTAMPTZ	4.6
claim_denied_reason	VARCHAR(100)	4.11
endorsement_id	UUID	4.4
endorsement_type	VARCHAR(30)	4.11
endorsement_effective_at	TIMESTAMPTZ	4.6
Enums novos:
sql
Copy
-- policy_type
'health', 'life', 'auto', 'home', 'disability', 'liability', 'travel'

-- policy_status
'active', 'suspended', 'expired', 'cancelled', 'pending', 'lapsed'

-- premium_frequency
'monthly', 'quarterly', 'semi_annual', 'annual', 'single_premium'

-- claim_type
'medical', 'death', 'disability', 'property_damage', 'liability', 'theft', 'accident'

-- claim_status
'opened', 'under_review', 'approved', 'paid', 'rejected', 'appealed', 'closed'

-- endorsement_type
'address_change', 'coverage_change', 'beneficiary_change', 'premium_change', 'term_extension'
6. FARMÁCIA — AUSENTE (só existe is_refrigerated em 4.32)
Table
Campo	Tipo	Padrão Aplicado
drug_code	VARCHAR(20)	4.42
active_ingredient	VARCHAR(255)	4.3
concentration_value	DECIMAL(10,4)	4.24
concentration_unit	VARCHAR(10)	4.24
pharmaceutical_form	VARCHAR(50)	4.11
dosage_instructions	TEXT	4.3
route_of_administration	VARCHAR(50)	4.11
controlled_substance_schedule	VARCHAR(10)	4.11
is_generic	BOOLEAN	4.9
is_reference_drug	BOOLEAN	4.9
is_similar	BOOLEAN	4.9
is_interchangeable	BOOLEAN	4.9
therapeutic_class	VARCHAR(100)	4.11
storage_condition	VARCHAR(30)	4.11
max_storage_temp_celsius	DECIMAL(5,2)	4.24
min_storage_temp_celsius	DECIMAL(5,2)	4.24
batch_lot_number	VARCHAR(50)	4.23
batch_expires_at	TIMESTAMPTZ	4.6
inventory_location_id	UUID	4.16
bin_location	VARCHAR(20)	4.23
reorder_point_quantity	INTEGER	4.23
economic_order_quantity	INTEGER	4.23
abc_classification	VARCHAR(1)	4.11
turnover_rate	DECIMAL(5,2)	4.49
days_on_hand	INTEGER	4.49
Enums novos:
sql
Copy
-- pharmaceutical_form
'tablet', 'capsule', 'syrup', 'suspension', 'injection', 'cream', 'ointment', 'patch', 'inhaler', 'drops'

-- route_of_administration
'oral', 'intravenous', 'intramuscular', 'subcutaneous', 'topical', 'ophthalmic', 'otic', 'inhalation', 'rectal', 'vaginal'

-- controlled_substance_schedule
'CII', 'CIII', 'CIV', 'CV', 'non_controlled'

-- storage_condition
'room_temperature', 'refrigerated', 'frozen', 'protected_from_light', 'dry'

-- abc_classification
'A', 'B', 'C'
7. MANUFATURA — AUSENTE COMPLETAMENTE
Table
Campo	Tipo	Padrão Aplicado
bom_id	UUID	4.4
bom_version	INTEGER	4.15
bom_line_id	UUID	4.4
parent_sku	VARCHAR(100)	4.23
component_sku	VARCHAR(100)	4.23
component_quantity	DECIMAL(10,4)	4.23
component_unit	VARCHAR(10)	4.24
is_optional_component	BOOLEAN	4.9
yield_bps	INTEGER	4.8
work_order_id	UUID	4.4
production_batch_id	UUID	4.4
routing_id	UUID	4.4
operation_sequence	INTEGER	4.48
work_center_id	UUID	4.16
setup_time_minutes	INTEGER	4.21
run_time_minutes	INTEGER	4.21
teardown_time_minutes	INTEGER	4.21
actual_start_at	TIMESTAMPTZ	4.6
actual_end_at	TIMESTAMPTZ	4.6
quantity_produced	DECIMAL(10,4)	4.23
quantity_rejected	DECIMAL(10,4)	4.23
rejection_reason_code	VARCHAR(20)	4.11
scrap_bps	INTEGER	4.8
quality_control_id	UUID	4.4
inspection_type	VARCHAR(20)	4.11
inspection_result	VARCHAR(20)	4.11
non_conformance_id	UUID	4.4
corrective_action_id	UUID	4.4
preventive_action_id	UUID	4.4
Enums novos:
sql
Copy
-- inspection_type
'incoming', 'in_process', 'final', 'shipping', 'receiving'

-- inspection_result
'passed', 'failed', 'conditional', 'waived'
8. LMS/EDUCAÇÃO — AUSENTE COMPLETAMENTE
Table
Campo	Tipo	Padrão Aplicado
course_id	UUID	4.4
course_code	VARCHAR(20)	4.42
course_version	INTEGER	4.15
module_id	UUID	4.4
module_sequence	INTEGER	4.48
lesson_id	UUID	4.4
lesson_sequence	INTEGER	4.48
content_id	UUID	4.4
enrollment_id	UUID	4.4
enrollment_status	VARCHAR(20)	4.11
progress_percent_bps	INTEGER	4.8
started_at	TIMESTAMPTZ	4.6
certificate_id	UUID	4.4
certificate_issued_at	TIMESTAMPTZ	4.6
certificate_expires_at	TIMESTAMPTZ	4.6
assessment_id	UUID	4.4
assessment_type	VARCHAR(20)	4.11
question_id	UUID	4.4
answer_id	UUID	4.4
score_achieved	INTEGER	4.33
passing_score	INTEGER	4.33
is_passed	BOOLEAN	4.9
attempt_number	INTEGER	4.48
max_attempts_allowed	INTEGER	4.48
time_spent_seconds	INTEGER	4.21
cohort_id	UUID	4.4
cohort_starts_at	TIMESTAMPTZ	4.6
cohort_ends_at	TIMESTAMPTZ	4.6
Enums novos:
sql
Copy
-- enrollment_status
'enrolled', 'in_progress', 'completed', 'dropped', 'suspended'

-- assessment_type
'quiz', 'exam', 'assignment', 'project', 'practical'
9. COMPLIANCE AVANÇADO — Extensão de 4.75
Table
Campo	Tipo	Padrão Aplicado
data_subject_id	UUID	4.4
consent_type	VARCHAR(30)	4.11
consent_granted_at	TIMESTAMPTZ	4.6
consent_withdrawn_at	TIMESTAMPTZ	4.6
consent_expires_at	TIMESTAMPTZ	4.6
processing_purpose	VARCHAR(100)	4.3
dpi_assessment_id	UUID	4.4
breach_notification_id	UUID	4.4
breach_detected_at	TIMESTAMPTZ	4.6
breach_contained_at	TIMESTAMPTZ	4.6
breach_reported_at	TIMESTAMPTZ	4.6
affected_data_subjects_count	INTEGER	4.49
affected_records_count	INTEGER	4.49
sox_control_id	UUID	4.4
control_test_id	UUID	4.4
control_test_result	VARCHAR(20)	4.11
deficiency_id	UUID	4.4
is_material_weakness	BOOLEAN	4.9
remediation_plan_id	UUID	4.4
remediation_deadline_at	TIMESTAMPTZ	4.6
remediation_completed_at	TIMESTAMPTZ	4.6
is_audit_committee_notified	BOOLEAN	4.9
external_auditor_id	UUID	4.4
audit_opinion	VARCHAR(20)	4.11
Enums novos:
sql
Copy
-- control_test_result
'passed', 'failed', 'exception', 'not_tested'

-- audit_opinion
'unqualified', 'qualified', 'adverse', 'disclaimer'
10. MARKETPLACE AVANÇADO — Extensão do existente
Table
Campo	Tipo	Padrão Aplicado
product_variant_id	UUID	4.4
parent_product_id	UUID	4.4
attribute_name	VARCHAR(50)	4.3
attribute_value	VARCHAR(255)	4.3
attribute_type	VARCHAR(20)	4.11
is_configurable	BOOLEAN	4.9
bundle_id	UUID	4.4
bundle_component_sku	VARCHAR(100)	4.23
component_quantity	INTEGER	4.23
supplier_sku	VARCHAR(100)	4.23
supplier_price_cents	BIGINT	4.7
msrp_cents	BIGINT	4.7
map_cents	BIGINT	4.7
compare_at_price_cents	BIGINT	4.7
cost_method	VARCHAR(20)	4.11
landed_cost_cents	BIGINT	4.7
seller_tier	VARCHAR(20)	4.11
commission_tier_id	UUID	4.4
seller_response_time_minutes	INTEGER	4.21
seller_cancel_rate_bps	INTEGER	4.8
seller_on_time_rate_bps	INTEGER	4.8
is_top_rated_seller	BOOLEAN	4.9
is_verified_seller	BOOLEAN	4.9
marketplace_fulfillment_id	UUID	4.4
storage_fee_cents	BIGINT	4.7
pick_pack_fee_cents	BIGINT	4.7
return_processing_fee_cents	BIGINT	4.7
inventory_turnover_bps	INTEGER	4.8
days_of_inventory	INTEGER	4.49
Enums novos:
sql
Copy
-- cost_method
'fifo', 'lifo', 'average', 'standard', 'specific_identification'

-- seller_tier
'basic', 'premium', 'enterprise', 'platinum'
📋 RESUMO FINAL
Table
Domínio	Status	Campos Novos	Prioridade
Card Issuing	🔴 Ausente	50	Alta
Healthcare	🔴 Ausente	40	Alta
ERP Financeiro	🔴 Ausente	55	Alta
CRM	🔴 Ausente	28	Média
Insurance	🔴 Ausente	32	Média
Pharmacy	🔴 Ausente	26	Alta
Manufacturing	🔴 Ausente	30	Baixa
LMS/Education	🔴 Ausente	28	Baixa
Advanced Compliance	🟡 Extensão	24	Alta
Marketplace Advanced	🟡 Extensão	30	Média
Total: 343 campos canônicos novos + enums correspondentes.

## 🎯 ANÁLISE DE GAPS POR DOMÍNIO

### 1. **CARTÃO (Card Issuing)** — 🔴 **AUSENTE COMPLETAMENTE**

O documento não possui **nenhuma** seção dedicada a emissão de cartões, autorizações, chargebacks ou fraudes.

| O que falta | Exemplo Canônico | Seção Sugerida |
|-------------|------------------|----------------|
| Dados do cartão | `card_number_token`, `card_number_last_four`, `expiry_month`, `expiry_year` | 4.82 |
| Segurança do cartão | `cvv_token`, `pin_hash`, `pin_attempts_remaining` | 4.83 |
| Configurações do cartão | `is_contactless_enabled`, `is_online_purchase_enabled`, `is_international_enabled` | 4.84 |
| Limites do cartão | `card_limit_cents`, `daily_purchase_limit_cents`, `daily_atm_limit_cents` | 4.85 |
| Autorizações | `authorization_id`, `authorization_code`, `authorization_type`, `mcc_code` | 4.86 |
| Transações de cartão | `is_recurring`, `is_installment`, `installment_number`, `total_installments` | 4.87 |
| 3D Secure | `is_3ds_authenticated`, `three_ds_version`, `three_ds_authentication_status`, `eci_indicator` | 4.88 |
| Fraude | `is_fraud_suspected`, `fraud_score`, `fraud_rule_triggered` | 4.89 |
| Chargebacks | `chargeback_id`, `chargeback_reason_code`, `chargeback_amount_cents`, `representment_status` | 4.90 |

**Enums necessários:**
```sql
-- card_type
'physical', 'virtual', 'single_use'

-- card_brand  
'visa', 'mastercard', 'amex', 'elo', 'hiper', 'diners'

-- card_product
'credit', 'debit', 'prepaid', 'fleet', 'corporate'

-- card_status
'active', 'blocked', 'expired', 'cancelled', 'suspended'

-- authorization_type
'pre_auth', 'final_auth', 'incremental_auth', 'reversal'

-- capture_mode
'automatic', 'manual'

-- three_ds_authentication_status
'authenticated', 'attempted', 'failed', 'not_enrolled'

-- replacement_reason
'expired', 'lost', 'stolen', 'damaged', 'fraud', 'upgrade'

-- representment_status
'pending', 'submitted', 'won', 'lost'
```

---

### 2. **MATERIAIS DE CONSTRUÇÃO** — 🔴 **AUSENTE**

O documento tem estoque genérico (4.23) mas não cobre especificidades de materiais de construção.

| O que falta | Exemplo Canônico | Seção Sugerida |
|-------------|------------------|----------------|
| Classificação técnica | `material_class`, `material_group`, `technical_specification` | 4.91 |
| Propriedades físicas | `density_kg_m3`, `compressive_strength_mpa`, `tensile_strength_mpa` | 4.92 |
| Normas técnicas | `abnt_standard`, `nbr_code`, `iso_standard` | 4.93 |
| Comercialização | `sales_unit`, `base_unit`, `conversion_factor` | 4.94 |
| Estoque específico | `is_bulk_material`, `requires_batch_control`, `shelf_life_months` | 4.95 |

**Exemplo de campos para concreto:**
```sql
concrete_type              -- 'ready_mix', 'precast', 'site_mixed'
compressive_strength_28d_mpa  -- Resistência característica
slump_mm                   -- Abatimento (workability)
aggregate_max_size_mm      -- Dimensão máxima do agregado
cement_content_kg_m3       -- Teor de cimento
water_cement_ratio         -- Relação água/cimento
```

---

### 3. **PESO E DIMENSÕES** — 🟡 **PARCIAL (4.24 incompleto)**

A seção 4.24 existe mas carece de unidades específicas para construção e logística pesada.

| O que falta | Exemplo Canônico | Seção Sugerida |
|-------------|------------------|----------------|
| Unidades industriais | `weight_tons`, `weight_kg`, `weight_grams` (já tem) — faltam: `weight_carats` | 4.24 extensão |
| Dimensões grandes | `length_meters`, `width_meters`, `height_meters` (além de cm) | 4.24 extensão |
| Volume industrial | `volume_cubic_meters`, `volume_liters`, `volume_ml` (já tem) | 4.24 extensão |
| Área | `area_square_meters`, `area_hectares` | 4.96 |
| Carga | `payload_kg`, `tare_weight_kg`, `gross_weight_kg` | 4.97 |
| Dimensional weight | `dimensional_weight_kg`, `chargeable_weight_kg` | 4.98 |

---

### 4. **REDE SOCIAL** — 🟡 **PARCIAL (4.37-4.38 básico)**

Tem `entity_type`, `actor_type` mas falta engajamento, conteúdo e algoritmo.

| O que falta | Exemplo Canônico | Seção Sugerida |
|-------------|------------------|----------------|
| Engajamento | `engagement_rate_bps`, `reach_count`, `impression_count` | 4.99 |
| Conteúdo | `post_type`, `content_format`, `media_duration_seconds` | 4.100 |
| Algoritmo | `algorithm_score`, `feature_vector`, `embedding_vector` | 4.101 |
| Moderação | `is_flagged`, `moderation_status`, `report_count` | 4.102 |
| Grupos/Comunidades | `member_count`, `admin_count`, `group_privacy` | 4.103 |
| Mensagens | `message_type`, `is_encrypted`, `read_receipt_enabled` | 4.104 |

---

### 5. **FARMÁCIA** — 🔴 **AUSENTE (só 4.32 perecíveis genérico)**

| O que falta | Exemplo Canônico | Seção Sugerida |
|-------------|------------------|----------------|
| Medicamentos | `drug_code`, `active_ingredient`, `concentration_value`, `concentration_unit` | 4.105 |
| Formas farmacêuticas | `pharmaceutical_form`, `dosage_instructions`, `route_of_administration` | 4.106 |
| Controle especial | `controlled_substance_schedule`, `is_generic`, `is_reference_drug` | 4.107 |
| Classe terapêutica | `therapeutic_class`, `atc_code`, `anvisa_registration` | 4.108 |
| Lotes | `batch_lot_number`, `batch_expires_at`, `serial_number` | 4.109 |
| Posologia | `dosage_value`, `dosage_unit`, `frequency_per_day` | 4.110 |

**Enums necessários:**
```sql
-- pharmaceutical_form
'tablet', 'capsule', 'syrup', 'suspension', 'injection', 
'cream', 'ointment', 'patch', 'inhaler', 'drops', 'suppository'

-- route_of_administration
'oral', 'intravenous', 'intramuscular', 'subcutaneous', 
'topical', 'ophthalmic', 'otic', 'inhalation', 'rectal', 'vaginal'

-- controlled_substance_schedule
'CII', 'CIII', 'CIV', 'CV', 'non_controlled'
```

---

### 6. **ERP FINANCEIRO COMPLETO** — 🟡 **PARCIAL (4.17 ledger básico)**

| O que falta | Exemplo Canônico | Seção Sugerida |
|-------------|------------------|----------------|
| Plano de contas | `chart_of_accounts_id`, `account_code`, `account_type`, `account_subtype` | 4.111 |
| Período contábil | `fiscal_year`, `accounting_period_id`, `period_status`, `is_period_closed` | 4.112 |
| Lançamentos | `journal_entry_id`, `journal_entry_type`, `posting_at`, `accounting_date` | 4.113 |
| AP/AR | `ap_invoice_id`, `ar_invoice_id`, `vendor_id`, `invoice_due_at`, `is_overdue` | 4.114 |
| Tesouraria | `bank_statement_id`, `is_reconciled`, `treasury_transaction_type` | 4.115 |
| Ativo fixo | `fixed_asset_id`, `asset_tag`, `depreciation_method`, `useful_life_months` | 4.116 |

---

### 7. **CRM** — 🔴 **AUSENTE**

| O que falta | Exemplo Canônico | Seção Sugerida |
|-------------|------------------|----------------|
| Lead | `lead_id`, `lead_status`, `lead_score`, `lead_source` | 4.117 |
| Oportunidade | `opportunity_id`, `sales_stage`, `estimated_value_cents`, `expected_close_at` | 4.118 |
| Métricas | `conversion_probability_bps`, `sales_cycle_days`, `churn_risk_score` | 4.119 |
| CSAT/NPS | `nps_score`, `csat_score`, `customer_lifetime_value_cents` | 4.120 |
| Consentimento | `marketing_consent_given`, `marketing_consent_given_at`, `is_do_not_contact` | 4.121 |

---

### 8. **SAÚDE (Healthcare)** — 🔴 **AUSENTE (só 4.72 básico)**

| O que falta | Exemplo Canônico | Seção Sugerida |
|-------------|------------------|----------------|
| Sinais vitais | `systolic_bp_mmhg`, `diastolic_bp_mmhg`, `heart_rate_bpm`, `oxygen_saturation_percent` | 4.122 |
| Códigos clínicos | `icd9_code`, `icd10_code`, `cpt_code`, `loinc_code`, `snomed_ct_code` | 4.123 |
| Prescrições | `prescription_id`, `prescription_status`, `refills_allowed`, `dispensed_at` | 4.124 |
| Agendamento | `appointment_id`, `appointment_type`, `appointment_status`, `checked_in_at` | 4.125 |
| Atendimento | `encounter_id`, `encounter_type`, `encounter_status`, `episode_of_care_id` | 4.126 |
| Medicamentos | `medication_request_id`, `medication_administration_id`, `dosage_value` | 4.127 |

---

### 9. **SEGUROS** — 🔴 **AUSENTE**

| O que falta | Exemplo Canônico | Seção Sugerida |
|-------------|------------------|----------------|
| Apólice | `policy_id`, `policy_number`, `policy_type`, `policy_status` | 4.128 |
| Cobertura | `coverage_amount_cents`, `deductible_cents`, `copay_cents`, `coinsurance_bps` | 4.129 |
| Sinistro | `claim_id`, `claim_number`, `claim_type`, `claim_status`, `claim_filed_at` | 4.130 |
| Endosso | `endorsement_id`, `endorsement_type`, `endorsement_effective_at` | 4.131 |

---

### 10. **MANUFATURA** — 🔴 **AUSENTE**

| O que falta | Exemplo Canônico | Seção Sugerida |
|-------------|------------------|----------------|
| BOM | `bom_id`, `bom_version`, `parent_sku`, `component_sku`, `component_quantity` | 4.132 |
| Ordem de produção | `work_order_id`, `production_batch_id`, `operation_sequence` | 4.133 |
| Tempo | `setup_time_minutes`, `run_time_minutes`, `actual_start_at` | 4.134 |
| Qualidade | `quality_control_id`, `inspection_result`, `non_conformance_id` | 4.135 |

---

### 11. **EDUCAÇÃO (LMS)** — 🔴 **AUSENTE**

| O que falta | Exemplo Canônico | Seção Sugerida |
|-------------|------------------|----------------|
| Curso | `course_id`, `course_code`, `course_version`, `module_sequence` | 4.136 |
| Matrícula | `enrollment_id`, `enrollment_status`, `progress_percent_bps` | 4.137 |
| Certificado | `certificate_id`, `certificate_issued_at`, `certificate_expires_at` | 4.138 |
| Avaliação | `assessment_id`, `score_achieved`, `passing_score`, `is_passed` | 4.139 |

---

### 12. **COMPLIANCE AVANÇADO** — 🟡 **PARCIAL (4.75 básico)**

| O que falta | Exemplo Canônico | Seção Sugerida |
|-------------|------------------|----------------|
| LGPD/GDPR | `data_subject_id`, `consent_type`, `processing_purpose`, `dpi_assessment_id` | 4.140 |
| Breach | `breach_notification_id`, `breach_detected_at`, `affected_data_subjects_count` | 4.141 |
| SOX | `sox_control_id`, `control_test_id`, `is_material_weakness`, `audit_opinion` | 4.142 |

---

## 📋 RESUMO EXECUTIVO DE GAPS

| Domínio | Status | Campos Estimados | Prioridade |
|---------|--------|------------------|------------|
| **Card Issuing** | 🔴 Ausente | ~50 campos | **Crítica** |
| **Healthcare** | 🔴 Ausente | ~40 campos | **Alta** |
| **ERP Financeiro** | 🟡 Parcial | ~30 campos | **Alta** |
| **CRM** | 🔴 Ausente | ~25 campos | Média |
| **Insurance** | 🔴 Ausente | ~30 campos | Média |
| **Pharmacy** | 🔴 Ausente | ~25 campos | **Alta** |
| **Manufacturing** | 🔴 Ausente | ~25 campos | Baixa |
| **LMS/Education** | 🔴 Ausente | ~25 campos | Baixa |
| **Materiais Construção** | 🔴 Ausente | ~20 campos | Média |
| **Rede Social** | 🟡 Parcial | ~20 campos | Média |
| **Compliance Avançado** | 🟡 Parcial | ~15 campos | **Alta** |
| **Peso/Dimensões** | 🟡 Parcial | ~10 campos | Baixa |

**Total: ~315 campos canônicos novos + ~60 enums**

---

## 🎯 RECOMENDAÇÃO DE IMPLEMENTAÇÃO

Sugiro adicionar **Parte VI — Domínios Verticais** ao documento, seguindo a mesma estrutura rigorosa:

```
PARTE VI — DOMÍNIOS VERTICAIS (NOVO)
├── 24. Cartão (Card Issuing) — 4.82-4.90
├── 25. Healthcare e Pharmacy — 4.91-4.110  
├── 26. ERP Financeiro Completo — 4.111-4.116
├── 27. CRM — 4.117-4.121
├── 28. Seguros — 4.128-4.131
├── 29. Manufatura — 4.132-4.135
├── 30. Educação (LMS) — 4.136-4.139
├── 31. Materiais de Construção — 4.91-4.95 (estender)
├── 32. Rede Social Avançada — 4.99-4.104
└── 33. Compliance e Governança Avançada — 4.140-4.142
```

Todos os novos campos seguem rigorosamente:
- ✅ `snake_case` no banco / `camelCase` na API
- ✅ Timestamps com `_at` / `At`
- ✅ Monetários com `_cents` e `BIGINT`
- ✅ Percentuais com `_bps`
- ✅ Booleanos com `is_`, `has_`, `can_`
- ✅ Unidades explícitas no nome
- ✅ Enums em inglês, lowercase
- ✅ IDs com sufixo `_id` / `Id`

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- 02_ACTORS_SSOT.md
- GATES.md
- SSOT_REGISTRY_UNIFICARD.md

### Referenciado por
- 00_AGENT_PROTOCOL.md
- 00_INDEX.md
- 00_SUMARIO.md
- 18_DOMAIN_ONTOLOGY_UNIFICARD.md
- EVENT_OUTBOX_E_ENTREGA_CANONICO.md
- HANDLER_EXECUTION_AND_RELIABILITY.md
- LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md
- VOCABULARIO_CANONICO_UNIFICARD.md
<!-- AUTO-GENERATED-END -->