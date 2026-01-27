"use strict";
// src/core/catalog/offer-index/offer-index.service.ts
// Serviço de índice de ofertas - READ-ONLY
Object.defineProperty(exports, "__esModule", { value: true });
exports.offerIndexService = void 0;
const pool_1 = require("../../database/pool");
const decision_log_service_1 = require("../../decision-log/decision-log.service");
/**
 * Serviço de índice de ofertas
 * READ-ONLY: apenas busca e consulta, não cria ou altera ofertas
 * Não vende, apenas responde: quem vende isso perto daqui?
 */
class OfferIndexService {
    /**
     * Converte row do banco para OfferIndex
     * Nota: localização precisa ser obtida separadamente (merchant ou city)
     */
    async toOfferIndex(row, location) {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            productId: row.product_id,
            merchantId: row.merchant_id,
            cityId: row.location_city_id || undefined,
            regionId: row.location_region_id || undefined,
            location: location
                ? {
                    latitude: location.lat,
                    longitude: location.lng,
                }
                : {
                    latitude: 0,
                    longitude: 0,
                },
            availability: {
                inStock: row.active && (row.stock === null || row.stock > 0),
                stockCount: row.stock || undefined,
            },
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    /**
     * Busca ofertas por produto e localização
     * READ-ONLY: apenas consulta, não cria ou altera
     */
    async search(tenantId, filters) {
        const { productId, cityId, radiusKm, centerLat, centerLng } = filters;
        // Buscar ofertas do produto
        let query = `
      SELECT id, tenant_id, product_id, merchant_id, 
             location_region_id, location_city_id, price, stock, active,
             created_at, updated_at
      FROM product_offers
      WHERE tenant_id = $1
        AND product_id = $2
        AND active = TRUE
    `;
        const params = [tenantId, productId];
        // Filtrar por cidade se fornecido
        if (cityId) {
            query += ` AND location_city_id = $${params.length + 1}`;
            params.push(cityId);
        }
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, {
            text: query,
            values: params,
        });
        // Obter localizações dos merchants
        // Usar localização da cidade como proxy (merchant está na cidade)
        const offers = [];
        for (const row of rows) {
            let location;
            // Tentar obter localização da cidade
            // Usar PostGIS para extrair lat/lng do POINT
            if (row.location_city_id) {
                const cityLocation = await (0, pool_1.runQueryWithTenant)(tenantId, {
                    text: `
            SELECT 
              ST_Y(center::geometry) AS lat,
              ST_X(center::geometry) AS lng
            FROM rides_cities
            WHERE tenant_id = $1 AND city_id = $2
              AND center IS NOT NULL
            LIMIT 1
            `,
                    values: [tenantId, row.location_city_id],
                });
                if (cityLocation && cityLocation.lat !== null && cityLocation.lng !== null) {
                    location = {
                        lat: cityLocation.lat,
                        lng: cityLocation.lng,
                    };
                }
            }
            // Se não encontrou localização, usar valores padrão (0,0)
            // Isso indica que a localização precisa ser configurada
            const offer = await this.toOfferIndex(row, location);
            offers.push(offer);
        }
        // Filtrar por raio se fornecido
        let filteredOffers = offers;
        if (radiusKm && centerLat && centerLng) {
            filteredOffers = offers.filter((offer) => {
                const distance = this.calculateDistance(centerLat, centerLng, offer.location.latitude, offer.location.longitude);
                return distance <= radiusKm;
            });
            // Ordenar por proximidade
            filteredOffers.sort((a, b) => {
                const distA = this.calculateDistance(centerLat, centerLng, a.location.latitude, a.location.longitude);
                const distB = this.calculateDistance(centerLat, centerLng, b.location.latitude, b.location.longitude);
                return distA - distB;
            });
        }
        else if (cityId) {
            // Se não há raio, mas há cidade, ordenar por disponibilidade (em estoque primeiro)
            filteredOffers.sort((a, b) => {
                if (a.availability.inStock && !b.availability.inStock)
                    return -1;
                if (!a.availability.inStock && b.availability.inStock)
                    return 1;
                return 0;
            });
        }
        const result = {
            offers: filteredOffers,
            total: filteredOffers.length,
            filters: {
                productId,
                cityId,
                radiusKm,
                centerLat,
                centerLng,
            },
        };
        // Log estruturado de busca (observação)
        await this.logSearch(tenantId, filters, result);
        return result;
    }
    /**
     * Calcula distância em km entre dois pontos (Haversine)
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Raio da Terra em km
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
                Math.cos(this.toRad(lat2)) *
                Math.sin(dLng / 2) *
                Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    /**
     * Converte graus para radianos
     */
    toRad(degrees) {
        return (degrees * Math.PI) / 180;
    }
    /**
     * Busca ofertas por merchant
     */
    async findByMerchant(tenantId, merchantId, options) {
        const { productId, limit = 50, offset = 0 } = options || {};
        let query = `
      SELECT id, tenant_id, product_id, merchant_id, 
             location_region_id, location_city_id, price, stock, active,
             created_at, updated_at
      FROM product_offers
      WHERE tenant_id = $1
        AND merchant_id = $2
        AND active = TRUE
    `;
        const params = [tenantId, merchantId];
        if (productId) {
            query += ` AND product_id = $${params.length + 1}`;
            params.push(productId);
        }
        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, {
            text: query,
            values: params,
        });
        const offers = [];
        for (const row of rows) {
            const offer = await this.toOfferIndex(row);
            offers.push(offer);
        }
        return {
            offers,
            total: offers.length,
            filters: {
                productId,
            },
        };
    }
    /**
     * Log estruturado de busca (observação)
     */
    async logSearch(tenantId, filters, result) {
        // Log estruturado no console
        console.log(JSON.stringify({
            module: 'offer-index',
            eventType: 'offer_search',
            tenantId,
            filters,
            resultsCount: result.offers.length,
            totalResults: result.total,
            timestamp: new Date().toISOString(),
        }));
        // Registrar no Decision Log (observação)
        try {
            await decision_log_service_1.decisionLogService.createObservation('economy', 'offer_search', {
                cityId: filters.cityId,
                regionId: result.offers[0]?.regionId,
            }, 0, {
                metadata: {
                    productId: filters.productId,
                    filters,
                    resultsCount: result.offers.length,
                    totalResults: result.total,
                    merchants: result.offers.map((o) => o.merchantId),
                },
            });
        }
        catch (error) {
            // Não falhar silenciosamente - log o erro
            console.error('[OfferIndexService] Erro ao registrar busca no Decision Log:', error);
        }
    }
}
exports.offerIndexService = new OfferIndexService();
