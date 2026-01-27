# Decisões Técnicas - Event Lifecycle (Prompt 2)

## ✅ Ajustes Obrigatórios Aplicados

### 1. LOCK no slot durante compra de ingresso ✅

**Problema**: Dois usuários podiam pegar o mesmo slot antes da reserva.

**Solução**: Adicionado `FOR UPDATE SKIP LOCKED` na busca de slot.

```typescript
SELECT slot_id, schedule_id, status
FROM schedule_slots
WHERE schedule_id = $1
  AND status = 'available'
FOR UPDATE SKIP LOCKED
LIMIT 1
```

**Arquivo**: `backend/src/services/events/TicketService.ts`

---

### 2. current_occupancy ≠ fonte da verdade ✅

**Problema**: Se alguém apagar ticket manualmente, occupancy fica errado.

**Decisão**: `current_occupancy` é **CACHE**, não fonte da verdade.

**Fonte real**: `COUNT(event_tickets WHERE status IN ('ACTIVE','USED'))`

**Documentação**: Comentário adicionado no código explicando que é cache para performance.

**Arquivo**: `backend/src/services/events/TicketService.ts`

---

### 3. Cancelamento de evento libera slots futuros ✅

**Problema**: Slots continuavam reservados após cancelamento, travando agenda.

**Solução**: 
- Slots futuros: liberados (`status = 'available'`, `reserved_by_global_user_id = NULL`)
- Slots passados: bloqueados (`status = 'blocked'`)

**Arquivo**: `backend/src/services/events/EventService.ts`

---

### 4. Split explícito no consumo ✅

**Problema**: Não estava explícito se consumo passa por mesmo split de evento.

**Decisão**: Consumo herda split do evento (sem regra própria no MVP).

**Implementação**: Adicionado `parentModule: 'EVENT'` no contexto de consumo.

```typescript
{
  module: 'CONSUMPTION',
  parentModule: 'EVENT', // Herda split do evento
  entityId: eventId,
  eventType: eventType,
  cityId: cityId,
  ...
}
```

**Arquivo**: `backend/src/types/unifycard-event.types.ts`

---

## 📋 Decisões Pendentes Resolvidas

### 1. Evento recorrente (BAR / RESTAURANTE)

**Decisão**: ✅ **1 evento permanente + slots diários**

**Justificativa**:
- Evita crescimento descontrolado da tabela `events`
- UX mais simples (1 evento no feed, não múltiplos)
- Consumo histórico unificado
- Slots diários permitem controle de horário

**Implementação**: 
- Evento tipo `BAR`/`RESTAURANTE` cria 1 evento fixo
- `EventScheduleService.generateEventSlots()` gera slots de 1h durante funcionamento
- Slots são gerados periodicamente (ex: 30 dias à frente)

---

### 2. Ingresso sem slot (capacidade apenas)

**Decisão**: ✅ **Slot é OPCIONAL**

**Regra**:
- **Com slot**: Eventos que precisam controle de horário (ex: WORKSHOP, CINEMA)
- **Sem slot**: Eventos grandes onde só capacidade importa (ex: SHOW, FESTIVAL)

**Implementação**:
- Se `event.schedule_id` existir → tenta reservar slot
- Se não encontrar slot disponível mas evento permite apenas capacidade → continua compra
- Slot não é obrigatório para compra de ingresso

**Arquivo**: `backend/src/services/events/TicketService.ts` (comentário adicionado)

---

### 3. Estacionamento gera agenda ou não?

**Decisão**: ✅ **Só financeiro, sem agenda própria**

**Justificativa**:
- Estacionamento é transação financeira, não controle de horário
- Não precisa de slots na agenda
- Simplifica arquitetura (menos complexidade)

**Implementação**:
- `event_parking` não cria schedule próprio
- Apenas registra entrada/saída e calcula valor
- Processa pagamento via UnifyBank (sem split de agenda)

---

## 🎯 Resumo das Decisões

| Decisão | Resposta | Impacto |
|---------|----------|---------|
| BAR/RESTAURANTE | 1 evento permanente | Menos eventos na tabela, UX melhor |
| Ingresso + slot | Slot opcional | Flexibilidade para eventos grandes |
| Parking + agenda | Só financeiro | Arquitetura mais simples |

---

## ✅ Sistema Atualizado

Após os 4 ajustes obrigatórios:

- ✅ Overbooking de slot prevenido (FOR UPDATE SKIP LOCKED)
- ✅ current_occupancy documentado como cache
- ✅ Cancelamento libera slots futuros
- ✅ Split de consumo explícito (herda do evento)

**Pronto para produção** (após testes).

---

## 📋 Próximos Passos

1. Integrar `UnifyBank.processPayment()` nos TODOs
2. Criar regras de split em `split_rules` para eventos
3. Dashboard para visualização de eventos/tickets/consumo
4. Feed Social + Eventos (descoberta)




























