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
// B-CITY-1 (DECISION-0177): resolveRegionalFundDestination ganhou `export` para prova direta
// sob teste/ROLLBACK; a assinatura payer/receiver permanece a mesma.
check('resolveRegionalFundDestination(tenantId, payerActorId, receiverActorId, ...) — payerActorId presente',
  /(?:export )?async function resolveRegionalFundDestination\(\s*\n\s*tenantId: string,\s*\n\s*payerActorId: string,\s*\n\s*receiverActorId: string/.test(src));

// (A) o branch PF resolve de verdade — não lança UNSUPPORTED_MVP incondicional.
const pfBranchMatch = src.match(/if \(basis === 'payer_identity_residence' \|\| basis === 'receiver_identity_residence'\) \{[\s\S]{0,2400}?\r?\n {2}\} else if/);
check("branch PF existe e NÃO lança POLICY_BASIS_UNSUPPORTED_MVP incondicionalmente (resolve de verdade)",
  !!pfBranchMatch && !/POLICY_BASIS_UNSUPPORTED_MVP/.test(pfBranchMatch[0]));

// (B) reusa o SSOT canônico de residência — nunca duplica a fonte.
// RECONCILIAÇÃO CONSCIENTE B-CITY-1 (DECISION-0177 D2/D3, fecha
// DT-BANK-REGIONAL-ORIGIN-PROFILE-ACTOR-DIVERGENCE): a casa de residência do money path
// CONVERGIU de profile/RESIDENCE (DECISION-0074, legado preservado fora do money) para a casa
// actor-scoped selada resolveActorTerritory(ACTOR_RESIDENCE). O invariante (SSOT único,
// fail-closed, ponta certa) está PRESERVADO — só a casa mudou, por decisão selada.
check("branch PF resolve via resolveActorTerritory(tenantId, residenceActorId, 'ACTOR_RESIDENCE') — casa actor-scoped selada (DECISION-0177)",
  !!pfBranchMatch && /await resolveActorTerritory\(tenantId, residenceActorId, 'ACTOR_RESIDENCE'\)/.test(pfBranchMatch[0]));
check('branch PF NÃO regride para profile/RESIDENCE (proibido no money path, DECISION-0177 D3)',
  !!pfBranchMatch && !/findPrimaryAddressByOwner\(\s*'profile'/.test(pfBranchMatch[0]));

// (C) a ponta certa é usada — payer_identity_residence usa payerActorId, receiver usa receiverActorId.
check("branch PF escolhe a ponta certa (payer_identity_residence→payerActorId, receiver_identity_residence→receiverActorId) — nunca a outra como atalho",
  !!pfBranchMatch && /residenceActorId = basis === 'payer_identity_residence' \? payerActorId : receiverActorId/.test(pfBranchMatch[0]));

// sem residência → fail-closed explícito (não silencia, não adivinha).
check('branch PF sem residência cadastrada → POLICY_REGIONAL_ORIGIN_UNRESOLVABLE (fail-closed, não adivinha)',
  !!pfBranchMatch && /POLICY_REGIONAL_ORIGIN_UNRESOLVABLE/.test(pfBranchMatch[0]));

// import correto (composição — reusa a casa canônica do Location Core, não SQL paralelo).
// RECONCILIAÇÃO B-CITY-1: locationRepository (casa profile) saiu do pipeline; a composição
// agora é com resolveActorTerritory (casa actor-scoped selada).
check("import resolveActorTerritory de '@core/location/actor-territorial-resolver' (composição da casa selada)",
  /import \{ resolveActorTerritory \} from '@core\/location\/actor-territorial-resolver';/.test(src));
check('locationRepository (casa profile) NÃO é importado pelo pipeline de pagamento',
  !/import \{ locationRepository \}/.test(src));

// call-site atualizado.
check('call-site passa paymentRequest.payerActorId (não só receiverActorId)',
  /resolveSplitDestinationFromPolicy\(\s*\n\s*tenantId,\s*\n\s*paymentRequest\.payerActorId,\s*\n\s*paymentRequest\.receiverActorId/.test(src));

if (failures.length) {
  console.error(`\nREGIONAL-FUND-PF-RESOLVER: ${failures.length} FAIL`);
  process.exit(1);
}
console.log('\nREGIONAL-FUND-PF-RESOLVER: OK');
