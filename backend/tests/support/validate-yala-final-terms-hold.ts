// validate-yala-final-terms-hold.ts — PROVA Etapa C (DECISION-0189C — C2/D1–D3)
//
// Roda contra CLONE EFÊMERO. Prova que financial_terms:confirm está em HOLD e que
// confirmFinancialTerms NÃO materializa bank_splits enquanto a PORTA 01 estiver fechada —
// nem por rota, nem por chamada direta, nem com FEATURE_FINANCIAL_ENABLED=true.
//   T1 canActAs('financial_terms:confirm') p/ gestor pleno → deny PORTA_01_HOLD
//   T2 canActAs('split:create') → deny PORTA_01_HOLD
//   T3 chamada DIRETA do service (flag OFF) → PORTA_01_CLOSED, 0 split, sem estado parcial
//   T4 chamada DIRETA do service com FEATURE_FINANCIAL_ENABLED=true → também bloqueada
//   T5 bank_splits/bank_transactions permanecem 0 (Δbank=0; nenhum caller alternativo criou split)

import { pool } from '@core/database/pool';
import { authorizationService } from '@core/authorization/authorization.service';
import { serviceOrderService } from '@modules/services/service-order.service';

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

async function bankCounts() {
  const r = (await pool.query(`SELECT (SELECT count(*) FROM bank_splits)::int s, (SELECT count(*) FROM bank_transactions)::int t, (SELECT count(*) FROM bank_ledger)::int l`)).rows[0];
  return r as { s: number; t: number; l: number };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!/closeout|ephemeral|clone|upgrade|final|ratchet/i.test(dbUrl)) {
    console.error(`recusado: DATABASE_URL não parece efêmero (${dbUrl.split('/').pop()})`);
    process.exit(1);
  }

  const fx = (await pool.query(`
    SELECT cu.id AS cu_id, cu.tenant_id, u.user_id, ua.id AS user_actor_id, pa.id AS page_actor_id
      FROM company_users cu
      JOIN users u  ON u.global_user_id = cu.global_user_id AND u.tenant_id = cu.tenant_id
      JOIN actors ua ON ua.user_id = u.user_id AND ua.tenant_id = cu.tenant_id AND ua.actor_type = 'user'
      JOIN actors pa ON pa.company_id = cu.company_id AND pa.tenant_id = cu.tenant_id
     LIMIT 1`)).rows[0] as { cu_id: string; tenant_id: string; user_id: string; user_actor_id: string; page_actor_id: string };
  const T = fx.tenant_id;

  // T1/T2 — decisor: gestor pleno negado nas duas chaves financeiras
  await setMember(fx.cu_id, { can_manage_company: true, can_manage_financial: true, can_view_financial: true });
  const c1 = await authorizationService.canActAs(T, fx.user_id, fx.page_actor_id, 'financial_terms:confirm');
  const c2 = await authorizationService.canActAs(T, fx.user_id, fx.page_actor_id, 'split:create');
  check('T1 canActAs(financial_terms:confirm) gestor pleno → deny PORTA_01_HOLD', !c1.allowed && /PORTA_01_HOLD/.test(c1.reason ?? ''), JSON.stringify(c1));
  check('T2 canActAs(split:create) gestor pleno → deny PORTA_01_HOLD', !c2.allowed && /PORTA_01_HOLD/.test(c2.reason ?? ''), JSON.stringify(c2));

  const before = await bankCounts();

  // T3 — chamada DIRETA do service (flag OFF por default) → PORTA_01_CLOSED antes de qualquer efeito
  delete process.env.FEATURE_FINANCIAL_ENABLED;
  let e3: string | null = null;
  try { await serviceOrderService.confirmFinancialTerms(T, '00000000-0000-0000-0000-000000000000', { confirmedByActorId: fx.page_actor_id, confirmedByUserId: fx.user_id } as never); }
  catch (e) { e3 = (e as Error).message; }
  check('T3 chamada DIRETA (flag OFF) → PORTA_01_CLOSED (antes de order lookup/split)', /PORTA_01_CLOSED/.test(e3 ?? ''), (e3 ?? 'sem erro').slice(0, 70));

  // T4 — chamada DIRETA com FEATURE_FINANCIAL_ENABLED=true → também bloqueada (flag não é autoridade)
  process.env.FEATURE_FINANCIAL_ENABLED = 'true';
  let e4: string | null = null;
  try { await serviceOrderService.confirmFinancialTerms(T, '00000000-0000-0000-0000-000000000000', { confirmedByActorId: fx.page_actor_id, confirmedByUserId: fx.user_id } as never); }
  catch (e) { e4 = (e as Error).message; }
  delete process.env.FEATURE_FINANCIAL_ENABLED;
  check('T4 chamada DIRETA com FEATURE_FINANCIAL_ENABLED=true → também PORTA_01_CLOSED', /PORTA_01_CLOSED/.test(e4 ?? ''), (e4 ?? 'sem erro').slice(0, 70));

  // T5 — nenhum split/tx materializado (sem estado parcial; Δbank=0)
  const after = await bankCounts();
  check('T5 bank_splits/transactions/ledger inalterados (0 split; sem estado parcial; Δbank=0)',
    after.s === before.s && after.t === before.t && after.l === before.l && after.s === 0, `antes=${JSON.stringify(before)} depois=${JSON.stringify(after)}`);

  console.log(`\n──────── RESULTADO: ${passed} passaram, ${failed} falharam ────────`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
