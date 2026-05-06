#!/usr/bin/env node
/**
 * docs-health.mjs
 *
 * Lê docs/graph.json e docs/01_normative/00_INDEX.md,
 * e emite um relatório de saúde estrutural do sistema normativo.
 *
 * Seções do relatório:
 *   1. Visão geral
 *   2. Top 10 mais referenciados (alta criticidade)
 *   3. Top 10 mais dependentes (alto acoplamento)
 *   4. Documentos órfãos (inDegree=0 e outDegree=0)
 *   5. Documentos isolados de saída (outDegree=0, mas referenciados)
 *   6. Inconsistência com 00_INDEX.md (arquivos sem status declarado)
 *   7. Alertas de risco estrutural
 *
 * Uso:
 *   node scripts/docs-health.mjs              → relatório no terminal
 *   node scripts/docs-health.mjs --json       → saída em JSON
 *   node scripts/docs-health.mjs --update-sumario  → atualiza Top 20 no 00_SUMARIO.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const GRAPH_PATH = path.join(ROOT, 'docs', 'graph.json');
const INDEX_PATH = path.join(ROOT, 'docs', '01_normative', '00_INDEX.md');
const SUMARIO_PATH = path.join(ROOT, 'docs', '01_normative', '00_SUMARIO.md');

const JSON_MODE = process.argv.includes('--json');
const UPDATE_SUMARIO = process.argv.includes('--update-sumario');

// Arquivos de infraestrutura que nunca devem aparecer em alertas de órfão
const INFRA_FILES = new Set(['00_INDEX.md', '00_SUMARIO.md']);

// Status que indicam arquivo fora de operação (não alertar como órfão crítico)
const INACTIVE_STATUS = new Set(['LEGADO', 'NON-NORMATIVE', 'PROPOSTO · NÃO VIGENTE', 'RASCUNHO', 'PLANEJAMENTO']);

// ─── Carregar dados ────────────────────────────────────────────────────────

function loadGraph() {
  if (!fs.existsSync(GRAPH_PATH)) {
    console.error(`graph.json não encontrado. Rode primeiro: npm run docs:export`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf-8'));
}

function loadIndex() {
  if (!fs.existsSync(INDEX_PATH)) return new Map();

  const content = fs.readFileSync(INDEX_PATH, 'utf-8');
  const statusMap = new Map(); // basename → status

  for (const line of content.split('\n')) {
    // Linha de tabela: | arquivo.md | STATUS | ... |
    const match = line.match(/^\|\s*([A-Za-z0-9][A-Za-z0-9_\-]*\.md)\s*\|\s*([^|]+?)\s*\|/);
    if (match) {
      statusMap.set(match[1], match[2].trim());
    }
  }

  return statusMap;
}

// ─── Análises ──────────────────────────────────────────────────────────────

function analyze(graph, statusMap) {
  const { nodes, links } = graph;

  // Recomputar graus a partir dos links (mais confiável que o json)
  const inDegree = new Map();
  const outDegree = new Map();
  for (const { id } of nodes) {
    inDegree.set(id, 0);
    outDegree.set(id, 0);
  }
  for (const { source, target } of links) {
    outDegree.set(source, (outDegree.get(source) || 0) + 1);
    inDegree.set(target, (inDegree.get(target) || 0) + 1);
  }

  // Peso de arestas: quantas vezes source → target
  const edgeWeight = new Map();
  for (const { source, target } of links) {
    const key = `${source}→${target}`;
    edgeWeight.set(key, (edgeWeight.get(key) || 0) + 1);
  }

  // Top 10 mais referenciados (inDegree)
  const topReferenced = [...inDegree.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ id, inDegree: count, outDegree: outDegree.get(id) || 0, status: statusMap.get(id) || '—' }));

  // Top 10 mais dependentes (outDegree)
  const topDependent = [...outDegree.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ id, outDegree: count, inDegree: inDegree.get(id) || 0, status: statusMap.get(id) || '—' }));

  // Órfãos completos (sem entrada E sem saída)
  const orphans = nodes
    .filter(({ id }) => !INFRA_FILES.has(id) && inDegree.get(id) === 0 && outDegree.get(id) === 0)
    .map(({ id }) => ({ id, status: statusMap.get(id) || '—' }));

  const orphansCritical = orphans.filter(({ status }) => !INACTIVE_STATUS.has(status));
  const orphansInactive = orphans.filter(({ status }) => INACTIVE_STATUS.has(status));

  // Terminais (referenciados mas não referenciam ninguém — potencial silo)
  const terminals = nodes
    .filter(({ id }) => !INFRA_FILES.has(id) && inDegree.get(id) > 0 && outDegree.get(id) === 0)
    .map(({ id }) => ({ id, inDegree: inDegree.get(id), status: statusMap.get(id) || '—' }))
    .sort((a, b) => b.inDegree - a.inDegree);

  // Arquivos no índice mas ausentes do grafo
  const graphIds = new Set(nodes.map(({ id }) => id));
  const missingFromGraph = [...statusMap.keys()].filter(
    (id) => !graphIds.has(id) && !INFRA_FILES.has(id)
  );

  // Arquivos no grafo mas ausentes do índice
  const missingFromIndex = nodes
    .map(({ id }) => id)
    .filter((id) => !statusMap.has(id) && !INFRA_FILES.has(id));

  // Alertas de risco
  const risks = [];

  // Risco 1: arquivo ativo com inDegree > 30 — ponto único de falha
  for (const { id, inDegree: deg } of topReferenced) {
    if (deg >= 30 && !INACTIVE_STATUS.has(statusMap.get(id) || '')) {
      risks.push({ level: 'CRÍTICO', file: id, reason: `${deg} arquivos dependem deste — mudança aqui propaga amplamente` });
    }
  }

  // Risco 2: arquivo ativo com outDegree > 15 — acoplador excessivo
  // (exclui arquivos de infraestrutura como INDEX e SUMARIO que listam refs por design)
  for (const { id, outDegree: deg } of topDependent) {
    if (deg >= 15 && !INACTIVE_STATUS.has(statusMap.get(id) || '') && !INFRA_FILES.has(id)) {
      risks.push({ level: 'ATENÇÃO', file: id, reason: `Referencia ${deg} arquivos — alto acoplamento de leitura` });
    }
  }

  // Risco 3: órfãos críticos ativos
  for (const { id } of orphansCritical) {
    risks.push({ level: 'ATENÇÃO', file: id, reason: 'Nenhuma referência de entrada ou saída — doc isolado sem conexão ao grafo' });
  }

  // Risco 4: ausentes do índice
  for (const id of missingFromIndex.slice(0, 5)) {
    risks.push({ level: 'INFO', file: id, reason: 'Existe no sistema mas não consta no 00_INDEX.md' });
  }

  return {
    stats: {
      totalNodes: nodes.length,
      totalLinks: links.length,
      avgInDegree: (links.length / nodes.length).toFixed(2),
    },
    topReferenced,
    topDependent,
    orphansCritical,
    orphansInactive,
    terminals,
    missingFromGraph,
    missingFromIndex,
    risks,
  };
}

// ─── Formatação terminal ───────────────────────────────────────────────────

const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

function pad(s, n) { return String(s).padEnd(n); }
function rpad(s, n) { return String(s).padStart(n); }

function printReport(result) {
  const { stats, topReferenced, topDependent, orphansCritical, orphansInactive, terminals, missingFromGraph, missingFromIndex, risks } = result;

  console.log('');
  console.log(BOLD('══════════════════════════════════════════════════════'));
  console.log(BOLD('  docs-health — Relatório de Saúde Estrutural'));
  console.log(BOLD('══════════════════════════════════════════════════════'));
  console.log('');

  // ── Visão geral
  console.log(BOLD('▸ Visão Geral'));
  console.log(`  Arquivos mapeados : ${stats.totalNodes}`);
  console.log(`  Referências reais : ${stats.totalLinks}`);
  console.log(`  Média inDegree    : ${stats.avgInDegree}`);
  console.log('');

  // ── Top referenciados
  console.log(BOLD('▸ Top 10 — Mais Referenciados (criticidade)'));
  console.log(DIM(`  ${'arquivo'.padEnd(55)} ${'in'.padStart(4)} ${'out'.padStart(4)}  status`));
  for (const { id, inDegree, outDegree, status } of topReferenced) {
    const flag = inDegree >= 30 ? RED('●') : inDegree >= 10 ? YELLOW('●') : GREEN('●');
    console.log(`  ${flag} ${pad(id, 53)} ${rpad(inDegree, 4)} ${rpad(outDegree, 4)}  ${DIM(status)}`);
  }
  console.log('');

  // ── Top dependentes
  console.log(BOLD('▸ Top 10 — Mais Dependentes (acoplamento)'));
  console.log(DIM(`  ${'arquivo'.padEnd(55)} ${'out'.padStart(4)} ${'in'.padStart(4)}  status`));
  for (const { id, outDegree, inDegree, status } of topDependent) {
    const flag = outDegree >= 15 ? RED('●') : outDegree >= 8 ? YELLOW('●') : GREEN('●');
    console.log(`  ${flag} ${pad(id, 53)} ${rpad(outDegree, 4)} ${rpad(inDegree, 4)}  ${DIM(status)}`);
  }
  console.log('');

  // ── Órfãos críticos
  if (orphansCritical.length > 0) {
    console.log(BOLD('▸ Documentos Órfãos — Ativos sem conexão ⚠'));
    for (const { id, status } of orphansCritical) {
      console.log(`  ${RED('✖')} ${id}  ${DIM(status)}`);
    }
    console.log('');
  }

  // ── Órfãos inativos
  if (orphansInactive.length > 0) {
    console.log(BOLD('▸ Documentos Órfãos — Inativos (ok)'));
    for (const { id, status } of orphansInactive) {
      console.log(`  ${DIM('○')} ${id}  ${DIM(status)}`);
    }
    console.log('');
  }

  // ── Terminais
  if (terminals.length > 0) {
    console.log(BOLD(`▸ Documentos Terminais — referenciados mas não referenciam (${terminals.length})`));
    for (const { id, inDegree, status } of terminals.slice(0, 10)) {
      console.log(`  ${DIM('→')} ${pad(id, 53)} ${DIM(`in:${inDegree}`)}  ${DIM(status)}`);
    }
    if (terminals.length > 10) console.log(DIM(`  … e mais ${terminals.length - 10}`));
    console.log('');
  }

  // ── Ausentes do índice
  if (missingFromIndex.length > 0) {
    console.log(BOLD(`▸ Fora do 00_INDEX.md (${missingFromIndex.length} arquivos)`));
    for (const id of missingFromIndex) {
      console.log(`  ${YELLOW('?')} ${id}`);
    }
    console.log('');
  }

  // ── Riscos
  console.log(BOLD('▸ Alertas de Risco'));
  if (risks.length === 0) {
    console.log(`  ${GREEN('✔')} Nenhum risco estrutural detectado.`);
  } else {
    for (const { level, file, reason } of risks) {
      const color = level === 'CRÍTICO' ? RED : level === 'ATENÇÃO' ? YELLOW : DIM;
      console.log(`  ${color(`[${level}]`)} ${file}`);
      console.log(`          ${DIM(reason)}`);
    }
  }
  console.log('');
  console.log(BOLD('══════════════════════════════════════════════════════'));
  console.log('');
}

// ─── Atualizar Top 20 no 00_SUMARIO.md ────────────────────────────────────

function updateSumario(topReferenced) {
  if (!fs.existsSync(SUMARIO_PATH)) {
    console.warn('00_SUMARIO.md não encontrado — pulando update.');
    return;
  }

  const top20Lines = topReferenced.slice(0, 20).map(({ id, inDegree, status }, i) => {
    const desc = `inDegree: ${inDegree}`;
    return `| ${String(i + 1).padStart(2)} | ${pad(id, 55)} | ${pad(status, 35)} | ${desc} |`;
  });

  const header = [
    '| # | Arquivo | Status | Métrica |',
    '|---|---------|--------|---------|',
  ];

  const block = [...header, ...top20Lines].join('\n');
  const START = '<!-- TOP20-AUTO-START -->';
  const END = '<!-- TOP20-AUTO-END -->';

  let content = fs.readFileSync(SUMARIO_PATH, 'utf-8');

  if (content.includes(START)) {
    content = content.replace(
      new RegExp(`${START}[\\s\\S]*?${END}`),
      `${START}\n${block}\n${END}`
    );
  } else {
    // Encontrar seção "Top 20" e substituir a tabela estática
    content = content.replace(
      /(\| # \| Arquivo \|[\s\S]*?)(?=\n##|\n---|\n$)/,
      `${START}\n${block}\n${END}`
    );
  }

  fs.writeFileSync(SUMARIO_PATH, content, 'utf-8');
  console.log(`00_SUMARIO.md atualizado com Top ${Math.min(20, topReferenced.length)} por inDegree.`);
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  const graph = loadGraph();
  const statusMap = loadIndex();

  // Enriquecer grafo com status do índice
  const enriched = {
    ...graph,
    nodes: graph.nodes.map((n) => ({ ...n, status: statusMap.get(n.id) || '—' })),
  };

  const result = analyze(enriched, statusMap);

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printReport(result);

  if (UPDATE_SUMARIO) {
    // Ordenar por inDegree para o Top 20
    const byInDegree = [...graph.nodes]
      .map(({ id }) => ({
        id,
        inDegree: result.topReferenced.find((n) => n.id === id)?.inDegree ?? 0,
        status: statusMap.get(id) || '—',
      }))
      .sort((a, b) => b.inDegree - a.inDegree);

    updateSumario(byInDegree);
  }
}

main();
