// backend/src/modules/business-audit/business-audit.helpers.ts
// Helpers para criar logs de auditoria de forma não bloqueante
// 🔴 BLINDAGEM: NÃO muda estado
// 🔴 BLINDAGEM: NÃO dispara ações

import { businessAuditLogService } from './business-audit.service';
import type { BusinessAuditAction, BusinessAuditContextType } from './business-audit.types';

/**
 * Criar log de auditoria de forma não bloqueante
 * Se falhar, apenas loga o erro sem quebrar o fluxo principal
 */
export async function recordBusinessAuditSafely(
  tenantId: string,
  input: {
    action: BusinessAuditAction;
    actorId: string;
    userId?: string | null;
    contextType: BusinessAuditContextType;
    contextId: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    await businessAuditLogService.createLog(tenantId, input);
  } catch (error) {
    // Não bloquear fluxo principal se auditoria falhar
    console.error('Erro ao criar log de auditoria (não bloqueante):', error);
  }
}




