#!/usr/bin/env node
// Guard estrutural — F-CRM-MYORDERS-ROUTE-PREFIX-FIX (achado B5 do auditoria.md, 2026-07-02).
//
// api/crm.ts chamava `/crm/*` (real: `/marketplace/crm/*` — crmRoutes registrado dentro de
// marketplace.routes.ts:133, montado sob prefix '/marketplace' em app.builder.ts). api/my-orders.ts
// chamava `/my-orders*` (real: `/api/my-orders*` — my-orders.module.ts:8 registra sob prefix '/api').
// Sem rewrite/proxy no client (client.ts usa API_BASE_URL absoluto) — o path do frontend É o path
// real. Resultado: 404 em 2 telas vivas (CrmContactDetailPage via App.tsx:341; My Orders via
// App.tsx:318-319). Confirmado ao vivo: rota antiga = 404, rota corrigida = 401 (rota existe, exige
// auth) — não é falso positivo de auditoria estática.
//
// MORDE: qualquer um dos 2 clients voltar a chamar o prefixo errado (sem o path completo correto).
// Heurística textual simples — este NÃO é problema de lógica, é contrato de string.
// Em validate:regression-guards (roda no backend, mas audita arquivos do frontend — precedente:
// nenhum guard cross-repo até agora; caminho relativo a partir da raiz do monorepo).

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// cwd é backend/ quando chamado pela cadeia de gates — sobe um nível pra achar frontend/.
const ROOT = process.cwd().endsWith('backend') ? join(process.cwd(), '..') : process.cwd();

const failures = [];

const CRM = join(ROOT, 'frontend', 'src', 'api', 'crm.ts');
if (!existsSync(CRM)) {
  failures.push(`arquivo ausente: ${CRM}`);
} else {
  const src = readFileSync(CRM, 'utf-8');
  const bareCrmCalls = src.match(/apiFetch(?:Json)?\(\s*[`'](?!\/marketplace\/crm)\/crm\//g);
  if (bareCrmCalls) {
    failures.push(`${CRM}: chamada(s) a /crm/ sem o prefixo /marketplace — 404 real (achado B5): ${bareCrmCalls.join(', ')}`);
  }
  if (!/\/marketplace\/crm\//.test(src)) {
    failures.push(`${CRM}: nenhuma chamada a /marketplace/crm/ encontrada — fix não parece aplicado.`);
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
console.log('GATE OK [crm-myorders-route-prefix-contract] — api/crm.ts chama /marketplace/crm/*, api/my-orders.ts chama /api/my-orders* (prefixos reais confirmados ao vivo: 401, não 404). Achado B5 do auditoria.md blindado.');
