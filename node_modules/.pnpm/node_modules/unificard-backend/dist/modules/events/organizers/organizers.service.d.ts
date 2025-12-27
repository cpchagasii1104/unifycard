import type { EventOrganizer, EventOrganizerMember, CreateOrganizerInput, AddOrganizerMemberInput, EventOrganizerWithDetails } from './organizers.types';
declare class OrganizersService {
    private toEventOrganizer;
    private toEventOrganizerMember;
    /**
     * Verifica se usuário tem permissão (owner ou admin)
     */
    private hasPermission;
    /**
     * Cria um novo organizador
     */
    createOrganizer(tenantId: string, input: CreateOrganizerInput, ownerGlobalUserId: string): Promise<EventOrganizer>;
    /**
     * Adiciona membro a um organizador (método interno sem validação de permissão)
     */
    private addMemberInternal;
    /**
     * Adiciona membro a um organizador (com validação de permissão)
     */
    addMember(tenantId: string, organizerId: string, input: AddOrganizerMemberInput, requesterGlobalUserId: string): Promise<EventOrganizerMember>;
    /**
     * Remove membro de um organizador
     */
    removeMember(tenantId: string, organizerId: string, globalUserId: string, requesterGlobalUserId: string): Promise<void>;
    /**
     * Busca organizador por ID
     */
    getOrganizer(tenantId: string, organizerId: string): Promise<EventOrganizer | null>;
    /**
     * Busca organizador com detalhes completos
     */
    getOrganizerWithDetails(tenantId: string, organizerId: string): Promise<EventOrganizerWithDetails | null>;
    /**
     * Lista organizadores
     */
    listOrganizers(tenantId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<EventOrganizer[]>;
    /**
     * Vincula evento a um organizador
     */
    linkEvent(tenantId: string, eventId: string, organizerId: string, requesterGlobalUserId: string): Promise<void>;
}
export declare const organizersService: OrganizersService;
export {};
//# sourceMappingURL=organizers.service.d.ts.map