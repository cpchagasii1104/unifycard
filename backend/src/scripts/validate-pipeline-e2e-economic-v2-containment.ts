/**
 * E2E — F-EVENT-ECONOMIC-V2-HONEST-CONTAINMENT (DECISION-0190 §4/§9, SELADA · VEREDITO A).
 *
 * Prova, via HTTP real (app.inject, sem frontend), que TODA a família economic/v2 devolve o 501
 * honesto ANTES de qualquer service/side-effect. As rotas alvo NÃO são digitadas como literais
 * operacionais neste arquivo — são descobertas dinamicamente via o hook onRoute do Fastify
 * (introspecção real do plugin registrado), e classificadas apenas por MÉTODO HTTP + sufixo do
 * path (nenhuma palavra de vocabulário financeiro fora do domínio Bank é introduzida como token
 * novo neste arquivo — DECISION-0158 ratchet).
 *
 * 🔴 COMPLETADO 2026-07-30 (achado da Yala, veredito B): até esta fatia, 3 das 11 rotas ficavam
 * FORA da contenção — advance (POST), custody (GET) e a 3ª rota de leitura da família (GET). O
 * GET custody, em particular, lia da tabela schema-ghost `event_custody` (nunca migrada) e
 * devolvia 500 (42P01) para QUALQUER autenticado do tenant — endpoint vivo, sem preHandler,
 * quebrado desde a gênese. Agora as 11 rotas têm o MESMO 501, sem exceção — leitura NÃO é carve-out.
 *
 *   T1 inventário: 11 rotas descobertas sob a família — TODAS contidas, zero carve-out.
 *   T2 as 11 → 501 EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED, MESMO para o DONO do
 *      evento (chamador legítimo) — a contenção não distingue autoridade, contém TUDO.
 *   T3 zero side-effect: contadores (bank_ledger+bank_transactions, event_custody,
 *      event_payment_authorization) idênticos antes/depois da bateria das 11 chamadas.
 *   T4 Δbank = 0.
 *   T5 guard audit-economic-v2-containment verde.
 *
 * 🔒 DB EFÊMERA (wrapper run-economic-v2-containment-ephemeral.ps1). NUNCA unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import eventRoutes from '../core/events/event.routes';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const cwd = process.cwd();
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/economic|containment|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId };
}

// Sintetiza um corpo MINIMAMENTE VÁLIDO a partir do JSON-schema real da rota (introspectado em runtime,
// via routeOptions.schema — nenhum nome de campo é hardcoded neste arquivo). Necessário porque o Fastify
// valida o corpo ANTES de invocar o handler; sem um payload válido, o schema rejeitaria com 400 antes de
// a contenção (que vive DENTRO do handler) sequer executar — o teste tem que provar o 501 real, não um
// 400 de schema.
function synth(schema: unknown): unknown {
  const s = schema as Record<string, unknown> | undefined;
  if (!s || typeof s !== 'object') return 'e2e';
  if (s.enum && Array.isArray(s.enum)) return s.enum[0];
  const rawType = s.type;
  const type = Array.isArray(rawType) ? (rawType as string[]).find((t) => t !== 'null') : rawType;
  if (type === 'object') {
    const out: Record<string, unknown> = {};
    const required = Array.isArray(s.required) ? (s.required as string[]) : [];
    const props = (s.properties as Record<string, unknown>) || {};
    for (const key of required) out[key] = synth(props[key]);
    return out;
  }
  if (type === 'array') return [synth(s.items)];
  if (type === 'string') return (s as { format?: string }).format === 'uuid' ? randomUUID() : 'e2e';
  if (type === 'number' || type === 'integer') {
    const min = typeof s.minimum === 'number' ? s.minimum : 1;
    return min;
  }
  if (type === 'boolean') return true;
  return 'e2e';
}

const CONTAINMENT_CODE = 'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED';

async function main(): Promise<void> {
  await assertEphemeralDb();
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Economic V2 Containment', slug: `ev2c-${Date.now()}` });
  const owner = await mkUserActor(TENANT, 'Dono'); // dono LEGÍTIMO do evento — a contenção deve valer até para ele.

  const eventId = (await pool.query<{ id: string }>(
    `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title) VALUES ($1::uuid,$2::uuid,'user','general','E2E Economic V2 Containment') RETURNING id::text AS id`,
    [TENANT, owner.actorId]
  )).rows[0].id;

  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = { userId: owner.userId, id: owner.userId };
    req.tenant = { id: TENANT };
    req.actionContext = { actorId: owner.actorId, intent: 'e2e', source: 'e2e', scope: `e2e-${TENANT}` };
  });

  // Introspecção REAL do plugin registrado (onRoute) — nenhuma lista de paths hardcoded neste arquivo.
  const discovered: { method: string; url: string; bodySchema: unknown }[] = [];
  app.addHook('onRoute', (routeOptions: any) => {
    // Fastify auto-registra HEAD para toda rota GET (exposeHeadRoutes) — não é uma rota real do plugin,
    // filtrado aqui para o inventário não inflar (rotas GET → HEAD auto-gerados, não fazem parte do MAP).
    if (
      typeof routeOptions.url === 'string' &&
      routeOptions.url.includes('economic') &&
      routeOptions.url.includes('v2') &&
      routeOptions.method !== 'HEAD'
    ) {
      discovered.push({
        method: String(routeOptions.method),
        url: routeOptions.url,
        bodySchema: routeOptions.schema?.body,
      });
    }
  });
  await app.register(eventRoutes);
  await app.ready();

  try {
    // T1 — inventário completo e provado: TODAS as 11 são contidas agora, zero carve-out.
    record(
      'T1 inventário: 11 rotas descobertas na família economic/v2, TODAS contidas (zero carve-out)',
      discovered.length === 11,
      `total=${discovered.length}`
    );

    // event_custody/event_payment_authorization são schema-ghost — NUNCA migradas (confirmado: nenhuma
    // migration em migrations/*.sql cria essas tabelas). count() tolera a ausência (mesmo padrão do
    // irmão validate-pipeline-e2e-event-economic-authority-binding.ts) — contagem 0 nesse caso ainda
    // prova "zero side-effect": ou a tabela não existe (nada pôde ser gravado), ou existe e não mudou.
    const countTolerant = async (sql: string, p: unknown[] = []): Promise<number> => {
      try { return await count(sql, p); } catch { return 0; }
    };

    // Baseline de side-effect ANTES da bateria (soma para não depender de qual rota grava em qual tabela).
    const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger) + (SELECT count(*) FROM bank_transactions))::int AS n`);
    const custodyBefore = await countTolerant(`SELECT count(*)::int AS n FROM event_custody WHERE event_id = $1`, [eventId]);
    const authBefore = await countTolerant(`SELECT count(*)::int AS n FROM event_payment_authorization WHERE event_id = $1`, [eventId]);

    // T2 — cada uma das 11 rotas (POST e GET) devolve o 501 honesto, mesmo para o DONO do evento.
    let allContained = true;
    const containedDetails: string[] = [];
    for (const route of discovered) {
      const url = route.url.replace(':eventId', eventId);
      const opts: any = { method: route.method, url };
      if (route.method === 'POST') {
        opts.headers = { 'content-type': 'application/json' };
        opts.payload = JSON.stringify(synth(route.bodySchema));
      }
      const res = await app.inject(opts);
      const body = JSON.parse(res.body || '{}');
      const ok = res.statusCode === 501 && body?.code === CONTAINMENT_CODE;
      if (!ok) allContained = false;
      containedDetails.push(`${route.method} ${url} → status=${res.statusCode} code=${body?.code}`);
    }
    record('T2 as 11 rotas (POST+GET) → 501 EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED (dono do evento incluso)', allContained, containedDetails.join(' | '));

    // T3 — zero side-effect (contadores idênticos antes/depois da bateria completa das 11 chamadas).
    const bankAfterBattery = await count(`SELECT ((SELECT count(*) FROM bank_ledger) + (SELECT count(*) FROM bank_transactions))::int AS n`);
    const custodyAfter = await countTolerant(`SELECT count(*)::int AS n FROM event_custody WHERE event_id = $1`, [eventId]);
    const authAfter = await countTolerant(`SELECT count(*)::int AS n FROM event_payment_authorization WHERE event_id = $1`, [eventId]);
    record(
      'T3 zero side-effect (bank + event_custody + event_payment_authorization inalterados)',
      bankBefore === bankAfterBattery && custodyBefore === custodyAfter && authBefore === authAfter,
      `bank ${bankBefore}→${bankAfterBattery} · custody ${custodyBefore}→${custodyAfter} · authorization ${authBefore}→${authAfter}`
    );

    // T4 — Δbank = 0 (fim a fim, do início do teste até aqui).
    const bankFinal = await count(`SELECT ((SELECT count(*) FROM bank_ledger) + (SELECT count(*) FROM bank_transactions))::int AS n`);
    record('T4 Δbank = 0', bankFinal === bankBefore, `${bankBefore} → ${bankFinal}`);

    // T5 — guard estrutural verde.
    let guard = false;
    try { execSync('node scripts/audit-economic-v2-containment.mjs', { cwd, encoding: 'utf8' }); guard = true; } catch { guard = false; }
    record('T5 guard audit-economic-v2-containment verde', guard);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  console.log('✨ Família economic/v2 INTEIRA (11 rotas, DECISION-0190 §4 completado) honestamente contida ANTES de qualquer side-effect; Δbank=0.');
  await pool.end();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
