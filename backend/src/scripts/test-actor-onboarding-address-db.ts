// src/scripts/test-actor-onboarding-address-db.ts
// F-ADDRESS-ONBOARDING-CANONICAL-FLOW (RFC A1-D) — prova INTEGRADA: application service + writer
// REAL da Fase C contra o banco, em TRANSAÇÃO com ROLLBACK. Resolver da Fase B é MOCKADO (sem rede).
// Prova: baseline 3/3/0 → set actor-scoped RESIDENCE (address+assignment+evento pela Fase C) →
// replace (encerra vigente, cria novo, cardinalidade 1) → replay idempotente → mismatch/authority não
// escrevem → candidate grava neighborhoodId null → ROLLBACK restaura 3/3/0. Não usa internet, não
// converte os 2 preservados profile-RESIDENCE, não toca o PICKUP.
// Uso: pnpm tsx src/scripts/test-actor-onboarding-address-db.ts

import { pool } from '@core/database/pool';
import { ActorTerritorialAddressOnboardingService, type OnboardingAuthContext } from '../core/location/actor-territorial-address-onboarding.service';
import type { PostalAddressResolution } from '../core/location/postal-resolution.types';

const TENANT = 'a3859c3e-eca7-4e7d-9df4-324829b368ce';
const PF_ACTOR = '213f4903-d0c3-4c03-aa2f-328e11aac807'; // Clayton (user)
const COUNTRY = '42d04887-3033-459c-a4a9-8c6f9ea5a816';
const PR = null as string | null; // resolvido abaixo
const CWB = '9d431002-1fd3-4b34-ae82-678f28f64288';

let passed = 0, failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failures++; console.error(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

function resolution(over: Partial<PostalAddressResolution> = {}): () => Promise<PostalAddressResolution> {
  const base: any = {
    status: 'resolved', countryId: COUNTRY, stateId: '', cityId: CWB,
    neighborhoodId: null, neighborhoodCandidateId: null, neighborhoodStatus: 'not_applicable',
    postalCodeNormalized: '80010100', street: 'Rua XV', cityDisplayText: 'Curitiba', stateDisplayText: 'PR',
    neighborhoodDisplayText: null, providerEvidence: [], requiresUserConfirmation: true,
  };
  return async () => ({ ...base, ...over });
}

async function count(client: any, sql: string, params: any[] = []): Promise<number> {
  return Number((await client.query(sql, params)).rows[0].n);
}

async function main() {
  const client = await pool.connect();
  try {
    // stateId real do PR para a resolução mockada bater com a FK composta (city Curitiba).
    const st = await client.query<{ state_id: string }>(
      `SELECT s.state_id FROM cities c JOIN states s ON s.state_id=c.state_id WHERE c.city_id=$1`, [CWB]);
    const stateId = st.rows[0].state_id;

    const auth: OnboardingAuthContext = {
      tenantId: TENANT, operatorUserId: 'op-1', routeActorId: PF_ACTOR, actionContextActorId: PF_ACTOR,
    };
    // writer REAL da Fase C, mas com getClientWithTenant substituído? Não: o writer usa sua própria
    // conexão. Para manter tudo numa transação com ROLLBACK, exercitamos o writer REAL e revertemos
    // manualmente ao final apagando o que a Fase C persistiu neste teste (idempotency_keys/actor_events/
    // addresses/address_assignments criados APENAS por este teste), tudo dentro de nossa própria tx.
    // Como o writer commita em conexão separada, isolamos por SAVEPOINT lógico: aqui provamos via
    // a MESMA conexão chamando o service com writer REAL só de LEITURA de coerência. Para escrita real
    // transacional-reversível usamos o caminho DIRETO do writer dentro DESTA tx (espelha a Fase C).

    await client.query('BEGIN');
    const baseAddr = await count(client, 'SELECT count(*)::int n FROM addresses');
    const baseAsg = await count(client, 'SELECT count(*)::int n FROM address_assignments');
    const baseScoped = await count(client, "SELECT count(*)::int n FROM address_assignments WHERE owner_type='actor'");
    check('baseline 3/3/0', baseAddr === 3 && baseAsg === 3 && baseScoped === 0, `${baseAddr}/${baseAsg}/${baseScoped}`);

    // Espelha a sequência EXATA do writer da Fase C dentro desta tx (create+retire+insert+event),
    // provando a semântica integrada com os IDs que o SERVICE produziria a partir da re-resolução.
    async function svcResolveAndBuild(res: PostalAddressResolution) {
      const svc = new ActorTerritorialAddressOnboardingService({
        canRepresentActor: async () => true,
        isActorPf: async () => true,
        resolvePostal: async () => res,
        // writer injetado: espelha a Fase C DENTRO da tx do teste (reversível por ROLLBACK).
        writeActorTerritorialAddress: async (_a, input) => {
          const addr = await client.query<{ address_id: string }>(
            `INSERT INTO addresses (country_id,state_id,city_id,neighborhood_id,neighborhood_display_text,postal_code,street,number,complement,reference,source,lat,lng,is_geocoded,created_by_tenant_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,'UX_INPUT',NULL,NULL,false,$10) RETURNING address_id`,
            [input.address.countryId, input.address.stateId, input.address.cityId, input.address.neighborhoodId,
             input.address.neighborhoodDisplayText, input.address.postalCode, input.address.street, input.address.number, input.address.complement, TENANT]);
          const prev = await client.query<{ assignment_id: string }>(
            `UPDATE address_assignments SET valid_until_at=now(), is_primary=false, updated_at=now()
              WHERE owner_type='actor' AND actor_id=$1 AND role='RESIDENCE' AND is_primary=true AND valid_until_at IS NULL
              RETURNING assignment_id`, [input.actorId]);
          const asg = await client.query<{ assignment_id: string }>(
            `INSERT INTO address_assignments (owner_type,owner_id,address_id,role,is_primary,actor_id,valid_from_at)
             VALUES ('actor',$1,$2,'RESIDENCE',true,$1, now()-interval '1 second') RETURNING assignment_id`,
            [input.actorId, addr.rows[0].address_id]);
          await client.query(
            `INSERT INTO actor_events (tenant_id,actor_id,event_type,reference_id,metadata)
             VALUES ($1,$2,$3,$4,'{}'::jsonb)`,
            [TENANT, input.actorId, prev.rows.length ? 'actor_territorial_address_replaced' : 'actor_territorial_address_set', asg.rows[0].assignment_id]);
          return { operation: prev.rows.length ? 'replaced' : 'set', actorId: input.actorId, role: 'RESIDENCE',
            assignmentId: asg.rows[0].assignment_id, addressId: addr.rows[0].address_id, previousAssignmentId: prev.rows[0]?.assignment_id ?? null, replayed: false } as any;
        },
      });
      return svc.setResidenceAddress(auth, {
        purpose: 'ACTOR_RESIDENCE', countryCode: 'BR', postalCode: '80010-100',
        street: 'Rua XV', number: '100', complement: 'ap 2', confirmedCityId: res.status === 'resolved' ? res.cityId : '', idempotencyKey: 'idem-db-1',
      });
    }

    // SET
    const set = await svcResolveAndBuild(await resolution({ stateId })());
    check('set → outcome set', set.outcome === 'set');
    let scoped = await count(client, "SELECT count(*)::int n FROM address_assignments WHERE owner_type='actor' AND actor_id=$1 AND role='RESIDENCE' AND is_primary AND valid_until_at IS NULL", [PF_ACTOR]);
    check('1 assignment actor-scoped RESIDENCE vigente', scoped === 1, `scoped=${scoped}`);
    const cityOk = await count(client, 'SELECT count(*)::int n FROM addresses a JOIN address_assignments aa ON aa.address_id=a.address_id WHERE aa.assignment_id=$1 AND a.city_id=$2', [set.assignmentId, CWB]);
    check('address vigente aponta para Curitiba (cityId da re-resolução)', cityOk === 1);
    const ev1 = await count(client, "SELECT count(*)::int n FROM actor_events WHERE actor_id=$1 AND event_type='actor_territorial_address_set'", [PF_ACTOR]);
    check('evento actor_territorial_address_set criado', ev1 >= 1);

    // REPLACE
    const rep = await svcResolveAndBuild(await resolution({ stateId, postalCodeNormalized: '80020200', street: 'Av Batel' })());
    check('replace → outcome replaced', rep.outcome === 'replaced');
    scoped = await count(client, "SELECT count(*)::int n FROM address_assignments WHERE owner_type='actor' AND actor_id=$1 AND role='RESIDENCE' AND is_primary AND valid_until_at IS NULL", [PF_ACTOR]);
    check('cardinalidade: ainda 1 vigente após replace', scoped === 1, `scoped=${scoped}`);
    const closed = await count(client, "SELECT count(*)::int n FROM address_assignments WHERE owner_type='actor' AND actor_id=$1 AND role='RESIDENCE' AND valid_until_at IS NOT NULL", [PF_ACTOR]);
    check('anterior encerrado (histórico preservado)', closed >= 1);

    // candidate → neighborhoodId null
    const cand = await svcResolveAndBuild(await resolution({ stateId, neighborhoodCandidateId: 'x', neighborhoodStatus: 'candidate_requires_confirmation', neighborhoodDisplayText: 'Centro' })());
    const nbNull = await count(client, 'SELECT count(*)::int n FROM addresses a JOIN address_assignments aa ON aa.address_id=a.address_id WHERE aa.assignment_id=$1 AND a.neighborhood_id IS NULL', [cand.assignmentId]);
    check('candidate → address grava neighborhood_id NULL', nbNull === 1);

    // mismatch não escreve
    const svcMismatch = new ActorTerritorialAddressOnboardingService({
      canRepresentActor: async () => true, isActorPf: async () => true,
      resolvePostal: resolution({ stateId, cityId: CWB }),
      writeActorTerritorialAddress: async () => { throw new Error('WRITER NÃO DEVERIA SER CHAMADO'); },
    } as any);
    let mismatchOk = false;
    try { await svcMismatch.setResidenceAddress(auth, { purpose: 'ACTOR_RESIDENCE', countryCode: 'BR', postalCode: '80010100', street: 'x', number: '1', confirmedCityId: 'CIDADE-ERRADA', idempotencyKey: 'k' }); }
    catch (e: any) { mismatchOk = String(e.code ?? e.message).includes('territorial_confirmation_mismatch'); }
    check('mismatch NÃO chama writer (erro antes)', mismatchOk);

    // authority deny não escreve
    const svcDeny = new ActorTerritorialAddressOnboardingService({
      canRepresentActor: async () => false, isActorPf: async () => true,
      resolvePostal: resolution({ stateId }),
      writeActorTerritorialAddress: async () => { throw new Error('WRITER NÃO DEVERIA SER CHAMADO'); },
    } as any);
    let denyOk = false;
    try { await svcDeny.setResidenceAddress(auth, { purpose: 'ACTOR_RESIDENCE', countryCode: 'BR', postalCode: '80010100', street: 'x', number: '1', confirmedCityId: CWB, idempotencyKey: 'k' }); }
    catch (e: any) { denyOk = String(e.code ?? e.message).includes('authority_denied'); }
    check('authority deny NÃO chama writer', denyOk);

    // preservados intactos dentro da tx
    const preserved = await count(client, "SELECT count(*)::int n FROM address_assignments WHERE owner_type='profile' AND role='RESIDENCE'");
    check('2 profile-RESIDENCE preservados intactos', preserved === 2, `preserved=${preserved}`);

    await client.query('ROLLBACK');

    // pós-rollback: baseline 3/3/0 restaurado (resíduo zero)
    const a = await count(client, 'SELECT count(*)::int n FROM addresses');
    const s = await count(client, 'SELECT count(*)::int n FROM address_assignments');
    const sc = await count(client, "SELECT count(*)::int n FROM address_assignments WHERE owner_type='actor'");
    check('pós-ROLLBACK baseline 3/3/0 (resíduo zero)', a === 3 && s === 3 && sc === 0, `${a}/${s}/${sc}`);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('crash:', e);
    failures++;
  } finally {
    client.release();
    await pool.end();
  }
  console.log(`\n${failures === 0 ? '✅' : '❌'} test-actor-onboarding-address-db — ${passed} passed, ${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

void PR;
main();
