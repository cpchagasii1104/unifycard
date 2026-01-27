# 📋 CHECKLIST FASE 10 v2 — EVENTOS + ESCROW + PENALIDADES

**Derivado de:** `CONTRATO_EVENTOS_V1.2.md`  
**Data:** 28/12/2025  
**Executor:** Cursor AI  
**Revisor:** Clayton

---

## 🚨 MUDANÇA DE PARADIGMA

```
ANTES (v1.1):
  Compra → Split imediato → Organizador recebe

AGORA (v1.2):
  Compra → Escrow → Evento → Validação → Split → Penalidades
```

---

## PARTE A: INFRAESTRUTURA DE ESCROW

### A.1 Migration — Tabela de Escrow

**Criar:** `migrations/092_event_escrow.sql`

```sql
-- ================================================
-- UNIFICARD - MIGRATION 092
-- Event Escrow (Contrato v1.2)
-- Fundo bloqueado por evento
-- ================================================

CREATE TABLE IF NOT EXISTS event_escrow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  
  -- Saldos
  total_collected_cents INTEGER NOT NULL DEFAULT 0,
  total_released_cents INTEGER NOT NULL DEFAULT 0,
  total_refunded_cents INTEGER NOT NULL DEFAULT 0,
  current_balance_cents INTEGER GENERATED ALWAYS AS (
    total_collected_cents - total_released_cents - total_refunded_cents
  ) STORED,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'COLLECTING'
    CHECK (status IN ('COLLECTING', 'LOCKED', 'RELEASING', 'COMPLETED', 'REFUNDING')),
  
  -- Timestamps
  locked_at TIMESTAMPTZ,
  release_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT event_escrow_unique UNIQUE (event_id)
);

-- Transações do escrow
CREATE TABLE IF NOT EXISTS event_escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  escrow_id UUID NOT NULL REFERENCES event_escrow(id) ON DELETE CASCADE,
  
  -- Tipo
  transaction_type VARCHAR(20) NOT NULL
    CHECK (transaction_type IN ('DEPOSIT', 'RELEASE', 'REFUND', 'PENALTY')),
  
  -- Valores
  amount_cents INTEGER NOT NULL,
  
  -- Referências
  source_account_id UUID,        -- Quem pagou
  destination_account_id UUID,   -- Quem recebeu
  ticket_id UUID,                -- Se for compra de ingresso
  participant_id UUID,           -- Se for pagamento de prestador
  
  -- Metadata
  reason VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  
  -- Idempotência
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_event_escrow_event ON event_escrow(event_id);
CREATE INDEX idx_event_escrow_status ON event_escrow(status);
CREATE INDEX idx_escrow_transactions_escrow ON event_escrow_transactions(escrow_id);
CREATE INDEX idx_escrow_transactions_type ON event_escrow_transactions(transaction_type);

-- RLS
ALTER TABLE event_escrow ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_escrow_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_escrow_rls ON event_escrow
  USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY event_escrow_transactions_rls ON event_escrow_transactions
  USING (tenant_id::text = current_setting('app.current_tenant', true));

COMMENT ON TABLE event_escrow IS 'Fundo bloqueado por evento (Contrato v1.2)';
COMMENT ON TABLE event_escrow_transactions IS 'Transações do escrow';
```

### Checklist A.1
- [ ] Criar migration 092
- [ ] Executar em dev
- [ ] Validar schema
- [ ] Commit: `feat(db): add event escrow tables`

---

### A.2 Backend — Escrow Service

**Criar:** `backend/src/core/economy/escrow.service.ts`

```typescript
// src/core/economy/escrow.service.ts
// Serviço de Escrow (Contrato v1.2)

import { runQueryWithTenant, runMutationWithTenant } from '@core/database/pool';
import { eventBus } from '@core/events/event-bus';
import { v4 as uuid } from 'uuid';

export interface EscrowDeposit {
  eventId: string;
  sourceAccountId: string;
  amountCents: number;
  ticketId?: string;
  idempotencyKey: string;
}

export interface EscrowRelease {
  eventId: string;
  destinationAccountId: string;
  amountCents: number;
  participantId?: string;
  reason: string;
  idempotencyKey: string;
}

class EscrowService {
  /**
   * Cria escrow para evento (chamado na publicação)
   */
  async createEscrow(tenantId: string, eventId: string): Promise<void> {
    await runMutationWithTenant(
      tenantId,
      `INSERT INTO event_escrow (tenant_id, event_id, status)
       VALUES ($1, $2, 'COLLECTING')
       ON CONFLICT (event_id) DO NOTHING`,
      [tenantId, eventId]
    );
  }

  /**
   * Deposita valor no escrow (compra de ingresso)
   */
  async deposit(tenantId: string, params: EscrowDeposit): Promise<void> {
    const { eventId, sourceAccountId, amountCents, ticketId, idempotencyKey } = params;

    // Verificar idempotência
    const existing = await this.getTransactionByKey(tenantId, idempotencyKey);
    if (existing) return;

    // Buscar escrow
    const escrow = await this.getEscrowByEvent(tenantId, eventId);
    if (!escrow) throw new Error('Escrow não encontrado para este evento');
    if (escrow.status !== 'COLLECTING') throw new Error('Escrow não está aceitando depósitos');

    // Registrar transação
    await runMutationWithTenant(
      tenantId,
      `INSERT INTO event_escrow_transactions 
       (tenant_id, escrow_id, transaction_type, amount_cents, source_account_id, ticket_id, idempotency_key)
       VALUES ($1, $2, 'DEPOSIT', $3, $4, $5, $6)`,
      [tenantId, escrow.id, amountCents, sourceAccountId, ticketId, idempotencyKey]
    );

    // Atualizar saldo
    await runMutationWithTenant(
      tenantId,
      `UPDATE event_escrow 
       SET total_collected_cents = total_collected_cents + $1, updated_at = now()
       WHERE id = $2`,
      [amountCents, escrow.id]
    );

    await eventBus.publish({
      tenantId,
      type: 'escrow.deposit',
      payload: { eventId, amount: amountCents, ticketId },
    });
  }

  /**
   * Bloqueia escrow (início do evento)
   */
  async lock(tenantId: string, eventId: string): Promise<void> {
    await runMutationWithTenant(
      tenantId,
      `UPDATE event_escrow 
       SET status = 'LOCKED', locked_at = now(), updated_at = now()
       WHERE event_id = $1 AND status = 'COLLECTING'`,
      [eventId]
    );
  }

  /**
   * Inicia liberação (pós-evento)
   */
  async startRelease(tenantId: string, eventId: string): Promise<void> {
    await runMutationWithTenant(
      tenantId,
      `UPDATE event_escrow 
       SET status = 'RELEASING', release_started_at = now(), updated_at = now()
       WHERE event_id = $1 AND status = 'LOCKED'`,
      [eventId]
    );
  }

  /**
   * Libera valor do escrow (pagamento pós-evento)
   */
  async release(tenantId: string, params: EscrowRelease): Promise<void> {
    const { eventId, destinationAccountId, amountCents, participantId, reason, idempotencyKey } = params;

    // Verificar idempotência
    const existing = await this.getTransactionByKey(tenantId, idempotencyKey);
    if (existing) return;

    const escrow = await this.getEscrowByEvent(tenantId, eventId);
    if (!escrow) throw new Error('Escrow não encontrado');
    if (escrow.status !== 'RELEASING') throw new Error('Escrow não está em fase de liberação');
    if (escrow.current_balance_cents < amountCents) throw new Error('Saldo insuficiente no escrow');

    // Registrar transação
    await runMutationWithTenant(
      tenantId,
      `INSERT INTO event_escrow_transactions 
       (tenant_id, escrow_id, transaction_type, amount_cents, destination_account_id, participant_id, reason, idempotency_key)
       VALUES ($1, $2, 'RELEASE', $3, $4, $5, $6, $7)`,
      [tenantId, escrow.id, amountCents, destinationAccountId, participantId, reason, idempotencyKey]
    );

    // Atualizar saldo
    await runMutationWithTenant(
      tenantId,
      `UPDATE event_escrow 
       SET total_released_cents = total_released_cents + $1, updated_at = now()
       WHERE id = $2`,
      [amountCents, escrow.id]
    );

    await eventBus.publish({
      tenantId,
      type: 'escrow.release',
      payload: { eventId, destinationAccountId, amount: amountCents, participantId },
    });
  }

  /**
   * Reembolsa valor (cancelamento)
   */
  async refund(tenantId: string, eventId: string, ticketId: string, idempotencyKey: string): Promise<void> {
    const escrow = await this.getEscrowByEvent(tenantId, eventId);
    if (!escrow) throw new Error('Escrow não encontrado');

    // Buscar transação original do ticket
    const original = await runQueryWithTenant<any>(
      tenantId,
      `SELECT * FROM event_escrow_transactions 
       WHERE escrow_id = $1 AND ticket_id = $2 AND transaction_type = 'DEPOSIT'`,
      [escrow.id, ticketId]
    );

    if (!original) throw new Error('Transação original não encontrada');

    // Registrar reembolso
    await runMutationWithTenant(
      tenantId,
      `INSERT INTO event_escrow_transactions 
       (tenant_id, escrow_id, transaction_type, amount_cents, destination_account_id, ticket_id, reason, idempotency_key)
       VALUES ($1, $2, 'REFUND', $3, $4, $5, 'CANCELLED', $6)`,
      [tenantId, escrow.id, original.amount_cents, original.source_account_id, ticketId, idempotencyKey]
    );

    // Atualizar saldo
    await runMutationWithTenant(
      tenantId,
      `UPDATE event_escrow 
       SET total_refunded_cents = total_refunded_cents + $1, updated_at = now()
       WHERE id = $2`,
      [original.amount_cents, escrow.id]
    );
  }

  /**
   * Finaliza escrow
   */
  async complete(tenantId: string, eventId: string): Promise<void> {
    await runMutationWithTenant(
      tenantId,
      `UPDATE event_escrow 
       SET status = 'COMPLETED', completed_at = now(), updated_at = now()
       WHERE event_id = $1`,
      [eventId]
    );
  }

  private async getEscrowByEvent(tenantId: string, eventId: string) {
    return runQueryWithTenant<any>(
      tenantId,
      `SELECT * FROM event_escrow WHERE event_id = $1`,
      [eventId]
    );
  }

  private async getTransactionByKey(tenantId: string, key: string) {
    return runQueryWithTenant<any>(
      tenantId,
      `SELECT * FROM event_escrow_transactions WHERE idempotency_key = $1`,
      [key]
    );
  }
}

export const escrowService = new EscrowService();
```

### Checklist A.2
- [ ] Criar escrow.service.ts
- [ ] Testar deposit/release/refund
- [ ] Commit: `feat(core): add escrow service`

---

## PARTE B: SISTEMA DE PENALIDADES

### B.1 Migration — Tabela de Scores e Penalidades

**Criar:** `migrations/093_actor_scores_penalties.sql`

```sql
-- ================================================
-- UNIFICARD - MIGRATION 093
-- Actor Scores & Penalties (Contrato v1.2)
-- ================================================

-- Score do ator
CREATE TABLE IF NOT EXISTS actor_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  actor_type VARCHAR(10) NOT NULL CHECK (actor_type IN ('user', 'page', 'group')),
  
  -- Score atual (0-100)
  current_score INTEGER NOT NULL DEFAULT 80
    CHECK (current_score >= 0 AND current_score <= 100),
  
  -- Estatísticas
  total_events_organized INTEGER DEFAULT 0,
  total_events_participated INTEGER DEFAULT 0,
  total_check_ins INTEGER DEFAULT 0,
  total_no_shows INTEGER DEFAULT 0,
  total_cancellations INTEGER DEFAULT 0,
  total_complaints_received INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT actor_scores_unique UNIQUE (tenant_id, actor_id, actor_type)
);

-- Histórico de mudanças de score
CREATE TABLE IF NOT EXISTS actor_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  actor_score_id UUID NOT NULL REFERENCES actor_scores(id) ON DELETE CASCADE,
  
  -- Mudança
  previous_score INTEGER NOT NULL,
  new_score INTEGER NOT NULL,
  change_amount INTEGER NOT NULL,
  
  -- Motivo
  reason VARCHAR(50) NOT NULL,
  event_id UUID,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Penalidades ativas
CREATE TABLE IF NOT EXISTS actor_penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  actor_type VARCHAR(10) NOT NULL,
  
  -- Tipo de penalidade
  penalty_type VARCHAR(50) NOT NULL
    CHECK (penalty_type IN (
      'SCORE_REDUCTION',
      'CREATION_SUSPENDED',
      'INVITATION_BLOCKED',
      'PURCHASE_RESTRICTED',
      'ACCOUNT_SUSPENDED',
      'PERMANENT_BAN',
      'FINANCIAL_HOLD'
    )),
  
  -- Detalhes
  reason VARCHAR(255) NOT NULL,
  event_id UUID,
  severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
    CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  
  -- Duração
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,  -- NULL = permanente
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'EXPIRED', 'APPEALED', 'REVOKED')),
  
  -- Valor financeiro (se aplicável)
  financial_amount_cents INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX idx_actor_scores_actor ON actor_scores(actor_id, actor_type);
CREATE INDEX idx_actor_scores_score ON actor_scores(current_score);
CREATE INDEX idx_actor_penalties_actor ON actor_penalties(actor_id, actor_type);
CREATE INDEX idx_actor_penalties_status ON actor_penalties(status);
CREATE INDEX idx_actor_penalties_type ON actor_penalties(penalty_type);

-- RLS
ALTER TABLE actor_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_penalties ENABLE ROW LEVEL SECURITY;

CREATE POLICY actor_scores_rls ON actor_scores
  USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY actor_score_history_rls ON actor_score_history
  USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY actor_penalties_rls ON actor_penalties
  USING (tenant_id::text = current_setting('app.current_tenant', true));

COMMENT ON TABLE actor_scores IS 'Score de reputação dos atores';
COMMENT ON TABLE actor_penalties IS 'Penalidades ativas e históricas';
```

### Checklist B.1
- [ ] Criar migration 093
- [ ] Executar em dev
- [ ] Commit: `feat(db): add actor scores and penalties`

---

### B.2 Backend — Penalty Service

**Criar:** `backend/src/core/reputation/penalty.service.ts`

```typescript
// src/core/reputation/penalty.service.ts
// Sistema de Penalidades (Contrato v1.2)

import { runQueryWithTenant, runMutationWithTenant } from '@core/database/pool';
import { eventBus } from '@core/events/event-bus';

// Configuração de penalidades
export const PENALTY_CONFIG = {
  // Organizadores
  CANCEL_LESS_THAN_24H: { scoreChange: -20, financialRate: 0.10, type: 'FINANCIAL_HOLD' },
  CANCEL_LESS_THAN_7D: { scoreChange: -10, financialRate: 0.05, type: 'SCORE_REDUCTION' },
  HIGH_COMPLAINT_RATE: { scoreChange: -15, type: 'CREATION_SUSPENDED', duration: 30 },
  LOW_CHECKIN_RATE: { scoreChange: -10, type: 'SCORE_REDUCTION' },
  FALSE_INFO: { scoreChange: -50, type: 'ACCOUNT_SUSPENDED', duration: 90 },
  FRAUD: { scoreChange: -100, type: 'PERMANENT_BAN' },

  // Prestadores
  NO_SHOW: { scoreChange: -30, type: 'INVITATION_BLOCKED', duration: 60 },
  LATE_CANCEL: { scoreChange: -15, type: 'SCORE_REDUCTION' },
  PARTIAL_DELIVERY: { scoreChange: -10, type: 'SCORE_REDUCTION' },

  // Compradores
  BUYER_NO_SHOW: { scoreChange: -5, type: 'SCORE_REDUCTION' },
  MULTIPLE_NO_SHOWS: { scoreChange: -15, type: 'PURCHASE_RESTRICTED', duration: 30 },
  FRAUDULENT_CHARGEBACK: { scoreChange: -100, type: 'PERMANENT_BAN' },

  // Groups
  GROUP_LOW_ATTENDANCE: { scoreChange: -20, type: 'CREATION_SUSPENDED', duration: 60 },
  GROUP_ACTING_AS_COMPANY: { scoreChange: -50, type: 'ACCOUNT_SUSPENDED' },
};

// Thresholds
export const SCORE_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 60,
  WARNING: 40,
  CRITICAL: 20,
  BLOCKED: 0,
};

class PenaltyService {
  /**
   * Aplica penalidade a um ator
   */
  async applyPenalty(
    tenantId: string,
    actorId: string,
    actorType: string,
    penaltyKey: keyof typeof PENALTY_CONFIG,
    eventId?: string
  ): Promise<void> {
    const config = PENALTY_CONFIG[penaltyKey];

    // Atualizar score
    await this.updateScore(tenantId, actorId, actorType, config.scoreChange, penaltyKey, eventId);

    // Criar penalidade se necessário
    if (config.type !== 'SCORE_REDUCTION') {
      const endsAt = config.duration
        ? new Date(Date.now() + config.duration * 24 * 60 * 60 * 1000)
        : null;

      await runMutationWithTenant(
        tenantId,
        `INSERT INTO actor_penalties 
         (tenant_id, actor_id, actor_type, penalty_type, reason, event_id, starts_at, ends_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), $7)`,
        [tenantId, actorId, actorType, config.type, penaltyKey, eventId, endsAt]
      );
    }

    await eventBus.publish({
      tenantId,
      type: 'penalty.applied',
      payload: { actorId, actorType, penaltyKey, eventId },
    });
  }

  /**
   * Atualiza score do ator
   */
  async updateScore(
    tenantId: string,
    actorId: string,
    actorType: string,
    change: number,
    reason: string,
    eventId?: string
  ): Promise<number> {
    // Buscar ou criar score
    let score = await this.getScore(tenantId, actorId, actorType);
    if (!score) {
      await this.createScore(tenantId, actorId, actorType);
      score = { current_score: 80, id: null };
    }

    const previousScore = score.current_score;
    const newScore = Math.max(0, Math.min(100, previousScore + change));

    // Atualizar score
    await runMutationWithTenant(
      tenantId,
      `UPDATE actor_scores 
       SET current_score = $1, updated_at = now()
       WHERE actor_id = $2 AND actor_type = $3`,
      [newScore, actorId, actorType]
    );

    // Registrar histórico
    const scoreRecord = await this.getScore(tenantId, actorId, actorType);
    await runMutationWithTenant(
      tenantId,
      `INSERT INTO actor_score_history 
       (tenant_id, actor_score_id, previous_score, new_score, change_amount, reason, event_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenantId, scoreRecord.id, previousScore, newScore, change, reason, eventId]
    );

    // Verificar se cruzou threshold crítico
    if (previousScore >= SCORE_THRESHOLDS.CRITICAL && newScore < SCORE_THRESHOLDS.CRITICAL) {
      await this.applyPenalty(tenantId, actorId, actorType, 'LOW_CHECKIN_RATE', eventId);
    }

    return newScore;
  }

  /**
   * Verifica se ator pode realizar ação
   */
  async canPerformAction(
    tenantId: string,
    actorId: string,
    actorType: string,
    action: 'CREATE_EVENT' | 'RECEIVE_INVITATION' | 'PURCHASE' | 'PARTICIPATE'
  ): Promise<{ allowed: boolean; reason?: string }> {
    const score = await this.getScore(tenantId, actorId, actorType);
    if (!score) return { allowed: true };

    // Verificar score mínimo
    if (action === 'CREATE_EVENT' && score.current_score < SCORE_THRESHOLDS.WARNING) {
      return { allowed: false, reason: 'Score muito baixo para criar eventos' };
    }

    if (action === 'RECEIVE_INVITATION' && score.current_score < SCORE_THRESHOLDS.WARNING) {
      return { allowed: false, reason: 'Score muito baixo para receber convites' };
    }

    // Verificar penalidades ativas
    const activePenalty = await this.getActivePenalty(tenantId, actorId, actorType, action);
    if (activePenalty) {
      return { allowed: false, reason: `Penalidade ativa: ${activePenalty.reason}` };
    }

    return { allowed: true };
  }

  /**
   * Processa avaliação automática pós-evento
   */
  async processEventEvaluation(tenantId: string, eventId: string): Promise<void> {
    const event = await this.getEventWithParticipants(tenantId, eventId);
    if (!event) return;

    // Avaliar organizador
    const checkInRate = event.checkInCount / event.ticketsSold;
    if (checkInRate < 0.20) {
      await this.applyPenalty(tenantId, event.organizerActorId, event.organizerActorType, 'LOW_CHECKIN_RATE', eventId);
    } else if (checkInRate > 0.80) {
      await this.updateScore(tenantId, event.organizerActorId, event.organizerActorType, 5, 'HIGH_CHECKIN_RATE', eventId);
    }

    // Avaliar prestadores
    for (const participant of event.participants) {
      if (!participant.checkedIn) {
        await this.applyPenalty(tenantId, participant.actorId, participant.actorType, 'NO_SHOW', eventId);
      } else if (participant.checkInRate < 0.50) {
        await this.applyPenalty(tenantId, participant.actorId, participant.actorType, 'PARTIAL_DELIVERY', eventId);
      } else if (participant.checkInRate >= 0.80) {
        await this.updateScore(tenantId, participant.actorId, participant.actorType, 5, 'FULL_DELIVERY', eventId);
      }
    }

    // Avaliar compradores que não foram
    const noShowBuyers = await this.getNoShowBuyers(tenantId, eventId);
    for (const buyer of noShowBuyers) {
      const recentNoShows = await this.countRecentNoShows(tenantId, buyer.actorId, 90);
      if (recentNoShows >= 3) {
        await this.applyPenalty(tenantId, buyer.actorId, 'user', 'MULTIPLE_NO_SHOWS', eventId);
      } else {
        await this.applyPenalty(tenantId, buyer.actorId, 'user', 'BUYER_NO_SHOW', eventId);
      }
    }
  }

  /**
   * Processa cancelamento de evento
   */
  async processEventCancellation(
    tenantId: string,
    eventId: string,
    hoursBeforeEvent: number
  ): Promise<void> {
    const event = await this.getEventWithParticipants(tenantId, eventId);
    if (!event) return;

    let penaltyKey: keyof typeof PENALTY_CONFIG;
    if (hoursBeforeEvent < 24) {
      penaltyKey = 'CANCEL_LESS_THAN_24H';
    } else if (hoursBeforeEvent < 168) { // 7 dias
      penaltyKey = 'CANCEL_LESS_THAN_7D';
    } else {
      // Sem penalidade se cancelou com antecedência
      return;
    }

    await this.applyPenalty(tenantId, event.organizerActorId, event.organizerActorType, penaltyKey, eventId);
  }

  // Métodos auxiliares privados...
  private async getScore(tenantId: string, actorId: string, actorType: string) {
    return runQueryWithTenant<any>(
      tenantId,
      `SELECT * FROM actor_scores WHERE actor_id = $1 AND actor_type = $2`,
      [actorId, actorType]
    );
  }

  private async createScore(tenantId: string, actorId: string, actorType: string) {
    return runMutationWithTenant(
      tenantId,
      `INSERT INTO actor_scores (tenant_id, actor_id, actor_type, current_score)
       VALUES ($1, $2, $3, 80)
       ON CONFLICT DO NOTHING`,
      [tenantId, actorId, actorType]
    );
  }

  private async getActivePenalty(tenantId: string, actorId: string, actorType: string, action: string) {
    const typeMapping: Record<string, string[]> = {
      CREATE_EVENT: ['CREATION_SUSPENDED', 'ACCOUNT_SUSPENDED', 'PERMANENT_BAN'],
      RECEIVE_INVITATION: ['INVITATION_BLOCKED', 'ACCOUNT_SUSPENDED', 'PERMANENT_BAN'],
      PURCHASE: ['PURCHASE_RESTRICTED', 'ACCOUNT_SUSPENDED', 'PERMANENT_BAN'],
      PARTICIPATE: ['ACCOUNT_SUSPENDED', 'PERMANENT_BAN'],
    };

    const types = typeMapping[action] || [];
    return runQueryWithTenant<any>(
      tenantId,
      `SELECT * FROM actor_penalties 
       WHERE actor_id = $1 AND actor_type = $2 
       AND status = 'ACTIVE'
       AND penalty_type = ANY($3)
       AND (ends_at IS NULL OR ends_at > now())
       LIMIT 1`,
      [actorId, actorType, types]
    );
  }

  private async getEventWithParticipants(tenantId: string, eventId: string) {
    // Implementar busca de evento com participantes
    return null as any;
  }

  private async getNoShowBuyers(tenantId: string, eventId: string) {
    return [] as any[];
  }

  private async countRecentNoShows(tenantId: string, actorId: string, days: number) {
    return 0;
  }
}

export const penaltyService = new PenaltyService();
```

### Checklist B.2
- [ ] Criar penalty.service.ts
- [ ] Testar aplicação de penalidades
- [ ] Testar verificação de permissões
- [ ] Commit: `feat(core): add penalty service`

---

## PARTE C: SPLIT PÓS-EVENTO

### C.1 Backend — Job de Split Pós-Evento

**Criar:** `backend/src/jobs/post-event-split.job.ts`

```typescript
// src/jobs/post-event-split.job.ts
// Job de Split Pós-Evento (Contrato v1.2)

import { escrowService } from '@core/economy/escrow.service';
import { penaltyService } from '@core/reputation/penalty.service';
import { runQueryWithTenant, runMutationWithTenant } from '@core/database/pool';
import { v4 as uuid } from 'uuid';

interface EventParticipant {
  id: string;
  actorId: string;
  actorType: string;
  role: string;
  agreedAmountCents: number;
  expectedHeadcount: number;
  checkedInCount: number;
  accountId: string;
}

class PostEventSplitJob {
  /**
   * Executa split pós-evento
   * Chamado pelo scheduler após evento terminar
   */
  async execute(tenantId: string, eventId: string): Promise<void> {
    console.log(`[PostEventSplit] Iniciando para evento ${eventId}`);

    // 1. Verificar se evento já foi processado
    const event = await this.getEvent(tenantId, eventId);
    if (!event || event.split_processed) {
      console.log(`[PostEventSplit] Evento já processado ou não encontrado`);
      return;
    }

    // 2. Iniciar liberação do escrow
    await escrowService.startRelease(tenantId, eventId);

    // 3. Buscar participantes com check-in
    const participants = await this.getParticipantsWithCheckIn(tenantId, eventId);

    // 4. Processar pagamento de cada participante
    for (const participant of participants) {
      const checkInRate = participant.checkedInCount / participant.expectedHeadcount;
      const adjustedAmount = Math.floor(participant.agreedAmountCents * checkInRate);

      if (adjustedAmount > 0) {
        await escrowService.release(tenantId, {
          eventId,
          destinationAccountId: participant.accountId,
          amountCents: adjustedAmount,
          participantId: participant.id,
          reason: `PARTICIPANT_PAYMENT_${participant.role}`,
          idempotencyKey: `split-${eventId}-${participant.id}-${uuid()}`,
        });
      }
    }

    // 5. Calcular e distribuir restante (organizador + splits fixos)
    await this.distributeRemainder(tenantId, eventId, event);

    // 6. Processar avaliações automáticas
    await penaltyService.processEventEvaluation(tenantId, eventId);

    // 7. Finalizar escrow
    await escrowService.complete(tenantId, eventId);

    // 8. Marcar evento como processado
    await runMutationWithTenant(
      tenantId,
      `UPDATE events SET split_processed = true, split_processed_at = now() WHERE id = $1`,
      [eventId]
    );

    console.log(`[PostEventSplit] Concluído para evento ${eventId}`);
  }

  private async distributeRemainder(tenantId: string, eventId: string, event: any): Promise<void> {
    // Buscar saldo restante
    const escrow = await runQueryWithTenant<any>(
      tenantId,
      `SELECT current_balance_cents FROM event_escrow WHERE event_id = $1`,
      [eventId]
    );

    if (!escrow || escrow.current_balance_cents <= 0) return;

    const remainder = escrow.current_balance_cents;

    // Split padrão: 70% organizador, 15% cidade, 10% região, 5% grupo
    const splits = [
      { accountId: event.organizerAccountId, percent: 70, reason: 'ORGANIZER' },
      { accountId: event.cityAccountId, percent: 15, reason: 'CITY_FUND' },
      { accountId: event.regionAccountId, percent: 10, reason: 'REGION_FUND' },
      { accountId: event.groupAccountId, percent: 5, reason: 'GROUP_FUND' },
    ].filter(s => s.accountId);

    for (const split of splits) {
      const amount = Math.floor(remainder * split.percent / 100);
      if (amount > 0) {
        await escrowService.release(tenantId, {
          eventId,
          destinationAccountId: split.accountId,
          amountCents: amount,
          reason: split.reason,
          idempotencyKey: `split-${eventId}-${split.reason}-${uuid()}`,
        });
      }
    }
  }

  private async getEvent(tenantId: string, eventId: string) {
    return runQueryWithTenant<any>(
      tenantId,
      `SELECT e.*, 
              a.account_id as organizer_account_id,
              t.city_fund_account_id as city_account_id,
              t.region_fund_account_id as region_account_id
       FROM events e
       LEFT JOIN accounts a ON a.owner_id = e.actor_id
       LEFT JOIN tenants t ON t.tenant_id = e.tenant_id
       WHERE e.id = $1`,
      [eventId]
    );
  }

  private async getParticipantsWithCheckIn(tenantId: string, eventId: string): Promise<EventParticipant[]> {
    const results = await runQueryWithTenant<any[]>(
      tenantId,
      `SELECT ep.*, 
              a.account_id,
              (SELECT COUNT(*) FROM event_check_ins ci WHERE ci.participant_id = ep.id) as checked_in_count
       FROM event_participants ep
       LEFT JOIN accounts a ON a.owner_id = ep.actor_id
       WHERE ep.event_id = $1`,
      [eventId]
    );
    return results || [];
  }
}

export const postEventSplitJob = new PostEventSplitJob();
```

### Checklist C.1
- [ ] Criar post-event-split.job.ts
- [ ] Integrar com scheduler
- [ ] Testar fluxo completo
- [ ] Commit: `feat(jobs): add post-event split job`

---

### C.2 Backend — Scheduler de Eventos

**Criar:** `backend/src/jobs/event-scheduler.ts`

```typescript
// src/jobs/event-scheduler.ts
// Scheduler de eventos (Contrato v1.2)

import { postEventSplitJob } from './post-event-split.job';
import { escrowService } from '@core/economy/escrow.service';
import { runQuery } from '@core/database/pool';

class EventScheduler {
  /**
   * Roda a cada hora
   * Processa eventos que terminaram
   */
  async processEndedEvents(): Promise<void> {
    console.log('[EventScheduler] Verificando eventos finalizados...');

    // Buscar eventos que terminaram nas últimas 2 horas e não foram processados
    const events = await runQuery<any[]>(`
      SELECT e.id, e.tenant_id 
      FROM events e
      WHERE e.end_time < now()
        AND e.end_time > now() - INTERVAL '2 hours'
        AND e.status = 'PUBLISHED'
        AND (e.split_processed IS NULL OR e.split_processed = false)
    `);

    for (const event of events || []) {
      try {
        await postEventSplitJob.execute(event.tenant_id, event.id);
      } catch (error) {
        console.error(`[EventScheduler] Erro ao processar evento ${event.id}:`, error);
      }
    }
  }

  /**
   * Roda 30 min antes do evento
   * Bloqueia o escrow
   */
  async lockUpcomingEvents(): Promise<void> {
    console.log('[EventScheduler] Bloqueando escrow de eventos próximos...');

    const events = await runQuery<any[]>(`
      SELECT e.id, e.tenant_id 
      FROM events e
      JOIN event_escrow es ON es.event_id = e.id
      WHERE e.start_time < now() + INTERVAL '30 minutes'
        AND e.start_time > now()
        AND es.status = 'COLLECTING'
    `);

    for (const event of events || []) {
      try {
        await escrowService.lock(event.tenant_id, event.id);
      } catch (error) {
        console.error(`[EventScheduler] Erro ao bloquear escrow ${event.id}:`, error);
      }
    }
  }

  /**
   * Expira penalidades antigas
   */
  async expirePenalties(): Promise<void> {
    await runQuery(`
      UPDATE actor_penalties 
      SET status = 'EXPIRED', resolved_at = now()
      WHERE status = 'ACTIVE' AND ends_at < now()
    `);
  }
}

export const eventScheduler = new EventScheduler();
```

### Checklist C.2
- [ ] Criar event-scheduler.ts
- [ ] Configurar cron jobs
- [ ] Commit: `feat(jobs): add event scheduler`

---

## PARTE D: PARTICIPANTES E CHECK-IN

### D.1 Migration — Participantes de Evento

**Criar:** `migrations/094_event_participants.sql`

```sql
-- ================================================
-- UNIFICARD - MIGRATION 094
-- Event Participants (Contrato v1.2)
-- Prestadores, artistas, staff
-- ================================================

CREATE TABLE IF NOT EXISTS event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  
  -- Actor
  actor_id UUID NOT NULL,
  actor_type VARCHAR(10) NOT NULL CHECK (actor_type IN ('user', 'page')),
  
  -- Função
  role VARCHAR(50) NOT NULL
    CHECK (role IN ('artist', 'vendor', 'security', 'cleaning', 'staff', 'venue', 'producer', 'volunteer')),
  
  -- Economia
  agreed_amount_cents INTEGER NOT NULL DEFAULT 0,
  payment_type VARCHAR(20) NOT NULL DEFAULT 'fixed'
    CHECK (payment_type IN ('fixed', 'percentage', 'per_person')),
  
  -- Check-in
  expected_headcount INTEGER NOT NULL DEFAULT 1,
  check_in_required BOOLEAN NOT NULL DEFAULT true,
  minimum_check_in_rate NUMERIC(3,2) DEFAULT 0.80,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'INVITED'
    CHECK (status IN ('INVITED', 'CONFIRMED', 'DECLINED', 'CHECKED_IN', 'NO_SHOW', 'PARTIAL')),
  
  -- Timestamps
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  
  CONSTRAINT event_participants_unique UNIQUE (event_id, actor_id)
);

-- Check-ins individuais (para grupos)
CREATE TABLE IF NOT EXISTS event_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES event_participants(id) ON DELETE CASCADE,
  
  -- Quem fez check-in
  actor_id UUID NOT NULL,
  actor_type VARCHAR(10) NOT NULL,
  
  -- Validação
  check_in_method VARCHAR(20) NOT NULL
    CHECK (check_in_method IN ('QR', 'MANUAL', 'GEO', 'AUTO')),
  validated_by_actor_id UUID,
  
  -- Localização
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  
  -- Timestamp
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_event_participants_event ON event_participants(event_id);
CREATE INDEX idx_event_participants_actor ON event_participants(actor_id);
CREATE INDEX idx_event_participants_status ON event_participants(status);
CREATE INDEX idx_event_check_ins_event ON event_check_ins(event_id);
CREATE INDEX idx_event_check_ins_participant ON event_check_ins(participant_id);

-- RLS
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_participants_rls ON event_participants
  USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY event_check_ins_rls ON event_check_ins
  USING (tenant_id::text = current_setting('app.current_tenant', true));

COMMENT ON TABLE event_participants IS 'Prestadores e participantes do evento';
COMMENT ON TABLE event_check_ins IS 'Registros de check-in';
```

### Checklist D.1
- [ ] Criar migration 094
- [ ] Executar em dev
- [ ] Commit: `feat(db): add event participants and check-ins`

---

## PARTE E: VALIDAÇÃO FINAL

### E.1 Smoke Tests Completos

```bash
# CENÁRIO 1: Fluxo completo feliz
# 1. Criar evento com prestador
# 2. Publicar
# 3. Comprar ingresso → dinheiro vai para escrow
# 4. Simular fim do evento
# 5. Fazer check-in do prestador
# 6. Rodar job de split
# 7. Verificar: prestador recebeu, organizador recebeu, funds receberam

# CENÁRIO 2: Prestador não aparece
# 1. Criar evento com prestador
# 2. Simular fim do evento SEM check-in
# 3. Rodar job de split
# 4. Verificar: prestador NÃO recebeu, penalidade aplicada, score reduzido

# CENÁRIO 3: Cancelamento tardio
# 1. Criar evento
# 2. Vender ingressos
# 3. Cancelar com <24h
# 4. Verificar: compradores reembolsados, organizador penalizado, multa aplicada

# CENÁRIO 4: Page deletada
# 1. Criar evento
# 2. Vender ingressos
# 3. Deletar page
# 4. Verificar: evento cancelado, compradores reembolsados, page bloqueada

# CENÁRIO 5: Score baixo bloqueia
# 1. Ator com score < 40 tenta criar evento
# 2. Verificar: criação bloqueada
```

### Checklist E.1
- [ ] Executar todos os cenários
- [ ] Documentar resultados
- [ ] Commit: `test: add smoke tests for escrow and penalties`

---

## 📊 RESUMO DE ARQUIVOS (v2)

### Migrations
```
migrations/
├── 092_event_escrow.sql
├── 093_actor_scores_penalties.sql
└── 094_event_participants.sql
```

### Backend
```
backend/src/
├── core/
│   ├── economy/
│   │   └── escrow.service.ts
│   └── reputation/
│       └── penalty.service.ts
└── jobs/
    ├── post-event-split.job.ts
    └── event-scheduler.ts
```

---

## 📅 ESTIMATIVA DE TEMPO (v2)

| Parte | Tempo |
|-------|-------|
| A: Escrow | 3h |
| B: Penalidades | 3h |
| C: Split pós-evento | 2h |
| D: Participantes/Check-in | 2h |
| E: Validação | 2h |
| **TOTAL** | **~12 horas** |

---

## ✅ CRITÉRIO DE CONCLUSÃO (v2)

Fase 10 está COMPLETA quando:

1. [ ] Compra de ingresso vai para escrow (não split imediato)
2. [ ] Escrow bloqueia antes do evento
3. [ ] Split só acontece pós-evento
4. [ ] Prestador sem check-in não recebe
5. [ ] Penalidades aplicadas automaticamente
6. [ ] Score impacta permissões
7. [ ] Page deletada = reembolso automático
8. [ ] Smoke tests passam 100%

---

*Checklist derivado do CONTRATO_EVENTOS_V1.2.md*
*Executor: Cursor AI | Revisor: Clayton*
