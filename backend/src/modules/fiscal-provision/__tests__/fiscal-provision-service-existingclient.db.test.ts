// backend/src/modules/fiscal-provision/__tests__/fiscal-provision-service-existingclient.db.test.ts
// FISCAL-4E — prova REAL (DB) do existingClient no service. Roda SOMENTE contra banco efêmero
// (FISCAL4E_EPHEMERAL=1 + DATABASE_URL apontando ao efêmero); no restante é SKIP (não toca unificard_dev).
// Prova: provisionPlatformCommission com existingClient escreve o log NA MESMA tx; ROLLBACK externo
// remove o log; nenhuma camada interna deu COMMIT (um client novo não vê nada).

const RUN = process.env.FISCAL4E_EPHEMERAL === '1';
const d: jest.Describe = (RUN ? describe : describe.skip) as any;

d('FISCAL-4E existingClient no service (DB efêmero)', () => {
  const TA = 'a3859c3e-eca7-4e7d-9df4-324829b368ce';
  const ref = 'svc-ec-' + Math.random().toString(36).slice(2);
  const event: any = {
    contractVersion: 1, tenantId: TA, taxpayerKind: 'platform', sourceModule: 'service_order',
    sourceReferenceId: ref, occurredAt: new Date(), effectiveAt: new Date(), commissionGrossCents: 1000,
    countryId: '42d04887-3033-459c-a4a9-8c6f9ea5a816', stateId: null, cityId: null, conceptId: null,
    platformRevenueStream: 'marketplace_commission', currency: 'BRL', consumptionMode: 'informative',
  };

  it('log escrito via existingClient; ROLLBACK externo remove; sem commit interno', async () => {
    const { getClientWithTenant } = await import('@core/database/pool');
    const { fiscalProvisionService } = await import('../fiscal-provision.service');
    const countWith = async (c: any) => Number((await c.query('SELECT count(*)::int AS n FROM fiscal_provision_logs WHERE source_reference_id=$1', [ref])).rows[0].n);

    const client = await getClientWithTenant(TA);
    try {
      await client.query('BEGIN');
      await fiscalProvisionService.provisionPlatformCommission(event, client);
      // log visível DENTRO da mesma transação/client externo
      expect(await countWith(client)).toBeGreaterThanOrEqual(1);
      await client.query('ROLLBACK'); // rollback da DONA
    } finally {
      client.release();
    }
    // client NOVO (só enxerga o que foi COMMITADO): nada — nenhuma camada interna commitou
    const fresh = await getClientWithTenant(TA);
    try {
      expect(await countWith(fresh)).toBe(0);
    } finally {
      fresh.release();
    }
  });
});
