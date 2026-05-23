/**
 * Ponte category_id → validação de CONCEPT (modo estrito).
 *
 * - NÃO persiste concept_id em global_users.metadata.
 * - Sem `continue`/omit/warn: inconsistência → HttpError (400).
 * - metadata.learnings / interests: apenas `string[]` UUID; objetos legados → 400.
 */
import type { Pool } from 'pg';
import { HttpError } from '../errors/http-error';

/** Formato UUID (validação sintática; vínculo semântico em `categories.concept_id`). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SEMANTIC_GUARD_LOG = '[semantic-guard:profile-metadata]' as const;
export const SEMANTIC_GUARD_WRITE_LOG = '[semantic-guard:profile-write]' as const;

/**
 * Leitura de `global_users.metadata`: **só** array de UUID strings.
 * Objetos `{ categoryName, categoryPath, ... }` → **400** (sem normalização inteligente).
 */
export function assertStoredProfileCategoryIdsStrict(raw: unknown, field: string): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    console.error(SEMANTIC_GUARD_LOG, `${field}: metadata não é array de UUIDs`);
    throw HttpError.badRequest(
      `${field}: armazenamento inválido — esperado array de UUIDs (category_id). Corrija metadata.`,
    );
  }
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const el = raw[i];
    if (el !== null && typeof el === 'object') {
      console.error(
        SEMANTIC_GUARD_LOG,
        `${field}[${i}]: JSON legado com objeto (categoryName/categoryPath/categoryId) proibido`,
      );
      throw HttpError.badRequest(
        `${field}: metadata legado com objetos — apenas lista de UUIDs. Migre ou limpe global_users.metadata.`,
      );
    }
    if (typeof el !== 'string' || !UUID_RE.test(el.trim())) {
      console.error(SEMANTIC_GUARD_WRITE_LOG, `${field}[${i}]: valor não é UUID string`);
      throw HttpError.badRequest(`${field}[${i}]: cada item deve ser UUID válido (category_id).`);
    }
    out.push(el.trim());
  }
  return [...new Set(out)];
}

/**
 * Escrita API: **apenas** array de strings UUID.
 */
export function assertWritePayloadCategoryIdsOnly(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    console.error(SEMANTIC_GUARD_WRITE_LOG, `${field} deve ser array de UUIDs`, { typeof: typeof value });
    throw HttpError.badRequest(`${field}: envie apenas lista de UUIDs (category_id).`);
  }
  const out: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const el = value[i];
    if (typeof el !== 'string' || !UUID_RE.test(el.trim())) {
      console.error(SEMANTIC_GUARD_WRITE_LOG, `${field}[${i}] inválido — esperado uuid string`, {
        type: typeof el,
      });
      throw HttpError.badRequest(`${field}: cada item deve ser UUID (category_id), sem objetos nem slug.`);
    }
    out.push(el.trim());
  }
  return [...new Set(out)];
}

/**
 * Valida que cada category_id existe no escopo, está ativa e tem concept_id.
 */
export async function requireCategoriesWithConceptForScope(
  pool: Pool,
  categoryIds: string[],
  scope: 'learning' | 'interest',
): Promise<void> {
  const unique = [...new Set(categoryIds.filter(Boolean))];
  if (unique.length === 0) return;

  const res = await pool.query<{ category_id: string; concept_id: string | null }>(
    `
    SELECT category_id, concept_id
    FROM categories
    WHERE category_id = ANY($1::uuid[])
      AND scope = $2
      AND (status IS NULL OR status = 'active' OR status = 'auto_active')
    `,
    [unique, scope],
  );

  if (res.rows.length !== unique.length) {
    const found = new Set(res.rows.map((r) => r.category_id));
    const missing = unique.filter((id) => !found.has(id));
    throw HttpError.badRequest(
      `Derivação semântica bloqueada: categoria(s) inexistente(s), inativa(s) ou fora do escopo '${scope}': ${missing.join(', ')}`,
    );
  }

  const nullConcept = res.rows.filter((r) => r.concept_id == null).map((r) => r.category_id);
  if (nullConcept.length > 0) {
    throw HttpError.badRequest(
      `Derivação semântica bloqueada: concept_id obrigatório em categories: ${nullConcept.join(', ')}`,
    );
  }
}

export type CategoryNavigationRow = {
  categoryId: string;
  categoryName: string;
  categoryPath: string[];
  level: number;
};

/**
 * Enriquecimento a partir de `categories`: qualquer id sem linha ativa ou sem concept_id → **400**.
 */
export async function enrichCategoryNavigationByIds(
  pool: Pool,
  categoryIds: string[],
  scope: 'learning' | 'interest',
): Promise<CategoryNavigationRow[]> {
  const unique = [...new Set(categoryIds.filter(Boolean))];
  if (unique.length === 0) return [];

  const res = await pool.query<{
    category_id: string;
    name: string;
    path: string[] | null;
    level: number | null;
    concept_id: string | null;
  }>(
    `
    SELECT category_id, name, path, level, concept_id
    FROM categories
    WHERE category_id = ANY($1::uuid[])
      AND scope = $2
      AND (status IS NULL OR status = 'active' OR status = 'auto_active')
    `,
    [unique, scope],
  );

  const byId = new Map(res.rows.map((r) => [r.category_id, r]));
  const out: CategoryNavigationRow[] = [];

  for (const id of unique) {
    const row = byId.get(id);
    if (!row) {
      throw HttpError.badRequest(
        `Perfil: category_id ${id} inexistente ou inativa para escopo '${scope}' (leitura estrita).`,
      );
    }
    if (row.concept_id == null) {
      throw HttpError.badRequest(
        `Perfil: category_id ${id} sem concept_id — dados inconsistentes (leitura estrita).`,
      );
    }
    out.push({
      categoryId: row.category_id,
      categoryName: row.name,
      categoryPath: row.path ?? [],
      level: row.level ?? 0,
    });
  }

  return out;
}

export type ProfessionalCategoryRow = {
  category_id: string;
  name: string;
  path: string[];
  level: number;
  concept_id: string;
  scope: string;
};

/**
 * Skills profissionais: todas as categorias devem existir, scope professional|global, ativas, level<=2, concept_id NOT NULL.
 * Retorna mapa para montagem do read model (sem skip).
 */
export async function resolveProfessionalSkillCategoriesStrict(
  pool: Pool,
  categoryIds: string[],
): Promise<Map<string, ProfessionalCategoryRow>> {
  const unique = [...new Set(categoryIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const res = await pool.query<{
    category_id: string;
    name: string;
    path: string[] | null;
    level: number | null;
    concept_id: string | null;
    scope: string;
  }>(
    `
    SELECT category_id, name, path, level, concept_id, scope
    FROM categories
    WHERE category_id = ANY($1::uuid[])
      AND scope IN ('professional', 'global')
      AND (status IS NULL OR status = 'active' OR status = 'auto_active')
    `,
    [unique],
  );

  if (res.rows.length !== unique.length) {
    const found = new Set(res.rows.map((r) => r.category_id));
    const missing = unique.filter((id) => !found.has(id));
    throw HttpError.badRequest(
      `Perfil profissional: categoria(s) inexistente(s), inativa(s) ou fora de scope professional/global: ${missing.join(', ')}`,
    );
  }

  const map = new Map<string, ProfessionalCategoryRow>();
  for (const r of res.rows) {
    if (r.concept_id == null) {
      throw HttpError.badRequest(
        `Perfil profissional: category_id ${r.category_id} sem concept_id (dados corruptos).`,
      );
    }
    if ((r.level ?? 99) > 2) {
      throw HttpError.badRequest(
        `Perfil profissional: category_id ${r.category_id} com level > 2 não permitido para skill.`,
      );
    }
    map.set(r.category_id, {
      category_id: r.category_id,
      name: r.name,
      path: r.path ?? [],
      level: r.level ?? 0,
      concept_id: r.concept_id,
      scope: r.scope,
    });
  }
  return map;
}

/**
 * Escrita em `user_skills_categories`: mesmas regras que `resolveProfessionalSkillCategoriesStrict`
 * (existe, ativa, scope professional|global, concept_id NOT NULL, level ≤ 2).
 */
export async function assertCategoryWritableForUserSkillsStrict(
  pool: Pool,
  categoryId: string,
): Promise<void> {
  const res = await pool.query<{
    category_id: string;
    concept_id: string | null;
    scope: string;
    level: number | null;
    status: string | null;
  }>(
    `
    SELECT category_id, concept_id, scope, level, status
    FROM categories
    WHERE category_id = $1::uuid
    LIMIT 1
    `,
    [categoryId],
  );
  const row = res.rows[0];
  if (!row) {
    throw HttpError.badRequest(`skill: category_id ${categoryId} inexistente.`);
  }
  const st = row.status;
  if (st != null && st !== 'active' && st !== 'auto_active') {
    throw HttpError.badRequest(`skill: category_id ${categoryId} inativa (status=${st}).`);
  }
  if (row.scope !== 'professional' && row.scope !== 'global') {
    throw HttpError.badRequest(
      `skill: category_id ${categoryId} fora de scope professional/global.`,
    );
  }
  if (row.concept_id == null) {
    throw HttpError.badRequest(
      `skill: category_id ${categoryId} sem concept_id (Lei 7 — escrita bloqueada).`,
    );
  }
  if ((row.level ?? 99) > 2) {
    throw HttpError.badRequest(`skill: category_id ${categoryId} level > 2 não permitido para skill.`);
  }
}

export const assertCategoryIdsBackedByConceptOrThrow = requireCategoriesWithConceptForScope;