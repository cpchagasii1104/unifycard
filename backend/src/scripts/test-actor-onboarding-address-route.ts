// src/scripts/test-actor-onboarding-address-route.ts
// F-ADDRESS-ONBOARDING-CANONICAL-FLOW (RFC A1-D) — testes de ROTA (fastify.inject) das camadas de
// gate/autoridade/validação e da leitura read-only. Monkey-patch de canRepresentActor; nenhum write
// (os caminhos de sucesso de escrita são provados no unit + prova DB). Uso:
//   pnpm tsx src/scripts/test-actor-onboarding-address-route.ts

import Fastify from 'fastify';
import { authorizationService } from '@core/authorization/authorization.service';
import actorTerritorialAddressRoutes from '../core/location/actor-territorial-address.routes';

const TENANT = 'a3859c3e-eca7-4e7d-9df4-324829b368ce';
const PF_ACTOR = '213f4903-d0c3-4c03-aa2f-328e11aac807';
const CWB = '9d431002-1fd3-4b34-ae82-678f28f64288';

let passed = 0, failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failures++; console.error(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

async function buildApp(ctx: { user?: any; tenant?: any; actionActorId?: string | null }) {
  const app = Fastify();
  app.addHook('preHandler', async (req: any) => {
    req.user = ctx.user;
    req.tenant = ctx.tenant;
    if (ctx.actionActorId !== null && ctx.actionActorId !== undefined) {
      req.actionContext = { actorId: ctx.actionActorId, intent: 'x', source: 'x', scope: `t:${TENANT}` };
    }
  });
  await app.register(actorTerritorialAddressRoutes, { prefix: '/actors' });
  return app;
}

const validBody = {
  purpose: 'ACTOR_RESIDENCE', countryCode: 'BR', postalCode: '80010-100', street: 'Rua XV',
  number: '100', complement: null, confirmedCityId: CWB, idempotencyKey: 'idem-route-1',
};

async function main() {
  const origCanRep = authorizationService.canRepresentActor.bind(authorizationService);

  console.log('▶ POST gates');
  {
    let app = await buildApp({ user: null, tenant: { id: TENANT }, actionActorId: PF_ACTOR });
    let r = await app.inject({ method: 'POST', url: `/actors/${PF_ACTOR}/territorial-address`, payload: validBody });
    check('POST sem user → 401', r.statusCode === 401);
    await app.close();

    app = await buildApp({ user: { userId: 'u1' }, tenant: { id: TENANT }, actionActorId: null });
    r = await app.inject({ method: 'POST', url: `/actors/${PF_ACTOR}/territorial-address`, payload: validBody });
    check('POST sem action-context → 400', r.statusCode === 400);
    await app.close();

    app = await buildApp({ user: { userId: 'u1' }, tenant: { id: TENANT }, actionActorId: PF_ACTOR });
    r = await app.inject({ method: 'POST', url: `/actors/${PF_ACTOR}/territorial-address`, payload: { ...validBody, number: undefined } });
    check('POST body inválido (sem número) → 400 invalid_address_payload', r.statusCode === 400 && r.json().error === 'invalid_address_payload');
    await app.close();

    app = await buildApp({ user: { userId: 'u1' }, tenant: { id: TENANT }, actionActorId: 'OUTRO-ACTOR' });
    r = await app.inject({ method: 'POST', url: `/actors/${PF_ACTOR}/territorial-address`, payload: validBody });
    check('POST coerência rota×action-context divergente → 403', r.statusCode === 403 && r.json().error === 'authority_denied');
    await app.close();

    (authorizationService as any).canRepresentActor = async () => false;
    app = await buildApp({ user: { userId: 'u1' }, tenant: { id: TENANT }, actionActorId: PF_ACTOR });
    r = await app.inject({ method: 'POST', url: `/actors/${PF_ACTOR}/territorial-address`, payload: validBody });
    check('POST canRepresentActor=false → 403', r.statusCode === 403 && r.json().error === 'authority_denied');
    await app.close();

    (authorizationService as any).canRepresentActor = async () => { throw new Error('infra down'); };
    app = await buildApp({ user: { userId: 'u1' }, tenant: { id: TENANT }, actionActorId: PF_ACTOR });
    r = await app.inject({ method: 'POST', url: `/actors/${PF_ACTOR}/territorial-address`, payload: validBody });
    check('POST infra-error na autoridade → 500 (não 403)', r.statusCode === 500 && r.json().error === 'unexpected_error');
    await app.close();
  }

  console.log('▶ GET gates + leitura read-only');
  {
    (authorizationService as any).canRepresentActor = async () => false;
    let app = await buildApp({ user: { userId: 'u1' }, tenant: { id: TENANT }, actionActorId: PF_ACTOR });
    let r = await app.inject({ method: 'GET', url: `/actors/${PF_ACTOR}/territorial-address?purpose=ACTOR_RESIDENCE` });
    check('GET canRepresentActor=false → 403', r.statusCode === 403);
    await app.close();

    app = await buildApp({ user: { userId: 'u1' }, tenant: { id: TENANT }, actionActorId: PF_ACTOR });
    r = await app.inject({ method: 'GET', url: `/actors/${PF_ACTOR}/territorial-address?purpose=ACTOR_FISCAL_HQ` });
    check('GET purpose fora do MVP → 400', r.statusCode === 400);
    await app.close();

    // autoridade OK + actor-scoped=0 (baseline) → 'none' (read-only, sem write).
    (authorizationService as any).canRepresentActor = async () => true;
    app = await buildApp({ user: { userId: 'u1' }, tenant: { id: TENANT }, actionActorId: PF_ACTOR });
    r = await app.inject({ method: 'GET', url: `/actors/${PF_ACTOR}/territorial-address?purpose=ACTOR_RESIDENCE` });
    check('GET autorizado, sem actor-scoped → 200 state=none', r.statusCode === 200 && r.json().state === 'none');
    await app.close();
  }

  (authorizationService as any).canRepresentActor = origCanRep;
  console.log(`\n${failures === 0 ? '✅' : '❌'} test-actor-onboarding-address-route — ${passed} passed, ${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('crash:', e); process.exit(1); });
