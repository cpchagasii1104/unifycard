// src/core/feed/feed-plugin.resolver.ts
// Resolvedor dinâmico do FEED PLUGIN SYSTEM
// 🔴 BLINDAGEM: Feed = orquestrador visual, Domínios = motores
// 🔴 BLINDAGEM: Resolver apenas resolve plugins, não decide comportamento
// 🔴 BLINDAGEM: Resolver não executa ações de domínio

import { feedPluginRegistry } from './feed-plugin.registry';
import type {
  PluginResolutionOptions,
  PluginResolutionResult,
  FeedItemDTO,
  FeedAction,
} from './feed-plugin.types';
import { ActorIntent } from '@core/social/ports';

/**
 * Resolvedor dinâmico de plugins do feed
 * 🔴 BLINDAGEM: Resolver apenas resolve plugins, não decide comportamento
 * 🔴 BLINDAGEM: Resolver não executa ações de domínio
 * 
 * Fluxo de resolução:
 * 1. post → intent → plugin
 * 2. plugin → renderFeedItem → DTO
 * 3. DTO → feed (renderização visual)
 */
class FeedPluginResolver {
  /**
   * Resolve plugin para um post
   * 🔴 BLINDAGEM: Resolução é apenas informação, não decisão
   * 
   * Fluxo: post → intent → plugin
   * 
   * @param postId ID do post
   * @param sourceType Tipo da entidade fonte (post, event, service, etc)
   * @param intent Intent que originou o post
   * @param metadata Metadados adicionais do post
   * @returns Resultado da resolução
   */
  resolveForPost(
    postId: string,
    sourceType: string,
    intent: ActorIntent,
    metadata?: Record<string, any>
  ): PluginResolutionResult {
    const options: PluginResolutionOptions = {
      sourceId: postId,
      sourceType,
      intent,
      metadata,
    };

    // 🔴 BLINDAGEM: Resolver plugin (apenas informação, não decisão)
    return feedPluginRegistry.resolvePlugin(options);
  }

  /**
   * Renderiza item do feed para um post
   * 🔴 BLINDAGEM: Renderização é apenas transformação de dados, não execução
   * 
   * Fluxo: post → intent → plugin → renderFeedItem → DTO
   * 
   * @param postId ID do post
   * @param sourceType Tipo da entidade fonte
   * @param intent Intent que originou o post
   * @param metadata Metadados adicionais do post
   * @returns DTO para renderização ou null se não houver plugin
   */
  async renderPost(
    postId: string,
    sourceType: string,
    intent: ActorIntent,
    metadata?: Record<string, any>
  ): Promise<FeedItemDTO | null> {
    const options: PluginResolutionOptions = {
      sourceId: postId,
      sourceType,
      intent,
      metadata,
    };

    // 🔴 BLINDAGEM: Renderizar usando plugin (apenas transformação de dados)
    return await feedPluginRegistry.renderFeedItem(options);
  }

  /**
   * Obtém ações disponíveis para um post
   * 🔴 BLINDAGEM: Ações são apenas declaração, não execução
   * 
   * Fluxo: post → intent → plugin → getAvailableActions → actions[]
   * 
   * @param postId ID do post
   * @param sourceType Tipo da entidade fonte
   * @param intent Intent que originou o post
   * @param metadata Metadados adicionais do post
   * @returns Lista de ações disponíveis (declaração, não execução)
   */
  async getPostActions(
    postId: string,
    sourceType: string,
    intent: ActorIntent,
    metadata?: Record<string, any>
  ): Promise<FeedAction[]> {
    const options: PluginResolutionOptions = {
      sourceId: postId,
      sourceType,
      intent,
      metadata,
    };

    // 🔴 BLINDAGEM: Obter ações disponíveis (apenas declaração, não execução)
    return await feedPluginRegistry.getAvailableActions(options);
  }
}

/**
 * Instância singleton do resolvedor
 * 🔴 BLINDAGEM: Singleton é apenas para acesso global, não para decisão
 */
export const feedPluginResolver = new FeedPluginResolver();

