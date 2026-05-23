/**
 * Único caminho suportado para escrever em `concept_relations`.
 * Trigger `trg_concept_relation_governance` exige set_config na mesma transação.
 */
import type { PoolClient } from 'pg';
import { pool } from '../database/pool';
import type { GraphRelationType } from './graph.adapter';

const RELATION_TYPES: ReadonlySet<string> = new Set<GraphRelationType>([
  'enables',
  'evolves_to',
  'related_to',
]);

export function isGraphRelationType(value: string): value is GraphRelationType {
  return RELATION_TYPES.has(value);
}

export type CreateConceptRelationInput = {
  subjectConceptId: string;
  objectConceptId: string;
  relationType: GraphRelationType;
  weight?: number;
  metadata?: Record<string, unknown>;
};

export async function enableGraphGovernanceWrite(client: PoolClient): Promise<void> {
  await client.query(`SELECT set_config('app.graph_governance', 'true', true)`);
}

async function assertConceptExists(client: PoolClient, conceptId: string): Promise<void> {
  const r = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM concepts WHERE concept_id = $1::uuid`,
    [conceptId]
  );
  if (Number(r.rows[0]?.n ?? 0) < 1) {
    throw new Error(`graph: concept_id inexistente: ${conceptId}`);
  }
}

/**
 * Cria aresta; se já existir (UNIQUE), devolve o relation_id existente.
 */
export async function createConceptRelationWithClient(
  client: PoolClient,
  input: CreateConceptRelationInput
): Promise<{ relation_id: string }> {
  const {
    subjectConceptId,
    objectConceptId,
    relationType,
    weight = 1,
    metadata = {},
  } = input;

  if (subjectConceptId === objectConceptId) {
    throw new Error('graph: subject e object não podem ser o mesmo concept');
  }
  if (!isGraphRelationType(relationType)) {
    throw new Error(`graph: relation_type inválido: ${relationType}`);
  }

  await assertConceptExists(client, subjectConceptId);
  await assertConceptExists(client, objectConceptId);

  await enableGraphGovernanceWrite(client);

  const ins = await client.query<{ relation_id: string }>(
    `
    INSERT INTO concept_relations (subject_concept_id, object_concept_id, relation_type, weight, metadata)
    VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb)
    ON CONFLICT (subject_concept_id, object_concept_id, relation_type) DO NOTHING
    RETURNING relation_id
    `,
    [subjectConceptId, objectConceptId, relationType, weight, JSON.stringify(metadata)]
  );

  if (ins.rows[0]) {
    return { relation_id: ins.rows[0].relation_id };
  }

  const sel = await client.query<{ relation_id: string }>(
    `
    SELECT relation_id FROM concept_relations
    WHERE subject_concept_id = $1::uuid
      AND object_concept_id = $2::uuid
      AND relation_type = $3
    LIMIT 1
    `,
    [subjectConceptId, objectConceptId, relationType]
  );
  const row = sel.rows[0];
  if (!row) {
    throw new Error('graph: falha ao resolver após ON CONFLICT');
  }
  return { relation_id: row.relation_id };
}

export async function createConceptRelation(
  input: CreateConceptRelationInput
): Promise<{ relation_id: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await createConceptRelationWithClient(client, input);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}