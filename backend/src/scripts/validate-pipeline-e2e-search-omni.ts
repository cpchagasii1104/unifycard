/**
 * E2E — F-GLOBAL-SEARCH-OMNI-SLICE-A (GET /search?q= federado). READ-ONLY, money-free.
 * Roda SÓ em DB efêmera (runner run-search-omni-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Prova END-TO-END (HTTP real via app.inject) que o omnibox:
 *   A  · exige autenticação (401 sem user);
 *   B  · termo curto (<2) → seções vazias honestas, 200;
 *   C  · QUEM/pessoas: acha actor 'user' por nome; seção companies não contamina; payload SEM PII
 *        (user_id, global_user_id, external_id, campos kyc_, metadata NUNCA nas seções de identidade);
 *   D  · accent-insensitive: "jose" acha "Maria José";
 *   E  · QUEM/empresas: acha actor 'page'; pessoas não contamina;
 *   F  · FEDERAÇÃO: um único q ("omni") acerta 3 seções ao mesmo tempo (companies+groups+events);
 *   G  · piso de discovery de eventos INTACTO: published/public IN · draft OUT · private OUT;
 *   H  · O QUÊ/serviços: vocabulário controlado — "faxina" resolve concept (seed vivo de migration)
 *        com results=[] honesto (sem oferta ativa); termo sem ponte → conceptIds=[];
 *   I  · nenhuma seção com erro (fail-soft não disparou) + products responde array;
 *   J  · limit clampa (limit=99 → 200 sem erro);
 *   K  · scaffolds N1-root FORA da descoberta: âncora marcada catalog_scaffold=true não aparece
 *        na seção produtos; gêmea SEM marca (mesma prontidão) aparece — o filtro é o marcador,
 *        não o nome. Migration 20260703140000 marcou as 6 âncoras do bloco3 no caminho FULL.
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
  if (!/search|omni|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `omni-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId };
}

async function mkPageActor(tenantId: string, name: string, responsibleActorId: string): Promise<string> {
  return (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, responsible_actor_id) VALUES ($1::uuid,'page',$2,$3::uuid) RETURNING id::text AS id`,
      [tenantId, name, responsibleActorId]
    )
  ).rows[0].id;
}

async function mkEvent(
  tenantId: string,
  actorId: string,
  title: string,
  status: string,
  visibility: string
): Promise<string> {
  return (
    await pool.query<{ id: string }>(
      `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title, status, visibility, datetime_start, datetime_end)
         VALUES ($1::uuid,$2::uuid,'user','show',$3,$4,$5,'2026-12-20T20:00:00Z','2026-12-20T23:00:00Z') RETURNING id::text AS id`,
      [tenantId, actorId, title, status, visibility]
    )
  ).rows[0].id;
}

const FORBIDDEN_IDENTITY_KEYS = ['user_id', 'global_user_id', 'external_id', 'kyc_verified_at', 'kyc_limit_cents', 'metadata'];

async function main(): Promise<void> {
  await assertEphemeralDb();

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Search Omni E2E', slug: `omni-${Date.now()}` });

  // ── fixtures ──
  const clayton = await mkUserActor(TENANT, 'Clayton Ferreira');
  const maria = await mkUserActor(TENANT, 'Maria José');
  const barbearia = await mkPageActor(TENANT, 'Barbearia do Omni', clayton.actorId);
  const groupId = (
    await pool.query<{ id: string }>(
      `INSERT INTO groups (tenant_id, name, slug, owner_actor_id, status, metadata) VALUES ($1::uuid,'Grupo do Omni',$2,$3::uuid,'active','{}'::jsonb) RETURNING id::text AS id`,
      [TENANT, `grupo-omni-${Date.now()}`, clayton.actorId]
    )
  ).rows[0].id;
  const evPublic = await mkEvent(TENANT, clayton.actorId, 'Show do Omni', 'published', 'public');
  const evDraft = await mkEvent(TENANT, clayton.actorId, 'Show Secreto do Omni', 'draft', 'public');
  const evPrivate = await mkEvent(TENANT, clayton.actorId, 'Show Privado do Omni', 'published', 'private');

  // ── app HTTP real (só o módulo sob teste; hook simula middleware auth/tenant) ──
  const searchOmniRoutes = (await import('../modules/search/search-omni.routes')).default;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.addHook('onRequest', async (req: any) => {
    const uid = req.headers['x-test-user-id'];
    req.user = uid ? { userId: uid, id: uid } : null;
    req.tenant = { id: TENANT };
  });
  await app.register(searchOmniRoutes, { prefix: '/search' });
  await app.ready();

  const search = (q: string, extra: Record<string, string> = {}, authed = true) =>
    app.inject({
      method: 'GET',
      url: `/search?${new URLSearchParams({ q, ...extra }).toString()}`,
      headers: authed ? { 'x-test-user-id': clayton.userId } : {},
    });

  try {
    console.log('\n— omnibox federado END-TO-END —');

    // A · auth floor
    const rAnon = await search('clayton', {}, false);
    record('A 401 sem autenticação', rAnon.statusCode === 401, `status=${rAnon.statusCode}`);

    // B · termo curto
    const rShort = await search('c');
    const bShort = JSON.parse(rShort.body);
    const allEmpty =
      bShort.data.sections.people.length === 0 &&
      bShort.data.sections.companies.length === 0 &&
      bShort.data.sections.groups.length === 0 &&
      bShort.data.sections.services.results.length === 0 &&
      bShort.data.sections.products.length === 0 &&
      bShort.data.sections.events.length === 0;
    record('B termo <2 chars → 200 + seções vazias honestas', rShort.statusCode === 200 && allEmpty, rShort.body.slice(0, 200));

    // C · pessoas + anti-PII
    const rClayton = await search('clayton');
    const bClayton = JSON.parse(rClayton.body);
    const foundClayton = (bClayton.data.sections.people ?? []).some((p: any) => p.actorId === clayton.actorId && p.displayName === 'Clayton Ferreira');
    const idJson = JSON.stringify({ p: bClayton.data.sections.people, c: bClayton.data.sections.companies, g: bClayton.data.sections.groups, e: bClayton.data.sections.events });
    const piiLeak = FORBIDDEN_IDENTITY_KEYS.filter((k) => idJson.includes(`"${k}"`));
    record(
      'C "clayton" → pessoas acha o actor; companies limpa; ZERO PII nas seções de identidade',
      rClayton.statusCode === 200 && foundClayton && bClayton.data.sections.companies.length === 0 && piiLeak.length === 0,
      `found=${foundClayton} piiLeak=${JSON.stringify(piiLeak)}`
    );

    // D · accent-insensitive
    const rJose = await search('jose');
    const bJose = JSON.parse(rJose.body);
    record(
      'D "jose" acha "Maria José" (unaccent)',
      (bJose.data.sections.people ?? []).some((p: any) => p.actorId === maria.actorId),
      rJose.body.slice(0, 200)
    );

    // E · empresas
    const rBarb = await search('barbearia');
    const bBarb = JSON.parse(rBarb.body);
    record(
      'E "barbearia" → empresas acha o actor page; pessoas limpa',
      (bBarb.data.sections.companies ?? []).some((c: any) => c.actorId === barbearia) && bBarb.data.sections.people.length === 0,
      rBarb.body.slice(0, 300)
    );

    // F · federação: 1 termo, 3 seções
    const rOmni = await search('omni');
    const bOmni = JSON.parse(rOmni.body);
    const hitCompany = (bOmni.data.sections.companies ?? []).some((c: any) => c.actorId === barbearia);
    const hitGroup = (bOmni.data.sections.groups ?? []).some((g: any) => g.groupId === groupId);
    const hitEvent = (bOmni.data.sections.events ?? []).some((e: any) => e.eventId === evPublic);
    record('F federação: "omni" acerta companies + groups + events num único GET', hitCompany && hitGroup && hitEvent, `company=${hitCompany} group=${hitGroup} event=${hitEvent}`);

    // G · piso de discovery de eventos
    const rShow = await search('show');
    const bShow = JSON.parse(rShow.body);
    const evIds = new Set((bShow.data.sections.events ?? []).map((e: any) => e.eventId));
    record(
      'G eventos: published/public IN · draft OUT · private OUT (piso de discovery intacto)',
      evIds.has(evPublic) && !evIds.has(evDraft) && !evIds.has(evPrivate),
      `ids=${JSON.stringify([...evIds])}`
    );

    // H · serviços: vocabulário controlado
    const rFaxina = await search('faxina');
    const bFaxina = JSON.parse(rFaxina.body);
    const svcResolved = (bFaxina.data.sections.services.conceptIds ?? []).length > 0;
    const svcHonest = (bFaxina.data.sections.services.results ?? []).length === 0;
    const svcMissClayton = (bClayton.data.sections.services.conceptIds ?? []).length === 0;
    record(
      'H serviços: "faxina" resolve CONCEPT (seed migration) com results=[] honesto; "clayton" sem ponte → conceptIds=[]',
      svcResolved && svcHonest && svcMissClayton,
      `resolved=${svcResolved} honest=${svcHonest} missClayton=${svcMissClayton}`
    );

    // I · fail-soft não disparou + products responde
    record(
      'I nenhuma seção em erro (sectionErrors=[]) e products é array',
      (bOmni.data.sectionErrors ?? ['x']).length === 0 && Array.isArray(bOmni.data.sections.products),
      `errors=${JSON.stringify(bOmni.data.sectionErrors)}`
    );

    // J · limit clamp
    const rBig = await search('omni', { limit: '99' });
    record('J limit=99 clampa sem erro (200)', rBig.statusCode === 200, `status=${rBig.statusCode}`);

    // K · scaffold N1-root fora da descoberta (marcador, não nome)
    // pega uma âncora real do bloco3 (migration FULL) p/ herdar concept/category com prontidão válida
    const anchor = await pool.query<{ concept_id: string; category_id: string }>(
      `SELECT concept_id, category_id FROM canonical_products
        WHERE name LIKE 'Catálogo global (N1 raiz) — %' AND attributes->>'catalog_scaffold' = 'true' LIMIT 1`
    );
    if (anchor.rows.length === 0) {
      record('K âncoras N1-root marcadas pela migration 20260703140000 no FULL', false, 'nenhuma âncora marcada encontrada');
    } else {
      const { concept_id, category_id } = anchor.rows[0];
      // gêmeas com MESMA prontidão (INDUSTRIAL, concept confirmado, category) — só o marcador difere
      await pool.query(
        `INSERT INTO canonical_products (tenant_id, scope, type, name, brand, images, attributes, category_id, concept_id, concept_resolution_status, gtin)
         VALUES (NULL,'global','INDUSTRIAL','Vassoura OmniTest Scaffold',NULL,'[]'::jsonb,'{"catalog_scaffold": true}'::jsonb,$1,$2,'confirmed',NULL),
                (NULL,'global','INDUSTRIAL','Vassoura OmniTest Real',NULL,'[]'::jsonb,'{}'::jsonb,$1,$2,'confirmed',NULL)`,
        [category_id, concept_id]
      );
      const rVass = await search('Vassoura OmniTest');
      const bVass = JSON.parse(rVass.body);
      const names = (bVass.data.sections.products ?? []).map((p: any) => p.name);
      record(
        'K scaffold marcado FORA · gêmea sem marca DENTRO (filtro = marcador catalog_scaffold, não nome)',
        names.includes('Vassoura OmniTest Real') && !names.includes('Vassoura OmniTest Scaffold'),
        `products=${JSON.stringify(names)}`
      );
      // e a âncora original do bloco3 não aparece buscando o próprio nome dela
      const rAnc = await search('Catálogo global');
      const bAnc = JSON.parse(rAnc.body);
      record(
        'K2 âncoras reais do bloco3 não poluem a busca ("Catálogo global" → produtos vazio)',
        (bAnc.data.sections.products ?? []).length === 0,
        JSON.stringify(bAnc.data.sections.products)
      );
    }
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nRESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.error('E2E SEARCH-OMNI: FALHOU');
    process.exit(1);
  }
  console.log('E2E SEARCH-OMNI: OK');
}

main().catch((e) => {
  console.error('💥', e.message);
  process.exit(1);
});
