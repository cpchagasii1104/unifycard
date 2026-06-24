#!/usr/bin/env node
// Guard — F-BUCKET-A-HYGIENE-SWEEP / DT-INTERNAL-SSOT-ADMIN-TENANT-QUERY-HYGIENE.
//
// /admin/ssot é TENANT-admin: req.tenant é a autoridade de escopo; req.query.tenantId NUNCA amplia.
// MORDE se: (1) ssot-admin atribuir options.tenantId a partir de req.query.tenantId (escopo do cliente);
// (2) sumir o bind ao tenant autenticado (options.tenantId = req.tenant.id) ou o 403 de escopo divergente.
// PLATFORM-admin cross-tenant exigiria DECISION/rota/autoridade próprias (não implícito via query).

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FILE = 'src/core/categories/ssot-admin.routes.ts';
const p = join(ROOT, FILE);
const failures = [];

if (!existsSync(p)) {
  failures.push(`${FILE}: ausente.`);
} else {
  const s = readFileSync(p, 'utf-8');
  // (1) PROIBIDO: options.tenantId derivado de req.query.tenantId.
  if (/options\.tenantId\s*=\s*req\.query\.tenantId/.test(s)) {
    failures.push(`${FILE}: options.tenantId = req.query.tenantId — query do cliente NÃO pode definir o escopo (tenant-admin). Bind a req.tenant.id.`);
  }
  // (2) bind ao tenant autenticado + 403 de escopo divergente.
  if (!/tenantId:\s*req\.tenant\.id/.test(s)) {
    failures.push(`${FILE}: options não escopa a req.tenant.id (risco de cross-tenant quando query ausente).`);
  }
  if (!/req\.query\.tenantId\s*&&\s*req\.query\.tenantId\s*!==\s*req\.tenant\.id[\s\S]{0,160}?(403|FORBIDDEN)/.test(s)) {
    failures.push(`${FILE}: sem 403 quando req.query.tenantId difere de req.tenant.id (escopo divergente).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [ssot-admin-tenant-bound]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [ssot-admin-tenant-bound] — /admin/ssot escopa a req.tenant.id; req.query.tenantId não amplia (403 se divergir). DT-INTERNAL-SSOT-ADMIN-TENANT-QUERY-HYGIENE fechado.');
