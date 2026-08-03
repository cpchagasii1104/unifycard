/**
 * E2E — F-BUSINESS-AUDIT-RESTORE. 🔒 SÓ DB efêmera.
 *
 *  RED   (sem a migration): a trilha de auditoria é DESCARTADA em silêncio — recordBusinessAuditSafely
 *        engole o 42P01 e devolve normalmente, como se tivesse gravado. É o defeito de hoje, vivo.
 *  GREEN (com a migration): ① grava de verdade · ② append-only morde UPDATE e DELETE ·
 *        ③ action fora do vocabulário é recusada · ④ o CHECK cobre TODO o vocabulário do TS
 *        (se o TS crescer sem migration, o INSERT vira silêncio de novo — esta é a asserção que
 *        impede a regressão).
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from '../core/database/pool';

const phase = process.argv[2] as 'red' | 'green' | undefined;
const results: { label: string; ok: boolean }[] = [];
const rec = (l: string, ok: boolean, extra?: string) => {
  results.push({ label: l, ok });
  console.log(`  ${ok ? '✅' : '❌'} ${l}${ok ? '' : ` — ${extra ?? ''}`}`);
};

/** Vocabulário declarado no TS — a fonte do que o código realmente insere. */
function vocabFromTypes(): { actions: string[]; contexts: string[] } {
  const src = readFileSync(join(process.cwd(), 'src/modules/business-audit/business-audit.types.ts'), 'utf8');
  const grab = (name: string): string[] => {
    const m = src.match(new RegExp(`export type ${name}\\s*=([\\s\\S]*?);`));
    if (!m) throw new Error(`tipo ${name} não encontrado`);
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  };
  return { actions: grab('BusinessAuditAction'), contexts: grab('BusinessAuditContextType') };
}

async function main(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev' || !process.env.EXPECTED_DATABASE_NAME || db !== process.env.EXPECTED_DATABASE_NAME) {
    throw new Error(`ABORT: banco "${db}"`);
  }
  console.log(`🔒 DB efêmera: ${db}\n`);

  const T = (
    await pool.query<{ id: string }>(
      `INSERT INTO tenants (name, slug) VALUES ('T AUDIT','t-audit-${Date.now()}') RETURNING id`
    )
  ).rows[0].id;
  const actorId = randomUUID();
  const contextId = randomUUID();

  const { recordBusinessAuditSafely } = await import('../modules/business-audit/business-audit.helpers');

  if (phase === 'red') {
    // O helper NÃO lança: engole o 42P01. O sistema segue como se tivesse auditado.
    let threw = false;
    try {
      await recordBusinessAuditSafely(T, {
        action: 'agreement_created', actorId, contextType: 'agreement', contextId,
      } as never);
    } catch { threw = true; }
    const tableExists = (
      await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM information_schema.tables WHERE table_name='business_audit_logs'`
      )
    ).rows[0].n;
    rec('RED · a tabela NÃO existe', tableExists === '0', `count=${tableExists}`);
    rec('RED · o helper NÃO propaga o erro (a trilha some em silêncio)', !threw);
    console.log('\n🔴 defeito confirmado: 40 call sites gravando no vazio, sem ninguém saber.');
    const allRed = results.every((r) => r.ok);
    if (!allRed) process.exit(1);
    return;
  }

  // ── GREEN
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [T]);
  await recordBusinessAuditSafely(T, {
    action: 'agreement_created', actorId, contextType: 'agreement', contextId,
  } as never);
  const rows = await pool.query<{ log_id: string; action: string }>(
    `SELECT log_id, action FROM business_audit_logs WHERE tenant_id=$1`, [T]
  );
  rec('GREEN① a trilha GRAVA de verdade', rows.rowCount === 1 && rows.rows[0].action === 'agreement_created',
    `linhas=${rows.rowCount}`);

  const logId = rows.rows[0]?.log_id;
  let updBlocked = false;
  try { await pool.query(`UPDATE business_audit_logs SET action='dispute_opened' WHERE log_id=$1`, [logId]); }
  catch (e) { updBlocked = String((e as Error).message).includes('BUSINESS_AUDIT_LOG_IMMUTABLE'); }
  rec('GREEN② UPDATE é recusado pelo trigger append-only', updBlocked);

  let delBlocked = false;
  try { await pool.query(`DELETE FROM business_audit_logs WHERE log_id=$1`, [logId]); }
  catch (e) { delBlocked = String((e as Error).message).includes('BUSINESS_AUDIT_LOG_IMMUTABLE'); }
  rec('GREEN② DELETE é recusado pelo trigger append-only', delBlocked);

  let badBlocked = false;
  try {
    await pool.query(
      `INSERT INTO business_audit_logs (tenant_id, action, actor_id, context_type, context_id)
       VALUES ($1,'ACAO_INVENTADA',$2,'agreement',$3)`, [T, actorId, contextId]
    );
  } catch (e) { badBlocked = (e as { code?: string }).code === '23514'; }
  rec('GREEN③ action fora do vocabulário é recusada (23514)', badBlocked);

  // ④ o CHECK cobre TODO o vocabulário do TS — impede a regressão silenciosa.
  const { actions, contexts } = vocabFromTypes();
  const defs = await pool.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid='business_audit_logs'::regclass AND contype='c'`
  );
  const allDefs = defs.rows.map((r) => r.def).join(' ');
  const missingA = actions.filter((a) => !allDefs.includes(`'${a}'`));
  const missingC = contexts.filter((c) => !allDefs.includes(`'${c}'`));
  rec(
    `GREEN④ CHECK cobre os ${actions.length} actions e ${contexts.length} contextos do TS`,
    missingA.length === 0 && missingC.length === 0,
    `faltando actions=${missingA.join(',')} contexts=${missingC.join(',')}`
  );

  const upper = [...actions, ...contexts].filter((v) => /[A-Z]/.test(v));
  rec('GREEN⑤ vocabulário 100% minúsculo (§4.77/§4.78)', upper.length === 0, `maiúsculos=${upper.join(',')}`);

  const allOk = results.every((r) => r.ok);
  console.log(`\n${allOk ? '✅ TODAS PASSARAM' : '❌ FALHOU'} (${results.filter((r) => r.ok).length}/${results.length})`);
  if (!allOk) process.exit(1);
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(`💥 ${err instanceof Error ? err.message : String(err)}`);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
