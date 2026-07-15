#!/usr/bin/env node
// PROVA DB (rollback, resíduo-zero) da REMEDIAÇÃO FISCAL 4D-1-R (Yala Veredito C).
// Conexão única + BEGIN → aplica in-tx a migration da remediação (corpo hash-verificado) sobre o
// baseline já vivo (as 2 migrations 4d-1 já estão aplicadas na base real) → prova A-I do envelope
// §9 via SQL direto (bypass do repository, provando a CONSTRAINT/TRIGGER, não só o código) →
// ROLLBACK. Catálogo real permanece VAZIO; resíduo-zero.
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const TENANT = 'a3859c3e-eca7-4e7d-9df4-324829b368ce';
const BR = '42d04887-3033-459c-a4a9-8c6f9ea5a816';

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) { pass++; console.log('  OK  ' + label); } else { fail++; console.log('  FAIL ' + label); } };
const stripTx = (sql) => sql.replace(/^\s*BEGIN;\s*$/gim, '').replace(/^\s*COMMIT;\s*$/gim, '');

async function main() {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const pg = require('pg');
  const url = readFileSync(join(here, '..', '.env'), 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL=')).slice(13).replace(/^"|"$/g, '').trim();
  const c = new pg.Client({ connectionString: url });
  await c.connect();

  const baseRules = (await c.query('SELECT count(*)::int n FROM tax_rules')).rows[0].n;
  const baseTypes = (await c.query('SELECT count(*)::int n FROM tax_types')).rows[0].n;
  const guard4c3Before = createHash('sha256').update(readFileSync(join(here, 'audit-fiscal-tax-catalog.mjs'))).digest('hex');

  const migPath = join(here, '..', 'migrations', '20260715100000_tax_rules_active_rounding_mode_enforcement.sql');
  const migRaw = readFileSync(migPath, 'utf8');
  const migSha = createHash('sha256').update(migRaw).digest('hex');
  if (migSha !== '5372836f70a54d8993902fa439b425699d4cca3ca941e61d164cb7b6053fe598') {
    console.error('ABORT: hash da migration de remediação divergiu:', migSha);
    process.exit(1);
  }

  const q = (sql, p = []) => c.query(sql, p);
  const mkType = async (code) => {
    const r = await q(`INSERT INTO tax_types (tenant_id, code, name, scope_level, source) VALUES ($1,$2,$2,'country','probe') RETURNING id`, [TENANT, code]);
    return r.rows[0].id;
  };
  const expect = async (label, expectFail, fn) => {
    await q('SAVEPOINT sp');
    try {
      await fn();
      if (expectFail) ok(label, false);
      else ok(label, true);
    } catch (e) {
      if (expectFail) ok(label + ' — ' + e.message.split('\n')[0].slice(0, 70), true);
      else { ok(label + ' — inesperado: ' + e.message.split('\n')[0], false); }
    } finally {
      await q('ROLLBACK TO SAVEPOINT sp');
    }
  };

  await q('BEGIN');
  try {
    // migration já aplicada na base real (4d-1220000/230000 + esta 100000, ou ainda pendente
    // dependendo do momento do rito) — aplicamos IN-TX de forma idempotente-segura via savepoint:
    // se a constraint já existir (pós-apply real), pulamos; senão aplicamos aqui para provar isolado.
    const already = (await q(`SELECT count(*)::int n FROM pg_constraint WHERE conname='chk_tax_rules_active_requires_rounding'`)).rows[0].n;
    if (already === 0) {
      await q(stripTx(migRaw));
      ok('migration de remediação aplicada in-tx (constraint+trigger ausentes antes)', true);
    } else {
      ok('constraint/trigger já vivas na base real (rito de apply já rodou) — prova roda sobre elas', true);
    }

    // ── casos que DEVEM FALHAR (A-E) — via SQL DIRETO, não pelo repository ──
    await expect('A: INSERT status=active + rounding_mode=NULL', true, async () => {
      const tt = await mkType('R4D1RA');
      await q(`INSERT INTO tax_rules (tenant_id, tax_type_id, scope_level, taxpayer_kind, country_id, rate_bps, rounding_mode, source, status, version) VALUES ($1,$2,'country','platform',$3,100,NULL,'probe','active',1)`, [TENANT, tt, BR]);
    });
    await expect('B: INSERT draft NULL -> UPDATE status=active', true, async () => {
      const tt = await mkType('R4D1RB');
      const tr = await q(`INSERT INTO tax_rules (tenant_id, tax_type_id, scope_level, taxpayer_kind, country_id, rate_bps, rounding_mode, source, status, version) VALUES ($1,$2,'country','platform',$3,100,NULL,'probe','draft',1) RETURNING id`, [TENANT, tt, BR]);
      await q(`UPDATE tax_rules SET status='active' WHERE id=$1`, [tr.rows[0].id]);
    });
    await expect('C: regra ativa válida -> UPDATE rounding_mode=NULL', true, async () => {
      const tt = await mkType('R4D1RC');
      const tr = await q(`INSERT INTO tax_rules (tenant_id, tax_type_id, scope_level, taxpayer_kind, country_id, rate_bps, rounding_mode, source, status, version) VALUES ($1,$2,'country','platform',$3,100,'half_up','probe','active',1) RETURNING id`, [TENANT, tt, BR]);
      await q(`UPDATE tax_rules SET rounding_mode=NULL WHERE id=$1`, [tr.rows[0].id]);
    });
    await expect('D: regra ativa half_up -> UPDATE rounding_mode=ceil', true, async () => {
      const tt = await mkType('R4D1RD');
      const tr = await q(`INSERT INTO tax_rules (tenant_id, tax_type_id, scope_level, taxpayer_kind, country_id, rate_bps, rounding_mode, source, status, version) VALUES ($1,$2,'country','platform',$3,100,'half_up','probe','active',1) RETURNING id`, [TENANT, tt, BR]);
      await q(`UPDATE tax_rules SET rounding_mode='ceil' WHERE id=$1`, [tr.rows[0].id]);
    });
    await expect('E: regra ativa half_up -> UPDATE status=deprecated + rounding_mode=ceil juntos', true, async () => {
      const tt = await mkType('R4D1RE');
      const tr = await q(`INSERT INTO tax_rules (tenant_id, tax_type_id, scope_level, taxpayer_kind, country_id, rate_bps, rounding_mode, source, status, version) VALUES ($1,$2,'country','platform',$3,100,'half_up','probe','active',1) RETURNING id`, [TENANT, tt, BR]);
      await q(`UPDATE tax_rules SET status='deprecated', rounding_mode='ceil', effective_until=NOW() WHERE id=$1`, [tr.rows[0].id]);
    });

    // ── casos que DEVEM PASSAR (F-I) ──
    await expect('F: INSERT draft, rounding_mode=NULL', false, async () => {
      const tt = await mkType('R4D1RF');
      await q(`INSERT INTO tax_rules (tenant_id, tax_type_id, scope_level, taxpayer_kind, country_id, rate_bps, rounding_mode, source, status, version) VALUES ($1,$2,'country','platform',$3,100,NULL,'probe','draft',1)`, [TENANT, tt, BR]);
    });
    await expect('G: draft NULL -> UPDATE rounding_mode=half_up (ainda draft)', false, async () => {
      const tt = await mkType('R4D1RG');
      const tr = await q(`INSERT INTO tax_rules (tenant_id, tax_type_id, scope_level, taxpayer_kind, country_id, rate_bps, rounding_mode, source, status, version) VALUES ($1,$2,'country','platform',$3,100,NULL,'probe','draft',1) RETURNING id`, [TENANT, tt, BR]);
      await q(`UPDATE tax_rules SET rounding_mode='half_up' WHERE id=$1`, [tr.rows[0].id]);
    });
    // H: ativação com modo válido — via SQL direto (draft NULL -> ativa com modo definido no mesmo
    // UPDATE, simulando o efeito de activateRule; NOTA: a proteção do REPOSITORY (repository
    // fail-closed real, TAX_RULE_ROUNDING_MODE_REQUIRED) já foi provada isoladamente na prova DB
    // formal do material 4d-1 original (test-fiscal-provision-engine-db.mjs, caso 13, 40/40 green)
    // e é travada estaticamente pelo guard dedicado (R12). Aqui provamos SÓ a camada de banco —
    // usar o repository real exigiria uma segunda conexão de pool fora desta transação (risco de
    // deadlock, já mitigado removendo esse vetor deste harness).
    await expect('H: draft NULL -> UPDATE define rounding_mode + status=active juntos (modo válido)', false, async () => {
      const tt = await mkType('R4D1RH');
      const tr = await q(`INSERT INTO tax_rules (tenant_id, tax_type_id, scope_level, taxpayer_kind, country_id, rate_bps, rounding_mode, source, status, version) VALUES ($1,$2,'country','platform',$3,100,NULL,'probe','draft',1) RETURNING id`, [TENANT, tt, BR]);
      await q(`UPDATE tax_rules SET rounding_mode='half_up', status='active' WHERE id=$1`, [tr.rows[0].id]);
    });
    // I: active half_up -> deprecated mantendo half_up (effective_from no passado p/ NOW() congelado na tx)
    await expect('I: regra ativa half_up -> deprecated mantendo half_up', false, async () => {
      const tt = await mkType('R4D1RI');
      const tr = await q(
        `INSERT INTO tax_rules (tenant_id, tax_type_id, scope_level, taxpayer_kind, country_id, rate_bps, rounding_mode, source, status, version, effective_from)
         VALUES ($1,$2,'country','platform',$3,100,'half_up','probe','active',1, NOW() - interval '1 day') RETURNING id`,
        [TENANT, tt, BR]
      );
      await q(`UPDATE tax_rules SET status='deprecated', effective_until=NOW() WHERE id=$1`, [tr.rows[0].id]);
    });

    // ── erro vem da constraint/trigger esperados (não fallback genérico) ──
    await q('SAVEPOINT sp_err');
    try {
      const tt = await mkType('R4D1RERR');
      await q(`INSERT INTO tax_rules (tenant_id, tax_type_id, scope_level, taxpayer_kind, country_id, rate_bps, rounding_mode, source, status, version) VALUES ($1,$2,'country','platform',$3,100,NULL,'probe','active',1)`, [TENANT, tt, BR]);
      ok('erro vem da constraint esperada (chk_tax_rules_active_requires_rounding)', false);
    } catch (e) {
      ok('erro vem da constraint esperada (chk_tax_rules_active_requires_rounding)', e.message.includes('chk_tax_rules_active_requires_rounding'));
    } finally {
      await q('ROLLBACK TO SAVEPOINT sp_err');
    }
  } finally {
    await q('ROLLBACK');
  }

  // ── resíduo-zero + guard 4c-3 intacto ──
  ok('R: tax_rules restaurado (catálogo real vazio)', (await c.query('SELECT count(*)::int n FROM tax_rules')).rows[0].n === baseRules);
  ok('R: tax_types restaurado', (await c.query('SELECT count(*)::int n FROM tax_types')).rows[0].n === baseTypes);
  const guard4c3After = createHash('sha256').update(readFileSync(join(here, 'audit-fiscal-tax-catalog.mjs'))).digest('hex');
  ok('guard 4c-3 byte-intacto', guard4c3After === guard4c3Before);

  console.log(`\n==== FISCAL 4D-1-R DB proof: pass=${pass} fail=${fail} ====`);
  await c.end();
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error('ERRO FATAL:', e); process.exit(1); });
