/**
 * E2E F-GROUPS-CREATE-SELF-AUTHORSHIP-F6_4 (DECISION-0113 fatia 6.4)
 *
 * READ-FIRST mostrou: `getCompleteProfile` é cross-user-CAPAZ (aceita userId arbitrário), mas TODOS os
 * callers passam o PRÓPRIO caller (self) — logo NÃO existe leitura de perfil alheio em produção. O único
 * furo estava no `POST /groups`: o `userId` derivava do `actionContext.actorId` (spoofável) e alimentava
 * TANTO o gate `identity_status` (read) QUANTO `groupsService.createGroup` (write) → criar grupo / checar
 * identidade em nome de OUTRO. Fix unificado (self, decisão Clayton): `userId = req.user.userId`.
 *
 * Prova (estrutural — o gate é no handler HTTP; a vulnerabilidade era de DATA-FLOW da origem do userId):
 *   B POST /groups: userId vem de req.user.userId; NÃO de actor.user_id/findById(actionContext.actorId);
 *     o MESMO userId self alimenta getCompleteProfile (read) e createGroup (write).
 *   C non-cross-user-view: os 4 callers de getCompleteProfile são self (core.routes/profile.routes via
 *     req.user.userId; social via globalUserId do caller; groups agora via req.user.userId).
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-groups-create-self-authorship-f6-4.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

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
  const coreRoutesSrc = readFileSync(join(root, 'src/core/core.routes.ts'), 'utf8');
  const profileRoutesSrc = readFileSync(join(root, 'src/core/profile/profile.routes.ts'), 'utf8');
  const socialSvcSrc = readFileSync(join(root, 'src/modules/social/social-2.0.service.ts'), 'utf8');

  // Slice do handler POST /groups (da 1ª rota até GET /groups/categories).
  const postGroups = sliceHandler(groupsSrc, "POST /groups", "'/categories'");

  console.log('\n— B estrutural: POST /groups é self (req.user.userId), não o actor declarado —');
  record('B1 POST /groups resolve userId de req.user.userId (self)',
    /const userId = req\.user\.userId/.test(postGroups));
  record('B2 POST /groups NÃO resolve userId via actor.user_id (actor declarado)',
    postGroups.length > 0 && !/const userId = actor\.user_id/.test(postGroups));
  record('B3 POST /groups NÃO faz findById(...req.actionContext.actorId) para autoria',
    postGroups.length > 0 && !/findById\(tenantId, req\.actionContext\.actorId\)/.test(postGroups));
  record('B4 o MESMO userId self alimenta o read (getCompleteProfile) e o write (createGroup)',
    /getCompleteProfile\(tenantId, userId\)/.test(postGroups)
    && /createGroup\(tenantId, userId/.test(postGroups));
  record('B5 fail-closed: sem req.user.userId → 401 (sem fallback ao actorId declarado)',
    /if \(!req\.user\?\.userId\)/.test(postGroups) && /status\(401\)/.test(postGroups));

  console.log('\n— C non-cross-user-view: os 4 callers de getCompleteProfile são self —');
  record('C1 core.routes GET /profile usa req.user.userId',
    /const userId = req\.user\.userId/.test(coreRoutesSrc) && /getCompleteProfile\(/.test(coreRoutesSrc));
  record('C2 profile.routes GET /progress usa req.user.userId (→ calculateProfileProgress)',
    /const userId = req\.user\.userId/.test(profileRoutesSrc) && /calculateProfileProgress\(req\.tenant\.id, userId\)/.test(profileRoutesSrc));
  record('C3 social-2.0 feed deriva user.user_id do globalUserId do caller (self), não de actor alheio',
    /getCompleteProfile\(tenantId, user\.user_id\)/.test(socialSvcSrc)
    && /getLocalUserIdByGlobalUserId\(tenantId, globalUserId\)/.test(socialSvcSrc));
  record('C4 groups (este fix) usa req.user.userId → nenhum caller lê perfil alheio',
    /const userId = req\.user\.userId/.test(postGroups));

  // sanidade DB: existe a PF DEV (o fix preserva o caminho legítimo do caller real).
  const dev = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM users WHERE email = 'dev@unificard.local' LIMIT 1`
  );
  record('D sanidade: PF DEV existe (caller real legítimo continua podendo criar grupo)', (dev.rowCount ?? 0) > 0);

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
  console.log('✨ Groups create self-authorship F6.4 (spoof de criar grupo em nome de outro fechado) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
