#!/usr/bin/env node
// Guard — DECISION-0153 (Referral Cascade Model B + rejeição C).
//
// Referral = LOOKUP econômico, single-level (Modelo B por-usuário). PROIBIDO multinível (C). A materialização
// da cascata actor→owner-user é FINANCEIRA → HOLD (não pode aparecer no split-engine sem decisão financeira).
// MORDE se: (1) split-engine resolver referral em multinível/recursão; (2) cascade actor→owner-user for wired
// (fromUserId derivado de actor no split-engine); (3) REFERRAL_PERCENTAGE virar níveis/array; (4) split 'referral'
// nascer fora do bank-split-engine.

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? readFileSync(p, 'utf-8') : null; };
const failures = [];

const ENGINE = 'src/modules/bank/bank-split-engine.service.ts';
const eng = read(ENGINE);
if (eng === null) {
  failures.push(`${ENGINE}: ausente (split-engine do referral).`);
} else {
  // (1) single-level: getActiveReferral chamado por fromUserId (o param), exatamente UMA vez no engine.
  const calls = [...eng.matchAll(/getActiveReferral\s*\(/g)].length;
  if (calls !== 1) {
    failures.push(`${ENGINE}: getActiveReferral chamado ${calls}× (esperado 1 — single-level Modelo B; >1 = risco multinível).`);
  }
  // 🔴 O INVARIANTE É QUEM RESOLVE, NÃO QUANTOS ARGUMENTOS (corrigido 2026-08-05).
  // A versão anterior exigia a chamada com EXATAMENTE 2 argumentos. Quando a JANELA saiu do código
  // e virou configuração de painel (GO de Clayton), a chamada ganhou `atDate` e `windowDays` — e
  // este guard ficou vermelho apesar de o Modelo B seguir intacto: quem resolve continua sendo o
  // user DIRETO (`fromUserId`), que é a única coisa que "single-level" significa.
  // Agora casa os DOIS PRIMEIROS argumentos e ignora o que vier depois. Medir forma em vez de
  // invariante transforma qualquer evolução legítima em falso vermelho — e falso vermelho ensina
  // a desligar guard.
  if (!/getActiveReferral\(\s*tenantId\s*,\s*fromUserId\s*[,)]/.test(eng)) {
    failures.push(`${ENGINE}: referral não resolve por getActiveReferral(tenantId, fromUserId, ...) — Modelo B exige resolução pelo user direto.`);
  }
  // (2) cascade actor→owner-user (material FINANCEIRO) NÃO pode estar wired no engine.
  if (/resolveOwnerUserFromActor|actorToOwnerUser|ownerUserOfActor|cascadeReferral|referralCascade/i.test(eng)) {
    failures.push(`${ENGINE}: cascade actor→owner-user wired — materialização da cascata é FINANCEIRA/HOLD (DECISION-0153 §C; exige 3 paralelas + Camada 1).`);
  }
  // (3) sem multinível em código.
  if (/referralLevel|multiLevel|multilevel|referralDepth|referralLevels|REFERRAL_LEVELS/i.test(eng)) {
    failures.push(`${ENGINE}: marcador de multinível detectado — Modelo C REJEITADO (DECISION-0153).`);
  }
  // (3b) REFERRAL_PERCENTAGE não pode virar array/níveis.
  if (/REFERRAL_PERCENTAGE\s*=\s*\[/.test(eng)) {
    failures.push(`${ENGINE}: REFERRAL_PERCENTAGE virou array (níveis) — multinível proibido.`);
  }
}

// (4) split 'referral' só nasce no bank-split-engine (não em outro lugar fora do Bank).
const SRC = join(ROOT, 'src');
function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    let st; try { st = require('fs').statSync(p); } catch { continue; }
    if (st.isDirectory()) { if (e !== 'node_modules') walk(p, acc); }
    else if (e.endsWith('.ts')) acc.push(p);
  }
  return acc;
}
for (const abs of walk(SRC)) {
  const r = abs.slice(ROOT.length + 1).replace(/\\/g, '/');
  if (r === ENGINE || r.includes('/__tests__/') || r.endsWith('.test.ts') || r.startsWith('src/scripts/')) continue;
  const s = readFileSync(abs, 'utf-8');
  if (/splitType:\s*'referral'/.test(s)) {
    failures.push(`${r}: cria split 'referral' fora do bank-split-engine — split de referral SÓ dentro do Bank (DECISION-0153).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [referral-cascade-model]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log("GATE OK [referral-cascade-model] — referral single-level (Modelo B; getActiveReferral(tenantId, fromUserId) 1×); sem multinível (C rejeitado); cascade actor→owner-user NÃO wired (FINANCEIRO/HOLD); split 'referral' só no bank-split-engine. DECISION-0153.");
