#!/usr/bin/env node
/**
 * GUARD — visibilidade vinda do CLIENTE não pode governar descoberta.
 *
 * 🔴 NASCEU DE UM DEFEITO REAL (2026-08-05), não de imaginação.
 * `GET /groups` fazia `const visibility = query?.visibility || 'public'` e depois
 * `allGroups.filter(g => g.visibility === visibility)`. Quem passasse `?visibility=secret`
 * recebia a lista de **grupos secretos**. O SQL de `findAll` não filtra visibilidade nenhuma —
 * o `visibilityConditions` de lá é nome que mente (são condições de escopo territorial).
 *
 * Gravidade pela régua "quem está presente para notar?": o prejudicado é o dono do grupo
 * secreto, que NÃO está na requisição. Não gera log, não gera reclamação, não gera incidente.
 *
 * O QUE ESTE GUARD EXIGE, e por quê:
 *   1. todo sítio que lê visibilidade da REQUISIÇÃO tem que citar uma lista de visibilidades
 *      descobríveis no mesmo arquivo — a validação existir "em algum lugar" não conta;
 *   2. essa lista NÃO pode conter `secret` — é o valor cuja exposição é o defeito;
 *   3. o arquivo tem que devolver **400** nesse caminho — 500 e silêncio são os dois modos de
 *      falhar que este repositório já catalogou como piores que o erro.
 *
 * ⚠️ Mede CÓDIGO, não comentário: literais de string e comentários são removidos antes da
 * medição, senão a própria explicação acima faria o guard passar (ou falhar) sozinha.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = join(import.meta.dirname, '..', 'src');
const NOME = 'group-visibility-discovery-boundary';

/** Remove comentários e literais — o guard mede código, nunca prosa. */
function semTexto(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, '``')
    .replace(/'(?:\\.|[^\\'])*'/g, "''")
    .replace(/"(?:\\.|[^\\"])*"/g, '""');
}

function arquivosDeRota(dir, acc = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivosDeRota(p, acc);
    else if (nome.endsWith('.routes.ts')) acc.push(p);
  }
  return acc;
}

const rotas = arquivosDeRota(RAIZ);
const violacoes = [];
let examinados = 0;

for (const arquivo of rotas) {
  const bruto = readFileSync(arquivo, 'utf8');
  const codigo = semTexto(bruto);

  // 🔴 SÓ A QUERY, NUNCA O BODY — e a distinção não é detalhe, é o defeito.
  // `body.visibility` é o DONO declarando a visibilidade do próprio recurso: legítimo, e a
  // validação dele é outra família. `query.visibility` é o LEITOR escolhendo o que quer enxergar
  // do acervo alheio — é aí que "me mostre os secretos" vira resposta. A 1ª versão deste guard
  // misturou as duas e acusou 3 sítios que não são este defeito.
  const leDaQuery =
    /\b(?:req|request)\s*\.\s*query\s*(?:\?\.)?\s*\.?\s*visibility\b/.test(codigo) ||
    /\bquery\s*\?\.\s*visibility\b/.test(codigo);

  if (!leDaQuery) continue;
  examinados += 1;

  const rel = relative(join(import.meta.dirname, '..'), arquivo).replace(/\\/g, '/');

  // 🔴 E A EXIGÊNCIA É DE FORMA, NÃO DE NOME.
  // A 1ª versão exigia uma constante chamada `VISIBILIDADE_DESCOBRIVEL` — ou seja, um guard que
  // lê o NOME, que é a evidência mais fraca deste repositório e o erro que ele existe para pegar.
  // `publication-engine.routes.ts` valida corretamente contra `validVisibilities` e teria sido
  // reprovado por escrever certo com outro nome. O que importa é: existe um vocabulário literal
  // de visibilidades neste arquivo, ele não admite `secret`, e o caminho inválido devolve 400.
  // ⚠️ NÃO basta "existe uma lista com 'public' no arquivo". A 2ª versão fazia isso e reprovou
  // `groups.routes.ts` por causa do schema de CRIAÇÃO (`z.enum(['public','private','secret'])`),
  // onde `secret` é legítimo — criar grupo secreto é um direito, listá-lo é o vazamento.
  // A pergunta certa é ESTRUTURAL: qual lista é efetivamente TESTADA contra o valor da query?
  // Pego o identificador usado num `X.includes(`, resolvo a definição dele, e leio AQUELA lista.
  const testes = [...codigo.matchAll(/\b([A-Za-z_$][\w$]*)\s*\.\s*includes\s*\(/g)].map((m) => m[1]);

  let vocabularioTestado = null;
  for (const ident of testes) {
    const def = bruto.match(
      new RegExp(`(?:const|let|var)\\s+${ident}\\b[^=]*=\\s*\\[([^\\]]*)\\]`)
    );
    if (def && /'public'|"public"/.test(def[1])) {
      vocabularioTestado = { ident, conteudo: def[1] };
      break;
    }
  }

  if (!vocabularioTestado) {
    violacoes.push(
      `${rel}: usa query.visibility para filtrar e NÃO testa contra vocabulário nenhum ` +
      `(qualquer valor do cliente governa a listagem)`
    );
    continue;
  }

  if (/'secret'|"secret"/.test(vocabularioTestado.conteudo)) {
    violacoes.push(
      `${rel}: a lista testada (${vocabularioTestado.ident}) admite 'secret' — é o vazamento`
    );
  }

  if (!/\bstatus\(\s*400\s*\)/.test(codigo)) {
    violacoes.push(`${rel}: valida visibilidade mas não devolve 400 no caminho inválido`);
  }
}

if (violacoes.length > 0) {
  console.error(`\n❌ GATE FAIL [${NOME}] — ${violacoes.length} violação(ões):\n`);
  for (const v of violacoes) console.error(`   · ${v}`);
  console.error(
    `\n   Denominador: ${examinados} arquivo(s) de rota que leem visibilidade da requisição,` +
    ` de ${rotas.length} arquivo(s) *.routes.ts no disco.\n`
  );
  process.exit(1);
}

// 🔴 O DENOMINADOR VAI NO VERDE. Guard que diz só "OK" esconde o caso em que ele varreu ZERO
// arquivos — foi assim que um guard deste repositório ficou verde validando 131 de 551.
console.log(
  `✅ GATE OK [${NOME}] — ${examinados} sítio(s) que leem visibilidade da requisição, ` +
  `todos com vocabulário de descoberta declarado, sem 'secret' e com 400 no caminho inválido ` +
  `(universo: ${rotas.length} arquivo(s) *.routes.ts).`
);
