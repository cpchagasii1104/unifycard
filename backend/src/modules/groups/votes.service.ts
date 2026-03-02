// src/modules/groups/votes.service.ts

import { votesRepository } from './votes.repository';
import { groupsRepository } from './groups.repository';
import { runTenantTransaction } from '@core/db';
import { toGroupVote, toGroupVoteOption } from './votes.types';
import type {
  GroupVote,
  CreateVoteInput,
  VoteWithOptions,
  VoteWithVoters,
} from './votes.types';

class VotesService {
  async createVote(
    tenantId: string,
    groupId: string,
    createdByUserId: string,
    input: CreateVoteInput,
    userId: string,
    globalUserId: string
  ): Promise<GroupVote> {
    // Validar: options.length >= 2 e <= 20 (validação app-level)
    if (!input.options || input.options.length < 2) {
      throw new Error('Votação deve ter pelo menos 2 opções');
    }
    if (input.options.length > 20) {
      throw new Error('Votação deve ter no máximo 20 opções');
    }

    // Validar: title não vazio (CHECK constraint no banco garante 3-200 chars)
    if (!input.title || input.title.trim().length < 3) {
      throw new Error('Título da votação deve ter pelo menos 3 caracteres');
    }

    // Validar: status === 'open' (será criado como 'open')
    // Validar: closesAt (se definido) deve ser futuro
    if (input.closesAt) {
      const closesAt = new Date(input.closesAt);
      const now = new Date();
      if (closesAt <= now) {
        throw new Error('Data de encerramento deve ser no futuro');
      }
    }

    // Executar tudo dentro de uma transação atômica
    return await runTenantTransaction(tenantId, async (trx) => {
      // 1. Criar votação
      const voteRows = await trx.query({
        text: `
          INSERT INTO group_votes (
            tenant_id, group_id, created_by_user_id, title, description, status, closesAt
          )
          VALUES ($1, $2, $3, $4, $5, 'open', $6)
          RETURNING vote_id, tenant_id, group_id, created_by_user_id, title, description, status, closesAt, createdAt, updatedAt
        `,
        values: [
          tenantId,
          groupId,
          createdByUserId,
          input.title,
          input.description ?? null,
          input.closesAt ? new Date(input.closesAt) : null,
        ],
      });

      if (!voteRows || voteRows.length === 0) {
        throw new Error('Falha ao criar votação');
      }

      const voteRow = voteRows[0] as {
        vote_id: string;
        tenant_id: string;
        group_id: string;
        created_by_user_id: string;
        title: string;
        description: string | null;
        status: string;
        closesAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
      };
      const vote = toGroupVote({
        ...voteRow,
        createdAt: voteRow.createdAt instanceof Date ? voteRow.createdAt.toISOString() : String(voteRow.createdAt),
        updatedAt: voteRow.updatedAt instanceof Date ? voteRow.updatedAt.toISOString() : String(voteRow.updatedAt),
      });

      // 2. Criar opções
      const createdOptions = [];
      for (let i = 0; i < input.options.length; i++) {
        const optionRows = await trx.query({
          text: `
            INSERT INTO group_vote_options (
              vote_id, tenant_id, text, display_order
            )
            VALUES ($1, $2, $3, $4)
            RETURNING option_id, vote_id, tenant_id, text, display_order, createdAt
          `,
          values: [vote.voteId, tenantId, input.options[i], i],
        });

        if (optionRows && optionRows.length > 0) {
          const optionRow = optionRows[0] as {
            option_id: string;
            vote_id: string;
            tenant_id: string;
            text: string;
            display_order: number;
            createdAt: Date;
          };
          createdOptions.push(toGroupVoteOption({
            ...optionRow,
            createdAt: optionRow.createdAt instanceof Date ? optionRow.createdAt.toISOString() : String(optionRow.createdAt),
          }));
        }
      }

      // 3. Obter ou criar actor do usuário (dentro da transação)
      let actorRows = await trx.query({
        text: `
          SELECT a.*
          FROM actors a
          WHERE a.tenant_id = $1 
            AND a.user_id = $2
            AND a.actor_type = 'user'
          LIMIT 1
        `,
        values: [tenantId, userId],
      });

      let actor;
      if (!actorRows || actorRows.length === 0) {
        // Buscar nome do usuário
        const userRows = await trx.query({
          text: `
            SELECT u.email, p.full_name
            FROM users u
            LEFT JOIN profiles p ON u.user_id = p.user_id AND u.tenant_id = p.tenant_id
            WHERE u.user_id = $1 AND u.tenant_id = $2
            LIMIT 1
          `,
          values: [userId, tenantId],
        });

        if (!userRows || userRows.length === 0) {
          throw new Error('Usuário não encontrado');
        }

        const user = userRows[0] as {
          email: string;
          full_name: string | null;
        };
        const displayName = user.full_name || user.email.split('@')[0];

        // Criar novo actor
        const newActorRows = await trx.query({
          text: `
            INSERT INTO actors (
              tenant_id, actor_type, user_id, display_name, slug
            )
            VALUES ($1, 'user', $2, $3, $4)
            RETURNING actor_id, tenant_id, actor_type, user_id, display_name, slug
          `,
          values: [tenantId, userId, displayName, `user-${userId.substring(0, 8)}`],
        });

        if (!newActorRows || newActorRows.length === 0) {
          throw new Error('Erro ao criar actor');
        }

        actor = newActorRows[0] as {
          actor_id: string;
          tenant_id: string;
          actor_type: string;
          user_id: string | null;
          display_name: string;
          slug: string;
        };
      } else {
        actor = actorRows[0] as {
          actor_id: string;
          tenant_id: string;
          actor_type: string;
          user_id: string | null;
          display_name: string;
          slug: string;
        };
      }

      // 4. Criar post no feed com intent='vote' e intent_metadata enxuto
      const intentMetadata = {
        voteId: vote.voteId,
        title: input.title,
        optionCount: input.options.length,
        closesAt: input.closesAt || null,
      };

      // Criar post dentro da transação usando query direta
      const postRows = await trx.query({
        text: `
          INSERT INTO posts (
            tenant_id, global_user_id, actor_id, content, media, intent, intent_metadata, targeting, metadata
          )
          VALUES ($1, $2, $3, $4, '[]'::jsonb, $5, $6::jsonb, '{}'::jsonb, $7::jsonb)
          RETURNING post_id, createdAt, updatedAt
        `,
        values: [
          tenantId,
          globalUserId,
          actor.actor_id,
          `Nova votação criada: ${input.title}`,
          'vote',
          JSON.stringify(intentMetadata),
          JSON.stringify({ groupId }),
        ],
      });

      if (!postRows || postRows.length === 0) {
        throw new Error('Falha ao criar post no feed');
      }

      return vote;
    });
  }

  async getGroupVotes(
    tenantId: string,
    groupId: string,
    status?: 'open' | 'closed'
  ): Promise<GroupVote[]> {
    return votesRepository.getGroupVotes(tenantId, groupId, status);
  }

  async getVoteWithOptions(
    tenantId: string,
    voteId: string,
    userId: string,
    isAdminOrOwner: boolean
  ): Promise<VoteWithOptions | VoteWithVoters> {
    const vote = await votesRepository.getVote(tenantId, voteId);
    if (!vote) {
      throw new Error('Votação não encontrada');
    }

    const options = await votesRepository.getVoteOptions(tenantId, voteId);
    const counts = await votesRepository.getVoteCounts(tenantId, voteId);
    const userVote = await votesRepository.getUserVote(tenantId, voteId, userId);

    const optionsWithCounts = options.map((opt) => ({
      ...opt,
      voteCount: counts.get(opt.optionId) || 0,
    }));

    const totalVotes = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);

    const voteWithOptions: VoteWithOptions = {
      ...vote,
      options: optionsWithCounts,
      totalVotes,
      userVoted: !!userVote,
      userVoteOptionId: userVote?.optionId || null,
    };

    // Se admin/owner, incluir lista de votantes
    if (isAdminOrOwner) {
      const votersRaw = await votesRepository.getVotersByOption(tenantId, voteId);
      const voteWithVoters: VoteWithVoters = {
        ...voteWithOptions,
        voters: votersRaw.map((v) => ({
          optionId: v.optionId,
          userId: v.userId,
          userName: v.userName,
          createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt),
        })),
      };
      return voteWithVoters;
    }

    return voteWithOptions;
  }

  async vote(
    tenantId: string,
    groupId: string,
    voteId: string,
    optionId: string,
    userId: string
  ): Promise<void> {
    // Validar: votação existe
    const vote = await votesRepository.getVote(tenantId, voteId);
    if (!vote || vote.groupId !== groupId) {
      throw new Error('Votação não encontrada');
    }

    // Validar: votação está aberta
    if (vote.status !== 'open') {
      throw new Error('Votação está fechada');
    }

    // Validar: closesAt não passou
    if (vote.closesAt && new Date(vote.closesAt) <= new Date()) {
      throw new Error('Votação já foi encerrada');
    }

    // Validar: opção pertence à votação
    const options = await votesRepository.getVoteOptions(tenantId, voteId);
    const optionExists = options.some((opt) => opt.optionId === optionId);
    if (!optionExists) {
      throw new Error('Opção inválida para esta votação');
    }

    // Validar: usuário ainda não votou (UNIQUE constraint vai prevenir, mas validamos antes)
    const existingVote = await votesRepository.getUserVote(tenantId, voteId, userId);
    if (existingVote) {
      throw new Error('Você já votou nesta votação');
    }

    // Registrar voto
    await votesRepository.createVoteResponse(tenantId, voteId, optionId, userId);
  }

  async closeVote(
    tenantId: string,
    groupId: string,
    voteId: string
  ): Promise<GroupVote> {
    // Validar: votação existe
    const vote = await votesRepository.getVote(tenantId, voteId);
    if (!vote || vote.groupId !== groupId) {
      throw new Error('Votação não encontrada');
    }

    // Fechar votação
    return votesRepository.closeVote(tenantId, voteId);
  }
}

export const votesService = new VotesService();

