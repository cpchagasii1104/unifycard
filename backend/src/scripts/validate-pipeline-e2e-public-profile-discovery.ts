/**
 * E2E — F-DISCOVERY-PUBLIC-PROFILE-SLICE-A (VISIBILIDADE_E_DESCOBERTA_DESENHO_CANONICO.md,
 * selado por Clayton 2026-07-03). Money-free; MATERIAL (rotas novas + pista global na busca).
 * Roda SÓ em DB efêmera (runner run-public-profile-discovery-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Prova o caso-mãe do desenho: "o Dev (tenant B) acha o Clayton (tenant A)" — SEM furar o cofre:
 *   A · POST /public-profiles/publish sem autoridade (actor alheio declarado) → 403, zero linha;
 *   B · Clayton publica visibility='public' → 201; linha com CHECK minúsculo ok (bug dormente morto);
 *   C · 🔦 busca no TENANT B acha Clayton (origin='global') — a vitrine atravessa o muro da
 *       IDENTIDADE, não do cofre;
 *   D · Clayton despublica (visibility='private') → busca no tenant B NÃO acha mais (a plaquinha
 *       obedece o dono);
 *   E · republica public → GET /mine devolve a plaquinha; anti-PII: o JSON da busca NÃO contém
 *       user_id/global_user_id/kyc/metadata;
 *   F · pista LOCAL intacta: actor do MESMO tenant continua achável mesmo SEM publicar (vitrine é
 *       aditiva, não substitui o comportamento original);
 *   G · Δbank=0 (nenhuma tabela de valor tocada).
 */

import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/profile|discovery|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 17).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `ppd-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId };
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // canRepresentActor resolve via ports-registry — sem os adapters, autoridade nega fail-closed.
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  // Dois tenants — o coração do teste é a TRAVESSIA entre eles.
  const TENANT_A = randomUUID();
  const TENANT_B = randomUUID();
  await tenantService.createTenant({ id: TENANT_A, name: 'PPD Tenant A (Clayton)', slug: `ppd-a-${Date.now()}` });
  await tenantService.createTenant({ id: TENANT_B, name: 'PPD Tenant B (Dev)', slug: `ppd-b-${Date.now()}` });

  const clayton = await mkUserActor(TENANT_A, 'Clayton Corte E2E');
  const devB = await mkUserActor(TENANT_B, 'Dev Canonical E2E');
  const localB = await mkUserActor(TENANT_B, 'Clayton Local B'); // homônimo local p/ check F

  // ── app HTTP real (rotas sob teste; hook simula middleware auth/tenant/actionContext) ──
  const publicProfileRoutes = (await import('../modules/public-profiles/public-profile.routes')).default;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    const uid = req.headers['x-test-user-id'];
    const aid = req.headers['x-test-actor-id'];
    const tid = req.headers['x-test-tenant-id'];
    req.user = uid ? { userId: uid, id: uid } : null;
    req.tenant = tid ? { id: tid } : null;
    req.actionContext = aid ? { actorId: aid, intent: 'e2e', source: 'e2e', scope: 'e2e' } : null;
  });
  await app.register(publicProfileRoutes);
  await app.ready();

  const call = (method: 'GET' | 'POST' | 'PUT', url: string, opts: { userId?: string; actorId?: string; tenantId?: string; body?: unknown } = {}) =>
    app.inject({
      method,
      url,
      headers: {
        ...(opts.userId ? { 'x-test-user-id': opts.userId } : {}),
        ...(opts.actorId ? { 'x-test-actor-id': opts.actorId } : {}),
        ...(opts.tenantId ? { 'x-test-tenant-id': opts.tenantId } : {}),
        'content-type': 'application/json',
      },
      payload: opts.body as string | object | undefined,
    });

  const { searchOmniService } = await import('../modules/search/search-omni.service');

  try {
    console.log('\n— public profile discovery END-TO-END (a vitrine atravessa o muro da identidade) —');

    const bankBefore = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );

    // A · Dev (tenant B) tenta publicar a plaquinha do actor do Clayton → 403 fail-closed
    const rNoAuth = await call('POST', '/public-profiles/publish', {
      userId: devB.userId,
      actorId: clayton.actorId, // actor alheio declarado
      tenantId: TENANT_B,
      body: { visibility: 'public' },
    });
    const rowsAfterA = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM public_profiles`);
    record('A publish sem autoridade sobre o actor declarado → 403, zero linha',
      rNoAuth.statusCode === 403 && rowsAfterA.rows[0].n === '0',
      `status=${rNoAuth.statusCode} rows=${rowsAfterA.rows[0].n}`);

    // B · Clayton publica public → 201 (CHECK minúsculo ok — bug dormente morto)
    const rPub = await call('POST', '/public-profiles/publish', {
      userId: clayton.userId,
      actorId: clayton.actorId,
      tenantId: TENANT_A,
      body: { visibility: 'public' },
    });
    const pubBody = rPub.json() as any;
    record('B Clayton publica plaquinha public → 201, visibility=public',
      rPub.statusCode === 201 && pubBody?.data?.visibility === 'public' && pubBody?.data?.actorId === clayton.actorId,
      `status=${rPub.statusCode} body=${JSON.stringify(pubBody).slice(0, 200)}`);

    // C · 🔦 O MOMENTO: busca no TENANT B acha o Clayton (origin='global')
    const searchB1 = await searchOmniService.searchOmni(TENANT_B, { q: 'Clayton Corte' });
    const hitC = searchB1.sections.people.find((p) => p.actorId === clayton.actorId);
    record("C busca no tenant B ACHA o Clayton do tenant A (origin='global')",
      !!hitC && hitC.origin === 'global' && hitC.displayName === 'Clayton Corte E2E',
      `people=${JSON.stringify(searchB1.sections.people)}`);

    // D · Clayton despublica (private) → some da busca do tenant B
    const rPriv = await call('POST', '/public-profiles/publish', {
      userId: clayton.userId,
      actorId: clayton.actorId,
      tenantId: TENANT_A,
      body: { visibility: 'private' },
    });
    const searchB2 = await searchOmniService.searchOmni(TENANT_B, { q: 'Clayton Corte' });
    const hitD = searchB2.sections.people.find((p) => p.actorId === clayton.actorId);
    record('D despublicar (private) → NÃO aparece mais no tenant B',
      rPriv.statusCode === 201 && !hitD,
      `status=${rPriv.statusCode} people=${JSON.stringify(searchB2.sections.people)}`);

    // E · republica + GET /mine + anti-PII no payload da busca
    await call('POST', '/public-profiles/publish', {
      userId: clayton.userId, actorId: clayton.actorId, tenantId: TENANT_A, body: { visibility: 'public' },
    });
    const rMine = await call('GET', '/public-profiles/mine', {
      userId: clayton.userId, actorId: clayton.actorId, tenantId: TENANT_A,
    });
    const mineBody = rMine.json() as any;
    const searchB3 = await searchOmniService.searchOmni(TENANT_B, { q: 'Clayton Corte' });
    const raw = JSON.stringify(searchB3.sections.people);
    const piiLeak = /user_id|global_user_id|kyc|metadata/i.test(raw) || raw.includes(clayton.userId);
    record('E GET /mine devolve plaquinha; busca sem PII (user_id/global_user_id/kyc/metadata)',
      rMine.statusCode === 200 && mineBody?.data?.visibility === 'public' && !piiLeak,
      `mine=${rMine.statusCode} piiLeak=${piiLeak}`);

    // F · pista LOCAL intacta: homônimo do PRÓPRIO tenant B aparece sem nunca ter publicado
    const searchB4 = await searchOmniService.searchOmni(TENANT_B, { q: 'Clayton Local' });
    const hitF = searchB4.sections.people.find((p) => p.actorId === localB.actorId);
    record("F pista local intacta (actor do próprio tenant achável sem publicar, origin='local')",
      !!hitF && hitF.origin === 'local',
      `people=${JSON.stringify(searchB4.sections.people)}`);

    // F4 · (YALA) GET /public-profiles/:slug NÃO serve perfil não-público. Com o perfil public,
    // resolve por slug; ao virar private, o MESMO slug passa a 404 (o "unpublish" vale também no
    // caminho by-slug, antes furado).
    const slug = mineBody?.data?.slug as string | undefined;
    const rSlugPublic = await call('GET', `/public-profiles/${slug}`, { userId: clayton.userId, actorId: clayton.actorId, tenantId: TENANT_A });
    await call('POST', '/public-profiles/publish', {
      userId: clayton.userId, actorId: clayton.actorId, tenantId: TENANT_A, body: { visibility: 'private' },
    });
    const rSlugPrivate = await call('GET', `/public-profiles/${slug}`, { userId: clayton.userId, actorId: clayton.actorId, tenantId: TENANT_A });
    record('F4 GET /:slug serve public (200) mas NÃO serve private (404) — unpublish vale by-slug',
      !!slug && rSlugPublic.statusCode === 200 && rSlugPrivate.statusCode === 404,
      `slug=${slug} public=${rSlugPublic.statusCode} private=${rSlugPrivate.statusCode}`);
    // restaura public para os passos seguintes
    await call('POST', '/public-profiles/publish', {
      userId: clayton.userId, actorId: clayton.actorId, tenantId: TENANT_A, body: { visibility: 'public' },
    });

    // H · O DESTINO DO CLIQUE: o Dev (tenant B) lê a plaquinha do Clayton (tenant A) via
    // GET /public-profiles/global/:actorId — CROSS-TENANT, só a plaquinha, sem tenant_id/PII.
    const rGlobal = await call('GET', `/public-profiles/global/${clayton.actorId}`, {
      userId: devB.userId, actorId: devB.actorId, tenantId: TENANT_B,
    });
    const gBody = rGlobal.json() as any;
    const gRaw = JSON.stringify(gBody);
    const gLeak = /tenant_id|tenantId|user_id|global_user_id|kyc|metadata/i.test(gRaw);
    record('H Dev (tenant B) lê a plaquinha do Clayton (tenant A) cross-tenant, sem PII/tenant_id',
      rGlobal.statusCode === 200 && gBody?.data?.displayName === 'Clayton Corte E2E' && gBody?.data?.actorId === clayton.actorId && !gLeak,
      `status=${rGlobal.statusCode} leak=${gLeak} body=${gRaw.slice(0, 160)}`);

    // H2 · perfil privado NÃO resolve pelo destino do clique (404)
    await call('POST', '/public-profiles/publish', { userId: clayton.userId, actorId: clayton.actorId, tenantId: TENANT_A, body: { visibility: 'private' } });
    const rGlobalPriv = await call('GET', `/public-profiles/global/${clayton.actorId}`, { userId: devB.userId, actorId: devB.actorId, tenantId: TENANT_B });
    record('H2 plaquinha privada → 404 no destino do clique', rGlobalPriv.statusCode === 404, `status=${rGlobalPriv.statusCode}`);
    await call('POST', '/public-profiles/publish', { userId: clayton.userId, actorId: clayton.actorId, tenantId: TENANT_A, body: { visibility: 'public' } });

    // I · CARTÃO PÚBLICO: o Clayton escolhe o que aparece — oculta a bio, adiciona headline + link.
    const rCard = await call('PUT', '/public-profiles/mine/card', {
      userId: clayton.userId, actorId: clayton.actorId, tenantId: TENANT_A,
      body: { showAvatar: true, showBio: false, headline: 'Cabeleireiro em Curitiba', link: 'mercadoeshop.com' },
    });
    const rAfterCard = await call('GET', `/public-profiles/global/${clayton.actorId}`, { userId: devB.userId, actorId: devB.actorId, tenantId: TENANT_B });
    const cardBody = rAfterCard.json() as any;
    const cardData = cardBody?.data ?? {};
    record('I cartão: Dev vê headline/link e bio OCULTA (escolha do usuário respeitada cross-tenant)',
      rCard.statusCode === 200 && rAfterCard.statusCode === 200 &&
      cardData.headline === 'Cabeleireiro em Curitiba' && cardData.link === 'https://mercadoeshop.com' && cardData.bio === null,
      `card=${rCard.statusCode} headline=${cardData.headline} link=${cardData.link} bio=${JSON.stringify(cardData.bio)}`);

    // I2 · o cartão NÃO vaza PII/tenant no payload cross-tenant
    const cardRaw = JSON.stringify(cardBody);
    record('I2 payload do cartão sem PII/tenant_id',
      !/tenant_id|tenantId|user_id|global_user_id|kyc|cpf|birthdate|metadata/i.test(cardRaw),
      cardRaw.slice(0, 160));

    // restaura mostrar-bio para não interferir em passos seguintes
    await call('PUT', '/public-profiles/mine/card', { userId: clayton.userId, actorId: clayton.actorId, tenantId: TENANT_A, body: { showAvatar: true, showBio: true, headline: null, link: null } });

    // V2 · CONFUSED-DEPUTY na POST legada (auditoria forense 2026-07-04): o Dev, representando o
    // PRÓPRIO actor (passa o gate), tenta criar a vitrine sob o actorId do Clayton (vítima) via body.
    // Fix: o sujeito é SEMPRE o actor provado → a linha nasce sob devB, NUNCA sob clayton.
    const rConfused = await call('POST', '/public-profiles', {
      userId: devB.userId,
      actorId: devB.actorId, // o Dev representa o PRÓPRIO actor (gate passa)
      tenantId: TENANT_B,
      body: { actorId: clayton.actorId, profileType: 'user', displayName: 'FAKE Clayton', visibility: 'public' },
    });
    const victimRow = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM public_profiles WHERE actor_id = $1 AND display_name = 'FAKE Clayton'`,
      [clayton.actorId]
    );
    const attackerRow = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM public_profiles WHERE actor_id = $1`,
      [devB.actorId]
    );
    record('V2 POST legada NÃO escreve sob o actor da vítima (confused-deputy fechado)',
      rConfused.statusCode < 500 && victimRow.rows[0].n === '0' && attackerRow.rows[0].n === '1',
      `status=${rConfused.statusCode} vitima=${victimRow.rows[0].n} atacante=${attackerRow.rows[0].n}`);

    // G · Δbank = 0
    const bankAfter = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );
    record('G Δbank=0 (nenhuma tabela de valor tocada)', bankBefore.rows[0].n === bankAfter.rows[0].n,
      `${bankBefore.rows[0].n} → ${bankAfter.rows[0].n}`);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
