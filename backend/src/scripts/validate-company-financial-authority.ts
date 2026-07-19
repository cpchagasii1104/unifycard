// validate-company-financial-authority.ts — PROVA ADVERSARIAL F3 (DECISION-0189)
//
// Roda contra CLONE EFÊMERO do dev (recusa DB não-efêmero). Prova a autoridade TERMINAL de
// leitura financeira e o dispatch do policy registry, manipulando a MEMBERSHIP real do clone
// (matriz de flags por cenário — clone é descartável).
//
// Casos (mínimos ratificados da F3):
//   1  membro ativo sem can_view_financial → deny
//   2  rótulo role='owner' sem flag → deny
//   3  is_primary sem flag → deny
//   4  can_manage_company sem view → deny
//   5  can_manage_financial sem view → deny
//   6  delegação ativa publish_feed → financeiro deny (canActAs view_financial TERMINAL)
//   7  can_view_financial=true → allow (role company_view_financial)
//   8  suspended com flag → deny (status nega; grants congelados)
//   9  revoked → deny
//  10  actor UUID inexistente → deny (uniforme com sem-grant)
//  11  self-wallet: actor humano com userId ≠ dono → deny; dono → allow(self)
//  12  revogação × leitura: lock FOR SHARE segura o UPDATE concorrente até o fim da leitura
//      (linearização provada por ordem temporal)
//  13  projeção: roster de delegações REDIGIDO sem can_manage_members; company.post só com grant
//  14  canActAs('view_financial') TERMINAL: gestor sem flag → deny; com flag → membership_grant
//  15  canActAs('publish_feed'): com grant → membership_grant; sem grant → fallback legado (F4 corta)
//  16  splits: origem de transação inexistente resolve null (rota → 404 uniforme)
//  17  audit trail: recordFinancialAudit persiste ANTES da resposta (linha em financial_audit_trail)

import { pool } from '@core/database/pool';
import { authorizeActorFinancialRead, hasActorFinancialReadAuthority } from '@core/authorization/financial-read-authority';
import { authorizationService } from '@core/authorization/authorization.service';
import { actorDelegationRepository } from '@core/actor-delegation/actor-delegation.repository';
import { recordFinancialAudit } from '@core/observability/financial-audit';
import { bankPortsRegistry } from '@core/bank/ports-registry';
import { bankTransactionReadAdapter } from '@modules/bank/adapters/bank-transaction-read.adapter';

let passed = 0;
let failed = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  if (ok) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.log(`❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const ALL_FLAGS = [
  'can_manage_company', 'can_manage_financial', 'can_manage_employees', 'can_view_reports',
  'can_manage_services', 'can_view_financial', 'can_manage_members', 'can_publish_feed', 'can_create_events',
];

async function setMember(cuId: string, patch: Record<string, unknown>): Promise<void> {
  const resetSql = ALL_FLAGS.map((f) => `${f} = false`).join(', ');
  await pool.query(`UPDATE company_users SET ${resetSql}, role = 'member', is_primary = false, member_status = 'active' WHERE id = $1`, [cuId]);
  const keys = Object.keys(patch);
  if (keys.length > 0) {
    const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    await pool.query(`UPDATE company_users SET ${sets} WHERE id = $1`, [cuId, ...keys.map((k) => patch[k])]);
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!/f3|ephemeral|clone|upgrade/i.test(dbUrl)) {
    console.error(`recusado: DATABASE_URL não parece efêmero (${dbUrl.split('/').pop()})`);
    process.exit(1);
  }

  // ports p/ canActAs (mesmo padrão dos e2e)
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const a = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(a.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(a.actorUtilsAdapter);

  const fx = (await pool.query(`
    SELECT cu.id AS cu_id, cu.tenant_id, cu.company_id, cu.global_user_id,
           u.user_id, ua.id AS user_actor_id, pa.id AS page_actor_id
      FROM company_users cu
      JOIN users u  ON u.global_user_id = cu.global_user_id AND u.tenant_id = cu.tenant_id
      JOIN actors ua ON ua.user_id = u.user_id AND ua.tenant_id = cu.tenant_id AND ua.actor_type = 'user'
      JOIN actors pa ON pa.company_id = cu.company_id AND pa.tenant_id = cu.tenant_id
     LIMIT 1`)).rows[0] as {
      cu_id: string; tenant_id: string; company_id: string; global_user_id: string;
      user_id: string; user_actor_id: string; page_actor_id: string;
    } | undefined;
  if (!fx) { console.error('fixture ausente no clone'); process.exit(1); }
  const T = fx.tenant_id;
  const gate = () => hasActorFinancialReadAuthority(T, fx.user_id, fx.page_actor_id);

  // 1
  await setMember(fx.cu_id, {});
  check('1. membro ativo sem can_view_financial → deny', !(await gate()).allowed);
  // 2
  await setMember(fx.cu_id, {});
  await pool.query(`UPDATE company_users SET role='owner' WHERE id=$1`, [fx.cu_id]);
  check("2. rótulo role='owner' sem flag → deny", !(await gate()).allowed);
  // 3
  await setMember(fx.cu_id, {});
  await pool.query(`UPDATE company_users SET is_primary=true WHERE id=$1`, [fx.cu_id]);
  check('3. is_primary sem flag → deny', !(await gate()).allowed);
  // 4
  await setMember(fx.cu_id, { can_manage_company: true });
  check('4. can_manage_company sem view → deny', !(await gate()).allowed);
  // 5
  await setMember(fx.cu_id, { can_manage_financial: true });
  check('5. can_manage_financial sem view → deny', !(await gate()).allowed);
  // 6 — delegação publish_feed não abre financeiro
  await setMember(fx.cu_id, {});
  const deleg = await actorDelegationRepository.create(T, {
    userActorId: fx.user_actor_id,
    institutionalActorId: fx.page_actor_id,
    scopes: ['publish_feed'],
    relationshipType: 'employee',
  });
  const viaCanActAs = await authorizationService.canActAs(T, fx.user_id, fx.page_actor_id, 'view_financial');
  check('6. delegação publish_feed → view_financial TERMINAL deny', !viaCanActAs.allowed && !(await gate()).allowed);
  await actorDelegationRepository.revoke(T, deleg.delegationId);
  // 7
  await setMember(fx.cu_id, { can_view_financial: true });
  const ok7 = await gate();
  check('7. can_view_financial=true → allow (company_view_financial)', ok7.allowed && ok7.role === 'company_view_financial');
  // 8
  await setMember(fx.cu_id, { can_view_financial: true });
  await pool.query(`UPDATE company_users SET member_status='suspended' WHERE id=$1`, [fx.cu_id]);
  check('8. suspended com flag → deny (status nega)', !(await gate()).allowed);
  // 9
  await pool.query(`UPDATE company_users SET member_status='revoked' WHERE id=$1`, [fx.cu_id]);
  check('9. revoked → deny', !(await gate()).allowed);
  // 10
  await setMember(fx.cu_id, { can_view_financial: true });
  const ghost = await hasActorFinancialReadAuthority(T, fx.user_id, '00000000-0000-4000-8000-000000000000');
  check('10. actor inexistente → deny (uniforme)', !ghost.allowed);
  // 11
  const selfOk = await hasActorFinancialReadAuthority(T, fx.user_id, fx.user_actor_id);
  const selfSpoof = await hasActorFinancialReadAuthority(T, '11111111-1111-4111-8111-111111111111', fx.user_actor_id);
  check('11. self-wallet: dono → allow(self); userId alheio → deny', selfOk.allowed && selfOk.role === 'self' && !selfSpoof.allowed);
  // 12 — linearização: UPDATE concorrente espera o lock FOR SHARE da leitura
  await setMember(fx.cu_id, { can_view_financial: true });
  let updateFinishedAt = 0;
  let readFinishedAt = 0;
  const reader = authorizeActorFinancialRead(T, fx.user_id, fx.page_actor_id, async () => {
    await new Promise((r) => setTimeout(r, 500));
    return 'read-done';
  }).then((r) => { readFinishedAt = Date.now(); return r; });
  await new Promise((r) => setTimeout(r, 120)); // deixa o lock ser tomado
  const updater = pool.query(`UPDATE company_users SET member_status='revoked' WHERE id=$1`, [fx.cu_id])
    .then(() => { updateFinishedAt = Date.now(); });
  const readOutcome = await reader;
  await updater;
  check(
    '12. revogação concorrente espera a leitura (linearização por FOR SHARE)',
    readOutcome.allowed && updateFinishedAt >= readFinishedAt,
    `read@${readFinishedAt} update@${updateFinishedAt}`
  );
  // 13 — projeção redigida
  await setMember(fx.cu_id, { can_publish_feed: true }); // sem manage_members
  const { actorCapabilitiesService } = await import('../core/actor-capabilities/actor-capabilities.service');
  const proj = await actorCapabilitiesService.resolveForUser(T, fx.page_actor_id, fx.user_id);
  const projNoGrant = proj !== null && proj.delegations.length === 0 && proj.capabilities.includes('company.post');
  await setMember(fx.cu_id, {}); // sem publish
  const proj2 = await actorCapabilitiesService.resolveForUser(T, fx.page_actor_id, fx.user_id);
  check(
    '13. roster redigido sem manage_members; company.post SÓ com can_publish_feed',
    projNoGrant && proj2 !== null && !proj2.capabilities.includes('company.post') && proj2.delegations.length === 0
  );
  // 14 — canActAs terminal
  await setMember(fx.cu_id, { can_manage_company: true });
  const d14a = await authorizationService.canActAs(T, fx.user_id, fx.page_actor_id, 'view_financial');
  await setMember(fx.cu_id, { can_view_financial: true });
  const d14b = await authorizationService.canActAs(T, fx.user_id, fx.page_actor_id, 'view_financial');
  check('14. canActAs view_financial: gestor sem flag → deny; com flag → membership_grant',
    !d14a.allowed && d14b.allowed && d14b.authoritySource === 'membership_grant');
  // 15 — publish_feed: grant → membership_grant; sem grant + gestor → fallback legado (até F4)
  // Pré-condição da TRÍADE: capability do actor no registry (can_publish_feed) — o writer real
  // (company-members.service) registra lazy; este clone pode ter page actor sem linha. Registramos
  // como o service faz (mesma perna, mesma fonte).
  {
    const { actorRegistryService } = await import('../core/actor-registry/actor-registry.service');
    await actorRegistryService.register(T, fx.page_actor_id, 'company', 'companies', fx.company_id);
  }
  await setMember(fx.cu_id, { can_publish_feed: true });
  const d15a = await authorizationService.canActAs(T, fx.user_id, fx.page_actor_id, 'publish_feed');
  await setMember(fx.cu_id, { can_manage_company: true });
  const d15b = await authorizationService.canActAs(T, fx.user_id, fx.page_actor_id, 'publish_feed');
  check('15. publish_feed: grant → membership_grant; gestor sem grant → ownership legado (transitório F4)',
    d15a.allowed && d15a.authoritySource === 'membership_grant' && d15b.allowed && d15b.authoritySource === 'ownership');
  // 16 — splits origem inexistente (via PORTA do Bank — mesma superfície que a rota usa)
  bankPortsRegistry.setBankTransactionRead(bankTransactionReadAdapter);
  const origin = await bankPortsRegistry
    .getBankTransactionRead()
    .getOriginAccountByTransactionId(T, '00000000-0000-4000-8000-000000000001');
  check('16. origem de transação inexistente → null (rota 404 uniforme)', origin === null);
  // 17 — audit trail persiste
  const before17 = Number((await pool.query(`SELECT count(*)::int n FROM financial_audit_trail WHERE tenant_id=$1`, [T])).rows[0].n);
  await recordFinancialAudit({ tenant_id: T, event_type: 'financial_read_balance', actor_id: fx.page_actor_id, metadata: { proof: 'f3' } });
  const after17 = Number((await pool.query(`SELECT count(*)::int n FROM financial_audit_trail WHERE tenant_id=$1`, [T])).rows[0].n);
  check('17. audit trail persistido (fail-closed estrutural: await antes da resposta)', after17 === before17 + 1);

  // Δbank=0 é provado FORA deste script (passo psql do rito efêmero — ledger/tx/splits = 0
  // pré e pós), preservando a Lei 5/ratchet financial-ssot: nenhum SQL bank_* fora do Bank.

  console.log(`\n${failed === 0 ? '✅✅' : '❌'} PROVA F3: ${passed} verdes, ${failed} vermelhos`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => { console.error('❌ prova F3 falhou:', err); process.exit(1); });
