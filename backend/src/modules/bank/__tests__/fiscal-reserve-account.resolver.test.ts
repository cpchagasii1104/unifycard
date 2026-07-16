// backend/src/modules/bank/__tests__/fiscal-reserve-account.resolver.test.ts
// FISCAL-4E — regressão PERMANENTE do resolver lookup-only + V24 + distinção MISSING × INTEGRITY_ERROR.
// V24: erro de INFRAESTRUTURA NUNCA convertido em MISSING nem em sucesso.
// Integridade: mapping existente com vínculo incoerente NÃO pode ser mascarado como ausência.

import {
  resolveFiscalReserveAccount,
  FiscalReserveAccountMissingError,
  FiscalReserveAccountAmbiguousError,
  FiscalReserveAccountIntegrityError,
} from '../fiscal-reserve-account.resolver';

const TENANT = 'a3859c3e-eca7-4e7d-9df4-324829b368ce';
const q = { tenantId: TENANT, fiscalIdentityId: '9b7168b2-775d-42b7-8616-adc3e253edad', currency: 'BRL' };
const validRow = { bank_account_id: 'acc-1', account_exists: true, account_tenant_id: TENANT, account_type: 'fiscal_reserve' };

function mockClient(queryImpl: (...a: any[]) => Promise<any>) {
  const state = { released: false, queries: 0 };
  const client = {
    query: async (...a: any[]) => { state.queries++; return queryImpl(...a); },
    release: () => { state.released = true; },
  } as any;
  return { client, state };
}

describe('FISCAL-4E fiscal_reserve resolver (lookup-only + V24 + integridade)', () => {
  it('tuple inexistente (0 mappings) → MISSING', async () => {
    const { client } = mockClient(async () => ({ rows: [] }));
    await expect(resolveFiscalReserveAccount(q, client)).rejects.toBeInstanceOf(FiscalReserveAccountMissingError);
  });

  it('mapping + conta fiscal_reserve válida → SUCESSO (retorna a conta)', async () => {
    const { client } = mockClient(async () => ({ rows: [validRow] }));
    await expect(resolveFiscalReserveAccount(q, client)).resolves.toEqual({ bankAccountId: 'acc-1' });
  });

  it('cardinalidade >1 → AMBIGUOUS', async () => {
    const { client } = mockClient(async () => ({ rows: [validRow, { ...validRow, bank_account_id: 'acc-2' }] }));
    await expect(resolveFiscalReserveAccount(q, client)).rejects.toBeInstanceOf(FiscalReserveAccountAmbiguousError);
  });

  it('mapping + conta ausente → INTEGRITY_ERROR (não MISSING)', async () => {
    const { client } = mockClient(async () => ({ rows: [{ bank_account_id: 'acc-x', account_exists: false, account_tenant_id: null, account_type: null }] }));
    await resolveFiscalReserveAccount(q, client).then(
      () => { throw new Error('deveria falhar'); },
      (e) => { expect(e).toBeInstanceOf(FiscalReserveAccountIntegrityError); expect(e).not.toBeInstanceOf(FiscalReserveAccountMissingError); },
    );
  });

  it('mapping + account_type incorreto → INTEGRITY_ERROR (NÃO mascarado como MISSING)', async () => {
    const { client } = mockClient(async () => ({ rows: [{ ...validRow, account_type: 'credit' }] }));
    await resolveFiscalReserveAccount(q, client).then(
      () => { throw new Error('deveria falhar'); },
      (e) => { expect(e).toBeInstanceOf(FiscalReserveAccountIntegrityError); expect(e).not.toBeInstanceOf(FiscalReserveAccountMissingError); expect(String((e as Error).message)).toMatch(/account_type/); },
    );
  });

  it('mapping + tenant da conta divergente → INTEGRITY_ERROR', async () => {
    const { client } = mockClient(async () => ({ rows: [{ ...validRow, account_tenant_id: 'a0000001-0000-4000-8000-000000000001' }] }));
    await expect(resolveFiscalReserveAccount(q, client)).rejects.toBeInstanceOf(FiscalReserveAccountIntegrityError);
  });

  it('V24: erro de infraestrutura PROPAGA exatamente (não vira missing, não vira sucesso)', async () => {
    const infra = Object.assign(new Error('ECONNRESET: server closed the connection'), { code: 'ECONNRESET' });
    const { client } = mockClient(async () => { throw infra; });
    await expect(resolveFiscalReserveAccount(q, client)).rejects.toBe(infra);
  });

  it('V24: erro de infraestrutura NÃO é MISSING nem INTEGRITY', async () => {
    const infra = Object.assign(new Error('57014: statement timeout'), { code: '57014' });
    const { client } = mockClient(async () => { throw infra; });
    await resolveFiscalReserveAccount(q, client).then(
      () => { throw new Error('deveria propagar'); },
      (e) => {
        expect(e).not.toBeInstanceOf(FiscalReserveAccountMissingError);
        expect(e).not.toBeInstanceOf(FiscalReserveAccountIntegrityError);
        expect((e as any).code).toBe('57014');
      },
    );
  });

  it('zero auto-provision: só SELECT (nenhum INSERT/UPDATE/DELETE)', async () => {
    const { client, state } = mockClient(async (sql: string) => {
      expect(String(sql)).toMatch(/^\s*SELECT/i);
      return { rows: [validRow] };
    });
    await resolveFiscalReserveAccount(q, client);
    expect(state.queries).toBe(1);
  });
});
