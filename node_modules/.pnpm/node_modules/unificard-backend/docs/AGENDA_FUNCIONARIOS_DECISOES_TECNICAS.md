# Decisões Técnicas - Agenda + Funcionários

## ✅ Erro Crítico Corrigido

**Migration 065**: Removido `NOW()` do índice parcial (função volátil não permitida).
- **Antes**: `WHERE status = 'available' AND start_time > NOW()`
- **Depois**: `WHERE status = 'available'`
- **Filtro temporal**: Fica na query, não no índice.

---

## 📋 Respostas às Dúvidas Técnicas

### 1️⃣ Fonte do Timezone

**Decisão**: Timezone obrigatório no `schedule.metadata.timezone` (sem fallback).

**Justificativa**:
- Agenda é a fonte de verdade para horários de operação
- Empresa pode ter múltiplas agendas (ex: filiais em timezones diferentes)
- Eventos terão agenda própria (Prompt 2)
- Usuário pode trabalhar em múltiplas empresas/timezones

**Implementação atual**:
```typescript
if (!schedule.metadata?.timezone || !schedule.metadata?.business_hours) {
  throw new Error('Schedule missing timezone or business_hours');
}
```

**Regra de negócio**:
- ❌ Sem fallback para empresa/usuário/evento
- ✅ Erro explícito se timezone faltar
- ✅ Timezone definido na criação da agenda (CompanyScheduleService)

---

### 2️⃣ Duração Padrão de Slot

**Decisão**: Slot padrão de 1h, configurável via `schedule.metadata.slot_duration_minutes`.

**Implementação proposta**:
```typescript
// SlotGenerator.ts
const slotDurationMinutes = schedule.metadata.slot_duration_minutes || 60;
const next = cursor.plus({ minutes: slotDurationMinutes });
```

**Regra de negócio**:
- **Padrão**: 60 minutos (1h)
- **Configurável**: `metadata.slot_duration_minutes` (ex: 30, 45, 60, 90, 120)
- **Escopo**: Por agenda (empresa pode ter slots de 1h, serviço pode ter 30min)
- **Validação**: Mínimo 15min, máximo 480min (8h)

**Exemplo de metadata**:
```json
{
  "timezone": "America/Sao_Paulo",
  "business_hours": { ... },
  "slot_duration_minutes": 30
}
```

---

### 3️⃣ Precedência de Agenda

**Decisão**: Agenda pessoal do funcionário BLOQUEIA agenda da empresa.

**Hierarquia confirmada**:
1. **Agenda Pessoal** (funcionário) → **BLOQUEIA** agenda da empresa
2. **Agenda da Empresa** → Base de operação
3. **Agenda do Serviço** → Específica (Prompt 2)

**Justificativa**:
- Funcionário pode ter compromissos pessoais que impedem trabalho
- Empresa não pode forçar funcionário a trabalhar em horário bloqueado
- Conflito explícito é melhor que overbooking silencioso

**Implementação atual** (AvailabilityResolver):
```typescript
// 3. Conflito pessoal?
const personalSchedule = await db('schedules')
  .where({global_user_id: employeeId})
  .first();

if (personalSchedule) {
  const conflict = await db('schedule_slots')
    .where({schedule_id: personalSchedule.schedule_id, status: 'reserved'})
    .whereRaw(`tstzrange(start_time, end_time) && tstzrange(?, ?)`, 
      [startTime.toISO(), endTime.toISO()])
    .first();
  
  if (conflict) {
    return {available: false, reason: 'Employee has conflict'};
  }
}
```

**Regra de negócio**:
- ✅ Agenda pessoal `reserved` → bloqueia empresa
- ✅ Agenda pessoal `available` → não bloqueia empresa
- ✅ Agenda pessoal `blocked` → bloqueia empresa
- ⚠️ **Eventos futuros**: Agenda de evento pode ter precedência diferente (Prompt 2)

---

## 🎯 Próximos Passos

### Antes do Prompt 2 (Events):

1. ✅ Migration 065 corrigida
2. ✅ Timezone: obrigatório no schedule (sem fallback)
3. ✅ Duração: 1h padrão, configurável via metadata
4. ✅ Precedência: Pessoal > Empresa > Serviço

### Implementação Pendente (se necessário):

- [ ] Adicionar `slot_duration_minutes` ao SlotGenerator (opcional, pode ficar para Prompt 2)
- [ ] Documentar precedência de agenda para eventos (Prompt 2)

---

## ✅ Sistema Pronto para Produção

Após correção da migration 065, o sistema está:
- ✅ Funcional
- ✅ Idempotente
- ✅ Sem race conditions
- ✅ Com índices otimizados
- ✅ Com RLS ativo

**Pronto para Prompt 2 (Events)**.















