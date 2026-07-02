#!/usr/bin/env node
// Guard estrutural — F-ACTOR-MODE-SURFACE-CLARITY-SLICE (Slice 2 do blueprint
// F-HOME-ACTOR-MODE-SEARCH-OPERABILITY-BLUEPRINT). Frontend-only, UX puro, sem authority nova.
//
// Prova (textual, comment-stripped) que:
//   (A) GlobalHeader.tsx tem a pílula "quem × modo" (badge + switcher agrupados visualmente,
//       aria-label combinado) — não são mais 2 widgets desconexos;
//   (B) OperatingModeToggle (controle interativo) permanece FORA da pílula (a pílula é leitura,
//       não controle — separação deliberada);
//   (C) Wallet.tsx declara o dono explícito do extrato ("Extrato de {actor}");
//   (D) actorContextConfig.ts documenta PROFILE_CHANNEL como scaffold morto/contido (D-C2
//       pendente) — não pode ser expandido silenciosamente sem a decisão ontológica.
//
// MORDE regressão real (perda de qualquer um dos 4). NÃO valida CSS/render visual — isso exige
// sign-off humano no navegador (frontend-only, sem harness de screenshot nesta sessão).
// Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd(); // backend/
const FE_SRC = join(ROOT, '..', 'frontend', 'src');
const HEADER = join(FE_SRC, 'components', 'layout', 'GlobalHeader.tsx');
const WALLET = join(FE_SRC, 'components', 'Wallet.tsx');
const CONFIG = join(FE_SRC, 'config', 'actorContextConfig.ts');

const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const failures = [];
const read = (p) => { if (!existsSync(p)) { failures.push(`arquivo ausente: ${p}`); return null; } return readFileSync(p, 'utf-8'); }; // CRU — marcadores de bloco são JSX/comentários

// (A) pílula "quem × modo": wrapper com badge + avatar-container dentro, aria-label combinado.
const header = read(HEADER);
if (header !== null) {
  const stripped = stripTs(header);
  if (!/className="gh-identity-pill"/.test(header)) {
    failures.push(`${HEADER}: gh-identity-pill (pílula "quem × modo") ausente — badge e switcher voltariam a ser widgets desconexos.`);
  } else {
    const pillStart = header.indexOf('className="gh-identity-pill"');
    const pillRegionEnd = header.indexOf('</header>');
    const pillRegion = header.slice(pillStart, pillRegionEnd > pillStart ? pillRegionEnd : header.length);
    if (!/<OperatingModeBadge/.test(pillRegion)) failures.push(`${HEADER}: OperatingModeBadge saiu de dentro da pílula gh-identity-pill.`);
    if (!/gh-avatar-container/.test(pillRegion)) failures.push(`${HEADER}: gh-avatar-container (switcher) saiu de dentro da pílula gh-identity-pill.`);
  }
  if (!/identityPillLabel/.test(stripped)) {
    failures.push(`${HEADER}: identityPillLabel (aria-label combinado "Operando como {actor} · {modo}") ausente.`);
  }
  // (B) OperatingModeToggle (controle) permanece FORA da pílula — antes dela no markup, não dentro.
  const toggleIdx = header.indexOf('<OperatingModeToggle');
  const pillIdx = header.indexOf('className="gh-identity-pill"');
  if (toggleIdx < 0) {
    failures.push(`${HEADER}: OperatingModeToggle (controle de troca de modo) sumiu do header.`);
  } else if (pillIdx >= 0 && toggleIdx > pillIdx) {
    failures.push(`${HEADER}: OperatingModeToggle está DENTRO da pílula de leitura — controle e leitura devem ficar separados (pílula é declarativa).`);
  }
}

// (C) Wallet.tsx: dono explícito do extrato.
const wallet = read(WALLET);
if (wallet !== null) {
  if (!/wallet-owner-label/.test(wallet)) {
    failures.push(`${WALLET}: wallet-owner-label ausente — extrato voltou a não declarar de quem é o saldo.`);
  }
  if (!/Extrato de \{activeActor\??\.display_name\}/.test(wallet)) {
    failures.push(`${WALLET}: label "Extrato de {activeActor.display_name}" (JSX) ausente ou reformulado sem o dono explícito.`);
  }
}

// (D) actorContextConfig.ts: PROFILE_CHANNEL documentado como scaffold morto (D-C2 pendente).
const config = read(CONFIG);
if (config !== null) {
  const idx = config.indexOf('const PROFILE_CHANNEL');
  if (idx < 0) {
    failures.push(`${CONFIG}: PROFILE_CHANNEL sumiu — se foi removido por decisão, isso deveria vir com D-C2 ratificada (registrar no cartório, não neste guard).`);
  } else {
    const before = config.slice(Math.max(0, idx - 900), idx);
    if (!/D-C2/.test(before)) {
      failures.push(`${CONFIG}: PROFILE_CHANNEL perdeu a nota de contenção (referência a D-C2) — risco de ser expandido/completado sem a decisão ontológica.`);
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [actor-mode-surface-clarity-slice]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [actor-mode-surface-clarity-slice] — pílula "quem × modo" agrupa badge+switcher (toggle separado, controle ≠ leitura); Wallet declara dono do extrato; PROFILE_CHANNEL contido com nota D-C2. Frontend-only, sem authority nova.');
