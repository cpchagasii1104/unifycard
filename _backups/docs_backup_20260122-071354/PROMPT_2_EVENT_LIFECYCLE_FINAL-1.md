# PROMPT 2: EVENT LIFECYCLE (VERSÃO FINAL BLOQUEADA CONTRA ERROS)

**Regra:** Implementar exatamente como descrito.  
**Objetivo:** Eventos funcionais integrados com Agenda + UnifyCard + UnifyBank.  
**Dependência:** Prompt 1 (Agenda + Funcionários) DEVE estar implementado.

---

## 🔒 FASE 0 — PRÉ-REQUISITOS OBRIGATÓRIOS

**Antes de qualquer código:**
- ✅ Prompt 1 implementado e testado
- ✅ Tabela `schedules` com unique indexes por owner
- ✅ Tabela `schedule_slots` com unique index (schedule_id, start_time, end_time)
- ✅ `AvailabilityResolver` funcionando
- ❌ NÃO recriar tabela `events` (já existe em `026_events_core.sql`)
- ❌ NÃO criar agenda universal para eventos
- ✅ Evento cria schedule próprio com event_id

---

## 🟥 FASE 1 — MIGRATIONS CRÍTICAS (BLOQUEANTES)

### 1.1 Adicionar event_id em schedules

**Migration:** `backend/migrations/039_schedules_event_owner.sql`

```sql
-- Adicionar event_id como owner possível
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS event_id UUID NULL;

-- FK para events
ALTER TABLE schedules ADD CONSTRAINT fk_schedules_event 
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- Atualizar CHECK constraint (incluir event_id)
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_owner_check;
ALTER TABLE schedules ADD CONSTRAINT schedules_owner_check CHECK (
  (
    (global_user_id IS NOT NULL)::int +
    (company_id IS NOT NULL)::int +
    (service_id IS NOT NULL)::int +
    (event_id IS NOT NULL)::int
  ) = 1
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_schedules_event_id 
  ON schedules(event_id) WHERE event_id IS NOT NULL;

-- 1 agenda por evento
CREATE UNIQUE INDEX IF NOT EXISTS uniq_schedule_event
  ON schedules(event_id) WHERE event_id IS NOT NULL;
```

**❌ Sem isso, eventos não podem ter agenda própria.**

---

### 1.2 Estender tabela events

**Migration:** `backend/migrations/040_events_lifecycle_extension.sql`

```sql
-- Adicionar colunas necessárias (se não existirem)
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'SHOW';
ALTER TABLE events ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_price NUMERIC(10,2) NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS accepts_consumption BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS accepts_parking BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_capacity INT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS current_occupancy INT NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'DRAFT';

-- 🔴 CRÍTICO: schedule_id (solução do Bloqueio 2)
ALTER TABLE events ADD COLUMN IF NOT EXISTS schedule_id UUID NULL;
ALTER TABLE events ADD CONSTRAINT fk_events_schedule 
  FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id) ON DELETE SET NULL;

-- Ownership: adicionar company (mantém user para compatibilidade)
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by_company_id UUID NULL;

-- Constraints
ALTER TABLE events ADD CONSTRAINT check_event_type CHECK (
  event_type IN ('SHOW','CINEMA','ESPORTE','BAR','RESTAURANTE','FEIRA','WORKSHOP','EXPOSICAO','FESTIVAL','BALADA')
);

ALTER TABLE events ADD CONSTRAINT check_event_status CHECK (
  status IN ('DRAFT','PUBLISHED','ONGOING','FINISHED','CANCELLED')
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_events_schedule ON events(schedule_id);
CREATE INDEX IF NOT EXISTS idx_events_type_status ON events(event_type, status);
CREATE INDEX IF NOT EXISTS idx_events_capacity ON events(current_occupancy, max_capacity) 
  WHERE max_capacity IS NOT NULL;
```

---

### 1.3 Criar tabelas de commerce (tickets, consumptions, parking)

**Migration:** `backend/migrations/041_event_commerce.sql`

```sql
-- Tabela de ingressos
CREATE TABLE IF NOT EXISTS event_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  schedule_slot_id UUID NULL REFERENCES schedule_slots(id) ON DELETE SET NULL,
  
  price_paid NUMERIC(10,2) NOT NULL,
  transaction_id UUID NULL, -- referência ao UnifyBank ledger
  
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT check_ticket_status CHECK (status IN ('ACTIVE','USED','REFUNDED','CANCELLED')),
  
  qr_code TEXT NOT NULL UNIQUE,
  checked_in_at TIMESTAMPTZ NULL,
  
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tickets_event_user ON event_tickets(event_id, global_user_id);
CREATE INDEX idx_tickets_qr ON event_tickets(qr_code);
CREATE INDEX idx_tickets_event_status ON event_tickets(event_id, status);

-- RLS
ALTER TABLE event_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON event_tickets
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Tabela de consumo
CREATE TABLE IF NOT EXISTS event_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  
  item_name TEXT,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  
  transaction_id UUID NULL,
  
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consumptions_event ON event_consumptions(event_id, created_at DESC);
CREATE INDEX idx_consumptions_user ON event_consumptions(global_user_id, created_at DESC);

ALTER TABLE event_consumptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON event_consumptions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Tabela de estacionamento
CREATE TABLE IF NOT EXISTS event_parking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  
  vehicle_plate TEXT,
  
  entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exit_time TIMESTAMPTZ NULL,
  
  hourly_rate NUMERIC(10,2) NULL,
  total_amount NUMERIC(10,2) NULL,
  
  transaction_id UUID NULL,
  
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT check_parking_status CHECK (status IN ('ACTIVE','EXITED','PAID')),
  
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parking_event_status ON event_parking(event_id, status);
CREATE INDEX idx_parking_user_status ON event_parking(global_user_id, status);

ALTER TABLE event_parking ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON event_parking
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

---

## 🟦 FASE 2 — SERVIÇOS (IMPLEMENTAÇÃO CORRETA)

### 2.1 UnifyCard Event Context (CONTRATO FORMAL - Bloqueio 4)

**Arquivo:** `backend/src/types/unifycard-event.types.ts`

```typescript
/**
 * 🔴 CRÍTICO: Contrato formal de contexto de evento
 * UnifyCard → UnifyBank SEMPRE usa este formato
 */
export interface UnifyCardEventContext {
  // Tipo de módulo
  module: 'EVENT' | 'CONSUMPTION' | 'PARKING';
  
  // Identificação
  entityType: 'event';
  entityId: string; // event_id
  eventType: string; // SHOW, BAR, RESTAURANTE, etc
  
  // Localização (para split regional)
  cityId: string;
  
  // Usuário
  globalUserId: string;
  
  // Referências opcionais
  ticketId?: string;
  consumptionId?: string;
  parkingId?: string;
  scheduleSlotId?: string;
}

/**
 * Validação em runtime
 */
export function validateEventContext(ctx: any): ctx is UnifyCardEventContext {
  if (!ctx || typeof ctx !== 'object') return false;
  
  const validModules = ['EVENT', 'CONSUMPTION', 'PARKING'];
  if (!validModules.includes(ctx.module)) return false;
  
  if (ctx.entityType !== 'event') return false;
  
  const requiredFields = ['entityId', 'eventType', 'cityId', 'globalUserId'];
  for (const field of requiredFields) {
    if (typeof ctx[field] !== 'string' || !ctx[field]) return false;
  }
  
  return true;
}

/**
 * Builder para contexto de evento
 */
export class EventContextBuilder {
  static forTicket(params: {
    eventId: string;
    eventType: string;
    cityId: string;
    userId: string;
    ticketId: string;
  }): UnifyCardEventContext {
    return {
      module: 'EVENT',
      entityType: 'event',
      entityId: params.eventId,
      eventType: params.eventType,
      cityId: params.cityId,
      globalUserId: params.userId,
      ticketId: params.ticketId
    };
  }
  
  static forConsumption(params: {
    eventId: string;
    eventType: string;
    cityId: string;
    userId: string;
    consumptionId: string;
  }): UnifyCardEventContext {
    return {
      module: 'CONSUMPTION',
      entityType: 'event',
      entityId: params.eventId,
      eventType: params.eventType,
      cityId: params.cityId,
      globalUserId: params.userId,
      consumptionId: params.consumptionId
    };
  }
}
```

**❌ Sem contrato formal → cada desenvolvedor inventa formato diferente.**

---

### 2.2 EventScheduleService

**Arquivo:** `backend/src/services/events/EventScheduleService.ts`

```typescript
import {DateTime} from 'luxon';
import db from '../../db';

export class EventScheduleService {
  /**
   * Cria schedule para evento (idempotente)
   */
  async ensureEventSchedule(eventId: string): Promise<string> {
    const trx = await db.transaction();
    
    try {
      // Verifica se já existe
      const existing = await trx('schedules')
        .where({event_id: eventId})
        .first();
      
      if (existing) {
        return existing.schedule_id;
      }
      
      // Busca dados do evento
      const event = await trx('events')
        .where({id: eventId})
        .first();
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Cria schedule
      const [schedule] = await trx('schedules')
        .insert({
          tenant_id: event.tenant_id,
          event_id: eventId,
          metadata: {
            timezone: event.timezone,
            event_type: event.event_type
          }
        })
        .returning('*');
      
      // 🔴 CRÍTICO: Atualiza evento com schedule_id
      await trx('events')
        .where({id: eventId})
        .update({schedule_id: schedule.schedule_id});
      
      await trx.commit();
      return schedule.schedule_id;
      
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
  
  /**
   * Gera slots baseado no tipo de evento (idempotente)
   */
  async generateEventSlots(eventId: string): Promise<number> {
    const trx = await db.transaction();
    
    try {
      const event = await trx('events')
        .where({id: eventId})
        .first();
      
      if (!event || !event.schedule_id) {
        throw new Error('Event or schedule not found');
      }
      
      const slots = this.buildSlotsByType(event);
      
      if (slots.length === 0) return 0;
      
      // 🔴 CRÍTICO: Batch insert (não loop)
      await trx.raw(`
        INSERT INTO schedule_slots (schedule_id, start_time, end_time, status, metadata)
        SELECT * FROM jsonb_to_recordset($1)
        AS t(schedule_id UUID, start_time TIMESTAMPTZ, end_time TIMESTAMPTZ, status TEXT, metadata JSONB)
        ON CONFLICT (schedule_id, start_time, end_time) DO NOTHING
      `, [JSON.stringify(slots)]);
      
      await trx.commit();
      return slots.length;
      
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
  
  private buildSlotsByType(event: any): any[] {
    const scheduleId = event.schedule_id;
    
    switch (event.event_type) {
      case 'SHOW':
      case 'CINEMA':
      case 'ESPORTE':
      case 'WORKSHOP':
      case 'EXPOSICAO':
        // Evento pontual: 1 slot
        return [{
          schedule_id: scheduleId,
          start_time: event.start_time,
          end_time: event.end_time,
          status: 'available',
          metadata: {
            max_capacity: event.max_capacity
          }
        }];
      
      case 'BAR':
      case 'RESTAURANTE':
        // Slots de 1h durante funcionamento
        return this.generateHourlySlots(
          event.start_time,
          event.end_time,
          scheduleId
        );
      
      case 'FESTIVAL':
      case 'BALADA':
        // Multi-dia: 1 slot grande
        return [{
          schedule_id: scheduleId,
          start_time: event.start_time,
          end_time: event.end_time,
          status: 'available',
          metadata: {
            max_capacity: event.max_capacity,
            multiday: true
          }
        }];
      
      default:
        throw new Error(`Unsupported event type: ${event.event_type}`);
    }
  }
  
  private generateHourlySlots(
    startTime: Date,
    endTime: Date,
    scheduleId: string
  ): any[] {
    const slots = [];
    const start = DateTime.fromJSDate(startTime);
    const end = DateTime.fromJSDate(endTime);
    
    let current = start;
    while (current < end) {
      const slotEnd = current.plus({hours: 1});
      
      slots.push({
        schedule_id: scheduleId,
        start_time: current.toISO(),
        end_time: (slotEnd > end ? end : slotEnd).toISO(),
        status: 'available',
        metadata: {}
      });
      
      current = slotEnd;
    }
    
    return slots;
  }
}
```

---

### 2.3 TicketService (com UPDATE atômico - Bloqueio 1)

**Arquivo:** `backend/src/services/events/TicketService.ts`

```typescript
import {v4 as uuid} from 'uuid';
import db from '../../db';
import {EventContextBuilder} from '../../types/unifycard-event.types';

export class TicketService {
  /**
   * Compra ingresso (transação atômica)
   * 🔴 CRÍTICO: UPDATE atômico de capacidade
   */
  async purchaseTicket(params: {
    eventId: string;
    buyerUserId: string;
    tenantId: string;
  }) {
    const trx = await db.transaction();
    
    try {
      // 1. Lock evento para leitura/escrita
      const event = await trx('events')
        .where({id: params.eventId})
        .forUpdate()
        .first();
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // 2. Valida status
      if (!['PUBLISHED', 'ONGOING'].includes(event.status)) {
        throw new Error('Event not available for ticket purchase');
      }
      
      // 3. 🔴 CRÍTICO: UPDATE atômico de capacidade
      // Evita race condition (2 usuários comprando último ingresso)
      if (event.max_capacity !== null) {
        const result = await trx.raw(`
          UPDATE events
          SET current_occupancy = current_occupancy + 1
          WHERE id = $1
            AND current_occupancy < max_capacity
          RETURNING *
        `, [params.eventId]);
        
        if (result.rows.length === 0) {
          throw new Error('Event sold out');
        }
      }
      
      // 4. Reserva slot (se aplicável)
      let slotId = null;
      if (event.schedule_id) {
        const slot = await trx('schedule_slots')
          .where({
            schedule_id: event.schedule_id,
            status: 'available'
          })
          .first();
        
        if (slot) {
          await trx('schedule_slots')
            .where({id: slot.id, status: 'available'})
            .update({
              status: 'reserved',
              reserved_by_global_user_id: params.buyerUserId
            });
          
          slotId = slot.id;
        }
      }
      
      // 5. Cria ticket
      const qrCode = uuid();
      
      const [ticket] = await trx('event_tickets')
        .insert({
          tenant_id: params.tenantId,
          event_id: params.eventId,
          global_user_id: params.buyerUserId,
          schedule_slot_id: slotId,
          price_paid: event.ticket_price,
          qr_code: qrCode,
          status: 'ACTIVE'
        })
        .returning('*');
      
      // 6. 🔴 CRÍTICO: Processa pagamento via UnifyBank
      const context = EventContextBuilder.forTicket({
        eventId: params.eventId,
        eventType: event.event_type,
        cityId: event.city_id,
        userId: params.buyerUserId,
        ticketId: ticket.id
      });
      
      // TODO: Chamar UnifyBank.processPayment(context)
      // const transaction = await unifyBankService.processPayment({
      //   amount: event.ticket_price,
      //   userId: params.buyerUserId,
      //   context
      // });
      
      // 7. Vincula transaction_id
      // await trx('event_tickets')
      //   .where({id: ticket.id})
      //   .update({transaction_id: transaction.id});
      
      await trx.commit();
      
      return {
        ticketId: ticket.id,
        qrCode,
        price: event.ticket_price
      };
      
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
  
  /**
   * Check-in (valida QR code)
   */
  async checkIn(qrCode: string) {
    const trx = await db.transaction();
    
    try {
      const ticket = await trx('event_tickets')
        .where({qr_code: qrCode})
        .forUpdate()
        .first();
      
      if (!ticket) {
        throw new Error('Invalid QR code');
      }
      
      if (ticket.status !== 'ACTIVE') {
        throw new Error(`Ticket already ${ticket.status.toLowerCase()}`);
      }
      
      const event = await trx('events')
        .where({id: ticket.event_id})
        .first();
      
      const now = new Date();
      if (now < event.start_time) {
        throw new Error('Event has not started yet');
      }
      
      if (event.end_time && now > event.end_time) {
        throw new Error('Event has ended');
      }
      
      await trx('event_tickets')
        .where({id: ticket.id})
        .update({
          status: 'USED',
          checked_in_at: now
        });
      
      await trx.commit();
      
      return {
        success: true,
        event: {
          id: event.id,
          title: event.title,
          start_time: event.start_time
        }
      };
      
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
}
```

**❌ Sem UPDATE atômico → overbooking em eventos concorridos.**

---

### 2.4 ConsumptionService

**Arquivo:** `backend/src/services/events/ConsumptionService.ts`

```typescript
import db from '../../db';
import {EventContextBuilder} from '../../types/unifycard-event.types';

export class ConsumptionService {
  async registerConsumption(params: {
    eventId: string;
    userId: string;
    tenantId: string;
    items: Array<{name: string; quantity: number; price: number}>;
  }) {
    const trx = await db.transaction();
    
    try {
      const event = await trx('events')
        .where({id: params.eventId})
        .first();
      
      if (!event.accepts_consumption) {
        throw new Error('Event does not accept consumption');
      }
      
      const totalAmount = params.items.reduce(
        (sum, item) => sum + (item.quantity * item.price),
        0
      );
      
      const consumptions = await Promise.all(
        params.items.map(item =>
          trx('event_consumptions').insert({
            tenant_id: params.tenantId,
            event_id: params.eventId,
            global_user_id: params.userId,
            item_name: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            total_amount: item.quantity * item.price
          }).returning('*')
        )
      );
      
      // Processa pagamento via UnifyBank
      const context = EventContextBuilder.forConsumption({
        eventId: params.eventId,
        eventType: event.event_type,
        cityId: event.city_id,
        userId: params.userId,
        consumptionId: consumptions[0][0].id
      });
      
      // TODO: await unifyBankService.processPayment({amount: totalAmount, userId, context})
      
      await trx.commit();
      
      return {consumptions, totalAmount};
      
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
}
```

---

## 🟨 FASE 3 — CANCELAMENTO DE EVENTO (Bloqueio 5)

### 3.1 EventService.cancelEvent

**Arquivo:** `backend/src/services/events/EventService.ts`

```typescript
import db from '../../db';

export class EventService {
  /**
   * Cancela evento
   * 
   * 🔴 POLÍTICA MVP:
   * - Tickets: CANCELLED (sem reembolso automático)
   * - Consumo passado: intocado (ledger imutável)
   * - Parking ativo: encerrado
   */
  async cancelEvent(params: {
    eventId: string;
    reason: string;
  }) {
    const trx = await db.transaction();
    
    try {
      const now = new Date();
      
      // 1. Marca evento como cancelado
      await trx('events')
        .where({id: params.eventId})
        .update({
          status: 'CANCELLED',
          metadata: db.raw(`metadata || ?::jsonb`, [
            JSON.stringify({
              cancellation_reason: params.reason,
              cancelled_at: now.toISOString()
            })
          ])
        });
      
      // 2. Cancela tickets ativos (SEM reembolso automático)
      await trx('event_tickets')
        .where({event_id: params.eventId, status: 'ACTIVE'})
        .update({
          status: 'CANCELLED',
          metadata: db.raw(`metadata || ?::jsonb`, [
            JSON.stringify({cancellation_reason: params.reason})
          ])
        });
      
      // 3. Consumos passados: NÃO tocam (ledger imutável)
      
      // 4. Parking ativo: encerra cobrança
      await trx('event_parking')
        .where({event_id: params.eventId, status: 'ACTIVE'})
        .update({
          status: 'EXITED',
          exit_time: now,
          metadata: db.raw(`metadata || ?::jsonb`, [
            JSON.stringify({auto_exited_reason: 'event_cancelled'})
          ])
        });
      
      // 5. Slots: bloqueia (não deleta)
      const eventSchedule = await trx('schedules')
        .where({event_id: params.eventId})
        .first();
      
      if (eventSchedule) {
        await trx('schedule_slots')
          .where({schedule_id: eventSchedule.schedule_id})
          .where('status', '!=', 'reserved')
          .update({status: 'blocked'});
      }
      
      await trx.commit();
      
      return {success: true};
      
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
}
```

**🔴 MVP: Reembolso automático está FORA DO ESCOPO.**

---

## 🔵 FASE 4 — ENDPOINTS

### 4.1 Rotas de Eventos

```typescript
// POST /api/events/:id/publish (publica + gera schedule + slots)
// POST /api/events/:id/tickets (compra ingresso)
// POST /api/events/checkin (check-in com QR)
// POST /api/events/:id/consumption (registra consumo)
// POST /admin/events/:id/cancel (cancela evento)
```

**RBAC:**
- publish: owner do evento
- checkin: público autenticado
- cancel: admin ou owner do evento

---

## ✅ DONE (CRITÉRIOS DE ACEITAÇÃO)

- [ ] event_id adicionado em schedules (unique index)
- [ ] events.schedule_id existe e é atualizado
- [ ] Tipos de evento (SHOW, BAR, etc) funcionam
- [ ] Evento cria schedule próprio
- [ ] Slots gerados por tipo (pontual, contínuo, multi-dia)
- [ ] Compra de ticket usa UPDATE atômico (sem race condition)
- [ ] Check-in valida QR e janela de tempo
- [ ] Consumo registra e gera contexto UnifyCard correto
- [ ] Cancelamento segue política MVP (sem reembolso)
- [ ] UnifyCard Context validado em runtime
- [ ] Testes passam

---

## 🚫 PROIBIDO

- ❌ Evento reusar agenda de empresa
- ❌ Meia-entrada, lotes, assentos
- ❌ Transferência de ingresso
- ❌ Reembolso automático
- ❌ UnifyCard executar split (sempre UnifyBank)
- ❌ Inventar campos em UnifyCardEventContext
- ❌ UPDATE não-atômico de capacidade

---

## 📋 PRÓXIMOS PASSOS

**Após implementação:**
1. Integrar UnifyBank.processPayment() nos TODOs
2. Criar regras de split em `split_rules` para eventos
3. Dashboard para visualização de eventos/tickets/consumo

---

**FIM DO PROMPT 2**

Esta versão está bloqueada contra todos os erros conhecidos.
Depende do Prompt 1 estar implementado.
