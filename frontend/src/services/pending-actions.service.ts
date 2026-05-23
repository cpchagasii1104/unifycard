// frontend/src/services/pending-actions.service.ts
// CONTINUOUS PRODUCTION: Serviço de Detecção de Pendências - SPRINT 5
// Infere pendências reais a partir de dados existentes

import type { PendingAction, PendingActionSeverity } from '../types/pending-action';
import { listCompanies } from '../api/companies';
import { listCompanyMembers } from '../api/companyMembers';
import { getBankBalance } from '../api/bank';
import { getUserGroupAllocations } from '../api/group-allocation';
import { getMyGroups } from '../api/groups';

interface PendingActionsContext {
  actorId: string;
  actorType: 'user' | 'page' | 'group' | 'project';
  userId?: string;
}

/**
 * Detecta pendências para um actor específico
 */
export async function detectPendingActions(
  context: PendingActionsContext
): Promise<PendingAction[]> {
  const actions: PendingAction[] = [];

  try {
    if (context.actorType === 'user') {
      // Pendências para usuário (PF)
      const userActions = await detectUserPendingActions(context);
      actions.push(...userActions);
    } else if (context.actorType === 'page') {
      // Pendências para empresa
      const companyActions = await detectCompanyPendingActions(context);
      actions.push(...companyActions);
    }
  } catch (error) {
    console.warn('Erro ao detectar pendências:', error);
    // Não quebrar - retornar lista vazia se houver erro
  }

  // Ordenar por severidade (blocking > attention > info)
  return actions.sort((a, b) => {
    const severityOrder: Record<PendingActionSeverity, number> = {
      blocking: 3,
      attention: 2,
      info: 1,
    };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
}

/**
 * Detecta pendências para usuário (PF)
 */
async function detectUserPendingActions(
  context: PendingActionsContext
): Promise<PendingAction[]> {
  const actions: PendingAction[] = [];

  try {
    // 1. Verificar empresas sem colaboradores
    const companies = await listCompanies().catch(() => []);
    for (const company of companies) {
      try {
        const members = await listCompanyMembers(company.companyId).catch(() => []);
        if (members.length === 0) {
          actions.push({
            id: `company_no_members_${company.companyId}`,
            actorId: context.actorId,
            type: 'company_no_members',
            message: `A empresa "${company.companyName || company.tradeName || 'N/A'}" não possui colaboradores. Considere convidar membros da equipe.`,
            severity: 'attention',
            createdAt: new Date().toISOString(),
            action: {
              label: 'Gerenciar Equipe',
              path: `/empresa/${company.companyId}`,
            },
            metadata: { companyId: company.companyId, companyName: company.companyName },
          });
        }
      } catch {
        // Ignorar erro individual
      }
    }

    // 2. Verificar grupos sem alocação (se usuário tem grupos)
    const groups = await getMyGroups().catch(() => ({ groups: [] }));
    if (groups.groups.length > 0) {
      const allocations = await getUserGroupAllocations().catch(() => []);
      if (allocations.length === 0) {
        actions.push({
          id: 'group_no_allocation',
          actorId: context.actorId,
          type: 'group_no_allocation',
          message: 'Você não configurou alocação para grupos. Todo o lucro vai para o Fundo Regional.',
          severity: 'info',
          createdAt: new Date().toISOString(),
          action: {
            label: 'Configurar Alocação',
            path: '/grupos',
          },
        });
      }
    }
  } catch (error) {
    console.warn('Erro ao detectar pendências do usuário:', error);
  }

  return actions;
}

/**
 * Detecta pendências para empresa
 */
async function detectCompanyPendingActions(
  context: PendingActionsContext
): Promise<PendingAction[]> {
  const actions: PendingAction[] = [];

  try {
    // 1. Verificar se empresa tem colaboradores
    // Extrair companyId do actorId ou metadata
    const companyId = context.actorId; // Assumindo que actorId é o companyId para empresas
    
    try {
      const members = await listCompanyMembers(companyId).catch(() => []);
      if (members.length === 0) {
        actions.push({
          id: `company_no_members_${companyId}`,
          actorId: context.actorId,
          type: 'company_no_members',
          message: 'Esta empresa não possui colaboradores. Considere convidar membros da equipe.',
          severity: 'attention',
          createdAt: new Date().toISOString(),
          action: {
            label: 'Convidar Colaborador',
            path: `/empresa/${companyId}`,
          },
          metadata: { companyId },
        });
      }
    } catch {
      // Ignorar se não conseguir buscar membros
    }

    // 2. Verificar se empresa tem conta bancária ativa
    try {
      const balance = await getBankBalance().catch(() => null);
      // Se não conseguir obter saldo, pode indicar que não há conta bancária
      // Mas não vamos criar pendência apenas por isso, pois pode ser erro de API
    } catch {
      // Ignorar
    }
  } catch (error) {
    console.warn('Erro ao detectar pendências da empresa:', error);
  }

  return actions;
}







