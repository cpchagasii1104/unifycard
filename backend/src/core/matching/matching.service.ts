// src/core/matching/matching.service.ts
// Serviço de Matching Humano - conexão por momento de vida

import { profileInferenceService } from '../profile/profile-inference.service';
import type { MatchResult, MatchSuggestion, MatchType, MatchUser } from './matching.types';

class MatchingService {
  /**
   * Gera sugestões de matching baseadas no estado e afinidade
   */
  async getMatchingSuggestions(
    tenantId: string,
    userId: string,
    limit: number = 5
  ): Promise<MatchResult> {
    // Buscar inferências do usuário atual
    const userInferences = await profileInferenceService.getInferences(tenantId, userId);
    const userState = userInferences.userState;

    // Gerar sugestões baseadas no estado
    const suggestions: MatchSuggestion[] = [];

    // MATCHING 1: Exploração (para exploradores e curiosos)
    if (userState === 'explorer' || userState === 'curious') {
      const explorationMatches = await this.generateExplorationMatches(
        tenantId,
        userId,
        userState,
        2
      );
      suggestions.push(...explorationMatches);
    }

    // MATCHING 2: Aprendizado (para curiosos, em transição, em formação)
    if (userState === 'curious' || userState === 'in_transition' || userState === 'professional_training') {
      const learningMatches = await this.generateLearningMatches(
        tenantId,
        userId,
        userState,
        2
      );
      suggestions.push(...learningMatches);
    }

    // MATCHING 3: Espelhamento (para profissionais estáveis ou em risco)
    if (userState === 'professional_stable' || userState === 'at_risk') {
      const mirroringMatches = await this.generateMirroringMatches(
        tenantId,
        userId,
        userState,
        1
      );
      suggestions.push(...mirroringMatches);
    }

    // Ordenar por prioridade
    suggestions.sort((a, b) => b.priority - a.priority);

    // Limitar quantidade
    const limitedSuggestions = suggestions.slice(0, limit);

    return {
      suggestions: limitedSuggestions,
      hasMore: suggestions.length > limit,
    };
  }

  /**
   * Gera matches de exploração
   */
  private async generateExplorationMatches(
    tenantId: string,
    userId: string,
    userState: string,
    limit: number
  ): Promise<MatchSuggestion[]> {
    // Por enquanto, retorna matches mockados
    // Em produção, buscaria usuários com estado similar e afinidade de Físico
    return [
      {
        id: 'exploration_1',
        type: 'exploration',
        users: [
          {
            userId: 'user_2',
            name: 'Ana Costa',
            state: 'explorer',
            affinity: {
              physical: ['criar-expressar', 'cozinhar-comer'],
            },
            lastActivity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        title: 'Pessoas explorando algo parecido',
        message: 'Tem gente descobrindo coisas similares ao que você curte.',
        affinityScore: 7,
        priority: 8,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  /**
   * Gera matches de aprendizado
   */
  private async generateLearningMatches(
    tenantId: string,
    userId: string,
    userState: string,
    limit: number
  ): Promise<MatchSuggestion[]> {
    return [
      {
        id: 'learning_1',
        type: 'learning',
        users: [
          {
            userId: 'user_3',
            name: 'Carlos Mendes',
            state: 'curious',
            affinity: {
              learning: ['fotografia-aprendizado', 'escrita-criativa'],
            },
            lastActivity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        title: 'Gente aprendendo isso também',
        message: 'Alguém está explorando caminhos parecidos com os seus.',
        affinityScore: 8,
        priority: 7,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  /**
   * Gera matches de espelhamento
   */
  private async generateMirroringMatches(
    tenantId: string,
    userId: string,
    userState: string,
    limit: number
  ): Promise<MatchSuggestion[]> {
    return [
      {
        id: 'mirroring_1',
        type: 'mirroring',
        users: [
          {
            userId: 'user_4',
            name: 'Patricia Lima',
            state: 'professional_stable',
            affinity: {
              professional: ['designer', 'criador-conteudo'],
            },
            lastActivity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        title: 'Histórias que podem te interessar',
        message: 'Alguém com uma trajetória parecida com a sua.',
        affinityScore: 6,
        priority: 6,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  /**
   * Registra ação do usuário sobre uma sugestão de match
   */
  async recordMatchAction(
    tenantId: string,
    userId: string,
    matchId: string,
    action: 'accept' | 'dismiss'
  ): Promise<void> {
    // Por enquanto, apenas log
    // Em produção, salvaria no metadata do usuário para não reaparecer
    console.log(`[MATCHING] User ${userId} ${action}ed match ${matchId}`);
  }

  /**
   * Verifica se um match já foi dispensado
   */
  async isMatchDismissed(
    tenantId: string,
    userId: string,
    matchId: string
  ): Promise<boolean> {
    // Por enquanto, retorna false
    // Em produção, verificaria no metadata do usuário
    return false;
  }
}

export const matchingService = new MatchingService();













