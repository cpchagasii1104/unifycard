// frontend/src/services/activity-aggregation.service.ts
// CONTINUOUS PRODUCTION: Agregação de Atividades - SPRINT 3
// Agrega atividades de diferentes fontes para compor timeline institucional

import { getBankStatement, type BankStatementEntry } from '../api/bank';
import { listCompanyMembers, type CompanyMember } from '../api/companyMembers';
import type { AvailableActor } from '../api/social';

/**
 * Tipo de atividade institucional
 */
export type ActivityType =
  | 'transaction'
  | 'transaction_reversed'
  | 'member_added'
  | 'member_removed'
  | 'member_updated'
  | 'delegation_created'
  | 'delegation_revoked'
  | 'event_created'
  | 'service_executed'
  | 'post_created'
  | 'other';

/**
 * Item de atividade unificado
 * CONTINUOUS PRODUCTION: Modelo frontend que reflete eventos reais do backend
 */
export interface ActivityItem {
  id: string;
  actorId: string; // Actor em nome do qual a ação foi executada
  actingUserId?: string; // Usuário que executou a ação (se disponível)
  type: ActivityType;
  description: string; // Texto claro e humano: "João convidou Maria para a empresa"
  createdAt: string;
  metadata: {
    // Metadados específicos do tipo de atividade
    [key: string]: any;
  };
}

/**
 * Opções para agregação de atividades
 */
export interface AggregateActivitiesOptions {
  actorId?: string; // Filtrar por actor específico
  companyId?: string; // Filtrar por empresa
  limit?: number; // Limite de atividades
  startDate?: Date; // Data inicial
  endDate?: Date; // Data final
}

/**
 * Agrega atividades de diferentes fontes
 * CONTINUOUS PRODUCTION: Usa apenas endpoints existentes, não cria eventos fictícios
 */
export async function aggregateActivities(
  options: AggregateActivitiesOptions = {}
): Promise<ActivityItem[]> {
  const { actorId, companyId, limit = 50 } = options;
  const activities: ActivityItem[] = [];

  try {
    // 1. Agregar transações bancárias
    if (actorId || companyId) {
      try {
        const statement = await getBankStatement({ limit: limit * 2 });
        
        statement.entries.forEach((entry) => {
          // Filtrar por actor se fornecido (via metadata)
          // CONTINUOUS PRODUCTION: Se metadata não tiver created_as_actor_id, 
          // assumir que é do actor ativo (filtro será feito pelo backend)
          const entryActorId = entry.metadata?.created_as_actor_id;
          if (actorId && entryActorId && entryActorId !== actorId) {
            return;
          }

          const isReversed = entry.status === 'reversed';
          const activityType: ActivityType = isReversed ? 'transaction_reversed' : 'transaction';
          
          activities.push({
            id: `transaction_${entry.transactionId}`,
            actorId: entryActorId || actorId || 'unknown',
            actingUserId: entry.metadata?.created_by_user_id,
            type: activityType,
            description: buildTransactionDescription(entry, isReversed),
            createdAt: entry.createdAt,
            metadata: {
              transactionId: entry.transactionId,
              amount: entry.amount,
              direction: entry.direction,
              context: entry.context,
              status: entry.status,
              referenceType: entry.referenceType,
              referenceId: entry.referenceId,
              // Preservar metadata completo para contexto futuro
              ...entry.metadata,
            },
          });
        });
      } catch (err) {
        console.warn('Erro ao carregar transações para timeline:', err);
        // Não quebrar se transações falharem
      }
    }

    // 2. Agregar membros de empresa (se companyId fornecido)
    if (companyId) {
      try {
        const members = await listCompanyMembers(companyId);
        
        members.forEach((member) => {
          activities.push({
            id: `member_${member.memberId}`,
            actorId: companyId, // Empresa em nome da qual o membro foi adicionado
            type: 'member_added',
            description: buildMemberDescription(member, 'added'),
            createdAt: member.createdAt,
            metadata: {
              memberId: member.memberId,
              memberActorId: member.actorId,
              role: member.role,
              status: member.status,
            },
          });
        });
      } catch (err) {
        console.warn('Erro ao carregar membros para timeline:', err);
        // Não quebrar se membros falharem
      }
    }

    // 3. Ordenar por data (mais recente primeiro)
    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 4. Limitar resultado
    return activities.slice(0, limit);
  } catch (err) {
    console.error('Erro ao agregar atividades:', err);
    return [];
  }
}

/**
 * Constrói descrição humana para transação
 * CONTINUOUS PRODUCTION: Texto claro indicando ação financeira
 */
function buildTransactionDescription(entry: BankStatementEntry, isReversed: boolean): string {
  const contextLabel = getContextLabel(entry.context);
  const amount = Math.abs(entry.amount ?? 0);
  
  if (isReversed) {
    return `Transação revertida: ${contextLabel} de ${formatCurrency(amount)}`;
  }
  
  const direction = entry.direction === 'in' ? 'recebeu' : 'pagou';
  return `${contextLabel}: ${direction} ${formatCurrency(amount)}`;
}

/**
 * Constrói descrição humana para membro
 * CONTINUOUS PRODUCTION: Texto claro indicando ação e contexto
 */
function buildMemberDescription(member: CompanyMember, action: 'added' | 'removed' | 'updated'): string {
  const roleLabel = getRoleLabel(member.role);
  const actorIdShort = member.actorId.substring(0, 8);
  
  if (action === 'added') {
    return `Colaborador adicionado à equipe: ${actorIdShort}... como ${roleLabel}`;
  } else if (action === 'removed') {
    return `Acesso de colaborador revogado: ${actorIdShort}...`;
  } else {
    return `Permissões de colaborador atualizadas: ${actorIdShort}... agora é ${roleLabel}`;
  }
}

/**
 * Labels de contexto
 */
function getContextLabel(context?: string): string {
  const labels: Record<string, string> = {
    event_ticket: 'Ingresso de evento',
    service_booking: 'Agendamento de serviço',
    ride_payment: 'Pagamento de corrida',
    donation: 'Doação',
    p2p_transfer: 'Transferência P2P',
    group_contribution: 'Contribuição para grupo',
  };
  return labels[context || ''] || 'Transação';
}

/**
 * Labels de role
 */
function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: 'Administrador',
    staff: 'Funcionário',
    contractor: 'Contratado',
  };
  return labels[role] || role;
}

/**
 * Formatação de moeda
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}







