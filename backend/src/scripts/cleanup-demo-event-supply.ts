/**
 * FAXINA do dado de DEMONSTRAÇÃO de eventos — desfaz o que os dois seeds criaram.
 *
 * Existe porque Clayton disse, ao autorizar: *"é usuário teste e os eventos são testes, depois a
 * gente apaga."* Melhor deixar a saída pronta agora, enquanto o mapa do que foi criado está fresco,
 * do que reconstruir esse conhecimento daqui a um mês.
 *
 * ═══ 🔴 NADA AQUI RODA SEM CONFIRMAÇÃO EXPLÍCITA ═══
 * Sem argumento, o script apenas LISTA o que apagaria (dry-run). Para executar de verdade:
 *
 *     npx tsx src/scripts/cleanup-demo-event-supply.ts --confirmar
 *
 * ═══ O QUE ELE ALCANÇA — e como sabe que é dele ═══
 * SOMENTE linhas com marcador explícito, nunca por nome/heurística:
 *   · eventos    → metadata->>'demo_seed' = 'true'   (os 6 semeados)
 *   · eventos    → metadata->>'completed_by_seed'    (os 36 rascunhos concluídos) ⚠️ ver abaixo
 *   · empresas   → actors.metadata->>'demo_seed'     (as 7 fornecedoras) + ofertas/serviços delas
 *   · locáveis   → rentable_resources.metadata->>'demo_seed'
 *   · donos      → users com e-mail terminando em '.demo.unificard'
 *
 * ⚠️ **`completed_by_seed` NÃO é apagado por padrão.** Esses 36 eventos são de Clayton — meses de
 * teste manual no wizard; o seed só deu data e publicou. Apagá-los seria destruir trabalho dele,
 * não limpar sujeira minha. Só saem com `--incluir-eventos-do-clayton`, e mesmo assim listados um
 * a um antes.
 *
 * Δbank=0 esperado: nada disto tocou dinheiro. O script MEDE antes e depois e ABORTA se mudar.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';

const CONFIRMAR = process.argv.includes('--confirmar');
const INCLUIR_EVENTOS_CLAYTON = process.argv.includes('--incluir-eventos-do-clayton');

async function contar(sql: string, params: unknown[] = []): Promise<number> {
  const r = await pool.query<{ n: string }>(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}

async function main(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  console.log(`🧹 Faxina do dado de demonstração em: ${db}`);
  console.log(CONFIRMAR ? '⚠️  MODO EXECUÇÃO (--confirmar)\n' : '👀 DRY-RUN — nada será apagado. Use --confirmar para executar.\n');

  const bank0 = await contar(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`);

  const eventosDemo = await contar(`SELECT count(*)::text n FROM events WHERE metadata->>'demo_seed' = 'true'`);
  const eventosClayton = await contar(`SELECT count(*)::text n FROM events WHERE metadata->>'completed_by_seed' = 'true'`);
  const empresas = await contar(`SELECT count(*)::text n FROM actors WHERE metadata->>'demo_seed' = 'true'`);
  const locaveis = await contar(`SELECT count(*)::text n FROM rentable_resources WHERE metadata->>'demo_seed' = 'true'`);
  const ofertas = await contar(
    `SELECT count(*)::text n FROM service_offerings so
      WHERE so.provider_actor_id IN (SELECT id FROM actors WHERE metadata->>'demo_seed' = 'true')`
  );
  const donos = await contar(`SELECT count(*)::text n FROM users WHERE email LIKE '%.demo.unificard'`);

  console.log('O QUE SERIA APAGADO:');
  console.log(`   eventos de demonstração (demo_seed)  : ${eventosDemo}`);
  console.log(`   ofertas das empresas de demonstração : ${ofertas}`);
  console.log(`   locáveis de demonstração             : ${locaveis}`);
  console.log(`   empresas fornecedoras                : ${empresas}`);
  console.log(`   donos (contas *.demo.unificard)      : ${donos}`);
  console.log(`\nO QUE FICA (a menos que --incluir-eventos-do-clayton):`);
  console.log(`   eventos DO CLAYTON concluídos pelo seed: ${eventosClayton}  ← trabalho dele, não sujeira minha`);
  if (INCLUIR_EVENTOS_CLAYTON) {
    console.log('   ⚠️  --incluir-eventos-do-clayton ATIVO: os acima TAMBÉM serão apagados.');
    const amostra = await pool.query<{ title: string }>(
      `SELECT title FROM events WHERE metadata->>'completed_by_seed' = 'true' ORDER BY created_at LIMIT 10`
    );
    amostra.rows.forEach((r) => console.log(`        - ${r.title}`));
    if (eventosClayton > 10) console.log(`        … e mais ${eventosClayton - 10}`);
  }

  if (!CONFIRMAR) {
    // NÃO fecha o pool aqui: quem fecha é o `.then(() => pool.end())` lá embaixo. Fechar nos dois
    // lugares dava "Called end on pool more than once" — erro cosmético, mas erro na saída de um
    // script cuja função é dar confiança sobre o que foi (ou não) apagado.
    console.log('\n👀 DRY-RUN encerrado. Nada foi alterado.');
    return;
  }

  // ── EXECUÇÃO ────────────────────────────────────────────────────────────────
  // Ordem respeita as FKs: ofertas → serviços → locáveis → eventos → actors → users.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM service_offerings WHERE provider_actor_id IN (SELECT id FROM actors WHERE metadata->>'demo_seed' = 'true')`
    );
    await client.query(
      `DELETE FROM services WHERE actor_id IN (SELECT id FROM actors WHERE metadata->>'demo_seed' = 'true')`
    );
    await client.query(`DELETE FROM rentable_resources WHERE metadata->>'demo_seed' = 'true'`);

    // Necessidades declaradas apontam para eventos — saem antes deles.
    await client.query(
      `DELETE FROM event_operational_needs WHERE event_id IN (SELECT id FROM events WHERE metadata->>'demo_seed' = 'true')`
    );
    await client.query(`DELETE FROM events WHERE metadata->>'demo_seed' = 'true'`);
    if (INCLUIR_EVENTOS_CLAYTON) {
      await client.query(
        `DELETE FROM event_operational_needs WHERE event_id IN (SELECT id FROM events WHERE metadata->>'completed_by_seed' = 'true')`
      );
      await client.query(`DELETE FROM events WHERE metadata->>'completed_by_seed' = 'true'`);
    }

    await client.query(
      `DELETE FROM actor_referral_codes WHERE owner_actor_id IN (SELECT id FROM actors WHERE metadata->>'demo_seed' = 'true')
          OR created_by_actor_id IN (SELECT id FROM actors WHERE metadata->>'demo_seed' = 'true')`
    );
    await client.query(`DELETE FROM actors WHERE metadata->>'demo_seed' = 'true'`);

    // Donos de demonstração: actor humano → referral → profile → user → identity → global_user.
    const donosRows = await client.query<{ user_id: string; global_user_id: string | null }>(
      `SELECT user_id::text, global_user_id::text FROM users WHERE email LIKE '%.demo.unificard'`
    );
    for (const d of donosRows.rows) {
      const acts = await client.query<{ id: string }>(`SELECT id::text FROM actors WHERE user_id = $1::uuid`, [d.user_id]);
      for (const a of acts.rows) {
        await client.query(`DELETE FROM actor_referral_codes WHERE owner_actor_id = $1::uuid OR created_by_actor_id = $1::uuid`, [a.id]);
      }
      await client.query(`DELETE FROM actors WHERE user_id = $1::uuid`, [d.user_id]);
      await client.query(`DELETE FROM profiles WHERE user_id = $1::uuid`, [d.user_id]);
      await client.query(`DELETE FROM users WHERE user_id = $1::uuid`, [d.user_id]);
      if (d.global_user_id) {
        await client.query(`DELETE FROM identities WHERE global_user_id = $1::uuid`, [d.global_user_id]);
        await client.query(`DELETE FROM global_users WHERE global_user_id = $1::uuid`, [d.global_user_id]);
      }
    }

    const bank1 = Number(
      (await client.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`)).rows[0].n
    );
    if (bank1 !== bank0) {
      // Não deveria ser possível — mas se for, a transação inteira volta atrás.
      throw new Error(`ABORTADO: Δbank mudou (${bank0} → ${bank1}). Nada foi apagado.`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Faxina concluída. Δbank inalterado.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(`\n💥 ROLLBACK: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  } finally {
    client.release();
  }
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(`💥 ${err instanceof Error ? err.message : String(err)}`);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
