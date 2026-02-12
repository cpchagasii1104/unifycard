// backend/src/modules/marketplace/__tests__/policy-registry-thresholds.test.ts
// SPRINT 66: Testes para verificar que thresholds são lidos do Policy Registry

import { describe, it, expect } from '@jest/globals';
import { policyRegistry } from '@core/policy/policy-registry';
import { decisionSimulationService } from '../decision-simulation.service';

describe('Policy Registry Thresholds (SPRINT 66)', () => {
  it('deve ler elasticidade do Policy Registry', () => {
    const elasticity = policyRegistry.getPolicyValue<number>(
      'marketplace',
      'price_elasticity_default',
      -1.5
    );

    expect(elasticity).toBe(-1.5);
    expect(typeof elasticity).toBe('number');
  });

  it('deve ler margem padrão do Policy Registry', () => {
    const defaultMargin = policyRegistry.getPolicyValue<number>(
      'marketplace',
      'default_margin_percentage',
      15
    );

    expect(defaultMargin).toBe(15);
    expect(typeof defaultMargin).toBe('number');
  });

  it('deve ler confidence thresholds do Policy Registry', () => {
    const lowThreshold = policyRegistry.getPolicyValue<number>(
      'marketplace',
      'confidence_min_data_points_low',
      7
    );

    const mediumThreshold = policyRegistry.getPolicyValue<number>(
      'marketplace',
      'confidence_min_data_points_medium',
      30
    );

    expect(lowThreshold).toBe(7);
    expect(mediumThreshold).toBe(30);
  });

  it('deve usar defaults se policy não existir', () => {
    // Buscar policy que não existe
    const nonExistent = policyRegistry.getPolicyValue<number>(
      'marketplace',
      'non_existent_policy',
      999 // default
    );

    expect(nonExistent).toBe(999);
  });
});







