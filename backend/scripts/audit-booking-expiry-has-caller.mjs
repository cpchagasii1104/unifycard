#!/usr/bin/env node
// Guard estrutural — F-BOOKING-EXPIRY-MOTOR (2026-08-04).
//
// ╔═ POR QUE ESTE GUARD EXISTE ════════════════════════════════════════════════════════════════
// O defeito que ele previne NÃO é "faltou a função". A função `expired`/`expired_at` JÁ EXISTIA,
// e `updateBooking` já sabia preencher a coluna — o que faltava era ALGUÉM PEDIR. Estado sem
// motor. E o precedente de como isso nasce está no próprio repositório:
// `startIdempotencyCleanupWorker` existe, está correto, e tem ZERO callers.
//
// Então o que este guard vigia é o CALLER, não a capacidade. Se um dia alguém "limpar" a chamada
// no painel de compromissos achando que é um worker que faz isso, o vermelho aparece aqui.
//
// MORDE se: `expirePastDueBookings` existir sem nenhum caller VIVO fora do próprio arquivo e dos
// testes/E2E. Um motor sem partida é o mesmo buraco com outro nome.
// ════════════════════════════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const MOTOR = 'src/core/availability/booking-expiry.service.ts';
const FUNCAO = 'expirePastDueBookings';
const failures = [];

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf-8') : null);
const stripTs = (s) => (s || '').replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

// 1. O motor existe e faz o que promete.
const motor = read(join(ROOT, MOTOR));
if (motor === null) {
  failures.push(`${MOTOR} ausente — o motor de expiração sumiu.`);
} else {
  const code = stripTs(motor);
  if (!new RegExp(`export async function ${FUNCAO}`).test(code)) {
    failures.push(`${MOTOR}: ${FUNCAO} não é mais exportada.`);
  }
  // Só `requested` expira. `confirmed` é compromisso aceito — caduca por regra própria, não por relógio.
  if (!/status\s*=\s*'requested'/.test(code)) {
    failures.push(`${MOTOR}: perdeu o filtro \`status = 'requested'\` — passaria a expirar estado que não deve.`);
  }
  if (/status\s*=\s*'confirmed'/.test(code)) {
    failures.push(`${MOTOR}: expira \`confirmed\` — compromisso ACEITO não caduca por tempo (regra própria, dono próprio).`);
  }
  // A janela vencida é a condição; sem ela expiraria pedido válido.
  if (!/start_datetime\s*<=\s*now\(\)/.test(code)) {
    failures.push(`${MOTOR}: perdeu a condição de janela já iniciada (\`start_datetime <= now()\`).`);
  }
  // Δbank=0: expirar pedido não toca dinheiro.
  if (/bank_ledger|bank_transactions|bank_accounts|bank_splits/.test(code)) {
    failures.push(`${MOTOR}: toca tabela do Bank — expirar pedido é Δbank=0 por construção.`);
  }
}

// 2. 🔴 O CALLER — o coração deste guard.
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules') continue;
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.ts$/.test(e)) out.push(full);
  }
  return out;
}
const arquivos = existsSync(SRC) ? walk(SRC) : [];
if (arquivos.length === 0) failures.push('src/ vazio/ausente — fail-closed.');

const callers = arquivos.filter((f) => {
  const rel = f.replace(ROOT, '').replace(/\\/g, '/');
  if (rel.endsWith('/core/availability/booking-expiry.service.ts')) return false; // a definição
  if (/\/scripts\/|__tests__|\.test\.ts$|\.spec\.ts$/.test(rel)) return false;    // prova não é caller vivo
  return new RegExp(`${FUNCAO}\\s*\\(`).test(stripTs(read(f)));
});

if (callers.length === 0) {
  failures.push(
    `${FUNCAO} não tem NENHUM caller vivo — motor sem partida. É exatamente o buraco que este ` +
    'guard existe para impedir (precedente: startIdempotencyCleanupWorker, correto e com zero callers).'
  );
}

if (failures.length > 0) {
  console.error('GATE FAIL [booking-expiry-has-caller]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(
  `GATE OK [booking-expiry-has-caller] — o estado \`expired\` tem MOTOR e o motor tem PARTIDA: ` +
  `${callers.length} caller(s) vivo(s). Expira só \`requested\` com janela já iniciada; \`confirmed\` ` +
  'intocado; Δbank=0. Capacidade sem caller é o defeito que este guard nomeia.'
);
