/**
 * E2E (unit, sem DB) — F-FINANCIAL-WORKERS-STRUCTURAL-DORMANCY-SEAL (DECISION-0128).
 *
 * Prova o comportamento DEFAULT-OFF estrito do gate dos workers financeiros + que os selos
 * financeiros vizinhos não regrediram. Não toca DB, não inicia worker, não move dinheiro.
 *
 *   T1  isFinancialWorkerEnabled: env AUSENTE → false (default-off).
 *   T2  env '' → false.
 *   T3  env 'false' → false.
 *   T4  env 'TRUE' (maiúsc.) → false (estrito).
 *   T5  env '1' → false.  T6 env 'yes' → false.
 *   T7  env 'true' (exata) → true.
 *   T8  guard financial-workers-dormancy verde (BOOT gateado; sem producer HTTP).
 *   T9  payout HTTP continua fail-closed (guard payout-authority-binding verde).
 *   T10 bank-http continua request-only (guard bank-http-authority-binding verde).
 *   T11 DECISION-0113 baseline = 0 (guard 0113 inalterado).
 *
 * Uso direto: npx tsx src/scripts/validate-pipeline-e2e-financial-workers-dormancy.ts
 */
import { join } from 'path';
import { execSync } from 'child_process';
import { isFinancialWorkerEnabled } from '../workers/financial-worker-gate';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

const FLAG = 'ENABLE_PAYOUT_WORKER';
const setFlag = (v?: string): void => { if (v === undefined) delete process.env[FLAG]; else process.env[FLAG] = v; };
const cwd = process.cwd();
const guardGreen = (script: string): boolean => {
  try { execSync(`node scripts/${script}`, { cwd, encoding: 'utf8' }); return true; } catch { return false; }
};

function main(): void {
  const orig = process.env[FLAG];
  try {
    setFlag(undefined); record('T1 env AUSENTE → false (default-off)', isFinancialWorkerEnabled(FLAG) === false);
    setFlag(''); record('T2 env "" → false', isFinancialWorkerEnabled(FLAG) === false);
    setFlag('false'); record('T3 env "false" → false', isFinancialWorkerEnabled(FLAG) === false);
    setFlag('TRUE'); record('T4 env "TRUE" → false (estrito)', isFinancialWorkerEnabled(FLAG) === false);
    setFlag('1'); record('T5 env "1" → false', isFinancialWorkerEnabled(FLAG) === false);
    setFlag('yes'); record('T6 env "yes" → false', isFinancialWorkerEnabled(FLAG) === false);
    setFlag('true'); record('T7 env "true" (exata) → true', isFinancialWorkerEnabled(FLAG) === true);
  } finally {
    setFlag(orig);
  }

  record('T8 guard financial-workers-dormancy verde', guardGreen('audit-financial-workers-dormancy.mjs'));
  record('T9 payout HTTP fail-closed (payout-authority-binding verde)', guardGreen('audit-payout-authority-binding.mjs'));
  record('T10 bank-http request-only (bank-http-authority-binding verde)', guardGreen('audit-bank-http-authority-binding.mjs'));
  let baseline0 = false;
  try { baseline0 = /baseline=0\b/.test(execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' })); } catch { baseline0 = false; }
  record('T11 DECISION-0113 baseline = 0', baseline0);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ Workers financeiros default-off estrito; selos vizinhos íntegros — verde.');
  process.exit(0);
}

main();
