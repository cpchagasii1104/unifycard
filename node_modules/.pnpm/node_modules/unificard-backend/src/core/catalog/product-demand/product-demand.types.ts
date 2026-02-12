// src/core/catalog/product-demand/product-demand.types.ts
// Tipos para sinal de demanda de produtos - READ-ONLY

/**
 * Sinal de demanda de produto por cidade
 * Observa demanda vs oferta, sem executar decisões
 */
export interface ProductDemandSignal {
  cityId: string;
  productId: string;
  demandIndex: number; // 0-1: intensidade de demanda
  supplyIndex: number; // 0-1: intensidade de oferta
  demandSupplyRatio: number; // demanda / oferta (1 = equilibrado, >1 = alta demanda, <1 = alta oferta)
  searchesLast7Days: number; // Buscas do produto nos últimos 7 dias
  offersCount: number; // Quantidade de ofertas ativas
  computedAt: string; // ISO date
  
  // Blindagem semântica: qualidade dos dados
  confidence: 'high' | 'medium' | 'low' | 'insufficient'; // Confiança na qualidade dos dados
  sampleSize: number; // Tamanho da amostra (buscas + ofertas)
  dataWindowDays: number; // Período de observação em dias
  reason?: string; // Motivo se confidence for 'insufficient'
}

/**
 * Resultado de demanda por cidade
 */
export interface CityProductDemandResult {
  cityId: string;
  signals: ProductDemandSignal[];
  totalProducts: number;
  highDemandProducts: number; // demandSupplyRatio > 1.5
  lowSupplyProducts: number; // demandSupplyRatio > 2.0
  computedAt: string;
}

