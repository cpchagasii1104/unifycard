#!/usr/bin/env node
// backend/scripts/audit-date-query-param-boundary.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (criado 2026-08-04)
// ║ NORMA:   CLAUDE.md §3.2 — "entrada de usuário em rota: valide contra o
// ║          vocabulário GOVERNADO e devolva 400, não 500"
// ║ NÃO:     NÃO fazer `new Date(req.query.X)` na fronteira de uma rota.
// ║ EM VEZ:  parseInstantQueryParam() de `src/core/http/query-instant.ts`.
// ╚════════════════════════════════════════════════════════════════
//
// ═══ O ACHADO QUE ORIGINOU ESTE GUARD (2026-08-04) ═══
// Clayton pediu filtro por data específica na vitrine de eventos. Antes de ligar o caminho,
// prova vermelha contra o servidor vivo:
//
//   curl ".../api/events/events?startAtFrom=lixo"
//   → HTTP 500 {"code":"22007","message":"sintaxe de entrada é inválida para tipo
//                timestamp with time zone: \"0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN\""}
//
// `new Date('lixo')` devolve `Invalid Date` — um `Date` VÁLIDO para o TypeScript. O tipo na
// assinatura (`startAtFrom?: Date`) é uma AFIRMAÇÃO, não uma checagem: o valor atravessou rota,
// service e repositório sem um aviso de compilação e só explodiu dentro do driver do Postgres.
//
// E não era sítio único. Varredura no mesmo dia: **13 arquivos de rota**, vários deles no
// caminho do DINHEIRO (ledger, invoicing, financial-agenda, regional-fee, reporting). Mesma
// forma, mesmo desfecho: 500 com erro de banco vazado, ou — pior — intervalo invertido que
// devolve 200 com lista vazia e ninguém reclama.
//
// ═══ POR QUE TETO E NÃO CONSERTO EM MASSA ═══
// Converter as rotas de dinheiro exige ler o que cada uma faz com o intervalo, e isso é frente
// própria com verificação própria. O que NÃO precisa de decisão nenhuma é impedir que a família
// CRESÇA enquanto isso. A contagem só desce; consertou uma, baixe o teto no mesmo commit.
//
// 🔴 O TETO É COMPARADO CONTRA O CÓDIGO, não impresso na mensagem de sucesso. Dois guards deste
// repositório nasceram com baseline declarada, impressa no verde e NUNCA comparada — anunciavam
// "a contagem só pode descer" com a contagem maior. Aqui `detectados > TETO` FALHA, e
// `detectados < TETO` também falha, exigindo que o número desça no mesmo commit do conserto:
// senão o primeiro conserto trava o runner para sempre e alguém acaba desligando o guard.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '../src');

/**
 * Teto vivo, MEDIDO em 2026-08-04 (não estimado). Chave = arquivo relativo a src/.
 * Só desce. Cada descida é uma rota que passou a validar de verdade — nomeie qual no commit.
 */
const TETO_POR_ARQUIVO = {
  'core/availability/unified-availability.routes.ts': 2,
  'core/categories/ssot-admin.routes.ts': 2,
  'modules/business-audit/business-audit.routes.ts': 2,
  'modules/events/events.routes.ts': 2,
  'modules/invoicing/invoice.routes.ts': 2,
  'modules/ledger/ledger.routes.ts': 2,
  'modules/marketplace/financial-agenda.routes.ts': 4,
  'modules/marketplace/marketplace-search.routes.ts': 2,
  'modules/marketplace/regional-fee.routes.ts': 4,
  'modules/my-orders/my-orders.routes.ts': 2,
  'modules/rentals/rentable-resource.routes.ts': 2,
  'modules/reporting/reporting.routes.ts': 8,
};

/**
 * `new Date(` seguido, dentro da mesma linha, de uma leitura de `req.query`.
 * Cobre as formas medidas: `new Date(req.query.x)`, `new Date(String(req.query.x))`,
 * `new Date((req.query as any).x)` e `new Date(req.query.x ?? '')`.
 */
const PADRAO = /new\s+Date\s*\([^)]*req\.query/;

/**
 * 🔴 COMENTÁRIO NÃO É CÓDIGO — e este guard acusou na primeira execução um sítio que era o
 * comentário do PRÓPRIO conserto, citando a linha antiga para explicar o que mudou. Guard que
 * conta comentário pune quem documenta e ensina a apagar a explicação para o verde voltar; este
 * repositório já pagou isso uma vez (o teto de vocabulário financeiro, que também lê comentário).
 */
function ehComentario(linha) {
  const t = linha.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

const failures = [];

// Denominador do verde — ver a nota na mensagem de sucesso. Declarados fora do bloco para que a
// saída consiga afirmar QUANTO foi examinado, e não só que nada falhou.
let totalArquivos = 0;
let totalSitios = 0;
let detectadoGlobal = {};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir)) {
    if (e === 'node_modules') continue;
    const full = path.join(dir, e);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (e.endsWith('.routes.ts')) out.push(full);
  }
  return out;
}

if (!fs.existsSync(SRC)) {
  // 🔴 Falha ao LER não pode virar "0 sítios". Zero afirma "não há"; aqui a verdade é "não sei".
  failures.push('src/ ausente — o guard não conseguiu medir, e não-medido não é zero. Fail-closed.');
} else {
  const arquivos = walk(SRC);
  totalArquivos = arquivos.length;
  if (arquivos.length === 0) {
    failures.push('nenhum *.routes.ts encontrado — leitura suspeita, não conclusão. Fail-closed.');
  }

  const detectado = {};
  for (const full of arquivos) {
    const rel = path.relative(SRC, full).split(path.sep).join('/');
    const n = fs.readFileSync(full, 'utf-8').split('\n')
      .filter((l) => !ehComentario(l) && PADRAO.test(l)).length;
    if (n > 0) { detectado[rel] = n; totalSitios += n; }
  }

  detectadoGlobal = detectado;

  // ── 1. arquivo NOVO na família, ou arquivo conhecido que CRESCEU ──
  for (const [rel, n] of Object.entries(detectado)) {
    const teto = TETO_POR_ARQUIVO[rel];
    if (teto === undefined) {
      failures.push(
        `${rel}: ${n} sítio(s) de \`new Date(req.query...)\` e o arquivo NÃO está no teto. ` +
        'Fronteira nova sem validação — use parseInstantQueryParam() de @core/http/query-instant ' +
        'e devolva 400. Entrada de usuário crua no SQL vira 500 com erro de banco vazado.'
      );
    } else if (n > teto) {
      failures.push(
        `${rel}: ${n} sítios > teto ${teto}. A contagem desta família só pode DESCER. ` +
        'Se a intenção era converger, converta e baixe o teto neste mesmo commit.'
      );
    }
  }

  // ── 2. teto que não foi podado junto com o conserto ──
  // Sem isto, o primeiro conserto real deixaria o guard verde com o número antigo — e o teto
  // viraria comentário, exatamente o defeito que este repositório já pagou duas vezes.
  for (const [rel, teto] of Object.entries(TETO_POR_ARQUIVO)) {
    const n = detectado[rel] ?? 0;
    if (n < teto) {
      failures.push(
        `${rel}: ${n} sítio(s) no código, mas o teto ainda diz ${teto}. Alguém consertou e não ` +
        `baixou o número. Ajuste TETO_POR_ARQUIVO para ${n}` +
        (n === 0 ? ' — ou remova a linha, se zerou.' : '.')
      );
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [date-query-param-boundary]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
// 🔴 O VERDE DECLARA O DENOMINADOR (2026-08-05) — aprendido lendo `ARQUITETURA/DOCS/00-fundamentos/
// gate-de-granularidade.md`, que registra um guard do legado verde por MESES validando 131 de 551
// arquivos (24%) e pulando o resto em silêncio, por um `return` antecipado.
// "Verde" só é seguro de ler como "ok" se a saída disser **quantos** foram examinados. Sem isso,
// um walk que quebra e devolve lista curta é indistinguível de um repositório limpo.
console.log(
  `GATE OK [date-query-param-boundary] — examinados ${totalArquivos} arquivos *.routes.ts; ` +
  `${Object.keys(detectadoGlobal).length} com sítios de conversão, ${totalSitios} sítios no total, ` +
  `contra ${Object.keys(TETO_POR_ARQUIVO).length} arquivos no teto. Nenhuma rota NOVA converte data ` +
  'de query string sem validar, e a família congelada não cresceu. `new Date(entrada_do_usuário)` ' +
  'devolve Invalid Date, que satisfaz o tipo `Date` e só explode dentro do driver, como 500.'
);
