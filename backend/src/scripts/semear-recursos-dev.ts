/**
 * SEMEADURA DE RECURSOS EM DESENVOLVIMENTO — a forma AUDITADA de pôr dinheiro no sistema para
 * exercitar transferência, pagamento e rateio.
 *
 * 🔴 AUTORIZADO POR CLAYTON (2026-08-04): *"a gente já injetou [recursos] antes para testes… deve
 * haver uma forma de injetarmos dinheiro para que as coisas comecem a fazer sentido e para que
 * possamos avançar e fazer testes"*.
 *
 * ═══ NÃO É DINHEIRO FICTÍCIO — E É POR ISSO QUE FUNCIONA ═══
 * A proposta original era "dinheiro fictício, depois a gente deleta". O registro do Bank tem
 * `bank_ledger_no_update` e `bank_ledger_no_delete`: ele RECUSA apagar, que é justamente o que o
 * torna confiável. Então não se marca dinheiro como falso — emite-se dinheiro DE VERDADE pelo
 * caminho que o próprio Bank usa (`liquidity_issuance`, partida dobrada), como um sistema real faz
 * ao capitalizar a reserva. Nada a apagar depois, nada de segunda verdade sobre "o que era teste".
 *
 * A saída existe e é outro script: `recolher-recursos-dev.ts`.
 *
 * ═══ O QUE ISTO **NÃO** ABRE ═══
 * 🔴 A PORTA-01 continua fechada, e ela NÃO é o que travava estes testes. `financial_approval_policies`
 * é consumida por UM caminho só — o serviço de aprovação de SAQUE (dinheiro SAINDO da
 * plataforma). Transferência, pagamento e rateio entre contas não passam por ela; passam por flags
 * de runtime (`CHECKOUT_FINANCIAL_RUNTIME_ENABLED`, `SERVICE_FINANCIAL_RUNTIME_ENABLED`, …), que
 * são interruptores de desenvolvimento, não porta soberana. Este script não toca em porta nenhuma.
 *
 * ═══ POR QUE NÃO EM BANCO DESCARTÁVEL ═══
 * Clayton: *"a gente fez isto, e depois outras instâncias esqueceram e começaram a desenvolver em
 * cima do banco descartável"*. O mecanismo efêmero é certo para PROVA automatizada; para uso HUMANO
 * no navegador ele já falhou nesta casa — duas bases vivas viram duas verdades. Por isso o dinheiro
 * de teste vive no `unificard_dev` mesmo, com saída própria em vez de segundo banco.
 *
 * ═══ COMO USAR ═══
 *   npx tsx src/scripts/semear-recursos-dev.ts --email dev@unificard.local --reais 500
 *   (sem `--confirmar` é ensaio: mostra o que faria e não emite nada)
 *
 * Sucessor do script de uso único de 2026-07, cujos ids apontam para o
 * tenant ANTERIOR e não resolvem mais. Mesmo mecanismo auditado; alvo resolvido por e-mail em vez
 * de uuid decorado, para não apodrecer de novo quando o banco for re-materializado.
 */

// Ligada SÓ no processo deste script, NUNCA no ambiente do backend rodando — padrão do antecessor.
process.env.BANK_TRANSACTION_SINK_FIREWALL_ENABLED = 'true';

import 'dotenv/config';
import { pool } from '../core/database/pool';
// 🔴 O script NÃO fala com o motor financeiro: PEDE ao Bank. Mesma lição do C4 — quem movimenta
// dinheiro é o domínio Bank, e há uma definição só de "como se emite".
import { countBankMovements } from '../modules/bank/bank-movement-probe';
import { contaDaPessoa, emitirParaConta, garantirLastro, garantirReserva, quantoTemAConta } from '../modules/bank/dev-funds.service';

const arg = (nome: string): string | undefined => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const EMAIL = arg('email') ?? 'dev@unificard.local';
const REAIS = Number(arg('reais') ?? '500');
const CONFIRMAR = process.argv.includes('--confirmar');

async function main(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  // Emitir é irreversível (registro append-only), então o banco alvo é DECLARADO, nunca herdado
  // por acaso do ambiente.
  if (db !== 'unificard_dev') {
    throw new Error(`ABORT: este script só roda contra unificard_dev; conectado em "${db}".`);
  }
  if (!Number.isFinite(REAIS) || REAIS <= 0) {
    throw new Error(`ABORT: --reais inválido (${arg('reais')}). Use um número positivo.`);
  }
  const CENTAVOS = Math.round(REAIS * 100);

  // Alvo resolvido POR E-MAIL: o uuid decorado do antecessor morreu junto com o tenant anterior.
  const alvo = await pool.query<{ user_id: string; tenant_id: string; actor_id: string; display_name: string }>(
    `SELECT u.user_id::text, u.tenant_id::text, a.id::text AS actor_id, a.display_name
       FROM users u
       JOIN actors a ON a.user_id = u.user_id AND a.tenant_id = u.tenant_id
      WHERE u.email = $1
      LIMIT 1`,
    [EMAIL]
  );
  if (alvo.rowCount === 0) throw new Error(`ABORT: nenhum usuário com actor para o e-mail "${EMAIL}".`);
  const { user_id: USER_ID, tenant_id: TENANT_ID, actor_id: ACTOR_ID, display_name } = alvo.rows[0];

  const antes = await countBankMovements();
  console.log(`Banco: ${db}`);
  console.log(`Alvo : ${display_name} <${EMAIL}>`);
  console.log(`Valor: R$ ${REAIS.toFixed(2)} (${CENTAVOS} centavos)`);
  console.log(`Movimento no Bank ANTES: ${antes} linha(s)\n`);

  if (!CONFIRMAR) {
    console.log('👀 ENSAIO — nada foi emitido. Rode de novo com --confirmar para valer.');
    console.log('⚠️  O registro do Bank é append-only (no_update/no_delete). Emitir NÃO se desfaz;');
    console.log('   o que se faz depois é RECOLHER (recolher-recursos-dev.ts).');
    return;
  }

  const reserva = await garantirReserva(TENANT_ID);

  // 🔴 LASTRO ANTES DE EMITIR. A plataforma RECUSA creditar pessoa quando o que está nas mãos das
  // pessoas alcança 80% do que ela detém (`trg_check_coverage`). Não é obstáculo: é solvência. O
  // passo certo é constituir a cobertura na reserva, não contornar a trava.
  const lastro = await garantirLastro(TENANT_ID, reserva.accountId, CENTAVOS, ACTOR_ID);
  console.log(
    `Lastro: plataforma detém R$ ${(lastro.capacidade / 100).toFixed(2)} · ` +
    `em mãos R$ ${(lastro.emitido / 100).toFixed(2)} · cobertura ${lastro.cobertura.toFixed(1)}% (teto 80%)`
  );

  // 🔴 EMISSÃO DIRETA para o usuário (só `toAccountId`). O antecessor descobriu, apanhando, que
  // passar `fromAccountId=reserva` + `toAccountId=usuário` na MESMA operação debita a reserva e a
  // trava `trg_check_coverage` vê o débito ANTES do crédito → COVERAGE_EXCEEDED. Não repetir.
  const conta = await contaDaPessoa(TENANT_ID, USER_ID);
  const id = await emitirParaConta({
    tenantId: TENANT_ID, contaId: conta.accountId, centavos: CENTAVOS, actorId: ACTOR_ID,
    motivo: 'semear-recursos-dev',
    descricao: 'Recursos de desenvolvimento para exercitar transferência/pagamento/rateio',
  });

  console.log(`✅ Emitido — id: ${id}`);
  console.log(`   Conta ${conta.accountId}`);
  console.log(`   Tem agora: R$ ${((await quantoTemAConta(TENANT_ID, conta.accountId)) / 100).toFixed(2)}`);
  console.log(`   Movimento no Bank: ${antes} → ${await countBankMovements()} linha(s)`);
}

main()
  .catch((e) => { console.error('💥', e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => pool.end());
