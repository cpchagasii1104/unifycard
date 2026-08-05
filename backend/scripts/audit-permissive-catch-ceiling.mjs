#!/usr/bin/env node
/**
 * GUARD — `catch` que responde valor PERMISSIVO (teto que só desce).
 *
 * 🔴 A FAMÍLIA: um `catch` que devolve `false`, `[]` ou `0` não está tratando erro — está
 * **AFIRMANDO AUSÊNCIA**. "Não há reserva", "não votou", "nenhuma política se aplica", "zero
 * bloqueios". A falha vira a resposta permissiva, e some: sem exceção, sem 500, sem log.
 * Regra da casa: *zero é uma afirmação; desconhecido é a verdade* — e desconhecido tem que
 * APARECER.
 *
 * 🔴 O CASO QUE PROVOU O CUSTO (2026-08-05, medido com a cadeia inteira colada):
 *   `event.routes.ts:2843` → `advanceToEconomicPhase` → `checkCanAdvanceToEconomicPhase`
 *   → `hasAgendaReservations` → `catch { return false }`
 * Lá em cima, `false` significa "não há reserva" ⇒ o pré-requisito não entra em
 * `missingPrerequisites` ⇒ `canAdvance = true`. **Uma falha transitória de leitura LIBERAVA o
 * avanço de fase que o portão existe para bloquear.** Fail-open, e mudo.
 *
 * ⚠️ POR QUE TETO, E NÃO PROIBIÇÃO: nem todo `catch` permissivo é defeito — `ENOENT` ao ler
 * diretório opcional devolvendo `[]` é correto e específico. Distinguir os dois exige ler o sítio,
 * e guard não lê. Então o guard não julga: ele **congela a contagem** e obriga a descer.
 * Teto que pode subir é permissão; teto que só desce é dívida com saída.
 *
 * ⚠️ E POR QUE CASAMENTO DE CHAVES, E NÃO JANELA FIXA: a 1ª medição desta família usou uma janela
 * de 2500 caracteres à frente do nome da função e atribuiu o `catch` de uma função a outra —
 * apontou `isPilotMode` quatro vezes, que não tinha `catch` nenhum. Contagem por janela mente
 * quando o arquivo é grande. Aqui o bloco do `catch` é delimitado contando chaves, e só o que está
 * DENTRO dele conta.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

const RAIZ = join(import.meta.dirname, '..', 'src');
const NOME = 'permissive-catch-ceiling';

/**
 * 🔴 Teto MEDIDO em 2026-08-05, depois de corrigir os 3 sítios da fatia. Só pode DESCER.
 *
 * ⚠️ Este número foi medido, não estimado — e a diferença apareceu na primeira execução. Eu havia
 * escrito `106` de cabeça; o guard reprovou dizendo "65 < 106, baixe o teto". **Teto inventado é
 * folga**: teria deixado 41 regressões entrarem de graça antes do primeiro vermelho. O ramo que me
 * pegou é o mesmo que impede alguém de consertar sítios e esquecer de apertar o teto.
 */
const TETO = 65;

function semTexto(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, '``')
    .replace(/'(?:\\.|[^\\'])*'/g, "''")
    .replace(/"(?:\\.|[^\\"])*"/g, '""');
}

function arquivos(dir, acc = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, acc);
    else if (nome.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

/** Delimita o bloco que começa na chave em `abre` contando chaves. Devolve o índice do fecha. */
function fimDoBloco(src, abre) {
  let nivel = 0;
  for (let i = abre; i < src.length; i += 1) {
    if (src[i] === '{') nivel += 1;
    else if (src[i] === '}') {
      nivel -= 1;
      if (nivel === 0) return i;
    }
  }
  return -1;
}

const lista = arquivos(RAIZ);
const sitios = [];

for (const arquivo of lista) {
  const codigo = semTexto(readFileSync(arquivo, 'utf8'));
  const re = /\bcatch\s*(?:\([^)]*\))?\s*\{/g;
  let m;
  while ((m = re.exec(codigo))) {
    const abre = codigo.indexOf('{', m.index);
    const fecha = fimDoBloco(codigo, abre);
    if (fecha === -1) continue;
    const bloco = codigo.slice(abre, fecha);
    if (/\breturn\s+(?:false|\[\s*\]|0)\s*;/.test(bloco)) {
      const linha = codigo.slice(0, m.index).split('\n').length;
      sitios.push(`${arquivo.split(sep).join('/')}:${linha}`);
    }
  }
}

const total = sitios.length;

if (lista.length === 0) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — zero arquivo .ts varrido. Isso não é "nada a reportar":\n` +
    `   é o guard tendo ficado CEGO. Denominador vazio nunca é aprovação.\n`
  );
  process.exit(1);
}

if (total > TETO) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — ${total} \`catch\` permissivo(s) > teto ${TETO}.\n\n` +
    `   Um \`catch\` que devolve false/[]/0 AFIRMA ausência. Se o valor não pôde ser lido, a\n` +
    `   resposta honesta é propagar o erro (ou devolver \`null\`/\`undefined\` e tratar em cima) —\n` +
    `   nunca a resposta permissiva, que some sem log e libera o que o predicado deveria barrar.\n\n` +
    `   Sítios novos prováveis (últimos da varredura):\n` +
    sitios.slice(-8).map((s) => `     · ${s}`).join('\n') +
    `\n\n   Denominador: ${lista.length} arquivo(s) .ts em src/.\n`
  );
  process.exit(1);
}

if (total < TETO) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — ${total} < teto ${TETO}: a contagem DESCEU e o teto não foi\n` +
    `   atualizado. Isso é bom trabalho pela metade — baixe a constante TETO para ${total} no\n` +
    `   mesmo commit, senão o teto vira folga para a próxima regressão entrar de graça.\n`
  );
  process.exit(1);
}

console.log(
  `✅ GATE OK [${NOME}] — ${total} \`catch\` permissivo(s) (false/[]/0), exatamente no teto ${TETO}, ` +
  `medidos por casamento de chaves em ${lista.length} arquivo(s) .ts de src/. O número só pode DESCER.`
);
