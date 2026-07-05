#!/usr/bin/env node
// audit-erp-composed-view.mjs
// Guard F-ERP-COMPOSED-VIEW (Fatia 8, GUIA_MESTRE §3/§275 — "ERP composto: vista integrada
// estoque+pedidos+agenda+financeiro pela empresa"). Congela os invariantes:
//   1 · purchaseOrderRepository.listByOwner existe, escopado em SQL por tenant_id+owner_actor_id
//       (nunca full-tenant-scan+pós-filtro dentro do actor-page);
//   2 · o bloco 'erp' só nasce em mode='operating' + actor page+company_id (DECISION-0133) —
//       nunca aparece pra visitante nem pra actor pessoa física;
//   3 · estoque/agenda do bloco erp REUSAM os blocos JÁ computados (blocks.find) — zero
//       chamada NOVA a listVisibleProducts/unifiedAvailabilityService pra montar o erp;
//   4 · financeiro é SÓ deeplink — o contrato NUNCA carrega saldo/balanceCents/amount (fronteira
//       anti-dinheiro literal do módulo, ratificada no cabeçalho de actor-page.types.ts);
//   5 · zero import de bank_/ledger/wallet-statement em actor-page.service.ts — dinheiro não
//       entra nem por leitura (mesmo sendo tecnicamente distinto de PORTA-1);
//   6 · frontend: ActorPage.tsx renderiza o bloco 'erp' (não cai no default genérico).
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const fails = [];
const check = (label, ok) => { if (!ok) fails.push(label); console.log(`  ${ok ? 'OK ' : 'FAIL'} ${label}`); };
const stripComments = (s) => s.split('\n').filter((l) => { const t = l.trim(); return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*'); }).join('\n');

const poRepo = read('src/modules/marketplace/purchase-order.repository.ts');
const service = read('src/modules/actor-page/actor-page.service.ts');
const types = read('src/modules/actor-page/actor-page.types.ts');
const serviceCode = stripComments(service);

// 1 · listByOwner escopado em SQL
check('purchase-order.repository: listByOwner(...) existe',
  /async listByOwner\(/.test(poRepo));
check('purchase-order.repository: listByOwner escopa por tenant_id E owner_actor_id em SQL (não full-scan)',
  /listByOwner[\s\S]{0,400}WHERE tenant_id = \$1 AND owner_actor_id = \$2/.test(poRepo));

// 2 · gate mode=operating + page + company_id
check("actor-page.service: bloco 'erp' exige mode === 'operating'",
  /mode === 'operating' && actor\.actor_type === 'page' && actor\.company_id/.test(serviceCode));

// 3 · reuso dos blocos já computados (composição, não SQL novo)
const erpAssemblyMatch = serviceCode.match(/if \(mode === 'operating'[\s\S]{0,1500}?tabs\.push\(\{ key: 'erp'/);
check("actor-page.service: bloco erp existe e reusa blocks.find (products/agenda) — não chama listVisibleProducts/unifiedAvailabilityService de novo",
  !!erpAssemblyMatch &&
  /blocks\.find\(\(b\) => b\.type === 'products'\)/.test(erpAssemblyMatch[0]) &&
  /blocks\.find\(\(b\) => b\.type === 'agenda'\)/.test(erpAssemblyMatch[0]) &&
  !/listVisibleProducts\(/.test(erpAssemblyMatch[0]) &&
  !/unifiedAvailabilityService\./.test(erpAssemblyMatch[0]));
check('actor-page.service: pedidos usa APENAS purchaseOrderRepository.listByOwner (o único reader novo desta fatia)',
  !!erpAssemblyMatch && /purchaseOrderRepository\.listByOwner\(/.test(erpAssemblyMatch[0]));

// 4 · financeiro é só deeplink — nunca dinheiro no contrato
check("actor-page.service: financeiro é { deeplink: '/wallet' } — sem número de saldo",
  !!erpAssemblyMatch && /financeiro: \{ deeplink: '\/wallet' \}/.test(erpAssemblyMatch[0]));
check('actor-page.service: bloco erp não carrega balanceCents/saldo/amount (anti-dinheiro)',
  !!erpAssemblyMatch && !/balanceCents|saldo|amountCents/i.test(erpAssemblyMatch[0]));

// 5 · zero acesso a dinheiro no módulo inteiro
check('actor-page.service: zero bank_/ledger/wallet-statement (dinheiro não entra nem por leitura)',
  !/bank_|ledger|walletStatement|wallet-statement/i.test(serviceCode));
check('actor-page.types: fronteira anti-dinheiro documentada explicitamente pro bloco erp',
  /pilar FINANCEIRO é só deeplink/.test(types));

// 6 · frontend renderiza o bloco
const FRONT = resolve(ROOT, '..', 'frontend', 'src');
const readF = (p) => readFileSync(resolve(FRONT, p), 'utf8');
try {
  const page = readF('pages/ActorPage.tsx');
  check("frontend: ActorPage.tsx tem case 'erp' dedicado (não cai no default genérico)",
    /case 'erp':/.test(page));
  check("frontend: bloco erp renderiza o deeplink financeiro (não número)",
    /financeiro\.deeplink/.test(page) && !/financeiro\.(balance|saldo|amount)/i.test(page));
} catch (e) {
  check(`frontend: ActorPage.tsx legível (${e.message})`, false);
}

if (fails.length) {
  console.error(`\nERP-COMPOSED-VIEW: ${fails.length} FAIL`);
  process.exit(1);
}
console.log('\nERP-COMPOSED-VIEW: OK');
