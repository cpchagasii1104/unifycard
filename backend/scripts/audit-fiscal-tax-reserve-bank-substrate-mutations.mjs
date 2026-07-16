#!/usr/bin/env node
// Harness REPRODUZÍVEL de mutation/prova do guard FISCAL-4E (audit-fiscal-tax-reserve-bank-substrate.mjs).
// DECISION-0179/0182/0183 — vetores hostis V24/V36/V38 + contrato integrado. NÃO é guard, NÃO entra no
// runner, NÃO ocupa a posição 186. Cada vetor: mutação byte-exata → roda o guard real → espera BITE →
// restaura byte-idêntico. Fail-closed (exit!=0 em qualquer divergência). Sem rede, sem DB.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const GUARD = 'scripts/audit-fiscal-tax-reserve-bank-substrate.mjs';
const COMP = 'src/modules/bank/fiscal-reserve-bank-composition.service.ts';
const RESOLVER = 'src/modules/bank/fiscal-reserve-account.resolver.ts';
const TYPES = 'src/modules/bank/bank-split.types.ts';
const MIG = 'migrations/20260716120000_fiscal_tax_reserve_bank_substrate.sql';
const SPLITREPO = 'src/modules/bank/bank-split.repository.ts';
const REV = 'src/modules/reversal/reversal.service.ts';
const FP = 'src/modules/fiscal-provision/fiscal-economic-fingerprint.ts';
const FRONTEND = resolve(process.cwd(), '../frontend/src');

const runGuardBITE = () => { try { execSync(`node ${GUARD}`, { stdio: 'pipe' }); return 'PASS'; } catch { return 'BITE'; } };
function onSandbox(path, transform) {
  const orig = readFileSync(path, 'utf8');
  const before = createHash('sha256').update(orig).digest('hex');
  let got;
  try { writeFileSync(path, transform(orig)); got = runGuardBITE(); }
  finally { writeFileSync(path, orig); }
  if (createHash('sha256').update(readFileSync(path, 'utf8')).digest('hex') !== before) throw new Error(`RESTORE FALHOU: ${path}`);
  return got;
}
// scan de refs executáveis a vocabulário FISCAL-4E no frontend (V38). Ignora arquivos .md; conta ocorrências.
// `probe` opcional simula um arquivo frontend hostil (arquivo virtual, sem tocar o disco).
function frontendFiscalRefs(probe) {
  const tokens = /tax_reserve|fiscal_reserve|fiscalReserveBankComposition|rate_bps|rounding_mode|treasury:fiscal_reserve/;
  let found = 0;
  const walk = (d) => { if (!existsSync(d)) return; for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = resolve(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) { if (tokens.test(readFileSync(p, 'utf8'))) found++; }
  } };
  walk(FRONTEND);
  if (probe && tokens.test(probe)) found++;
  return found;
}

const V = [
  // ── V24 — infra convertida em MISSING (resolver deve PROPAGAR) ──
  { n: 'V24', name: 'resolver captura infra e converte em MISSING', exp: 'BITE',
    got: () => onSandbox(RESOLVER, (c) => c.replace(
      'const res = await client.query',
      'let res; try { res = await client.query'
    ).replace(
      'return { bankAccountId: row.bank_account_id };',
      'return { bankAccountId: row.bank_account_id }; } catch (e) { throw new FiscalReserveAccountMissingError(tenantId, fiscalIdentityId, currency); }')) },

  // ── V36 — regional/split regional dentro da composição 4E ──
  { n: 'V36', name: 'composição 4E referencia regional_fund', exp: 'BITE',
    got: () => onSandbox(COMP, (c) => c.replace(
      'let materializedTaxReserve = false;',
      'const regional_fund_accounts = true; // hostil: split regional na 4E\n    let materializedTaxReserve = false;')) },

  // ── V38 — frontend introduz decisão fiscal (scan direto) ──
  { n: 'V38-benign', name: 'frontend sem ref FISCAL-4E executável', exp: 'NONE',
    got: () => (frontendFiscalRefs() === 0 ? 'NONE' : 'FOUND') },
  { n: 'V38', name: 'frontend referencia tax_reserve/fiscal_reserve → detectado', exp: 'FOUND',
    got: () => (frontendFiscalRefs("export const x = 'tax_reserve';") >= 1 ? 'FOUND' : 'NONE') },

  // ── vetores estruturais do contrato ──
  { n: 'tuple', name: 'tax_reserve removido do tuple', exp: 'BITE',
    got: () => onSandbox(TYPES, (c) => c.replace(/\n\s*'tax_reserve',[^\n]*/, '')) },
  { n: 'fk-inversa', name: 'FK inversa fiscal→bank_*', exp: 'BITE',
    got: () => onSandbox(MIG, (c) => c.replace('CREATE TABLE fiscal_provision_events', 'CREATE TABLE fiscal_provision_events_x_ref (x uuid REFERENCES bank_accounts(id));\nCREATE TABLE fiscal_provision_events')) },
  { n: 'allowlist', name: 'allowlist distributable não vazia (economicPolicyId não-null)', exp: 'BITE',
    got: () => onSandbox(COMP, (c) => c.replace(/economicPolicyId: null,/g, 'economicPolicyId: "pol-x",')) },
  { n: 'source-implicita', name: 'source line deixa de ser explícita', exp: 'BITE',
    got: () => onSandbox(COMP, (c) => c.replace(/commissionGrossSourceLineId/g, 'firstMatchLineId')) },
  { n: 'readback-actor', name: 'read-back deixa de ser target-account-first', exp: 'BITE',
    got: () => onSandbox(SPLITREPO, (c) => c.replace(/COALESCE\(bs\.target_account_id, ba_actor\.id\)/g, 'ba_actor.id')) },
  { n: 'crosstenant', name: 'read-back cross-tenant deixa de ser fail-closed', exp: 'BITE',
    got: () => onSandbox(SPLITREPO, (c) => c.replace(/BANK_SPLIT_TARGET_ACCOUNT_CROSS_TENANT/g, 'BENIGN_TENANT')) },
  { n: 'reversal-ownsTx', name: 'reversal remove a guarda ownsTx do COMMIT', exp: 'BITE',
    got: () => onSandbox(REV, (c) => c.replace("if (ownsTx) await client.query('COMMIT');", "await client.query('COMMIT');")) },
  { n: 'fingerprint-ref', name: 'reference_id entra no preimage do fingerprint', exp: 'BITE',
    got: () => onSandbox(FP, (c) => c.replace('tenantId: input.tenantId,', 'tenantId: input.tenantId,\n    referenceId: (input).referenceId,')) },
];

let allPass = true;
for (const v of V) {
  let got;
  try { got = v.got(); } catch (e) { got = 'ERRO:' + (e?.message ?? e); }
  const ok = got === v.exp;
  if (!ok) allPass = false;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  [${v.n}] ${v.name} — esperado ${v.exp}, obtido ${got}`);
}
console.log(allPass
  ? `\nGATE OK [fiscal-4e-mutations] — ${V.length}/${V.length} vetores (V24/V36/V38 + estruturais) provados; resíduo byte-exato ZERO.`
  : '\nGATE FAIL [fiscal-4e-mutations] — ver acima.');
process.exit(allPass ? 0 : 1);
