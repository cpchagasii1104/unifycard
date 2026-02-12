// backend/src/core/events/event-creation.orchestrator.ts
// Event Creation Orchestrator (FASE 5.0)
// EVENT_DOMAIN_MINIMUM_CONTRACT

/**
 * 🔴 ORQUESTRADOR É APENAS COLA
 * 
 * O orquestrador NÃO decide nada.
 * Ele apenas encadeia serviços existentes.
 * Nenhuma regra nova.
 * Nenhum efeito colateral.
 * 
 * RESPONSABILIDADES PERMITIDAS:
 * - createDraftEvent
 * - declareEvent
 * - setTimeWindows (via declareEvent)
 * - setOperationalCommitments
 * - getAvailabilityRich
 * - getEconomicPreview (TEST, read-only)
 * 
 * PROIBIDO ABSOLUTAMENTE:
 * - pagamento
 * - split
 * - custódia
 * - ledger
 * - reserva
 * - confirmação
 * - cálculo econômico real
 */

import { eventService } from './event.service';
import { operationalCommitmentsService } from './operational-commitments.service';
import { BadRequestError, NotFoundError, ForbiddenError } from '@core/errors';
import type {
  CreateEventInput,
  DeclareEventInput,
  Event,
  EventTimeWindow,
} from './event.types';
import type {
  CreateOperationalCommitmentInput,
  OperationalCommitment,
} from './operational-commitments.types';

/**
 * Input para criar ou avançar rascunho
 */
export interface CreateDraftInput {
  event?: CreateEventInput; // Se fornecido, cria novo draft
  eventId?: string; // Se fornecido, trabalha com draft existente
}

/**
 * Input para definir time windows
 */
export interface SetTimeWindowsInput {
  eventId: string;
  desiredTimeWindows: EventTimeWindow[];
  flexibilityLevel?: 'strict' | 'flexible' | 'very_flexible';
  timezone?: string;
}

/**
 * Input para definir operational commitments
 */
export interface SetOperationalCommitmentsInput {
  eventId: string;
  commitments: Array<Omit<CreateOperationalCommitmentInput, 'eventId'>>;
}

/**
 * Preview econômico (TEST currency, read-only)
 */
export interface EconomicPreview {
  currency: 'TEST';
  estimated_costs: {
    min: number;
    max: number;
    scenarios: Array<{
      scenario: string;
      amountCents: number;
      breakdown: Array<{
        item: string;
        amountCents: number;
      }>;
    }>;
  };
  notes: string;
  disclaimer: string;
}

/**
 * Summary completo do evento (declarativo)
 */
export interface EventSummary {
  event: Event;
  declaration?: {
    title: string;
    description?: string | null;
    eventAspects: string[];
    visibility: string;
    desiredTimeWindows?: EventTimeWindow[];
    flexibilityLevel?: string;
  };
  availability?: {
    status: 'insufficient_declaration' | 'analyzed';
    windows: Array<{
      window: EventTimeWindow;
      available: boolean;
      conflicts: Array<{
        availability_id: string;
        start_datetime: string;
        end_datetime: string;
      }>;
    }>;
  };
  commitments?: OperationalCommitment[];
  economic_preview?: EconomicPreview;
}

class EventCreationOrchestrator {
  /**
   * Cria ou avança um RASCUNHO
   * Nunca "evento final"
   * Nunca confirma nada
   */
  async createOrAdvanceDraft(
    tenantId: string,
    actorId: string,
    input: CreateDraftInput
  ): Promise<Event> {
    // Se eventId fornecido, retornar draft existente
    if (input.eventId) {
      const existingEvent = await eventService.getEvent(tenantId, input.eventId);
      if (!existingEvent) {
        throw new NotFoundError('Rascunho não encontrado');
      }
      // Garantir que é draft
      if (existingEvent.status !== 'draft') {
        throw new BadRequestError('Apenas rascunhos podem ser avançados');
      }
      return existingEvent;
    }

    // Se event fornecido, criar novo draft
    if (input.event) {
      return await eventService.createDraftEvent(tenantId, input.event);
    }

    throw new BadRequestError('Forneça event ou eventId');
  }

  /**
   * Declara evento (draft -> declared)
   * Persiste EventDeclaration completa
   */
  async declareEvent(
    tenantId: string,
    eventId: string,
    declarationInput: DeclareEventInput,
    actorId: string
  ): Promise<Event> {
    return await eventService.declareEvent(tenantId, eventId, declarationInput, actorId);
  }

  /**
   * Define time windows (atualiza metadata)
   * 
   * 🔴 REGRA CANÔNICA: Time windows NÃO dependem de event_aspects
   * - Em DRAFT, aspects podem estar vazios
   * - Time windows são declaração independente
   * - Salva diretamente em metadata, sem recriar declaration
   * - NUNCA retorna 500 por ausência de aspects
   */
  async setTimeWindows(
    tenantId: string,
    input: SetTimeWindowsInput,
    actorId: string
  ): Promise<Event> {
    // Buscar evento
    const event = await eventService.getEvent(tenantId, input.eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    // Validar permissão
    if (event.actorId !== actorId) {
      throw new ForbiddenError('Apenas o criador do evento pode definir time windows');
    }

    // Validar que evento não está cancelado/finalizado
    if (event.status === 'cancelled' || event.status === 'ended') {
      throw new BadRequestError(`Evento com status '${event.status}' não pode ter time windows atualizados`);
    }

    // 🔴 SALVAR TIME WINDOWS DIRETAMENTE EM METADATA
    // NÃO recriar declaration
    // NÃO validar event_aspects
    // Funciona em DRAFT, DECLARED, PUBLISHED
    return await eventService.updateTimeWindows(
      tenantId,
      input.eventId,
      input.desiredTimeWindows,
      input.flexibilityLevel,
      input.timezone,
      actorId
    );
  }

  /**
   * Define operational commitments
   * Apenas cria commitments, sem efeitos colaterais
   */
  async setOperationalCommitments(
    tenantId: string,
    input: SetOperationalCommitmentsInput
  ): Promise<OperationalCommitment[]> {
    const commitments: OperationalCommitment[] = [];

    for (const commitmentInput of input.commitments) {
      const commitment = await operationalCommitmentsService.createCommitment(
        tenantId,
        {
          eventId: input.eventId,
          ...commitmentInput,
        }
      );
      commitments.push(commitment);
    }

    return commitments;
  }

  /**
   * Obtém disponibilidade rica (read-only)
   */
  async getAvailabilityRich(
    tenantId: string,
    eventId: string
  ) {
    return await eventService.getEventAvailabilityRich(tenantId, eventId);
  }

  /**
   * Preview econômico (TEST currency, read-only)
   * Apenas simulação, sem escrita em ledger
   */
  async getEconomicPreview(
    tenantId: string,
    eventId: string
  ): Promise<EconomicPreview> {
    // Buscar evento
    const event = await eventService.getEvent(tenantId, eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    // Preview básico (sem cálculo real)
    // Apenas intervalos / cenários
    // Nunca valor fechado
    return {
      currency: 'TEST',
      estimated_costs: {
        min: 0,
        max: 10000,
        scenarios: [
          {
            scenario: 'cenario_minimo',
            amountCents: 0,
            breakdown: [
              { item: 'infraestrutura', amountCents: 0 },
              { item: 'operacional', amountCents: 0 },
            ],
          },
          {
            scenario: 'cenario_medio',
            amountCents: 5000,
            breakdown: [
              { item: 'infraestrutura', amountCents: 2000 },
              { item: 'operacional', amountCents: 3000 },
            ],
          },
          {
            scenario: 'cenario_maximo',
            amountCents: 10000,
            breakdown: [
              { item: 'infraestrutura', amountCents: 4000 },
              { item: 'operacional', amountCents: 6000 },
            ],
          },
        ],
      },
      notes: 'Preview simulado. Valores são estimativas informacionais apenas.',
      disclaimer: 'Este preview é apenas simulação. Nenhuma movimentação econômica foi executada. Moeda TEST apenas para preview.',
    };
  }

  /**
   * Agrega estado declarativo completo
   * Apenas leitura
   * Nenhum side-effect
   */
  async getSummary(
    tenantId: string,
    eventId: string
  ): Promise<EventSummary> {
    // 1. Buscar evento
    const event = await eventService.getEvent(tenantId, eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    // 2. Buscar availability rich (se houver declaration)
    let availability;
    if (event.declaration?.desiredTimeWindows && event.declaration.desiredTimeWindows.length > 0) {
      try {
        const richAvailability = await this.getAvailabilityRich(tenantId, eventId);
        availability = richAvailability;
      } catch (error) {
        // Ignorar erros de availability (pode não estar disponível)
      }
    }

    // 3. Buscar commitments
    let commitments;
    try {
      commitments = await operationalCommitmentsService.listCommitmentsByEvent(tenantId, eventId);
    } catch (error) {
      // Ignorar erros de commitments (pode não ter commitments)
    }

    // 4. Buscar economic preview
    let economicPreview;
    try {
      economicPreview = await this.getEconomicPreview(tenantId, eventId);
    } catch (error) {
      // Ignorar erros de preview (pode não estar disponível)
    }

    return {
      event,
      declaration: event.declaration ? {
        title: event.declaration.title,
        description: event.declaration.description,
        eventAspects: event.declaration.eventAspects,
        visibility: event.declaration.visibility,
        desiredTimeWindows: event.declaration.desiredTimeWindows,
        flexibilityLevel: event.declaration.flexibilityLevel,
      } : undefined,
      availability,
      commitments,
      economic_preview: economicPreview,
    };
  }
}

export const eventCreationOrchestrator = new EventCreationOrchestrator();


