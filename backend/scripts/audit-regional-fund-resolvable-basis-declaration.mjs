#!/usr/bin/env node
// audit-regional-fund-resolvable-basis-declaration.mjs — Guard dedicado à frente "regional-fund
// publish-time containment" (2026-07-27).
//
// PROBLEMA que este guard existe para nunca deixar voltar: o painel admin oferecia os 7 valores
// físicos de regionalOriginBasis e os 5 de regionalLevel, mas o resolver de pagamento
// (resolveRegionalFundDestination, service-payment-execution.service.ts) REJEITA incondicionalmente
// 3 dos 7 basis (POLICY_BASIS_UNSUPPORTED_MVP) e SEGURA (HOLD, 501) o nível 'neighborhood'. Clayton
// podia publicar uma policy garantida a falhar quando o dinheiro se movesse.
//
// O resolver é BYTE-PINNED por audit-fiscal-economic-policy-composition.mjs (BYTE_INTACT.F.SPE) —
// fora de alcance para esta frente, nunca editado. A solução NÃO foi reconciliar o pin nem
// duplicar a lista à mão: foi DECLARAR o subconjunto resolvível em economic-policy.types.ts
// (REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP / REGIONAL_FUND_LEVEL_RESOLVABLE_MVP) e POLICIAR essa
// declaração com este guard, que lê o resolver READ-ONLY (nunca o edita, nunca o importa/executa)
// e recomputa, a partir do COMPORTAMENTO real do código-fonte, qual deveria ser o subconjunto
// resolvível — falhando (RED) se a declaração divergir.
//
// MÉTODO DE EXTRAÇÃO (comment-stripped, lexical, sem parser AST — mesmo estilo de
// audit-regional-fund-pf-resolver.mjs, que já audita esta mesma função neste mesmo arquivo):
//   1. Isola o TEXTO da função resolveRegionalFundDestination (da assinatura até a próxima
//      declaração de função de nível superior) — nunca varre o arquivo inteiro, reduz superfície
//      de falso positivo/negativo.
//   2. Dentro dela, varre a cadeia if/else-if por `basis === '<literal>'` e marca REJEITADO todo
//      basis cuja cláusula lança `POLICY_BASIS_UNSUPPORTED_MVP` no corpo.
//   3. Localiza o bloco `if (level === 'neighborhood')` e confirma que ele MANTÉM o HOLD
//      (REGIONAL_FUND_NEIGHBORHOOD_HOLD + statusCode 501) — se essa assinatura sumir ou mudar de
//      forma que o guard não reconheça, o guard falha (fail-closed), não assume nada.
//   4. Lê o UNIVERSO físico (RegionalOriginBasis / RegionalFundLevel, os union types já existentes,
//      não-editados por esta frente) em economic-policy.types.ts.
//   5. RESOLVÍVEL-ESPERADO = universo físico − rejeitados-pelo-resolver (basis) / − {neighborhood
//      se HOLD confirmado} (level).
//   6. Compara (igualdade de conjunto, ordem irrelevante) contra as duas constantes DECLARADAS
//      (REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP / REGIONAL_FUND_LEVEL_RESOLVABLE_MVP) — falha se
//      houver QUALQUER diferença (declarado tem a mais, tem a menos, ou diverge).
//   7. Verifica WIRING: economic-policy-write-validation.ts importa e USA as duas constantes para
//      rejeitar (throw) linha regional_fund cujo basis/level não seja resolvível; e o painel admin
//      tem uma rota GET que expõe as mesmas duas constantes (consumo pelo frontend).
//
// POR QUE NÃO É FALSO POSITIVO HOJE: as 4 checagens abaixo (basis rejeitado, hold de neighborhood,
// universo físico, declaração) foram construídas lendo o código REAL vigente nesta sessão — o
// guard roda a MESMA extração sobre a MESMA árvore, então converge por construção enquanto nada
// mudar. A prova RED (mandato desta frente) demonstra a outra direção: alterar SÓ a declaração
// (nunca o resolver) faz o guard morder.
//
// POR QUE PEGARIA DIVERGÊNCIA REAL: se o resolver ganhar suporte a um basis hoje rejeitado (a
// cláusula `POLICY_BASIS_UNSUPPORTED_MVP` sumir do corpo daquele branch) e ninguém atualizar a
// declaração, o RESOLVÍVEL-ESPERADO cresce e a comparação do passo 6 diverge → RED. Mesma lógica
// no sentido contrário (resolver passa a rejeitar um basis hoje aceito) e para o HOLD de
// neighborhood (resolver larga o HOLD, ou o HOLD muda de forma que a extração não reconheça mais
// — também RED, fail-closed, nunca assume "continua igual").
//
// Em validate:regression-guards. NÃO altera runtime. NÃO importa/executa o resolver.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url))); // backend/
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const RESOLVER_FILE = join(ROOT, 'src', 'modules', 'services', 'service-payment-execution.service.ts');
const TYPES_FILE = join(ROOT, 'src', 'modules', 'economy', 'policy-engine', 'economic-policy.types.ts');
const WRITE_VALIDATION_FILE = join(ROOT, 'src', 'modules', 'economy', 'policy-engine', 'economic-policy-write-validation.ts');
const ADMIN_ROUTES_FILE = join(ROOT, 'src', 'modules', 'economy', 'policy-engine', 'economic-policy-admin.routes.ts');

const failures = [];
const check = (label, ok) => { if (!ok) failures.push(label); console.log(`  ${ok ? 'OK ' : 'FAIL'} ${label}`); };
const setEq = (a, b) => {
  const sa = [...new Set(a)].sort();
  const sb = [...new Set(b)].sort();
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
};

// ── 1. Isola o texto da função resolveRegionalFundDestination ──────────────────────────────────
const resolverRaw = readFileSync(RESOLVER_FILE, 'utf8');
const resolverSrc = stripTs(resolverRaw);
const FN_START = /(?:export )?async function resolveRegionalFundDestination\(/;
const startMatch = FN_START.exec(resolverSrc);
if (!startMatch) {
  check('resolveRegionalFundDestination encontrado em service-payment-execution.service.ts', false);
} else {
  const afterStart = resolverSrc.slice(startMatch.index + startMatch[0].length);
  const NEXT_FN = /\r?\n(?:export\s+)?(?:async\s+)?function\s+\w+/;
  const nextMatch = NEXT_FN.exec(afterStart);
  const fnText = nextMatch ? afterStart.slice(0, nextMatch.index) : afterStart;
  check('função isolada tem corpo não-trivial (>500 chars — extração não ficou vazia)', fnText.length > 500);

  // ── 2. Cadeia if/else-if — basis rejeitado incondicionalmente ────────────────────────────────
  // Casa tanto o `if (` inicial da cadeia quanto os `} else if (` seguintes; \r?\n tolera CRLF
  // (Windows Write/Edit gera CRLF — mesma disciplina do resto do repo).
  const chainRe = /\}?\s*(?:^|\r?\n)\s*\}?\s*(?:^|)(?:if|else if)\s*\(([\s\S]*?)\)\s*\{([\s\S]*?)(?=\r?\n\s{2}\}\s*(?:else\b|\r?\n))/g;
  // A regex acima é frágil por natureza (heurística de indentação) — validação estrutural mínima:
  // exige achar ao menos os 4 branches conhecidos de basis (residence×2 fundidos, operational, hq)
  // mais os 2 branches de rejeição, senão a extração está quebrada e o guard falha fechado.
  const rejectedBasis = new Set();
  const seenBasis = new Set();
  let cm;
  let branchCount = 0;
  while ((cm = chainRe.exec(fnText)) !== null) {
    branchCount++;
    const cond = cm[1];
    const body = cm[2];
    const lits = [...cond.matchAll(/basis\s*===\s*'([a-z_]+)'/g)].map((x) => x[1]);
    if (lits.length === 0) continue;
    for (const l of lits) seenBasis.add(l);
    if (/POLICY_BASIS_UNSUPPORTED_MVP/.test(body)) {
      for (const l of lits) rejectedBasis.add(l);
    }
  }
  check(`cadeia if/else-if percorrida (${branchCount} branches encontrados, ≥4 esperado)`, branchCount >= 4);
  check(
    `basis rejeitados extraídos do resolver: {${[...rejectedBasis].sort().join(', ')}} (esperado exatamente {explicit_economic_region, service_location, transaction_location})`,
    setEq([...rejectedBasis], ['explicit_economic_region', 'service_location', 'transaction_location'])
  );
  check(
    `basis NÃO-rejeitados vistos no resolver incluem os 4 esperados`,
    ['payer_identity_residence', 'receiver_identity_residence', 'receiver_company_operational', 'receiver_company_hq']
      .every((v) => seenBasis.has(v) && !rejectedBasis.has(v))
  );

  // ── 3. HOLD de neighborhood ────────────────────────────────────────────────────────────────
  const holdRe = /if\s*\(\s*level\s*===\s*'neighborhood'\s*\)\s*\{([\s\S]*?)\r?\n\s{2}\}/;
  const holdMatch = holdRe.exec(fnText);
  const neighborhoodHeld = !!holdMatch
    && /REGIONAL_FUND_NEIGHBORHOOD_HOLD/.test(holdMatch[1])
    && /statusCode\s*=\s*501/.test(holdMatch[1]);
  check("bloco 'if (level === neighborhood)' encontrado e confirma HOLD (REGIONAL_FUND_NEIGHBORHOOD_HOLD + statusCode 501)", neighborhoodHeld);

  // ── 4. Universo físico (union types já existentes, não-editados por esta frente) ─────────────
  const typesRaw = readFileSync(TYPES_FILE, 'utf8');
  const typesSrc = stripTs(typesRaw);
  const basisUnionMatch = /export type RegionalOriginBasis =\s*([\s\S]*?);/.exec(typesSrc);
  const levelUnionMatch = /export type RegionalFundLevel = ([^;]+);/.exec(typesSrc);
  const basisUniverse = basisUnionMatch ? [...basisUnionMatch[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : [];
  const levelUniverse = levelUnionMatch ? [...levelUnionMatch[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : [];
  check('RegionalOriginBasis (universo físico) tem exatamente 7 valores', basisUniverse.length === 7);
  check('RegionalFundLevel (universo físico) tem exatamente 5 valores', levelUniverse.length === 5);

  // ── 5. RESOLVÍVEL-ESPERADO ────────────────────────────────────────────────────────────────
  const expectedBasisResolvable = basisUniverse.filter((v) => !rejectedBasis.has(v));
  const expectedLevelResolvable = levelUniverse.filter((v) => !(neighborhoodHeld && v === 'neighborhood'));

  // ── 6. Declaração (economic-policy.types.ts) ──────────────────────────────────────────────
  const declBasisMatch = /export const REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP = \[([\s\S]*?)\] as const;/.exec(typesSrc);
  const declLevelMatch = /export const REGIONAL_FUND_LEVEL_RESOLVABLE_MVP = \[([\s\S]*?)\] as const;/.exec(typesSrc);
  check('REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP declarada em economic-policy.types.ts', !!declBasisMatch);
  check('REGIONAL_FUND_LEVEL_RESOLVABLE_MVP declarada em economic-policy.types.ts', !!declLevelMatch);
  const declaredBasis = declBasisMatch ? [...declBasisMatch[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : [];
  const declaredLevel = declLevelMatch ? [...declLevelMatch[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : [];

  check(
    `REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP declarado {${[...declaredBasis].sort().join(', ')}} == esperado {${[...expectedBasisResolvable].sort().join(', ')}} (derivado do resolver)`,
    setEq(declaredBasis, expectedBasisResolvable)
  );
  check(
    `REGIONAL_FUND_LEVEL_RESOLVABLE_MVP declarado {${[...declaredLevel].sort().join(', ')}} == esperado {${[...expectedLevelResolvable].sort().join(', ')}} (derivado do resolver)`,
    setEq(declaredLevel, expectedLevelResolvable)
  );

  // ── 7. Wiring dos dois consumidores ────────────────────────────────────────────────────────
  const wvSrc = stripTs(readFileSync(WRITE_VALIDATION_FILE, 'utf8'));
  check(
    'economic-policy-write-validation.ts importa REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP e REGIONAL_FUND_LEVEL_RESOLVABLE_MVP',
    /REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP/.test(wvSrc) && /REGIONAL_FUND_LEVEL_RESOLVABLE_MVP/.test(wvSrc)
  );
  check(
    'write-validation REJEITA (throw) regional_fund cujo basis não esteja em REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP',
    /REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP as readonly string\[\]\)\.includes\(line\.regionalOriginBasis\)/.test(wvSrc)
      && /throw HttpError\.badRequest/.test(wvSrc)
  );
  check(
    'write-validation REJEITA (throw) regional_fund cujo level não esteja em REGIONAL_FUND_LEVEL_RESOLVABLE_MVP',
    /REGIONAL_FUND_LEVEL_RESOLVABLE_MVP as readonly string\[\]\)\.includes\(line\.regionalLevel\)/.test(wvSrc)
  );
  const routesSrc = stripTs(readFileSync(ADMIN_ROUTES_FILE, 'utf8'));
  check(
    'economic-policy-admin.routes.ts expõe rota GET que serve as duas constantes RESOLVABLE_MVP (consumo pelo painel)',
    /REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP/.test(routesSrc)
      && /REGIONAL_FUND_LEVEL_RESOLVABLE_MVP/.test(routesSrc)
      && /fastify\.get\(\s*\n?\s*'\/admin\/regional-fund-vocabulary'/.test(routesSrc)
  );
}

if (failures.length) {
  console.error(`\nGATE FAIL [regional-fund-resolvable-basis-declaration]: ${failures.length} falha(s):`);
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('\nGATE OK [regional-fund-resolvable-basis-declaration] — REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP e REGIONAL_FUND_LEVEL_RESOLVABLE_MVP (economic-policy.types.ts) recomputadas por extração lexical do resolver byte-pinned batem exatamente; write-validation e a rota admin estão fiadas às constantes (nenhuma segunda lista).');
