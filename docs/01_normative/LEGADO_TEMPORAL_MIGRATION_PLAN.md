Status: SUBORDINATED
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
# Plano de Migração — Estruturas Temporais Legadas

## Contexto

Este documento identifica estruturas temporais **LEGADAS** que foram substituídas pela fonte canônica temporal do UnifiCard: **Unified Availability** (migration 144).

## Fonte Canônica Temporal

**Fonte canônica:** `unified-availability.service.ts` (tabelas `availability` e `bookings`, migration 144)

**Regra absoluta:** Nenhum novo código pode usar estruturas legadas listadas abaixo.

## Estruturas Legadas Identificadas

### 1. `schedules` e `schedule_slots`
- **Migration:** `032_schedule_universal.sql`
- **Status:** LEGADO
- **Migração:** Usar `unified-availability.service.ts`

### 2. `service_availability`
- **Migration:** `137_service_availability.sql`
- **Status:** LEGADO
- **Migração:** Usar `unified-availability.service.ts`

### 3. `calendar_events`
- **Migration:** `195_calendar_events.sql`
- **Status:** LEGADO
- **Migração:** Usar `unified-availability.service.ts`

### 4. `group_schedules`
- **Migration:** `120_group_schedules.sql`
- **Status:** LEGADO
- **Migração:** Usar `unified-availability.service.ts`

### 5. `rides_driver_availability`
- **Migration:** `010_rides_driver_availability.sql`
- **Status:** LEGADO
- **Migração:** Usar `unified-availability.service.ts`

## Services Legados Identificados

### 1. `CompanyScheduleService.ts`
- **Localização:** `backend/src/services/schedule/CompanyScheduleService.ts`
- **Status:** LEGADO
- **Migração:** Usar `unified-availability.service.ts`

### 2. `availability.service.ts` (rides)
- **Localização:** 
  - `backend/src/modules/rides/availability/availability.service.ts`
  - `backend/src/modules/rides/drivers/availability/availability.service.ts`
- **Status:** LEGADO
- **Migração:** Usar `unified-availability.service.ts`

## Regras de Uso

1. **Nenhum novo código** pode usar estruturas legadas listadas acima.
2. **Código legado existente** deve ser gradualmente migrado para Unified Availability.
3. **Decisões temporais** (disponibilidade, conflitos, bookings) devem sempre usar `unified-availability.service.ts`.

## Plano de Migração (Futuro)

A migração completa das estruturas legadas será planejada em fases futuras, após validação institucional.

---

**Última atualização:** Gerado como parte do hardening institucional do Core Temporal.



