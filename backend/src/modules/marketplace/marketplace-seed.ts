/**
 * Inicialização de dados de exemplo (desenvolvimento).
 * Controlado por ENABLE_MARKETPLACE_SEED.
 * Importado por index.ts após o service estar criado.
 */
import { marketplaceService } from './marketplace.service';
import { marketplaceLogger } from './marketplace.logger';

const enableMarketplaceSeed = process.env.ENABLE_MARKETPLACE_SEED?.toLowerCase() === 'true';
if (process.env.NODE_ENV === 'production' && !enableMarketplaceSeed) {
  // Em produção, seed só com flag explícita
}

if (enableMarketplaceSeed) {
  try {
    marketplaceService.initializeServiceData();
    marketplaceService.company.initializeCompanyPlans();
    marketplaceService.catalog.initializeBusinessTemplates();
    marketplaceService.catalog.initializeProductTemplates();
    marketplaceService.catalog.initializeServiceTemplatesCanonical();
    marketplaceLogger.init('Dados de exemplo inicializados');
  } catch (err) {
    marketplaceLogger.error('Erro ao inicializar dados de exemplo', err);
    throw err;
  }
}