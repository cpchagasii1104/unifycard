"use strict";
// src/core/profile/profile-physical.service.ts
// Serviço para gerenciar perfil físico/interesses
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.profilePhysicalService = void 0;
const identity_service_1 = require("../identity/identity.service");
const profile_health_facts_repository_1 = require("./profile-health-facts.repository");
const profile_health_taxonomy_repository_1 = require("./profile-health-taxonomy.repository");
class ProfilePhysicalService {
    /**
     * Busca perfil físico/interesses do usuário
     */
    async getPhysicalProfile(tenantId, userId) {
        // Buscar globalUserId
        const identity = await identity_service_1.identityService.getIdentityProfile(userId, tenantId);
        if (!identity || !identity.global.globalUserId) {
            return null;
        }
        const globalUserId = identity.global.globalUserId;
        // Buscar interesses do usuário (armazenados no metadata do global_user ou em tabela separada)
        const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
        // 🔴 CORREÇÃO: ORDER BY updatedAt DESC para garantir registro mais recente
        const userRow = await pool.query(`
      SELECT metadata
      FROM global_users
      WHERE global_user_id = $1
      ORDER BY updatedAt DESC
      LIMIT 1
      `, [globalUserId]);
        const metadata = userRow.rows[0]?.metadata || {};
        // Extrair dados do perfil físico
        const interests = metadata.interests || [];
        const lifestyle = metadata.lifestyle || {
            drinks: null,
            smokes: null,
            relationshipStatus: null,
            sexualOrientation: null,
        };
        const preferences = metadata.preferences || {};
        // Buscar dados de saúde compartilhados (altura, peso) se houver consentimento
        let healthData = null;
        try {
            // Buscar actor_id do usuário
            const identity = await identity_service_1.identityService.getIdentityProfile(userId, tenantId);
            if (identity?.actors?.person?.actor_id) {
                const actorId = identity.actors.person.actor_id;
                // Verificar se há consentimento para compartilhar no perfil de relacionamento
                const shareConsentTax = await profile_health_taxonomy_repository_1.profileHealthTaxonomyRepository.findBySlug(tenantId, 'compartilhar-perfil-relacionamento');
                if (shareConsentTax) {
                    const shareConsentFact = await profile_health_facts_repository_1.profileHealthFactsRepository.findByTaxonomyId(tenantId, actorId, shareConsentTax.taxonomyId);
                    if (shareConsentFact?.valueBoolean === true) {
                        // Buscar altura e peso
                        const heightTax = await profile_health_taxonomy_repository_1.profileHealthTaxonomyRepository.findBySlug(tenantId, 'altura');
                        const weightTax = await profile_health_taxonomy_repository_1.profileHealthTaxonomyRepository.findBySlug(tenantId, 'peso');
                        let height;
                        let weight;
                        if (heightTax) {
                            const heightFact = await profile_health_facts_repository_1.profileHealthFactsRepository.findByTaxonomyId(tenantId, actorId, heightTax.taxonomyId);
                            if (heightFact?.valueNumber) {
                                height = heightFact.valueNumber;
                            }
                        }
                        if (weightTax) {
                            const weightFact = await profile_health_facts_repository_1.profileHealthFactsRepository.findByTaxonomyId(tenantId, actorId, weightTax.taxonomyId);
                            if (weightFact?.valueNumber) {
                                weight = weightFact.valueNumber;
                            }
                        }
                        if (height || weight) {
                            healthData = { height, weight };
                            // Calcular peso ideal (IMC 22.5 é considerado ideal)
                            if (height && weight) {
                                const heightInMeters = height / 100;
                                const idealWeight = 22.5 * (heightInMeters * heightInMeters);
                                healthData.idealWeight = Math.round(idealWeight * 10) / 10; // Arredondar para 1 casa decimal
                            }
                        }
                    }
                }
            }
        }
        catch (error) {
            // Log mas não quebra o fluxo
            console.warn('[ProfilePhysicalService] Erro ao buscar dados de saúde compartilhados:', error);
        }
        return {
            globalUserId,
            interests,
            lifestyle,
            preferences,
            metadata: {
                ...(metadata.physicalMetadata || {}),
                ...(healthData ? { sharedHealthData: healthData } : {}),
            },
        };
    }
    /**
     * Atualiza perfil físico/interesses
     */
    async updatePhysicalProfile(tenantId, userId, input) {
        // Buscar globalUserId
        const identity = await identity_service_1.identityService.getIdentityProfile(userId, tenantId);
        if (!identity || !identity.global.globalUserId) {
            throw new Error('Identidade do usuário não encontrada');
        }
        const globalUserId = identity.global.globalUserId;
        // Buscar metadata atual
        // 🔴 NOTA: global_users não tem RLS, então não precisa de tenant_id no WHERE
        // Mas adicionamos ORDER BY updatedAt DESC como garantia de registro mais recente
        const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
        const currentRow = await pool.query(`
      SELECT metadata
      FROM global_users
      WHERE global_user_id = $1
      ORDER BY updatedAt DESC
      LIMIT 1
      `, [globalUserId]);
        const currentMetadata = currentRow.rows[0]?.metadata || {};
        // Atualizar metadata com novos dados
        const updatedMetadata = {
            ...currentMetadata,
            interests: input.interests || currentMetadata.interests || [],
            lifestyle: {
                ...(currentMetadata.lifestyle || {}),
                ...(input.lifestyle || {}),
            },
            preferences: {
                ...(currentMetadata.preferences || {}),
                ...(input.preferences || {}),
            },
            physicalMetadata: {
                ...(currentMetadata.physicalMetadata || {}),
                ...(input.metadata || {}),
            },
            updatedAt: new Date().toISOString(),
        };
        // Atualizar no banco
        await pool.query(`
      UPDATE global_users
      SET metadata = $1, updatedAt = now()
      WHERE global_user_id = $2
      `, [JSON.stringify(updatedMetadata), globalUserId]);
        // Buscar categorias para montar o retorno completo
        const interestsWithDetails = [];
        if (updatedMetadata.interests && Array.isArray(updatedMetadata.interests) && updatedMetadata.interests.length > 0) {
            const categoriesResult = await pool.query(`
        SELECT category_id, name, path, level
        FROM categories
        WHERE category_id = ANY($1::uuid[])
          AND scope = 'interest'
          AND (status IS NULL OR status = 'active' OR status = 'auto_active')
        `, [updatedMetadata.interests]);
            interestsWithDetails.push(...categoriesResult.rows.map((row) => ({
                categoryId: row.category_id,
                categoryName: row.name,
                categoryPath: row.path,
                level: row.level,
            })));
        }
        return {
            globalUserId,
            interests: interestsWithDetails,
            lifestyle: updatedMetadata.lifestyle,
            preferences: updatedMetadata.preferences || {},
            metadata: updatedMetadata.physicalMetadata || {},
        };
    }
}
exports.profilePhysicalService = new ProfilePhysicalService();
