#!/usr/bin/env node
// Gate estrutural — fecha a CLASSE do BLOCKER Yala 2026-07-06: policy RLS com GUC errado = quebra-fechada
// silenciosa (o CI fica verde porque E2E-como-superuser bypassa RLS). O GUC canônico de tenant é
// `app.current_tenant` (pool.ts). Este guard varre TODAS as migrations e morde qualquer CREATE POLICY
// que use `app.tenant_id` ou `app.current_tenant_id` (nunca setados pelo runtime) — EXCETO a migration
// corretiva (que só os cita em comentário). GUCs legítimos: app.current_tenant, app.is_platform_admin,
// app.concept_governance (não-tenant).
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DIR = join(process.cwd(), 'migrations');
// Históricas SUPERSEDED pela corretiva 20260706160000 (as policies erradas foram DROP+recriadas no DB;
// os arquivos são imutáveis por norma forward-only). Qualquer arquivo NOVO com o GUC errado morde.
const SUPERSEDED = new Set([
  '20260706150000_follows_rls_and_not_self.sql',
  '20260428220000_create_webauthn_tables.sql',
  '20260428230000_create_audit_events.sql',
  '20260428240000_create_category_ai_logs.sql',
]);
const failures = [];
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.sql') && !SUPERSEDED.has(x))) {
  const raw = readFileSync(join(DIR, f), 'utf8');
  const code = raw.replace(/--[^\n]*/g, ''); // comentários fora
  if (/current_setting\(\s*'+app\.(tenant_id|current_tenant_id)'+/.test(code)) {
    // a corretiva RECRIA policies certas; se ela mesma contivesse o GUC errado em código, morde igual.
    const bad = code.match(/current_setting\(\s*'+app\.(tenant_id|current_tenant_id)'+/g) || [];
    failures.push(`${f}: ${bad.length}× GUC de tenant NÃO-CANÔNICO (app.tenant_id/app.current_tenant_id — runtime só seta app.current_tenant; policy nunca casa = quebra-fechada).`);
  }
}
console.log(`[rls-policy-guc-canonical] failures=${failures.length}`);
if (failures.length) {
  console.error('GATE FAIL [rls-policy-guc-canonical]:');
  failures.forEach((x) => console.error('  ❌', x));
  process.exit(1);
}
console.log('GATE OK [rls-policy-guc-canonical] — nenhuma policy com GUC de tenant não-canônico; a classe do BLOCKER (quebra-fechada por GUC errado) está travada.');
