# PADRÃO DE UX TEMPORAL CANÔNICO

## 🔴 INPUT DECLARATIVO — NÃO É VERDADE TEMPORAL

Este módulo implementa o **PADRÃO DE UX TEMPORAL CANÔNICO** para entrada de dados temporais no frontend do UnifiCard.

### Princípios Fundamentais

- **NÃO cria verdade temporal**
- **NÃO bloqueia agenda**
- **NÃO resolve conflitos**
- **NÃO cria bookings**
- **NÃO interfere em Unified Availability**

A verdade temporal está exclusivamente no **Core (Agenda Universal)**.

### Estrutura

```
frontend/src/
  components/temporal/
    TimeRangePicker.tsx    # Componente para seleção de intervalo de tempo
    DatePicker.tsx         # Componente para seleção de data
    ScheduleInput.tsx      # Componente para múltiplos intervalos (agenda diária)
  hooks/temporal/
    useTimeRange.ts        # Hook para gerenciar estado de intervalo (draft vs validado)
    useTemporalValidation.ts # Hook para validação assistiva
  utils/temporal/
    formatTime.ts          # Utilitários de formatação de tempo
    validateTimeRange.ts   # Validação de intervalos (formato, não conflitos reais)
```

### Componentes

#### `TimeRangePicker`

Componente para entrada de intervalo de tempo (início-fim).

**Características:**
- Validação apenas em `onBlur` e `onConfirm` (não bloqueia digitação)
- Ajuste automático de valores inválidos
- Estado separado: draft (temporário) vs validado
- Suporte a validação de sobreposição/ordem com outros intervalos

**Exemplo:**
```tsx
import { TimeRangePicker } from '@/components/temporal';

<TimeRangePicker
  start="09:00"
  end="18:00"
  onChange={(start, end) => {
    // Atualizar estado (pode ser inválido temporariamente)
  }}
  onBlur={(start, end) => {
    // Validação e ajuste automático
  }}
  intervals={otherIntervals}
  currentIndex={0}
/>
```

#### `ScheduleInput`

Componente para gerenciar múltiplos intervalos de tempo (agenda diária).

**Características:**
- Gerencia lista de intervalos
- Novo intervalo: `startTime` pré-preenchido, `endTime` vazio
- Validação de sobreposição e ordem
- Botão de confirmação (✓) apenas quando válido

**Exemplo:**
```tsx
import { ScheduleInput } from '@/components/temporal';

<ScheduleInput
  intervals={['09:00-12:00', '14:00-18:00']}
  onChange={(intervals) => {
    // Atualizar lista de intervalos
  }}
/>
```

#### `DatePicker`

Componente para entrada de data.

**Exemplo:**
```tsx
import { DatePicker } from '@/components/temporal';

<DatePicker
  value="2024-01-15"
  onChange={(date) => {
    // Atualizar data
  }}
/>
```

### Hooks

#### `useTimeRange`

Gerencia estado de intervalo de tempo com separação clara entre draft e validado.

**Exemplo:**
```tsx
import { useTimeRange } from '@/hooks/temporal';

const timeRange = useTimeRange('09:00', '18:00');

// Atualizar draft (sem validação)
timeRange.updateDraft('start', '10:00');

// Confirmar (validar e persistir)
const confirmed = timeRange.confirm();
```

#### `useTemporalValidation`

Hook para validação assistiva de intervalos temporais.

**Exemplo:**
```tsx
import { useTemporalValidation } from '@/hooks/temporal';

const validation = useTemporalValidation({
  intervals: otherIntervals,
  currentIndex: 0,
  autoAdjust: true,
});

// Validar
const result = validation.validate('09:00', '18:00');

// Ajustar automaticamente
const adjusted = validation.adjust('08:00', '17:00');
```

### Utils

#### `formatTime.ts`

Utilitários para formatação e conversão de tempo.

```tsx
import { timeToMinutes, minutesToTime, formatTimeRange, parseTimeRange } from '@/utils/temporal';

const minutes = timeToMinutes('09:00'); // 540
const time = minutesToTime(540); // '09:00'
const range = formatTimeRange('09:00', '18:00'); // '09:00-18:00'
const { start, end } = parseTimeRange('09:00-18:00');
```

#### `validateTimeRange.ts`

Validação de intervalos temporais (formato e lógica básica, não conflitos reais).

```tsx
import { validateTimeRange, validateNoOverlap, validateOrdered } from '@/utils/temporal';

const result = validateTimeRange('09:00', '18:00');
const overlapResult = validateNoOverlap(intervals, currentIndex, '09:00', '18:00');
const orderResult = validateOrdered(intervals, currentIndex, '09:00');
```

### Regras de UX

1. **Digitação não bloqueia input**: Validação apenas em `onBlur` e `onConfirm`
2. **Estado separado**: Draft (temporário, pode ser inválido) vs Validado
3. **Ajuste automático**: Valores inválidos são ajustados automaticamente com feedback
4. **Mensagens instrutivas**: Erros orientam, não bloqueiam
5. **Novo intervalo incompleto**: `endTime` vazio, usuário preenche

### Integração com AvailabilityScheduleEnhanced

O componente `AvailabilityScheduleEnhanced.tsx` pode ser refatorado para usar estes componentes:

```tsx
import { ScheduleInput } from '@/components/temporal';

// Substituir lógica manual de intervalos por:
<ScheduleInput
  intervals={schedule[dayKey] || []}
  onChange={(intervals) => {
    const newSchedule = { ...schedule };
    newSchedule[dayKey] = intervals;
    updateSchedule(newSchedule);
  }}
/>
```

### Referências Canônicas

- `AGENDA_UNIVERSAL_CONTRACT.md`
- `CORE_IMUTAVEL.md`
- `profile-professional.types.ts` (AvailabilitySchedule = INPUT DECLARATIVO)


