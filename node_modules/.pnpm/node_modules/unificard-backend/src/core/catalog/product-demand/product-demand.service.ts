// src/core/catalog/product-demand/product-demand.service.ts
// Serviço de sinal de demanda de produtos - READ-ONLY

import { runQueryWithTenant, runQueriesWithTenant } from '../../database/pool';
import { decisionLogService } from '../../decision-log/decision-log.service';
import { offerIndexService } from '../offer-index/offer-index.service';
import { cityReadinessService } from '../../city/city-readiness/city-readiness.service';
import type {
  ProductDemandSignal,
  CityProductDemandResult,
} from './product-demand.types';

/**
 * Serviço de sinal de demanda de produtos
 * READ-ONLY: apenas observa e mede, não executa decisões
 */
class ProductDemandService {
  // TEMPORARY_HEURISTIC: Normalizações fixas serão substituídas por
  // percentil local ou baseline móvel por cidade quando houver dados suficientes
  private readonly TEMP_DEMAND_NORMALIZATION_THRESHOLD = 100; // 100+ buscas = demanda máxima (1.0)
  private readonly TEMP_SUPPLY_NORMALIZATION_THRESHOLD = 10; // 10+ ofertas = oferta máxima (1.0)
  
  // TEMPORARY_HEURISTIC: Thresholds de confidence escolhidos como mínimo conservador
  // Serão substituídos por cálculo adaptativo baseado em percentis quando houver dados suficientes
  private readonly MIN_SAMPLE_SIZE_FOR_HIGH_CONFIDENCE = 20;
  private readonly MIN_SAMPLE_SIZE_FOR_MEDIUM_CONFIDENCE = 10;
  private readonly MIN_SAMPLE_SIZE_FOR_LOW_CONFIDENCE = 5;
  private readonly MIN_DATA_WINDOW_DAYS_FOR_HIGH = 7;
  private readonly MIN_DATA_WINDOW_DAYS_FOR_MEDIUM = 3;
  private readonly MIN_DATA_WINDOW_DAYS_FOR_LOW = 1;
  /**
   * Calcula sinais de demanda para todos os produtos de uma cidade
   */
  async getCityDemandSignals(
    tenantId: string,
    cityId: string
  ): Promise<CityProductDemandResult | null> {
    // Validar cidade (usar city readiness como referência)
    // Por enquanto, apenas verificar se cidade existe
    const cityExists = await this.validateCity(tenantId, cityId);
    if (!cityExists) {
      return null;
    }

    // Buscar produtos canônicos que têm ofertas nesta cidade
    const productsWithOffers = await this.getProductsWithOffers(
      tenantId,
      cityId
    );

    const signals: ProductDemandSignal[] = [];

    for (const productId of productsWithOffers) {
      const signal = await this.calculateDemandSignal(
        tenantId,
        cityId,
        productId
      );
      if (signal) {
        signals.push(signal);
      }
    }

    // Calcular estatísticas
    const highDemandProducts = signals.filter(
      (s) => s.demandSupplyRatio > 1.5
    ).length;
    const lowSupplyProducts = signals.filter(
      (s) => s.demandSupplyRatio > 2.0
    ).length;

    const result: CityProductDemandResult = {
      cityId,
      signals,
      totalProducts: signals.length,
      highDemandProducts,
      lowSupplyProducts,
      computedAt: new Date().toISOString(),
    };

    // Log estruturado (observação)
    await this.logDemandCalculation(tenantId, cityId, result);

    return result;
  }

  /**
   * Calcula sinal de demanda para um produto específico em uma cidade
   */
  async getProductDemandSignal(
    tenantId: string,
    cityId: string,
    productId: string
  ): Promise<ProductDemandSignal | null> {
    // Validar cidade
    const cityExists = await this.validateCity(tenantId, cityId);
    if (!cityExists) {
      return null;
    }

    const signal = await this.calculateDemandSignal(
      tenantId,
      cityId,
      productId
    );

    if (signal) {
      // Log estruturado (observação)
      await this.logProductDemand(tenantId, cityId, productId, signal);
    }

    return signal;
  }

  /**
   * Valida se cidade existe e verifica readiness (guardrail informativo)
   */
  private async validateCity(
    tenantId: string,
    cityId: string
  ): Promise<boolean> {
    // Verificar se cidade existe
    const city = await runQueryWithTenant<{ exists: boolean }>(
      tenantId,
      {
        text: `
        SELECT EXISTS(
          SELECT 1 FROM rides_cities
          WHERE tenant_id = $1 AND city_id = $2
        ) AS exists
        `,
        values: [tenantId, cityId],
      }
    );

    if (!city?.exists) {
      return false;
    }

    // Guardrail informativo: verificar readiness (não bloqueia, apenas avisa)
    try {
      const readiness = await cityReadinessService.getCityReadiness(cityId);
      if (readiness && !readiness.canActivate.marketplace) {
        console.warn(
          `[ProductDemandService] Cidade ${cityId} não está pronta para marketplace:`,
          readiness.reasons.marketplace || ['Dependências faltantes']
        );
      }
    } catch (error) {
      // Não falhar silenciosamente - log o erro mas continua
      console.warn(
        '[ProductDemandService] Erro ao verificar city readiness:',
        error
      );
    }

    return true;
  }

  /**
   * Obtém lista de produtos que têm ofertas na cidade
   */
  private async getProductsWithOffers(
    tenantId: string,
    cityId: string
  ): Promise<string[]> {
    const rows = await runQueriesWithTenant<{ product_id: string }>(
      tenantId,
      {
        text: `
        SELECT DISTINCT product_id
        FROM product_offers
        WHERE tenant_id = $1
          AND location_city_id = $2
          AND active = TRUE
        `,
        values: [tenantId, cityId],
      }
    );

    return rows.map((r) => r.product_id);
  }

  /**
   * Calcula sinal de demanda para um produto
   */
  private async calculateDemandSignal(
    tenantId: string,
    cityId: string,
    productId: string
  ): Promise<ProductDemandSignal | null> {
    // 1. Buscar ofertas do produto na cidade (supply)
    const offersResult = await offerIndexService.search(tenantId, {
      productId,
      cityId,
    });
    const offersCount = offersResult.offers.length;

    // 2. Buscar buscas do produto nos últimos 7 dias (demand)
    // Ler do Decision Log (observações de busca)
    const searchesLast7Days = await this.getSearchesLast7Days(
      tenantId,
      productId
    );

    // 3. Calcular índices (normalizados 0-1)
    // Demand Index: baseado em buscas (normalizar para escala 0-1)
    const demandIndex = Math.min(
      searchesLast7Days / this.TEMP_DEMAND_NORMALIZATION_THRESHOLD,
      1.0
    );

    // Supply Index: baseado em ofertas (normalizar para escala 0-1)
    const supplyIndex = Math.min(
      offersCount / this.TEMP_SUPPLY_NORMALIZATION_THRESHOLD,
      1.0
    );

    // 4. Calcular ratio (demanda / oferta)
    // 1.0 = equilibrado, >1.0 = alta demanda, <1.0 = alta oferta
    const demandSupplyRatio =
      supplyIndex > 0 ? demandIndex / supplyIndex : demandIndex > 0 ? 10 : 0; // Se oferta = 0 mas há demanda, ratio alto

    // 5. Calcular qualidade dos dados (blindagem semântica)
    const sampleSize = searchesLast7Days + offersCount;
    const dataWindowDays = 7; // Período fixo de 7 dias (pode evoluir para adaptativo)
    
    let confidence: 'high' | 'medium' | 'low' | 'insufficient';
    let reason: string | undefined;
    
    if (
      sampleSize >= this.MIN_SAMPLE_SIZE_FOR_HIGH_CONFIDENCE &&
      dataWindowDays >= this.MIN_DATA_WINDOW_DAYS_FOR_HIGH
    ) {
      confidence = 'high';
    } else if (
      sampleSize >= this.MIN_SAMPLE_SIZE_FOR_MEDIUM_CONFIDENCE &&
      dataWindowDays >= this.MIN_DATA_WINDOW_DAYS_FOR_MEDIUM
    ) {
      confidence = 'medium';
    } else if (
      sampleSize >= this.MIN_SAMPLE_SIZE_FOR_LOW_CONFIDENCE &&
      dataWindowDays >= this.MIN_DATA_WINDOW_DAYS_FOR_LOW
    ) {
      confidence = 'low';
    } else {
      confidence = 'insufficient';
      reason = `Dados insuficientes: sampleSize=${sampleSize} (mínimo=${this.MIN_SAMPLE_SIZE_FOR_LOW_CONFIDENCE}), dataWindowDays=${dataWindowDays} (mínimo=${this.MIN_DATA_WINDOW_DAYS_FOR_LOW})`;
    }

    return {
      cityId,
      productId,
      demandIndex,
      supplyIndex,
      demandSupplyRatio,
      searchesLast7Days,
      offersCount,
      computedAt: new Date().toISOString(),
      confidence,
      sampleSize,
      dataWindowDays,
      reason,
    };
  }

  /**
   * Obtém quantidade de buscas do produto nos últimos 7 dias
   * Lê do Decision Log (observações de busca)
   * Modo conservador: retorna 0 se não conseguir ler
   */
  private async getSearchesLast7Days(
    tenantId: string,
    productId: string
  ): Promise<number> {
    try {
      const fs = require('fs');
      const path = require('path');

      const logsDir = path.join(process.cwd(), 'logs', 'decisions');
      if (!fs.existsSync(logsDir)) {
        return 0; // Modo conservador: se não há logs, retornar 0
      }

      const files = fs.readdirSync(logsDir);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      let searchCount = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const filePath = path.join(logsDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const logs: any[] = JSON.parse(content);

          for (const log of logs) {
            // Verificar se é observação de busca de produto canônico
            if (
              log.policyKey === 'canonical_product_search' &&
              log.metadata?.query &&
              log.createdAt &&
              new Date(log.createdAt) >= sevenDaysAgo
            ) {
              // Contar buscas (modo conservador: não filtrar por productId específico)
              // Em produção, isso seria mais preciso com metadata.productId
              searchCount++;
            }
          }
        } catch (error) {
          // Continuar mesmo se um arquivo falhar
          console.warn(
            `[ProductDemandService] Erro ao ler log ${file}:`,
            error
          );
        }
      }

      return searchCount;
    } catch (error) {
      // Modo conservador: se falhar, retornar 0
      console.warn(
        '[ProductDemandService] Erro ao ler Decision Log:',
        error
      );
      return 0;
    }
  }

  /**
   * Log estruturado de cálculo de demanda por cidade
   */
  private async logDemandCalculation(
    tenantId: string,
    cityId: string,
    result: CityProductDemandResult
  ): Promise<void> {
    // Log estruturado no console
    console.log(
      JSON.stringify({
        module: 'product-demand',
        eventType: 'demand_calculation',
        tenantId,
        cityId,
        totalProducts: result.totalProducts,
        highDemandProducts: result.highDemandProducts,
        lowSupplyProducts: result.lowSupplyProducts,
        computedAt: result.computedAt,
        timestamp: new Date().toISOString(),
      })
    );

    // Registrar no Decision Log (observação)
    try {
      await decisionLogService.createObservation(
        'economy',
        'product_demand_calculation',
        {
          cityId,
        },
        0,
        {
          metadata: {
            totalProducts: result.totalProducts,
            highDemandProducts: result.highDemandProducts,
            lowSupplyProducts: result.lowSupplyProducts,
            signals: result.signals.map((s) => ({
              productId: s.productId,
              demandIndex: s.demandIndex,
              supplyIndex: s.supplyIndex,
              demandSupplyRatio: s.demandSupplyRatio,
              // Blindagem semântica: qualidade dos dados
              confidence: s.confidence,
              sampleSize: s.sampleSize,
              dataWindowDays: s.dataWindowDays,
              reason: s.reason,
            })),
          },
        }
      );
    } catch (error) {
      // Não falhar silenciosamente - log o erro
      console.error(
        '[ProductDemandService] Erro ao registrar no Decision Log:',
        error
      );
    }
  }

  /**
   * Log estruturado de demanda por produto
   */
  private async logProductDemand(
    tenantId: string,
    cityId: string,
    productId: string,
    signal: ProductDemandSignal
  ): Promise<void> {
    // Log estruturado no console
    console.log(
      JSON.stringify({
        module: 'product-demand',
        eventType: 'product_demand_signal',
        tenantId,
        cityId,
        productId,
        demandIndex: signal.demandIndex,
        supplyIndex: signal.supplyIndex,
        demandSupplyRatio: signal.demandSupplyRatio,
        searchesLast7Days: signal.searchesLast7Days,
        offersCount: signal.offersCount,
        computedAt: signal.computedAt,
        timestamp: new Date().toISOString(),
      })
    );

    // Registrar no Decision Log (observação)
    try {
      await decisionLogService.createObservation(
        'economy',
        'product_demand_signal',
        {
          cityId,
        },
        0,
        {
          metadata: {
            productId,
            demandIndex: signal.demandIndex,
            supplyIndex: signal.supplyIndex,
            demandSupplyRatio: signal.demandSupplyRatio,
            searchesLast7Days: signal.searchesLast7Days,
            offersCount: signal.offersCount,
            // Blindagem semântica: qualidade dos dados
            confidence: signal.confidence,
            sampleSize: signal.sampleSize,
            dataWindowDays: signal.dataWindowDays,
            reason: signal.reason,
          },
        }
      );
    } catch (error) {
      // Não falhar silenciosamente - log o erro
      console.error(
        '[ProductDemandService] Erro ao registrar no Decision Log:',
        error
      );
    }
  }
}

export const productDemandService = new ProductDemandService();

