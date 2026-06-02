// src/scripts/backfill-neighborhood-display-text.ts
// F-GEO-4b (DECISION-0079): migra o bairro TEXTUAL de `profiles.metadata.address.neighborhood` para
// `addresses.neighborhood_display_text` (destino de exibição controlado criado na F-GEO-4a).
//
// 🔴 Casamento: profile → user-actor (actor_type='user', tenant_id+user_id) → assignment profile/RESIDENCE
//    primário VIGENTE (is_primary=true, valid_until_at IS NULL) → address.
// 🔴 Preserva o blob (NÃO limpa metadata.address — isso é a F-GEO-4d). NÃO toca core.service, frontend,
//    city/state/source, neighborhood_id (FK), neighborhoods, PJ/Companies, actor_active_location.
// 🔴 Idempotente: re-run não duplica nem sobrescreve. Conflito (valor canônico ≠ blob, ambos não-vazios)
//    é REPORTADO e NÃO sobrescrito (sem overwrite cego).
//
// Uso manual: pnpm --dir backend tsx src/scripts/backfill-neighborhood-display-text.ts
import 'dotenv/config';
import { pool } from '@core/database/pool';
import { locationRepository } from '@core/location/location.repository';

export interface NeighborhoodBackfillReport {
  scanned: number;     // profiles com bairro textual não-vazio no blob
  migrated: number;    // address.neighborhood_display_text preenchido a partir do blob
  skipped: number;     // sem residência canônica / já igual / bairro vazio
  conflicts: number;   // valor canônico já existente e diferente do blob (não sobrescrito)
}

function nz(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export async function runBackfill(): Promise<NeighborhoodBackfillReport> {
  const report: NeighborhoodBackfillReport = { scanned: 0, migrated: 0, skipped: 0, conflicts: 0 };

  // Perfis com bairro textual não-vazio no blob.
  const rows = (
    await pool.query<{ tenant_id: string; user_id: string; blob_neighborhood: string | null }>(
      `
      SELECT p.tenant_id, p.user_id,
             p.metadata->'address'->>'neighborhood' AS blob_neighborhood
      FROM profiles p
      WHERE p.metadata ? 'address'
        AND NULLIF(BTRIM(COALESCE(p.metadata->'address'->>'neighborhood','')), '') IS NOT NULL
      ORDER BY p.created_at ASC
      `
    )
  ).rows;

  for (const r of rows) {
    report.scanned++;
    const blobNeighborhood = nz(r.blob_neighborhood);
    if (!blobNeighborhood) { report.skipped++; continue; }

    // profile → user-actor (actor_type='user').
    const actorRes = await pool.query<{ actor_id: string }>(
      `SELECT actor_id FROM actors WHERE actor_type = 'user' AND tenant_id = $1 AND user_id = $2 LIMIT 1`,
      [r.tenant_id, r.user_id]
    );
    const actorId = actorRes.rows[0]?.actor_id;
    if (!actorId) { report.skipped++; continue; }

    // residência primária vigente (com o valor canônico atual de bairro).
    const geo = await locationRepository.findPrimaryResidenceGeoByOwner('profile', actorId, 'RESIDENCE');
    if (!geo) { report.skipped++; continue; }

    const current = nz(geo.neighborhoodDisplayText);
    if (current === blobNeighborhood) { report.skipped++; continue; } // idempotente: já migrado
    if (current && current !== blobNeighborhood) {                    // conflito: não sobrescrever cego
      console.warn(
        `[backfill-neighborhood] CONFLITO address=${geo.addressId} canonico="${current}" blob="${blobNeighborhood}" — preservado (não sobrescrito)`
      );
      report.conflicts++;
      continue;
    }

    // current == null → preencher
    await locationRepository.updateAddressNeighborhoodDisplayText(geo.addressId, blobNeighborhood);
    report.migrated++;
  }

  return report;
}

// CLI (ESM): roda só quando invocado diretamente.
if (process.argv[1] && process.argv[1].includes('backfill-neighborhood-display-text')) {
  runBackfill()
    .then((r) => {
      console.log('[backfill-neighborhood-display-text]', JSON.stringify(r));
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[backfill-neighborhood-display-text] erro:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
