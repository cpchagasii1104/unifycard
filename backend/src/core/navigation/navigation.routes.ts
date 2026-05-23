import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../database/pool';
import { getN1IdBySlugAndDomain, getN2ByContext } from './n2-query.adapter';
import { listOfferRowsForNavigation } from './navigation-offers.list';
import { resolveRefsBatchFromVariants } from '@modules/marketplace/adapters/concept-offer-refs.adapter';

const ALLOWED_N1_DOMAINS = new Set([
  'produtos-e-comercio',
  'servicos',
  'financas-e-economia',
]);

const navigationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: { n1?: string; context?: string; domain?: string; locale?: string };
  }>(
    '/n2',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['n1', 'context', 'domain'],
          properties: {
            n1: { type: 'string' },
            context: { type: 'string' },
            domain: { type: 'string' },
            locale: { type: 'string', default: 'pt-BR' },
          },
        },
      },
    },
    async (req, reply) => {
      const n1 = (req.query.n1 ?? '').trim().toLowerCase();
      const contextSlug = (req.query.context ?? '').trim().toLowerCase();
      const domain = (req.query.domain ?? '').trim();
      const locale = (req.query.locale ?? 'pt-BR').trim() || 'pt-BR';

      if (!n1 || !contextSlug) {
        return reply.status(400).send({ ok: false, message: 'n1 e context são obrigatórios' });
      }
      if (!ALLOWED_N1_DOMAINS.has(domain)) {
        return reply.status(400).send({
          ok: false,
          message: 'domain inválido para N2 (use produtos-e-comercio, servicos ou financas-e-economia)',
        });
      }

      const ctxCheck = await pool.query<{ n: string }>(
        `
        SELECT COUNT(*)::text AS n
        FROM context_nodes
        WHERE context_slug = $1
          AND is_active = true
          AND deprecated_at IS NULL
        `,
        [contextSlug]
      );
      if (Number(ctxCheck.rows[0]?.n ?? 0) < 1) {
        return reply.status(400).send({
          ok: false,
          message: 'context inválido ou inativo — context_slug deve existir em context_nodes (sem string livre)',
        });
      }

      const n1Id = await getN1IdBySlugAndDomain(n1, domain);
      if (!n1Id) {
        return reply.status(404).send({
          ok: false,
          message: 'n1 não encontrado para o domain informado (slug + domain_key devem existir em n1_nodes)',
        });
      }

      const items = await getN2ByContext(n1, contextSlug, { domainKey: domain, locale });

      return reply.send({
        n1,
        domain,
        context_applied: contextSlug,
        locale,
        total_count: items.length,
        n2_nodes: items.map((row) => ({
          id: row.n2Id,
          slug: row.slug,
          sort_order: row.sortOrder,
          is_default: row.isDefault,
          display_names: row.displayNames,
          name: row.displayNames[0]?.value ?? row.slug,
        })),
      });
    }
  );

  fastify.get<{
    Querystring: { domain?: string; locale?: string };
  }>(
    '/n1',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['domain'],
          properties: {
            domain: { type: 'string' },
            locale: { type: 'string', default: 'pt-BR' },
          },
        },
      },
    },
    async (req, reply) => {
      const domain = (req.query.domain ?? '').trim();
      const locale = (req.query.locale ?? 'pt-BR').trim() || 'pt-BR';

      if (!ALLOWED_N1_DOMAINS.has(domain)) {
        return reply.status(400).send({
          ok: false,
          message: 'domain inválido para N1 (use produtos-e-comercio, servicos ou financas-e-economia)',
        });
      }

      const { rows } = await pool.query<{
        n1_id: string;
        slug: string;
        display_name: string | null;
      }>(
        `
        SELECT n.n1_id, n.slug, l.display_name
        FROM n1_nodes n
        LEFT JOIN n1_localized_names l
          ON l.n1_id = n.n1_id AND l.locale = $2
        WHERE n.domain_key = $1
        ORDER BY n.sort_order ASC, n.slug ASC
        `,
        [domain, locale]
      );

      return reply.send({
        domain,
        locale,
        items: rows.map((row) => ({
          n1Id: row.n1_id,
          slug: row.slug,
          name: row.display_name ?? row.slug,
        })),
      });
    }
  );

  fastify.get<{
    Querystring: {
      n1?: string;
      context?: string;
      domain?: string;
      n2?: string;
      limit?: string;
      offset?: string;
    };
  }>(
    '/offers',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['n1', 'context', 'domain', 'n2'],
          properties: {
            n1: { type: 'string' },
            context: { type: 'string' },
            domain: { type: 'string' },
            n2: { type: 'string' },
            limit: { type: 'string' },
            offset: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return reply.status(400).send({ ok: false, message: 'tenant obrigatório' });
      }

      const n1 = (req.query.n1 ?? '').trim().toLowerCase();
      const contextSlug = (req.query.context ?? '').trim().toLowerCase();
      const domain = (req.query.domain ?? '').trim();
      const n2 = (req.query.n2 ?? '').trim().toLowerCase();

      const limitRaw = req.query.limit;
      const offsetRaw = req.query.offset;
      const limit =
        limitRaw === undefined || limitRaw === ''
          ? 50
          : Number.parseInt(String(limitRaw), 10);
      const offset =
        offsetRaw === undefined || offsetRaw === ''
          ? 0
          : Number.parseInt(String(offsetRaw), 10);

      if (
        !Number.isFinite(limit) ||
        !Number.isFinite(offset) ||
        limit < 1 ||
        limit > 100 ||
        offset < 0 ||
        !Number.isInteger(limit) ||
        !Number.isInteger(offset)
      ) {
        return reply.status(400).send({ ok: false, code: 'INVALID_PAGINATION' });
      }

      if (!n1 || !contextSlug || !n2) {
        return reply.status(400).send({ ok: false, message: 'n1, context e n2 são obrigatórios' });
      }
      if (!ALLOWED_N1_DOMAINS.has(domain)) {
        return reply.status(400).send({
          ok: false,
          message: 'domain inválido para ofertas (use produtos-e-comercio, servicos ou financas-e-economia)',
        });
      }

      const ctxCheck = await pool.query<{ n: string }>(
        `
        SELECT COUNT(*)::text AS n
        FROM context_nodes
        WHERE context_slug = $1
          AND is_active = true
          AND deprecated_at IS NULL
        `,
        [contextSlug]
      );
      if (Number(ctxCheck.rows[0]?.n ?? 0) < 1) {
        return reply.status(400).send({
          ok: false,
          message: 'context inválido ou inativo — context_slug deve existir em context_nodes',
        });
      }

      const n1Id = await getN1IdBySlugAndDomain(n1, domain);
      if (!n1Id) {
        return reply.status(404).send({
          ok: false,
          message: 'n1 não encontrado para o domain informado',
        });
      }

      const { rows, totalCount } = await listOfferRowsForNavigation(tenantId, {
        n1,
        context: contextSlug,
        n2,
        domain,
        limit,
        offset,
      });

      const variantIds = rows.map((r) => r.product_variant_id);
      const refsBatch = await resolveRefsBatchFromVariants(tenantId, variantIds);

      const items = rows.map((row) => {
        const refs =
          refsBatch.get(row.product_variant_id) ?? {
            concept_ref: null,
            offer_ref: null,
            resolution: 'failed' as const,
          };
        const base: Record<string, unknown> = {
          product_id: row.product_id,
          product_variant_id: row.product_variant_id,
          product_name: row.product_name,
          sku: row.sku,
          concept_ref: refs.concept_ref,
          offer_ref: refs.offer_ref,
        };
        if (refs.resolution !== 'ok') {
          req.log.warn({
            code: 'OFFER_REF_RESOLUTION',
            tenant_id: tenantId,
            offer_ref: row.product_variant_id,
            resolution: refs.resolution,
            ...(refs.failureReason ? { failure_reason: refs.failureReason } : {}),
          });
          base.resolution = refs.resolution;
          if (refs.failureReason) {
            base.failure_reason = refs.failureReason;
          }
        }
        return base;
      });

      return reply.send({
        ok: true,
        n1,
        domain,
        context_applied: contextSlug,
        n2,
        limit,
        offset,
        total_count: totalCount,
        items,
      });
    }
  );
};

export default navigationRoutes;