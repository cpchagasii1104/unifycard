/**
 * E2E F-PLAN-IDENTITY-CONFIG-AUTHORSHIP-GATE-F5_1 (DECISION-0113 fatia 5.1 — self-only)
 *
 * `PUT /plan` e `PUT /identity/configurations` são operações SELF (o caller age sobre o PRÓPRIO user).
 * Antes derivavam o sujeito de `actionContext.actorId` declarado (spoofável) → caller comum trocava
 * plano/userType de OUTRO usuário. Fix: sujeito resolvido de `req.user` server-side; `actorId` declarado
 * IGNORADO para autoridade.
 *
 * Gates vivem nas ROTAS → prova (A) que a resolução self aponta sempre para o CALLER (nunca para um
 * actor declarado) + (B) wiring estrutural (sujeito de req.user; resolução spoofável removida).
 *
 * Casos:
 *   A1 plan: findByUserId(devUserId) → user-actor do dev (sujeito do plano = actor do caller).
 *   A2 identity: resolveGlobalUserId(devUserId) → globalUserId do dev (sujeito do config = global do caller).
 *   A3 contraste: um actor ALHEIO (page-actor de empresa) NÃO é o que findByUserId(devUserId) retorna →
 *      um actorId declarado não vira o sujeito (spoof neutralizado: sujeito é sempre o do caller).
 *   B1 plan.routes: actorId derivado de findByUserId(req.user.userId); NÃO de req.actionContext.actorId.
 *   B2 identity.routes /configurations: callerGlobalUserId de req.user; updateGlobalIdentity sobre ele;
 *      removida a resolução via findById(actionContext.actorId).
 *   B3 nenhum dos dois handlers usa actionContext.actorId como SUJEITO da mutação.
 *
 * Base: tenant DEV. LIMPO ao fim. Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-pj-plan-identity-config-authorship.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';
import { companiesService } from '../core/companies/companies.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

async function bootstrap(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

function validCnpj(): string {
  const n: number[] = [];
  for (let i = 0; i < 12; i++) n.push(Math.floor(Math.random() * 10));
  const dv = (base: number[]): number => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.reduce((acc, d, i) => acc + d * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(n);
  const d2 = dv([...n, d1]);
  return [...n, d1, d2].join('');
}

async function main(): Promise<void> {
  await bootstrap();

  const dev = await pool.query<{ id: string; global_user_id: string }>(
    `SELECT id::text AS id, global_user_id::text AS global_user_id FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1`,
    [DEV_EMAIL, TENANT_ID]
  );
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].id; // = req.user.userId
  const devGlobalUserId = dev.rows[0].global_user_id;

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const actorRepo = socialPortsRegistry.getActorRepository();
  const { resolveGlobalUserId } = await import('../core/identity/identity.utils');

  const createdCompanyIds: string[] = [];
  try {
    console.log('\n— A (resolução self aponta para o caller) —');
    const devActor = await actorRepo.findByUserId(TENANT_ID, devUserId);
    record('A1 plan: findByUserId(req.user.userId) → user-actor do dev (sujeito = actor do caller)',
      !!devActor && devActor.user_id === devUserId, `actor=${devActor?.actor_id} user_id=${devActor?.user_id}`);

    const resolvedGlobal = await resolveGlobalUserId(devUserId, TENANT_ID);
    record('A2 identity: resolveGlobalUserId(req.user.userId) → globalUserId do dev (sujeito = global do caller)',
      resolvedGlobal === devGlobalUserId, `resolved=${resolvedGlobal} expected=${devGlobalUserId}`);

    // A3 contraste: actor alheio (page-actor de empresa) ≠ o resolvido do caller
    const c = await companiesService.createCompany(
      devGlobalUserId,
      { cnpj: validCnpj(), companyName: 'E2E F51 Foreign', role: 'owner' as never, fetchFromRevenue: false, isPrimary: false },
      TENANT_ID
    );
    createdCompanyIds.push(c.company.companyId);
    const foreign = (await pool.query<{ actor_id: string }>(
      `SELECT actor_id FROM actors WHERE tenant_id=$1 AND company_id=$2::uuid LIMIT 1`, [TENANT_ID, c.company.companyId]
    )).rows[0]?.actor_id;
    record('A3 contraste: actor alheio (page-actor) ≠ actor resolvido do caller (spoof neutralizado)',
      !!foreign && foreign !== devActor?.actor_id, `foreign=${foreign} caller=${devActor?.actor_id}`);

    console.log('\n— B (wiring estrutural: sujeito de req.user, não do actorId declarado) —');
    const planSrc = readFileSync(join(process.cwd(), 'src/core/plan/plan.routes.ts'), 'utf8');
    const planPut = planSrc.slice(planSrc.indexOf("fastify.put"));
    record('B1a plan: actorId derivado de findByUserId(req.user.userId)',
      /findByUserId\(req\.tenant\.id, req\.user\.userId\)/.test(planPut) && /const actorId = callerActor\.actor_id/.test(planPut));
    record('B1b plan: actorId NÃO mais derivado de req.actionContext.actorId',
      !/const actorId = req\.actionContext\.actorId/.test(planPut));

    const idSrc = readFileSync(join(process.cwd(), 'src/core/identity/identity.routes.ts'), 'utf8');
    // Fatiar SÓ o handler PUT /identity/configurations (do comentário até a próxima rota fastify.*).
    const cfgStart = idSrc.indexOf('PUT /identity/configurations');
    const afterPut = idSrc.indexOf('fastify.put', cfgStart);
    const cfgEnd = idSrc.indexOf('fastify.', afterPut + 20);
    const cfg = cfgStart >= 0 ? idSrc.slice(cfgStart, cfgEnd > cfgStart ? cfgEnd : cfgStart + 3000) : '';
    record('B2a identity: callerGlobalUserId resolvido de req.user',
      /req\.user\.globalUserId \?\? await resolveGlobalUserId\(req\.user\.userId/.test(cfg)
      && /updateGlobalIdentity\(req\.tenant\.id, callerGlobalUserId/.test(cfg));
    record('B2b identity: resolução via findById(actionContext.actorId) REMOVIDA do /configurations',
      !/findById\(req\.tenant\.id, req\.actionContext\.actorId\)/.test(cfg));

    record('B3 nenhum handler usa actionContext.actorId como sujeito da mutação',
      !/const actorId = req\.actionContext\.actorId/.test(planPut)
      && !/findById\(req\.tenant\.id, req\.actionContext\.actorId\)/.test(cfg));
  } finally {
    console.log('\n— cleanup —');
    for (const id of [...createdCompanyIds]) {
      for (const t of ['company_opportunity_preferences', 'company_domains', 'company_users']) {
        try { await pool.query(`DELETE FROM ${t} WHERE company_id = $1::uuid`, [id]); }
        catch (e) { if ((e as { code?: string }).code !== '42P01') console.warn(`cleanup ${t}:`, (e as Error).message); }
      }
      await pool.query(`DELETE FROM actors WHERE company_id = $1::uuid`, [id]);
      await pool.query(`DELETE FROM companies WHERE company_id = $1::uuid`, [id]);
    }
    const left = await pool.query<{ n: string }>(
      `SELECT count(*)::text n FROM companies WHERE company_name LIKE 'E2E F51 %'`
    );
    record('CLEANUP DEV intacto (companies de teste = 0)', left.rows[0].n === '0', `restantes=${left.rows[0].n}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Plan + identity-config authorship (F5.1 self-only) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
