"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizersService = void 0;
// src/modules/events/organizers/organizers.service.ts
const pool_1 = require("@core/database/pool");
const events_service_1 = require("../events.service");
class OrganizersService {
    toEventOrganizer(row) {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            name: row.name,
            description: row.description,
            logoUrl: row.logo_url,
            ownerGlobalUserId: row.owner_global_user_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    toEventOrganizerMember(row) {
        return {
            id: row.id,
            organizerId: row.organizer_id,
            globalUserId: row.global_user_id,
            role: row.role,
            createdAt: row.created_at,
        };
    }
    /**
     * Verifica se usuário tem permissão (owner ou admin)
     */
    async hasPermission(tenantId, organizerId, globalUserId, requiredRoles = ['owner', 'admin']) {
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
        const member = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT id, organizer_id, global_user_id, role, created_at
      FROM event_organizer_members
      WHERE organizer_id = $1 AND global_user_id = $2
      LIMIT 1
      `, [organizerId, globalUserId]);
        if (!member) {
            return false;
        }
        return requiredRoles.includes(member.role);
    }
    /**
     * Cria um novo organizador
     */
    async createOrganizer(tenantId, input, ownerGlobalUserId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO event_organizers (
        tenant_id,
        name,
        description,
        logo_url,
        owner_global_user_id
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, tenant_id, name, description, logo_url, owner_global_user_id, created_at, updated_at
      `, [
            tenantId,
            input.name,
            input.description ?? null,
            input.logoUrl ?? null,
            ownerGlobalUserId,
        ]);
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
    async addMemberInternal(tenantId, organizerId, globalUserId, role) {
        // Verificar se já é membro
        const existing = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT id, organizer_id, global_user_id, role, created_at
      FROM event_organizer_members
      WHERE organizer_id = $1 AND global_user_id = $2
      LIMIT 1
      `, [organizerId, globalUserId]);
        if (existing) {
            // Atualizar role se já existe
            const updated = await (0, pool_1.runQueryWithTenant)(tenantId, `
        UPDATE event_organizer_members
        SET role = $1
        WHERE organizer_id = $2 AND global_user_id = $3
        RETURNING id, organizer_id, global_user_id, role, created_at
        `, [role, organizerId, globalUserId]);
            return this.toEventOrganizerMember(updated);
        }
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO event_organizer_members (organizer_id, global_user_id, role)
      VALUES ($1, $2, $3)
      RETURNING id, organizer_id, global_user_id, role, created_at
      `, [organizerId, globalUserId, role]);
        if (!row) {
            throw new Error('Falha ao adicionar membro');
        }
        return this.toEventOrganizerMember(row);
    }
    /**
     * Adiciona membro a um organizador (com validação de permissão)
     */
    async addMember(tenantId, organizerId, input, requesterGlobalUserId) {
        // Verificar permissão
        const hasPermission = await this.hasPermission(tenantId, organizerId, requesterGlobalUserId, ['owner', 'admin']);
        if (!hasPermission) {
            throw new Error('Apenas owner ou admin podem adicionar membros');
        }
        return this.addMemberInternal(tenantId, organizerId, input.globalUserId, input.role);
    }
    /**
     * Remove membro de um organizador
     */
    async removeMember(tenantId, organizerId, globalUserId, requesterGlobalUserId) {
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
        await (0, pool_1.runQueryWithTenant)(tenantId, `
      DELETE FROM event_organizer_members
      WHERE organizer_id = $1 AND global_user_id = $2
      `, [organizerId, globalUserId]);
    }
    /**
     * Busca organizador por ID
     */
    async getOrganizer(tenantId, organizerId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT id, tenant_id, name, description, logo_url, owner_global_user_id, created_at, updated_at
      FROM event_organizers
      WHERE id = $1
      LIMIT 1
      `, [organizerId]);
        return row ? this.toEventOrganizer(row) : null;
    }
    /**
     * Busca organizador com detalhes completos
     */
    async getOrganizerWithDetails(tenantId, organizerId) {
        const organizer = await this.getOrganizer(tenantId, organizerId);
        if (!organizer) {
            return null;
        }
        // Buscar membros
        const membersRows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT id, organizer_id, global_user_id, role, created_at
      FROM event_organizer_members
      WHERE organizer_id = $1
      ORDER BY role ASC, created_at ASC
      `, [organizerId]);
        // Contar eventos
        const eventCountRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT COUNT(*) as count
      FROM events
      WHERE organizer_id = $1
      `, [organizerId]);
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
    async listOrganizers(tenantId, options = {}) {
        const { limit = 50, offset = 0 } = options;
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT id, tenant_id, name, description, logo_url, owner_global_user_id, created_at, updated_at
      FROM event_organizers
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
      `, [limit, offset]);
        return rows.map((r) => this.toEventOrganizer(r));
    }
    /**
     * Vincula evento a um organizador
     */
    async linkEvent(tenantId, eventId, organizerId, requesterGlobalUserId) {
        // Verificar se evento existe
        const event = await events_service_1.eventsService.getEvent(tenantId, eventId);
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
        await (0, pool_1.runQueryWithTenant)(tenantId, `
      UPDATE events
      SET organizer_id = $1
      WHERE id = $2
      `, [organizerId, eventId]);
    }
}
exports.organizersService = new OrganizersService();
