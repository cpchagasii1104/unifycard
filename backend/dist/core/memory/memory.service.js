"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryService = void 0;
// src/core/memory/memory.service.ts
const memory_repository_1 = require("./memory.repository");
const memory_model_1 = require("./memory.model");
class MemoryService {
    repository = new memory_repository_1.MemoryRepository();
    contextStore = [];
    /**
     * Salva contexto no store em memória
     * Usado para armazenar eventos e contextos temporários
     */
    async saveContext(key, data) {
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
    getContextsByKey(key, filter) {
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
    getContextsByUserId(userId, key) {
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
    async updateFromIntent(tenantId, globalUserId, input) {
        const { intent, parameters, entityType, entityId, entityName } = input;
        // 1. Registrar interação
        await this.repository.upsertInteraction({
            tenantId,
            globalUserId,
            intent,
            entityType: entityType || 'unknown',
            entityId: entityId || null,
            entityName: entityName || null,
            parameters,
        });
        // 2. Extrair preferências baseadas no intent e parâmetros
        await this.extractPreferences(tenantId, globalUserId, intent, parameters);
        // 3. Registrar entidade se houver
        if (entityId && entityType) {
            await this.repository.upsertEntity({
                tenantId,
                globalUserId,
                entityType,
                targetGlobalUserId: entityType === 'worker' ? entityId : null,
                targetCompanyId: entityType === 'company' ? entityId : null,
                entityName: entityName || 'Unknown',
                entityMetadata: parameters,
                relevanceScore: 1.0,
            });
        }
        // 4. Criar/atualizar shortcut se for ação frequente
        if (this.isFrequentAction(intent, parameters)) {
            const label = this.generateShortcutLabel(intent, parameters, entityName);
            await this.repository.upsertShortcut({
                tenantId,
                globalUserId,
                label,
                intent,
                parameters,
            });
        }
    }
    /**
     * Extrai preferências dos parâmetros
     */
    async extractPreferences(tenantId, globalUserId, intent, parameters) {
        // Extrair preferências baseadas no intent
        if (intent === 'schedule_service') {
            // Preferência de horário
            if (parameters.time) {
                await this.repository.upsertPreference({
                    tenantId,
                    globalUserId,
                    category: 'schedule',
                    key: 'preferred_time',
                    value: parameters.time,
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
                    value: dayOfWeek,
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
                    value: parameters.workerId,
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
                    value: parameters.restaurantId,
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
                            value: item.name,
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
                    value: parameters.origin,
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
                    value: parameters.destination,
                    confidence: 0.8,
                });
            }
        }
    }
    /**
     * Verifica se é uma ação frequente (para criar shortcut)
     */
    isFrequentAction(intent, parameters) {
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
    generateShortcutLabel(intent, parameters, entityName) {
        const labels = {
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
    async getUserPreferences(tenantId, globalUserId, category) {
        const rows = await this.repository.findPreferencesByUser(tenantId, globalUserId, category);
        const preferences = memory_model_1.MemoryModel.preferencesFromRows(rows);
        // Agrupar por categoria
        const result = {};
        for (const pref of preferences) {
            if (!result[pref.category]) {
                result[pref.category] = {};
            }
            result[pref.category][pref.key] = {
                value: pref.value,
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
    async getSuggestedActions(tenantId, globalUserId, limit = 10) {
        const rows = await this.repository.findSuggestedShortcuts(tenantId, globalUserId, limit);
        return memory_model_1.MemoryModel.shortcutsFromRows(rows);
    }
    /**
     * Registra interação com entidade
     */
    async registerInteraction(tenantId, globalUserId, input) {
        const { entityId, entityType, entityName, metadata } = input;
        await this.repository.upsertEntity({
            tenantId,
            globalUserId,
            entityType,
            targetGlobalUserId: entityType === 'worker' ? entityId : null,
            targetCompanyId: entityType === 'company' ? entityId : null,
            entityName: entityName || 'Unknown',
            entityMetadata: metadata || {},
            relevanceScore: 1.0,
        });
    }
    /**
     * Busca contexto completo do usuário
     */
    async getUserContext(tenantId, globalUserId) {
        // Buscar preferências
        const preferences = await this.getUserPreferences(tenantId, globalUserId);
        // Buscar entidades frequentes
        const entityRows = await this.repository.findFrequentEntities(tenantId, globalUserId, undefined, 20);
        const frequentEntities = memory_model_1.MemoryModel.entitiesFromRows(entityRows);
        // Buscar shortcuts sugeridos
        const suggestedShortcuts = await this.getSuggestedActions(tenantId, globalUserId, 10);
        // Buscar interações recentes
        const interactionRows = await this.repository.findRecentInteractions(tenantId, globalUserId, 10);
        const recentInteractions = memory_model_1.MemoryModel.interactionsFromRows(interactionRows);
        return {
            preferences,
            frequentEntities,
            suggestedShortcuts,
            recentInteractions,
        };
    }
}
exports.memoryService = new MemoryService();
//# sourceMappingURL=memory.service.js.map