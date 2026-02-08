// src/core/feed/feed-plugin.service.ts
// Service do FEED PLUGIN SYSTEM
// 🔴 BLINDAGEM: Feed = orquestrador visual, Domínios = motores
// 🔴 BLINDAGEM: Service apenas orquestra plugins, não decide comportamento
// 🔴 BLINDAGEM: Service não executa ações de domínio

import { feedPluginRegistry } from './feed-plugin.registry';
import { feedPluginResolver } from './feed-plugin.resolver';
import { feedPluginCache } from './feed-plugin.cache';
import type {
  SocialFeedPlugin,
  FeedItemDTO,
  FeedAction,
  PluginResolutionResult,
} from './feed-plugin.types';
import { ActorIntent } from '@core/social/ports';
import { pool } from '@core/database/pool';

/**
 * Service do Feed Plugin System
 * 🔴 BLINDAGEM: Service apenas orquestra plugins, não decide comportamento
 * 🔴 BLINDAGEM: Service não executa ações de domínio
 * 
 * Responsabilidades:
 * - Registrar plugins de módulos
 * - Resolver plugins para posts
 * - Renderizar items do feed
 * - Obter ações disponíveis
 */
class FeedPluginService {
  /**
   * Registra um plugin no sistema
   * 🔴 BLINDAGEM: Registro é apenas declaração, não execução
   * 
   * @param plugin Plugin a ser registrado
   */
  registerPlugin(plugin: SocialFeedPlugin): void {
    // 🔴 BLINDAGEM: Registrar plugin (apenas declaração, não execução)
    feedPluginRegistry.register(plugin);
  }

  /**
   * Remove um plugin do sistema
   * 🔴 BLINDAGEM: Remoção é apenas declaração, não execução
   * 
   * @param pluginName Nome do plugin a ser removido
   */
  unregisterPlugin(pluginName: string): void {
    // 🔴 BLINDAGEM: Remover plugin (apenas declaração, não execução)
    feedPluginRegistry.unregister(pluginName);
  }

  /**
   * Lista todos os plugins registrados
   * 🔴 BLINDAGEM: Lista é apenas informação, não decisão
   * 
   * @returns Lista de plugins registrados
   */
  listPlugins(): SocialFeedPlugin[] {
    return feedPluginRegistry.getAllPlugins();
  }

  /**
   * Resolve plugin para um post
   * 🔴 BLINDAGEM: Resolução é apenas informação, não decisão
   * 
   * Fluxo: post → intent → plugin
   * 
   * @param postId ID do post
   * @param sourceType Tipo da entidade fonte
   * @param intent Intent que originou o post
   * @param metadata Metadados adicionais do post
   * @returns Resultado da resolução
   */
  resolvePluginForPost(
    postId: string,
    sourceType: string,
    intent: ActorIntent,
    metadata?: Record<string, any>
  ): PluginResolutionResult {
    // 🔴 BLINDAGEM: Resolver plugin (apenas informação, não decisão)
    return feedPluginResolver.resolveForPost(postId, sourceType, intent, metadata);
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
  async renderFeedItem(
    postId: string,
    sourceType: string,
    intent: ActorIntent,
    metadata?: Record<string, any>
  ): Promise<FeedItemDTO | null> {
    // 🔴 BLINDAGEM: Renderizar usando plugin (apenas transformação de dados)
    return await feedPluginResolver.renderPost(postId, sourceType, intent, metadata);
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
  async getAvailableActions(
    postId: string,
    sourceType: string,
    intent: ActorIntent,
    metadata?: Record<string, any>
  ): Promise<FeedAction[]> {
    // 🔴 BLINDAGEM: Obter ações disponíveis (apenas declaração, não execução)
    return await feedPluginResolver.getPostActions(postId, sourceType, intent, metadata);
  }

  /**
   * Renderiza múltiplos posts em batch
   * 🔴 BLINDAGEM: Renderização é apenas transformação de dados, não execução
   * 🔴 BLINDAGEM: Batch otimiza performance, não altera comportamento
   * 
   * Fluxo:
   * 1. Buscar posts em batch
   * 2. Verificar cache
   * 3. Agrupar por plugin
   * 4. Renderizar em batch quando possível
   * 5. Retornar resultados
   * 
   * @param tenantId ID do tenant
   * @param postIds IDs dos posts a renderizar
   * @returns Map de postId → { pluginId, dto, actions[] }
   */
  async renderBatch(
    tenantId: string,
    postIds: string[]
  ): Promise<Map<string, { pluginId: string | null; dto: FeedItemDTO | null; actions: FeedAction[] }>> {
    // 🔴 HARDENING: Log estruturado antes de render batch
    const { structuredLogger: logger } = await import('@core/utils/structured-logger');
    logger.logFeedRenderBatch('info', 'Iniciando render batch do feed', {
      tenantId,
      postCount: postIds.length,
    });

    // 🔴 BLINDAGEM: Resultado do batch (mapa de postId → resultado)
    const results = new Map<string, { pluginId: string | null; dto: FeedItemDTO | null; actions: FeedAction[] }>();

    if (postIds.length === 0) {
      return results;
    }

    // 1. Buscar posts em batch
    const posts = await this.getPostsBatch(postIds);
    const postsMap = new Map(posts.map(p => [p.post_id, p]));

    // 2. Processar cada post
    for (const postId of postIds) {
      const post = postsMap.get(postId);
      if (!post) {
        // Post não encontrado
        results.set(postId, { pluginId: null, dto: null, actions: [] });
        continue;
      }

      // 3. Verificar cache
      const cached = feedPluginCache.get(tenantId, postId, post.updatedAt);
      if (cached) {
        // 🔴 BLINDAGEM: Cache apenas retorna dados de renderização, não decisão
        results.set(postId, {
          pluginId: cached.dto?.type || null,
          dto: cached.dto,
          actions: cached.actions,
        });
        continue;
      }

      // 4. Resolver plugin
      const intent = post.intent as ActorIntent | null;
      if (!intent) {
        // Post sem intent, não tem plugin
        results.set(postId, { pluginId: null, dto: null, actions: [] });
        continue;
      }

      const resolution = feedPluginResolver.resolveForPost(
        postId,
        'post',
        intent,
        post.metadata
      );

      if (!resolution.resolved || !resolution.plugin) {
        // Nenhum plugin encontrado
        results.set(postId, { pluginId: null, dto: null, actions: [] });
        continue;
      }

      // 5. Renderizar e obter ações
      try {
        const [dto, actions] = await Promise.all([
          resolution.plugin.renderFeedItem(postId, 'post', intent, post.metadata),
          resolution.plugin.getAvailableActions(postId, 'post', intent),
        ]);

        // 6. Armazenar no cache
        feedPluginCache.set(tenantId, postId, post.updatedAt, dto, actions);

        // 7. Adicionar ao resultado
        results.set(postId, {
          pluginId: resolution.plugin.name,
          dto,
          actions,
        });
      } catch (error) {
        // Erro ao renderizar, usar fallback
        // 🔴 HARDENING: Log estruturado para observabilidade
        logger.logFeedRenderBatch('warn', `Erro ao renderizar post ${postId} via plugin`, {
          tenantId,
          postId,
          error: error instanceof Error ? error.message : String(error),
        });
        results.set(postId, { pluginId: null, dto: null, actions: [] });
      }
    }

    // 🔴 HARDENING: Log estruturado após render batch
    const cachedCount = Array.from(results.values()).filter(r => r.dto !== null).length;
    logger.logFeedRenderBatch('info', 'Render batch do feed concluído', {
      tenantId,
      postCount: postIds.length,
      cachedCount,
      renderedCount: results.size,
    });

    return results;
  }

  /**
   * Busca múltiplos posts em batch
   * 🔴 BLINDAGEM: Busca é apenas leitura, não execução
   * 
   * @param postIds IDs dos posts a buscar
   * @returns Lista de posts encontrados
   */
  private async getPostsBatch(postIds: string[]): Promise<Array<{
    post_id: string;
    tenant_id: string;
    intent: string | null;
    metadata: Record<string, any>;
    updatedAt: Date;
  }>> {
    if (postIds.length === 0) {
      return [];
    }

    // 🔴 BLINDAGEM: Buscar posts em batch usando query direta
    // Não usamos serviço de posts para evitar dependência circular
    const result = await pool.query<{
      post_id: string;
      tenant_id: string;
      intent: string | null;
      metadata: Record<string, any>;
      updatedAt: Date;
    }>(
      `
      SELECT post_id, tenant_id, intent, COALESCE(metadata, '{}'::jsonb) as metadata, updatedAt
      FROM posts
      WHERE post_id = ANY($1)
      `,
      [postIds]
    );

    return result.rows || [];
  }
}

/**
 * Instância singleton do service
 * 🔴 BLINDAGEM: Singleton é apenas para acesso global, não para decisão
 */
export const feedPluginService = new FeedPluginService();


