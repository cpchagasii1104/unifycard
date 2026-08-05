#!/usr/bin/env node
// Guard estrutural — F-BANK-OWNER-TYPE-TRUTH (2026-08-04).
//
// ╔═ A FORMA QUE ELE FECHA ═══════════════════════════════════════════════════════════════════
// "Adaptador entre dois vocabulários ou é BIJETIVO, ou mente na volta" — armadilha nomeada pela
// instância de ARQUITETURA e CONFIRMADA aqui:
//
//   ida   `toDbOwnerType`:  'user' → 'actor'  E  'company' → 'actor'   (colapsa dois em um)
//   volta `toBankAccount`:  'actor' → 'user'  SEMPRE                    (inventa)
//
// Gravava-se `company`, lia-se `user`. Consequência medida: em `transparency.routes.ts` o ramo
// `ownerType === 'company'` era INALCANÇÁVEL — quem tinha grant financeiro legítimo de empresa era
// NEGADO, sem erro e sem explicação. Falso negativo num caminho de AUTORIDADE, dentro do domínio
// de dinheiro. E as duas definições do tipo divergiam entre si, nenhuma contendo `'actor'` — o
// único valor que o banco guarda para carteira.
//
// A regra: como a ida colapsa, o tradutor de VOLTA não pode existir. Os dois lados falam o
// vocabulário do banco. Quem é pessoa ou empresa é `actors.actor_type`, o SSOT dessa distinção —
// nunca um enum que o Bank já achatou na escrita.
//
// MORDE se:
//   1. a leitura voltar a remapear `'actor'` para outro valor;
//   2. alguma das definições de `BankAccountOwnerType` perder `'actor'`;
//   3. um caminho de AUTORIDADE do Bank voltar a comparar contra o valor inventado.
// ════════════════════════════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
const read = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf-8') : null);
const stripTs = (s) => (s || '').replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

// ── 1. a leitura não inventa ──
const REPO = 'src/modules/bank/bank-account.repository.ts';
const repoRaw = read(REPO);
if (repoRaw === null) failures.push(`${REPO} ausente — fail-closed.`);
else {
  const repo = stripTs(repoRaw);
  // O remapeamento antigo tinha esta forma: row.owner_type === 'actor' ? 'user' : …
  if (/row\.owner_type\s*===\s*'actor'\s*\?/.test(repo)) {
    failures.push(
      `${REPO}: a leitura voltou a REMAPEAR \`'actor'\`. A ida colapsa 'user'/'company' em 'actor'; ` +
      'qualquer volta que escolha um dos dois está inventando. Devolva o que está gravado.'
    );
  }
  // A ida PODE colapsar (é o schema); o que não pode é a volta desfazer o colapso por chute.
  if (!/toDbOwnerType/.test(repo)) {
    failures.push(`${REPO}: \`toDbOwnerType\` sumiu — a escrita precisa continuar traduzindo para o vocabulário do banco.`);
  }
}

// ── 2. as DUAS definições contêm o valor real ──
for (const f of ['src/modules/bank/bank-account.types.ts', 'src/core/bank/ports/bank-account.port.ts']) {
  const src = stripTs(read(f));
  if (!src) { failures.push(`${f} ausente — fail-closed.`); continue; }
  const m = src.match(/type\s+BankAccountOwnerType\s*=\s*([^;]+);/);
  if (!m) { failures.push(`${f}: \`BankAccountOwnerType\` não encontrado.`); continue; }
  if (!/'actor'/.test(m[1])) {
    failures.push(
      `${f}: \`BankAccountOwnerType\` não contém \`'actor'\` — o ÚNICO valor que o banco guarda para ` +
      'carteira. Tipo que não contém o valor real compila perfeitamente e mente para sempre.'
    );
  }
}

// ── 3. 🔴 caminhos de AUTORIDADE não comparam contra o valor inventado ──
const AUTORIDADE = [
  'src/core/unifybank/bank-http.routes.ts',
  'src/core/unifybank/transparency.routes.ts',
];
for (const f of AUTORIDADE) {
  const src = stripTs(read(f));
  if (!src) { failures.push(`${f} ausente — fail-closed.`); continue; }
  const suspeitas = src.match(/ownerType\s*(===|!==)\s*'(user|company)'/g) || [];
  if (suspeitas.length > 0) {
    failures.push(
      `${f}: ${suspeitas.length}× comparação de autoridade contra ${suspeitas.join(', ')} — valores que ` +
      'a LEITURA nunca devolve (o banco guarda `actor`). Comparação que nunca casa = ramo morto que ' +
      'parece vivo; foi assim que o grant de empresa ficou inalcançável.'
    );
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [bank-owner-type-no-lossy-translation]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(
  'GATE OK [bank-owner-type-no-lossy-translation] — a leitura devolve o que o banco guarda; as duas ' +
  'definições do tipo contêm `actor`; nenhum caminho de autoridade do Bank compara contra valor que ' +
  'a leitura nunca produz. Tradutor que colapsa na ida não desfaz o colapso na volta.'
);
