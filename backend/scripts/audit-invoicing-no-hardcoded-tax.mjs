#!/usr/bin/env node
// audit-invoicing-no-hardcoded-tax.mjs — GUARD (standalone) da DT-INVOICING-HARDCODED-TAX-RATE.
// Prova, de forma determinística e comment-aware, que:
//   1. NENHUM literal de alíquota fiscal permanece no CÓDIGO do módulo invoicing (ex.: `* 0.05`);
//   2. `createInvoiceFromPayout` é FAIL-CLOSED: emite o marcador canônico INVOICE_FISCAL_CONFIG_MISSING
//      e NÃO chama `invoiceRepository.create(` (não fabrica nem persiste documento fiscal);
//   3. o motor NÃO inventa imposto default (sem `taxesCents = <número>`), respeitando a doutrina
//      `fiscal_config_missing` (DECISION-0166 "Lei do Contador").
// NÃO entra em run-regression-guards.mjs (mantém o fingerprint do runner intacto para outras frentes).
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SVC = resolve(ROOT, 'src/modules/invoicing/invoice.service.ts');
const MARK = '[invoicing-no-hardcoded-tax]';

/** Remove comentários de linha (//...) e de bloco para não dar falso-positivo em prosa. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const raw = readFileSync(SVC, 'utf8');
const code = stripComments(raw);
const fails = [];

// 1. Nenhum literal de alíquota no código (multiplicação/round por fração 0.dd).
const rateLiteral = /(\*|Math\.round\([^)]*\*)\s*0\.\d+/g;
const hits = code.match(rateLiteral);
if (hits) fails.push(`literal de alíquota fiscal ainda presente no código: ${JSON.stringify(hits)}`);

// 2. Marcador fail-closed canônico presente.
if (!/INVOICE_FISCAL_CONFIG_MISSING/.test(code)) {
  fails.push('marcador fail-closed INVOICE_FISCAL_CONFIG_MISSING ausente (createInvoiceFromPayout deve recusar fechado)');
}

// 3. O service NÃO persiste invoice fabricado (não chama invoiceRepository.create()).
if (/invoiceRepository\.create\s*\(/.test(code)) {
  fails.push('invoiceRepository.create( ainda é chamado no service — emissão fabricada não foi contida');
}

// 4. Não há taxesCents atribuído a valor no código (nenhuma reintrodução de imposto default/fabricado).
if (/taxesCents\s*[:=]\s*(Math\.|[0-9])/.test(code)) {
  fails.push('taxesCents recebe valor fabricado no código — o sistema não pode inventar imposto');
}

if (fails.length) {
  console.error(`❌ ${MARK} FAIL — ${fails.length} problema(s):`);
  for (const f of fails) console.error(`   - ${f}`);
  process.exit(1);
}
console.log(`✅ GATE OK ${MARK} — sem alíquota hardcoded no código; createInvoiceFromPayout fail-closed (INVOICE_FISCAL_CONFIG_MISSING), sem create() fabricado, sem imposto default. DT-INVOICING-HARDCODED-TAX-RATE contida no backend alcançável.`);
