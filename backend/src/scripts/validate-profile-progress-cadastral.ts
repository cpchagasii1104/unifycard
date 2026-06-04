/**
 * Prova DECISION-0095 / Profile Progress 1 — completude cadastral ≠ verificação fiscal.
 *
 * 🔒 SEM DB / SEM DML. Testa `coreService.calculateProfileProgress` em isolamento,
 *    stubando as duas dependências de leitura (getCompleteProfile + identityService.
 *    getIdentityProfile). Não abre conexão, não toca `unificard_dev`, não toca Bank.
 *
 * Invariantes provados:
 *   1. Perfil cadastral PF completo → progress === 100 SEM validação presencial,
 *      SEM empresa, SEM KYB.
 *   2. Empresa vinculada é INFORMATIVA (breakdown.companies) e NÃO altera o 100
 *      nem é requisito (PF chega a 100 sem ela).
 *   3. Sem teto de 80% (maxProgressWithoutValidation === 100).
 *   4. presentialValidation/hasPresentialValidation neutros (0/false) por compat.
 *   5. Nenhuma mensagem cita "presencial"/"loja parceira".
 *   6. Perfil parcial → mensagem cadastral neutra (sem presencial).
 */
import { coreService } from '../core/core.service';
import { identityService } from '../core/identity/identity.service';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const check = (label: string, ok: boolean, reason?: string) =>
  results.push({ label, ok, reason });

// --- Fixtures de getCompleteProfile (só os campos que o cálculo lê) ---
const fullCadastral = (withCompany: boolean) => ({
  personal_profile: { fullName: 'Fulano', cpf: '111', phone: '999', metadata: { gender: 'male' } },
  professional_profile: { skills: ['dev'], bio: 'bio viva' },
  physical_profile: { interests: ['musica'], lifestyle: { drinks: true } },
  companies: withCompany ? [{ company_id: 'c1' }] : [],
});

const partialPersonal = () => ({
  personal_profile: { fullName: 'Fulano', cpf: '111' }, // 10+10; +birthdate(identity) 10 = 30
  professional_profile: {},
  physical_profile: {},
  companies: [],
});

const personalPlusProfessional = () => ({
  personal_profile: { fullName: 'F', cpf: '1', phone: '9', metadata: { gender: 'x' } }, // 40 + birthdate 10 = 50
  professional_profile: { skills: ['a'], bio: 'b' }, // 30
  physical_profile: {}, // 0
  companies: [],
});

// stubs
const origGetComplete = (coreService as any).getCompleteProfile;
const origIdentity = (identityService as any).getIdentityProfile;
const stub = (profile: any, withIdentity = true) => {
  (coreService as any).getCompleteProfile = async () => profile;
  (identityService as any).getIdentityProfile = async () =>
    withIdentity ? { global: { birthdate: '1990-01-01', globalUserId: 'gid-1' } } : null;
};
const restore = () => {
  (coreService as any).getCompleteProfile = origGetComplete;
  (identityService as any).getIdentityProfile = origIdentity;
};

const noPresencial = (msgs: string[]) =>
  !msgs.some((m) => /presencial|loja parceira/i.test(m));

async function run() {
  // CASO 1 — cadastral completo, SEM empresa, SEM KYB → 100
  stub(fullCadastral(false));
  const r1 = await coreService.calculateProfileProgress('t', 'u');
  check('1.progress===100 sem empresa/KYB/presencial', r1.progress === 100, `progress=${r1.progress}`);
  check('1.maxProgressWithoutValidation===100 (sem teto 80)', r1.maxProgressWithoutValidation === 100, `max=${r1.maxProgressWithoutValidation}`);
  check('1.hasPresentialValidation===false (neutro)', r1.hasPresentialValidation === false);
  check('1.breakdown.presentialValidation===0 (neutro)', r1.breakdown.presentialValidation === 0);
  check('1.breakdown.companies===0 (sem empresa)', r1.breakdown.companies === 0);
  check('1.mensagem "Perfil cadastral completo."', r1.messages[0] === 'Perfil cadastral completo.', r1.messages.join('|'));
  check('1.nenhuma mensagem presencial', noPresencial(r1.messages));

  // CASO 2 — cadastral completo + empresa vinculada → ainda 100; companies informativo
  stub(fullCadastral(true));
  const r2 = await coreService.calculateProfileProgress('t', 'u');
  check('2.progress===100 mesmo com empresa', r2.progress === 100, `progress=${r2.progress}`);
  check('2.breakdown.companies===10 (informativo)', r2.breakdown.companies === 10, `companies=${r2.breakdown.companies}`);
  check('2.empresa NÃO é requisito nem somada (100 sem e com empresa)', r1.progress === 100 && r2.progress === 100);

  // CASO 3 — parcial (só fullName+cpf) → 20, mensagem inicial neutra
  stub(partialPersonal());
  const r3 = await coreService.calculateProfileProgress('t', 'u');
  check('3.progress===30 (parcial: fullName+cpf+birthdate)', r3.progress === 30, `progress=${r3.progress}`);
  check('3.mensagem inicial cadastral', r3.messages[0] === 'Complete seu perfil para acessar todos os recursos', r3.messages.join('|'));
  check('3.nenhuma mensagem presencial', noPresencial(r3.messages));

  // CASO 4 — 80 (personal 50 + professional 30, physical 0) → <100 com msg neutra (sem cap nem presencial)
  stub(personalPlusProfessional());
  const r4 = await coreService.calculateProfileProgress('t', 'u');
  check('4.progress===80 e NÃO travado (passa de 80 no caso 1)', r4.progress === 80, `progress=${r4.progress}`);
  check('4.mensagem <100 cadastral neutra', r4.messages[0] === 'Complete os dados cadastrais restantes para chegar a 100%', r4.messages.join('|'));
  check('4.nenhuma mensagem presencial', noPresencial(r4.messages));

  restore();

  // RELATÓRIO
  const pass = results.filter((r) => r.ok).length;
  const total = results.length;
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} — ${r.label}${r.ok ? '' : `  [${r.reason ?? ''}]`}`);
  }
  console.log(`\n${pass}/${total} ${pass === total ? 'OK ✅' : 'FALHOU ❌'}`);
  if (pass !== total) process.exit(1);
}

run().catch((e) => {
  restore();
  console.error('ERRO no teste:', e);
  process.exit(1);
});
