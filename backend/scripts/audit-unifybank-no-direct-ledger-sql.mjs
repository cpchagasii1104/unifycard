#!/usr/bin/env node
// audit-unifybank-no-direct-ledger-sql.mjs — GUARD de fronteira Bank do ENDPOINT do Fundo Regional
// (R-8, GATE VEREDITO A). Prova que o caminho vivo de GET /bank/regional-fund
// (transparency.service.getUserRegionalFund) NÃO acessa diretamente bank_ledger/bank_transactions/
// bank_accounts por SQL, e SIM pelos readers PÚBLICOS do domínio Bank (modules/bank) —
// BANK_DOMAIN_RULES §3 / LEI_DE_COERENCIA §4.6 / SSOT_REGISTRY §5.2.
//
// ESCOPO DELIBERADO: só o método getUserRegionalFund (o endpoint da Fatia D). NÃO cobre a dívida-irmã
// (_getStatementForAccount / getTransactionSplits / getAdminRegionalFund / donation / governance) —
// que segue OPEN na DT-UNIFYBANK-CORE-DIRECT-BANK-LEDGER-SQL como sequência posterior. Não duplica o
// guard de escrita `audit-bank-ledger-boundaries` (aquele cobre INSERT/UPDATE; este cobre a LEITURA do
// endpoint regional).
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SVC = resolve(ROOT, 'src/core/unifybank/transparency.service.ts');
const MARK = '[unifybank-no-direct-ledger-sql]';
const fails = [];

const raw = readFileSync(SVC, 'utf8');

/** Extrai o corpo do método getUserRegionalFund por brace-matching a partir do brace do CORPO
 *  (após `): Promise<...> {`), não do `{` do tipo do parâmetro `options`. */
function extractMethodBody(src, methodSig) {
  const start = src.indexOf(methodSig);
  if (start === -1) return null;
  // âncora do corpo: o `{` que segue o fecho da lista de parâmetros + tipo de retorno.
  const bodyOpen = src.slice(start).search(/\)\s*:\s*Promise<[^>]*>\s*\{/);
  if (bodyOpen === -1) return null;
  const braceStart = src.indexOf('{', start + bodyOpen);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(braceStart, i + 1);
    }
  }
  return null;
}
/** Remove comentários de linha/bloco para não dar falso-positivo em prosa. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

const body = extractMethodBody(raw, 'async getUserRegionalFund');
if (!body) {
  fails.push('método getUserRegionalFund não encontrado (o guard não pôde escopar o endpoint)');
} else {
  const code = stripComments(body);
  // 1. NENHUM SQL direto a bank_* dentro do método do endpoint.
  for (const tbl of ['bank_ledger', 'bank_transactions', 'bank_accounts']) {
    if (new RegExp(`FROM\\s+${tbl}\\b`, 'i').test(code) || new RegExp(`(INTO|UPDATE|JOIN)\\s+${tbl}\\b`, 'i').test(code)) {
      fails.push(`getUserRegionalFund acessa ${tbl} por SQL direto — deve usar o reader público do Bank (modules/bank)`);
    }
  }
  // 2. Nenhum client.query cru (SQL direto) dentro do método do endpoint.
  if (/\bclient\.query\s*\(/.test(code)) {
    fails.push('getUserRegionalFund usa client.query cru — SQL direto proibido nesse caminho (use o reader do Bank)');
  }
  // 3. USA as PORTAS canônicas do Bank (prova positiva do reuso via interface pública, não repositório).
  if (!/getLedgerEntriesByAccount\s*\(/.test(code)) {
    fails.push('getUserRegionalFund não usa a porta getLedgerEntriesByAccount (extrato via interface pública do Bank)');
  }
  if (!/getMetadataByTransactionIds\s*\(/.test(code)) {
    fails.push('getUserRegionalFund não usa a porta getMetadataByTransactionIds (metadado via interface pública do Bank)');
  }
  // 4. Saldo permanece via port canônico (não reintroduzir SQL de saldo).
  if (!/getBalance\s*\(/.test(code)) {
    fails.push('getUserRegionalFund não usa o port getBalance para o saldo (regressão de fronteira Bank)');
  }
  // 5. Consumo via bankPortsRegistry (interface pública), não import de repositório do Bank.
  if (!/bankPortsRegistry\./.test(code)) {
    fails.push('getUserRegionalFund não consome via bankPortsRegistry (a fronteira correta é a PORTA pública do Bank)');
  }
}

// 6. O arquivo NÃO deve importar repositórios do Bank diretamente (consumo é via porta pública).
if (/from '@modules\/bank\/bank-ledger\.repository'/.test(raw) || /from '@modules\/bank\/bank-transaction-read\.repository'/.test(raw)) {
  fails.push('transparency.service importa repositório do Bank diretamente — deve consumir a PORTA pública (bankPortsRegistry), não o repositório');
}

if (fails.length) {
  console.error(`❌ ${MARK} FAIL — ${fails.length} problema(s):`);
  for (const f of fails) console.error(`   - ${f}`);
  process.exit(1);
}
console.log(`✅ GATE OK ${MARK} — GET /bank/regional-fund (getUserRegionalFund) sem SQL direto a bank_*; usa readers públicos do Bank (getEntriesByAccount + getMetadataByTransactionIds) e o port getBalance; implementação em modules/bank. (Dívida-irmã statement/admin/donation/governance segue OPEN na DT — fora deste escopo.)`);
