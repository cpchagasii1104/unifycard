// backend/src/modules/fiscal-provision/__tests__/fiscal-provision-service-existingclient.test.ts
// FISCAL-4E — regressão PERMANENTE do threading de existingClient no ORQUESTRADOR fiscal.
// Prova: provisionPlatformCommission → finalize → appendRows repassam o MESMO client;
// getClientWithTenant NÃO é chamado nesse caminho; sem existingClient o caminho anterior segue.

import { jest } from '@jest/globals';

// mocks ESM (hoisted por unstable_mockModule) das dependências do orquestrador. Mockar appendRows
// (spy) já prova o forwarding do client; o "zero getClientWithTenant" é propriedade JÁ provada de
// appendRows/event-repo (ownsTx guards) — aqui basta capturar o 2º argumento repassado.
const getActiveProfileForTenant = jest.fn(async () => null); // caminho curto → finalize(missing)→appendRows
const appendRows = jest.fn(async () => [] as any[]);

jest.unstable_mockModule('@modules/fiscal/fiscal-profile.repository', () => ({
  fiscalProfileRepository: { getActiveProfileForTenant },
}));
jest.unstable_mockModule('../fiscal-provision-log.repository', () => ({
  fiscalProvisionLogRepository: { appendRows },
}));

const { fiscalProvisionService } = await import('../fiscal-provision.service');

const event: any = {
  contractVersion: 1,
  tenantId: 'a3859c3e-eca7-4e7d-9df4-324829b368ce',
  taxpayerKind: 'platform',
  sourceModule: 'service_order',
  sourceReferenceId: 'ref-1',
  occurredAt: new Date('2026-07-16T00:00:00Z'),
  effectiveAt: new Date('2026-07-16T00:00:00Z'),
  commissionGrossCents: 1000,
  countryId: '42d04887-3033-459c-a4a9-8c6f9ea5a816',
  stateId: null,
  cityId: null,
  conceptId: null,
  platformRevenueStream: 'marketplace_commission',
  currency: 'BRL',
  consumptionMode: 'informative',
};

const fakeClient = { query: jest.fn(async () => ({ rows: [] })), release: jest.fn() } as any;

describe('FISCAL-4E existingClient threading no service', () => {
  beforeEach(() => { appendRows.mockClear(); });

  it('com existingClient: appendRows recebe o MESMO client externo (forwarding provado)', async () => {
    await fiscalProvisionService.provisionPlatformCommission(event, fakeClient);
    expect(appendRows).toHaveBeenCalledTimes(1);
    // 2º argumento de appendRows === o client externo passado (mesma referência)
    expect((appendRows.mock.calls[0] as any[])[1]).toBe(fakeClient);
  });

  it('sem existingClient: comportamento anterior — appendRows recebe undefined (transação própria do repo)', async () => {
    await fiscalProvisionService.provisionPlatformCommission(event);
    expect(appendRows).toHaveBeenCalledTimes(1);
    expect((appendRows.mock.calls[0] as any[])[1]).toBeUndefined();
  });
});
