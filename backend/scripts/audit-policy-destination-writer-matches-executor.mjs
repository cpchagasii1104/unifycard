#!/usr/bin/env node
/**
 * GUARD — o que se PUBLICA tem que ser o que se PAGA.
 *
 * 🔴 O DEFEITO (medido 2026-08-05): a validação de escrita de política aceitava qualquer destino do
 * CHECK físico do Postgres — incluindo `referrer_actor_wallet`. A EXECUÇÃO suporta um conjunto
 * MENOR e lança `POLICY_DESTINATION_UNSUPPORTED` fora dele. Consequência: dava para publicar, pelo
 * painel de admin, uma linha de indicação — e **todo pagamento daquela política passava a falhar**,
 * porque o erro derruba a transação inteira, não só a linha.
 *
 * **Configuração administrativa que quebra pagamento é o pior tipo de armadilha: quem configura não
 * é quem descobre.** O admin vê "salvo com sucesso"; o defeito aparece no primeiro pagamento real,
 * longe dali, sem ninguém ligar uma coisa à outra.
 *
 * O INVARIANTE: `DESTINOS_PAGAVEIS` (escritor) ⊆ `SUPPORTED_DESTINATION_TYPES` (executor).
 * Encolher o publicável é sempre seguro; ampliar sem resolvedor é armar a bomba.
 *
 * ⚠️ O arquivo do executor é BYTE-PINNED (campanha B-CITY). Este guard **só o LÊ**. Se um dia o
 * executor passar a suportar mais destinos, é lá que o conjunto cresce primeiro — e só então aqui.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const ESCRITOR = join(RAIZ, 'src', 'modules', 'economy', 'policy-engine', 'economic-policy-write-validation.ts');
const EXECUTOR = join(RAIZ, 'src', 'modules', 'services', 'service-payment-execution.service.ts');
const NOME = 'policy-destination-writer-matches-executor';

/** Extrai os literais de uma lista/Set nomeada, ignorando comentários. */
function conjunto(arquivo, nomeDaConstante) {
  const src = readFileSync(arquivo, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
  const m = src.match(new RegExp(`${nomeDaConstante}[^=]*=[^\\[]*\\[([^\\]]*)\\]`));
  if (!m) return null;
  return new Set((m[1].match(/'[a-z_]+'/g) || []).map((s) => s.slice(1, -1)));
}

const publicaveis = conjunto(ESCRITOR, 'DESTINOS_PAGAVEIS');
const suportados = conjunto(EXECUTOR, 'SUPPORTED_DESTINATION_TYPES');

if (!publicaveis || !suportados) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — não consegui LER um dos conjuntos ` +
    `(escritor: ${publicaveis ? 'ok' : 'FALHOU'} · executor: ${suportados ? 'ok' : 'FALHOU'}).\n` +
    `   Não conseguir medir NÃO é aprovação: se a constante mudou de nome ou de forma, o guard\n` +
    `   ficou cego e alguém precisa reapontá-lo — no mesmo commit que mudou a forma.\n`
  );
  process.exit(1);
}

if (publicaveis.size === 0 || suportados.size === 0) {
  console.error(`\n❌ GATE FAIL [${NOME}] — conjunto vazio (publicáveis=${publicaveis.size} · suportados=${suportados.size}). Denominador vazio nunca é aprovação.\n`);
  process.exit(1);
}

const impagaveis = [...publicaveis].filter((d) => !suportados.has(d));

if (impagaveis.length > 0) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — ${impagaveis.length} destino(s) PUBLICÁVEIS que o motor NÃO paga:\n` +
    impagaveis.map((d) => `   · ${d}`).join('\n') +
    `\n\n   Publicar um destino sem resolvedor faz TODO pagamento da política falhar\n` +
    `   (POLICY_DESTINATION_UNSUPPORTED derruba a transação inteira, não só a linha).\n` +
    `   EM VEZ: primeiro o resolvedor no executor, depois o destino entra no publicável.\n` +
    `   A ordem inversa entrega ao admin um botão que quebra pagamento.\n\n` +
    `   publicáveis: ${[...publicaveis].join(', ')}\n` +
    `   suportados : ${[...suportados].join(', ')}\n`
  );
  process.exit(1);
}

const soExecutor = [...suportados].filter((d) => !publicaveis.has(d));

console.log(
  `✅ GATE OK [${NOME}] — ${publicaveis.size} destino(s) publicáveis, todos dentro dos ` +
  `${suportados.size} que o motor sabe pagar.` +
  (soExecutor.length > 0
    ? `\n   ℹ️  ${soExecutor.length} suportado(s) pelo executor e não publicáveis (${soExecutor.join(', ')}) — ` +
      `assimetria SEGURA: o motor sabe pagar mais do que o painel deixa configurar.`
    : '')
);
