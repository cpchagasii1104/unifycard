#!/usr/bin/env node
/**
 * GUARD — PARTIDA, NÃO CICLO: todo worker tem um ponto de partida alcançável do boot.
 *
 * Família #11 do inventário da instância de `ARQUITETURA/`: *"`processX` sem `startX` alcançável a
 * partir do boot"*. Um worker completo, testado e correto que **ninguém inicia** não é código
 * pronto: é uma capacidade que não existe. E não gera erro, porque nada tenta usá-la.
 *
 * 🔴 ESTE GUARD NASCEU DE UM ERRO MEU, e é por isso que ele mede o que mede.
 * Em 2026-08-05 eu afirmei que **nenhum** worker era iniciado. A prova de que eu estava errado veio
 * do banco: `ledger_snapshots` ganhou 3 linhas novas ENQUANTO eu media — o worker estava rodando na
 * minha frente. A causa do erro: meus greps eram escopados em `src/`, e **o boot mora em
 * `backend/BOOT.ts`, FORA de `src/`**. Denominador errado, conclusão invertida.
 * Medição correta depois: **26 de 26 workers citados no BOOT**, cada um com portão explícito.
 *
 * ⚠️ O QUE ESTE GUARD **NÃO** AFIRMA: que o worker está LIGADO. Vários são `default-off` de
 * propósito (`isFinancialWorkerEnabled`), e desligar worker financeiro é decisão registrada, não
 * defeito. O que se exige aqui é que o worker seja **ALCANÇÁVEL** — que exista o caminho, mesmo que
 * a chave esteja desligada. Confundir "não tem partida" com "está desligado" seria transformar
 * contenção deliberada em dívida falsa.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const DIR_WORKERS = join(RAIZ, 'src', 'workers');
const NOME = 'worker-has-starter';

// 🔴 O BOOT MORA FORA DE `src/`. Escrito assim, explícito, porque foi exatamente o que me enganou:
// varrer só `src/` faz todo worker parecer órfão.
const BOOTS = ['BOOT.ts', 'src/BOOT.ts', 'src/server.ts', 'src/index.ts']
  .map((p) => join(RAIZ, p))
  .filter((p) => existsSync(p));

if (BOOTS.length === 0) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — nenhum arquivo de boot encontrado.\n` +
    `   Não é "está tudo certo": é o guard tendo ficado CEGO (o entrypoint mudou de lugar).\n`
  );
  process.exit(1);
}

const textoBoot = BOOTS.map((p) => readFileSync(p, 'utf8')).join('\n');

const workers = readdirSync(DIR_WORKERS).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
const semPartida = [];
let comPartida = 0;

for (const arquivo of workers) {
  const modulo = basename(arquivo, '.ts');
  const src = readFileSync(join(DIR_WORKERS, arquivo), 'utf8');

  // Um "worker" para efeito desta checagem é o que EXPORTA algo que se inicia ou executa um ciclo.
  // Arquivo de apoio (ex.: o portão `financial-worker-gate`) não precisa de partida própria.
  const exportsDePartida = [...src.matchAll(/export\s+(?:async\s+)?function\s+((?:start|run|claim|process)[A-Z]\w*)/g)]
    .map((m) => m[1]);
  if (exportsDePartida.length === 0) continue;

  // Alcançável = o BOOT cita o MÓDULO (import dinâmico usa o caminho) ou a função de partida.
  const citado =
    textoBoot.includes(modulo) || exportsDePartida.some((fn) => textoBoot.includes(fn));

  if (citado) comPartida += 1;
  else semPartida.push(`${modulo} (exporta ${exportsDePartida.join(', ')})`);
}

if (comPartida === 0 && semPartida.length === 0) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — zero worker reconhecido em src/workers/.\n` +
    `   Denominador vazio nunca é aprovação: ou a pasta mudou, ou o padrão de export mudou.\n`
  );
  process.exit(1);
}

if (semPartida.length > 0) {
  console.error(`\n❌ GATE FAIL [${NOME}] — ${semPartida.length} worker(s) SEM partida no boot:\n`);
  for (const w of semPartida) console.error(`   · ${w}`);
  console.error(
    `\n   Worker que ninguém inicia não é código pronto: é capacidade que não existe, e não gera\n` +
    `   erro porque nada tenta usá-la. Ligue no boot (pode nascer default-off, com portão) ou\n` +
    `   remova o arquivo. Deixar parado é a terceira opção, e é a única que mente.\n\n` +
    `   Boot(s) verificado(s): ${BOOTS.map((p) => p.replace(RAIZ, '').replace(/\\/g, '/')).join(', ')}\n`
  );
  process.exit(1);
}

console.log(
  `✅ GATE OK [${NOME}] — ${comPartida} worker(s) com partida alcançável a partir do boot ` +
  `(${BOOTS.length} arquivo(s) de boot verificado(s), incluindo BOOT.ts FORA de src/). ` +
  `Estar default-off é decisão, não ausência de partida — o guard não confunde as duas.`
);
