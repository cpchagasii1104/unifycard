// src/core/config/feature-flags.service.ts
// Serviço de feature flags simples

import { stagingConfig } from './staging.config';

class FeatureFlagsService {
  /**
   * Verifica se o fundo regional está visível
   */
  isFundVisibilityEnabled(): boolean {
    return stagingConfig.fundVisibilityEnabled;
  }

  /**
   * Campanhas de procurement (fase neutra, sem dinheiro).
   * Por defeito desligado — rotas não são registadas no BOOT.
   */
  isProcurementCampaignEnabled(): boolean {
    return stagingConfig.procurementCampaignEnabled;
  }
}

export const featureFlagsService = new FeatureFlagsService();











