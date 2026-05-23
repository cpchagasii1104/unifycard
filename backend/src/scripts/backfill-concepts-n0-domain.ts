/**
 * Ajuste manual de domínio N0 por slug (concepts.domain após migração 0074).
 *
 * Antes da 0074 existia concepts.n0_domain — use backfill-n0-from-legacy.ts primeiro.
 *
 * Uso: pnpm backfill:concepts-n0-domain
 * Aplicar: pnpm backfill:concepts-n0-domain --apply
 */
import dotenv from 'dotenv';
import { join } from 'path';
import pg from 'pg';
import { isN0DomainKey } from '../core/ontology/n0-domains';

dotenv.config({ path: join(process.cwd(), '.env') });

const SLUG_TO_N0: Record<string, string> = {};

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

const apply = process.argv.includes('--apply');

async function main(): Promise<void> {
  const pool = new pg.Pool({ connectionString: url });
  try {
    const { rows: colRows } = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'concepts'
         AND column_name IN ('n0_domain', 'domain')`
    );
    const names = new Set(colRows.map((r) => r.column_name));
    const targetCol = names.has('n0_domain') ? 'n0_domain' : 'domain';
    if (!names.has('domain') && !names.has('n0_domain')) {
      console.error('Tabela concepts inesperada');
      process.exit(1);
    }

    const keys = Object.keys(SLUG_TO_N0);
    if (keys.length === 0) {
      console.log('Nenhum mapeamento em SLUG_TO_N0. Edite o ficheiro e adicione slug → N0.');
      return;
    }

    for (const slug of keys) {
      const n0 = SLUG_TO_N0[slug];
      if (!isN0DomainKey(n0)) {
        console.error(`Domínio inválido para slug "${slug}": ${n0}`);
        process.exit(1);
      }
    }

    for (const slug of keys) {
      const n0 = SLUG_TO_N0[slug];
      const sql = `UPDATE concepts SET ${targetCol} = $1 WHERE slug = $2 AND (${targetCol} IS NULL OR ${targetCol} <> $1)`;
      if (!apply) {
        console.log(`[dry-run] UPDATE concepts SET ${targetCol} = '${n0}' WHERE slug = '${slug}' ...`);
        continue;
      }
      const r = await pool.query(sql, [n0, slug]);
      console.log(`slug=${slug} → ${n0} (rowCount=${r.rowCount})`);
    }

    if (!apply) {
      console.log('\nPara aplicar: adicione --apply');
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});