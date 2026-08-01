#!/usr/bin/env node
// backend/scripts/audit-doc-tag-ratchet.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (criado 2026-07-31, GO Clayton)
// ║ NORMA:   F-DOC-ENTRY-AUTHORITY (cartório) — teto de documento novo
// ║ NÃO:     exigir tarja nos 1805 documentos existentes (nasce vermelho e é desligado)
// ║ EM VEZ:  baseline congelada + documento NOVO obrigado à tarja; a contagem SÓ DESCE
// ╚════════════════════════════════════════════════════════════════
//
// POR QUE EXISTE
// Em 2026-07-31 mediu-se: QUATRO documentos disputavam ser "a entrada" do
// repositório (`00_AGENT_PROTOCOL`, `CLAUDE.md`, `AGENT_BOOTSTRAP`,
// `LEIA_ANTES_DE_TOMAR_DECISAO`), mais duas âncoras (`CORE_DOCUMENTS`,
// `00_AGENT`) e três índices concorrentes. Dois deles estavam parados desde
// jan/fev, um mandava ler 418 arquivos como "ORDEM OBRIGATÓRIA" e apontava
// para uma pasta que não existe. Nenhum declarava seu próprio papel.
// Reorganizar resolve o passado; só um TETO impede o próximo nascer.
//
// A REGRA
// Documento NOVO em `docs/` declara cinco campos, ou o gate morde:
//     **Categoria:**      normativa | operacional | histórico | auditoria
//     **Status:**         vivo | referência | histórico | obsoleto
//     **Fonte canônica:** <caminho da norma que governa, ou "este documento">
//     **Obrigatório:**    sim | não        (leitura obrigatória para operar?)
//     **Governado por:**  <quem responde por ele>
// O rótulo `**Status:**` NÃO foi inventado aqui: já é a convenção de 461
// documentos deste repositório. Os outros quatro seguem a mesma forma.
//
// POR QUE CONGELADO
// Há 1805 `.md` rastreados em `docs/`. Um gate que exigisse tarja em todos
// nasceria vermelho e seria desligado na primeira semana — foi exatamente o
// que aconteceu neste repositório com `validate-schema-code-coherence`:
// vermelho, FORA do runner e da CI, por meses, listando 644 problemas que
// ninguém lia. Aqui a baseline congela o passado e cobra só o futuro.
//
// A LIÇÃO QUE CUSTOU CARO (2026-07-31, duas vezes no mesmo dia)
// Dois guards deste repositório nasceram declarando `BASELINE_COUNT`,
// imprimindo-o na mensagem de SUCESSO, e NUNCA comparando — passavam verdes
// anunciando "a contagem só pode descer" com a contagem MAIOR. Aqui o teto é
// comparado contra a contagem real do disco, e a baseline é comparada contra
// si mesma: adicionar a chave na baseline para abafar um documento novo
// estoura o teto do mesmo jeito.
//
// Em validate:regression-guards.

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..');
const BASELINE_PATH = join(__dirname, 'doc-tag-ratchet-baseline.json');

// ============================================================================
// UNIVERSO — documentos rastreados sob docs/
// ============================================================================
// 🔴 `--others --exclude-standard` NÃO é detalhe: sem ele o gate só enxerga
// arquivo já RASTREADO, e documento novo fica invisível até alguém dar
// `git add` — ou seja, o gate morderia um commit TARDE DEMAIS. Achado
// atacando o próprio guard em 2026-07-31: a prova "documento novo sem tarja"
// passou VERDE na primeira versão. `--cached` traz os rastreados,
// `--others --exclude-standard` traz os novos que não são ignorados.
function trackedDocs() {
  const out = execSync(
    'git ls-files --cached --others --exclude-standard -- "docs/**/*.md" "docs/*.md"',
    { cwd: REPO, encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 }
  );
  return [...new Set(out.split('\n').map((l) => l.trim()).filter(Boolean))].sort();
}

// ============================================================================
// TARJA — os cinco campos, procurados no CABEÇALHO (primeiras 40 linhas)
// Fora do cabeçalho não conta: tarja que aparece no meio do documento não
// cumpre a função (quem abre o arquivo tem de ver na primeira tela).
// ============================================================================
const FIELDS = [
  { key: 'categoria', re: /^\s*>?\s*\*\*Categoria:\*\*/im },
  { key: 'status', re: /^\s*>?\s*\*\*Status:\*\*/im },
  { key: 'fonte', re: /^\s*>?\s*\*\*Fonte can[oô]nica:\*\*/im },
  { key: 'obrigatorio', re: /^\s*>?\s*\*\*Obrigat[oó]rio:\*\*/im },
  { key: 'governanca', re: /^\s*>?\s*\*\*Governado por:\*\*/im },
];

function missingFields(relPath) {
  const abs = join(REPO, relPath);
  if (!existsSync(abs)) return null; // sumiu entre o ls-files e a leitura
  let head;
  try {
    head = readFileSync(abs, 'utf-8').split('\n').slice(0, 40).join('\n');
  } catch {
    return null;
  }
  return FIELDS.filter((f) => !f.re.test(head)).map((f) => f.key);
}

// ============================================================================
// BASELINE
// ============================================================================
if (!existsSync(BASELINE_PATH)) {
  console.error('='.repeat(80));
  console.error('❌ GATE — DOC TAG RATCHET: baseline ausente');
  console.error('='.repeat(80));
  console.error(`Esperado: ${relative(REPO, BASELINE_PATH)}`);
  console.error('Gere com: node scripts/audit-doc-tag-ratchet.mjs --write-baseline');
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
const BASELINE_UNTAGGED = new Set(baseline.untagged || []);
const CEILING = Number(baseline.ceiling);

// ============================================================================
// VARREDURA
// ============================================================================
const docs = trackedDocs();
const untaggedNow = [];
const detail = new Map();
for (const d of docs) {
  const missing = missingFields(d);
  if (missing === null) continue;
  if (missing.length > 0) {
    untaggedNow.push(d);
    detail.set(d, missing);
  }
}
const untaggedSet = new Set(untaggedNow);

// ============================================================================
// --write-baseline — só quando a contagem DESCE (conserto real)
// ============================================================================
if (process.argv.includes('--write-baseline')) {
  if (existsSync(BASELINE_PATH) && Number.isFinite(CEILING) && untaggedNow.length > CEILING) {
    console.error('='.repeat(80));
    console.error('❌ --write-baseline RECUSADO');
    console.error('='.repeat(80));
    console.error(
      `Sem tarja hoje: ${untaggedNow.length} · teto congelado: ${CEILING}. ` +
        'Regenerar a baseline só é permitido quando a contagem DESCE (tarja aplicada de verdade). ' +
        'Conserte o(s) documento(s) novo(s) primeiro — alistar para abafar o vermelho é o defeito que este gate existe para pegar.'
    );
    process.exit(1);
  }
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        _comment:
          'Baseline congelada do F-DOC-ENTRY-AUTHORITY. Documento NOVO em docs/ exige os 5 campos de tarja. Esta lista SÓ ENCOLHE — regenerar com --write-baseline é recusado se a contagem subir.',
        generatedAt: new Date().toISOString().slice(0, 10),
        ceiling: untaggedNow.length,
        untagged: untaggedNow,
      },
      null,
      1
    ) + '\n'
  );
  console.log(`✅ baseline regravada: ${untaggedNow.length} documento(s) sem tarja (teto novo).`);
  process.exit(0);
}

// ============================================================================
// COMPARAÇÃO — duas travas independentes
// ============================================================================
const errors = [];

// (1) documento NOVO sem tarja — não estava na baseline e não tem os campos
for (const d of untaggedNow) {
  if (!BASELINE_UNTAGGED.has(d)) {
    errors.push(
      `❌ DOCUMENTO NOVO SEM TARJA: ${d} — falta: ${detail.get(d).join(', ')}. ` +
        'Declare os 5 campos no cabeçalho (primeiras 40 linhas). NÃO adicione à baseline para calar o gate.'
    );
  }
}

// (2) entrada da baseline que JÁ ganhou tarja precisa sair (ratchet desce)
for (const d of BASELINE_UNTAGGED) {
  if (!untaggedSet.has(d)) {
    errors.push(
      `❌ BASELINE DESATUALIZADA: ${d} já tem tarja (ou sumiu) mas continua na baseline — ` +
        'remova a linha e baixe o teto no MESMO commit (`--write-baseline`). A contagem tem de descer quando o trabalho é feito.'
    );
  }
}

// (3) TETO — comparado contra a contagem REAL, não só contra pertencimento.
//     É isto que impede "adicionar a chave na baseline" de resolver o vermelho.
if (Number.isFinite(CEILING) && untaggedNow.length > CEILING) {
  errors.push(
    `❌ TETO ESTOURADO (disco): ${untaggedNow.length} documento(s) sem tarja > teto congelado ${CEILING}. A contagem SÓ PODE DESCER.`
  );
}
if (Number.isFinite(CEILING) && BASELINE_UNTAGGED.size > CEILING) {
  errors.push(
    `❌ TETO ESTOURADO (baseline): ${BASELINE_UNTAGGED.size} entrada(s) > teto congelado ${CEILING}. Alistar documento novo para abafar o gate é exatamente o que ele existe para pegar.`
  );
}

// ============================================================================
// SAÍDA
// ============================================================================
if (errors.length > 0) {
  console.error('='.repeat(80));
  console.error('❌ GATE — TARJA OBRIGATÓRIA EM DOCUMENTO NOVO DE docs/: FALHOU');
  console.error('='.repeat(80));
  errors.slice(0, 25).forEach((e) => console.error(e));
  if (errors.length > 25) console.error(`   ... e mais ${errors.length - 25}`);
  console.error('');
  console.error(`Sem tarja hoje: ${untaggedNow.length} · baseline: ${BASELINE_UNTAGGED.size} · teto: ${CEILING} · universo: ${docs.length}`);
  process.exit(1);
}

console.log(
  `GATE OK [doc-tag-ratchet] — ${docs.length} documento(s) rastreados em docs/; ` +
    `${untaggedNow.length}/${CEILING} sem tarja (teto congelado 2026-07-31, comparado contra o disco); ` +
    'documento NOVO sem os 5 campos = FAIL; alistar para abafar estoura o teto do mesmo jeito; a contagem só desce.'
);
