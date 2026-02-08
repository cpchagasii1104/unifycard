// backend/src/modules/business-audit/business-audit.service.ts
// Service para Auditoria de Negócio
// 🔴 BLINDAGEM: Logs são IMUTÁVEIS (append-only)
// 🔴 BLINDAGEM: Logs NÃO mudam estado
// 🔴 BLINDAGEM: Logs NÃO disparam ações

import { businessAuditLogRepository } from './business-audit.repository';
import { NotFoundError } from '@core/errors';
import type {
  BusinessAuditLog,
  CreateBusinessAuditLogInput,
  BusinessAuditLogFilters,
} from './business-audit.types';

class BusinessAuditLogService {
  /**
   * Criar log de auditoria
   * 🔴 BLINDAGEM: Não bloqueia fluxo principal - apenas registra
   */
  async createLog(
    tenantId: string,
    input: CreateBusinessAuditLogInput
  ): Promise<BusinessAuditLog> {
    return await businessAuditLogRepository.create(tenantId, input);
  }

  /**
   * Buscar log por ID
   */
  async getLogById(tenantId: string, logId: string): Promise<BusinessAuditLog> {
    const log = await businessAuditLogRepository.findById(tenantId, logId);
    if (!log) {
      throw new NotFoundError(`Log de auditoria não encontrado: ${logId}`);
    }
    return log;
  }

  /**
   * Listar logs com filtros
   */
  async listLogs(
    tenantId: string,
    filters: BusinessAuditLogFilters = {}
  ): Promise<{ logs: BusinessAuditLog[]; totalCents: number }> {
    return await businessAuditLogRepository.find(tenantId, filters);
  }
}

export const businessAuditLogService = new BusinessAuditLogService();





