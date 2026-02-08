// backend/src/modules/human-mvp/human-mvp-skill.service.ts
// Service para Skills do Human MVP
// COMMIT 1: Criar Skill

import { pool } from '@core/database/pool';
import { categoriesService } from '@core/categories/categories.service';
import { CategoryRepository } from '@core/categories/categories.repository';
import { tenantContextPermissionService } from '@core/tenants/tenant-context-permission.service';
import type { CategoryContext } from '@unificard/contracts';

export interface CreateSkillInput {
  categoryId: string;
  context: CategoryContext;
  personId: string;
}

export interface SkillCreatedEvent {
  tenantId: string;
  personId: string;
  categoryId: string;
  context: CategoryContext;
  timestamp: Date;
}

class HumanMvpSkillService {
  private categoryRepository = new CategoryRepository();

  /**
   * Cria uma Skill vinculada a uma categoria
   * Validações obrigatórias:
   * - Categoria existe
   * - Context é permitido (person ou professional)
   * - Tenant tem permissão de write no context
   */
  async createSkill(
    input: CreateSkillInput,
    tenantId: string,
    globalUserId: string
  ): Promise<{ skillId: string }> {
    // VALIDAÇÃO 1: Categoria existe
    const category = await this.categoryRepository.findById(input.categoryId);
    if (!category) {
      throw new Error('Categoria não encontrada');
    }

    // VALIDAÇÃO 2: Context é permitido (person ou professional)
    if (input.context !== 'person' && input.context !== 'professional') {
      throw new Error('Context inválido. Apenas "person" ou "professional" são permitidos');
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

    // Criar Skill (usar tabela user_skills_categories existente)
    const result = await pool.query<{ id: string }>(
      `
      INSERT INTO user_skills_categories (global_user_id, category_id, createdAt, updatedAt)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (global_user_id, category_id)
      DO UPDATE SET updatedAt = NOW()
      RETURNING id
      `,
      [globalUserId, input.categoryId]
    );

    const skillId = result.rows[0].id;

    // Gerar e persistir evento SKILL_CREATED
    await this.recordSkillCreatedEvent({
      tenantId,
      personId: input.personId,
      categoryId: input.categoryId,
      context: input.context,
      timestamp: new Date(),
    });

    return { skillId };
  }

  /**
   * Registra evento SKILL_CREATED
   */
  private async recordSkillCreatedEvent(event: SkillCreatedEvent): Promise<void> {
    await pool.query(
      `
      INSERT INTO human_mvp_events (event_type, tenant_id, person_id, category_id, context, details, createdAt)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        'SKILL_CREATED',
        event.tenantId,
        event.personId,
        event.categoryId,
        event.context,
        JSON.stringify({}),
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

export const humanMvpSkillService = new HumanMvpSkillService();


