// src/modules/groups/votes.service.ts
//
// Identidade operacional do voto/votação = actor_id (resolvido por ensureUserActor).
// O service NÃO duplica SQL de group_votes/group_vote_options — delega ao
// votesRepository, passando o `trx` para preservar atomicidade. O INSERT em `posts`
// permanece inline na mesma transação (fora do escopo desta fatia mover posts).

import { votesRepository } from './votes.repository';
import { runTenantTransaction } from '@core/db';
import { ensureUserActor } from '@modules/identity/actor-writer.service';
import { HttpError } from '@core/errors/http-error';
import { isActorEffectivelyBlocked } from '@modules/risk-identity/actor-effective-block';
import type {
  GroupVote,
  CreateVoteInput,
  VoteWithOptions,
  VoteWithVoters,
} from './votes.types';

class VotesService {
  /**
   * 🔴 F-GROUPS-VOTES-POST-INTENT-QUARANTINE-GATE (§4.8.4) — autoridade-ATIVA. A rota autoriza admin/owner do grupo;
   * quarentena DECIDE se o actor está ATIVO. Criar votação cria estado (group_votes/group_vote_options) E um post
   * social inline com intent='vote' — porta lateral fora do gate canônico de social 2.0. Recebe o actorId JÁ
   * RESOLVIDO por ensureUserActor (NUNCA userId/globalUserId/createdByUserId cru). Chamar ANTES da transação/escrita.
   * NÃO toca canRepresentActor (que segue puro). 403 ACTOR_EFFECTIVELY_BLOCKED.
   */
  private async assertActorNotQuarantined(tenantId: string, actorId: string): Promise<void> {
    if (await isActorEffectivelyBlocked(tenantId, actorId)) {
      throw HttpError.forbidden(
        'ACTOR_EFFECTIVELY_BLOCKED: actor em quarentena (ou âncora humana bloqueada) — criação/voto de votação bloqueado (§4.8.4).'
      );
    }
  }

  async createVote(
    tenantId: string,
    groupId: string,
    input: CreateVoteInput,
    userId: string
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

    // Validar: closesAt (se definido) deve ser futuro
    if (input.closesAt) {
      const closesAt = new Date(input.closesAt);
      const now = new Date();
      if (closesAt <= now) {
        throw new Error('Data de encerramento deve ser no futuro');
      }
    }

    // Identidade operacional: resolver ANTES da transação (ensureUserActor usa conexão própria).
    const userActor = await ensureUserActor(tenantId, userId);
    const actorId = userActor.actor_id;

    // 🔴 F-GROUPS-VOTES-POST-INTENT-QUARANTINE-GATE: actor bloqueado não cria votação/opções/post intent='vote'.
    // ANTES da transação → nenhuma escrita parcial em group_votes/group_vote_options/posts. Atomicidade preservada.
    await this.assertActorNotQuarantined(tenantId, actorId);

    // Transação atômica: votação + opções + post no feed (mesma trx).
    return await runTenantTransaction(tenantId, async (trx) => {
      // 1. Criar votação (created_by_actor_id = actorId) — SQL no repository.
      const vote = await votesRepository.createVote(tenantId, groupId, actorId, input, trx);

      // 2. Criar opções — SQL no repository.
      await votesRepository.createVoteOptions(tenantId, vote.voteId, input.options, trx);

      // 3. Criar post no feed com intent='vote' (INSERT inline mantido nesta fatia).
      const intentMetadata = {
        voteId: vote.voteId,
        title: input.title,
        optionCount: input.options.length,
        closesAt: input.closesAt || null,
      };

      // Schema vivo de `posts` é actor-keyed: actor_id + media_ids (UUID[], default '{}'); NÃO existe
      // global_user_id nem coluna `media`; PK é `id`. (DT-GROUPS-VOTES-POST-INSERT-SCHEMA-DRIFT)
      const postRows = await trx.query({
        text: `
          INSERT INTO posts (
            tenant_id, actor_id, content, intent, intent_metadata, targeting, metadata
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, '{}'::jsonb, $6::jsonb)
          RETURNING id, created_at, updated_at
        `,
        values: [
          tenantId,
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

    // "Eu votei?" resolvido pela identidade operacional (actor_id), não user_id.
    const userActor = await ensureUserActor(tenantId, userId);
    const actorVote = await votesRepository.getActorVote(tenantId, voteId, userActor.actor_id);

    const optionsWithCounts = options.map((opt) => ({
      ...opt,
      voteCount: counts.get(opt.optionId) || 0,
    }));

    const totalVotes = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);

    const voteWithOptions: VoteWithOptions = {
      ...vote,
      options: optionsWithCounts,
      totalVotes,
      userVoted: !!actorVote,
      userVoteOptionId: actorVote?.optionId || null,
    };

    // Se admin/owner, incluir lista de votantes (por actor; anonimato NÃO aplicado — DT OPEN).
    if (isAdminOrOwner) {
      const votersRaw = await votesRepository.getVotersByOption(tenantId, voteId);
      const voteWithVoters: VoteWithVoters = {
        ...voteWithOptions,
        voters: votersRaw.map((v) => ({
          optionId: v.optionId,
          actorId: v.actorId,
          actorName: v.actorName,
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

    // Identidade operacional do voto = actor_id (resolvido por ensureUserActor).
    const userActor = await ensureUserActor(tenantId, userId);
    const actorId = userActor.actor_id;

    // 🔴 F-GROUPS-VOTES-POST-INTENT-QUARANTINE-GATE: actor bloqueado não registra voto (createVoteResponse).
    await this.assertActorNotQuarantined(tenantId, actorId);

    // Validar: actor ainda não votou (UNIQUE(vote_id, actor_id) também previne).
    const existingVote = await votesRepository.getActorVote(tenantId, voteId, actorId);
    if (existingVote) {
      throw new Error('Você já votou nesta votação');
    }

    // Registrar voto (actor_id, não user_id).
    await votesRepository.createVoteResponse(tenantId, voteId, optionId, actorId);
  }

  async closeVote(
    tenantId: string,
    groupId: string,
    voteId: string,
    userId: string
  ): Promise<GroupVote> {
    // Validar: votação existe
    const vote = await votesRepository.getVote(tenantId, voteId);
    if (!vote || vote.groupId !== groupId) {
      throw new Error('Votação não encontrada');
    }

    // 🔴 F-GROUPS-VOTES-CLOSEVOTE-QUARANTINE-GATE: admin/owner (rota) DECIDE permissão; quarentena DECIDE se o actor
    // está ATIVO. Resolver a identidade operacional e gatear ANTES do UPDATE group_votes SET status='closed'.
    const userActor = await ensureUserActor(tenantId, userId);
    await this.assertActorNotQuarantined(tenantId, userActor.actor_id);

    // Fechar votação
    return votesRepository.closeVote(tenantId, voteId);
  }
}

export const votesService = new VotesService();
