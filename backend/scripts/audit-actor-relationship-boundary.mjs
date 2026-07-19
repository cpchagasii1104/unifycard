#!/usr/bin/env node
// audit-actor-relationship-boundary.mjs
// Guard F-ACTOR-RELATIONSHIP-TYPED-EDGE-SLICE-1 (DESENHO_PAGINA_DO_ACTOR.md §5 SELADO;
// SPEC_FATIA1_RELACAO_TIPADA.md; GUIA_MESTRE §8 PASSO 3; Opção B ratificada 2026-07-04).
// Congela os invariantes da aresta de relação tipada:
//   1 · RELAÇÃO ≠ AUTORIDADE — o módulo NUNCA importa/escreve company_users, canManageCompany,
//       actor_delegations nem qualquer bank_* (aceite social não concede poder — DECISION-0125);
//   2 · AUTORIDADE NA ROTA — envio E aceite exigem canRepresentActor (fail-closed 403), e nenhum
//       handler lê o actor-sujeito do body (DECISION-0113: actorId client-declared não é autoridade);
//   3 · VOCABULÁRIO GOVERNADO — labels só do seed aprovado (§7 do desenho), no CHECK do schema
//       E na validação do service (fail-closed); extensão = RFC/DECISION, não feature;
//   4 · SCHEMA — from<>to, UNIQUE par não-ordenado (LEAST/GREATEST), RLS ENABLE+FORCE;
//   5 · PONTE Opção B — suppliers.actor_id nullable existe e a migration NÃO toca purchase_orders
//       (o fluxo vivo PO→inventário→a-pagar não regride) nem dropa colunas de suppliers.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const fails = [];
const check = (label, ok) => { if (!ok) fails.push(label); console.log(`  ${ok ? 'OK ' : 'FAIL'} ${label}`); };
// código sem comentários (comentários explicativos citam os termos proibidos legitimamente)
const stripComments = (s) => s.split('\n').filter((l) => { const t = l.trim(); return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*'); }).join('\n');

const routes = read('src/modules/relationships/actor-relationship.routes.ts');
const service = read('src/modules/relationships/actor-relationship.service.ts');
const repo = read('src/modules/relationships/actor-relationship.repository.ts');
const types = read('src/modules/relationships/actor-relationship.types.ts');
const migration = read('migrations/20260704120000_actor_relationships_typed_edge.sql');
const moduleCode = stripComments(routes + '\n' + service + '\n' + repo + '\n' + types);

// 1 · relação ≠ autoridade / ≠ dinheiro (nenhuma referência viva no CÓDIGO do módulo)
check('módulo: zero referência a company_users (aceite não concede vínculo de operação)',
  !/company_users/.test(moduleCode));
check('módulo: zero referência a canManageCompany/checkPermission/actor_delegations (não concede/consulta poder)',
  !/canManageCompany|checkPermission|actor_delegations/.test(moduleCode));
check('módulo: zero referência a bank_/ledger/payment/payout (Δbank=0 por construção)',
  !/bank_|bank\.|ledger|payment|payout|amount_cents|amountCents/i.test(moduleCode));
check('repo: só toca actor_relationships (+ SELECT mínimo de actors p/ tipo)',
  /FROM actor_relationships|INTO actor_relationships|UPDATE actor_relationships/.test(repo) &&
  !/INSERT INTO actors|UPDATE actors|DELETE FROM actors/.test(repo));

// 2 · autoridade server-side no envio E no aceite; sujeito nunca do body
check('routes: POST /relationships exige canRepresentActor (envio)',
  /'\/relationships'[\s\S]{0,600}assertRepresentsActor/.test(routes) && /canRepresentActor/.test(routes));
check('routes: POST /relationships/:id/respond exige canRepresentActor (aceite)',
  /'\/relationships\/:id\/respond'[\s\S]{0,600}assertRepresentsActor/.test(routes));
check('routes: GET /relationships/mine exige canRepresentActor (leitura como actor)',
  /'\/relationships\/mine'[\s\S]{0,600}assertRepresentsActor/.test(routes));
check('routes: nenhum handler lê o actor-SUJEITO do body (body.actorId/fromActorId proibidos)',
  !/\bbody\??\.actorId\b|\bbody\??\.fromActorId\b|req\.body\.actorId|req\.body\.fromActorId/.test(stripComments(routes)));
check('service: responder exige ser o actor DESTINO da aresta (fail-closed 403)',
  /toActorId !== respondingActorId/.test(service) && /403/.test(service));

// 3 · vocabulário governado fail-closed (o seed aprovado §7, nem mais nem menos)
const SEED = ['amigo', 'conhecido', 'familiar', 'cliente', 'colaborador', 'fornecedor', 'parceiro'];
check('types: RELATIONSHIP_LABELS = exatamente o seed aprovado (7 labels)',
  SEED.every((l) => types.includes(`'${l}'`)) &&
  (types.match(/RELATIONSHIP_LABELS = \[[\s\S]*?\]/)?.[0].match(/'/g) || []).length === SEED.length * 2);
check('types: pareamento PF/PJ do seed (pf:pf amigo/conhecido/familiar · pf:pj cliente/colaborador/fornecedor · pj:pj fornecedor/cliente/parceiro)',
  /'pf:pf':\s*\['amigo',\s*'conhecido',\s*'familiar'\]/.test(types) &&
  /'pf:pj':\s*\['cliente',\s*'colaborador',\s*'fornecedor'\]/.test(types) &&
  /'pj:pj':\s*\['fornecedor',\s*'cliente',\s*'parceiro'\]/.test(types));
check('service: labels validados fail-closed (assertLabelAllowedForPair no envio E no aceite)',
  (service.match(/assertLabelAllowedForPair\(/g) || []).length >= 3);
check('migration: CHECK do vocabulário em requester_label E target_label',
  (migration.match(/'amigo', 'conhecido', 'familiar', 'cliente', 'colaborador', 'fornecedor', 'parceiro'/g) || []).length >= 2);

// 4 · invariantes de schema
check('migration: from_actor_id <> to_actor_id (não conecta consigo)',
  /CHECK \(from_actor_id <> to_actor_id\)/.test(migration));
check('migration: UNIQUE par não-ordenado (LEAST/GREATEST)',
  /UNIQUE INDEX[\s\S]{0,200}LEAST\(from_actor_id, to_actor_id\), GREATEST\(from_actor_id, to_actor_id\)/.test(migration));
check('migration: RLS ENABLE + FORCE (invariante §1.4 RLS-live, sem gap novo)',
  /actor_relationships ENABLE ROW LEVEL SECURITY/.test(migration) &&
  /actor_relationships FORCE ROW LEVEL SECURITY/.test(migration));
check('migration: status CHECK (pending/accepted/rejected/removed/blocked)',
  /'pending', 'accepted', 'rejected', 'removed', 'blocked'/.test(migration));

// 5 · ponte Opção B sem regressão do fluxo vivo
check('migration: suppliers.actor_id nullable (ponte Opção B)',
  /ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES actors\(id\)/.test(migration));
check('migration: NÃO toca purchase_orders (FK supplier_id do fluxo vivo intacta)',
  !/purchase_orders/i.test(stripComments(migration.replace(/^--.*$/gm, ''))));
check('migration: NÃO dropa/renomeia nada de suppliers (só ADD COLUMN)',
  !/ALTER TABLE suppliers (DROP|RENAME|ALTER COLUMN)/i.test(migration));

// 6 · FATIA 2 — a PONTE colaborador→autoridade (arquivo SEPARADO: o módulo da aresta segue puro).
//     O grant é ato do DONO (canManageCompany revalidado), roteado pro fluxo VIVO de membros
//     (companyMembersService → company_users SSOT DECISION-0042) — nunca INSERT paralelo,
//     nunca can_manage_company, alvo/empresa derivados DA ARESTA (body sem actorId/companyId).
// 🔒 DECISION-0189 (F4/R17): a bridge NÃO pode mais materializar membership 'active' —
// só bootstrap e o aceite canônico de convite criam active. A rota está CONTIDA FAIL-CLOSED
// (410 MEMBERSHIP_VIA_INVITATION_REQUIRED, zero service/DB). Os checks antigos (gate
// canManageCompany → createMember) descreviam o fluxo APOSENTADO; agora o guard prova a
// CONTENÇÃO — reintroduzir materialização direta aqui MORDE.
const bridge = read('src/modules/relationships/actor-relationship-membership-bridge.routes.ts');
const bridgeCode = stripComments(bridge);
check('bridge: CONTIDA fail-closed (410 MEMBERSHIP_VIA_INVITATION_REQUIRED antes de qualquer efeito)',
  /status\(410\)/.test(bridgeCode) && /MEMBERSHIP_VIA_INVITATION_REQUIRED/.test(bridgeCode));
check('bridge: ZERO materialização de membership (sem createMember, sem INSERT/UPDATE em company_users)',
  !/companyMembersService\.createMember/.test(bridgeCode) &&
  !/INSERT INTO company_users|UPDATE company_users/i.test(bridgeCode));
check('bridge: NUNCA escreve can_manage_company (dono só nasce com a empresa)',
  !/can_manage_company|canManageCompany:\s*true/.test(bridgeCode.replace(/canManageCompany\(/g, '')));
check('bridge: zero dinheiro (bank_/ledger/payment)',
  !/bank_|ledger|payment|payout/i.test(bridgeCode));

if (fails.length) {
  console.error(`\nACTOR-RELATIONSHIP-BOUNDARY: ${fails.length} FAIL`);
  process.exit(1);
}
console.log('\nACTOR-RELATIONSHIP-BOUNDARY: OK');
