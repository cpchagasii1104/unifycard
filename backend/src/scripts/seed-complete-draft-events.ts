/**
 * CONCLUI OS EVENTOS DE TESTE PENDENTES — dá data, declara e publica.
 *
 * 🔴 AUTORIZADO POR CLAYTON em 2026-08-04: *"Você consegue em meus eventos concluir os 37 sendo
 * cadastrados? … é usuário teste e os eventos são testes, depois a gente apaga."*
 *
 * O problema que isto resolve: 37 eventos parados em `draft`/`declared` SEM data. Sem
 * `datetime_start` futura eles não podem ser publicados, não entram na vitrine, e a tela de gestão
 * fica cheia de "falta confirmar a data". Eram o resultado de meses de testes manuais no wizard.
 *
 * ═══ O QUE ESTE SCRIPT RESPEITA ═══
 *  · Usa o CAMINHO REAL do domínio (`eventService.declareEvent` / `publishEvent` / `updateEvent`),
 *    NUNCA `UPDATE events SET status='published'` — a máquina de estados é autoridade:
 *    `draft → declared → published`. `draft → published` é PROIBIDA e o domínio recusa.
 *  · 🔴 `updateEvent` REJEITA quando só `datetimeStart` é enviado contra evento sem
 *    `datetime_end` (bug conhecido, registrado no E2E do publish-funnel: `new Date(null)` = 1970 e
 *    a checagem `end <= start` sempre falha). Por isso mandamos SEMPRE as duas datas.
 *  · Só toca evento SEM data (`datetime_start IS NULL`) — quem já tem data não é mexido.
 *  · Δbank=0.
 *  · Idempotente: re-rodar não altera quem já foi concluído.
 *
 * ⚠️ Marca `metadata.completed_by_seed = true` para que estes eventos sejam identificáveis e
 * apagáveis depois, como Clayton pediu.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';

/** Espalha os eventos entre 5 e 90 dias no futuro, em horários plausíveis. */
function dataFutura(indice: number): { inicio: Date; fim: Date } {
  const inicio = new Date();
  inicio.setDate(inicio.getDate() + 5 + (indice * 3) % 85);
  inicio.setHours(19 + (indice % 4), 0, 0, 0);
  const fim = new Date(inicio);
  fim.setHours(inicio.getHours() + 3);
  return { inicio, fim };
}

async function main(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  console.log(`🗓️  Concluindo eventos de teste sem data em: ${db}\n`);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
  const { eventService } = await import('../core/events/event.service');

  const bank0 = (await pool.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`)).rows[0].n;

  const pendentes = (
    await pool.query<{ id: string; tenant_id: string; actor_id: string; title: string; status: string }>(
      `SELECT id::text, tenant_id::text, actor_id::text, title, status
         FROM events
        WHERE datetime_start IS NULL
          AND status IN ('draft','declared')
        ORDER BY created_at ASC`
    )
  ).rows;

  console.log(`Encontrados: ${pendentes.length} evento(s) sem data em draft/declared\n`);
  if (pendentes.length === 0) {
    console.log('Nada a fazer (idempotente).');
    await pool.end();
    return;
  }

  let declarados = 0, comData = 0, publicados = 0;
  const falhas: Array<{ titulo: string; etapa: string; motivo: string }> = [];

  for (let i = 0; i < pendentes.length; i++) {
    const ev = pendentes[i];
    const { inicio, fim } = dataFutura(i);
    try {
      // 1) draft → declared (transição REAL; draft→published é proibida pela máquina de estados)
      if (ev.status === 'draft') {
        await eventService.declareEvent(
          ev.tenant_id,
          ev.id,
          { title: ev.title, eventAspects: ['social'], visibility: 'public', intentFlags: [] } as never,
          ev.actor_id
        );
        declarados++;
      }

      // 2) data confirmada — SEMPRE as duas (ver nota sobre o bug de new Date(null) no topo)
      await eventService.updateEvent(
        ev.tenant_id,
        ev.id,
        { datetimeStart: inicio.toISOString(), datetimeEnd: fim.toISOString() } as never,
        ev.actor_id
      );
      comData++;

      // 3) declared → published
      await eventService.publishEvent(ev.tenant_id, ev.id, ev.actor_id);
      publicados++;

      // Marcador para poder apagar depois (pedido explícito de Clayton).
      await pool.query(
        `UPDATE events SET metadata = COALESCE(metadata,'{}'::jsonb) || '{"completed_by_seed":true}'::jsonb WHERE id = $1::uuid`,
        [ev.id]
      );

      console.log(`   ✅ ${ev.title.slice(0, 44).padEnd(44)} → publicado ${inicio.toLocaleDateString('pt-BR')}`);
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      falhas.push({ titulo: ev.title, etapa: ev.status, motivo });
      console.log(`   ⚠️  ${ev.title.slice(0, 44).padEnd(44)} → ${motivo.slice(0, 70)}`);
    }
  }

  const bank1 = (await pool.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`)).rows[0].n;
  const naVitrine = (
    await pool.query<{ n: string }>(
      `SELECT count(*)::text n FROM events
        WHERE status IN ('published','active') AND datetime_start IS NOT NULL AND datetime_start >= NOW()`
    )
  ).rows[0].n;
  const aindaSemData = (
    await pool.query<{ n: string }>(`SELECT count(*)::text n FROM events WHERE datetime_start IS NULL AND status IN ('draft','declared')`)
  ).rows[0].n;

  console.log('\n' + '═'.repeat(64));
  console.log(`declarados ${declarados} · com data ${comData} · publicados ${publicados}`);
  if (falhas.length > 0) {
    console.log(`\n⚠️  ${falhas.length} não concluído(s) — motivo REAL, não escondido:`);
    const porMotivo = new Map<string, number>();
    for (const f of falhas) porMotivo.set(f.motivo.slice(0, 90), (porMotivo.get(f.motivo.slice(0, 90)) ?? 0) + 1);
    for (const [m, n] of porMotivo) console.log(`   ${n}× ${m}`);
  }
  console.log(`\nEVENTOS na vitrine agora: ${naVitrine}`);
  console.log(`Ainda sem data (draft/declared): ${aindaSemData}`);
  console.log(`Δbank: ${bank0} → ${bank1} ${bank0 === bank1 ? '(ZERO ✅)' : '(🔴 MOVEU!)'}`);
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(`💥 ${err instanceof Error ? err.message : String(err)}`);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
