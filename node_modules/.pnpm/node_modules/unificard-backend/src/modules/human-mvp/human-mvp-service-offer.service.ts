// backend/src/modules/human-mvp/human-mvp-service-offer.service.ts
// Service para ServiceOffers do Human MVP
// COMMIT 2: Criar ServiceOffer

import { pool } from '@core/database/pool';
import { tenantContextPermissionService } from '@core/tenants/tenant-context-permission.service';
import type { CategoryContext } from '@unificard/contracts';

export interface CreateServiceOfferInput {
  skillId: string;
  personId: string;
  context: CategoryContext; // OBRIGATÓRIO: context deve ser explícito
}

export interface ServiceOfferCreatedEvent {
  tenantId: string;
  personId: string;
  skillId: string;
  categoryId: string;
  context: CategoryContext;
  timestamp: Date;
}

class HumanMvpServiceOfferService {
  /**
   * Cria uma ServiceOffer vinculada a uma Skill existente
   * Validações obrigatórias:
   * - Skill existe
   * - Skill é válida
   * - Context é obrigatoriamente professional
   * - Tenant tem permissão de write no context professional
   * - Categoria é herdada da Skill (não redefinível)
   */
  async createServiceOffer(
    input: CreateServiceOfferInput,
    tenantId: string
  ): Promise<{ serviceOfferId: string }> {
    // VALIDAÇÃO 1: Skill existe
    const skillResult = await pool.query<{
      id: string;
      global_user_id: string;
      category_id: string;
    }>(
      `SELECT id, global_user_id, category_id 
       FROM user_skills_categories 
       WHERE id = $1 
       LIMIT 1`,
      [input.skillId]
    );

    if (skillResult.rows.length === 0) {
      throw new Error('Skill não encontrada');
    }

    const skill = skillResult.rows[0];

    // VALIDAÇÃO 2: Skill pertence ao mesmo personId
    if (skill.global_user_id !== input.personId) {
      throw new Error('Skill não pertence à pessoa especificada');
    }

    // VALIDAÇÃO 3: Context é obrigatório e deve ser fornecido explicitamente
    if (!input.context) {
      throw new Error('context é obrigatório');
    }
    const context: CategoryContext = input.context;

    // VALIDAÇÃO 4: Tenant tem permissão de write no context professional
    const hasWriteAccess = await tenantContextPermissionService.hasWriteAccess(
      tenantId,
      context
    );
    if (!hasWriteAccess) {
      throw new Error(`CONTEXT_ACCESS_DENIED: Tenant ${tenantId} não tem permissão de escrita no context ${context}`);
    }

    // Criar ServiceOffer (categoria herdada da Skill)
    const result = await pool.query<{ id: string }>(
      `
      INSERT INTO human_mvp_service_offers (
        tenant_id, person_id, skill_id, category_id, context, createdAt, updatedAt
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id
      `,
      [tenantId, input.personId, input.skillId, skill.category_id, context]
    );

    const serviceOfferId = result.rows[0].id;

    // Gerar e persistir evento SERVICE_OFFER_CREATED
    await this.recordServiceOfferCreatedEvent({
      tenantId,
      personId: input.personId,
      skillId: input.skillId,
      categoryId: skill.category_id,
      context,
      timestamp: new Date(),
    });

    return { serviceOfferId };
  }

  /**
   * Registra evento SERVICE_OFFER_CREATED
   */
  private async recordServiceOfferCreatedEvent(event: ServiceOfferCreatedEvent): Promise<void> {
    await pool.query(
      `
      INSERT INTO human_mvp_events (
        event_type, tenant_id, person_id, category_id, context, details, createdAt
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        'SERVICE_OFFER_CREATED',
        event.tenantId,
        event.personId,
        event.categoryId,
        event.context,
        JSON.stringify({ skillId: event.skillId }),
        event.timestamp,
      ]
    );
  }
}

export const humanMvpServiceOfferService = new HumanMvpServiceOfferService();



