// backend/src/modules/human-mvp/human-mvp-matching.service.ts
// Service para Matching do Human MVP
// COMMIT 4: Matching por categoria

import { pool } from '@core/database/pool';
import { categoriesService } from '@core/categories/categories.service';
import type { CategoryContext } from '@unificard/contracts';

export interface MatchFoundEvent {
  tenantId: string;
  opportunityId: string;
  matchedPersonIds: string[];
  categoryId: string;
  context: CategoryContext;
  timestamp: Date;
}

class HumanMvpMatchingService {
  /**
   * Executa matching entre Opportunity e Skills/ServiceOffers
   * Matching baseado EXCLUSIVAMENTE em categoria + context
   * 
   * Regras:
   * - Busca Skills com mesma categoria e context
   * - Busca ServiceOffers com mesma categoria e context
   * - Retorna lista de personIds que têm match
   */
  async findMatches(
    opportunityId: string,
    categoryId: string,
    context: CategoryContext,
    tenantId: string
  ): Promise<string[]> {
    // VALIDAÇÃO 1: Opportunity existe
    const opportunityResult = await pool.query<{ id: string }>(
      `SELECT id FROM human_mvp_opportunities WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [opportunityId, tenantId]
    );

    if (opportunityResult.rows.length === 0) {
      throw new Error('Opportunity não encontrada');
    }

    // VALIDAÇÃO 2: Categoria existe
    const categoryResult = await pool.query<{ category_id: string }>(
      `SELECT category_id FROM categories WHERE category_id = $1 LIMIT 1`,
      [categoryId]
    );

    if (categoryResult.rows.length === 0) {
      throw new Error('Categoria inválida');
    }

    // VALIDAÇÃO 3: Context é válido
    const allowedContexts: CategoryContext[] = ['professional', 'person', 'interest'];
    if (!allowedContexts.includes(context)) {
      throw new Error('Context incompatível');
    }

    // MATCHING: Buscar Skills com mesma categoria e context
    // Skills estão em user_skills_categories
    // Para validar context, preciso verificar se a categoria existe no context usando SSOT
    // Buscar Skills com a categoria e validar que a categoria existe no context
    const skillsResult = await pool.query<{ global_user_id: string }>(
      `
      SELECT DISTINCT usc.global_user_id
      FROM user_skills_categories usc
      WHERE usc.category_id = $1
      `,
      [categoryId]
    );

    const matchedPersonIds = new Set<string>();

    // Validar que a categoria existe no context usando SSOT
    // Se não existir, não há matches de Skills para este context
    const categories = await categoriesService.getCategoriesForTenant(tenantId, context);
    const categoryExists = this.findCategoryInTree(categories, categoryId);

    // Adicionar personIds de Skills apenas se categoria existe no context
    if (categoryExists) {
      skillsResult.rows.forEach(row => {
        matchedPersonIds.add(row.global_user_id);
      });
    }

    // MATCHING: Buscar ServiceOffers com mesma categoria e context
    // ServiceOffers já têm context = 'professional' fixo
    // Se context da Opportunity for 'professional', buscar ServiceOffers
    if (context === 'professional') {
      const serviceOffersResult = await pool.query<{ person_id: string }>(
        `
        SELECT DISTINCT so.person_id
        FROM human_mvp_service_offers so
        WHERE so.category_id = $1
          AND so.context = $2
          AND so.tenant_id = $3
        `,
        [categoryId, context, tenantId]
      );

      serviceOffersResult.rows.forEach(row => {
        matchedPersonIds.add(row.person_id);
      });
    }

    return Array.from(matchedPersonIds);
  }

  /**
   * Executa matching e registra evento MATCH_FOUND
   */
  async executeMatching(
    opportunityId: string,
    categoryId: string,
    context: CategoryContext,
    tenantId: string
  ): Promise<void> {
    // Executar matching
    const matchedPersonIds = await this.findMatches(opportunityId, categoryId, context, tenantId);

    // Registrar evento MATCH_FOUND
    await this.recordMatchFoundEvent({
      tenantId,
      opportunityId,
      matchedPersonIds,
      categoryId,
      context,
      timestamp: new Date(),
    });
  }

  /**
   * Registra evento MATCH_FOUND
   */
  private async recordMatchFoundEvent(event: MatchFoundEvent): Promise<void> {
    await pool.query(
      `
      INSERT INTO human_mvp_events (
        event_type, tenant_id, person_id, category_id, context, details, createdAt
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        'MATCH_FOUND',
        event.tenantId,
        null, // person_id é null para eventos de matching
        event.categoryId,
        event.context,
        JSON.stringify({
          opportunityId: event.opportunityId,
          matchedPersonIds: event.matchedPersonIds,
        }),
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

export const humanMvpMatchingService = new HumanMvpMatchingService();


