// src/modules/social/social-action-tracking.service.ts
// NOTE: Repository não existe ainda, comentando import temporariamente
// import { SocialActionTrackingRepository } from './social-action-tracking.repository';
import type { SuggestedAction as PostAction } from './social.types';

export class SocialActionTrackingService {
  // NOTE: Repository não existe ainda, métodos serão implementados quando repository estiver disponível
  // private repository = new SocialActionTrackingRepository();

  /**
   * Registra execução de uma action
   */
  async trackAction(data: {
    tenantId: string;
    globalUserId: string;
    postId: string;
    actionId: string;
    actionType?: string;
    outcome: 'success' | 'cancel' | 'error' | 'pending';
    metadata?: any;
  }): Promise<void> {
    // TODO: Implementar quando repository estiver disponível
    // await this.repository.trackAction(data);
  }

  /**
   * Atualiza estado de uma action
   */
  async setActionState(data: {
    tenantId: string;
    globalUserId: string;
    postId: string;
    actionId: string;
    state: 'pending' | 'completed' | 'dismissed';
    metadata?: any;
  }): Promise<void> {
    // TODO: Implementar quando repository estiver disponível
    // await this.repository.setActionState(data);
  }

  /**
   * Enriquece actions com estados do usuário
   */
  async enrichActionsWithStates(
    tenantId: string,
    globalUserId: string,
    posts: Array<{ postId: string; actions?: PostAction[] }>
  ): Promise<void> {
    if (posts.length === 0) {
      return;
    }

    // TODO: Implementar quando repository estiver disponível
    // TODO: Implementar quando repository estiver disponível
    // const postIds = posts.map(p => p.postId);
    const statesMap = new Map<string, Map<string, any>>(); // await this.repository.getActionStates(tenantId, globalUserId, postIds);

    // Adicionar estado às actions
    for (const post of posts) {
      if (!post.actions || post.actions.length === 0) {
        continue;
      }

      const postStates = statesMap.get(post.postId);
      if (postStates) {
        for (const action of post.actions) {
          // NOTE: SuggestedAction não tem 'id', usando 'action' como chave
          const actionKey = (action as any).id || (action as any).action || '';
          const state = postStates.get(actionKey);
          if (state) {
            // Adicionar estado à action (sem modificar a interface PostAction)
            (action as any).state = state;
          }
        }
      }
    }
  }

  /**
   * Calcula pesos adaptativos para tipos de post baseado em histórico
   */
  async calculatePostTypeWeights(
    tenantId: string,
    globalUserId: string
  ): Promise<Map<string, number>> {
    // TODO: Implementar quando repository estiver disponível
    const stats: Array<{ postType: string; actionCount: number; successCount: number; cancelCount: number }> = []; // await this.repository.getPostTypeActionStats(tenantId, globalUserId, 30);

    const weights = new Map<string, number>();

    // Calcular peso baseado em:
    // - Número de actions executadas (mais = maior peso)
    // - Taxa de sucesso (mais sucesso = maior peso)
    // - Reduzir peso se muitas ações foram canceladas

    let totalActions = 0;
    for (const stat of stats) {
      totalActions += stat.actionCount;
    }

    if (totalActions === 0) {
      // Se não há histórico, retornar pesos neutros
      return weights;
    }

    for (const stat of stats) {
      const actionRate = stat.actionCount / totalActions;
      const successRate = stat.actionCount > 0 ? stat.successCount / stat.actionCount : 0;
      const cancelRate = stat.actionCount > 0 ? stat.cancelCount / stat.actionCount : 0;

      // Peso = taxa de ações * (taxa de sucesso - taxa de cancelamento)
      // Valores entre 0 e 1, onde 1 = muito relevante
      const weight = actionRate * (successRate - cancelRate * 0.5);
      weights.set(stat.postType, Math.max(0, Math.min(1, weight)));
    }

    return weights;
  }
}

export const socialActionTrackingService = new SocialActionTrackingService();

