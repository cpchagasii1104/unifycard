/**
 * E2E — F-PERFORMER-AUDIENCE-RANGE (público-faixa: faixa de tamanho de público preferida/aceita).
 * Prova, POR API DIRETA (camada de serviço/repo REAL — "a verdade vive no backend", nunca via frontend), que a
 * banda declara na PRÓPRIA oferta `apresentacao-musical` a FAIXA de público [audience_min, audience_max] que
 * prefere tocar, e que a DESCOBERTA casa quando um N pedido CAI DENTRO da faixa (min<=N<=max). A faixa é
 * PREFERÊNCIA/CONFORTO (descoberta) — DISTINTA de conditions.audience_capacity (alcance do EQUIPAMENTO/som).
 * PREÇO/cardápio fora. Bank-free (público = contagem de pessoas, nunca dinheiro; Δbank=0). DB efêmera. NUNCA unificard_dev.
 *
 *   (1) publica oferta com faixa [100,2000]; descoberta audienceSize=500 (dentro) ENCONTRA; =50 (abaixo) NÃO;
 *       =5000 (acima) NÃO; nos limites =100 e =2000 ENCONTRA (faixa CONTÉM os extremos).
 *   (2) compõe com a DATA (0156): faixa contém N + DENTRO da janela → aparece; + FORA da janela → não aparece.
 *   (3) validação: min>max → 400; both-or-neither (só um extremo) → 400; ≤0/não-inteiro → 400; canRep → 403.
 *   (4) distinção: a MESMA oferta carrega conditions.audience_capacity (equipamento) E audience_min/max
 *       (preferência) com valores DIFERENTES (capacity=200, faixa=[100,2000]) — eixos independentes, ambos válidos.
 *   (5) Δbank=0 em todos os caminhos.
 */

import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { professionalC1Service } from '../core/profile/professional-c1/professional-c1.service';
import { servicesService } from '../modules/services/services.service';
import { servicesRepository } from '../modules/services/services.repository';
import { serviceOfferingService } from '../modules/services/service-offering.service';
import { ServiceType, ServiceStatus } from '../modules/services/services.types';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/audience|range|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 61).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `audience-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId };
}

async function resolveServiceConcept(slug: string): Promise<{ conceptId: string; canonicalId: string }> {
  const r = (await pool.query<{ concept_id: string; canonical_id: string }>(
    `SELECT c.concept_id::text AS concept_id, cs.id::text AS canonical_id
       FROM concepts c
       JOIN canonical_services cs ON cs.concept_id = c.concept_id AND cs.tenant_id IS NULL AND cs.scope='global' AND cs.status='active'
      WHERE c.slug = $1`,
    [slug]
  )).rows[0];
  if (!r) throw new Error(`concept de serviço governado ausente: ${slug}`);
  return { conceptId: r.concept_id, canonicalId: r.canonical_id };
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Audience Range E2E', slug: `audience-${Date.now()}` });
  const CITY = randomUUID();
  const band = await mkUserActor(TENANT, 'Banda Faixa-Público');

  const bankSnap = async (): Promise<string> =>
    (await pool.query<{ n: string }>(`SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`)).rows[0].n;
  const bankBefore = await bankSnap();

  console.log('\n— faixa de público preferida + descoberta por tamanho e data (público-faixa) —');

  const musical = await resolveServiceConcept('apresentacao-musical');
  const CONCEPT = musical.conceptId, CANONICAL = musical.canonicalId;

  // Publica oferta ATIVA com faixa [100,2000] E conditions.audience_capacity=200 (equipamento) — eixos distintos.
  await professionalC1Service.declareConcept(TENANT, band.actorId, { conceptId: CONCEPT, skillLevel: 3 }, band.userId);
  const service = await servicesService.createService(TENANT, band.userId, {
    actorId: band.actorId, name: 'Show ao vivo — Banda Faixa-Público', serviceType: ServiceType.SERVICE,
    status: ServiceStatus.ACTIVE, canonicalServiceId: CANONICAL, cityId: CITY,
  });
  const { offering } = await serviceOfferingService.createOffering({
    tenantId: TENANT, userId: band.userId, providerActorId: band.actorId,
    canonicalServiceId: CANONICAL, priceCents: 250000, durationMinutes: 90,
    conditions: { audience_capacity: 200 }, // EQUIPAMENTO: som atende até 200
    audienceMin: 100, audienceMax: 2000,    // PREFERÊNCIA: prefere tocar p/ 100..2000
  });
  await serviceOfferingService.updateOwnOffering({ tenantId: TENANT, userId: band.userId, offeringId: offering.id, status: 'active' });
  const start = new Date(Date.now() + 7 * 24 * 3600e3);
  const end = new Date(Date.now() + 7 * 24 * 3600e3 + 2 * 3600e3);
  await serviceOfferingService.declareAvailability({ tenantId: TENANT, userId: band.userId, offeringId: offering.id, startDatetime: start.toISOString(), endDatetime: end.toISOString() });

  const hasSvc = (arr: Array<{ serviceId: string }>): boolean => arr.some((s) => s.serviceId === service.serviceId);
  const disc = (audienceSize: number): Promise<Array<{ serviceId: string }>> =>
    servicesRepository.discoverServices(TENANT, { conceptId: CONCEPT, cityId: CITY, audienceSize });

  // (1) faixa CONTÉM N: 500 dentro ✓; 50 abaixo ✗; 5000 acima ✗; limites 100 e 2000 ✓.
  const inMid = hasSvc(await disc(500));
  const below = hasSvc(await disc(50));
  const above = hasSvc(await disc(5000));
  const loEdge = hasSvc(await disc(100));
  const hiEdge = hasSvc(await disc(2000));
  record('(1) faixa [100,2000] CONTÉM N: 500 ENCONTRA · 50 NÃO · 5000 NÃO · limites 100 e 2000 ENCONTRAM',
    inMid && !below && !above && loEdge && hiEdge, `mid=${inMid} below=${below} above=${above} loEdge=${loEdge} hiEdge=${hiEdge}`);

  // (2) composição com a DATA (0156): faixa contém N=500 + DENTRO da janela → aparece; + FORA → não.
  const svcRef = { serviceId: service.serviceId, actorId: band.actorId, canonicalServiceId: CANONICAL };
  const inW = { windowStart: new Date(Date.now() + 6 * 24 * 3600e3), windowEnd: new Date(Date.now() + 8 * 24 * 3600e3) };
  const outW = { windowStart: new Date(Date.now() + 30 * 24 * 3600e3), windowEnd: new Date(Date.now() + 31 * 24 * 3600e3) };
  const inRangeInWindow = inMid && await servicesRepository.hasCanonicalOfferingFutureAvailability(TENANT, svcRef, inW);
  const inRangeOutWindow = inMid && await servicesRepository.hasCanonicalOfferingFutureAvailability(TENANT, svcRef, outW);
  record('(2) faixa contém N + DENTRO da janela → aparece; + FORA → não aparece (0156 reusado, composição)',
    inRangeInWindow === true && inRangeOutWindow === false, `in=${inRangeInWindow} out=${inRangeOutWindow}`);

  // (3) validação (assertAudienceRange fire ANTES da idempotência/criação de service — validate-before-mutate).
  const tryCreate = async (audienceMin: number | null, audienceMax: number | null, userId = band.userId, actorId = band.actorId): Promise<string> => {
    try {
      await serviceOfferingService.createOffering({
        tenantId: TENANT, userId, providerActorId: actorId,
        canonicalServiceId: CANONICAL, priceCents: 250000, durationMinutes: 90,
        audienceMin, audienceMax,
      });
      return 'NO_THROW';
    } catch (e: any) { return e?.code || 'THROW'; }
  };
  const cMinGtMax = await tryCreate(2000, 100);      // min>max
  const cOnlyMin = await tryCreate(100, null);       // both-or-neither (só min)
  const cOnlyMax = await tryCreate(null, 2000);      // both-or-neither (só max)
  const cZero = await tryCreate(0, 100);             // ≤0
  const cFloat = await tryCreate(1.5, 100);          // não-inteiro
  const stranger = await mkUserActor(TENANT, 'Estranho');
  const cAuth = await tryCreate(100, 2000, stranger.userId, band.actorId); // não representa o provider
  record('(3) validação: min>max→400 · só-um-extremo→400 (x2) · ≤0→400 · não-inteiro→400 · não-representa→403',
    cMinGtMax === 'SERVICE_OFFERING_AUDIENCE_RANGE_INVALID' &&
    cOnlyMin === 'SERVICE_OFFERING_AUDIENCE_RANGE_INCOMPLETE' &&
    cOnlyMax === 'SERVICE_OFFERING_AUDIENCE_RANGE_INCOMPLETE' &&
    cZero === 'SERVICE_OFFERING_AUDIENCE_MIN_INVALID' &&
    cFloat === 'SERVICE_OFFERING_AUDIENCE_MIN_INVALID' &&
    cAuth === 'SERVICE_OFFERING_NOT_REPRESENTABLE',
    `minGtMax=${cMinGtMax} onlyMin=${cOnlyMin} onlyMax=${cOnlyMax} zero=${cZero} float=${cFloat} auth=${cAuth}`);

  // (4) DISTINÇÃO: a mesma oferta carrega audience_capacity (equipamento) E audience_min/max (preferência),
  //     com valores DIFERENTES — eixos independentes. Lê o estado REAL persistido.
  const row = (await pool.query<{ cap: number | null; amin: number | null; amax: number | null }>(
    `SELECT (conditions->>'audience_capacity')::int AS cap, audience_min AS amin, audience_max AS amax
       FROM service_offerings WHERE id = $1::uuid`,
    [offering.id]
  )).rows[0];
  const reread = await serviceOfferingService.findById(TENANT, offering.id);
  const capDistinct = row.cap !== row.amax; // eixos independentes: capacidade do equipamento ≠ topo da faixa
  record('(4) distinção: audience_capacity=200 (equipamento) E faixa=[100,2000] (preferência) coexistem, valores diferentes',
    row.cap === 200 && row.amin === 100 && row.amax === 2000 && capDistinct &&
    reread?.audienceMin === 100 && reread?.audienceMax === 2000,
    `cap=${row.cap} amin=${row.amin} amax=${row.amax} (capacity≠audience_max: ${capDistinct})`);

  // (5) Δbank=0.
  const bankAfter = await bankSnap();
  record('(5) Bank-free: Δbank=0 (bank_ledger:bank_transactions inalterado)', bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  if (failed.length > 0) { console.error('❌ FALHAS:'); for (const f of failed) console.error(`   - ${f.label}${f.reason ? ` (${f.reason})` : ''}`); }
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.stack ?? e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
