import type { Event, EventSession, EventStaff, CreateEventInput, AddSessionInput, AssignStaffInput, EventWithDetails, SearchEventsOptions } from './events.types';
declare class EventsService {
    private toEvent;
    private toEventSession;
    private toEventLocation;
    private toEventStaff;
    private toEventAttendee;
    /**
     * Cria um novo evento
     */
    createEvent(tenantId: string, input: CreateEventInput, createdByGlobalUserId: string): Promise<Event>;
    /**
     * Adiciona uma sessão a um evento
     */
    addSession(tenantId: string, eventId: string, input: AddSessionInput): Promise<EventSession>;
    /**
     * Designa staff para um evento
     */
    assignStaff(tenantId: string, eventId: string, input: AssignStaffInput, assignedByGlobalUserId: string): Promise<EventStaff>;
    /**
     * Realiza check-in de um participante
     */
    checkIn(tenantId: string, eventId: string, globalUserId: string): Promise<{
        checkedIn: boolean;
        checkInTime: Date;
    }>;
    /**
     * Busca um evento por ID
     */
    getEvent(tenantId: string, eventId: string): Promise<Event | null>;
    /**
     * Busca evento com detalhes completos
     */
    getEventWithDetails(tenantId: string, eventId: string): Promise<EventWithDetails | null>;
    /**
     * Busca eventos com filtros
     */
    searchEvents(tenantId: string, options?: SearchEventsOptions): Promise<Event[]>;
}
export declare const eventsService: EventsService;
export {};
//# sourceMappingURL=events.service.d.ts.map