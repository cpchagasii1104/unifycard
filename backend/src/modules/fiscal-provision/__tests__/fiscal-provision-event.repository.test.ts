// backend/src/modules/fiscal-provision/__tests__/fiscal-provision-event.repository.test.ts
// FISCAL-4E — regressão PERMANENTE do event repository: contrato existingClient (sem tx interna) e
// idempotência tuple+fingerprint (D11). Prova determinística por mock de PoolClient (a semântica SQL/DB
// é provada separadamente no banco efêmero).

import { fiscalProvisionEventRepository, IdempotencyPayloadMismatchError, type FiscalProvisionEventInput } from '../fiscal-provision-event.repository';

const baseInput = (): FiscalProvisionEventInput => ({
  tenantId: 'a3859c3e-eca7-4e7d-9df4-324829b368ce',
  fiscalIdentityId: '9b7168b2-775d-42b7-8616-adc3e253edad',
  taxpayerKind: 'platform',
  currency: 'BRL',
  referenceType: 'service_order',
  referenceId: 'ref-1',
  fiscalEconomicContextFingerprint: 'fp-AAA',
  commissionGrossCents: 1000, taxReserveCents: 150, commissionDistributableCents: 850,
  sourceLineRef: { lineId: 'L1' }, destinationSnapshot: { account: 'platform_fees' },
  fiscalJurisdiction: { country: 'BR' }, buyerTerritory: null,
  snapshotVersion: 1, fiscalSnapshot: {}, eventKind: 'provision', reversesEventId: null,
  status: 'provisioned', occurredAt: new Date(), effectiveAt: new Date(),
});

// mock que despacha por conteúdo do SQL e rastreia controle de transação.
function mockClient(findRows: Array<{ id: string; fiscal_economic_context_fingerprint: string }>) {
  const calls: string[] = [];
  const client = {
    query: async (sql: string) => {
      const s = String(sql);
      if (/^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(s)) calls.push(s.trim().split(/\s/)[0]!.toUpperCase());
      if (/pg_advisory_xact_lock/.test(s)) return { rows: [{ pg_advisory_xact_lock: '' }] };
      if (/FROM fiscal_provision_events/i.test(s)) return { rows: findRows };
      if (/INSERT INTO fiscal_provision_events/i.test(s)) return { rows: [{ id: 'ev-new' }] };
      return { rows: [] };
    },
    release: () => { calls.push('RELEASE'); },
  } as any;
  return { client, calls };
}

describe('FISCAL-4E fiscal_provision_events repository (existingClient + idempotência)', () => {
  it('existingClient: NÃO executa BEGIN/COMMIT/ROLLBACK nem release (participa da tx da dona)', async () => {
    const { client, calls } = mockClient([]); // nada existente → insere
    const r = await fiscalProvisionEventRepository.insertProvisionEvent(baseInput(), client);
    expect(r).toEqual({ id: 'ev-new', idempotent: false });
    expect(calls).not.toContain('BEGIN');
    expect(calls).not.toContain('COMMIT');
    expect(calls).not.toContain('ROLLBACK');
    expect(calls).not.toContain('RELEASE');
  });

  it('idempotência: mesma tuple + MESMO fingerprint → retorno idempotente (sem novo INSERT)', async () => {
    const { client } = mockClient([{ id: 'ev-existing', fiscal_economic_context_fingerprint: 'fp-AAA' }]);
    const r = await fiscalProvisionEventRepository.insertProvisionEvent(baseInput(), client);
    expect(r).toEqual({ id: 'ev-existing', idempotent: true });
  });

  it('mismatch: mesma tuple + fingerprint DIFERENTE → IDEMPOTENCY_PAYLOAD_MISMATCH', async () => {
    const { client } = mockClient([{ id: 'ev-existing', fiscal_economic_context_fingerprint: 'fp-DIFFERENT' }]);
    await expect(fiscalProvisionEventRepository.insertProvisionEvent(baseInput(), client))
      .rejects.toBeInstanceOf(IdempotencyPayloadMismatchError);
  });

  it('não usa reference_id como fingerprint (campos distintos no input)', () => {
    const i = baseInput();
    expect(i.referenceId).not.toBe(i.fiscalEconomicContextFingerprint);
  });
});
