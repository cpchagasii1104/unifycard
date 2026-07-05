#!/usr/bin/env node
// Guard estrutural — F-TREASURY-SPLIT-SUPERSEDED-ANTIREVIVAL (Fatia 9 passo 3, decision pack
// PORTA-1, GO de Clayton via AskUserQuestion: "integrar treasury-split ao motor principal").
//
// ACHADO (read-first): `treasury-split.service.ts`/`treasury-split-config.repository.ts` calculam
// um SEGUNDO motor de split (pós-settlement) com percentuais hardcoded de bootstrap
// (regional/community/system_reserve/governance/seller) — DIFERENTE do motor principal
// (bank-split-engine/economic-policy-engine, escopo desta sessão). O worker que o dispararia
// (`startTreasurySplitWorker`) NUNCA foi chamado em lugar nenhum do runtime — 100% morto, sem
// rota registrada.
//
// A "INTEGRAÇÃO" decidida por Clayton (não é reativação nem descarte): a MESMA conta de sistema
// `regional_fund` que o motor principal já popula (agora PJ+PF completos, PE-5-RESOLVER-V2) é a
// que `regional-fund-governance.service.ts` JÁ CONSOME (bankAccount.getSystemAccount(tenantId,
// 'regional_fund') / getBalance) para as propostas/votação de "democracia direta" (community/
// reserve/governance/project são ALVOS DE VOTO sobre o MESMO pool, não pré-splits de percentual
// fixo antes do voto). Pré-dividir o dinheiro em baldes fixos (5/3/2/2/88) ANTES da comunidade
// votar contradiz tanto a doutrina "sem percentual hardcoded" (Clayton, Fatia 9 passo 3) quanto a
// tese de produto "fundo regional com democracia direta" (a comunidade decide o destino, não um
// percentual pré-cravado no código). treasury-split fica CONGELADO — sua responsabilidade já é
// servida pelo par (regional_fund account + governança/voto), sem 2º motor paralelo (CORE_SPLIT
// §12.1 proíbe engine paralelo).
//
// MORDE:
//   (A) startTreasurySplitWorker() passar a ser importado/chamado em qualquer lugar fora do
//       próprio arquivo de definição (reativação do worker morto);
//   (B) qualquer rota nova registrar/expor treasury-split (hoje NÃO existe rota nenhuma);
//   (C) executeSplit() de treasury-split.service.ts ganhar caller NOVO fora da allowlist morta
//       (o próprio worker) — sinal de reativação por efeito colateral de outra fatia.
// Em validate:regression-guards. Heurística textual comment-stripped. NÃO altera runtime.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, sep } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const norm = (p) => p.split(sep).join('/');

const failures = [];

// (A) startTreasurySplitWorker só pode aparecer na PRÓPRIA definição.
const WORKER_REL = 'src/workers/treasury-split-worker.ts';
const workerPath = join(ROOT, WORKER_REL);
if (!existsSync(workerPath)) {
  failures.push(`arquivo ausente: ${WORKER_REL}`);
} else {
  const offenders = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(full); continue; }
      if (!e.name.endsWith('.ts')) continue;
      const rel = norm(full.replace(ROOT + sep, ''));
      if (rel === WORKER_REL) continue; // a própria definição
      const src = stripTs(readFileSync(full, 'utf-8'));
      if (/startTreasurySplitWorker/.test(src)) offenders.push(rel);
    }
  };
  walk(join(ROOT, 'src'));
  if (offenders.length > 0) {
    failures.push(`startTreasurySplitWorker() foi importado/chamado fora da própria definição — worker morto reativado sem decisão própria: ${offenders.join(', ')}`);
  }
}

// (B) nenhuma rota registra treasury-split (hoje não existe treasury-split.routes.ts).
const TS_ROUTES = join(ROOT, 'src', 'modules', 'treasury-split', 'treasury-split.routes.ts');
if (existsSync(TS_ROUTES)) {
  failures.push(`${norm(TS_ROUTES.replace(ROOT + sep, ''))}: rota de treasury-split apareceu — exige decisão própria antes de expor HTTP (CORE_SPLIT §12 proíbe engine paralelo sem decisão).`);
}

// (C) executeSplit() só pode ser chamado pelo worker morto (allowlist).
const SERVICE_REL = 'src/modules/treasury-split/treasury-split.service.ts';
const servicePath = join(ROOT, SERVICE_REL);
if (!existsSync(servicePath)) {
  failures.push(`arquivo ausente: ${SERVICE_REL}`);
} else {
  const ALLOWLIST = new Set([SERVICE_REL, WORKER_REL]);
  const offenders = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(full); continue; }
      if (!e.name.endsWith('.ts')) continue;
      const rel = norm(full.replace(ROOT + sep, ''));
      if (ALLOWLIST.has(rel)) continue;
      const src = stripTs(readFileSync(full, 'utf-8'));
      if (/\bexecuteSplit\s*\(/.test(src) && /treasury-split/.test(src)) offenders.push(rel);
    }
  };
  walk(join(ROOT, 'src'));
  if (offenders.length > 0) {
    failures.push(`executeSplit (treasury-split) ganhou caller NOVO fora da allowlist morta: ${offenders.join(', ')} — reativação sem decisão própria.`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [treasury-split-superseded-antirevival-guard]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [treasury-split-superseded-antirevival-guard] — treasury-split (2º motor de split, percentuais hardcoded de bootstrap) permanece CONGELADO; sua responsabilidade (regional/community/reserve/governance) já é servida pela conta regional_fund única (PE-5-RESOLVER-V2, PJ+PF) consumida por regional-fund-governance.service.ts (democracia direta — a comunidade vota o destino, não um percentual pré-cravado). Zero worker ativo, zero rota, zero caller novo de executeSplit.');
