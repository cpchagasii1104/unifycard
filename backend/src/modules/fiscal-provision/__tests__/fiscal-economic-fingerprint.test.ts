// backend/src/modules/fiscal-provision/__tests__/fiscal-economic-fingerprint.test.ts
// FISCAL-4E — regressão PERMANENTE do fingerprint fiscal-econômico (DECISION-0179 D11 + DECISION-0182).
// Prova a SEPARAÇÃO selada: a identidade EXTERNA da operação (tenant_id, reference_type, reference_id)
// NÃO entra no preimage; o fingerprint é a identidade do PAYLOAD fiscal-econômico. tenant_id permanece
// apenas como dimensão material. reference_type/reference_id sequer existem no tipo de entrada.

import { computeFiscalEconomicFingerprint, type FiscalEconomicFingerprintInput } from '../fiscal-economic-fingerprint';

const base: FiscalEconomicFingerprintInput = {
  tenantId: 'a3859c3e-eca7-4e7d-9df4-324829b368ce',
  fiscalIdentityId: '9b7168b2-775d-42b7-8616-adc3e253edad',
  taxpayerKind: 'platform',
  taxRegime: 'SIMPLES_NACIONAL',
  platformRevenueStream: 'marketplace_commission',
  conceptId: 'concept-1',
  fiscalJurisdiction: { country: 'BR', state: 'PR', city: 'Curitiba' },
  buyerTerritory: { country: 'BR', state: 'SP' },
  economicPolicyId: 'policy-v1',
  taxRuleVersions: [{ taxRuleId: 'r2', version: 3 }, { taxRuleId: 'r1', version: 1 }],
  currency: 'BRL',
  commissionGrossCents: 1000,
  taxReserveCents: 150,
  commissionDistributableCents: 850,
  sourceLineIdentity: { lineId: 'L1' },
  sourceDestination: { account: 'platform_fees' },
  eventKind: 'provision',
  reversesEventId: null,
  snapshotVersion: 1,
};
const fp = (o: Partial<FiscalEconomicFingerprintInput> = {}) => computeFiscalEconomicFingerprint({ ...base, ...o });

describe('FISCAL-4E fiscal-economic fingerprint (D11 preimage separation)', () => {
  it('determinístico: mesmo payload -> mesmo hash', () => {
    expect(fp()).toBe(fp());
  });

  it('é sha256 (64 hex)', () => {
    expect(fp()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reference_type / reference_id NÃO estão no tipo de entrada (fora do preimage)', () => {
    // prova estática + estrutural: as chaves não existem no objeto de entrada.
    expect(Object.prototype.hasOwnProperty.call(base, 'referenceId')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(base, 'referenceType')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(base, 'idempotencyIdentity')).toBe(false);
    // adicionar reference_* ao objeto NÃO altera o hash (spread ignora campos desconhecidos do preimage).
    const withRefs = { ...base, referenceId: 'ref-9', referenceType: 'other' } as FiscalEconomicFingerprintInput;
    expect(computeFiscalEconomicFingerprint(withRefs)).toBe(fp());
  });

  it('normalização de tax rule versions: ordem de entrada não importa -> mesmo hash', () => {
    expect(fp()).toBe(fp({ taxRuleVersions: [{ taxRuleId: 'r1', version: 1 }, { taxRuleId: 'r2', version: 3 }] }));
  });

  it('array materialmente ordenado (dentro de source line) preserva ordem -> ordem diferente muda o hash', () => {
    const a = fp({ sourceLineIdentity: { path: ['a', 'b', 'c'] } });
    const b = fp({ sourceLineIdentity: { path: ['c', 'b', 'a'] } });
    expect(a).not.toBe(b);
  });

  describe('sensibilidade a cada dimensão material', () => {
    const cases: Array<[string, Partial<FiscalEconomicFingerprintInput>]> = [
      ['fiscalIdentityId', { fiscalIdentityId: 'other' }],
      ['taxpayerKind', { taxpayerKind: 'x' }],
      ['taxRegime', { taxRegime: 'LUCRO_REAL' }],
      ['platformRevenueStream', { platformRevenueStream: 'advertising' }],
      ['conceptId', { conceptId: 'concept-2' }],
      ['fiscalJurisdiction', { fiscalJurisdiction: { country: 'BR', state: 'SP' } }],
      ['buyerTerritory', { buyerTerritory: { country: 'BR', state: 'RJ' } }],
      ['economicPolicyId', { economicPolicyId: 'policy-v2' }],
      ['taxRuleVersion', { taxRuleVersions: [{ taxRuleId: 'r1', version: 2 }, { taxRuleId: 'r2', version: 3 }] }],
      ['currency', { currency: 'USD' }],
      ['commissionGrossCents', { commissionGrossCents: 1001, taxReserveCents: 151 }],
      ['taxReserveCents', { taxReserveCents: 200, commissionDistributableCents: 800 }],
      ['commissionDistributableCents', { commissionDistributableCents: 851, commissionGrossCents: 1001 }],
      ['sourceLineIdentity', { sourceLineIdentity: { lineId: 'L2' } }],
      ['sourceDestination', { sourceDestination: { account: 'platform_revenue' } }],
      ['eventKind', { eventKind: 'full_reversal', reversesEventId: 'ev0' }],
      ['reversesEventId', { eventKind: 'full_reversal', reversesEventId: 'ev1' }],
      ['snapshotVersion', { snapshotVersion: 2 }],
    ];
    it.each(cases)('mudar %s -> hash diferente', (_name, patch) => {
      expect(fp(patch)).not.toBe(fp());
    });
  });

  it('isolamento de tenant: tenant diferente -> hash diferente (sem colisão)', () => {
    expect(fp({ tenantId: 'a0000001-0000-4000-8000-000000000001' })).not.toBe(fp());
  });

  it('distingue null de vazio quando material (taxRegime null vs "")', () => {
    expect(fp({ taxRegime: null })).not.toBe(fp({ taxRegime: '' }));
  });

  it('valor monetário não-inteiro falha fechado', () => {
    expect(() => fp({ commissionGrossCents: 10.5 })).toThrow(/FISCAL_FINGERPRINT_NON_INTEGER/);
  });
});
