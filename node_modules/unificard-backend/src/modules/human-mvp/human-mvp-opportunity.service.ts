// backend/src/modules/human-mvp/human-mvp-opportunity.service.ts
// Service para Opportunities do Human MVP
// COMMIT 3: Publicar Opportunity

import { pool } from '@core/database/pool';
import { categoriesService } from '@core/categories/categories.service';
import { CategoryRepository } from '@core/categories/categories.repository';
import { tenantContextPermissionService } from '@core/tenants/tenant-context-permission.service';
import { humanMvpMatchingService } from './human-mvp-matching.service';
import type { CategoryContext } from '@unificard/contracts';

export interface CreateOpportunityInput {
  categoryId: string;
  context: CategoryContext;
  originType: 'person' | 'system' | 'government';
}

export interface OpportunityPublishedEvent {
  tenantId: string;
  originType: 'person' | 'system' | 'government';
  categoryId: string;
  context: CategoryContext;
  timestamp: Date;
}

class HumanMvpOpportunityService {
  private categoryRepository = new CategoryRepository();

  /**
   * Publica uma Opportunity vinculada a uma categoria existente
   * Validações obrigatórias:
   * - Categoria existe
   * - Context é permitido (professional, person ou interest)
   * - Tenant tem permissão de write no context
   * - Opportunity não depende de Skill nem ServiceOffer
   */
  async publishOpportunity(
    input: CreateOpportunityInput,
    tenantId: string
  ): Promise<{ opportunityId: string }> {
    // VALIDAÇÃO 1: Categoria existe
    const category = await this.categoryRepository.findById(input.categoryId);
    if (!category) {
      throw new Error('Categoria não encontrada');
    }

    // VALIDAÇÃO 2: Context é permitido (professional, person ou interest)
    const allowedContexts: CategoryContext[] = ['professional', 'person', 'interest'];
    if (!allowedContexts.includes(input.context)) {
      throw new Error('Context inválido. Apenas "professional", "person" ou "interest" são permitidos');
    }

    // VALIDAÇÃO 3: Tenant tem permissão de write no context
    const hasWriteAccess = await tenantContextPermissionService.hasWriteAccess(
      tenantId,
      input.context
    );
    if (!hasWriteAccess) {
      throw new Error(`CONTEXT_ACCESS_DENIED: Tenant ${tenantId} não tem permissão de escrita no context ${input.context}`);
    }

    // VALIDAÇÃO 4: Verificar se categoria pertence ao context correto
    // Usar getCategoriesForTenant para validar que a categoria existe no context
    const categories = await categoriesService.getCategoriesForTenant(tenantId, input.context);
    const categoryExists = this.findCategoryInTree(categories, input.categoryId);
    if (!categoryExists) {
      throw new Error(`Categoria ${input.categoryId} não existe no context ${input.context}`);
    }

    // VALIDAÇÃO 5: OriginType é válido
    const allowedOriginTypes: ('person' | 'system' | 'government')[] = ['person', 'system', 'government'];
    if (!allowedOriginTypes.includes(input.originType)) {
      throw new Error('OriginType inválido. Apenas "person", "system" ou "government" são permitidos');
    }

    // Criar Opportunity
    const result = await pool.query<{ id: string }>(
      `
      INSERT INTO human_mvp_opportunities (
        tenant_id, category_id, context, origin_type, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id
      `,
      [tenantId, input.categoryId, input.context, input.originType]
    );

    const opportunityId = result.rows[0].id;

    // Gerar e persistir evento OPPORTUNITY_PUBLISHED
    await this.recordOpportunityPublishedEvent({
      tenantId,
      originType: input.originType,
      categoryId: input.categoryId,
      context: input.context,
      timestamp: new Date(),
    });

    // COMMIT 4: Executar matching após OPPORTUNITY_PUBLISHED
    // Matching acontece SOMENTE após OPPORTUNITY_PUBLISHED
    try {
      await humanMvpMatchingService.executeMatching(
        opportunityId,
        input.categoryId,
        input.context,
        tenantId
      );
    } catch (error) {
      // Não falhar a criação da Opportunity se matching falhar
      // Apenas logar o erro
      console.error('[HumanMvpOpportunityService] Erro ao executar matching:', error);
    }

    return { opportunityId };
  }

  /**
   * Registra evento OPPORTUNITY_PUBLISHED
   */
  private async recordOpportunityPublishedEvent(event: OpportunityPublishedEvent): Promise<void> {
    await pool.query(
      `
      INSERT INTO human_mvp_events (
        event_type, tenant_id, person_id, category_id, context, details, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        'OPPORTUNITY_PUBLISHED',
        event.tenantId,
        null, // person_id é null para opportunities de system/government
        event.categoryId,
        event.context,
        JSON.stringify({ originType: event.originType }),
        event.timestamp,
      ]
    );
  }

  /**
   * Busca categoria na árvore recursivamente
   */
  private findCategoryInTree(
    tree: any[],
    categoryId: string
  ): boolean {
    for (const node of tree) {
      if (node.categoryId === categoryId) {
        return true;
      }
      if (node.children && node.children.length > 0) {
        if (this.findCategoryInTree(node.children, categoryId)) {
          return true;
        }
      }
    }
    return false;
  }
}

export const humanMvpOpportunityService = new HumanMvpOpportunityService();

