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
// Δbank=0 se pergunta AO BANK — a sonda mora em src/modules/bank porque só o domínio Bank lê bank_*
// (SSOT_EXCLUSIVE_BANK_RULE; C4-BANK-READ-BOUNDARY do audit-schema-coherence-ratchet).
import { countBankMovements } from '../modules/bank/bank-movement-probe';
// 🔴 IDENTIDADE É O ID (Lei 7). Os eventos-alvo saem do MANIFESTO que o seed escreveu, não de
// `metadata->>'demo_seed'` — decidir sobre `events` (tabela TRANSACIONAL) por metadata é o que
// `audit-schema-coherence-ratchet` morde em C7-METADATA-DECISION, e ele está certo.
import { lerDoManifesto, esquecerDoManifesto, CAMINHO_DO_MANIFESTO } from './helpers/demo-seed-manifest';

// 🔴 ALVOS EXPLÍCITOS (2026-08-04, 2ª versão). A 1ª versão tinha um default perigoso: apagava o
// dado de demonstração BOM (as 7 empresas + 6 eventos realistas) e PRESERVAVA os 36 rascunhos de
// teste — exatamente o inverso do que Clayton pediu quando disse "pode excluir esses 36 rascunhos".
// Default agora é NADA: cada grupo sai só se for nomeado. Não existe "apagar tudo" implícito.
const CONFIRMAR = process.argv.includes('--confirmar');
/** Os 36 rascunhos de teste do Clayton (metadata.completed_by_seed). */
const ALVO_EVENTOS_TESTE = process.argv.includes('--eventos-teste');
/** O estoque de demonstração: 7 empresas + ofertas + locáveis + 6 eventos (metadata.demo_seed). */
const ALVO_DEMO = process.argv.includes('--demo');

async function contar(sql: string, params: unknown[] = []): Promise<number> {
  const r = await pool.query<{ n: string }>(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}

/**
 * Tabelas que apontam para `events.id` SEM `ON DELETE CASCADE` — precisam ser limpas à mão.
 * 🔴 PERGUNTADO AO BANCO, não decorado: a 1ª tentativa de apagar quebrou em
 * `event_metrics_event_id_fkey` (a transação deu ROLLBACK, nada foi perdido). Em vez de descobrir
 * uma FK por vez no erro, esta lista sai de `information_schema` — 14 tabelas NO ACTION, contra 4
 * que já cascateiam sozinhas (event_category_facets, event_financial_execution,
 * event_operational_needs, event_theme_links).
 */
const DEPENDENTES_SEM_CASCADE = [
  'event_attendees', 'event_checkins', 'event_consumptions', 'event_metrics',
  'event_occupancy_models', 'event_reservations', 'event_rsvp', 'event_sectors',
  'event_sessions', 'event_specs', 'event_staff', 'event_tickets',
  'group_events', 'ticket_sales',
] as const;

/**
 * 🔴 TRAVA DE DINHEIRO. Apagar evento com venda/execução financeira destruiria registro contábil.
 * Roda ANTES de qualquer DELETE e ABORTA se achar qualquer coisa. Medido em 2026-08-04 sobre os 36
 * eventos de teste: zero em todas — por isso foi seguro. A trava fica para a próxima vez, quando
 * pode não ser.
 */
async function abortarSeTiverDinheiro(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  for (const t of ['ticket_sales', 'event_consumptions', 'event_financial_execution']) {
    const n = await contar(`SELECT count(*)::text n FROM ${t} WHERE event_id = ANY($1::uuid[])`, [eventIds]);
    if (n > 0) {
      throw new Error(
        `ABORTADO: ${n} registro(s) em ${t} para os eventos-alvo. Apagar destruiria registro financeiro — isto exige decisão explícita de Clayton, não faxina.`
      );
    }
  }
}

async function main(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  console.log(`🧹 Faxina do dado de demonstração em: ${db}`);
  console.log(CONFIRMAR ? '⚠️  MODO EXECUÇÃO (--confirmar)\n' : '👀 DRY-RUN — nada será apagado. Use --confirmar para executar.\n');

  const bank0 = await countBankMovements();

  // Ids registrados pelos seeds. Vazio = seed não rodou (ou já foi limpo) — afirmação medida.
  const idsDemo = lerDoManifesto('demo_events');
  const idsClayton = lerDoManifesto('completed_events');
  // Conta o que AINDA EXISTE desses ids (o manifesto pode citar linha já apagada à mão).
  const eventosDemo = await contar(`SELECT count(*)::text n FROM events WHERE id = ANY($1::uuid[])`, [idsDemo]);
  const eventosClayton = await contar(`SELECT count(*)::text n FROM events WHERE id = ANY($1::uuid[])`, [idsClayton]);
  const empresas = await contar(`SELECT count(*)::text n FROM actors WHERE metadata->>'demo_seed' = 'true'`);
  const locaveis = await contar(`SELECT count(*)::text n FROM rentable_resources WHERE metadata->>'demo_seed' = 'true'`);
  const ofertas = await contar(
    `SELECT count(*)::text n FROM service_offerings so
      WHERE so.provider_actor_id IN (SELECT id FROM actors WHERE metadata->>'demo_seed' = 'true')`
  );
  const donos = await contar(`SELECT count(*)::text n FROM users WHERE email LIKE '%.demo.unificard'`);

  console.log('ALVOS DISPONÍVEIS (nenhum sai sem ser nomeado):\n');
  console.log(`   --eventos-teste  → ${eventosClayton} evento(s) de teste (metadata.completed_by_seed) ${ALVO_EVENTOS_TESTE ? '  ⬅️ SELECIONADO' : ''}`);
  console.log(`   --demo           → ${eventosDemo} evento(s) + ${ofertas} oferta(s) + ${locaveis} locável(is)`);
  console.log(`                      + ${empresas} empresa(s) + ${donos} conta(s) *.demo.unificard ${ALVO_DEMO ? '  ⬅️ SELECIONADO' : ''}`);

  if (ALVO_EVENTOS_TESTE) {
    const amostra = await pool.query<{ title: string }>(
      `SELECT title FROM events WHERE id = ANY($1::uuid[]) ORDER BY created_at LIMIT 8`,
      [idsClayton]
    );
    console.log('\n   Amostra dos eventos de teste que sairão:');
    amostra.rows.forEach((r) => console.log(`        - ${r.title}`));
    if (eventosClayton > 8) console.log(`        … e mais ${eventosClayton - 8}`);
  }

  if (!ALVO_EVENTOS_TESTE && !ALVO_DEMO) {
    console.log('\n⚠️  Nenhum alvo nomeado — nada a fazer. Escolha --eventos-teste e/ou --demo.');
    return;
  }

  if (!CONFIRMAR) {
    // NÃO fecha o pool aqui: quem fecha é o `.then(() => pool.end())` lá embaixo. Fechar nos dois
    // lugares dava "Called end on pool more than once" — erro cosmético, mas erro na saída de um
    // script cuja função é dar confiança sobre o que foi (ou não) apagado.
    console.log('\n👀 DRY-RUN encerrado. Nada foi alterado.');
    return;
  }

  // ── TRAVA DE DINHEIRO antes de qualquer escrita ─────────────────────────────
  if (ALVO_EVENTOS_TESTE) await abortarSeTiverDinheiro(idsClayton);
  if (ALVO_DEMO) await abortarSeTiverDinheiro(idsDemo);
  console.log('\n✅ Trava de dinheiro: nenhum registro financeiro nos eventos-alvo.');

  // ── EXECUÇÃO ────────────────────────────────────────────────────────────────
  // Ordem respeita as FKs: dependentes → ofertas → serviços → locáveis → eventos → actors → users.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (ALVO_EVENTOS_TESTE) {
      // 🔴 TRAVA DE PROCEDÊNCIA (2026-08-05, a pedido de Clayton: "verifique se não existe caminho
      // paralelo"). Um script de limpeza só pode apagar o que ELE CRIOU.
      //
      // O QUE ACONTECEU: `seed-complete-draft-events.ts:112` faz
      //   UPDATE events SET metadata = metadata || '{"completed_by_seed":true}'
      // ou seja, ele CARIMBA eventos que JÁ EXISTIAM — rascunhos reais do dono. Este cleanup então
      // apagava por esse carimbo. Resultado: **dado de produto virou descartável por ter sido
      // TOCADO por um seed.** É a explicação estrutural mais provável para os 25 eventos que
      // sumiram do banco oficial entre 01 e 03/08 e cuja causa eu não tinha achado.
      //
      // A distinção que faltava: `demo_seed` prova CRIAÇÃO (o seed inseriu a linha);
      // `completed_by_seed` prova apenas EDIÇÃO. Apagar por prova de edição é apagar o alheio.
      const criadosPeloSeed = await client.query<{ id: string }>(
        `SELECT id::text FROM events
          WHERE id = ANY($1::uuid[]) AND metadata->>'demo_seed' = 'true'`,
        [idsClayton]
      );
      const podemSair = criadosPeloSeed.rows.map((r) => r.id);
      const preexistentes = idsClayton.length - podemSair.length;

      if (preexistentes > 0) {
        console.log(
          `\n🛑 RECUSADO: ${preexistentes} evento(s) marcados com \`completed_by_seed\` NÃO foram\n` +
          `   criados por seed — são registros pré-existentes que um seed apenas completou.\n` +
          `   Marca de EDIÇÃO não autoriza apagar. Se a intenção é desfazer a conclusão, reverta o\n` +
          `   campo (ex.: \`datetime_start\`), NUNCA remova a linha.`
        );
      }

      if (podemSair.length > 0) {
        for (const t of DEPENDENTES_SEM_CASCADE) {
          await client.query(`DELETE FROM ${t} WHERE event_id = ANY($1::uuid[])`, [podemSair]);
        }
        await client.query(`DELETE FROM events WHERE id = ANY($1::uuid[])`, [podemSair]);
      }
    }

    if (ALVO_DEMO) {
      await client.query(
        `DELETE FROM service_offerings WHERE provider_actor_id IN (SELECT id FROM actors WHERE metadata->>'demo_seed' = 'true')`
      );
      await client.query(
        `DELETE FROM services WHERE actor_id IN (SELECT id FROM actors WHERE metadata->>'demo_seed' = 'true')`
      );
      await client.query(`DELETE FROM rentable_resources WHERE metadata->>'demo_seed' = 'true'`);
      for (const t of DEPENDENTES_SEM_CASCADE) {
        await client.query(`DELETE FROM ${t} WHERE event_id = ANY($1::uuid[])`, [idsDemo]);
      }
      await client.query(`DELETE FROM events WHERE id = ANY($1::uuid[])`, [idsDemo]);
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
    }

    // DENTRO da transação de propósito: a contagem tem que enxergar o que este DELETE fez, não o
    // que o pool veria de fora. Por isso a sonda aceita o client — o escopo é decisão do caller.
    const bank1 = await countBankMovements(client);
    if (bank1 !== bank0) {
      // Não deveria ser possível — mas se for, a transação inteira volta atrás.
      throw new Error(`ABORTADO: Δbank mudou (${bank0} → ${bank1}). Nada foi apagado.`);
    }

    await client.query('COMMIT');
    // DEPOIS do COMMIT, nunca antes: se a transação voltasse atrás, esquecer os ids deixaria linhas
    // órfãs que nenhuma faxina futura acharia — sujeira invisível é pior que sujeira listada.
    if (ALVO_EVENTOS_TESTE) esquecerDoManifesto('completed_events');
    if (ALVO_DEMO) esquecerDoManifesto('demo_events');
    console.log('\n✅ Faxina concluída. Δbank inalterado.');
    console.log(`   Manifesto atualizado: ${CAMINHO_DO_MANIFESTO}`);
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
