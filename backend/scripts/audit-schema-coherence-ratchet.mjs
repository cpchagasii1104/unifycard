#!/usr/bin/env node
// backend/scripts/audit-schema-coherence-ratchet.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (criado 2026-07-31, GO Clayton — F-SCHEMA-COHERENCE-RATCHET)
// ║ NORMA:   decomposição docs/04_audit/DECOMPOSICAO_SCHEMA_COHERENCE_2026-07-30.md
// ║ NÃO:     relaxar o gate subjacente para "caber"; nem consertar violação aqui
// ║ EM VEZ:  congelar a baseline de hoje e SÓ DESCER — item novo = FAIL
// ╚════════════════════════════════════════════════════════════════
//
// O gate `validate-schema-code-coherence.mjs` existe desde o PLAN, mede certo
// (após 3 rodadas de conserto de parser: `01c54f53e`, `25aa17223`), esteve
// VERMELHO com ~1800 violações e FORA do runner e do CI — ninguém o lia. Em
// 2026-07-30 a direção redescobriu à mão (rides, reporting, alerts...) o que
// ele já listava. Este ratchet o religa SEM esperar zerar: congela a baseline
// de hoje por chave estável e entra verde no runner, ficando vermelho para
// qualquer violação NOVA — o mesmo padrão de
// `audit-query-param-boundary-validation.mjs` (`705711d19`), incluindo a
// lição da v1 daquele guard: OS TETOS SÃO COMPARADOS, NÃO SÓ IMPRESSOS.
//
// TETOS SEPARADOS (mandato explícito — um número agregado deixaria alguém
// "melhorar o número" mexendo em harness de e2e enquanto o BLOCKER-vivo
// cresce). Os 6 buckets = severidade × superfície (vivo = fora de
// backend/src/scripts/; scripts = harness/e2e/seed, não superfície de
// runtime):
const CEILINGS = {
  'BLOCKER-vivo': 260,     // escrita em tabela ausente, código vivo — O que precisa cair primeiro
  'BLOCKER-scripts': 105,  // escrita em tabela ausente, harness
  'CORRUPTOR-vivo': 364,   // leitura decisória / fronteira de módulo, código vivo
  'CORRUPTOR-scripts': 1047,
  'DEBT-vivo': 32,         // não falha o gate subjacente, mas ratcheteia igual
  'DEBT-scripts': 18,
};
// ⚠️ Nota de reconciliação com a medição do mandato (376/271/105): a medição
// de Clayton foi anterior às fatias do MESMO DIA (rides 501 `f0bddb25e` etc.).
// No momento do congelamento a medição de 1ª mão deu 365 BLOCKER (260 vivo +
// 105 scripts) — 11 a menos no vivo, zero de diferença nos scripts. Os tetos
// congelam a medição REAL do momento do congelamento, não a do mandato.
//
// REGRAS (idênticas ao padrão query-param-boundary, corrigido):
//   1. Chave detectada que NÃO está na baseline → FAIL (violação nova).
//   2. Contagem de uma chave MAIOR que a da baseline → FAIL (a mesma
//      violação multiplicou no mesmo arquivo).
//   3. Qualquer bucket detectado > teto, OU qualquer bucket da baseline >
//      teto → FAIL — comparado dos DOIS lados, mesmo que código e baseline
//      batam ponto-a-ponto entre si (a lacuna da v1 do query-param).
//   4. Chave da baseline ausente do código, ou contagem que CAIU, sem a
//      baseline/tetos terem sido baixados → FAIL com instrução de
//      regeneração — para a primeira queima não travar o runner pra sempre.
//      Regenerar: `node scripts/audit-schema-coherence-ratchet.mjs
//      --write-baseline` (RECUSA se qualquer bucket tiver crescido) e baixar
//      os CEILINGS acima no MESMO commit.
//
// A baseline vive em `schema-coherence-ratchet-baseline.json` (1188 chaves —
// grande demais para inline). Inflar o JSON sem consertar nada não passa: o
// bucket da baseline estoura o teto daqui (regra 3), e a chave nova sem
// código correspondente cai na regra 4.

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASELINE_PATH = path.join(__dirname, 'schema-coherence-ratchet-baseline.json');
const GATE_PATH = path.join(__dirname, '../../scripts/validate-schema-code-coherence.mjs');
const WRITE_MODE = process.argv.includes('--write-baseline');

// ============================================================================
// 1. Roda o gate subjacente com --json (o exit 1 dele é ESPERADO — quem julga
//    agora é o ratchet; o gate continua rodável avulso com a régua original).
// ============================================================================
const tmpJson = path.join(__dirname, `.schema-coherence-scan-${process.pid}.json`);
const run = spawnSync('node', [GATE_PATH, `--json=${tmpJson}`], {
  cwd: path.join(__dirname, '..'),
  encoding: 'utf-8',
  timeout: 300000,
});
if (!fs.existsSync(tmpJson)) {
  console.error('❌ RATCHET — o gate subjacente não produziu o JSON (falha de execução real, não violação):');
  console.error((run.stderr || run.stdout || '').slice(-2000));
  process.exit(1);
}
const items = JSON.parse(fs.readFileSync(tmpJson, 'utf-8'));
fs.unlinkSync(tmpJson);

// ============================================================================
// 2. Agrega por chave estável: arquivo::tabela::padrão::severidade::superfície
//    (linha NÃO entra na chave — robusto a deslocamento por edição alheia).
// ============================================================================
function toKey(v) {
  const file = String(v.file).replace(/\\/g, '/').replace(/.*backend\/src\//, '');
  return `${file}::${v.name ?? v.type}::${v.pattern ?? v.type}::${v.severity}::${v.inScripts ? 'scripts' : 'vivo'}`;
}
const detectedKeys = new Map();
const detectedBuckets = { 'BLOCKER-vivo': 0, 'BLOCKER-scripts': 0, 'CORRUPTOR-vivo': 0, 'CORRUPTOR-scripts': 0, 'DEBT-vivo': 0, 'DEBT-scripts': 0 };
for (const v of items) {
  const key = toKey(v);
  detectedKeys.set(key, (detectedKeys.get(key) || 0) + 1);
  const bucket = `${v.severity}-${v.inScripts ? 'scripts' : 'vivo'}`;
  if (bucket in detectedBuckets) detectedBuckets[bucket] += 1;
}

// ============================================================================
// 3. --write-baseline: regenera o JSON APÓS UM CONSERTO REAL. Recusa crescer.
// ============================================================================
if (WRITE_MODE) {
  const old = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));
  const grew = Object.keys(detectedBuckets).filter((b) => detectedBuckets[b] > (old.buckets[b] ?? 0));
  if (grew.length > 0) {
    console.error(`❌ --write-baseline RECUSADO: bucket(s) CRESCERAM vs baseline atual: ${grew.map((b) => `${b} ${old.buckets[b]}→${detectedBuckets[b]}`).join(' · ')}. Regenerar baseline só é permitido quando a contagem DESCE (conserto real). Conserte a(s) violação(ões) nova(s) primeiro.`);
    process.exit(1);
  }
  const sorted = {};
  for (const k of [...detectedKeys.keys()].sort()) sorted[k] = detectedKeys.get(k);
  fs.writeFileSync(BASELINE_PATH, JSON.stringify({ _comment: old._comment, generatedAt: new Date().toISOString().slice(0, 10), buckets: detectedBuckets, keys: sorted }, null, 1) + '\n');
  console.log(`✅ baseline regenerada: ${detectedKeys.size} chaves · buckets ${JSON.stringify(detectedBuckets)}`);
  console.log(`⚠️ AGORA baixe os CEILINGS em audit-schema-coherence-ratchet.mjs para os valores acima, no MESMO commit — sem isso o guard falha (regra 3/4).`);
  process.exit(0);
}

// ============================================================================
// 4. Comparação — código × baseline × tetos (os três, não dois)
// ============================================================================
const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));
const errors = [];
let shrunk = false;

for (const [key, count] of detectedKeys) {
  const base = baseline.keys[key];
  if (base === undefined) {
    errors.push(`❌ VIOLAÇÃO NOVA (chave fora da baseline): ${key} (${count}x). Conserte — não adicione à baseline.`);
  } else if (count > base) {
    errors.push(`❌ VIOLAÇÃO MULTIPLICOU: ${key} — baseline ${base}x, código ${count}x.`);
  } else if (count < base) {
    shrunk = true;
  }
}
for (const key of Object.keys(baseline.keys)) {
  if (!detectedKeys.has(key)) shrunk = true;
}

for (const bucket of Object.keys(CEILINGS)) {
  if (detectedBuckets[bucket] > CEILINGS[bucket]) {
    errors.push(`❌ TETO ESTOURADO (código): ${bucket} = ${detectedBuckets[bucket]} > teto ${CEILINGS[bucket]}. A contagem deste bucket só pode DESCER.`);
  }
  if ((baseline.buckets[bucket] ?? 0) > CEILINGS[bucket]) {
    errors.push(`❌ TETO ESTOURADO (baseline): ${bucket} = ${baseline.buckets[bucket]} no JSON > teto ${CEILINGS[bucket]}. Inflar a baseline não passa — o teto vive no guard e é comparado.`);
  }
}

if (errors.length === 0 && shrunk) {
  errors.push(`❌ BASELINE DESATUALIZADA PARA BAIXO: a contagem real caiu (alguém consertou — ótimo), mas a baseline ainda registra o número antigo. Rode \`node scripts/audit-schema-coherence-ratchet.mjs --write-baseline\` e baixe os CEILINGS no guard para ${JSON.stringify(detectedBuckets)}, no MESMO commit.`);
}

// ============================================================================
// 5. Saída — os 6 números por extenso em TODA corrida, verde ou vermelha
// ============================================================================
const scoreboard = Object.keys(CEILINGS)
  .map((b) => `${b} ${detectedBuckets[b]}/${CEILINGS[b]}`)
  .join(' · ');

if (errors.length > 0) {
  console.error('='.repeat(80));
  console.error('❌ GATE — SCHEMA-COHERENCE RATCHET: FALHOU');
  console.error('='.repeat(80));
  errors.slice(0, 25).forEach((e) => console.error(e));
  if (errors.length > 25) console.error(`  ... e mais ${errors.length - 25} (todas as chaves são impressas por extenso, sem corte, acima do limite de 25 só desta mensagem — rode o gate subjacente com --json para a lista integral)`);
  console.error('');
  console.error(`Placar: ${scoreboard}`);
  process.exit(1);
} else {
  console.log(`✅ GATE OK [schema-coherence-ratchet] — ${scoreboard} · ${detectedKeys.size} chaves congeladas (baseline ${baseline.generatedAt}) · violação nova = FAIL · contagem só desce.`);
  process.exit(0);
}
