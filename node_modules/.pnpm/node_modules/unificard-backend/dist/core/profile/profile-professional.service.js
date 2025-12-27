"use strict";
// src/core/profile/profile-professional.service.ts
// Serviço para gerenciar perfil profissional do usuário
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
exports.profileProfessionalService = void 0;
const pool_1 = require("@core/database/pool");
const categories_service_1 = require("../categories/categories.service");
const identity_service_1 = require("../identity/identity.service");
class ProfileProfessionalService {
    /**
     * Busca perfil profissional do usuário
     */
    async getProfessionalProfile(tenantId, userId) {
        // Buscar globalUserId
        const identity = await identity_service_1.identityService.getIdentityProfile(userId, tenantId);
        if (!identity || !identity.global.globalUserId) {
            return null;
        }
        const globalUserId = identity.global.globalUserId;
        // Buscar metadata do global_user para educação
        const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
        // 🔴 CORREÇÃO: ORDER BY updated_at DESC para garantir registro mais recente
        const userMetadataRow = await pool.query(`
      SELECT metadata
      FROM global_users
      WHERE global_user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
      `, [globalUserId]);
        const metadata = userMetadataRow.rows[0]?.metadata || {};
        // Buscar skills do usuário
        const skillsRows = await pool.query(`
      SELECT 
        usc.category_id,
        usc.skill_level,
        COALESCE(usc.years_experience, 0) as years_experience,
        COALESCE(usc.hourly_rate, NULL) as hourly_rate,
        COALESCE(usc.pricing_type, 'hourly') as pricing_type,
        COALESCE(usc.service_type, 'service') as service_type,
        COALESCE(usc.charge_visit, false) as charge_visit,
        COALESCE(usc.visit_price, NULL) as visit_price
      FROM user_skills_categories usc
      WHERE usc.global_user_id = $1
      ORDER BY usc.updated_at DESC
      `, [globalUserId]);
        // Buscar serviços pré-definidos
        const predefinedServicesRows = await pool.query(`
      SELECT 
        service_id,
        category_id,
        name,
        description,
        base_price,
        discount_percentage,
        final_price,
        is_active
      FROM predefined_services
      WHERE global_user_id = $1 AND is_active = true
      ORDER BY created_at ASC
      `, [globalUserId]);
        // Buscar regras de desconto para combos
        const comboDiscountRulesRows = await pool.query(`
      SELECT 
        rule_id,
        category_id,
        min_services,
        discount_percentage,
        description,
        is_active
      FROM combo_discount_rules
      WHERE global_user_id = $1 AND is_active = true
      ORDER BY min_services ASC
      `, [globalUserId]);
        // Buscar informações das categorias
        const skills = await Promise.all(skillsRows.rows.map(async (row) => {
            const category = await categories_service_1.categoriesService.getCategoryById(row.category_id);
            const predefinedServices = predefinedServicesRows.rows
                .filter(ps => ps.category_id === row.category_id)
                .map(ps => ({
                serviceId: ps.service_id,
                name: ps.name,
                description: ps.description || undefined,
                basePrice: Number(ps.base_price),
                discountPercentage: ps.discount_percentage ? Number(ps.discount_percentage) : undefined,
                finalPrice: Number(ps.final_price),
                isActive: ps.is_active,
            }));
            const comboDiscountRules = comboDiscountRulesRows.rows
                .filter(rule => rule.category_id === row.category_id)
                .map(rule => ({
                ruleId: rule.rule_id,
                minServices: rule.min_services,
                discountPercentage: Number(rule.discount_percentage),
                description: rule.description || undefined,
                isActive: rule.is_active,
            }));
            return {
                categoryId: row.category_id,
                categoryName: category?.name || 'Desconhecida',
                categoryPath: category?.path || [],
                skillLevel: row.skill_level,
                yearsExperience: row.years_experience || 0,
                hourlyRate: row.hourly_rate ? Number(row.hourly_rate) : null,
                pricingType: (row.pricing_type || 'hourly'),
                serviceType: (row.service_type === 'product' ? 'product' : 'service'),
                chargeVisit: row.charge_visit || false,
                visitPrice: row.visit_price ? Number(row.visit_price) : null,
                predefinedServices: predefinedServices.length > 0 ? predefinedServices : undefined,
                comboDiscountRules: comboDiscountRules.length > 0 ? comboDiscountRules : undefined,
                verified: false, // Por enquanto sempre false, pode ser implementado depois
            };
        }));
        // Buscar dados do worker (se existir)
        const workerRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT bio, availability
      FROM workers
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY updated_at DESC
      LIMIT 1
      `, [tenantId, userId]);
        // Buscar educação (armazenada no metadata do global_user ou worker)
        const educationMetadata = metadata.education || [];
        const education = Array.isArray(educationMetadata)
            ? educationMetadata.map((edu, idx) => ({
                educationId: edu.educationId || `temp-${idx}`,
                level: edu.level || 'other',
                institution: edu.institution || '',
                course: edu.course,
                field: edu.field,
                startDate: edu.startDate,
                endDate: edu.endDate,
                isCompleted: edu.isCompleted !== undefined ? edu.isCompleted : true,
                description: edu.description,
            }))
            : [];
        return {
            globalUserId,
            skills,
            education,
            bio: workerRow?.bio || null,
            availability: workerRow?.availability || null,
        };
    }
    /**
     * Atualiza perfil profissional
     */
    async updateProfessionalProfile(tenantId, userId, input) {
        // Buscar globalUserId
        const identity = await identity_service_1.identityService.getIdentityProfile(userId, tenantId);
        if (!identity || !identity.global.globalUserId) {
            throw new Error('Identidade do usuário não encontrada');
        }
        const globalUserId = identity.global.globalUserId;
        // Buscar metadata atual do global_user
        // 🔴 NOTA: global_users não tem RLS, então não precisa de tenant_id no WHERE
        // Mas adicionamos ORDER BY updated_at DESC como garantia de registro mais recente
        const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
        const currentUserRow = await pool.query(`
      SELECT metadata
      FROM global_users
      WHERE global_user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
      `, [globalUserId]);
        const currentMetadata = currentUserRow.rows[0]?.metadata || {};
        // Atualizar skills
        if (input.skills) {
            // Remover skills antigas
            await pool.query(`
        DELETE FROM user_skills_categories
        WHERE global_user_id = $1
        `, [globalUserId]);
            // Inserir novas skills com valores por profissão
            for (const skill of input.skills) {
                await categories_service_1.categoriesService.assignSkillToUser(globalUserId, {
                    categoryId: skill.categoryId,
                    skillLevel: skill.skillLevel || 0,
                    yearsExperience: skill.yearsExperience || 0,
                });
                // Atualizar campos adicionais
                const updates = [];
                const values = [];
                let paramIdx = 1;
                if (skill.yearsExperience !== undefined) {
                    updates.push(`years_experience = $${paramIdx}`);
                    values.push(skill.yearsExperience);
                    paramIdx++;
                }
                if (skill.hourlyRate !== undefined) {
                    updates.push(`hourly_rate = $${paramIdx}`);
                    values.push(skill.hourlyRate);
                    paramIdx++;
                }
                if (skill.pricingType !== undefined) {
                    updates.push(`pricing_type = $${paramIdx}`);
                    values.push(skill.pricingType);
                    paramIdx++;
                }
                if (skill.serviceType !== undefined) {
                    updates.push(`service_type = $${paramIdx}`);
                    values.push(skill.serviceType);
                    paramIdx++;
                }
                if (skill.chargeVisit !== undefined) {
                    updates.push(`charge_visit = $${paramIdx}`);
                    values.push(skill.chargeVisit);
                    paramIdx++;
                }
                if (skill.visitPrice !== undefined) {
                    updates.push(`visit_price = $${paramIdx}`);
                    values.push(skill.visitPrice);
                    paramIdx++;
                }
                if (updates.length > 0) {
                    values.push(globalUserId, skill.categoryId);
                    await pool.query(`
            UPDATE user_skills_categories
            SET ${updates.join(', ')}, updated_at = now()
            WHERE global_user_id = $${paramIdx} AND category_id = $${paramIdx + 1}
            `, values);
                }
                // Gerenciar serviços pré-definidos
                if (skill.predefinedServices !== undefined) {
                    // Buscar serviços existentes
                    const existingServices = await pool.query(`
            SELECT service_id
            FROM predefined_services
            WHERE global_user_id = $1 AND category_id = $2
            `, [globalUserId, skill.categoryId]);
                    const existingIds = new Set(existingServices.rows.map(r => r.service_id));
                    // Atualizar ou criar serviços
                    for (const predefinedService of skill.predefinedServices) {
                        if (predefinedService.serviceId && existingIds.has(predefinedService.serviceId)) {
                            // Atualizar existente
                            await pool.query(`
                UPDATE predefined_services
                SET 
                  name = $1,
                  description = $2,
                  base_price = $3,
                  discount_percentage = $4,
                  is_active = COALESCE($5, true),
                  updated_at = now()
                WHERE service_id = $6
                `, [
                                predefinedService.name,
                                predefinedService.description || null,
                                predefinedService.basePrice,
                                predefinedService.discountPercentage || null,
                                predefinedService.isActive !== undefined ? predefinedService.isActive : true,
                                predefinedService.serviceId,
                            ]);
                            existingIds.delete(predefinedService.serviceId);
                        }
                        else {
                            // Criar novo
                            await pool.query(`
                INSERT INTO predefined_services (
                  global_user_id, category_id, name, description, base_price, discount_percentage, is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                                globalUserId,
                                skill.categoryId,
                                predefinedService.name,
                                predefinedService.description || null,
                                predefinedService.basePrice,
                                predefinedService.discountPercentage || null,
                                predefinedService.isActive !== undefined ? predefinedService.isActive : true,
                            ]);
                        }
                    }
                    // Remover serviços que não foram enviados (desativar)
                    if (existingIds.size > 0) {
                        await pool.query(`
              UPDATE predefined_services
              SET is_active = false, updated_at = now()
              WHERE service_id = ANY($1)
              `, [Array.from(existingIds)]);
                    }
                }
                // Gerenciar regras de desconto para combos
                if (skill.comboDiscountRules !== undefined) {
                    // Buscar regras existentes
                    const existingRules = await pool.query(`
            SELECT rule_id
            FROM combo_discount_rules
            WHERE global_user_id = $1 AND category_id = $2
            `, [globalUserId, skill.categoryId]);
                    const existingRuleIds = new Set(existingRules.rows.map(r => r.rule_id));
                    // Atualizar ou criar regras
                    for (const rule of skill.comboDiscountRules) {
                        if (rule.ruleId && existingRuleIds.has(rule.ruleId)) {
                            // Atualizar existente
                            await pool.query(`
                UPDATE combo_discount_rules
                SET 
                  min_services = $1,
                  discount_percentage = $2,
                  description = $3,
                  is_active = COALESCE($4, true),
                  updated_at = now()
                WHERE rule_id = $5
                `, [
                                rule.minServices,
                                rule.discountPercentage,
                                rule.description || null,
                                rule.isActive !== undefined ? rule.isActive : true,
                                rule.ruleId,
                            ]);
                            existingRuleIds.delete(rule.ruleId);
                        }
                        else {
                            // Criar novo
                            await pool.query(`
                INSERT INTO combo_discount_rules (
                  global_user_id, category_id, min_services, discount_percentage, description, is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                                globalUserId,
                                skill.categoryId,
                                rule.minServices,
                                rule.discountPercentage,
                                rule.description || null,
                                rule.isActive !== undefined ? rule.isActive : true,
                            ]);
                        }
                    }
                    // Remover regras que não foram enviadas (desativar)
                    if (existingRuleIds.size > 0) {
                        await pool.query(`
              UPDATE combo_discount_rules
              SET is_active = false, updated_at = now()
              WHERE rule_id = ANY($1)
              `, [Array.from(existingRuleIds)]);
                    }
                }
            }
        }
        // Atualizar educação no metadata do global_user
        if (input.education !== undefined) {
            const updatedMetadata = {
                ...currentMetadata,
                education: input.education.map((edu, idx) => ({
                    educationId: edu.educationId || `edu-${Date.now()}-${idx}`,
                    level: edu.level,
                    institution: edu.institution,
                    course: edu.course,
                    field: edu.field,
                    startDate: edu.startDate,
                    endDate: edu.endDate,
                    isCompleted: edu.isCompleted,
                    description: edu.description,
                })),
            };
            await pool.query(`
        UPDATE global_users
        SET metadata = $1, updated_at = now()
        WHERE global_user_id = $2
        `, [JSON.stringify(updatedMetadata), globalUserId]);
        }
        // Criar ou atualizar worker
        // 🔴 CORREÇÃO: WHERE tenant_id = $1 AND user_id = $2 + ORDER BY para garantir registro mais recente
        const workerExists = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT worker_id
      FROM workers
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY updated_at DESC
      LIMIT 1
      `, [tenantId, userId]);
        if (workerExists) {
            // Atualizar worker existente (sem hourly_rate, pois agora é por profissão)
            // 🔴 CORREÇÃO: WHERE tenant_id = $4 AND user_id = $5 para garantir isolamento multi-tenant
            await (0, pool_1.runQueryWithTenant)(tenantId, `
        UPDATE workers
        SET
          bio = COALESCE($1, bio),
          availability = COALESCE($2, availability),
          updated_at = now()
        WHERE tenant_id = $3 AND user_id = $4
        `, [
                input.bio ?? null,
                input.availability ? JSON.stringify(input.availability) : null,
                tenantId,
                userId,
            ]);
        }
        else {
            // Criar novo worker (sem hourly_rate, pois agora é por profissão)
            await (0, pool_1.runQueryWithTenant)(tenantId, `
        INSERT INTO workers (
          tenant_id, user_id, bio, availability
        )
        VALUES ($1, $2, $3, $4)
        `, [
                tenantId,
                userId,
                input.bio ?? null,
                input.availability ? JSON.stringify(input.availability) : null,
            ]);
        }
        // Retornar perfil atualizado
        const updated = await this.getProfessionalProfile(tenantId, userId);
        if (!updated) {
            throw new Error('Erro ao atualizar perfil profissional');
        }
        return updated;
    }
}
exports.profileProfessionalService = new ProfileProfessionalService();
//# sourceMappingURL=profile-professional.service.js.map