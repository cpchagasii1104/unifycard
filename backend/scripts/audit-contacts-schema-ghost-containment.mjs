#!/usr/bin/env node
// Guard estrutural — F-CONTACTS-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT.
// A tabela `contacts` é schema ghost (ausente no schema vivo). TODO acesso passa por `contactService`
// (funil único: nenhum caller importa `contactRepository` direto). Cada método do service que alcança o
// repository DEVE chamar `assertContactsFeatureAvailable()` ANTES — fail-closed 501. FALHA se:
//   (a) o guard de feature sumir (to_regclass + AppError 501 + CONTACTS_SCHEMA_GHOST_CONTAINED);
//   (b) algum método do service alcançar `contactRepository.` sem `assertContactsFeatureAvailable` antes;
//   (c) algum arquivo FORA do módulo contact importar `contactRepository` direto (quebra o funil);
//   (d) aparecer CREATE TABLE contacts em migration viva (gênese é frente própria, NÃO esta). Em validate:regression-guards.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const MK = join(ROOT, 'src', 'modules', 'marketplace');
const GUARD = join(MK, 'contact-feature.guard.ts');
const SERVICE = join(MK, 'contact.service.ts');
const MIGRATIONS = join(ROOT, 'migrations');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

const failures = [];
const must = (cond, msg) => { if (!cond) failures.push(msg); };

// (a) guard de feature ───────────────────────────────────────────────────────────────
const guard = read(GUARD);
must(guard, 'contact-feature.guard.ts ausente');
must(/to_regclass\('public\.contacts'\)/.test(guard), 'guard não faz probe to_regclass(public.contacts)');
must(/new AppError\(\s*501/.test(guard), 'guard não lança 501');
must(/CONTACTS_SCHEMA_GHOST_CONTAINED/.test(guard), 'guard sem code CONTACTS_SCHEMA_GHOST_CONTAINED');

// (b) cada método do service que alcança o repository é guardado ANTES ──────────────────
const service = read(SERVICE);
must(/assertContactsFeatureAvailable/.test(service), 'service não importa/usa assertContactsFeatureAvailable');
const GUARDED_METHODS = ['createContact', 'updateContact', 'getContactById', 'getContactByTaxId', 'listContacts', 'linkUserToContact'];
for (const name of GUARDED_METHODS) {
  const start = service.indexOf(`async ${name}(`);
  if (start === -1) { failures.push(`método ${name} não encontrado em contact.service.ts (removido/renomeado?)`); continue; }
  // corpo do método = do início até o próximo `\n  async ` / `\n  private async ` após ele (ou fim).
  const after = service.slice(start + 1);
  const nextRel = after.search(/\n {2}(private\s+)?async\s+\w+\(/);
  const body = nextRel === -1 ? service.slice(start) : service.slice(start, start + 1 + nextRel);
  const idxAssert = body.indexOf('assertContactsFeatureAvailable');
  const idxRepo = body.indexOf('contactRepository.');
  must(idxRepo !== -1, `método ${name} não alcança contactRepository (mudou de forma? revisar guard)`);
  must(idxAssert !== -1, `método ${name} alcança o repository SEM assertContactsFeatureAvailable (contenção removida)`);
  if (idxAssert !== -1 && idxRepo !== -1) {
    must(idxAssert < idxRepo, `método ${name}: assertContactsFeatureAvailable deve vir ANTES de contactRepository`);
  }
}

// (c) funil: nenhum arquivo fora do módulo contact importa contactRepository direto ────
{
  const offenders = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(full); continue; }
      if (!e.name.endsWith('.ts')) continue;
      const rel = full.replace(/\\/g, '/');
      if (/modules\/marketplace\/contact[\w.-]*\.ts$/.test(rel)) continue; // o próprio módulo contact (qualquer arquivo)
      // Violação = IMPORT ou CHAMADA real do repository fora do módulo (não menção em comentário).
      const src = read(full);
      if (/import[^\n;]*contact\.repository|\bcontactRepository\s*\./.test(src)) {
        offenders.push(rel.replace(ROOT.replace(/\\/g, '/') + '/', ''));
      }
    }
  };
  walk(join(ROOT, 'src'));
  must(offenders.length === 0, `funil quebrado: contactRepository referenciado fora do service: ${offenders.join(', ')}`);
}

// (e) ROUTE-LEVEL containment (R8F, 2026-06-19): a rota também contém fail-closed na BORDA, ANTES de ler
// actionContext.actorId (canal-1) ou chamar contactService — eliminando o canal-1 do arquivo (saída honesta do
// baseline canal-1). FALHA se: a rota voltar a chamar contactService, voltar a ler actionContext.actorId, ou
// perder o 501 CONTACTS_SCHEMA_GHOST_CONTAINED.
{
  const ROUTES = join(MK, 'contact.routes.ts');
  const rawRoutes = read(ROUTES);
  must(rawRoutes, 'contact.routes.ts ausente');
  // comment-stripped (não confundir o canal-1 no comentário de contenção com uso real).
  const routes = rawRoutes.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
  must(/CONTACTS_SCHEMA_GHOST_CONTAINED/.test(routes), 'route não retorna code CONTACTS_SCHEMA_GHOST_CONTAINED');
  const contained501 = (routes.match(/reply\.status\(\s*501\s*\)\.send\(\s*CONTAINED\s*\)/g) || []).length;
  must(contained501 >= 6, `route esperado >= 6 rotas contidas (501 CONTAINED), encontradas ${contained501} — não remover rotas`);
  must(!/contactService\./.test(routes), 'route voltou a chamar contactService (religação exige frente própria — gênese do schema)');
  must(!/actionContext\s*\.\s*actorId/.test(routes), 'route voltou a referenciar actionContext.actorId (canal-1) — a rota contida não lê ator do cliente');
}

// (d) nenhuma migration viva cria a tabela contacts ────────────────────────────────────
const migs = existsSync(MIGRATIONS) ? readdirSync(MIGRATIONS) : [];
let createdContacts = false;
for (const f of migs) {
  if (!/\.sql$/.test(f)) continue;
  const sql = read(join(MIGRATIONS, f));
  if (/CREATE TABLE (IF NOT EXISTS )?contacts\b/i.test(sql)) createdContacts = true;
}
must(!createdContacts, 'migration viva cria a tabela contacts (gênese é frente própria, NÃO esta contenção)');

if (failures.length) {
  console.error('GATE FAIL [contacts-schema-ghost-containment]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('[contacts-schema-ghost-containment] funil único contactService (sem caller direto do repository); 6 métodos fail-closed (assertContactsFeatureAvailable antes do repository); 501 CONTACTS_SCHEMA_GHOST_CONTAINED; nenhuma migration cria contacts.');
console.log('GATE OK [contacts-schema-ghost-containment] — schema ghost contido fail-closed; gênese segue OPEN.');
