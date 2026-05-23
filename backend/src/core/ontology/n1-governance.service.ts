/**
 * Único caminho suportado para escrever em `n1_nodes`, `n1_localized_names` e
 * `category_n1_mapping` (norma 19_N1_NAVIGATION_STRUCTURE_UNIFICARD).
 * Triggers exigem set_config na mesma transação.
 */
import type { PoolClient } from 'pg';
import { pool } from '../database/pool';
import { normalizeConceptSlug } from './concept-governance.service';

export async function enableN1GovernanceWrite(client: PoolClient): Promise<void> {
  await client.query(`SELECT set_config('app.n1_governance', 'true', true)`);
}

async function assertDomainKeyExists(client: PoolClient, domainKey: string): Promise<void> {
  const r = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM domains WHERE domain_key = $1`,
    [domainKey]
  );
  if (Number(r.rows[0]?.n ?? 0) < 1) {
    throw new Error(`n1: domain_key inexistente em domains: ${domainKey}`);
  }
}

async function assertN1Exists(client: PoolClient, n1Id: string): Promise<void> {
  const r = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM n1_nodes WHERE n1_id = $1::uuid`,
    [n1Id]
  );
  if (Number(r.rows[0]?.n ?? 0) < 1) {
    throw new Error(`n1: n1_id inexistente: ${n1Id}`);
  }
}

async function assertCategoryExists(client: PoolClient, categoryId: string): Promise<void> {
  const r = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM categories WHERE category_id = $1::uuid`,
    [categoryId]
  );
  if (Number(r.rows[0]?.n ?? 0) < 1) {
    throw new Error(`n1: category_id inexistente: ${categoryId}`);
  }
}

function normalizeN1Slug(raw: string): string {
  const slug = normalizeConceptSlug(raw);
  if (slug.length > 64) {
    throw new Error('n1: slug excede 64 caracteres após normalização');
  }
  return slug;
}

export type CreateN1NodeInput = {
  slug: string;
  domainKey: string;
  sortOrder?: number;
  /** Nome exibido (ex.: pt-BR). */
  displayName: string;
  locale?: string;
};

export async function createN1NodeWithClient(
  client: PoolClient,
  input: CreateN1NodeInput
): Promise<{ n1Id: string }> {
  const slug = normalizeN1Slug(input.slug);
  if (!slug) {
    throw new Error('n1: slug vazio ou inválido após normalização');
  }
  const domainKey = input.domainKey.trim();
  if (!domainKey) {
    throw new Error('n1: domain_key vazio');
  }
  const locale = (input.locale ?? 'pt-BR').trim() || 'pt-BR';
  const displayName = input.displayName.trim();
  if (!displayName) {
    throw new Error('n1: displayName vazio');
  }

  await assertDomainKeyExists(client, domainKey);
  await enableN1GovernanceWrite(client);

  const ins = await client.query<{ n1_id: string }>(
    `
    INSERT INTO n1_nodes (slug, domain_key, sort_order)
    VALUES ($1, $2, COALESCE($3, 0))
    RETURNING n1_id
    `,
    [slug, domainKey, input.sortOrder ?? null]
  );
  const n1Id = ins.rows[0]?.n1_id;
  if (!n1Id) {
    throw new Error('n1: falha ao criar nó');
  }

  await client.query(
    `
    INSERT INTO n1_localized_names (n1_id, locale, display_name)
    VALUES ($1::uuid, $2, $3)
    `,
    [n1Id, locale, displayName]
  );

  return { n1Id };
}

export async function createN1Node(input: CreateN1NodeInput): Promise<{ n1Id: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await createN1NodeWithClient(client, input);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export type UpdateN1NodeInput = {
  n1Id: string;
  /** Alteração de slug/domain exige RFC; não suportado aqui. */
  sortOrder?: number;
  localized?: { locale: string; displayName: string }[];
};

export async function updateN1NodeWithClient(client: PoolClient, input: UpdateN1NodeInput): Promise<void> {
  await assertN1Exists(client, input.n1Id);
  await enableN1GovernanceWrite(client);

  if (input.sortOrder !== undefined) {
    await client.query(
      `UPDATE n1_nodes SET sort_order = $2 WHERE n1_id = $1::uuid`,
      [input.n1Id, input.sortOrder]
    );
  }

  if (input.localized?.length) {
    for (const row of input.localized) {
      const loc = row.locale.trim();
      const name = row.displayName.trim();
      if (!loc || !name) {
        throw new Error('n1: locale e displayName obrigatórios em localized');
      }
      await client.query(
        `
        INSERT INTO n1_localized_names (n1_id, locale, display_name)
        VALUES ($1::uuid, $2, $3)
        ON CONFLICT (n1_id, locale) DO UPDATE SET display_name = EXCLUDED.display_name
        `,
        [input.n1Id, loc, name]
      );
    }
  }
}

export async function updateN1Node(input: UpdateN1NodeInput): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await updateN1NodeWithClient(client, input);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function linkCategoryToN1WithClient(
  client: PoolClient,
  categoryId: string,
  n1Id: string
): Promise<void> {
  await assertCategoryExists(client, categoryId);
  await assertN1Exists(client, n1Id);
  await enableN1GovernanceWrite(client);

  await client.query(
    `
    INSERT INTO category_n1_mapping (category_id, n1_id)
    VALUES ($1::uuid, $2::uuid)
    ON CONFLICT (category_id) DO UPDATE SET n1_id = EXCLUDED.n1_id
    `,
    [categoryId, n1Id]
  );
}

export async function linkCategoryToN1(categoryId: string, n1Id: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await linkCategoryToN1WithClient(client, categoryId, n1Id);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}