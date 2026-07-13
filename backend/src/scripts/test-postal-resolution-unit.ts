// src/scripts/test-postal-resolution-unit.ts
// FASE B (RFC B1-D) — testes unitários DETERMINÍSTICOS da resolução postal canônica.
// SEM internet real (fetch stubado para os adapters; adapters de teste para o resolver) e SEM
// banco (repository de evidência fake em memória). Exit code ≠ 0 em qualquer falha.
// Uso: pnpm tsx src/scripts/test-postal-resolution-unit.ts

import {
  ViaCepProvider,
  MockPostalProviderAdapter,
  getPostalProviderChain,
  type PostalProviderAdapter,
  type PostalProviderQueryResult,
} from '../core/location/cep-provider';
import { normalizePostalCodeForCountry } from '../core/location/postal-code-normalizer';
import {
  PostalAddressResolverService,
  detectPostalEvidenceConflict,
} from '../core/location/postal-address-resolver.service';
import type { PostalTerritorialEvidenceRepository } from '../core/location/postal-territorial-evidence.repository';
import type { PostalProviderEvidence } from '../core/location/postal-resolution.types';

let failures = 0;
let passed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failures++; console.error(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

// ── Fixtures canônicas em memória (espelham o catálogo vivo: BR, PR/SP, Curitiba IBGE 4106902) ──
const BR = { id: 'c-br', isoAlpha2: 'BR', name: 'Brasil' };
const PR = { id: 's-pr', abbreviation: 'PR', name: 'Paraná' };
const SP = { id: 's-sp', abbreviation: 'SP', name: 'São Paulo' };
const CWB = { id: 'city-cwb', stateId: 's-pr', name: 'Curitiba', isActive: true, code: '4106902' };
const norm = (s: string) => s.toLowerCase().trim();

class FakeEvidenceRepo {
  cached: any = null;
  storeCalls: any[] = [];
  ambiguousCity = false;
  aliasRows: Array<{ cityId: string; alias: string; id: string; name: string }> = [];
  candidateRows: Array<{ cityId: string; nameNorm: string; id: string; name: string }> = [];

  async findCountryByIsoAlpha2(iso: string) { return iso === 'BR' ? BR : null; }
  async findStateByCountryAndUf(countryId: string, uf: string) {
    if (countryId !== BR.id) return null;
    if (uf === 'PR') return PR;
    if (uf === 'SP') return SP;
    return null;
  }
  async findCitiesByStateAndOfficialCode(stateId: string, code: string) {
    if (this.ambiguousCity && stateId === PR.id && code === CWB.code) {
      return [
        { id: 'dup-1', stateId: PR.id, name: 'Dup 1', isActive: true },
        { id: 'dup-2', stateId: PR.id, name: 'Dup 2', isActive: true },
      ];
    }
    if (stateId === CWB.stateId && code === CWB.code) {
      return [{ id: CWB.id, stateId: CWB.stateId, name: CWB.name, isActive: CWB.isActive }];
    }
    return [];
  }
  async existsCityWithOfficialCodeInCountry(countryId: string, code: string) {
    return countryId === BR.id && code === CWB.code;
  }
  async findNeighborhoodAliasMatchesInCity(cityId: string, rawText: string) {
    return this.aliasRows
      .filter((r) => r.cityId === cityId && r.alias === norm(rawText))
      .map((r) => ({ id: r.id, name: r.name }));
  }
  async findNeighborhoodCandidatesByNameInCity(cityId: string, rawText: string) {
    return this.candidateRows
      .filter((r) => r.cityId === cityId && r.nameNorm === norm(rawText))
      .map((r) => ({ id: r.id, name: r.name }));
  }
  async findCachedResolution(_postal: string) { return this.cached; }
  async storeCachedResolution(input: any) { this.storeCalls.push(input); }
}

function adapter(
  providerId: 'viacep' | 'brasilapi' | 'mock',
  result: PostalProviderQueryResult,
  calls?: string[]
): PostalProviderAdapter {
  return {
    providerId,
    async query(cep: string) { calls?.push(`${providerId}:${cep}`); return result; },
  };
}

const CWB_DATA = {
  stateCode: 'PR', cityName: 'Curitiba', officialCityCode: '4106902',
  neighborhoodText: 'Centro', street: 'Rua XV de Novembro', lat: null, lng: null,
};

function makeResolver(repo: FakeEvidenceRepo, chain: PostalProviderAdapter[]) {
  return new PostalAddressResolverService({
    providerChain: () => chain,
    evidenceRepository: repo as unknown as PostalTerritorialEvidenceRepository,
    now: () => new Date('2026-07-13T12:00:00Z'),
  });
}

async function main() {
  console.log('▶ normalizador por país');
  {
    check('BR com máscara 01001-000 → 01001000', (() => { const r = normalizePostalCodeForCountry('BR', '01001-000'); return r.ok && r.value === '01001000'; })());
    check('BR zeros à esquerda preservados', (() => { const r = normalizePostalCodeForCountry('BR', '01001000'); return r.ok && r.value === '01001000'; })());
    check('BR curto (123) inválido', !normalizePostalCodeForCountry('BR', '123').ok);
    check('BR letras (abcdefgh) inválido', !normalizePostalCodeForCountry('BR', 'abcdefgh').ok);
    check('BR vazio inválido', !normalizePostalCodeForCountry('BR', '').ok);
    check('BR payload excessivo inválido', !normalizePostalCodeForCountry('BR', '0'.repeat(64)).ok);
    check('país sem normalizador (US) inválido', !normalizePostalCodeForCountry('US', '90210').ok);
  }

  console.log('▶ país explícito');
  {
    const repo = new FakeEvidenceRepo();
    const r1 = await makeResolver(repo, []).resolve({ countryCode: '', postalCode: '80010100' });
    check('country ausente → country_required', r1.status === 'country_required');
    const r2 = await makeResolver(repo, []).resolve({ countryCode: 'US', postalCode: '90210' });
    check('country sem catálogo/adapter → country_not_supported', r2.status === 'country_not_supported');
    const r3 = await makeResolver(repo, []).resolve({ countryCode: 'BR', postalCode: '80010-100' });
    check('sem opt-in de provider → provider_unavailable', r3.status === 'provider_unavailable');
    const r4 = await makeResolver(repo, []).resolve({ countryCode: 'BR', postalCode: 'abc' });
    check('CEP inválido → postal_code_invalid', r4.status === 'postal_code_invalid');
  }

  console.log('▶ chain governada (primário/fallback/estados explícitos)');
  {
    const repo = new FakeEvidenceRepo();
    const calls: string[] = [];
    const ok = await makeResolver(repo, [adapter('viacep', { outcome: 'resolved', data: CWB_DATA }, calls)])
      .resolve({ countryCode: 'BR', postalCode: '80010-100' });
    check('primário resolve → resolved com city canônica', ok.status === 'resolved' && ok.cityId === CWB.id);
    check('resolved carrega stateId/countryId canônicos', ok.status === 'resolved' && ok.stateId === PR.id && ok.countryId === BR.id);
    check('requiresUserConfirmation sempre true', ok.status === 'resolved' && ok.requiresUserConfirmation === true);
    check('cityDisplayText = nome CANÔNICO (não texto do provider)', ok.status === 'resolved' && ok.cityDisplayText === 'Curitiba');
    check('cache write em consulta fresca (provider real)', repo.storeCalls.length === 1 && repo.storeCalls[0].cityExternalCode === '4106902');

    const repo2 = new FakeEvidenceRepo();
    const calls2: string[] = [];
    const r2 = await makeResolver(repo2, [
      adapter('viacep', { outcome: 'unavailable', data: null }, calls2),
      adapter('brasilapi', { outcome: 'resolved', data: CWB_DATA }, calls2),
    ]).resolve({ countryCode: 'BR', postalCode: '80010100' });
    check('primário indisponível → fallback resolve', r2.status === 'resolved' && calls2.length === 2);

    const repo3 = new FakeEvidenceRepo();
    const r3 = await makeResolver(repo3, [
      adapter('viacep', { outcome: 'unavailable', data: null }),
      adapter('brasilapi', { outcome: 'unavailable', data: null }),
    ]).resolve({ countryCode: 'BR', postalCode: '80010100' });
    check('ambos indisponíveis → provider_unavailable', r3.status === 'provider_unavailable');

    const calls4: string[] = [];
    const r4 = await makeResolver(new FakeEvidenceRepo(), [
      adapter('viacep', { outcome: 'not_found', data: null }, calls4),
      adapter('brasilapi', { outcome: 'resolved', data: CWB_DATA }, calls4),
    ]).resolve({ countryCode: 'BR', postalCode: '99999999' });
    check('not_found NÃO cai em fallback (estado explícito)', r4.status === 'provider_not_found' && calls4.length === 1);

    const calls5: string[] = [];
    const r5 = await makeResolver(new FakeEvidenceRepo(), [
      adapter('viacep', { outcome: 'malformed', data: null }, calls5),
      adapter('brasilapi', { outcome: 'resolved', data: CWB_DATA }, calls5),
    ]).resolve({ countryCode: 'BR', postalCode: '80010100' });
    check('malformado NÃO cai em fallback (estado explícito)', r5.status === 'malformed_provider_response' && calls5.length === 1);

    const r6 = await makeResolver(new FakeEvidenceRepo(), [
      adapter('viacep', { outcome: 'resolved', data: { ...CWB_DATA, officialCityCode: null } }),
    ]).resolve({ countryCode: 'BR', postalCode: '80010100' });
    check('provider sem código oficial → official_identifier_missing (nunca nome)', r6.status === 'official_identifier_missing');
  }

  console.log('▶ resolução canônica contra o Location Core');
  {
    const r1 = await makeResolver(new FakeEvidenceRepo(), [
      adapter('viacep', { outcome: 'resolved', data: { ...CWB_DATA, stateCode: 'PR', officialCityCode: '9999999' } }),
    ]).resolve({ countryCode: 'BR', postalCode: '80010100' });
    check('código inexistente no catálogo → canonical_city_missing', r1.status === 'canonical_city_missing');

    const r2 = await makeResolver(new FakeEvidenceRepo(), [
      adapter('viacep', { outcome: 'resolved', data: { ...CWB_DATA, stateCode: 'SP' } }),
    ]).resolve({ countryCode: 'BR', postalCode: '80010100' });
    check('UF conflitante com código vivo em outra UF → territorial_inconsistency', r2.status === 'territorial_inconsistency');

    const r3 = await makeResolver(new FakeEvidenceRepo(), [
      adapter('viacep', { outcome: 'resolved', data: { ...CWB_DATA, stateCode: 'XX' } }),
    ]).resolve({ countryCode: 'BR', postalCode: '80010100' });
    check('UF fora do catálogo canônico → territorial_inconsistency', r3.status === 'territorial_inconsistency');

    const repoAmb = new FakeEvidenceRepo();
    repoAmb.ambiguousCity = true;
    const r4 = await makeResolver(repoAmb, [adapter('viacep', { outcome: 'resolved', data: CWB_DATA })])
      .resolve({ countryCode: 'BR', postalCode: '80010100' });
    check('par escopado ambíguo → canonical_city_ambiguous (nunca first-row)', r4.status === 'canonical_city_ambiguous');
  }

  console.log('▶ bairro: alias governado / candidato / pending / not_applicable');
  {
    const repoAlias = new FakeEvidenceRepo();
    repoAlias.aliasRows = [{ cityId: CWB.id, alias: 'centro', id: 'n-centro', name: 'Centro' }];
    const r1 = await makeResolver(repoAlias, [adapter('viacep', { outcome: 'resolved', data: CWB_DATA })])
      .resolve({ countryCode: 'BR', postalCode: '80010100' });
    check('alias governado na MESMA city → neighborhoodId resolvido',
      r1.status === 'resolved' && r1.neighborhoodId === 'n-centro' && r1.neighborhoodStatus === 'resolved');

    const repoOtherCity = new FakeEvidenceRepo();
    repoOtherCity.aliasRows = [{ cityId: 'city-outra', alias: 'centro', id: 'n-alien', name: 'Centro' }];
    const r2 = await makeResolver(repoOtherCity, [adapter('viacep', { outcome: 'resolved', data: CWB_DATA })])
      .resolve({ countryCode: 'BR', postalCode: '80010100' });
    check('alias de OUTRA city nunca resolve (cross-city proibido)',
      r2.status === 'resolved' && r2.neighborhoodId === null && r2.neighborhoodStatus === 'pending');

    const repoCand = new FakeEvidenceRepo();
    repoCand.candidateRows = [{ cityId: CWB.id, nameNorm: 'centro', id: 'n-centro', name: 'Centro' }];
    const r3 = await makeResolver(repoCand, [adapter('viacep', { outcome: 'resolved', data: CWB_DATA })])
      .resolve({ countryCode: 'BR', postalCode: '80010100' });
    check('nome canônico coincidente → CANDIDATO (exige confirmação), nunca identidade',
      r3.status === 'resolved' && r3.neighborhoodId === null &&
      r3.neighborhoodCandidateId === 'n-centro' && r3.neighborhoodStatus === 'candidate_requires_confirmation');

    const r4 = await makeResolver(new FakeEvidenceRepo(), [adapter('viacep', { outcome: 'resolved', data: CWB_DATA })])
      .resolve({ countryCode: 'BR', postalCode: '80010100' });
    check('sem match → pending com texto só de exibição',
      r4.status === 'resolved' && r4.neighborhoodId === null && r4.neighborhoodCandidateId === null &&
      r4.neighborhoodStatus === 'pending' && r4.neighborhoodDisplayText === 'Centro');

    const r5 = await makeResolver(new FakeEvidenceRepo(), [
      adapter('viacep', { outcome: 'resolved', data: { ...CWB_DATA, neighborhoodText: null } }),
    ]).resolve({ countryCode: 'BR', postalCode: '80010100' });
    check('provider sem bairro → not_applicable', r5.status === 'resolved' && r5.neighborhoodStatus === 'not_applicable');
  }

  console.log('▶ cache derivado (D-I)');
  {
    const repoHit = new FakeEvidenceRepo();
    repoHit.cached = { postalCode: '80010100', provider: 'VIA_CEP', stateCode: 'PR', cityName: 'Curitiba', cityExternalCode: '4106902', neighborhoodName: 'Centro', street: 'Rua XV', source: 'CEP_RESOLVED' };
    const calls: string[] = [];
    const r1 = await makeResolver(repoHit, [adapter('viacep', { outcome: 'resolved', data: CWB_DATA }, calls)])
      .resolve({ countryCode: 'BR', postalCode: '80010100' });
    check('cache hit com código → resolve SEM chamar provider',
      r1.status === 'resolved' && r1.cityId === CWB.id && calls.length === 0);
    check('evidência marca cacheHit', r1.status === 'resolved' && r1.providerEvidence[0]?.cacheHit === true);
    check('cache hit não regrava cache', repoHit.storeCalls.length === 0);

    const repoStale = new FakeEvidenceRepo();
    repoStale.cached = { postalCode: '80010100', provider: 'VIA_CEP', stateCode: 'PR', cityName: 'Cidade Fantasma', cityExternalCode: '8888888', neighborhoodName: null, street: null, source: 'CEP_RESOLVED' };
    const calls2: string[] = [];
    const r2 = await makeResolver(repoStale, [adapter('viacep', { outcome: 'resolved', data: CWB_DATA }, calls2)])
      .resolve({ countryCode: 'BR', postalCode: '80010100' });
    check('cache incompatível com o Core → DESCARTADO, provider reconsultado, Core prevalece',
      r2.status === 'resolved' && r2.cityId === CWB.id && calls2.length === 1);
    check('resolução fresca CURA o cache incompatível', repoStale.storeCalls.length === 1);

    const repoNoCode = new FakeEvidenceRepo();
    repoNoCode.cached = { postalCode: '80010100', provider: 'BRASIL_API', stateCode: 'PR', cityName: 'Curitiba', cityExternalCode: null, neighborhoodName: null, street: null, source: 'CEP_RESOLVED' };
    const calls3: string[] = [];
    const r3 = await makeResolver(repoNoCode, [adapter('viacep', { outcome: 'resolved', data: CWB_DATA }, calls3)])
      .resolve({ countryCode: 'BR', postalCode: '80010100' });
    check('cache sem código não curto-circuita (upgrade via provider)',
      r3.status === 'resolved' && r3.cityId === CWB.id && calls3.length === 1);

    const repoConf = new FakeEvidenceRepo();
    repoConf.cached = { postalCode: '80010100', provider: 'BRASIL_API', stateCode: 'SP', cityName: 'Outra', cityExternalCode: null, neighborhoodName: null, street: null, source: 'CEP_RESOLVED' };
    const r4 = await makeResolver(repoConf, [adapter('viacep', { outcome: 'resolved', data: CWB_DATA })])
      .resolve({ countryCode: 'BR', postalCode: '80010100' });
    check('evidências comparáveis discordantes (UF) → provider_conflict explícito', r4.status === 'provider_conflict');

    const repoMock = new FakeEvidenceRepo();
    const r5 = await makeResolver(repoMock, [adapter('mock', { outcome: 'resolved', data: CWB_DATA })])
      .resolve({ countryCode: 'BR', postalCode: '80010100' });
    check('provider de teste nunca persiste cache', r5.status === 'resolved' && repoMock.storeCalls.length === 0);
  }

  console.log('▶ comparador de evidências (conflitos)');
  {
    const base = { countryCode: 'BR', postalCodeNormalized: '80010100', queriedAt: 'x', responseHash: null, cacheHit: false } as const;
    const e1: PostalProviderEvidence = { ...base, provider: 'viacep', outcome: 'resolved', officialCityCode: '4106902', stateCode: 'PR' };
    const e2: PostalProviderEvidence = { ...base, provider: 'brasilapi', outcome: 'resolved', officialCityCode: '3550308', stateCode: 'PR' };
    check('códigos oficiais divergentes → official_identifier_conflict', detectPostalEvidenceConflict([e1, e2]) === 'official_identifier_conflict');
    const e3: PostalProviderEvidence = { ...base, provider: 'brasilapi', outcome: 'resolved', officialCityCode: null, stateCode: 'SP' };
    check('UFs divergentes → provider_conflict', detectPostalEvidenceConflict([e1, e3]) === 'provider_conflict');
    const e4: PostalProviderEvidence = { ...base, provider: 'brasilapi', outcome: 'unavailable', officialCityCode: '9999999', stateCode: 'AC' };
    check('evidência não-resolvida não é comparável', detectPostalEvidenceConflict([e1, e4]) === null);
    check('evidências concordantes → sem conflito', detectPostalEvidenceConflict([e1, { ...e1, provider: 'brasilapi' }]) === null);
  }

  console.log('▶ adapter real (fetch stubado — SEM rede): validação, sanitização, retry');
  {
    const realFetch = globalThis.fetch;
    const jsonRes = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    try {
      let fetchCalls = 0;

      (globalThis as any).fetch = async () => { fetchCalls++; return jsonRes({ uf: 'pr', localidade: 'Curitiba', ibge: '4106902', bairro: '  Centro <script>alert(1)</script>  ', logradouro: 'R'.repeat(500) }); };
      const a1 = await new ViaCepProvider(200, () => 0).query('80010100');
      check('ViaCEP resolved + UF normalizada', a1.outcome === 'resolved' && a1.data?.stateCode === 'PR');
      check('markup/script removido do texto externo', a1.outcome === 'resolved' && !(a1.data?.neighborhoodText ?? '').includes('<'));
      check('string excessiva truncada (≤120)', a1.outcome === 'resolved' && (a1.data?.street ?? '').length <= 120);
      check('código IBGE 7 dígitos aceito', a1.data?.officialCityCode === '4106902');

      (globalThis as any).fetch = async () => jsonRes({ uf: 'PR', localidade: 'Curitiba', ibge: 'xx123' });
      const a2 = await new ViaCepProvider(200, () => 0).query('80010100');
      check('IBGE inválido não vira identificador oficial', a2.outcome === 'resolved' && a2.data?.officialCityCode === null);

      (globalThis as any).fetch = async () => jsonRes({ erro: true });
      const a3 = await new ViaCepProvider(200, () => 0).query('99999999');
      check('ViaCEP {erro:true} → not_found', a3.outcome === 'not_found');

      (globalThis as any).fetch = async () => new Response('not json{{', { status: 200 });
      const a4 = await new ViaCepProvider(200, () => 0).query('80010100');
      check('payload não-JSON → malformed', a4.outcome === 'malformed');

      (globalThis as any).fetch = async () => jsonRes({ localidade: 'SemUF' });
      const a5 = await new ViaCepProvider(200, () => 0).query('80010100');
      check('resposta sem UF → malformed', a5.outcome === 'malformed');

      fetchCalls = 0;
      (globalThis as any).fetch = async () => { fetchCalls++; return jsonRes({}, 500); };
      const a6 = await new ViaCepProvider(200, () => 0).query('80010100');
      check('5xx persistente → unavailable após 1 retry (2 tentativas)', a6.outcome === 'unavailable' && fetchCalls === 2);

      fetchCalls = 0;
      (globalThis as any).fetch = async () => { fetchCalls++; return jsonRes({}, 429); };
      const a7 = await new ViaCepProvider(200, () => 0).query('80010100');
      check('429 persistente → unavailable após 1 retry', a7.outcome === 'unavailable' && fetchCalls === 2);

      fetchCalls = 0;
      (globalThis as any).fetch = async () => {
        fetchCalls++;
        if (fetchCalls === 1) throw new Error('ECONNRESET');
        return jsonRes({ uf: 'PR', localidade: 'Curitiba', ibge: '4106902' });
      };
      const a8 = await new ViaCepProvider(200, () => 0).query('80010100');
      check('falha de rede transitória → retry ÚNICO recupera', a8.outcome === 'resolved' && fetchCalls === 2);

      fetchCalls = 0;
      (globalThis as any).fetch = async () => { fetchCalls++; return jsonRes({}, 404); };
      const a9 = await new ViaCepProvider(200, () => 0).query('80010100');
      check('404 → not_found SEM retry', a9.outcome === 'not_found' && fetchCalls === 1);

      const a10 = await new ViaCepProvider(200, () => 0).query('8001010');
      check('CEP não-normalizado rejeitado antes de qualquer fetch', a10.outcome === 'malformed');
    } finally {
      (globalThis as any).fetch = realFetch;
    }
  }

  console.log('▶ chain por configuração server-side (sem seleção por request)');
  {
    const prev = process.env.CEP_PROVIDER;
    try {
      delete process.env.CEP_PROVIDER;
      check('sem opt-in → chain VAZIA (gates/testes sem rede)', getPostalProviderChain().length === 0);
      process.env.CEP_PROVIDER = 'viacep';
      const chain = getPostalProviderChain();
      check('opt-in → ViaCEP primário + BrasilAPI fallback',
        chain.length === 2 && chain[0]?.providerId === 'viacep' && chain[1]?.providerId === 'brasilapi');
    } finally {
      if (prev === undefined) delete process.env.CEP_PROVIDER; else process.env.CEP_PROVIDER = prev;
    }
  }

  // MockPostalProviderAdapter (contrato rico de teste) — comportamento default honesto.
  {
    const mock = new MockPostalProviderAdapter({ '80010100': { outcome: 'resolved', data: CWB_DATA } });
    const hit = await mock.query('80010100');
    const miss = await mock.query('12345678');
    check('MockPostalProviderAdapter: fixture hit/miss determinístico', hit.outcome === 'resolved' && miss.outcome === 'not_found');
  }

  console.log(`\n${failures === 0 ? '✅' : '❌'} test-postal-resolution-unit — ${passed} passed, ${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('❌ test-postal-resolution-unit crashed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
