#!/usr/bin/env node
// PROVA DB (rollback, resíduo-zero) da audiência territorial S-CITY-1 / DECISION-0176.
// Importa o predicado REAL da casa canônica (post-audience.house) via tsx e o avalia contra linhas
// sintéticas numa TEMP TABLE (ON COMMIT DROP) dentro de uma transação sempre revertida. Prova a matriz
// territorial que governa TANTO as coleções quanto o detalhe-por-id/derivado (canViewPost usa o MESMO
// predicado). Zero produto tocado; zero migration; ROLLBACK garante resíduo nulo.
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));

function envDatabaseUrl() {
  const m = readFileSync(join(here, '..', '.env'), 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='));
  if (!m) throw new Error('DATABASE_URL ausente em backend/.env');
  return m.slice('DATABASE_URL='.length).replace(/^"|"$/g, '').trim();
}

const CURITIBA = '9d431002-1fd3-4b34-ae82-678f28f64288';
const OTHER_CITY = '00000000-0000-0000-0000-0000000000ff';
const AUTHOR = '11111111-1111-1111-1111-111111111111';
const VIEWER = '22222222-2222-2222-2222-222222222222';
const TENANT = '33333333-3333-3333-3333-333333333333';
const POST_CBA = '44444444-4444-4444-4444-4444444444a1';
const POST_NULL = '44444444-4444-4444-4444-4444444444b2';

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) { pass++; console.log('  OK  ' + label); } else { fail++; console.log('  FAIL ' + label); } };

async function main() {
  // importa o predicado REAL da casa (pura; a resolução @core acontece via tsx + tsconfig paths)
  const house = await import('../src/modules/social/post-audience.house.ts');
  const { postAudiencePredicateSql, CURITIBA_CITY_ID } = house;
  ok('casa exporta CURITIBA_CITY_ID canônico (server-side, não env)', CURITIBA_CITY_ID === CURITIBA);

  const client = new pg.Client({ connectionString: envDatabaseUrl() });
  await client.connect();
  const baseline = (await client.query('SELECT count(*)::int AS n FROM posts')).rows[0].n;
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TEMP TABLE ptest (
        id uuid, tenant_id uuid, actor_id uuid, visibility text,
        audience_city_id uuid, audience_relationship_types text[]
      ) ON COMMIT DROP`);
    await client.query(
      `INSERT INTO ptest (id, tenant_id, actor_id, visibility, audience_city_id, audience_relationship_types) VALUES
        ($1,$3,$4,'public',$5,NULL),
        ($2,$3,$4,'public',NULL,NULL)`,
      [POST_CBA, POST_NULL, TENANT, AUTHOR, CURITIBA],
    );

    const pred = postAudiencePredicateSql('p', '$2', '$3');
    const sees = async (postId, viewer, viewerCity) => {
      const r = await client.query(
        `SELECT 1 FROM ptest p WHERE p.id = $1 AND ${pred} LIMIT 1`,
        [postId, viewer, viewerCity],
      );
      return r.rows.length > 0;
    };

    // POST territorial (Curitiba)
    ok('territorial: AUTOR vê o próprio post (bypass)', await sees(POST_CBA, AUTHOR, null));
    ok('territorial: leitor com residência Curitiba vê', await sees(POST_CBA, VIEWER, CURITIBA));
    ok('territorial: leitor de OUTRA cidade NÃO vê', !(await sees(POST_CBA, VIEWER, OTHER_CITY)));
    ok('territorial: leitor SEM residência (city NULL) NÃO vê — fail-closed', !(await sees(POST_CBA, VIEWER, null)));
    // temporalidade: residência expirada ⇒ resolver devolve city NULL ⇒ mesmo caminho do "sem residência" ⇒ não vê.
    ok('temporalidade: residência expirada→city NULL⇒NÃO vê (mesma fronteira fail-closed)', !(await sees(POST_CBA, VIEWER, null)));

    // POST sem restrição territorial (audience_city_id NULL)
    ok('sem-restrição: leitor Curitiba vê', await sees(POST_NULL, VIEWER, CURITIBA));
    ok('sem-restrição: leitor de outra cidade vê', await sees(POST_NULL, VIEWER, OTHER_CITY));
    ok('sem-restrição: leitor sem residência vê (NULL não restringe)', await sees(POST_NULL, VIEWER, null));

    await client.query('ROLLBACK');
    const after = (await client.query('SELECT count(*)::int AS n FROM posts')).rows[0].n;
    ok('resíduo-zero: contagem de posts inalterada após ROLLBACK', after === baseline);
    const temp = (await client.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name='ptest'`)).rows[0].n;
    ok('resíduo-zero: temp table descartada (ON COMMIT DROP + ROLLBACK)', temp === 0);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('ERRO:', e.message);
    fail++;
  } finally {
    await client.end();
  }

  console.log(`\n==== S-CITY-1 DB proof: pass=${pass} fail=${fail} ====`);
  process.exit(fail ? 1 : 0);
}
main();
