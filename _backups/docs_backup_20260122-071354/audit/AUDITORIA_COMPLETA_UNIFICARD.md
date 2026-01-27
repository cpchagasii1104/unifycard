# 🔍 AUDITORIA COMPLETA — UnifiCard

**Data:** 02/01/2026  
**Escopo:** Referral Code + CPF + Actor/Permissões + Motor de Split

---

## 📊 RESUMO EXECUTIVO

| Item | Status | Ação Necessária |
|------|--------|-----------------|
| **Referral Code** | 🔴 QUEBRADO | Migration faltando + tabela de vínculos |
| **CPF** | ✅ OK | Funciona, apenas ajustes menores |
| **Actor/Permissões** | ✅ OK | Criado sob demanda, funciona |
| **Motor de Split** | 🟡 PARCIAL | Modelagem proposta neste documento |

---

## 🔴 PROBLEMA 1: REFERRAL CODE NÃO FUNCIONA

### Causa Raiz

**A tabela `users` NÃO TEM o campo `referral_code`!**

```sql
-- Estrutura atual de users (migration 001):
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
  -- ❌ FALTA: referral_code
  -- ❌ FALTA: metadata
);
```

O código em `referral.service.ts` tenta:
```typescript
SELECT referral_code FROM users WHERE user_id = $1  // ❌ Campo não existe!
UPDATE users SET referral_code = $2 WHERE user_id = $1  // ❌ Campo não existe!
```

### Solução Completa

#### MIGRATION 1: Adicionar campo referral_code em users

**Arquivo:** `backend/migrations/107_add_referral_code_to_users.sql`

```sql
-- Migration 107: Adicionar campo referral_code à tabela users
-- Data: 2025-01-02
-- Autor: Auditoria Claude + ChatGPT

-- 1. Adicionar coluna referral_code
ALTER TABLE users
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20);

-- 2. Criar índice único para garantir códigos não duplicados
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique 
ON users(tenant_id, referral_code) 
WHERE referral_code IS NOT NULL;

-- 3. Adicionar coluna metadata (para referred_by e outros dados)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 4. Comentários para documentação
COMMENT ON COLUMN users.referral_code IS 
  'Código de indicação único do usuário (8 chars alfanuméricos). Imutável após geração.';

COMMENT ON COLUMN users.metadata IS 
  'Metadados do usuário (referred_by, preferences, etc). JSONB para flexibilidade.';
```

#### MIGRATION 2: Criar tabela de vínculos para split

**Arquivo:** `backend/migrations/108_create_user_referral_links.sql`

```sql
-- Migration 108: Criar tabela user_referral_links para motor de split
-- Data: 2025-01-02
-- Propósito: Vincular "quem indicou quem" de forma auditável para split de pagamento

-- 1. Criar tabela de vínculos
CREATE TABLE IF NOT EXISTS user_referral_links (
  link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  
  -- Quem indicou
  referrer_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Quem foi indicado
  referred_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Código usado no momento do cadastro (auditoria/rastreabilidade)
  referral_code_used VARCHAR(20) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Garantir unicidade: cada usuário só pode ser indicado UMA vez
  UNIQUE(referred_user_id)
);

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS user_referral_links_tenant_idx ON user_referral_links(tenant_id);
CREATE INDEX IF NOT EXISTS user_referral_links_referrer_idx ON user_referral_links(referrer_user_id);
CREATE INDEX IF NOT EXISTS user_referral_links_referred_idx ON user_referral_links(referred_user_id);

-- 3. RLS
ALTER TABLE user_referral_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_referral_links_rls ON user_referral_links
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- 4. Comentários
COMMENT ON TABLE user_referral_links IS 
  'Vínculos de indicação entre usuários. Usado para calcular split de pagamento. Imutável após criação.';

COMMENT ON COLUMN user_referral_links.referrer_user_id IS 
  'Usuário que indicou (recebe % do split de transações do indicado)';

COMMENT ON COLUMN user_referral_links.referred_user_id IS 
  'Usuário que foi indicado (origem das transações que geram split)';

COMMENT ON COLUMN user_referral_links.referral_code_used IS 
  'Código usado no momento do cadastro (para auditoria, mesmo que referrer mude de código depois)';
```

#### Atualizar referral.service.ts

**Arquivo:** `backend/src/core/referral/referral.service.ts`

**Adicionar no método `applyReferralCode` (após linha 141):**

```typescript
    // Registrar vínculo na tabela user_referral_links (para split de pagamento)
    try {
      await runQueryWithTenant(
        tenantId,
        `
        INSERT INTO user_referral_links (tenant_id, referrer_user_id, referred_user_id, referral_code_used)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (referred_user_id) DO NOTHING
        `,
        [tenantId, referrer.user_id, newUserId, referralCode]
      );
      console.log('[ReferralService] ✅ Vínculo de indicação registrado:', {
        referrerUserId: referrer.user_id,
        referredUserId: newUserId,
        referralCode,
      });
    } catch (err) {
      // Log mas não falha - vínculo em metadata é suficiente como fallback
      console.warn('[ReferralService] ⚠️ Erro ao registrar vínculo (não crítico):', err);
    }
```

---

## ✅ PROBLEMA 2: CPF — STATUS OK

### Análise

| Componente | Status | Detalhes |
|------------|--------|----------|
| Tabela `user_profiles` | ✅ Existe | Migration 105 |
| Campo `cpf` | ✅ Existe | VARCHAR(11) NOT NULL UNIQUE |
| Backend busca | ✅ Correto | `core.service.ts` linha 151-164 |
| Frontend consome | ✅ Correto | `Profile.tsx` linha 617 |

### Fluxo atual (funcionando)

```
1. Signup → CPF salvo em user_profiles.cpf
2. GET /core/profile → Busca CPF via runQueryWithTenant
3. Retorna em personal_profile.cpf
4. Frontend exibe com máscara
```

### Melhoria sugerida (não crítica)

Para maior robustez, usar pool diretamente (como já feito para referralCode):

```typescript
// core.service.ts - substituir linhas 151-164
let cpf: string | null = null;
try {
  const { pool } = await import('@core/database/pool');
  const cpfResult = await pool.query<{ cpf: string | null }>(
    `SELECT cpf FROM user_profiles WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  cpf = cpfResult.rows[0]?.cpf || null;
} catch (err) {
  console.warn('Erro ao buscar CPF (não crítico):', err);
}
```

---

## ✅ PROBLEMA 3: ACTOR/PERMISSÕES — STATUS OK

### Análise

| Componente | Status | Detalhes |
|------------|--------|----------|
| Criação de actor | ✅ Sob demanda | `findOrCreateUserActor` em core.service.ts |
| Actor padrão | ✅ Existe | Criado na primeira chamada de profile |
| Permissões | ✅ Não há gating | Sistema aberto, sem permissões restritivas |

### Fluxo atual (funcionando)

```
1. Signup → Usuário criado (SEM actor)
2. GET /core/profile → actorRepository.findOrCreateUserActor()
3. Actor criado se não existir
4. Retorna actor em profile.actor
```

### Por que funciona

O `findOrCreateUserActor` é chamado em múltiplos lugares:
- `/core/profile` (core.service.ts)
- `/social/*` (social-2.0.routes.ts)
- `/events/*` (event.routes.ts)

Qualquer endpoint que precise de actor vai criá-lo automaticamente.

### Verificação adicional (se problemas persistirem)

Se usuário novo não tem actor, verificar logs:
```
grep "findOrCreateUserActor" backend.log
```

---

## 🟡 PROBLEMA 4: MOTOR DE SPLIT — PROPOSTA

### Contexto

O UnifiCard tem um modelo econômico com distribuição automática:
- **70%** → Prestador/Vendedor
- **15%** → Cidade/Região
- **10%** → Fundo Regional
- **5%** → Grupo(s) do usuário

Adicionalmente, precisa suportar:
- **Comissão de indicação** → Referrer do usuário
- **Até 3 grupos** → Distribuição proporcional

### Modelagem de Dados

#### Tabela: `payout_rules` (Regras de distribuição)

```sql
-- Migration 109: Criar tabela payout_rules
CREATE TABLE IF NOT EXISTS payout_rules (
  rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  
  -- Identificador da regra (ex: 'default', 'event_ticket', 'service')
  rule_key VARCHAR(50) NOT NULL,
  
  -- Descrição
  description TEXT,
  
  -- Percentuais (em basis points: 100 = 1%)
  provider_bps INTEGER NOT NULL DEFAULT 7000,      -- 70%
  city_bps INTEGER NOT NULL DEFAULT 1500,          -- 15%
  regional_fund_bps INTEGER NOT NULL DEFAULT 1000, -- 10%
  group_bps INTEGER NOT NULL DEFAULT 500,          -- 5%
  referrer_bps INTEGER DEFAULT 0,                  -- 0% (configurável)
  
  -- Metadata para extensibilidade
  metadata JSONB DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(tenant_id, rule_key)
);

COMMENT ON TABLE payout_rules IS 
  'Regras de distribuição de pagamento (split). Percentuais em basis points (100 = 1%).';
```

#### Tabela: `payout_destinations` (Destinos flexíveis)

```sql
-- Para suportar "até 3 grupos" e outros destinos
CREATE TABLE IF NOT EXISTS payout_destinations (
  destination_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  
  -- Tipo de destino
  destination_type VARCHAR(20) NOT NULL CHECK (destination_type IN (
    'provider',     -- Prestador do serviço
    'city',         -- Fundo da cidade
    'regional_fund',-- Fundo regional
    'group',        -- Grupo específico
    'referrer',     -- Quem indicou
    'platform'      -- Plataforma (taxa administrativa)
  )),
  
  -- Referência ao destino (account_id, group_id, etc)
  destination_ref UUID,
  
  -- Percentual (em basis points)
  percentage_bps INTEGER NOT NULL,
  
  -- Prioridade (ordem de processamento)
  priority INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### Tabela: `profit_events` (Eventos de lucro)

```sql
-- Migration 110: Criar tabela profit_events
CREATE TABLE IF NOT EXISTS profit_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  
  -- Tipo de evento
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'service_payment',    -- Pagamento de serviço
    'ticket_purchase',    -- Compra de ingresso
    'product_sale',       -- Venda de produto
    'subscription',       -- Assinatura
    'donation'            -- Doação
  )),
  
  -- Valor bruto (centavos)
  gross_amount_cents INTEGER NOT NULL,
  
  -- Usuário que gerou o lucro
  source_user_id UUID NOT NULL REFERENCES users(user_id),
  
  -- Regra aplicada
  rule_id UUID REFERENCES payout_rules(rule_id),
  
  -- Referência à transação original
  original_transaction_id UUID,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',    -- Aguardando processamento
    'processing', -- Em processamento
    'completed',  -- Concluído
    'failed',     -- Falhou
    'reversed'    -- Estornado
  )),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX profit_events_status_idx ON profit_events(status);
CREATE INDEX profit_events_source_user_idx ON profit_events(source_user_id);
```

#### Tabela: `payout_ledger` (Ledger de distribuição)

```sql
-- Migration 111: Criar tabela payout_ledger
CREATE TABLE IF NOT EXISTS payout_ledger (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  
  -- Referência ao evento de lucro
  profit_event_id UUID NOT NULL REFERENCES profit_events(event_id),
  
  -- Destino do pagamento
  destination_type VARCHAR(20) NOT NULL,
  destination_ref UUID, -- account_id, group_id, etc
  
  -- Valor (centavos)
  amount_cents INTEGER NOT NULL,
  
  -- Percentual aplicado (basis points)
  percentage_bps INTEGER NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',
    'credited',
    'failed',
    'reversed'
  )),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  credited_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX payout_ledger_event_idx ON payout_ledger(profit_event_id);
CREATE INDEX payout_ledger_destination_idx ON payout_ledger(destination_type, destination_ref);
```

### Fluxo de Split (Pseudo-código)

```typescript
async function processProfitEvent(eventId: string): Promise<void> {
  const event = await getProfitEvent(eventId);
  const rule = await getPayoutRule(event.rule_id || 'default');
  
  const destinations = [];
  
  // 1. Provider (70%)
  destinations.push({
    type: 'provider',
    ref: event.metadata.provider_account_id,
    bps: rule.provider_bps,
  });
  
  // 2. City (15%)
  const city = await getUserCity(event.source_user_id);
  if (city) {
    destinations.push({
      type: 'city',
      ref: city.fund_account_id,
      bps: rule.city_bps,
    });
  }
  
  // 3. Regional Fund (10%)
  destinations.push({
    type: 'regional_fund',
    ref: REGIONAL_FUND_ACCOUNT_ID,
    bps: rule.regional_fund_bps,
  });
  
  // 4. Groups (5% dividido entre até 3 grupos)
  const userGroups = await getUserGroups(event.source_user_id, { limit: 3 });
  if (userGroups.length > 0) {
    const groupBps = Math.floor(rule.group_bps / userGroups.length);
    for (const group of userGroups) {
      destinations.push({
        type: 'group',
        ref: group.fund_account_id,
        bps: groupBps,
      });
    }
  }
  
  // 5. Referrer (se existir e configurado)
  if (rule.referrer_bps > 0) {
    const referrerLink = await getReferrerLink(event.source_user_id);
    if (referrerLink) {
      destinations.push({
        type: 'referrer',
        ref: referrerLink.referrer_user_id,
        bps: rule.referrer_bps,
      });
    }
  }
  
  // Calcular e registrar no ledger
  for (const dest of destinations) {
    const amount = Math.floor(event.gross_amount_cents * dest.bps / 10000);
    await createLedgerEntry(event.event_id, dest, amount);
  }
  
  // Marcar evento como processado
  await markEventProcessed(eventId);
}
```

---

## 🎯 PROMPT PARA O CURSOR

```
Você está no monorepo Unificard.

PROBLEMAS IDENTIFICADOS:
1. Campo referral_code NÃO EXISTE na tabela users
2. Tabela user_referral_links NÃO EXISTE

TAREFAS (EXECUTAR EM ORDEM):

### 1. Criar migration para referral_code

Criar arquivo: backend/migrations/107_add_referral_code_to_users.sql

Conteúdo:
-- Migration 107: Adicionar campo referral_code à tabela users

ALTER TABLE users
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique 
ON users(tenant_id, referral_code) 
WHERE referral_code IS NOT NULL;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN users.referral_code IS 
  'Código de indicação único do usuário. Imutável após geração.';


### 2. Criar migration para user_referral_links

Criar arquivo: backend/migrations/108_create_user_referral_links.sql

Conteúdo:
-- Migration 108: Criar tabela user_referral_links

CREATE TABLE IF NOT EXISTS user_referral_links (
  link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  referrer_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  referral_code_used VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(referred_user_id)
);

CREATE INDEX IF NOT EXISTS user_referral_links_tenant_idx ON user_referral_links(tenant_id);
CREATE INDEX IF NOT EXISTS user_referral_links_referrer_idx ON user_referral_links(referrer_user_id);

ALTER TABLE user_referral_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_referral_links_rls ON user_referral_links
  USING (tenant_id::text = current_setting('app.current_tenant', true));


### 3. Atualizar referral.service.ts

Arquivo: backend/src/core/referral/referral.service.ts

APÓS linha 141 (dentro de applyReferralCode, após salvar em metadata), ADICIONAR:

    // Registrar vínculo na tabela user_referral_links
    try {
      await runQueryWithTenant(
        tenantId,
        `
        INSERT INTO user_referral_links (tenant_id, referrer_user_id, referred_user_id, referral_code_used)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (referred_user_id) DO NOTHING
        `,
        [tenantId, referrer.user_id, newUserId, referralCode]
      );
      console.log('[ReferralService] ✅ Vínculo registrado');
    } catch (err) {
      console.warn('[ReferralService] ⚠️ Erro ao registrar vínculo:', err);
    }


### 4. Rodar migrations

cd backend
npm run migrate

### 5. Reiniciar backend e testar

VALIDAÇÃO:
1. Criar novo usuário
2. Verificar no banco: SELECT referral_code FROM users WHERE email = 'novo@email.com';
3. Acessar /profile
4. Código de indicação deve aparecer
5. Botão copiar deve funcionar

Se não aparecer código, verificar logs do backend.
```

---

## 📋 CONTRATO DE DADOS DO PERFIL

### Interface `CompleteProfile` (fonte de verdade)

```typescript
interface CompleteProfile {
  actor: {
    actor_id: string;
    actor_type: 'user' | 'page' | 'group';
    display_name: string;
    avatar_url: string | null;
    cover_url: string | null;
    bio: string | null;
  } | null;
  
  personal_profile: {
    fullName: string | null;
    phone: string | null;
    metadata: Record<string, any>;
    referralCode: string | null;  // ← De users.referral_code
    cpf: string | null;           // ← De user_profiles.cpf
  } | null;
  
  professional_profile: { ... } | null;
  physical_profile: { ... } | null;
  addresses: Array<...>;
  contacts: Array<...>;
  interests: Array<...>;
  companies: Array<...>;
}
```

### Fontes de cada campo

| Campo | Tabela | Coluna |
|-------|--------|--------|
| `referralCode` | `users` | `referral_code` |
| `cpf` | `user_profiles` | `cpf` |
| `fullName` | `profiles` | `full_name` |
| `phone` | `profiles` | `phone` |
| `metadata` | `profiles` | `metadata` |
| `actor.*` | `actors` | `*` |

---

## ⚠️ GOVERNANÇA DO REFERRAL CODE

### Regras Imutáveis

1. **Código único por usuário** — Nunca duplicado no mesmo tenant
2. **Imutável após geração** — Nunca pode ser alterado
3. **Permanente** — Nunca expira
4. **Vínculo imutável** — `user_referral_links.referred_user_id` é UNIQUE
5. **Auditável** — Sempre registra código usado no momento do cadastro

### Fluxo de Indicação

```
Usuário A (referral_code: ABC123)
        ↓
Usuário B cadastra usando ABC123
        ↓
user_referral_links:
  referrer_user_id = A.user_id
  referred_user_id = B.user_id
  referral_code_used = 'ABC123'
        ↓
B gera lucro (serviço, venda, etc)
        ↓
profit_events registra evento
        ↓
Split Engine consulta user_referral_links
        ↓
A recebe X% como comissão
```

---

*Documento gerado em 02/01/2026*  
*Auditoria colaborativa Claude + ChatGPT*
