// validate-yala-final-porta01.ts — PROVA Etapa B (DECISION-0189B — C1 / D1–D3)
//
// Roda contra CLONE EFÊMERO. Prova o fechamento financeiro terminal da PORTA 01:
//   B1  HOLD terminal das chaves NOVAS (execute_payout, execute_payments, split:create):
//       deny para self, gestor pleno e membro com can_manage_financial — o deny precede
//       ownership/role/capability (inclui can_hold_assets, que nunca chega a ser consultado).
//   B2  Aliases já em HOLD (execute_payouts, manage_splits) seguem deny.
//   B3  Caminho legado (businessAuthorizationService) nega execute_payments estruturalmente.
//   B4  GET /payouts/orders → 503 { code:'PORTA_01_CLOSED' } IDÊNTICO com e sem actorId,
//       sem chamar listOrders (prova HTTP via fastify.inject).
//   B5  Δbank inspecionado (bank_ledger/tx/splits) — 0 no efêmero fresh.

import { pool } from '@core/database/pool';
import { authorizationService } from '@core/authorization/authorization.service';
import { businessAuthorizationService } from '@core/authorization/business-authorization.service';
import Fastify from 'fastify';
import payoutRoutes from '../modules/payout/payout.routes';

let passed = 0; let failed = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  if (ok) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.log(`❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const FLAGS = ['can_manage_company','can_manage_members','can_manage_financial','can_view_financial','can_publish_feed','can_create_events','can_manage_employees','can_manage_services','can_view_reports'];
async function setMember(cuId: string, patch: Record<string, boolean>) {
  const reset = FLAGS.map((f) => `${f} = false`).join(', ');
  await pool.query(`UPDATE company_users SET ${reset}, member_status='active' WHERE id=$1`, [cuId]);
  const keys = Object.keys(patch);
  if (keys.length) {
    await pool.query(`UPDATE company_users SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id=$1`, [cuId, ...keys.map((k) => patch[k])]);
  }
}

const HOLD_NEW = ['financial:execute_payout', 'marketplace_execute_payments', 'split:create'] as const;
const HOLD_LEGACY = ['marketplace_execute_payouts', 'marketplace_manage_splits'] as const;

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!/closeout|ephemeral|clone|upgrade|final/i.test(dbUrl)) {
    console.error(`recusado: DATABASE_URL não parece efêmero (${dbUrl.split('/').pop()})`);
    process.exit(1);
  }

  const fx = (await pool.query(`
    SELECT cu.id AS cu_id, cu.tenant_id, cu.company_id, u.user_id,
           ua.id AS user_actor_id, pa.id AS page_actor_id
      FROM company_users cu
      JOIN users u  ON u.global_user_id = cu.global_user_id AND u.tenant_id = cu.tenant_id
      JOIN actors ua ON ua.user_id = u.user_id AND ua.tenant_id = cu.tenant_id AND ua.actor_type = 'user'
      JOIN actors pa ON pa.company_id = cu.company_id AND pa.tenant_id = cu.tenant_id
     LIMIT 1`)).rows[0] as {
      cu_id: string; tenant_id: string; company_id: string; user_id: string;
      user_actor_id: string; page_actor_id: string;
    };
  const T = fx.tenant_id;

  // B1 — gestor PLENO (owner-equivalente: todas as flags) + membro com can_manage_financial
  await setMember(fx.cu_id, { can_manage_company: true, can_manage_financial: true, can_view_financial: true });
  for (const key of HOLD_NEW) {
    const self = await authorizationService.canActAs(T, fx.user_id, fx.user_actor_id, key);
    const comp = await authorizationService.canActAs(T, fx.user_id, fx.page_actor_id, key);
    check(`B1 HOLD "${key}": deny p/ self E gestor pleno (can_manage_financial incl.), razão PORTA_01_HOLD antes de ownership/capability`,
      !self.allowed && !comp.allowed && /PORTA_01_HOLD/.test(self.reason ?? '') && /PORTA_01_HOLD/.test(comp.reason ?? ''));
  }

  // B2 — aliases já em HOLD seguem deny
  for (const key of HOLD_LEGACY) {
    const comp = await authorizationService.canActAs(T, fx.user_id, fx.page_actor_id, key);
    check(`B2 HOLD alias "${key}": deny (PORTA_01_HOLD)`, !comp.allowed && /PORTA_01_HOLD/.test(comp.reason ?? ''));
  }

  // B3 — caminho legado estrutural
  const legacy = await businessAuthorizationService.checkPermission(T, fx.user_id, fx.page_actor_id, 'marketplace_execute_payments' as never);
  check('B3 caminho legado (businessAuthorization) nega execute_payments (PORTA_01_HOLD)',
    !legacy.allowed && /PORTA_01_HOLD/.test(legacy.reason ?? ''));

  // B4 — GET /payouts/orders 503 uniforme via HTTP
  const app = Fastify();
  await app.register(payoutRoutes);
  await app.ready();
  const noFilter = await app.inject({ method: 'GET', url: '/payouts/orders' });
  const withActor = await app.inject({ method: 'GET', url: `/payouts/orders?actorId=${fx.page_actor_id}` });
  await app.close();
  const bodyNo = noFilter.json() as { code?: string };
  const bodyWith = withActor.json() as { code?: string };
  check('B4 GET /payouts/orders SEM actorId → 503 PORTA_01_CLOSED',
    noFilter.statusCode === 503 && bodyNo.code === 'PORTA_01_CLOSED', `${noFilter.statusCode} ${JSON.stringify(bodyNo)}`);
  check('B4 GET /payouts/orders COM actorId → 503 PORTA_01_CLOSED (idêntico)',
    withActor.statusCode === 503 && bodyWith.code === 'PORTA_01_CLOSED'
    && noFilter.statusCode === withActor.statusCode && bodyNo.code === bodyWith.code,
    `${withActor.statusCode} ${JSON.stringify(bodyWith)}`);
  check('B4 resposta não vaza orders (sem chave "orders" no corpo)',
    !('orders' in bodyNo) && !('orders' in bodyWith));

  // B5 — Δbank inspecionado
  const bank = (await pool.query(`SELECT
      (SELECT count(*) FROM bank_ledger)::int AS l,
      (SELECT count(*) FROM bank_transactions)::int AS t,
      (SELECT count(*) FROM bank_splits)::int AS s`)).rows[0] as { l: number; t: number; s: number };
  check('B5 Δbank=0 no efêmero (ledger/tx/splits todos 0)', bank.l === 0 && bank.t === 0 && bank.s === 0, JSON.stringify(bank));

  console.log(`\n──────── RESULTADO: ${passed} passaram, ${failed} falharam ────────`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
