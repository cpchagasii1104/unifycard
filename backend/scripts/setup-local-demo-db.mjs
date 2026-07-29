// backend/scripts/setup-local-demo-db.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO
// ║ NORMA:   REMEDIATION_DT_LOG.md — DT-OFFICIAL-DATABASE-LOCK-FAIL-CLOSED (2026-07-29)
// ║ NÃO:     recriar/(re)popular unificard_local — banco aposentado por decisão de Clayton
// ║ EM VEZ:  usar unificard_dev (banco oficial; já tem as 547 migrations aplicadas)
// ╚════════════════════════════════════════════════════════════════
//
// ESTE SCRIPT ESTÁ CONTIDO. Ele existia para criar `unificard_local` do zero porque
// `unificard_dev` não tinha as migrations do motor de eventos — justificativa que
// EXPIROU em 2026-07-29: os dois bancos convergiram (547 migrations / 334 tabelas em
// ambos). `unificard_dev` é o banco OFICIAL; `unificard_local` está sendo aposentado.
//
// `unificard_local` ainda guarda o CATÁLOGO DE VEÍCULOS (vehicle_makes/models/years/
// specs além do que as migrations sozinhas produzem) — a ÚNICA coisa do sistema que
// não tem caminho de renascimento provado. Recriar `unificard_local` do zero destruiria
// esse dado. Por isso este script agora RECUSA antes de conectar, criar ou dropar
// qualquer coisa. O corpo operacional original permanece abaixo, intacto e INERTE —
// nunca é alcançado.
//
// Uso (a partir de backend/):  node scripts/setup-local-demo-db.mjs  → recusa, exit 1.

function refuseAndExit() {
  console.error('❌ RECUSADO: setup-local-demo-db.mjs está CONTIDO (DT-OFFICIAL-DATABASE-LOCK-FAIL-CLOSED, 2026-07-29).');
  console.error('   unificard_local foi APOSENTADO — a razão de existir deste script (unificard_dev sem as');
  console.error('   migrations do motor de eventos) expirou: os dois bancos convergiram em 547 migrations / 334 tabelas.');
  console.error('   unificard_local ainda guarda o CATÁLOGO DE VEÍCULOS, dado sem caminho de renascimento provado —');
  console.error('   recriar o banco do zero destruiria esse dado. Este script NÃO conecta, NÃO cria, NÃO dropa nada.');
  console.error('   EM VEZ: use unificard_dev (banco oficial). Ver REMEDIATION_DT_LOG.md para o histórico completo.');
  process.exit(1);
}

refuseAndExit();

// ─────────────────────────────────────────────────────────────────────────────────
// CORPO ORIGINAL — INERTE, NUNCA ALCANÇADO (refuseAndExit() acima já encerrou o processo).
// Mantido por rastreabilidade histórica, não por funcionalidade.
// ─────────────────────────────────────────────────────────────────────────────────
//
// import { Client } from 'pg';
// import { spawnSync } from 'node:child_process';
// import { readFileSync, existsSync } from 'node:fs';
// import { fileURLToPath } from 'node:url';
// import { dirname, join } from 'node:path';
//
// const __dirname = dirname(fileURLToPath(import.meta.url));
// const BACKEND_ROOT = join(__dirname, '..');
//
// const LOCAL_DB = 'unificard_local';
// const FORBIDDEN = 'unificard_dev';
//
// /** Lê DATABASE_URL da linha bruta do .env (dotenv trunca senha com `#`; aqui pegamos a linha inteira). */
// function readBaseDatabaseUrl() {
//   const envPath = join(BACKEND_ROOT, '.env');
//   if (!existsSync(envPath)) throw new Error(`.env não encontrado em ${envPath}`);
//   const line = readFileSync(envPath, 'utf8')
//     .split(/\r?\n/)
//     .find((l) => l.startsWith('DATABASE_URL='));
//   if (!line) throw new Error('DATABASE_URL ausente no .env');
//   let value = line.slice('DATABASE_URL='.length).trim();
//   if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
//     value = value.slice(1, -1);
//   }
//   return value;
// }
//
// async function runAdminSql(adminUrl, sql) {
//   const c = new Client({ connectionString: adminUrl });
//   await c.connect();
//   try {
//     await c.query(sql);
//   } finally {
//     await c.end();
//   }
// }
//
// async function main() {
//   const baseUrl = readBaseDatabaseUrl();
//   const prefix = baseUrl.replace(/\/[^/]+$/, ''); // remove /<dbname>
//   const adminUrl = `${prefix}/postgres`;
//   const localUrl = `${prefix}/${LOCAL_DB}`;
//
//   // GUARD fail-closed: jamais operar sobre unificard_dev.
//   if (LOCAL_DB === FORBIDDEN) {
//     console.error(`❌ ABORT: alvo é ${FORBIDDEN}`);
//     process.exit(1);
//   }
//   const baseDbName = (baseUrl.match(/\/([^/]+)$/) || [])[1];
//   console.log(`🎯 Alvo LOCAL: ${LOCAL_DB}  (dev intocado: ${baseDbName})`);
//
//   console.log(`🧱 (re)criando DB persistente ${LOCAL_DB} ...`);
//   await runAdminSql(adminUrl, `DROP DATABASE IF EXISTS ${LOCAL_DB} WITH (FORCE)`);
//   await runAdminSql(adminUrl, `CREATE DATABASE ${LOCAL_DB}`);
//   console.log(`✅ DB ${LOCAL_DB} criada (vazia).`);
//
//   console.log('📦 Aplicando migrations FULL (npx tsx src/core/db/migrate.ts) ...');
//   const res = spawnSync('npx', ['tsx', 'src/core/db/migrate.ts'], {
//     cwd: BACKEND_ROOT,
//     stdio: 'inherit',
//     shell: true,
//     env: {
//       ...process.env,
//       DATABASE_URL: localUrl,
//       EXPECTED_DATABASE_NAME: LOCAL_DB,
//       MIGRATION_PROFILE: 'FULL',
//     },
//   });
//   if (res.status !== 0) {
//     console.error(`❌ migrate falhou (rc=${res.status}). DB ${LOCAL_DB} pode estar incompleta.`);
//     process.exit(1);
//   }
//
//   // Spot-check pós-migração: tabelas/colunas do motor de eventos presentes.
//   const c = new Client({ connectionString: localUrl });
//   await c.connect();
//   try {
//     const applied = (await c.query('SELECT COUNT(*)::int AS n FROM schema_migrations')).rows[0].n;
//     const tbl = (name) =>
//       c.query(`SELECT to_regclass('public.${name}') IS NOT NULL AS ok`).then((r) => r.rows[0].ok);
//     const col = (t, col) =>
//       c
//         .query(
//           `SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2) AS ok`,
//           [t, col]
//         )
//         .then((r) => r.rows[0].ok);
//     const checks = {
//       service_offering_configs: await tbl('service_offering_configs'),
//       service_offering_config_prices: await tbl('service_offering_config_prices'),
//       event_sectors: await tbl('event_sectors'),
//       'service_offerings.audience_min': await col('service_offerings', 'audience_min'),
//     };
//     console.log(`\n📊 schema_migrations aplicadas: ${applied}`);
//     for (const [k, v] of Object.entries(checks)) console.log(`   ${v ? '✅' : '❌'} ${k}`);
//     const allOk = Object.values(checks).every(Boolean);
//     if (!allOk) {
//       console.error('❌ Spot-check falhou: schema incompleto.');
//       process.exit(1);
//     }
//     console.log(`\n🎉 ${LOCAL_DB} pronto (${applied} migrations, motor de eventos presente).`);
//     console.log('   Próximo passo: node scripts/seed-local-demo.mjs');
//   } finally {
//     await c.end();
//   }
// }
//
// main().catch((e) => {
//   console.error('💥', e?.message ?? e);
//   process.exit(1);
// });
