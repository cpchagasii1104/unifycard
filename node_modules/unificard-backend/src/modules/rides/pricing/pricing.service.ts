// src/modules/rides/pricing/pricing.service.ts

import { runQueryWithTenant, runQueriesWithTenant } from "@core/db";
import { eventBus } from "@core/events/event-bus";
import { BadRequestError } from "@core/errors";

export class PricingService {

  // ================================================================================
  // 🔹 1. Calcular preço ESTIMADO da corrida
  // ================================================================================
  async calculateEstimatedPrice(tenantId: string, requestId: string) {
    const req = await runQueryWithTenant<any>(
      tenantId,
      {
        text: `
      SELECT 
        request_id, tenant_id,
        origin, destination,
        passenger_count,
        stops,
        service_type_id
      FROM rides_ride_requests
      WHERE tenant_id = $1 AND request_id = $2
      `,
        values: [tenantId, requestId],
      }
    );

    if (!req) {
      throw new BadRequestError('Request not found');
    }

    // --------------------------------------------------------------------------------------------
    // 1. Calcular distância total (origem → paradas → destino)
    // --------------------------------------------------------------------------------------------
    const totalDistanceKm = await this.calculateRouteDistance(tenantId, req);

    // --------------------------------------------------------------------------------------------
    // 2. Buscar config base de pricing
    // --------------------------------------------------------------------------------------------
    const cfg = await this.getCityPricingConfig(tenantId, req.service_type_id);

    // --------------------------------------------------------------------------------------------
    // 3. Aplicar faixas de distância (tiers)
    // --------------------------------------------------------------------------------------------
    const distanceCost = await this.applyDistanceTiers(
      tenantId,
      cfg.city_id,
      totalDistanceKm
    );

    // --------------------------------------------------------------------------------------------
    // 4. Ajustes dinâmicos (horário, clima, trânsito)
    // --------------------------------------------------------------------------------------------
    const dynamicAdj = await this.getDynamicAdjustments(
      tenantId,
      cfg.city_id
    );

    // --------------------------------------------------------------------------------------------
    // 5. Incentivo de zona (caso a origem esteja em zona de alta demanda)
    // --------------------------------------------------------------------------------------------
    const zoneIncentive = await this.getZoneIncentive(
      tenantId,
      req.origin
    );

    // --------------------------------------------------------------------------------------------
    // 6. Combinar preço final estimado
    // --------------------------------------------------------------------------------------------
    const total =
      cfg.base_fare +
      distanceCost +
      cfg.time_rate_per_minute * 10 + // estimado
      dynamicAdj +
      zoneIncentive;

    const estimate = {
      total: Number(total.toFixed(2)),
      currency: cfg.currency,
      base_fare: cfg.base_fare,
      distance_cost: distanceCost,
      dynamic_adjustments: dynamicAdj,
      zone_incentive: zoneIncentive,
      distance_km: totalDistanceKm,
    };

    return estimate;
  }

  // ================================================================================
  // 🔹 2. Calcular preço FINAL (usado ao completar a corrida)
  // ================================================================================
  async calculateFinalPrice(tenantId: string, rideId: string) {
    const ride = await runQueryWithTenant<any>(
      tenantId,
      {
        text: `
      SELECT 
        ride_id, tenant_id,
        origin, destination, stops,
        service_type_id
      FROM rides_rides
      WHERE tenant_id = $1 AND ride_id = $2
      `,
        values: [tenantId, rideId],
      }
    );

    if (!ride) {
      throw new BadRequestError('Ride not found');
    }

    // Distância final real via tracking
    const distanceKm = await this.calculateRideDistance(tenantId, rideId);

    const cfg = await this.getCityPricingConfig(tenantId, ride.service_type_id);

    const distanceCost = await this.applyDistanceTiers(
      tenantId,
      cfg.city_id,
      distanceKm
    );

    const dynamicAdj = await this.getDynamicAdjustments(
      tenantId,
      cfg.city_id
    );

    const total =
      cfg.base_fare +
      distanceCost +
      dynamicAdj +
      cfg.time_rate_per_minute * 12;

    const finalPrice = {
      total: Number(total.toFixed(2)),
      currency: cfg.currency,
      base_fare: cfg.base_fare,
      distance_cost: distanceCost,
      dynamic_adjustments: dynamicAdj,
      distance_km: distanceKm,
    };

    // Emitir evento
    await eventBus.emit({
      type: "rides.pricing.calculated",
      tenantId,
      payload: {
        rideId,
        finalPrice,
      },
    });

    return finalPrice;
  }

  // ================================================================================
  // 🔹 3. Cálculo de distância (request → estimado)
  // ================================================================================
  async calculateRouteDistance(tenantId: string, req: any) {
    let distanceMeters = 0;

    // Origem → primeira parada
    let previousPoint = req.origin;

    // Paradas intermediárias
    for (const stop of req.stops || []) {
      const d = await runQueryWithTenant<{ dist: number }>(
        tenantId,
        {
          text: `
        SELECT ST_Distance(
          $1::geography,
          ST_SetSRID(ST_MakePoint($3,$2),4326)::geography
        ) AS dist
        `,
          values: [
            previousPoint,
            stop.lat,
            stop.lng,
          ],
        }
      );

      if (d) {
        distanceMeters += d.dist;
      }
      previousPoint = stop;
    }

    // Última parada → destino
    const finalLeg = await runQueryWithTenant<{ dist: number }>(
      tenantId,
      {
        text: `
      SELECT ST_Distance(
        $1::geography,
        ST_SetSRID(ST_MakePoint($3,$2),4326)::geography
      ) AS dist
      `,
        values: [
          previousPoint,
          req.destination.lat,
          req.destination.lng,
        ],
      }
    );

    if (finalLeg) {
      distanceMeters += finalLeg.dist;
    }

    return +(distanceMeters / 1000).toFixed(2);
  }

  // ================================================================================
  // 🔹 4. Cálculo de distância REAL da corrida (tracking)
  // ================================================================================
  async calculateRideDistance(tenantId: string, rideId: string) {
    const points = await runQueriesWithTenant<{ location: any }>(
      tenantId,
      {
        text: `
      SELECT location
      FROM rides_ride_locations
      WHERE tenant_id = $1 AND ride_id = $2
      ORDER BY created_at ASC
      `,
        values: [tenantId, rideId],
      }
    );

    if (points.length < 2) return 0;

    let meters = 0;

    for (let i = 1; i < points.length; i++) {
      const d = await runQueryWithTenant<{ dist: number }>(
        tenantId,
        {
          text: `
        SELECT ST_Distance($1::geography, $2::geography) AS dist
        `,
          values: [points[i - 1].location, points[i].location],
        }
      );

      if (d) {
        meters += d.dist;
      }
    }

    return +(meters / 1000).toFixed(2);
  }

  // ================================================================================
  // 🔹 5. Buscar configuração da cidade
  // ================================================================================
  async getCityPricingConfig(tenantId: string, serviceTypeId: string) {
    const cfg = await runQueryWithTenant<any>(
      tenantId,
      {
        text: `
      SELECT *
      FROM rides_pricing_config
      WHERE tenant_id = $1
        AND service_type_id = $2
      `,
        values: [tenantId, serviceTypeId],
      }
    );

    if (!cfg) {
      throw new BadRequestError('Pricing config not found');
    }

    return cfg;
  }

  // ================================================================================
  // 🔹 6. Aplicar tiers de distância (km)
  // ================================================================================
  async applyDistanceTiers(tenantId: string, cityId: string, distanceKm: number) {
    const tiers = await runQueriesWithTenant<any>(
      tenantId,
      {
        text: `
      SELECT *
      FROM rides_pricing_distance_tiers
      WHERE tenant_id = $1 AND city_id = $2
      ORDER BY km_from ASC
      `,
        values: [tenantId, cityId],
      }
    );

    let cost = 0;

    for (const tier of tiers) {
      if (distanceKm > tier.km_from) {
        const kmInTier =
          Math.min(distanceKm, tier.km_to) - tier.km_from;

        cost += kmInTier * tier.price_per_km;
      }
    }

    return Number(cost.toFixed(2));
  }

  // ================================================================================
  // 🔹 7. Ajustes dinâmicos (surge, clima, trânsito)
  // ================================================================================
  async getDynamicAdjustments(tenantId: string, cityId: string) {
    const row = await runQueryWithTenant<{ adj: string | null }>(
      tenantId,
      {
        text: `
      SELECT SUM(adjustment_value) AS adj
      FROM rides_pricing_adjustments
      WHERE tenant_id = $1
        AND city_id = $2
        AND active = true
        AND starts_at <= now()
        AND expires_at >= now()
      `,
        values: [tenantId, cityId],
      }
    );

    return Number(row?.adj || 0);
  }

  // ================================================================================
  // 🔹 8. Incentivos automáticos por zona quente
  // ================================================================================
  async getZoneIncentive(tenantId: string, originPoint: any) {
    const zone = await runQueryWithTenant<{ zone_id: string }>(
      tenantId,
      {
        text: `
      SELECT zone_id
      FROM rides_zones
      WHERE tenant_id = $1
        AND ST_Contains(
          polygon,
          ST_SetSRID(ST_MakePoint($3,$2),4326)
        )
      LIMIT 1
      `,
        values: [tenantId, originPoint.lat, originPoint.lng],
      }
    );

    if (!zone) return 0;

    const incentive = await runQueryWithTenant<{ incentive_value: number }>(
      tenantId,
      {
        text: `
      SELECT incentive_value
      FROM rides_zone_incentives
      WHERE tenant_id = $1
        AND zone_id = $2
        AND is_active = true
        AND starts_at <= now()
        AND expires_at >= now()
      ORDER BY starts_at DESC
      LIMIT 1
      `,
        values: [tenantId, zone.zone_id],
      }
    );

    return Number(incentive?.incentive_value || 0);
  }

  // ================================================================================
  // 🔹 9. Calcular estimativa simplificada
  // ================================================================================
  async calculateEstimate(
    tenantId: string,
    cityId: string,
    data: {
      origin: { lat: number; lng: number };
      destination: { lat: number; lng: number };
      stops?: Array<{ lat: number; lng: number }>;
      passenger_count?: number;
      service_type_id?: string;
    }
  ) {
    // Implementação simplificada - pode ser melhorada
    const baseFare = 4.0;
    const costPerKm = 2.0;
    const costPerMin = 0.5;
    
    // Distância estimada (simplificada)
    const distanceKm = 5.0; // placeholder
    const durationMin = 10; // placeholder
    
    const total = baseFare + (costPerKm * distanceKm) + (costPerMin * durationMin);
    
    return {
      total: Number(total.toFixed(2)),
      currency: 'BRL',
      base_fare: baseFare,
      distance_cost: costPerKm * distanceKm,
      dynamic_adjustments: 0,
      zone_incentive: 0,
      distance_km: distanceKm,
    };
  }
}

export const pricingService = new PricingService();
