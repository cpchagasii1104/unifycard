// backend/src/core/http/query-instant.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — parser de INSTANTE vindo de query string, na fronteira
// ║ NORMA:   CLAUDE.md §3.2 "entrada de usuário em rota: valide contra o vocabulário
// ║          GOVERNADO e devolva 400, não 500" · 07_NOMENCLATURA §4.6 (TIMESTAMPTZ)
// ║ NÃO:     NÃO fazer `new Date(req.query.X)` direto — `Invalid Date` chega ao SQL.
// ║ EM VEZ:  parseInstantQueryParam(req.query.X, 'startAtFrom') → 400 nomeado.
// ╚════════════════════════════════════════════════════════════════
//
// ═══ POR QUE ESTE ARQUIVO EXISTE (2026-08-04) ═══
// Medido com curl contra o servidor vivo, ANTES de escrever uma linha:
//
//   GET /api/events/events?startAtFrom=lixo
//   → HTTP 500  {"code":"22007","message":"sintaxe de entrada é inválida para tipo
//                timestamp with time zone: \"0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN\""}
//
// `new Date('lixo')` é `Invalid Date` — um objeto Date PERFEITAMENTE VÁLIDO para o TypeScript,
// cujo `toISOString()` só explode no fim do caminho, dentro do driver, já como erro de sintaxe do
// Postgres. O tipo `Date` na assinatura é uma AFIRMAÇÃO, não uma checagem: `startAtFrom?: Date`
// (event.types.ts:173) está satisfeito por `Invalid Date`, e por isso o defeito atravessou rota,
// service e repositório sem um único aviso de compilação.
//
// O 500 vazando `22007` para o cliente é o sintoma barulhento. O silencioso é pior e mora ao lado:
// um intervalo INVERTIDO (`from` depois de `to`) produz `datetime_start >= X AND <= Y` com X > Y —
// SQL perfeitamente válido, zero linhas, HTTP 200. O usuário pede "eventos do dia 16", recebe
// "nenhum evento" e acredita. Por isso `assertInstantRangeCoherent` existe junto: as duas metades
// do mesmo defeito, e a muda é a que ninguém reporta.
//
// ⚠️ ESCOPO: instante de FILTRO (query string). NÃO é para data de nascimento — essa tem regra
// própria e mais estrita em `src/utils/dateNormalizer.ts` (faixa 1900-2100, aceita DD/MM/YYYY).
// Duas regras diferentes porque são dois domínios diferentes; não unifique por parecerem "data".

/**
 * Resultado explícito — sem exceção: quem chama decide o que fazer com o 400.
 *
 * ⚠️ ISTO NÃO É UMA UNIÃO DISCRIMINADA, E A RAZÃO É MEDIDA, NÃO PREFERÊNCIA.
 * A primeira versão era `{ ok: true; value: Date } | { ok: false; code; message }`, que é a forma
 * idiomática — e ela NÃO COMPILA neste repositório. `tsconfig.build.json` tem `strict: false`, e
 * sem `strictNullChecks` o TypeScript não estreita união por literal booleano. Provado com o tsc
 * do próprio repo (5.9.3), no menor caso possível:
 *
 *   type R = { ok: true; value: number } | { ok: false; code: string };
 *   if (!r.ok) { r.code }
 *     --strict        → compila
 *     --strict false  → TS2339: Property 'code' does not exist on type 'R'
 *
 * Um único formato, com `null` explícito, compila nos dois. Não "simplifique" de volta para união
 * sem rodar `npm run typecheck` (que usa o tsconfig.build, o permissivo) — o editor mente aqui,
 * porque `tsconfig.json` é estrito e não é o arquivo que a build usa.
 */
export interface InstantQueryParseResult {
  /** `false` = não deu para ler. */
  ok: boolean;
  /** O instante lido, ou `null`. NUNCA `Invalid Date` — é isso que o tipo `Date` sozinho não garante. */
  value: Date | null;
  /** Código do 400 quando falhou; `null` quando deu certo. */
  code: string | null;
  /** Mensagem do 400 quando falhou; `null` quando deu certo. */
  message: string | null;
}

/**
 * Formato aceito, deliberadamente ESTREITO: `YYYY-MM-DD` ou ISO-8601 com hora.
 *
 * 🔴 A regex é o portão, NÃO o `isNaN` que vem depois. `new Date()` do JS aceita coisas que
 * ninguém quis dizer e devolve Date válido — `new Date('0')` é 01/01/2000, `new Date('mar')` é
 * inválido em um motor e válido em outro. Confiar só em `isNaN(getTime())` deixaria passar
 * `?startAtFrom=0` como "ano 2000" e o filtro devolveria silenciosamente o conjunto errado.
 * Aqui a forma é verificada ANTES de existir Date nenhum.
 */
const FORMA_ISO =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * 🔴 `Number.isNaN(getTime())` NÃO BASTA — medido, não suposto (2026-08-04):
 *
 *   new Date('2026-02-31')  →  Mon Mar 02 2026   ← NÃO é Invalid Date. ROLA para março.
 *   new Date('2026-02-30')  →  Sun Mar 01 2026
 *   new Date('2026-13-01')  →  Invalid Date      ← só o mês fora de faixa grita
 *
 * Este arquivo chegou a AFIRMAR num comentário que 31/02 daria Invalid Date. A prova de ponta a
 * ponta devolveu HTTP 200 para `?startAtFrom=2026-02-31` e derrubou a afirmação. É o defeito mudo
 * na sua forma mais pura: quem perguntasse por 31 de fevereiro receberia os eventos de 2 de março
 * e acreditaria. Por isso o calendário é conferido por ARITMÉTICA, sem depender da leniência do
 * motor — que varia entre motores e entre versões, e não é contrato de ninguém.
 */
function diaDoCalendarioExiste(ano: number, mes: number, dia: number): boolean {
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
  const diasNoMes = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dia <= diasNoMes[mes - 1];
}

/**
 * Converte um parâmetro de query em instante, ou explica por que não dá.
 *
 * @param raw   valor cru de `req.query.*` — `unknown` de propósito: query string NÃO é string
 *              garantida. `?d=a&d=b` chega como ARRAY, e `new Date(['a','b'])` é Invalid Date.
 *              O tipo `string | undefined` que as rotas declaram no Querystring é declaração de
 *              intenção do autor, não validação do runtime do Fastify.
 * @param nome  nome do parâmetro, para o erro dizer QUAL deles está errado.
 */
export function parseInstantQueryParam(raw: unknown, nome: string): InstantQueryParseResult {
  if (typeof raw !== 'string') {
    return {
      ok: false, value: null,
      code: 'QUERY_INSTANT_INVALID',
      message:
        `'${nome}' precisa ser um único valor de texto. Recebido: ${Array.isArray(raw) ? 'lista de valores' : typeof raw}.`,
    };
  }

  const texto = raw.trim();
  if (texto === '') {
    return {
      ok: false, value: null,
      code: 'QUERY_INSTANT_INVALID',
      message: `'${nome}' veio vazio. Omita o parâmetro em vez de mandá-lo em branco.`,
    };
  }

  const m = FORMA_ISO.exec(texto);
  if (!m) {
    return {
      ok: false, value: null,
      code: 'QUERY_INSTANT_INVALID',
      message:
        `'${nome}' não está em formato de data reconhecido. Use YYYY-MM-DD ou ISO-8601 ` +
        `(ex.: 2026-08-16 ou 2026-08-16T20:00:00.000Z). Recebido: '${texto}'.`,
    };
  }

  // 2ª barreira — CALENDÁRIO, por aritmética. Ver `diaDoCalendarioExiste`: 31/02 NÃO é rejeitado
  // pelo motor, vira 2 de março em silêncio, e devolveria a lista de um dia que ninguém pediu.
  const ano = Number(m[1]); const mes = Number(m[2]); const dia = Number(m[3]);
  if (!diaDoCalendarioExiste(ano, mes, dia)) {
    return {
      ok: false, value: null,
      code: 'QUERY_INSTANT_INVALID',
      message: `'${nome}' tem o formato certo mas não é um dia que existe no calendário: '${texto}'.`,
    };
  }

  // 3ª barreira — HORA. Mesma doença: `T25:00` também rola para o dia seguinte sem reclamar.
  const hora = m[4] === undefined ? 0 : Number(m[4]);
  const minuto = m[5] === undefined ? 0 : Number(m[5]);
  const segundo = m[6] === undefined ? 0 : Number(m[6]);
  if (hora > 23 || minuto > 59 || segundo > 59) {
    return {
      ok: false, value: null,
      code: 'QUERY_INSTANT_INVALID',
      message: `'${nome}' tem hora fora de faixa: '${texto}'.`,
    };
  }

  const instante = new Date(texto);
  // 4ª barreira, defensiva: nenhuma das anteriores deveria deixar passar Invalid Date, mas o dia
  // em que uma deixar, a verdade é "não sei ler", nunca um Date que só explode dentro do driver.
  if (Number.isNaN(instante.getTime())) {
    return {
      ok: false, value: null,
      code: 'QUERY_INSTANT_INVALID',
      message: `'${nome}' não pôde ser lido como instante: '${texto}'.`,
    };
  }

  return { ok: true, value: instante, code: null, message: null };
}

/**
 * Intervalo invertido é o irmão MUDO do 500 — 200 com lista vazia, para sempre, sem erro.
 * Devolve a mensagem do 400 quando `de` é posterior a `ate`; `null` quando está coerente
 * (inclusive quando falta uma das pontas, que é intervalo aberto legítimo).
 */
export function assertInstantRangeCoherent(
  de: Date | null | undefined,
  ate: Date | null | undefined,
  nomeDe: string,
  nomeAte: string
): string | null {
  if (!de || !ate) return null;
  if (de.getTime() <= ate.getTime()) return null;
  return (
    `'${nomeDe}' (${de.toISOString()}) é posterior a '${nomeAte}' (${ate.toISOString()}). ` +
    'Um intervalo invertido nunca casa nada: devolveria lista vazia sem erro, e quem perguntou ' +
    'acreditaria que não existe nada no período.'
  );
}
