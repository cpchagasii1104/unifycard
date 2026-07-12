#!/usr/bin/env node
// Guard estrutural — F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-F · COERÊNCIA COMPOSTA DE ADDRESSES.
// Pergunta própria: "a coerência city×neighborhood é FÍSICA (CHECK + FK composta MATCH SIMPLE RESTRICT/
// NO ACTION sobre neighborhoods(city_id,neighborhood_id)); a FK simples foi removida; a candidate key existe;
// zero backfill textual; os writers vivos (rentals/events) rejeitam bairro-sem-city e mapeiam SÓ as
// constraints territoriais conhecidas sem engolir infra; nenhuma fronteira territorial/Social/Bank tocada?"
// Integridade VERSIONADA (migration/arquivos). Estado vivo = introspecção. Parse fail = FAIL.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const failures = [];
const stripSql = (s) => s.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, ' ');
const MIG_FILE = '20260711220000_addresses_neighborhood_city_composite_coherence.sql';
const CK = 'ck_addresses_neighborhood_requires_city';
const FK = 'fk_addresses_city_neighborhood';
const UQ = 'uq_neighborhoods_city_id_neighborhood_id';
const SIMPLE_FK = 'addresses_neighborhood_id_fkey';

try {
  const MIG = join(ROOT, 'migrations');
  const migFiles = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
  if (!migFiles.includes(MIG_FILE)) throw new Error(`migration N2-F ausente: ${MIG_FILE}`);
  const sql = stripSql(readFileSync(join(MIG, MIG_FILE), 'utf-8'));

  // ── 1. SCHEMA ─────────────────────────────────────────────────────────────────────────────────
  // candidate key (M-1)
  if (!new RegExp(`ADD\\s+CONSTRAINT\\s+${UQ}\\s+UNIQUE\\s*\\(\\s*city_id\\s*,\\s*neighborhood_id\\s*\\)`, 'i').test(sql)) {
    failures.push('candidate key UNIQUE(city_id, neighborhood_id) ausente.');
  }
  // CHECK (D-F1)
  if (!new RegExp(`ADD\\s+CONSTRAINT\\s+${CK}\\s+CHECK\\s*\\(`, 'i').test(sql)) failures.push('CHECK ck_addresses_neighborhood_requires_city ausente.');
  if (!/neighborhood_id\s+IS\s+NULL\s+OR\s+city_id\s+IS\s+NOT\s+NULL/i.test(sql)) failures.push('CHECK do nome não é (neighborhood_id IS NULL OR city_id IS NOT NULL).');
  // FK composta (D-F2/M-3)
  const fkAdd = new RegExp(`ADD\\s+CONSTRAINT\\s+${FK}\\s+FOREIGN\\s+KEY\\s*\\(\\s*city_id\\s*,\\s*neighborhood_id\\s*\\)\\s*REFERENCES\\s+neighborhoods\\s*\\(\\s*city_id\\s*,\\s*neighborhood_id\\s*\\)([\\s\\S]*?);`, 'i');
  const fkm = fkAdd.exec(sql);
  if (!fkm) failures.push('FK composta (city_id, neighborhood_id)→neighborhoods(city_id, neighborhood_id) ausente/colunas divergentes.');
  else {
    const tail = fkm[1];
    if (!/MATCH\s+SIMPLE/i.test(tail)) failures.push('FK composta: falta MATCH SIMPLE (nunca FULL — preserva city+neighborhood-NULL).');
    if (/MATCH\s+FULL/i.test(tail)) failures.push('FK composta: MATCH FULL proibido.');
    if (!/ON\s+DELETE\s+RESTRICT/i.test(tail)) failures.push('FK composta: falta ON DELETE RESTRICT.');
    if (!/ON\s+UPDATE\s+NO\s+ACTION/i.test(tail)) failures.push('FK composta: falta ON UPDATE NO ACTION.');
    if (/ON\s+(DELETE|UPDATE)\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT)/i.test(tail)) failures.push('FK composta: CASCADE/SET NULL/SET DEFAULT proibido.');
  }
  // índice de suporte
  if (!/CREATE\s+INDEX\s+idx_addresses_city_neighborhood\s+ON\s+addresses\s*\(\s*city_id\s*,\s*neighborhood_id\s*\)/i.test(sql)) {
    failures.push('índice de suporte idx_addresses_city_neighborhood ausente.');
  }
  // remoção da FK simples (D-F3)
  if (!new RegExp(`ALTER\\s+TABLE\\s+addresses\\s+DROP\\s+CONSTRAINT\\s+${SIMPLE_FK}`, 'i').test(sql)) {
    failures.push('FK simples addresses_neighborhood_id_fkey NÃO removida no mesmo envelope.');
  }
  // sem NOT VALID (cláusula real, fora de mensagens de RAISE); sem NOT NULL global; sem trigger de autocorreção
  const bareSql = sql.replace(/'(?:[^']|'')*'/g, "''"); // remove literais single-quote p/ os checks negativos
  if (/(ADD\s+CONSTRAINT[\s\S]{0,300}?|\)\s+)NOT\s+VALID\b/i.test(bareSql)) failures.push('constraint NOT VALID na migration — validação deve ser imediata (base pequena).');
  if (/ALTER\s+COLUMN\s+(city_id|neighborhood_id)\s+SET\s+NOT\s+NULL/i.test(sql)) failures.push('adiciona NOT NULL a city_id/neighborhood_id — proibido (matriz de nulabilidade).');
  if (/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION|CREATE\s+TRIGGER/i.test(sql)) failures.push('migration cria função/trigger — autocorreção proibida (barreira é CHECK+FK declarativa).');

  // ── 2. ZERO BACKFILL na migration ──────────────────────────────────────────────────────────────
  if (/UPDATE\s+addresses\s+SET[\s\S]{0,120}neighborhood_id/i.test(sql)) failures.push('backfill: UPDATE addresses SET neighborhood_id — proibido.');
  if (/neighborhood_id[\s\S]{0,80}(neighborhood_display_text|normalize_name|LOWER\s*\(|ILIKE|postal_code|external_code|slug)/i.test(sql)) {
    failures.push('backfill: neighborhood_id derivado de display_text/normalize_name/CEP/nome/slug — proibido.');
  }
  if (/INSERT\s+INTO\s+neighborhoods/i.test(sql)) failures.push('seed clandestino de neighborhoods na migration.');

  // ── 3. FRONTEIRAS SQL ──────────────────────────────────────────────────────────────────────────
  if (/'territory:|actor_capability_grant|fn_(grant|revoke|create_canonical_neighborhood|assert_territorial)/i.test(sql)) failures.push('migration toca grant/writer territorial — fora do escopo N2-F.');
  if (/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(public\.)?neighborhood_(aliases|success\w*|candidates)/i.test(sql)) failures.push('migration cria alias/sucessão — proibido.');
  if (/\bbank_\w+|\bsocial_\w+|regional_fund|split/i.test(sql)) failures.push('migration toca Bank/Social/split — proibido.');

  // ── 4. Migrations POSTERIORES não enfraquecem ──────────────────────────────────────────────────
  for (const f of migFiles.filter((x) => x > MIG_FILE)) {
    const s = stripSql(readFileSync(join(MIG, f), 'utf-8'));
    if (new RegExp(`DROP\\s+CONSTRAINT\\s+(${CK}|${FK}|${UQ})`, 'i').test(s)) failures.push(`[pós-N2F] ${f}: dropa CHECK/FK composta/candidate key — proibido.`);
    if (new RegExp(`ADD\\s+CONSTRAINT\\s+${SIMPLE_FK}|FOREIGN\\s+KEY\\s*\\(\\s*neighborhood_id\\s*\\)\\s*REFERENCES\\s+neighborhoods`, 'i').test(s)) failures.push(`[pós-N2F] ${f}: revive a FK simples de neighborhood_id — proibido.`);
    if (new RegExp(`${FK}[\\s\\S]{0,120}(SET\\s+NULL|CASCADE|SET\\s+DEFAULT)`, 'i').test(s)) failures.push(`[pós-N2F] ${f}: enfraquece a ação referencial da FK composta.`);
    if (/UPDATE\s+addresses\s+SET[\s\S]{0,120}neighborhood_id[\s\S]{0,120}(display_text|normalize_name|LOWER|ILIKE|postal)/i.test(s)) failures.push(`[pós-N2F] ${f}: backfill textual de neighborhood_id.`);
  }

  // ── 5. MAPPER canônico: mapeia SÓ as 2 constraints; REPROPAGA o resto; sem swallow ─────────────
  const mapP = join(SRC, 'core/location/address-territorial-errors.ts');
  const map = existsSync(mapP) ? stripTs(readFileSync(mapP, 'utf-8')) : '';
  if (!map) failures.push('address-territorial-errors.ts ausente.');
  else {
    if (!/assertNeighborhoodRequiresCity/.test(map)) failures.push('mapper: assertNeighborhoodRequiresCity ausente.');
    if (!/mapAddressTerritorialConstraintError/.test(map)) failures.push('mapper: mapAddressTerritorialConstraintError ausente.');
    // pré-check estrutural: neighborhoodId && !cityId → erro
    if (!/if\s*\(\s*neighborhoodId\s*&&\s*!\s*cityId\s*\)/.test(map.replace(/\s+/g, ' '))) failures.push('mapper: assert estrutural não é `if (neighborhoodId && !cityId)`.');
    // mapeia por NOME EXATO de constraint (não SQLSTATE genérico)
    if (!new RegExp(`constraint\\s*===\\s*'${CK}'`).test(map)) failures.push('mapper: não mapeia por constraint exata ck_addresses_neighborhood_requires_city.');
    if (!new RegExp(`constraint\\s*===\\s*'${FK}'`).test(map)) failures.push('mapper: não mapeia por constraint exata fk_addresses_city_neighborhood.');
    if (/error\.code\s*===\s*'23503'|error\.code\s*===\s*'23514'/.test(map)) failures.push('mapper: usa SQLSTATE genérico (23503/23514) em vez do nome exato — pode mascarar FK não-territorial.');
    // REPROPAGA o resto: última instrução é throw error (não swallow / não return sucesso)
    if (!/throw\s+error\s*;/.test(map)) failures.push('mapper: não repropaga (throw error) o erro não-territorial/infra — swallow proibido.');
    if (/return\s+(true|false|null|undefined|{)/.test(map)) failures.push('mapper: retorna valor (converteria erro em sucesso) — proibido.');
  }

  // ── 6. WRITERS vivos (rentals + events) adaptados ──────────────────────────────────────────────
  const rentSvc = existsSync(join(SRC, 'modules/rentals/rentable-resource.service.ts')) ? stripTs(readFileSync(join(SRC, 'modules/rentals/rentable-resource.service.ts'), 'utf-8')) : '';
  const rentRepo = existsSync(join(SRC, 'modules/rentals/rentable-resource.repository.ts')) ? stripTs(readFileSync(join(SRC, 'modules/rentals/rentable-resource.repository.ts'), 'utf-8')) : '';
  const evtSvc = existsSync(join(SRC, 'core/events/event.service.ts')) ? stripTs(readFileSync(join(SRC, 'core/events/event.service.ts'), 'utf-8')) : '';
  if (!rentSvc) failures.push('rentals service ausente.');
  else if ((rentSvc.match(/assertNeighborhoodRequiresCity\s*\(/g) || []).length < 2) failures.push('rentals service: assertNeighborhoodRequiresCity não chamado em create E update (≥2).');
  if (!rentRepo) failures.push('rentals repository ausente.');
  else {
    if (!/mapAddressTerritorialConstraintError\s*\(/.test(rentRepo)) failures.push('rentals repository: não mapeia constraint territorial no INSERT.');
    if (!/catch\s*\([\s\S]{0,40}\)\s*{[\s\S]{0,80}mapAddressTerritorialConstraintError/.test(rentRepo)) failures.push('rentals repository: mapper fora de catch do INSERT (deve traduzir a violação do INSERT).');
    if (/catch\s*\([\s\S]{0,40}\)\s*{\s*(return|\/\/ *ignore|}\s*)/.test(rentRepo) && !/mapAddressTerritorialConstraintError/.test(rentRepo)) failures.push('rentals repository: catch fail-open (swallow) proibido.');
    // não autocorrige city a partir de neighborhood
    if (/city_id\s*=\s*[^;\n]*neighborhood/i.test(rentRepo)) failures.push('rentals repository: autocorreção de city a partir de neighborhood — proibido.');
  }
  if (!evtSvc) failures.push('events service ausente.');
  else {
    if (!/assertNeighborhoodRequiresCity\s*\(/.test(evtSvc)) failures.push('events service: assertNeighborhoodRequiresCity não chamado no venue.');
    if (!/catch\s*\([\s\S]{0,40}\)\s*{[\s\S]{0,80}mapAddressTerritorialConstraintError/.test(evtSvc)) failures.push('events service: mapper fora de catch do INSERT do venue.');
  }

  // ── 7. Nenhum OUTRO writer vivo de addresses grava neighborhood_id sem o mapper (sweep) ────────
  function walk(dir) { const out = []; for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) { if (e.name === '__tests__' || e.name === 'node_modules') continue; out.push(...walk(p)); } else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') && !e.name.endsWith('.d.ts')) out.push(p); } return out; }
  // Writers CANÔNICOS conhecidos que gravam neighborhood_id em addresses (Location Core central + rentals +
  // events). QUALQUER OUTRO arquivo com INSERT INTO addresses(... neighborhood_id ...) = writer paralelo → FAIL.
  const KNOWN_WRITERS = ['rentable-resource.repository.ts', 'event.service.ts', 'location.repository.ts'];
  for (const f of (existsSync(SRC) ? walk(SRC) : [])) {
    const rel = f.slice(ROOT.length + 1).replace(/\\/g, '/');
    const c = stripTs(readFileSync(f, 'utf-8'));
    if (/INSERT\s+INTO\s+addresses\b/i.test(c) && /neighborhood_id/i.test(c)) {
      const known = KNOWN_WRITERS.some((k) => rel.endsWith(k));
      if (!known) failures.push(`[sweep] ${rel}: novo writer de addresses grava neighborhood_id fora dos writers canônicos conhecidos — proibido (writer paralelo / 2º Location Core).`);
    }
  }

  // ── 8. wiring ──────────────────────────────────────────────────────────────────────────────────
  const runner = stripTs(readFileSync(join(ROOT, 'scripts', 'run-regression-guards.mjs'), 'utf-8'));
  if (!runner.includes('audit-addresses-neighborhood-composite-coherence.mjs')) failures.push('runner: audit-addresses-neighborhood-composite-coherence.mjs fora do run-regression-guards.');
} catch (e) {
  failures.push(`falha de leitura/parsing: ${e.message} — FAIL.`);
}

if (failures.length) {
  console.error('GATE FAIL [addresses-neighborhood-composite-coherence]:');
  for (const f of failures) console.error('   ❌ ' + f);
  console.error('\n→ Coerência composta de addresses (N2-F) ausente/enfraquecida. Exige: candidate key UNIQUE(city_id,neighborhood_id); CHECK (neighborhood_id IS NULL OR city_id IS NOT NULL); FK composta (city_id,neighborhood_id)→neighborhoods MATCH SIMPLE ON DELETE RESTRICT ON UPDATE NO ACTION; FK simples removida; índice; ZERO backfill textual; rentals/events rejeitam bairro-sem-city e mapeiam SÓ as constraints territoriais conhecidas sem swallow; nenhum writer paralelo; sem grant/rota/PORTA/Social/Bank.');
  process.exit(1);
}
console.log('GATE OK [addresses-neighborhood-composite-coherence] — integridade VERSIONADA da N2-F: candidate key UNIQUE(city_id,neighborhood_id); CHECK ck_addresses_neighborhood_requires_city; FK composta fk_addresses_city_neighborhood (MATCH SIMPLE, ON DELETE RESTRICT, ON UPDATE NO ACTION) sobre neighborhoods(city_id,neighborhood_id); FK simples addresses_neighborhood_id_fkey REMOVIDA; índice idx_addresses_city_neighborhood; ZERO backfill textual (migration/posteriores); mapper canônico mapeia SÓ as 2 constraints por nome exato e REPROPAGA o resto (sem swallow); rentals (create+update) e events rejeitam bairro-sem-city; nenhum writer paralelo de neighborhood_id em addresses; sem grant/rota/PORTA/Social/Bank. (Estado vivo = introspecção.)');
