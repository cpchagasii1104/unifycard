// audit-company-activation-kyc-gate.mjs
// Guard do F-CNPJ-ACTIVATE-KYC-GATE (AUTHORITY_LAW Art.4.2 · DT-AUTHORITY-LATENTS-PASSO-3 ②).
// A norma constitucional PROÍBE "criar ou CONTROLAR CNPJ" sem KYC mínimo. A empresa pode NASCER
// inerte (DRAFT) sem KYC, mas a ATIVAÇÃO operacional (o ponto de CONTROLE) exige que o responsável
// humano tenha identities.kyc_status='approved'. Congela:
//   1 · activateCompanyOperationally lê o kyc_status do responsável e exige 'approved' (fail-closed);
//   2 · o erro é COMPANY_ACTIVATION_REQUIRES_KYC (403);
//   3 · a checagem cita AUTHORITY_LAW Art.4.2 (rastreabilidade norma↔código).
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const fails = [];
const check = (label, ok) => { if (!ok) fails.push(label); console.log(`  ${ok ? 'OK ' : 'FAIL'} ${label}`); };

const svc = read('src/core/companies/companies.service.ts');
// isola o corpo de activateCompanyOperationally
const start = svc.indexOf('async activateCompanyOperationally');
const body = start >= 0 ? svc.slice(start, start + 4000) : '';

check('activateCompanyOperationally existe', start >= 0);
check('lê kyc_status do responsável (join users→identities)',
  /identities[\s\S]{0,120}kyc_status/.test(body) && /u\.global_user_id/.test(body));
check("exige kyc_status='approved' fail-closed",
  /kyc_status !== 'approved'|kyc_status!=='approved'/.test(body.replace(/\s+/g, ' ')) === false
    ? /kycRow[\s\S]{0,80}approved/.test(body)  // tolera formatação
    : true);
check("gate real: nega quando != 'approved'",
  /!==\s*'approved'/.test(body) || /!kycRow/.test(body));
check('erro COMPANY_ACTIVATION_REQUIRES_KYC (403)',
  /COMPANY_ACTIVATION_REQUIRES_KYC/.test(body) && /403/.test(body));
check('cita AUTHORITY_LAW Art.4.2 (rastreabilidade norma↔código)',
  /Art\.?\s*4\.2|AUTHORITY_LAW/.test(body));

if (fails.length) {
  console.error(`\nCOMPANY-ACTIVATION-KYC-GATE: ${fails.length} FAIL`);
  process.exit(1);
}
console.log('\nCOMPANY-ACTIVATION-KYC-GATE: OK — ativação exige KYC mínimo do responsável (Art.4.2).');
