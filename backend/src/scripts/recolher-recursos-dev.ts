/**
 * RECOLHIMENTO DOS RECURSOS DE DESENVOLVIMENTO — a SAÍDA do dinheiro de teste.
 *
 * 🔴 A IDEIA É DE CLAYTON (2026-08-04): *"de repente criar uma conta fictícia e no final a gente
 * faz todas as transferências pra essa conta, e depois deleta a conta"*. A intuição está certa; só
 * a última parte não é possível, e por um bom motivo.
 *
 * ═══ POR QUE NÃO SE APAGA (e por que isso NÃO trava nada) ═══
 * O registro do Bank tem `bank_ledger_no_update` e `bank_ledger_no_delete`. Apagar histórico é
 * exatamente o que esse registro existe para impedir — e um sistema que apaga o próprio histórico
 * financeiro deixa de ser auditável, inclusive em desenvolvimento.
 *
 * Mas apagar nunca foi o objetivo real. O objetivo é **nenhuma conta de pessoa ficar com dinheiro
 * de teste**. Isso se chama RECOLHER, é o que sistema financeiro de verdade faz, e é reversível no
 * que importa: o histórico permanece (honesto) e o que circula volta a ZERO (limpo).
 *
 * Depois deste recolhimento:
 *   · toda conta de actor volta a zero;
 *   · o dinheiro de teste fica todo na conta de sistema que o emitiu, identificável;
 *   · "quanto dinheiro de teste está em circulação?" vira UMA consulta, não uma suposição.
 *
 * ═══ COMO USAR ═══
 *   npx tsx src/scripts/recolher-recursos-dev.ts               (ensaio)
 *   npx tsx src/scripts/recolher-recursos-dev.ts --confirmar
 */

process.env.BANK_TRANSACTION_SINK_FIREWALL_ENABLED = 'true';

import 'dotenv/config';
import { pool } from '../core/database/pool';
// 🔴 O script NÃO fala com o motor financeiro nem lê as tabelas dele: PEDE ao Bank (lição do C4).
import { garantirReserva, listarContasComRecursos, moverEntreContas, type ContaComRecursos } from '../modules/bank/dev-funds.service';

const CONFIRMAR = process.argv.includes('--confirmar');

async function main(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db !== 'unificard_dev') {
    throw new Error(`ABORT: este script só roda contra unificard_dev; conectado em "${db}".`);
  }

  const contas: ContaComRecursos[] = await listarContasComRecursos();
  const total = contas.reduce((s, c) => s + Number(c.centavos), 0);

  console.log(`Banco: ${db}`);
  console.log(`Contas a recolher: ${contas.length}`);
  for (const c of contas) {
    console.log(`   ${(c.nome ?? c.owner_type).padEnd(28)} R$ ${(Number(c.centavos) / 100).toFixed(2)}`);
  }
  console.log(`TOTAL em circulação: R$ ${(total / 100).toFixed(2)}\n`);

  if (contas.length === 0) {
    console.log('✅ Nada a recolher — nenhuma conta de pessoa carrega valor.');
    return;
  }
  if (!CONFIRMAR) {
    console.log('👀 ENSAIO — nada foi movido. Rode com --confirmar para recolher.');
    console.log('   O histórico PERMANECE (append-only); o que zera é o que está em circulação.');
    return;
  }

  // Destino: a reserva do próprio tenant — a conta de sistema que emitiu. Devolver para lá fecha o
  // ciclo (emissão → circulação → recolhimento) sem inventar uma conta nova, que seria mais um
  // substrato para alguém esquecer depois. Exatamente o erro que o banco descartável já causou aqui.
  for (const c of contas) {
    const reserva = await garantirReserva(c.tenant_id);
    await moverEntreContas({
      tenantId: c.tenant_id, deContaId: c.id, paraContaId: reserva.accountId,
      centavos: Number(c.centavos), actorId: c.actor_id ?? null,
      motivo: 'recolher-recursos-dev', descricao: 'Recolhimento de recursos de desenvolvimento',
    });
    console.log(`   ✅ ${(c.nome ?? c.owner_type).padEnd(28)} R$ ${(Number(c.centavos) / 100).toFixed(2)} recolhido`);
  }

  // Verificação de 1ª mão: RELÊ, não confia no que acabou de escrever.
  const restante = (await listarContasComRecursos()).reduce((s, c) => s + Number(c.centavos), 0);
  console.log(`\nEm circulação DEPOIS: R$ ${(restante / 100).toFixed(2)}`);
  console.log(restante === 0 ? '✅ Zerado.' : '🔴 Ainda há valor — investigue antes de considerar limpo.');
}

main()
  .catch((e) => { console.error('💥', e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => pool.end());
