#!/usr/bin/env node
// Gate estrutural — F-GOVERNED-VOCABULARY-MANIFEST.
// Institucionaliza a lição das 2 violações desta frente (C1 intent-keys paralelas; R2 relationship_type
// não-registrado): torna a conformidade normativa de VOCABULÁRIO um passo de VERIFICAÇÃO (CI), não sorte.
//
// Fonte: src/core/governance/governed-vocabularies.manifest.ts (o registro descobrível dos vocabulários
// SSOT centrais). Este guard faz DUAS checagens ROBUSTAS:
//   (1) ANTI-DRIFT: cada entrada do manifesto DEVE bater com a fonte VIVA (enum/const/CHECK) — o manifesto
//       não pode mentir. Se a fonte muda e o manifesto não, morde (força atualização deliberada). Isto é o
//       que mantém o manifesto DESCOBRÍVEL e verdadeiro (resolve a raiz do RN1: vocab não-descobrível).
//   (2) ANTI-PARALELO: os MESMOS valores (conjunto ≥4) NÃO podem aparecer definidos em OUTRO arquivo
//       (enum / z.enum([...]) / const array / CHECK IN) fora da fonte canônica — é o smell exato do C1/R2
//       (copiar/inventar o vocabulário em vez de compor do SSOT).
//
// DECISION-0181 — CONTRATO sourceSymbol × derivedTypeSymbol (endurecimento ESTRUTURAL, não permissivo):
//   Uma entrada pode declarar `derivedTypeSymbol` (o TIPO derivado do `symbol`=sourceSymbol). Para essas
//   entradas o guard distingue ESTRUTURALMENTE três situações (via parser TypeScript, sem nova dependência):
//     (A) DECLARAÇÃO PARALELA — um MESMO construto (union type / array / tuple / enum) reconstrói o
//         vocabulário (≥ n−1 valores) → MORDE. Importar o tipo derivado NÃO perdoa uma declaração paralela.
//     (B) REFERÊNCIA CANÔNICA — consumidor usa o tipo derivado (`import type`), sem declaração paralela → OK.
//     (C) USO ESCALAR LEGÍTIMO — valores individuais espalhados em lógica (casos/destinos/defaults) NÃO
//         são segunda fonte → NÃO morde (mera coocorrência textual nunca basta).
//   Além disso, para entradas COM derivedTypeSymbol, o guard prova na fonte que `symbol` é const e que o
//   tipo derivado deriva de `(typeof symbol)[number]`.
//   Entradas SEM derivedTypeSymbol (as 28 legadas) mantêm EXATAMENTE o comportamento textual anterior
//   (retrocompatibilidade total — nenhum veredito muda, nenhum limiar reduz, nenhuma allowlist nova).
//
// Em validate:regression-guards (via agregador). Comment-stripped.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const MANIFEST = join(ROOT, 'src', 'core', 'governance', 'governed-vocabularies.manifest.ts');
const stripComments = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const failures = [];
const warnings = [];

if (!existsSync(MANIFEST)) {
  console.error('GATE FAIL [governed-vocabulary-manifest]: manifesto ausente:', relative(ROOT, MANIFEST));
  process.exit(1);
}

// Parse leve do manifesto: extrai os literais de cada entrada (name/sourceFile/sourceKind/symbol/
// derivedTypeSymbol/values).
const manifestSrc = readFileSync(MANIFEST, 'utf8');
const entryBlocks = manifestSrc.split(/\{\s*\n\s*name:/).slice(1);
const entries = [];
for (const b of entryBlocks) {
  const name = (b.match(/^\s*'([^']+)'/) || [])[1];
  const sourceFile = (b.match(/sourceFile:\s*'([^']+)'/) || [])[1];
  const sourceKind = (b.match(/sourceKind:\s*'([^']+)'/) || [])[1];
  const symbol = (b.match(/symbol:\s*'([^']+)'/) || [])[1];
  const derivedTypeSymbol = (b.match(/derivedTypeSymbol:\s*'([^']+)'/) || [])[1];
  const valuesRaw = (b.match(/values:\s*\[([^\]]+)\]/) || [])[1];
  if (!name || !sourceFile || !valuesRaw) continue;
  const values = valuesRaw.split(',').map((v) => v.trim().replace(/^'|'$/g, '')).filter(Boolean);
  entries.push({ name, sourceFile, sourceKind, symbol, derivedTypeSymbol, values });
}

if (entries.length === 0) {
  failures.push('manifesto não parseou nenhuma entrada — formato mudou? o guard precisa acompanhar.');
}

// ── (1) ANTI-DRIFT: cada valor do manifesto aparece na fonte viva ──
for (const e of entries) {
  const p = join(ROOT, e.sourceFile);
  if (!existsSync(p)) {
    failures.push(`[${e.name}] fonte canônica ausente: ${e.sourceFile}`);
    continue;
  }
  const src = readFileSync(p, 'utf8');
  const missing = e.values.filter((v) => !new RegExp(`['"]${escapeRe(v)}['"]`).test(src));
  if (missing.length > 0) {
    failures.push(`[${e.name}] ANTI-DRIFT: valores no manifesto mas AUSENTES na fonte ${e.sourceFile}: ${missing.join(', ')} — a fonte mudou e o manifesto não (ou vice-versa). Reconciliar.`);
  }
}

// ── (1b) CONTRATO source×derived (DECISION-0181) — só entradas COM derivedTypeSymbol ──
// Prova na fonte que `symbol` é const-fonte e que o tipo derivado deriva de (typeof symbol)[number].
for (const e of entries) {
  if (!e.derivedTypeSymbol) continue;
  const p = join(ROOT, e.sourceFile);
  if (!existsSync(p)) continue; // já reportado por anti-drift
  const src = readFileSync(p, 'utf8');
  const hasConst = new RegExp(`export\\s+const\\s+${escapeRe(e.symbol)}\\s*=`).test(src);
  const hasDerivation = new RegExp(
    `type\\s+${escapeRe(e.derivedTypeSymbol)}\\s*=\\s*\\(\\s*typeof\\s+${escapeRe(e.symbol)}\\s*\\)\\s*\\[\\s*number\\s*\\]`
  ).test(src);
  if (!hasConst) {
    failures.push(`[${e.name}] CONTRATO (0181): sourceSymbol '${e.symbol}' não é const-fonte (\`export const ${e.symbol} = [...] as const\`) em ${e.sourceFile}.`);
  }
  if (!hasDerivation) {
    failures.push(`[${e.name}] CONTRATO (0181): derivedTypeSymbol '${e.derivedTypeSymbol}' não deriva de \`(typeof ${e.symbol})[number]\` em ${e.sourceFile} — o tipo derivado NÃO pode vir de segunda lista.`);
  }
}

// ── (2) ANTI-PARALELO ──
const SRC = join(ROOT, 'src');
const skip = (rel) => /(\.test\.|\/scripts\/|governed-vocabularies\.manifest|__tests__|\.spec\.)/.test(rel) || /validate-pipeline-e2e/.test(rel);
const tsFiles = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    const st = statSync(full);
    if (st.isDirectory()) { if (f !== 'node_modules') walk(full); }
    else if (f.endsWith('.ts')) tsFiles.push(full);
  }
})(SRC);

// Colisões de TOKEN legítimas: vocabulários semanticamente DISTINTOS que só compartilham palavras de tempo.
// observability.windowType = granularidade de bucket de MÉTRICA (hour/day/week/month) — NÃO é a unidade de
// tempo mínimo de LOCAÇÃO. Acoplar observability→MIN_RENTAL_UNITS seria o erro. Exceção estreita e documentada
// (não laundering: qualquer OUTRO arquivo que copie MIN_RENTAL_UNITS segue sendo pego).
const PARALLEL_ALLOWLIST = {
  'actor_asset_rental_terms.min_rental_unit': ['core/observability/'],
};

// DECISION-0181 — detecção ESTRUTURAL (parser TS, carregado só se necessário).
let ts = null;
if (entries.some((e) => e.derivedTypeSymbol)) {
  ts = require('typescript');
}

// Maior "cluster" de valores do vocabulário dentro de UM ÚNICO construto declarativo
// (union type | array literal | tuple type | enum). Propriedades de objeto e literais escalares
// espalhados NÃO contam — é exatamente a distinção declaração-paralela × uso-escalar (DECISION-0181).
function maxDeclClusterHits(sourceText, valueSet) {
  const sf = ts.createSourceFile('f.ts', sourceText, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  let max = 0;
  const strOf = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) return node.literal.text;
    return null;
  };
  const countAmong = (nodes) => {
    const s = new Set();
    nodes.forEach((el) => { const v = strOf(el); if (v && valueSet.has(v)) s.add(v); });
    return s.size;
  };
  const visit = (node) => {
    if (ts.isUnionTypeNode(node)) max = Math.max(max, countAmong(node.types));
    else if (ts.isArrayLiteralExpression(node)) max = Math.max(max, countAmong(node.elements));
    else if (ts.isTupleTypeNode(node)) max = Math.max(max, countAmong(node.elements));
    else if (ts.isEnumDeclaration(node)) {
      const s = new Set();
      node.members.forEach((m) => {
        if (m.initializer && ts.isStringLiteral(m.initializer) && valueSet.has(m.initializer.text)) s.add(m.initializer.text);
      });
      max = Math.max(max, s.size);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return max;
}

for (const e of entries) {
  if (e.values.length < 4) continue; // conservador: só conjuntos ≥4 (evita colisão trivial de 2-3 tokens comuns)
  const canonical = join(ROOT, e.sourceFile).toLowerCase();
  const allow = PARALLEL_ALLOWLIST[e.name] || [];
  const valueSet = new Set(e.values);

  if (e.derivedTypeSymbol) {
    // ── DECISION-0181: caminho ESTRUTURAL ──
    for (const file of tsFiles) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (skip(rel)) continue;
      if (allow.some((p) => rel.includes(p))) continue;
      if (file.toLowerCase() === canonical) continue; // a própria fonte
      const raw = readFileSync(file, 'utf8');
      const code = stripComments(raw);
      // pré-filtro textual barato: nº de valores distintos como literal string.
      const hits = e.values.filter((v) => new RegExp(`['"]${escapeRe(v)}['"]`).test(code)).length;
      if (hits < e.values.length - 1) continue; // longe de ser declaração quase-completa
      // prova ESTRUTURAL: existe UM construto que reconstrói o vocabulário?
      const cluster = maxDeclClusterHits(raw, valueSet);
      if (cluster >= e.values.length - 1) {
        failures.push(`[${e.name}] ANTI-PARALELO (estrutural): declaração paralela do vocabulário GOVERNADO — ${cluster}/${e.values.length} valores num MESMO construto (union/array/tuple/enum) em ${rel}. Importar ${e.derivedTypeSymbol} NÃO perdoa declaração paralela. COMPOR do tipo derivado (\`import type { ${e.derivedTypeSymbol} } from '.../${e.sourceFile.split('/').pop()}'\`), nunca redeclarar.`);
      } else {
        const refsDerived = new RegExp(`\\b${escapeRe(e.derivedTypeSymbol)}\\b`).test(code);
        warnings.push(`[${e.name}] ${rel} usa ${hits}/${e.values.length} valores ESCALARES em lógica distribuída (não é declaração paralela — cluster máximo ${cluster})${refsDerived ? `, referencia ${e.derivedTypeSymbol}` : ''} — uso legítimo (C).`);
      }
    }
  } else {
    // ── caminho TEXTUAL legado (28 entradas) — comportamento inalterado ──
    for (const file of tsFiles) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (skip(rel)) continue;
      if (allow.some((p) => rel.includes(p))) continue; // colisão de token legítima e documentada
      if (file.toLowerCase() === canonical) continue; // a própria fonte
      const code = stripComments(readFileSync(file, 'utf8'));
      // quantos dos valores do vocab aparecem como literal string neste arquivo
      const hits = e.values.filter((v) => new RegExp(`['"]${escapeRe(v)}['"]`).test(code)).length;
      // paralelo suspeito: ≥ (todos menos 1) dos valores num MESMO arquivo que NÃO importa a fonte canônica
      const importsCanon = new RegExp(escapeRe(e.symbol)).test(code);
      if (hits >= e.values.length - 1 && !importsCanon) {
        failures.push(`[${e.name}] ANTI-PARALELO: ${hits}/${e.values.length} valores do vocabulário GOVERNADO reaparecem em ${rel} SEM importar/referenciar ${e.symbol} — possível vocabulário paralelo (smell C1/R2). COMPOR da fonte (${e.sourceFile}), não copiar. Se legítimo, importar o símbolo governado.`);
      } else if (hits >= e.values.length - 1 && importsCanon) {
        // reusa o símbolo governado — OK, mas anota (projeção legítima, ex.: composer/guard).
        warnings.push(`[${e.name}] ${rel} lista os valores mas importa ${e.symbol} (projeção legítima).`);
      }
    }
  }
}

console.log(`[governed-vocabulary-manifest] entradas=${entries.length} failures=${failures.length} warnings=${warnings.length}`);
for (const w of warnings) console.log('  🟢', w);
if (failures.length > 0) {
  console.error('GATE FAIL [governed-vocabulary-manifest]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log(`GATE OK [governed-vocabulary-manifest] — ${entries.length} vocabulários governados registrados e coerentes com a fonte viva (anti-drift); nenhum vocabulário paralelo detectado (anti-C1/R2; DECISION-0181: referência estrutural ao tipo derivado, uso escalar legítimo distinguido). A conformidade de vocabulário é VERIFICADA, não sorte.`);
