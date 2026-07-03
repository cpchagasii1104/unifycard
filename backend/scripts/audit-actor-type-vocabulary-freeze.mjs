#!/usr/bin/env node
// Guard estrutural — F-ACTOR-TYPE-VOCABULARY-CANONICAL / DECISION-0157 (D-C2, achado B6 do
// auditoria.md). Clayton ratificou o vocabulário canônico de actor_type = user/page/group/channel
// e mandou CONGELAR a fragmentação (proibir writers NOVOS de valores legados) SEM tocar o CHECK /
// readers / triggers legados ainda (norma assintótica — conter o drift agora, drenar depois).
//
// Runtime já convergiu (só user/page/group têm linhas em dev); a dívida é o CHECK permissivo (10
// valores) + readers defensivos. Este guard trava a EXPANSÃO: nenhum writer NOVO de valor legado.
//
// LEGADO-CONGELADO (proibido para writers novos): person/company/system · actor_human/
// actor_organizational/actor_system. CANÔNICO (permitido): user/page/group/channel.
//
// MORDE: um arquivo FORA do allowlist ESCREVER actor_type legado, em qualquer das 3 formas:
//   (P1) objeto literal:  actor_type: 'legado'
//   (P2) SQL update:      SET actor_type = 'legado'
//   (P4) INSERT INTO actors ... VALUES contendo QUALQUER token legado (inclusive os genéricos
//        person/company/system) — escopado ao bloco `INSERT INTO actors` para não flagar 'system'/
//        'company' de outras tabelas. (Substitui a P3 antiga, que só pegava tokens ator-inequívocos
//        e por isso deixava passar um INSERT posicional de 'company' — achado R3-1 da re-auditoria
//        rodada 3.)
// NÃO morde READERS (comparações ===/==/IN/WHERE) — esses ramos legados ficam até a drenagem.
//
// ALLOWLIST (writers legados PRÉ-EXISTENTES, documentados na DECISION-0157; convergência = frente de
// drenagem, não esta fatia):
//   • src/core/identity/identity.service.ts — ensureGenesisActorForUser escreve 'actor_human'
//     (schema Genesis, actor.id=user.id). ⚠️ SCRIPT-ONLY (achado R3-2): private, chamado só por
//     ensureCanonicalActorChain, cujo único caller é validate-financial-flow-real.ts (gate
//     validate:financial-e2e). Produção NÃO nasce actor_human — mas rodar o gate financeiro semeia.
//   • migrations/0012_unify_actor_and_kyc_ontology.sql — normalização histórica (imutável, aplicada).
//   • seeds/036_seed_e2e_c52_payment_intents.sql — fixture E2E C52 escreve seller 'company' (achado
//     R3-1). Reader inventory-unit-actor.ts:28 depende de actor_type='company' p/ o fixture; converter
//     p/ 'page' tem risco — allowlistado como legado fixture conhecido, convergência = drenagem.
// Percorre src/ + migrations/ + seeds/ (seeds/ estava fora do walk — cegueira do achado R3-1).
// Heurística textual comment-stripped. Em validate:regression-guards. NÃO altera runtime/CHECK/dados.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const ROOT = process.cwd();
const norm = (p) => p.split(sep).join('/');
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

const ALLOWLIST = new Set([
  'src/core/identity/identity.service.ts',
  'migrations/0012_unify_actor_and_kyc_ontology.sql',
  'seeds/036_seed_e2e_c52_payment_intents.sql',
]);

const LEGACY = 'person|company|system|actor_human|actor_organizational|actor_system';
const LEGACY_TOKEN = new RegExp(`'(?:${LEGACY})'`, 'i');

const P1 = new RegExp(`actor_type\\s*:\\s*'(?:${LEGACY})'`);           // objeto literal
const P2 = new RegExp(`SET\\s+actor_type\\s*=\\s*'(?:${LEGACY})'`, 'i'); // SQL update

// P4: dentro de cada bloco `INSERT INTO actors ... VALUES(...)`, qualquer token legado (inclusive
// genéricos), escopado ao INSERT de actors — não flaga 'system'/'company' de outras tabelas.
function insertIntoActorsHasLegacy(content) {
  const re = /INSERT\s+INTO\s+actors\b/gi;
  let m;
  while ((m = re.exec(content)) !== null) {
    const window = content.slice(m.index, m.index + 700);
    if (LEGACY_TOKEN.test(window)) return true;
  }
  return false;
}

function hasLegacyWrite(content) {
  return P1.test(content) || P2.test(content) || insertIntoActorsHasLegacy(content);
}

const failures = [];
const files = [];
function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    if (e === 'node_modules' || e === 'dist' || e === '.git') continue;
    const full = join(dir, e);
    let st; try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full);
    else if (/\.(ts|mts|cts)$/.test(e) && !/\.d\.ts$/.test(e)) files.push({ full, kind: 'ts' });
    else if (/\.sql$/.test(e)) files.push({ full, kind: 'sql' });
  }
}
walk(join(ROOT, 'src'));
walk(join(ROOT, 'migrations'));
walk(join(ROOT, 'seeds')); // achado R3-1: seeds/ estava fora do walk — cegueira que escondia o writer C52.

for (const { full, kind } of files) {
  const rel = norm(relative(ROOT, full));
  // pula tests e scripts de e2e/validate (fixtures podem escrever legado deliberadamente p/ provar guards/leitura legada)
  if (/\.test\.(ts|mts|cts)$/.test(rel) || rel.startsWith('src/scripts/')) continue;
  if (ALLOWLIST.has(rel)) continue;
  let content;
  try { content = readFileSync(full, 'utf-8'); } catch { continue; }
  content = kind === 'sql' ? stripSql(content) : stripTs(content);
  if (hasLegacyWrite(content)) {
    failures.push(`${rel}: WRITER NOVO de actor_type legado (person/company/system/actor_human/actor_organizational/actor_system) — vocabulário congelado por DECISION-0157 (D-C2). Canônico = user/page/group/channel. Se for drenagem intencional, faça na frente F-ACTOR-TYPE-VOCABULARY-DRAIN-* com GO.`);
  }
}

// A allowlist não pode envelhecer silenciosamente: os writers legados conhecidos devem seguir existindo
// (se sumirem/convergirem, revisar esta trava conscientemente).
for (const rel of ALLOWLIST) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) {
    failures.push(`allowlist desatualizada: ${rel} não existe mais — revisar a trava (writer legado removido/convergido exige atualizar este guard e a DECISION-0157).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [actor-type-vocabulary-freeze]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [actor-type-vocabulary-freeze] — vocabulário de actor_type CONGELADO (DECISION-0157/D-C2): canônico user/page/group/channel; nenhum writer NOVO de valor legado; 3 writers legados pré-existentes allowlistados (Genesis identity.service [script-only] + migration histórica 0012 + fixture C52 seed); walk cobre src+migrations+seeds; INSERT INTO actors posicional detectado. Readers/CHECK legados intocados (drenagem = frente própria). Achados B6 + R3-1/R3-2 contidos.');
