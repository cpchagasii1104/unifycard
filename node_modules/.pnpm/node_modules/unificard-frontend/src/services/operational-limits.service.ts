// frontend/src/services/operational-limits.service.ts
// CONTINUOUS PRODUCTION: Serviço de Detecção de Limites Operacionais - SPRINT 6
// Infere limites a partir de dados existentes (sem criar backend novo)

import type { OperationalState, ActionType, OperationalSeverity } from '../types/operational-state';
import { listCompanies } from '../api/companies';
import { listCompanyMembers, CompanyMemberStatus } from '../api/companyMembers';
import { getBankBalance } from '../api/bank';
import { getUserGroupAllocations } from '../api/group-allocation';
import { getMyGroups } from '../api/groups';
import { detectPendingActions } from './pending-actions.service';

interface OperationalContext {
  actorId: string;
  actorType: 'user' | 'page' | 'group' | 'project';
  userId?: string;
  companyId?: string; // Para ações de empresa
}

/**
 * Verifica o estado operacional para uma ação específica
 */
export async function checkOperationalState(
  actionType: ActionType,
  context: OperationalContext
): Promise<OperationalState> {
  try {
    switch (actionType) {
      case 'create_service':
        return await checkCreateService(context);
      case 'create_event':
        return await checkCreateEvent(context);
      case 'invite_member':
        return await checkInviteMember(context);
      case 'manage_financial':
        return await checkManageFinancial(context);
      case 'receive_payment':
        return await checkReceivePayment(context);
      case 'publish_feed':
        return await checkPublishFeed(context);
      case 'create_group':
        return await checkCreateGroup(context);
      case 'allocate_groups':
        return await checkAllocateGroups(context);
      case 'transfer_money':
        return await checkTransferMoney(context);
      case 'create_company':
        return await checkCreateCompany(context);
      default:
        return {
          canPerform: true,
          reason: 'Ação não verificada',
          severity: 'info',
        };
    }
  } catch (error) {
    console.warn('Erro ao verificar estado operacional:', error);
    // Em caso de erro, permitir (backend vai validar)
    return {
      canPerform: true,
      reason: 'Não foi possível verificar limites',
      severity: 'info',
    };
  }
}

/**
 * Verifica se pode criar serviço
 * Limite: Empresa precisa ter pelo menos um membro
 */
async function checkCreateService(context: OperationalContext): Promise<OperationalState> {
  if (context.actorType !== 'page') {
    return {
      canPerform: false,
      reason: 'Serviços só podem ser criados por empresas',
      severity: 'blocking',
    };
  }

  if (!context.companyId) {
    return {
      canPerform: false,
      reason: 'Empresa não identificada',
      severity: 'blocking',
    };
  }

  try {
    const members = await listCompanyMembers(context.companyId).catch(() => []);
    // Verificar se há pelo menos um membro ativo
    const activeMembers = members.filter(m => m.status === 'active');
    if (activeMembers.length === 0) {
      return {
        canPerform: false,
        reason: 'Esta empresa não possui colaboradores ativos. Adicione membros da equipe antes de criar serviços.',
        severity: 'blocking',
        suggestion: 'Convide colaboradores na aba "Equipe & Permissões"',
      };
    }

    return {
      canPerform: true,
    };
  } catch {
    // Se não conseguir verificar, permitir (backend vai validar)
    return {
      canPerform: true,
    };
  }
}

/**
 * Verifica se pode criar evento
 * Limite: Actor precisa ter capability de publicar
 */
async function checkCreateEvent(context: OperationalContext): Promise<OperationalState> {
  // Por enquanto, permitir para todos (backend vai validar capabilities)
  // Futuramente, podemos verificar capabilities do actor_registry
  return {
    canPerform: true,
  };
}

/**
 * Verifica se pode convidar membro
 * Limite: Empresa precisa existir e usuário precisa ter permissão
 */
async function checkInviteMember(context: OperationalContext): Promise<OperationalState> {
  if (context.actorType !== 'page' || !context.companyId) {
    return {
      canPerform: false,
      reason: 'Convites só podem ser enviados por empresas',
      severity: 'blocking',
    };
  }

  // Verificar se empresa existe (já temos companyId, então assumimos que existe)
  // Backend vai validar permissão
  return {
    canPerform: true,
  };
}

/**
 * Verifica se pode gerenciar financeiro
 * Limite: Actor precisa ter capability financeira
 */
async function checkManageFinancial(context: OperationalContext): Promise<OperationalState> {
  // Por enquanto, permitir (backend vai validar via permissions)
  // Futuramente, podemos verificar capabilities do actor_registry
  return {
    canPerform: true,
  };
}

/**
 * Verifica se pode receber pagamento
 * Limite: Actor precisa ter capability de receber fundos
 */
async function checkReceivePayment(context: OperationalContext): Promise<OperationalState> {
  // Verificar se actor tem conta bancária ativa
  try {
    const balance = await getBankBalance().catch(() => null);
    // Se não conseguir obter saldo, pode indicar que não há conta
    // Mas não vamos bloquear apenas por isso (pode ser erro de API)
    return {
      canPerform: true,
    };
  } catch {
    return {
      canPerform: true,
    };
  }
}

/**
 * Verifica se pode publicar no feed
 * Limite: Actor precisa ter capability de publicar
 */
async function checkPublishFeed(context: OperationalContext): Promise<OperationalState> {
  // Por enquanto, permitir (backend vai validar via permissions)
  return {
    canPerform: true,
  };
}

/**
 * Verifica se pode criar grupo
 */
async function checkCreateGroup(context: OperationalContext): Promise<OperationalState> {
  // Sem limites conhecidos no frontend
  return {
    canPerform: true,
  };
}

/**
 * Verifica se pode alocar grupos
 * Limite: Usuário precisa ter grupos
 */
async function checkAllocateGroups(context: OperationalContext): Promise<OperationalState> {
  if (context.actorType !== 'user') {
    return {
      canPerform: false,
      reason: 'Alocação de grupos só está disponível para usuários',
      severity: 'blocking',
    };
  }

  try {
    const groups = await getMyGroups().catch(() => ({ groups: [] }));
    if (groups.groups.length === 0) {
      return {
        canPerform: false,
        reason: 'Você precisa participar de grupos antes de configurar alocação',
        severity: 'attention',
        suggestion: 'Explore grupos disponíveis ou crie um novo grupo',
      };
    }

    return {
      canPerform: true,
    };
  } catch {
    return {
      canPerform: true,
    };
  }
}

/**
 * Verifica se pode transferir dinheiro
 * Limite: Saldo suficiente
 */
async function checkTransferMoney(context: OperationalContext): Promise<OperationalState> {
  try {
    const balance = await getBankBalance().catch(() => null);
    if (balance === null) {
      return {
        canPerform: true, // Não bloquear se não conseguir verificar
      };
    }

    if ((balance as any).balance <= 0) {
      return {
        canPerform: false,
        reason: 'Saldo insuficiente para realizar transferência',
        severity: 'blocking',
        suggestion: 'Adicione fundos à sua conta antes de transferir',
      };
    }

    return {
      canPerform: true,
    };
  } catch {
    return {
      canPerform: true,
    };
  }
}

/**
 * Verifica se pode criar empresa
 */
async function checkCreateCompany(context: OperationalContext): Promise<OperationalState> {
  // Sem limites conhecidos no frontend
  return {
    canPerform: true,
  };
}

/**
 * Verifica se há pendências bloqueantes que impedem uma ação
 */
export async function checkBlockingPendingActions(
  context: OperationalContext
): Promise<OperationalState | null> {
  try {
    const pendingActions = await detectPendingActions({
      actorId: context.actorId,
      actorType: context.actorType,
      userId: context.userId,
    });

    const blockingAction = pendingActions.find((a) => a.severity === 'blocking');
    if (blockingAction) {
      return {
        canPerform: false,
        reason: blockingAction.message,
        severity: 'blocking',
        suggestion: blockingAction.action?.label,
      };
    }

    return null;
  } catch {
    return null;
  }
}







