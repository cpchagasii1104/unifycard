// src/modules/social/social-group.repository.ts

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { groupsRepository } from '../groups/groups.repository';
import { accountService } from '@core/economy/account.service';
import type { GroupSocialInfo, GroupFeedOptions, GroupInsights } from './social-group.types';

class SocialGroupRepository {
  /**
   * Busca informações sociais de um grupo
   */
  async getGroupSocialInfo(tenantId: string, groupId: string): Promise<GroupSocialInfo | null> {
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      return null;
    }

    const members = await groupsRepository.getMembers(tenantId, groupId);
    const memberCount = members.length;

    // Buscar total recebido (saldo da conta)
    let totalReceived = 0;
    const groupAccount = await groupsRepository.getGroupAccount(tenantId, groupId);
    if (groupAccount) {
      const account = await accountService.getAccountById(tenantId, groupAccount.accountId);
      if (account) {
        totalReceived = account.balanceCents;
      }
    }

    // Contar posts recentes (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPostsCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM posts
      WHERE tenant_id = $1
        AND metadata->>'groupId' = $2
        AND created_at >= $3
      `,
      [tenantId, groupId, thirtyDaysAgo]
    );

    const recentPosts = recentPostsCount ? Number(recentPostsCount.count) : 0;

    // Calcular indicadores básicos
    const indicators = {
      activeMembers: memberCount, // TODO: Calcular membros ativos (com posts recentes)
      avgPostPerMember: memberCount > 0 ? recentPosts / memberCount : 0,
    };

    return {
      groupId,
      name: group.name,
      description: group.description,
      memberCount,
      totalReceived,
      recentPosts,
      indicators,
    };
  }

  /**
   * Busca feed de posts de um grupo
   */
  async getGroupFeed(
    tenantId: string,
    groupId: string,
    options: GroupFeedOptions = {}
  ): Promise<{ rows: any[]; totalCents: number }> {
    const { limit = 50, offset = 0, includeAutoPosts = true } = options;

    let query = `
      SELECT post_id, tenant_id, global_user_id, content, media, intent, confidence, categories, suggested_actions, metadata, created_at, updated_at
      FROM posts
      WHERE tenant_id = $1
        AND metadata->>'groupId' = $2
    `;

    const params: any[] = [tenantId, groupId];

    // Se não incluir auto-posts, filtrar por tipo
    if (!includeAutoPosts) {
      query += ` AND metadata->>'type' != 'system_auto_post'`;
    }

    query += ` ORDER BY created_at DESC LIMIT $3 OFFSET $4`;
    params.push(limit, offset);

    const rows = await runQueriesWithTenant(tenantId, query, params);

    // Contar total
    let countQuery = `
      SELECT COUNT(*)::text as "totalCents"
      FROM posts
      WHERE tenant_id = $1
        AND metadata->>'groupId' = $2
    `;
    const countParams: any[] = [tenantId, groupId];

    if (!includeAutoPosts) {
      countQuery += ` AND metadata->>'type' != 'system_auto_post'`;
    }

    const countRow = await runQueryWithTenant<{ totalCents: string }>(
      tenantId,
      countQuery,
      countParams
    );

    return {
      rows,
      totalCents: countRow ? Number(countRow.totalCents) : 0,
    };
  }

  /**
   * Busca insights de um grupo
   */
  async getGroupInsights(tenantId: string, groupId: string): Promise<GroupInsights | null> {
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      return null;
    }

    const members = await groupsRepository.getMembers(tenantId, groupId);
    const memberCount = members.length;

    // Buscar total recebido
    let totalReceived = 0;
    const groupAccount = await groupsRepository.getGroupAccount(tenantId, groupId);
    if (groupAccount) {
      const account = await accountService.getAccountById(tenantId, groupAccount.accountId);
      if (account) {
        totalReceived = account.balanceCents;
      }
    }

    // Buscar últimos 20 auto-posts econômicos
    const autoPosts = await runQueriesWithTenant<{
      post_id: string;
      content: string;
      metadata: any;
      created_at: Date;
    }>(
      tenantId,
      `
      SELECT post_id, content, metadata, created_at
      FROM posts
      WHERE tenant_id = $1
        AND metadata->>'groupId' = $2
        AND metadata->>'type' = 'system_auto_post'
        AND metadata->>'source' = 'economic_impact'
      ORDER BY created_at DESC
      LIMIT 20
      `,
      [tenantId, groupId]
    );

    const recentAutoPosts = autoPosts.map((p) => ({
      postId: p.post_id,
      content: p.content,
      amountCents: p.metadata?.splitAmount || 0,
      createdAt: p.created_at.toISOString(),
      assignmentId: p.metadata?.assignmentId,
      jobId: p.metadata?.jobId,
    }));

    // Calcular crescimento mensal (últimos 6 meses)
    const monthlyGrowth = await this.calculateMonthlyGrowth(tenantId, groupId);

    // Buscar membro mais ativo (por posts)
    const mostActive = await runQueryWithTenant<{
      global_user_id: string;
      post_count: string;
    }>(
      tenantId,
      `
      SELECT global_user_id, COUNT(*) as post_count
      FROM posts
      WHERE tenant_id = $1
        AND metadata->>'groupId' = $2
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY global_user_id
      ORDER BY post_count DESC
      LIMIT 1
      `,
      [tenantId, groupId]
    );

    // Buscar atividades mais frequentes
    const frequentActivities = await runQueriesWithTenant<{
      activity: string;
      count: string;
    }>(
      tenantId,
      `
      SELECT metadata->>'activity' as activity, COUNT(*) as count
      FROM posts
      WHERE tenant_id = $1
        AND metadata->>'groupId' = $2
        AND metadata->>'activity' IS NOT NULL
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY metadata->>'activity'
      ORDER BY count DESC
      LIMIT 5
      `,
      [tenantId, groupId]
    );

    return {
      groupId,
      name: group.name,
      totalReceived,
      recentAutoPosts,
      monthlyGrowth,
      memberCount,
      mostActiveMember: mostActive
        ? {
            userId: mostActive.global_user_id,
            postCount: Number(mostActive.post_count),
          }
        : undefined,
      frequentActivities: frequentActivities.map((a) => ({
        activity: a.activity || 'unknown',
        count: Number(a.count),
      })),
    };
  }

  /**
   * Calcula crescimento mensal de recebimentos
   */
  private async calculateMonthlyGrowth(
    tenantId: string,
    groupId: string
  ): Promise<Array<{ month: string; amountCents: number }>> {
    const growth = await runQueriesWithTenant<{
      month: string;
      amountCents: string;
    }>(
      tenantId,
      // C61-B: valor derivado de metadata (observabilidade social apenas)
      // NÃO usar para decisão financeira — fonte canônica é bank_ledger
      // Ref: REMEDIATION_DECISIONS_LOG_APPEND.md §C61-B
      `
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        SUM((metadata->>'splitAmount')::numeric)::text as "amountCents"
      FROM posts
      WHERE tenant_id = $1
        AND metadata->>'groupId' = $2
        AND metadata->>'type' = 'system_auto_post'
        AND metadata->>'source' = 'economic_impact'
        AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month DESC
      `,
      [tenantId, groupId]
    );

    return growth.map((g) => ({
      month: g.month,
      amountCents: Number(g.amountCents || 0),
    }));
  }

  /**
   * Busca feed de impacto combinado
   */
  async getImpactFeed(
    tenantId: string,
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ items: any[]; totalCents: number }> {
    const { limit = 50, offset = 0 } = options;

    // Buscar grupos do usuário
    const userGroups = await groupsRepository.getUserGroups(tenantId, userId);
    const groupIds = userGroups.map((g) => g.groupId);

    if (groupIds.length === 0) {
      return { items: [], totalCents: 0 };
    }

    // Buscar posts de grupos + auto-posts econômicos
    const query = `
      SELECT post_id, global_user_id, content, metadata, created_at
      FROM posts
      WHERE tenant_id = $1
        AND (
          metadata->>'groupId' = ANY($2::text[])
          OR (metadata->>'source' = 'economic_impact' AND metadata->>'groupId' = ANY($2::text[]))
        )
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const rows = await runQueriesWithTenant(tenantId, query, [
      tenantId,
      groupIds,
      limit,
      offset,
    ]);

    // Contar total
    const countQuery = `
      SELECT COUNT(*)::text as "totalCents"
      FROM posts
      WHERE tenant_id = $1
        AND (
          metadata->>'groupId' = ANY($2::text[])
          OR (metadata->>'source' = 'economic_impact' AND metadata->>'groupId' = ANY($2::text[]))
        )
    `;

    const countRow = await runQueryWithTenant<{ totalCents: string }>(
      tenantId,
      countQuery,
      [tenantId, groupIds]
    );

    return {
      items: rows,
      totalCents: countRow ? Number(countRow.totalCents) : 0,
    };
  }
}

export const socialGroupRepository = new SocialGroupRepository();



