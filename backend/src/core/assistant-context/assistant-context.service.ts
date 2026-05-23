// src/core/assistant-context/assistant-context.service.ts
// Context Builder - extrai contexto das interações do usuário para a assistente

import { MemoryRepository } from '../memory/memory.repository';

const memoryRepository = new MemoryRepository();

export interface FeedInteractionContext {
  recentInterests: string[];
  avoidedTopics: string[];
  savedTopics: string[];
  interactionTone: 'explore' | 'create' | 'learn' | 'relax' | 'neutral';
  lastInteractionDays: number;
}

export interface AssistantContext {
  feedContext?: FeedInteractionContext;
  summary?: string;
}

class AssistantContextService {
  /**
   * Busca contexto das interações do feed para a assistente
   */
  async getFeedInteractionContext(
    tenantId: string,
    globalUserId: string,
    daysBack: number = 7
  ): Promise<FeedInteractionContext | null> {
    try {
      // Buscar interações recentes do feed (últimos N dias)
      const interactions = await memoryRepository.findRecentInteractions(
        tenantId,
        globalUserId,
        50 // Buscar mais para ter contexto suficiente
      );

      // Filtrar apenas interações do feed dos últimos N dias
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const feedInteractions = interactions.filter((interaction) => {
        if (interaction.entity_type !== 'feed_content') return false;
        const lastInteraction = new Date(interaction.last_interaction_at);
        return lastInteraction >= cutoffDate;
      });

      if (feedInteractions.length === 0) {
        return null;
      }

      // Processar interações para extrair contexto
      const interests: Set<string> = new Set();
      const avoided: Set<string> = new Set();
      const saved: Set<string> = new Set();
      let likeCount = 0;
      let saveCount = 0;
      let ignoreCount = 0;
      let dislikeCount = 0;

      feedInteractions.forEach((interaction) => {
        const parameters = interaction.parameters as any;
        const action = parameters?.action;
        
        // A ação também pode estar no intent (feed_like, feed_dislike, etc)
        const intentAction = interaction.intent?.replace('feed_', '');
        const finalAction = action || intentAction;

        // Extrair tags/categorias do conteúdo (se disponível)
        const tags = parameters?.tags || [];
        const category = parameters?.categoryName || parameters?.category;

        if (finalAction === 'like') {
          likeCount++;
          if (category) interests.add(category.toLowerCase());
          tags.forEach((tag: string) => interests.add(tag.toLowerCase()));
        } else if (finalAction === 'dislike' || finalAction === 'ignore') {
          if (finalAction === 'dislike') dislikeCount++;
          else ignoreCount++;
          if (category) avoided.add(category.toLowerCase());
          tags.forEach((tag: string) => avoided.add(tag.toLowerCase()));
        } else if (finalAction === 'save') {
          saveCount++;
          if (category) saved.add(category.toLowerCase());
          tags.forEach((tag: string) => saved.add(tag.toLowerCase()));
        }
      });

      // Determinar tom da interação
      const totalInteractions = feedInteractions.length;
      const exploreRatio = (likeCount + saveCount) / totalInteractions;
      const avoidRatio = (dislikeCount + ignoreCount) / totalInteractions;

      let interactionTone: FeedInteractionContext['interactionTone'] = 'neutral';
      if (exploreRatio > 0.6) {
        interactionTone = 'explore';
      } else if (saveCount > likeCount) {
        interactionTone = 'learn';
      } else if (avoidRatio > 0.5) {
        interactionTone = 'relax'; // Evitando muito = quer algo mais leve
      }

      // Calcular dias desde última interação
      const lastInteraction = feedInteractions[0]?.last_interaction_at
        ? new Date(feedInteractions[0].last_interaction_at)
        : new Date();
      const daysSince = Math.floor(
        (Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        recentInterests: Array.from(interests).slice(0, 5), // Top 5 interesses
        avoidedTopics: Array.from(avoided).slice(0, 3), // Top 3 evitados
        savedTopics: Array.from(saved).slice(0, 3), // Top 3 salvos
        interactionTone,
        lastInteractionDays: daysSince,
      };
    } catch (error) {
      console.error('Erro ao buscar contexto do feed:', error);
      return null;
    }
  }

  /**
   * Gera resumo de contexto para a assistente
   */
  async buildAssistantContext(
    tenantId: string,
    globalUserId: string
  ): Promise<AssistantContext> {
    const feedContext = await this.getFeedInteractionContext(
      tenantId,
      globalUserId,
      7 // Últimos 7 dias
    );

    if (!feedContext) {
      return {};
    }

    // Gerar resumo textual para a IA
    const summaryParts: string[] = [];

    if (feedContext.recentInterests.length > 0) {
      summaryParts.push(
        `Interagiu positivamente com conteúdos sobre: ${feedContext.recentInterests.join(', ')}.`
      );
    }

    if (feedContext.savedTopics.length > 0) {
      summaryParts.push(
        `Salvou conteúdos sobre: ${feedContext.savedTopics.join(', ')}.`
      );
    }

    if (feedContext.avoidedTopics.length > 0) {
      summaryParts.push(
        `Evitou conteúdos sobre: ${feedContext.avoidedTopics.join(', ')}.`
      );
    }

    const toneDescription: Record<FeedInteractionContext['interactionTone'], string> = {
      explore: 'está explorando e descobrindo coisas novas',
      create: 'está focado em criar e fazer',
      learn: 'está aprendendo e se aprofundando',
      relax: 'prefere conteúdo mais leve e relaxante',
      neutral: 'tem interações variadas',
    };

    summaryParts.push(`Momento atual: ${toneDescription[feedContext.interactionTone]}.`);

    if (feedContext.lastInteractionDays === 0) {
      summaryParts.push('Interagiu com o feed hoje.');
    } else if (feedContext.lastInteractionDays === 1) {
      summaryParts.push('Última interação foi ontem.');
    } else {
      summaryParts.push(
        `Última interação foi há ${feedContext.lastInteractionDays} dias.`
      );
    }

    return {
      feedContext,
      summary: summaryParts.join(' '),
    };
  }
}

export const assistantContextService = new AssistantContextService();


