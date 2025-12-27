// src/modules/votes/votes.service.ts
// Service para lógica de negócio de votações

import { votesRepository, type VoteRow, type VoteOptionRow } from './votes.repository';
import { social2Service } from '../social/social-2.0.service';
import { actorRepository } from '../social/actor.repository';

export interface CreateVoteInput {
  title: string;
  description?: string;
  options: string[];
  starts_at?: string;
  ends_at?: string;
}

export interface VoteWithOptions extends VoteRow {
  options: VoteOptionRow[];
  results?: Array<{
    option_id: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  has_voted?: boolean;
  total_votes?: number;
}

export class VotesService {
  /**
   * Cria uma nova votação (status = draft)
   */
  async createVote(
    tenantId: string,
    userId: string,
    globalUserId: string,
    actorId: string,
    input: CreateVoteInput
  ): Promise<VoteWithOptions> {
    // Validar opções
    if (!input.options || input.options.length < 2) {
      throw new Error('Uma votação deve ter pelo menos 2 opções');
    }

    // Criar votação
    const vote = await votesRepository.create(tenantId, {
      title: input.title,
      description: input.description,
      created_by_actor_id: actorId,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
    });

    // Adicionar opções
    const options: VoteOptionRow[] = [];
    for (const label of input.options) {
      const option = await votesRepository.addOption(tenantId, vote.vote_id, label);
      options.push(option);
    }

    // Criar post no feed (tipo vote, status draft)
    try {
      const actor = await actorRepository.findById(tenantId, actorId);
      if (actor) {
        await social2Service.createPost(
          tenantId,
          userId,
          globalUserId,
          `Nova votação criada: ${input.title}`,
          actorId,
          [],
          'vote',
          {
            vote_id: vote.vote_id,
            status: 'draft',
            title: input.title,
          }
        );
      }
    } catch (err) {
      console.warn('Erro ao criar post no feed (não crítico):', err);
    }

    return {
      ...vote,
      options,
    };
  }

  /**
   * Publica uma votação (muda status para active)
   */
  async publishVote(
    tenantId: string,
    userId: string,
    globalUserId: string,
    voteId: string,
    actorId: string
  ): Promise<VoteWithOptions> {
    const vote = await votesRepository.findById(tenantId, voteId);
    if (!vote) {
      throw new Error('Votação não encontrada');
    }

    // Verificar se é o criador
    if (vote.created_by_actor_id !== actorId) {
      throw new Error('Apenas o criador pode publicar a votação');
    }

    // Verificar se tem pelo menos 2 opções
    const options = await votesRepository.getOptions(tenantId, voteId);
    if (options.length < 2) {
      throw new Error('Uma votação deve ter pelo menos 2 opções antes de ser publicada');
    }

    // Atualizar status
    const updatedVote = await votesRepository.updateStatus(tenantId, voteId, 'active');

    // Criar post no feed (tipo vote, status active)
    try {
      await social2Service.createPost(
        tenantId,
        userId,
        globalUserId,
        `🗳️ Votação aberta: ${vote.title}`,
        actorId,
        [],
        'vote',
        {
          vote_id: voteId,
          status: 'active',
          title: vote.title,
        }
      );
    } catch (err) {
      console.warn('Erro ao criar post no feed (não crítico):', err);
    }

    return {
      ...updatedVote,
      options,
    };
  }

  /**
   * Registra voto do actor
   */
  async vote(
    tenantId: string,
    voteId: string,
    optionId: string,
    actorId: string
  ): Promise<void> {
    const vote = await votesRepository.findById(tenantId, voteId);
    if (!vote) {
      throw new Error('Votação não encontrada');
    }

    if (vote.status !== 'active') {
      throw new Error('Esta votação não está aberta para votação');
    }

    // Verificar se já votou
    const hasVoted = await votesRepository.hasVoted(tenantId, voteId, actorId);
    if (hasVoted) {
      throw new Error('Você já votou nesta votação');
    }

    // Registrar voto
    await votesRepository.addResponse(tenantId, {
      vote_id: voteId,
      vote_option_id: optionId,
      actor_id: actorId,
    });
  }

  /**
   * Busca votação com detalhes
   */
  async getVote(
    tenantId: string,
    voteId: string,
    actorId?: string
  ): Promise<VoteWithOptions | null> {
    const vote = await votesRepository.findById(tenantId, voteId);
    if (!vote) {
      return null;
    }

    const options = await votesRepository.getOptions(tenantId, voteId);
    const results = await votesRepository.getResults(tenantId, voteId);
    
    const hasVoted = actorId ? await votesRepository.hasVoted(tenantId, voteId, actorId) : false;
    const totalVotes = results.reduce((sum, r) => sum + r.count, 0);

    return {
      ...vote,
      options,
      results: vote.status === 'closed' || vote.status === 'active' ? results : undefined,
      has_voted: hasVoted,
      total_votes: totalVotes,
    };
  }

  /**
   * Lista votações
   */
  async listVotes(
    tenantId: string,
    options: {
      status?: 'draft' | 'active' | 'closed';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ votes: VoteWithOptions[]; total: number }> {
    const { rows, total } = await votesRepository.list(tenantId, options);

    const votes: VoteWithOptions[] = [];
    for (const vote of rows) {
      const voteOptions = await votesRepository.getOptions(tenantId, vote.vote_id);
      const results = vote.status === 'closed' || vote.status === 'active'
        ? await votesRepository.getResults(tenantId, vote.vote_id)
        : undefined;
      
      const totalVotes = results ? results.reduce((sum, r) => sum + r.count, 0) : 0;

      votes.push({
        ...vote,
        options: voteOptions,
        results,
        total_votes: totalVotes,
      });
    }

    return { votes, total };
  }

  /**
   * Encerra votação (muda status para closed)
   */
  async closeVote(
    tenantId: string,
    userId: string,
    globalUserId: string,
    voteId: string,
    actorId: string
  ): Promise<VoteWithOptions> {
    const vote = await votesRepository.findById(tenantId, voteId);
    if (!vote) {
      throw new Error('Votação não encontrada');
    }

    // Verificar se é o criador
    if (vote.created_by_actor_id !== actorId) {
      throw new Error('Apenas o criador pode encerrar a votação');
    }

    // Atualizar status
    const updatedVote = await votesRepository.updateStatus(tenantId, voteId, 'closed');

    // Buscar resultados finais
    const options = await votesRepository.getOptions(tenantId, voteId);
    const results = await votesRepository.getResults(tenantId, voteId);

    // Criar post no feed (tipo vote, status closed)
    try {
      await social2Service.createPost(
        tenantId,
        userId,
        globalUserId,
        `✅ Votação encerrada: ${vote.title}`,
        actorId,
        [],
        'vote',
        {
          vote_id: voteId,
          status: 'closed',
          title: vote.title,
          results,
        }
      );
    } catch (err) {
      console.warn('Erro ao criar post no feed (não crítico):', err);
    }

    return {
      ...updatedVote,
      options,
      results,
    };
  }
}

export const votesService = new VotesService();








