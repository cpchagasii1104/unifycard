import { pool } from '@core/database/pool';
import { getRelatedConcepts, type GraphRelationType } from '@core/semantic/graph.adapter';
import { listTenantsOfferingConcept } from './tenant-concept-offerings.repository';

export type ContextualBundleOption = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
};

export type ContextualBundleItem = {
  conceptId: string;
  slug: string;
  domain: string;
  role: 'anchor' | 'related';
  relationType?: GraphRelationType;
  options: ContextualBundleOption[];
};

export type MarketplaceContextualResponse = {
  ok: true;
  intent: string;
  anchor: { conceptId: string; slug: string; domain: string } | null;
  bundle: ContextualBundleItem[];
};

function intentToSlug(intent: string): string {
  return intent
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function findConceptBySlug(slug: string): Promise<{ concept_id: string; slug: string; domain: string } | null> {
  const { rows } = await pool.query<{ concept_id: string; slug: string; domain: string }>(
    `
    SELECT concept_id, slug, domain
    FROM concepts
    WHERE slug = $1
    ORDER BY CASE WHEN domain = 'unificard' THEN 0 ELSE 1 END, domain ASC
    LIMIT 1
    `,
    [slug]
  );
  return rows[0] ?? null;
}

class MarketplaceContextualService {
  /**
   * Intenção em linguagem natural → conceito canónico → expansão pelo grafo global → ofertantes por concept.
   */
  async getContextualBundle(viewerTenantId: string, intentRaw: string): Promise<MarketplaceContextualResponse> {
    const intent = intentRaw.trim();
    const slug = intentToSlug(intent);
    if (!slug) {
      return {
        ok: true,
        intent,
        anchor: null,
        bundle: [],
      };
    }

    const anchor = await findConceptBySlug(slug);
    if (!anchor) {
      return {
        ok: true,
        intent,
        anchor: null,
        bundle: [],
      };
    }

    const edges = await getRelatedConcepts(anchor.concept_id);
    const seen = new Set<string>([anchor.concept_id]);
    const items: ContextualBundleItem[] = [];

    const anchorOptions = await listTenantsOfferingConcept(anchor.concept_id);
    items.push({
      conceptId: anchor.concept_id,
      slug: anchor.slug,
      domain: anchor.domain,
      role: 'anchor',
      options: anchorOptions.map((o) => ({
        tenantId: o.tenant_id,
        tenantName: o.tenant_name,
        tenantSlug: o.tenant_slug,
      })),
    });

    for (const e of edges) {
      if (seen.has(e.relatedConceptId)) {
        continue;
      }
      seen.add(e.relatedConceptId);

      const conceptRow = await pool.query<{ concept_id: string; slug: string; domain: string }>(
        `SELECT concept_id, slug, domain FROM concepts WHERE concept_id = $1::uuid LIMIT 1`,
        [e.relatedConceptId]
      );
      const c = conceptRow.rows[0];
      if (!c) {
        continue;
      }

      const options = await listTenantsOfferingConcept(c.concept_id);
      items.push({
        conceptId: c.concept_id,
        slug: c.slug,
        domain: c.domain,
        role: 'related',
        relationType: e.relationType,
        options: options.map((o) => ({
          tenantId: o.tenant_id,
          tenantName: o.tenant_name,
          tenantSlug: o.tenant_slug,
        })),
      });
    }

    return {
      ok: true,
      intent,
      anchor: {
        conceptId: anchor.concept_id,
        slug: anchor.slug,
        domain: anchor.domain,
      },
      bundle: items,
    };
  }
}

export const marketplaceContextualService = new MarketplaceContextualService();