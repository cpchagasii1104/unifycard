// @vitest-environment jsdom
//
// F-SESSION-TENANT-ID-REQUIRED-ON-PUBLISH-SLICE-A — reprodução controlada + trava de invariante.
// DT: DT-SESSION-TENANT-ID-REQUIRED-ON-PUBLISH.
//
// CONTEXTO (diagnose-first, HEAD 453ae7e78):
//   • Backend SEMPRE emite `tenantId` no JWT (auth.service.ts generateTokens:76; users.tenant_id NOT NULL).
//     Logo um token válido recém-emitido NUNCA carece de tenant.
//   • O frontend (apiFetch, client.ts:204-217) AUTO-CURA o caso "storage vazio": re-extrai o tenantId do
//     JWT e persiste. Uma sessão válida, portanto, NÃO dispara TENANT_ID_REQUIRED no fluxo de publicação.
//   • TENANT_ID_REQUIRED (code MISSING_TENANT) só nasce de:
//       (A) token presente mas SEM claim tenantId / payload ilegível (token legado/corrompido) — client.ts:225;
//       (B) ausência total de token (chamada autenticada sem sessão) — client.ts:240.
//     Ambos são ARTEFATO DE ESTADO DE SESSÃO, não defeito de código numa sessão válida.
//
// Este teste exercita o apiFetch REAL (sem alterar runtime) e CONGELA o invariante:
//   token válido => publica sem falso TENANT_ID_REQUIRED + auto-cura o storage;
//   token sem tenant / malformado / ausente => MISSING_TENANT controlado, ANTES de qualquer fetch.
// Se alguém quebrar a auto-cura (regressão que faça um token válido disparar MISSING_TENANT), o teste morde.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Estado controlável dos getters de sessão (mock de ../../src/config/auth).
let mockToken: string | null = null;
let mockTenant: string | null = null;
const setTenantIdSpy = vi.fn((t: string) => {
  mockTenant = t;
});
const clearSessionSpy = vi.fn();

vi.mock('../../src/config/auth', () => ({
  getAuthToken: () => mockToken,
  getTenantId: () => mockTenant,
  setTenantId: (t: string) => setTenantIdSpy(t),
  clearSession: () => clearSessionSpy(),
}));

// Importado APÓS o vi.mock (hoisted) — o apiFetch real resolve para o config/auth mockado,
// tanto no import estático quanto no `await import('../config/auth')` dinâmico.
import { apiFetch } from '../../src/api/client';

const ACTOR_STORAGE_KEY = 'unificard_active_actor_id';

/** Monta um JWT sintético header.payload.assinatura (só o payload importa para o apiFetch). */
function makeToken(payload: Record<string, unknown>): string {
  const b64 = btoa(JSON.stringify(payload));
  return `h.${b64}.s`;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockToken = null;
  mockTenant = null;
  setTenantIdSpy.mockClear();
  clearSessionSpy.mockClear();
  // Actor presente no storage para que o bloco de ActionContext não espere/derrube o caminho feliz.
  localStorage.setItem(ACTOR_STORAGE_KEY, 'actor-test');
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true }),
  }));
  // @ts-expect-error — substituir fetch global pelo mock no ambiente de teste.
  global.fetch = fetchMock;
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

function headerOfLastFetch(): Record<string, string> {
  const call = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return (call?.[1] as RequestInit | undefined)?.headers as Record<string, string>;
}

describe('apiFetch — resolução de tenantId (DT-SESSION-TENANT-ID-REQUIRED-ON-PUBLISH)', () => {
  it('SESSÃO VÁLIDA, storage vazio: auto-cura do JWT, publica sem TENANT_ID_REQUIRED', async () => {
    mockToken = makeToken({ sub: 'u1', tenantId: 'unificard-inicial', type: 'access' });
    mockTenant = null; // storage vazio (cenário "race de bootstrap")

    await apiFetch('/services'); // caminho do fluxo de publicação (POST autenticado)

    // Não lançou; chamou o backend.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Auto-curou o storage a partir do JWT.
    expect(setTenantIdSpy).toHaveBeenCalledWith('unificard-inicial');
    // Header de tenant resolvido enviado.
    expect(headerOfLastFetch()['x-tenant-id']).toBe('unificard-inicial');
  });

  it('SESSÃO VÁLIDA, tenant em cache: usa o storage sem reparse do JWT', async () => {
    mockTenant = 'tenant-cacheado';
    mockToken = makeToken({ sub: 'u1', tenantId: 'tenant-do-jwt', type: 'access' });

    await apiFetch('/services');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(headerOfLastFetch()['x-tenant-id']).toBe('tenant-cacheado');
    expect(setTenantIdSpy).not.toHaveBeenCalled();
  });

  it('TOKEN LEGADO sem claim tenantId: MISSING_TENANT controlado, ANTES de qualquer fetch (gatilho A)', async () => {
    mockToken = makeToken({ sub: 'u1', email: 'x@y.z', type: 'access' }); // sem tenantId
    mockTenant = null;

    await expect(apiFetch('/services')).rejects.toMatchObject({ code: 'MISSING_TENANT' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('TOKEN MALFORMADO (payload ilegível): MISSING_TENANT controlado, sem fetch (gatilho A)', async () => {
    mockToken = 'isto-nao-e-um-jwt';
    mockTenant = null;

    await expect(apiFetch('/services')).rejects.toMatchObject({ code: 'MISSING_TENANT' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('SEM TOKEN (chamada autenticada sem sessão): MISSING_TENANT controlado, sem fetch (gatilho B)', async () => {
    mockToken = null;
    mockTenant = null;

    await expect(apiFetch('/services')).rejects.toMatchObject({ code: 'MISSING_TENANT' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
