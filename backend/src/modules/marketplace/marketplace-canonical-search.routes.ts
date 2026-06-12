// marketplace-canonical-search.routes.ts
// DECISION-0117 F/CP5 — BUSCA agrupada por IDENTIDADE canônica.
//
// A busca pública retorna o ITEM canônico (1 resultado por identidade), nunca N
// produtos duplicados quando N empresas vendem a mesma coisa. A página do item
// lista as OFERTAS empresariais (mesma defesa do reader público: canônico READY,
// oferta ativa, estoque do merchant, KYB+publicação para empresas). Comparação
// de preço SÓ entre ofertas com a MESMA unidade comercial (DECISION-0117 H —
// bases incompatíveis são separadas, nunca agregadas silenciosamente).
// Filtros/categorias seguem vindo da ontologia (/navigation/n2) — não daqui.

import type { FastifyPluginAsync } from 'fastify';
import { runQueriesWithTenant } from '@core/database/pool';
import {
  sqlCanonicalIndustrialOperationalReady,
  sqlCanonicalIdMatchesTenantContext,
  sqlOrderScopedCanonicalFirst,
} from '@core/catalog/canonical/canonical-product-readiness';
import { listVisibleProducts } from './product-visibility.service';

interface CanonicalItemRow {
  id: string;
  name: string;
  brand: string | null;
  gtin: string | null;
  category_id: string | null;
  scope: string;
  images: unknown;
}

const marketplaceCanonicalSearchRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /catalog/items/search?q=&categoryId= — itens canônicos (1 por identidade)
   * com agregação das ofertas públicas: offerCount + menor preço POR unidade.
   */
  fastify.get<{ Querystring: { q?: string; categoryId?: string; limit?: string } }>(
    '/catalog/items/search',
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const q = String(req.query.q ?? '').trim();
      const limit = Math.min(parseInt(req.query.limit ?? '20', 10) || 20, 50);

      const cpVis = sqlCanonicalIdMatchesTenantContext('cp', '$1::uuid');
      const cpReady = sqlCanonicalIndustrialOperationalReady('cp');
      const cpOrder = sqlOrderScopedCanonicalFirst('cp');
      const params: unknown[] = [tenantId, limit];
      let filter = '';
      if (q) {
        params.push(`%${q}%`);
        filter += ` AND (cp.name ILIKE $${params.length} OR cp.brand ILIKE $${params.length})`;
      }
      if (req.query.categoryId) {
        params.push(req.query.categoryId);
        filter += ` AND cp.category_id = $${params.length}::uuid`;
      }

      const items = await runQueriesWithTenant<CanonicalItemRow>(
        tenantId,
        `SELECT cp.id, cp.name, cp.brand, cp.gtin, cp.category_id, cp.scope, cp.images
           FROM canonical_products cp
          WHERE ${cpVis} AND cp.type = 'INDUSTRIAL' AND ${cpReady}
            AND cp.duplicate_of_canonical_product_id IS NULL
            ${filter}
          ORDER BY ${cpOrder}, cp.name ASC
          LIMIT $2`,
        params
      );

      const data = [];
      for (const item of items) {
        const offers = await listVisibleProducts(tenantId, { canonicalProductId: item.id, limit: 50 });
        // Agregação por unidade — preços NUNCA comparados entre unidades distintas.
        const byUnit = new Map<string, { saleUnit: string; offerCount: number; minPriceCents: number }>();
        for (const o of offers) {
          const unit = o.saleUnit ?? 'un';
          const agg = byUnit.get(unit) ?? { saleUnit: unit, offerCount: 0, minPriceCents: Number.MAX_SAFE_INTEGER };
          agg.offerCount += 1;
          agg.minPriceCents = Math.min(agg.minPriceCents, o.priceCents);
          byUnit.set(unit, agg);
        }
        data.push({
          canonicalProductId: item.id,
          name: item.name,
          brand: item.brand,
          gtin: item.gtin,
          categoryId: item.category_id,
          scope: item.scope,
          offerCount: offers.length,
          priceByUnit: [...byUnit.values()],
        });
      }
      return reply.send({ ok: true, data });
    }
  );

  /**
   * GET /catalog/items/:canonicalProductId/offers — página do item canônico →
   * lista de ofertas empresariais (modelo "1 identidade → N ofertas").
   */
  fastify.get<{ Params: { canonicalProductId: string } }>(
    '/catalog/items/:canonicalProductId/offers',
    async (req, reply) => {
      const offers = await listVisibleProducts(req.tenant.id, {
        canonicalProductId: req.params.canonicalProductId,
        limit: 50,
      });
      return reply.send({
        ok: true,
        data: offers.map((o) => ({
          offerId: o.offerId,
          merchantActorId: o.merchantActorId,
          canonicalVariantId: o.canonicalVariantId,
          internalSku: o.internalSku,
          saleUnit: o.saleUnit,
          priceCents: o.priceCents,
          availableQuantity: o.availableQuantity,
        })),
      });
    }
  );
};

export default marketplaceCanonicalSearchRoutes;
