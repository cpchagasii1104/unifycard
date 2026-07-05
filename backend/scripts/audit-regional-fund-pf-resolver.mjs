#!/usr/bin/env node
// Guard estrutural — F-REGIONAL-FUND-PF-RESOLVER (Fatia 9 passo 3, decision pack PORTA-1, GO de
// Clayton via AskUserQuestion: "resolver PF também agora"). Fecha DT-PE5-PF-RESOLVER-PENDING.
//
// ANTES: `resolveRegionalFundDestination` fail-closed IMEDIATO (POLICY_BASIS_UNSUPPORTED_MVP)
// pra `payer_identity_residence`/`receiver_identity_residence` — PF nunca resolvia fundo regional.
// AGORA: resolve via `address_assignments(owner_type='profile', role='RESIDENCE')` — o MESMO SSOT
// já usado por `profile-residence-address.service.ts` (DECISION-0074) — nunca duplica a fonte de
// endereço civil. Sem residência cadastrada, AINDA falha fechado (POLICY_REGIONAL_ORIGIN_
// UNRESOLVABLE), só que porque falta o dado, não porque o caminho está bloqueado por design.
//
// MORDE:
//   (A) o branch PF voltar a lançar POLICY_BASIS_UNSUPPORTED_MVP incondicionalmente (regressão pra
//       antes desta fatia);
//   (B) o resolver PF parar de chamar locationRepository.findPrimaryAddressByOwner('profile', ...,
//       'RESIDENCE') (duplicaria a fonte de endereço civil em vez de reusar);
//   (C) `payer_identity_residence` resolver pro actor ERRADO (receiver) ou vice-versa — a ponta
//       declarada pelo basis tem que ser a ponta usada, nunca a outra como atalho;
//   (D) `resolveSplitDestinationFromPolicy`/`resolveRegionalFundDestination` perderem o parâmetro
//       `payerActorId` (sem ele, o basis payer_identity_residence não tem como resolver).
// Em validate:regression-guards. Heurística textual comment-stripped. NÃO altera runtime.

import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const FILE = join(ROOT, 'src', 'modules', 'services', 'service-payment-execution.service.ts');
const raw = readFileSync(FILE, 'utf-8');
const src = stripTs(raw);

const failures = [];
const check = (label, ok) => { if (!ok) failures.push(label); console.log(`  ${ok ? 'OK ' : 'FAIL'} ${label}`); };

// (D) payerActorId chegou nas duas assinaturas.
check('resolveSplitDestinationFromPolicy(tenantId, payerActorId, receiverActorId, ...) — payerActorId presente',
  /async function resolveSplitDestinationFromPolicy\(\s*\n\s*tenantId: string,\s*\n\s*payerActorId: string,\s*\n\s*receiverActorId: string/.test(src));
check('resolveRegionalFundDestination(tenantId, payerActorId, receiverActorId, ...) — payerActorId presente',
  /async function resolveRegionalFundDestination\(\s*\n\s*tenantId: string,\s*\n\s*payerActorId: string,\s*\n\s*receiverActorId: string/.test(src));

// (A) o branch PF resolve de verdade — não lança UNSUPPORTED_MVP incondicional.
const pfBranchMatch = src.match(/if \(basis === 'payer_identity_residence' \|\| basis === 'receiver_identity_residence'\) \{[\s\S]{0,1000}?\r?\n {2}\} else if/);
check("branch PF existe e NÃO lança POLICY_BASIS_UNSUPPORTED_MVP incondicionalmente (resolve de verdade)",
  !!pfBranchMatch && !/POLICY_BASIS_UNSUPPORTED_MVP/.test(pfBranchMatch[0]));

// (B) reusa o SSOT de residência civil — nunca duplica a fonte.
check("branch PF chama locationRepository.findPrimaryAddressByOwner('profile', ..., 'RESIDENCE') — reusa o SSOT de DECISION-0074",
  !!pfBranchMatch && /findPrimaryAddressByOwner\('profile', residenceActorId, 'RESIDENCE'\)/.test(pfBranchMatch[0]));

// (C) a ponta certa é usada — payer_identity_residence usa payerActorId, receiver usa receiverActorId.
check("branch PF escolhe a ponta certa (payer_identity_residence→payerActorId, receiver_identity_residence→receiverActorId) — nunca a outra como atalho",
  !!pfBranchMatch && /residenceActorId = basis === 'payer_identity_residence' \? payerActorId : receiverActorId/.test(pfBranchMatch[0]));

// sem residência → fail-closed explícito (não silencia, não adivinha).
check('branch PF sem residência cadastrada → POLICY_REGIONAL_ORIGIN_UNRESOLVABLE (fail-closed, não adivinha)',
  !!pfBranchMatch && /POLICY_REGIONAL_ORIGIN_UNRESOLVABLE/.test(pfBranchMatch[0]));

// import correto (composição — reusa o repository do Location Core, não SQL novo).
check("import locationRepository de '@core/location/location.repository' (composição, sem SQL novo)",
  /import \{ locationRepository \} from '@core\/location\/location\.repository';/.test(src));

// call-site atualizado.
check('call-site passa paymentRequest.payerActorId (não só receiverActorId)',
  /resolveSplitDestinationFromPolicy\(\s*\n\s*tenantId,\s*\n\s*paymentRequest\.payerActorId,\s*\n\s*paymentRequest\.receiverActorId/.test(src));

if (failures.length) {
  console.error(`\nREGIONAL-FUND-PF-RESOLVER: ${failures.length} FAIL`);
  process.exit(1);
}
console.log('\nREGIONAL-FUND-PF-RESOLVER: OK');
