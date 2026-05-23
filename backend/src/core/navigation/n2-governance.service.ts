/**
 * Escrita em `n2_nodes`, `context_nodes`, `context_n2_mapping` e tabelas localizadas
 * (norma 20_N2_NAVIGATION_STRUCTURE_UNIFICARD). Triggers exigem set_config na transação.
 */
import type { PoolClient } from 'pg';
import { pool } from '../database/pool';
import { normalizeConceptSlug } from '../ontology/concept-governance.service';

export async function enableN2GovernanceWrite(client: PoolClient): Promise<void> {
  await client.query(`SELECT set_config('app.n2_governance', 'true', true)`);
}

function normalizeN2Slug(raw: string): string {
  const slug = normalizeConceptSlug(raw);
  if (slug.length > 64) {
    throw new Error('n2: slug excede 64 caracteres após normalização');
  }
  return slug;
}

function normalizeContextSlug(raw: string): string {
  return normalizeN2Slug(raw);
}

async function assertN1Exists(client: PoolClient, n1Id: string): Promise<void> {
  const r = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM n1_nodes WHERE n1_id = $1::uuid`,
    [n1Id]
  );
  if (Number(r.rows[0]?.n ?? 0) < 1) {
    throw new Error(`n2: n1_id inexistente: ${n1Id}`);
  }
}

async function assertContextIdExists(client: PoolClient, contextId: string): Promise<void> {
  const r = await client.query<{ n: string }>(
    `
    SELECT COUNT(*)::text AS n
    FROM context_nodes
    WHERE context_id = $1::uuid
      AND deprecated_at IS NULL
    `,
    [contextId]
  );
  if (Number(r.rows[0]?.n ?? 0) < 1) {
    throw new Error(`n2: context_id inexistente ou deprecated: ${contextId}`);
  }
}

async function assertN2Exists(client: PoolClient, n2Id: string): Promise<void> {
  const r = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM n2_nodes WHERE n2_id = $1::uuid`,
    [n2Id]
  );
  if (Number(r.rows[0]?.n ?? 0) < 1) {
    throw new Error(`n2: n2_id inexistente: ${n2Id}`);
  }
}

async function assertDomainKeyIfSet(
  client: PoolClient,
  domainKey: string | null | undefined
): Promise<void> {
  if (domainKey == null || domainKey === '') {
    return;
  }
  const r = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM domains WHERE domain_key = $1`,
    [domainKey]
  );
  if (Number(r.rows[0]?.n ?? 0) < 1) {
    throw new Error(`n2: domain_key inexistente em domains: ${domainKey}`);
  }
}

export type CreateN2NodeInput = {
  slug: string;
  n1Id: string;
  sortOrder?: number;
  isActive?: boolean;
  /** Nome exibido (ex.: pt-BR). */
  displayName?: string;
  locale?: string;
};

export async function createN2NodeWithClient(
  client: PoolClient,
  input: CreateN2NodeInput
): Promise<{ n2Id: string }> {
  const slug = normalizeN2Slug(input.slug);
  if (!slug) {
    throw new Error('n2: slug vazio ou inválido após normalização');
  }
  await assertN1Exists(client, input.n1Id);

  const dup = await client.query(
    `SELECT 1 FROM n2_nodes WHERE n1_id = $1::uuid AND slug = $2 LIMIT 1`,
    [input.n1Id, slug]
  );
  if (dup.rows.length > 0) {
    throw new Error(`n2: slug duplicado para este N1: ${slug}`);
  }

  await enableN2GovernanceWrite(client);

  const ins = await client.query<{ n2_id: string }>(
    `
    INSERT INTO n2_nodes (slug, n1_id, sort_order, is_active)
    VALUES ($1, $2::uuid, COALESCE($3, 0), COALESCE($4, true))
    RETURNING n2_id
    `,
    [slug, input.n1Id, input.sortOrder ?? null, input.isActive ?? null]
  );
  const n2Id = ins.rows[0]?.n2_id;
  if (!n2Id) {
    throw new Error('n2: falha ao criar nó');
  }

  const locale = (input.locale ?? 'pt-BR').trim() || 'pt-BR';
  const displayName = input.displayName?.trim();
  if (displayName) {
    await client.query(
      `
      INSERT INTO n2_localized_names (n2_id, locale, value, priority)
      VALUES ($1::uuid, $2, $3, 1)
      `,
      [n2Id, locale, displayName]
    );
  }

  return { n2Id };
}

/**
 * Idempotente: retorna `n2_id` existente ou cria linha + nome localizado (se `created`).
 */
export async function getOrCreateN2NodeWithClient(
  client: PoolClient,
  input: CreateN2NodeInput
): Promise<{ n2Id: string; created: boolean }> {
  const slug = normalizeN2Slug(input.slug);
  if (!slug) {
    throw new Error('n2: slug vazio ou inválido após normalização');
  }
  await assertN1Exists(client, input.n1Id);

  const ex = await client.query<{ n2_id: string }>(
    `SELECT n2_id FROM n2_nodes WHERE n1_id = $1::uuid AND slug = $2 LIMIT 1`,
    [input.n1Id, slug]
  );
  if (ex.rows[0]) {
    return { n2Id: ex.rows[0].n2_id, created: false };
  }

  await enableN2GovernanceWrite(client);

  const ins = await client.query<{ n2_id: string }>(
    `
    INSERT INTO n2_nodes (slug, n1_id, sort_order, is_active)
    VALUES ($1, $2::uuid, COALESCE($3, 0), COALESCE($4, true))
    RETURNING n2_id
    `,
    [slug, input.n1Id, input.sortOrder ?? null, input.isActive ?? null]
  );
  const n2Id = ins.rows[0]?.n2_id;
  if (!n2Id) {
    throw new Error('n2: falha ao criar nó');
  }

  const locale = (input.locale ?? 'pt-BR').trim() || 'pt-BR';
  const displayName = input.displayName?.trim();
  if (displayName) {
    await client.query(
      `
      INSERT INTO n2_localized_names (n2_id, locale, value, priority)
      VALUES ($1::uuid, $2, $3, 1)
      `,
      [n2Id, locale, displayName]
    );
  }

  return { n2Id, created: true };
}

export async function createN2Node(input: CreateN2NodeInput): Promise<{ n2Id: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await createN2NodeWithClient(client, input);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export type CreateContextNodeInput = {
  contextSlug: string;
  domainKey?: string | null;
  isActive?: boolean;
  displayName?: string;
  locale?: string;
};

export async function createContextNodeWithClient(
  client: PoolClient,
  input: CreateContextNodeInput
): Promise<{ contextId: string }> {
  const contextSlug = normalizeContextSlug(input.contextSlug);
  if (!contextSlug) {
    throw new Error('context: context_slug vazio ou inválido após normalização');
  }

  await assertDomainKeyIfSet(client, input.domainKey);

  const exists = await client.query(
    `SELECT 1 FROM context_nodes WHERE context_slug = $1 LIMIT 1`,
    [contextSlug]
  );
  if (exists.rows.length > 0) {
    throw new Error(`context: context_slug já existe: ${contextSlug}`);
  }

  await enableN2GovernanceWrite(client);

  const ins = await client.query<{ context_id: string }>(
    `
    INSERT INTO context_nodes (context_slug, domain_key, is_active)
    VALUES ($1, $2, COALESCE($3, true))
    RETURNING context_id
    `,
    [contextSlug, input.domainKey ?? null, input.isActive ?? null]
  );
  const contextId = ins.rows[0]?.context_id;
  if (!contextId) {
    throw new Error('context: falha ao criar contexto');
  }

  const locale = (input.locale ?? 'pt-BR').trim() || 'pt-BR';
  const displayName = input.displayName?.trim();
  if (displayName) {
    await client.query(
      `
      INSERT INTO context_localized_names (context_id, locale, value, priority)
      VALUES ($1::uuid, $2, $3, 1)
      `,
      [contextId, locale, displayName]
    );
  }

  return { contextId };
}

export async function createContextNode(input: CreateContextNodeInput): Promise<{ contextId: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await createContextNodeWithClient(client, input);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export type LinkContextToN2Input = {
  contextId: string;
  n2Id: string;
  isDefault?: boolean;
  sortOrder?: number;
};

export async function linkContextToN2WithClient(
  client: PoolClient,
  input: LinkContextToN2Input
): Promise<void> {
  await assertContextIdExists(client, input.contextId);
  await assertN2Exists(client, input.n2Id);

  const dup = await client.query(
    `SELECT 1 FROM context_n2_mapping WHERE context_id = $1::uuid AND n2_id = $2::uuid LIMIT 1`,
    [input.contextId, input.n2Id]
  );
  if (dup.rows.length > 0) {
    throw new Error('n2: vínculo context↔n2 já existe');
  }

  await enableN2GovernanceWrite(client);

  await client.query(
    `
    INSERT INTO context_n2_mapping (context_id, n2_id, is_default, sort_order)
    VALUES ($1::uuid, $2::uuid, COALESCE($3, false), COALESCE($4, 0))
    `,
    [input.contextId, input.n2Id, input.isDefault ?? null, input.sortOrder ?? null]
  );
}

/** Idempotente: não falha se o vínculo já existir. */
export async function tryLinkContextToN2WithClient(
  client: PoolClient,
  input: LinkContextToN2Input
): Promise<'linked' | 'already_linked'> {
  await assertContextIdExists(client, input.contextId);
  await assertN2Exists(client, input.n2Id);

  const dup = await client.query(
    `SELECT 1 FROM context_n2_mapping WHERE context_id = $1::uuid AND n2_id = $2::uuid LIMIT 1`,
    [input.contextId, input.n2Id]
  );
  if (dup.rows.length > 0) {
    return 'already_linked';
  }

  await enableN2GovernanceWrite(client);

  await client.query(
    `
    INSERT INTO context_n2_mapping (context_id, n2_id, is_default, sort_order)
    VALUES ($1::uuid, $2::uuid, COALESCE($3, false), COALESCE($4, 0))
    `,
    [input.contextId, input.n2Id, input.isDefault ?? null, input.sortOrder ?? null]
  );
  return 'linked';
}

export async function linkContextToN2(input: LinkContextToN2Input): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await linkContextToN2WithClient(client, input);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}