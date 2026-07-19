// frontend/src/handlers/action-handlers.ts
// CONTINUOUS PRODUCTION: Action Handlers - SPRINT 8
// Camada de execução de ações reais usando APIs existentes

import { observePilotEvent } from '../services/pilot-observer.service';

import { createCompany, type CreateCompanyInput } from '../api/companies';
// DECISION-0189 (F5): createCompanyMember morreu (410) — convite canônico em ../api/companyInvitations
import { setUserGroupAllocations, type GroupAllocation } from '../api/group-allocation';
import { getGroup } from '../api/groups';

export interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string; // Mensagem humana para o usuário
}

/**
 * Cria uma nova empresa
 */
export async function executeCreateCompany(
  input: CreateCompanyInput
): Promise<ActionResult> {
  try {
    const result = await createCompany(input);
    const company = result.company;

    // Observar primeiro evento de criação de empresa
    // Nota: actorId precisa ser obtido do contexto (useSession)
    // Por enquanto, observamos apenas quando empresa é criada
    observePilotEvent('first_company_created', (company as any).id || 'unknown', 'page');

    return {
      success: true,
      data: result,
      message: `Empresa "${(company as any).name || (company as any).tradeName}" criada com sucesso`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao criar empresa',
      message: error.message || 'Não foi possível criar a empresa. Verifique os dados e tente novamente.',
    };
  }
}

/**
 * Convida um membro para a empresa via CONVITE CANÔNICO (DECISION-0189 F5).
 * A criação direta de membro morreu (backend 410) — este handler agora emite convite
 * (permissões vêm do catálogo convidável; o servidor aplica os dois tetos).
 */
export async function executeInviteCompanyMember(
  companyId: string,
  input: { inviteeGlobalUserId: string; permissionKeys: string[] }
): Promise<ActionResult> {
  try {
    const { createCompanyInvitation } = await import('../api/companyInvitations');
    const invitation = await createCompanyInvitation(companyId, input);

    observePilotEvent('first_member_invited', companyId, 'page', {
      companyId,
    });

    return {
      success: true,
      data: invitation,
      message: 'Convite criado — envie o código de aceite ao colaborador',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao convidar colaborador',
      message: error.message || 'Não foi possível criar o convite. Verifique se você tem permissão.',
    };
  }
}

/**
 * Configura alocação de grupos
 */
export async function executeConfigureGroupAllocation(
  allocations: GroupAllocation[]
): Promise<ActionResult> {
  try {
    const result = await setUserGroupAllocations(allocations);
    
    // Observar primeiro evento de alocação de grupo
    // Nota: actorId precisa ser obtido do contexto (useSession)
    if (allocations.length > 0) {
      observePilotEvent('first_group_allocation', 'user', 'user', {
        groupsCount: allocations.length,
      });
    }
    
    // Carregar nomes dos grupos para mensagem
    const groupNames = await Promise.all(
      result.map(async (alloc) => {
        try {
          const group = await getGroup(alloc.groupId);
          return group.name;
        } catch {
          return alloc.groupId.substring(0, 8) + '...';
        }
      })
    );

    const totalPercentage = result.reduce((sum, a) => sum + (a.percentage * 100), 0);
    const message = result.length > 0
      ? `Alocação configurada: ${groupNames.join(', ')} (${totalPercentage.toFixed(1)}%)`
      : 'Alocação removida. Todo o lucro vai para o Fundo Regional.';

    return {
      success: true,
      data: result,
      message,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao configurar alocação',
      message: error.message || 'Não foi possível configurar a alocação. Verifique os dados e tente novamente.',
    };
  }
}

/**
 * Navega para visualizar extrato bancário
 * (Ação de visualização, não executa nada)
 */
export async function executeViewBankStatement(): Promise<ActionResult> {
  // Esta é uma ação de navegação, não precisa executar nada
  return {
    success: true,
    message: 'Redirecionando para extrato...',
  };
}







