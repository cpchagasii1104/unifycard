/**
 * Único caminho suportado para criar linhas em `concepts` (norma 18_DOMAIN_ONTOLOGY 5.5).
 * O trigger `trg_concept_governance` exige set_config na mesma transação.
 */
import type { PoolClient } from 'pg';
import { pool } from '../database/pool';
import { isN0DomainKey, type N0DomainKey } from './n0-domains';

export type CreateConceptInput = {
  slug: string;
  /** domain_key em `domains` (N0) */
  domain: N0DomainKey | string;
};

/** Normaliza slug para armazenamento (alinhado a convenções existentes no projeto). */
export function normalizeConceptSlug(raw: string): string {
  const t = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return t;
}

/**
 * Ativa o bypass do trigger na transação corrente (chamar após BEGIN).
 */
export async function enableConceptGovernanceInsert(client: PoolClient): Promise<void> {
  await client.query(`SELECT set_config('app.concept_governance', 'true', true)`);
}

/**
 * Cria ou resolve concept existente (ON CONFLICT por UNIQUE domain+slug).
 * O cliente deve estar numa transação aberta.
 */
export async function createConceptWithClient(
  client: PoolClient,
  input: CreateConceptInput
): Promise<{ concept_id: string }> {
  const slug = normalizeConceptSlug(input.slug);
  if (!slug) {
    throw new Error('concept: slug vazio ou inválido após normalização');
  }
  if (!isN0DomainKey(input.domain)) {
    throw new Error(`concept: domain não é N0 canónico: ${input.domain}`);
  }

  await enableConceptGovernanceInsert(client);

  const ins = await client.query<{ concept_id: string }>(
    `
    INSERT INTO concepts (slug, domain)
    VALUES ($1, $2)
    ON CONFLICT (domain, slug) DO NOTHING
    RETURNING concept_id
    `,
    [slug, input.domain]
  );

  if (ins.rows[0]) {
    return { concept_id: ins.rows[0].concept_id };
  }

  const sel = await client.query<{ concept_id: string }>(
    `SELECT concept_id FROM concepts WHERE domain = $1 AND slug = $2 LIMIT 1`,
    [input.domain, slug]
  );
  const row = sel.rows[0];
  if (!row) {
    throw new Error(`concept: falha ao resolver após ON CONFLICT slug=${slug} domain=${input.domain}`);
  }
  return { concept_id: row.concept_id };
}

/**
 * Transação própria: connect → BEGIN → createConceptWithClient → COMMIT.
 */
export async function createConcept(input: CreateConceptInput): Promise<{ concept_id: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await createConceptWithClient(client, input);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}