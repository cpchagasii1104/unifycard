#!/usr/bin/env node
// audit-erp-composed-view.mjs
// Guard F-ERP-COMPOSED-VIEW (Fatia 8, GUIA_MESTRE §3/§275 — "ERP composto: vista integrada
// estoque+pedidos+agenda+financeiro pela empresa"). Congela os invariantes:
//   1 · purchaseOrderRepository.listByOwner existe, escopado em SQL por tenant_id+owner_actor_id
//       (nunca full-tenant-scan+pós-filtro dentro do actor-page);
//   2 · [CONVERGIDO em F-ERP-TWO-SIDED, 2026-08-01] o bloco 'erp' só nasce para actor
//       page+company_id (DECISION-0133) E só para quem PROVOU representar a empresa —
//       `operatesThisPage` (403 fail-closed na rota) OU `actingAsThisPage` (viewerActorId ===
//       actorId, e viewerActorId só é honrado se canRepresentActor provou: DECISION-0113 D4/D9).
//       Nunca aparece pra visitante nem pra actor pessoa física. O que MUDOU: deixou de ser
//       "só em mode=operating", porque COMPRAR É CONSUMIR e o lado de compra (purchase_orders)
//       estava trancado no modo de vender. O que NÃO mudou: a autoridade. Detalhe das duas
//       caras em audit-erp-two-sided-mode-projection.mjs;
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

// 2 · gate: empresa (page+company_id) E representação PROVADA — nunca visitante, nunca PF
check("actor-page.service: bloco 'erp' exige empresa (actor_type page + company_id)",
  /const isCompanyPage = actor\.actor_type === 'page' && !!actor\.company_id;/.test(serviceCode));
check("actor-page.service: bloco 'erp' exige representação provada (operatesThisPage || actingAsThisPage)",
  /if \(isCompanyPage && \(operatesThisPage \|\| actingAsThisPage\)\)/.test(serviceCode));
check("actor-page.service: 'actingAsThisPage' é viewerActorId === actorId (autoridade da rota, não nova)",
  /const actingAsThisPage = !!viewerActorId && viewerActorId === actorId;/.test(serviceCode));

// 3 · reuso dos blocos já computados (composição, não SQL novo) — face de VENDA
const erpAssemblyMatch = serviceCode.match(/if \(operatesThisPage\)[\s\S]{0,1500}?tabs\.push\(\{ key: 'erp'/);
check("actor-page.service: bloco erp existe e reusa blocks.find (products/agenda) — não chama listVisibleProducts/unifiedAvailabilityService de novo",
  !!erpAssemblyMatch &&
  /blocks\.find\(\(b\) => b\.type === 'products'\)/.test(erpAssemblyMatch[0]) &&
  /blocks\.find\(\(b\) => b\.type === 'agenda'\)/.test(erpAssemblyMatch[0]) &&
  !/listVisibleProducts\(/.test(erpAssemblyMatch[0]) &&
  !/unifiedAvailabilityService\./.test(erpAssemblyMatch[0]));
// F-ERP-TWO-SIDED: a leitura de pedidos passou a ser feita UMA vez, ANTES do split das duas caras
// (as duas usam o mesmo resultado). Por isso a asserção olha a REGIÃO INTEIRA do bloco erp, não só
// a fatia da face de venda — e continua exigindo que listByOwner seja o único reader ali dentro.
const erpRegionMatch = serviceCode.match(/if \(isCompanyPage && \(operatesThisPage \|\| actingAsThisPage\)\)[\s\S]{0,2600}?tabs\.push\(\{ key: 'erp', label: 'ERP · Compras' \}\);/);
check('actor-page.service: pedidos usa APENAS purchaseOrderRepository.listByOwner (escopado por owner_actor_id em SQL)',
  !!erpRegionMatch && /purchaseOrderRepository\.listByOwner\(/.test(erpRegionMatch[0])
  && !/listSuppliers|listVisibleProducts\(|unifiedAvailabilityService\./.test(erpRegionMatch[0]));

// 4 · financeiro é só deeplink — nunca dinheiro no contrato
check("actor-page.service: financeiro é { deeplink: '/wallet' } — sem número de saldo",
  !!erpAssemblyMatch && /financeiro: \{ deeplink: '\/wallet' \}/.test(erpAssemblyMatch[0]));
check('actor-page.service: bloco erp não carrega balanceCents/saldo/amount (anti-dinheiro)',
  !!erpAssemblyMatch && !/balanceCents|saldo|amountCents/i.test(erpAssemblyMatch[0]));

// 4b · F-ERP-TWO-SIDED: a face de COMPRA nasce DENTRO da mesma fronteira anti-dinheiro.
// Sem isto, a cara nova poderia carregar valor monetário sem nenhum guard notar.
const erpSupplyMatch = serviceCode.match(/side: 'supply'[\s\S]{0,900}?tabs\.push\(\{ key: 'erp'/);
check("actor-page.service: face de COMPRA (side:'supply') existe e é montada",
  !!erpSupplyMatch);
check("actor-page.service: face de COMPRA — financeiro é { deeplink: '/wallet' }, sem número",
  !!erpSupplyMatch && /financeiro: \{ deeplink: '\/wallet' \}/.test(erpSupplyMatch[0]));
check('actor-page.service: face de COMPRA não carrega balanceCents/saldo/amount (anti-dinheiro)',
  !!erpSupplyMatch && !/balanceCents|saldo|amountCents/i.test(erpSupplyMatch[0]));
check('actor-page.service: face de COMPRA usa APENAS purchaseOrderRepository.listByOwner (escopado por dono em SQL)',
  !!erpSupplyMatch && !/listSuppliers|listVisibleProducts\(|unifiedAvailabilityService\./.test(erpSupplyMatch[0]));

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
