#!/usr/bin/env node
// Gate estrutural — F-SESSION-TENANT-ID-REQUIRED-ON-PUBLISH-SLICE-A (DT-SESSION-TENANT-ID-REQUIRED).
// CAUSA-RAIZ do TENANT_ID_REQUIRED intermitente: `atob()` puro sobre payload de JWT (que é BASE64URL,
// RFC 7515) lança DOMException em '-'/'_' — presentes em ~90% dos tokens reais. O padrão frágil
// `JSON.parse(atob(token.split('.')[1]))` estava em 10 call sites da cadeia de sessão.
// Fix: helper único base64url-safe `decodeJwtPayload` (frontend/src/utils/jwt.ts).
// ESTE GUARD morde se: (1) `atob(` reaparecer em frontend/src FORA do helper (regressão do padrão
// frágil); (2) o helper perder a conversão base64url→base64 (replace de -/_ + padding).

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const FRONTEND_SRC = join(ROOT, '..', 'frontend', 'src');
const HELPER = join(FRONTEND_SRC, 'utils', 'jwt.ts');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

if (!existsSync(HELPER)) {
  failures.push('helper frontend/src/utils/jwt.ts ausente — a decodificação base64url-safe sumiu.');
} else {
  const code = stripTs(readFileSync(HELPER, 'utf8'));
  if (!/replace\(\/-\/g,\s*'\+'\)/.test(code) || !/replace\(\/_\/g,\s*'\/'\)/.test(code)) {
    failures.push('utils/jwt.ts: perdeu a conversão base64url→base64 (replace de - e _) — atob voltaria a quebrar em ~90% dos tokens.');
  }
  if (!/decodeJwtPayload/.test(code)) {
    failures.push('utils/jwt.ts: perdeu decodeJwtPayload.');
  }
}

// (1) nenhum atob( fora do helper em frontend/src (o padrão frágil não pode voltar).
const offenders = [];
(function walk(dir) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    const st = statSync(full);
    if (st.isDirectory()) { if (f !== 'node_modules') walk(full); }
    else if (/\.(ts|tsx)$/.test(f)) {
      if (full === HELPER) continue;
      const code = stripTs(readFileSync(full, 'utf8'));
      if (/\batob\s*\(/.test(code)) offenders.push(relative(FRONTEND_SRC, full).replace(/\\/g, '/'));
    }
  }
})(FRONTEND_SRC);
for (const o of offenders) {
  failures.push(`frontend/src/${o}: usa atob( fora do helper — padrão frágil (base64url quebra atob). Usar decodeJwtPayload de utils/jwt.`);
}

console.log(`[jwt-payload-decode-frontend] offenders=${offenders.length} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [jwt-payload-decode-frontend]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [jwt-payload-decode-frontend] — decodificação de JWT centralizada no helper base64url-safe; zero atob( solto em frontend/src; TENANT_ID_REQUIRED intermitente não pode regredir por este vetor.');
