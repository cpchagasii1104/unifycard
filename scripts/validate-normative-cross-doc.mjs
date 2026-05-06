#!/usr/bin/env node
/**
 * Validação cross-doc: lei ↔ protocolo ↔ SSOT §5.16 ↔ vocabulário ↔ contracts (fonte TS).
 *
 * Objetivo: impedir drift silencioso entre documentos normativos e listas fechadas em código.
 * Não substitui revisão humana; complementa CI com invariantes explícitos.
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const NORM = join(ROOT, 'docs', '01_normative');
const VOCAB_DIR = join(ROOT, 'packages', 'contracts', 'src', 'vocabulary');

const PATHS = {
  lei: join(NORM, 'LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md'),
  protocol: join(NORM, '00_AGENT_PROTOCOL.md'),
  ssot: join(NORM, 'SSOT_REGISTRY_UNIFICARD.md'),
  vocabMd: join(NORM, 'VOCABULARIO_CANONICO_UNIFICARD.md'),
};

function read(p) {
  if (!existsSync(p)) {
    throw new Error(`Ficheiro em falta: ${p}`);
  }
  return readFileSync(p, 'utf8');
}

/** Extrai literais de `export const Name = [ 'a', ... ] as const` (uma ocorrência). */
function parseTsStringConst(source, constName) {
  const re = new RegExp(
    `export const ${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`,
    'm',
  );
  const m = source.match(re);
  if (!m) {
    throw new Error(`Não encontrado export const ${constName} = [ ... ] as const`);
  }
  const inner = m[1];
  const vals = [...inner.matchAll(/'([^']*)'/g)].map((x) => x[1]);
  if (vals.length === 0) {
    throw new Error(`Array vazio ou formato inesperado em ${constName}`);
  }
  return vals;
}

/** Bullets `* valor` após um cabeçalho ### até o próximo `---` ou ### / ##. */
function extractVocabBullets(md, headerLine) {
  const idx = md.indexOf(headerLine);
  if (idx === -1) {
    throw new Error(`Secção não encontrada em VOCABULARIO: ${headerLine}`);
  }
  const rest = md.slice(idx + headerLine.length);
  const stop = rest.search(/\n---\n|\n### |\n## /);
  const block = stop === -1 ? rest : rest.slice(0, stop);
  const bullets = [...block.matchAll(/^\* ([^\n]+)$/gm)].map((x) => x[1].trim());
  if (bullets.length === 0) {
    throw new Error(`Sem bullets * em ${headerLine}`);
  }
  return bullets;
}

function sameSet(a, b, label) {
  const sa = [...a].sort().join('\n');
  const sb = [...b].sort().join('\n');
  if (sa !== sb) {
    throw new Error(
      `${label}: divergência.\n  contracts: ${[...a].sort().join(', ')}\n  documento: ${[...b].sort().join(', ')}`,
    );
  }
}

function mustContain(label, text, needle) {
  if (!text.includes(needle)) {
    throw new Error(`${label}: texto obrigatório em falta: ${JSON.stringify(needle)}`);
  }
}

function main() {
  const lei = read(PATHS.lei);
  const protocol = read(PATHS.protocol);
  const ssot = read(PATHS.ssot);
  const vocabMd = read(PATHS.vocabMd);

  // --- Remissões lei ↔ protocolo (§7 / §7.1 ↔ 2.2.8 / 2.3.2) ---
  mustContain('LEI §7', lei, '# 7. REGRA DE COMPOSIÇÃO SISTÊMICA');
  mustContain('LEI §7', lei, 'SEMÂNTICA (CONCEPT)');
  mustContain('LEI §7.1', lei, '## 7.1 COMPATIBILIDADE COM O PROTOCOLO OPERACIONAL');
  mustContain('LEI §7.1', lei, '00_AGENT_PROTOCOL.md');
  mustContain('LEI §7.1', lei, '2.3.2');
  mustContain('LEI §7.1', lei, 'subconjunto');
  mustContain('LEI §15', lei, '# 15. INTEGRAÇÃO OPERACIONAL');
  mustContain('LEI §15', lei, '2.3.2');
  mustContain('LEI §15', lei, '7.1');

  mustContain('Protocolo 2.2.8', protocol, '### 2.2.8 VALIDAÇÃO DE COERÊNCIA SISTÊMICA');
  mustContain('Protocolo 2.2.8 camada', protocol, '#### 0. Identificação de camada');
  mustContain('Protocolo 2.2.8', protocol, 'LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md');
  mustContain('Protocolo 2.2.8 §7.1', protocol, '§**7.1**');
  mustContain('Protocolo GATE 2.3.2', protocol, '### 2.3.2 GATE OBRIGATÓRIO');
  mustContain('Protocolo causal', protocol, 'Mutation → Estado → Dinheiro → Evento');
  mustContain('Protocolo exceção bootstrap', protocol, 'Exceção controlada — tarefas não estruturais');

  mustContain('LEI desambiguação event', lei, '### 3.1.2 Desambiguação de `event`');

  // --- SSOT §5.16 ↔ vocabulário ↔ contracts ---
  mustContain('SSOT §5.16', ssot, '## 5.16 SSOT');
  mustContain('SSOT §5.16', ssot, 'canonical_vocabulary');
  mustContain('SSOT §5.16', ssot, 'VOCABULARIO_CANONICO_UNIFICARD.md');
  mustContain('SSOT §5.16', ssot, '@unificard/contracts');
  mustContain('SSOT §5.16 locale', ssot, 'locale.bcp47');
  mustContain('SSOT §5.16', ssot, 'vocabulary/locale.ts');

  mustContain('VOCABULARIO → SSOT', vocabMd, 'SSOT_REGISTRY_UNIFICARD.md');
  mustContain('VOCABULARIO §5.16', vocabMd, '§5.16');

  // --- Vocabulário MD ↔ TS (listas fechadas) ---
  const domains = [
    { header: '### 6.1 GENDER', file: 'gender.ts', constName: 'GENDER_VALUES' },
    { header: '### 6.2 LANGUAGE', file: 'language.ts', constName: 'LANGUAGE_VALUES' },
    { header: '### 6.3 LOCALE', file: 'locale.ts', constName: 'LOCALE_VALUES' },
    { header: '### 6.4 COUNTRY', file: 'country.ts', constName: 'COUNTRY_VALUES' },
    { header: '### 6.5 CURRENCY', file: 'currency.ts', constName: 'CURRENCY_VALUES' },
    { header: '### 6.6 TIMEZONE', file: 'timezone.ts', constName: 'TIMEZONE_VALUES' },
  ];

  for (const d of domains) {
    const tsPath = join(VOCAB_DIR, d.file);
    const ts = read(tsPath);
    const fromTs = parseTsStringConst(ts, d.constName);
    const fromMd = extractVocabBullets(vocabMd, d.header);
    sameSet(fromTs, fromMd, `${d.constName} ↔ ${d.header}`);
  }

  // --- Cabeçalhos mínimos (estrutura sistémica na lei) ---
  mustContain('LEI §3.1', lei, '## 3.1 PILARES');
  mustContain('LEI §3.2', lei, '## 3.2 SSOT');
  mustContain('LEI §3.3', lei, '## 3.3 CORE IMUTÁVEL');
  mustContain('LEI §3.4', lei, '## 3.4 MÓDULOS');
  mustContain('LEI §3.5', lei, '## 3.5 NAVEGAÇÃO');

  console.log('validate-normative-cross-doc: OK (lei, protocolo, SSOT §5.16, vocabulário, contracts alinhados).');
}

try {
  main();
} catch (e) {
  console.error('validate-normative-cross-doc: FALHA');
  console.error(e.message || e);
  process.exit(1);
}
