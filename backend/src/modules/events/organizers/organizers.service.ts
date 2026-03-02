// src/modules/events/organizers/organizers.service.ts
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { eventsService } from '../events.service';
import type {
  EventOrganizer,
  EventOrganizerRow,
  EventOrganizerMember,
  EventOrganizerMemberRow,
  CreateOrganizerInput,
  AddOrganizerMemberInput,
  LinkEventToOrganizerInput,
  EventOrganizerWithDetails,
  OrganizerRole,
} from './organizers.types';

class OrganizersService {
  private toEventOrganizer(row: EventOrganizerRow): EventOrganizer {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      logoUrl: row.logo_url,
      ownerGlobalUserId: row.owner_global_user_id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toEventOrganizerMember(row: EventOrganizerMemberRow): EventOrganizerMember {
    return {
      id: row.id,
      organizerId: row.organizer_id,
      globalUserId: row.global_user_id,
      role: row.role as OrganizerRole,
      createdAt: row.createdAt,
    };
  }

  /**
   * Verifica se usuário tem permissão (owner ou admin)
   */
  async hasPermission(
    tenantId: string,
    organizerId: string,
    globalUserId: string,
    requiredRoles: OrganizerRole[] = ['owner', 'admin']
  ): Promise<boolean> {
    // Buscar organizador
    const organizer = await this.getOrganizer(tenantId, organizerId);
    if (!organizer) {
      return false;
    }

    // Owner sempre tem permissão
    if (organizer.ownerGlobalUserId === globalUserId) {
      return true;
    }

    // Verificar se é membro com role adequada
    const member = await runQueryWithTenant<EventOrganizerMemberRow>(
      tenantId,
      `
      SELECT id, organizer_id, global_user_id, role, createdAt
      FROM event_organizer_members
      WHERE organizer_id = $1 AND global_user_id = $2
      LIMIT 1
      `,
      [organizerId, globalUserId]
    );

    if (!member) {
      return false;
    }

    return requiredRoles.includes(member.role as OrganizerRole);
  }

  /**
   * Cria um novo organizador
   */
  async createOrganizer(
    tenantId: string,
    input: CreateOrganizerInput,
    ownerGlobalUserId: string
  ): Promise<EventOrganizer> {
    const row = await runQueryWithTenant<EventOrganizerRow>(
      tenantId,
      `
      INSERT INTO event_organizers (
        tenant_id,
        name,
        description,
        logo_url,
        owner_global_user_id
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, tenant_id, name, description, logo_url, owner_global_user_id, createdAt, updatedAt
      `,
      [
        tenantId,
        input.name,
        input.description ?? null,
        input.logoUrl ?? null,
        ownerGlobalUserId,
      ]
    );

    if (!row) {
      throw new Error('Falha ao criar organizador');
    }

    const organizer = this.toEventOrganizer(row);

    // Adicionar owner como membro com role 'owner'
    await this.addMemberInternal(tenantId, organizer.id, ownerGlobalUserId, 'owner');

    return organizer;
  }

  /**
   * Adiciona membro a um organizador (método interno sem validação de permissão)
   */
  private async addMemberInternal(
    tenantId: string,
    organizerId: string,
    globalUserId: string,
    role: OrganizerRole
  ): Promise<EventOrganizerMember> {
    // Verificar se já é membro
    const existing = await runQueryWithTenant<EventOrganizerMemberRow>(
      tenantId,
      `
      SELECT id, organizer_id, global_user_id, role, createdAt
      FROM event_organizer_members
      WHERE organizer_id = $1 AND global_user_id = $2
      LIMIT 1
      `,
      [organizerId, globalUserId]
    );

    if (existing) {
      // Atualizar role se já existe
      const updated = await runQueryWithTenant<EventOrganizerMemberRow>(
        tenantId,
        `
        UPDATE event_organizer_members
        SET role = $1
        WHERE organizer_id = $2 AND global_user_id = $3
        RETURNING id, organizer_id, global_user_id, role, createdAt
        `,
        [role, organizerId, globalUserId]
      );
      return this.toEventOrganizerMember(updated!);
    }

    const row = await runQueryWithTenant<EventOrganizerMemberRow>(
      tenantId,
      `
      INSERT INTO event_organizer_members (organizer_id, global_user_id, role)
      VALUES ($1, $2, $3)
      RETURNING id, organizer_id, global_user_id, role, createdAt
      `,
      [organizerId, globalUserId, role]
    );

    if (!row) {
      throw new Error('Falha ao adicionar membro');
    }

    return this.toEventOrganizerMember(row);
  }

  /**
   * Adiciona membro a um organizador (com validação de permissão)
   */
  async addMember(
    tenantId: string,
    organizerId: string,
    input: AddOrganizerMemberInput,
    requesterGlobalUserId: string
  ): Promise<EventOrganizerMember> {
    if (requesterGlobalUserId == null || requesterGlobalUserId === '') {
      throw new Error('requesterGlobalUserId é obrigatório');
    }
    const globalUserId = input.globalUserId;
    if (globalUserId == null || globalUserId === '') {
      throw new Error('globalUserId é obrigatório');
    }
    const role = input.role ?? 'viewer';
    // Verificar permissão
    const hasPermission = await this.hasPermission(tenantId, organizerId, requesterGlobalUserId, ['owner', 'admin']);
    if (!hasPermission) {
      throw new Error('Apenas owner ou admin podem adicionar membros');
    }

    return this.addMemberInternal(tenantId, organizerId, globalUserId, role);
  }

  /**
   * Remove membro de um organizador
   */
  async removeMember(
    tenantId: string,
    organizerId: string,
    globalUserId: string,
    requesterGlobalUserId: string
  ): Promise<void> {
    // Verificar permissão
    const hasPermission = await this.hasPermission(tenantId, organizerId, requesterGlobalUserId, ['owner', 'admin']);
    if (!hasPermission) {
      throw new Error('Apenas owner ou admin podem remover membros');
    }

    // Não permitir remover owner
    const organizer = await this.getOrganizer(tenantId, organizerId);
    if (!organizer) {
      throw new Error('Organizador não encontrado');
    }

    if (organizer.ownerGlobalUserId === globalUserId) {
      throw new Error('Não é possível remover o owner do organizador');
    }

    await runQueryWithTenant(
      tenantId,
      `
      DELETE FROM event_organizer_members
      WHERE organizer_id = $1 AND global_user_id = $2
      `,
      [organizerId, globalUserId]
    );
  }

  /**
   * Busca organizador por ID
   */
  async getOrganizer(tenantId: string, organizerId: string): Promise<EventOrganizer | null> {
    const row = await runQueryWithTenant<EventOrganizerRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, description, logo_url, owner_global_user_id, createdAt, updatedAt
      FROM event_organizers
      WHERE id = $1
      LIMIT 1
      `,
      [organizerId]
    );

    return row ? this.toEventOrganizer(row) : null;
  }

  /**
   * Busca organizador com detalhes completos
   */
  async getOrganizerWithDetails(tenantId: string, organizerId: string): Promise<EventOrganizerWithDetails | null> {
    const organizer = await this.getOrganizer(tenantId, organizerId);
    if (!organizer) {
      return null;
    }

    // Buscar membros
    const membersRows = await runQueriesWithTenant<EventOrganizerMemberRow>(
      tenantId,
      `
      SELECT id, organizer_id, global_user_id, role, createdAt
      FROM event_organizer_members
      WHERE organizer_id = $1
      ORDER BY role ASC, createdAt ASC
      `,
      [organizerId]
    );

    // Contar eventos
    const eventCountRow = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM events
      WHERE organizer_id = $1
      `,
      [organizerId]
    );

    return {
      ...organizer,
      members: membersRows.map((r) => this.toEventOrganizerMember(r)),
      memberCount: membersRows.length,
      eventCount: eventCountRow ? Number(eventCountRow.count) : 0,
    };
  }

  /**
   * Lista organizadores
   */
  async listOrganizers(
    tenantId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<EventOrganizer[]> {
    const { limit = 50, offset = 0 } = options;

    const rows = await runQueriesWithTenant<EventOrganizerRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, description, logo_url, owner_global_user_id, createdAt, updatedAt
      FROM event_organizers
      ORDER BY createdAt DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    return rows.map((r) => this.toEventOrganizer(r));
  }

  /**
   * Vincula evento a um organizador
   */
  async linkEvent(
    tenantId: string,
    eventId: string,
    organizerId: string,
    requesterGlobalUserId: string
  ): Promise<void> {
    // Verificar se evento existe
    const event = await eventsService.getEvent(tenantId, eventId);
    if (!event) {
      throw new Error('Evento não encontrado');
    }

    // Verificar se organizador existe
    const organizer = await this.getOrganizer(tenantId, organizerId);
    if (!organizer) {
      throw new Error('Organizador não encontrado');
    }

    // Verificar permissão (owner ou admin do organizador)
    const hasPermission = await this.hasPermission(tenantId, organizerId, requesterGlobalUserId, ['owner', 'admin']);
    if (!hasPermission) {
      throw new Error('Apenas owner ou admin do organizador podem vincular eventos');
    }

    // Verificar se usuário é criador do evento ou tem permissão no organizador
    if (event.createdByGlobalUserId !== requesterGlobalUserId && !hasPermission) {
      throw new Error('Apenas o criador do evento ou membro autorizado do organizador podem vincular');
    }

    // Vincular evento
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE events
      SET organizer_id = $1
      WHERE id = $2
      `,
      [organizerId, eventId]
    );
  }
}

export const organizersService = new OrganizersService();


















