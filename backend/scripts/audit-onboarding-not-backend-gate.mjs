#!/usr/bin/env node
// Guard — F-ONBOARDING-MARCOS-PROJECTION (DECISION-0150 / Opção B + b1).
//
// POLÍTICA: onboarding PF é PROGRESSIVO e UX-hint — NUNCA um hard gate de backend. requiresOnboarding/
// isOnboardingCompleted/metadata.onboarding_completed são SINAIS (navegação/projeção), não autoridade.
// Ações de risco têm hard gate PRÓPRIO (P3 activation, P5 booking, KYB PJ, payout, checkout firewall);
// criar empresa/page shell = auth-only (b1). Os marcos read-only (milestones) são PROJEÇÃO, não autorização.
//
// MORDE se o sinal de onboarding PF for usado como BLOQUEIO backend (throw / 4xx) — i.e., virar catraca.
// (Company onboarding PJ usa tokens próprios — company.onboarding/status — e NÃO é alvo: é gate legítimo de KYB.)

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const rel = (p) => p.slice(ROOT.length + 1).replace(/\\/g, '/');

// Sinal de onboarding PF (NÃO os tokens de company onboarding PJ).
const PF_SIGNAL = /\b(requiresOnboarding|isOnboardingCompleted)\b/;
// Bloqueio (gate): throw OU resposta 4xx próxima do sinal (ambas as direções, janela curta).
const SIGNAL_THEN_BLOCK = /\b(requiresOnboarding|isOnboardingCompleted)\b[\s\S]{0,160}?(throw\s|reply\.status\(\s*4|reply\.code\(\s*4|\.status\(\s*40)/;
const BLOCK_THEN_SIGNAL = /(throw\s|reply\.status\(\s*4|reply\.code\(\s*4|\.status\(\s*40)[\s\S]{0,160}?\b(requiresOnboarding|isOnboardingCompleted)\b/;

// auth.service computa requiresOnboarding como VALOR de retorno (hint), não gate; profile.service é a CASA do
// getter puro isOnboardingCompleted (definição read-only, sem gate) → allowlist (o guard cobre routes/handlers/
// demais services, onde uma catraca real nasceria).
const isAllowed = (r) =>
  r === 'src/core/auth/auth.service.ts' ||
  r === 'src/core/profile/profile.service.ts' ||
  r.includes('/__tests__/') || r.endsWith('.test.ts') || r.startsWith('src/scripts/');

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) { if (e !== 'node_modules') walk(p, acc); }
    else if (e.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

const failures = [];
for (const abs of walk(join(ROOT, 'src'))) {
  const r = rel(abs);
  if (isAllowed(r)) continue;
  const s = stripTs(readFileSync(abs, 'utf-8'));
  if (!PF_SIGNAL.test(s)) continue;
  if (SIGNAL_THEN_BLOCK.test(s) || BLOCK_THEN_SIGNAL.test(s)) {
    failures.push(
      `${r}: onboarding PF (requiresOnboarding/isOnboardingCompleted) usado como BLOQUEIO backend (throw/4xx). ` +
      `DECISION-0150: onboarding PF é UX-hint progressivo, NUNCA hard gate. Ações de risco têm gate próprio ` +
      `(P3/P5/KYB/payout/checkout). Se precisa bloquear, use a regra de risco dedicada — não o sinal de onboarding.`
    );
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [onboarding-not-backend-gate]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [onboarding-not-backend-gate] — onboarding PF é UX-hint progressivo (nunca hard gate backend); ações de risco gateadas por regra própria; marcos = projeção read-only. DECISION-0150 Opção B+b1.');
