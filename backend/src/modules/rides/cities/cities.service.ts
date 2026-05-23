// src/modules/rides/cities/cities.service.ts

import { runQueryWithTenant, runQueriesWithTenant, runTenantTransactionWithClient } from '@core/db';
import { BadRequestError, NotFoundError } from '@core/errors';
import { publishRideEventOutbox } from '../shared/publish-ride-event';

type CityRow = {
  city_id: string;
  tenant_id: string;
  name: string;
  state: string;
  timezone: string | null;
  lat: number | null;
  lng: number | null;
  base_fare: number | null;
  min_price: number | null;
  price_per_km: number | null;
  price_per_min: number | null;
  isEnabled: boolean;
  allows_multi_stop: boolean;
};

export class CitiesService {
  // ============================================================================
  // 🔹 1. Criar uma nova cidade
  // ============================================================================
  async createCity(tenantId: string, data: any) {
    const {
      name,
      state,
      timezone,
      lat,
      lng,
      base_fare,
      min_price,
      price_per_km,
      price_per_min,
      isEnabled = true,
      allows_multi_stop = true,
    } = data;

    if (!name || !state) {
      throw new BadRequestError('Nome e estado são obrigatórios.');
    }

    const exists = await runQueryWithTenant<{ exists: string }>(
      tenantId,
      {
        text: `
        SELECT 1 AS exists
        FROM rides_cities
        WHERE tenant_id = $1 AND LOWER(name) = LOWER($2)
        LIMIT 1
        `,
        values: [tenantId, name],
      }
    );

    if (exists) {
      throw new BadRequestError('Uma cidade com este nome já existe.');
    }

    return runTenantTransactionWithClient(tenantId, async (client) => {
      const res = await client.query(
        `
        INSERT INTO rides_cities (
          tenant_id,
          name, state, timezone,
          lat, lng,
          base_fare, min_price, price_per_km, price_per_min,
          enabled,           allows_multi_stop,
          created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
        RETURNING *
        `,
        [
          tenantId,
          name,
          state,
          timezone,
          lat,
          lng,
          base_fare,
          min_price,
          price_per_km,
          price_per_min,
          isEnabled,
          allows_multi_stop,
        ]
      );
      const city = res.rows[0] as CityRow;
      if (!city) {
        throw new Error('Falha ao criar cidade');
      }
      await publishRideEventOutbox(client, {
        type: 'rides.city.created',
        tenantId,
        payload: {
          cityId: city.city_id,
          name: city.name,
        },
      });
      return city;
    });
  }

  // ============================================================================
  // 🔹 2. Atualizar uma cidade
  // ============================================================================
  async updateCity(tenantId: string, cityId: string, patch: any) {
    await this.getCity(tenantId, cityId);

    return runTenantTransactionWithClient(tenantId, async (client) => {
      const res = await client.query(
        `
        UPDATE rides_cities
        SET
          name = COALESCE($3, name),
          state = COALESCE($4, state),
          timezone = COALESCE($5, timezone),
          lat = COALESCE($6, lat),
          lng = COALESCE($7, lng),
          base_fare = COALESCE($8, base_fare),
          min_price = COALESCE($9, min_price),
          price_per_km = COALESCE($10, price_per_km),
          price_per_min = COALESCE($11, price_per_min),
          enabled = COALESCE($12, enabled),
          allows_multi_stop = COALESCE($13, allows_multi_stop),
          updated_at = now()
        WHERE tenant_id = $1 AND city_id = $2
        RETURNING *
        `,
        [
          tenantId,
          cityId,
          patch.name,
          patch.state,
          patch.timezone,
          patch.lat,
          patch.lng,
          patch.base_fare,
          patch.min_price,
          patch.price_per_km,
          patch.price_per_min,
          patch.isEnabled,
          patch.allows_multi_stop,
        ]
      );
      const updated = res.rows[0] as CityRow;
      if (!updated) {
        throw new Error('Falha ao atualizar cidade');
      }
      await publishRideEventOutbox(client, {
        type: 'rides.city.updated',
        tenantId,
        payload: {
          cityId,
        },
      });
      return updated;
    });
  }

  // ============================================================================
  // 🔹 3. Listar cidades
  // ============================================================================
  async listCities(tenantId: string) {
    return runQueriesWithTenant<CityRow>(
      tenantId,
      {
        text: `
        SELECT *
        FROM rides_cities
        WHERE tenant_id = $1
        ORDER BY name ASC
        `,
        values: [tenantId],
      }
    );
  }

  // ============================================================================
  // 🔹 4. Obter cidade
  // ============================================================================
  async getCity(tenantId: string, cityId: string) {
    const city = await runQueryWithTenant<CityRow>(
      tenantId,
      {
        text: `
        SELECT *
        FROM rides_cities
        WHERE tenant_id = $1 AND city_id = $2
        `,
        values: [tenantId, cityId],
      }
    );

    if (!city) {
      throw new NotFoundError('Cidade não encontrada.');
    }

    return city;
  }

  // ============================================================================
  // 🔹 5. Deletar cidade (apenas se não houver zonas associadas)
  // ============================================================================
  async deleteCity(tenantId: string, cityId: string) {
    const zones = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `SELECT COUNT(*) FROM rides_zones WHERE tenant_id = $1 AND city_id = $2`,
        values: [tenantId, cityId],
      }
    );

    if (zones && +zones.count > 0) {
      throw new BadRequestError('Não é possível excluir uma cidade com zonas cadastradas.');
    }

    await runTenantTransactionWithClient(tenantId, async (client) => {
      await client.query(
        `
        DELETE FROM rides_cities
        WHERE tenant_id = $1 AND city_id = $2
        `,
        [tenantId, cityId]
      );

      await publishRideEventOutbox(client, {
        type: 'rides.city.deleted',
        tenantId,
        payload: { cityId },
      });
    });

    return { ok: true };
  }
}

export const citiesService = new CitiesService();
