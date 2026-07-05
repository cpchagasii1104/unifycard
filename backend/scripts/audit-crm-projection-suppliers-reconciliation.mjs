#!/usr/bin/env node
// audit-crm-projection-suppliers-reconciliation.mjs
// Guard F-CRM-PROJECTION-SUPPLIERS-RECONCILIATION (Fatia 7, GUIA_MESTRE §2B/§3/§4 — Opção B
// RATIFICADA por Clayton 2026-07-04). Congela os invariantes:
//   1 · o módulo crm.* (SPRINT 88) está REALMENTE removido — não apenas contido. Achado do
//       read-first: estava VIVO e registrado (/marketplace/crm/*) SEM guard, lendo tabelas
//       fantasma (crm_notes/crm_tags/crm_consents/crm_contact_tags) — bomba de 42P01 em runtime.
//   2 · frontend não chama mais o ghost (api/crm.ts e CrmContactDetailPage.tsx removidos; App.tsx
//       sem a rota crm/contacts/:id);
//   3 · CRM = PROJEÇÃO — CrmPage.tsx compõe getMyRelationships (Fatia 1) + listSuppliers
//       (ERP vivo), nunca chama um endpoint CRM-próprio novo;
//   4 · suppliers.actor_id (ponte Fatia 1, Opção B) está WIRED: types/repository/service
//       leem/escrevem a coluna; existência do actor é PROVADA (fail-closed) antes de gravar —
//       nunca confia no hint do cliente;
//   5 · PATCH /suppliers/:id/link-actor exige representar o owner empresarial (mesma catraca de
//       qualquer mutação de supplier — loadAndAuthorizeSupplier), nunca autoriza sozinho;
//   6 · módulo contact.* (irmão, gênese própria) permanece INTOCADO — este guard não mexe nele.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FRONT = resolve(ROOT, '..', 'frontend', 'src');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const readF = (p) => readFileSync(resolve(FRONT, p), 'utf8');
const fails = [];
const check = (label, ok) => { if (!ok) fails.push(label); console.log(`  ${ok ? 'OK ' : 'FAIL'} ${label}`); };

// 1 · módulo crm.* REALMENTE removido (não contido — removido)
check('backend: src/modules/crm/ não existe mais (ghost reachable removido, não só contido)',
  !existsSync(resolve(ROOT, 'src/modules/crm')));
const marketplaceRoutes = read('src/modules/marketplace/marketplace.routes.ts');
check('backend: marketplace.routes.ts não importa/registra crmRoutes',
  !/crmRoutes/.test(marketplaceRoutes) && !/from '\.\.\/crm\/crm\.routes'/.test(marketplaceRoutes));
check('backend: módulo contact.* (irmão, gênese própria) permanece intocado',
  existsSync(resolve(ROOT, 'src/modules/marketplace/contact.routes.ts')) &&
  existsSync(resolve(ROOT, 'src/modules/marketplace/contact-feature.guard.ts')));

// 2 · frontend não chama mais o ghost
check('frontend: api/crm.ts removido', !existsSync(resolve(FRONT, 'api/crm.ts')));
check('frontend: CrmContactDetailPage.tsx removido', !existsSync(resolve(FRONT, 'pages/CrmContactDetailPage.tsx')));
const appTsx = readF('App.tsx');
check("frontend: App.tsx sem a rota 'crm/contacts/:id' nem import de CrmContactDetailPage",
  !/crm\/contacts\/:id/.test(appTsx) && !/CrmContactDetailPage/.test(appTsx));

// 3 · CRM = projeção (compõe, não inventa endpoint próprio)
const crmPage = readF('pages/CrmPage.tsx');
check('frontend: CrmPage.tsx usa getMyRelationships (aresta Fatia 1) — não lista contacts fantasma',
  /getMyRelationships/.test(crmPage) && !/from '\.\.\/api\/contacts'/.test(crmPage));
check('frontend: CrmPage.tsx compõe listSuppliers (ERP vivo) na aba Fornecedores',
  /listSuppliers/.test(crmPage));
check("frontend: CrmPage.tsx não chama nenhum endpoint '/crm/' ou '/marketplace/crm' novo",
  !/['"`]\/crm\//.test(crmPage) && !/marketplace\/crm/.test(crmPage));

// 4 · suppliers.actor_id wired (types/repository/service)
const supplierTypes = read('src/modules/marketplace/supplier.types.ts');
const supplierRepo = read('src/modules/marketplace/supplier.repository.ts');
const supplierService = read('src/modules/marketplace/supplier.service.ts');
check('supplier.types: Supplier.actorId e CreateSupplierInput.actorId existem',
  /actorId: string \| null;/.test(supplierTypes) && /actorId\?: string \| null;/.test(supplierTypes));
check('supplier.repository: actor_id lido/escrito (INSERT + SELECT + toSupplier)',
  /actor_id/.test(supplierRepo) && /actorId: row\.actor_id/.test(supplierRepo));
check('supplier.repository: linkActor(...) existe (reconciliação de fornecedor já cadastrado)',
  /async linkActor\(/.test(supplierRepo));
check('supplier.service: assertActorExists prova existência ANTES de gravar actor_id (fail-closed, nunca confia no hint)',
  /assertActorExists/.test(supplierService) && /SUPPLIER_ACTOR_ID_INVALID/.test(supplierService));
check('supplier.service: linkSupplierActor(...) existe e reusa assertActorExists',
  /async linkSupplierActor\(/.test(supplierService));

// 5 · autoridade do link-actor
const supplierRoutes = read('src/modules/marketplace/supplier.routes.ts');
check("routes: PATCH /suppliers/:id/link-actor exige loadAndAuthorizeSupplier (representar o owner)",
  /'\/suppliers\/:id\/link-actor'[\s\S]{0,400}loadAndAuthorizeSupplier/.test(supplierRoutes));

if (fails.length) {
  console.error(`\nCRM-PROJECTION-SUPPLIERS-RECONCILIATION: ${fails.length} FAIL`);
  process.exit(1);
}
console.log('\nCRM-PROJECTION-SUPPLIERS-RECONCILIATION: OK');
