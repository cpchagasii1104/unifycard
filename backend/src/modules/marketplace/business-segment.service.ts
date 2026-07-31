// backend/src/modules/marketplace/business-segment.service.ts
// SPRINT 81: Service para Business Segments

import { businessSegmentRepository } from './business-segment.repository';
import type { BusinessSegment, SetBusinessSegmentInput, ModuleKey } from './business-segment.types';
import { SUGGESTED_MODULES_BY_SEGMENT } from './business-segment.types';

/**
 * Service para Business Segments
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Segmento ≠ permissão
 * - Segmento ≠ papel
 * - Segmento define:
 *   - Módulos visíveis
 *   - Fluxos esperados
 * - Nenhuma lógica automática
 * - Apenas configuração estrutural
 */
class BusinessSegmentService {
  /**
   * Define segmento de negócio
   * 
   * SPRINT 81: Apenas 1 segmento por tenant
   */
  async setSegment(
    tenantId: string,
    input: SetBusinessSegmentInput,
    updatedByUserId: string
  ): Promise<BusinessSegment> {
    // Fase 4b (DECISION-0166 D9): o gate antigo lia company_profiles (tabela FANTASMA —
    // este caminho SEMPRE quebrava em runtime). Gate agora é a casa canônica: exige perfil
    // fiscal ativo configurado (fiscal_config_missing fail-closed, honesto).
    const { fiscalProfileRepository } = await import('../fiscal/fiscal-profile.repository');
    const fiscalProfile = await fiscalProfileRepository.getActiveProfileForTenant(tenantId);
    if (!fiscalProfile) {
      throw new Error(
        'fiscal_config_missing: perfil fiscal não configurado (actor_fiscal_profiles). ' +
          'Configure o enquadramento (contador/empresa) antes de definir o segmento.'
      );
    }

    // Se enabledModules não fornecido, usar sugestões do segmento
    const enabledModules = input.enabledModules || SUGGESTED_MODULES_BY_SEGMENT[input.segmentType];

    const segment = await businessSegmentRepository.setSegment(
      tenantId,
      tenantId, // company_profile_tenant_id = tenant_id (1:1)
      {
        ...input,
        enabledModules,
      }
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'BUSINESS_SEGMENT_SET',
      segmentId: segment.id,
      segmentType: segment.segmentType,
      updatedByUserId,
    });

    return segment;
  }

  /**
   * Busca segmento de negócio
   */
  async getSegment(tenantId: string): Promise<BusinessSegment | null> {
    return await businessSegmentRepository.getSegment(tenantId);
  }

  /**
   * Atualiza segmento de negócio
   */
  async updateSegment(
    tenantId: string,
    input: Partial<SetBusinessSegmentInput>,
    updatedByUserId: string
  ): Promise<BusinessSegment> {
    // Buscar segmento existente
    const existing = await businessSegmentRepository.getSegment(tenantId);
    if (!existing) {
      throw new Error('Business segment não encontrado. Use setSegment para criar.');
    }

    // Mesclar com valores existentes
    const updateInput: SetBusinessSegmentInput = {
      segmentType: input.segmentType ?? existing.segmentType,
      enabledModules: input.enabledModules ?? existing.enabledModules,
      metadata: input.metadata ?? existing.metadata,
    };

    const segment = await businessSegmentRepository.setSegment(
      tenantId,
      existing.companyProfileTenantId,
      updateInput
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'BUSINESS_SEGMENT_UPDATED',
      segmentId: segment.id,
      segmentType: segment.segmentType,
      updatedByUserId,
    });

    return segment;
  }

  /**
   * Verifica se módulo está habilitado
   */
  async isModuleEnabled(tenantId: string, moduleKey: ModuleKey): Promise<boolean> {
    const segment = await this.getSegment(tenantId);
    if (!segment) {
      // Se não tem segmento, todos os módulos estão disponíveis (compatibilidade)
      return true;
    }

    return segment.enabledModules.includes(moduleKey);
  }

  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      segmentId: string;
      segmentType: string;
      updatedByUserId: string;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'INFO',
        actor_id: data.updatedByUserId,
        actor_type: 'user',
        source: 'validation',
        context: {
          segment_id: data.segmentId,
          segment_type: data.segmentType,
          updated_by_user_id: data.updatedByUserId,
        },
      });
    } catch (error) {
      console.warn('[BusinessSegment] Erro ao registrar auditoria:', error);
    }
  }
}

export const businessSegmentService = new BusinessSegmentService();





