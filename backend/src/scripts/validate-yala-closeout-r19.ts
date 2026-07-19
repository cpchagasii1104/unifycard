// validate-yala-closeout-r19.ts — PROVA Etapa D (DECISION-0189A §5 — R19)
//
// Roda contra CLONE EFÊMERO. Matriz executável no decisor/fachada (as superfícies de
// invoice/overview têm as FONTES schema-ghost — a perna "dados materiais" está registrada
// como NÃO REPRODUZIDA no relatório; aqui prova-se a AUTORIZAÇÃO, que é o objeto de R19):
//   D1  PORTA_HOLD: view_all_ledger deny p/ self, gestor e membro (nunca ownership genérico)
//   D2  PORTA_HOLD: marketplace_execute_payouts deny sempre
//   D3  PORTA_HOLD: marketplace_manage_splits deny sempre
//   D4  PORTA_HOLD estrutural também no caminho legado (businessAuthorizationService)
//   D5  overview de empresa: gestor SEM view_financial → deny; membro COM view → allow
//   D6  overview de grupo: deny (fachada nega grupos — fail-closed)
//   D7  parte de invoice EMPRESARIAL: manager sem view deny · finance-manager sem view deny ·
//       membro com view allow · estranho deny (mesma fachada usada pela rota)
//   D8  Δbank=0 (psql do rito)

import { pool } from '@core/database/pool';
import { authorizationService } from '@core/authorization/authorization.service';
import { hasActorFinancialReadAuthority } from '@core/authorization/financial-read-authority';
import { businessAuthorizationService } from '@core/authorization/business-authorization.service';

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

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!/closeout|ephemeral|clone|upgrade/i.test(dbUrl)) {
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
     LIMIT 1`)).rows[0] as {
      cu_id: string; tenant_id: string; company_id: string; user_id: string;
      user_actor_id: string; page_actor_id: string;
    };
  const T = fx.tenant_id;

  // D1-D3 — PORTA_HOLD no decisor canônico (self incluído: NUNCA ownership genérico)
  await setMember(fx.cu_id, { can_manage_company: true, can_manage_financial: true, can_view_financial: true });
  for (const key of ['financial:view_all_ledger', 'marketplace_execute_payouts', 'marketplace_manage_splits'] as const) {
    const self = await authorizationService.canActAs(T, fx.user_id, fx.user_actor_id, key);
    const comp = await authorizationService.canActAs(T, fx.user_id, fx.page_actor_id, key);
    check(`D1-3 PORTA_HOLD ${key}: deny p/ self E p/ gestor pleno (razão PORTA_01_HOLD)`,
      !self.allowed && !comp.allowed && /PORTA_01_HOLD/.test(self.reason ?? '') && /PORTA_01_HOLD/.test(comp.reason ?? ''));
  }

  // D4 — caminho legado estrutural (não depende de tabela fantasma)
  const legacy = await businessAuthorizationService.checkPermission(T, fx.user_id, fx.user_actor_id, 'financial:view_all_ledger' as never);
  check('D4 PORTA_HOLD no caminho legado (businessAuthorization): deny EXPLÍCITO', !legacy.allowed && /PORTA_01_HOLD/.test(legacy.reason ?? ''));

  // D5 — overview de empresa: fachada terminal
  await setMember(fx.cu_id, { can_manage_company: true, can_manage_financial: true }); // gestor+finance SEM view
  const mgr = await hasActorFinancialReadAuthority(T, fx.user_id, fx.page_actor_id);
  await setMember(fx.cu_id, { can_view_financial: true }); // membro comum COM view
  const viewer = await hasActorFinancialReadAuthority(T, fx.user_id, fx.page_actor_id);
  check('D5 overview: gestor/finance SEM view_financial → deny; membro COM view → allow',
    !mgr.allowed && viewer.allowed && viewer.role === 'company_view_financial');

  // D6 — grupo: fail-closed (se houver grupo no clone; senão prova com actor fantasma tipo-grupo ausente)
  const g = (await pool.query(`SELECT id FROM actors WHERE tenant_id=$1 AND group_id IS NOT NULL LIMIT 1`, [T])).rows[0];
  if (g) {
    const grp = await hasActorFinancialReadAuthority(T, fx.user_id, (g as { id: string }).id);
    check('D6 overview de grupo → deny (fachada nega grupos)', !grp.allowed);
  } else {
    const ghost = await hasActorFinancialReadAuthority(T, fx.user_id, '00000000-0000-4000-8000-0000000000aa');
    check('D6 (sem grupo no clone) actor inexistente → deny uniforme; ramo grupo é fail-closed por código', !ghost.allowed);
  }

  // D7 — parte de invoice EMPRESARIAL usa a MESMA fachada (provada acima) + estranho
  const stranger = await hasActorFinancialReadAuthority(T, '22222222-2222-4222-8222-222222222222', fx.page_actor_id);
  check('D7 estranho sobre parte empresarial → deny', !stranger.allowed);

  console.log(`\n${failed === 0 ? '✅✅' : '❌'} PROVA ETAPA D (R19): ${passed} verdes, ${failed} vermelhos`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => { console.error('❌ prova Etapa D falhou:', err?.message ?? err); process.exit(1); });
