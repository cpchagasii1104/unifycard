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
//       (copiar/inventar o vocabulário em vez de compor do SSOT). Conservador (≥4 valores, exclui
//       test/e2e/manifest/o próprio arquivo-fonte) para baixo falso-positivo. Mordida = INVESTIGAR.
//
// Em validate:regression-guards (via agregador). Comment-stripped.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const MANIFEST = join(ROOT, 'src', 'core', 'governance', 'governed-vocabularies.manifest.ts');
const stripComments = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const warnings = [];

if (!existsSync(MANIFEST)) {
  console.error('GATE FAIL [governed-vocabulary-manifest]: manifesto ausente:', relative(ROOT, MANIFEST));
  process.exit(1);
}

// Parse leve do manifesto: extrai os literais de cada entrada (name/sourceFile/sourceKind/symbol/values).
const manifestSrc = readFileSync(MANIFEST, 'utf8');
const entryBlocks = manifestSrc.split(/\{\s*\n\s*name:/).slice(1);
const entries = [];
for (const b of entryBlocks) {
  const name = (b.match(/^\s*'([^']+)'/) || [])[1];
  const sourceFile = (b.match(/sourceFile:\s*'([^']+)'/) || [])[1];
  const sourceKind = (b.match(/sourceKind:\s*'([^']+)'/) || [])[1];
  const symbol = (b.match(/symbol:\s*'([^']+)'/) || [])[1];
  const valuesRaw = (b.match(/values:\s*\[([^\]]+)\]/) || [])[1];
  if (!name || !sourceFile || !valuesRaw) continue;
  const values = valuesRaw.split(',').map((v) => v.trim().replace(/^'|'$/g, '')).filter(Boolean);
  entries.push({ name, sourceFile, sourceKind, symbol, values });
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
  const missing = e.values.filter((v) => !new RegExp(`['"]${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(src));
  if (missing.length > 0) {
    failures.push(`[${e.name}] ANTI-DRIFT: valores no manifesto mas AUSENTES na fonte ${e.sourceFile}: ${missing.join(', ')} — a fonte mudou e o manifesto não (ou vice-versa). Reconciliar.`);
  }
}

// ── (2) ANTI-PARALELO: mesmos valores (≥4) definidos em outro arquivo ──
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

for (const e of entries) {
  if (e.values.length < 4) continue; // conservador: só conjuntos ≥4 (evita colisão trivial de 2-3 tokens comuns)
  const canonical = join(ROOT, e.sourceFile).toLowerCase();
  for (const file of tsFiles) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (skip(rel)) continue;
    if (file.toLowerCase() === canonical) continue; // a própria fonte
    const code = stripComments(readFileSync(file, 'utf8'));
    // quantos dos valores do vocab aparecem como literal string neste arquivo
    const hits = e.values.filter((v) => new RegExp(`['"]${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(code)).length;
    // paralelo suspeito: ≥ (todos menos 1) dos valores num MESMO arquivo que NÃO importa a fonte canônica
    const importsCanon = new RegExp(e.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(code);
    if (hits >= e.values.length - 1 && !importsCanon) {
      failures.push(`[${e.name}] ANTI-PARALELO: ${hits}/${e.values.length} valores do vocabulário GOVERNADO reaparecem em ${rel} SEM importar/referenciar ${e.symbol} — possível vocabulário paralelo (smell C1/R2). COMPOR da fonte (${e.sourceFile}), não copiar. Se legítimo, importar o símbolo governado.`);
    } else if (hits >= e.values.length - 1 && importsCanon) {
      // reusa o símbolo governado — OK, mas anota (projeção legítima, ex.: composer/guard).
      warnings.push(`[${e.name}] ${rel} lista os valores mas importa ${e.symbol} (projeção legítima).`);
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
console.log(`GATE OK [governed-vocabulary-manifest] — ${entries.length} vocabulários governados registrados e coerentes com a fonte viva (anti-drift); nenhum vocabulário paralelo detectado (anti-C1/R2). A conformidade de vocabulário é VERIFICADA, não sorte.`);
