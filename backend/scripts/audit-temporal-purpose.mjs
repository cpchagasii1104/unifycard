#!/usr/bin/env node
// Guard estrutural — F-AGENDA-PURPOSE-CONCEPT-MATERIALIZATION (DECISION-0132).
// Finalidade temporal da agenda = CONCEPT em availability.purpose_concept_id (FK→concepts), NUNCA
// metadata/enum solto/estado visual. Booking gate protege estudo/cuidados-pessoais/lazer; trabalho/NULL
// bookáveis. FALHA se:
//   (a) sumir a coluna/FK(RESTRICT)/índice de purpose_concept_id, ou aparecer is_bookable;
//   (b) sumir o seed governado dos 4 concepts (set_config + 4 slugs + ON CONFLICT);
//   (c) o resolver perder os 4 pares (domain,slug) ou a política (só trabalho bookável);
//   (d) a finalidade for gravada em metadata (anti-padrão);
//   (e) o service createBooking perder o gate AVAILABILITY_PERSONAL_PROTECTED / getProtectedPurposeConceptIds;
//   (f) o materializer não gravar purpose_concept_id por janela;
//   (g) a rota não validar o slug (z.enum dos 4) ou não expor purposeConceptId no read-back. Em validate:regression-guards.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const AVAIL = join(ROOT, 'src', 'core', 'availability');
const MIGRATIONS = join(ROOT, 'migrations');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

const failures = [];
const must = (cond, msg) => { if (!cond) failures.push(msg); };

// ── arquivos ────────────────────────────────────────────────────────────────────────
const temporal = read(join(AVAIL, 'temporal-purpose.ts'));
const materializer = read(join(AVAIL, 'weekly-template-materializer.service.ts'));
const service = read(join(AVAIL, 'unified-availability.service.ts'));
const routes = read(join(AVAIL, 'unified-availability.routes.ts'));
const repo = read(join(AVAIL, 'unified-availability.repository.ts'));
must(temporal && materializer && service && routes && repo, 'arquivo(s) do core availability ausente(s)');

// ── migrations ──────────────────────────────────────────────────────────────────────
const migs = existsSync(MIGRATIONS) ? readdirSync(MIGRATIONS) : [];
const seedMig = migs.find((f) => /seed_concepts_temporal_purpose\.sql$/.test(f));
const colMig = migs.find((f) => /availability_purpose_concept_id\.sql$/.test(f));
must(seedMig, 'migration de SEED das 4 finalidades ausente');
must(colMig, 'migration da coluna purpose_concept_id ausente');
if (seedMig) {
  const s = read(join(MIGRATIONS, seedMig));
  must(/set_config\('app\.concept_governance',\s*'true'/.test(s), 'seed sem set_config de governança');
  for (const slug of ['trabalho', 'estudo', 'cuidados-pessoais', 'lazer']) must(s.includes(`'${slug}'`), `seed sem o concept '${slug}'`);
  must(/ON CONFLICT/i.test(s), 'seed não idempotente (sem ON CONFLICT)');
  must(!/INSERT INTO domains/i.test(s) || /tempo-e-finalidade/.test(s) === false, 'seed criou domínio N0 novo (proibido por DECISION-0132)');
}
if (colMig) {
  const c = read(join(MIGRATIONS, colMig));
  must(/purpose_concept_id\s+UUID/i.test(c), 'coluna purpose_concept_id ausente na migration');
  must(/REFERENCES\s+concepts\(concept_id\)\s+ON DELETE RESTRICT/i.test(c), 'FK→concepts ON DELETE RESTRICT ausente');
  must(/idx_availability_purpose_concept/.test(c), 'índice de purpose_concept_id ausente');
  must(!/is_bookable\s+(boolean|bool)/i.test(c), 'coluna is_bookable proibida (bookability é derivada da finalidade)');
}

// ── resolver / política ───────────────────────────────────────────────────────────────
must(/'trabalho':\s*'servicos'/.test(temporal), 'resolver sem trabalho→servicos');
must(/'estudo':\s*'educacao-e-conhecimento'/.test(temporal), 'resolver sem estudo→educacao-e-conhecimento');
must(/'cuidados-pessoais':\s*'saude-e-bem-estar'/.test(temporal), 'resolver sem cuidados-pessoais→saude-e-bem-estar');
must(/'lazer':\s*'cultura-lazer-e-eventos'/.test(temporal), 'resolver sem lazer→cultura-lazer-e-eventos');
must(/BOOKABLE_TEMPORAL_PURPOSE_SLUGS[\s\S]{0,80}'trabalho'/.test(temporal), 'política de bookability deve listar SÓ trabalho');
must(/getProtectedPurposeConceptIds/.test(temporal), 'resolver sem getProtectedPurposeConceptIds');

// ── booking gate ──────────────────────────────────────────────────────────────────────
must(/getProtectedPurposeConceptIds/.test(service), 'createBooking não resolve concept_ids protegidos server-side');
must(/AVAILABILITY_PERSONAL_PROTECTED/.test(service), 'gate sem erro AVAILABILITY_PERSONAL_PROTECTED');
must(/availability\.purposeConceptId/.test(service), 'gate não inspeciona availability.purposeConceptId');

// ── materializer grava finalidade por janela ──────────────────────────────────────────
must(/resolveTemporalPurposeBySlug/.test(materializer), 'materializer não resolve slug→concept_id server-side');
must(/purposeConceptId:\s*w\.purposeConceptId/.test(materializer), 'createAvailability do materializer sem purposeConceptId');

// ── repo persiste a coluna ─────────────────────────────────────────────────────────────
must(/purpose_concept_id/.test(repo), 'repository não insere/lê purpose_concept_id');

// ── rota valida slug + expõe read-back ────────────────────────────────────────────────
must(/purposes:\s*z\.record\(z\.enum\(\['trabalho',\s*'estudo',\s*'cuidados-pessoais',\s*'lazer'\]\)\)/.test(routes), 'zod de purposes não valida os 4 slugs (400)');
must(/purposeConceptId:\s*a\.purposeConceptId/.test(routes), 'read-back (list) não expõe purposeConceptId');
must(/temporal-purposes/.test(routes), 'endpoint GET /temporal-purposes ausente');

// ── anti-padrão: finalidade NUNCA em metadata ─────────────────────────────────────────
must(!/metadata[\s\S]{0,40}purpose/i.test(materializer.replace(/\/\/[^\n]*/g, '')), 'finalidade aparenta ser gravada em metadata no materializer (proibido)');

if (failures.length) {
  console.error('GATE FAIL [temporal-purpose]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('[temporal-purpose] finalidade=CONCEPT em availability.purpose_concept_id (FK RESTRICT, sem is_bookable); 4 concepts governados em domínios naturais; gate protege estudo/cuidados/lazer; materializer grava por janela; slug validado (z.enum); read-back expõe purposeConceptId; finalidade nunca em metadata.');
console.log('GATE OK [temporal-purpose] — DECISION-0132 materializada.');
