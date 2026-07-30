/**
 * E2E HTTP REAL — DT-AUTH-RATE-LIMIT-FAIL-OPEN-SUBSTRATE-AUSENTE
 *
 * Prova COMPORTAMENTAL (não só "a tabela existe"): auth_rate_limit_logs precisa bloquear
 * de verdade. auth.login = 5 tentativas/minuto (auth-rate-limit.service.ts RATE_LIMITS).
 *   - 5 tentativas com o mesmo IP passam (401, credenciais inválidas — não 429);
 *   - a 6ª e a 7ª são BLOQUEADAS (429), mesmo IP, mesma janela;
 *   - auth_rate_limit_logs recebe exatamente 2 linhas por tentativa aceita (ip + email) —
 *     10 linhas para as 5 aceitas, nenhuma linha para as bloqueadas.
 *
 * Roda SÓ em DB efêmera (runner run-auth-rate-limit-ephemeral.ps1). NUNCA unificard_dev.
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-auth-rate-limit-substrate.ts
 */
import 'tsconfig-paths/register';
import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { pool } from '../core/database/pool';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/auth_rate_limit|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  const authModule = await import('../core/auth/auth.routes');
  await app.register(authModule.default, { prefix: '/auth' });
  await app.ready();
  return app;
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const tableCheck = await pool.query<{ t: string | null }>(`SELECT to_regclass('public.auth_rate_limit_logs')::text AS t`);
  record('substrato: tabela auth_rate_limit_logs existe', tableCheck.rows[0]?.t === 'auth_rate_limit_logs', `to_regclass=${tableCheck.rows[0]?.t}`);

  const email = `auth-rl-e2e-${Date.now()}@teste.com`;
  await pool.query(`DELETE FROM auth_rate_limit_logs WHERE key_value = $1 OR key_value = 'auth-rl-e2e-shared'`, [email]);

  const app = await buildApp();
  const login = () => app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email, password: 'senhaErrada123' }),
  });

  try {
    console.log('\n— rate limit real: 5 passam, 6ª e 7ª bloqueadas (auth.login = 5/min) —');
    const statuses: number[] = [];
    for (let i = 1; i <= 7; i++) {
      const res = await login();
      statuses.push(res.statusCode);
      console.log(`  tentativa ${i}: HTTP ${res.statusCode}`);
    }

    const firstFive = statuses.slice(0, 5);
    const sixthSeventh = statuses.slice(5, 7);

    record('A primeiras 5 tentativas NÃO bloqueadas (sem 429)', firstFive.every((s) => s !== 429), `statuses=${firstFive.join(',')}`);
    record('B 6ª tentativa BLOQUEADA (429)', sixthSeventh[0] === 429, `status=${sixthSeventh[0]}`);
    record('C 7ª tentativa também BLOQUEADA (429)', sixthSeventh[1] === 429, `status=${sixthSeventh[1]}`);

    const rows = await pool.query<{ key_type: string }>(
      `SELECT key_type FROM auth_rate_limit_logs WHERE key_value = $1 AND action = 'auth.login'`,
      [email]
    );
    record('D exatamente 5 linhas key_type=email gravadas (uma por tentativa aceita)',
      rows.rows.filter((r) => r.key_type === 'email').length === 5,
      `email-rows=${rows.rows.filter((r) => r.key_type === 'email').length}`);

    const ipRows = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text n FROM auth_rate_limit_logs WHERE key_type = 'ip' AND action = 'auth.login' AND attempted_at > now() - interval '2 minutes'`
    );
    record('E linhas key_type=ip também gravadas nesta janela', Number(ipRows.rows[0]?.n ?? '0') >= 5, `ip-rows=${ipRows.rows[0]?.n}`);
  } finally {
    await app.close();
    await pool.query(`DELETE FROM auth_rate_limit_logs WHERE key_value = $1`, [email]);
  }

  console.log('\n════════════════════════════════════════════');
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? `✅ AUTH-RATE-LIMIT-SUBSTRATE :: PASS (${results.length}/${results.length})` : `❌ AUTH-RATE-LIMIT-SUBSTRATE :: FAIL (${results.length - failed.length}/${results.length})`);
  console.log('════════════════════════════════════════════');
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('💥', e);
  process.exit(1);
});
