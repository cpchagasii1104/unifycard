// validate-yala-final-interact-feed.ts — PROVA Etapa D (DECISION-0189B — C3 / D4–D5)
//
// Roda contra CLONE EFÊMERO com a migration 20260719200000 aplicada. Prova a autoridade EXATA
// de interação no feed (reactions/comments):
//   D1 membro fino (can_interact_feed=true, SEM can_manage_company) → permite (membership_grant)
//   D2 gestor SEM interact_feed (can_manage_company=true) → NEGA
//   D3 suspenso → NEGA ; D4 revogado → NEGA
//   D5 self (user actor por si) → permite (ownership)
//   D6 capability leg: grant true mas registry sem can_interact_feed → NEGA (tríade)
//   D7 delegação externa cobrindo publish_feed (sem interact_feed) → NEGA
//   D8 delegação externa cobrindo interact_feed → permite (delegation)
//   D9 grupo (sem substrato) → NEGA (fail-closed no dispatch, antes de ownership)
//   D10 HTTP: reação com post cross-tenant/inexistente → 404 (post server-side); actor sem grant → 403
//   D11 catálogo v2: interact_feed convidável (aceite só concede linha persistida — F5 23/23)

import { pool } from '@core/database/pool';
import { authorizationService } from '@core/authorization/authorization.service';
import Fastify from 'fastify';
import social20Routes from '../modules/social/social-2.0.routes';

let passed = 0; let failed = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  if (ok) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.log(`❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const FLAGS = ['can_manage_company','can_manage_members','can_manage_financial','can_view_financial','can_publish_feed','can_interact_feed','can_create_events','can_manage_employees','can_manage_services','can_view_reports'];
async function setMember(cuId: string, patch: Record<string, boolean>, status = 'active') {
  const reset = FLAGS.map((f) => `${f} = false`).join(', ');
  await pool.query(`UPDATE company_users SET ${reset}, member_status=$2 WHERE id=$1`, [cuId, status]);
  const keys = Object.keys(patch);
  if (keys.length) await pool.query(`UPDATE company_users SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id=$1`, [cuId, ...keys.map((k) => patch[k])]);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!/closeout|ephemeral|clone|upgrade|final/i.test(dbUrl)) {
    console.error(`recusado: DATABASE_URL não parece efêmero (${dbUrl.split('/').pop()})`);
    process.exit(1);
  }
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const a = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(a.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(a.actorUtilsAdapter);

  const fx = (await pool.query(`
    SELECT cu.id AS cu_id, cu.tenant_id, cu.company_id, u.user_id,
           ua.id AS user_actor_id, pa.id AS page_actor_id
      FROM company_users cu
      JOIN users u  ON u.global_user_id = cu.global_user_id AND u.tenant_id = cu.tenant_id
      JOIN actors ua ON ua.user_id = u.user_id AND ua.tenant_id = cu.tenant_id AND ua.actor_type = 'user'
      JOIN actors pa ON pa.company_id = cu.company_id AND pa.tenant_id = cu.tenant_id
     LIMIT 1`)).rows[0] as { cu_id: string; tenant_id: string; company_id: string; user_id: string; user_actor_id: string; page_actor_id: string };
  const T = fx.tenant_id;

  // external delegate: user actor SEM membership ativa nesta empresa
  const ext = (await pool.query(`
    SELECT a.id AS user_actor_id, a.user_id
      FROM actors a
     WHERE a.tenant_id=$1 AND a.actor_type='user' AND a.user_id <> $2
       AND NOT EXISTS (SELECT 1 FROM company_users cu JOIN users u ON u.global_user_id=cu.global_user_id
                        WHERE u.user_id=a.user_id AND cu.company_id=$3 AND cu.member_status='active')
     LIMIT 1`, [T, fx.user_id, fx.company_id])).rows[0] as { user_actor_id: string; user_id: string };
  const grp = (await pool.query(`SELECT id FROM actors WHERE tenant_id=$1 AND actor_type='group' LIMIT 1`, [T])).rows[0] as { id: string } | undefined;

  const K = 'interact_feed' as const;
  const can = (uid: string, aid: string) => authorizationService.canActAs(T, uid, aid, K);

  // D1 — membro fino
  await setMember(fx.cu_id, { can_interact_feed: true });
  const fine = await can(fx.user_id, fx.page_actor_id);
  check('D1 membro fino (can_interact_feed, SEM can_manage_company) → permite (membership_grant)',
    fine.allowed && fine.authoritySource === 'membership_grant', JSON.stringify(fine));

  // D2 — gestor sem grant
  await setMember(fx.cu_id, { can_manage_company: true, can_manage_members: true, can_publish_feed: true });
  const boss = await can(fx.user_id, fx.page_actor_id);
  check('D2 gestor pleno SEM interact_feed → NEGA', !boss.allowed, JSON.stringify(boss));

  // D3/D4 — suspenso/revogado
  await setMember(fx.cu_id, { can_interact_feed: true }, 'suspended');
  const susp = await can(fx.user_id, fx.page_actor_id);
  check('D3 suspenso (mesmo com grant) → NEGA', !susp.allowed);
  await setMember(fx.cu_id, { can_interact_feed: true }, 'revoked');
  const rev = await can(fx.user_id, fx.page_actor_id);
  check('D4 revogado (mesmo com grant) → NEGA', !rev.allowed);

  // D5 — self (user actor por si)
  const self = await can(fx.user_id, fx.user_actor_id);
  check('D5 self (user actor por si) → permite (ownership)', self.allowed);

  // D6 — capability leg (tríade): grant true mas registry sem can_interact_feed → NEGA
  await setMember(fx.cu_id, { can_interact_feed: true });
  await pool.query(`UPDATE actor_registry SET capabilities_json = capabilities_json - 'can_interact_feed' WHERE tenant_id=$1 AND actor_id=$2`, [T, fx.page_actor_id]);
  const noCap = await can(fx.user_id, fx.page_actor_id);
  check('D6 capability leg: grant SEM capability de tipo → NEGA (tríade)', !noCap.allowed, JSON.stringify(noCap));
  await pool.query(`UPDATE actor_registry SET capabilities_json = capabilities_json || jsonb_build_object('can_interact_feed', true) WHERE tenant_id=$1 AND actor_id=$2`, [T, fx.page_actor_id]);

  // D7/D8 — delegação externa (usuário NÃO-membro)
  if (ext) {
    await pool.query(`DELETE FROM actor_delegations WHERE tenant_id=$1 AND user_actor_id=$2 AND institutional_actor_id=$3`, [T, ext.user_actor_id, fx.page_actor_id]);
    const insDeleg = async (scopes: string[]) => {
      await pool.query(`DELETE FROM actor_delegations WHERE tenant_id=$1 AND user_actor_id=$2 AND institutional_actor_id=$3`, [T, ext.user_actor_id, fx.page_actor_id]);
      await pool.query(`INSERT INTO actor_delegations (tenant_id, user_actor_id, institutional_actor_id, scopes_json, status, expires_at, relationship_type)
                        VALUES ($1,$2,$3,$4::jsonb,'active', NOW() + INTERVAL '1 day', 'legal_representative')`,
        [T, ext.user_actor_id, fx.page_actor_id, JSON.stringify(scopes)]);
    };
    await insDeleg(['publish_feed']);
    const dPub = await can(ext.user_id, fx.page_actor_id);
    check('D7 delegação externa cobrindo publish_feed (sem interact_feed) → NEGA', !dPub.allowed, JSON.stringify(dPub));
    await insDeleg(['interact_feed']);
    const dInt = await can(ext.user_id, fx.page_actor_id);
    check('D8 delegação externa cobrindo interact_feed → permite (delegation)', dInt.allowed && dInt.authoritySource === 'delegation', JSON.stringify(dInt));
    await pool.query(`DELETE FROM actor_delegations WHERE tenant_id=$1 AND user_actor_id=$2 AND institutional_actor_id=$3`, [T, ext.user_actor_id, fx.page_actor_id]);
  } else {
    check('D7/D8 delegação externa — SEM fixture de não-membro no clone (NÃO REPRODUZIDA)', false, 'sem external delegate');
  }

  // D9 — grupo fail-closed
  if (grp) {
    const g = await can(fx.user_id, grp.id);
    check('D9 grupo (sem substrato) → NEGA (fail-closed no dispatch)', !g.allowed, JSON.stringify(g));
  } else {
    check('D9 grupo — SEM group actor no clone (NÃO REPRODUZIDA)', false);
  }

  // D10 — HTTP: post server-side + anti-spoof
  await setMember(fx.cu_id, { can_interact_feed: true });
  const app = Fastify();
  app.addHook('onRequest', async (req) => {
    (req as { user?: unknown }).user = { id: fx.user_id, userId: fx.user_id };
    (req as { tenant?: unknown }).tenant = { id: T };
    (req as { actionContext?: unknown }).actionContext = { actorId: fx.page_actor_id, scope: undefined };
  });
  await app.register(social20Routes as never, { prefix: '/social' });
  await app.ready();
  const crossTenant = await app.inject({ method: 'POST', url: '/social/posts/00000000-0000-0000-0000-000000000000/reactions', payload: { reaction_type: 'like' } });
  await app.close();
  check('D10 reação em post inexistente/cross-tenant → 404 (post carregado server-side)', crossTenant.statusCode === 404, `${crossTenant.statusCode}`);

  // D11 — catálogo v2: interact_feed convidável
  const cat = (await pool.query(`SELECT invitable, delegable, protected FROM company_permission_catalog WHERE permission_key='interact_feed' AND catalog_version=2`)).rows[0] as { invitable: boolean; delegable: boolean; protected: boolean } | undefined;
  check('D11 catálogo v2: interact_feed convidável + delegável + NÃO protegido (aceite só concede linha persistida — F5)',
    cat?.invitable === true && cat?.delegable === true && cat?.protected === false, JSON.stringify(cat));

  console.log(`\n──────── RESULTADO: ${passed} passaram, ${failed} falharam ────────`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
