// src/modules/groups/groups.insights.service.ts

import { groupsRepository } from './groups.repository';
import { groupsService } from './groups.service';
import { accountService } from '@core/economy/accounts/account.service';
import { runQueryWithTenant } from '@core/database/pool';
import { memoryService } from '@core/memory/memory.service';
import type { GroupInsights } from './groups.types';

class GroupsInsightsService {
  async getGroupInsights(tenantId: string, groupId: string): Promise<GroupInsights> {
    const group = await groupsService.getGroup(tenantId, groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    const members = await groupsRepository.getMembers(tenantId, groupId);
    const memberCount = members.length;

    // Buscar total recebido em splits
    const groupAccount = await groupsRepository.getGroupAccount(tenantId, groupId);
    let totalReceived = 0;

    if (groupAccount) {
      const account = await accountService.getAccountById(tenantId, groupAccount.accountId);
      if (account) {
        totalReceived = account.balance;
      }
    }

    // Buscar logs de participação do Memory (se método disponível)
    let participationLogs: any[] = [];
    try {
      if (typeof memoryService.getContextsByUserId === 'function') {
        participationLogs = memoryService.getContextsByUserId(groupId, 'group_participation') || [];
      }
    } catch (error) {
      console.error('Error getting participation logs from memory:', error);
    }

    // Gerar resumo via AI Kernel (placeholder)
    const aiSummary = await this.generateAISummary(tenantId, groupId, {
      name: group.name,
      memberCount,
      totalReceived,
    });

    return {
      groupId,
      name: group.name,
      totalReceived,
      memberCount,
      participationLogs: participationLogs.map((log: any) => ({
        action: log.action || 'unknown',
        timestamp: log.timestamp || new Date(),
        userId: log.userId || 'unknown',
      })),
      aiSummary,
    };
  }

  private async generateAISummary(
    tenantId: string,
    groupId: string,
    data: { name: string; memberCount: number; totalReceived: number }
  ): Promise<string | undefined> {
    // TODO: Integrar com AI Kernel quando disponível
    // Por enquanto, retornar resumo simples
    return `Grupo ${data.name} com ${data.memberCount} membros. Total recebido: R$ ${data.totalReceived.toFixed(2)}`;
  }
}

export const groupsInsightsService = new GroupsInsightsService();

