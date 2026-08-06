#!/usr/bin/env node
// backend/scripts/audit-rental-guarantee-parity.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (DT-DB-GUARANTEE-SWEEP-INCOMPLETE — a metade do par migrado da locação)
// ║ NORMA:   Lei 2 (forward-only) · DECISION-0151 / arco asset-first (migração de substrato)
// ║ NÃO:     provar paridade por LISTA DE NOMES — nome novo na tabela viva enganaria o guard
// ║ EM VEZ:  comparar o PAR por COLUNA COMUM, no catálogo do banco vivo
// ╚════════════════════════════════════════════════════════════════
//
// ── POR QUE ESTE GUARD EXISTE, E POR QUE ELE É GENÉRICO ────────────────────────────────────────
// O arco asset-first migrou a locação de `rentable_resources` (morta) para `actor_asset_rental_terms`
// (viva) — e a tabela nova **copiou parte dos CHECKs e deixou o resto para trás**. Isso mordeu DUAS
// vezes, com dois meses de distância:
//   · 2026-08-06 manhã: `chk_aart_quantity_single_unless_equipment` (migration 20260806010000).
//     Sem ela, `quantity=10` num `vehicle` faria o confirm aceitar 10 reservas do MESMO carro.
//   · 2026-08-06 noite: mais **12** garantias, achadas só porque alguém comparou 26 × 16 CHECKs.
//     Quatro eram de DINHEIRO: a tabela viva tinha 5 colunas `_cents` e não-negativo em UMA.
//
// Um guard por lista de nomes teria passado verde nas duas vezes. Este compara o PAR:
//   para cada COLUNA que as duas tabelas têm, se a MORTA tem CHECK e a VIVA não tem NENHUM que
//   mencione a coluna → FAIL.
// Colunas que só a morta tem são IGNORADAS (CHECK sobre coluna inexistente é morto por definição —
// copiá-lo seria o oposto do conserto).
//
// 🔴 Banco indisponível = FAIL. Não conseguir verificar NÃO é aprovação.
// Em validate:regression-guards (comando direto).

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

const MORTA = 'rentable_resources';
const VIVA = 'actor_asset_rental_terms';

// Colunas cuja ausência de CHECK na viva é DELIBERADA, com a razão escrita. Só entra aqui o que foi
// PROVADO legítimo — e a lista só pode ENCOLHER (é dívida com saída, não permissão).
const ABSOLVIDAS = new Map([
  // A viva não tem `status` de recurso com o mesmo papel? tem — e tem CHECK. Nada absolvido hoje.
]);

const failures = [];
let comuns = 0, cobertas = 0;

try {
  const { Client } = require('pg');
  const envPath = join(ROOT, '.env');
  const line = existsSync(envPath)
    ? readFileSync(envPath, 'utf-8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))
    : null;
  const url = process.env.DATABASE_URL || (line ? line.slice('DATABASE_URL='.length).trim() : null);
  if (!url) throw new Error('DATABASE_URL ausente (.env e env)');

  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const existe = await c.query(
      `SELECT to_regclass($1) AS morta, to_regclass($2) AS viva`, [MORTA, VIVA]);
    if (!existe.rows[0].viva) {
      failures.push(`banco: tabela VIVA ${VIVA} não existe — o par de migração sumiu; este guard perdeu o alvo.`);
    } else if (!existe.rows[0].morta) {
      // Legítimo se um dia a morta for removida: aí não há par a comparar e o guard vira no-op honesto.
      console.log(`GATE OK [rental-guarantee-parity] — ${MORTA} não existe mais; não há par a comparar. Nada a herdar.`);
      await c.end();
      process.exit(0);
    } else {
      // Colunas COMUNS às duas tabelas.
      const cols = await c.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name=$1
         INTERSECT
         SELECT column_name FROM information_schema.columns WHERE table_name=$2`, [MORTA, VIVA]);
      // CHECKs de cada lado, com o texto da definição.
      const defs = async (t) => (await c.query(
        `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
          WHERE conrelid = $1::regclass AND contype='c'`, [t])).rows;
      const dMorta = await defs(MORTA);
      const dViva = await defs(VIVA);

      for (const { column_name: col } of cols.rows) {
        // 🔴 SUBSTÂNCIA: a coluna aparece como PALAVRA na definição (não como substring de outra).
        const re = new RegExp(`\\b${col}\\b`);
        const naMorta = dMorta.filter((x) => re.test(x.def));
        if (naMorta.length === 0) continue;
        comuns++;
        const naViva = dViva.filter((x) => re.test(x.def));
        if (naViva.length > 0) { cobertas++; continue; }
        if (ABSOLVIDAS.has(col)) { cobertas++; continue; }
        failures.push(
          `coluna '${col}': ${MORTA} (MORTA) tem ${naMorta.length} CHECK e ${VIVA} (VIVA) não tem NENHUM. ` +
          `Garantia deixada para trás na migração de substrato. Exemplo: ${naMorta[0].conname} — ${naMorta[0].def}`
        );
      }

      // ══ 🔴 A SEGUNDA CAMADA — porque a primeira sozinha é FRACA, e eu provei isso ══════════
      // A checagem acima pergunta "a coluna tem ALGUM CHECK?". Ao forçar o vermelho eu dropei
      // `chk_aart_cleaning_fee_nonneg` e o guard ficou VERDE: sobrou o CHECK de coerência, que
      // também menciona a coluna. *Cobertura por coluna não é equivalência de cláusula.*
      // Para a família que mais importa — DINHEIRO — a exigência é de SUBSTÂNCIA: toda coluna
      // `_cents` da tabela VIVA precisa de uma guarda de NÃO-NEGATIVO. Valor negativo em taxa é
      // defeito mudo (não estoura, só entra torto no preço).
      const cents = await c.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = $1 AND column_name LIKE '%\\_cents'`, [VIVA]);
      for (const { column_name: col } of cents.rows) {
        const re = new RegExp(`\\b${col}\\b[\\s\\S]{0,40}?>=\\s*0`);
        if (!dViva.some((x) => re.test(x.def))) {
          failures.push(
            `coluna de DINHEIRO '${col}' em ${VIVA} sem guarda de NÃO-NEGATIVO. ` +
            `Taxa negativa não estoura — entra torta no preço. Exigido: CHECK (${col} IS NULL OR ${col} >= 0).`
          );
        }
      }
    }
  } finally {
    await c.end();
  }
} catch (e) {
  failures.push(`banco INDISPONÍVEL (${e.message}) — FAIL: não verificar não é aprovar.`);
}

if (failures.length) {
  console.log('GATE FAIL [rental-guarantee-parity]:');
  for (const f of failures) console.log('  ❌ ' + f);
  console.log(
    `\n→ A tabela VIVA (${VIVA}) tem de herdar toda garantia da MORTA (${MORTA}) sobre COLUNA COMUM.` +
    '\n→ Colunas que só a morta tem são ignoradas: CHECK sobre coluna inexistente é morto por definição.' +
    '\n→ EM VEZ de absolver: migre o CHECK. Se a ausência for deliberada, entre em ABSOLVIDAS com a RAZÃO.');
  process.exit(1);
}

console.log(
  `GATE OK [rental-guarantee-parity] — paridade de garantias do par migrado da locação: ${cobertas}/${comuns} ` +
  `coluna(s) comum(ns) com CHECK na morta também têm CHECK na VIVA (${VIVA}); e TODA coluna _cents da ` +
  `viva tem guarda de não-negativo (substância, não nome). Comparado por COLUNA no catálogo do banco, ` +
  `não por lista de nomes — foi lista de nomes que deixou 1 garantia passar em 2026-07-08 e outras 12 ` +
  `até 2026-08-06.` +
  `\n   ⚠️ LIMITE DECLARADO: a 1ª camada prova COBERTURA por coluna, não EQUIVALÊNCIA de cláusula — ` +
  `trocar um CHECK por outro na mesma coluna passa. A 2ª camada (dinheiro) fecha o caso que importa; ` +
  `para os demais, a prova real é o harness comportamental.`
);
