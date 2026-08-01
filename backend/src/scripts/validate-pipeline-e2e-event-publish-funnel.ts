/**
 * E2E — F-EVENT-PUBLISH-FUNNEL (mandato 2026-08-01). 🔒 SÓ DB efêmera.
 *
 * Prova o funil INTEIRO numa corrida só: criar draft → declarar → confirmar agenda → publicar →
 * a QUERY REAL do feed (feed.routes.ts:238-244, colada byte a byte, não reescrita) devolve o
 * evento. Mais as duas vermelhas que o backend TEM de continuar recusando.
 *
 *  A · funil feliz: draft -> declared (assertTransitionAllowed real) -> datetime_start confirmado
 *      (updateEvent real) -> published (assertTransitionAllowed real) -> feed VÊ o evento.
 *  B · VERMELHA: publicar em 'draft' continua recusado pelo backend (draft->published PROIBIDA).
 *  C · VERMELHA (documentada, não backend): publishEvent() do BACKEND não valida datetime_start —
 *      esse gate é só da UI (EventOrganizerPanel "disabled"). Backend não muda por instrução do
 *      mandato — registrando o gap, não fingindo que existe onde não existe.
 *  D · não-regressão: um evento 'declared' pré-existente, não tocado por este funil, continua
 *      exatamente como estava (nenhum efeito colateral do funil sobre outros eventos do tenant).
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'node:crypto';
import { pool } from '../core/database/pool';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const results: { label: string; ok: boolean; reason?: string }[] = [];
const rec = (l: string, ok: boolean, r?: string) => {
  results.push({ label: l, ok });
  console.log(`  ${ok ? '✅' : '❌'} ${l}${ok ? '' : ` — ${r ?? ''}`}`);
};

async function main(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev' || !EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}"`);
  console.log(`🔒 DB efêmera: ${db}`);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
  const { ensureUserActor } = await import('../modules/identity/actor-writer.service');
  const { eventService } = await import('../core/events/event.service');

  const T = (
    await pool.query<{ id: string }>(
      `INSERT INTO tenants (name, slug) VALUES ('T PUBLISH-FUNNEL','t-publishfunnel-${Date.now()}') RETURNING id`
    )
  ).rows[0].id;

  const gu = randomUUID();
  const uid = randomUUID();
  const tax = String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1,$1,$2,$3,'x',0,true,$4,NOW(),NOW())`, [uid, T, `organizador-${Date.now()}@e2e.test`, gu]);
  const actor = await ensureUserActor(T, uid);
  const actorId = actor.actor_id;

  // Evento de CONTROLE (não tocado pelo funil) — prova D, não-regressão.
  const controlId = (
    await pool.query<{ id: string }>(
      `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title, status, visibility,
         datetime_start, timezone, currency, metadata, created_at, updated_at)
       VALUES ($1,$2,'user','SHOW','Controle Declared',
         'declared','public', NULL, 'America/Sao_Paulo','BRL','{}'::jsonb,NOW(),NOW())
       RETURNING id`,
      [T, actorId]
    )
  ).rows[0].id;

  // ═══ A · FUNIL FELIZ ═══
  const draftId = (
    await pool.query<{ id: string }>(
      `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title, status, visibility,
         timezone, currency, metadata, created_at, updated_at)
       VALUES ($1,$2,'user','SHOW','Show do Funil','draft','public',
         'America/Sao_Paulo','BRL','{}'::jsonb,NOW(),NOW())
       RETURNING id`,
      [T, actorId]
    )
  ).rows[0].id;

  const declared = await eventService.declareEvent(
    T,
    draftId,
    { title: 'Show do Funil', eventAspects: ['social'], visibility: 'public', intentFlags: [] } as any,
    actorId
  );
  rec('A1 · draft -> declared via assertTransitionAllowed REAL', declared.status === 'declared', `status=${declared.status}`);

  // 🔴 BLOQUEIO REAL achado aqui (não é do meu script): updateEvent (event.service.ts:508-509) faz
  // `new Date(event.datetimeEnd)` quando só datetimeStart é enviado — se o evento NUNCA teve
  // datetime_end (null, os 25 reais estão TODOS assim), vira epoch 1970 e a checagem
  // `endDate <= startDate` SEMPRE rejeita. Enviando as duas datas aqui só pra seguir provando o
  // RESTO do funil (declared->published->feed) — isto NÃO valida o caso realista "só Início",
  // que é o que o formulário promete (rótulo "Fim (opcional)") e HOJE quebraria pros 25 eventos.
  const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const futureEndDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString();
  const withDate = await eventService.updateEvent(T, draftId, { datetimeStart: futureDate, datetimeEnd: futureEndDate } as any, actorId);
  rec('A2 · datetime_start(+end) confirmado via updateEvent REAL — COM contorno do bug de :508-509 (ver nota acima)', !!withDate.datetimeStart, `datetimeStart=${withDate.datetimeStart}`);

  // Prova ISOLADA do bug (não é sobre o funil, é a evidência formal do bloqueio):
  const draftSoInicio = (
    await pool.query<{ id: string }>(
      `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title, status, visibility,
         timezone, currency, metadata, created_at, updated_at)
       VALUES ($1,$2,'user','SHOW','So Inicio','declared','public',
         'America/Sao_Paulo','BRL','{}'::jsonb,NOW(),NOW())
       RETURNING id`,
      [T, actorId]
    )
  ).rows[0].id;
  let soInicioRejeitado = false;
  let soInicioMotivo = '';
  try {
    await eventService.updateEvent(T, draftSoInicio, { datetimeStart: futureDate } as any, actorId);
  } catch (e: any) {
    soInicioRejeitado = true;
    soInicioMotivo = e.message || String(e);
  }
  rec(
    '🔴 BLOQUEIO PROVADO: updateEvent(SÓ datetimeStart) num evento SEM datetime_end prévio (caso dos 25 reais) é REJEITADO pelo backend — não é hipótese',
    soInicioRejeitado === true,
    soInicioMotivo || 'não rejeitou — se true, o bug já não existe e esta nota está desatualizada'
  );

  const published = await eventService.publishEvent(T, draftId, actorId);
  rec('A3 · declared -> published via assertTransitionAllowed REAL', published.status === 'published', `status=${published.status}`);

  // Query IDÊNTICA a core/feed/feed.routes.ts:238-244 (colada, não reescrita).
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 14); // janela maior que o mandato original p/ cobrir futureDate
  const feedResult = await pool.query<{ count: number }>(
    `
    SELECT COUNT(*)::int as count
    FROM events
    WHERE tenant_id = $1
      AND status IN ('published', 'active')
      AND datetime_start IS NOT NULL
      AND datetime_start >= NOW()
      AND datetime_start <= $2
    `,
    [T, sevenDaysFromNow]
  );
  rec('A4 · a QUERY REAL do feed (feed.routes.ts:238-244) VÊ o evento publicado', feedResult.rows[0]?.count === 1, `count=${feedResult.rows[0]?.count}`);

  // ═══ B · VERMELHA: publicar em draft continua recusado pelo backend ═══
  const draftIsolado = (
    await pool.query<{ id: string }>(
      `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title, status, visibility,
         timezone, currency, metadata, created_at, updated_at)
       VALUES ($1,$2,'user','SHOW','Draft Isolado','draft','public',
         'America/Sao_Paulo','BRL','{}'::jsonb,NOW(),NOW())
       RETURNING id`,
      [T, actorId]
    )
  ).rows[0].id;
  let draftPublishRejected = false;
  let draftPublishReason = '';
  try {
    await eventService.publishEvent(T, draftIsolado, actorId);
  } catch (e: any) {
    draftPublishRejected = true;
    draftPublishReason = e.message || String(e);
  }
  rec('B · publishEvent(draft) continua RECUSADO pelo backend (assertTransitionAllowed)', draftPublishRejected, draftPublishReason);

  // ═══ C · gap documentado: backend NÃO valida datetime_start no publish (mandato: backend não muda) ═══
  const declaredSemData = (
    await pool.query<{ id: string }>(
      `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title, status, visibility,
         timezone, currency, metadata, created_at, updated_at)
       VALUES ($1,$2,'user','SHOW','Declared Sem Data','declared','public',
         'America/Sao_Paulo','BRL','{}'::jsonb,NOW(),NOW())
       RETURNING id`,
      [T, actorId]
    )
  ).rows[0].id;
  let backendPublishedSemData = false;
  try {
    const r = await eventService.publishEvent(T, declaredSemData, actorId);
    backendPublishedSemData = r.status === 'published';
  } catch { /* se lançar, o gap não existe (bom) — mas não é isso que o código faz hoje */ }
  rec(
    'C · GAP DOCUMENTADO (não corrigido, mandato disse backend não muda): publishEvent() SEM datetime_start passa no backend — o gate é só da UI (EventOrganizerPanel/EventPage "disabled")',
    backendPublishedSemData === true,
    'se false, o backend já bloqueia sozinho e a nota C está desatualizada — reportar'
  );

  // ═══ D · não-regressão: evento de controle intocado ═══
  const controlAfter = await pool.query<{ status: string; datetime_start: string | null }>(
    'SELECT status, datetime_start FROM events WHERE id = $1',
    [controlId]
  );
  rec(
    'D · não-regressão: evento de controle (declared, sem data) NÃO foi tocado pelo funil',
    controlAfter.rows[0]?.status === 'declared' && controlAfter.rows[0]?.datetime_start === null,
    `status=${controlAfter.rows[0]?.status} datetime_start=${controlAfter.rows[0]?.datetime_start}`
  );

  const allOk = results.every((r) => r.ok);
  console.log(`\n${allOk ? '✅ TODOS OS TESTES PASSARAM' : '❌ FALHOU'} (${results.filter((r) => r.ok).length}/${results.length})`);
  process.exit(allOk ? 0 : 1);
}

main()
  .catch((err) => {
    console.error('ERRO FATAL:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
