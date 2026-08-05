#!/usr/bin/env node
/**
 * GUARD — QUEM VIGIA O VIGIA: o EVENT TRIGGER que proíbe saldo paralelo de grupo está VIVO.
 *
 * 🔴 NASCEU DO ACHADO 1 DA AUDITORIA INDEPENDENTE (YALA, 2026-08-05), e a frase dela é a razão:
 * *"nada vigia o vigia — se ele for dropado ou desabilitado, nenhum guard fica vermelho."*
 * Ela estava certa. A migration `20260805190000` instalou um `EVENT TRIGGER` que recusa recriar
 * coluna de saldo em `group_accounts` (GO de Clayton, SSOT do dinheiro no Bank) — e o único
 * testemunho de que ele existia era a migration, que é histórico, não estado.
 *
 * **Trava sem vigilância é trava até alguém desligar.** E desligar é uma linha:
 *   ALTER EVENT TRIGGER trg_group_accounts_no_parallel_balance DISABLE;
 * O papel que roda migration é `postgres` (superusuário, medido) — pode fazer isso sem obstáculo.
 *
 * O QUE EXIGE, e nesta ordem:
 *   A. o trigger EXISTE;
 *   B. está ENABLED (`evtenabled` = 'O'), não apenas presente — desabilitado é pior que ausente,
 *      porque parece protegido;
 *   C. a FUNÇÃO dele ainda contém a recusa (alguém pode substituir o corpo por um `RETURN` vazio
 *      com `CREATE OR REPLACE` e o trigger continuaria "existindo e habilitado");
 *   D. `group_accounts` continua sem coluna de saldo — o estado que a trava protege.
 *
 * ⚠️ ESTE GUARD CONSULTA O BANCO. Dois guards do runner já fazem isso
 * (`audit-auth-rate-limit-substrate`, `audit-actor-authority-boundary`) — sigo o padrão da casa em
 * vez de inventar exceção. **Banco indisponível FALHA**: não conseguir verificar não é aprovação.
 */
import 'dotenv/config';
import pg from 'pg';

const NOME = 'group-balance-trigger-alive';
const TRIGGER = 'trg_group_accounts_no_parallel_balance';

const falhas = [];
const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await cliente.connect();
} catch (e) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — não foi possível conectar ao banco (${String(e.message).slice(0, 80)}).\n` +
    `   Não conseguir VERIFICAR não é aprovação. A trava protege o SSOT do dinheiro de grupo;\n` +
    `   passar sem medir seria exatamente o "verde que não olhou" que este projeto cataloga.\n`
  );
  process.exit(1);
}

try {
  const { rows: trg } = await cliente.query(
    `SELECT evtname, evtenabled, evtevent FROM pg_event_trigger WHERE evtname = $1`,
    [TRIGGER]
  );

  if (trg.length === 0) {
    falhas.push(
      `o EVENT TRIGGER \`${TRIGGER}\` NÃO EXISTE. Ele é a única trava física contra recriar ` +
      `saldo paralelo em group_accounts (GO de Clayton, migration 20260805190000)`
    );
  } else {
    // 'O' = origin (habilitado). 'D' = disabled. Qualquer coisa != 'O' não protege.
    if (trg[0].evtenabled !== 'O') {
      falhas.push(
        `o trigger existe mas está DESABILITADO (evtenabled='${trg[0].evtenabled}'). ` +
        `Desabilitado é PIOR que ausente: parece protegido e não protege`
      );
    }

    const { rows: fn } = await cliente.query(
      `SELECT p.prosrc FROM pg_proc p
        JOIN pg_event_trigger t ON t.evtfoid = p.oid
       WHERE t.evtname = $1`,
      [TRIGGER]
    );
    const corpo = fn[0]?.prosrc ?? '';
    if (!/SSOT_VIOLATION/.test(corpo) || !/RAISE\s+EXCEPTION/i.test(corpo)) {
      falhas.push(
        `a FUNÇÃO do trigger não recusa mais nada (sem RAISE EXCEPTION / SSOT_VIOLATION). ` +
        `\`CREATE OR REPLACE FUNCTION\` troca o corpo sem tocar no trigger: ele continuaria ` +
        `"existindo e habilitado" e deixaria tudo passar`
      );
    }
  }

  // D. O estado protegido, medido direto — a trava existe para manter ISTO verdadeiro.
  const { rows: cols } = await cliente.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='group_accounts'
        AND (column_name LIKE '%balance%' OR column_name LIKE '%saldo%'
             OR column_name LIKE '%amount%' OR column_name LIKE '%_cents')`
  );
  if (cols.length > 0) {
    falhas.push(
      `group_accounts voltou a ter coluna de valor: ${cols.map((c) => c.column_name).join(', ')}. ` +
      `O dinheiro do grupo vive no Bank (CONTRATO_GRUPOS_V2 §2.1)`
    );
  }
} finally {
  await cliente.end();
}

if (falhas.length > 0) {
  console.error(`\n❌ GATE FAIL [${NOME}] — ${falhas.length} problema(s):\n`);
  for (const f of falhas) console.error(`   · ${f}`);
  console.error(
    `\n   EM VEZ: reinstale a trava (migration forward-only) antes de qualquer trabalho em\n` +
    `   group_accounts. Se a intenção é APOSENTAR a trava, isso é decisão do dono — e este guard\n` +
    `   sai no MESMO commit, nunca antes.\n`
  );
  process.exit(1);
}

console.log(
  `✅ GATE OK [${NOME}] — EVENT TRIGGER \`${TRIGGER}\` existe, está HABILITADO, a função ainda ` +
  `recusa com SSOT_VIOLATION, e \`group_accounts\` segue sem nenhuma coluna de valor. ` +
  `A trava não é só histórico de migration: foi medida no banco agora.`
);
