"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventsService = void 0;
// src/modules/events/events.service.ts
const pool_1 = require("@core/database/pool");
const tenant_service_1 = require("@core/tenants/tenant.service");
const world_service_1 = require("@core/world/services/world.service");
const reputation_service_1 = require("@core/reputation/reputation.service");
const occupancy_service_1 = require("./occupancy.service");
class EventsService {
    toEvent(row) {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            title: row.title,
            description: row.description,
            startTime: row.starts_at,
            endTime: row.ends_at,
            datetimeStart: row.datetime_start || row.starts_at,
            datetimeEnd: row.datetime_end || row.ends_at,
            locationName: row.location_name || null,
            capacity: row.capacity || null,
            cityId: row.city_id,
            stateId: row.state_id,
            countryId: row.country_id,
            createdByGlobalUserId: row.created_by_global_user_id,
            createdByActorId: row.created_by_actor_id || null,
            eventType: row.event_type,
            ticketPrice: row.ticket_price,
            acceptsConsumption: row.accepts_consumption,
            acceptsParking: row.accepts_parking,
            maxCapacity: row.max_capacity,
            currentOccupancy: row.current_occupancy,
            status: (row.status || 'draft'),
            timezone: row.timezone,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
    toEventSession(row) {
        return {
            id: row.id,
            eventId: row.event_id,
            name: row.name,
            startTime: row.starts_at,
            endTime: row.ends_at,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
    toEventLocation(row) {
        return {
            id: row.id,
            eventId: row.event_id,
            name: row.name,
            capacity: row.capacity,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
    toEventStaff(row) {
        return {
            id: row.id,
            eventId: row.event_id,
            globalUserId: row.global_user_id,
            role: row.role,
            assignedByGlobalUserId: row.assigned_by_global_user_id,
            createdAt: row.createdAt,
        };
    }
    toEventAttendee(row) {
        return {
            id: row.id,
            eventId: row.event_id,
            globalUserId: row.global_user_id,
            checkInTime: row.checked_in_at,
            createdAt: row.createdAt,
        };
    }
    /**
     * Cria um novo evento
     */
    async createEvent(tenantId, input, createdByGlobalUserId) {
        // Obter região do tenant como fallback
        const tenant = await tenant_service_1.tenantService.getTenantById(tenantId);
        let finalCityId = input.cityId ?? tenant?.cityId ?? null;
        let finalStateId = input.stateId ?? null;
        let finalCountryId = input.countryId ?? null;
        // Se cityId foi fornecido, validar e obter stateId/countryId automaticamente
        if (finalCityId) {
            const cityPath = await world_service_1.worldService.getCityFullPath(finalCityId);
            if (!cityPath) {
                throw new Error('Cidade não encontrada');
            }
            finalStateId = cityPath.state.stateId;
            finalCountryId = cityPath.country.countryId;
        }
        else if (finalStateId) {
            // Se stateId foi fornecido, validar e obter countryId automaticamente
            const state = await world_service_1.worldService.getStateById(finalStateId);
            if (!state) {
                throw new Error('Estado não encontrado');
            }
            finalCountryId = state.countryId;
        }
        else if (finalCountryId) {
            // Validar se país existe
            const country = await world_service_1.worldService.getCountryById(finalCountryId);
            if (!country) {
                throw new Error('País não encontrado');
            }
        }
        else if (tenant?.cityId) {
            // Usar região do tenant
            const cityPath = await world_service_1.worldService.getCityFullPath(tenant.cityId);
            if (cityPath) {
                finalCityId = cityPath.city.cityId;
                finalStateId = cityPath.state.stateId;
                finalCountryId = cityPath.country.countryId;
            }
        }
        // Validar hierarquia se todos os campos foram fornecidos
        if (finalStateId && finalCountryId) {
            const state = await world_service_1.worldService.getStateById(finalStateId);
            if (!state || state.countryId !== finalCountryId) {
                throw new Error('Estado não pertence ao país especificado');
            }
        }
        if (finalCityId && finalStateId) {
            const city = await world_service_1.worldService.getCityById(finalCityId);
            if (!city || city.stateId !== finalStateId) {
                throw new Error('Cidade não pertence ao estado especificado');
            }
        }
        // Validar que endTime > startTime
        if (input.endTime <= input.startTime) {
            throw new Error('Data/hora de fim deve ser posterior à data/hora de início');
        }
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO events (
        tenant_id,
        title,
        description,
        starts_at,
        ends_at,
        city_id,
        state_id,
        country_id,
        created_by_global_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, tenant_id, title, description, starts_at, ends_at, city_id, state_id, country_id, created_by_global_user_id, createdAt, updatedAt
      `, [
            tenantId,
            input.title,
            input.description ?? null,
            input.startTime,
            input.endTime,
            finalCityId,
            finalStateId,
            finalCountryId,
            createdByGlobalUserId,
        ]);
        if (!row) {
            throw new Error('Falha ao criar evento');
        }
        const event = this.toEvent(row);
        // Se houver group_id, criar relacionamento na tabela group_events
        // 🔴 FASE 2: group_events.startsAt/endsAt são READ-MODEL ou INPUT declarativo, não verdade temporal
        // A verdade temporal está em Unified Availability (criada via event.service.ts)
        if (input.group_id) {
            try {
                // Verificar se já existe relacionamento (evitar duplicata)
                const existing = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT event_id FROM group_events WHERE event_id = $1 AND tenant_id = $2 LIMIT 1`, [event.id, tenantId]);
                if (!existing) {
                    // 🔴 FASE 2: startsAt/endsAt aqui são apenas READ-MODEL para visualização
                    // Não bloqueiam agenda, não resolvem conflito, não criam booking
                    await (0, pool_1.runQueryWithTenant)(tenantId, `
            INSERT INTO group_events (
              event_id, group_id, tenant_id, title, description, startsAt, endsAt, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                        event.id,
                        input.group_id,
                        tenantId,
                        input.title,
                        input.description ?? null,
                        input.startTime,
                        input.endTime,
                        createdByGlobalUserId,
                    ]);
                }
                // Publicar evento automaticamente no feed com actionType = event
                try {
                    const { actorRepository } = await Promise.resolve().then(() => __importStar(require('@modules/social/actor.repository')));
                    const { social2Service } = await Promise.resolve().then(() => __importStar(require('@modules/social/social-2.0.service')));
                    // Buscar userId do globalUserId
                    const userResult = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT user_id FROM users WHERE global_user_id = $1 AND tenant_id = $2 LIMIT 1`, [createdByGlobalUserId, tenantId]);
                    if (userResult) {
                        const actor = await actorRepository.findOrCreateUserActor(tenantId, userResult.user_id);
                        if (actor) {
                            // Criar post no feed anunciando o evento
                            await social2Service.createPost(tenantId, userResult.user_id, createdByGlobalUserId, `🎉 Novo evento: ${input.title}${input.description ? `\n\n${input.description}` : ''}`, actor.actor_id, [], 'event', // Intent = event
                            {
                                eventId: event.id,
                                eventTitle: input.title,
                                eventStartTime: input.startTime.toISOString(),
                                eventEndTime: input.endTime.toISOString(),
                            }, undefined, // targeting
                            undefined, // cta
                            input.group_id // groupId para vincular ao grupo
                            );
                        }
                    }
                }
                catch (feedError) {
                    // Log mas não quebra criação do evento
                    console.error('Erro ao publicar evento no feed:', feedError);
                }
            }
            catch (err) {
                // Log mas não quebra criação do evento
                console.error('Erro ao vincular evento ao grupo:', err);
            }
        }
        // Se houver metadata com modelo de ocupação, criar
        if (input.metadata?.occupancy_model) {
            const occupancyData = input.metadata.occupancy_model;
            try {
                await occupancy_service_1.occupancyService.createOrUpdateOccupancyModel(tenantId, {
                    event_id: event.id,
                    occupancy_type: occupancyData.type,
                    requires_reservation: occupancyData.requires_reservation ?? false,
                    reservation_price_cents: occupancyData.reservation_price,
                    config: occupancyData.config || {},
                });
            }
            catch (err) {
                // Log mas não quebra criação do evento
                console.error('Erro ao criar modelo de ocupação:', err);
            }
        }
        return event;
    }
    /**
     * Adiciona uma sessão a um evento
     */
    async addSession(tenantId, eventId, input) {
        // Verificar se evento existe
        const event = await this.getEvent(tenantId, eventId);
        if (!event) {
            throw new Error('Evento não encontrado');
        }
        // Validar que endTime > startTime
        if (input.endTime <= input.startTime) {
            throw new Error('Data/hora de fim deve ser posterior à data/hora de início');
        }
        // Validar que sessão está dentro do período do evento
        if (input.startTime < event.startTime || input.endTime > event.endTime) {
            throw new Error('Sessão deve estar dentro do período do evento');
        }
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO event_sessions (event_id, name, starts_at, ends_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id, event_id, name, starts_at, ends_at, createdAt, updatedAt
      `, [eventId, input.name, input.startTime, input.endTime]);
        if (!row) {
            throw new Error('Falha ao criar sessão');
        }
        return this.toEventSession(row);
    }
    /**
     * Designa staff para um evento
     */
    async assignStaff(tenantId, eventId, input, assignedByGlobalUserId) {
        // Verificar se evento existe
        const event = await this.getEvent(tenantId, eventId);
        if (!event) {
            throw new Error('Evento não encontrado');
        }
        // Validar reputação mínima (exemplo: score >= 3.0)
        const reputation = await reputation_service_1.reputationService.getScoreByGlobalUserId(input.globalUserId);
        if (!reputation || reputation.scores.global < 3.0) {
            throw new Error('Usuário não possui reputação suficiente para ser designado como staff');
        }
        // Verificar se já está designado
        const existing = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT id, event_id, global_user_id, role, assigned_by_global_user_id, createdAt
      FROM event_staff
      WHERE event_id = $1 AND global_user_id = $2
      LIMIT 1
      `, [eventId, input.globalUserId]);
        if (existing) {
            throw new Error('Usuário já está designado como staff deste evento');
        }
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO event_staff (event_id, global_user_id, role, assigned_by_global_user_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, event_id, global_user_id, role, assigned_by_global_user_id, createdAt
      `, [eventId, input.globalUserId, input.role, assignedByGlobalUserId]);
        if (!row) {
            throw new Error('Falha ao designar staff');
        }
        return this.toEventStaff(row);
    }
    /**
     * Realiza check-in de um participante
     */
    async checkIn(tenantId, eventId, globalUserId) {
        // Verificar se evento existe e está ativo
        const event = await this.getEvent(tenantId, eventId);
        if (!event) {
            throw new Error('Evento não encontrado');
        }
        if (event.status === 'cancelled' || event.status === 'completed' || event.status === 'archived') {
            throw new Error(`Evento com status '${event.status}' não aceita check-in`);
        }
        // Verificar se já está inscrito
        const existing = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT id, event_id, global_user_id, checked_in_at, createdAt
      FROM event_attendees
      WHERE event_id = $1 AND global_user_id = $2
      LIMIT 1
      `, [eventId, globalUserId]);
        if (!existing) {
            // Criar registro de participante
            await (0, pool_1.runQueryWithTenant)(tenantId, `
        INSERT INTO event_attendees (event_id, global_user_id, checked_in_at)
        VALUES ($1, $2, now())
        RETURNING id, event_id, global_user_id, checked_in_at, createdAt
        `, [eventId, globalUserId]);
        }
        else if (!existing.checked_in_at) {
            // Atualizar check-in
            await (0, pool_1.runQueryWithTenant)(tenantId, `
        UPDATE event_attendees
        SET checked_in_at = now()
        WHERE event_id = $1 AND global_user_id = $2
        RETURNING id, event_id, global_user_id, checked_in_at, createdAt
        `, [eventId, globalUserId]);
        }
        // Buscar registro atualizado
        const updated = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT id, event_id, global_user_id, checked_in_at, createdAt
      FROM event_attendees
      WHERE event_id = $1 AND global_user_id = $2
      LIMIT 1
      `, [eventId, globalUserId]);
        if (!updated || !updated.checked_in_at) {
            throw new Error('Falha ao realizar check-in');
        }
        return {
            checkedIn: true,
            checkInTime: updated.checked_in_at,
        };
    }
    /**
     * Busca um evento por ID
     */
    async getEvent(tenantId, eventId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT 
        id, tenant_id, title, description, starts_at, ends_at, 
        city_id, state_id, country_id, created_by_global_user_id, 
        event_type, ticket_price, accepts_consumption, accepts_parking,
        max_capacity, current_occupancy, status, timezone,
        createdAt, updatedAt
      FROM events
      WHERE id = $1
      LIMIT 1
      `, [eventId]);
        return row ? this.toEvent(row) : null;
    }
    /**
     * Busca evento com detalhes completos
     */
    async getEventWithDetails(tenantId, eventId) {
        const event = await this.getEvent(tenantId, eventId);
        if (!event) {
            return null;
        }
        // Buscar sessões
        const sessionsRows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT id, event_id, name, starts_at, ends_at, createdAt, updatedAt
      FROM event_sessions
      WHERE event_id = $1
      ORDER BY starts_at ASC
      `, [eventId]);
        // Buscar locais
        const locationsRows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT id, event_id, name, capacity, createdAt, updatedAt
      FROM event_locations
      WHERE event_id = $1
      ORDER BY name ASC
      `, [eventId]);
        // Buscar staff
        const staffRows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT id, event_id, global_user_id, role, assigned_by_global_user_id, createdAt
      FROM event_staff
      WHERE event_id = $1
      ORDER BY role ASC, createdAt ASC
      `, [eventId]);
        // Contar participantes
        const attendeeCountRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT COUNT(*) as count
      FROM event_attendees
      WHERE event_id = $1
      `, [eventId]);
        // Contar check-ins
        const checkedInCountRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT COUNT(*) as count
      FROM event_attendees
      WHERE event_id = $1 AND checked_in_at IS NOT NULL
      `, [eventId]);
        return {
            ...event,
            sessions: sessionsRows.map((r) => this.toEventSession(r)),
            locations: locationsRows.map((r) => this.toEventLocation(r)),
            staff: staffRows.map((r) => this.toEventStaff(r)),
            attendeeCount: attendeeCountRow ? Number(attendeeCountRow.count) : 0,
            checkedInCount: checkedInCountRow ? Number(checkedInCountRow.count) : 0,
        };
    }
    /**
     * Busca posts relacionados ao evento
     */
    async getEventPosts(tenantId, eventId, limit = 20) {
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT 
        post_id,
        content,
        type,
        createdAt,
        global_user_id,
        media,
        metadata
      FROM posts
      WHERE tenant_id = $1
        AND event_id = $2
        AND visibility = 'PUBLIC'
      ORDER BY createdAt DESC
      LIMIT $3
      `, [tenantId, eventId, limit]);
        return rows.map((row) => ({
            postId: row.post_id,
            content: row.content,
            type: row.type,
            createdAt: row.createdAt,
            globalUserId: row.global_user_id,
            media: Array.isArray(row.media) ? row.media : [],
            metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
        }));
    }
    /**
     * Busca participantes do evento (com informações básicas)
     */
    async getEventParticipants(tenantId, eventId, limit = 50) {
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT 
        id,
        event_id,
        global_user_id,
        checked_in_at,
        createdAt
      FROM event_attendees
      WHERE event_id = $1
      ORDER BY createdAt DESC
      LIMIT $2
      `, [eventId, limit]);
        return rows.map((row) => ({
            globalUserId: row.global_user_id,
            checkInTime: row.checked_in_at,
            joinedAt: row.createdAt,
        }));
    }
    /**
     * Busca eventos com filtros
     */
    async searchEvents(tenantId, options = {}) {
        const { cityId, stateId, countryId, startDate, endDate, limit = 50, offset = 0, } = options;
        let query = `
      SELECT id, tenant_id, title, description, starts_at, ends_at, city_id, state_id, country_id, created_by_global_user_id, createdAt, updatedAt
      FROM events
      WHERE 1=1
    `;
        const params = [];
        let paramIndex = 1;
        if (cityId) {
            query += ` AND city_id = $${paramIndex}`;
            params.push(cityId);
            paramIndex++;
        }
        if (stateId) {
            query += ` AND state_id = $${paramIndex}`;
            params.push(stateId);
            paramIndex++;
        }
        if (countryId) {
            query += ` AND country_id = $${paramIndex}`;
            params.push(countryId);
            paramIndex++;
        }
        if (startDate) {
            query += ` AND starts_at >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        if (endDate) {
            query += ` AND ends_at <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        query += ` ORDER BY starts_at ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, query, params);
        return rows.map((r) => this.toEvent(r));
    }
}
exports.eventsService = new EventsService();
