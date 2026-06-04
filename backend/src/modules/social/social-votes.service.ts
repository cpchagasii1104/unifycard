// src/modules/social/social-votes.service.ts
// Serviço para gerenciar votações em posts

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { HttpError } from '@core/errors/http-error';
import type { PermissionKey } from '@core/authorization/permission-keys';

export interface VoteOption {
  index: number;
  text: string;
  count: number;
  percentage: number;
}

export interface VoteResults {
  options: VoteOption[];
  total_votes: number;
  closesAt?: string;
  is_closed: boolean;
}

export class SocialVotesService {
  /**
   * Registra voto de um actor em um post
   * REGRA: Uma pessoa = um voto (enforced por UNIQUE constraint)
   */
  async castVote(
    tenantId: string,
    postId: string,
    actorId: string,
    optionIndex: number,
    userId?: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      // Verificar se post existe e é do tipo 'vote'
      const post = await runQueryWithTenant<{
        intent: string;
        intent_metadata: any;
      }>(
        tenantId,
        `
        SELECT intent, intent_metadata
        FROM posts
        WHERE post_id = $1 AND tenant_id = $2
        LIMIT 1
        `,
        [postId, tenantId]
      );

      if (!post) {
        return { success: false, message: 'Post não encontrado' };
      }

      if (post.intent !== 'vote') {
        return { success: false, message: 'Post não é uma votação' };
      }

      // Verificar se votação está fechada
      const metadata = typeof post.intent_metadata === 'string' 
        ? JSON.parse(post.intent_metadata) 
        : post.intent_metadata;
      
      if (metadata.closesAt) {
        const closesAt = new Date(metadata.closesAt);
        if (new Date() > closesAt) {
          return { success: false, message: 'Votação já está fechada' };
        }
      }

      // Verificar se opção é válida
      if (!metadata.options || !Array.isArray(metadata.options)) {
        return { success: false, message: 'Opções de votação inválidas' };
      }

      if (optionIndex < 0 || optionIndex >= metadata.options.length) {
        return { success: false, message: 'Opção inválida' };
      }

      // REGRA: Verificar se actor é empresa PROVISIONAL (não pode votar)
      const actor = await runQueryWithTenant<{
        actor_type: string;
        company_id: string | null;
      }>(
        tenantId,
        `
        SELECT actor_type, company_id
        FROM actors
        WHERE actor_id = $1 AND tenant_id = $2
        LIMIT 1
        `,
        [actorId, tenantId]
      );

      // FASE 11: Verificar permissões baseadas em reputação
      let companyStatus: string | undefined = undefined;
      if (!actor) {
        return { success: false, message: 'Actor não encontrado' };
      }
      if (actor.actor_type === 'page' && actor.company_id) {
        const company = await runQueryWithTenant<{ company_status: string }>(
          tenantId,
          `
          SELECT company_status FROM companies
          WHERE company_id = $1 AND tenant_id = $2
          LIMIT 1
          `,
          [actor.company_id, tenantId]
        );

        if (company) {
          companyStatus = company.company_status;
        }
      }

      // 🔴 BLINDAGEM: permissão via authority.service (fachada modules — §4.9)
      if (userId) {
        const { authorityService } = await import('@modules/authority/authority.service');
        const auth = await authorityService.canPerformAction(
          actorId,
          'cast_vote',
          undefined,
          { tenantId, userId }
        );
        if (!auth.allowed) {
          if (actor.actor_type === 'page' && companyStatus === 'PROVISIONAL') {
            return { 
              success: false, 
              message: 'Empresas em validação não podem votar em votações públicas. Complete a validação presencial para habilitar esta funcionalidade.' 
            };
          }
          return {
            success: false,
            message: auth.reason || 'Você não tem permissão para votar. Continue usando a plataforma para desbloquear esta funcionalidade.'
          };
        }
      }

      // DECISION-0094 Fase Social Gate 1: page-actor/PJ só vota se KYB approved.
      // O canActAs (acima) é delegation-only e NÃO é KYB-aware — este gate impede voto público
      // de PJ não-verificada. Fonte única = fiscal_identities.kyb_status (server-side, fail-closed).
      // NUNCA company_status/is_verified. PF/user inalterado.
      if (actor.actor_type === 'page') {
        const { isPageActorKybApproved, PJ_KYB_SOCIAL_BLOCK_MESSAGE } = await import('./pj-kyb-gate');
        const kybApproved = await isPageActorKybApproved(tenantId, actorId);
        if (!kybApproved) {
          return { success: false, message: PJ_KYB_SOCIAL_BLOCK_MESSAGE };
        }
      }

      // Inserir voto (UNIQUE constraint garante uma pessoa = um voto)
      try {
        await runQueryWithTenant(
          tenantId,
          `
          INSERT INTO post_votes (post_id, tenant_id, actor_id, option_index)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (post_id, actor_id) DO UPDATE
          SET option_index = EXCLUDED.option_index
          `,
          [postId, tenantId, actorId, optionIndex]
        );
      } catch (err: any) {
        // Se erro de constraint, já votou (mas atualiza o voto)
        if (err.code === '23505') {
          // Já existe, atualizar
          await runQueryWithTenant(
            tenantId,
            `
            UPDATE post_votes
            SET option_index = $4
            WHERE post_id = $1 AND actor_id = $3
            `,
            [postId, tenantId, actorId, optionIndex]
          );
        } else {
          throw err;
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Erro ao registrar voto:', error);
      return { success: false, message: 'Erro ao registrar voto' };
    }
  }

  /**
   * Busca resultados de uma votação
   */
  async getVoteResults(tenantId: string, postId: string): Promise<VoteResults | null> {
    try {
      // Buscar post e metadata
      const post = await runQueryWithTenant<{
        intent_metadata: any;
      }>(
        tenantId,
        `
        SELECT intent_metadata
        FROM posts
        WHERE post_id = $1 AND tenant_id = $2 AND intent = 'vote'
        LIMIT 1
        `,
        [postId, tenantId]
      );

      if (!post) {
        return null;
      }

      const metadata = typeof post.intent_metadata === 'string'
        ? JSON.parse(post.intent_metadata)
        : post.intent_metadata;

      if (!metadata.options || !Array.isArray(metadata.options)) {
        return null;
      }

      // Buscar contagem de votos por opção
      const votes = await runQueriesWithTenant<{
        option_index: number;
        count: string;
      }>(
        tenantId,
        `
        SELECT option_index, COUNT(*) as count
        FROM post_votes
        WHERE post_id = $1 AND tenant_id = $2
        GROUP BY option_index
        `,
        [postId, tenantId]
      );

      // Calcular totais
      const totalVotes = votes.reduce((sum, v) => sum + parseInt(v.count, 10), 0);

      // Mapear opções com contagem
      const options: VoteOption[] = metadata.options.map((text: string, index: number) => {
        const voteCount = votes.find((v) => v.option_index === index);
        const count = voteCount ? parseInt(voteCount.count, 10) : 0;
        const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

        return {
          index,
          text,
          count,
          percentage,
        };
      });

      // Verificar se está fechada
      const closesAt = metadata.closesAt;
      const isClosed = closesAt ? new Date() > new Date(closesAt) : false;

      return {
        options,
        total_votes: totalVotes,
        closesAt: closesAt,
        is_closed: isClosed,
      };
    } catch (error) {
      console.error('Erro ao buscar resultados de votação:', error);
      return null;
    }
  }

  /**
   * Verifica se um actor já votou
   */
  async hasVoted(tenantId: string, postId: string, actorId: string): Promise<boolean> {
    try {
      const vote = await runQueryWithTenant<{ vote_id: string }>(
        tenantId,
        `
        SELECT vote_id
        FROM post_votes
        WHERE post_id = $1 AND actor_id = $2 AND tenant_id = $3
        LIMIT 1
        `,
        [postId, actorId, tenantId]
      );

      return !!vote;
    } catch (error) {
      console.error('Erro ao verificar voto:', error);
      return false;
    }
  }
}

export const socialVotesService = new SocialVotesService();

