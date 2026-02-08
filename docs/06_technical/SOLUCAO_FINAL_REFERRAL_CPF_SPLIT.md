# 🎯 SOLUÇÃO FINAL — REFERRAL + CPF + SPLIT

**Data:** 02/01/2026  
**Colaboração:** Claude + ChatGPT  
**Objetivo:** Fechar circuito econômico completo

---

## 📊 GAPS IDENTIFICADOS PELO CHATGPT

| Gap | Problema | Solução |
|-----|----------|---------|
| **A** | Referral não é determinístico no payload | Query única + geração garantida |
| **B** | Referral não conecta com split | Criar `ledger_referral_splits` |
| **C** | CPF isolado | JOIN canônico no core.service |

---

## 🔧 SOLUÇÃO A: REFERRAL CODE DETERMINÍSTICO

### Problema Atual

O código atual faz 2 queries separadas:
1. Busca `referral_code` de `users`
2. Se null, tenta gerar

Mas se a coluna não existe ou query falha, retorna null silenciosamente.

### Solução: Query Única com JOIN + Geração Garantida

**Arquivo:** `backend/src/core/core.service.ts`

**SUBSTITUIR linhas 117-165 por:**

```typescript
      // 2. Perfil pessoal básico
      // 🔴 SOLUÇÃO DEFINITIVA: Query única com JOIN + geração garantida
      
      let referralCode: string | null = null;
      let cpf: string | null = null;
      
      try {
        const { pool } = await import('@core/database/pool');
        
        // Query única que busca TUDO de uma vez (eficiente)
        const identityResult = await pool.query<{
          referral_code: string | null;
          cpf: string | null;
          email: string;
        }>(
          `
          SELECT 
            u.referral_code,
            u.email,
            up.cpf
          FROM users u
          LEFT JOIN user_profiles up ON up.user_id = u.user_id
          WHERE u.user_id = $1
          LIMIT 1
          `,
          [userId]
        );
        
        const row = identityResult.rows[0];
        
        if (row) {
          cpf = row.cpf || null;
          referralCode = row.referral_code || null;
          
          // 🔴 GERAÇÃO GARANTIDA: Se não tem código, gerar AGORA
          // Isso torna o payload determinístico - SEMPRE terá código
          if (!referralCode) {
            console.log('[CoreService] 🔄 Gerando código de indicação (lazy):', { userId });
            const { referralService } = await import('@core/referral/referral.service');
            referralCode = await referralService.getOrCreateReferralCode(tenantId, userId);
            console.log('[CoreService] ✅ Código gerado com sucesso:', { userId, referralCode });
          }
        }
      } catch (err) {
        // 🔴 LOG DETALHADO para debug (não silencioso)
        console.error('[CoreService] ❌ Erro ao buscar identidade:', {
          userId,
          tenantId,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
        
        // Tentar gerar código mesmo em caso de erro na query principal
        try {
          const { referralService } = await import('@core/referral/referral.service');
          referralCode = await referralService.getOrCreateReferralCode(tenantId, userId);
        } catch (genErr) {
          console.error('[CoreService] ❌ Falha também na geração de código:', genErr);
        }
      }
```

### Por que isso funciona

1. **Query única** — Menos roundtrips ao banco
2. **JOIN** — Busca CPF junto (eficiente)
3. **Geração garantida** — Se não tem código, gera na hora
4. **Log detalhado** — Nunca silencia erros
5. **Fallback** — Mesmo se query falhar, tenta gerar

---

## 🔧 SOLUÇÃO B: CONECTAR REFERRAL COM SPLIT

### Estrutura de Dados

```
profit_event (quando usuário gera lucro)
        ↓
ledger_referral_splits (distribuição para referrer)
        ↓
Crédito na conta do referrer
```

### Migration: Criar tabela de splits de referral

**Arquivo:** `backend/migrations/109_create_ledger_referral_splits.sql`

```sql
-- Migration 109: Criar tabela ledger_referral_splits
-- Data: 2025-01-02
-- Propósito: Registrar distribuições de split para indicadores

-- ============================================================================
-- REGRA DE NEGÓCIO:
-- Quando usuário B (indicado por A) gera lucro, A recebe % de comissão.
-- Esta tabela registra cada crédito de comissão para auditoria.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ledger_referral_splits (
  split_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  
  -- Referência ao evento de lucro que gerou este split
  profit_event_id UUID NOT NULL,  -- FK para profit_events (quando existir)
  
  -- Transação original (serviço, venda, ingresso, etc)
  original_transaction_id UUID NOT NULL,
  
  -- Quem gerou o lucro (referred)
  source_user_id UUID NOT NULL REFERENCES users(user_id),
  
  -- Quem recebe a comissão (referrer)
  beneficiary_user_id UUID NOT NULL REFERENCES users(user_id),
  
  -- Vínculo de indicação usado (auditoria)
  referral_link_id UUID REFERENCES user_referral_links(link_id),
  
  -- Valor original da transação (centavos)
  original_amount_cents INTEGER NOT NULL,
  
  -- Percentual aplicado (basis points: 100 = 1%)
  percentage_bps INTEGER NOT NULL DEFAULT 500, -- 5% default
  
  -- Valor do split (centavos)
  split_amount_cents INTEGER NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',    -- Aguardando processamento
    'credited',   -- Creditado na conta do beneficiário
    'failed',     -- Falhou
    'reversed'    -- Estornado
  )),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  credited_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata (razão do split, tipo de transação, etc)
  metadata JSONB DEFAULT '{}'
);

-- Índices
CREATE INDEX IF NOT EXISTS ledger_referral_splits_tenant_idx 
ON ledger_referral_splits(tenant_id);

CREATE INDEX IF NOT EXISTS ledger_referral_splits_source_idx 
ON ledger_referral_splits(source_user_id);

CREATE INDEX IF NOT EXISTS ledger_referral_splits_beneficiary_idx 
ON ledger_referral_splits(beneficiary_user_id);

CREATE INDEX IF NOT EXISTS ledger_referral_splits_status_idx 
ON ledger_referral_splits(status);

CREATE INDEX IF NOT EXISTS ledger_referral_splits_transaction_idx 
ON ledger_referral_splits(original_transaction_id);

-- RLS
ALTER TABLE ledger_referral_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY ledger_referral_splits_rls ON ledger_referral_splits
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Comentários
COMMENT ON TABLE ledger_referral_splits IS 
  'Registro de splits de comissão para indicadores. Auditável e imutável.';

COMMENT ON COLUMN ledger_referral_splits.percentage_bps IS 
  'Percentual em basis points (500 = 5%). Configurável por tipo de transação.';
```

### Service: Split Engine para Referral

**Arquivo:** `backend/src/core/economy/referral-split.service.ts`

```typescript
// src/core/economy/referral-split.service.ts
// Motor de split para comissões de indicação

import { runQueryWithTenant } from '@core/database/pool';

interface ReferralSplitInput {
  tenantId: string;
  transactionId: string;
  sourceUserId: string;      // Quem gerou o lucro
  amountCents: number;       // Valor da transação
  percentageBps?: number;    // Percentual (default: 500 = 5%)
  metadata?: Record<string, any>;
}

interface ReferralSplitResult {
  created: boolean;
  splitId?: string;
  beneficiaryUserId?: string;
  splitAmountCents?: number;
  reason?: string;
}

class ReferralSplitService {
  /**
   * Processa split de referral para uma transação
   * Chamado pelo motor de pagamento quando uma transação é concluída
   */
  async processReferralSplit(input: ReferralSplitInput): Promise<ReferralSplitResult> {
    const { 
      tenantId, 
      transactionId, 
      sourceUserId, 
      amountCents,
      percentageBps = 500, // 5% default
      metadata = {}
    } = input;

    // 1. Buscar vínculo de indicação
    const referralLink = await runQueryWithTenant<{
      link_id: string;
      referrer_user_id: string;
    }>(
      tenantId,
      `
      SELECT link_id, referrer_user_id
      FROM user_referral_links
      WHERE referred_user_id = $1
      LIMIT 1
      `,
      [sourceUserId]
    );

    // Se não foi indicado por ninguém, não há split
    if (!referralLink) {
      return {
        created: false,
        reason: 'Usuário não foi indicado por ninguém',
      };
    }

    // 2. Calcular valor do split
    const splitAmountCents = Math.floor(amountCents * percentageBps / 10000);

    // Se valor muito pequeno, não criar split (evitar micro-transações)
    if (splitAmountCents < 1) {
      return {
        created: false,
        reason: 'Valor do split menor que R$ 0,01',
      };
    }

    // 3. Criar registro de split
    const result = await runQueryWithTenant<{ split_id: string }>(
      tenantId,
      `
      INSERT INTO ledger_referral_splits (
        tenant_id,
        profit_event_id,
        original_transaction_id,
        source_user_id,
        beneficiary_user_id,
        referral_link_id,
        original_amount_cents,
        percentage_bps,
        split_amount_cents,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING split_id
      `,
      [
        tenantId,
        transactionId, // Usando transaction como profit_event por ora
        transactionId,
        sourceUserId,
        referralLink.referrer_user_id,
        referralLink.link_id,
        amountCents,
        percentageBps,
        splitAmountCents,
        JSON.stringify(metadata),
      ]
    );

    if (!result) {
      return {
        created: false,
        reason: 'Falha ao criar registro de split',
      };
    }

    console.log('[ReferralSplitService] ✅ Split de referral criado:', {
      splitId: result.split_id,
      sourceUserId,
      beneficiaryUserId: referralLink.referrer_user_id,
      amountCents,
      splitAmountCents,
      percentageBps,
    });

    return {
      created: true,
      splitId: result.split_id,
      beneficiaryUserId: referralLink.referrer_user_id,
      splitAmountCents,
    };
  }

  /**
   * Busca splits pendentes de crédito
   */
  async getPendingSplits(tenantId: string, limit: number = 100) {
    return runQueryWithTenant(
      tenantId,
      `
      SELECT *
      FROM ledger_referral_splits
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT $1
      `,
      [limit]
    );
  }

  /**
   * Marca split como creditado
   */
  async markAsCredited(tenantId: string, splitId: string) {
    return runQueryWithTenant(
      tenantId,
      `
      UPDATE ledger_referral_splits
      SET status = 'credited', credited_at = now()
      WHERE split_id = $1
      `,
      [splitId]
    );
  }

  /**
   * Busca histórico de comissões recebidas por um usuário
   */
  async getReceivedCommissions(tenantId: string, userId: string) {
    return runQueryWithTenant(
      tenantId,
      `
      SELECT 
        lrs.*,
        u.email as source_email
      FROM ledger_referral_splits lrs
      JOIN users u ON u.user_id = lrs.source_user_id
      WHERE lrs.beneficiary_user_id = $1
      ORDER BY lrs.created_at DESC
      `,
      [userId]
    );
  }

  /**
   * Busca total de comissões de um usuário
   */
  async getTotalCommissions(tenantId: string, userId: string) {
    const result = await runQueryWithTenant<{
      total_cents: string;
      count: string;
    }>(
      tenantId,
      `
      SELECT 
        COALESCE(SUM(split_amount_cents), 0) as total_cents,
        COUNT(*) as count
      FROM ledger_referral_splits
      WHERE beneficiary_user_id = $1 AND status = 'credited'
      `,
      [userId]
    );

    return {
      totalCents: parseInt(result?.total_cents || '0', 10),
      count: parseInt(result?.count || '0', 10),
    };
  }
}

export const referralSplitService = new ReferralSplitService();
```

### Integração com Motor de Pagamento

Onde chamar `referralSplitService.processReferralSplit()`:

1. **Após pagamento de serviço** (`work/payment.service.ts`)
2. **Após compra de ingresso** (`events/event-economy.service.ts`)
3. **Após venda de produto** (futuro)

Exemplo de integração:

```typescript
// Em payment.service.ts ou similar, APÓS confirmar pagamento:

import { referralSplitService } from '@core/economy/referral-split.service';

// Dentro da função que processa pagamento:
async function processPayment(/* ... */) {
  // ... código existente de pagamento ...
  
  // APÓS pagamento confirmado, processar split de referral
  try {
    const splitResult = await referralSplitService.processReferralSplit({
      tenantId,
      transactionId: transaction.transaction_id,
      sourceUserId: payerUserId,
      amountCents: amountCents,
      percentageBps: 500, // 5% para indicador
      metadata: {
        type: 'service_payment',
        serviceId: serviceId,
      },
    });
    
    if (splitResult.created) {
      console.log('[Payment] Split de referral criado:', splitResult);
    }
  } catch (err) {
    // Não falha o pagamento se split falhar
    console.warn('[Payment] Erro ao processar split de referral:', err);
  }
}
```

---

## 🔧 SOLUÇÃO C: CPF COMO IDENTIDADE CONECTADA

### Modelo de Dados Canônico

```
users (autenticação)
 ├── user_id (PK)
 ├── email
 ├── referral_code
 └── metadata (referred_by, etc)

user_profiles (PII sensível)
 ├── user_id (FK)
 ├── cpf (UNIQUE)
 └── created_at

profiles (dados sociais)
 ├── user_id (FK)
 ├── full_name
 ├── phone
 └── metadata (address, gender, birthdate)

actors (identidade social)
 ├── actor_id (PK)
 ├── user_id (FK) ← Herda identidade
 ├── actor_type
 └── display_name
```

### Query Canônica para Identidade Completa

```sql
-- Query que busca TUDO de um usuário (identidade completa)
SELECT 
  -- Autenticação
  u.user_id,
  u.email,
  u.referral_code,
  u.metadata as user_metadata,
  
  -- PII (LGPD)
  up.cpf,
  
  -- Dados sociais
  p.full_name,
  p.phone,
  p.metadata as profile_metadata,
  
  -- Identidade social
  a.actor_id,
  a.actor_type,
  a.display_name,
  a.avatar_url,
  
  -- Vínculo de indicação (quem indicou)
  url.referrer_user_id,
  
  -- Dados derivados
  EXTRACT(YEAR FROM AGE(
    (p.metadata->>'birthdate')::date
  )) as age

FROM users u
LEFT JOIN user_profiles up ON up.user_id = u.user_id
LEFT JOIN profiles p ON p.user_id = u.user_id AND p.tenant_id = u.tenant_id
LEFT JOIN actors a ON a.user_id = u.user_id AND a.tenant_id = u.tenant_id AND a.actor_type = 'user'
LEFT JOIN user_referral_links url ON url.referred_user_id = u.user_id

WHERE u.user_id = $1;
```

### Por que este modelo funciona

1. **users** — Autenticação pura, sem PII
2. **user_profiles** — Dados sensíveis isolados (LGPD)
3. **profiles** — Dados sociais (nome, telefone, endereço)
4. **actors** — Identidade pública (o que outros veem)
5. **user_referral_links** — Relação econômica

---

## 🎯 PROMPT FINAL PARA O CURSOR

```
Você está no monorepo Unificard.

CONTEXTO:
Colaboração Claude + ChatGPT identificou 3 gaps críticos.
Vou implementar soluções para todos.

TAREFAS (EXECUTAR EM ORDEM):

### 1. MIGRATION: Adicionar referral_code a users

Arquivo: backend/migrations/107_add_referral_code_to_users.sql

Criar com conteúdo:

-- Migration 107: Adicionar referral_code
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique ON users(tenant_id, referral_code) WHERE referral_code IS NOT NULL;


### 2. MIGRATION: Criar user_referral_links

Arquivo: backend/migrations/108_create_user_referral_links.sql

Criar com conteúdo:

-- Migration 108: Vínculos de indicação
CREATE TABLE IF NOT EXISTS user_referral_links (
  link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  referrer_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  referral_code_used VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(referred_user_id)
);
CREATE INDEX IF NOT EXISTS user_referral_links_referrer_idx ON user_referral_links(referrer_user_id);
ALTER TABLE user_referral_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_referral_links_rls ON user_referral_links USING (tenant_id::text = current_setting('app.current_tenant', true));


### 3. MIGRATION: Criar ledger_referral_splits

Arquivo: backend/migrations/109_create_ledger_referral_splits.sql

Criar com conteúdo:

-- Migration 109: Ledger de splits de indicação
CREATE TABLE IF NOT EXISTS ledger_referral_splits (
  split_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  profit_event_id UUID NOT NULL,
  original_transaction_id UUID NOT NULL,
  source_user_id UUID NOT NULL REFERENCES users(user_id),
  beneficiary_user_id UUID NOT NULL REFERENCES users(user_id),
  referral_link_id UUID,
  original_amount_cents INTEGER NOT NULL,
  percentage_bps INTEGER NOT NULL DEFAULT 500,
  split_amount_cents INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  credited_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS ledger_referral_splits_beneficiary_idx ON ledger_referral_splits(beneficiary_user_id);
CREATE INDEX IF NOT EXISTS ledger_referral_splits_status_idx ON ledger_referral_splits(status);
ALTER TABLE ledger_referral_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY ledger_referral_splits_rls ON ledger_referral_splits USING (tenant_id::text = current_setting('app.current_tenant', true));


### 4. ATUALIZAR core.service.ts

Arquivo: backend/src/core/core.service.ts

SUBSTITUIR linhas 117-165 (busca de referralCode e CPF) por:

      // 2. Perfil pessoal básico - Query única com JOIN
      let referralCode: string | null = null;
      let cpf: string | null = null;
      
      try {
        const { pool } = await import('@core/database/pool');
        
        const identityResult = await pool.query<{
          referral_code: string | null;
          cpf: string | null;
        }>(
          `
          SELECT u.referral_code, up.cpf
          FROM users u
          LEFT JOIN user_profiles up ON up.user_id = u.user_id
          WHERE u.user_id = $1
          LIMIT 1
          `,
          [userId]
        );
        
        const row = identityResult.rows[0];
        if (row) {
          cpf = row.cpf || null;
          referralCode = row.referral_code || null;
          
          // Geração garantida se não tem código
          if (!referralCode) {
            console.log('[CoreService] 🔄 Gerando código:', { userId });
            const { referralService } = await import('@core/referral/referral.service');
            referralCode = await referralService.getOrCreateReferralCode(tenantId, userId);
          }
        }
      } catch (err) {
        console.error('[CoreService] ❌ Erro ao buscar identidade:', err);
        try {
          const { referralService } = await import('@core/referral/referral.service');
          referralCode = await referralService.getOrCreateReferralCode(tenantId, userId);
        } catch (genErr) {
          console.error('[CoreService] ❌ Falha na geração:', genErr);
        }
      }


### 5. ATUALIZAR referral.service.ts

Arquivo: backend/src/core/referral/referral.service.ts

APÓS linha 141 (após salvar referred_by em metadata), ADICIONAR:

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
    } catch (err) {
      console.warn('[ReferralService] Erro ao registrar vínculo:', err);
    }


### 6. RODAR MIGRATIONS

cd backend
npm run migrate


### 7. REINICIAR E TESTAR

VALIDAÇÃO:
1. Criar novo usuário
2. Acessar /profile
3. Código de indicação DEVE aparecer
4. Verificar no banco:
   SELECT referral_code FROM users WHERE email = 'novo@email.com';
```

---

## 🧠 REGRA DE OURO (ChatGPT)

> **Cadastro cria identidade.**  
> **Uso cria valor.**  
> **Valor cria split.**

---

## 📋 CHECKLIST FINAL

- [ ] Migration 107 criada e executada
- [ ] Migration 108 criada e executada
- [ ] Migration 109 criada e executada
- [ ] core.service.ts atualizado (query única)
- [ ] referral.service.ts atualizado (salva em user_referral_links)
- [ ] referral-split.service.ts criado
- [ ] Integração com motor de pagamento (Work/Events)
- [ ] Frontend exibe código no perfil
- [ ] Botão copiar funciona
- [ ] Teste E2E: cadastro → indicação → lucro → split

---

*Documento final - Colaboração Claude + ChatGPT*  
*02/01/2026*
