// backend/tests/integration/groups-votes-schema-drift.test.ts
// F-GROUPS-VOTES-SCHEMA-DRIFT-FIX (DT-GROUPS-VOTES-SCHEMA-DRIFT).
//
// Prova CONTIDA, repository-level, contra o SCHEMA VIVO actor-keyed:
//   group_votes.created_by_actor_id · group_vote_options.label · group_vote_responses.actor_id
// e que NÃO depende das colunas antigas (vote_id-PK / created_by_user_id / option_id-PK / text /
// response_id / user_id). Reusa tenant+actor existentes; cria/limpa apenas o próprio group+vote.
// Não move dinheiro, não toca bank_*, não liga worker.

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { pool } from '../../src/core/database/pool';
import { votesRepository } from '../../src/modules/groups/votes.repository';

describe('Groups Votes — alinhamento ao schema actor-keyed (DT-GROUPS-VOTES-SCHEMA-DRIFT)', () => {
  let tenantId: string;
  let actorId: string;
  let groupId: string;
  let voteId = '';
  let optionIds: string[] = [];

  beforeAll(async () => {
    // tenant que tenha ao menos 1 actor (fixture reusável, sem criar identidade)
    const t = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM actors GROUP BY tenant_id HAVING count(*) >= 1 ORDER BY count(*) DESC LIMIT 1`
    );
    if (t.rows.length === 0) throw new Error('Nenhum tenant com actors para fixture');
    tenantId = t.rows[0].tenant_id;

    const a = await pool.query<{ id: string }>(
      `SELECT id FROM actors WHERE tenant_id = $1 ORDER BY created_at LIMIT 1`,
      [tenantId]
    );
    actorId = a.rows[0].id;

    const g = await pool.query<{ id: string }>(
      `INSERT INTO groups (tenant_id, name, owner_actor_id) VALUES ($1, 'DRIFT-TEST-VOTES', $2) RETURNING id`,
      [tenantId, actorId]
    );
    groupId = g.rows[0].id;
  });

  afterAll(async () => {
    try {
      if (voteId) {
        await pool.query(`DELETE FROM group_vote_responses WHERE vote_id = $1`, [voteId]);
        await pool.query(`DELETE FROM group_vote_options WHERE vote_id = $1`, [voteId]);
        await pool.query(`DELETE FROM group_votes WHERE id = $1`, [voteId]);
      }
      if (groupId) await pool.query(`DELETE FROM groups WHERE id = $1`, [groupId]);
    } catch {
      /* cleanup best-effort */
    }
  });

  it('createVote grava em created_by_actor_id (não created_by_user_id)', async () => {
    const vote = await votesRepository.createVote(tenantId, groupId, actorId, {
      title: 'Drift fix?',
      options: ['A', 'B'],
    });
    voteId = vote.voteId;

    expect(vote.voteId).toBeTruthy(); // DTO voteId = group_votes.id
    expect(vote.createdByActorId).toBe(actorId);

    const row = await pool.query<{ created_by_actor_id: string }>(
      `SELECT created_by_actor_id FROM group_votes WHERE id = $1`,
      [voteId]
    );
    expect(row.rows[0].created_by_actor_id).toBe(actorId);
  });

  it('createVoteOptions grava em label (não text)', async () => {
    const opts = await votesRepository.createVoteOptions(tenantId, voteId, ['Sim', 'Não']);
    optionIds = opts.map((o) => o.optionId);

    expect(opts).toHaveLength(2);
    expect(opts[0].text).toBe('Sim'); // DTO text = coluna real label

    const rows = await pool.query<{ label: string }>(
      `SELECT label FROM group_vote_options WHERE vote_id = $1 ORDER BY display_order`,
      [voteId]
    );
    expect(rows.rows.map((r) => r.label)).toEqual(['Sim', 'Não']);
  });

  it('createVoteResponse grava actor_id; UNIQUE(vote_id, actor_id) impede 2º voto do mesmo actor', async () => {
    const resp = await votesRepository.createVoteResponse(tenantId, voteId, optionIds[0], actorId);
    expect(resp.actorId).toBe(actorId);

    const row = await pool.query<{ actor_id: string }>(
      `SELECT actor_id FROM group_vote_responses WHERE id = $1`,
      [resp.responseId]
    );
    expect(row.rows[0].actor_id).toBe(actorId);

    // segundo voto do MESMO actor → viola UNIQUE(vote_id, actor_id)
    await expect(
      votesRepository.createVoteResponse(tenantId, voteId, optionIds[1], actorId)
    ).rejects.toThrow();
  });

  it('getActorVote resolve por actor_id; getVotersByOption junta actors (não users)', async () => {
    const av = await votesRepository.getActorVote(tenantId, voteId, actorId);
    expect(av?.actorId).toBe(actorId);

    const voters = await votesRepository.getVotersByOption(tenantId, voteId);
    expect(voters).toHaveLength(1);
    expect(voters[0].actorId).toBe(actorId);
    expect(voters[0]).toHaveProperty('actorName'); // display_name do actor (ou null), nunca users.name
  });

  it('o schema vivo NÃO tem as colunas antigas (drift fechado)', async () => {
    const colsOf = async (table: string) => {
      const r = await pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
        [table]
      );
      return r.rows.map((x) => x.column_name);
    };
    const votes = await colsOf('group_votes');
    const options = await colsOf('group_vote_options');
    const responses = await colsOf('group_vote_responses');

    expect(votes).toContain('created_by_actor_id');
    expect(votes).not.toContain('created_by_user_id');
    expect(votes).not.toContain('vote_id'); // PK de group_votes é id

    expect(options).toContain('label');
    expect(options).not.toContain('text');
    expect(options).not.toContain('option_id'); // PK de group_vote_options é id

    expect(responses).toContain('actor_id');
    expect(responses).not.toContain('user_id');
    expect(responses).not.toContain('response_id'); // PK de group_vote_responses é id
  });
});
