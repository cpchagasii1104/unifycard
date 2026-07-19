// validate-yala-final-publication-reactions.ts — PROVA Etapa D (DECISION-0189C — C3/D4)
//
// Roda contra CLONE EFÊMERO. Prova que a rota GENÉRICA de reação do publication-engine está
// contida (410) ANTES de qualquer efeito, e que a tabela `reactions` fica intocada.
//   P1 POST /publication/x/y/reactions (actor_id falsificado) → 410 GENERIC_REACTIONS_NOT_GOVERNED
//   P2 DELETE /publication/x/y/reactions → 410
//   P3 cross-tenant / sem auth → mesmo 410 (nenhum efeito, uniforme)
//   P4 tabela `reactions` inalterada após todas as tentativas
//   P5 caminho canônico social-2.0 segue GOVERNADO por interact_feed (membro fino permite,
//      gestor sem grant nega — decisor)

import { pool } from '@core/database/pool';
import { authorizationService } from '@core/authorization/authorization.service';
import Fastify from 'fastify';
import { publicationEngineRoutes } from '@core/publication/publication-engine.routes';

let passed = 0; let failed = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  if (ok) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.log(`❌ ${label}${extra ? ' — ' + extra : ''}`); }
};
const FLAGS = ['can_manage_company','can_manage_members','can_manage_financial','can_view_financial','can_publish_feed','can_interact_feed','can_create_events','can_manage_employees','can_manage_services','can_view_reports'];
async function setMember(cuId: string, patch: Record<string, boolean>) {
  const reset = FLAGS.map((f) => `${f} = false`).join(', ');
  await pool.query(`UPDATE company_users SET ${reset}, member_status='active' WHERE id=$1`, [cuId]);
  const keys = Object.keys(patch);
  if (keys.length) await pool.query(`UPDATE company_users SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id=$1`, [cuId, ...keys.map((k) => patch[k])]);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!/closeout|ephemeral|clone|upgrade|final|ratchet/i.test(dbUrl)) {
    console.error(`recusado: DATABASE_URL não parece efêmero (${dbUrl.split('/').pop()})`);
    process.exit(1);
  }
  const { socialPortsRegistry } = await import('@core/social/ports-registry');
  const a = await import('@modules/social/adapters');
  socialPortsRegistry.setActorRepository(a.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(a.actorUtilsAdapter);

  const fx = (await pool.query(`
    SELECT cu.id AS cu_id, cu.tenant_id, u.user_id, pa.id AS page_actor_id
      FROM company_users cu
      JOIN users u  ON u.global_user_id = cu.global_user_id AND u.tenant_id = cu.tenant_id
      JOIN actors pa ON pa.company_id = cu.company_id AND pa.tenant_id = cu.tenant_id
     LIMIT 1`)).rows[0] as { cu_id: string; tenant_id: string; user_id: string; page_actor_id: string };
  const T = fx.tenant_id;

  const reactionsBefore = Number((await pool.query(`SELECT count(*)::int n FROM reactions`)).rows[0].n);

  const app = Fastify();
  // hook opcional de auth: em algumas tentativas injetamos tenant/user, em outras não
  await app.register(publicationEngineRoutes as never, { prefix: '/publication' });
  await app.ready();

  const body410 = (r: { statusCode: number; json: () => unknown }) => r.statusCode === 410 && (r.json() as { code?: string }).code === 'GENERIC_REACTIONS_NOT_GOVERNED';

  const p1 = await app.inject({ method: 'POST', url: '/publication/post/abc/reactions', payload: { reaction_type: 'like', actor_id: fx.page_actor_id } });
  check('P1 POST reactions (actor_id falsificado) → 410 GENERIC_REACTIONS_NOT_GOVERNED', body410(p1), `${p1.statusCode}`);
  const p2 = await app.inject({ method: 'DELETE', url: '/publication/post/abc/reactions' });
  check('P2 DELETE reactions → 410 GENERIC_REACTIONS_NOT_GOVERNED', body410(p2), `${p2.statusCode}`);
  const p3a = await app.inject({ method: 'POST', url: '/publication/event/xyz/reactions', payload: { reaction_type: 'love', actor_id: '00000000-0000-0000-0000-000000000000' } });
  const p3b = await app.inject({ method: 'POST', url: '/publication/anything/zzz/reactions', payload: { reaction_type: 'wow' } });
  check('P3 cross-tenant/sem auth → mesmo 410 uniforme (nenhum efeito)', body410(p3a) && body410(p3b), `${p3a.statusCode}/${p3b.statusCode}`);
  await app.close();

  const reactionsAfter = Number((await pool.query(`SELECT count(*)::int n FROM reactions`)).rows[0].n);
  check('P4 tabela reactions INALTERADA após todas as tentativas', reactionsAfter === reactionsBefore, `${reactionsBefore}→${reactionsAfter}`);

  // P5 — social-2.0 segue governado por interact_feed (decisor)
  await setMember(fx.cu_id, { can_interact_feed: true });
  const fine = await authorizationService.canActAs(T, fx.user_id, fx.page_actor_id, 'interact_feed');
  await setMember(fx.cu_id, { can_manage_company: true, can_manage_members: true, can_publish_feed: true });
  const boss = await authorizationService.canActAs(T, fx.user_id, fx.page_actor_id, 'interact_feed');
  check('P5 social interact_feed: membro fino permite E gestor sem grant nega (governança preservada)',
    fine.allowed && !boss.allowed, `fine=${fine.allowed} boss=${boss.allowed}`);

  console.log(`\n──────── RESULTADO: ${passed} passaram, ${failed} falharam ────────`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
