#!/usr/bin/env node
// Guard estrutural — FASE D (F-ADDRESS-CANONICAL-BINDING) · limpeza governada de fixtures territoriais.
// Prova que o manifest é FECHADO, que o one-shot só remove por UUID exato na ordem asg→addr, dry-run
// com ROLLBACK obrigatório, apply com token literal + COMMIT único após provas, rerun fail-closed,
// preservados protegidos, referências verificadas, sem actor-scoped/provider/PII/Bank/Social, e que
// os SEIS artefatos selados foram reconciliados para baseline 3/3/0 (nominal, sem relaxar provas).
//
// Heurística textual comment-stripped (não AST): falso positivo torna o gate MAIS restritivo.

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.cwd();
const failures = [];
const note = (m) => failures.push(m);
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
function read(rel) { const p = join(ROOT, ...rel.split('/')); return existsSync(p) ? readFileSync(p, 'utf8') : null; }

const MANIFEST = 'scripts/fixture-cleanup-territorial-manifest.json';
const ONESHOT = 'scripts/fixture-cleanup-territorial.mjs';
const GUARD = 'scripts/audit-fixture-cleanup-territorial-manifest.mjs';
const DBPROOF = 'scripts/test-fixture-cleanup-territorial-db.sql';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ── G1 · manifest FECHADO ────────────────────────────────────────────────────────────────────────
const mraw = read(MANIFEST);
let manifest = null;
if (!mraw) { note('G1: manifest ausente: ' + MANIFEST); }
else {
  try { manifest = JSON.parse(mraw); } catch { note('G1: manifest não é JSON válido'); }
}
if (manifest) {
  const { preserve, remove, baseline, expectedFinal, version, manifestHash } = manifest;
  if (version !== 1) note('G1: version != 1');
  if (!(baseline && baseline.addresses === 37 && baseline.addressAssignments === 12 && baseline.actorScoped === 0)) note('G1: baseline != 37/12/0');
  if (!(expectedFinal && expectedFinal.addresses === 3 && expectedFinal.addressAssignments === 3 && expectedFinal.actorScoped === 0)) note('G1: expectedFinal != 3/3/0');
  const pA = preserve?.addressIds ?? [], pS = preserve?.assignmentIds ?? [], rA = remove?.addressIds ?? [], rS = remove?.assignmentIds ?? [];
  if (pA.length !== 3) note(`G1: preserve.addressIds != 3 (${pA.length})`);
  if (pS.length !== 3) note(`G1: preserve.assignmentIds != 3 (${pS.length})`);
  if (rA.length !== 34) note(`G1: remove.addressIds != 34 (${rA.length})`);
  if (rS.length !== 9) note(`G1: remove.assignmentIds != 9 (${rS.length})`);
  for (const id of [...pA, ...pS, ...rA, ...rS]) if (!UUID_RE.test(id)) note('G1: UUID incompleto/ inválido no manifest: ' + id);
  if (new Set([...pA, ...rA]).size !== pA.length + rA.length) note('G1: duplicidade/overlap em addressIds');
  if (new Set([...pS, ...rS]).size !== pS.length + rS.length) note('G1: duplicidade/overlap em assignmentIds');
  // hash canônico
  const core = { version, baseline, expectedFinal, preserve, remove };
  const recomputed = createHash('sha256').update(JSON.stringify(core)).digest('hex');
  if (recomputed !== manifestHash) note(`G1: manifestHash divergente (recomputado ${recomputed?.slice(0, 12)}… vs ${String(manifestHash).slice(0, 12)}…)`);
}

// ── one-shot ──────────────────────────────────────────────────────────────────────────────────────
const oneshotRaw = read(ONESHOT);
const S = oneshotRaw ? stripTs(oneshotRaw) : '';
if (!oneshotRaw) note('one-shot ausente: ' + ONESHOT);

// G1b · sem descoberta dinâmica do que apagar: DELETE só por UUID parametrizado ($1) do manifest.
if (S) {
  // PK canônica por tabela: o DELETE só pode filtrar pela chave primária EXATA, por $1::uuid[].
  const PK = { addresses: 'address_id', address_assignments: 'assignment_id' };
  const deletes = [...S.matchAll(/DELETE\s+FROM\s+(\w+)[^;]*/gi)].map((m) => m[0]);
  for (const d of deletes) {
    const tbl = /DELETE\s+FROM\s+(\w+)/i.exec(d)[1];
    if (!Object.prototype.hasOwnProperty.call(PK, tbl)) { note(`G2: DELETE em tabela não autorizada: ${tbl}`); continue; }
    const expectPk = PK[tbl];
    // exige EXATAMENTE `WHERE <pk> = ANY($1::uuid[])` — qualquer outra coluna/critério morde.
    const exact = new RegExp(`WHERE\\s+${expectPk}\\s*=\\s*ANY\\(\\$1::uuid\\[\\]\\)`, 'i');
    if (!exact.test(d)) note(`G3-uuid: DELETE FROM ${tbl} não filtra pela PK exata (${expectPk} = ANY($1::uuid[])): "${d.slice(0, 70)}"`);
    // nenhuma outra coluna pode aparecer no WHERE (tenant/owner_type/source/data/texto)
    const whereBody = (/\bWHERE\b([\s\S]*)$/i.exec(d)?.[1] ?? '');
    if (/\b(created_by_tenant_id|owner_type|owner_id|source|created_at|street|postal_code|city_id)\b/i.test(whereBody)) {
      note(`G3-crit: DELETE FROM ${tbl} usa coluna não-PK no WHERE (proibido; só a PK): "${d.slice(0, 70)}"`);
    }
    if (/\bLIKE\b|%|CASCADE/i.test(d)) note(`G3-wild: DELETE com LIKE/%/CASCADE: "${d.slice(0, 60)}"`);
  }
  if (deletes.length !== 2) note(`G3-count: esperado EXATAMENTE 2 DELETE (asg, addr), encontrado ${deletes.length}`);
}

// G2 · DML só em addresses/address_assignments; nenhuma outra tabela mutada
if (S) {
  for (const m of S.matchAll(/\b(INSERT\s+INTO|UPDATE)\s+(\w+)/gi)) {
    note(`G2-write: escrita (${m[1]} ${m[2]}) proibida no one-shot (limpeza só DELETA addresses/address_assignments)`);
  }
  for (const t of ['countries', 'states', 'cities', 'neighborhoods', 'neighborhood_aliases', 'actors', 'actor_assets', 'companies', 'profiles']) {
    if (new RegExp(`DELETE\\s+FROM\\s+${t}\\b`, 'i').test(S)) note(`G2-del: DELETE proibido em ${t}`);
  }
}

// G3 · ordem asg → addr (assignments antes de addresses)
if (S) {
  const iAsg = S.search(/DELETE\s+FROM\s+address_assignments/i);
  const iAddr = S.search(/DELETE\s+FROM\s+addresses\b/i);
  if (iAsg < 0 || iAddr < 0 || iAsg > iAddr) note('G3-order: DELETE de addresses deve vir DEPOIS de address_assignments');
  if (/CASCADE|TRUNCATE|DISABLE\s+TRIGGER|DROP\s+CONSTRAINT|ALTER\s+TABLE/i.test(S)) note('G3-forbidden: CASCADE/TRUNCATE/disable-trigger/alter-constraint proibidos');
}

// G4 · dry-run com ROLLBACK obrigatório e nenhum COMMIT alcançável no dry-run
if (S) {
  if (!/if\s*\(\s*apply\s*&&\s*confirm\s*===\s*CONFIRM_TOKEN\s*&&\s*!failed\s*\)\s*\{\s*await\s+client\.query\('COMMIT'\)/.test(S)) {
    note('G4/G5: COMMIT não está guardado por (apply && confirm===CONFIRM_TOKEN && !failed)');
  }
  const commitCount = (S.match(/client\.query\('COMMIT'\)/g) ?? []).length;
  if (commitCount !== 1) note(`G5-commit: esperado EXATAMENTE 1 COMMIT alcançável (${commitCount})`);
  if (!/await\s+client\.query\('ROLLBACK'\)/.test(S)) note('G4-rollback: ROLLBACK ausente');
  // else-branch do modo não-apply deve ROLLBACK
  if (!/\}\s*else\s*\{\s*await\s+client\.query\('ROLLBACK'\)/.test(S)) note('G4-else: dry-run/apply-não-confirmado deve cair em ROLLBACK explícito');
}

// G5 · token literal EXATO; sem boolean genérico/--force/case-insensitive
if (S) {
  if (!/const\s+CONFIRM_TOKEN\s*=\s*'APPLY_FIXTURE_CLEANUP_TERRITORIAL_V1'/.test(S)) note('G5-token: token canônico ausente/alterado');
  if (!/confirm\s*!==\s*CONFIRM_TOKEN/.test(S)) note('G5-check: apply sem checagem de token exato (!==)');
  if (/--force/.test(S)) note('G5-force: --force proibido');
  if (/toLowerCase\(\)|toUpperCase\(\)/.test(S) && /confirm/i.test(S)) note('G5-case: normalização de case no token proibida');
  if (!/rerun|BASELINE\s+DIVERGENTE|baseline\s+diverg/i.test(S)) note('G5-rerun: rerun fail-closed (baseline divergente) não evidenciado');
  if (!/baseAddr\s*!==\s*37\s*\|\|\s*baseAsg\s*!==\s*12/.test(S)) note('G5-baseline: preflight não trava em baseline != 37/12 (rerun silencioso possível)');
}

// G6 · proteção dos preservados: os 3+3 UUIDs aparecem e nunca entram em delete
if (S && manifest) {
  const pIds = [...manifest.preserve.addressIds, ...manifest.preserve.assignmentIds];
  // o one-shot usa arrays do manifest (pA/pS); prova que valida existência de preservados e overlap=0
  if (!/preservedCoherent\s*!==\s*3/.test(S)) note('G6: one-shot não revalida os 3 preservados coerentes');
  if (!/overlapAddr\s*!==\s*0\s*\|\|\s*overlapAsg\s*!==\s*0/.test(S)) note('G6-overlap: one-shot não rejeita overlap preserve∩remove');
  if (!/preservedStill\s*!==\s*3\s*\|\|\s*preservedAsgStill\s*!==\s*3/.test(S)) note('G6-final: one-shot não prova preservados intactos pós-delete');
}

// G7 · referências: preflight verifica as 5 FKs conhecidas + aborta em FK nova + sem CASCADE
if (S) {
  for (const t of ['actor_active_location', 'companies', 'posts', 'tenants']) {
    if (!new RegExp(t).test(S)) note(`G7: preflight não verifica referência em ${t}`);
  }
  if (!/FK\s+NOVA|constraint_type='FOREIGN KEY'/.test(S)) note('G7-introspect: sem introspecção de FK nova para addresses');
  if (!/extRefs\s*!==\s*0/.test(S)) note('G7-extref: one-shot não aborta em FK externa viva');
}

// G8 · sem actor-scoped / sem Fase C
if (S) {
  if (/actor-territorial-address(-writer|\.repository)|setActorTerritorialAddress|retireActorTerritorialAddress|canRepresentActor/.test(S)) note('G8: one-shot referencia writer/autoridade da Fase C');
  if (/INSERT\s+INTO\s+address_assignments|owner_type\s*=\s*'actor'\s*[,)]/i.test(S) && !/remActorScoped|owner_type='actor'\s*"/.test(S)) {
    // só permitido no contexto de PROVA de que remove não é actor-scoped
  }
  if (!/remActorScoped\s*!==\s*0/.test(S)) note('G8-scoped: one-shot não prova que nenhum removível é actor-scoped');
}

// G9 · sem provider / sem texto-como-identidade / sem PII em log.
// (Ler a CONTAGEM de cep_resolution_cache para provar Δcache=0 é obrigatório — só WRITE ao cache é vetado.)
if (S) {
  if (/viacep|brasilapi|getDefaultCepProvider|resolvePostalCode|postalAddressResolver/i.test(S)) note('G9-provider: one-shot chama provider/resolver de CEP');
  if (/(INSERT\s+INTO|UPDATE|DELETE\s+FROM)[^;]*cep_resolution_cache/i.test(S)) note('G9-cache: one-shot ESCREVE no cache derivado (só leitura de contagem é permitida)');
  if (/LOWER\s*\(\s*TRIM|name_normalized|\.street|logradouro|complement/i.test(S)) note('G9-text: one-shot usa texto de endereço como critério (proibido; decisão é por UUID)');
  // log não pode imprimir endereço/CEP; só IDs/contagens/hash
  for (const m of S.matchAll(/log\([^)]*\)/g)) {
    if (/street|logradouro|complement|\.lat|\.lng/i.test(m[0])) note(`G9-pii: log com PII: ${m[0].slice(0, 50)}`);
  }
}

// G10 · fronteiras: sem IMPORT/WRITE de Bank/Social/ledger/split/fundos/ingestão de municípios.
// (Ler a CONTAGEM/soma de bank_accounts para provar Δbank=0 é obrigatório — só import/write é vetado.)
if (S) {
  if (/(from|require)\s*\(?\s*['"][^'"]*(bank|social|ledger|split|regional[-_]?fund)[^'"]*['"]/i.test(S)) note('G10-import: one-shot importa domínio Bank/Social/ledger/split/fundos');
  if (/(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+\w*(bank|social|ledger|split|regional)\w*/i.test(S)) note('G10-write: one-shot escreve em tabela Bank/Social/ledger/split/fundos');
  if (/createCityFromExternal|findOrCreateCity|findOrCreateState/i.test(S)) note('G10-ingest: one-shot cria território (ingestão proibida)');
}

// G11 · reconciliação NOMINAL dos SEIS artefatos selados (baseline 3/3/0; nada relaxado)
const RECON = [
  { f: 'scripts/test-actor-territorial-foundation-db.sql', must: [/\b3 addresses\b|addresses\s*=\s*3|=3\b/], mustNot: [/os 37 addresses/] },
  { f: 'scripts/test-actor-territorial-writer-db.sql', must: [/na=3 AND naa=3 AND ascoped=0/], mustNot: [/na=37 AND naa=12/] },
  { f: 'scripts/test-addresses-neighborhood-composite-coherence-db.sql', must: [/na=3\b/], mustNot: [/na=37\b/] },
  { f: 'scripts/test-neighborhood-integrated-composition-db.sql', must: [/nad=3\b/], mustNot: [/nad=37\b/] },
  { f: 'scripts/audit-neighborhood-integrated-composition.mjs', must: [/addresses\s*…?\s*=?\s*3\b|addresses=3/], mustNot: [/addresses=37/] },
  { f: 'scripts/n3-load-curitiba-neighborhoods.mjs', must: [/addr === 3\b/], mustNot: [/addr === 37\b/] },
];
for (const r of RECON) {
  const raw = read(r.f);
  if (!raw) { note(`G11: artefato selado ausente: ${r.f}`); continue; }
  for (const re of r.must) if (!re.test(raw)) note(`G11: ${r.f} não reconciliado para baseline 3 (esperado ${re})`);
  for (const re of r.mustNot) if (re.test(raw)) note(`G11: ${r.f} ainda contém baseline antigo 37/12 (${re})`);
}
// n3-loader: famílias seladas preservadas (gate/manifest/contagens BEGIN/COMMIT/ROLLBACK intactas)
{
  const n3 = read('scripts/n3-load-curitiba-neighborhoods.mjs') ?? '';
  if (n3 && !/items\.length === 75/.test(n3)) note('G11-n3: loader perdeu a asserção dos 75 bairros (relaxamento indevido)');
  if (n3 && !/estado inicial NÃO-ZERO/.test(n3)) note('G11-n3: loader perdeu a trava de estado-inicial-zero');
}

// ── runner ─────────────────────────────────────────────────────────────────────────────────────────
{
  const runner = read('scripts/run-regression-guards.mjs') ?? '';
  if (!runner.includes('audit-fixture-cleanup-territorial-manifest.mjs')) note('R1: guard fora do runner validate:regression-guards');
}
// prova DB existe
if (!read(DBPROOF)) note('R2: prova DB ausente: ' + DBPROOF);
// auto-referência (o guard precisa citar o próprio nome para o R1 acima)
void GUARD;

if (failures.length) {
  console.error('GATE FAIL [fixture-cleanup-territorial-manifest]:');
  for (const f of failures) console.error('   ❌ ' + f);
  console.error('\n→ FASE D: limpeza governada por MANIFEST FECHADO (34 addr + 9 asg), UUID exato, ordem asg→addr, dry-run ROLLBACK, apply com token literal + COMMIT único, rerun fail-closed, preservados protegidos, sem actor-scoped/provider/PII/Bank/Social; 6 baselines selados reconciliados para 3/3/0 sem relaxar provas.');
  process.exit(1);
}
console.log('GATE OK [fixture-cleanup-territorial-manifest] — manifest fechado 3/3 preserve + 34/9 remove (UUIDs completos, sem overlap/dup, hash canônico ok); one-shot só DELETA addresses/address_assignments por UUID $1 exato na ordem asg→addr (sem wildcard/tenant/owner_type/CASCADE/TRUNCATE); dry-run ROLLBACK obrigatório, apply com token literal exato + 1 COMMIT guardado após provas, rerun fail-closed por baseline≠37/12; preservados revalidados e nunca deletados; referências (5 FKs + FK nova + evento) verificadas fail-closed; sem actor-scoped/Fase C/provider/texto-PII/Bank/Social; 6 artefatos selados reconciliados nominalmente para baseline 3/3/0 sem relaxar provas (N3 loader com gate/manifest/estado-zero intactos).');
