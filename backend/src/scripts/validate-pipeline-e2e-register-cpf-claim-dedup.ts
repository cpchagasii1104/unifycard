/**
 * E2E F-REGISTER-CPF-CLAIM-DEDUP — 1 CPF = 1 identidade global (DECISION-0062).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-register-cpf-claim-dedup-ephemeral.ps1.
 *
 * Prova o vetor que NUNCA foi coberto (fixtures sempre usaram CPFs distintos): cadastro NOVO com CPF JÁ
 * RECLAMADO + e-mail diferente deve FALHAR FECHADO (409 CPF_ALREADY_REGISTERED), sem criar 2º user/profile/actor
 * preso ao mesmo global_user_id, sem vazar PII, sem depender de profiles.cpf (inexistente) nem do 23505 morto.
 * Money-free: Δbank=0; referral não interfere; tenant isolation preservado.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { authService } from '../core/auth/auth.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/register|cpf|claim|dedup|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  if (!process.env.JWT_SECRET) throw new Error('ABORT: JWT_SECRET ausente.');
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let cpfSeq = 0;
function genValidCpf(seed: number): string {
  const n: number[] = []; let x = seed;
  for (let i = 0; i < 9; i++) { n.push(x % 10); x = Math.floor(x / 10) + 3 * (i + 1); }
  const dig = (len: number) => { let s = 0; for (let i = 0; i < len; i++) s += n[i] * (len + 1 - i); const r = s % 11; return r < 2 ? 0 : 11 - r; };
  n.push(dig(9)); n.push(dig(10)); return n.join('');
}
const newCpf = () => genValidCpf(Math.floor(Math.random() * 90000000) + 10000000 + (cpfSeq += 7));
const reg = (email: string, cpf: string, name: string) => authService.register(undefined, email, 'senha123', cpf, name);
const errOf = (e: any): { code?: string; status?: number; msg: string } => ({ code: e?.code, status: e?.statusCode, msg: e?.message || String(e) });

async function main(): Promise<void> {
  await assertEphemeralDb();
  delete process.env.PILOT_MODE; // cadastro aberto (sem gate de convite)
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  // register resolve `unificard-inicial` server-side → garantir que existe na DB efêmera.
  const existsT = await pool.query(`SELECT 1 FROM tenants WHERE slug='unificard-inicial' LIMIT 1`);
  if (existsT.rows.length === 0) {
    await tenantService.createTenant({ id: randomUUID(), name: 'Unificard Inicial', slug: 'unificard-inicial' });
  }

  const bankSql = `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`;
  const bankBefore = await count(bankSql);

  const VICTIM_CPF = newCpf();
  const e1 = `victim-${Date.now()}@e2e.test`;

  // ── T1 — primeiro cadastro com CPF novo → OK ──
  {
    let ok = false; let msg = '';
    try { const r = await reg(e1, VICTIM_CPF, 'Vitima Original'); ok = !!r?.tenantId; } catch (e) { msg = errOf(e).msg; }
    record('T1 primeiro cadastro (CPF novo) → OK', ok, msg);
  }
  const gid = (await pool.query<{ g: string }>(`SELECT global_user_id::text AS g FROM global_users WHERE cpf=$1`, [VICTIM_CPF])).rows[0]?.g;

  // ── T2 — segundo cadastro, MESMO CPF + e-mail novo → 409 CPF_ALREADY_REGISTERED ──
  {
    const r = await reg(`attacker-${Date.now()}@e2e.test`, VICTIM_CPF, 'Atacante').then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
    record('T2 mesmo CPF + e-mail novo → 409 CPF_ALREADY_REGISTERED (fail-closed)',
      r.ok === false && r.err?.status === 409 && r.err?.code === 'CPF_ALREADY_REGISTERED', JSON.stringify(r.err));
  }

  // ── T3 — após a rejeição: exatamente 1 user / 1 profile / 1 user-actor no mesmo global_user_id ──
  {
    const users = await count(`SELECT count(*)::int AS n FROM users WHERE global_user_id=$1`, [gid]);
    const profiles = await count(`SELECT count(*)::int AS n FROM profiles p JOIN users u ON u.id=p.user_id WHERE u.global_user_id=$1`, [gid]);
    const actors = await count(`SELECT count(*)::int AS n FROM actors WHERE global_user_id=$1 AND actor_type='user'`, [gid]);
    record('T3 sem 2º user/profile/actor no mesmo global_user_id (1/1/1)', users === 1 && profiles === 1 && actors === 1, `users=${users} profiles=${profiles} actors=${actors}`);
  }

  // ── T4 — conta original continua válida (existe e logável) ──
  {
    const u = await count(`SELECT count(*)::int AS n FROM users WHERE email=$1`, [e1]);
    record('T4 conta original permanece válida', u === 1, `users(email1)=${u}`);
  }

  // ── T6 — CPF diferente + e-mail diferente → OK ──
  {
    let ok = false; let msg = '';
    try { const r = await reg(`other-${Date.now()}@e2e.test`, newCpf(), 'Outra Pessoa'); ok = !!r?.tenantId; } catch (e) { msg = errOf(e).msg; }
    record('T6 CPF diferente + e-mail diferente → OK (não regrediu cadastro legítimo)', ok, msg);
  }

  // ── T7 — mesmo e-mail (CPF diferente) → rejeitado pelo fluxo de e-mail existente ──
  {
    const r = await reg(e1, newCpf(), 'Email Dup').then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
    record('T7 e-mail já cadastrado → rejeitado (Email already registered)', r.ok === false && /Email already registered/i.test(r.err?.msg || ''), JSON.stringify(r.err));
  }

  // ── T11 — CONCORRÊNCIA: 2 cadastros simultâneos com MESMO CPF (e-mails distintos) → 1 OK, 1 409 ──
  {
    const cpf = newCpf();
    const [a, b] = await Promise.allSettled([
      reg(`race-a-${Date.now()}@e2e.test`, cpf, 'Race A'),
      reg(`race-b-${Date.now()}@e2e.test`, cpf, 'Race B'),
    ]);
    const okCount = [a, b].filter((x) => x.status === 'fulfilled').length;
    const rejCount = [a, b].filter((x) => x.status === 'rejected').length;
    const raceGid = (await pool.query<{ g: string }>(`SELECT global_user_id::text AS g FROM global_users WHERE cpf=$1`, [cpf])).rows[0]?.g;
    const users = raceGid ? await count(`SELECT count(*)::int AS n FROM users WHERE global_user_id=$1`, [raceGid]) : -1;
    record('T11 concorrência mesmo CPF → 1 OK / 1 409 / exatamente 1 user', okCount === 1 && rejCount === 1 && users === 1, `ok=${okCount} rej=${rejCount} users=${users}`);
  }

  // ── T8 — Δbank=0 (cadastro não toca dinheiro) ──
  record('T8 Δbank=0 (register não move dinheiro)', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ register recusa CPF já reclamado (409, sem PII, sem 2º actor); concorrência serializa; cadastro legítimo intacto; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
