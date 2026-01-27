# PROMPT 1: AGENDA + FUNCIONÁRIOS (VERSÃO FINAL BLOQUEADA CONTRA ERROS)

**Regra:** Implementar exatamente como descrito.  
**Objetivo:** Agenda robusta, sem duplicação, sem race condition, sem buracos de permissão.

---

## 🔒 FASE 0 — PRÉ-REQUISITOS OBRIGATÓRIOS

**Antes de qualquer código:**
- ❌ NÃO alterar o schema base de `schedules`
- ❌ NÃO criar agenda universal
- ❌ NÃO criar múltiplas agendas por entidade
- ✅ Timezone no banco é sempre UTC
- ✅ Timezone local fica em metadata

---

## 🟥 FASE 1 — MIGRATIONS CRÍTICAS (BLOQUEANTES)

### 1.1 Garantir 1 Schedule por Owner (OBRIGATÓRIO)

**Migration:** `backend/migrations/035_schedule_unique_owners.sql`

```sql
-- 1 agenda por empresa
CREATE UNIQUE INDEX IF NOT EXISTS uniq_schedule_company
  ON schedules(company_id)
  WHERE company_id IS NOT NULL;

-- 1 agenda por usuário
CREATE UNIQUE INDEX IF NOT EXISTS uniq_schedule_user
  ON schedules(global_user_id)
  WHERE global_user_id IS NOT NULL;

-- 1 agenda por serviço
CREATE UNIQUE INDEX IF NOT EXISTS uniq_schedule_service
  ON schedules(service_id)
  WHERE service_id IS NOT NULL;
```

**❌ Sem isso, o sistema quebra silenciosamente.**

---

### 1.2 Constraint para Slots (necessário para idempotência)

**Migration:** `backend/migrations/036_schedule_slots_unique.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uniq_schedule_slot_time
  ON schedule_slots(schedule_id, start_time, end_time);
```

---

### 1.3 Índices de Performance (não opcionais)

**Migration:** `backend/migrations/037_schedule_performance_indexes.sql`

```sql
CREATE INDEX IF NOT EXISTS idx_slots_user_time 
  ON schedule_slots(reserved_by_global_user_id, start_time)
  WHERE reserved_by_global_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_slots_available 
  ON schedule_slots(schedule_id, start_time)
  WHERE status = 'available' AND start_time > NOW();

CREATE INDEX IF NOT EXISTS idx_slots_status_time 
  ON schedule_slots(status, start_time);
```

---

### 1.4 Criar Tabela de Funcionários

**Migration:** `backend/migrations/038_company_employees.sql`

```sql
CREATE TABLE IF NOT EXISTS company_employees (
  company_employee_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NULL,

  role VARCHAR(20) NOT NULL DEFAULT 'staff',
    -- 'owner' | 'admin' | 'manager' | 'staff'
  can_manage_schedule BOOLEAN NOT NULL DEFAULT false,
  can_manage_services BOOLEAN NOT NULL DEFAULT false,

  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'manager', 'staff')),
  CONSTRAINT valid_dates CHECK (ended_at IS NULL OR ended_at > started_at)
);

-- Índice para vínculos ativos
CREATE INDEX idx_company_employees_active 
  ON company_employees(company_id, ended_at)
  WHERE ended_at IS NULL;

-- Índice para histórico
CREATE INDEX idx_company_employees_user 
  ON company_employees(global_user_id, started_at DESC);

-- RLS
ALTER TABLE company_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON company_employees
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

---

## 🟦 FASE 2 — SERVIÇOS (IMPLEMENTAÇÃO CORRETA)

### 2.1 SlotGenerator — BATCH INSERT (PROIBIDO N+1)

**Arquivo:** `backend/src/services/schedule/SlotGenerator.ts`

```typescript
import {DateTime} from 'luxon';
import db from '../../db';

export class SlotGenerator {
  async generateCompanySlots(params: {
    companyId: string;
    scheduleId: string;
    daysAhead?: number;
  }): Promise<{generated: number}> {
    const {scheduleId, daysAhead = 30} = params;
    const trx = await db.transaction();
    
    try {
      const schedule = await trx('schedules')
        .where({schedule_id: scheduleId})
        .first();
      
      if (!schedule?.metadata?.timezone || !schedule.metadata.business_hours) {
        throw new Error('Schedule missing timezone or business_hours');
      }
      
      const tz = schedule.metadata.timezone;
      const hours = schedule.metadata.business_hours;
      
      // Gera array de slots
      const slotsToInsert = [];
      const start = DateTime.now().setZone(tz).startOf('day');
      const end = start.plus({days: daysAhead});
      
      for (let date = start; date < end; date = date.plus({days: 1})) {
        const day = date.toFormat('EEEE').toLowerCase();
        const config = hours[day];
        
        if (!config) continue;
        
        const [startH, startM] = config.start.split(':').map(Number);
        const [endH, endM] = config.end.split(':').map(Number);
        
        let cursor = date.set({hour: startH, minute: startM, second: 0});
        const limit = date.set({hour: endH, minute: endM, second: 0});
        
        while (cursor < limit) {
          const next = cursor.plus({hours: 1});
          slotsToInsert.push({
            schedule_id: scheduleId,
            start_time: cursor.toUTC().toISO(),
            end_time: next.toUTC().toISO(),
            status: 'available'
          });
          cursor = next;
        }
      }
      
      // 🔴 CRÍTICO: Batch insert, não loop
      if (slotsToInsert.length > 0) {
        await trx.raw(`
          INSERT INTO schedule_slots (schedule_id, start_time, end_time, status)
          SELECT * FROM jsonb_to_recordset($1)
          AS t(schedule_id UUID, start_time TIMESTAMPTZ, end_time TIMESTAMPTZ, status TEXT)
          ON CONFLICT (schedule_id, start_time, end_time) DO NOTHING
        `, [JSON.stringify(slotsToInsert)]);
      }
      
      await trx.commit();
      return {generated: slotsToInsert.length};
      
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
}
```

**❌ Nunca usar loop com insert individual.**

---

### 2.2 AvailabilityResolver — Validação de Sobreposição (CRÍTICO)

**Arquivo:** `backend/src/services/schedule/AvailabilityResolver.ts`

```typescript
import {DateTime} from 'luxon';
import db from '../../db';

export class AvailabilityResolver {
  async checkEmployeeAvailability(params: {
    employeeId: string;
    companyId: string;
    serviceId?: string;
    startTime: DateTime;
    endTime: DateTime;
  }): Promise<{available: boolean; reason?: string}> {
    const {employeeId, companyId, startTime, endTime} = params;
    
    // 1. Funcionário ativo?
    const employment = await db('company_employees')
      .where({
        company_id: companyId,
        global_user_id: employeeId,
        ended_at: null
      })
      .first();
    
    if (!employment) {
      return {available: false, reason: 'Employee not active'};
    }
    
    // 2. Empresa operando?
    const companySchedule = await db('schedules')
      .where({company_id: companyId})
      .first();
    
    if (!companySchedule) {
      return {available: false, reason: 'Company has no schedule'};
    }
    
    const companySlot = await db('schedule_slots')
      .where({schedule_id: companySchedule.schedule_id, status: 'available'})
      .whereRaw(
        `tstzrange(start_time, end_time) @> tstzrange(?, ?)`,
        [startTime.toISO(), endTime.toISO()]
      )
      .first();
    
    if (!companySlot) {
      return {available: false, reason: 'Company not operating'};
    }
    
    // 3. Conflito pessoal?
    const personalSchedule = await db('schedules')
      .where({global_user_id: employeeId})
      .first();
    
    if (personalSchedule) {
      const conflict = await db('schedule_slots')
        .where({schedule_id: personalSchedule.schedule_id, status: 'reserved'})
        .whereRaw(
          `tstzrange(start_time, end_time) && tstzrange(?, ?)`,
          [startTime.toISO(), endTime.toISO()]
        )
        .first();
      
      if (conflict) {
        return {available: false, reason: 'Employee has conflict'};
      }
    }
    
    return {available: true};
  }
  
  /**
   * Reserva slot com proteção contra overbooking
   */
  async reserveSlot(params: {
    scheduleId: string;
    slotId: string;
    userId: string;
    actionId?: string;
  }): Promise<{success: boolean}> {
    const trx = await db.transaction();
    
    try {
      // 1. 🔴 CRÍTICO: Validação de sobreposição ANTES de reservar
      const slot = await trx('schedule_slots')
        .where({schedule_slot_id: params.slotId})
        .first();
      
      if (!slot) {
        throw new Error('Slot not found');
      }
      
      const overlap = await trx('schedule_slots')
        .where({schedule_id: params.scheduleId, status: 'reserved'})
        .whereRaw(
          `tstzrange(start_time, end_time) && tstzrange(?, ?)`,
          [slot.start_time, slot.end_time]
        )
        .first();
      
      if (overlap) {
        throw new Error('Time slot overlaps with existing reservation');
      }
      
      // 2. Lock otimista
      const updated = await trx('schedule_slots')
        .where({
          schedule_slot_id: params.slotId,
          status: 'available'
        })
        .update({
          status: 'reserved',
          reserved_by_global_user_id: params.userId,
          reserved_via_action_id: params.actionId,
          updated_at: new Date()
        });
      
      if (updated === 0) {
        throw new Error('Slot no longer available');
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

**Sem validação de overlap → overbooking silencioso.**

---

## 🟨 FASE 3 — FUNCIONÁRIOS (SEM AGENDA = BUG)

### 3.1 EmployeeService

**Arquivo:** `backend/src/services/employee/EmployeeService.ts`

```typescript
import db from '../../db';

export class EmployeeService {
  /**
   * Contrata funcionário
   * 🔴 CRÍTICO: Cria agenda pessoal automaticamente
   */
  async hireEmployee(params: {
    companyId: string;
    userId: string;
    tenantId: string;
    role: 'owner' | 'admin' | 'manager' | 'staff';
  }) {
    const trx = await db.transaction();
    
    try {
      // 1. Cria vínculo
      const [employment] = await trx('company_employees')
        .insert({
          company_id: params.companyId,
          global_user_id: params.userId,
          tenant_id: params.tenantId,
          role: params.role
        })
        .returning('*');
      
      // 2. 🔴 CRÍTICO: Garante agenda pessoal
      // Usa raw SQL com WHERE NOT EXISTS para evitar race condition
      await trx.raw(`
        INSERT INTO schedules (global_user_id, tenant_id, metadata)
        SELECT $1, $2, $3::jsonb
        WHERE NOT EXISTS (
          SELECT 1 FROM schedules WHERE global_user_id = $1
        )
      `, [
        params.userId,
        params.tenantId,
        JSON.stringify({timezone: 'America/Sao_Paulo'})
      ]);
      
      await trx.commit();
      return employment;
      
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
  
  /**
   * Demite funcionário
   */
  async terminateEmployee(params: {
    companyId: string;
    employeeId: string;
    reason?: string;
  }) {
    const trx = await db.transaction();
    
    try {
      const now = new Date();
      
      // 1. Encerra vínculo
      await trx('company_employees')
        .where({
          company_id: params.companyId,
          global_user_id: params.employeeId,
          ended_at: null
        })
        .update({
          ended_at: now,
          metadata: db.raw(
            `metadata || ?::jsonb`,
            [JSON.stringify({termination_reason: params.reason})]
          )
        });
      
      // 2. Libera slots futuros
      const personalSchedule = await trx('schedules')
        .where({global_user_id: params.employeeId})
        .first();
      
      if (personalSchedule) {
        await trx('schedule_slots')
          .where({schedule_id: personalSchedule.schedule_id})
          .where('start_time', '>', now)
          .where('status', 'reserved')
          .update({
            status: 'available',
            reserved_by_global_user_id: null,
            reserved_via_action_id: null
          });
      }
      
      // 3. Ledger NÃO é tocado (imutável)
      
      await trx.commit();
      return {success: true};
      
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
}
```

**❌ Nunca assumir que agenda pessoal já existe.**

---

## 🟩 FASE 4 — AGENDA DA EMPRESA (OBRIGATÓRIO)

### 4.1 CompanyScheduleService

**Arquivo:** `backend/src/services/schedule/CompanyScheduleService.ts`

```typescript
import db from '../../db';

export class CompanyScheduleService {
  /**
   * Cria ou atualiza agenda da empresa
   */
  async ensureCompanySchedule(params: {
    companyId: string;
    tenantId: string;
    timezone: string;
    businessHours: {
      monday?: {start: string; end: string};
      tuesday?: {start: string; end: string};
      wednesday?: {start: string; end: string};
      thursday?: {start: string; end: string};
      friday?: {start: string; end: string};
      saturday?: {start: string; end: string};
      sunday?: {start: string; end: string};
    };
  }) {
    const trx = await db.transaction();
    
    try {
      // Verifica se já existe
      const existing = await trx('schedules')
        .where({company_id: params.companyId})
        .first();
      
      if (existing) {
        // Atualiza metadata
        await trx('schedules')
          .where({schedule_id: existing.schedule_id})
          .update({
            metadata: {
              timezone: params.timezone,
              business_hours: params.businessHours
            }
          });
        
        await trx.commit();
        return existing.schedule_id;
      }
      
      // Cria novo
      const [schedule] = await trx('schedules')
        .insert({
          company_id: params.companyId,
          tenant_id: params.tenantId,
          metadata: {
            timezone: params.timezone,
            business_hours: params.businessHours
          }
        })
        .returning('*');
      
      await trx.commit();
      return schedule.schedule_id;
      
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
}
```

**❌ Sem agenda da empresa → slots nunca serão gerados.**

---

## 🔵 FASE 5 — ENDPOINTS

### 5.1 Rotas de Agenda

```typescript
// POST /admin/schedules/generate-slots
// POST /api/schedules/check-availability
// POST /api/schedules/reserve-slot

// POST /admin/companies/:id/schedule (criar/atualizar agenda)
// GET /admin/companies/:id/schedule (ler agenda)
```

### 5.2 Rotas de Funcionários

```typescript
// POST /api/employees (contratar)
// DELETE /api/employees/:id (demitir)
// GET /api/employees (listar ativos)
```

**RBAC:** requireCompanyAdmin para mutations

---

## ✅ DONE (CRITÉRIOS DE ACEITAÇÃO)

- [ ] Apenas 1 agenda por entidade (unique indexes)
- [ ] Slots gerados sem duplicação (batch insert + ON CONFLICT)
- [ ] Reservas sem sobreposição (validação de overlap)
- [ ] Funcionário novo nunca quebra agenda (criação automática)
- [ ] Demissão limpa agenda futura
- [ ] Queries usam índices (sem full scan)
- [ ] Agenda da empresa pode ser criada/editada

---

## 🚫 PROIBIDO

- ❌ Agenda universal
- ❌ Agenda compartilhada
- ❌ Slot sem owner claro
- ❌ Insert em loop (N+1)
- ❌ Assumir agenda existente
- ❌ Timezone fora de metadata
- ❌ Reservar sem validar overlap

---

## 📋 PRÓXIMO BLOQUEIO

**Após implementação, próximo passo:**

**Prompt 2 — Event Lifecycle** (depende desta base funcional)
- Eventos geram schedule próprio
- Tickets reservam slots
- Consumo registra pagamento
- Split executa via UnifyBank

---

**FIM DO PROMPT 1**

Esta versão está bloqueada contra todos os erros conhecidos.
