#!/usr/bin/env node
/**
 * GUARD — PORTA DE SAÍDA COM GATILHO: coluna de prazo que alguém ESCREVE tem que ser HONRADA.
 *
 * 🔴 A FAMÍLIA (inventário da instância de `ARQUITETURA/`, #12): *"estado terminal / `expires_at`
 * sem worker que o dispare"* — writer pronto e **nada dispara**. O prazo vira decoração: a linha
 * vence e continua valendo para sempre, sem erro e sem log.
 *
 * 🔴 O CASO QUE PROVOU (2026-08-05): `actor_active_location.expires_at` era **escrito** pelo
 * `INSERT` do próprio repositório (parâmetro `$8`, valor real do caller) e **nenhuma** das duas
 * leituras filtrava por ele — só `is_active = true`. Contido até então apenas porque nenhuma linha
 * tinha prazo definido (1 linha, 0 com prazo). Isso é sorte, não desenho: o writer já aceitava a
 * data. Corrigido com gatilho preguiçoso.
 *
 * O QUE O GUARD EXIGE, e a assimetria é o ponto:
 *   · porta que **ninguém escreve** → tudo bem, é coluna dormente (ex.: `bank_accounts.expires_at`,
 *     `service_payment_requests.expired_at`, medidos com zero writer e zero linha);
 *   · porta que **alguém escreve** → precisa de GATILHO, e vale qualquer um dos dois:
 *       (a) preguiçoso — alguma leitura compara a coluna com `NOW()`;
 *       (b) varredor — algum `UPDATE` marca o estado vencido.
 *   Worker dedicado NÃO é exigido: expiração preguiçosa na leitura é gatilho legítimo, e é o que a
 *   maioria das portas sadias deste repositório usa (`actor_delegations`, `group_invites`).
 *
 * ⚠️ SEM LISTA FIXA. As portas são descobertas no próprio código — lista de tabelas escrita à mão
 * apodrece em silêncio, e a porta NOVA seria justamente a que ninguém lembraria de acrescentar.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

const RAIZ = join(import.meta.dirname, '..', 'src');
const NOME = 'expiry-door-has-trigger';
const COLUNA = /\b(expires_at|expired_at)\b/;

function arquivos(dir, acc = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, acc);
    else if (nome.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

const lista = arquivos(RAIZ);
const comWriter = new Map(); // tabela -> Set(arquivo)
const comGatilho = new Set();

for (const arquivo of lista) {
  const src = readFileSync(arquivo, 'utf8');
  const curto = arquivo.split(sep).join('/');

  // ⚠️ Harnesses E2E (`src/scripts/`) montam fixture: inserem prazo de propósito e não são o
  // runtime. Contá-los transformava teste em dívida — 4 dos 5 falsos positivos da 1ª versão.
  const ehHarness = curto.includes('/src/scripts/');

  // WRITER — e a precisão aqui é o guard inteiro. A 1ª versão perguntava "a coluna aparece nos
  // 900 caracteres seguintes?" e acusou `bank_ledger` e `bank_transactions`, que **não têm** coluna
  // de prazo: a janela alcançou texto vizinho. Janela é a mesma doença que este projeto cataloga.
  // Agora a pergunta é ESTRUTURAL: a coluna está na LISTA DE COLUNAS do INSERT, ou no SET do UPDATE?
  if (!ehHarness) {
    for (const m of src.matchAll(/\bINSERT\s+INTO\s+([a-z_][a-z0-9_]*)\s*\(([^)]*)\)/gi)) {
      if (!COLUNA.test(m[2])) continue;
      const tabela = m[1].toLowerCase();
      if (!comWriter.has(tabela)) comWriter.set(tabela, new Set());
      comWriter.get(tabela).add(curto);
    }
    for (const m of src.matchAll(/\bUPDATE\s+([a-z_][a-z0-9_]*)\s+SET\b([\s\S]*?)(?:\bWHERE\b|`)/gi)) {
      const tabela = m[1].toLowerCase();
      // `SET status = 'expired'` é VARREDOR — é o gatilho, não o risco.
      if (/expired/i.test(m[2]) && !COLUNA.test(m[2])) {
        comGatilho.add(tabela);
        continue;
      }
      if (!COLUNA.test(m[2])) continue;
      if (!comWriter.has(tabela)) comWriter.set(tabela, new Set());
      comWriter.get(tabela).add(curto);
    }
  }

  // GATILHO PREGUIÇOSO: a coluna comparada com o relógio do banco, perto da tabela.
  for (const m of src.matchAll(/\b(expires_at|expired_at)\b[\s\S]{0,80}?(?:NOW\(\)|CURRENT_TIMESTAMP)/gi)) {
    const janela = src.slice(Math.max(0, m.index - 900), m.index + 200);
    for (const t of janela.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_][a-z0-9_]*)\b/gi)) {
      comGatilho.add(t[1].toLowerCase());
    }
  }
  // Gatilho em JS (compara a data lida antes de decidir) também conta.
  if (/\b(expiresAt|expiredAt)\b[\s\S]{0,60}?(?:<|>)\s*(?:new Date\(\)|now\b)/.test(src)) {
    for (const t of src.matchAll(/\bFROM\s+([a-z_][a-z0-9_]*)\b/gi)) comGatilho.add(t[1].toLowerCase());
  }
}

/**
 * 🔴 CONTIDAS POR AUSÊNCIA — schema-ghost, não defeito de prazo.
 *
 * As quatro escrevem prazo em tabela que **NÃO EXISTE** no banco oficial. Medido em 2026-08-05:
 *   node → SELECT count(*) FROM <tabela>  →  relação "<tabela>" não existe  (4 de 4)
 * Logo o writer não chega a armar porta nenhuma: estouraria `42P01` na primeira chamada. Fazem
 * parte da dívida de schema-ghost, que tem contenção própria neste repositório — não desta família.
 *
 * ⚠️ ESTA LISTA SÓ ENCOLHE. Se a tabela nascer, ela sai daqui e precisa de gatilho no mesmo commit;
 * se o código morrer, sai daqui também. O guard REPROVA entrada que deixou de ser violação, senão
 * a lista viraria permissão permanente em vez de dívida com saída.
 */
const CONTIDAS_POR_AUSENCIA = new Set([
  'opportunity_dispatches',
  'loyalty_vouchers',
  'policy_decisions',
  'rides_vehicle_documents',
]);

const violacoes = [];
const semViolacao = new Set(CONTIDAS_POR_AUSENCIA);
for (const [tabela, arqs] of comWriter) {
  if (comGatilho.has(tabela)) continue;
  if (CONTIDAS_POR_AUSENCIA.has(tabela)) {
    semViolacao.delete(tabela);
    continue;
  }
  violacoes.push(`${tabela}: alguém ESCREVE o prazo e NADA o honra — ${[...arqs].join(', ')}`);
}

if (semViolacao.size > 0) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — ${semViolacao.size} entrada(s) da lista de contenção não são mais\n` +
    `   violação: ${[...semViolacao].join(', ')}.\n` +
    `   Isso é bom trabalho pela metade — REMOVA a entrada no mesmo commit. Lista que guarda item\n` +
    `   já resolvido deixa de ser dívida com saída e vira permissão permanente.\n`
  );
  process.exit(1);
}

if (comWriter.size === 0) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — nenhuma escrita de coluna de prazo encontrada em ${lista.length} arquivo(s).\n` +
    `   Não é "não há portas": é o guard tendo ficado CEGO. Denominador vazio nunca é aprovação.\n`
  );
  process.exit(1);
}

if (violacoes.length > 0) {
  console.error(`\n❌ GATE FAIL [${NOME}] — ${violacoes.length} porta(s) de saída SEM GATILHO:\n`);
  for (const v of violacoes) console.error(`   · ${v}`);
  console.error(
    `\n   Um prazo que ninguém honra é decoração: a linha vence e continua valendo para sempre,\n` +
    `   sem erro e sem log. Gatilho aceito: filtrar a coluna contra NOW() na leitura (preguiçoso)\n` +
    `   OU um UPDATE que marque o estado vencido (varredor). Worker dedicado não é exigido.\n\n` +
    `   Denominador: ${comWriter.size} tabela(s) com escrita de prazo, em ${lista.length} arquivo(s) .ts.\n`
  );
  process.exit(1);
}

console.log(
  `✅ GATE OK [${NOME}] — ${comWriter.size} tabela(s) cujo prazo é ESCRITO, todas com gatilho ` +
  `(leitura preguiçosa contra NOW() ou varredor de estado vencido). ` +
  `Portas dormentes, sem writer, ficam de fora por desenho. Universo: ${lista.length} arquivo(s) .ts.`
);
