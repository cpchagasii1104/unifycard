#!/usr/bin/env node
/**
 * docs-link.mjs
 *
 * Varre todos os arquivos .md em docs/01_normative/ e docs/ssot/,
 * extrai referências explícitas a outros arquivos .md,
 * constrói o grafo bidirecional e injeta as seções
 * <!-- AUTO-GENERATED-START --> / <!-- AUTO-GENERATED-END -->
 * no final de cada arquivo.
 *
 * Uso:
 *   node scripts/docs-link.mjs              → injeta refs nos arquivos
 *   node scripts/docs-link.mjs --dry-run    → só mostra grafo, não altera
 *   node scripts/docs-link.mjs --export     → gera docs/graph.json
 *
 * Filtros ativos:
 *   - ignora blocos de código fenced (``` ... ```)
 *   - ignora links externos (http/https)
 *   - ignora a seção auto-gerada anterior (evita loop)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');
const EXPORT = process.argv.includes('--export');

const SCAN_DIRS = [
  path.join(ROOT, 'docs', '01_normative'),
  path.join(ROOT, 'docs', 'ssot'),
];

const MD_REF_REGEX = /\b([A-Za-z0-9][A-Za-z0-9_\-]*\.md)\b/g;

// Remove blocos fenced (``` ... ```) e inline code (` ... `),
// mas PRIMEIRO extrai referências a arquivos .md dentro de inline code.
function stripCode(text, knownNames, refs) {
  // fenced code blocks — remover sem extrair (são exemplos de código real)
  text = text.replace(/```[\s\S]*?```/g, '');
  // inline code: extrair refs válidas antes de remover
  text = text.replace(/`([^`\n]*)`/g, (match, inner) => {
    // se o conteúdo do inline code É um nome de arquivo conhecido, capturar
    const trimmed = inner.trim();
    if (knownNames && knownNames.has(trimmed)) {
      refs.add(trimmed);
    }
    return '';
  });
  return text;
}

// Remove links externos e imagens que contenham URLs
function stripExternalLinks(text) {
  // [texto](http...) ou ![texto](http...)
  text = text.replace(/!?\[[^\]]*\]\(https?:\/\/[^)]*\)/g, '');
  return text;
}

const SECTION_HEADER = '\n\n---\n\n## 🔗 Referencias\n';
const AUTO_START = '<!-- AUTO-GENERATED-START -->';
const AUTO_END = '<!-- AUTO-GENERATED-END -->';

// ─── 1. Coletar todos os arquivos ──────────────────────────────────────────

function collectMdFiles(dirs) {
  const files = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (entry.endsWith('.md')) {
        files.push(path.join(dir, entry));
      }
    }
  }
  return files;
}

// ─── 2. Extrair referências de um arquivo ──────────────────────────────────

function extractRefs(filePath, knownNames) {
  const content = fs.readFileSync(filePath, 'utf-8');

  const selfName = path.basename(filePath);
  const refs = new Set();

  // 1. Remover seção auto-gerada anterior (evita contar refs dentro dela)
  let withoutAuto = content.replace(
    new RegExp(`${AUTO_START}[\\s\\S]*?${AUTO_END}`, 'g'),
    ''
  );
  // 2. Remover fenced blocks e EXTRAIR refs de inline code antes de remover
  withoutAuto = stripCode(withoutAuto, knownNames, refs);
  // 3. Remover links externos
  withoutAuto = stripExternalLinks(withoutAuto);

  let match;
  MD_REF_REGEX.lastIndex = 0;
  while ((match = MD_REF_REGEX.exec(withoutAuto)) !== null) {
    const name = match[1];
    if (name !== selfName && knownNames.has(name)) {
      refs.add(name);
    }
  }

  return refs;
}

// ─── 3. Montar grafo ───────────────────────────────────────────────────────

function buildGraph(files) {
  const knownNames = new Set(files.map((f) => path.basename(f)));

  /** @type {Map<string, Set<string>>} — basename → [basenames que ele referencia] */
  const forward = new Map();
  /** @type {Map<string, Set<string>>} — basename → [basenames que o referenciam] */
  const backward = new Map();

  for (const name of knownNames) {
    forward.set(name, new Set());
    backward.set(name, new Set());
  }

  for (const filePath of files) {
    const selfName = path.basename(filePath);
    const refs = extractRefs(filePath, knownNames);
    for (const ref of refs) {
      forward.get(selfName).add(ref);
      backward.get(ref).add(selfName);
    }
  }

  return { forward, backward };
}

// ─── 4. Gerar bloco auto-gerado ────────────────────────────────────────────

function buildBlock(selfName, forward, backward) {
  const refs = [...(forward.get(selfName) || [])].sort();
  const refdBy = [...(backward.get(selfName) || [])].sort();

  const refsSection =
    refs.length > 0
      ? refs.map((r) => `- ${r}`).join('\n')
      : '_nenhuma referência explícita_';

  const refdBySection =
    refdBy.length > 0
      ? refdBy.map((r) => `- ${r}`).join('\n')
      : '_não referenciado por nenhum arquivo mapeado_';

  return (
    `${AUTO_START}\n` +
    `### Referencia\n${refsSection}\n\n` +
    `### Referenciado por\n${refdBySection}\n` +
    `${AUTO_END}`
  );
}

// ─── 5. Injetar no arquivo ─────────────────────────────────────────────────

function injectIntoFile(filePath, block) {
  let content = fs.readFileSync(filePath, 'utf-8');

  const sectionPattern = new RegExp(
    `## 🔗 Referencias\\s*\\n${AUTO_START}[\\s\\S]*?${AUTO_END}`,
    'g'
  );

  const fullSection = `## 🔗 Referencias\n${block}`;

  if (sectionPattern.test(content)) {
    // Substituir seção existente
    content = content.replace(sectionPattern, fullSection);
  } else {
    // Remover trailing whitespace e adicionar seção nova
    content = content.trimEnd() + SECTION_HEADER + block;
  }

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

// ─── 6. Main ───────────────────────────────────────────────────────────────

function main() {
  console.log(`docs-link.mjs — ${DRY_RUN ? 'DRY RUN' : 'WRITE MODE'}\n`);

  const files = collectMdFiles(SCAN_DIRS);
  console.log(`Arquivos encontrados: ${files.length}`);

  const { forward, backward } = buildGraph(files);

  let changed = 0;
  for (const filePath of files) {
    const selfName = path.basename(filePath);
    const block = buildBlock(selfName, forward, backward);
    injectIntoFile(filePath, block);
    changed++;
  }

  console.log(`Arquivos processados: ${changed}`);
  if (DRY_RUN) {
    console.log('(dry-run: nenhum arquivo foi modificado)');
  }

  // Resumo do grafo
  const totalRefs = [...forward.values()].reduce((acc, s) => acc + s.size, 0);
  console.log(`\nTotal de referências mapeadas: ${totalRefs}`);

  // Arquivos mais referenciados
  const ranked = [...backward.entries()]
    .map(([name, refs]) => ({ name, count: refs.size }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (ranked.length > 0) {
    console.log('\nTop 10 mais referenciados:');
    for (const { name, count } of ranked) {
      console.log(`  ${count.toString().padStart(3)}x  ${name}`);
    }
  }

  if (EXPORT) {
    exportGraph(forward, backward);
  }
}

// ─── 7. Exportar graph.json ────────────────────────────────────────────────

function exportGraph(forward, backward) {
  const nodes = [];
  const links = [];
  const seen = new Set();

  for (const [name, refs] of forward.entries()) {
    const inDegree = (backward.get(name) || new Set()).size;
    const outDegree = refs.size;

    if (!seen.has(name)) {
      nodes.push({ id: name, inDegree, outDegree });
      seen.add(name);
    }

    for (const target of refs) {
      links.push({ source: name, target });
    }
  }

  // Ordenar nodes por inDegree desc (mais referenciados primeiro)
  nodes.sort((a, b) => b.inDegree - a.inDegree);

  const graph = { nodes, links };
  const outPath = path.join(ROOT, 'docs', 'graph.json');

  if (!DRY_RUN) {
    fs.writeFileSync(outPath, JSON.stringify(graph, null, 2), 'utf-8');
    console.log(`\ngraph.json exportado → ${outPath}`);
    console.log(`  nodes: ${nodes.length}`);
    console.log(`  links: ${links.length}`);
  } else {
    console.log(`\n[dry-run] graph.json seria gerado em: ${outPath}`);
    console.log(`  nodes: ${nodes.length}, links: ${links.length}`);
  }
}

main();
