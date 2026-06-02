// src/scripts/backfill-geo-enrichment.ts
// F-GEO-1b (DECISION-0078): backfill idempotente de enriquecimento geográfico de `addresses` existentes.
//
// Seleciona addresses com `postal_code IS NOT NULL` e (`state_id IS NULL` OR `city_id IS NULL`) e chama
// `geoEnrichmentService.enrichAddress` (cache-first + fail-open). NÃO chama API externa por si — o provider
// é o default (Null, a menos que CEP_PROVIDER=brasilapi). Para prova SEM REDE, injete um MockCepProvider via
// `runBackfill(new GeoEnrichmentService(mock))`. NÃO limpa blob, NÃO toca neighborhoods/PJ/Companies.
//
// Uso manual (provider real, opt-in explícito): CEP_PROVIDER=brasilapi pnpm tsx src/scripts/backfill-geo-enrichment.ts
import 'dotenv/config';
import { pool } from '@core/database/pool';
import { geoEnrichmentService, GeoEnrichmentService } from '@core/location/geo-enrichment.service';

export interface GeoBackfillReport {
  scanned: number;
  enriched: number;
  skipped: number;
  failed: number;
}

/** Idempotente: re-run só processa addresses ainda sem state_id/city_id; cache/cidade não duplicam. */
export async function runBackfill(svc: GeoEnrichmentService = geoEnrichmentService): Promise<GeoBackfillReport> {
  const report: GeoBackfillReport = { scanned: 0, enriched: 0, skipped: 0, failed: 0 };
  const rows = (
    await pool.query<{ address_id: string; postal_code: string | null }>(
      `
      SELECT address_id, postal_code
      FROM addresses
      WHERE postal_code IS NOT NULL
        AND (state_id IS NULL OR city_id IS NULL)
      ORDER BY created_at ASC
      `
    )
  ).rows;

  for (const r of rows) {
    report.scanned++;
    try {
      const res = await svc.enrichAddress(r.address_id, r.postal_code);
      if (res.enriched) report.enriched++;
      else report.skipped++;
    } catch {
      report.failed++;
    }
  }
  return report;
}

// CLI (ESM): roda só quando invocado diretamente (não no import da probe).
if (process.argv[1] && process.argv[1].includes('backfill-geo-enrichment')) {
  runBackfill()
    .then((r) => {
      console.log('[backfill-geo-enrichment]', JSON.stringify(r));
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[backfill-geo-enrichment] erro:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
