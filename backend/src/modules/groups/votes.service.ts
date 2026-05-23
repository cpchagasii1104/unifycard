// src/modules/groups/votes.service.ts

import { votesRepository } from './votes.repository';
import { groupsRepository } from './groups.repository';
import { runTenantTransaction } from '@core/db';
import { ensureUserActor } from '@modules/identity/actor-writer.service';
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

    const userActor = await ensureUserActor(tenantId, userId);
    const actorId = userActor.actor_id;

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
            tenant_id, group_id, created_by_user_id, title, description, status, closes_at
          )
          VALUES ($1, $2, $3, $4, $5, 'open', $6)
          RETURNING vote_id, tenant_id, group_id, created_by_user_id, title, description, status, closes_at, created_at, updated_at
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
        closes_at: Date | null;
        created_at: Date;
        updated_at: Date;
      };
      const vote = toGroupVote({
        vote_id: voteRow.vote_id,
        tenant_id: voteRow.tenant_id,
        group_id: voteRow.group_id,
        created_by_user_id: voteRow.created_by_user_id,
        title: voteRow.title,
        description: voteRow.description,
        status: voteRow.status,
        closesAt: voteRow.closes_at,
        createdAt: voteRow.created_at instanceof Date ? voteRow.created_at.toISOString() : String(voteRow.created_at),
        updatedAt: voteRow.updated_at instanceof Date ? voteRow.updated_at.toISOString() : String(voteRow.updated_at),
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
            RETURNING option_id, vote_id, tenant_id, text, display_order, created_at
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
            created_at: Date;
          };
          createdOptions.push(toGroupVoteOption({
            option_id: optionRow.option_id,
            vote_id: optionRow.vote_id,
            tenant_id: optionRow.tenant_id,
            text: optionRow.text,
            display_order: optionRow.display_order,
            createdAt: optionRow.created_at instanceof Date ? optionRow.created_at.toISOString() : String(optionRow.created_at),
          }));
        }
      }

      // 3. Actor do usuário obtido antes da transação (ensureUserActor → actorId)

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
          RETURNING post_id, created_at, updated_at
        `,
        values: [
          tenantId,
          globalUserId,
          actorId,
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

