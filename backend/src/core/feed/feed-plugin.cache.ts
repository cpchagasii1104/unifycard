// src/core/feed/feed-plugin.cache.ts
// Cache in-memory para Feed Plugin System
// 🔴 BLINDAGEM: Cache NÃO armazena decisão
// 🔴 BLINDAGEM: Cache NÃO armazena estado mutável
// 🔴 BLINDAGEM: Cache quebra isolamento de tenant (chave inclui tenant_id)

import type { FeedItemDTO, FeedAction } from './feed-plugin.types';

/**
 * Item do cache
 * 🔴 BLINDAGEM: Cache apenas armazena DTO + actions (dados de renderização)
 * 🔴 BLINDAGEM: Cache NÃO armazena decisão ou estado mutável
 */
interface CacheItem {
  dto: FeedItemDTO | null;
  actions: FeedAction[];
  cachedAt: number; // Timestamp em ms
  expiresAt: number; // Timestamp em ms
}

/**
 * Cache in-memory para Feed Plugin System
 * 🔴 BLINDAGEM: Cache é apenas otimização de performance, não fonte de verdade
 * 🔴 BLINDAGEM: Cache quebra isolamento de tenant (chave inclui tenant_id)
 */
class FeedPluginCache {
  private cache: Map<string, CacheItem> = new Map();
  private readonly TTL_MS: number = 60 * 1000; // 60 segundos (pode ser configurável)
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(ttlSeconds: number = 60) {
    this.TTL_MS = ttlSeconds * 1000;
    this.startCleanupInterval();
  }

  /**
   * Inicia intervalo de limpeza automática de itens expirados
   * 🔴 BLINDAGEM: Limpeza é apenas manutenção, não decisão
   */
  private startCleanupInterval(): void {
    // Limpar itens expirados a cada 30 segundos
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30 * 1000);
  }

  /**
   * Limpa itens expirados do cache
   * 🔴 BLINDAGEM: Limpeza é apenas manutenção, não decisão
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Gera chave do cache
   * 🔴 BLINDAGEM: Chave inclui tenant_id para garantir isolamento
   * 🔴 BLINDAGEM: Chave inclui post_id + post_updatedAt para invalidar quando post mudar
   * 
   * @param tenantId ID do tenant
   * @param postId ID do post
   * @param postUpdatedAt Timestamp de atualização do post (ISO string ou Date)
   * @returns Chave do cache
   */
  private getCacheKey(
    tenantId: string,
    postId: string,
    postUpdatedAt?: string | Date
  ): string {
    // Se postUpdatedAt não for fornecido, usar timestamp atual (cache sempre expira)
    const updatedAt = postUpdatedAt 
      ? (typeof postUpdatedAt === 'string' ? postUpdatedAt : postUpdatedAt.toISOString())
      : new Date().toISOString();
    
    // 🔴 BLINDAGEM: Chave inclui tenant_id para isolamento
    return `${tenantId}:${postId}:${updatedAt}`;
  }

  /**
   * Obtém item do cache
   * 🔴 BLINDAGEM: Cache apenas retorna dados de renderização, não decisão
   * 
   * @param tenantId ID do tenant
   * @param postId ID do post
   * @param postUpdatedAt Timestamp de atualização do post
   * @returns Item do cache ou null se não existir ou expirado
   */
  get(
    tenantId: string,
    postId: string,
    postUpdatedAt?: string | Date
  ): { dto: FeedItemDTO | null; actions: FeedAction[] } | null {
    const key = this.getCacheKey(tenantId, postId, postUpdatedAt);
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // Verificar se item expirou
    if (item.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    // 🔴 BLINDAGEM: Retornar apenas dados de renderização (DTO + actions)
    return {
      dto: item.dto,
      actions: item.actions,
    };
  }

  /**
   * Armazena item no cache
   * 🔴 BLINDAGEM: Cache apenas armazena dados de renderização, não decisão
   * 
   * @param tenantId ID do tenant
   * @param postId ID do post
   * @param postUpdatedAt Timestamp de atualização do post
   * @param dto DTO renderizado (pode ser null se não houver plugin)
   * @param actions Ações disponíveis
   */
  set(
    tenantId: string,
    postId: string,
    postUpdatedAt: string | Date | undefined,
    dto: FeedItemDTO | null,
    actions: FeedAction[]
  ): void {
    const key = this.getCacheKey(tenantId, postId, postUpdatedAt);
    const now = Date.now();

    // 🔴 BLINDAGEM: Armazenar apenas dados de renderização (DTO + actions)
    this.cache.set(key, {
      dto,
      actions,
      cachedAt: now,
      expiresAt: now + this.TTL_MS,
    });
  }

  /**
   * Remove item do cache
   * 🔴 BLINDAGEM: Remoção é apenas manutenção, não decisão
   * 
   * @param tenantId ID do tenant
   * @param postId ID do post
   */
  invalidate(tenantId: string, postId: string): void {
    // Remover todas as chaves que correspondem ao post (independente de updatedAt)
    const prefix = `${tenantId}:${postId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpa todo o cache
   * 🔴 BLINDAGEM: Limpeza é apenas manutenção, não decisão
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Obtém estatísticas do cache (para debug/monitoramento)
   * 🔴 BLINDAGEM: Estatísticas são apenas informação, não decisão
   */
  getStats(): {
    size: number;
    expired: number;
    active: number;
  } {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const item of this.cache.values()) {
      if (item.expiresAt < now) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      size: this.cache.size,
      expired,
      active,
    };
  }

  /**
   * Para o intervalo de limpeza (útil para testes)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Instância singleton do cache
 * 🔴 BLINDAGEM: Singleton é apenas para acesso global, não para decisão
 */
export const feedPluginCache = new FeedPluginCache(60); // TTL padrão: 60 segundos


