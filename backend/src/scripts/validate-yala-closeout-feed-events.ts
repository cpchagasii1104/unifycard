// validate-yala-closeout-feed-events.ts — PROVA ADVERSARIAL Etapa B (DECISION-0189A)
//
// Roda contra CLONE EFÊMERO. Prova a matriz de decisão EXATA de feed/eventos no decisor
// canônico (as rotas agora delegam a decisão a canActAs — a fiação está provada pelo guard
// estrutural audit-event-feed-exact-permission):
//   B1  membro can_publish_feed=true, can_manage_company=false → PUBLICA (membership_grant)
//   B2  membro ativo sem can_publish_feed → 403
//  B3  gestor can_manage_company=true, can_publish_feed=false → 403 (Finding B morto)
//   B4  representante externo (delegação publish_feed) → permitido SÓ na empresa delegada
//   B5  membro can_create_events=true, can_manage_company=false → CRIA evento
//   B6  membro sem can_create_events → 403
//   B7  gestor sem can_create_events → 403 (Finding A morto)
//   B8  actor de empresa alheia → deny uniforme
//   B9  manage_events: governança → allow; membro comum (só create_events) → deny
//   B10 manage_attendees: governança → allow; membro comum → deny
//   B11 PF (self) publica/cria no próprio actor
//   B12 suspenso/revogado com grants → deny

import { randomUUID } from 'crypto';
import { pool } from '@core/database/pool';
import { authorizationService } from '@core/authorization/authorization.service';
import { actorDelegationRepository } from '@core/actor-delegation/actor-delegation.repository';

let passed = 0; let failed = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  if (ok) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.log(`❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const FLAGS = ['can_manage_company','can_manage_members','can_manage_financial','can_view_financial','can_publish_feed','can_create_events','can_manage_employees','can_manage_services','can_view_reports'];

async function setMember(cuId: string, patch: Record<string, boolean>, status = 'active') {
  const reset = FLAGS.map((f) => `${f} = false`).join(', ');
  await pool.query(`UPDATE company_users SET ${reset}, member_status = $2 WHERE id = $1`, [cuId, status]);
  const keys = Object.keys(patch);
  if (keys.length) {
    await pool.query(`UPDATE company_users SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [cuId, ...keys.map((k) => patch[k])]);
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
    SELECT cu.id AS cu_id, cu.tenant_id, cu.company_id, cu.global_user_id, u.user_id,
           ua.id AS user_actor_id, pa.id AS page_actor_id
      FROM company_users cu
      JOIN users u  ON u.global_user_id = cu.global_user_id AND u.tenant_id = cu.tenant_id
      JOIN actors ua ON ua.user_id = u.user_id AND ua.tenant_id = cu.tenant_id AND ua.actor_type = 'user'
      JOIN actors pa ON pa.company_id = cu.company_id AND pa.tenant_id = cu.tenant_id
     WHERE cu.can_manage_company LIMIT 1`)).rows[0] as {
      cu_id: string; tenant_id: string; company_id: string; global_user_id: string;
      user_id: string; user_actor_id: string; page_actor_id: string;
    };
  const T = fx.tenant_id;
  const { actorRegistryService } = await import('../core/actor-registry/actor-registry.service');
  await actorRegistryService.register(T, fx.page_actor_id, 'company', 'companies', fx.company_id);
  const pf = (k: 'publish_feed' | 'create_events' | 'manage_events' | 'manage_attendees') =>
    authorizationService.canActAs(T, fx.user_id, fx.page_actor_id, k);

  // B1/B5 — membro fino SEM manage_company
  await setMember(fx.cu_id, { can_publish_feed: true, can_create_events: true });
  const b1 = await pf('publish_feed');
  const b5 = await pf('create_events');
  check('B1 membro can_publish_feed sem manage_company → PUBLICA (membership_grant)', b1.allowed && b1.authoritySource === 'membership_grant');
  check('B5 membro can_create_events sem manage_company → CRIA (membership_grant)', b5.allowed && b5.authoritySource === 'membership_grant');

  // B2/B6 — membro sem grants
  await setMember(fx.cu_id, {});
  check('B2 membro sem can_publish_feed → deny', !(await pf('publish_feed')).allowed);
  check('B6 membro sem can_create_events → deny', !(await pf('create_events')).allowed);

  // B3/B7 — GESTOR sem grants finos (Findings A/B mortos)
  await setMember(fx.cu_id, { can_manage_company: true, can_manage_members: true });
  check('B3 gestor sem can_publish_feed → deny (sombra morta)', !(await pf('publish_feed')).allowed);
  check('B7 gestor sem can_create_events → deny (gate exato vivo)', !(await pf('create_events')).allowed);

  // B9/B10 — manage_events/attendees: governança sim; membro comum não
  const b9g = await pf('manage_events');
  const b10g = await pf('manage_attendees');
  check('B9a governança → manage_events allow', b9g.allowed);
  check('B10a governança → manage_attendees allow', b10g.allowed);
  await setMember(fx.cu_id, { can_publish_feed: true, can_create_events: true });
  check('B9b membro comum (create_events) NÃO altera evento (manage_events deny)', !(await pf('manage_events')).allowed);
  check('B10b membro comum NÃO administra participantes (manage_attendees deny)', !(await pf('manage_attendees')).allowed);

  // B12 — status nega
  await setMember(fx.cu_id, { can_publish_feed: true, can_create_events: true }, 'suspended');
  check('B12a suspenso com grants → deny', !(await pf('publish_feed')).allowed && !(await pf('create_events')).allowed);
  await setMember(fx.cu_id, { can_publish_feed: true }, 'revoked');
  check('B12b revogado → deny', !(await pf('publish_feed')).allowed);
  await setMember(fx.cu_id, { can_manage_company: true, can_manage_members: true, can_publish_feed: true, can_create_events: true, can_view_financial: true, can_manage_financial: true, can_manage_employees: true, can_manage_services: true, can_view_reports: true });

  // B4 — representante EXTERNO com delegação exata (revoga membership de um user sintético e delega)
  const g2 = randomUUID(); const u2 = randomUUID(); const ua2 = randomUUID();
  await pool.query(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [g2, String(Math.floor(1e10 + Math.random() * 8.9e10))]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none') ON CONFLICT DO NOTHING`, [g2, String(Math.floor(1e10 + Math.random() * 8.9e10))]);
  await pool.query(`INSERT INTO users (user_id, tenant_id, global_user_id, email, password_hash) VALUES ($1,$2,$3,$4,'x')`, [u2, T, g2, `bcl-${u2.slice(0, 8)}@proof.local`]);
  await pool.query(`INSERT INTO actors (id, actor_id, tenant_id, user_id, global_user_id, actor_type, display_name) VALUES ($1,$1,$2,$3,$4,'user','Closeout Rep')`, [ua2, T, u2, g2]);
  const dExt = await actorDelegationRepository.create(T, {
    userActorId: ua2, institutionalActorId: fx.page_actor_id,
    scopes: ['publish_feed'], relationshipType: 'attorney',
  });
  const b4a = await authorizationService.canActAs(T, u2, fx.page_actor_id, 'publish_feed');
  const b4b = await authorizationService.canActAs(T, u2, fx.page_actor_id, 'create_events');
  check('B4 rep externo (delegação publish_feed) → publica SÓ com o scope exato; create_events deny',
    b4a.allowed && b4a.authoritySource === 'delegation' && !b4b.allowed);
  // B8 — empresa alheia (actor fantasma)
  const b8 = await authorizationService.canActAs(T, u2, fx.user_actor_id, 'publish_feed').catch(() => ({ allowed: false }));
  const b8b = await authorizationService.canActAs(T, u2, '00000000-0000-4000-8000-00000000dead', 'create_events').catch(() => ({ allowed: false }));
  check('B8 actor alheio/inexistente → deny uniforme', !b8.allowed && !b8b.allowed);
  await actorDelegationRepository.revoke(T, dExt.delegationId);

  // B11 — PF self
  const b11a = await authorizationService.canActAs(T, fx.user_id, fx.user_actor_id, 'publish_feed');
  const b11b = await authorizationService.canActAs(T, fx.user_id, fx.user_actor_id, 'create_events');
  check('B11 PF publica/cria no próprio actor (self)', b11a.allowed && b11b.allowed);

  console.log(`\n${failed === 0 ? '✅✅' : '❌'} PROVA ETAPA B: ${passed} verdes, ${failed} vermelhos`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => { console.error('❌ prova Etapa B falhou:', err?.message ?? err); process.exit(1); });
