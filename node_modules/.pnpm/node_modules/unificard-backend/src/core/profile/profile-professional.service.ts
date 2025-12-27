// src/core/profile/profile-professional.service.ts
// Serviço para gerenciar perfil profissional do usuário

import { runQueryWithTenant } from '@core/database/pool';
import { categoriesService } from '../categories/categories.service';
import { identityService } from '../identity/identity.service';
import type {
  ProfessionalProfile,
  ProfessionalSkill,
  UpdateProfessionalProfileInput,
  AvailabilitySchedule,
  EducationEntry,
} from './profile-professional.types';

class ProfileProfessionalService {
  /**
   * Busca perfil profissional do usuário
   */
  async getProfessionalProfile(
    tenantId: string,
    userId: string
  ): Promise<ProfessionalProfile | null> {
    // Buscar globalUserId
    const identity = await identityService.getIdentityProfile(userId, tenantId);
    if (!identity || !identity.global.globalUserId) {
      return null;
    }

    const globalUserId = identity.global.globalUserId;

    // Buscar metadata do global_user para educação
    const { pool } = await import('@core/database/pool');
    // 🔴 CORREÇÃO: ORDER BY updated_at DESC para garantir registro mais recente
    const userMetadataRow = await pool.query<{ metadata: any }>(
      `
      SELECT metadata
      FROM global_users
      WHERE global_user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [globalUserId]
    );
    const metadata = userMetadataRow.rows[0]?.metadata || {};

    // Buscar skills do usuário
    const skillsRows = await pool.query<{
      category_id: string;
      skill_level: number;
      years_experience: number;
      hourly_rate: number | null;
      pricing_type: string;
      service_type: string;
      charge_visit: boolean;
      visit_price: number | null;
    }>(
      `
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
      `,
      [globalUserId]
    );

    // Buscar serviços pré-definidos
    const predefinedServicesRows = await pool.query<{
      service_id: string;
      category_id: string;
      name: string;
      description: string | null;
      base_price: number;
      discount_percentage: number | null;
      final_price: number;
      is_active: boolean;
    }>(
      `
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
      `,
      [globalUserId]
    );

    // Buscar regras de desconto para combos
    const comboDiscountRulesRows = await pool.query<{
      rule_id: string;
      category_id: string;
      min_services: number;
      discount_percentage: number;
      description: string | null;
      is_active: boolean;
    }>(
      `
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
      `,
      [globalUserId]
    );

    // Buscar informações das categorias
    const skills = await Promise.all(
      skillsRows.rows.map(async (row) => {
        const category = await categoriesService.getCategoryById(row.category_id);
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
          pricingType: (row.pricing_type || 'hourly') as 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quote',
          serviceType: (row.service_type === 'product' ? 'product' : 'service') as 'service' | 'product',
          chargeVisit: row.charge_visit || false,
          visitPrice: row.visit_price ? Number(row.visit_price) : null,
          predefinedServices: predefinedServices.length > 0 ? predefinedServices : undefined,
          comboDiscountRules: comboDiscountRules.length > 0 ? comboDiscountRules : undefined,
          verified: false, // Por enquanto sempre false, pode ser implementado depois
        };
      })
    );

    // Buscar dados do worker (se existir)
    const workerRow = await runQueryWithTenant<{
      bio: string | null;
      availability: any;
    }>(
      tenantId,
      `
      SELECT bio, availability
      FROM workers
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [tenantId, userId]
    );

    // Buscar educação (armazenada no metadata do global_user ou worker)
    const educationMetadata = metadata.education || [];
    const education: EducationEntry[] = Array.isArray(educationMetadata)
      ? educationMetadata.map((edu: any, idx: number) => ({
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
  async updateProfessionalProfile(
    tenantId: string,
    userId: string,
    input: UpdateProfessionalProfileInput
  ): Promise<ProfessionalProfile> {
    // Buscar globalUserId
    const identity = await identityService.getIdentityProfile(userId, tenantId);
    if (!identity || !identity.global.globalUserId) {
      throw new Error('Identidade do usuário não encontrada');
    }

    const globalUserId = identity.global.globalUserId;

    // Buscar metadata atual do global_user
    // 🔴 NOTA: global_users não tem RLS, então não precisa de tenant_id no WHERE
    // Mas adicionamos ORDER BY updated_at DESC como garantia de registro mais recente
    const { pool } = await import('@core/database/pool');
    const currentUserRow = await pool.query<{ metadata: any }>(
      `
      SELECT metadata
      FROM global_users
      WHERE global_user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [globalUserId]
    );
    const currentMetadata = currentUserRow.rows[0]?.metadata || {};

    // Atualizar skills
    if (input.skills) {
      // Remover skills antigas
      await pool.query(
        `
        DELETE FROM user_skills_categories
        WHERE global_user_id = $1
        `,
        [globalUserId]
      );

      // Inserir novas skills com valores por profissão
      for (const skill of input.skills) {
        await categoriesService.assignSkillToUser(globalUserId, {
          categoryId: skill.categoryId,
          skillLevel: skill.skillLevel || 0,
          yearsExperience: skill.yearsExperience || 0,
        });

        // Atualizar campos adicionais
        const updates: string[] = [];
        const values: any[] = [];
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
          await pool.query(
            `
            UPDATE user_skills_categories
            SET ${updates.join(', ')}, updated_at = now()
            WHERE global_user_id = $${paramIdx} AND category_id = $${paramIdx + 1}
            `,
            values
          );
        }

        // Gerenciar serviços pré-definidos
        if (skill.predefinedServices !== undefined) {
          // Buscar serviços existentes
          const existingServices = await pool.query<{ service_id: string }>(
            `
            SELECT service_id
            FROM predefined_services
            WHERE global_user_id = $1 AND category_id = $2
            `,
            [globalUserId, skill.categoryId]
          );
          const existingIds = new Set(existingServices.rows.map(r => r.service_id));

          // Atualizar ou criar serviços
          for (const predefinedService of skill.predefinedServices) {
            if (predefinedService.serviceId && existingIds.has(predefinedService.serviceId)) {
              // Atualizar existente
              await pool.query(
                `
                UPDATE predefined_services
                SET 
                  name = $1,
                  description = $2,
                  base_price = $3,
                  discount_percentage = $4,
                  is_active = COALESCE($5, true),
                  updated_at = now()
                WHERE service_id = $6
                `,
                [
                  predefinedService.name,
                  predefinedService.description || null,
                  predefinedService.basePrice,
                  predefinedService.discountPercentage || null,
                  predefinedService.isActive !== undefined ? predefinedService.isActive : true,
                  predefinedService.serviceId,
                ]
              );
              existingIds.delete(predefinedService.serviceId);
            } else {
              // Criar novo
              await pool.query(
                `
                INSERT INTO predefined_services (
                  global_user_id, category_id, name, description, base_price, discount_percentage, is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                `,
                [
                  globalUserId,
                  skill.categoryId,
                  predefinedService.name,
                  predefinedService.description || null,
                  predefinedService.basePrice,
                  predefinedService.discountPercentage || null,
                  predefinedService.isActive !== undefined ? predefinedService.isActive : true,
                ]
              );
            }
          }

          // Remover serviços que não foram enviados (desativar)
          if (existingIds.size > 0) {
            await pool.query(
              `
              UPDATE predefined_services
              SET is_active = false, updated_at = now()
              WHERE service_id = ANY($1)
              `,
              [Array.from(existingIds)]
            );
          }
        }

        // Gerenciar regras de desconto para combos
        if (skill.comboDiscountRules !== undefined) {
          // Buscar regras existentes
          const existingRules = await pool.query<{ rule_id: string }>(
            `
            SELECT rule_id
            FROM combo_discount_rules
            WHERE global_user_id = $1 AND category_id = $2
            `,
            [globalUserId, skill.categoryId]
          );
          const existingRuleIds = new Set(existingRules.rows.map(r => r.rule_id));

          // Atualizar ou criar regras
          for (const rule of skill.comboDiscountRules) {
            if (rule.ruleId && existingRuleIds.has(rule.ruleId)) {
              // Atualizar existente
              await pool.query(
                `
                UPDATE combo_discount_rules
                SET 
                  min_services = $1,
                  discount_percentage = $2,
                  description = $3,
                  is_active = COALESCE($4, true),
                  updated_at = now()
                WHERE rule_id = $5
                `,
                [
                  rule.minServices,
                  rule.discountPercentage,
                  rule.description || null,
                  rule.isActive !== undefined ? rule.isActive : true,
                  rule.ruleId,
                ]
              );
              existingRuleIds.delete(rule.ruleId);
            } else {
              // Criar novo
              await pool.query(
                `
                INSERT INTO combo_discount_rules (
                  global_user_id, category_id, min_services, discount_percentage, description, is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                `,
                [
                  globalUserId,
                  skill.categoryId,
                  rule.minServices,
                  rule.discountPercentage,
                  rule.description || null,
                  rule.isActive !== undefined ? rule.isActive : true,
                ]
              );
            }
          }

          // Remover regras que não foram enviadas (desativar)
          if (existingRuleIds.size > 0) {
            await pool.query(
              `
              UPDATE combo_discount_rules
              SET is_active = false, updated_at = now()
              WHERE rule_id = ANY($1)
              `,
              [Array.from(existingRuleIds)]
            );
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

      await pool.query(
        `
        UPDATE global_users
        SET metadata = $1, updated_at = now()
        WHERE global_user_id = $2
        `,
        [JSON.stringify(updatedMetadata), globalUserId]
      );
    }

    // Criar ou atualizar worker
    // 🔴 CORREÇÃO: WHERE tenant_id = $1 AND user_id = $2 + ORDER BY para garantir registro mais recente
    const workerExists = await runQueryWithTenant<{ worker_id: string }>(
      tenantId,
      `
      SELECT worker_id
      FROM workers
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [tenantId, userId]
    );

    if (workerExists) {
      // Atualizar worker existente (sem hourly_rate, pois agora é por profissão)
      // 🔴 CORREÇÃO: WHERE tenant_id = $4 AND user_id = $5 para garantir isolamento multi-tenant
      await runQueryWithTenant(
        tenantId,
        `
        UPDATE workers
        SET
          bio = COALESCE($1, bio),
          availability = COALESCE($2, availability),
          updated_at = now()
        WHERE tenant_id = $3 AND user_id = $4
        `,
        [
          input.bio ?? null,
          input.availability ? JSON.stringify(input.availability) : null,
          tenantId,
          userId,
        ]
      );
    } else {
      // Criar novo worker (sem hourly_rate, pois agora é por profissão)
      await runQueryWithTenant(
        tenantId,
        `
        INSERT INTO workers (
          tenant_id, user_id, bio, availability
        )
        VALUES ($1, $2, $3, $4)
        `,
        [
          tenantId,
          userId,
          input.bio ?? null,
          input.availability ? JSON.stringify(input.availability) : null,
        ]
      );
    }

    // Retornar perfil atualizado
    const updated = await this.getProfessionalProfile(tenantId, userId);
    if (!updated) {
      throw new Error('Erro ao atualizar perfil profissional');
    }

    return updated;
  }
}

export const profileProfessionalService = new ProfileProfessionalService();

