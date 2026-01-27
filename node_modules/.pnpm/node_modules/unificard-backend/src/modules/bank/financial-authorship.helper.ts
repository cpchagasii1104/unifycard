// backend/src/modules/bank/financial-authorship.helper.ts
// CORE DE PERMISSÕES FINANCEIRAS — FASE 2
// Helper centralizado para construir contexto de autoria financeira

import type {
  FinancialAuthorshipContext,
  PermissionSnapshot,
  PolicySnapshot,
  FinancialAuthoritySource,
} from './financial-authorship.types';

/**
 * Constrói contexto de autoria financeira a partir de um request autenticado
 * 
 * Este helper padroniza a criação de autoria em todos os call sites,
 * garantindo que toda operação financeira tenha rastreabilidade completa.
 * 
 * @param params - Parâmetros para construir autoria
 * @returns Contexto de autoria completo
 */
export function buildFinancialAuthorshipFromRequest(params: {
  /**
   * ID do usuário que executou a operação (quem fez)
   * NULL apenas para operações do sistema (authoritySource='system')
   */
  performedByUserId: string | null;

  /**
   * ID do actor em nome do qual a operação foi executada (em nome de quem)
   * Geralmente o mesmo que o dono da conta origem
   */
  actingForActorId: string;

  /**
   * ID da conta em nome da qual a operação foi executada
   * OBRIGATÓRIO segundo Core Canônico
   */
  actingForAccountId: string;

  /**
   * Fonte da autoridade
   * - ownership: dono da conta
   * - delegation: delegação explícita
   * - account_acl: permissão explícita via ACL da conta
   * - system: operação do sistema (jobs, processos internos)
   */
  authoritySource: FinancialAuthoritySource;

  /**
   * Snapshot de permissão (OBRIGATÓRIO - NOT NULL no banco)
   */
  permissionSnapshot: PermissionSnapshot;

  /**
   * Snapshot de policy (opcional, será mínimo se não fornecido)
   */
  policySnapshot?: PolicySnapshot;
}): FinancialAuthorshipContext {
  const {
    performedByUserId,
    actingForActorId,
    actingForAccountId,
    authoritySource,
    permissionSnapshot,
    policySnapshot,
  } = params;

  // Validar que actingForAccountId não está vazio
  if (!actingForAccountId) {
    throw new Error('FINANCIAL_AUTHORSHIP_REQUIRED: actingForAccountId is mandatory');
  }

  // permissionSnapshot é OBRIGATÓRIO (NOT NULL no banco)
  if (!permissionSnapshot) {
    throw new Error('Financial authorship requires permissionSnapshot. It is mandatory.');
  }

  // Construir snapshot mínimo de policy se não fornecido (policySnapshot é opcional)
  const effectivePolicySnapshot: PolicySnapshot = policySnapshot || {
    policyKeyResolved: null,
    decidedAt: new Date().toISOString(),
  };

  return {
    performedByUserId,
    actingForActorId,
    actingForAccountId,
    authoritySource,
    permissionSnapshot, // OBRIGATÓRIO
    policySnapshot: effectivePolicySnapshot,
  };
}

/**
 * Constrói autoria para operações do sistema (jobs, rotinas internas)
 * 
 * @param params - Parâmetros para autoria do sistema
 * @returns Contexto de autoria com authoritySource='system'
 */
export function buildSystemAuthorship(params: {
  /**
   * ID da conta afetada (obrigatório mesmo para sistema)
   */
  actingForAccountId: string;

  /**
   * ID do actor afetado (opcional, pode ser 'system')
   */
  actingForActorId?: string;

  /**
   * Snapshot de policy (opcional)
   */
  policySnapshot?: PolicySnapshot;
}): FinancialAuthorshipContext {
  return buildFinancialAuthorshipFromRequest({
    performedByUserId: null, // Sistema não tem user (CHECK constraint garante isso)
    actingForActorId: params.actingForActorId || 'system',
    actingForAccountId: params.actingForAccountId,
    authoritySource: 'system',
    permissionSnapshot: {
      permissionKey: 'system',
      allowed: true,
      reason: 'System operation (job/internal routine)',
      actorId: params.actingForActorId || 'system',
      userId: 'system',
      decidedAt: new Date().toISOString(),
    },
    policySnapshot: params.policySnapshot || {
      policyKeyResolved: null,
      decidedAt: new Date().toISOString(),
    },
  });
}

