/**
 * Relatório dry-run: rides_vehicles → slug (brand+model) → concepts.
 *
 * Duas visões no mesmo JSON:
 * - all_domains: slug sem filtro (diagnóstico; expõe colisão cross-domain).
 * - strict_vehicle_domain: só `concepts.domain` esperado para veículo (operacional).
 *
 * Esquema: UNIQUE(domain, slug) em `concepts` → não existem "2+ no mesmo domain";
 *   ambiguidade = mesmo slug em domínios N0 diferentes.
 *
 * - Não faz UPDATE / INSERT.
 * Uso:
 *   pnpm report:rides-vehicles-concept-map
 *   RIDES_VEHICLE_CONCEPT_DOMAIN=mobilidade-e-logistica pnpm report:rides-vehicles-concept-map
 *   pnpm exec tsx src/scripts/report-rides-vehicles-concept-mapping.ts -- --strict-domain=outro-n0
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { normalizeConceptSlug } from '../core/ontology/concept-governance.service';
import { getDefaultConceptDomain } from '../modules/concept-resolution/concept-resolution-context';

dotenv.config({ path: join(process.cwd(), '.env') });

type VehicleRow = {
  vehicle_id: string;
  tenant_id: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
  concept_id: string | null;
};

type ConceptHit = { concept_id: string; domain: string; slug: string };

function parseStrictDomainArg(): string | null {
  const prefix = '--strict-domain=';
  const a = process.argv.find((x) => x.startsWith(prefix));
  if (!a) return null;
  const v = a.slice(prefix.length).trim();
  return v || null;
}

async function tableExists(name: string): Promise<boolean> {
  const r = await pool.query<{ n: string }>(
    `
    SELECT COUNT(*)::text AS n
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = $1
    `,
    [name]
  );
  return Number(r.rows[0]?.n ?? 0) >= 1;
}

async function columnExists(table: string, col: string): Promise<boolean> {
  const r = await pool.query<{ n: string }>(
    `
    SELECT COUNT(*)::text AS n
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    `,
    [table, col]
  );
  return Number(r.rows[0]?.n ?? 0) >= 1;
}

/** slug → todas as linhas em concepts com esse slug (vários domains possíveis). */
async function loadConceptsBySlugs(slugs: string[]): Promise<Map<string, ConceptHit[]>> {
  const map = new Map<string, ConceptHit[]>();
  if (slugs.length === 0) return map;

  const r = await pool.query<ConceptHit>(
    `
    SELECT concept_id::text AS concept_id, domain::text AS domain, slug::text AS slug
    FROM concepts
    WHERE slug = ANY($1::text[])
    ORDER BY slug ASC, domain ASC
    `,
    [slugs]
  );
  for (const row of r.rows) {
    const list = map.get(row.slug) ?? [];
    list.push(row);
    map.set(row.slug, list);
  }
  return map;
}

type Eligible = {
  vehicle: VehicleRow;
  slug: string;
};

function classifyAllDomains(hits: ConceptHit[]): 'none' | 'unique' | 'ambiguous' {
  if (hits.length === 0) return 'none';
  if (hits.length === 1) return 'unique';
  return 'ambiguous';
}

async function main(): Promise<void> {
  const strictDomain =
    parseStrictDomainArg() ??
    process.env.RIDES_VEHICLE_CONCEPT_DOMAIN?.trim() ??
    getDefaultConceptDomain('vehicle');

  const hasTable = await tableExists('rides_vehicles');
  if (!hasTable) {
    console.log(JSON.stringify({ ok: false, reason: 'table_rides_vehicles_missing', summary: {} }, null, 2));
    process.exit(0);
  }

  const hasConceptCol = await columnExists('rides_vehicles', 'concept_id');
  const conceptSelect = hasConceptCol ? 'v.concept_id' : 'NULL::uuid AS concept_id';

  const { rows: vehicles } = await pool.query<VehicleRow>(
    `
    SELECT
      v.vehicle_id::text AS vehicle_id,
      v.tenant_id::text AS tenant_id,
      v.brand,
      v.model,
      v.year,
      v.plate,
      ${conceptSelect}
    FROM rides_vehicles v
    `
  );

  const skipped: Array<{
    vehicle_id: string;
    reason: string;
    brand: string | null;
    model: string | null;
    concept_id: string | null;
  }> = [];

  const eligible: Eligible[] = [];

  for (const v of vehicles) {
    if (v.concept_id) {
      skipped.push({
        vehicle_id: v.vehicle_id,
        reason: 'already_has_concept_id',
        brand: v.brand,
        model: v.model,
        concept_id: v.concept_id,
      });
      continue;
    }

    const b = v.brand?.trim() ?? '';
    const m = v.model?.trim() ?? '';
    if (!b || !m) {
      skipped.push({
        vehicle_id: v.vehicle_id,
        reason: 'missing_brand_or_model',
        brand: v.brand,
        model: v.model,
        concept_id: null,
      });
      continue;
    }

    const slug = normalizeConceptSlug(`${b} ${m}`);
    if (!slug) {
      skipped.push({
        vehicle_id: v.vehicle_id,
        reason: 'empty_slug_after_normalize',
        brand: v.brand,
        model: v.model,
        concept_id: null,
      });
      continue;
    }

    eligible.push({ vehicle: v, slug });
  }

  const uniqueSlugs = [...new Set(eligible.map((e) => e.slug))];
  const slugToHits = await loadConceptsBySlugs(uniqueSlugs);

  const allMappable: Array<{
    vehicle_id: string;
    tenant_id: string;
    plate: string | null;
    brand: string | null;
    model: string | null;
    slug: string;
    concept_id: string;
    domain: string;
    /** `false` → backfill de rides não deve usar só esta linha all_domains. */
    matches_strict_vehicle_domain: boolean;
  }> = [];

  const allAmbiguous: Array<{ vehicle_id: string; slug: string; hits: ConceptHit[] }> = [];

  const allUnresolved: Array<{
    vehicle_id: string;
    tenant_id: string;
    plate: string | null;
    brand: string | null;
    model: string | null;
    slug: string;
    note: string;
  }> = [];

  const strictMappable: typeof allMappable = [];
  const strictUnresolvedNoConcept: typeof allUnresolved = [];
  const strictUnresolvedForeignOnly: Array<{
    vehicle_id: string;
    tenant_id: string;
    plate: string | null;
    brand: string | null;
    model: string | null;
    slug: string;
    strict_domain: string;
    foreign_domain_hits: ConceptHit[];
    note: string;
  }> = [];

  for (const { vehicle: v, slug } of eligible) {
    const hits = slugToHits.get(slug) ?? [];

    const ad = classifyAllDomains(hits);
    if (ad === 'none') {
      allUnresolved.push({
        vehicle_id: v.vehicle_id,
        tenant_id: v.tenant_id,
        plate: v.plate,
        brand: v.brand,
        model: v.model,
        slug,
        note: 'no_concept_with_slug — candidato a fila / ontologia (não inserir automático)',
      });
    } else if (ad === 'unique') {
      const h = hits[0]!;
      allMappable.push({
        vehicle_id: v.vehicle_id,
        tenant_id: v.tenant_id,
        plate: v.plate,
        brand: v.brand,
        model: v.model,
        slug,
        concept_id: h.concept_id,
        domain: h.domain,
        matches_strict_vehicle_domain: h.domain === strictDomain,
      });
    } else {
      allAmbiguous.push({ vehicle_id: v.vehicle_id, slug, hits });
    }

    const inStrict = hits.filter((h) => h.domain === strictDomain);
    if (inStrict.length === 1) {
      const h = inStrict[0]!;
      strictMappable.push({
        vehicle_id: v.vehicle_id,
        tenant_id: v.tenant_id,
        plate: v.plate,
        brand: v.brand,
        model: v.model,
        slug,
        concept_id: h.concept_id,
        domain: h.domain,
        matches_strict_vehicle_domain: true,
      });
    } else if (inStrict.length === 0) {
      if (hits.length === 0) {
        strictUnresolvedNoConcept.push({
          vehicle_id: v.vehicle_id,
          tenant_id: v.tenant_id,
          plate: v.plate,
          brand: v.brand,
          model: v.model,
          slug,
          note: `no_concept_in_domain — domain esperado para veículo: ${strictDomain}`,
        });
      } else {
        strictUnresolvedForeignOnly.push({
          vehicle_id: v.vehicle_id,
          tenant_id: v.tenant_id,
          plate: v.plate,
          brand: v.brand,
          model: v.model,
          slug,
          strict_domain: strictDomain,
          foreign_domain_hits: hits,
          note:
            'slug existe apenas fora do domain esperado — não usar para backfill de rides sem decisão normativa',
        });
      }
    }
    // inStrict.length > 1 impossível com UNIQUE(domain, slug); ignorar
  }

  const report = {
    ok: true,
    meta: {
      strict_vehicle_domain: strictDomain,
      schema_note:
        'concepts tem UNIQUE(domain, slug): ambiguidade all_domains = colisão cross-domain; não há 2+ linhas no mesmo domain para o mesmo slug.',
      env_override: 'RIDES_VEHICLE_CONCEPT_DOMAIN ou --strict-domain=',
    },
    summary_all_domains: {
      total_vehicles: vehicles.length,
      eligible_for_mapping: eligible.length,
      mappable_count: allMappable.length,
      mappable_not_in_strict_vehicle_domain_count: allMappable.filter((r) => !r.matches_strict_vehicle_domain)
        .length,
      ambiguous_cross_domain_count: allAmbiguous.length,
      unresolved_count: allUnresolved.length,
      skipped_count: skipped.length,
      concept_column_present: hasConceptCol,
    },
    summary_strict_vehicle_domain: {
      strict_domain: strictDomain,
      mappable_count: strictMappable.length,
      unresolved_no_concept_in_domain_count: strictUnresolvedNoConcept.length,
      unresolved_only_foreign_domain_count: strictUnresolvedForeignOnly.length,
    },
    views: {
      all_domains: {
        mappable: allMappable,
        ambiguous_cross_domain: allAmbiguous,
        unresolved: allUnresolved,
      },
      strict_vehicle_domain: {
        mappable: strictMappable,
        unresolved_no_concept_in_domain: strictUnresolvedNoConcept,
        unresolved_only_foreign_domain: strictUnresolvedForeignOnly,
      },
    },
    skipped,
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());