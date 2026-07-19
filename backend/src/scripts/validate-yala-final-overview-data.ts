// validate-yala-final-overview-data.ts — PROVA Etapa F (DECISION-0189B — overview com DADOS)
//
// Roda contra CLONE EFÊMERO. Insere fixtures financeiras SOMENTE no efêmero (destruído depois;
// dev intocado). Prova a leitura financeira do economic-overview com valores reais:
//   F1 sem view_financial (membro comum) → 403 VIEW_FINANCIAL_REQUIRED
//   F2 gestor (can_manage_company) SEM view_financial → 403
//   F3 com view_financial → 200 e VALORES CORRETOS (totalPaid=5000, totalReceived=3000)
//   F4 200 traz Cache-Control: no-store
//   F5 audit PERSISTIDO antes do disclosure (financial_read_economic_overview)
//   F6 empresa alheia (caller não-membro) → nega (isolamento; cross-tenant amplo = 9/9 próprio)
//   F7 pós-revogação do grant → 403 (sem estado antigo; concorrência FOR SHARE = F3 17/17)

import { pool } from '@core/database/pool';
import Fastify from 'fastify';
import economicOverviewRoutes from '../modules/economy/economic-overview.routes';

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

async function buildApp(tenantId: string, userId: string) {
  const app = Fastify();
  app.addHook('onRequest', async (req) => {
    (req as { user?: unknown }).user = { id: userId, userId };
    (req as { tenant?: unknown }).tenant = { id: tenantId };
  });
  await app.register(economicOverviewRoutes as never, { prefix: '/economy' });
  await app.ready();
  return app;
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
    SELECT cu.id AS cu_id, cu.tenant_id, cu.company_id, u.user_id, pa.id AS page_actor_id
      FROM company_users cu
      JOIN users u  ON u.global_user_id = cu.global_user_id AND u.tenant_id = cu.tenant_id
      JOIN actors pa ON pa.company_id = cu.company_id AND pa.tenant_id = cu.tenant_id
     LIMIT 1`)).rows[0] as { cu_id: string; tenant_id: string; company_id: string; user_id: string; page_actor_id: string };
  const T = fx.tenant_id;
  const concept = (await pool.query(`SELECT concept_id FROM concepts LIMIT 1`)).rows[0] as { concept_id: string };

  // ── fixtures financeiras (SOMENTE no efêmero) ────────────────────────────────
  const existingAcct = (await pool.query(`SELECT id FROM bank_accounts WHERE tenant_id=$1 AND actor_id=$2 LIMIT 1`, [T, fx.page_actor_id])).rows[0] as { id: string } | undefined;
  const acct = existingAcct ?? (await pool.query(
    `INSERT INTO bank_accounts (tenant_id, actor_id, owner_type, owner_id, account_type) VALUES ($1::uuid,$2::uuid,'actor',$2::text,'credit') RETURNING id`,
    [T, fx.page_actor_id])).rows[0] as { id: string };
  const tx = (await pool.query(
    `INSERT INTO bank_transactions (tenant_id, actor_id, account_id, amount_cents, purpose, concept_id) VALUES ($1,$2,$3,5000,'settlement',$4) RETURNING id`,
    [T, fx.page_actor_id, acct.id, concept.concept_id])).rows[0] as { id: string };
  await pool.query(
    `INSERT INTO bank_splits (tenant_id, transaction_id, source_actor_id, target_actor_id, amount_cents, split_type, target_account_id) VALUES ($1,$2,$3,$3,3000,'fixed',$4)`,
    [T, tx.id, fx.page_actor_id, acct.id]);

  const url = `/economy/actors/${fx.page_actor_id}/overview`;

  // F1 — membro comum sem view_financial → 403
  await setMember(fx.cu_id, { can_publish_feed: true });
  let app = await buildApp(T, fx.user_id);
  const r1 = await app.inject({ method: 'GET', url });
  await app.close();
  check('F1 sem view_financial → 403 VIEW_FINANCIAL_REQUIRED', r1.statusCode === 403 && (r1.json() as { code?: string }).code === 'VIEW_FINANCIAL_REQUIRED', `${r1.statusCode}`);

  // F2 — gestor com can_manage_company mas SEM view_financial → 403
  await setMember(fx.cu_id, { can_manage_company: true, can_manage_members: true });
  app = await buildApp(T, fx.user_id);
  const r2 = await app.inject({ method: 'GET', url });
  await app.close();
  check('F2 gestor (can_manage_company) SEM view_financial → 403', r2.statusCode === 403, `${r2.statusCode}`);

  // F3/F4/F5 — com view_financial → 200 + valores corretos + no-store + audit
  await setMember(fx.cu_id, { can_view_financial: true });
  const auditBefore = Number((await pool.query(`SELECT count(*)::int n FROM financial_audit_trail WHERE tenant_id=$1 AND event_type='financial_read_economic_overview'`, [T])).rows[0].n);
  app = await buildApp(T, fx.user_id);
  const r3 = await app.inject({ method: 'GET', url });
  await app.close();
  const body = r3.json() as { ok?: boolean; data?: { totalPaid?: number; totalReceived?: number } };
  check('F3 com view_financial → 200', r3.statusCode === 200 && body.ok === true, `${r3.statusCode}`);
  check('F3 VALORES CORRETOS: totalPaid=5000 e totalReceived=3000', body.data?.totalPaid === 5000 && body.data?.totalReceived === 3000, JSON.stringify(body.data));
  check('F4 200 traz Cache-Control: no-store', (r3.headers['cache-control'] ?? '') === 'no-store');
  const auditAfter = Number((await pool.query(`SELECT count(*)::int n FROM financial_audit_trail WHERE tenant_id=$1 AND event_type='financial_read_economic_overview'`, [T])).rows[0].n);
  check('F5 audit persistido antes do disclosure (+1 financial_read_economic_overview)', auditAfter === auditBefore + 1, `${auditBefore}→${auditAfter}`);

  // F6 — caller NÃO-membro (empresa alheia) → nega
  const outsider = (await pool.query(`
    SELECT a.user_id FROM actors a
     WHERE a.tenant_id=$1 AND a.actor_type='user' AND a.user_id<>$2
       AND NOT EXISTS (SELECT 1 FROM company_users cu JOIN users u ON u.global_user_id=cu.global_user_id WHERE u.user_id=a.user_id AND cu.company_id=$3 AND cu.member_status='active')
     LIMIT 1`, [T, fx.user_id, fx.company_id])).rows[0] as { user_id: string } | undefined;
  if (outsider) {
    app = await buildApp(T, outsider.user_id);
    const r6 = await app.inject({ method: 'GET', url });
    await app.close();
    check('F6 caller não-membro (empresa alheia) → 403 (isolamento; cross-tenant amplo = closeout 9/9)', r6.statusCode === 403, `${r6.statusCode}`);
  } else {
    check('F6 sem outsider no clone (NÃO REPRODUZIDA)', false);
  }

  // F7 — pós-revogação do grant → 403 (sem estado antigo)
  await setMember(fx.cu_id, {}); // revoga can_view_financial (reset all false, active)
  app = await buildApp(T, fx.user_id);
  const r7 = await app.inject({ method: 'GET', url });
  await app.close();
  check('F7 pós-revogação de view_financial → 403 (sem estado antigo; concorrência FOR SHARE = F3 17/17)', r7.statusCode === 403, `${r7.statusCode}`);

  console.log(`\n──────── RESULTADO: ${passed} passaram, ${failed} falharam ────────`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
