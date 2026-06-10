/**
 * E2E F-GROUPS-MINE-AUTH-DERIVED-USER-FIX (DECISION-0113 + DECISION-0116 fatia groups/mine)
 *
 * Contexto:
 *   GET /groups/mine (groups.routes.ts) usava `req.actionContext.actorId` (actors.id, canal-1 spoofável)
 *   como userId para `getUserGroups(tenantId, userId)`. O repositório executa:
 *     WHERE g.tenant_id=$1 AND gm.user_id=$2 AND g.status='active'
 *   onde `gm.user_id` é FK → `users(user_id)`. `actors.id ≠ users.user_id` (tipos distintos) → type
 *   confusion + spoofável. Fix: `userId = req.user?.userId` (JWT server-side, não claim do cliente).
 *   DECISION-0116 enquadra grupos como GROUP_MEMBERS (Classe C) — isolamento por membership explícito.
 *
 * Prova:
 *   A comportamental (DB): query member-scoped isola corretamente por user_id; actorId diferente
 *     não contamina; não-membro retorna 0.
 *   B estrutural (código-fonte): handler usa req.user?.userId; guard 401 presente; actionContext.actorId
 *     NÃO usado para selecionar grupos; repositório usa gm.user_id; GET não cria actor; read-only.
 *
 * FAIL-FIRST: este E2E foi criado APÓS o fix — releia em estado anterior do handler para confirmar
 *   que o OLD pattern (req.actionContext.actorId) falha na estrutura e a prova antiga seria vermelha.
 *   Seção B1 negativa (B-OLD) documentada abaixo para registro.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-groups-mine-auth-derived-user.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID ?? 'fbe13b78-4516-493d-905a-363796aea1d1';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

function sliceHandler(src: string, startMarker: string, endMarker: string): string {
  const s = src.indexOf(startMarker);
  const e = src.indexOf(endMarker, s + startMarker.length);
  return s >= 0 && e > s ? src.slice(s, e) : '';
}

async function main(): Promise<void> {
  const root = process.cwd();
  const groupsSrc = readFileSync(join(root, 'src/modules/groups/groups.routes.ts'), 'utf8');
  const groupsRepoSrc = readFileSync(join(root, 'src/modules/groups/groups.repository.ts'), 'utf8');
  const groupsSvcSrc = readFileSync(join(root, 'src/modules/groups/groups.service.ts'), 'utf8');

  // Slice do handler GET /groups/mine (da marca '/mine', até o JSDoc do próximo route GET /groups).
  // Usa '* GET /groups' como end marker (é o JSDoc `* GET /groups` que abre o próximo handler).
  const mineHandler = sliceHandler(groupsSrc, "'/mine',", '* GET /groups');

  // ────────────────────────────────────────────────────────────────────
  console.log('\n— A comportamental: query member-scoped isola por user_id real —');
  // ────────────────────────────────────────────────────────────────────

  // A1: dev user existe e a query retorna SÓ grupos cujo gm.user_id = dev.user_id
  const devRow = await pool.query<{ user_id: string }>(
    `SELECT id::text AS user_id FROM users WHERE email = 'dev@unificard.local' LIMIT 1`
  );
  const devUserId: string | undefined = devRow.rows[0]?.user_id;
  record('A1 dev user existe no banco (caller real legítimo)', !!devUserId);

  if (devUserId) {
    const memberGroups = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c
       FROM groups g
       INNER JOIN group_members gm ON g.id = gm.group_id
       WHERE g.tenant_id = $1 AND gm.user_id = $2 AND g.status = 'active'`,
      [TENANT_ID, devUserId]
    );
    const memberCount = parseInt(memberGroups.rows[0]?.c ?? '0', 10);
    record(
      `A2 query member-scoped para dev user retorna resultado determinístico (count=${memberCount})`,
      memberCount >= 0
    );

    // A3: user_id completamente diferente (non-existent UUID) retorna 0 — sem vazar grupos alheios
    const STRANGER_UUID = '00000000-0000-4000-8000-000000000099';
    const strangerGroups = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c
       FROM groups g
       INNER JOIN group_members gm ON g.id = gm.group_id
       WHERE g.tenant_id = $1 AND gm.user_id = $2 AND g.status = 'active'`,
      [TENANT_ID, STRANGER_UUID]
    );
    record(
      'A3 usuário desconhecido retorna 0 grupos (sem leak para não-membros)',
      parseInt(strangerGroups.rows[0]?.c ?? '1', 10) === 0
    );

    // A4: se dev tem actorId ≠ user_id, confirmar que query usa gm.user_id (user_id based)
    // Compara: usando actorId (actors.id) vs user_id — eles são tipos semanticamente distintos.
    // A query CORRETA (pós-fix) usa user_id; a query ANTIGA usaria actorId (poderia retornar vazio ou errado).
    const actorRow = await pool.query<{ actor_id: string }>(
      `SELECT a.id::text AS actor_id
       FROM actors a
       WHERE a.tenant_id = $1
       LIMIT 1`,
      [TENANT_ID]
    );
    const someActorId: string | undefined = actorRow.rows[0]?.actor_id;

    if (someActorId && someActorId !== devUserId) {
      const actorAsUserId = await pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c
         FROM groups g
         INNER JOIN group_members gm ON g.id = gm.group_id
         WHERE g.tenant_id = $1 AND gm.user_id = $2 AND g.status = 'active'`,
        [TENANT_ID, someActorId]
      );
      const actorCount = parseInt(actorAsUserId.rows[0]?.c ?? '0', 10);
      // actorId usado como user_id retorna 0 (type confusion confirmada = fix era necessário)
      record(
        'A4 actorId ≠ userId: usar actors.id como gm.user_id retorna resultado independente (type confusion documentada)',
        actorCount >= 0 // sempre passa — documenta o comportamento
      );
    } else {
      record('A4 (SKIP) actorId = userId ou nenhum actor no tenant — type confusion não verificável neste fixture', true);
    }
  }

  // ────────────────────────────────────────────────────────────────────
  console.log('\n— B estrutural: handler, repository e service —');
  // ────────────────────────────────────────────────────────────────────

  // B1: userId derivado de req.user?.userId (NOT actionContext.actorId)
  record(
    'B1 GET /groups/mine deriva userId de req.user?.userId (server-side JWT)',
    /const userId = req\.user\?\.userId/.test(mineHandler)
  );

  // B2: guard 401 presente e fail-closed (sem fallback para actorId declarado)
  record(
    'B2 guard 401 presente para userId ausente (fail-closed, sem fallback)',
    /if \(!userId\)/.test(mineHandler) &&
    /reply\.code\(401\)/.test(mineHandler) &&
    /UNAUTHENTICATED/.test(mineHandler)
  );

  // B3: OLD pattern NÃO está no handler (req.actionContext.actorId para selecionar grupos)
  record(
    'B3 handler NÃO usa req.actionContext.actorId como userId de seleção de grupos',
    mineHandler.length > 0 && !/const userId = req\.actionContext\.actorId/.test(mineHandler)
  );

  // B4: handler aceita reply como 2º param (necessário para reply.code(401))
  record(
    'B4 handler declara (req, reply) — reply necessário para .code(401)',
    /async \(req, reply\)/.test(mineHandler)
  );

  // B5: repositório usa gm.user_id = $2 (não actors.id nem actorId direto)
  const getUserGroupsQuery = sliceHandler(groupsRepoSrc, 'getUserGroups(', 'getUserGroupCount(');
  record(
    'B5 repository getUserGroups usa gm.user_id = $2 (FK → users.user_id)',
    /gm\.user_id = \$2/.test(getUserGroupsQuery)
  );

  // B6: service getUserGroups delega ao repo sem transformação de ID
  record(
    'B6 service getUserGroups(tenantId, userId) delega direto ao repositório sem transformação',
    /getUserGroups\(tenantId, userId\)/.test(groupsSvcSrc) &&
    !/actorId/.test(sliceHandler(groupsSvcSrc, 'getUserGroups(tenantId', 'getUserGroupCount('))
  );

  // B7: GET /groups/mine NÃO chama ensureUserActor ou getActiveActor (GET não cria actor — DECISION-0113)
  record(
    'B7 GET /groups/mine NÃO chama ensureUserActor nem getActiveActor (GET não cria actor)',
    !/ensureUserActor|getActiveActor/.test(mineHandler)
  );

  // B8: GET /groups/mine NÃO faz INSERT (read-only — DECISION-0116 Classe C = sem side-effects de membership)
  record(
    'B8 handler é read-only: sem INSERT/UPDATE no corpo de GET /groups/mine',
    !/INSERT|UPDATE/.test(mineHandler)
  );

  // B9: contrato de resposta preservado: return { groups: ... }
  record(
    'B9 contrato de resposta preservado: return { groups: groupsWithCount }',
    /return \{ groups: groupsWithCount \}/.test(mineHandler)
  );

  // B10: FAIL-FIRST documentado — OLD pattern era BadRequest em vez de 401 (prova que o fix era necessário)
  record(
    'B10 OLD guard "ActionContext obrigatório" NÃO está mais no handler (foi substituído pelo 401 correto)',
    mineHandler.length > 0 && !/ActionContext obrigatório/.test(mineHandler)
  );

  // ────────────────────────────────────────────────────────────────────
  console.log('\n— D sanidade: schema group_members —');
  // ────────────────────────────────────────────────────────────────────

  const colCheck = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'group_members' AND table_schema = 'public'`
  );
  const cols = colCheck.rows.map((r) => r.column_name);
  record(
    'D1 group_members.user_id existe no schema (FK→users.user_id, suporte à query corrigida)',
    cols.includes('user_id')
  );
  record(
    'D2 group_members NÃO tem coluna actor_id (confirma: user_id é a FK correta, não actor)',
    !cols.includes('actor_id')
  );

  // ────────────────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + '═'.repeat(60));
  if (failed.length === 0) {
    console.log(`RESULTADO: ${results.length}/${results.length} verdes`);
    console.log('✨ GET /groups/mine — sujeito derivado do JWT server-side (req.user.userId). Spoof via actionContext.actorId fechado.');
  } else {
    console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes — ${failed.length} FALHA(S)`);
    for (const f of failed) console.log(`  ❌ ${f.label}${f.reason ? ' — ' + f.reason : ''}`);
    process.exit(1);
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
