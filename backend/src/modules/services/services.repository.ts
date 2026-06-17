// src/modules/services/services.repository.ts
// Repository do Domínio de SERVIÇOS
// 🔴 BLINDAGEM: Nenhum service deve ser criado sem actor

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { Service, ServiceRow, CreateServiceInput, UpdateServiceInput } from './services.types';
import { ServiceType, ServiceStatus } from './services.types';

class ServicesRepository {
  /**
   * Converte ServiceRow para Service
   */
  private toService(row: ServiceRow): Service {
    return {
      serviceId: row.service_id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      shortDescription: row.short_description,
      serviceType: row.service_type as ServiceType,
      status: row.status as ServiceStatus,
      categoryId: row.category_id,
      canonicalServiceId: row.canonical_service_id,
      // price_cents é BIGINT (07 §4.7) — o driver pg devolve int8 como string; coage para number
      // preservando o contrato priceCents:number|null (sem global type-parser no projeto).
      priceCents: row.price_cents === null ? null : Number(row.price_cents),
      currency: row.currency,
      pricingType: row.pricing_type as any,
      countryId: row.country_id,
      stateId: row.state_id,
      cityId: row.city_id,
      neighborhood: row.neighborhood,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      activatedAt: row.activated_at,
    };
  }

  /**
   * Gera slug a partir do nome
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9]+/g, '-') // Substitui não-alfanuméricos por hífen
      .replace(/^-+|-+$/g, ''); // Remove hífens do início e fim
  }

  /**
   * Busca serviço por ID
   */
  async findById(tenantId: string, serviceId: string): Promise<Service | null> {
    const row = await runQueryWithTenant<ServiceRow>(
      tenantId,
      `
      SELECT 
        service_id, tenant_id, actor_id, name, slug, description, short_description,
        service_type, status, category_id, canonical_service_id, price_cents, currency, pricing_type,
        country_id, state_id, city_id, neighborhood, metadata,
        created_at, updated_at, activated_at
      FROM services
      WHERE service_id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [serviceId, tenantId]
    );

    if (!row) {
      return null;
    }

    return this.toService(row);
  }

  /**
   * Busca serviços por Actor
   * 🔴 BLINDAGEM: Nenhuma query deve usar serviço como filtro decisório
   */
  async findByActor(tenantId: string, actorId: string, filters?: { status?: ServiceStatus }): Promise<Service[]> {
    let query = `
      SELECT 
        service_id, tenant_id, actor_id, name, slug, description, short_description,
        service_type, status, category_id, canonical_service_id, price_cents, currency, pricing_type,
        country_id, state_id, city_id, neighborhood, metadata,
        created_at, updated_at, activated_at
      FROM services
      WHERE actor_id = $1 AND tenant_id = $2
    `;
    const params: any[] = [actorId, tenantId];

    if (filters?.status) {
      query += ` AND status = $3`;
      params.push(filters.status);
    }

    query += ` ORDER BY created_at DESC`;

    const rows = await runQueriesWithTenant<ServiceRow>(tenantId, query, params);

    return rows.map(this.toService);
  }

  /**
   * Cria novo serviço
   * 🔴 BLINDAGEM: actorId é OBRIGATÓRIO
   */
  async create(tenantId: string, input: CreateServiceInput): Promise<Service> {
    // 🔴 BLINDAGEM: Validar que actorId foi fornecido
    if (!input.actorId) {
      throw new Error('actorId é obrigatório para criar serviço');
    }

    // Gerar slug se não fornecido
    const slug = input.slug || this.generateSlug(input.name);

    // Verificar se slug já existe para este actor
    const existing = await runQueryWithTenant<{ service_id: string }>(
      tenantId,
      `
      SELECT service_id
      FROM services
      WHERE tenant_id = $1 AND actor_id = $2 AND slug = $3
      LIMIT 1
      `,
      [tenantId, input.actorId, slug]
    );

    if (existing) {
      throw new Error(`Serviço com slug '${slug}' já existe para este actor`);
    }

    const row = await runQueryWithTenant<ServiceRow>(
      tenantId,
      `
      INSERT INTO services (
        tenant_id, actor_id, name, slug, description, short_description,
        service_type, status, category_id, canonical_service_id, price_cents, currency, pricing_type,
        country_id, state_id, city_id, neighborhood, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING 
        service_id, tenant_id, actor_id, name, slug, description, short_description,
        service_type, status, category_id, canonical_service_id, price_cents, currency, pricing_type,
        country_id, state_id, city_id, neighborhood, metadata,
        created_at, updated_at, activated_at
      `,
      [
        tenantId,
        input.actorId,
        input.name,
        slug,
        input.description || null,
        input.shortDescription || null,
        input.serviceType || ServiceType.SERVICE,
        input.status || ServiceStatus.DRAFT,
        input.categoryId || null,
        input.canonicalServiceId || null,
        input.priceCents || null,
        input.currency || 'BRL',
        input.pricingType || null,
        input.countryId || null,
        input.stateId || null,
        input.cityId || null,
        input.neighborhood || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Falha ao criar serviço');
    }

    return this.toService(row);
  }

  /**
   * Busca serviços para descoberta com filtros explícitos
   * 🔴 BLINDAGEM: Apenas serviços com status = 'active'
   * 🔴 BLINDAGEM: Ordem determinística (created_at ASC) - SEM ranking ou score
   */
  async discoverServices(
    tenantId: string,
    filters: {
      categoryId?: string;
      cityId?: string;
      stateId?: string;
      countryId?: string;
      startDate?: Date;
      endDate?: Date;
      actorType?: 'user' | 'page' | 'group' | 'channel';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Service[]> {
    const conditions: string[] = ['s.tenant_id = $1', "s.status = 'active'"];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    // JOIN com actors para filtrar por actor_type
    let joinClause = '';
    if (filters.actorType) {
      joinClause = 'INNER JOIN actors a ON s.actor_id = a.actor_id AND a.tenant_id = s.tenant_id';
      conditions.push(`a.actor_type = $${paramIndex++}`);
      params.push(filters.actorType);
    }

    // Filtros de localização
    if (filters.categoryId) {
      conditions.push(`s.category_id = $${paramIndex++}`);
      params.push(filters.categoryId);
    }

    if (filters.cityId) {
      conditions.push(`s.city_id = $${paramIndex++}`);
      params.push(filters.cityId);
    }

    if (filters.stateId) {
      conditions.push(`s.state_id = $${paramIndex++}`);
      params.push(filters.stateId);
    }

    if (filters.countryId) {
      conditions.push(`s.country_id = $${paramIndex++}`);
      params.push(filters.countryId);
    }

    // Limite e offset
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const query = `
      SELECT 
        s.service_id, s.tenant_id, s.actor_id, s.name, s.slug, s.description, s.short_description,
        s.service_type, s.status, s.category_id, s.canonical_service_id, s.price_cents, s.currency, s.pricing_type,
        s.country_id, s.state_id, s.city_id, s.neighborhood, s.metadata,
        s.created_at, s.updated_at, s.activated_at
      FROM services s
      ${joinClause}
      WHERE ${conditions.join(' AND ')}
      ORDER BY s.created_at ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const rows = await runQueriesWithTenant<ServiceRow>(tenantId, query, params);
    return rows.map(this.toService);
  }

  /**
   * Atualiza serviço
   */
  async update(tenantId: string, serviceId: string, input: UpdateServiceInput): Promise<Service> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(input.description);
    }
    if (input.shortDescription !== undefined) {
      updates.push(`short_description = $${paramIndex++}`);
      params.push(input.shortDescription);
    }
    if (input.serviceType !== undefined) {
      updates.push(`service_type = $${paramIndex++}`);
      params.push(input.serviceType);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(input.status);
    }
    if (input.categoryId !== undefined) {
      updates.push(`category_id = $${paramIndex++}`);
      params.push(input.categoryId);
    }
    if (input.priceCents !== undefined) {
      updates.push(`price_cents = $${paramIndex++}`);
      params.push(input.priceCents);
    }
    if (input.currency !== undefined) {
      updates.push(`currency = $${paramIndex++}`);
      params.push(input.currency);
    }
    if (input.pricingType !== undefined) {
      updates.push(`pricing_type = $${paramIndex++}`);
      params.push(input.pricingType);
    }
    if (input.countryId !== undefined) {
      updates.push(`country_id = $${paramIndex++}`);
      params.push(input.countryId);
    }
    if (input.stateId !== undefined) {
      updates.push(`state_id = $${paramIndex++}`);
      params.push(input.stateId);
    }
    if (input.cityId !== undefined) {
      updates.push(`city_id = $${paramIndex++}`);
      params.push(input.cityId);
    }
    if (input.neighborhood !== undefined) {
      updates.push(`neighborhood = $${paramIndex++}`);
      params.push(input.neighborhood);
    }
    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(input.metadata));
    }

    if (updates.length === 0) {
      // Nenhuma atualização, retornar serviço atual
      return await this.findById(tenantId, serviceId) || (() => { throw new Error('Serviço não encontrado'); })();
    }

    updates.push('updated_at = NOW()');

    params.push(serviceId, tenantId);

    const row = await runQueryWithTenant<ServiceRow>(
      tenantId,
      `
      UPDATE services
      SET ${updates.join(', ')}
      WHERE service_id = $${paramIndex++} AND tenant_id = $${paramIndex++}
      RETURNING 
        service_id, tenant_id, actor_id, name, slug, description, short_description,
        service_type, status, category_id, canonical_service_id, price_cents, currency, pricing_type,
        country_id, state_id, city_id, neighborhood, metadata,
        created_at, updated_at, activated_at
      `,
      params
    );

    if (!row) {
      throw new Error('Serviço não encontrado');
    }

    return this.toService(row);
  }
}

export const servicesRepository = new ServicesRepository();



