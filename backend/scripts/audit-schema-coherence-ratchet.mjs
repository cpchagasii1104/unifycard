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
// TETOS POR CONDIÇÃO (F-SCHEMA-COHERENCE-TRUTH, 2026-07-31): a v1 destes
// tetos era severidade × superfície — e `BLOCKER-vivo=260` misturava DUAS
// doenças (achado de Clayton, `bbfc238f3` corrigido): tabela FANTASMA
// (Condição 1 — a tabela não existe) e FRONTEIRA bank_*/actors (Condições
// 3/4/5 — a tabela EXISTE; o acesso é que está fora do módulo autorizado;
// violação de AUTORIDADE, outro remédio). 64% do total era fronteira sendo
// lida como fantasma. Tetos agora por CONDIÇÃO × direção × superfície; o
// gate subjacente exporta `condition` no --json (campo aditivo).
// Direção por OPERAÇÃO, não por severidade: C5 (INSERT em actors) é
// CORRUPTOR na régua do gate mas é ESCRITA — entra em BOUNDARY-WRITE.
const CEILINGS = {
  // 2026-07-31 F-BANK-RECONCILIATION-RELINK: religado bank_reconciliation_history
  // (schema-ghost) ao SSOT canônico (reconciliation_runs/reconciliation_ledger_discrepancies);
  // arquivo dormente allowlistado (DT-BANK-RECONCILIATION-HISTORY-DORMANT). 1º descida
  // desde que os tetos existem: WRITE 260→259 (1 INSERT), READ 355→353 (2 FROM).
  // 258→253 em 2026-08-04 (F-NOTIFY-QUEUE-MATERIALIZE): `notify_queue` existia no CÓDIGO inteiro
  // (service/worker/processor) e NÃO no banco. Materializá-la matou 8 referências-fantasma de uma vez.
  'GHOST-WRITE-vivo': 253,      // Cond.1 escrita em tabela ausente, código vivo — o que cai primeiro
  'GHOST-WRITE-scripts': 5,
  // 345→344 em 2026-08-04 (F-EVENT-RSVP-RELINK): `event-rsvp.service.ts` lia `event_rsvp_counts`,
  // tabela que NUNCA existiu (pré-gênesis) — a contagem passou a sair da agregação de `event_rsvp`,
  // que é real. Descida por CONSERTO, não por allowlist.
  'GHOST-READ-vivo': 341,  // 349→345 em 2026-08-03: business_audit_logs MATERIALIZADA (a trilha de compliance escrevia numa tabela ausente, 40 call sites, 42P01 engolido) · 353→349 em 2026-08-02: getStats+getPenalties reescritos sobre tabelas REAIS (event_participants e actor_penalties eram fantasmas) — 1ª descida do teto grande por CONSERTO       // Cond.1 leitura (CORRUPTOR 323 + DEBT 32)
  'GHOST-READ-scripts': 27,     // (CORRUPTOR 9 + DEBT 18)
  'BOUNDARY-WRITE-vivo': 4,     // Cond.3 (bank_* write, 0) + Cond.5 (actors INSERT, 4)
  'BOUNDARY-WRITE-scripts': 327, // Cond.3 (100) + Cond.5 (227)
  'BOUNDARY-READ-vivo': 37,     // Cond.4 bank_* read fora do módulo
  'BOUNDARY-READ-scripts': 807,
  'METADATA-DECISION-vivo': 0,  // Cond.7
  'METADATA-DECISION-scripts': 4,
  'SCHEMA-CATCH-vivo': 0,       // Cond.6 — zero hoje; qualquer um novo = FAIL
  'SCHEMA-CATCH-scripts': 0,
  'GHOST-COLUMN-vivo': 0,       // Cond.2 — detector CEGO hoje (medição 3 do mandato);
  'GHOST-COLUMN-scripts': 0,    // se for acordado em fatia futura, ganha teto próprio LÁ
};
// Soma dos tetos = 1826 = soma dos tetos da v1 (260+105+364+1047+32+18).
// Reconciliação exata com a v1: BLOCKER 365 = GHOST-WRITE 265 + C3 100 ·
// CORRUPTOR 1411 = GHOST-READ(C) 332 + C4 844 + C5 231 + C7 4 · DEBT 50 =
// GHOST-READ(D) 50. Dupla-natureza conhecida (3 itens): bank_reconciliation_
// history (bank_* E inexistente) DENTRO de modules/bank — a fronteira passa
// (caminho autorizado), a existência pega → classificada GHOST pelo gate.
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
// 2. Agrega por chave estável: arquivo::tabela::padrão::CONDIÇÃO::severidade::
//    superfície (linha NÃO entra na chave — robusto a deslocamento).
//    A condição vem do próprio gate (campo aditivo `condition` no --json);
//    item sem condição = gate desatualizado/regressão do campo → FAIL duro.
// ============================================================================
function toBucket(v) {
  const surface = v.inScripts ? 'scripts' : 'vivo';
  switch (v.condition) {
    case 'C1-GHOST-WRITE': return `GHOST-WRITE-${surface}`;
    case 'C1-GHOST-READ':
    case 'C1-GHOST-OTHER': return `GHOST-READ-${surface}`;
    case 'C3-BANK-WRITE-BOUNDARY':
    case 'C5-ACTORS-INSERT-BOUNDARY': return `BOUNDARY-WRITE-${surface}`;
    case 'C4-BANK-READ-BOUNDARY': return `BOUNDARY-READ-${surface}`;
    case 'C7-METADATA-DECISION': return `METADATA-DECISION-${surface}`;
    case 'C6-SCHEMA-CATCH': return `SCHEMA-CATCH-${surface}`;
    case 'C2-GHOST-COLUMN': return `GHOST-COLUMN-${surface}`;
    default: return null;
  }
}
function toKey(v) {
  const file = String(v.file).replace(/\\/g, '/').replace(/.*backend\/src\//, '');
  return `${file}::${v.name ?? v.type}::${v.pattern ?? v.type}::${v.condition}::${v.severity}::${v.inScripts ? 'scripts' : 'vivo'}`;
}
const detectedKeys = new Map();
const detectedBuckets = Object.fromEntries(Object.keys(CEILINGS).map((b) => [b, 0]));
const unconditioned = [];
for (const v of items) {
  const bucket = toBucket(v);
  if (bucket === null) {
    unconditioned.push(`${v.file}:${v.line} (${v.condition ?? 'sem condition'})`);
    continue;
  }
  const key = toKey(v);
  detectedKeys.set(key, (detectedKeys.get(key) || 0) + 1);
  detectedBuckets[bucket] += 1;
}
if (unconditioned.length > 0) {
  console.error(`❌ RATCHET — ${unconditioned.length} violação(ões) SEM condição reconhecida no --json do gate (o campo aditivo 'condition' regrediu ou nasceu condição nova sem bucket aqui):`);
  unconditioned.slice(0, 10).forEach((u) => console.error('  ', u));
  process.exit(1);
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
