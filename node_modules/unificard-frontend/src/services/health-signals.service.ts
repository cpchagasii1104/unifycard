// frontend/src/services/health-signals.service.ts
// CONTINUOUS PRODUCTION: Serviço de Detecção de Sinais de Saúde - SPRINT 9
// Infere sinais simples baseados em dados existentes (sem criar backend novo)

import type { HealthSignal, HealthStatus } from '../types/health-signal';
import { getBankStatement } from '../api/bank';
import { listCompanyMembers } from '../api/companyMembers';
import { getMyGroups } from '../api/groups';
import { aggregateActivities } from './activity-aggregation.service';

interface HealthSignalsContext {
  actorId: string;
  actorType: 'user' | 'page' | 'group' | 'project';
  userId?: string;
  companyId?: string;
}

/**
 * Detecta sinais de saúde para um actor específico
 */
export async function getUserHealthSignals(
  context: HealthSignalsContext
): Promise<HealthSignal[]> {
  const signals: HealthSignal[] = [];

  try {
    if (context.actorType === 'user') {
      const userSignals = await detectUserHealthSignals(context);
      signals.push(...userSignals);
    } else if (context.actorType === 'page') {
      const companySignals = await detectCompanyHealthSignals(context);
      signals.push(...companySignals);
    }
  } catch (error) {
    console.warn('Erro ao detectar sinais de saúde:', error);
    // Não quebrar - retornar lista vazia se houver erro
  }

  // Ordenar por status (critical > attention > healthy)
  return signals.sort((a, b) => {
    const statusOrder: Record<HealthStatus, number> = {
      critical: 3,
      attention: 2,
      healthy: 1,
    };
    return statusOrder[b.status] - statusOrder[a.status];
  });
}

/**
 * Detecta sinais de saúde para usuário (PF)
 */
async function detectUserHealthSignals(
  context: HealthSignalsContext
): Promise<HealthSignal[]> {
  const signals: HealthSignal[] = [];

  try {
    // 1. Verificar atividade recente
    const statement = await getBankStatement({ limit: 10 }).catch(() => ({ entries: [], total: 0, hasMore: false }));
    const activities = await aggregateActivities({ actorId: context.actorId, limit: 10 }).catch(() => []);

    if (statement.entries.length > 0) {
      const lastTransaction = statement.entries[0];
      const daysSinceLastActivity = getDaysSince(lastTransaction.createdAt);

      if (daysSinceLastActivity <= 7) {
        signals.push({
          id: 'recent_activity_user',
          type: 'recent_activity',
          status: 'healthy',
          title: 'Atividade recente',
          description: `Última transação há ${daysSinceLastActivity} ${daysSinceLastActivity === 1 ? 'dia' : 'dias'}`,
          observation: 'Você teve movimentação financeira recente na plataforma.',
          source: 'Baseado em transações bancárias',
          createdAt: new Date().toISOString(),
          metadata: {
            lastActivityDate: lastTransaction.createdAt,
            daysSince: daysSinceLastActivity,
          },
        });
      } else if (daysSinceLastActivity > 30) {
        signals.push({
          id: 'no_recent_activity_user',
          type: 'no_recent_activity',
          status: 'attention',
          title: 'Sem atividade recente',
          description: `Última transação há ${daysSinceLastActivity} dias`,
          observation: 'Não há movimentação financeira recente registrada.',
          source: 'Baseado em transações bancárias',
          createdAt: new Date().toISOString(),
          metadata: {
            lastActivityDate: lastTransaction.createdAt,
            daysSince: daysSinceLastActivity,
          },
        });
      }
    } else {
      signals.push({
        id: 'no_activity_user',
        type: 'no_recent_activity',
        status: 'attention',
        title: 'Nenhuma transação registrada',
        description: 'Ainda não há movimentação financeira na plataforma',
        observation: 'Quando você realizar transações, elas aparecerão aqui.',
        source: 'Baseado em transações bancárias',
        createdAt: new Date().toISOString(),
      });
    }

    // 2. Verificar grupos e contribuições
    const groups = await getMyGroups().catch(() => ({ groups: [] }));
    if (groups.groups.length > 0) {
      signals.push({
        id: 'active_groups_user',
        type: 'group_contributions',
        status: 'healthy',
        title: 'Participando de grupos',
        description: `Você participa de ${groups.groups.length} ${groups.groups.length === 1 ? 'grupo' : 'grupos'}`,
        observation: 'Você está conectado a grupos comunitários na plataforma.',
        source: 'Baseado em grupos do usuário',
        createdAt: new Date().toISOString(),
        metadata: {
          groupsCount: groups.groups.length,
        },
      });
    }
  } catch (error) {
    console.warn('Erro ao detectar sinais de saúde do usuário:', error);
  }

  return signals;
}

/**
 * Detecta sinais de saúde para empresa
 */
async function detectCompanyHealthSignals(
  context: HealthSignalsContext
): Promise<HealthSignal[]> {
  const signals: HealthSignal[] = [];

  try {
    const companyId = context.companyId || context.actorId;

    // 1. Verificar membros
    const members = await listCompanyMembers(companyId).catch(() => []);
    const activeMembers = members.filter(m => m.status === 'active');

    if (activeMembers.length === 0) {
      signals.push({
        id: 'no_members_company',
        type: 'no_members',
        status: 'attention',
        title: 'Sem colaboradores ativos',
        description: 'Esta empresa não possui colaboradores ativos',
        observation: 'Adicionar membros da equipe pode facilitar a operação da empresa.',
        source: 'Baseado em membros da empresa',
        createdAt: new Date().toISOString(),
      });
    } else {
      signals.push({
        id: 'active_members_company',
        type: 'active_members',
        status: 'healthy',
        title: 'Equipe ativa',
        description: `${activeMembers.length} ${activeMembers.length === 1 ? 'colaborador ativo' : 'colaboradores ativos'}`,
        observation: 'A empresa possui membros da equipe configurados.',
        source: 'Baseado em membros da empresa',
        createdAt: new Date().toISOString(),
        metadata: {
          membersCount: activeMembers.length,
        },
      });
    }

    // 2. Verificar atividade financeira
    const statement = await getBankStatement({ limit: 5 }).catch(() => ({ entries: [], total: 0, hasMore: false }));
    if (statement.entries.length > 0) {
      const lastTransaction = statement.entries[0];
      const daysSinceLastActivity = getDaysSince(lastTransaction.createdAt);

      if (daysSinceLastActivity <= 7) {
        signals.push({
          id: 'recent_activity_company',
          type: 'recent_activity',
          status: 'healthy',
          title: 'Atividade financeira recente',
          description: `Última transação há ${daysSinceLastActivity} ${daysSinceLastActivity === 1 ? 'dia' : 'dias'}`,
          observation: 'A empresa teve movimentação financeira recente.',
          source: 'Baseado em transações bancárias',
          createdAt: new Date().toISOString(),
          metadata: {
            lastActivityDate: lastTransaction.createdAt,
            daysSince: daysSinceLastActivity,
          },
        });
      }
    }
  } catch (error) {
    console.warn('Erro ao detectar sinais de saúde da empresa:', error);
  }

  return signals;
}

/**
 * Calcula dias desde uma data
 */
function getDaysSince(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}







