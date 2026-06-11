#!/usr/bin/env node
// Gate estrutural — F-C1-BIRTH-MINIMUM-ATOMIC-ORGANIC
// Impede regressão do nascimento humano orgânico (register).
//
// Invariantes verificados no método `register` de auth.service.ts (+ auth.routes.ts):
//   1. tenant institucional resolvido SERVER-SIDE (getTenantBySlug('unificard-inicial'));
//   2. register NÃO cria tenant `user-*` por signup (sem createTenant / template `user-${`);
//   3. x-tenant-id NÃO escolhe tenant (param tenantId marcado ignorado: `void tenantId`);
//   4. nascimento ATÔMICO (withTransaction) com identity + actor TRANSACIONAIS
//      (ensureIdentityRowForGlobalUserTx + ensureUserActorTx);
//   5. SEM best-effort de identity/actor ("retentar no próximo acesso" / ensureUserActor não-Tx);
//   6. token (generateTokens) emitido DEPOIS do withTransaction (após COMMIT).
//
// NÃO declara: read purity fechada, gender fechado, invite override implementado, C1 completo.
// O override cross-tenant por convite permanece PENDENTE DE SUBSTRATO (fora desta fatia).

import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(process.cwd(), 'src');
const svc = readFileSync(join(ROOT, 'core/auth/auth.service.ts'), 'utf8');

// Extrai o corpo do método register (da assinatura até o início de `async login`).
const startIdx = svc.indexOf('async register(');
const endIdx = svc.indexOf('async login(', startIdx);
if (startIdx < 0 || endIdx < 0) {
  console.error('GATE FAIL [register-birth]: não foi possível localizar o método register em auth.service.ts');
  process.exit(1);
}
const register = svc.slice(startIdx, endIdx);

const failures = [];

// 1. tenant server-side por slug institucional
if (!/getTenantBySlug\(\s*['"]unificard-inicial['"]\s*\)/.test(register)) {
  failures.push("INV1: register deve resolver tenant server-side via getTenantBySlug('unificard-inicial').");
}

// 2. proibido tenant-per-signup
if (/createTenant\(/.test(register)) {
  failures.push('INV2: register NÃO pode chamar createTenant (tenant-per-signup proibido).');
}
if (/`user-\$\{/.test(register) || /user-\$\{emailSlug\}/.test(register)) {
  failures.push('INV2: register NÃO pode montar slug de tenant `user-${...}` (tenant-per-signup proibido).');
}

// 3. x-tenant-id não é autoridade (param ignorado explicitamente)
if (!/void tenantId;/.test(register)) {
  failures.push('INV3: o parâmetro tenantId (header x-tenant-id) deve ser ignorado explicitamente (`void tenantId;`).');
}

// 4. nascimento atômico + identity/actor transacionais
if (!/withTransaction\(/.test(register)) {
  failures.push('INV4: nascimento deve ocorrer em withTransaction (transação única).');
}
if (!/ensureIdentityRowForGlobalUserTx\(/.test(register)) {
  failures.push('INV4: identity deve ser criada na transação (ensureIdentityRowForGlobalUserTx).');
}
if (!/ensureUserActorTx\(/.test(register)) {
  failures.push('INV4: actor deve ser criado na transação (ensureUserActorTx).');
}

// 5. sem best-effort de identity/actor
if (/retentado no próximo acesso/.test(register)) {
  failures.push('INV5: proibido "retentado no próximo acesso" (identity/actor best-effort).');
}
if (/ensureUserActor\(finalTenantId/.test(register) || /await ensureUserActor\(/.test(register)) {
  failures.push('INV5: proibido ensureUserActor não-transacional no register (use ensureUserActorTx na tx).');
}
if (/ensureIdentityRowForGlobalUserId\(/.test(register)) {
  failures.push('INV5: proibido ensureIdentityRowForGlobalUserId não-transacional no register (use a variante Tx).');
}

// 6. token após o withTransaction (após COMMIT)
const txIdx = register.indexOf('withTransaction(');
const tokenIdx = register.indexOf('this.generateTokens(');
if (txIdx < 0 || tokenIdx < 0 || tokenIdx < txIdx) {
  failures.push('INV6: token (generateTokens) deve ser gerado DEPOIS do withTransaction (após COMMIT).');
}

console.log('[register-birth] invariantes do nascimento orgânico atômico:');
console.log('  INV1 tenant server-side (unificard-inicial)');
console.log('  INV2 sem tenant-per-signup (user-*)');
console.log('  INV3 x-tenant-id ignorado');
console.log('  INV4 transação única + identity/actor Tx');
console.log('  INV5 sem best-effort identity/actor');
console.log('  INV6 token após COMMIT');
console.log('[register-birth] NOTA: NÃO cobre read purity / gender / invite override / C1 completo (fatias futuras).');

if (failures.length > 0) {
  console.error('GATE FAIL [register-birth]:');
  failures.forEach((f) => console.error('  ', f));
  process.exit(1);
}
console.log('GATE OK [register-birth] — nascimento orgânico tenant-bound e atômico (Fatia 1). Override cross-tenant por convite: PENDENTE.');
