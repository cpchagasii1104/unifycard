// src/core/profile/profile-professional.service.ts
// Serviço para gerenciar perfil profissional do usuário

import { runQueryWithTenant } from '@core/database/pool';
import { categoriesService } from '../categories/categories.service';
import { HttpError } from '../errors/http-error';
import { identityService } from '../identity/identity.service';
import { resolveProfessionalSkillCategoriesStrict } from './category-navigation-bridge';
import type {
  ProfessionalProfile,
  ProfessionalSkill,
  UpdateProfessionalProfileInput,
  AvailabilitySchedule,
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
    // 🔴 CORREÇÃO: ORDER BY updatedAt DESC para garantir registro mais recente
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

    const skills: ProfessionalSkill[] = [];

    for (const row of skillsRows.rows) {
      if (!row.category_id) {
        throw HttpError.badRequest(
          'Perfil profissional: registro em user_skills_categories sem category_id (dados corruptos).',
        );
      }
    }

    const skillCategoryIds = skillsRows.rows.map((r) => r.category_id);
    const categoryById =
      skillCategoryIds.length > 0
        ? await resolveProfessionalSkillCategoriesStrict(pool, skillCategoryIds)
        : new Map();

    for (const row of skillsRows.rows) {
      const cid = row.category_id as string;
      const category = categoryById.get(cid);
      if (!category) {
        throw HttpError.internal('Perfil profissional: categoria ausente após validação estrita.');
      }

      const predefinedServices = predefinedServicesRows.rows
        .filter((ps) => ps.category_id === cid)
        .map((ps) => ({
          serviceId: ps.service_id,
          name: ps.name,
          description: ps.description || undefined,
          basePrice: Number(ps.base_price),
          discountPercentage: ps.discount_percentage ? Number(ps.discount_percentage) : undefined,
          finalPrice: Number(ps.final_price),
          isActive: ps.is_active,
        }));

      const comboRulesForSkill = comboDiscountRulesRows.rows
        .filter((rule) => rule.category_id === cid)
        .map((rule) => ({
          ruleId: rule.rule_id,
          minServices: rule.min_services,
          discountPercentage: Number(rule.discount_percentage),
          description: rule.description || undefined,
          isActive: rule.is_active,
        }));

      skills.push({
        categoryId: cid,
        categoryName: category.name,
        categoryPath: category.path,
        skillLevel: row.skill_level,
        yearsExperience: row.years_experience || 0,
        hourlyRate: row.hourly_rate ? Number(row.hourly_rate) : null,
        pricingType: (row.pricing_type || 'hourly') as 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quote',
        serviceType: (row.service_type === 'product' ? 'product' : 'service') as 'service' | 'product',
        chargeVisit: row.charge_visit || false,
        visitPrice: row.visit_price ? Number(row.visit_price) : null,
        predefinedServices: predefinedServices.length > 0 ? predefinedServices : undefined,
        comboDiscountRules: comboRulesForSkill.length > 0 ? comboRulesForSkill : undefined,
        isVerified: false,
      });
    }

    // Buscar dados do worker (se existir)
    // 🔴 FASE 2: availability aqui é INPUT DECLARATIVO, não verdade temporal
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

    return {
      globalUserId,
      skills,
      bio: workerRow?.bio || null,
      // 🔴 FASE 2: availability é INPUT DECLARATIVO — não bloqueia agenda, não resolve conflito, não cria booking
      // A verdade temporal está em Unified Availability (tabela `availability`)
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

    // 🔴 VALIDAÇÃO: Verificar se existem categorias profissionais disponíveis
    if (input.skills && input.skills.length > 0) {
      const { pool } = await import('@core/database/pool');
      const professionalCategoriesCount = await pool.query<{ count: string }>(
        `
        SELECT COUNT(*)::text as count
        FROM categories
        WHERE (scope = 'professional' OR scope = 'global')
          AND level <= 2
          AND is_active = true
        `
      );
      const count = parseInt(professionalCategoriesCount.rows[0]?.count || '0', 10);
      if (count === 0) {
        throw new Error('Sistema sem categorias profissionais disponíveis. Contate o administrador para configurar as categorias.');
      }
    }

    const { pool } = await import('@core/database/pool');

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
          // Validar que categoria tem scope profissional
          const category = await categoriesService.getCategoryById(skill.categoryId);
          if (!category || category.scope !== 'professional') {
            throw new Error('Categoria deve ter scope profissional para serviços');
          }
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
            // 🔴 DIAGNÓSTICO: Log detalhado do serviço recebido
            console.log('[ProfileProfessional] 🔍 Processando serviço:', {
              serviceId: predefinedService.serviceId,
              name: predefinedService.name,
              nameType: typeof predefinedService.name,
              nameLength: predefinedService.name?.length,
              nameCharCodes: predefinedService.name ? Array.from(predefinedService.name).map(c => c.charCodeAt(0)) : [],
              hasSpaces: predefinedService.name?.includes(' '),
              rawService: JSON.stringify(predefinedService)
            });
            
            // 🔴 VALIDAÇÃO: Garantir que o nome seja uma string válida e preserve espaços
            if (!predefinedService.name || typeof predefinedService.name !== 'string') {
              console.warn('[ProfileProfessional] Nome de serviço inválido ignorado:', predefinedService);
              continue;
            }
            
            // Preservar espaços internos, apenas remover espaços nas extremidades
            const serviceName = predefinedService.name.trim();
            if (serviceName.length === 0) {
              console.warn('[ProfileProfessional] Nome de serviço vazio após trim ignorado:', predefinedService);
              continue;
            }
            
            // 🔴 DIAGNÓSTICO: Log do nome após processamento
            console.log('[ProfileProfessional] 🔍 Nome processado:', {
              original: predefinedService.name,
              processed: serviceName,
              originalLength: predefinedService.name.length,
              processedLength: serviceName.length,
              originalHasSpaces: predefinedService.name.includes(' '),
              processedHasSpaces: serviceName.includes(' ')
            });
            
            if (predefinedService.serviceId && existingIds.has(predefinedService.serviceId)) {
              // Atualizar existente
              try {
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
                    serviceName, // Usar nome validado e trimado (preserva espaços internos)
                    predefinedService.description ? predefinedService.description.trim() : null,
                    predefinedService.basePrice,
                    predefinedService.discountPercentage || null,
                    predefinedService.isActive !== undefined ? predefinedService.isActive : true,
                    predefinedService.serviceId,
                  ]
                );
                existingIds.delete(predefinedService.serviceId);
                console.log('[ProfileProfessional] ✅ Serviço atualizado com sucesso:', { serviceId: predefinedService.serviceId, name: serviceName });
                
                // 🔴 VERIFICAÇÃO FINAL: Buscar o serviço atualizado para confirmar que o nome foi salvo corretamente
                const verifyResult = await pool.query<{ name: string }>(
                  `
                  SELECT name FROM predefined_services 
                  WHERE service_id = $1
                  LIMIT 1
                  `,
                  [predefinedService.serviceId]
                );
                
                if (verifyResult.rows.length > 0) {
                  const savedName = verifyResult.rows[0].name;
                  console.log('[ProfileProfessional] ✅ VERIFICAÇÃO: Nome salvo no banco após atualização:', {
                    original: predefinedService.name,
                    processed: serviceName,
                    saved: savedName,
                    match: serviceName === savedName,
                    originalLength: predefinedService.name.length,
                    savedLength: savedName.length,
                    originalHasSpaces: predefinedService.name.includes(' '),
                    savedHasSpaces: savedName.includes(' ')
                  });
                  
                  if (serviceName !== savedName) {
                    console.error('[ProfileProfessional] ❌ ERRO CRÍTICO: Nome salvo difere do processado após atualização!', {
                      expected: serviceName,
                      actual: savedName
                    });
                  }
                }
              } catch (error: any) {
                // 🔴 TRATAMENTO DE ERRO: Se for erro de constraint UNIQUE, logar detalhes
                if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate')) {
                  console.error('[ProfileProfessional] ❌ ERRO: Violação de constraint UNIQUE ao atualizar serviço:', {
                    serviceId: predefinedService.serviceId,
                    name: serviceName,
                    nameLength: serviceName.length,
                    nameCharCodes: Array.from(serviceName).map(c => c.charCodeAt(0)),
                    error: error.message,
                    errorCode: error.code
                  });
                  throw new Error(`Já existe um serviço com o nome "${serviceName}" nesta categoria`);
                }
                throw error;
              }
            } else {
              // Criar novo
              try {
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
                    serviceName, // Usar nome validado e trimado (preserva espaços internos)
                    predefinedService.description ? predefinedService.description.trim() : null,
                    predefinedService.basePrice,
                    predefinedService.discountPercentage || null,
                    predefinedService.isActive !== undefined ? predefinedService.isActive : true,
                  ]
                );
                console.log('[ProfileProfessional] ✅ Serviço criado com sucesso:', { name: serviceName });
                
                // 🔴 VERIFICAÇÃO FINAL: Buscar o serviço recém-criado para confirmar que o nome foi salvo corretamente
                const verifyResult = await pool.query<{ name: string }>(
                  `
                  SELECT name FROM predefined_services 
                  WHERE global_user_id = $1 AND category_id = $2 AND name = $3
                  LIMIT 1
                  `,
                  [globalUserId, skill.categoryId, serviceName]
                );
                
                if (verifyResult.rows.length > 0) {
                  const savedName = verifyResult.rows[0].name;
                  console.log('[ProfileProfessional] ✅ VERIFICAÇÃO: Nome salvo no banco:', {
                    original: predefinedService.name,
                    processed: serviceName,
                    saved: savedName,
                    match: serviceName === savedName,
                    originalLength: predefinedService.name.length,
                    savedLength: savedName.length,
                    originalHasSpaces: predefinedService.name.includes(' '),
                    savedHasSpaces: savedName.includes(' ')
                  });
                  
                  if (serviceName !== savedName) {
                    console.error('[ProfileProfessional] ❌ ERRO CRÍTICO: Nome salvo difere do processado!', {
                      expected: serviceName,
                      actual: savedName
                    });
                  }
                }
              } catch (error: any) {
                // 🔴 TRATAMENTO DE ERRO: Se for erro de constraint UNIQUE, logar detalhes
                if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate')) {
                  console.error('[ProfileProfessional] ❌ ERRO: Violação de constraint UNIQUE ao criar serviço:', {
                    name: serviceName,
                    nameLength: serviceName.length,
                    nameCharCodes: Array.from(serviceName).map(c => c.charCodeAt(0)),
                    categoryId: skill.categoryId,
                    error: error.message,
                    errorCode: error.code
                  });
                  throw new Error(`Já existe um serviço com o nome "${serviceName}" nesta categoria`);
                }
                throw error;
              }
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

    // Criar ou atualizar worker
    // 🔴 CORREÇÃO: WHERE tenant_id = $1 AND user_id = $2 + ORDER BY para garantir registro mais recente
    // 🔴 FASE 2: availability aqui é INPUT DECLARATIVO — não bloqueia agenda, não resolve conflito, não cria booking
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

    // 🔴 INPUT DECLARATIVO — availability é apenas INPUT, não verdade temporal
    // Preparar availability com cast explícito para JSONB
    // Garantir que sempre seja string JSON válida ou null explícito
    let availabilityValue: string | null = null;
    if (input.availability !== null && input.availability !== undefined) {
      // Validar que é um objeto válido (não array primitivo, não string, etc.)
      if (typeof input.availability === 'object' && !Array.isArray(input.availability)) {
        try {
          availabilityValue = JSON.stringify(input.availability);
          // Validar que o JSON é válido
          JSON.parse(availabilityValue);
        } catch (e) {
          // Se falhar ao stringify ou parse, logar e usar null
          console.warn(`[ProfileProfessional] Failed to stringify availability for user ${userId}:`, e);
          availabilityValue = null;
        }
      } else {
        // Se não for objeto válido, logar e usar null (validação defensiva)
        console.warn(`[ProfileProfessional] Invalid availability format for user ${userId}:`, input.availability);
        availabilityValue = null;
      }
    }

    // 🔴 LOGGING: Log payload antes do SQL para diagnóstico
    console.log(`[ProfileProfessional] Updating professional profile for user ${userId} with availability:`, {
      availabilityType: typeof input.availability,
      availabilityValue: availabilityValue ? availabilityValue.substring(0, 200) : null,
      availabilityIsNull: input.availability === null,
      availabilityIsUndefined: input.availability === undefined,
      workerExists: !!workerExists,
    });

    if (workerExists) {
      // Atualizar worker existente (sem hourly_rate, pois agora é por profissão)
      // 🔴 CORREÇÃO: WHERE tenant_id = $4 AND user_id = $5 para garantir isolamento multi-tenant
      // 🔴 FASE 2: availability armazenado como INPUT declarativo, não verdade temporal
      // 🔴 CORREÇÃO: Cast explícito ::jsonb para evitar erro "não foi possível determinar o tipo de dados do parâmetro $2"
      // Quando availabilityValue é null, usar COALESCE para manter o valor atual ou usar '{}'::jsonb como padrão
      await runQueryWithTenant(
        tenantId,
        `
        UPDATE workers
        SET
          bio = COALESCE($1, bio),
          availability = CASE 
            WHEN $2 IS NULL THEN availability 
            ELSE $2::jsonb 
          END,
          updated_at = now()
        WHERE tenant_id = $3 AND user_id = $4
        `,
        [
          input.bio ?? null,
          availabilityValue, // Pode ser null ou string JSON válida
          tenantId,
          userId,
        ]
      );
    } else {
      // Criar novo worker (sem hourly_rate, pois agora é por profissão)
      // 🔴 FASE 2: availability armazenado como INPUT declarativo, não verdade temporal
      // 🔴 CORREÇÃO: Cast explícito ::jsonb para evitar erro "não foi possível determinar o tipo de dados do parâmetro $4"
      // Quando availabilityValue é null, usar '{}'::jsonb como padrão (conforme schema DEFAULT '{}')
      await runQueryWithTenant(
        tenantId,
        `
        INSERT INTO workers (
          tenant_id, user_id, bio, availability
        )
        VALUES ($1, $2, $3, COALESCE($4::jsonb, '{}'::jsonb))
        `,
        [
          tenantId,
          userId,
          input.bio ?? null,
          availabilityValue ?? '{}', // Se null, usar '{}' para cast funcionar (será convertido para {}::jsonb)
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


