#!/usr/bin/env node
/**
 * GUARD — contenção de `agreements` (schema-ghost) não pode ser removida por descuido.
 *
 * 🔴 O QUE ELE PROTEGE (medido em 2026-08-05):
 *   · a tabela `agreements` **não existe** no banco oficial (nem qualquer `%agreement%`);
 *   · o módulo está REGISTRADO em `app.builder.ts` — as 10 rotas respondiam de verdade;
 *   · sem contenção, **toda chamada devolvia 500 com o `42P01` cru do Postgres vazando**.
 *
 * A contenção vive num `onRequest` no topo do plugin: recusa **antes** de qualquer handler tocar o
 * service. Conter dentro do service deixaria cada rota nova nascer descoberta; na borda, rota nova
 * já nasce contida — e é por isso que este guard exige o hook, e não uma checagem por rota.
 *
 * ⚠️ Ele NÃO decide o produto. Acordo assistido pode voltar — mas pela ordem da casa: GATE →
 * decisão → migration COM RLS → leitor → writer. O guard morde se alguém pular a fila religando
 * as rotas sem o substrato.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const ROTAS = join(RAIZ, 'src', 'modules', 'agreements', 'agreement.routes.ts');
const REPO = join(RAIZ, 'src', 'modules', 'agreements', 'agreement.repository.ts');
const MIGRACOES = join(RAIZ, 'migrations');
const NOME = 'agreements-schema-ghost-containment';

if (!existsSync(ROTAS)) {
  // Módulo removido é desfecho LEGÍTIMO — e melhor que contido. Mas some com o objeto do guard,
  // então ele avisa em vez de passar mudo: verde varrendo nada é a mentira que esta casa cataloga.
  console.error(
    `\n❌ GATE FAIL [${NOME}] — \`agreement.routes.ts\` não existe mais.\n` +
    `   Se o módulo foi REMOVIDO (desfecho legítimo), remova este guard no MESMO commit.\n` +
    `   Guard sem objeto não é aprovação: é cegueira com aparência de verde.\n`
  );
  process.exit(1);
}

const rotas = readFileSync(ROTAS, 'utf8');
const falhas = [];

if (!/addHook\s*\(\s*['"]onRequest['"]/.test(rotas)) {
  falhas.push('a contenção de BORDA (`onRequest`) sumiu — as rotas voltaram a alcançar o service');
}
if (!/AGREEMENTS_SCHEMA_GHOST_CONTAINED/.test(rotas)) {
  falhas.push('o código de erro nomeado sumiu — recusa sem nome não diz ao chamador o que houve');
}
if (!/status\(\s*501\s*\)/.test(rotas)) {
  falhas.push('a recusa deixou de ser 501 (não implementado) — 500 volta a parecer defeito nosso');
}

// 🔴 A trava que importa: se alguém CRIAR a tabela, a contenção tem que sair junto — senão o
// sistema fica com substrato pronto e porta fechada, que é a pior das três combinações.
const criaTabela = readdirSync(MIGRACOES)
  .filter((f) => f.endsWith('.sql'))
  .some((f) =>
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?agreements\b/i.test(
      readFileSync(join(MIGRACOES, f), 'utf8').replace(/--[^\n]*/g, ' ')
    )
  );

if (criaTabela) {
  falhas.push(
    'alguma migration passou a CRIAR a tabela `agreements`, mas a contenção continua de pé — ' +
    'substrato pronto com porta fechada. Religue as rotas e remova este guard no mesmo commit'
  );
}

// O repositório segue apontando para a tabela ausente — é esperado enquanto contido, e serve de
// âncora: se ele parar de citar, o objeto do guard mudou e alguém precisa reavaliar.
if (existsSync(REPO) && !/\bagreements\b/.test(readFileSync(REPO, 'utf8'))) {
  falhas.push('o repositório deixou de citar `agreements` — a premissa do guard mudou, reavalie');
}

if (falhas.length > 0) {
  console.error(`\n❌ GATE FAIL [${NOME}] — ${falhas.length} problema(s):\n`);
  for (const f of falhas) console.error(`   · ${f}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✅ GATE OK [${NOME}] — rotas de acordo contidas na BORDA (onRequest → 501 ` +
  `AGREEMENTS_SCHEMA_GHOST_CONTAINED), nenhuma migration cria a tabela, e o repositório segue ` +
  `apontando para o substrato ausente. Rota nova neste plugin nasce contida.`
);
