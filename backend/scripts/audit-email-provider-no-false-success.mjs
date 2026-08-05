#!/usr/bin/env node
// Guard estrutural — F-NOTIFY-NO-FALSE-SUCCESS (2026-08-04).
//
// ╔═ O DEFEITO QUE ELE IMPEDE DE VOLTAR ══════════════════════════════════════════════════════
// `EmailProvider.sendEmail` fazia um `console.log` e devolvia `{ success: true }`. O caller
// (`notify.service.ts`) lê esse `success` e marca a linha como **`sent`, com `sent_at = now()`**.
// O sistema registrava entrega de mensagem que nunca saiu — com carimbo de hora, que é o que torna
// a mentira convincente para quem auditar depois.
//
// Clayton: *"enquanto o sistema estiver na minha máquina, ele não tem acesso a servidor pra
// disparar 'esqueci minha senha' / 'confirmar e-mail'."* — servidor ausente é condição HONESTA.
// Sucesso falso não é. Este guard vigia a diferença.
//
// MORDE se:
//   1. o provider devolver `success: true` fora do caminho de integração real;
//   2. o flag fail-closed sumir (ausência de flag tem de significar DESLIGADO);
//   3. `ProviderResult.retryable` sumir do contrato, ou o processador parar de respeitá-lo
//      (falha definitiva que queima 5 tentativas vira ruído e esconde a causa);
//   4. o CHECK que exige `sent_at` para status `sent` sumir da migration.
// ════════════════════════════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
const read = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf-8') : null);
const stripTs = (s) => (s || '').replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

// ── 1. o provider não pode declarar sucesso sem integração real ──
const PROV = 'src/core/notify/providers/email.provider.ts';
const provRaw = read(PROV);
if (provRaw === null) {
  failures.push(`${PROV} ausente — fail-closed.`);
} else {
  const prov = stripTs(provRaw);
  if (/success:\s*true/.test(prov)) {
    failures.push(
      `${PROV}: devolve \`success: true\`. Sem provider real confirmando entrega, isso faz o ` +
      'sistema marcar a linha como `sent` com `sent_at` — registro de entrega que não aconteceu. ' +
      'Só integração real pode produzir sucesso.'
    );
  }
  if (!/EMAIL_PROVIDER_ENABLED/.test(prov)) {
    failures.push(`${PROV}: perdeu o flag fail-closed EMAIL_PROVIDER_ENABLED.`);
  }
  if (!/!==\s*'true'/.test(prov)) {
    failures.push(
      `${PROV}: o flag não é mais fail-closed. Ausente/qualquer-outro DEVE significar desligado — ` +
      'flag que liga por omissão é a mesma mentira por outro caminho.'
    );
  }
  if (!/retryable:\s*false/.test(prov)) {
    failures.push(`${PROV}: falta \`retryable: false\` — falta de configuração não melhora com retentativa.`);
  }
}

// ── 2. o contrato conhece falha definitiva ──
const TYPES = stripTs(read('src/core/notify/notify.types.ts'));
if (!TYPES) failures.push('src/core/notify/notify.types.ts ausente — fail-closed.');
else if (!/retryable\?:\s*boolean/.test(TYPES)) {
  failures.push('notify.types.ts: `ProviderResult.retryable` sumiu do contrato.');
}

// ── 3. o processador respeita a falha definitiva ──
const SVC = stripTs(read('src/core/notify/notify.service.ts'));
if (!SVC) failures.push('src/core/notify/notify.service.ts ausente — fail-closed.');
else {
  if (!/result\.retryable\s*===\s*false/.test(SVC)) {
    failures.push(
      'notify.service.ts: o processador não respeita mais `retryable === false` — falha definitiva ' +
      'voltaria a queimar as 5 tentativas, trocando causa-raiz clara por ruído.'
    );
  }
  // Sucesso continua sendo a ÚNICA porta para `sent` — e ela carrega o timestamp.
  if (!/status\s*=\s*'sent'[\s\S]{0,120}sent_at\s*=\s*now\(\)/.test(SVC)) {
    failures.push("notify.service.ts: marcar `sent` sem `sent_at = now()` — entrega sem quando é entrega não provada.");
  }
}

// ── 4. a trava física continua na migration ──
const migs = existsSync(join(ROOT, 'migrations')) ? readdirSync(join(ROOT, 'migrations')) : [];
const notifyMig = migs.find((m) => m.includes('notify_queue_materialize'));
if (!notifyMig) {
  failures.push('migration de materialização de notify_queue sumiu — a casa da fila é forward-only.');
} else {
  const sql = readFileSync(join(ROOT, 'migrations', notifyMig), 'utf-8');
  if (!/status\s*<>\s*'sent'\s*OR\s*sent_at\s+IS\s+NOT\s+NULL/i.test(sql)) {
    failures.push(
      `${notifyMig}: perdeu o CHECK que exige \`sent_at\` quando status='sent'. É a trava FÍSICA ` +
      'contra registrar entrega sem quando — a última linha de defesa se o código voltar a mentir.'
    );
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [email-provider-no-false-success]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(
  'GATE OK [email-provider-no-false-success] — sem provider real, a mensagem é REGISTRADA e a ' +
  'falha é HONESTA: nunca `sent`, nunca `sent_at`, sem queimar retentativa. O estado diz a verdade ' +
  'sobre si; a última milha é que está pendente.'
);
