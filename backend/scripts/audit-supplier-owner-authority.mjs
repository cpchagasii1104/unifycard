#!/usr/bin/env node
// Guard estrutural — F-SUPPLIERS-OWNER-ACTOR-SCHEMA-WIRING (materializa DECISION-0133).
// supplier é company-owned via owner_actor_id (page+company_id). Toda operação da ROTA exige representar o
// owner (canRepresentActor); created_by_actor_id/created_by_user_id/tenant_id/supplier_id NÃO autorizam; RLS
// não é prova. FALHA se:
//   (a) a rota perder a validação ORGANIZACIONAL do owner no create (isOrgActor: actor_type='page' AND company_id);
//   (b) a rota perder canRepresentActor (create + get via loadAndAuthorizeSupplier + list);
//   (c) GET/LIST virarem tenant-only (sem canRepresentActor por owner);
//   (d) o create aceitar owner do BODY como autoridade (sem isOrgActor/canRepresentActor);
//   (e) created_by_actor_id virar owner (passar como ownerActorId);
//   (f) o service não exigir owner (perder SUPPLIER_OWNER_REQUIRED/input.ownerActorId);
//   (g) a migration de owner_actor_id sumir (coluna/FK actors/índice);
//   (h) o repository perder owner_actor_id. Em validate:regression-guards.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const MK = join(ROOT, 'src', 'modules', 'marketplace');
const ROUTES = join(MK, 'supplier.routes.ts');
const SERVICE = join(MK, 'supplier.service.ts');
const REPO = join(MK, 'supplier.repository.ts');
const MIGRATIONS = join(ROOT, 'migrations');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

const failures = [];
const must = (cond, msg) => { if (!cond) failures.push(msg); };

const routes = read(ROUTES);
const service = read(SERVICE);
const repo = read(REPO);
must(routes && service && repo, 'arquivo(s) do módulo supplier ausente(s)');

// (a) validação organizacional do owner no create
must(/actor_type === 'page'/.test(routes) && /company_id != null/.test(routes), 'rota perdeu isOrgActor (page + company_id) no create');
// (b) canRepresentActor presente em create + get + list (>=3 usos)
const repCount = (routes.match(/canRepresentActor/g) || []).length;
must(repCount >= 3, `canRepresentActor deve aparecer no create + get + list (>=3); achei ${repCount}`);
must(/loadAndAuthorizeSupplier/.test(routes), 'rota perdeu loadAndAuthorizeSupplier (get por owner)');
// (c) list não é tenant-only: filtra por canRepresentActor por owner
must(/listSuppliers[\s\S]{0,400}canRepresentActor\([^)]*ownerActorId/.test(routes) || /repCache[\s\S]{0,200}canRepresentActor[\s\S]{0,200}ownerActorId/.test(routes), 'LIST não filtra por canRepresentActor(ownerActorId) — tenant-only proibido');
// (d) create resolve owner server-side (ownerHint via isOrgActor) — body não é autoridade
must(/ownerHint[\s\S]{0,200}isOrgActor\(tenantId, ownerHint\)/.test(routes), 'create não valida o owner-hint via isOrgActor (body viraria autoridade)');
must(/createSupplier\([\s\S]{0,200}ownerActorId: ownerHint\b/.test(routes), 'create não passa o owner RESOLVIDO (ownerActorId: ownerHint) — created_by/actionContext não pode virar owner');
// (e) created_by não é owner
must(!/ownerActorId:\s*actionContext\.actorId\b/.test(routes) || /ownerHint/.test(routes), 'created_by/actionContext.actorId não pode ser passado como ownerActorId direto (use ownerHint validado)');
// (f) service exige owner
must(/SUPPLIER_OWNER_REQUIRED/.test(service) && /input\.ownerActorId/.test(service), 'service não exige owner (SUPPLIER_OWNER_REQUIRED / input.ownerActorId)');
// (g) migration
const migs = existsSync(MIGRATIONS) ? readdirSync(MIGRATIONS) : [];
const mig = migs.find((f) => /suppliers_owner_actor_id\.sql$/.test(f));
must(mig, 'migration suppliers_owner_actor_id ausente');
if (mig) {
  const m = read(join(MIGRATIONS, mig));
  must(/owner_actor_id\s+uuid/i.test(m), 'migration sem coluna owner_actor_id uuid');
  must(/REFERENCES\s+actors\(id\)/i.test(m), 'migration sem FK owner_actor_id → actors(id)');
  must(/idx_suppliers_tenant_owner/.test(m), 'migration sem índice (tenant_id, owner_actor_id)');
  must(!/owner_actor_id[\s\S]{0,40}REFERENCES\s+suppliers/i.test(m), 'owner_actor_id não pode referenciar suppliers (deve ser actors)');
}
// (h) repository expõe owner_actor_id
must(/owner_actor_id/.test(repo) && /ownerActorId/.test(repo), 'repository não persiste/lê owner_actor_id');

// (i) F-SUPPLIERS-STATUS-ENUM-CASE-MISMATCH: status alinhado ao CHECK físico (lowercase active/inactive).
const types = read(join(MK, 'supplier.types.ts'));
const typesCode = types.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''); // sem comentários
must(/SupplierStatus\s*=\s*'active'\s*\|\s*'inactive'/.test(typesCode), "SupplierStatus deve ser 'active' | 'inactive' (lowercase canônico; sem ACTIVE/INACTIVE/SUSPENDED)");
must(!/'ACTIVE'|'INACTIVE'|'SUSPENDED'/.test(typesCode), 'supplier.types.ts não pode conter status uppercase/legado (ACTIVE/INACTIVE/SUSPENDED) no código');
must(/normalizeSupplierStatus/.test(service), 'service deve normalizar status (normalizeSupplierStatus)');
must(!/status:\s*input\.status\s*\|\|\s*'ACTIVE'/.test(service), "service não pode usar default 'ACTIVE' uppercase (CHECK físico é lowercase)");
must(/return 'active'/.test(service), "normalizeSupplierStatus deve ter default canônico 'active'");
must(!/createSupplier[\s\S]{0,400}status:\s*'ACTIVE'/.test(service), 'service não pode persistir status uppercase no create');

if (failures.length) {
  console.error('GATE FAIL [supplier-owner-authority]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('[supplier-owner-authority] owner empresarial (page+company_id) validado + canRepresentActor em create/get/list; create resolve owner server-side (body é hint); service exige owner; migration owner_actor_id+FK actors+índice; repository expõe owner_actor_id; created_by/tenant/supplier_id não autorizam (DECISION-0133).');
console.log('GATE OK [supplier-owner-authority] — suppliers company-owned material; toda operação exige representar o owner.');
