# PLANO DE CORREÇÃO — NOMENCLATURA CANÔNICA
## UnifiCard · Baseado em auditoria verificada com evidência de linha

> ## 🔴 STATUS: **VIGENTE COM NÚMEROS VENCIDOS** (tarja de 2026-07-31, autorizada por Clayton)
>
> **A doutrina deste plano continua certa** (`_cents`, prefixo `is_`, camelCase em interface,
> kebab-case de arquivo, evento `v1.`) e **ainda tem violações vivas**. **As CONTAGENS de
> 2026-04-09 não são o estado atual** — reamostragem de 2026-07-31 contra `unificard_dev`:
>
> | Eixo | O que o plano diz | O que se mediu em 2026-07-31 |
> |---|---|---|
> | 1 — migrations SQL | 25 violações | **~90% já fechado**; resíduo real: os 3 booleanos de `tenant_semantic_policy` (o plano ainda erra o nome, escreve plural) |
> | 3 — backend monetário/boolean | 87 + 134 | moldura **stale** (`marketplace-company.service.ts`, `trust.service.ts` não existem mais); mas `ActorCapabilities.can_receive_funds` segue snake_case, vivo |
> | 4 — snake_case em interfaces | 2.162 campos | **INCONCLUSIVO** — arquivos-alvo mudaram de endereço; re-varrer antes de usar o número |
> | 5 — frontend | 249 + 48 | progresso **desigual por arquivo**: `bank.ts` fechado; `dashboard.ts` e `calendar.ts` abertos |
> | 6 — snake_case frontend | 1.543 | **zero progresso** em `marketplace.ts` (cresceu para 5.155 linhas) |
> | 7 — eventos versionados | 60+ | **zero progresso** — `event.custody.created` ainda sem prefixo `v1.` |
> | 8 — nomes de arquivo | 5 | **2 fechados, 3 abertos** |
>
> **Re-varra o eixo ANTES de abrir qualquer sessão `NOMENCLATURA-*`.** A regra 6 abaixo já
> mandava isso e ninguém aplicou em 3,5 meses — foi assim que os números envelheceram sem aviso.
>
> ⚠️ **Referência quebrada:** a linha abaixo aponta o estado operacional para
> `STATUS_EXECUCAO_GLOBAL.md`, que desde 2026-07-28 **se autodeclara HISTÓRICO** (conteúdo parado
> em 2026-07-03), sucedido por `REMEDIATION_DT_LOG.md` (cartório) e
> `docs/04_audit/PAINEL_DIVIDA_VIVA.md` (placar). Use estes dois.

> **ESTADO OPERACIONAL DO §GLOBAL BLOCK:** ver `STATUS_EXECUCAO_GLOBAL.md`  
> **REGRA NORMATIVA:** definida em `PLANO_BASE_MODULO.md` (secção §GLOBAL BLOCK).  
> ⚠️ **Estado operacional pode variar por data.** Ver `STATUS_EXECUCAO_GLOBAL.md`.

**Status:** VIGENTE COM NÚMEROS VENCIDOS · ver tarja acima  
**Normativo:** `07_NOMENCLATURA_CANONICA.md` v3.3.6  
**Data:** 2026-04-09 · **reamostrado:** 2026-07-31  
**Executor:** Cursor (modo código)

---

## INSTRUÇÕES OBRIGATÓRIAS PARA O CURSOR

Leia antes de executar qualquer sessão:

1. **Uma sessão = um eixo.** Nunca misture migrations com TypeScript no mesmo contexto.
2. **Não edite migrations já aplicadas** — crie sempre uma nova migration forward-only.
3. ~~**Não renomeie campos de contratos públicos marcados `// CONGELADO`** — crie arquivo `.v2.contract.ts`.~~
   🔴 **SUSPENSA ENQUANTO O SISTEMA ESTIVER VIRGEM** (Clayton, 2026-07-31). Não há usuário real,
   transação real nem produto cadastrado — nenhum contrato público tem consumidor externo a
   proteger. Criar 54 arquivos `.v2.contract.ts` para zero consumidores fabrica dívida em vez de
   pagá-la. **Enquanto virgem: renomeie NO LUGAR**, sem arquivo v2.
   **Esta suspensão vence no primeiro usuário/transação real** — a partir daí a regra 3 volta a
   valer integralmente e contrato publicado só muda por versão. Quem retomar depois disso:
   confira no banco antes de presumir que ainda é virgem.
4. **Não faça commits parciais** — cada sessão só fecha quando todos os testes do escopo passam.
5. **Conversão `snake_case → camelCase` exclusivamente no `.repository.ts`** — nunca em service, routes ou types.
6. **Verificar antes de editar:** cada item desta lista tem arquivo e linha real. Se o arquivo não tiver o campo indicado, PARAR e reportar — não inventar correção.
7. **Ordem de execução é obrigatória** — cada eixo é pré-requisito do seguinte onde indicado.

---

## VISÃO GERAL DOS EIXOS

| Eixo | Escopo | Violações verificadas | Sessões estimadas |
|------|--------|----------------------|-------------------|
| 1 | Migrations SQL | 25 violações ativas | 1 |
| 2 | Contratos backend (v2) | 54 contratos sem v2; 56 campos monetários | 3 |
| 3 | Módulos backend — monetário + booleanos | 87 monetários; 134+ booleanos | 2 |
| 4 | Módulos backend — snake_case em interfaces | 2.162+ campos | 4 |
| 5 | Frontend `src/api/` — monetário + timestamp | 249 monetários; 48 timestamps | 2 |
| 6 | Frontend `src/api/` — snake_case em interfaces | 1.543+ campos | 3 |
| 7 | Eventos — migração para formato versionado | 60+ eventos legados | 2 |
| 8 | Nomes de arquivos | 5 arquivos frontend | 1 |

**Total de sessões estimadas:** 18 sessões independentes.

---

---

# EIXO 1 — MIGRATIONS SQL

**Sessão:** `NOMENCLATURA-M01`  
**Pré-requisito:** nenhum  
**Arquivos afetados:** `backend/migrations/` (criar novas migrations)

### Regra de execução
Nunca editar migration existente. Criar arquivo novo com timestamp sequencial ao último existente. Cada `ALTER` em bloco `DO $$ BEGIN ... END $$` com verificação de existência da coluna antes de renomear.

### Template obrigatório para cada migration

```sql
BEGIN;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = '<tabela>'
      AND column_name  = '<coluna_antiga>'
  ) THEN
    ALTER TABLE <tabela> RENAME COLUMN <coluna_antiga> TO <coluna_nova>;
  END IF;
END $$;

COMMIT;
```

---

### M01-A — TIMESTAMP sem timezone (3 ocorrências)

Criar: `migrations/YYYYMMDDHHMMSS_fix_timestamp_no_tz.sql`

| Tabela | Coluna | Problema | Correção |
|--------|--------|----------|----------|
| `schema_version` | `applied_at` | `TIMESTAMP` → `TIMESTAMPTZ` | `ALTER COLUMN applied_at TYPE TIMESTAMPTZ` |
| `identities` | `created_at` | `TIMESTAMP` → `TIMESTAMPTZ` | `ALTER COLUMN created_at TYPE TIMESTAMPTZ` |
| `identities` | `updated_at` | `TIMESTAMP` → `TIMESTAMPTZ` | `ALTER COLUMN updated_at TYPE TIMESTAMPTZ` |

**Atenção:** `schema_version` é tabela de controle interno — verificar se tem dados e se a alteração de tipo causa cast implícito seguro (PostgreSQL suporta `TIMESTAMP → TIMESTAMPTZ` sem perda).

---

### M01-B — NUMERIC em campo monetário (5 ocorrências ativas)

Criar: `migrations/YYYYMMDDHHMMSS_fix_monetary_numeric.sql`

| Tabela | Coluna atual | Tipo atual | Coluna nova | Tipo novo | Migration origem |
|--------|-------------|-----------|-------------|-----------|-----------------|
| `tenant_products` | `price` | `NUMERIC(10,2)` | `price_cents` | `BIGINT` | `0112` |
| `orders` | `total_quantity` | `NUMERIC(20,4)` | — | — | `0117` — **não é monetário, é quantidade** — ignorar |
| `product_offers` | `price` | `NUMERIC(12,4)` | `price_cents` | `BIGINT` | `0122` — verificar se `20260331150000` já corrigiu |
| `product_prices` | `price` | `NUMERIC(20,2)` | `price_cents` | `BIGINT` | `20260415120000` — verificar se `20260416100000` já corrigiu |
| `promotions` | `value` | `NUMERIC(20,2)` | `value_cents` | `BIGINT` | `20260415120100` — verificar se `20260416100000` já corrigiu |
| `economic_guardianship` | `limit_amount` | `NUMERIC` | `limit_amount_cents` | `BIGINT` | `20260501100000` |

**Passo obrigatório antes de executar:** para cada tabela, verificar se a migration de correção já existe e foi aplicada (`SELECT column_name FROM information_schema.columns WHERE table_name = '<tabela>'`). Só criar migration para as que ainda têm a coluna velha.

**Fórmula de conversão para monetário:** `price_cents = GREATEST(0, ROUND(price * 100)::BIGINT)`

---

### M01-C — Booleanos sem prefixo (15 ocorrências)

Criar: `migrations/YYYYMMDDHHMMSS_fix_boolean_prefixes.sql`

| Tabela | Coluna atual | Coluna correta | Migration origem |
|--------|-------------|---------------|-----------------|
| `bank_accounts` ou tabela de `bank_core` | `operation_blocked` | `is_operation_blocked` | `0003` |
| `events` ou tabela de eventos | `kill_switch` | `is_kill_switch_active` | `0005` |
| `events` | `false_positive` | `is_false_positive` | `0005` |
| `reconciliation_ledger_discrepancies` | `resolved` | `is_resolved` | `0053` |
| `users` ou profiles | `profile_personal_confirmed` | `is_profile_personal_confirmed` | `0058` |
| `categories` | `created_by_ai` | `is_created_by_ai` | `0061` |
| `feature_flags` | `enabled` | `is_enabled` | `0062` |
| `tenant_semantic_policies` | `allow_slug_fallback` | `allows_slug_fallback` | `0070` |
| `tenant_semantic_policies` | `log_fallback_as_error` | `logs_fallback_as_error` | `0070` |
| `tenant_semantic_policies` | `enforce_graph` | `enforces_graph` | `0070` |
| `tenant_concept_offerings` | `active` | `is_active` | `0072` |
| `category_write_prereqs` (função/temp) | `created` | `is_created` | `0097` |
| `category_from_concept_lock` (função/temp) | `created` | `is_created` | `0110` |
| `tenant_products` | `availability` | `is_available` | `0112` |
| `product_offers` | `active` | `is_active` | `0122` |

**Atenção:** `created_by_ai`, `enabled`, `active`, `availability` podem ter referências em código TypeScript. Após a migration, buscar e atualizar os repositories correspondentes (parte do Eixo 4).

**Verificar nome real das tabelas:** as migrations `0097` e `0110` criam `created BOOLEAN` em contexto de função PL/pgSQL — pode ser variável local, não coluna. Inspecionar antes de criar migration.

---

---

# EIXO 2 — CONTRATOS BACKEND (criação de v2)

**Sessão base:** `NOMENCLATURA-C01`, `C02`, `C03`  
**Pré-requisito:** nenhum (paralelo ao Eixo 1)  
**Regra:** Nunca editar `*.contract.ts` marcado `// CONGELADO`. Criar `*.v2.contract.ts` ao lado.

### Estrutura obrigatória de arquivo v2

```typescript
// backend/src/contracts/marketplace/<Nome>.v2.contract.ts
// CONTRATO v2 — <Nome> (nomenclatura canônica §07)
// v1: <Nome>.contract.ts (CONGELADO) — <descrição do problema>
// Criado: YYYY-MM-DD

import type { MoneyAmountCents, RateBps, Iso4217CurrencyCode } from './_canonical/money.types';

export interface <Nome>V2 {
  // ... campos corrigidos
}
```

### Tipos canônicos disponíveis em `_canonical/money.types.ts`

- `MoneyAmountCents` — para preços, valores, saldos
- `RateBps` — para taxas percentuais (basis points)
- `Iso4217CurrencyCode` — para moeda (`'BRL'`, `'USD'`)

---

### Sessão C01 — Contratos com violações monetárias críticas (prioridade 1)

**Arquivos a criar** (todos em `backend/src/contracts/marketplace/`):

#### `RegionalImpactMetrics.v2.contract.ts` — já existe ✅
Verificar se consumidores estão usando v1 ou v2. Migrar consumidores para v2.

#### `Order.v2.contract.ts`
Campo problemático: `subtotal: number` (linha ~1933)  
Correção: `subtotalCents: number` com `orderCurrency: Iso4217CurrencyCode`

#### `CheckoutIntent.v2.contract.ts` — já existe ✅
Consumidores: verificar `import { CheckoutIntent }` em todo o backend e frontend. Migrar para `CheckoutIntentV2`.

#### `B2BCommercialContract.v2.contract.ts` — já existe ✅
Campos problemáticos na v1: `unitPrice: number`, `penaltyRate?: number`  
v2 corrige para `unitPrice: MoneyAmountCents`, `penaltyRateBps?: RateBps`. Migrar consumidores.

#### `DistributionHub.v2.contract.ts`
Campos: `fixedAmount?: number` → `fixedAmountCents?: number`; `costPerKm?: number` → `costPerKmCents?: number`; `baseCost?: number` → `baseCostCents?: number`

#### `EconomicSustainabilitySnapshot.v2.contract.ts`
Campos: `totalFixedCost: number` → `totalFixedCostCents: number`; `averageVariableCost: number` → `averageVariableCostCents: number`; `averagePrice: number` → `averagePriceCents: number`

#### `EconomicIdentity.v2.contract.ts`
Campos: `limits.maxInvoiceAmount: number` → `maxInvoiceAmountCents: number`; `limits.maxMonthlyVolume: number` → `maxMonthlyVolumeCents: number`

#### `RegionalFund.v2.contract.ts`
Campos: `balance: number` → `balanceCents: number`; `maxMonthlyOutflow: number` → `maxMonthlyOutflowCents: number`

---

### Sessão C02 — Contratos com violações monetárias (prioridade 2)

#### `ResourceCompensation.v2.contract.ts`
Campos: `baseValue: number` → `baseValueCents: number`; `fixedValueApplied: number` → `fixedValueAppliedCents: number`

#### `ServiceResource.v2.contract.ts`
Campos: `percentValue: number` → `percentValueBps: RateBps`; `fixedAmount: number` → `fixedAmountCents: number`

#### `ReputationSnapshot.v2.contract.ts`
Campos: `fulfillmentPenalty: number` → `fulfillmentPenaltyCents: number`; `cancellationPenalty: number` → `cancellationPenaltyCents: number`; `disputePenalty: number` → `disputePenaltyCents: number`

#### `ActivationEvent.v2.contract.ts`
Campo: `actionPayload.maxAmount?: number` → `maxAmountCents?: number`

#### `IndustryAccount.v2.contract.ts`
Campo: `minimumPrice?: number` → `minimumPriceCents?: number`

#### `PaymentInfrastructureConfig.v2.contract.ts`
Campo: `regionalFundPercentage: number` → `regionalFundRateBps: RateBps`

#### `PaymentTerminal.v2.contract.ts`
Campo: `regionalFundPercentage: number` → `regionalFundRateBps: RateBps`

---

### Sessão C03 — Contratos restantes + migração de consumidores

#### Contratos a criar (sem violações monetárias, mas sem v2):
Todos os 54 contratos sem v2 precisam de versão atualizada com `MoneyAmountCents` nos campos relevantes. Lista completa — criar v2 apenas para os que têm consumidores ativos identificados por:

```bash
# Comando para encontrar consumidores de cada contrato v1:
grep -rn "import.*<NomeContrato>" backend/src/ frontend/src/ --include="*.ts"
```

#### Migração de consumidores dos 6 contratos que já têm v2:
```bash
# Encontrar todos os imports da v1
grep -rn "from.*CheckoutIntent\.contract" backend/src/ frontend/src/
grep -rn "from.*B2BCommercialContract\.contract" backend/src/ frontend/src/
grep -rn "from.*RegionalImpactMetrics\.contract" backend/src/ frontend/src/
grep -rn "from.*EconomicEvent\.contract" backend/src/ frontend/src/
grep -rn "from.*RegionalActivationRule\.contract" backend/src/ frontend/src/
grep -rn "from.*SLAContract\.contract" backend/src/ frontend/src/
```

Para cada import encontrado: substituir `<Nome>` por `<Nome>V2` e ajustar o path para `.v2.contract`.

---

---

# EIXO 3 — MÓDULOS BACKEND — MONETÁRIO E BOOLEANOS

**Sessão:** `NOMENCLATURA-B01`, `B02`  
**Pré-requisito:** Eixo 1 concluído (para não criar conflito com nomes de colunas)  
**Regra:** Alterar apenas interfaces TypeScript e DTOs internos. Não alterar banco de dados aqui.

### Prioridade por módulo (verificado)

| Módulo | Monetários sem Cents | Booleanos sem prefixo | Sessão |
|--------|--------------------|-----------------------|--------|
| `modules/marketplace` | 152 | 181 | B01 |
| `modules/rides` | 57 | 4 | B01 |
| `modules/reports` | 34 | 1 | B02 |
| `core/reputation` | 21 | 0 | B02 |
| `core/observability` | 20 | 0 | B02 |
| `core/profile` | 15 | 13 | B02 |
| `modules/events` | 42 | 10 | B02 |
| `modules/social` | 31 | 13 | B02 |

---

### Sessão B01 — marketplace + rides

#### `backend/src/modules/marketplace/`

**Arquivos prioritários identificados:**
- `marketplace-orchestration.service.ts` — 7 monetários, 7 booleanos
- `trust.service.ts` — 13 monetários (`totalReceived`, `totalPaid`, `totalDebt`, `totalGuaranteed`, `change_amount`, `total_received`, `total_paid`, `total_guaranteed`)
- `transparency.service.ts` — 10 monetários (`totalAmount`, `totalIn`, `totalOut`, `netAmount`)
- `marketplace-company.service.ts` — 59 booleanos sem prefixo

**Padrão de correção para booleanos em `marketplace-company.service.ts`:**

```typescript
// ANTES (violação dupla: sem prefixo + mistura de case)
catalog_ready: boolean;
services_ready: boolean;
pdvEnabled: boolean;
marketplaceEnabled: boolean;
b2b_enabled: boolean;

// DEPOIS (padronizado)
isCatalogReady: boolean;
isServicesReady: boolean;
isPdvEnabled: boolean;
isMarketplaceEnabled: boolean;
isB2bEnabled: boolean;
```

**Padrão de correção para monetários:**

```typescript
// ANTES
totalReceived: number;
totalPaid: number;
change_amount: number;

// DEPOIS
totalReceivedCents: number;
totalPaidCents: number;
changeAmountCents: number;
```

#### `backend/src/modules/rides/rides.types.ts`

**Padrão geral:** arquivo inteiro usa snake_case em interfaces. Abordar em Eixo 4.  
**Nesta sessão:** apenas campos monetários sem `_cents`.

Campos a corrigir:
```typescript
// Monetários reais (não contagens):
base_price → base_price_cents (ou após migração para camelCase: basePriceCents)
final_price → final_price_cents
wait_fee_amount → wait_fee_amount_cents
cancellation_fee_passenger → cancellation_fee_passenger_cents
amount_paid_to_driver → amount_paid_to_driver_cents
base_fare → base_fare_cents
driver_amount → driver_amount_cents
platform_amount → platform_amount_cents
fund_amount → fund_amount_cents
referral_amount → referral_amount_cents

// NÃO são monetários — não alterar:
total_trips_completed, total_trips_cancelled (são contagens)
total_distance_km (é distância)
total_duration_min (é duração)
```

---

### Sessão B02 — demais módulos + ActorCapabilities

#### `backend/src/core/actor-registry/actor-registry.service.ts`

**Violação:** interface `ActorCapabilities` usa snake_case (42 ocorrências no codebase).

```typescript
// ANTES
export interface ActorCapabilities {
  can_receive_funds?: boolean;
  can_publish_feed?: boolean;
  can_delegate?: boolean;
  can_hold_assets?: boolean;
  can_create_events?: boolean;
  can_manage_members?: boolean;
  [key: string]: any;
}

// DEPOIS
export interface ActorCapabilities {
  canReceiveFunds?: boolean;
  canPublishFeed?: boolean;
  canDelegate?: boolean;
  canHoldAssets?: boolean;
  canCreateEvents?: boolean;
  canManageMembers?: boolean;
  [key: string]: unknown;
}
```

**Atenção:** após renomear, buscar e atualizar todos os 42 pontos de uso:
```bash
grep -rn "can_receive_funds\|can_publish_feed\|can_delegate\|can_hold_assets\|can_create_events\|can_manage_members" backend/src/ --include="*.ts"
```

#### `backend/src/core/events/events.types.ts`

**Violação dupla:** mesmo conceito com `startTime` (camelCase) e `start_time` (snake_case) em interfaces diferentes do mesmo arquivo.

```typescript
// ANTES — interfaces com startTime
startTime: Date;
endTime: Date;

// ANTES — interfaces com start_time
start_time: Date;
end_time: Date;

// DEPOIS — unificar para startsAt/endsAt (§4.6)
startsAt: Date;
endsAt: Date;
```

**Atenção:** verificar consumidores de ambas as formas antes de renomear:
```bash
grep -rn "startTime\|endTime\|start_time\|end_time" backend/src/core/events/ --include="*.ts"
grep -rn "startTime\|endTime\|start_time\|end_time" backend/src/modules/events/ --include="*.ts"
```

---

---

# EIXO 4 — MÓDULOS BACKEND — SNAKE_CASE EM INTERFACES

**Sessão:** `NOMENCLATURA-S01` a `S04`  
**Pré-requisito:** Eixo 3 concluído  
**Regra crítica:** conversão snake_case → camelCase em interfaces TypeScript de domínio. A conversão banco → código já acontece no `.repository.ts` — não duplicar.

### Ordem por módulo (volume verificado)

| Sessão | Módulos | Snake_case verificado |
|--------|---------|----------------------|
| S01 | `modules/cultural` (355) + `core/cultural-event.service.ts` (220) | 575 |
| S02 | `modules/rides` (387) | 387 |
| S03 | `core/companies` (257) + `modules/social` (347) | 604 |
| S04 | `modules/events` (288) + `core/events` (252) | 540 |

---

### Sessão S01 — cultural

**Arquivo principal:** `backend/src/core/events/cultural-event.service.ts`

**Padrão dominante — interfaces de input em snake_case:**
```typescript
// ANTES (violação §5.1)
export interface CreateCulturalEventInput {
  target_type: 'CULTURAL_PROFILE' | 'REGION' | 'FUND';
  target_id: string;
  tenant_id: string;
  created_by_cultural_profile_id: string;
  co_creators_cultural_profile_ids: string[];
  event_type: EventType;
  datetime_start: string;
  datetime_end: string;
  location_cultural_profile_id: string | null;
  ticket_price_cents: number | null;
  max_attendees: number | null;
}

// DEPOIS
export interface CreateCulturalEventInput {
  targetType: 'CULTURAL_PROFILE' | 'REGION' | 'FUND';
  targetId: string;
  tenantId: string;
  createdByCulturalProfileId: string;
  coCreatorsCulturalProfileIds: string[];
  eventType: EventType;
  startsAt: string;
  endsAt: string;
  locationCulturalProfileId: string | null;
  ticketPriceCents: number | null;
  maxAttendees: number | null;
}
```

**Após renomear interface:** atualizar todos os pontos de criação do objeto:
```bash
grep -rn "CreateCulturalEventInput\|target_type\|target_id\|datetime_start\|datetime_end" backend/src/ --include="*.ts"
```

---

### Sessão S02 — rides

**Arquivo:** `backend/src/modules/rides/rides.types.ts`

**Padrão:** arquivo inteiro em snake_case — 172 campos. Estratégia:

1. Converter todas as interfaces de snake_case para camelCase
2. Verificar todos os repositories de rides que fazem a conversão banco→código — eles já devem retornar camelCase; se estiverem retornando snake_case, corrigir o mapeamento no repository
3. Verificar rotas de rides que recebem snake_case como body HTTP — manter snake_case no body da requisição, mapear para camelCase na função handler

**Amostra de interface a converter:**
```typescript
// ANTES
export interface Region {
  region_id: UUID;
  tenant_id: UUID;
  name: string;
  metadata: JSONValue;
  createdAt: string;  // mistura!
  updatedAt: string;
}

// DEPOIS
export interface Region {
  regionId: UUID;
  tenantId: UUID;
  name: string;
  metadata: JSONValue;
  createdAt: string;
  updatedAt: string;
}
```

---

### Sessões S03 e S04 — companies, social, events

Mesmo padrão das sessões S01/S02. Executar módulo por módulo. Para cada arquivo:

1. Identificar interfaces com snake_case
2. Converter campos para camelCase
3. Buscar consumidores e atualizar
4. Garantir que repositories mantêm a conversão na camada correta

---

---

# EIXO 5 — FRONTEND `src/api/` — MONETÁRIO E TIMESTAMPS

**Sessão:** `NOMENCLATURA-F01`, `F02`  
**Pré-requisito:** nenhum (paralelo ao backend)  
**Regra:** frontend espelha o contrato da API. Quando a API backend for atualizada para `Cents`, o frontend deve seguir. Coordenar com Eixo 2 e 3.

---

### Sessão F01 — Campos monetários (249 ocorrências em 50 arquivos)

**Top 10 arquivos por volume verificado:**

| Arquivo | Monetários sem Cents |
|---------|---------------------|
| `marketplace.ts` | 116 |
| `dashboard.ts` | 21 |
| `events.ts` | 18 |
| `fund.ts` | 18 |
| `transparency.ts` | 18 |
| `risk-dashboard.ts` | 7 |
| `bank.ts` | 4 |
| `checkout.ts` | 4 |
| `identity.ts` | 4 |
| `pdv.ts` | 4 |

**Padrão de correção em `bank.ts` (verificado):**
```typescript
// ANTES
export interface BankBalance {
  balance: number;      // → balanceCents
  currency: string;
  hasAccount: boolean;
}

export interface BankStatementEntry {
  amount: number;       // → amountCents
  balanceAfter: number; // → balanceAfterCents
}

// ATENÇÃO: BankStatement.total NÃO é monetário — é paginação
export interface BankStatement {
  entries: BankStatementEntry[];
  total: number;   // ← NÃO alterar — é contagem de registros
  hasMore: boolean;
}
```

**Padrão de correção em `dashboard.ts` (verificado):**
```typescript
// Todos estes são monetários reais:
totalAmount → totalAmountCents
totalPaid → totalPaidCents
totalReceived → totalReceivedCents
amount → amountCents
```

**Padrão de correção em `transparency.ts` (verificado):**
```typescript
amount → amountCents
balanceAfter → balanceAfterCents
totalAmount → totalAmountCents
totalIn → totalInCents
totalOut → totalOutCents
netAmount → netAmountCents
```

---

### Sessão F02 — Timestamps proibidos (48 ocorrências em 7 arquivos)

| Arquivo | Ocorrências | Campos proibidos |
|---------|-------------|-----------------|
| `marketplace.ts` | 24 | `delivery_date`, `start_date`, `end_date` |
| `calendar.ts` | 8 | `startTime`, `endTime`, `startTimeFrom`, `startTimeTo` |
| `events.ts` | 6 | `startTime`, `endTime` |
| `commitments.ts` | 4 | `startTime`, `endTime` |
| `pendingResponsibilities.ts` | 2 | `startTime`, `endTime` |
| `service-discovery.ts` | 2 | `start_date`, `end_date` |
| `unified-calendar.ts` | 2 | `startTime`, `endTime` |

**Padrão de correção em `calendar.ts` (verificado):**
```typescript
// ANTES
export interface CalendarSlot {
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
}

export interface CalendarFilter {
  startTimeFrom?: string;
  startTimeTo?: string;
}

// DEPOIS
export interface CalendarSlot {
  startsAt: string;
  endsAt: string;
}

export interface CalendarFilter {
  startsAtFrom?: string;
  startsAtTo?: string;
}
```

**Após renomear:** atualizar componentes React que consumem essas interfaces:
```bash
grep -rn "startTime\|endTime\|startTimeFrom\|startTimeTo" frontend/src/ --include="*.ts" --include="*.tsx"
```

---

---

# EIXO 6 — FRONTEND `src/api/` — SNAKE_CASE EM INTERFACES

**Sessão:** `NOMENCLATURA-F03`, `F04`, `F05`  
**Pré-requisito:** F01 e F02 concluídos  
**Escopo verificado:** 1.543+ campos em interfaces TypeScript

### Arquivo mais crítico: `marketplace.ts` (924 campos em interfaces)

Este arquivo tem 5.115 linhas e 156 interfaces/types. Estratégia recomendada:

**Não converter tudo de uma vez.** Dividir em grupos por domínio semântico dentro do arquivo:

| Grupo | Interfaces | Sessão |
|-------|-----------|--------|
| Orders e checkout | `Order`, `OrderItem`, `CheckoutInput`, `CreateDeliveryFromHubInput` | F03 |
| Store e products | `StoreProduct`, `ProductVariant`, `ServiceTemplate`, `ServiceOffering` | F04 |
| B2B e hub | `HubOrder`, `IndustryProduct`, `DropshipItem` | F05 |

**Padrão verificado em `marketplace.ts`:**
```typescript
// ANTES (violação §6.1)
export interface ConfirmServiceBookingResult {
  booking_id: string;
  order_id: string;
  offering_id: string;
  price: {
    amount: number;
    currency: string;
  };
}

// DEPOIS
export interface ConfirmServiceBookingResult {
  bookingId: string;
  orderId: string;
  offeringId: string;
  priceCents: number;
  priceCurrency: Iso4217CurrencyCode;
}
```

### Outros arquivos com snake_case verificado

| Arquivo | Campos snake_case | Sessão |
|---------|------------------|--------|
| `cultural.ts` | 59 | F03 |
| `social-2.0.ts` | 57 | F04 |
| `companies.ts` | 25 | F03 |
| `core.ts` | 25 | F03 |
| `groups.ts` | 21 | F04 |
| `votes.ts` | 20 | F04 |
| `events-v2.ts` | 21 | F04 |
| `social.ts` | 11 | F05 |
| `event-rsvp.ts` | 9 | F05 |
| `impact.ts` | 10 | F05 |

---

---

# EIXO 7 — EVENTOS — MIGRAÇÃO PARA FORMATO VERSIONADO

**Sessão:** `NOMENCLATURA-E01`, `E02`  
**Pré-requisito:** nenhum  
**Escopo:** 60+ eventos em formato legado. Zero eventos no formato `v1.domain.entity.action`.

---

---

# DÍVIDAS DOCUMENTAIS (Auditoria Cursor 2026-04-19)

**Status:** REGISTRADO · NÃO BLOQUEIA PRODUTO  
**Severidade:** Média (bloqueia IAs, não bloqueia gates CI/CD)

## DD-01 — Referências a arquivos inexistentes

**Descrição:** Múltiplos arquivos de configuração e documentação referenciam caminhos que não existem ou estão em local diferente. Isso afeta sessões futuras com outros agentes que usam `00_AGENT_PROTOCOL.md` como entrada.

**Referências quebradas identificadas:**
- `00_AGENT_PROTOCOL.md` → referencia `UNIFICARD_PLANO_DEFINITIVO_v7.md` (na raiz existe **placeholder** anti-regressão; não substitui norma completa — avaliar revisão do protocolo)
- aliases de registry **sem** sufixo `_UNIFICARD` ou colocados sob a pasta de processo `docs/ssot/` (inexistentes como ficheiros) → canónico: `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md`
- `docs/ssot/PROHIBITED_STRUCTURES.md` (inexistente) → canónico: `docs/01_normative/PROHIBITED_STRUCTURES.md`
- `docs/architecture/CONTRACTS.md` (inexistente) → canónico: `docs/01_normative/CONTRACTS.md`

**Ação recomendada:** Normalizar caminhos em `00_AGENT_PROTOCOL.md` para apontar para locais corretos após conclusão de eixos 1-8 (nomenclatura estável).

**Bloqueio:** Não bloqueia tests CI, não bloqueia deploys, não bloqueia produto. Bloqueia apenas IAs/agentes que usam `00_AGENT_PROTOCOL.md` como source-of-truth de estrutura.

---

## DD-02 — Glossário duplo e arquivo PLANO_FASE_ATUAL sem versão canônica

**Descrição:** Dois arquivos de glossário com referências misturadas:
- `07_NOMENCLATURA_CANONICA.md` contém glossário authoritário
- `04_GLOSSARIO_UNIFICADO.md` existe também com definições parciais

PLANO_FASE_ATUAL.md está duplicado em múltiplos locais sem definição clara de qual é versão canônica atual.

**Ação recomendada:** Unificar após estabilização documental (após eixos 1-8). Manter apenas `07_NOMENCLATURA_CANONICA.md` como glossário authoritário; mover `04_GLOSSARIO_UNIFICADO.md` para `docs/99_archive/`.

**Bloqueio:** Não bloqueia. Causa confusão visual apenas.

---

### DD-03 — validate:architecture:strict com 38 CRITICAL no baseline

**Severidade:** Média (gate separado dos 3 gates CI ativos)
**Descrição:** O script validate-architectural-patterns.mjs --strict reporta
38 CRITICAL usando baseline em scripts/architectural-patterns-baseline.json.
Inclui leituras SELECT em bank_* por reporting e sagas (falsos positivos do gate)
e possivelmente violações reais não cobertas pelos gates atuais.
**Ação futura:** auditar o baseline, separar falsos positivos de violações reais,
atualizar allowlist ou baseline após análise.
**Bloqueio:** não bloqueia produto — nossos 3 gates CI passam.

---

**Data de auditoria:** 2026-04-19  
**Detectado por:** Cursor (varredura documental pré-code)  
**Próxima revisão:** Após conclusão EIXO 8 (nomenclatura estável)

### Regra de formato versionado (§10)

```
v{major}.{domain}.{entity}.{action}

- major: número inteiro (1)
- domain: kebab-case (payment, order, event, group)
- entity: kebab-case (transaction, item, member)
- action: past tense, kebab-case (created, completed, failed, captured)
```

### Tabela de migração — eventos verificados

| Evento atual | Formato correto | Arquivo | Linha aprox. |
|-------------|----------------|---------|-------------|
| `event.custody.created` | `v1.event.custody.created` | `event-custody.service.ts` | 182 |
| `event.custody.reverted` | `v1.event.custody.reverted` | `event-custody.service.ts` | 255 |
| `event.custody.released` | `v1.event.custody.released` | `event-custody.service.ts` | 371 |
| `event.advance_to_economic_phase` | `v1.event.lifecycle.economic-phase-advanced` | `event-economic-phase.service.ts` | 143 |
| `event.payment.authorized` | `v1.event.payment.authorized` | `event-payment-prepared.service.ts` | 185 |
| `event.created` | `v1.event.event.created` | `event.routes.ts` | 327 |
| `distribution.completed` | `v1.fund.distribution.completed` | grupo distribution | — |
| `distribution.failed` | `v1.fund.distribution.failed` | grupo distribution | — |
| `penalty.applied` | `v1.trust.penalty.applied` | trust service | — |
| `core.review.created` | `v1.marketplace.review.created` | review service | — |
| `order.saga.started` | `v1.order.saga.started` | order saga | — |
| `order.saga.advanced` | `v1.order.saga.advanced` | order saga | — |
| `order.saga.failed` | `v1.order.saga.failed` | order saga | — |
| `order.saga.timeout` | `v1.order.saga.timeout` | order saga | — |
| `group.fund.received` | `v1.group.fund.received` | group fund service | — |
| `config.changed` | `v1.system.config.changed` | config service | — |
| `config.deleted` | `v1.system.config.deleted` | config service | — |
| `feature_flag.changed` | `v1.system.feature-flag.changed` | feature flag service | — |
| `feature_flag.deleted` | `v1.system.feature-flag.deleted` | feature flag service | — |
| `dispute.created` | `v1.dispute.dispute.created` | dispute service | — |
| `dispute.resolved` | `v1.dispute.dispute.resolved` | dispute service | — |
| `payout_batch_created` | `v1.payment.payout-batch.created` | payout service | — |
| `payout_blocked` | `v1.payment.payout.blocked` | payout service | — |
| `payout_executed` | `v1.payment.payout.executed` | payout service | — |
| `payout_failed` | `v1.payment.payout.failed` | payout service | — |
| `policy_decision_applied` | `v1.governance.policy-decision.applied` | policy service | — |
| `policy_decision_revoked` | `v1.governance.policy-decision.revoked` | policy service | — |
| `actor.switched` | `v1.identity.actor.switched` | actor service | — |
| `bypass_attempt_detected` | `v1.security.bypass-attempt.detected` | trust/security | — |
| `ledger.transaction.compensated` | `v1.bank.ledger-transaction.compensated` | bank service | — |
| `b2b.payment.completed` | `v1.marketplace.b2b-payment.completed` | B2B service | — |
| `work.assignment.paid` | `v1.work.assignment.paid` | work service | — |

**Eventos SCREAMING_SNAKE_CASE (precisam de verificação separada):**
Eventos como `COMPANY_CREATED`, `CONTACT_CREATED`, `CHECKIN_SUCCESS` estão em outro formato — verificar se são tipos de evento do banco (não publicados via eventBus) antes de migrar.

### Estratégia de migração sem breaking change

```typescript
// Padrão de transição (manter compatibilidade temporária):
const EVENT_TYPES = {
  // Legado (deprecado)
  LEGACY_CUSTODY_CREATED: 'event.custody.created',
  // Novo (§10)
  CUSTODY_CREATED: 'v1.event.custody.created',
} as const;

// Publicar apenas o novo formato após migração
await eventBus.publish({
  eventType: EVENT_TYPES.CUSTODY_CREATED,
  // ...
});
```

### Sessão E01 — core/events (eventos de custódia, pagamento, ciclo de vida)
### Sessão E02 — demais módulos (saga, payout, dispute, policy, group)

Para cada evento: localizar o arquivo, trocar o string do eventType, verificar handlers/subscribers que filtram por esse nome e atualizar.

---

---

# EIXO 8 — NOMES DE ARQUIVOS

**Sessão:** `NOMENCLATURA-A01`  
**Pré-requisito:** Eixos 5 e 6 concluídos (para não quebrar imports durante a renomeação)  
**Escopo:** 5 arquivos em `frontend/src/api/`

### Arquivos a renomear (§5.5 — kebab-case obrigatório)

| Arquivo atual | Arquivo correto | Impacto |
|--------------|----------------|---------|
| `companyMembers.ts` | `company-members.ts` | Atualizar todos os imports |
| `feedPlugins.ts` | `feed-plugins.ts` | Atualizar todos os imports |
| `liveChat.ts` | `live-chat.ts` | Atualizar todos os imports |
| `serviceBookings.ts` | `service-bookings.ts` | Atualizar todos os imports |
| `serviceOrders.ts` | `service-orders.ts` | Atualizar todos os imports |

**Passo 1:** renomear arquivo  
**Passo 2:** atualizar todos os imports:
```bash
grep -rn "companyMembers\|feedPlugins\|liveChat\|serviceBookings\|serviceOrders" frontend/src/ --include="*.ts" --include="*.tsx"
```
**Passo 3:** verificar se há barrel exports em `frontend/src/api/index.ts` e atualizar

---

---

# EIXO 9 — VERSIONAMENTO DE API (SISTÊMICO)

**Sessão:** `NOMENCLATURA-V01`  
**Pré-requisito:** todos os outros eixos  
**Escopo:** 210+ rotas sem `/v1/` — sistema usa `/api` como prefixo flat

### Situação verificada

Todas as rotas são registradas com `prefix: '/api'` ou sem prefix. Zero rotas têm `/v1/`.

### Estratégia

**Não renomear rotas existentes individualmente** — isso causaria breaking change em todos os clientes. A abordagem correta é:

1. Adicionar prefix `/v1` ao nível de registro no bootstrap
2. Manter `/api` como alias temporário com redirecionamento 301

```typescript
// Em BOOT.ts — ao registrar módulos:
// ANTES
await fastify.register(companiesRoutes);
await fastify.register(agreementRoutes, { prefix: '/api' });

// DEPOIS
await fastify.register(companiesRoutes, { prefix: '/v1' });
await fastify.register(agreementRoutes, { prefix: '/v1/api' }); // ou unificar prefixes
```

**Atenção:** esta sessão requer decisão arquitetural — consultar Clayton antes de executar. O versionamento de API é uma mudança de contrato público que afeta todos os clientes, incluindo o frontend. Pode ser feito em paralelo com alias `/api` → `/v1/api` até migração completa do frontend.

---

---

# APÊNDICE A — COMANDOS DE VERIFICAÇÃO PÓS-SESSÃO

Executar após cada sessão para confirmar que não foram introduzidas novas violações:

```bash
# Monetário sem Cents em TypeScript (backend)
grep -rn "amount\|total\|price\|subtotal\|balance\|fee\|cost" backend/src/ \
  --include="*.ts" | grep ": number" | grep -v "Cents\|cents\|Count\|count\|Bps\|bps\|//\|repository\|\.sql"

# Snake_case em interfaces TypeScript (backend)
grep -rn "^\s\{2,8\}[a-z][a-z0-9]*_[a-z][a-z0-9_]*\s*[?]\?:" backend/src/ \
  --include="*.types.ts" --include="*.service.ts" --include="*.routes.ts"

# Booleanos sem prefixo em TypeScript
grep -rn "^\s\{2,8\}\w\+\s*\?:\s*boolean" backend/src/ --include="*.ts" \
  | grep -v "^is\|^has\|^can\|^should\|^was\|^requires\|^allow"

# Timestamps proibidos
grep -rn "\b\(startTime\|endTime\|start_time\|end_time\|start_date\|end_date\|delivery_date\)\b" \
  backend/src/ frontend/src/ --include="*.ts"

# Eventos sem versionamento
grep -rn "eventType: '" backend/src/ --include="*.ts" | grep -v "^v[0-9]\."

# Verificar migrations sem _cents para monetário
grep -rn "\bNUMERIC\b\|\bDECIMAL\b\|\bFLOAT\b" backend/migrations/ \
  | grep -i "price\|amount\|total\|cost\|fee\|balance\|value" | grep -v "_cents\|--"
```

---

# APÊNDICE B — ORDEM DE EXECUÇÃO RECOMENDADA

```
SPRINT 1 (sem dependências):
  ├── NOMENCLATURA-M01  (Migrations)
  ├── NOMENCLATURA-C01  (Contratos v2 prioritários)
  └── NOMENCLATURA-E01  (Eventos core/events)

SPRINT 2 (após Sprint 1):
  ├── NOMENCLATURA-C02  (Contratos v2 restantes)
  ├── NOMENCLATURA-B01  (Módulos backend monetário/bool — marketplace+rides)
  ├── NOMENCLATURA-E02  (Eventos demais módulos)
  └── NOMENCLATURA-F01  (Frontend monetário)

SPRINT 3 (após Sprint 2):
  ├── NOMENCLATURA-C03  (Migração de consumidores)
  ├── NOMENCLATURA-B02  (Módulos backend ActorCapabilities + events.types)
  ├── NOMENCLATURA-F02  (Frontend timestamps)
  └── NOMENCLATURA-S01  (Snake_case cultural)

SPRINT 4 (após Sprint 3):
  ├── NOMENCLATURA-S02  (Snake_case rides)
  ├── NOMENCLATURA-F03  (Frontend snake_case grupo 1)
  └── NOMENCLATURA-S03  (Snake_case companies+social)

SPRINT 5 (após Sprint 4):
  ├── NOMENCLATURA-S04  (Snake_case events)
  ├── NOMENCLATURA-F04  (Frontend snake_case grupo 2)
  └── NOMENCLATURA-F05  (Frontend snake_case grupo 3)

SPRINT 6 (após Sprint 5 — todos os eixos de renomeação concluídos):
  ├── NOMENCLATURA-A01  (Nomes de arquivos)
  └── NOMENCLATURA-V01  (Versionamento API — decisão arquitetural)
```

---

# APÊNDICE C — ITENS FORA DO ESCOPO DESTE PLANO

Os seguintes itens foram identificados na auditoria mas **não fazem parte deste plano de nomenclatura** — pertencem a outros planos:

- `economic_guardianship` GUARDA table sem migration → P1-21 (plano de governance)
- `event_outbox` cobertura de 10% → P0-2 (plano de event outbox)
- Float monetary em bank_ledger → P0-3 (plano de float→integer cents)

Esses itens têm impacto em dados reais e requerem sessões próprias com estratégia de migração de dados.
