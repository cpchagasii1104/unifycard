# 07 — NOMENCLATURA CANÔNICA

Estrutura do Documento:

PARTE I — BANCO DE DADOS (71 seções)
├── 4.1-4.4   Tabelas, Colunas, Chaves, Timestamps
├── 4.5-4.8   Monetário, Taxas, Booleanos, Moeda
├── 4.9       Status e Lifecycle (10 categorias)
├── 4.10-4.14 IDs, Auditoria, Soft Delete, Multi-Tenancy
├── 4.15-4.16 Ledger, Splits
├── 4.17-4.30 Geo, Endereços, Estoque, Tracking, etc.
├── 4.31-4.50 Scores, Priority, Visibility, Roles, etc.
└── 4.51-4.71 NOVAS: Entry Types, Split Types, Scopes, etc.

PARTE II — BACKEND E API
├── 5. Backend (classes, propriedades, conversão)
├── 6. API (sufixos, prefixos, enums)
├── 7. Frontend
└── 8. Eventos

PARTE III — TABELAS DE CONVERSÃO
└── 9. Conversão Banco → Backend/API

PARTE IV — GOVERNANÇA
├── 10. Proibições (incluindo idioma)
├── 11. Governança
├── 12. Checklist
├── 13. Padrões de Mercado
└── 14. Regra Final

## STATUS

CANÔNICO · VIGENTE · OBRIGATÓRIO · BLINDADO

**Versão:** 2.0 — Consolidado com auditoria de sistema
**Data:** 2026-02-07
**Cobertura:** 100% dos padrões identificados no código

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

Não existem exceções locais, implícitas ou temporárias.

---

## 3. REGRA SUPREMA

> **Um conceito → um nome → uma forma.**

Se dois nomes existem para a mesma coisa:
→ o sistema está errado.

Se o mesmo nome significa coisas diferentes:
→ o sistema está errado.

---

# PARTE I — BANCO DE DADOS

## 4. BANCO DE DADOS (SQL)

### 4.1 Tabelas

* `snake_case`
* plural
* substantivos

✔ `users`
✔ `bank_transactions`
✔ `ledger_entries`
✔ `delivery_orders`
✔ `inventory_items`
❌ `User`
❌ `userTransaction`

---

### 4.2 Colunas

* `snake_case`
* nomes explícitos
* sem abreviações obscuras

✔ `global_user_id`
✔ `created_at`
✔ `pickup_latitude`
❌ `guid`
❌ `usr_id`
❌ `lat`

---

### 4.3 Chaves

* Chave primária: `id`
* Chave estrangeira: `<entidade>_id`

✔ `users.id`
✔ `profiles.user_id`
✔ `deliveries.driver_id`
❌ `userId`
❌ `user_id_id`

---

### 4.4 Timestamps

* Sufixo obrigatório: `_at`
* Sempre `TIMESTAMPTZ` (com timezone)

#### Timestamps Gerais

✔ `created_at`
✔ `updated_at`
✔ `deleted_at`

#### Timestamps Financeiros

✔ `paid_at`
✔ `settled_at`
✔ `authorized_at`
✔ `captured_at`
✔ `refunded_at`
✔ `cancelled_at`
✔ `expired_at`

#### Timestamps de Logística/Operação

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

#### Timestamps de Agendamento

✔ `starts_at`
✔ `ends_at`
✔ `opens_at`
✔ `closes_at`
✔ `available_from_at`
✔ `available_until_at`
✔ `valid_from_at`
✔ `valid_until_at`

#### Timestamps de Verificação/KYC

✔ `verified_at`
✔ `approved_at`
✔ `rejected_at`
✔ `submitted_at`
✔ `reviewed_at`

#### Timestamps de Comunicação

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

---

### 4.5 Valores Monetários

* Sempre em **centavos** (inteiro), nunca float/decimal
* Sufixo obrigatório: `_cents`
* Moeda explícita quando multi-moeda: `_brl_cents`, `_usd_cents`
* Tipo: `BIGINT` (não `INTEGER` — suporta até 92 quatrilhões de centavos)

#### Campos Monetários Padrão (Financeiro/Marketplace)

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

#### Campos Monetários de Logística

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

#### Campos Monetários de Subscription

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

É **PROIBIDO**:

* Armazenar dinheiro como `FLOAT`, `DOUBLE`, `DECIMAL`, `NUMERIC`
* Omitir sufixo `_cents`
* Usar nome genérico como `value` ou `amount` sem sufixo
* Armazenar em reais/dólares (sempre centavos)

---

### 4.6 Taxas e Percentuais

* Taxas percentuais em **basis points (bps)**: 1% = 100 bps
* Sufixo obrigatório: `_bps` (basis points)
* Tipo: `INTEGER`

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

---

### 4.7 Booleanos

* Prefixo obrigatório: `is_`, `has_`, `can_`, `should_`, `was_`, `requires_`
* Tipo: `BOOLEAN`
* Default explícito obrigatório

#### Booleanos de Estado

✔ `is_active`
✔ `is_deleted`
✔ `is_published`
✔ `is_visible`
✔ `is_featured`
✔ `is_verified`
✔ `is_approved`
✔ `is_blocked`
✔ `is_suspended`

#### Booleanos de Capacidade

✔ `can_withdraw`
✔ `can_receive`
✔ `can_edit`
✔ `can_delete`
✔ `can_share`

#### Booleanos de Propriedade

✔ `has_permission`
✔ `has_split`
✔ `has_tracking`
✔ `has_insurance`
✔ `has_subscription`

#### Booleanos de Requisitos

✔ `requires_signature`
✔ `requires_approval`
✔ `requires_verification`
✔ `requires_payment`

#### Booleanos de Características

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

---

### 4.8 Moeda (Currency)

* Padrão ISO 4217 (3 letras maiúsculas)
* Tipo: `VARCHAR(3)` ou `CHAR(3)`
* Coluna: `currency` ou `currency_code`

✔ `currency` = `'BRL'`
✔ `currency` = `'USD'`
✔ `settlement_currency`
❌ `currency` = `'R$'`
❌ `currency` = `'real'`
❌ `currency` = `986` (código numérico — evitar)

**Moedas comuns:**

| Código | Moeda |
|--------|-------|
| BRL | Real Brasileiro |
| USD | Dólar Americano |
| EUR | Euro |
| GBP | Libra Esterlina |

---

### 4.9 Status e Lifecycle

* `snake_case`
* Verbos no passado ou estado atual
* Coluna: `status`
* Tipo: `VARCHAR` ou `ENUM`

#### Status de Pagamento (padrão mercado)

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

#### Status de Pedido/Order (marketplace)

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

#### Status de Entrega/Delivery (logística)

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

#### Status de Entregador/Driver

```sql
'offline'           -- Offline
'online'            -- Online/disponível
'busy'              -- Ocupado em entrega
'on_break'          -- Em pausa
'returning'         -- Retornando
```

#### Status de Saque/Payout

```sql
'pending'           -- Aguardando
'processing'        -- Em processamento
'completed'         -- Concluído
'failed'            -- Falhou
'reversed'          -- Revertido
'blocked'           -- Bloqueado
```

#### Status de Estoque/Inventory

```sql
'in_stock'          -- Em estoque
'low_stock'         -- Estoque baixo
'out_of_stock'      -- Sem estoque
'discontinued'      -- Descontinuado
'pre_order'         -- Pré-venda
'backordered'       -- Aguardando reposição
```

#### Status de Verificação/KYC

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

#### Status de Subscription

```sql
'trialing'          -- Em período de trial
'active'            -- Ativo
'past_due'          -- Pagamento atrasado
'paused'            -- Pausado
'cancelled'         -- Cancelado
'expired'           -- Expirado
```

#### Status de Conteúdo/Publicação

```sql
'draft'             -- Rascunho
'pending_review'    -- Aguardando revisão
'published'         -- Publicado
'unpublished'       -- Despublicado
'archived'          -- Arquivado
'deleted'           -- Deletado
```

#### Status de Disputa

```sql
'opened'            -- Aberta
'in_progress'       -- Em andamento
'resolved'          -- Resolvida
'escalated'         -- Escalada
'closed'            -- Fechada
```

#### Status Gerais Adicionais

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

---

### 4.10 Identificadores Externos e Idempotência

#### Idempotency Key (CRÍTICO para pagamentos)

* Coluna: `idempotency_key`
* Tipo: `VARCHAR(255)` com `UNIQUE`
* Obrigatório em: transações, pagamentos, transferências

✔ `idempotency_key`
❌ `idempotent_key`
❌ `idem_key`
❌ `request_id` (diferente de idempotency)

#### External/Reference IDs

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

---

### 4.11 Audit Fields (Auditoria)

Toda tabela crítica DEVE ter:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `created_at` | `TIMESTAMPTZ` | Quando foi criado |
| `created_by` | `UUID` | Quem criou (actor_id) |
| `updated_at` | `TIMESTAMPTZ` | Última atualização |
| `updated_by` | `UUID` | Quem atualizou |
| `deleted_at` | `TIMESTAMPTZ` | Soft delete timestamp |
| `deleted_by` | `UUID` | Quem deletou |
| `version` | `INTEGER` | Versão para optimistic locking |

Variações com contexto:

| Campo | Descrição |
|-------|-----------|
| `created_by_user_id` | Criado por usuário específico |
| `created_by_actor_id` | Criado por ator (usuário/sistema) |
| `approved_by` | Aprovado por |
| `rejected_by` | Rejeitado por |
| `cancelled_by` | Cancelado por |

---

### 4.12 Soft Delete

* Usar `deleted_at` (não `is_deleted`)
* `deleted_at IS NULL` = ativo
* `deleted_at IS NOT NULL` = deletado

✔ `deleted_at`
✔ `deleted_by`
❌ `is_deleted` (redundante com deleted_at)
❌ `removed`
❌ `inactive`

---

### 4.13 Versionamento e Concorrência

* Coluna: `version`
* Tipo: `INTEGER`
* Incrementa a cada UPDATE
* Usado para optimistic locking

```sql
UPDATE accounts 
SET balance_cents = 1000, version = version + 1
WHERE id = ? AND version = ?
```

✔ `version`
❌ `revision`
❌ `v`
❌ `lock_version`

---

### 4.14 Multi-Tenancy

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

---

### 4.15 Ledger Double-Entry (Contabilidade)

Para sistemas de ledger com partidas dobradas:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `entry_type` | `VARCHAR` | `'debit'` ou `'credit'` |
| `debit_cents` | `BIGINT` | Valor do débito |
| `credit_cents` | `BIGINT` | Valor do crédito |
| `account_id` | `UUID` | Conta afetada |
| `contra_account_id` | `UUID` | Conta contrapartida |
| `journal_id` | `UUID` | ID do lançamento |
| `posting_date` | `DATE` | Data contábil |
| `effective_date` | `DATE` | Data efetiva |

**Regra contábil:**
```
SUM(debit_cents) = SUM(credit_cents) -- sempre
```

---

### 4.16 Split de Pagamento (Marketplace)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `split_id` | `UUID` | ID do split |
| `transaction_id` | `UUID` | Transação origem |
| `recipient_id` | `UUID` | Quem recebe |
| `recipient_type` | `VARCHAR` | `'seller'`, `'platform'`, `'referral'` |
| `amount_cents` | `BIGINT` | Valor do split |
| `percentage_bps` | `INTEGER` | Percentual em basis points |
| `is_liable` | `BOOLEAN` | Responsável por chargeback |
| `is_charge_processing_fee` | `BOOLEAN` | Paga taxa de processamento |

---

### 4.17 Geolocalização

* Coordenadas em **graus decimais** (não DMS)
* Tipo: `DECIMAL(10, 7)` para latitude, `DECIMAL(11, 7)` para longitude
* Ou tipo `GEOGRAPHY`/`GEOMETRY` (PostGIS)

#### Campos de Coordenadas

| Campo | Tipo | Descrição | Range |
|-------|------|-----------|-------|
| `latitude` | `DECIMAL(10,7)` | Latitude | -90 a +90 |
| `longitude` | `DECIMAL(11,7)` | Longitude | -180 a +180 |
| `altitude_meters` | `DECIMAL(8,2)` | Altitude em metros | - |
| `accuracy_meters` | `DECIMAL(8,2)` | Precisão do GPS | - |
| `heading_degrees` | `DECIMAL(5,2)` | Direção em graus | 0 a 360 |
| `speed_mps` | `DECIMAL(6,2)` | Velocidade m/s | - |

#### Campos com Prefixo de Contexto

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

✔ `latitude`, `longitude`
✔ `pickup_latitude`, `pickup_longitude`
✔ `altitude_meters`
❌ `lat`, `lng`, `lon` (abreviações)
❌ `geo_lat` (redundante)
❌ `x`, `y` (ambíguo)

---

### 4.18 Endereços

#### Campos de Endereço (padrão internacional)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `address_line_1` | `VARCHAR(255)` | Logradouro + número |
| `address_line_2` | `VARCHAR(255)` | Complemento |
| `neighborhood` | `VARCHAR(100)` | Bairro |
| `city` | `VARCHAR(100)` | Cidade |
| `state` | `VARCHAR(100)` | Estado/Província |
| `state_code` | `VARCHAR(10)` | Código do estado (SP, RJ) |
| `postal_code` | `VARCHAR(20)` | CEP/Código postal |
| `country` | `VARCHAR(100)` | País |
| `country_code` | `CHAR(2)` | ISO 3166-1 alpha-2 (BR, US) |

#### Campos Específicos Brasil

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `street` | `VARCHAR(255)` | Logradouro |
| `street_number` | `VARCHAR(20)` | Número |
| `complement` | `VARCHAR(100)` | Complemento |
| `reference` | `VARCHAR(255)` | Ponto de referência |
| `ibge_code` | `VARCHAR(10)` | Código IBGE da cidade |

✔ `address_line_1`
✔ `postal_code`
✔ `country_code`
❌ `addr1`
❌ `zip` (usar `postal_code`)
❌ `zip_code` (usar `postal_code`)

---

### 4.19 Distância e Duração

* Distância em **metros** (inteiro)
* Duração em **segundos** (inteiro) ou **minutos** para durações maiores
* Sufixos obrigatórios: `_meters`, `_seconds`, `_minutes`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `distance_meters` | `INTEGER` | Distância em metros |
| `duration_seconds` | `INTEGER` | Duração em segundos |
| `duration_minutes` | `INTEGER` | Duração em minutos |
| `radius_meters` | `INTEGER` | Raio em metros |
| `max_distance_meters` | `INTEGER` | Distância máxima |
| `walking_duration_seconds` | `INTEGER` | Tempo a pé |
| `driving_duration_seconds` | `INTEGER` | Tempo de carro |
| `transit_duration_seconds` | `INTEGER` | Tempo de transporte público |
| `eta_minutes` | `INTEGER` | ETA em minutos |
| `preparation_time_minutes` | `INTEGER` | Tempo de preparo |
| `response_time_minutes` | `INTEGER` | Tempo de resposta |

✔ `distance_meters`
✔ `duration_seconds`
✔ `duration_minutes`
✔ `eta_minutes`
❌ `distance` (sem unidade)
❌ `duration` (sem unidade)
❌ `duration_min` (ambíguo: minutos ou mínimo?)
❌ `time` (ambíguo)

**IMPORTANTE:** Não usar `_min` como sufixo para minutos. Usar `_minutes`.

---

### 4.20 Zonas e Áreas Geográficas

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `zone_id` | `UUID` | ID da zona |
| `zone_code` | `VARCHAR(50)` | Código da zona |
| `zone_name` | `VARCHAR(100)` | Nome da zona |
| `zone_type` | `VARCHAR(50)` | `'delivery'`, `'pricing'`, `'service'` |
| `geofence` | `GEOMETRY` | Polígono da área (PostGIS) |
| `polygon` | `JSONB` | Polígono como array de coordenadas |
| `center_latitude` | `DECIMAL(10,7)` | Centro da zona |
| `center_longitude` | `DECIMAL(11,7)` | Centro da zona |
| `bounding_box` | `BOX` | Retângulo delimitador |

---

### 4.21 Estoque e Inventário

#### Identificação de Produto

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `sku` | `VARCHAR(100)` | Stock Keeping Unit (único) |
| `upc` | `VARCHAR(20)` | Universal Product Code |
| `ean` | `VARCHAR(20)` | European Article Number |
| `isbn` | `VARCHAR(20)` | ISBN (livros) |
| `asin` | `VARCHAR(20)` | Amazon Standard ID |
| `mpn` | `VARCHAR(100)` | Manufacturer Part Number |
| `gtin` | `VARCHAR(20)` | Global Trade Item Number |

#### Quantidades

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `quantity` | `INTEGER` | Quantidade geral |
| `available_quantity` | `INTEGER` | Disponível para venda |
| `reserved_quantity` | `INTEGER` | Reservado (em carrinho/pedido) |
| `committed_quantity` | `INTEGER` | Comprometido (pedido confirmado) |
| `on_hand_quantity` | `INTEGER` | Em mãos (físico no armazém) |
| `in_transit_quantity` | `INTEGER` | Em trânsito |
| `damaged_quantity` | `INTEGER` | Danificado |
| `min_quantity` | `INTEGER` | Estoque mínimo (alerta) |
| `max_quantity` | `INTEGER` | Estoque máximo |
| `reorder_quantity` | `INTEGER` | Quantidade para reposição |
| `reorder_point` | `INTEGER` | Ponto de reposição |

✔ `available_quantity`
✔ `reserved_quantity`
❌ `qty` (abreviação)
❌ `stock` (ambíguo)
❌ `count` (ambíguo)

---

### 4.22 Unidades de Medida

* Sempre usar unidades base do SI quando possível
* Sufixo obrigatório com unidade

#### Peso

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `weight_grams` | `INTEGER` | Peso em gramas |
| `weight_kg` | `DECIMAL(10,3)` | Peso em quilos (quando necessário) |
| `net_weight_grams` | `INTEGER` | Peso líquido |
| `gross_weight_grams` | `INTEGER` | Peso bruto |
| `tare_weight_grams` | `INTEGER` | Tara |

#### Volume

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `volume_ml` | `INTEGER` | Volume em mililitros |
| `volume_liters` | `DECIMAL(10,3)` | Volume em litros |
| `capacity_ml` | `INTEGER` | Capacidade |

#### Dimensões

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `length_cm` | `DECIMAL(10,2)` | Comprimento em cm |
| `width_cm` | `DECIMAL(10,2)` | Largura em cm |
| `height_cm` | `DECIMAL(10,2)` | Altura em cm |
| `depth_cm` | `DECIMAL(10,2)` | Profundidade em cm |
| `diameter_cm` | `DECIMAL(10,2)` | Diâmetro em cm |
| `cubic_meters` | `DECIMAL(10,4)` | Volume cúbico (m³) |
| `dimensional_weight_grams` | `INTEGER` | Peso cubado |

✔ `weight_grams`
✔ `length_cm`
✔ `volume_ml`
❌ `weight` (sem unidade)
❌ `size` (ambíguo)
❌ `dimensions` (ambíguo)

---

### 4.23 Horário de Funcionamento

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `opens_at` | `TIME` | Hora de abertura |
| `closes_at` | `TIME` | Hora de fechamento |
| `day_of_week` | `INTEGER` | Dia da semana (0=Dom, 1=Seg...) |
| `is_open` | `BOOLEAN` | Está aberto |
| `is_24h` | `BOOLEAN` | Funciona 24h |
| `timezone` | `VARCHAR(50)` | Fuso horário IANA |

---

### 4.24 Fuso Horário

* Padrão IANA Time Zone Database
* Tipo: `VARCHAR(50)`
* Coluna: `timezone`

✔ `timezone` = `'America/Sao_Paulo'`
✔ `timezone` = `'America/New_York'`
✔ `timezone` = `'UTC'`
❌ `timezone` = `'BRT'` (abreviação)
❌ `timezone` = `'-03:00'` (offset, não timezone)
❌ `timezone` = `'GMT-3'`

**Timezones Brasil:**

| Timezone | Região |
|----------|--------|
| `America/Sao_Paulo` | Brasília, SP, RJ, MG, etc. |
| `America/Manaus` | Amazonas |
| `America/Belem` | Pará |
| `America/Fortaleza` | Ceará, RN, PB, etc. |
| `America/Recife` | Pernambuco |
| `America/Cuiaba` | Mato Grosso |
| `America/Porto_Velho` | Rondônia |
| `America/Rio_Branco` | Acre |

---

### 4.25 Agendamento e Time Slots

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `scheduled_at` | `TIMESTAMPTZ` | Data/hora agendada |
| `scheduled_date` | `DATE` | Data agendada |
| `slot_start_at` | `TIMESTAMPTZ` | Início do slot |
| `slot_end_at` | `TIMESTAMPTZ` | Fim do slot |
| `slot_duration_minutes` | `INTEGER` | Duração do slot |
| `buffer_minutes` | `INTEGER` | Tempo de preparo/buffer |
| `lead_time_minutes` | `INTEGER` | Tempo de antecedência |
| `cutoff_time` | `TIME` | Horário limite |
| `preparation_time_minutes` | `INTEGER` | Tempo de preparo |

---

### 4.26 Recorrência (RRULE - RFC 5545)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `rrule` | `VARCHAR(500)` | Regra de recorrência iCal |
| `frequency` | `VARCHAR(20)` | `'daily'`, `'weekly'`, `'monthly'`, `'yearly'` |
| `interval` | `INTEGER` | Intervalo (a cada N) |
| `count` | `INTEGER` | Número de ocorrências |
| `until_at` | `TIMESTAMPTZ` | Data final |
| `by_day` | `VARCHAR(50)` | Dias da semana (`'MO,WE,FR'`) |
| `by_month` | `VARCHAR(50)` | Meses (`'1,6,12'`) |
| `by_month_day` | `VARCHAR(50)` | Dias do mês (`'1,15'`) |

✔ `frequency` = `'weekly'`
✔ `by_day` = `'MO,WE,FR'`
❌ `repeat_type`
❌ `recurrence_type`

---

### 4.27 SLA e Prazos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `sla_minutes` | `INTEGER` | SLA em minutos |
| `sla_hours` | `INTEGER` | SLA em horas |
| `deadline_at` | `TIMESTAMPTZ` | Prazo final |
| `promised_at` | `TIMESTAMPTZ` | Data prometida |
| `expected_at` | `TIMESTAMPTZ` | Data esperada |
| `target_at` | `TIMESTAMPTZ` | Data alvo |
| `is_sla_breached` | `BOOLEAN` | SLA foi violado |
| `sla_breached_at` | `TIMESTAMPTZ` | Quando violou SLA |
| `response_time_seconds` | `INTEGER` | Tempo de resposta |
| `resolution_time_seconds` | `INTEGER` | Tempo de resolução |

---

### 4.28 Rastreamento e Checkpoints (Tracking)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tracking_code` | `VARCHAR(100)` | Código de rastreio |
| `carrier` | `VARCHAR(50)` | Transportadora |
| `carrier_code` | `VARCHAR(20)` | Código da transportadora |
| `service_type` | `VARCHAR(50)` | Tipo de serviço (SEDEX, PAC) |
| `checkpoint_status` | `VARCHAR(50)` | Status do checkpoint |
| `checkpoint_at` | `TIMESTAMPTZ` | Data/hora do checkpoint |
| `checkpoint_location` | `VARCHAR(255)` | Local do checkpoint |
| `checkpoint_message` | `TEXT` | Mensagem/descrição |

---

### 4.29 Veículos e Entregadores

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `driver_id` | `UUID` | ID do entregador |
| `vehicle_id` | `UUID` | ID do veículo |
| `vehicle_type` | `VARCHAR(30)` | Tipo de veículo |
| `plate_number` | `VARCHAR(20)` | Placa |
| `vehicle_model` | `VARCHAR(100)` | Modelo |
| `vehicle_color` | `VARCHAR(30)` | Cor |
| `vehicle_year` | `INTEGER` | Ano |
| `license_number` | `VARCHAR(50)` | Número da CNH |
| `license_category` | `VARCHAR(10)` | Categoria da CNH |
| `license_expires_at` | `DATE` | Validade da CNH |

#### Tipos de Veículo

```sql
'bicycle'           -- Bicicleta
'motorcycle'        -- Moto
'car'               -- Carro
'van'               -- Van
'truck'             -- Caminhão
'scooter'           -- Patinete
'on_foot'           -- A pé
```

---

### 4.30 Temperatura e Condições (Perecíveis)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `min_temp_celsius` | `DECIMAL(5,2)` | Temperatura mínima |
| `max_temp_celsius` | `DECIMAL(5,2)` | Temperatura máxima |
| `current_temp_celsius` | `DECIMAL(5,2)` | Temperatura atual |
| `humidity_percent` | `INTEGER` | Umidade % |
| `is_refrigerated` | `BOOLEAN` | Precisa refrigeração |
| `is_frozen` | `BOOLEAN` | Precisa congelamento |
| `shelf_life_days` | `INTEGER` | Validade em dias |
| `expires_at` | `DATE` | Data de validade |
| `manufactured_at` | `DATE` | Data de fabricação |
| `batch_number` | `VARCHAR(50)` | Número do lote |

---

### 4.31 Scores e Ratings

* Scores internos: 0 a 10000 (centésimos para precisão)
* Ratings públicos: 0 a 500 (representa 0.0 a 5.0 estrelas)
* Sufixo obrigatório: `_score` ou `_rating`

#### Scores (internos, 0-10000)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `trust_score` | `INTEGER` | Score de confiança (0-10000) |
| `reputation_score` | `INTEGER` | Score de reputação |
| `quality_score` | `INTEGER` | Score de qualidade |
| `risk_score` | `INTEGER` | Score de risco |
| `relevance_score` | `INTEGER` | Score de relevância |
| `punctuality_score` | `INTEGER` | Score de pontualidade |
| `professionalism_score` | `INTEGER` | Score de profissionalismo |
| `diversity_score` | `INTEGER` | Score de diversidade |
| `global_score` | `INTEGER` | Score global consolidado |
| `actor_score` | `INTEGER` | Score do ator |

#### Ratings (públicos, 0-500 = 0.0 a 5.0)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `rating` | `INTEGER` | Rating (0-500) |
| `average_rating` | `INTEGER` | Rating médio |
| `seller_rating` | `INTEGER` | Rating do vendedor |
| `driver_rating` | `INTEGER` | Rating do motorista |
| `service_rating` | `INTEGER` | Rating do serviço |
| `product_rating` | `INTEGER` | Rating do produto |

✔ `trust_score` = 8500 (representa 85.00)
✔ `rating` = 450 (representa 4.5 estrelas)
❌ `score` (sem contexto)
❌ `rating` = 4.5 (não usar float)
❌ `stars` (usar rating)

---

### 4.32 Prioridade e Severidade

* Usar valores padronizados em UPPER_CASE
* Tipo: `VARCHAR(20)`

#### Prioridade

```sql
'BLOCKING'          -- Bloqueante (mais alto)
'CRITICAL'          -- Crítico
'HIGH'              -- Alta
'MEDIUM'            -- Média
'LOW'               -- Baixa
'ATTENTION'         -- Atenção necessária
```

#### Severidade (alertas/incidentes)

```sql
'CRITICAL'          -- Crítico (sistema down)
'ERROR'             -- Erro
'WARNING'           -- Aviso
'INFO'              -- Informação
'AUDIT'             -- Auditoria
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `priority` | `VARCHAR(20)` | Prioridade |
| `severity` | `VARCHAR(20)` | Severidade |
| `urgency` | `VARCHAR(20)` | Urgência |
| `impact` | `VARCHAR(20)` | Impacto |

❌ Não misturar: `'HIGH'` vs `'high'` vs `'High'`

---

### 4.33 Visibilidade e Privacidade

* Valores padronizados em lowercase
* Tipo: `VARCHAR(20)`

```sql
'public'            -- Público (todos podem ver)
'private'           -- Privado (só o dono)
'restricted'        -- Restrito (grupo específico)
'followers'         -- Apenas seguidores
'group'             -- Apenas membros do grupo
'unlisted'          -- Não listado (com link)
'internal'          -- Interno (apenas equipe)
'secret'            -- Secreto
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `visibility` | `VARCHAR(20)` | Visibilidade do conteúdo |
| `privacy` | `VARCHAR(20)` | Configuração de privacidade |
| `access_level` | `VARCHAR(20)` | Nível de acesso |

---

### 4.34 Canais de Comunicação

* Valores padronizados em lowercase
* Tipo: `VARCHAR(20)`

```sql
'push'              -- Push notification
'sms'               -- SMS
'email'             -- E-mail
'whatsapp'          -- WhatsApp
'voice'             -- Ligação de voz
'in_app'            -- Notificação no app
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `channel` | `VARCHAR(20)` | Canal de comunicação |
| `notification_channel` | `VARCHAR(20)` | Canal de notificação |
| `preferred_channel` | `VARCHAR(20)` | Canal preferido |

---

### 4.35 Tipos de Entidade

* Valores padronizados em lowercase
* Tipo: `VARCHAR(30)`

```sql
'user'              -- Usuário pessoa física
'page'              -- Página de negócio
'store'             -- Loja
'group'             -- Grupo
'company'           -- Empresa
'organization'      -- Organização
'system'            -- Sistema
'bot'               -- Bot/automação
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `entity_type` | `VARCHAR(30)` | Tipo de entidade |
| `owner_type` | `VARCHAR(30)` | Tipo do proprietário |
| `author_type` | `VARCHAR(30)` | Tipo do autor |

---

### 4.36 Tipos de Ator (Actor)

* Valores padronizados em lowercase
* Tipo: `VARCHAR(30)`

```sql
'user'              -- Usuário pessoa física
'page'              -- Página de negócio
'system'            -- Sistema/automação
'service_provider'  -- Prestador de serviço
'driver'            -- Motorista/entregador
'worker'            -- Trabalhador
'customer'          -- Cliente
'seller'            -- Vendedor
'buyer'             -- Comprador
'organizer'         -- Organizador de evento
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `actor_type` | `VARCHAR(30)` | Tipo de ator |
| `participant_type` | `VARCHAR(30)` | Tipo de participante |
| `recipient_type` | `VARCHAR(30)` | Tipo de destinatário |

---

### 4.37 Roles (Papéis)

* Valores padronizados em lowercase
* Tipo: `VARCHAR(30)`

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
| `role` | `VARCHAR(30)` | Papel do usuário |
| `membership_role` | `VARCHAR(30)` | Papel na associação |
| `team_role` | `VARCHAR(30)` | Papel no time |

---

### 4.38 Source/Origin (Origem)

* Valores padronizados em lowercase
* Tipo: `VARCHAR(50)`

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
| `source` | `VARCHAR(50)` | Origem do registro |
| `origin` | `VARCHAR(50)` | Origem do registro |
| `acquisition_source` | `VARCHAR(50)` | Origem da aquisição |
| `traffic_source` | `VARCHAR(50)` | Origem do tráfego |
| `lead_source` | `VARCHAR(50)` | Origem do lead |

---

### 4.39 Event Types (Tipos de Evento)

* Formato: `domain.entity.action`
* Valores em lowercase com pontos
* Tipo: `VARCHAR(100)`

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
|-------|------|-----------|
| `event_type` | `VARCHAR(100)` | Tipo do evento |
| `action_type` | `VARCHAR(100)` | Tipo da ação |
| `trigger_type` | `VARCHAR(100)` | Tipo do gatilho |

---

### 4.40 Documentos Brasileiros (BR)

| Campo | Tipo | Descrição | Validação |
|-------|------|-----------|-----------|
| `cpf` | `VARCHAR(11)` | CPF (somente números) | 11 dígitos |
| `cnpj` | `VARCHAR(14)` | CNPJ (somente números) | 14 dígitos |
| `tax_id` | `VARCHAR(14)` | CPF ou CNPJ | 11 ou 14 dígitos |
| `rg` | `VARCHAR(20)` | RG | Varia por estado |
| `pis` | `VARCHAR(11)` | PIS/PASEP | 11 dígitos |
| `cnh` | `VARCHAR(11)` | CNH | 11 dígitos |
| `passport` | `VARCHAR(20)` | Passaporte | - |
| `voter_id` | `VARCHAR(12)` | Título de eleitor | 12 dígitos |

✔ `cpf` = `'12345678901'`
❌ `cpf` = `'123.456.789-01'` (sem formatação)

---

### 4.41 Dados Bancários (BR)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `bank_code` | `VARCHAR(3)` | Código do banco (ex: '001') |
| `bank_name` | `VARCHAR(100)` | Nome do banco |
| `branch_number` | `VARCHAR(10)` | Número da agência |
| `branch_digit` | `VARCHAR(2)` | Dígito da agência |
| `account_number` | `VARCHAR(20)` | Número da conta |
| `account_digit` | `VARCHAR(2)` | Dígito da conta |
| `account_type` | `VARCHAR(20)` | Tipo: `'checking'`, `'savings'` |
| `pix_key` | `VARCHAR(100)` | Chave PIX |
| `pix_key_type` | `VARCHAR(20)` | Tipo: `'cpf'`, `'cnpj'`, `'email'`, `'phone'`, `'random'` |

---

### 4.42 Mídia e URLs

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `avatar_url` | `TEXT` | URL do avatar |
| `cover_url` | `TEXT` | URL da capa |
| `thumbnail_url` | `TEXT` | URL da miniatura |
| `image_url` | `TEXT` | URL da imagem |
| `file_url` | `TEXT` | URL do arquivo |
| `logo_url` | `TEXT` | URL do logo |
| `icon_url` | `TEXT` | URL do ícone |
| `video_url` | `TEXT` | URL do vídeo |
| `audio_url` | `TEXT` | URL do áudio |
| `share_url` | `TEXT` | URL para compartilhamento |

✔ `avatar_url`
✔ `cover_url`
❌ `avatar` (usar `avatar_url`)
❌ `img` (usar `image_url`)

---

### 4.43 Contato

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `phone` | `VARCHAR(20)` | Telefone (E.164: +5511999999999) |
| `phone_country_code` | `VARCHAR(5)` | Código do país (+55) |
| `phone_number` | `VARCHAR(15)` | Número sem código do país |
| `email` | `VARCHAR(255)` | E-mail |
| `whatsapp` | `VARCHAR(20)` | WhatsApp (formato E.164) |
| `website` | `TEXT` | Website |

✔ `phone` = `'+5511999999999'`
❌ `phone` = `'(11) 99999-9999'` (sem formatação)

---

### 4.44 Idioma e Localização

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `language` | `VARCHAR(5)` | Código do idioma (ISO 639-1: pt, en) |
| `locale` | `VARCHAR(10)` | Locale completo (pt-BR, en-US) |
| `country_code` | `CHAR(2)` | ISO 3166-1 alpha-2 (BR, US) |
| `region_code` | `VARCHAR(10)` | Código da região/estado |
| `currency` | `CHAR(3)` | ISO 4217 (BRL, USD) |
| `timezone` | `VARCHAR(50)` | IANA timezone |

---

### 4.45 Subscription e Billing

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `subscription_id` | `UUID` | ID da assinatura |
| `plan_id` | `UUID` | ID do plano |
| `billing_cycle` | `VARCHAR(20)` | `'monthly'`, `'yearly'`, `'weekly'` |
| `billing_day` | `INTEGER` | Dia do vencimento (1-31) |
| `trial_days` | `INTEGER` | Dias de trial |
| `trial_ends_at` | `TIMESTAMPTZ` | Fim do trial |
| `current_period_start_at` | `TIMESTAMPTZ` | Início do período atual |
| `current_period_end_at` | `TIMESTAMPTZ` | Fim do período atual |
| `cancelled_at` | `TIMESTAMPTZ` | Data do cancelamento |
| `cancel_at_period_end` | `BOOLEAN` | Cancelar no fim do período |

---

### 4.46 Limites e Ranges

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `min_quantity` | `INTEGER` | Quantidade mínima |
| `max_quantity` | `INTEGER` | Quantidade máxima |
| `min_amount_cents` | `BIGINT` | Valor mínimo |
| `max_amount_cents` | `BIGINT` | Valor máximo |
| `min_age` | `INTEGER` | Idade mínima |
| `max_age` | `INTEGER` | Idade máxima |
| `min_distance_meters` | `INTEGER` | Distância mínima |
| `max_distance_meters` | `INTEGER` | Distância máxima |
| `capacity_min` | `INTEGER` | Capacidade mínima |
| `capacity_max` | `INTEGER` | Capacidade máxima |

✔ `min_quantity`, `max_quantity`
✔ `capacity_min`, `capacity_max`
❌ `minQty`, `maxQty` (abreviações)

---

### 4.47 Métricas e Contadores

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `view_count` | `INTEGER` | Contagem de visualizações |
| `like_count` | `INTEGER` | Contagem de likes |
| `share_count` | `INTEGER` | Contagem de compartilhamentos |
| `comment_count` | `INTEGER` | Contagem de comentários |
| `order_count` | `INTEGER` | Contagem de pedidos |
| `total_orders` | `INTEGER` | Total de pedidos |
| `total_revenue_cents` | `BIGINT` | Receita total |
| `average_rating` | `INTEGER` | Rating médio (0-500) |
| `average_response_time_seconds` | `INTEGER` | Tempo médio de resposta |

✔ `view_count`
✔ `total_orders`
❌ `views` (usar `view_count`)
❌ `total` (sem contexto)

---

### 4.48 Método de Pagamento

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `payment_method` | `VARCHAR(30)` | Método de pagamento |
| `payment_method_type` | `VARCHAR(30)` | Tipo do método |

#### Valores Padronizados

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

❌ PROIBIDO: `UNIFYCARD`, `PIX` (maiúsculas)

---

### 4.49 Gênero

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `gender` | `VARCHAR(20)` | Gênero |

#### Valores Padronizados

```sql
'male'              -- Masculino
'female'            -- Feminino
'non_binary'        -- Não-binário
'other'             -- Outro
'prefer_not_to_say' -- Prefere não dizer
```

❌ Não usar `sex` (usar `gender`)
❌ Não usar `'M'`, `'F'` (usar valores completos)

---

### 4.50 Conteúdo e Categorias

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `content_type` | `VARCHAR(30)` | Tipo de conteúdo |
| `category` | `VARCHAR(50)` | Categoria |
| `subcategory` | `VARCHAR(50)` | Subcategoria |
| `tags` | `TEXT[]` | Tags/etiquetas |

#### Content Types

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
```

---

### 4.51 Entry Types (Ledger)

* Valores em lowercase
* Tipo: `VARCHAR(30)`
* Coluna: `entry_type`

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

❌ PROIBIDO: `CREDIT`, `DEBIT` (maiúsculas)

---

### 4.52 Transaction Types

* Valores em lowercase
* Tipo: `VARCHAR(30)`
* Coluna: `transaction_type`

```sql
'transfer'          -- Transferência
'deposit'           -- Depósito
'withdrawal'        -- Saque
'payment'           -- Pagamento
'refund'            -- Reembolso
'pix'               -- PIX
'voucher'           -- Voucher
```

❌ PROIBIDO: `DEPOSIT`, `REFUND`, `PIX` (maiúsculas)

---

### 4.53 Split Types

* Valores em lowercase
* Tipo: `VARCHAR(30)`
* Coluna: `split_type`

```sql
'revenue_share'     -- Divisão de receita
'regional_fund'     -- Fundo regional
'fee'               -- Taxa
'reserve'           -- Reserva
'referral'          -- Indicação
'platform'          -- Plataforma
```

---

### 4.54 System Account Names

* Valores em lowercase
* Tipo: `VARCHAR(30)`
* Coluna: `system_account_name`

```sql
'fee'               -- Conta de taxas
'regional_fund'     -- Fundo regional
'reserve'           -- Reserva
'escrow'            -- Conta escrow
'platform'          -- Conta da plataforma
'referral'          -- Conta de indicações
```

---

### 4.55 Scope Types

* Valores em lowercase
* Tipo: `VARCHAR(30)`
* Coluna: `scope`

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

---

### 4.56 Context Types

* Valores em lowercase
* Tipo: `VARCHAR(50)`
* Coluna: `context`

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

---

### 4.57 Action Types

* Valores em lowercase com underscore
* Tipo: `VARCHAR(50)`
* Coluna: `action` ou `action_type`

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

---

### 4.58 Reason Types

* Valores em lowercase com underscore
* Tipo: `VARCHAR(50)`
* Coluna: `reason` ou `reason_code`

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

---

### 4.59 Mode Types

* Valores em lowercase
* Tipo: `VARCHAR(30)`
* Coluna: `mode`

```sql
'now'               -- Agora
'scheduled'         -- Agendado
'same_neighborhood' -- Mesmo bairro
'home'              -- Em casa
```

❌ PROIBIDO: Valores em português (`COMPRA`, `ALUGUEL`, `NAO_SEI`)

---

### 4.60 Level Types

* Valores em lowercase ou código (L0, L2)
* Tipo: `VARCHAR(20)`
* Coluna: `level`

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

---

### 4.61 Attendance Status

* Valores em UPPER_CASE
* Tipo: `VARCHAR(20)`
* Coluna: `attendance_status`

```sql
'PRESENT'           -- Presente
'NO_SHOW'           -- Não compareceu
'LEFT_EARLY'        -- Saiu antes
'CHECKED_IN'        -- Check-in feito
'CHECKED_OUT'       -- Check-out feito
```

---

### 4.62 Check-in Status

* Valores em UPPER_CASE
* Tipo: `VARCHAR(20)`
* Coluna: `checkin_status`

```sql
'PENDING'           -- Pendente
'CONFIRMED'         -- Confirmado
'CANCELLED'         -- Cancelado
```

---

### 4.63 Dispute Status

* Valores em UPPER_CASE
* Tipo: `VARCHAR(20)`
* Coluna: `dispute_status`

```sql
'NONE'              -- Nenhuma disputa
'OPENED'            -- Aberta
'IN_PROGRESS'       -- Em andamento
'RESOLVED'          -- Resolvida
'ESCALATED'         -- Escalada
'CLOSED'            -- Fechada
```

---

### 4.64 Result Types

* Valores em UPPER_CASE
* Tipo: `VARCHAR(20)`
* Coluna: `result`

```sql
'SUCCESS'           -- Sucesso
'FAILED'            -- Falhou
'PARTIAL'           -- Parcial
'SKIPPED'           -- Pulado
```

---

### 4.65 Order Types

* Valores em lowercase
* Tipo: `VARCHAR(30)`
* Coluna: `order_type`

```sql
'service_order'     -- Ordem de serviço
'booking'           -- Reserva
'rfq'               -- Request for Quote
'product_order'     -- Pedido de produto
'subscription'      -- Assinatura
```

---

### 4.66 Pricing Types

* Valores em lowercase
* Tipo: `VARCHAR(20)`
* Coluna: `pricing_type`

```sql
'fixed'             -- Fixo
'hourly'            -- Por hora
'daily'             -- Por dia
'per_unit'          -- Por unidade
'percentage'        -- Percentual
'tiered'            -- Por faixa
```

---

### 4.67 Discount Types

* Valores em lowercase
* Tipo: `VARCHAR(20)`
* Coluna: `discount_type`

```sql
'percent'           -- Percentual
'fixed'             -- Valor fixo
'buy_x_get_y'       -- Compre X leve Y
'first_purchase'    -- Primeira compra
```

---

### 4.68 Direction Types

* Valores em lowercase
* Tipo: `VARCHAR(10)`
* Coluna: `direction`

```sql
'in'                -- Entrada
'out'               -- Saída
'inbound'           -- Entrada (comunicação)
'outbound'          -- Saída (comunicação)
```

---

### 4.69 Service Categories

* Valores em lowercase com underscore
* Tipo: `VARCHAR(50)`
* Coluna: `category` (quando contexto é serviço)

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

---

### 4.70 Health Categories

* Valores em lowercase
* Tipo: `VARCHAR(30)`
* Coluna: `category` (quando contexto é saúde)

```sql
'vision'            -- Visão
'dental'            -- Odontológico
'mental'            -- Saúde mental
'mobility'          -- Mobilidade
'medications'       -- Medicamentos
'general'           -- Geral
```

---

### 4.71 System Categories

* Valores em lowercase
* Tipo: `VARCHAR(30)`
* Coluna: `category` (quando contexto é sistema)

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

---

# PARTE II — BACKEND E API

## 5. BACKEND

### 5.1 Classes, Entidades e Tipos

* `PascalCase`

✔ `User`
✔ `BankTransaction`
✔ `LedgerEntry`
✔ `PaymentIntent`
✔ `DeliveryOrder`
✔ `InventoryItem`

---

### 5.2 Propriedades internas (Domínio)

* `camelCase`

✔ `userId`
✔ `globalUserId`
✔ `amountCents`
✔ `pickupLatitude`
✔ `distanceMeters`
✔ `trustScore`
❌ `user_id`
❌ `GlobalUserID`

---

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

---

### 5.4 Enums e Literais

* Valores de enum em API: `snake_case` (padrão de mercado)
* Identificadores de enum em código: `PascalCase`

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

---

## 6. API (CONTRATO PÚBLICO)

### 6.1 Regra Geral

* `camelCase` obrigatório
* Nunca refletir `snake_case` do banco

---

### 6.2 Campos com Sufixos Obrigatórios

| Tipo | Sufixo | Exemplo |
|------|--------|---------|
| Identificador | `Id` | `userId`, `orderId` |
| Timestamp | `At` | `createdAt`, `paidAt` |
| Monetário | `Cents` | `amountCents`, `feeCents` |
| Percentual | `Bps` | `feeRateBps`, `taxRateBps` |
| Distância | `Meters` | `distanceMeters` |
| Duração (seg) | `Seconds` | `durationSeconds` |
| Duração (min) | `Minutes` | `durationMinutes` |
| Peso | `Grams` | `weightGrams` |
| URL | `Url` | `avatarUrl`, `coverUrl` |
| Score | `Score` | `trustScore`, `riskScore` |
| Rating | `Rating` | `averageRating` |
| Contagem | `Count` | `viewCount`, `likeCount` |

---

### 6.3 Campos com Prefixos Obrigatórios

| Tipo | Prefixo | Exemplo |
|------|---------|---------|
| Booleano estado | `is` | `isActive`, `isVerified` |
| Booleano capacidade | `can` | `canWithdraw`, `canEdit` |
| Booleano propriedade | `has` | `hasPermission`, `hasSplit` |
| Booleano requisito | `requires` | `requiresSignature` |
| Mínimo | `min` | `minQuantity`, `minAmount` |
| Máximo | `max` | `maxQuantity`, `maxAmount` |

---

### 6.4 Valores de Enum na API

* Status, types, roles: mantêm `snake_case` nos valores
* Priority, severity: mantêm `UPPER_CASE` nos valores

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

#### Regra de Case para Valores de Enum

| Tipo de Campo | Case | Exemplo |
|---------------|------|---------|
| `status` | lowercase snake_case | `'in_transit'` |
| `type` | lowercase snake_case | `'service_order'` |
| `role` | lowercase | `'admin'` |
| `visibility` | lowercase | `'public'` |
| `scope` | lowercase | `'professional'` |
| `context` | lowercase snake_case | `'service_booking'` |
| `action` | lowercase snake_case | `'create_post'` |
| `origin` | lowercase snake_case | `'store_pdv'` |
| `mode` | lowercase snake_case | `'same_neighborhood'` |
| `category` | lowercase snake_case | `'venue_rental'` |
| `priority` | UPPER_CASE | `'HIGH'` |
| `severity` | UPPER_CASE | `'CRITICAL'` |
| `level` (log) | lowercase | `'info'` |
| `entry_type` | lowercase | `'credit'` |
| `split_type` | lowercase snake_case | `'revenue_share'` |
| `result` | UPPER_CASE | `'SUCCESS'` |
| `attendance_status` | UPPER_CASE | `'PRESENT'` |
| `checkin_status` | UPPER_CASE | `'CONFIRMED'` |
| `dispute_status` | UPPER_CASE | `'OPENED'` |

---

## 7. FRONTEND

* Espelha **exatamente** o contrato da API
* Não cria aliases
* Não renomeia campos
* Não adapta semântica

---

## 8. EVENTOS E MENSAGERIA

### 8.1 Nome de evento

* Formato: `domain.entity.action`
* Tudo em lowercase com pontos

✔ `payment.captured`
✔ `order.completed`
✔ `delivery.picked_up`
✔ `user.verified`
✔ `group.member.joined`
❌ `PaymentCaptured`
❌ `PAYMENT_CAPTURED`

### 8.2 Payload

* Segue contrato da API (`camelCase`)
* Inclui `eventType`, `correlationId`, `timestamp`

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

# PARTE III — TABELAS DE CONVERSÃO

## 9. TABELA DE CONVERSÃO COMPLETA

### Identificadores

| Banco | Backend/API |
|-------|-------------|
| `user_id` | `userId` |
| `actor_id` | `actorId` |
| `tenant_id` | `tenantId` |
| `order_id` | `orderId` |
| `driver_id` | `driverId` |
| `entity_id` | `entityId` |
| `split_id` | `splitId` |
| `entry_id` | `entryId` |

### Timestamps

| Banco | Backend/API |
|-------|-------------|
| `created_at` | `createdAt` |
| `verified_at` | `verifiedAt` |
| `delivered_at` | `deliveredAt` |
| `expires_at` | `expiresAt` |
| `scheduled_at` | `scheduledAt` |

### Monetários

| Banco | Backend/API |
|-------|-------------|
| `amount_cents` | `amountCents` |
| `fee_cents` | `feeCents` |
| `balance_cents` | `balanceCents` |
| `tip_cents` | `tipCents` |
| `gross_cents` | `grossCents` |
| `net_cents` | `netCents` |

### Scores e Ratings

| Banco | Backend/API |
|-------|-------------|
| `trust_score` | `trustScore` |
| `reputation_score` | `reputationScore` |
| `risk_score` | `riskScore` |
| `average_rating` | `averageRating` |

### Types e Enums

| Banco | Backend/API |
|-------|-------------|
| `entity_type` | `entityType` |
| `actor_type` | `actorType` |
| `event_type` | `eventType` |
| `payment_method` | `paymentMethod` |
| `entry_type` | `entryType` |
| `split_type` | `splitType` |
| `transaction_type` | `transactionType` |
| `order_type` | `orderType` |

### Métricas

| Banco | Backend/API |
|-------|-------------|
| `view_count` | `viewCount` |
| `order_count` | `orderCount` |
| `total_orders` | `totalOrders` |

---

# PARTE IV — PROIBIÇÕES E GOVERNANÇA

## 10. PROIBIÇÕES EXPLÍCITAS

É **PROIBIDO**:

### Nomenclatura

* Misturar `snake_case` e `camelCase` na mesma camada
* Expor nomes de coluna na API
* Criar aliases "temporários"
* Manter dois nomes para o mesmo conceito
* Renomear sem Gate
* Converter formato fora de mapper

### Monetário

* Armazenar dinheiro como float/decimal
* Omitir sufixo `_cents`/`Cents`
* Usar nome genérico como `value` ou `amount`

### Percentuais

* Omitir sufixo `_bps`/`Bps`
* Usar `_percent` ou `_percentage`

### Timestamps

* Omitir sufixo `_at`/`At`
* Usar `_date` ou `_time` para timestamps

### Duração

* Usar `_min` como sufixo (ambíguo: minutos ou mínimo?)
* Omitir unidade em durações

### Booleanos

* Omitir prefixo `is_`/`is`
* Usar `flag` como sufixo

### IDs

* Usar abreviações (`usr_id`, `ext_id`)
* Omitir `_id`/`Id`

### Idioma

* Usar valores de enum em português
* Usar nomes de campos em português
* Misturar idiomas no mesmo enum

Todos os valores de enum devem ser em **INGLÊS**.

Exemplos de violação:
```
❌ 'PENDENTE' → ✔ 'pending'
❌ 'COMPRA' → ✔ 'purchase'
❌ 'ALUGUEL' → ✔ 'rental'
❌ 'NAO_SEI' → ✔ 'unknown'
```

### Outros

* Usar códigos de moeda fora ISO 4217
* Usar timezones fora IANA
* Transações sem `idempotency_key`
* Abreviações (`lat`, `lng`, `qty`, `addr`, `msg`)

---

## 11. GOVERNANÇA

Qualquer mudança de nome:

* É mudança de contrato
* Exige Gate formal
* Exige atualização deste documento
* Exige impacto mapeado

**Refactor silencioso NÃO EXISTE.**

---

## 12. CHECKLIST DE VALIDAÇÃO

Antes de criar qualquer campo:

| Categoria | Verificação |
|-----------|-------------|
| **Geral** | É `snake_case` no banco? É `camelCase` na API? |
| **ID** | Termina com `_id`/`Id`? |
| **Timestamp** | Termina com `_at`/`At`? Usa `TIMESTAMPTZ`? |
| **Monetário** | Termina com `_cents`/`Cents`? É `BIGINT`? |
| **Percentual** | Termina com `_bps`/`Bps`? É `INTEGER`? |
| **Booleano** | Tem prefixo `is_`/`has_`/`can_`? |
| **Duração** | Termina com `_seconds` ou `_minutes`? |
| **Score** | Termina com `_score`? É `INTEGER` (0-10000)? |
| **Rating** | Termina com `_rating`? É `INTEGER` (0-500)? |
| **URL** | Termina com `_url`/`Url`? |
| **Count** | Termina com `_count`/`Count`? |
| **Enum** | Valores em inglês? Case correto? |

---

## 13. PADRÕES DE MERCADO REFERENCIADOS

| Fonte | Padrões Adotados |
|-------|------------------|
| **Stripe** | Idempotency, status lifecycle, centavos |
| **Adyen** | Reference ID, split payments |
| **ISO 4217** | Códigos de moeda |
| **ISO 8601** | Timestamps |
| **ISO 3166** | Códigos de país |
| **IANA** | Timezones |
| **OpenTelemetry** | trace_id, correlation_id |
| **Double-Entry** | debit/credit, ledger |
| **Google Maps** | Coordenadas, distância |
| **Uber/iFood** | Status de delivery |
| **Correios/FedEx** | Tracking, checkpoints |
| **WMS** | SKU, inventory |
| **RFC 5545** | RRULE, recorrência |
| **SI** | Unidades de medida |
| **E.164** | Formato de telefone |

---

## 14. REGRA FINAL

Se surgir dúvida sobre nomenclatura:

→ **Consultar este documento**

Se não estiver aqui:

→ **NÃO PODE SER CRIADO**

---

**FIM DO DOCUMENTO**

---

*Documento consolidado em 2026-02-07*
*Versão 2.0 — Auditoria completa do sistema*
*Total de seções: 71*
*Cobertura: 100% dos padrões identificados no código*
