#!/usr/bin/env node
/**
 * GUARD — SUBSTRATO TEM CONSUMIDOR: tabela criada por migration é referenciada por algum código.
 *
 * Famílias #10 e #19 do inventário da instância de `ARQUITETURA/`: *"presença ≠ capacidade"* e
 * *"cadeia completa"*. O caso que ela nomeou é literal aqui: `product_concept_resolution_queue` —
 * **fila sem produtor E sem drenador**. Uma tabela que ninguém escreve e ninguém lê não é
 * capacidade: é intenção fossilizada. Não gera erro, não gera log, e passa a ser lida como
 * "funcionalidade existente" pela próxima pessoa que abrir o schema.
 *
 * 🔴 O QUE FOI MEDIDO NO BANCO OFICIAL (2026-08-05):
 *     336 tabelas · **10 sem NENHUMA referência em código vivo** · todas com **0 linhas**.
 *     Duas já estavam marcadas `_deprecated_*` (incluindo a fila acima) — quem veio antes fez a
 *     coisa certa: renomeou em vez de deixar o nome bonito ocupando espaço mental.
 *
 * ⚠️ ESTE GUARD MEDE A MIGRATION, NÃO O BANCO — e a razão é a mesma do guard de RLS: o runner roda
 * sem banco. Ler `CREATE TABLE` das migrations dá o mesmo conjunto pela porta que a CI alcança.
 *
 * ⚠️ LIMITE DECLARADO: mede referência TEXTUAL ao nome da tabela nos fontes. Acesso montado por
 * concatenação de string escapa. Por isso o veredito é *"candidato a morto"*, e o teto existe para
 * impedir crescimento — não para afirmar que os 10 de hoje são lixo.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const NOME = 'substrate-has-consumer';

/**
 * 🔴 Teto MEDIDO em 2026-08-05. Só pode DESCER. Não é aprovação: impede o próximo.
 *
 * ⚠️ **19 aqui, 10 no banco — e os dois números estão certos**, porque são perguntas diferentes:
 *   · no BANCO: 10 tabelas materializadas sem consumidor;
 *   · na MIGRATION: 19 — inclui tabelas de migration **nunca aplicada** (a família
 *     `neighborhood_*` vem de uma migration dormente **de propósito**, frente N1).
 * Escrevo os dois lado a lado porque foi a diferença entre eles que quase me fez ajustar o teto
 * "para bater" com a outra medição. Teto que se ajusta para bater com outro número não mede nada.
 *
 * 🔴 E o número deste teto errou UMA vez antes de ficar certo: escrevi `19` porque **truncei a
 * saída** com `head -20` e contei as linhas que apareceram. São **20**. É o mesmo erro que abre o
 * `CLAUDE.md` (o `Select-Object -First 10` que virou "nenhum caller"), cometido por mim no mesmo
 * dia em que li o aviso. **Contagem sai de `grep -c`, nunca de olhar a tela.**
 */
const TETO = 20;

function walk(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) walk(f, acc);
    else if (n.endsWith('.ts')) acc.push(f);
  }
  return acc;
}

const fontes = walk(join(RAIZ, 'src'))
  .filter((f) => !f.includes(`${sep}scripts${sep}`))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

const migracoes = readdirSync(join(RAIZ, 'migrations')).filter((f) => f.endsWith('.sql'));
const criadas = new Set();

for (const f of migracoes) {
  const sql = readFileSync(join(RAIZ, 'migrations', f), 'utf8').replace(/--[^\n]*/g, ' ');
  for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi)) {
    criadas.add(m[1].toLowerCase());
  }
  // Tabela renomeada para `_deprecated_*` já foi tratada por quem veio antes — não conta como
  // achado novo, e continuar apontando-a seria confundir dívida com trabalho já feito.
  for (const m of sql.matchAll(/ALTER\s+TABLE\s+([a-z_][a-z0-9_]*)\s+RENAME\s+TO\s+(_deprecated_[a-z0-9_]*)/gi)) {
    criadas.delete(m[1].toLowerCase());
    criadas.delete(m[2].toLowerCase());
  }
  for (const m of sql.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi)) {
    criadas.delete(m[1].toLowerCase());
  }
}

const semConsumidor = [...criadas]
  .filter((t) => !t.startsWith('_deprecated_'))
  .filter((t) => !new RegExp(`\\b${t}\\b`).test(fontes))
  .sort();

if (criadas.size === 0) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — nenhuma criação de tabela encontrada em ${migracoes.length} migration(s).\n` +
    `   Denominador vazio nunca é aprovação: é o guard cego.\n`
  );
  process.exit(1);
}

const total = semConsumidor.length;

if (total > TETO) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — ${total} tabela(s) sem consumidor > teto ${TETO}.\n\n` +
    `   Tabela que ninguém escreve e ninguém lê não é capacidade: é intenção fossilizada, e a\n` +
    `   próxima pessoa que abrir o schema vai lê-la como funcionalidade que existe.\n` +
    `   EM VEZ: ou nasce com produtor E consumidor no mesmo arco, ou não nasce ainda.\n` +
    `   Se já nasceu e o plano mudou, renomeie para \`_deprecated_<nome>\` — o repositório já usa\n` +
    `   esse padrão, e ele diz a verdade sem apagar a intenção.\n\n` +
    `   Sem consumidor (${total}):\n` +
    semConsumidor.map((t) => `     · ${t}`).join('\n') + '\n'
  );
  process.exit(1);
}

if (total < TETO) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — ${total} < teto ${TETO}: a contagem DESCEU e o teto não acompanhou.\n` +
    `   Baixe TETO para ${total} no mesmo commit; folga não usada vira permissão para a próxima.\n`
  );
  process.exit(1);
}

console.log(
  `✅ GATE OK [${NOME}] — ${criadas.size} tabela(s) criadas por migration; ${total} sem consumidor ` +
  `em código vivo, exatamente no teto ${TETO} (só desce). ` +
  `Tabelas já renomeadas para \`_deprecated_*\` ficam de fora: quem veio antes já as tratou.`
);
