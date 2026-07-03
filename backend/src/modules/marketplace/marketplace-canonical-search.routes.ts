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
import { searchCanonicalItems } from './canonical-item-search.service';
import { listVisibleProducts } from './product-visibility.service';

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

      // 🔵 F-GLOBAL-SEARCH-OMNI: SELECT canônico extraído p/ canonical-item-search.service
      // (Lei de Coerência — 1 verdade, 2 callers: esta rota + o omnibox /search).
      const items = await searchCanonicalItems(tenantId, {
        q,
        categoryId: req.query.categoryId,
        limit,
      });

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
