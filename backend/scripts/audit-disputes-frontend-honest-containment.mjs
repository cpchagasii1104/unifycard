#!/usr/bin/env node
// Guard estrutural — F-DISPUTES-FRONTEND-HONEST-CONTAINMENT (2026-06-27).
//
// LEI: "Frontend nunca cria verdade — projeta verdade resolvida." O frontend de disputas ANTES
//   usava localStorage como verdade e fabricava resolução/reversão financeira no browser
//   (status='reverted', revertedTransactionId) SEM Bank. O backend de disputa/reversão é completo
//   e DELIBERADAMENTE fail-closed em 403 (DECISION-0123). Este guard trava a contenção do FRONTEND
//   (nenhum guard de backend morde a fabricação do browser) e cruza, read-only, que o backend
//   permanece 403. Protege:
//   (A) api/disputes.ts é terminal honesto de LEITURA: sem localStorage/DISPUTES_STORAGE_KEY,
//       sem saveDisputes, sem observePilotEvent, sem create/resolve/reject/revertDispute exportados,
//       sem fabricar status='reverted'/revertedTransactionId.
//   (B) DisputePanel.tsx não importa de api/disputes nem o modal de resolução (DisputeResolutionModal).
//   (C) ActivityDetailModal.tsx não chama createDispute nem importa DisputeFormModal.
//   (D) Os modais de fabricação foram removidos (DisputeResolutionModal/DisputeFormModal ausentes).
//   (E) Nenhum arquivo VIVO do frontend/src (ignorando comentários) reintroduz o botão "Reverter Ação"
//       nem importa os modais de fabricação.
//   (F) cross-check read-only: o backend segue fail-closed — reconciliation-dispute.routes.ts mantém
//       DISPUTE_MUTATION_HTTP_DISABLED e DISPUTE_REVERSAL_HTTP_DISABLED (este guard NÃO toca backend/src).
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd(); // backend/
const FE = join(ROOT, '..', 'frontend');
const FE_SRC = join(FE, 'src');
const DISPUTES_API = join(FE_SRC, 'api', 'disputes.ts');
const PANEL = join(FE_SRC, 'components', 'dispute', 'DisputePanel.tsx');
const ACTIVITY_MODAL = join(FE_SRC, 'components', 'timeline', 'ActivityDetailModal.tsx');
const RESOLUTION_MODAL = join(FE_SRC, 'components', 'dispute', 'DisputeResolutionModal.tsx');
const FORM_MODAL = join(FE_SRC, 'components', 'dispute', 'DisputeFormModal.tsx');
const BE_DISPUTE_ROUTES = join(ROOT, 'src', 'modules', 'reconciliation', 'reconciliation-dispute.routes.ts');

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
// remove comentários de linha (//) e bloco (/* */) e strings — fiel ao stripTs dos guards vizinhos.
const stripComments = (s) =>
  s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const stripStrings = (s) => s.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === '.vite') continue;
      out.push(...walk(p));
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const failures = [];
const must = (cond, msg) => { if (!cond) failures.push(msg); };
let checked = 0;

// (A) api/disputes.ts — terminal honesto de leitura, sem fabricação ───────────────────────────────
const apiRaw = read(DISPUTES_API);
if (!apiRaw) {
  failures.push('DISPUTES_FE_HONEST (A): frontend/src/api/disputes.ts ausente.');
} else {
  const api = stripComments(apiRaw);
  checked++;
  must(!/\blocalStorage\b/.test(api),
    'DISPUTES_FE_HONEST (A): api/disputes.ts voltou a usar localStorage como verdade.');
  must(!/DISPUTES_STORAGE_KEY/.test(api) && !/['"]unify_disputes['"]/.test(api),
    'DISPUTES_FE_HONEST (A): api/disputes.ts voltou a referenciar o storage key de disputas (unify_disputes).');
  must(!/\bsaveDisputes\b/.test(api),
    'DISPUTES_FE_HONEST (A): api/disputes.ts voltou a persistir disputas (saveDisputes).');
  must(!/\bobservePilotEvent\b/.test(api),
    'DISPUTES_FE_HONEST (A): api/disputes.ts voltou a disparar telemetria de criação de disputa (observePilotEvent).');
  must(!/export\s+(async\s+)?function\s+createDispute\b/.test(api),
    'DISPUTES_FE_HONEST (A): api/disputes.ts voltou a expor createDispute (criação fabricada no frontend).');
  must(!/export\s+(async\s+)?function\s+resolveDispute\b/.test(api),
    'DISPUTES_FE_HONEST (A): api/disputes.ts voltou a expor resolveDispute (resolução fabricada no frontend).');
  must(!/export\s+(async\s+)?function\s+rejectDispute\b/.test(api),
    'DISPUTES_FE_HONEST (A): api/disputes.ts voltou a expor rejectDispute (rejeição fabricada no frontend).');
  must(!/export\s+(async\s+)?function\s+revertDispute\b/.test(api),
    'DISPUTES_FE_HONEST (A): api/disputes.ts voltou a expor revertDispute (REVERSÃO FINANCEIRA fabricada no frontend).');
  const apiCode = stripStrings(api);
  must(!/\.status\s*=\s*['"]?reverted/.test(api) && !/status:\s*['"]reverted['"]/.test(api),
    "DISPUTES_FE_HONEST (A): api/disputes.ts voltou a fabricar status='reverted' no browser.");
  must(!/\brevertedTransactionId\s*=/.test(apiCode),
    'DISPUTES_FE_HONEST (A): api/disputes.ts voltou a gravar revertedTransactionId como verdade no browser.');
}

// (B) DisputePanel.tsx — não importa api/disputes nem o modal de resolução ─────────────────────────
const panelRaw = read(PANEL);
if (!panelRaw) {
  failures.push('DISPUTES_FE_HONEST (B): DisputePanel.tsx ausente.');
} else {
  const panel = stripComments(panelRaw);
  checked++;
  must(!/from\s+['"][^'"]*api\/disputes['"]/.test(panel),
    'DISPUTES_FE_HONEST (B): DisputePanel.tsx voltou a importar de api/disputes (leitura/mutação de disputa fake).');
  must(!/DisputeResolutionModal/.test(panel),
    'DISPUTES_FE_HONEST (B): DisputePanel.tsx voltou a usar DisputeResolutionModal (resolver/reverter no browser).');
}

// (C) ActivityDetailModal.tsx — não cria disputa nem importa o form de criação ────────────────────
const actRaw = read(ACTIVITY_MODAL);
if (!actRaw) {
  failures.push('DISPUTES_FE_HONEST (C): ActivityDetailModal.tsx ausente.');
} else {
  const act = stripComments(actRaw);
  checked++;
  must(!/\bcreateDispute\b/.test(act),
    'DISPUTES_FE_HONEST (C): ActivityDetailModal.tsx voltou a chamar createDispute (protocolo de disputa fake).');
  must(!/DisputeFormModal/.test(act),
    'DISPUTES_FE_HONEST (C): ActivityDetailModal.tsx voltou a usar DisputeFormModal (abertura de disputa fake).');
}

// (D) modais de fabricação removidos ──────────────────────────────────────────────────────────────
checked++;
must(!existsSync(RESOLUTION_MODAL),
  'DISPUTES_FE_HONEST (D): DisputeResolutionModal.tsx reapareceu (modal de resolução/reversão fabricada).');
must(!existsSync(FORM_MODAL),
  'DISPUTES_FE_HONEST (D): DisputeFormModal.tsx reapareceu (modal de criação de disputa fabricada).');

// (E) sweep do frontend/src — nenhum arquivo vivo reintroduz o botão ou os modais ─────────────────
if (!existsSync(FE_SRC)) {
  failures.push('DISPUTES_FE_HONEST (E): frontend/src ausente.');
} else {
  checked++;
  const buttonOffenders = [];
  const modalOffenders = [];
  for (const f of walk(FE_SRC)) {
    const code = stripComments(read(f) || '');
    if (/Reverter\s+Ação/.test(code)) buttonOffenders.push(f.replace(FE, '').replace(/\\/g, '/'));
    if (/import\s+DisputeResolutionModal\b/.test(code) || /import\s+DisputeFormModal\b/.test(code)) {
      modalOffenders.push(f.replace(FE, '').replace(/\\/g, '/'));
    }
  }
  must(buttonOffenders.length === 0,
    `DISPUTES_FE_HONEST (E): botão "Reverter Ação" (reversão financeira fake) reintroduzido em: ${buttonOffenders.join(', ')}`);
  must(modalOffenders.length === 0,
    `DISPUTES_FE_HONEST (E): import de modal de fabricação de disputa reintroduzido em: ${modalOffenders.join(', ')}`);
}

// (F) cross-check read-only — backend segue fail-closed (403) ──────────────────────────────────────
const beRoutes = read(BE_DISPUTE_ROUTES);
checked++;
must(!!beRoutes, 'DISPUTES_FE_HONEST (F): reconciliation-dispute.routes.ts ausente (cross-check de contenção backend).');
if (beRoutes) {
  must(/DISPUTE_MUTATION_HTTP_DISABLED/.test(beRoutes),
    'DISPUTES_FE_HONEST (F): backend perdeu DISPUTE_MUTATION_HTTP_DISABLED — mutação de disputa deixou de ser fail-closed.');
  must(/DISPUTE_REVERSAL_HTTP_DISABLED/.test(beRoutes),
    'DISPUTES_FE_HONEST (F): backend perdeu DISPUTE_REVERSAL_HTTP_DISABLED — reversão de disputa deixou de ser fail-closed.');
}

console.log(`[disputes-frontend-honest-containment] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [disputes-frontend-honest-containment]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [disputes-frontend-honest-containment] — api/disputes.ts sem localStorage/fabricação; painel e modal de atividade sem create/resolve/revert; modais de fabricação removidos; ZERO "Reverter Ação" vivo; backend segue 403 (DECISION-0123).');
