// src/core/memory/memory.service.ts
import { MemoryRepository } from './memory.repository';
import { MemoryModel } from './memory.model';
import type {
  UserPreferences,
  UserContext,
  UpdateFromIntentInput,
  RegisterInteractionInput,
  UserMemoryPreference,
  UserMemoryEntity,
  UserMemoryShortcut,
  UserMemoryInteraction,
} from './memory.types';

class MemoryService {
  private repository = new MemoryRepository();
  private contextStore: Array<{ key: string; data: any; timestamp: number }> = [];

  /**
   * Salva contexto no store em memória
   * Usado para armazenar eventos e contextos temporários
   */
  async saveContext(key: string, data: any): Promise<void> {
    this.contextStore.push({
      key,
      data,
      timestamp: Date.now(),
    });

    // Limitar tamanho do store (manter últimas 1000 entradas)
    if (this.contextStore.length > 1000) {
      this.contextStore.shift();
    }
  }

  /**
   * Busca contextos por chave e filtro opcional
   */
  getContextsByKey(key: string, filter?: (data: any) => boolean): Array<{ key: string; data: any; timestamp: number }> {
    let results = this.contextStore.filter((entry) => entry.key === key);
    
    if (filter) {
      results = results.filter((entry) => filter(entry.data));
    }
    
    // Ordenar por timestamp (mais recente primeiro)
    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Busca contextos por userId
   */
  getContextsByUserId(userId: string, key?: string): Array<{ key: string; data: any; timestamp: number }> {
    let results = this.contextStore.filter((entry) => {
      const data = entry.data;
      return data && (data.userId === userId || data.user_id === userId);
    });
    
    if (key) {
      results = results.filter((entry) => entry.key === key);
    }
    
    // Ordenar por timestamp (mais recente primeiro)
    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Atualiza memória a partir de uma intent executada
   */
  async updateFromIntent(
    tenantId: string,
    globalUserId: string,
    input: UpdateFromIntentInput
  ): Promise<void> {
    const { intent, parameters, entityType, entityId, entityName } = input;

    // 1. Registrar interação
    await this.repository.upsertInteraction({
      tenantId,
      globalUserId,
      intent: intent ?? 'unknown',
      entityType: entityType || 'unknown',
      entityId: entityId || null,
      entityName: entityName || null,
      parameters: parameters ?? {},
    });

    // 2. Extrair preferências baseadas no intent e parâmetros
    await this.extractPreferences(tenantId, globalUserId, intent ?? 'unknown', parameters ?? {});

    // 3. Registrar entidade se houver
    if (entityId && entityType) {
      await this.repository.upsertEntity({
        tenantId,
        globalUserId,
        entityType,
        targetGlobalUserId: entityType === 'worker' ? entityId : null,
        targetCompanyId: entityType === 'company' ? entityId : null,
        entityName: entityName || 'Unknown',
        entityMetadata: parameters ?? {},
        relevanceScore: 1.0,
      });
    }

    // 4. Criar/atualizar shortcut se for ação frequente
    if (this.isFrequentAction(intent ?? 'unknown', parameters ?? {})) {
      const label = this.generateShortcutLabel(intent ?? 'unknown', parameters ?? {}, entityName);
      await this.repository.upsertShortcut({
        tenantId,
        globalUserId,
        label,
        intent: intent ?? 'unknown',
        parameters: parameters ?? {},
      });
    }
  }

  /**
   * Extrai preferências dos parâmetros
   */
  private async extractPreferences(
    tenantId: string,
    globalUserId: string,
    intent: string,
    parameters: Record<string, any>
  ): Promise<void> {
    // Extrair preferências baseadas no intent
    if (intent === 'schedule_service') {
      // Preferência de horário
      if (parameters.time) {
        await this.repository.upsertPreference({
          tenantId,
          globalUserId,
          category: 'schedule',
          key: 'preferred_time',
          valueCents: parameters.time,
          confidence: 0.8,
        });
      }

      // Preferência de dia da semana
      if (parameters.date) {
        const date = new Date(parameters.date);
        const dayOfWeek = date.getDay();
        await this.repository.upsertPreference({
          tenantId,
          globalUserId,
          category: 'schedule',
          key: 'preferred_day_of_week',
          valueCents: dayOfWeek,
          confidence: 0.7,
        });
      }

      // Preferência de profissional
      if (parameters.workerId) {
        await this.repository.upsertPreference({
          tenantId,
          globalUserId,
          category: 'services',
          key: 'preferred_worker',
          valueCents: parameters.workerId,
          confidence: 0.9,
        });
      }
    }

    if (intent === 'order_food') {
      // Preferência de restaurante
      if (parameters.restaurantId) {
        await this.repository.upsertPreference({
          tenantId,
          globalUserId,
          category: 'food',
          key: 'favorite_restaurant',
          valueCents: parameters.restaurantId,
          confidence: 0.8,
        });
      }

      // Preferência de prato
      if (parameters.items && Array.isArray(parameters.items)) {
        for (const item of parameters.items) {
          if (item.name) {
            await this.repository.upsertPreference({
              tenantId,
              globalUserId,
              category: 'food',
              key: 'favorite_dish',
              valueCents: item.name,
              confidence: 0.7,
            });
          }
        }
      }
    }

    if (intent === 'request_ride') {
      // Preferência de origem
      if (parameters.origin) {
        await this.repository.upsertPreference({
          tenantId,
          globalUserId,
          category: 'transport',
          key: 'usual_origin',
          valueCents: parameters.origin,
          confidence: 0.8,
        });
      }

      // Preferência de destino
      if (parameters.destination) {
        await this.repository.upsertPreference({
          tenantId,
          globalUserId,
          category: 'transport',
          key: 'usual_destination',
          valueCents: parameters.destination,
          confidence: 0.8,
        });
      }
    }
  }

  /**
   * Verifica se é uma ação frequente (para criar shortcut)
   */
  private isFrequentAction(intent: string, parameters: Record<string, any>): boolean {
    // Ações que podem gerar shortcuts
    const shortcutableIntents = [
      'schedule_service',
      'order_food',
      'request_ride',
      'buy_product',
      'book_event',
    ];

    return shortcutableIntents.includes(intent) && Object.keys(parameters).length > 0;
  }

  /**
   * Gera label para shortcut
   */
  private generateShortcutLabel(
    intent: string,
    parameters: Record<string, any>,
    entityName?: string | null
  ): string {
    const labels: Record<string, (params: Record<string, any>, name?: string | null) => string> = {
      schedule_service: (params, name) => {
        const time = params.time || '';
        const worker = name || 'serviço';
        return `Agendar ${worker}${time ? ` às ${time}` : ''}`;
      },
      order_food: (params, name) => {
        const restaurant = name || 'restaurante';
        const items = params.items ? ` (${params.items.length} itens)` : '';
        return `Pedir de ${restaurant}${items}`;
      },
      request_ride: (params) => {
        const origin = params.origin || 'origem';
        const destination = params.destination || 'destino';
        return `Chamar carro: ${origin} → ${destination}`;
      },
      buy_product: (params, name) => {
        const product = name || 'produto';
        return `Comprar ${product}`;
      },
      book_event: (params, name) => {
        const event = name || 'evento';
        return `Reservar ${event}`;
      },
    };

    const generator = labels[intent];
    return generator ? generator(parameters, entityName) : `Executar ${intent}`;
  }

  /**
   * Busca preferências do usuário
   */
  async getUserPreferences(
    tenantId: string,
    globalUserId: string,
    category?: string
  ): Promise<UserPreferences> {
    const rows = await this.repository.findPreferencesByUser(tenantId, globalUserId, category);
    const preferences = MemoryModel.preferencesFromRows(rows);

    // Agrupar por categoria
    const result: UserPreferences = {};
    for (const pref of preferences) {
      if (!result[pref.category]) {
        result[pref.category] = {};
      }
      result[pref.category][pref.key] = {
        valueCents: pref.valueCents,
        confidence: pref.confidence,
        usageCount: pref.usageCount,
        lastUsedAt: pref.lastUsedAt,
      };
    }

    return result;
  }

  /**
   * Busca ações sugeridas (shortcuts)
   */
  async getSuggestedActions(
    tenantId: string,
    globalUserId: string,
    limit: number = 10
  ): Promise<UserMemoryShortcut[]> {
    const rows = await this.repository.findSuggestedShortcuts(tenantId, globalUserId, limit);
    return MemoryModel.shortcutsFromRows(rows);
  }

  /**
   * Registra interação com entidade
   */
  async registerInteraction(
    tenantId: string,
    globalUserId: string,
    input: RegisterInteractionInput
  ): Promise<void> {
    const { entityId, entityType, entityName, metadata } = input;

    await this.repository.upsertEntity({
      tenantId,
      globalUserId,
      entityType: entityType ?? 'unknown',
      targetGlobalUserId: entityType === 'worker' ? entityId ?? null : null,
      targetCompanyId: entityType === 'company' ? entityId ?? null : null,
      entityName: entityName || 'Unknown',
      entityMetadata: metadata ?? {},
      relevanceScore: 1.0,
    });
  }

  /**
   * Busca contexto completo do usuário
   */
  async getUserContext(
    tenantId: string,
    globalUserId: string
  ): Promise<UserContext> {
    // Buscar preferências
    const preferences = await this.getUserPreferences(tenantId, globalUserId);

    // Buscar entidades frequentes
    const entityRows = await this.repository.findFrequentEntities(tenantId, globalUserId, undefined, 20);
    const frequentEntities = MemoryModel.entitiesFromRows(entityRows);

    // Buscar shortcuts sugeridos
    const suggestedShortcuts = await this.getSuggestedActions(tenantId, globalUserId, 10);

    // Buscar interações recentes
    const interactionRows = await this.repository.findRecentInteractions(tenantId, globalUserId, 10);
    const recentInteractions = MemoryModel.interactionsFromRows(interactionRows);

    return {
      preferences,
      frequentEntities,
      suggestedShortcuts,
      recentInteractions,
    };
  }
}

export const memoryService = new MemoryService();


