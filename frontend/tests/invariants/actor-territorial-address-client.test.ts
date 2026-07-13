// @vitest-environment jsdom
//
// F-ADDRESS-ONBOARDING-CANONICAL-FLOW (RFC A1-D) — invariantes do client canônico da jornada PF.
// CONGELA: o preview usa o resolver CANÔNICO (/locations/cep) com país EXPLÍCITO, nunca a facade
// textual /api/location/cep; o comando POST /actors/:actorId/territorial-address NUNCA envia
// tenant/role/owner_type/owner_id; IDs canônicos (cityId/neighborhoodId) trafegam preservados.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const apiFetchJson = vi.fn();
const apiFetch = vi.fn();
vi.mock('../../src/api/client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  apiFetchJson: (...a: unknown[]) => apiFetchJson(...a),
}));

import {
  previewResidenceAddress,
  setActorResidenceAddress,
} from '../../src/api/actorTerritorialAddress';

beforeEach(() => {
  apiFetch.mockReset();
  apiFetchJson.mockReset();
});

describe('preview canônico (país explícito, sem facade textual)', () => {
  it('chama /locations/cep com countryCode e mapeia o DTO estreito com IDs canônicos', async () => {
    apiFetchJson.mockResolvedValue({
      ok: true,
      data: { resolved: true, postalCode: '80010100', street: 'Rua XV', neighborhoodDisplay: null, neighborhoodId: null, cityId: 'city-cwb', cityName: 'Curitiba', stateUf: 'PR', source: 'viacep' },
    });
    const r = await previewResidenceAddress('BR', '80010-100');
    const url = apiFetchJson.mock.calls[0][0] as string;
    expect(url).toContain('/locations/cep/80010100');
    expect(url).toContain('countryCode=BR');
    expect(url).not.toContain('/api/location/cep');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.preview.city.id).toBe('city-cwb');
      expect(r.preview.requiresUserConfirmation).toBe(true);
      expect(r.preview.neighborhood.status).toBe('not_applicable');
    }
  });

  it('cidade não resolvida → ok:false', async () => {
    apiFetchJson.mockResolvedValue({ ok: true, data: { resolved: false, cityId: null } });
    const r = await previewResidenceAddress('BR', '00000000');
    expect(r.ok).toBe(false);
  });
});

describe('comando set/replace (sem tenant/role/owner)', () => {
  it('POST /actors/:actorId/territorial-address com body canônico e sem campos proibidos', async () => {
    apiFetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ actorId: 'a1', purpose: 'ACTOR_RESIDENCE', role: 'RESIDENCE', outcome: 'set', assignmentId: 'asg', addressId: 'addr', replayed: false }) });
    const r = await setActorResidenceAddress('actor-1', {
      purpose: 'ACTOR_RESIDENCE', countryCode: 'BR', postalCode: '80010100', street: 'Rua XV',
      number: '100', complement: null, confirmedCityId: 'city-cwb', confirmedNeighborhoodId: null, idempotencyKey: 'idem-1',
    });
    const [url, opts] = apiFetch.mock.calls[0] as [string, { method: string; body: string }];
    expect(url).toBe('/actors/actor-1/territorial-address');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body).not.toHaveProperty('tenantId');
    expect(body).not.toHaveProperty('role');
    expect(body).not.toHaveProperty('owner_type');
    expect(body).not.toHaveProperty('owner_id');
    expect(body).not.toHaveProperty('actorId');
    expect(body.confirmedCityId).toBe('city-cwb');
    expect(body.idempotencyKey).toBe('idem-1');
    expect(r.ok).toBe(true);
  });

  it('erro do backend projeta o código público estável', async () => {
    apiFetch.mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: 'territorial_confirmation_mismatch' }) });
    const r = await setActorResidenceAddress('actor-1', {
      purpose: 'ACTOR_RESIDENCE', countryCode: 'BR', postalCode: '80010100', street: 'x', number: '1', confirmedCityId: 'c', idempotencyKey: 'k',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('territorial_confirmation_mismatch');
  });
});
