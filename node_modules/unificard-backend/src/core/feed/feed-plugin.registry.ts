// src/core/feed/feed-plugin.registry.ts
// Registry do FEED PLUGIN SYSTEM
// 🔴 BLINDAGEM: Feed = orquestrador visual, Domínios = motores
// 🔴 BLINDAGEM: Registry apenas gerencia plugins, não decide comportamento
// 🔴 BLINDAGEM: Registry não executa ações de domínio

import type {
  SocialFeedPlugin,
  PluginResolutionResult,
  PluginResolutionOptions,
  FeedItemDTO,
  FeedAction,
} from './feed-plugin.types';
import { ActorIntent } from '@core/social/ports';

/**
 * Registry de Plugins do Feed
 * 🔴 BLINDAGEM: Registry apenas gerencia plugins, não decide comportamento
 * 🔴 BLINDAGEM: Registry não executa ações de domínio
 */
class FeedPluginRegistry {
  private plugins: Map<string, SocialFeedPlugin> = new Map();
  private intentPluginMap: Map<ActorIntent, Set<string>> = new Map();

  /**
   * Registra um plugin no registry
   * 🔴 BLINDAGEM: Registro é apenas declaração, não execução
   * 
   * @param plugin Plugin a ser registrado
   */
  register(plugin: SocialFeedPlugin): void {
    // 🔴 BLINDAGEM: Validar que plugin tem nome único
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin com nome '${plugin.name}' já está registrado`);
    }

    // 🔴 BLINDAGEM: Validar que plugin tem intents suportados
    if (!plugin.supportedIntents || plugin.supportedIntents.length === 0) {
      throw new Error(`Plugin '${plugin.name}' deve declarar pelo menos um intent suportado`);
    }

    // 🔴 BLINDAGEM: Registrar plugin
    this.plugins.set(plugin.name, plugin);

    // 🔴 BLINDAGEM: Mapear intents para plugins
    for (const intent of plugin.supportedIntents) {
      if (!this.intentPluginMap.has(intent)) {
        this.intentPluginMap.set(intent, new Set());
      }
      this.intentPluginMap.get(intent)!.add(plugin.name);
    }
  }

  /**
   * Remove um plugin do registry
   * 🔴 BLINDAGEM: Remoção é apenas declaração, não execução
   * 
   * @param pluginName Nome do plugin a ser removido
   */
  unregister(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      return;
    }

    // 🔴 BLINDAGEM: Remover mapeamento de intents
    for (const intent of plugin.supportedIntents) {
      const pluginSet = this.intentPluginMap.get(intent);
      if (pluginSet) {
        pluginSet.delete(pluginName);
        if (pluginSet.size === 0) {
          this.intentPluginMap.delete(intent);
        }
      }
    }

    // 🔴 BLINDAGEM: Remover plugin
    this.plugins.delete(pluginName);
  }

  /**
   * Busca plugin por nome
   * 🔴 BLINDAGEM: Busca é apenas informação, não decisão
   * 
   * @param name Nome do plugin
   * @returns Plugin encontrado ou null
   */
  getPlugin(name: string): SocialFeedPlugin | null {
    return this.plugins.get(name) || null;
  }

  /**
   * Lista todos os plugins registrados
   * 🔴 BLINDAGEM: Lista é apenas informação, não decisão
   * 
   * @returns Lista de plugins registrados
   */
  getAllPlugins(): SocialFeedPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Resolve plugin para um item do feed
   * 🔴 BLINDAGEM: Resolução é apenas informação, não decisão
   * 🔴 BLINDAGEM: Resolução não executa ações de domínio
   * 
   * Estratégia de resolução:
   * 1. Busca plugins que suportam o intent
   * 2. Valida se plugin pode processar (canHandle)
   * 3. Retorna primeiro plugin válido
   * 
   * @param options Opções de resolução
   * @returns Resultado da resolução
   */
  resolvePlugin(options: PluginResolutionOptions): PluginResolutionResult {
    const { sourceType, intent, sourceId, metadata } = options;

    // 🔴 BLINDAGEM: Buscar plugins que suportam o intent
    const pluginNames = this.intentPluginMap.get(intent);
    if (!pluginNames || pluginNames.size === 0) {
      return {
        plugin: null,
        resolved: false,
        reason: `Nenhum plugin registrado para intent '${intent}'`,
      };
    }

    // 🔴 BLINDAGEM: Tentar resolver plugin que pode processar
    for (const pluginName of pluginNames) {
      const plugin = this.plugins.get(pluginName);
      if (!plugin) {
        continue;
      }

      // 🔴 BLINDAGEM: Validar se plugin pode processar
      if (plugin.canHandle(sourceType, intent)) {
        return {
          plugin,
          resolved: true,
          reason: `Plugin '${plugin.name}' pode processar ${sourceType} com intent ${intent}`,
        };
      }
    }

    // 🔴 BLINDAGEM: Nenhum plugin pode processar
    return {
      plugin: null,
      resolved: false,
      reason: `Nenhum plugin pode processar ${sourceType} com intent ${intent}`,
    };
  }

  /**
   * Renderiza item do feed usando plugin resolvido
   * 🔴 BLINDAGEM: Renderização é apenas transformação de dados, não execução
   * 🔴 BLINDAGEM: Feed usa DTO para renderizar, não para decidir
   * 
   * @param options Opções de resolução
   * @returns DTO para renderização ou null se não houver plugin
   */
  async renderFeedItem(options: PluginResolutionOptions): Promise<FeedItemDTO | null> {
    const resolution = this.resolvePlugin(options);
    
    if (!resolution.resolved || !resolution.plugin) {
      return null;
    }

    // 🔴 BLINDAGEM: Renderizar usando plugin (apenas transformação de dados)
    return await resolution.plugin.renderFeedItem(
      options.sourceId || '',
      options.sourceType,
      options.intent,
      options.metadata
    );
  }

  /**
   * Obtém ações disponíveis para um item do feed
   * 🔴 BLINDAGEM: Ações são apenas declaração, não execução
   * 🔴 BLINDAGEM: Feed não executa ações de domínio
   * 
   * @param options Opções de resolução
   * @returns Lista de ações disponíveis (declaração, não execução)
   */
  async getAvailableActions(options: PluginResolutionOptions): Promise<FeedAction[]> {
    const resolution = this.resolvePlugin(options);
    
    if (!resolution.resolved || !resolution.plugin) {
      return [];
    }

    // 🔴 BLINDAGEM: Obter ações disponíveis (apenas declaração, não execução)
    return await resolution.plugin.getAvailableActions(
      options.sourceId || '',
      options.sourceType,
      options.intent
    );
  }
}

/**
 * Instância singleton do registry
 * 🔴 BLINDAGEM: Singleton é apenas para acesso global, não para decisão
 */
export const feedPluginRegistry = new FeedPluginRegistry();

