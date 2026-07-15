#!/usr/bin/env node
// audit-fiscal-provision-engine.mjs — Guard consolidado FISCAL 4D-1 (DECISION-0167; GO D9.7).
//
// Congela o MOTOR READ-ONLY de provisão fiscal (comment-aware + liveness):
//   F · fontes: allowlist §3 (perfil 4b + resolver 4c-2 + evento) — company/tax-profile/invoice/
//       template/env/Bank/order/checkout/ACTOR_RESIDENCE/cidade-textual PROIBIDOS;
//   C · cálculo: centavos inteiros; zero taxa/percentual literal; rounding_mode GOVERNADO da regra
//       (motor nunca escolhe); reserva = Σ provisões; distributable = gross − reserve; negativo
//       não ocultado; missing não vira zero;
//   P · persistência: trilha append-only (RLS FORCE, sem UPDATE/DELETE), sem PII, rule/profile
//       id+version, identidade do evento, idempotência sem contradição;
//   A · activateRule fail-closed sem rounding_mode; vocabulário ROUNDING_MODES único (types+CHECK+
//       manifesto alinhados);
//   B · fronteiras: zero bank_*; zero applies_to; guard 4c-3 INTACTO; zero 4e; zero invoicing;
//       zero rota HTTP/monetária; zero frontend; passada seller/provider não aberta;
//   O · aplicador seletivo estreito (2 hashes fixos, token, lock, rerun fail-closed).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const strip = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fails = [];
const note = (m) => fails.push(m);

const F = {
  SVC: 'src/modules/fiscal-provision/fiscal-provision.service.ts',
  TYPES: 'src/modules/fiscal-provision/fiscal-provision.types.ts',
  LOGREPO: 'src/modules/fiscal-provision/fiscal-provision-log.repository.ts',
  CATTYPES: 'src/modules/fiscal/tax-catalog.types.ts',
  CATREPO: 'src/modules/fiscal/tax-catalog.repository.ts',
  MIG_RM: 'migrations/20260714220000_tax_rules_rounding_mode.sql',
  MIG_FPL: 'migrations/20260714230000_create_fiscal_provision_logs.sql',
  APPLY: 'scripts/apply-fiscal-4d1-migrations.mjs',
  MANIFEST: 'src/core/governance/governed-vocabularies.manifest.ts',
  GUARD_4C3: 'scripts/audit-fiscal-tax-catalog.mjs',
  RUNNER: 'scripts/run-regression-guards.mjs',
  MIG_ENFORCE: 'migrations/20260715100000_tax_rules_active_rounding_mode_enforcement.sql',
  APPLY_R: 'scripts/apply-fiscal-4d1-migrations.mjs',
  IMMUT_MIG: 'migrations/20260710140000_create_tax_types_and_tax_rules.sql',
};
const S = Object.fromEntries(Object.entries(F).map(([k, p]) => [k, { p, raw: read(p), s: p.endsWith('.sql') ? stripSql(read(p)) : strip(read(p)) }]));

// ── F · fontes (allowlist §3) ──
{
  const svc = S.SVC.s;
  if (!/fiscalProfileRepository\.getActiveProfileForTenant\(/.test(svc))
    note('F1: motor não resolve o contribuinte pela casa 4b (getActiveProfileForTenant)');
  if (!/const resolution = await taxCatalogRepository\.resolveRuleOrMissing\(\{/.test(svc))
    note('F2: motor não usa o resolver 4c-2 (ÚNICO ponto de resolução de regra) na forma canônica');
  if (/try\s*\{[\s\S]{0,120}resolveRuleOrMissing|try\s*\{[\s\S]{0,120}getActiveProfileForTenant/.test(svc))
    note('F2b: try/catch engolindo o resolver/perfil (infra-error deve PROPAGAR)');
  if (!/if \(!profile\) \{\s*return this\.finalize\([\s\S]{0,160}'active_platform_fiscal_profile_missing'/.test(svc))
    note('F2c: perfil ausente deixou de virar missing discriminado (fail-honest sumiu)');
  if (!/resolution\.status === FISCAL_CONFIG_MISSING[\s\S]{0,160}missing\('tax_rule_missing'/.test(svc))
    note('F2d: regra ausente deixou de virar missing honesto (ausência ≠ zero)');
  const allSvc = svc + S.LOGREPO.s + S.TYPES.s;
  if (/company-profile|companyProfile|tax-profile\.repository|taxProfileRepository/.test(allSvc))
    note('F3: revival de company/tax-profile como fonte fiscal (aposentadas na 4b)');
  if (/invoice/i.test(allSvc)) note('F4: invoicing como fonte/consumidor do motor (proibido nesta fatia)');
  if (/business_template|business-template|businessTemplate/.test(allSvc)) note('F5: template fiscal como fonte (0167 §7 do template: NUNCA entra na allowlist)');
  if (/process\.env/.test(allSvc)) note('F6: env como fonte fiscal (proibido)');
  if (/resolveActorTerritory|ACTOR_RESIDENCE|active_location/.test(allSvc)) note('F7: residência do comprador/território social no motor (jurisdição é CADASTRAL do contribuinte, via evento)');
  if (/FROM\s+(orders|checkout|payment_intents|bank_)/i.test(allSvc)) note('F8: motor lendo order/checkout/bank (fora da allowlist §3)');
  if (/categories|category_id/.test(allSvc)) note('F9: categoria/TREE como identidade fiscal (Lei 7)');
}

// ── C · cálculo ──
{
  const svc = S.SVC.s;
  if (/\*\s*0?\.\d+|\d+\s*\/\s*100(?!00)/.test(svc)) note('C1: percentual literal no motor (alíquota é DADO da regra)');
  if (/rateBps\s*[:=]\s*\d+|rate_bps\s*=\s*\d+/.test(svc)) note('C2: alíquota hardcoded no motor');
  if (!/rule\.roundingMode == null/.test(svc) || !/rounding_mode_missing/.test(svc))
    note('C3: regra ativa sem rounding_mode deixou de ser missing honesto (defensivo §8)');
  if (!/dividePer10000\(numerator, rule\.roundingMode\)/.test(svc))
    note('C4: cálculo não aplica o rounding_mode DA REGRA (motor escolhendo arredondamento?)');
  // Math.* só DENTRO da política selecionada (função dividePer10000); fora dela = escolha do motor
  const outside = svc.replace(/function dividePer10000[\s\S]*?\n}/, '');
  if (/Math\.(round|floor|ceil)/.test(outside)) note('C5: Math.round/floor/ceil decidindo arredondamento fora da política governada');
  if (!/Number\.isInteger\(event\.commissionGrossCents\)/.test(svc)) note('C6: base não validada como centavos inteiros');
  if (!/results\.reduce\(\(acc, r\) => acc \+ r\.provisionCents, 0\)/.test(svc)) note('C7: tax_reserve deixou de ser Σ provisões (inteiros)');
  if (!/const numerator = event\.commissionGrossCents \* rule\.rateBps;/.test(svc))
    note('C12: numerador deixou de ser base×rate_bps inteiro (float/env/hardcode?)');
  if (/rateBps\s*\/\s*10000|\/\s*10000\s*\)\s*\*\s*10000/.test(svc)) note('C13: aritmética float monetária no motor');
  if (!/for \(const rule of resolution\.rules\) \{/.test(svc))
    note('C14: motor deixou de processar TODAS as regras aplicáveis (colisão escolhida silenciosamente?)');
  if (/includeDeprecated|ignoreDates|IgnoringDates/.test(svc)) note('C15: motor pedindo regra deprecated/fora de vigência');
  if (!/commissionGrossCents - taxReserveCents/.test(svc)) note('C8: distributable ≠ gross − reserve');
  if (/Math\.max\(0|Math\.min\(.*commissionGross/.test(svc)) note('C9: clamp silencioso no agregado (negativo deve ser honesto)');
  if (!/tax_reserve_exceeds_commission_gross/.test(svc) || !/commission_distributable_negative/.test(svc))
    note('C10: warnings de reserva>gross / distributable negativo sumiram');
  if (!/explicit_zero_rate/.test(svc)) note('C11: taxa zero explícita deixou de ser distinguida (≠ missing)');
}

// ── P · persistência/trilha ──
{
  const mig = S.MIG_FPL.s;
  if (!/CREATE TABLE fiscal_provision_logs/.test(mig)) note('P1: tabela da trilha sumiu da migration');
  if (!/ENABLE ROW LEVEL SECURITY/.test(mig) || !/FORCE ROW LEVEL SECURITY/.test(mig)) note('P2: RLS ENABLE+FORCE sumiu');
  if (!/BEFORE UPDATE ON fiscal_provision_logs/.test(mig) || !/BEFORE DELETE ON fiscal_provision_logs/.test(mig))
    note('P3: triggers append-only (no UPDATE/DELETE) sumiram');
  if (/\b(cpf|cnpj|cep|endereco|endereço|address|street|postal)\b/i.test(mig.replace(/--[^\n]*/g, ''))) note('P4: PII no schema da trilha');
  if (!/uq_fpl_event_rule UNIQUE NULLS NOT DISTINCT/.test(mig)) note('P5: UNIQUE de idempotência (evento/passada/regra) sumiu');
  if (!/tax_rule_version/.test(mig) || !/actor_fiscal_profile_version/.test(mig)) note('P6: versões de regra/perfil sumiram da trilha');
  if (!/source_module TEXT NOT NULL/.test(mig) || !/source_reference_id TEXT NOT NULL/.test(mig)) note('P7: identidade do evento sumiu da trilha');
  if (/REFERENCES bank_/.test(mig)) note('P8: FK para bank_* na trilha (proibido)');
  if (!/chk_fpl_missing_shape/.test(mig) || !/missing_reason/.test(mig)) note('P9: missing_reason discriminado sumiu do schema');
  const repo = S.LOGREPO.s;
  if (/UPDATE fiscal_provision_logs|DELETE FROM fiscal_provision_logs/i.test(repo)) note('P10: repository tenta UPDATE/DELETE na trilha');
  if (!/ON CONFLICT ON CONSTRAINT uq_fpl_event_rule DO NOTHING/.test(repo)) note('P11: idempotência do INSERT sumiu');
  const svc = S.SVC.s;
  if (!/FISCAL_PROVISION_LOG_CONTRADICTION/.test(svc)) note('P12: verificação de contradição no retry sumiu');
  if (!/FISCAL_CONFIG_MISSING_MANDATORY/.test(svc)) note('P13: contexto obrigatório deixou de falhar fechado (D9.6.18)');
  if (!/statusCode = 422/.test(svc)) note('P14: falha obrigatória sem classe de erro explícita');
}

// ── A · activateRule + vocabulário ──
{
  const catrepo = S.CATREPO.s;
  if (!/TAX_RULE_ROUNDING_MODE_REQUIRED/.test(catrepo) || !/t\.rounding_mode == null/.test(catrepo))
    note('A1: activateRule deixou de exigir rounding_mode (ativação fail-closed sumiu)');
  const cattypes = S.CATTYPES.s;
  if (!/export const ROUNDING_MODES = \['half_up', 'half_even', 'floor', 'ceil'\] as const/.test(cattypes))
    note('A2: vocabulário ROUNDING_MODES divergiu/sumiu da fonte governada');
  const migrm = S.MIG_RM.s;
  if (!/CHECK \(rounding_mode IS NULL OR rounding_mode IN \('half_up', 'half_even', 'floor', 'ceil'\)\)/.test(migrm))
    note('A3: CHECK do rounding_mode divergiu do vocabulário');
  if (/DEFAULT/i.test(migrm.replace(/COMMENT ON[\s\S]*/,''))) note('A4: DEFAULT fiscal silencioso na migration do rounding_mode');
  if (!/symbol: 'ROUNDING_MODES'/.test(S.MANIFEST.s)) note('A5: ROUNDING_MODES fora do manifesto de vocabulários governados');
  if (!/ROUNDING_MODES\.includes\(input\.roundingMode\)/.test(catrepo)) note('A6: createDraftRule aceita rounding_mode fora do vocabulário');
}

// ── B · fronteiras ──
{
  const all = S.SVC.s + S.LOGREPO.s + S.TYPES.s;
  if (/(INSERT INTO|UPDATE|DELETE FROM)\s+bank_/i.test(all)) note('B1: escrita em bank_* no motor');
  if (/@modules\/bank|modules\/bank|bankTransactionService|bankIntegrationService|createTransactionWith/.test(all))
    note('B2: motor acoplado ao Bank (4e é fatia própria)');
  if (/applies_to/.test(all)) note('B3: motor tocando applies_to (4d-2 é fatia própria)');
  // fronteira dura: nada nesta fatia altera economic_policy_lines
  for (const f of readdirSync(resolve(ROOT, 'migrations')).filter((x) => x >= '20260714220000' && x.endsWith('.sql'))) {
    const src = stripSql(read('migrations/' + f));
    if (/applies_to/.test(src)) note(`B4: migrations/${f} toca applies_to (4d-2)`);
    if (/line_type[\s\S]{0,120}tax_reserve/.test(src)) note(`B4b: migrations/${f} materializa tax_reserve em policy (4e)`);
  }
  // passada seller/provider NÃO aberta silenciosamente (condição + throw adjacentes)
  if (!/if \(event\.taxpayerKind !== 'platform'\) \{\s*throw new Error\('TAXABLE_EVENT_PASSADA_NOT_AUTHORIZED/.test(S.SVC.s))
    note('B5: passada seller/provider aberta silenciosamente (fatia própria)');
  // identidade do evento é obrigatória (base da idempotência)
  if (!/if \(!event\.sourceModule\?\.trim\(\) \|\| !event\.sourceReferenceId\?\.trim\(\)\) \{\s*throw/.test(S.SVC.s))
    note('B5b: evento sem identidade tolerado (idempotência quebraria)');
  // snapshot não inventa stream/fallback
  if (!/platformRevenueStream: event\.platformRevenueStream,/.test(S.SVC.s) || /as never/.test(S.SVC.s))
    note('B5c: snapshot com stream inventado/fallback (só o fato governado do evento)');
  // zero rota HTTP: módulo não registra rotas nem é registrado no app.builder
  if (/fastify|FastifyPluginAsync|\.routes/.test(S.SVC.s + S.LOGREPO.s + S.TYPES.s)) note('B6: rota HTTP no motor (consumer inicial é prova read-only)');
  const appBuilder = strip(read('src/app.builder.ts'));
  if (/fiscal-provision/.test(appBuilder)) note('B7: motor registrado no app.builder (reachability HTTP proibida nesta fatia)');
  // consumidores monetários não ligados
  for (const p of ['src/modules/services/service-payment-execution.service.ts', 'src/modules/bank/bank-integration.service.ts', 'src/modules/invoicing/invoice.service.ts', 'src/modules/economy/policy-engine/economic-policy-engine.service.ts']) {
    if (existsSync(resolve(ROOT, p)) && /fiscal-provision|fiscalProvisionService/.test(strip(read(p))))
      note(`B8: consumidor monetário ligado ao motor (${p}) — proibido nesta fatia`);
  }
}

// ── O · aplicador seletivo ──
{
  const ap = S.APPLY.s;
  if (!/CONFIRM_TOKEN = 'APPLY_FISCAL_4D1_MIGRATIONS'/.test(ap)) note('O1: token literal do apply sumiu');
  if (!/APPLY && !CONFIRMED/.test(ap)) note('O2: apply sem token não aborta');
  if (!/sha256: '6cf941c9a68806edaa3db303023499d764168174d82042fa25d5efbf5fdcca9d'/.test(S.APPLY.raw)) note('O3: hash fixo da migration rounding_mode sumiu/divergiu');
  if (!/sha256: '76db12f904b8d0968101da395e7a0ac75df2e97c28121429e65a264a60e5723c'/.test(S.APPLY.raw)) note('O4: hash fixo da migration da trilha sumiu/divergiu');
  if (!/pg_advisory_xact_lock/.test(ap)) note('O5: advisory lock sumiu');
  if (!/pending\.length === 0\)[\s\S]{0,80}throw[\s\S]{0,60}already_applied/.test(ap)) note('O6: rerun fail-closed (zero pendente) sumiu');
  if (/process\.argv[\s\S]{0,160}migrations\//.test(ap)) note('O7: caminho de migration por CLI (proibido — nomes fixos)');
  if (!/MUST_STAY_UNREGISTERED/.test(ap)) note('O8: preservação de N1/drift sumiu do preflight');
  // hashes reais batem com os fixos
  for (const [file, expected] of [[F.MIG_RM, '6cf941c9a68806edaa3db303023499d764168174d82042fa25d5efbf5fdcca9d'], [F.MIG_FPL, '76db12f904b8d0968101da395e7a0ac75df2e97c28121429e65a264a60e5723c']]) {
    const real = createHash('sha256').update(read(file)).digest('hex');
    if (real !== expected) note(`O9: ${file} divergiu do hash embutido (${real})`);
  }
}

// ── R · REMEDIAÇÃO 4D-1-R (Yala Veredito C): enforcement DB de rounding_mode em regra ativa ──
{
  const mig = S.MIG_ENFORCE.s;
  // (R1) constraint exata OU semanticamente equivalente: status<>active OR rounding_mode NOT NULL
  const hasCheck = /ADD CONSTRAINT chk_tax_rules_active_requires_rounding\s*\n?\s*CHECK\s*\(\s*status\s*<>\s*'active'\s*OR\s*rounding_mode\s+IS\s+NOT\s+NULL\s*\)/i.test(mig);
  if (!hasCheck) note('R1: CHECK chk_tax_rules_active_requires_rounding ausente ou com condição divergente (status<>active OR rounding_mode IS NOT NULL)');
  // (R2) dependência explícita status='active' <-> rounding_mode IS NOT NULL (não é presença solta de string)
  if (!/status\s*<>\s*'active'\s*OR\s*rounding_mode\s+IS\s+NOT\s+NULL/i.test(mig))
    note('R2: condição da constraint não amarra status=active a rounding_mode NOT NULL');
  // (R3) ausência de DEFAULT na constraint/coluna (a coluna já nasceu sem default na 1ª migration;
  // aqui garantimos que a remediação não introduziu um)
  if (/ALTER COLUMN rounding_mode SET DEFAULT|ADD COLUMN rounding_mode[\s\S]{0,80}DEFAULT/i.test(mig))
    note('R3: DEFAULT fiscal silencioso introduzido na remediação');
  // (R4) draft continua nullable — a migration NÃO pode tornar a coluna NOT NULL globalmente
  if (/ALTER COLUMN rounding_mode SET NOT NULL/i.test(mig))
    note('R4: coluna virou NOT NULL global — draft incompleto deixaria de ser permitido');
  // (R5) trigger de imutabilidade (mesma casa canônica, via CREATE OR REPLACE — não duplicada)
  // inclui rounding_mode na lista de campos materiais protegidos quando OLD.status='active'
  const funcBlock = (mig.match(/CREATE OR REPLACE FUNCTION enforce_tax_rules_immutability\(\)[\s\S]*?\$\$ LANGUAGE plpgsql;/) || [''])[0];
  if (!funcBlock) note('R5: reforço da função enforce_tax_rules_immutability (CREATE OR REPLACE) ausente');
  if (!/NEW\.rounding_mode IS DISTINCT FROM OLD\.rounding_mode/.test(funcBlock))
    note('R6: rounding_mode não entrou na lista de campos imutáveis quando OLD.status=active');
  // rounding_mode deve estar na MESMA cláusula IF OLD.status='active' que os demais campos materiais
  // (não uma trigger paralela/isolada) — checa coexistência com um campo pré-existente conhecido
  const activeBlock = (funcBlock.match(/IF OLD\.status = 'active' THEN[\s\S]*?END IF;\s*\n\s*END IF;/) || [funcBlock])[0];
  if (!/NEW\.rate_bps IS DISTINCT FROM OLD\.rate_bps/.test(activeBlock) || !/NEW\.rounding_mode IS DISTINCT FROM OLD\.rounding_mode/.test(activeBlock))
    note('R7: rounding_mode não está na MESMA checagem de imutabilidade dos demais campos materiais (rate_bps) — trigger paralela suspeita');
  if (!/active→deprecated|active\s*→\s*deprecated|NEW\.status NOT IN \('active', 'deprecated'\)/.test(funcBlock))
    note('R8: transição active→deprecated deixou de ser permitida na função reforçada');
  // (R9) não duplicar lifecycle: só UMA função/trigger de imutabilidade para tax_rules na migration nova
  if ((mig.match(/CREATE TRIGGER/gi) || []).length > 0)
    note('R9: remediação criou TRIGGER nova/paralela em vez de reforçar a função existente via CREATE OR REPLACE');
  // (R10) zero seed/backfill/UPDATE de dados na migration de remediação
  if (/^\s*UPDATE\s+tax_rules/im.test(mig)) note('R10: remediação faz UPDATE de dados (backfill proibido — tax_rules=0 no baseline)');
  if (/NOT VALID/i.test(mig)) note('R11: constraint criada NOT VALID (deve validar imediatamente — catálogo vazio)');

  // (R12) activateRule PRESERVADO (defesa cumulativa: repository + constraint + trigger + guard)
  if (!/TAX_RULE_ROUNDING_MODE_REQUIRED/.test(S.CATREPO.s) || !/t\.rounding_mode == null/.test(S.CATREPO.s))
    note('R12: proteção fail-closed do activateRule foi removida — defesa cumulativa quebrada (banco não substitui repository)');

  // (R13) aplicador seletivo reconhece o hash fixo da migration de remediação
  if (!/name: '20260715100000_tax_rules_active_rounding_mode_enforcement\.sql', sha256: '5372836f70a54d8993902fa439b425699d4cca3ca941e61d164cb7b6053fe598'/.test(S.APPLY_R.raw))
    note('R14: aplicador seletivo não reconhece a migration de remediação pelo hash fixo');
  const realShaEnforce = createHash('sha256').update(read(F.MIG_ENFORCE)).digest('hex');
  if (realShaEnforce !== '5372836f70a54d8993902fa439b425699d4cca3ca941e61d164cb7b6053fe598')
    note(`R15: migration de remediação divergiu do hash embutido (${realShaEnforce})`);
}

// ── guard 4c-3 INTACTO (hash de referência do envelope 4d-1) ──
{
  const h = createHash('sha256').update(S.GUARD_4C3.raw).digest('hex');
  if (h !== 'a74ae08d0d52031b23451e67cb1f944d276fe868f63a4b0181130e0d6a8ed277')
    note(`G1: guard 4c-3 foi ALTERADO (hash ${h}) — proibido nesta fatia (inversões conscientes = 4d-2/4e)`);
}

// ── runner wiring ──
{
  if (!S.RUNNER.s.includes('audit-fiscal-provision-engine.mjs')) note('R1: este guard está fora do runner');
}

if (fails.length) {
  console.error('\nGATE FAIL [fiscal-provision-engine]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [fiscal-provision-engine] — motor read-only 4d-1 (DECISION-0167): fontes = allowlist §3 (perfil 4b + resolver 4c-2 + TaxableEvent; company/tax-profile/invoice/template/env/Bank/residência-do-comprador PROIBIDOS); cálculo em centavos inteiros com rounding_mode GOVERNADO da regra (motor nunca escolhe; Math.* só como implementação da política selecionada); tax_reserve = Σ provisões; commission_distributable = gross − reserve (negativo HONESTO com warning, sem clamp); taxa zero explícita ≠ missing; fiscal_config_missing DISCRIMINADO e contexto obrigatório fail-closed (D9.6.18); trilha fiscal_provision_logs append-only (RLS FORCE, no UPDATE/DELETE, sem PII, rule/profile id+version, identidade do evento, idempotência sem contradição); activateRule exige rounding_mode (zero default silencioso); vocabulário ROUNDING_MODES único (types+CHECK+manifesto); REMEDIAÇÃO 4D-1-R (Yala Veredito C): regra ativa com rounding_mode NULL é IMPOSSÍVEL no banco (CHECK chk_tax_rules_active_requires_rounding validada, sem NOT VALID, sem default, draft nullable) e o modo de regra ativa é IMUTÁVEL (função enforce_tax_rules_immutability reforçada via CREATE OR REPLACE — rounding_mode na MESMA checagem dos demais campos materiais, active→deprecated preservado, sem trigger paralela); defesa cumulativa repository+constraint+trigger+guard; fronteiras: zero bank_*, zero applies_to (4d-2), zero tax_reserve em policy (4e), passada seller não aberta, zero rota HTTP/app.builder/consumidor monetário; guard 4c-3 BYTE-INTACTO por hash; aplicador seletivo estreito (3 hashes fixos, token, lock, aplica só pendentes, rerun fail-closed, N1/drift preservadas). (Comment-aware + liveness.)');
