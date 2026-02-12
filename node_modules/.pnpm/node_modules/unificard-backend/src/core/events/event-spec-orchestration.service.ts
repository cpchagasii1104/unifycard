// backend/src/core/events/event-spec-orchestration.service.ts
// P0-3: Orquestração EventSpec → Event.declaration
// ⚠️ PROIBIÇÕES EXPLÍCITAS:
// - NÃO escrever na Agenda Universal
// - NÃO criar slots, reservas ou entries
// - NÃO usar ownerType/ownerId/type/time_range em tabelas de agenda
// - NÃO observers, listeners ou reações automáticas
//
// PERMITIDO:
// - Atualizar (merge) Event.declaration com dados derivados do EventSpec
// - Converter answers.time_window em Event.declaration.desired_time_windows

import { eventService } from './event.service';
import { eventSpecService } from './specs/event-spec.service';
import { BadRequestError, NotFoundError, ForbiddenError } from '@core/errors';
import type { EventSpec } from './specs/event-spec.types';
import type { EventTimeWindow, FlexibilityLevel } from './event.types';

/**
 * 🔴 P0-3: Atualiza Event.declaration a partir de EventSpec
 * 
 * PERMITIDO:
 * - Atualizar Event.declaration com dados do EventSpec
 * - Converter answers.time_window em desired_time_windows
 * 
 * PROIBIDO:
 * - Qualquer escrita na Agenda Universal
 */
export async function updateEventDeclarationFromSpec(
  tenantId: string,
  eventId: string,
  specId: string,
  actorId: string
): Promise<void> {
  // 1. Buscar EventSpec
  const eventSpec = await eventSpecService.getEventSpecById(tenantId, specId);
  
  // 2. Validar que EventSpec está associado ao Event correto
  if (eventSpec.eventId !== eventId) {
    throw new BadRequestError('EventSpec não está associado ao Event fornecido');
  }

  // 3. Buscar Event
  const event = await eventService.getEvent(tenantId, eventId);
  if (!event) {
    throw new NotFoundError('Evento não encontrado');
  }

  // 4. Validar permissão
  if (event.actorId !== actorId) {
    throw new ForbiddenError('Apenas o criador do evento pode atualizar a declaração');
  }

  // 5. Converter answers.time_window em desired_time_windows
  const answers = eventSpec.answers;
  const desiredTimeWindows: EventTimeWindow[] = [];
  
  if (answers.time_window) {
    const timeWindow = answers.time_window;
    
    // Se tem date e starts_at/ends_at, construir time windows
    if (timeWindow.date) {
      const dateStr = timeWindow.date; // ISO date string (YYYY-MM-DD)
      const startTime = timeWindow.starts_at || '00:00';
      const endTime = timeWindow.ends_at || '23:59';
      
      // Construir ISO datetime strings
      const startDatetime = `${dateStr}T${startTime}:00.000Z`;
      const endDatetime = `${dateStr}T${endTime}:00.000Z`;
      
      desiredTimeWindows.push({
        startDatetime: startDatetime,
        endDatetime: endDatetime,
        timezone: timeWindow.timezone || 'America/Sao_Paulo', // Default do sistema
      });
    }
  }

  // 6. Determinar flexibility_level
  let flexibilityLevel: FlexibilityLevel | undefined = undefined;
  if (answers.time_window?.flexible === true) {
    flexibilityLevel = 'flexible';
  } else if (answers.time_window?.flexible === false) {
    flexibilityLevel = 'strict';
  }

  // 7. Atualizar Event.declaration via eventService.updateTimeWindows
  // Este método já faz merge seguro em metadata.declaration
  if (desiredTimeWindows.length > 0) {
    await eventService.updateTimeWindows(
      tenantId,
      eventId,
      desiredTimeWindows,
      flexibilityLevel,
      desiredTimeWindows[0]?.timezone,
      actorId
    );
  }

  // 8. Se não tem time windows mas tem outros dados do EventSpec, atualizar declaration básica
  // Por enquanto, apenas time windows são mapeados conforme P0-3
  // Outros campos podem ser adicionados futuramente se necessário
}


