/**
 * E2E — F-RISK-DASHBOARD (2026-07-31)
 *
 * Prova COMPORTAMENTAL, chamando risk-dashboard.service.ts DIRETO (não via HTTP): as 4 rotas em
 * risk-dashboard.routes.ts checam `isPorta01Closed()` ANTES de chamar o service — e PORTA 01 está
 * ESTRUTURALMENTE fechada hoje (`financial:execute_payout` em PORTA_HOLD_KEYS,
 * company-policy-registry.ts:230-244, DECISION-0189C/0189A). Isso significa que TODA rota de
 * risk-dashboard devolve 503 PORTA_01_CLOSED incondicionalmente, ANTES de alcançar o código desta
 * fatia — não tocado aqui (hold deliberado, "NUNCA afrouxar" no próprio comentário da norma). A
 * prova, portanto, é no SERVICE (o nível que este pacote pediu pra corrigir), não na rota HTTP.
 *
 * Prova:
 *   1) getOverview/listActorRiskProfiles/getActorRiskTimeline NÃO lançam (antes desta fatia:
 *      lançavam sempre — 0 try/catch no arquivo inteiro, qualquer leitura de agreements/
 *      evidence_packs/payout_orders — todas schema-ghost, medido — derrubava a chamada).
 *   2) as métricas dependentes vêm `undefined` (desconhecido), nunca `0` (afirmação falsa).
 *   3) o log nomeia a causa nos 3 pontos de captura (agreements/evidence_packs/payout_orders).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-risk-dashboard-schema-ghost-ephemeral.ps1.
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-risk-dashboard-schema-ghost.ts
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { randomUUID } from 'crypto';

import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/risk|dashboard|schema.ghost|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
  for (const t of ['agreements', 'evidence_packs', 'payout_orders']) {
    const r2 = await pool.query<{ t: string | null }>(`SELECT to_regclass('public.${t}')::text AS t`);
    record(`pré-condição: ${t} NÃO existe (schema-ghost, como medido em unificard_dev)`, r2.rows[0].t === null, `to_regclass=${r2.rows[0].t}`);
  }
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Risk Dashboard Schema Ghost Test', slug: `risk-dash-${Date.now()}` });

  const actorRepo = socialPortsRegistry.getActorRepository();
  const globalId = randomUUID();
  const userId = randomUUID();
  const cpf = String(Date.now() % 100000000).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,$3,'{}'::jsonb)`, [globalId, cpf, 'E2E Actor']);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [globalId, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [userId, TENANT_ID, globalId, `${userId}@e2e.local`]);
  const actorId = (await actorRepo.findOrCreateUserActor(TENANT_ID, userId)).actor_id;

  // seed direto — 1 trust_profile, pra exercitar o loop per-actor de listActorRiskProfiles.
  // risk_level minúsculo (CHECK do banco); achado colateral NÃO consertado nesta fatia:
  // trust.repository.ts:79 (`riskLevel: row.risk_level as any`) não converte case, então
  // actorsByRiskLevel[profile.riskLevel]++ em getOverview vira NaN silencioso pro contador —
  // campo DIFERENTE (risk_level, não severity/priority), fora do escopo deste pacote.
  await pool.query(
    `INSERT INTO trust_profiles (tenant_id, actor_id, current_score, risk_level) VALUES ($1,$2,75,'low')`,
    [TENANT_ID, actorId]
  );

  const warnLines: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnLines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    originalWarn(...args);
  };

  try {
    const { riskDashboardService } = await import('../modules/risk-command-center/risk-dashboard.service');

    console.log('\n— getOverview: NÃO lança (antes: sempre lançava) —');
    let overview: Awaited<ReturnType<typeof riskDashboardService.getOverview>> | undefined;
    try {
      overview = await riskDashboardService.getOverview(TENANT_ID);
      record('getOverview() completou sem lançar', true);
    } catch (err) {
      record('getOverview() completou sem lançar', false, err instanceof Error ? err.message : String(err));
    }
    if (overview) {
      console.log(`  overview.abandonedAgreements=${overview.abandonedAgreements} openDisputes=${overview.openDisputes} blockedPayouts=${overview.blockedPayouts} failedPayouts=${overview.failedPayouts}`);
      console.log('\n— ANTES (0, afirmando) vs DEPOIS (desconhecido, honesto) —');
      record('ANTES desta fatia: 0 leituras completavam (500 sempre) · DEPOIS: abandonedAgreements === undefined (não 0)', overview.abandonedAgreements === undefined, `valor=${overview.abandonedAgreements}`);
      record('DEPOIS: openDisputes === undefined (não 0)', overview.openDisputes === undefined, `valor=${overview.openDisputes}`);
      record('DEPOIS: blockedPayouts === undefined (não 0)', overview.blockedPayouts === undefined, `valor=${overview.blockedPayouts}`);
      record('DEPOIS: failedPayouts === undefined (não 0)', overview.failedPayouts === undefined, `valor=${overview.failedPayouts}`);
    }

    console.log('\n— listActorRiskProfiles: NÃO lança —');
    let profiles: Awaited<ReturnType<typeof riskDashboardService.listActorRiskProfiles>> | undefined;
    try {
      profiles = await riskDashboardService.listActorRiskProfiles(TENANT_ID, { limit: 100 });
      record('listActorRiskProfiles() completou sem lançar', true, `profiles.length=${profiles.length}`);
    } catch (err) {
      record('listActorRiskProfiles() completou sem lançar', false, err instanceof Error ? err.message : String(err));
    }
    if (profiles && profiles.length > 0) {
      const p = profiles[0];
      console.log(`  profile[0]: abandonedAgreements=${p.abandonedAgreements} blockedPayouts=${p.blockedPayouts} escrowHeldCents=${p.escrowHeldCents}`);
      record('profile.abandonedAgreements === undefined (não 0)', p.abandonedAgreements === undefined, `valor=${p.abandonedAgreements}`);
      record('profile.blockedPayouts === undefined (não 0)', p.blockedPayouts === undefined, `valor=${p.blockedPayouts}`);
    } else {
      record('ao menos 1 profile retornado (seed exercitou o loop per-actor)', false, `profiles=${JSON.stringify(profiles)}`);
    }

    console.log('\n— getActorRiskTimeline: NÃO lança —');
    try {
      const timeline = await riskDashboardService.getActorRiskTimeline(TENANT_ID, actorId);
      record('getActorRiskTimeline() completou sem lançar', true, `timeline.length=${timeline.length}`);
    } catch (err) {
      record('getActorRiskTimeline() completou sem lançar', false, err instanceof Error ? err.message : String(err));
    }

    console.log('\n— o log nomeia a causa nos 3 pontos de captura —');
    record('log nomeia "agreements" (schema-ghost)', warnLines.some((l) => l.includes('[RiskDashboardService]') && l.includes('agreements')), `warnLines=${warnLines.length}`);
    record('log nomeia "evidence_packs" (schema-ghost)', warnLines.some((l) => l.includes('[RiskDashboardService]') && l.includes('evidence_packs')), `warnLines=${warnLines.length}`);
    record('log nomeia "payout_orders" (schema-ghost)', warnLines.some((l) => l.includes('[RiskDashboardService]') && l.includes('payout_orders')), `warnLines=${warnLines.length}`);
  } finally {
    console.warn = originalWarn;
  }

  console.log('\n════════════════════════════════════════════');
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? `✅ RISK-DASHBOARD-SCHEMA-GHOST :: PASS (${results.length}/${results.length})` : `❌ RISK-DASHBOARD-SCHEMA-GHOST :: FAIL (${results.length - failed.length}/${results.length})`);
  console.log('════════════════════════════════════════════');
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
