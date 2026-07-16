// backend/src/modules/bank/__tests__/fiscal-reserve-bank-composition.service.test.ts
// FISCAL-4E · PASSE 3 — regressão PERMANENTE da composição fiscal-Bank dormente
// (DECISION-0179 · DECISION-0182 · DECISION-0183). Mocks ESM das dependências; o fingerprint é REAL.
// Prova: source line explícita fail-closed; matriz zero-bucket completa; resolver condicional a
// tax_reserve>0; continuation herda destino (não reescolhe); conservação; provisão UMA vez;
// existingClient repassado a todas as escritas; snapshots territoriais separados.

import { jest } from '@jest/globals';

const provisionPlatformCommission = jest.fn<(...a: any[]) => Promise<any>>();
const insertProvisionEvent = jest.fn(async () => ({ id: 'EVT-1', idempotent: false }));
const resolveFiscalReserveAccount = jest.fn(async () => ({ bankAccountId: 'FISCAL-RESERVE-ACC' }));
const createTransactionWithExplicitSplitLines = jest.fn(async () => ({
  transaction: { transactionId: 'BANKTX-1' },
  splits: [],
  ledgerEntries: [],
}));
const reverseTransaction = jest.fn(async () => ({ reversalTransactionId: 'REV-1' }));

jest.unstable_mockModule('@modules/fiscal-provision/fiscal-provision.service', () => ({
  fiscalProvisionService: { provisionPlatformCommission },
}));
const findByTuple = jest.fn<(...a: any[]) => Promise<any>>();
const getProvisionEventById = jest.fn<(...a: any[]) => Promise<any>>();
jest.unstable_mockModule('@modules/fiscal-provision/fiscal-provision-event.repository', () => ({
  fiscalProvisionEventRepository: { insertProvisionEvent, findByTuple, getProvisionEventById },
}));
jest.unstable_mockModule('../fiscal-reserve-account.resolver', () => ({
  resolveFiscalReserveAccount,
  FiscalReserveAccountMissingError: class extends Error {},
}));
jest.unstable_mockModule('../bank-transaction.service', () => ({
  bankTransactionService: { createTransactionWithExplicitSplitLines },
}));
jest.unstable_mockModule('../bank-integration.service', () => ({
  bankIntegrationService: { reverseTransaction },
}));

const { fiscalReserveBankCompositionService, FiscalReserveCompositionError } = await import(
  '../fiscal-reserve-bank-composition.service'
);

const TENANT = 'a3859c3e-eca7-4e7d-9df4-324829b368ce';

function snapshot(gross: number, reserve: number, dist: number) {
  return {
    calculationVersion: 1,
    taxpayerKind: 'platform',
    fiscalIdentityId: 'FID-1',
    actorFiscalProfileId: 'PROF-1',
    actorFiscalProfileVersion: 1,
    taxRegime: 'simples_nacional',
    platformRevenueStream: 'marketplace_commission',
    conceptId: null,
    countryId: 'CTRY-BR',
    stateId: 'ST-PR',
    cityId: 'CITY-CWB',
    occurredAt: '2026-07-16T00:00:00.000Z',
    effectiveAt: '2026-07-16T00:00:00.000Z',
    baseType: 'commission_gross',
    commissionGrossCents: gross,
    taxReserveCents: reserve,
    commissionDistributableCents: dist,
    rules: [{ taxRuleId: 'RULE-1', taxRuleVersion: 2, taxTypeId: 'TT-1', rateBps: 1500, roundingMode: 'half_up', provisionCents: reserve, source: 'test' }],
    warnings: [],
  };
}
function outcomeFound(gross: number, reserve: number, dist: number) {
  return { status: 'found', results: [], taxReserveCents: reserve, commissionDistributableCents: dist, warnings: [], fiscalSnapshot: snapshot(gross, reserve, dist) };
}

function baseInput(sourceAmount: number, extra?: Partial<any>) {
  return {
    tenantId: TENANT,
    currency: 'BRL' as const,
    referenceType: 'service_order_commission',
    referenceId: 'ref-' + Math.random().toString(36).slice(2),
    fromAccountId: 'PAYER-ACC',
    payerActorId: 'PAYER-ACTOR',
    conceptId: 'concept-x',
    description: 'commission composition test',
    authorship: { actingForActorId: 'PAYER-ACTOR' } as any,
    originalSplitLines: [
      { lineId: 'seller', targetAccountId: 'SELLER-ACC', amountCents: 9000, receiverActorId: 'SELLER-ACTOR', splitType: 'revenue_share' as const },
      { lineId: 'commission', targetAccountId: 'PLATFORM-FEE-ACC', amountCents: sourceAmount, receiverActorId: 'PLATFORM-ACTOR', splitType: 'fee' as const },
    ],
    commissionGrossSourceLineId: 'commission',
    platformRevenueStream: 'marketplace_commission' as const,
    fiscalCountryId: 'CTRY-BR',
    fiscalStateId: 'ST-PR',
    fiscalCityId: 'CITY-CWB',
    occurredAt: new Date('2026-07-16T00:00:00Z'),
    consumptionMode: 'mandatory' as const,
    buyerTerritory: { cityId: 'BUYER-CITY' },
    ...(extra ?? {}),
  };
}

const fakeClient = { query: jest.fn(async () => ({ rows: [] })) } as any;

beforeEach(() => {
  provisionPlatformCommission.mockReset();
  insertProvisionEvent.mockClear();
  resolveFiscalReserveAccount.mockClear();
  createTransactionWithExplicitSplitLines.mockClear();
  reverseTransaction.mockClear();
  fakeClient.query.mockClear();
  insertProvisionEvent.mockResolvedValue({ id: 'EVT-1', idempotent: false } as any);
  resolveFiscalReserveAccount.mockResolvedValue({ bankAccountId: 'FISCAL-RESERVE-ACC' } as any);
  createTransactionWithExplicitSplitLines.mockResolvedValue({ transaction: { transactionId: 'BANKTX-1' }, splits: [], ledgerEntries: [] } as any);
});

function sinkLines() {
  return (createTransactionWithExplicitSplitLines.mock.calls[0] as any[])[1].splitLines as any[];
}

describe('FISCAL-4E composição fiscal-Bank — matriz zero-bucket (DECISION-0183)', () => {
  it('reserve>0 & distributable>0 → continuation + tax_reserve (2 linhas); resolver invocado', async () => {
    provisionPlatformCommission.mockResolvedValue(outcomeFound(1000, 150, 850) as any);
    const r = await fiscalReserveBankCompositionService.composePlatformCommission(baseInput(1000), fakeClient);
    expect(r.materializedContinuation).toBe(true);
    expect(r.materializedTaxReserve).toBe(true);
    expect(resolveFiscalReserveAccount).toHaveBeenCalledTimes(1);
    const lines = sinkLines();
    // seller (intacta) + continuation + tax_reserve
    const cont = lines.find((l) => l.targetAccountId === 'PLATFORM-FEE-ACC');
    const res = lines.find((l) => l.splitType === 'tax_reserve');
    expect(cont.amountCents).toBe(850);
    expect(cont.splitType).toBe('fee'); // herda o split_type da source, NÃO reescolhe
    expect(res.amountCents).toBe(150);
    expect(res.targetAccountId).toBe('FISCAL-RESERVE-ACC');
    // conservação global: seller 9000 + cont 850 + reserve 150 == 10000
    expect(lines.reduce((s, l) => s + l.amountCents, 0)).toBe(10000);
  });

  it('reserve>0 & distributable=0 → somente tax_reserve; sem continuation', async () => {
    provisionPlatformCommission.mockResolvedValue(outcomeFound(1000, 1000, 0) as any);
    const r = await fiscalReserveBankCompositionService.composePlatformCommission(baseInput(1000), fakeClient);
    expect(r.materializedContinuation).toBe(false);
    expect(r.materializedTaxReserve).toBe(true);
    expect(resolveFiscalReserveAccount).toHaveBeenCalledTimes(1);
    const lines = sinkLines();
    expect(lines.some((l) => l.targetAccountId === 'PLATFORM-FEE-ACC')).toBe(false); // sem continuation
    expect(lines.find((l) => l.splitType === 'tax_reserve').amountCents).toBe(1000);
    expect(lines.reduce((s, l) => s + l.amountCents, 0)).toBe(10000);
  });

  it('reserve=0 & distributable>0 → somente continuation; resolver NÃO invocado', async () => {
    provisionPlatformCommission.mockResolvedValue(outcomeFound(1000, 0, 1000) as any);
    const r = await fiscalReserveBankCompositionService.composePlatformCommission(baseInput(1000), fakeClient);
    expect(r.materializedContinuation).toBe(true);
    expect(r.materializedTaxReserve).toBe(false);
    expect(resolveFiscalReserveAccount).not.toHaveBeenCalled(); // condicional a tax_reserve>0
    const lines = sinkLines();
    expect(lines.some((l) => l.splitType === 'tax_reserve')).toBe(false);
    expect(lines.find((l) => l.targetAccountId === 'PLATFORM-FEE-ACC').amountCents).toBe(1000);
  });

  it('reserve=0 & distributable=0 (com gross>0) → INVARIANT VIOLATION; sink NÃO chamado', async () => {
    // source line física positiva (1000) mas outcome fiscal declara ambos os buckets zero → contradição.
    provisionPlatformCommission.mockResolvedValue(outcomeFound(1000, 0, 0) as any);
    await expect(
      fiscalReserveBankCompositionService.composePlatformCommission(baseInput(1000), fakeClient)
    ).rejects.toThrow(/INVARIANT_VIOLATION/);
    expect(createTransactionWithExplicitSplitLines).not.toHaveBeenCalled();
  });
});

describe('FISCAL-4E composição — source line explícita fail-closed (§4)', () => {
  it('source ausente → SOURCE_LINE_MISSING; provisão não chamada', async () => {
    await expect(
      fiscalReserveBankCompositionService.composePlatformCommission(baseInput(1000, { commissionGrossSourceLineId: 'nope' }), fakeClient)
    ).rejects.toThrow(/SOURCE_LINE_MISSING/);
    expect(provisionPlatformCommission).not.toHaveBeenCalled();
  });

  it('source duplicada → SOURCE_LINE_DUPLICATE', async () => {
    const inp = baseInput(1000);
    inp.originalSplitLines.push({ lineId: 'commission', targetAccountId: 'OTHER', amountCents: 1, receiverActorId: 'X', splitType: 'fee' as const });
    await expect(fiscalReserveBankCompositionService.composePlatformCommission(inp, fakeClient)).rejects.toThrow(/SOURCE_LINE_DUPLICATE/);
  });

  it('linha original não positiva → NONPOSITIVE_ORIGINAL_LINE', async () => {
    const inp = baseInput(1000);
    inp.originalSplitLines[0].amountCents = 0;
    await expect(fiscalReserveBankCompositionService.composePlatformCommission(inp, fakeClient)).rejects.toThrow(/NONPOSITIVE_ORIGINAL_LINE/);
  });
});

describe('FISCAL-4E composição — fiscal, conservação, provisão-uma-vez, existingClient (§5/§8/§9)', () => {
  it('provisão ausente → FISCAL_CONFIG_MISSING; sink não chamado', async () => {
    provisionPlatformCommission.mockResolvedValue({ status: 'fiscal_config_missing', missingReason: 'tax_rule_missing', reason: 'x', results: [], taxReserveCents: null, commissionDistributableCents: null, warnings: [] } as any);
    await expect(fiscalReserveBankCompositionService.composePlatformCommission(baseInput(1000), fakeClient)).rejects.toThrow(/FISCAL_CONFIG_MISSING/);
    expect(createTransactionWithExplicitSplitLines).not.toHaveBeenCalled();
  });

  it('conservação violada (gross != reserve+dist) → CONSERVATION_VIOLATION', async () => {
    provisionPlatformCommission.mockResolvedValue(outcomeFound(1000, 100, 800) as any); // 100+800 != 1000
    await expect(fiscalReserveBankCompositionService.composePlatformCommission(baseInput(1000), fakeClient)).rejects.toThrow(/CONSERVATION_VIOLATION/);
  });

  it('distributable negativo → COMMISSION_DISTRIBUTABLE_NEGATIVE', async () => {
    provisionPlatformCommission.mockResolvedValue(outcomeFound(1000, 1200, -200) as any);
    await expect(fiscalReserveBankCompositionService.composePlatformCommission(baseInput(1000), fakeClient)).rejects.toThrow(/COMMISSION_DISTRIBUTABLE_NEGATIVE/);
  });

  it('provisão fiscal chamada EXATAMENTE uma vez; existingClient repassado a provisão/evento/resolver/sink', async () => {
    provisionPlatformCommission.mockResolvedValue(outcomeFound(1000, 150, 850) as any);
    await fiscalReserveBankCompositionService.composePlatformCommission(baseInput(1000), fakeClient);
    expect(provisionPlatformCommission).toHaveBeenCalledTimes(1);
    expect((provisionPlatformCommission.mock.calls[0] as any[])[1]).toBe(fakeClient);
    expect((insertProvisionEvent.mock.calls[0] as any[])[1]).toBe(fakeClient);
    expect((resolveFiscalReserveAccount.mock.calls[0] as any[])[1]).toBe(fakeClient);
    expect((createTransactionWithExplicitSplitLines.mock.calls[0] as any[])[2]).toBe(fakeClient);
  });

  it('snapshots territoriais SEPARADOS no evento: fiscalJurisdiction (cadastral) × buyerTerritory', async () => {
    provisionPlatformCommission.mockResolvedValue(outcomeFound(1000, 150, 850) as any);
    await fiscalReserveBankCompositionService.composePlatformCommission(baseInput(1000), fakeClient);
    const evt = (insertProvisionEvent.mock.calls[0] as any[])[0];
    expect(evt.fiscalJurisdiction).toEqual({ countryId: 'CTRY-BR', stateId: 'ST-PR', cityId: 'CITY-CWB' });
    expect(evt.buyerTerritory).toEqual({ cityId: 'BUYER-CITY' });
    expect(evt.taxpayerKind).toBe('platform');
    // ambos os amounts (inclusive quando um é 0) no evento
    expect(evt.commissionDistributableCents).toBe(850);
    expect(evt.taxReserveCents).toBe(150);
  });

  it('exige existingClient (dormente): sem client → EXTERNAL_CLIENT_REQUIRED', async () => {
    provisionPlatformCommission.mockResolvedValue(outcomeFound(1000, 150, 850) as any);
    await expect(
      (fiscalReserveBankCompositionService as any).composePlatformCommission(baseInput(1000), undefined)
    ).rejects.toThrow(/EXTERNAL_CLIENT_REQUIRED/);
  });

  it('replay idempotente: event.idempotent propaga', async () => {
    provisionPlatformCommission.mockResolvedValue(outcomeFound(1000, 150, 850) as any);
    insertProvisionEvent.mockResolvedValue({ id: 'EVT-1', idempotent: true } as any);
    const r = await fiscalReserveBankCompositionService.composePlatformCommission(baseInput(1000), fakeClient);
    expect(r.idempotent).toBe(true);
  });

  it('vínculo Bank→fiscal: UPDATE bank_transactions com event id + fingerprint', async () => {
    provisionPlatformCommission.mockResolvedValue(outcomeFound(1000, 150, 850) as any);
    await fiscalReserveBankCompositionService.composePlatformCommission(baseInput(1000), fakeClient);
    const upd = fakeClient.query.mock.calls.find((c: any[]) => /UPDATE bank_transactions/.test(String(c[0])));
    expect(upd).toBeTruthy();
    expect(upd[1][0]).toBe('EVT-1'); // fiscal_provision_event_id
    expect(typeof upd[1][1]).toBe('string'); // fingerprint
  });
});

describe('FISCAL-4E full reversal — contrato de atomicidade (PASSE 3R)', () => {
  it('sem existingClient → EXTERNAL_CLIENT_REQUIRED (reversão atômica exige tx DONA)', async () => {
    await expect(
      (fiscalReserveBankCompositionService as any).reverseFullPlatformCommission(
        { tenantId: TENANT, referenceType: 'r', referenceId: 'x', actorId: 'a' }, undefined
      )
    ).rejects.toThrow(/EXTERNAL_CLIENT_REQUIRED/);
  });

  it('sem evento de provisão original → REVERSAL_NO_ORIGINAL (fail-closed)', async () => {
    findByTuple.mockResolvedValue(null as any);
    await expect(
      fiscalReserveBankCompositionService.reverseFullPlatformCommission(
        { tenantId: TENANT, referenceType: 'r', referenceId: 'x', actorId: 'a' }, fakeClient
      )
    ).rejects.toThrow(/REVERSAL_NO_ORIGINAL/);
    // findByTuple recebeu o existingClient (leitura na MESMA tx DONA)
    expect((findByTuple.mock.calls[0] as any[])[4]).toBe(fakeClient);
  });
});
