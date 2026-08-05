#!/usr/bin/env node
// backend/scripts/audit-free-time-single-reader.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (criado 2026-08-05)
// ║ NORMA:   DECISION-0146 §A.1/§A.2/§A.3/§A.4 · "duas verdades divergem em silêncio"
// ║ NÃO:     NÃO reimplementar "janela declarada MENOS compromissos" fora do módulo canônico.
// ║ EM VEZ:  importar de `@core/availability/free-time` (subtrair / computeFreeTime).
// ╚════════════════════════════════════════════════════════════════
//
// ═══ O QUE ELE TRAVA, E POR QUE ═══
// A pergunta "este horário está livre?" tinha DUAS respostas no mesmo repositório: a descoberta
// respondia "existe janela declarada" (`EXISTS` em availability) e a página do recurso respondia
// "janela menos reservas confirmadas". Quem estivesse errado venderia o mesmo bem duas vezes.
//
// A aritmética foi unificada em `core/availability/free-time.ts` e a ilha original passou a
// IMPORTAR de lá. Este guard existe para que a próxima superfície que precisar da mesma conta
// importe em vez de copiar — copiar é grátis na hora e caro no dia em que uma cópia for corrigida
// e a outra não.
//
// MORDE se:
//   1. o módulo canônico sumir ou perder a exportação;
//   2. aparecer uma SEGUNDA implementação da subtração fora dele (assinatura ou corpo);
//   3. o vocabulário de status de compromisso for reescrito fora do módulo (0146 §A.4 manda
//      mapear do schema vivo, num lugar só);
//   4. o módulo passar a ESCREVER (ele é read-only: responde, não decide nem persiste).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '../src');
const CANONICO = 'core/availability/free-time.ts';

const failures = [];

// Denominador do verde — um walk que quebra e devolve lista curta e indistinguivel de repositorio
// limpo. Ver a nota na mensagem de sucesso.
let totalArquivos = 0;
const read = (rel) => {
  const p = path.join(SRC, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null;
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir)) {
    if (e === 'node_modules') continue;
    const full = path.join(dir, e);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (e.endsWith('.ts')) out.push(full);
  }
  return out;
}

// ── 1. o módulo canônico existe e exporta a conta ──
const canon = read(CANONICO);
if (canon === null) {
  failures.push(`${CANONICO} desapareceu — a resposta única de "está livre?" perdeu a casa.`);
} else {
  if (!/export function subtrair\(/.test(canon)) {
    failures.push(`${CANONICO}: a aritmética deixou de ser exportada — quem importa vai copiar.`);
  }
  if (!/export async function computeFreeTime\(/.test(canon)) {
    failures.push(`${CANONICO}: computeFreeTime sumiu — é a porta que as superfícies consomem.`);
  }
  // ── 4. read-only: responder não é escrever ──
  if (/\b(INSERT|UPDATE|DELETE)\s+(INTO|FROM|\w)/i.test(canon)) {
    failures.push(
      `${CANONICO}: contém escrita (INSERT/UPDATE/DELETE). Este módulo RESPONDE "está livre?" e não ` +
      'decide nem persiste nada — escrever aqui o transformaria num segundo writer de agenda.'
    );
  }
  if (!/'confirmed'/.test(canon) || !/'checked_in'/.test(canon)) {
    failures.push(
      `${CANONICO}: o vocabulário de status de COMPROMISSO sumiu. 0146 §A.4 manda mapeá-lo do schema ` +
      'vivo — e num lugar só, senão cada superfície escolhe o seu.'
    );
  }
}

// ── 2 e 3. nenhuma segunda implementação da conta, e nenhum vocabulário paralelo ──
if (!fs.existsSync(SRC)) {
  // 🔴 Falha ao LER não vira "0 cópias". Zero afirma "não há"; a verdade aqui seria "não sei".
  failures.push('src/ ausente — o guard não conseguiu medir. Fail-closed.');
} else {
  const arquivos = walk(SRC);
  totalArquivos = arquivos.length;
  if (arquivos.length === 0) failures.push('src/ sem .ts — leitura suspeita, não conclusão. Fail-closed.');

  for (const full of arquivos) {
    const rel = path.relative(SRC, full).split(path.sep).join('/');
    if (rel === CANONICO) continue;
    const txt = fs.readFileSync(full, 'utf-8');

    // A cópia se reconhece pela FORMA da conta: uma função que recebe janela + ocupados e devolve
    // lacunas. Casar pelo NOME (`subtractPeriods`) seria a evidência mais fraca — quem copia
    // renomeia. Aqui casa a assinatura estrutural, não o rótulo.
    const copia = /function\s+\w+\s*\([^)]*win(Start|dowStart)[^)]*busy[^)]*\)/i.test(txt);
    if (copia) {
      failures.push(
        `${rel}: parece conter uma SEGUNDA implementação da subtração de janela (recebe janela + ` +
        `ocupados). Importe de @core/availability/free-time — duas contas divergem no dia em que ` +
        'uma for corrigida e a outra não.'
      );
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [free-time-single-reader]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
// 🔴 O VERDE DECLARA O DENOMINADOR (2026-08-05) — aprendido em ARQUITETURA/DOCS/00-fundamentos/
// gate-de-granularidade.md: um guard do legado ficou verde por MESES validando 131 de 551 arquivos.
console.log(
  `GATE OK [free-time-single-reader] — ${totalArquivos} arquivos .ts varridos, zero copias da` +
  ' aritmetica. ' +
  '"está livre DE VERDADE?" tem UMA resposta: ' +
  'core/availability/free-time.ts, read-only, com a régua por espécie (item × provider, 0146 §A.3) ' +
  'e o status de compromisso mapeado do schema vivo (§A.4). Nenhuma cópia da aritmética no repositório.'
);
