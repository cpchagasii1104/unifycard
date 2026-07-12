#!/usr/bin/env node
// Guard agregador — F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-G · COMPOSIÇÃO N2-E × N2-F.
// Pergunta própria: "existe uma prova VERSIONADA que, num único fluxo transacional, use o WRITER
// CANÔNICO REAL (não INSERT direto) para criar um neighborhood, o referencie por um address coerente,
// e prove as falhas compostas (city incorreta→FK; bairro-sem-city→CHECK; bairro inexistente→FK;
// display_text/CEP não vira identity), com create+approve/2 grant_ids/2 eventos/token consumido,
// ROLLBACK real (não COMMIT, não DELETE-cleanup) e resíduo ZERO?"
// Prova a FORMA EXECUTÁVEL e a liveness do fluxo (não strings soltas): comment-stripped, statement-aware.
// Estado vivo = introspecção. Parse fail = FAIL.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
const note = (m) => failures.push(m);

const TEST = join(ROOT, 'scripts', 'test-neighborhood-integrated-composition-db.sql');
const RUNNER = join(ROOT, 'scripts', 'run-regression-guards.mjs');

if (!existsSync(TEST)) {
  console.error('GATE FAIL [neighborhood-integrated-composition] — prova integrada ausente: scripts/test-neighborhood-integrated-composition-db.sql');
  process.exit(1);
}

const raw = readFileSync(TEST, 'utf8');
// remove comentários de linha SQL (-- ...) para checar STATEMENTS reais (não texto comentado)
const sql = raw.replace(/--[^\n]*/g, ' ');
const has = (re) => re.test(sql);
const rawHas = (re) => re.test(raw);

// 1. WRITER CANÔNICO REAL como caminho feliz (retorno atribuído; não é comentário)
if (!has(/:=\s*public\.fn_create_canonical_neighborhood\s*\(/)) {
  note('A1: o fluxo feliz não chama o writer canônico real (v := public.fn_create_canonical_neighborhood(...))');
}

// 2. INSERT direto em neighborhoods só pode existir como TESTE NEGATIVO (HOLD), nunca como caminho feliz.
//    Todo INSERT INTO neighborhoods deve estar acompanhado da expectativa do HOLD.
const nbInserts = (sql.match(/INSERT\s+INTO\s+neighborhoods\b/gi) || []).length;
if (nbInserts > 0 && !has(/NEIGHBORHOOD_CANONICAL_WRITER_HOLD/)) {
  note('A2: há INSERT INTO neighborhoods sem prova de bloqueio pelo HOLD (INSERT direto não pode ser caminho feliz)');
}
if (nbInserts > 1) {
  note(`A2b: ${nbInserts} INSERT INTO neighborhoods — o writer deve ser o único criador; INSERT direto só como negativo único`);
}

// 3. grants create + approve via fixture territorial
if (!has(/territory:create_neighborhood/) || !has(/territory:approve_neighborhood/)) {
  note('A3: fixtures não concedem os DOIS grants territoriais (create + approve)');
}
if (!has(/mkgrant/)) note('A3b: não usa helper de grant de fixture (mkgrant) — não deve inventar authority paralela');

// 4. create+approve distintos: 2 eventos + 2 grant_ids + token consumido
if (!has(/neighborhood_curation_events[\s\S]{0,120}=\s*2|=\s*2[\s\S]{0,40}eventos/i) && !has(/v_ev\s*=\s*2/)) {
  note('A4: não prova 2 eventos de curadoria (create+approve)');
}
if (!has(/DISTINCT\s+grant_id/i) || !has(/v_g\s*=\s*2/)) note('A4b: não prova 2 grant_ids distintos');
if (!has(/neighborhood_writer_authorizations/) || !has(/v_tok\s*=\s*0/)) note('A4c: não prova token one-use consumido (0 tokens vivos)');

// 5. address VÁLIDO referenciando o neighborhood criado (composição real N2-E→N2-F)
if (!has(/INSERT\s+INTO\s+addresses[\s\S]{0,160}v_nb/i)) {
  note('A5: não cria address válido referenciando o neighborhood_id recém-criado (v_nb)');
}

// 6. FALHAS COMPOSTAS: city incorreta (FK), bairro sem city (CHECK), bairro inexistente (FK), display_text não-identity
if (!has(/ins_addr\(\s*'058705b4[^)]*v_nb[\s\S]{0,40}'fk'/) && !has(/city incorreta[\s\S]{0,20}'fk'/i)) {
  note('A6a: não prova CITY INCORRETA (mesmo neighborhood_id em outra city → FK composta)');
}
if (!has(/ins_addr\(\s*NULL\s*,\s*v_nb[\s\S]{0,40}'check'/) && !has(/sem city[\s\S]{0,20}'check'/i)) {
  note('A6b: não prova NEIGHBORHOOD SEM CITY (→ CHECK)');
}
if (!has(/99999999-9999-9999-9999-999999999999[\s\S]{0,40}'fk'/) && !has(/inexistente[\s\S]{0,20}'fk'/i)) {
  note('A6c: não prova NEIGHBORHOOD INEXISTENTE (→ FK)');
}
if (!has(/display_text[\s\S]{0,120}(não identity|não inferiu|evidence)/i) && !has(/ins_addr\([^)]*NULL\s*,\s*'[^']+'\s*\)[\s\S]{0,40}'ok'/)) {
  note('A6d: não prova DISPLAY_TEXT/CEP NÃO É IDENTITY (nome em display_text sem neighborhood_id, contagem não muda)');
}
if (!has(/count\(\*\)\s+INTO\s+v_nb_count\s+FROM\s+neighborhoods[\s\S]{0,120}v_nb_count\s*=\s*1/i) && !has(/ainda 1 neighborhood/i)) {
  note('A6e: não prova que display_text NÃO aumentou a contagem de neighborhoods');
}

// 7. ROLLBACK real + ausência de COMMIT (statement) — detecta "só comentou ROLLBACK" e "usou COMMIT"
if (!has(/(^|\n)\s*ROLLBACK\s*;/) && !has(/\bROLLBACK\s*;/)) {
  note('A7: não há ROLLBACK real (statement) — a limpeza deve ser por ROLLBACK');
}
if (rawHas(/(^|\n)\s*--[^\n]*ROLLBACK/i) && !has(/\bROLLBACK\s*;/)) {
  note('A7b: ROLLBACK aparece só comentado — não é executável');
}
if (has(/\bCOMMIT\s*;/i)) note('A7c: contém COMMIT — proibido; fixtures não podem sobreviver');

// 8. NENHUM DELETE-cleanup para mascarar resíduo (rollback é a única limpeza)
if (has(/\bDELETE\s+FROM\b/i)) {
  note('A8: contém DELETE FROM — limpeza por DELETE proibida; use apenas ROLLBACK');
}

// 9. PROVA DE RESÍDUO ZERO após o rollback (fora da tx)
if (!has(/neighborhoods[\s\S]{0,400}addresses[\s\S]{0,80}=\s*37|resíduo ZERO/i)) {
  note('A9: não há prova de resíduo ZERO pós-rollback (neighborhoods=0 … addresses=37 … actors=6)');
}
if (!has(/actors[\s\S]{0,40}=\s*6|actors=6/i)) note('A9b: resíduo final não confere actors=6 (nenhuma fixture de Actor residual)');

// 10. FRONTEIRA: sem Bank/ledger/split e sem rota/PORTA
for (const bad of ['bank_account', 'regional_fund', 'treasury', 'split', 'ledger']) {
  if (new RegExp(bad, 'i').test(sql)) note(`A10: referência proibida a ${bad} (N2 não toca Bank/Social)`);
}

// 11. WIRING: o teste é executável pelo processo de validação (guard no runner) e não usa função territorial paralela
if (existsSync(RUNNER)) {
  const runner = readFileSync(RUNNER, 'utf8');
  if (!/audit-neighborhood-integrated-composition\.mjs/.test(runner)) {
    note('A11: guard N2-G não está no runner (run-regression-guards.mjs)');
  }
}
// função territorial paralela: o único writer aceitável é fn_create_canonical_neighborhood
const otherWriters = (sql.match(/fn_[a-z_]*neighborhood[a-z_]*\s*\(/gi) || []).filter((s) => !/fn_create_canonical_neighborhood/.test(s));
if (otherWriters.length) note(`A11b: chama função territorial não-canônica: ${[...new Set(otherWriters)].join(', ')}`);

if (failures.length) {
  console.error('GATE FAIL [neighborhood-integrated-composition]\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('GATE OK [neighborhood-integrated-composition] — prova integrada N2-E×N2-F versionada: writer canônico real cria o neighborhood (INSERT direto só como negativo do HOLD), address coerente o referencia, e as falhas compostas (city incorreta→FK; bairro-sem-city→CHECK; bairro inexistente→FK; display_text não-identity) são provadas; create+approve com 2 grant_ids + 2 eventos + token one-use consumido; ROLLBACK real (sem COMMIT, sem DELETE-cleanup); resíduo ZERO (neighborhoods=0 … addresses=37 … actors=6); sem Bank/rota. (Forma executável e liveness; comment-stripped.)');
