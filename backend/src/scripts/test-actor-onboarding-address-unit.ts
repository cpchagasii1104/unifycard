// src/scripts/test-actor-onboarding-address-unit.ts
// F-ADDRESS-ONBOARDING-CANONICAL-FLOW (RFC A1-D) — testes unitários do application service.
// SEM rede/DB: canRepresentActor, resolver B, writer C e o PF-gate são INJETADOS. Prova ordem,
// argumentos, autoridade, re-resolução, cross-check, bairro, idempotência e mapeamento de erro.
// Uso: pnpm tsx src/scripts/test-actor-onboarding-address-unit.ts

import {
  ActorTerritorialAddressOnboardingService,
  TerritorialOnboardingError,
  type OnboardingAuthContext,
} from '../core/location/actor-territorial-address-onboarding.service';
import {
  ActorTerritorialAuthorityError,
  ActorTerritorialConflictError,
} from '../core/location/actor-territorial-address-writer.service';
import type { SetTerritorialAddressCommand } from '@unificard/contracts';

let passed = 0, failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failures++; console.error(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}
async function expectError(name: string, code: string, fn: () => Promise<unknown>) {
  try { await fn(); check(name, false, 'não lançou'); }
  catch (e) {
    const c = e instanceof TerritorialOnboardingError ? e.code : (e instanceof Error ? e.message : String(e));
    check(name, c === code, `esperado ${code}, obtido ${c}`);
  }
}

const AUTH: OnboardingAuthContext = {
  tenantId: 'tenant-1', operatorUserId: 'user-1', routeActorId: 'actor-1', actionContextActorId: 'actor-1',
};
const CWB = {
  status: 'resolved' as const, countryId: 'c-br', stateId: 's-pr', cityId: 'city-cwb',
  neighborhoodId: null as string | null, neighborhoodCandidateId: null as string | null,
  neighborhoodStatus: 'not_applicable' as const, postalCodeNormalized: '80010100',
  street: 'Rua XV', cityDisplayText: 'Curitiba', stateDisplayText: 'PR', neighborhoodDisplayText: null,
  providerEvidence: [], requiresUserConfirmation: true as const,
};
const CMD: SetTerritorialAddressCommand = {
  purpose: 'ACTOR_RESIDENCE', countryCode: 'BR', postalCode: '80010-100', street: 'Rua XV',
  number: '100', complement: 'ap 2', confirmedCityId: 'city-cwb', idempotencyKey: 'idem-1',
};

function makeSvc(over: Partial<{
  authz: boolean | (() => Promise<boolean>);
  pf: boolean;
  resolve: any;
  write: any;
  writeCalls: any[];
}> = {}) {
  const writeCalls = over.writeCalls ?? [];
  const svc = new ActorTerritorialAddressOnboardingService({
    canRepresentActor: async () => {
      if (typeof over.authz === 'function') return over.authz();
      return over.authz ?? true;
    },
    isActorPf: async () => over.pf ?? true,
    resolvePostal: over.resolve ?? (async () => CWB),
    writeActorTerritorialAddress: over.write ?? (async (_auth: any, input: any) => {
      writeCalls.push(input);
      return { operation: 'set', actorId: input.actorId, role: 'RESIDENCE', assignmentId: 'asg-1', addressId: 'addr-1', previousAssignmentId: null, replayed: false };
    }),
  });
  return { svc, writeCalls };
}

async function main() {
  console.log('▶ autoridade / elegibilidade');
  {
    const { svc, writeCalls } = makeSvc();
    const r = await svc.setResidenceAddress(AUTH, CMD);
    check('PF autorizado → set + writer chamado 1x', r.outcome === 'set' && writeCalls.length === 1);
    check('resposta projeta role RESIDENCE + purpose', r.role === 'RESIDENCE' && r.purpose === 'ACTOR_RESIDENCE');

    const { svc: denied } = makeSvc({ authz: false });
    await expectError('deny legítimo → authority_denied', 'authority_denied', () => denied.setResidenceAddress(AUTH, CMD));

    const { svc: infra } = makeSvc({ authz: async () => { throw new Error('DB down'); } });
    await expectError('infra-error propaga (não vira authority_denied)', 'DB down', () => infra.setResidenceAddress(AUTH, CMD));

    const { svc: pj, writeCalls: wc } = makeSvc({ pf: false });
    await expectError('Actor PJ rejeitado → actor_not_eligible', 'actor_not_eligible', () => pj.setResidenceAddress(AUTH, CMD));
    check('PJ não chama writer', wc.length === 0);

    const { svc: mm } = makeSvc();
    await expectError('actor rota × action-context divergente → authority_denied', 'authority_denied',
      () => mm.setResidenceAddress({ ...AUTH, actionContextActorId: 'outro' }, CMD));

    const { svc: badPurpose } = makeSvc();
    await expectError('purpose fora do MVP → actor_not_eligible', 'actor_not_eligible',
      () => badPurpose.setResidenceAddress(AUTH, { ...CMD, purpose: 'ACTOR_FISCAL_HQ' as any }));
  }

  console.log('▶ re-resolução e cross-check');
  {
    for (const st of ['country_required', 'country_not_supported', 'postal_code_invalid', 'provider_unavailable', 'provider_not_found', 'canonical_city_missing', 'canonical_city_ambiguous', 'territorial_inconsistency', 'official_identifier_missing']) {
      const { svc, writeCalls } = makeSvc({ resolve: async () => ({ status: st, providerEvidence: [] }) });
      await expectError(`resolver ${st} → mesmo código, sem writer`, st, () => svc.setResidenceAddress(AUTH, CMD));
      check(`${st} não chama writer`, writeCalls.length === 0);
    }
    const { svc: conflictSvc } = makeSvc({ resolve: async () => ({ status: 'malformed_provider_response', providerEvidence: [] }) });
    await expectError('malformed → provider_conflict público', 'provider_conflict', () => conflictSvc.setResidenceAddress(AUTH, CMD));

    const { svc: mismatch, writeCalls } = makeSvc({ resolve: async () => ({ ...CWB, cityId: 'city-OUTRA' }) });
    await expectError('confirmedCityId ≠ re-resolvido → territorial_confirmation_mismatch', 'territorial_confirmation_mismatch',
      () => mismatch.setResidenceAddress(AUTH, CMD));
    check('mismatch NÃO chama writer', writeCalls.length === 0);

    // cityId do writer vem da RE-RESOLUÇÃO (não do cliente): cliente manda X, resolver diz X, writer recebe X.
    const { svc: authoritative, writeCalls: wc2 } = makeSvc();
    await authoritative.setResidenceAddress(AUTH, CMD);
    check('writer recebe cityId da re-resolução', wc2[0].address.cityId === 'city-cwb');
    check('writer recebe stateId/countryId da re-resolução', wc2[0].address.stateId === 's-pr' && wc2[0].address.countryId === 'c-br');
  }

  console.log('▶ bairro');
  {
    // resolved: writer recebe o neighborhoodId; cliente confirma o mesmo.
    const resolvedNb = { ...CWB, neighborhoodId: 'nb-1', neighborhoodStatus: 'resolved' as const };
    const { svc, writeCalls } = makeSvc({ resolve: async () => resolvedNb });
    await svc.setResidenceAddress(AUTH, { ...CMD, confirmedNeighborhoodId: 'nb-1' });
    check('bairro resolved → writer recebe neighborhoodId', writeCalls[0].address.neighborhoodId === 'nb-1');

    const { svc: mm } = makeSvc({ resolve: async () => resolvedNb });
    await expectError('bairro resolved com id divergente → mismatch', 'territorial_confirmation_mismatch',
      () => mm.setResidenceAddress(AUTH, { ...CMD, confirmedNeighborhoodId: 'nb-OUTRO' }));

    // candidate: cliente NÃO pode impor id; writer recebe null.
    const candidate = { ...CWB, neighborhoodId: null, neighborhoodCandidateId: 'cand-1', neighborhoodStatus: 'candidate_requires_confirmation' as const };
    const { svc: candSvc, writeCalls: wc } = makeSvc({ resolve: async () => candidate });
    await candSvc.setResidenceAddress(AUTH, CMD);
    check('candidate → writer recebe neighborhoodId null', wc[0].address.neighborhoodId === null);
    const { svc: candBad } = makeSvc({ resolve: async () => candidate });
    await expectError('candidate com confirmedNeighborhoodId → mismatch', 'territorial_confirmation_mismatch',
      () => candBad.setResidenceAddress(AUTH, { ...CMD, confirmedNeighborhoodId: 'cand-1' }));

    // pending → null.
    const pending = { ...CWB, neighborhoodStatus: 'pending' as const, neighborhoodDisplayText: 'Centro' };
    const { svc: pendSvc, writeCalls: wc2 } = makeSvc({ resolve: async () => pending });
    await pendSvc.setResidenceAddress(AUTH, CMD);
    check('pending → writer recebe neighborhoodId null', wc2[0].address.neighborhoodId === null);
  }

  console.log('▶ payload físico');
  {
    const { svc } = makeSvc();
    await expectError('número ausente → invalid_address_payload', 'invalid_address_payload',
      () => svc.setResidenceAddress(AUTH, { ...CMD, number: '   ' }));
    await expectError('idempotencyKey vazia → invalid_address_payload', 'invalid_address_payload',
      () => svc.setResidenceAddress(AUTH, { ...CMD, idempotencyKey: '' }));

    // sanitização: XSS/controle removidos; comprimento limitado.
    const { svc: sani, writeCalls } = makeSvc();
    await sani.setResidenceAddress(AUTH, { ...CMD, street: 'Rua <script>alert(1)</script> XV', number: '100' });
    check('street sanitizada (sem <script>)', !String(writeCalls[0].address.street).includes('<'));
    const { svc: longSvc, writeCalls: wc } = makeSvc();
    await longSvc.setResidenceAddress(AUTH, { ...CMD, street: 'R'.repeat(500) });
    check('street truncada (≤160)', String(wc[0].address.street).length <= 160);
  }

  console.log('▶ idempotência (mapeamento de erro do writer)');
  {
    const { svc: replaySvc } = makeSvc({
      write: async (_a: any, input: any) => ({ operation: 'set', actorId: input.actorId, role: 'RESIDENCE', assignmentId: 'asg-1', addressId: 'addr-1', previousAssignmentId: null, replayed: true }),
    });
    const r = await replaySvc.setResidenceAddress(AUTH, CMD);
    check('replay idempotente → replayed:true', r.replayed === true);

    const { svc: inProg } = makeSvc({ write: async () => { throw new ActorTerritorialConflictError('ACTOR_TERRITORIAL_IN_PROGRESS'); } });
    await expectError('in-progress → actor_territorial_in_progress', 'actor_territorial_in_progress', () => inProg.setResidenceAddress(AUTH, CMD));

    const { svc: mmc } = makeSvc({ write: async () => { throw new ActorTerritorialConflictError('ACTOR_TERRITORIAL_IDEMPOTENCY_PAYLOAD_MISMATCH'); } });
    await expectError('payload mismatch → idempotency_payload_mismatch', 'idempotency_payload_mismatch', () => mmc.setResidenceAddress(AUTH, CMD));

    const { svc: authErr } = makeSvc({ write: async () => { throw new ActorTerritorialAuthorityError('x'); } });
    await expectError('writer authority error → authority_denied', 'authority_denied', () => authErr.setResidenceAddress(AUTH, CMD));

    const { svc: replaceSvc } = makeSvc({
      write: async (_a: any, input: any) => ({ operation: 'replaced', actorId: input.actorId, role: 'RESIDENCE', assignmentId: 'asg-2', addressId: 'addr-2', previousAssignmentId: 'asg-1', replayed: false }),
    });
    const rep = await replaceSvc.setResidenceAddress(AUTH, CMD);
    check('replace → outcome replaced', rep.outcome === 'replaced');

    // writer chamado com auth server-side (tenant/operator) e actorId da rota.
    const { svc, writeCalls } = makeSvc();
    // provamos o auth pelo actorId no input; o auth (tenant/operator) é passado ao writer, não ao input.
    await svc.setResidenceAddress(AUTH, CMD);
    check('writer recebe actorId da rota + purpose', writeCalls[0].actorId === 'actor-1' && writeCalls[0].purpose === 'ACTOR_RESIDENCE');
    check('writer recebe idempotencyKey do cliente', writeCalls[0].idempotencyKey === 'idem-1');
  }

  console.log(`\n${failures === 0 ? '✅' : '❌'} test-actor-onboarding-address-unit — ${passed} passed, ${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('crash:', e); process.exit(1); });
