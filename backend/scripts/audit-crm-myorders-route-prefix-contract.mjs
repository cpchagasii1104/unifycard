#!/usr/bin/env node
// Guard estrutural — F-CRM-MYORDERS-ROUTE-PREFIX-FIX (achado B5 do auditoria.md, 2026-07-02).
//
// HISTÓRICO: api/crm.ts chamava `/crm/*` (real: `/marketplace/crm/*`) — 404 numa tela viva. Esse
// bug de prefixo ficou MOOT na Fatia 7 (F-CRM-PROJECTION-SUPPLIERS-RECONCILIATION, 2026-07-05):
// o módulo crm.* inteiro (backend E frontend, api/crm.ts + CrmContactDetailPage.tsx) foi REMOVIDO
// — era ghost vivo sem guard, lendo tabelas fantasma (crm_notes/crm_tags/...), bomba de 42P01. CRM
// agora é projeção de actor_relationships (CrmPage.tsx). A checagem de prefixo do crm.ts não faz
// mais sentido (nada chama mais `/crm/` nem `/marketplace/crm/`) — MORDE se o arquivo voltar
// (religação de ghost sem gênese própria) ou se qualquer coisa chamar `/marketplace/crm/`.
//
// api/my-orders.ts chamava `/my-orders*` (real: `/api/my-orders*` — my-orders.module.ts:8 registra
// sob prefix '/api'). Sem rewrite/proxy no client (client.ts usa API_BASE_URL absoluto) — o path do
// frontend É o path real. Confirmado ao vivo: rota antiga = 404, rota corrigida = 401 (rota existe,
// exige auth) — não é falso positivo de auditoria estática. Esta parte SEGUE VIVA e vigiada.
//
// MORDE: api/crm.ts ressuscitar, qualquer coisa chamar /marketplace/crm/, OU my-orders.ts voltar a
// chamar o prefixo errado. Heurística textual simples — este NÃO é problema de lógica, é contrato
// de string. Em validate:regression-guards (roda no backend, mas audita arquivos do frontend —
// precedente: nenhum guard cross-repo até agora; caminho relativo a partir da raiz do monorepo).

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

// cwd é backend/ quando chamado pela cadeia de gates — sobe um nível pra achar frontend/.
const ROOT = process.cwd().endsWith('backend') ? join(process.cwd(), '..') : process.cwd();

const failures = [];

// crm.ts foi REMOVIDO de propósito na Fatia 7 — a checagem agora é "continua removido" (fecha
// F-CRM-PROJECTION-SUPPLIERS-RECONCILIATION), não "tem o prefixo certo".
const CRM = join(ROOT, 'frontend', 'src', 'api', 'crm.ts');
if (existsSync(CRM)) {
  failures.push(`${CRM}: ressuscitou — o módulo crm.* foi removido na Fatia 7 (ghost sem gênese própria); religar exige frente própria, não reintroduzir o arquivo`);
}
{
  const FRONT_SRC = join(ROOT, 'frontend', 'src');
  const offenders = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(full); continue; }
      if (!/\.(ts|tsx)$/.test(e.name)) continue;
      const src = readFileSync(full, 'utf-8');
      if (/\/marketplace\/crm\//.test(src)) offenders.push(full.replace(ROOT.replace(/\\/g, '/') + '/', ''));
    }
  };
  walk(FRONT_SRC);
  if (offenders.length > 0) {
    failures.push(`chamada(s) a /marketplace/crm/ encontrada(s) — o módulo foi removido (Fatia 7): ${offenders.join(', ')}`);
  }
}

const MYORDERS = join(ROOT, 'frontend', 'src', 'api', 'my-orders.ts');
if (!existsSync(MYORDERS)) {
  failures.push(`arquivo ausente: ${MYORDERS}`);
} else {
  const src = readFileSync(MYORDERS, 'utf-8');
  const bareMyOrdersCalls = src.match(/apiFetchJson[^(]*\(\s*[`'](?!\/api\/my-orders)\/my-orders/g);
  if (bareMyOrdersCalls) {
    failures.push(`${MYORDERS}: chamada(s) a /my-orders sem o prefixo /api — 404 real (achado B5): ${bareMyOrdersCalls.join(', ')}`);
  }
  if (!/\/api\/my-orders/.test(src)) {
    failures.push(`${MYORDERS}: nenhuma chamada a /api/my-orders encontrada — fix não parece aplicado.`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [crm-myorders-route-prefix-contract]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [crm-myorders-route-prefix-contract] — api/crm.ts permanece removido (Fatia 7, ghost sem gênese própria) e nada chama /marketplace/crm/; api/my-orders.ts chama /api/my-orders* (prefixo real confirmado ao vivo: 401, não 404). Achado B5 do auditoria.md + Fatia 7 blindados.');
