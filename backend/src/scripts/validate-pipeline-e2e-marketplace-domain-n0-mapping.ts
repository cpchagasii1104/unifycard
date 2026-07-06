/**
 * E2E — F-MARKETPLACE-DOMAIN-N0-MATERIALIZATION (L3, DECISION-0106).
 * 🔒 Roda SÓ em DB efêmera (run-marketplace-domain-n0-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Prova que o mapa materializado é COERENTE com a ontologia N0 VIVA (não inventa domínio):
 *   A · os 3 rótulos com alvo (market/services/events) resolvem para N0 que EXISTE em `domains`;
 *   B · os 3 regulados (jobs/real_estate/vehicles) resolvem null POR DECISÃO (0106 D4/D5/D6) — não forçados;
 *   C · vehicles NÃO resolve mobilidade-e-logistica (trava 0106 §4, viga do rides);
 *   D · rótulo desconhecido → null (fail-safe, não inventa N0);
 *   E · guard estático verde.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { execSync } from 'child_process';
import {
  MARKETPLACE_DOMAIN_TO_N0,
  resolveN0ForMarketplaceDomain,
} from '../core/marketplace-domain/marketplace-domain-n0-mapping';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const rec = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeral(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: alvo é unificard_dev.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/marketplace|domain|n0|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function main(): Promise<void> {
  await assertEphemeral();

  const domains = (await pool.query<{ domain_key: string }>(`SELECT domain_key FROM domains`)).rows.map((r) => r.domain_key);
  const domainSet = new Set(domains);

  // A · os 3 rótulos com alvo resolvem para N0 VIVO.
  const mapped = ['market', 'services', 'events'] as const;
  const allExist = mapped.every((d) => {
    const n0 = resolveN0ForMarketplaceDomain(d);
    return n0 !== null && domainSet.has(n0);
  });
  rec('A market/services/events resolvem N0 que EXISTE em domains (coerente com a ontologia viva)',
    allExist, mapped.map((d) => `${d}→${resolveN0ForMarketplaceDomain(d)}`).join(' '));

  // B · os 3 regulados resolvem null POR DECISÃO (não forçados a um N0).
  const regulated = ['jobs', 'real_estate', 'vehicles'] as const;
  rec('B jobs/real_estate/vehicles resolvem null (0106 D4/D5/D6 — regulados/capability, não forçados)',
    regulated.every((d) => resolveN0ForMarketplaceDomain(d) === null),
    regulated.map((d) => `${d}→${resolveN0ForMarketplaceDomain(d)}`).join(' '));

  // C · vehicles NÃO conflata com mobilidade-e-logistica (viga do rides, 0106 §4).
  rec('C vehicles NÃO resolve mobilidade-e-logistica (trava 0106 §4, viga do rides)',
    MARKETPLACE_DOMAIN_TO_N0.vehicles !== 'mobilidade-e-logistica',
    `vehicles→${MARKETPLACE_DOMAIN_TO_N0.vehicles}`);

  // D · rótulo desconhecido → null (fail-safe, não inventa).
  rec('D rótulo desconhecido → null (não inventa N0)', resolveN0ForMarketplaceDomain('inventado_xyz') === null);

  // E · guard estático verde.
  let g = 0; try { execSync('node scripts/audit-marketplace-domain-n0-mapping.mjs', { cwd: process.cwd(), encoding: 'utf8' }); } catch { g = 1; }
  rec('E guard marketplace-domain-n0-mapping verde', g === 0);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error('💥 fatal:', e?.message ?? e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
