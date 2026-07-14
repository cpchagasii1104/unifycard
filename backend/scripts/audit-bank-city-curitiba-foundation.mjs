#!/usr/bin/env node
// audit-bank-city-curitiba-foundation.mjs — Guard consolidado B-CITY-1 (DECISION-0177).
//
// Congela a FUNDAÇÃO MUNICIPAL INERTE de Curitiba (comment-aware + liveness):
//   R · residência: money usa resolveActorTerritory(ACTOR_RESIDENCE); profile fallback PROIBIDO;
//       sem active_location/CEP/texto/sessão/cidade-do-cliente; infra propaga (nunca ausência).
//   C · Curitiba-only: UUID canônico server-side; sem env/nome/lista; outra cidade falha.
//   L · lookup-only: money path não provisiona; ausência = REGIONAL_FUND_ACCOUNT_NOT_PROVISIONED;
//       lookup por FKs (regional_fund_accounts), forma system/actor_id NULL validada.
//   P · paralelos: string regional fora da jurisdição territorial (transparência/consolidação
//       convergidas pra FK); split engine legado + workers permanecem gated; anti-revival.
//   O · one-shot: dry-run default/ROLLBACK real, token literal, hash de manifest fixo, advisory
//       lock, preflight fail-closed, tx única, rerun fail-closed, DML limitado às 2 casas, sem PII.
//   A · anti-money: zero policy regional criada, zero tx/split/ledger, sink/workers fechados,
//       zero fiscal/commission_distributable material, gross/net proibidos p/ linha regional futura.
//   F · fronteiras: Address/Social intocados, bairro HOLD, nacional trancado, N1 dormente.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const strip = (s) => s.split('\n').filter((l) => { const t = l.trim(); return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*'); }).join('\n');
const fails = [];
const note = (m) => fails.push(m);

const F = {
  SPE: 'src/modules/services/service-payment-execution.service.ts',
  BAS: 'src/modules/bank/bank-account.service.ts',
  ACT: 'src/modules/bank/regional-fund-city-activation.ts',
  TRA: 'src/core/unifybank/transparency.service.ts',
  CON: 'src/modules/bank/bank-balance-consolidation.service.ts',
  RESOLVER: 'src/core/location/actor-territorial-resolver.ts',
  ONESHOT: 'scripts/provision-curitiba-city-regional-fund-account.mjs',
  MANIFEST: 'scripts/manifests/curitiba-city-regional-fund-bootstrap.manifest.json',
  RUNNER: 'scripts/run-regression-guards.mjs',
  ENGINE: 'src/modules/economy/policy-engine/economic-policy-engine.service.ts',
};
const S = Object.fromEntries(Object.entries(F).map(([k, p]) => [k, { p, raw: read(p), s: strip(read(p)) }]));

// ── R · residência actor-scoped no money path ──
{
  const spe = S.SPE.s;
  if (!/await resolveActorTerritory\(tenantId, residenceActorId, 'ACTOR_RESIDENCE'\)/.test(spe))
    note('R1: money path não AGUARDA resolveActorTerritory(ACTOR_RESIDENCE) (sem await = promise nunca resolvida)');
  if (/findPrimaryAddressByOwner\(\s*'profile'/.test(spe))
    note('R2: fallback/leitura profile/RESIDENCE VOLTOU ao money path (proibido, DECISION-0177 D3)');
  if (/locationRepository/.test(spe))
    note('R3: locationRepository (casa profile) reimportado no pipeline de pagamento');
  if (/actor_active_location|active_location/.test(spe))
    note('R4: actor_active_location no money path');
  if (!/POLICY_REGIONAL_ORIGIN_UNRESOLVABLE[\s\S]{0,160}sem residência actor-scoped/.test(spe))
    note('R5: fail-closed de residência ausente (erro UNRESOLVABLE do bloco actor-scoped) sumiu');
  if (!/territory\.cityId/.test(spe) || !/if \(!territory\.cityId\)/.test(spe))
    note('R6: ausência de cityId da residência não falha fechada');
  // payer explícito: basis payer usa payerActorId, nunca receiver como fallback
  if (!/basis === 'payer_identity_residence' \? payerActorId : receiverActorId/.test(spe))
    note('R7: seleção payer/receiver por basis (sem troca de ponta) sumiu');
  // infra propaga: resolver canônico não engole erro (sem try/catch em volta da chamada)
  const seg = spe.slice(spe.indexOf("resolveActorTerritory(tenantId, residenceActorId"), spe.indexOf("resolveActorTerritory(tenantId, residenceActorId") + 400);
  if (/catch/.test(seg)) note('R8: erro de infraestrutura do resolver está sendo engolido (catch)');
  // cadeia territorial por FK (city→state→country), nunca texto
  if (!/FROM cities c JOIN states s ON s\.state_id = c\.state_id/.test(spe))
    note('R9: derivação da cadeia territorial por FK (Location Core) sumiu');
  const res = S.RESOLVER.s;
  if (!/owner_type = 'actor'/.test(res) || !/valid_until_at IS NULL/.test(res))
    note('R10: casa resolveActorTerritory deixou de ser actor-scoped/vigente');
}

// ── C · Curitiba-only ──
{
  const act = S.ACT.s;
  if (!/export const BANK_CITY_ENABLED_CITY_ID = '9d431002-1fd3-4b34-ae82-678f28f64288'/.test(act))
    note('C1: constante canônica de Curitiba ausente/alterada');
  if (/process\.env/.test(act)) note('C2: ativação territorial por env (proibido)');
  if (/'Curitiba'|"Curitiba"/.test(act)) note('C3: nome textual como decisão de ativação');
  if (!/cityId === BANK_CITY_ENABLED_CITY_ID/.test(act)) note('C4: comparação por UUID exato sumiu');
  const spe = S.SPE.s;
  if (!/isRegionalFundCityEnabled\(cityId\)/.test(spe) || !/REGIONAL_FUND_CITY_NOT_ENABLED/.test(spe))
    note('C5: trava Curitiba-only (REGIONAL_FUND_CITY_NOT_ENABLED) fora do pipeline');
  if (!/level === 'city' && !isRegionalFundCityEnabled\(cityId\)/.test(spe))
    note('C6: trava não é aplicada ao nível city antes do lookup');
}

// ── L · lookup-only no money path ──
{
  const spe = S.SPE.s;
  if (!/bankAccountService\.lookupRegionalFundAccount\(tenantId, scope\)/.test(spe))
    note('L1: pipeline não usa lookupRegionalFundAccount');
  if (/provisionRegionalFundAccountForBootstrap|ensureRegionalFundAccount|createAccount\(|upsert/i.test(spe))
    note('L2: money path cria/provisiona/upserta conta (auto-provision voltou)');
  if (!/if \(!fundAccount\) \{\s*throw new BadRequestError\(\s*`REGIONAL_FUND_ACCOUNT_NOT_PROVISIONED/.test(spe))
    note('L3: ausência de mapping deixou de LANÇAR (fail-open) — NOT_PROVISIONED deve ser throw imediato');
  const bas = S.BAS.s;
  const lk = bas.slice(bas.indexOf('async lookupRegionalFundAccount'), bas.indexOf('async provisionRegionalFundAccountForBootstrap'));
  if (!(lk.length > 0)) note('L4: par lookup/provision não existe ou perdeu a separação');
  if (!/FROM regional_fund_accounts rfa/.test(lk) || !/JOIN bank_accounts ba/.test(lk))
    note('L5: lookup não resolve por regional_fund_accounts (FK) + validação da conta');
  if (/INSERT|UPDATE|DELETE/i.test(lk.replace(/REGIONAL_FUND_ACCOUNT_(MALFORMED|DANGLING)[^`]*`/g, '')))
    note('L6: lookup deixou de ser SELECT-only');
  if (!/owner_type !== 'system' \|\| row\.actor_id !== null/.test(lk))
    note('L7: lookup não valida forma system/actor_id NULL (D5)');
  if ((lk.match(/IS NOT DISTINCT FROM/g) || []).length < 3 || !/rfa\.city_id IS NOT DISTINCT FROM/.test(lk))
    note('L8: shape territorial exato (country+state+city IS NOT DISTINCT FROM) frouxo no lookup');
  if (!/`SELECT rfa\.bank_account_id::text, ba\.owner_type/.test(lk) || /owner_id LIKE/.test(lk))
    note('L9: lookup deixou de selecionar do mapping FK (ou resolve por owner_id string)');
}

// ── P · paralelos/string fora da jurisdição territorial ──
{
  const tra = S.TRA.s;
  if (/getSystemAccount\([^)]*'regional_fund'/.test(tra))
    note("P1: transparência voltou a resolver fundo por string getSystemAccount('regional_fund')");
  if (!/resolveRegionalFundAccountIdViaMapping/.test(tra) || !/FROM regional_fund_accounts/.test(tra))
    note('P2: transparência não resolve via regional_fund_accounts (FK)');
  const con = S.CON.s;
  if (/getSystemAccount\([^)]*'regional_fund'/.test(con))
    note('P3: consolidação por região voltou à conta string tenant-level');
  if (!/FROM regional_fund_accounts/.test(con))
    note('P4: consolidação byRegion não itera o mapping canônico');
  if (/metadata\?\.regionId|\|\| tenantId/.test(con.slice(con.indexOf('balancesByRegion'))))
    note('P5: pseudo-região por metadata/tenant voltou à consolidação');
  // split engine legado permanece existente porém fora do caminho Bank City (gated pelo sink)
  const engineLegacy = read('src/modules/bank/bank-split-engine.service.ts');
  if (!/getSplitConfig/.test(engineLegacy))
    note('P6: split engine legado mudou de forma — reavaliar contenção (não deve virar caminho Bank City)');
  const spe = S.SPE.s;
  if (/getSystemAccount\([^)]*'regional_fund'/.test(spe))
    note('P7: pipeline de pagamento resolve fundo por string');
}

// ── O · one-shot governado ──
{
  const os = S.ONESHOT.s;
  if (!/CONFIRM_TOKEN = 'PROVISION_CURITIBA_CITY_REGIONAL_FUND_ACCOUNT'/.test(os))
    note('O1: token literal do apply ausente/alterado');
  if (!/APPLY && !CONFIRMED/.test(os)) note('O2: apply sem token não aborta');
  if (!/EXPECTED_MANIFEST_SHA256 = '[0-9a-f]{64}'/.test(os)) note('O3: hash fixo do manifest ausente');
  if (!/manifestSha !== EXPECTED_MANIFEST_SHA256/.test(os)) note('O4: verificação do hash do manifest sumiu');
  if (!/pg_advisory_xact_lock/.test(os)) note('O5: advisory lock sumiu');
  if (!/ROLLBACK/.test(os) || !/'BEGIN'/.test(os)) note('O6: transação única BEGIN/ROLLBACK sumiu');
  if (!/APPLY && CONFIRMED[\s\S]{0,120}?COMMIT/.test(os)) note('O7: COMMIT sem dupla confirmação');
  if (!/conta regional Curitiba INEXISTENTE/.test(S.ONESHOT.raw) || !/mapping Curitiba INEXISTENTE/.test(S.ONESHOT.raw))
    note('O8: preflight de rerun (conta E mapping inexistentes) sumiu — rerun deixaria de ser fail-closed');
  if (!/\} else \{\s*await client\.query\('ROLLBACK'\);/.test(S.ONESHOT.raw))
    note('O21: dry-run deixou de executar ROLLBACK real (virou log?)');
  if (!/VALUES \(\$1, 'system', \$2, NULL, \$3\)\s*RETURNING/.test(S.ONESHOT.raw))
    note('O22: INSERT da conta deixou de ser tupla ÚNICA na forma governada');
  if (!/VALUES \(\$1, 'city', \$2, \$3, \$4, NULL, \$5\)`/.test(S.ONESHOT.raw))
    note('O23: INSERT do mapping deixou de ser tupla ÚNICA city/neighborhood NULL');
  if (/process\.argv[\s\S]{0,200}manifest/i.test(os)) note('O9: caminho de manifest por CLI (proibido)');
  if (/INSERT INTO (?!bank_accounts|regional_fund_accounts)/.test(os))
    note('O10: one-shot insere fora das 2 casas autorizadas');
  if (/INSERT INTO (bank_ledger|bank_transactions|bank_splits|economic_polic)/.test(os))
    note('O11: one-shot toca dinheiro/policy (proibido)');
  if (!/'system', \$2, NULL/.test(os.replace(/\s+/g, ' ')) && !/'system',\s*\$2,\s*NULL/.test(os))
    note('O12: conta criada sem forma system/actor_id NULL');
  if (/cpf|CPF/.test(os)) note('O13: PII no one-shot');
  // hash real do manifest bate com o embutido
  const realSha = createHash('sha256').update(read(F.MANIFEST)).digest('hex');
  const embedded = (S.ONESHOT.raw.match(/EXPECTED_MANIFEST_SHA256 = '([0-9a-f]{64})'/) || [])[1];
  if (realSha !== embedded) note(`O14: manifest divergente do hash embutido (${realSha} ≠ ${embedded})`);
  const man = JSON.parse(read(F.MANIFEST));
  if (man.city_id !== '9d431002-1fd3-4b34-ae82-678f28f64288') note('O15: manifest não aponta Curitiba canônica');
  if (man.scope_level !== 'city' || man.neighborhood_id !== null) note('O16: manifest fora do escopo city (bairro?)');
  if (man.account.owner_type !== 'system' || man.account.actor_id !== null) note('O17: forma da conta no manifest violada');
  if (man.authority_source !== 'platform_bootstrap') note('O18: authority_source ausente/errada');
  if ('balance' in (man.account || {}) || /saldo|seed/i.test(JSON.stringify(man.expected_baselines)))
    note('O19: manifest carrega saldo/seed');
}

// ── A · anti-money (fundação é INERTE) ──
{
  const os = S.ONESHOT.s;
  if (!/bank_transactions=0|bank_transactions'\)\)\) === 0/.test(S.ONESHOT.raw))
    note('A1: preflight não exige tx=0');
  const spe = S.SPE.s;
  // linha regional futura: engine não ganhou base fiscal escondida
  const eng = S.ENGINE.s;
  if (/commission_distributable|tax_reserve/.test(eng))
    note('A2: base fiscal apareceu no engine fora do envelope 4d (proibido em B-CITY-1)');
  if (/commission_distributable/.test(spe)) note('A3: base fiscal no pipeline (B-CITY-2 bloqueada)');
}

// ── F · fronteiras ──
{
  const spe = S.SPE.s;
  if (/audience_city_id|posts\./.test(spe)) note('F1: Social vazou para o money path');
  if (/neighborhoodId!|scope_level = .neighborhood/.test(spe)) note('F2: bairro entrou no pipeline');
  const bas = S.BAS.s;
  if (!/REGIONAL_FUND_NEIGHBORHOOD_HOLD/.test(bas)) note('F3: HOLD de bairro sumiu do provisioner');
  if (!/if \(level === 'neighborhood'\) \{/.test(spe) || !/REGIONAL_FUND_NEIGHBORHOOD_HOLD/.test(spe))
    note('F3b: HOLD de bairro sumiu do pipeline (nível neighborhood entraria)');
  // runner contém os 4 guards da frente
  const runner = S.RUNNER.s;
  for (const g of ['audit-regional-fund-fk-canonical', 'audit-policy-immutability-and-split-snapshot', 'audit-bank-split-pipeline-consolidation', 'audit-bank-city-curitiba-foundation']) {
    if (!runner.includes(g + '.mjs')) note(`F4: guard ${g} fora do runner`);
  }
  // Address writer intocado: money path não escreve address_assignments
  if (/INSERT INTO address_assignments|UPDATE address_assignments/i.test(spe))
    note('F5: money path escreve residência (proibido)');
}

if (fails.length) {
  console.error(`\nGATE FAIL [bank-city-curitiba-foundation]:`);
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [bank-city-curitiba-foundation] — fundação municipal inerte B-CITY-1 (DECISION-0177): money path resolve residência SÓ por resolveActorTerritory(ACTOR_RESIDENCE) (profile/active_location/CEP/cliente proibidos; infra propaga; cadeia territorial por FK); Curitiba-only por UUID canônico server-side (sem env/nome/lista; outra cidade = REGIONAL_FUND_CITY_NOT_ENABLED); resolução cidade→conta LOOKUP-ONLY em regional_fund_accounts (SELECT-only, forma system/actor_id NULL, shape exato; ausência = REGIONAL_FUND_ACCOUNT_NOT_PROVISIONED antes de qualquer write; provisionar no pagamento PROIBIDO); string regional fora da jurisdição territorial (transparência/consolidação por FK; legados gated); one-shot governado (dry-run/ROLLBACK, token literal, manifest hash-fixo, advisory lock, preflight/rerun fail-closed, DML limitado a bank_accounts+regional_fund_accounts, sem PII, sem saldo); fundação INERTE (zero policy/tx/split/ledger; base fiscal 4d trancada); fronteiras Address/Social/bairro/nacional/N1 preservadas. (Comment-aware + liveness.)');
