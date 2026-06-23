#!/usr/bin/env node
// Guard — F-IDENTITY-CIVIL-LOCK-PROFILE-WRITER-PURITY (DECISION-0120 D6).
//
// SSOT civil = camada identity: global_users.full_name + identity_civil_confirmation_events (evento
// append-only 'civil_data_confirmed'). `profiles` é PROJEÇÃO não-soberana; `profiles.metadata`
// (personal_data_locked / profile_personal_confirmed) é tombstone/legado e NUNCA decide a trava civil.
//
// MORDE se o split-brain voltar: (1) profile.service gatear escrita de campo civil pela metadata em vez
// de delegar à autoridade identity; (2) a camada identity (autoridade) passar a ler flags civis de profiles;
// (3) o frontend ler `personal_data_locked` cru p/ decidir a trava (deve projetar a verdade do backend).

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const read = (rel) => {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, 'utf-8') : null;
};

const failures = [];

// ── RULE 1: profile.service.upsertProfile deriva a trava civil da AUTORIDADE identity (canEditPersonalData),
//    não de profiles.metadata. O padrão split-brain removido NÃO pode voltar.
const PROFILE_SVC = 'src/core/profile/profile.service.ts';
const ps = read(PROFILE_SVC);
if (ps === null) {
  failures.push(`${PROFILE_SVC}: arquivo ausente.`);
} else {
  // padrão proibido (split-brain): a var que gateia o write civil vinda de metadata.personal_data_locked.
  if (/personalDataLocked\s*=\s*(existingMetadata|[\w.]*metadata)\??\.\s*personal_data_locked/.test(ps)) {
    failures.push(
      `${PROFILE_SVC}: trava civil derivada de profiles.metadata.personal_data_locked (split-brain). ` +
      `Deve delegar à autoridade identity: const personalDataLocked = !(await this.canEditPersonalData(...)). DECISION-0120 D6.`
    );
  }
  // delegação à autoridade identity precisa existir (canEditPersonalData → identityCivilConfirmationService).
  if (!/canEditPersonalData/.test(ps) || !/identityCivilConfirmationService|identity-civil-confirmation/.test(ps)) {
    failures.push(`${PROFILE_SVC}: sem delegação da trava civil à camada identity (canEditPersonalData/identityCivilConfirmationService).`);
  }
}

// ── RULE 2: a camada identity (AUTORIDADE) não pode consultar flags civis de profiles.metadata.
const AUTHORITY_FILES = [
  'src/core/identity/identity.service.ts',
  'src/core/identity/identity-civil-confirmation.service.ts',
];
for (const rel of AUTHORITY_FILES) {
  const s = read(rel);
  if (s === null) { failures.push(`${rel}: arquivo ausente.`); continue; }
  if (/personal_data_locked|profile_personal_confirmed/.test(s)) {
    failures.push(
      `${rel}: autoridade civil lendo flag de profiles (personal_data_locked/profile_personal_confirmed). ` +
      `A trava civil é o evento identity_civil_confirmation_events — profiles NÃO é fonte.`
    );
  }
}

// ── RULE 3: frontend não pode ler `personal_data_locked` cru p/ decidir a trava (projeta a verdade do backend).
const FRONT = 'frontend/src/components/Profile.tsx';
const fp = read('../' + FRONT) ?? read(join('..', FRONT));
// ROOT é backend/; o frontend está em ../frontend. Resolve relativo ao repo.
const frontAbs = join(ROOT, '..', 'frontend/src/components/Profile.tsx');
const front = existsSync(frontAbs) ? readFileSync(frontAbs, 'utf-8') : fp;
if (front && /personal_data_locked/.test(front)) {
  failures.push(
    `${FRONT}: referência a personal_data_locked (metadata cru). O frontend deve projetar a editabilidade ` +
    `autoritativa do backend (canEditPersonalData), não ler/decidir a trava por metadata.`
  );
}

if (failures.length > 0) {
  console.error('GATE FAIL [civil-lock-identity-authority]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [civil-lock-identity-authority] — trava civil decidida pela camada identity (evento append-only); profile.service delega (não lê metadata como autoridade); identity não consulta flags de profiles; frontend não lê personal_data_locked cru. DECISION-0120 D6.');
