# 📋 CHECKLIST TÉCNICO DE IMPLEMENTAÇÃO
## Contrato de Eventos v1 → Código

**Status:** ATIVO  
**Derivado de:** `CONTRATO_EVENTOS_V1.md`  
**Data:** 28/12/2025  
**Executor:** Cursor AI  
**Revisor:** Clayton  

---

## 🚨 REGRAS DE EXECUÇÃO

```
1. ORDEM É OBRIGATÓRIA — não pular etapas
2. CADA FASE TEM CHECKPOINT — só avança se passar
3. NÃO IMPROVISAR — se não está aqui, perguntar primeiro
4. ROLLBACK PREPARADO — cada migration tem undo
```

---

## FASE 0: PRÉ-REQUISITOS
**Objetivo:** Garantir ambiente limpo antes de começar

### Checklist

- [ ] **0.1** Backup do banco de dados atual
- [ ] **0.2** Commit de tudo que está pendente (working tree limpa)
- [ ] **0.3** Validar que servidor sobe sem erros
- [ ] **0.4** Documentar estado atual de `events` e `cultural_events`:
  ```sql
  SELECT COUNT(*) FROM events;
  SELECT COUNT(*) FROM cultural_events;
  ```
- [ ] **0.5** Criar branch: `feature/events-contract-v1`

### Checkpoint Fase 0
```
✅ Backup existe
✅ Git limpo
✅ Servidor sobe
✅ Contagens documentadas
✅ Branch criada
```

---

## FASE 1: SCHEMA — Expandir tabela `events`
**Objetivo:** Tornar `events` a tabela canônica

### Migration 088: `088_events_unified_schema.sql`

```sql
-- ================================================
-- UNIFICARD - MIGRATION 088
-- Events Unified Schema (CONTRATO v1)
-- Expande events para ser tabela canônica
-- ================================================

-- 1. Adicionar event_type (discriminador central)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'event_type_enum'
  ) THEN
    CREATE TYPE event_type_enum AS ENUM (
      'cultural',
      'gastronomic', 
      'social',
      'professional',
      'community',
      'spiritual',
      'sports',
      'private'
    );
  END IF;
END $$;

ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS event_type event_type_enum;

-- 2. Adicionar Actor (origem do evento)
ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS actor_id UUID,
  ADD COLUMN IF NOT EXISTS actor_type VARCHAR(10) 
    CHECK (actor_type IN ('user', 'page'));

-- 3. Adicionar campos econômicos
ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS ticket_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS max_capacity INTEGER,
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'PUBLIC'
    CHECK (visibility IN ('PUBLIC', 'LOCAL', 'PRIVATE')),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'ARCHIVED'));

-- 4. Adicionar subtype (refinamento dinâmico)
ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS event_subtype VARCHAR(100),
  ADD COLUMN IF NOT EXISTS event_subtype_status VARCHAR(20) DEFAULT 'provisional'
    CHECK (event_subtype_status IN ('provisional', 'official', 'rejected'));

-- 5. Adicionar metadata flexível
ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 6. Índices para performance
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_actor ON events(actor_id, actor_type);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(visibility);

-- 7. Comentários
COMMENT ON COLUMN events.event_type IS 'Tipo canônico do evento (Contrato v1)';
COMMENT ON COLUMN events.actor_id IS 'ID do Actor que criou (user ou page)';
COMMENT ON COLUMN events.actor_type IS 'Tipo do Actor: user ou page';
COMMENT ON COLUMN events.event_subtype IS 'Refinamento dinâmico do tipo';
```

### Checklist Fase 1

- [ ] **1.1** Criar arquivo `migrations/088_events_unified_schema.sql`
- [ ] **1.2** Executar migration em ambiente de dev
- [ ] **1.3** Validar schema:
  ```sql
  \d events  -- deve mostrar novas colunas
  ```
- [ ] **1.4** Validar que dados existentes não quebraram
- [ ] **1.5** Commit: `feat(db): add unified event schema (Contract v1)`

### Checkpoint Fase 1
```
✅ Coluna event_type existe (enum)
✅ Colunas actor_id/actor_type existem
✅ Colunas econômicas existem
✅ Índices criados
✅ Dados antigos preservados
```

---

## FASE 2: SCHEMA — Tabela de Subtypes
**Objetivo:** Permitir subtypes dinâmicos sem poluir event_type

### Migration 089: `089_event_subtypes.sql`

```sql
-- ================================================
-- UNIFICARD - MIGRATION 089
-- Event Subtypes (Contrato v1 - Seção 8)
-- Refinamentos dinâmicos de event_type
-- ================================================

CREATE TABLE IF NOT EXISTS event_subtypes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  event_type event_type_enum NOT NULL,
  subtype_slug VARCHAR(100) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'provisional'
    CHECK (status IN ('provisional', 'official', 'rejected')),
  usage_count INTEGER DEFAULT 0,
  created_by_actor_id UUID,
  created_by_actor_type VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  promoted_at TIMESTAMPTZ,
  
  CONSTRAINT event_subtypes_unique UNIQUE (tenant_id, event_type, subtype_slug)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_subtypes_type ON event_subtypes(event_type);
CREATE INDEX IF NOT EXISTS idx_event_subtypes_status ON event_subtypes(status);
CREATE INDEX IF NOT EXISTS idx_event_subtypes_usage ON event_subtypes(usage_count DESC);

-- RLS
ALTER TABLE event_subtypes ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_subtypes_rls ON event_subtypes
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Comentários
COMMENT ON TABLE event_subtypes IS 'Subtypes dinâmicos de eventos (Contrato v1)';
COMMENT ON COLUMN event_subtypes.status IS 'provisional→official por uso, rejected por moderação';
```

### Checklist Fase 2

- [ ] **2.1** Criar arquivo `migrations/089_event_subtypes.sql`
- [ ] **2.2** Executar migration
- [ ] **2.3** Validar:
  ```sql
  \d event_subtypes
  ```
- [ ] **2.4** Commit: `feat(db): add event_subtypes table (Contract v1)`

### Checkpoint Fase 2
```
✅ Tabela event_subtypes existe
✅ RLS ativo
✅ Índices criados
```

---

## FASE 3: BACKEND — Tipos e Validação
**Objetivo:** Criar tipos TypeScript alinhados com Contrato v1

### Arquivos a criar/modificar

#### 3.1 Criar: `backend/src/modules/events/events-v2.types.ts`

```typescript
// src/modules/events/events-v2.types.ts
// Tipos alinhados com Contrato de Eventos v1

export const EVENT_TYPES = [
  'cultural',
  'gastronomic',
  'social',
  'professional',
  'community',
  'spiritual',
  'sports',
  'private',
] as const;

export type EventType = typeof EVENT_TYPES[number];

export const ACTOR_TYPES = ['user', 'page'] as const;
export type ActorType = typeof ACTOR_TYPES[number];

export const EVENT_STATUS = [
  'DRAFT',
  'PUBLISHED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
] as const;
export type EventStatus = typeof EVENT_STATUS[number];

export const VISIBILITY = ['PUBLIC', 'LOCAL', 'PRIVATE'] as const;
export type Visibility = typeof VISIBILITY[number];

// Matriz Actor × EventType (Contrato v1 - Seção 4)
export const ACTOR_EVENT_TYPE_MATRIX: Record<EventType, { user: boolean; page: boolean }> = {
  cultural: { user: true, page: true },
  gastronomic: { user: true, page: true },
  social: { user: true, page: false },      // ❌ Page não pode
  professional: { user: true, page: true },
  community: { user: true, page: true },
  spiritual: { user: true, page: true },
  sports: { user: true, page: true },
  private: { user: true, page: false },     // ❌ Page não pode
};

export function canActorCreateEventType(
  actorType: ActorType,
  eventType: EventType
): boolean {
  return ACTOR_EVENT_TYPE_MATRIX[eventType][actorType];
}

export interface UnifiedEvent {
  id: string;
  tenantId: string;
  eventType: EventType;
  actorId: string;
  actorType: ActorType;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  ticketPriceCents: number | null;
  maxCapacity: number | null;
  visibility: Visibility;
  status: EventStatus;
  eventSubtype: string | null;
  eventSubtypeStatus: 'provisional' | 'official' | 'rejected' | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  eventType: EventType;
  actorId: string;
  actorType: ActorType;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  ticketPriceCents?: number;
  maxCapacity?: number;
  visibility?: Visibility;
  eventSubtype?: string;
  metadata?: Record<string, unknown>;
}
```

#### 3.2 Criar: `backend/src/modules/events/events-v2.validator.ts`

```typescript
// src/modules/events/events-v2.validator.ts
// Validação de Wizard (Contrato v1 - Seção 9)

import { z } from 'zod';
import { EVENT_TYPES, ACTOR_TYPES, VISIBILITY, canActorCreateEventType } from './events-v2.types';

export const createEventSchema = z.object({
  eventType: z.enum(EVENT_TYPES),
  actorId: z.string().uuid(),
  actorType: z.enum(ACTOR_TYPES),
  title: z.string().min(3).max(255),
  description: z.string().max(5000).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  ticketPriceCents: z.number().int().min(0).optional(),
  maxCapacity: z.number().int().min(1).optional(),
  visibility: z.enum(VISIBILITY).default('PUBLIC'),
  eventSubtype: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  { message: 'endTime deve ser após startTime' }
).refine(
  (data) => canActorCreateEventType(data.actorType, data.eventType),
  { message: 'Este tipo de Actor não pode criar este tipo de evento' }
);

export type CreateEventPayload = z.infer<typeof createEventSchema>;
```

### Checklist Fase 3

- [ ] **3.1** Criar `events-v2.types.ts`
- [ ] **3.2** Criar `events-v2.validator.ts`
- [ ] **3.3** Rodar `tsc --noEmit` sem erros
- [ ] **3.4** Commit: `feat(backend): add event types and validator (Contract v1)`

### Checkpoint Fase 3
```
✅ Tipos compilam
✅ Matriz Actor×EventType implementada
✅ Validador Zod funciona
```

---

## FASE 4: BACKEND — Service Unificado
**Objetivo:** Criar service que usa Split Engine

### Arquivos a criar/modificar

#### 4.1 Criar: `backend/src/modules/events/events-v2.service.ts`

```typescript
// src/modules/events/events-v2.service.ts
// Service unificado (Contrato v1)

import { runQueryWithTenant, runMutationWithTenant } from '@core/database/pool';
import { splitEngineService } from '@core/economy/split.service';
import { eventBus } from '@core/events/event-bus';
import { createEventSchema, type CreateEventPayload } from './events-v2.validator';
import type { UnifiedEvent, EventType, ActorType } from './events-v2.types';

class EventsV2Service {
  /**
   * Cria evento (DRAFT)
   * Contrato v1 - Seção 9: Wizard obrigatório
   */
  async createEvent(
    tenantId: string,
    input: CreateEventPayload
  ): Promise<UnifiedEvent> {
    // Validar via Zod (inclui matriz Actor×EventType)
    const validated = createEventSchema.parse(input);

    const result = await runMutationWithTenant<UnifiedEvent>(
      tenantId,
      `
      INSERT INTO events (
        tenant_id,
        event_type,
        actor_id,
        actor_type,
        title,
        description,
        start_time,
        end_time,
        ticket_price_cents,
        max_capacity,
        visibility,
        status,
        event_subtype,
        metadata,
        created_by_global_user_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'DRAFT', $12, $13,
        (SELECT global_user_id FROM actors WHERE id = $3 LIMIT 1)
      )
      RETURNING *
      `,
      [
        tenantId,
        validated.eventType,
        validated.actorId,
        validated.actorType,
        validated.title,
        validated.description || null,
        validated.startTime,
        validated.endTime,
        validated.ticketPriceCents || null,
        validated.maxCapacity || null,
        validated.visibility,
        validated.eventSubtype || null,
        JSON.stringify(validated.metadata || {}),
      ]
    );

    // Emitir evento de criação
    await eventBus.publish({
      tenantId,
      type: 'event.created',
      payload: {
        eventId: result.id,
        eventType: validated.eventType,
        actorId: validated.actorId,
        actorType: validated.actorType,
      },
    });

    return this.mapToUnifiedEvent(result);
  }

  /**
   * Publica evento (DRAFT → PUBLISHED)
   */
  async publishEvent(tenantId: string, eventId: string): Promise<UnifiedEvent> {
    const result = await runMutationWithTenant<UnifiedEvent>(
      tenantId,
      `
      UPDATE events 
      SET status = 'PUBLISHED', updated_at = now()
      WHERE id = $1 AND status = 'DRAFT'
      RETURNING *
      `,
      [eventId]
    );

    if (!result) {
      throw new Error('Evento não encontrado ou não está em DRAFT');
    }

    await eventBus.publish({
      tenantId,
      type: 'event.published',
      payload: { eventId, eventType: result.event_type },
    });

    return this.mapToUnifiedEvent(result);
  }

  /**
   * Processa checkout de ingresso
   * Contrato v1 - Seção 5.1: OBRIGATÓRIO passar pelo Split Engine
   */
  async processTicketCheckout(
    tenantId: string,
    eventId: string,
    buyerAccountId: string,
    idempotencyKey: string
  ): Promise<{ success: boolean; transactionIds: string[] }> {
    // Buscar evento
    const event = await this.getEvent(tenantId, eventId);
    
    if (!event) {
      throw new Error('Evento não encontrado');
    }

    if (!event.ticketPriceCents || event.ticketPriceCents <= 0) {
      throw new Error('Evento não tem preço de ingresso');
    }

    // 🔴 CRÍTICO: Usar Split Engine (Contrato v1 - Seção 5.1)
    const organizerAccountId = await this.getActorAccountId(tenantId, event.actorId, event.actorType);

    const splitResult = await splitEngineService.applySplits({
      tenantId,
      amount: event.ticketPriceCents / 100, // Converter centavos para reais
      currency: 'BRL',
      source: 'EVENT_TICKET',
      customerAccountId: buyerAccountId,
      eventOrganizerAccountId: organizerAccountId,
      metadata: {
        module: 'EVENT_TICKET',
        eventId,
        eventType: event.eventType,
        idempotencyKey,
      },
    });

    const transactionIds = splitResult.splits
      .filter(s => s.transactionId)
      .map(s => s.transactionId!);

    await eventBus.publish({
      tenantId,
      type: 'event.ticket.purchased',
      payload: {
        eventId,
        buyerAccountId,
        amount: event.ticketPriceCents,
        transactionIds,
      },
    });

    return { success: true, transactionIds };
  }

  /**
   * Busca evento por ID
   */
  async getEvent(tenantId: string, eventId: string): Promise<UnifiedEvent | null> {
    const result = await runQueryWithTenant<any>(
      tenantId,
      `SELECT * FROM events WHERE id = $1`,
      [eventId]
    );

    return result ? this.mapToUnifiedEvent(result) : null;
  }

  /**
   * Lista eventos por tipo
   */
  async listEventsByType(
    tenantId: string,
    eventType: EventType,
    options?: { limit?: number; offset?: number; status?: string }
  ): Promise<UnifiedEvent[]> {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;
    const statusFilter = options?.status ? `AND status = '${options.status}'` : '';

    const results = await runQueryWithTenant<any[]>(
      tenantId,
      `
      SELECT * FROM events 
      WHERE event_type = $1 ${statusFilter}
      ORDER BY start_time DESC
      LIMIT $2 OFFSET $3
      `,
      [eventType, limit, offset]
    );

    return (results || []).map(r => this.mapToUnifiedEvent(r));
  }

  private async getActorAccountId(
    tenantId: string,
    actorId: string,
    actorType: ActorType
  ): Promise<string> {
    // Buscar conta do Actor
    const result = await runQueryWithTenant<{ account_id: string }>(
      tenantId,
      `
      SELECT a.account_id 
      FROM accounts a
      JOIN ${actorType === 'user' ? 'global_users' : 'companies'} e 
        ON a.owner_id = e.${actorType === 'user' ? 'global_user_id' : 'id'}
      WHERE e.id = $1 OR e.${actorType === 'user' ? 'global_user_id' : 'id'} = $1
      LIMIT 1
      `,
      [actorId]
    );

    if (!result) {
      throw new Error(`Conta não encontrada para Actor ${actorId}`);
    }

    return result.account_id;
  }

  private mapToUnifiedEvent(row: any): UnifiedEvent {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      eventType: row.event_type,
      actorId: row.actor_id,
      actorType: row.actor_type,
      title: row.title,
      description: row.description,
      startTime: row.start_time,
      endTime: row.end_time,
      ticketPriceCents: row.ticket_price_cents,
      maxCapacity: row.max_capacity,
      visibility: row.visibility,
      status: row.status,
      eventSubtype: row.event_subtype,
      eventSubtypeStatus: row.event_subtype_status,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const eventsV2Service = new EventsV2Service();
```

### Checklist Fase 4

- [ ] **4.1** Criar `events-v2.service.ts`
- [ ] **4.2** Verificar imports do Split Engine
- [ ] **4.3** Rodar `tsc --noEmit` sem erros
- [ ] **4.4** Commit: `feat(backend): add events-v2 service with Split Engine`

### Checkpoint Fase 4
```
✅ Service compila
✅ Usa splitEngineService.applySplits()
✅ Emite eventos via eventBus
```

---

## FASE 5: BACKEND — Rotas v2
**Objetivo:** Expor endpoints do novo sistema

### Criar: `backend/src/modules/events/events-v2.routes.ts`

```typescript
// src/modules/events/events-v2.routes.ts
// Rotas unificadas (Contrato v1)

import { FastifyPluginAsync } from 'fastify';
import { eventsV2Service } from './events-v2.service';
import { createEventSchema } from './events-v2.validator';
import { EVENT_TYPES } from './events-v2.types';

const eventsV2Routes: FastifyPluginAsync = async (fastify) => {
  // POST /events/v2/create
  fastify.post('/create', async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    try {
      const event = await eventsV2Service.createEvent(
        req.tenant.id,
        req.body as any
      );
      return reply.status(201).send(event);
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Erro ao criar evento',
      });
    }
  });

  // POST /events/v2/:id/publish
  fastify.post('/:id/publish', async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    try {
      const event = await eventsV2Service.publishEvent(
        req.tenant.id,
        (req.params as any).id
      );
      return reply.send(event);
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Erro ao publicar',
      });
    }
  });

  // POST /events/v2/:id/checkout
  fastify.post('/:id/checkout', async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    try {
      const { buyerAccountId, idempotencyKey } = req.body as any;
      const result = await eventsV2Service.processTicketCheckout(
        req.tenant.id,
        (req.params as any).id,
        buyerAccountId,
        idempotencyKey
      );
      return reply.send(result);
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Erro no checkout',
      });
    }
  });

  // GET /events/v2/:id
  fastify.get('/:id', async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    const event = await eventsV2Service.getEvent(
      req.tenant.id,
      (req.params as any).id
    );

    if (!event) {
      return reply.status(404).send({ error: 'Evento não encontrado' });
    }

    return reply.send(event);
  });

  // GET /events/v2/type/:eventType
  fastify.get('/type/:eventType', async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    const eventType = (req.params as any).eventType;
    if (!EVENT_TYPES.includes(eventType)) {
      return reply.status(400).send({ error: 'Tipo de evento inválido' });
    }

    const events = await eventsV2Service.listEventsByType(
      req.tenant.id,
      eventType,
      req.query as any
    );

    return reply.send({ events });
  });
};

export default eventsV2Routes;
```

### Registrar rotas

Modificar `backend/src/modules/events/events.module.ts`:

```typescript
// Adicionar import
import eventsV2Routes from './events-v2.routes';

// Registrar com prefix
fastify.register(eventsV2Routes, { prefix: '/v2' });
```

### Checklist Fase 5

- [ ] **5.1** Criar `events-v2.routes.ts`
- [ ] **5.2** Registrar em `events.module.ts`
- [ ] **5.3** Testar endpoints com curl/Postman
- [ ] **5.4** Commit: `feat(backend): add events-v2 routes`

### Checkpoint Fase 5
```
✅ POST /api/events/v2/create funciona
✅ POST /api/events/v2/:id/publish funciona
✅ POST /api/events/v2/:id/checkout usa Split Engine
✅ GET /api/events/v2/:id retorna evento
```

---

## FASE 6: FRONTEND — API Client
**Objetivo:** Criar client unificado para eventos

### Criar: `frontend/src/api/events-v2.ts`

```typescript
// src/api/events-v2.ts
// API unificada de eventos (Contrato v1)

import { apiFetchJson } from './client';

export const EVENT_TYPES = [
  'cultural',
  'gastronomic',
  'social',
  'professional',
  'community',
  'spiritual',
  'sports',
  'private',
] as const;

export type EventType = typeof EVENT_TYPES[number];
export type ActorType = 'user' | 'page';
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
export type Visibility = 'PUBLIC' | 'LOCAL' | 'PRIVATE';

export interface UnifiedEvent {
  id: string;
  tenantId: string;
  eventType: EventType;
  actorId: string;
  actorType: ActorType;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  ticketPriceCents: number | null;
  maxCapacity: number | null;
  visibility: Visibility;
  status: EventStatus;
  eventSubtype: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  eventType: EventType;
  actorId: string;
  actorType: ActorType;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  ticketPriceCents?: number;
  maxCapacity?: number;
  visibility?: Visibility;
  eventSubtype?: string;
  metadata?: Record<string, unknown>;
}

// Matriz Actor × EventType (espelho do backend)
export const ACTOR_EVENT_TYPE_MATRIX: Record<EventType, { user: boolean; page: boolean }> = {
  cultural: { user: true, page: true },
  gastronomic: { user: true, page: true },
  social: { user: true, page: false },
  professional: { user: true, page: true },
  community: { user: true, page: true },
  spiritual: { user: true, page: true },
  sports: { user: true, page: true },
  private: { user: true, page: false },
};

export function canActorCreateEventType(actorType: ActorType, eventType: EventType): boolean {
  return ACTOR_EVENT_TYPE_MATRIX[eventType][actorType];
}

// Labels em português
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  cultural: 'Cultural',
  gastronomic: 'Gastronômico',
  social: 'Social',
  professional: 'Profissional',
  community: 'Comunitário',
  spiritual: 'Espiritual',
  sports: 'Esportivo',
  private: 'Privado',
};

/**
 * Cria evento (DRAFT)
 */
export async function createEvent(input: CreateEventInput): Promise<UnifiedEvent> {
  return apiFetchJson<UnifiedEvent>('/api/events/v2/create', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Publica evento
 */
export async function publishEvent(eventId: string): Promise<UnifiedEvent> {
  return apiFetchJson<UnifiedEvent>(`/api/events/v2/${eventId}/publish`, {
    method: 'POST',
  });
}

/**
 * Processa checkout de ingresso
 */
export async function checkoutEventTicket(
  eventId: string,
  buyerAccountId: string,
  idempotencyKey: string
): Promise<{ success: boolean; transactionIds: string[] }> {
  return apiFetchJson(`/api/events/v2/${eventId}/checkout`, {
    method: 'POST',
    body: JSON.stringify({ buyerAccountId, idempotencyKey }),
  });
}

/**
 * Busca evento por ID
 */
export async function getEvent(eventId: string): Promise<UnifiedEvent> {
  return apiFetchJson<UnifiedEvent>(`/api/events/v2/${eventId}`);
}

/**
 * Lista eventos por tipo
 */
export async function listEventsByType(
  eventType: EventType,
  options?: { limit?: number; offset?: number; status?: EventStatus }
): Promise<{ events: UnifiedEvent[] }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.offset) params.set('offset', options.offset.toString());
  if (options?.status) params.set('status', options.status);

  const query = params.toString();
  return apiFetchJson(`/api/events/v2/type/${eventType}${query ? `?${query}` : ''}`);
}
```

### Checklist Fase 6

- [ ] **6.1** Criar `frontend/src/api/events-v2.ts`
- [ ] **6.2** Verificar tipos espelham backend
- [ ] **6.3** Commit: `feat(frontend): add events-v2 api client`

### Checkpoint Fase 6
```
✅ API client compila
✅ Tipos alinhados com backend
✅ Matriz Actor×EventType espelhada
```

---

## FASE 7: FRONTEND — Componentes
**Objetivo:** Criar componentes unificados

### 7.1 Criar: `frontend/src/components/events/UnifiedEventCard.tsx`

> **NOTA:** Componente adapta visual baseado em `event.eventType`

### 7.2 Criar: `frontend/src/components/events/EventWizard.tsx`

> **NOTA:** Implementa fluxo obrigatório do Contrato v1 Seção 9:
> `Actor → EventType → Contexto → Economia → Revisão → Publicar`

### Checklist Fase 7

- [ ] **7.1** Criar `UnifiedEventCard.tsx`
- [ ] **7.2** Criar `EventWizard.tsx`
- [ ] **7.3** Testar no browser
- [ ] **7.4** Commit: `feat(frontend): add unified event components`

---

## FASE 8: MIGRAÇÃO DE DADOS
**Objetivo:** Mover dados de `cultural_events` para `events`

### Migration 090: `090_migrate_cultural_events.sql`

```sql
-- ================================================
-- UNIFICARD - MIGRATION 090
-- Migrar cultural_events → events (Contrato v1)
-- ================================================

-- 1. Migrar dados
INSERT INTO events (
  id,
  tenant_id,
  event_type,
  actor_id,
  actor_type,
  title,
  description,
  start_time,
  end_time,
  ticket_price_cents,
  max_capacity,
  visibility,
  status,
  metadata,
  created_at,
  updated_at,
  created_by_global_user_id
)
SELECT 
  ce.id,
  ce.tenant_id,
  'cultural'::event_type_enum,
  cp.owner_actor_id,
  cp.owner_actor_type,
  ce.title,
  ce.description,
  ce.datetime_start,
  ce.datetime_end,
  ce.ticket_price_cents,
  ce.max_attendees,
  ce.visibility,
  ce.status,
  jsonb_build_object(
    'legacy_cultural_profile_id', ce.created_by_cultural_profile_id,
    'legacy_event_type', ce.event_type,
    'migrated_at', now()
  ),
  ce.created_at,
  ce.updated_at,
  (SELECT global_user_id FROM global_users LIMIT 1) -- Fallback
FROM cultural_events ce
JOIN cultural_profiles cp ON ce.created_by_cultural_profile_id = cp.id
WHERE NOT EXISTS (
  SELECT 1 FROM events e WHERE e.id = ce.id
);

-- 2. Marcar cultural_events como deprecada
COMMENT ON TABLE cultural_events IS 'DEPRECATED: Migrado para events em 090. Não usar.';
```

### Checklist Fase 8

- [ ] **8.1** Criar migration 090
- [ ] **8.2** Executar em dev
- [ ] **8.3** Validar:
  ```sql
  SELECT COUNT(*) FROM events WHERE event_type = 'cultural';
  -- Deve ser igual ao antigo COUNT(*) FROM cultural_events
  ```
- [ ] **8.4** Commit: `feat(db): migrate cultural_events to events`

### Checkpoint Fase 8
```
✅ Dados migrados
✅ Contagens batem
✅ cultural_events marcada como DEPRECATED
```

---

## FASE 9: DEPRECAR CÓDIGO LEGADO
**Objetivo:** Marcar código antigo como deprecated

### Arquivos a modificar

- [ ] **9.1** `backend/src/modules/cultural/cultural.routes.ts`
  - Adicionar header: `// ⚠️ DEPRECATED: Use /api/events/v2 (Contrato v1)`
  
- [ ] **9.2** `backend/src/modules/cultural/cultural-event.service.ts`
  - Adicionar header: `// ⚠️ DEPRECATED: Use eventsV2Service`

- [ ] **9.3** `frontend/src/api/cultural.ts`
  - Adicionar header: `// ⚠️ DEPRECATED: Use events-v2.ts`

- [ ] **9.4** Commit: `chore: mark cultural module as deprecated`

---

## FASE 10: TESTES E VALIDAÇÃO FINAL
**Objetivo:** Garantir que tudo funciona

### Checklist Final

- [ ] **10.1** Criar evento via wizard → funciona
- [ ] **10.2** Publicar evento → funciona
- [ ] **10.3** Checkout de ingresso → Split Engine executa
- [ ] **10.4** Verificar ledger tem transações
- [ ] **10.5** Feed mostra eventos unificados
- [ ] **10.6** Matriz Actor×EventType respeitada

### Smoke Test Script

```bash
# 1. Criar evento cultural (user)
curl -X POST /api/events/v2/create \
  -d '{"eventType":"cultural","actorId":"...","actorType":"user",...}'

# 2. Publicar
curl -X POST /api/events/v2/{id}/publish

# 3. Checkout
curl -X POST /api/events/v2/{id}/checkout \
  -d '{"buyerAccountId":"...","idempotencyKey":"..."}'

# 4. Verificar ledger
SELECT * FROM ledger WHERE metadata->>'eventId' = '{id}';
```

---

## 📊 RESUMO DE ARQUIVOS

### Criar (novos)
```
backend/
├── migrations/
│   ├── 088_events_unified_schema.sql
│   ├── 089_event_subtypes.sql
│   └── 090_migrate_cultural_events.sql
└── src/modules/events/
    ├── events-v2.types.ts
    ├── events-v2.validator.ts
    ├── events-v2.service.ts
    └── events-v2.routes.ts

frontend/
└── src/
    ├── api/events-v2.ts
    └── components/events/
        ├── UnifiedEventCard.tsx
        └── EventWizard.tsx
```

### Modificar
```
backend/src/modules/events/events.module.ts  (registrar v2)
```

### Deprecar (não deletar ainda)
```
backend/src/modules/cultural/*
frontend/src/api/cultural.ts
```

### NÃO TOCAR
```
backend/src/core/economy/split.service.ts  (já funciona)
backend/src/core/events/event-bus.ts       (já funciona)
```

---

## 🚨 PONTOS DE NÃO IMPROVISAÇÃO

| Situação | Regra |
|----------|-------|
| Criar novo `event_type` | ❌ Não criar. Usar subtype. |
| Calcular split no frontend | ❌ Proibido. Só backend. |
| Criar evento sem Actor | ❌ Proibido. Validador bloqueia. |
| Bypass do wizard | ❌ Proibido. Só via API v2. |
| Modificar Split Engine | ❌ Não tocar. Já funciona. |

---

## 📅 ESTIMATIVA DE TEMPO

| Fase | Tempo estimado |
|------|----------------|
| Fase 0: Pré-requisitos | 30 min |
| Fase 1-2: Migrations | 1 hora |
| Fase 3-5: Backend | 3 horas |
| Fase 6-7: Frontend | 3 horas |
| Fase 8: Migração dados | 1 hora |
| Fase 9: Deprecar | 30 min |
| Fase 10: Testes | 2 horas |
| **TOTAL** | **~11 horas** |

---

*Checklist gerado a partir do Contrato de Eventos v1.*
*Executor: Cursor AI | Revisor: Clayton*
