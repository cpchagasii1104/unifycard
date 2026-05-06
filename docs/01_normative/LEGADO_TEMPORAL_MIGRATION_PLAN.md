---
⚠️ DEPRECATED — versão anterior do plano de migração temporal

Este conteúdo foi substituído pela versão atual alinhada com:
- C63 (violação SSOT temporal)
- DECISION-0014
- CORE_TEMPORAL_CONTRACT.md

A versão abaixo NÃO deve ser usada como referência operacional.
---

---

# VERSÃO ATUAL — PLANO DE MIGRAÇÃO TEMPORAL (2026-04-28)

## Objetivo

Definir plano de eliminação de WRITE paths em estruturas legadas (schedules/schedule_slots).

---

## 1. Contexto

- Violação formal C63 identificada (SSOT temporal duplicado)
- SSOT canônico: unified_availability
- Estruturas legadas: schedules, schedule_slots

---

## 2. Lista de WRITE paths

### PRODUÇÃO (ativos)

1. `checkout-ticket.service.ts:127` — UPDATE schedule_slots (checkout de eventos)
2. `EmployeeService.ts:62` — INSERT schedules (contratação de funcionários)
3. `EmployeeService.ts:128` — UPDATE schedule_slots (demissão de funcionários)

### CÓDIGO MORTO

4. `EventScheduleService.ts:66` — INSERT schedules (unwired)
5. `EventScheduleService.ts:135` — INSERT schedule_slots (unwired)
6. `SlotGenerator.ts:95` — INSERT schedule_slots (unwired)

---

## 3. Estratégia de Migração

- Fase 1: bloquear código morto com ScheduleLegacyError
- Fase 2: migrar 3 fluxos produção para unified_availability
- Fase 3: validar zero WRITE paths ativos antes de aplicar REVOKE
- Fase 4: aplicar REVOKE após validação completa

---

## 4. Status

- IN_PROGRESS

---

## 5. Referências

- CORE_TEMPORAL_CONTRACT.md
- SSOT_REGISTRY_UNIFICARD.md
- DECISION-0014

---
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

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CORE_IMUTAVEL.md

### Referenciado por
- 00_INDEX.md
<!-- AUTO-GENERATED-END -->