# RFC C63-FASE2B — Migração checkout-ticket.service.ts para unified_availability

**Status:** APROVADO — EM EXECUÇÃO  
**Data:** 2026-04-29  
**Violação:** C63 (SSOT temporal duplicado)  
**Decisão base:** DECISION-0014, DECISION-0015  
**Responsável:** Clayton  

---

## Problema

`checkout-ticket.service.ts` executa UPDATE em `schedule_slots` (SSOT temporal inválido)
dentro de transação aberta (`trx`). Isso é WRITE em fonte legada proibida por DECISION-0014.

THROW imediato não é possível porque 3 bloqueadores estruturais impedem a substituição
pelo caminho canônico (`unified_availability`). Enquanto esses bloqueadores existem,
o sistema opera em estado de transição documentado (DECISION-0015).

---

## Bloqueadores confirmados (auditoria SRC_FULL + MIGRATIONS_FULL, 2026-04-29)

### Bloqueador 1 — createBooking não aceita trx externo

`unified-availability.service.ts` L16606:

```typescript
async createBooking(
  tenantId: string,
  input: CreateUnifiedBookingInput
): Promise<UnifiedBooking>
```

Usa `runQueryWithTenant` internamente — não aceita transação externa.
`checkout-ticket.service.ts` opera dentro de `trx` já aberta — incompatível.

### Bloqueador 2 — event_tickets sem unified_booking_id

DDL atual (MIGRATIONS_FULL L12477): tabela `event_tickets` não tem coluna `unified_booking_id`.
Sem essa coluna, não é possível registrar a referência ao booking canônico no ticket.

### Bloqueador 3 — events sem unified_availability_id

DDL atual (MIGRATIONS_FULL L12122): tabela `events` não tem coluna `unified_availability_id`.
Sem essa coluna, não é possível vincular um evento ao slot canônico de disponibilidade.

---

## Plano de execução (sequência obrigatória)

### Etapa 1 — Migration: ADD COLUMN em events e event_tickets

PRÉ-CONDICIONAL: verificar no banco que colunas não existem antes de criar migration.

```sql
-- Verificar antes de executar:
SELECT column_name FROM information_schema.columns
WHERE table_name = 'events' AND column_name = 'unified_availability_id';

SELECT column_name FROM information_schema.columns
WHERE table_name = 'event_tickets' AND column_name = 'unified_booking_id';
```

Se retornar resultado: ABORTAR, não criar migration.
Se retornar vazio: criar migration forward-only com guards IF NOT EXISTS.

Colunas a adicionar:
- `events.unified_availability_id UUID NULL` — referência ao slot canônico
- `event_tickets.unified_booking_id UUID NULL` — referência ao booking canônico

Tipo: NULL permitido (NOT NULL após migração completa dos dados).
FK: sem FK obrigatória nesta etapa (unified_availability pode não ter registro para todos os eventos).

### Etapa 2 — Patch: createBooking aceitar trx opcional

Adicionar parâmetro opcional `trx?` na assinatura de `createBooking` em
`unified-availability.service.ts`.

Restrições:
- Comportamento sem `trx` deve permanecer idêntico ao atual.
- Não alterar domínio financeiro.
- Não criar SQL fora do módulo `unified-availability`.
- Não criar fluxo paralelo.

### Etapa 3 — Substituição em checkout-ticket.service.ts

Substituir bloco L139605-139641 (SELECT + UPDATE em schedule_slots) por:
1. Chamada a `unifiedAvailabilityService.createBooking(tenantId, input, trx)`.
2. Armazenar `booking.bookingId` em `unified_booking_id` do ticket.
3. `slotId` passa a ser `null` (campo legado, mantido por compatibilidade).

### Etapa 4 — THROW explícito (ScheduleLegacyError)

Após Etapa 3 validada e gates verdes:
Adicionar `throw new ScheduleLegacyError(...)` no bloco substituído como proteção permanente
caso o código legado seja reintroduzido por regressão.

### Etapa 5 — Aplicar migration de REVOKE

Aplicar `20260428200000_schedules_revoke_write.sql` (já criada, não aplicada).
Isso torna `schedule_slots` READ-ONLY em nível de banco.

---

## Critério de conclusão de C63

C63 só pode ser marcado FIXED após:
- Etapas 1-5 executadas e verificadas.
- 4 gates verdes após cada etapa.
- `schedule_slots` sem nenhum WRITE path ativo no código.
- `unified_availability` como único SSOT temporal.

---

## Referências

- DECISION-0014: decisão base C63
- DECISION-0015: justificativa para manter WRITE durante transição
- `checkout-ticket.service.ts` L139605-141 (WRITE ativo)
- `unified-availability.service.ts` L16606 (createBooking sem trx)
- MIGRATIONS_FULL L12122 (events DDL)
- MIGRATIONS_FULL L12477 (event_tickets DDL)
- Migration criada (não aplicada): `20260428200000_schedules_revoke_write.sql`

---

Após criar o arquivo, confirmar o path exato onde foi salvo.
Não executar nenhum gate — aguardar instrução.
