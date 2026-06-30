#!/usr/bin/env node
// Gate estrutural — F-SERVICE-PRICING-FIXED-MVP-HARDENING.
// Congela o desarme do "fallback R$10" no caminho de pagamento de discovery (payAcceptedRequest).
// Invariantes (anti-reativação do valor financeiro artificial):
//   1) o constante SERVICE_DISCOVERY_DEFAULT_PAYMENT_CENTS NÃO existe mais no arquivo — preço
//      ausente/nulo/zero/inválido jamais vira valor financeiro fixo silencioso;
//   2) payAcceptedRequest deriva amountCents do price_cents da oferta (priceNum), nunca de um
//      literal/constante de fallback;
//   3) payAcceptedRequest FALHA HONESTAMENTE quando o preço não é inteiro estritamente positivo
//      (guard `priceNum <= 0` → throw), e esse guard vem ANTES da primeira mutação de estado
//      (UPDATE ... payment_status='pending') e ANTES de qualquer chamada bancária
//      (createSimpleTransaction) — garantindo Δbank=0 no caminho de preço inválido;
//   4) nenhum literal de centavos artificial (ex.: `= 1000`, `?? 1000`, `: 1000`) é usado como
//      amountCents nesse método.
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SVC = join(ROOT, 'src/modules/services/services-discovery.service.ts');

const failures = [];
let checked = 0;

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
// Remove comentários de linha e bloco para não confundir heurística com a doutrina escrita nos comentários.
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

{
  const raw = read(SVC);
  if (!raw) {
    failures.push('FIRMPRICE_REGRESSION: services-discovery.service.ts ausente.');
  } else {
    checked++;
    const code = stripTs(raw);

    // 1) Constante de fallback artificial não pode renascer (em qualquer forma de uso, fora de comentário).
    if (/SERVICE_DISCOVERY_DEFAULT_PAYMENT_CENTS/.test(code)) {
      failures.push(
        'FIRMPRICE_REGRESSION: SERVICE_DISCOVERY_DEFAULT_PAYMENT_CENTS reapareceu em código — o valor financeiro artificial (R$10) foi removido e não pode voltar.'
      );
    }

    // Isola o corpo de payAcceptedRequest para os checks de posicionamento.
    const m = code.match(/async payAcceptedRequest\([\s\S]*?(?=\n {2}async |\n {2}private |\n}\s*$)/);
    const body = m ? m[0] : '';
    if (!body) {
      failures.push('FIRMPRICE_REGRESSION: método payAcceptedRequest ausente — caminho de pagamento de discovery sumiu.');
    } else {
      // 2) amountCents tem de derivar do preço da oferta (priceNum), não de constante/literal.
      if (!/const\s+amountCents\s*=\s*priceNum\s*;/.test(body)) {
        failures.push('FIRMPRICE_REGRESSION: amountCents não deriva de priceNum (preço firme da oferta) — risco de valor artificial.');
      }

      // 3) Guard de preço firme: throw quando priceNum não é inteiro estritamente positivo.
      const hasGuard = /if\s*\(\s*!Number\.isFinite\(\s*priceNum\s*\)\s*\|\|\s*priceNum\s*<=\s*0\s*\)/.test(body);
      if (!hasGuard) {
        failures.push('FIRMPRICE_REGRESSION: guard de preço firme (priceNum inválido/<=0 → throw) ausente — preço ausente/zero/negativo não falha honestamente.');
      }
      if (!/throw\s+new\s+BadRequestError\(/.test(body)) {
        failures.push('FIRMPRICE_REGRESSION: payAcceptedRequest não lança BadRequestError no preço inválido — falha honesta ausente.');
      }

      // 3b) Posicionamento: o guard vem ANTES da primeira mutação de estado e ANTES do banco.
      const idxGuard = body.search(/if\s*\(\s*!Number\.isFinite\(\s*priceNum\s*\)\s*\|\|\s*priceNum\s*<=\s*0\s*\)/);
      const idxPendingUpdate = body.search(/payment_status\s*=\s*'pending'/);
      const idxBankCall = body.search(/createSimpleTransaction\s*\(/);
      if (idxGuard >= 0 && idxPendingUpdate >= 0 && idxGuard > idxPendingUpdate) {
        failures.push('FIRMPRICE_REGRESSION: guard de preço vem DEPOIS do UPDATE payment_status=pending — mutação de estado aconteceria antes da falha honesta.');
      }
      if (idxGuard >= 0 && idxBankCall >= 0 && idxGuard > idxBankCall) {
        failures.push('FIRMPRICE_REGRESSION: guard de preço vem DEPOIS da chamada bancária — movimento financeiro aconteceria antes da falha honesta (Δbank≠0).');
      }

      // 4) Nenhum literal de centavos artificial servindo de fallback de amountCents.
      if (/amountCents[\s\S]{0,40}(\?\?|:)\s*\d{2,}\b/.test(body) || /\b(\?\?|:)\s*1000\b/.test(body)) {
        failures.push('FIRMPRICE_REGRESSION: literal de centavos usado como fallback de amountCents — proibido (preço tem de ser firme ou falhar).');
      }
    }
  }
}

console.log(`[service-discovery-firm-price] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [service-discovery-firm-price]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [service-discovery-firm-price] — fallback R$10 removido; amountCents deriva do preço firme; preço ausente/zero/inválido falha honestamente ANTES de mutação de estado e do banco (Δbank=0); sem literal de centavos artificial.');
