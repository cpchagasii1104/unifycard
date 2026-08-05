#!/usr/bin/env node
// backend/scripts/audit-policy-base-honored.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (criado 2026-08-05, GO de Clayton)
// ║ NORMA:   DECISION-0194 D2 (uma base por policy) · D4 (divergência = fail-closed)
// ║ NÃO:     NÃO calcular split sem declarar QUE BASE o valor representa.
// ║ EM VEZ:  calculatePolicySplits(amount, lines, base) — 3 argumentos, sempre.
// ╚════════════════════════════════════════════════════════════════
//
// ═══ O QUE ELE TRAVA, E POR QUE ELE EXISTE ═══
// O motor de split IGNORAVA `applies_to`. Aplicava todo bps sobre o valor recebido, fosse ele o
// bruto da venda ou a comissão da plataforma. A própria DECISION-0194 chamava isso de **"arma
// carregada para a primeira policy que use outra base"** — e a primeira chegou: Clayton decidiu
// (2026-08-05) que a INDICAÇÃO incide sobre `commission_gross`.
//
// A conta do estrago, com os números que ele deu de exemplo:
//     comissão da plataforma ... 20%      indicação configurada ... 10%
//     esperado ................. 10% de 20% = 2% do total
//     motor cego pagaria ....... 10% DO TOTAL = **cinco vezes mais**
// Sem erro nenhum aparecendo. As travas de runtime financeiro estavam OFF, então ninguém foi pago
// errado — o defeito nasceria no dia de LIGAR, que é o dia em que ninguém lembraria do aviso.
//
// MORDE se:
//   1. `calculatePolicySplits` deixar de exigir a base (3º parâmetro);
//   2. as travas D2 (base única) / D4 (base declarada = base do valor) sumirem do motor;
//   3. algum chamador voltar a invocar o motor com 2 argumentos;
//   4. a trava de base única sumir da validação de ESCRITA (o painel voltaria a aceitar mistura).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '../src');
// 🔴 O DENOMINADOR PRECISAVA INCLUIR scripts/ — descoberto na 1a corrida completa (2026-08-05).
// Varrendo so src/, este guard ficou VERDE enquanto um guard de conservacao em scripts/ chamava o
// motor com 2 argumentos. Quem pegou foi o runner, nao eu. E a licao do gate-de-granularidade de
// ARQUITETURA/ na pratica: cobertura parcial e indistinguivel de cobertura total quando o verde
// nao diz o denominador. scripts/ TAMBEM chama o motor — entao scripts/ tambem e varrido.
const SCRIPTS = path.join(__dirname, '.');
const MOTOR = 'modules/economy/policy-engine/economic-policy-engine.service.ts';
const ESCRITA = 'modules/economy/policy-engine/economic-policy-write-validation.ts';

const failures = [];
// Denominador do verde — ver `gate-de-granularidade` de ARQUITETURA/: um guard do legado ficou
// verde por meses validando 24% dos arquivos em silêncio. Verde sem denominador não é prova.
let totalArquivos = 0;
let totalChamadas = 0;

const read = (rel) => {
  const p = path.join(SRC, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null;
};

function semComentarios(txt) {
  return txt.split('\n').filter((l) => {
    const t = l.trim();
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  }).join('\n');
}

/** scripts/ tem .mjs (guards) alem de .ts — os dois podem chamar o motor. */
function walkScripts(dir, out = []) {
  for (const e of fs.readdirSync(dir)) {
    const full = path.join(dir, e);
    if (fs.statSync(full).isDirectory()) walkScripts(full, out);
    else if (e.endsWith('.ts') || e.endsWith('.mjs')) out.push(full);
  }
  return out;
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir)) {
    if (e === 'node_modules') continue;
    const full = path.join(dir, e);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (e.endsWith('.ts')) out.push(full);
  }
  return out;
}

// ── 1 e 2. o motor exige a base e mantém as duas travas ──
const motorBruto = read(MOTOR);
if (motorBruto === null) {
  failures.push(`${MOTOR} ausente — o motor de split sumiu. Fail-closed.`);
} else {
  const motor = semComentarios(motorBruto);
  if (!/baseOfAmount\s*:\s*EconomicPolicyLineAppliesTo/.test(motor)) {
    failures.push(
      `${MOTOR}: calculatePolicySplits não exige mais a BASE do valor. Sem ela o motor volta a ` +
      'aplicar bps sobre qualquer régua — o defeito que DECISION-0194 chamou de arma carregada.'
    );
  }
  if (!/POLICY_MIXED_BASE/.test(motor)) {
    failures.push(`${MOTOR}: trava D2 (uma base por policy) sumiu. Mistura volta a corromper o drift.`);
  }
  if (!/POLICY_BASE_MISMATCH/.test(motor)) {
    failures.push(
      `${MOTOR}: trava D4 sumiu. Base declarada divergente do valor tem que ser FAIL-CLOSED, ` +
      'nunca correção silenciosa.'
    );
  }
}

// ── 4. a escrita continua barrando mistura (o painel é a porta do admin) ──
const escritaBruta = read(ESCRITA);
if (escritaBruta === null) {
  failures.push(`${ESCRITA} ausente — a validação de escrita da policy sumiu. Fail-closed.`);
} else if (!/D2/.test(escritaBruta) || !/mistura bases/.test(escritaBruta)) {
  failures.push(
    `${ESCRITA}: a trava de BASE ÚNICA na escrita sumiu. O painel voltaria a aceitar uma policy ` +
    'com réguas diferentes, e o admin só descobriria meses depois, no dinheiro.'
  );
}

// ── 3. nenhum chamador com 2 argumentos ──
if (!fs.existsSync(SRC)) {
  failures.push('src/ ausente — o guard não conseguiu medir. Não-medido não é zero. Fail-closed.');
} else {
  const arquivos = [...walk(SRC), ...walkScripts(SCRIPTS)];
  totalArquivos = arquivos.length;
  if (arquivos.length === 0) failures.push('src/ sem .ts — leitura suspeita. Fail-closed.');

  for (const full of arquivos) {
    const rel = path.relative(path.join(__dirname, '..'), full).split(path.sep).join('/');
    if (rel === 'src/' + MOTOR) continue;
    const txt = semComentarios(fs.readFileSync(full, 'utf-8'));
    // Chamada multi-linha é a forma comum aqui, então normaliza espaços antes de contar vírgulas
    // do primeiro nível. Regex sobre texto achatado; o gate-de-granularidade de ARQUITETURA/
    // recomenda AST — registrado como melhoria, não feito nesta fatia.
    const achatado = txt.replace(/\s+/g, ' ');
    // 🔴 O PONTO ANTES DO NOME NÃO É DETALHE — é o que separa CHAMADA de MENÇÃO.
    // A 1ª versão casava `calculatePolicySplits\s*\(` e acusou um rótulo de teste em português:
    // `'C3 resolvedor usa calculatePolicySplits (floor bps via engine)'` — o nome dentro de uma
    // STRING, seguido de espaço e parêntese. É a terceira variante do mesmo defeito num dia
    // (guard lendo comentário, guard lendo comentário SQL, guard lendo string).
    // Chamada real aqui é sempre método: `economicPolicyEngineService.calculatePolicySplits(`.
    // ⚠️ LIMITE DECLARADO: import desestruturado (`const { calculatePolicySplits } = ...`) escaparia
    // desta forma — por isso a checagem logo abaixo proíbe desestruturar o motor.
    if (/\{[^}]*\bcalculatePolicySplits\b[^}]*\}\s*=/.test(achatado)) {
      failures.push(
        `${rel}: desestrutura calculatePolicySplits do motor. Chame pelo objeto do serviço — ` +
        'desestruturar esconde a chamada do guard que garante a declaração de base.'
      );
    }
    for (const m of achatado.matchAll(/\.calculatePolicySplits\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
      const args = m[1];
      // 🔴 QUARTA VARIANTE DO MESMO DEFEITO, NO MESMO DIA: `...calculatePolicySplits()` — parênteses
      // VAZIOS — apareceu dentro da mensagem de sucesso de outro guard, descrevendo o que ele testa.
      // Menção não é chamada. E aqui a distinção é SEGURA, não heurística: a função exige 3
      // argumentos, então uma chamada real com zero argumentos nem compilaria.
      if (args.trim() === '') continue;
      totalChamadas += 1;
      let nivel = 0;
      let virgulas = 0;
      for (const ch of args) {
        if (ch === '(' || ch === '[' || ch === '{') nivel += 1;
        else if (ch === ')' || ch === ']' || ch === '}') nivel -= 1;
        else if (ch === ',' && nivel === 0) virgulas += 1;
      }
      if (virgulas < 2) {
        failures.push(
          `${rel}: chamada a calculatePolicySplits com ${virgulas + 1} argumento(s) — falta declarar ` +
          'a BASE do valor. Quem calcula split precisa dizer se o valor é o bruto da venda ou a ' +
          'comissão da plataforma; sem isso o percentual cai sobre a régua errada.'
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [policy-base-honored]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(
  `GATE OK [policy-base-honored] — ${totalArquivos} arquivos .ts varridos, ${totalChamadas} chamadas ` +
  'a calculatePolicySplits, todas declarando a base. Motor com D2 (uma base por policy) e D4 ' +
  '(divergência = fail-closed); escrita barrando mistura antes de gravar. O percentual só incide ' +
  'sobre a régua que a policy declarou.'
);
