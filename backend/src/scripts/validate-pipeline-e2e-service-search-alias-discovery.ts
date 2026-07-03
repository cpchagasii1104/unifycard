/**
 * E2E — F-SERVICE-SEARCH-ALIAS-DISCOVERY-SLICE-A (ponte de busca termo→concept; discovery-only; money-free).
 * Modo: npx tsx src/scripts/validate-pipeline-e2e-service-search-alias-discovery.ts
 *
 * PRÉ-REQ: migrations 20260629140000 (tabela) + 20260629150000 (seed beleza) APLICADAS em unificard_dev.
 * SEGURO em unificard_dev: TODAS as operações são READ-ONLY (resolver + discoverServices + SELECTs).
 *   As provas de DELTA confirmam que rodar a busca N vezes NÃO muta concepts/canonical/categorias/alias/bank.
 *
 * Prova:
 *   Seed     — alias semeado: >=58 linhas, 16 termos distintos (beauty-v1).
 *   Positivos— cabeleireiro→11, barbeiro→2, manicure→1, colorista→5 concepts; salão-de-beleza→16.
 *   Normaliz.— "Cabeleireiro " (caps+espaço) e "Salão de Beleza" (acento) resolvem igual (chave normalizada).
 *   Miss     — termo desconhecido e termo vazio → 0 concepts (descoberta honesta, sem fabricar concept).
 *   HTTP     — GET /search-by-term: termo conhecido → 200 {conceptIds,results[]}; desconhecido → 200 vazio;
 *              sem term → 400 (zod). Endpoint não exige representação (discovery é leitura), igual /search.
 *   Delta=0  — após N buscas: concepts/canonical_services/categories/service_search_aliases/bank_ledger/
 *              bank_transactions inalterados (runtime só lê; migration governa).
 *   Guard    — audit-service-search-alias-discovery verde; audit-createservice-eligibility (DECISION-0144) verde
 *              (publicação gated intocada: descobrir ≠ poder publicar).
 */
import 'tsconfig-paths/register';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { pool } from '@core/database/pool';
import {
  resolveConceptsFromSearchTerm,
  normalizeSearchTerm,
} from '@core/semantic/semantic.adapter';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const rec = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const cwd = process.cwd();

const SRC = 'F-SERVICE-SEARCH-ALIAS-DISCOVERY-SLICE-A';

async function count(table: string): Promise<number | null> {
  const reg = await pool.query<{ r: string | null }>(`SELECT to_regclass($1) AS r`, [`public.${table}`]);
  if (!reg.rows[0]?.r) return null; // tabela ausente → não contabiliza (não falha por algo fora de escopo)
  const c = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.${table}`);
  return Number(c.rows[0].n);
}

async function main(): Promise<void> {
  // ── 0) Tenant real (para discoverServices); fallback random (resultados vazios, delta ainda válido).
  let tenantId: string = randomUUID(); // anotação string: a inferência do template-literal UUID rejeitava o reassign vindo do DB (achado B4)
  try {
    const t = await pool.query<{ tenant_id: string }>(`SELECT tenant_id FROM tenants LIMIT 1`);
    if (t.rows[0]?.tenant_id) tenantId = t.rows[0].tenant_id;
  } catch { /* sem tenants — segue com random */ }

  // ── 1) Seed presente.
  console.log('\n— seed beleza —');
  const seed = await pool.query<{ total: string; terms: string }>(
    `SELECT count(*)::text AS total, count(DISTINCT normalized_term)::text AS terms
       FROM service_search_aliases WHERE source = $1`,
    [SRC],
  );
  rec('1a alias semeado >=58 linhas', Number(seed.rows[0].total) >= 58, `total=${seed.rows[0].total}`);
  rec('1b 16 termos normalizados distintos', Number(seed.rows[0].terms) === 16, `terms=${seed.rows[0].terms}`);

  // ── 2) Snapshot ANTES (provas de delta).
  const before = {
    concepts: await count('concepts'),
    canonical_services: await count('canonical_services'),
    categories: await count('categories'),
    service_search_aliases: await count('service_search_aliases'),
    bank_ledger: await count('bank_ledger'),
    bank_transactions: await count('bank_transactions'),
  };

  // ── 3) Resolução positiva (contagem de concepts por termo).
  console.log('\n— resolução positiva (termo→concepts) —');
  const r1 = await resolveConceptsFromSearchTerm('cabeleireiro');
  rec('3a cabeleireiro → 11 concepts', r1.conceptIds.length === 11, `n=${r1.conceptIds.length}`);
  const r2 = await resolveConceptsFromSearchTerm('barbeiro');
  rec('3b barbeiro → 2 concepts', r2.conceptIds.length === 2, `n=${r2.conceptIds.length}`);
  const r3 = await resolveConceptsFromSearchTerm('manicure');
  rec('3c manicure → 1 concept', r3.conceptIds.length === 1, `n=${r3.conceptIds.length}`);
  const r4 = await resolveConceptsFromSearchTerm('colorista');
  rec('3d colorista → 5 concepts', r4.conceptIds.length === 5, `n=${r4.conceptIds.length}`);
  const r5 = await resolveConceptsFromSearchTerm('salao-de-beleza');
  rec('3e salao-de-beleza → 16 concepts', r5.conceptIds.length === 16, `n=${r5.conceptIds.length}`);

  // ── 4) Normalização (chave normalizada absorve caps/acento/espaço).
  console.log('\n— normalização —');
  rec('4a normalizeSearchTerm("Salão de Beleza")==="salao-de-beleza"',
    normalizeSearchTerm('Salão de Beleza') === 'salao-de-beleza', normalizeSearchTerm('Salão de Beleza'));
  const r6 = await resolveConceptsFromSearchTerm('  Cabeleireiro ');
  rec('4b "  Cabeleireiro " resolve igual a cabeleireiro (11)', r6.conceptIds.length === 11, `n=${r6.conceptIds.length}`);
  const r7 = await resolveConceptsFromSearchTerm('Salão de Beleza');
  rec('4c "Salão de Beleza" (acento) resolve a 16', r7.conceptIds.length === 16, `n=${r7.conceptIds.length}`);

  // ── 5) Miss honesto.
  console.log('\n— miss honesto —');
  const m1 = await resolveConceptsFromSearchTerm('astronauta-quantico-xyz');
  rec('5a termo desconhecido → 0 concepts', m1.conceptIds.length === 0, `n=${m1.conceptIds.length}`);
  const m2 = await resolveConceptsFromSearchTerm('   ');
  rec('5b termo vazio/branco → 0 concepts', m2.conceptIds.length === 0, `n=${m2.conceptIds.length}`);

  // ── 6) HTTP (app.inject) — endpoint discovery-only.
  console.log('\n— HTTP GET /search-by-term —');
  const Fastify = (await import('fastify')).default;
  const { default: routes } = await import('../modules/services/services-discovery.routes');
  const app = Fastify({ logger: false });
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: tenantId };
    r.user = { id: randomUUID() };
    r.actionContext = { actorId: randomUUID() };
  });
  await app.register(routes);
  await app.ready();
  const GET = (url: string) => app.inject({ method: 'GET', url });
  try {
    const h1 = await GET('/search-by-term?term=cabeleireiro');
    let b1: any = {};
    try { b1 = JSON.parse(h1.body); } catch { /* */ }
    rec('6a GET term=cabeleireiro → 200 + conceptIds=11 + results[] array',
      h1.statusCode === 200 && b1?.data?.conceptIds?.length === 11 && Array.isArray(b1?.data?.results),
      `status=${h1.statusCode} conceptIds=${b1?.data?.conceptIds?.length} resultsIsArray=${Array.isArray(b1?.data?.results)}`);

    const h2 = await GET('/search-by-term?term=astronauta-quantico-xyz');
    let b2: any = {};
    try { b2 = JSON.parse(h2.body); } catch { /* */ }
    rec('6b GET term desconhecido → 200 + conceptIds=[] + results=[]',
      h2.statusCode === 200 && b2?.data?.conceptIds?.length === 0 && Array.isArray(b2?.data?.results) && b2.data.results.length === 0,
      `status=${h2.statusCode} conceptIds=${b2?.data?.conceptIds?.length}`);

    const h3 = await GET('/search-by-term');
    rec('6c GET sem term → 400 (zod)', h3.statusCode === 400, `status=${h3.statusCode}`);
  } finally {
    await app.close();
  }

  // ── 7) Snapshot DEPOIS + provas de delta=0.
  console.log('\n— delta=0 (runtime só lê) —');
  const after = {
    concepts: await count('concepts'),
    canonical_services: await count('canonical_services'),
    categories: await count('categories'),
    service_search_aliases: await count('service_search_aliases'),
    bank_ledger: await count('bank_ledger'),
    bank_transactions: await count('bank_transactions'),
  };
  for (const k of Object.keys(before) as (keyof typeof before)[]) {
    const a = before[k];
    const b = after[k];
    if (a === null || b === null) {
      rec(`7-${k} delta n/a (tabela ausente — fora de escopo)`, true);
    } else {
      rec(`7-${k} Δ=0 (antes=${a} depois=${b})`, a === b, `antes=${a} depois=${b}`);
    }
  }

  // ── 8) Guards.
  console.log('\n— guards —');
  let g1 = 0; try { execSync('node scripts/audit-service-search-alias-discovery.mjs', { cwd, encoding: 'utf8' }); } catch { g1 = 1; }
  rec('8a guard service-search-alias-discovery verde', g1 === 0);
  let g2 = 0; try { execSync('node scripts/audit-createservice-eligibility.mjs', { cwd, encoding: 'utf8' }); } catch { g2 = 1; }
  rec('8b guard createservice-eligibility (DECISION-0144) verde — publicação gated intocada', g2 === 0);

  await pool.end();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ F-SERVICE-SEARCH-ALIAS-DISCOVERY-SLICE-A: termo→concept resolve (beleza), normaliza, miss honesto, HTTP discovery-only, delta=0, publicação gated intocada, zero money.');
  process.exit(0);
}

main().catch((e) => { console.error('💥 Erro não tratado:', e); process.exit(1); });
