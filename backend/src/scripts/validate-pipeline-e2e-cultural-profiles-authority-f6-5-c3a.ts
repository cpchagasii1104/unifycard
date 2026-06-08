/**
 * E2E F6.5-CANAL3-A-CULTURAL — GET /cultural/profiles (DECISION-0113, canal 3 — único A não-money)
 *
 * Antes: GET /cultural/profiles?owner_actor_id lê os PACs (perfis culturais) DO DONO via owner_actor_id
 *   declarado pelo cliente, sem canRepresentActor (só req.user) → ler perfil cultural de outro owner.
 * Fix (A): canRepresentActor(req.user.userId, owner_actor_id) ANTES de listProfilesByActor; 401 sem caller;
 *   403 não-leak se não representável. owner_actor_id é obrigatório (não há caminho sem ele).
 *
 * Prova:
 *   A behavioral REAL — canRepresentActor nega cross-user (dev→próprio=true; estranho→dev=false).
 *   B estrutural — gate canRepresentActor(owner) ANTES de listProfilesByActor; valida o owner FILTRADO.
 *   C escopo — só o handler /profiles (owner_actor_id) tocado; B públicos não.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-cultural-profiles-authority-f6-5-c3a.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ee';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function gateBeforeRead(src: string, gateMarker: string, readMarker: string): boolean {
  const g = src.indexOf(gateMarker);
  const r = src.indexOf(readMarker);
  return g >= 0 && r >= 0 && g < r;
}

async function main(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const dev = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1`,
    [DEV_EMAIL, TENANT_ID]
  );
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].id;
  const devActorRow = await pool.query<{ actor_id: string }>(
    `SELECT actor_id FROM actors WHERE tenant_id=$1 AND user_id=$2::uuid AND actor_type='user' LIMIT 1`,
    [TENANT_ID, devUserId]
  );
  const devActor = devActorRow.rows[0]?.actor_id;
  if (!devActor) { console.error('❌ user-actor do dev não encontrado.'); process.exit(1); }

  const { authorizationService } = await import('../core/authorization/authorization.service');

  console.log('\n— A behavioral REAL: o gate (canRepresentActor sobre o owner) nega cross-user —');
  record('A1 dev representa o próprio actor (owner=próprio) → true (lista os PACs)',
    (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
  record('A2 estranho NÃO representa o owner (actor do dev) → false (403, não lê)',
    (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);

  console.log('\n— B estrutural: gate sobre o owner FILTRADO antes da leitura —');
  const src = readFileSync(join(process.cwd(), 'src/modules/cultural/cultural.routes.ts'), 'utf8');
  record('B1 gate canRepresentActor(req.tenant.id, callerUserId, ownerActorId) ANTES de listProfilesByActor(',
    gateBeforeRead(src, 'canRepresentActor(req.tenant.id, callerUserId, ownerActorId)', 'listProfilesByActor('));
  record('B2 valida o OWNER filtrado (ownerActorId da query), não só o actor do caller',
    /canRepresentActor\(req\.tenant\.id, callerUserId, ownerActorId\)/.test(src) && /const ownerActorId = req\.query\.owner_actor_id/.test(src));
  record('B3 fail-closed: sem callerUserId → 401; não representável → 403 não-leak',
    /if \(!callerUserId\)/.test(src) && /if \(!canRepresentOwner\)/.test(src) && /status\(403\)/.test(src));

  console.log('\n— C escopo: nada de B público / trust / impact tocado neste arquivo —');
  record('C1 cultural.routes NÃO contém gate em impact/reputation/marketplace/public-profiles (não é o arquivo deles)',
    !/impact\/balance|reputation\/permissions|public-profiles|marketplace\/categories/.test(src));
  record('C2 o GET /cultural/profiles/:id (params id = canal 5) NÃO foi gateado nesta micro-fatia',
    /\/profiles\/:id/.test(src) && !/canRepresentActor[\s\S]{0,400}req\.params\.id/.test(src));

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
  console.log('✨ Cultural profiles authority (canRepresentActor no owner) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
