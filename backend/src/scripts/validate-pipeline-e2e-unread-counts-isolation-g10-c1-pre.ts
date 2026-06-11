/**
 * E2E F-G10-C1-PRECONDITION-TENANT-WIDE-READS-HARDENING · Cluster 1 — unread-counts isolation
 *
 * Pré-condição da C1 (DECISION-0115 D1, tenant inicial COMPARTILHADO): RLS é por tenant, não por
 * actor/user → leituras tenant-wide vazam no tenant compartilhado. Este E2E prova o hardening de:
 *   GET /social/unread-counts  (modules/social/social.routes.ts)
 *   GET /feed/unread-counts    (core/feed/feed.routes.ts)
 *
 * Decisão de produto (GO IA Diretora/Clayton):
 *   - `groups`   → MEMBER-SCOPED via group_members (sujeito = req.user server-side, nunca actorId de cliente);
 *   - `services` → conta apenas conteúdo público (publicado, não deletado, fora de grupo — schema vivo de
 *                  posts NÃO tem coluna `visibility`; fronteira não-pública materializada = grupo);
 *   - `feed`/`events` → continuam tenant-wide públicos por enquanto (INTOCADOS byte-a-byte);
 *   - contrato `{ feed, groups, events, services }` preservado.
 *
 * Prova:
 *   A behavioral — fixtures reais no dev DB: membro vê o grupo, não-membro NÃO vê; leak shape antiga
 *                  documentada; services só conta service_offer público.
 *   B estrutural — ambos os arquivos: join group_members + gm.user_id; services público-only; feed/events
 *                  intocados; contrato preservado; sem actorId de cliente; GET não cria actor; read-only.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-unread-counts-isolation-g10-c1-pre.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ee'; // não-membro de nada
const MARKER = 'E2E-UNREAD-ISO';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

// Réplica exata da query MEMBER-SCOPED de `groups` pós-hardening (restringível ao grupo fixture).
const GROUPS_MEMBER_SCOPED_SQL = `
  SELECT COUNT(DISTINCT p.metadata->>'groupId')::int as count
  FROM posts p
  INNER JOIN group_members gm
    ON gm.tenant_id = p.tenant_id
   AND gm.group_id::text = p.metadata->>'groupId'
  WHERE p.tenant_id = $1
    AND p.metadata->>'groupId' IS NOT NULL
    AND p.created_at >= $2
    AND p.is_published = true
    AND p.is_deleted = false
    AND gm.user_id = $3
    AND gm.group_id = $4
`;

// Shape ANTIGA (tenant-wide, sem membership) — documenta o leak que o hardening fecha.
const GROUPS_TENANT_WIDE_LEAK_SQL = `
  SELECT COUNT(DISTINCT metadata->>'groupId')::int as count
  FROM posts
  WHERE tenant_id = $1
    AND metadata->>'groupId' IS NOT NULL
    AND created_at >= $2
    AND metadata->>'groupId' = $3
`;

// Réplica da query de `services` pós-hardening, restrita aos posts fixture.
const SERVICES_PUBLIC_ONLY_SQL = `
  SELECT COUNT(*)::int as count
  FROM posts
  WHERE tenant_id = $1
    AND intent = 'service_offer'
    AND created_at >= $2
    AND is_published = true
    AND is_deleted = false
    AND metadata->>'groupId' IS NULL
    AND id = ANY($3::uuid[])
`;

async function main(): Promise<void> {
  const dev = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1`, [DEV_EMAIL, TENANT_ID]);
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].id;
  const devActorRow = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM actors WHERE tenant_id=$1 AND user_id=$2::uuid AND actor_type='user' LIMIT 1`,
    [TENANT_ID, devUserId]);
  const devActor = devActorRow.rows[0]?.id;
  if (!devActor) { console.error('❌ user-actor do dev não encontrado.'); process.exit(1); }

  // limpeza preventiva de execuções anteriores
  await pool.query(`DELETE FROM posts WHERE tenant_id=$1 AND content LIKE $2`, [TENANT_ID, `${MARKER}%`]);
  await pool.query(
    `DELETE FROM group_members WHERE tenant_id=$1 AND group_id IN (SELECT id FROM groups WHERE tenant_id=$1 AND name LIKE $2)`,
    [TENANT_ID, `${MARKER}%`]);
  await pool.query(`DELETE FROM groups WHERE tenant_id=$1 AND name LIKE $2`, [TENANT_ID, `${MARKER}%`]);

  const groupId = randomUUID();
  const postIds: string[] = [];
  try {
    // ===== fixtures =====
    await pool.query(
      `INSERT INTO groups (id, tenant_id, name, slug, owner_actor_id, status) VALUES ($1,$2,$3,$4,$5,'active')`,
      [groupId, TENANT_ID, `${MARKER}-group`, `${MARKER.toLowerCase()}-${groupId.slice(0, 8)}`, devActor]);
    await pool.query(
      `INSERT INTO group_members (tenant_id, group_id, user_id, role) VALUES ($1,$2,$3,'owner')`,
      [TENANT_ID, groupId, devUserId]);

    const insertPost = async (content: string, intent: string | null, meta: Record<string, unknown>, published: boolean, deleted: boolean): Promise<string> => {
      const r = await pool.query<{ id: string }>(
        `INSERT INTO posts (tenant_id, actor_id, content, intent, metadata, is_published, is_deleted)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7) RETURNING id::text AS id`,
        [TENANT_ID, devActor, content, intent, JSON.stringify(meta), published, deleted]);
      postIds.push(r.rows[0].id);
      return r.rows[0].id;
    };

    await insertPost(`${MARKER} group-post`, null, { groupId }, true, false);
    const svcPublic = await insertPost(`${MARKER} svc-public`, 'service_offer', {}, true, false);
    const svcInGroup = await insertPost(`${MARKER} svc-in-group`, 'service_offer', { groupId }, true, false);
    const svcUnpublished = await insertPost(`${MARKER} svc-unpublished`, 'service_offer', {}, false, false);
    const svcDeleted = await insertPost(`${MARKER} svc-deleted`, 'service_offer', {}, true, true);
    const svcFixtures = [svcPublic, svcInGroup, svcUnpublished, svcDeleted];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    console.log('\n— A behavioral: isolamento member-scoped de groups + services público-only —');
    const memberCount = await pool.query<{ count: number }>(GROUPS_MEMBER_SCOPED_SQL, [TENANT_ID, sevenDaysAgo, devUserId, groupId]);
    record('A1 MEMBRO (dev) vê o grupo fixture no contador member-scoped (count=1)',
      Number(memberCount.rows[0]?.count) === 1, `count=${memberCount.rows[0]?.count}`);

    const strangerCount = await pool.query<{ count: number }>(GROUPS_MEMBER_SCOPED_SQL, [TENANT_ID, sevenDaysAgo, STRANGER_USER_ID, groupId]);
    record('A2 NÃO-MEMBRO não vê o grupo fixture (count=0) — isolamento no tenant compartilhado',
      Number(strangerCount.rows[0]?.count) === 0, `count=${strangerCount.rows[0]?.count}`);

    const leakCount = await pool.query<{ count: number }>(GROUPS_TENANT_WIDE_LEAK_SQL, [TENANT_ID, sevenDaysAgo, groupId]);
    record('A3 shape ANTIGA (tenant-wide, sem membership) vazaria o grupo p/ QUALQUER usuário (count=1) — leak fechado pelo hardening',
      Number(leakCount.rows[0]?.count) === 1, `count=${leakCount.rows[0]?.count}`);

    const svcCount = await pool.query<{ count: number }>(SERVICES_PUBLIC_ONLY_SQL, [TENANT_ID, sevenDaysAgo, svcFixtures]);
    record('A4 services conta SÓ o service_offer público (publicado, não-deletado, fora de grupo): 1 de 4 fixtures',
      Number(svcCount.rows[0]?.count) === 1, `count=${svcCount.rows[0]?.count}`);
  } finally {
    await pool.query(`DELETE FROM posts WHERE tenant_id=$1 AND id = ANY($2::uuid[])`, [TENANT_ID, postIds]);
    await pool.query(`DELETE FROM group_members WHERE tenant_id=$1 AND group_id=$2`, [TENANT_ID, groupId]);
    await pool.query(`DELETE FROM groups WHERE tenant_id=$1 AND id=$2`, [TENANT_ID, groupId]);
  }

  console.log('\n— B estrutural: ambos os arquivos hardened; feed/events intocados; contrato preservado —');
  const files: Array<[string, string]> = [
    ['social', join(process.cwd(), 'src/modules/social/social.routes.ts')],
    ['feed', join(process.cwd(), 'src/core/feed/feed.routes.ts')],
  ];
  for (const [name, path] of files) {
    const src = readFileSync(path, 'utf8');
    const handler = src.slice(src.indexOf(`'/unread-counts'`)); // último handler de cada arquivo
    const block = (a: string, b: string) => {
      const i = handler.indexOf(a);
      const j = b ? handler.indexOf(b, i + 1) : handler.length;
      return i >= 0 ? handler.slice(i, j > i ? j : handler.length) : '';
    };
    const feedBlock = block('// Feed:', '// Grupos:');
    const groupsBlock = block('// Grupos:', '// Eventos:');
    const eventsBlock = block('// Eventos:', '// Serviços:');
    const servicesBlock = block('// Serviços:', 'return {');

    record(`B1[${name}] groups MEMBER-SCOPED: INNER JOIN group_members + gm.user_id = $3 + sujeito req.user (userId server-side)`,
      /INNER JOIN group_members gm/.test(groupsBlock)
      && /gm\.user_id = \$3/.test(groupsBlock)
      && /gm\.group_id::text = p\.metadata->>'groupId'/.test(groupsBlock)
      && /\[tenantId, sevenDaysAgo, userId\]/.test(groupsBlock));
    record(`B2[${name}] services PÚBLICO-only: is_published + NOT is_deleted + fora de grupo (groupId IS NULL)`,
      /is_published = true/.test(servicesBlock)
      && /is_deleted = false/.test(servicesBlock)
      && /metadata->>'groupId' IS NULL/.test(servicesBlock));
    record(`B3[${name}] feed INTOCADO (tenant-wide público; predicado visibility = 'PUBLIC' preservado byte-a-byte)`,
      /visibility = 'PUBLIC'/.test(feedBlock) && !/group_members/.test(feedBlock));
    record(`B4[${name}] events INTOCADO (tenant-wide público; FROM events sem membership)`,
      /FROM events/.test(eventsBlock) && /status IN \('published', 'active'\)/.test(eventsBlock) && !/group_members/.test(eventsBlock));
    record(`B5[${name}] contrato preservado: { feed, groups, events, services }`,
      /return \{ feed, groups, events, services \}/.test(handler));
    record(`B6[${name}] DECISION-0113: nenhum actorId declarado pelo cliente no handler (actionContext/x-actor-id/query/params)`,
      !/actionContext/.test(handler) && !/x-actor-id/.test(handler) && !/actorId/.test(handler));
    record(`B7[${name}] GET não cria actor (sem ensureUserActor/getActiveActor) e é read-only (sem INSERT/UPDATE/DELETE)`,
      !/ensureUserActor|getActiveActor/.test(handler) && !/INSERT INTO|UPDATE |DELETE FROM/.test(handler));
    // F-C1-AUTO-REACHABLE-READ-PURITY: o isolamento por contador é PRESERVADO (cada contador tem
    // seu try/catch), mas o erro estrutural agora retorna `null` (indisponível/honesto), NÃO `0` falso.
    // Assertiva atualizada: helper renomeado countOrZero → countOrNull; catch retorna null (read purity).
    record(`B8[${name}] erro isolado por contador (query quebrada → null honesto, não zera nem falseia os demais)`,
      /countOrNull/.test(handler) && !/countOrZero/.test(handler) && /return null;/.test(handler));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ unread-counts isolation (groups member-scoped · services público-only · feed/events intocados) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
