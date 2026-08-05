#!/usr/bin/env node
/**
 * GUARD — DESFAZER tem a MESMA regra dos dois lados.
 *
 * Família #13 (irmãos com gates diferentes) aplicada ao elo que a família #19 diz que todo domínio
 * esquece: *"quem resolve quando dá errado"*. Ele nunca aparece no fluxo feliz, e por isso nasce
 * torto — cada lado ganha a sua regra, escrita em momento diferente, por gente diferente.
 *
 * 🔴 O DEFEITO QUE ORIGINOU (medido em 2026-08-05):
 *   · `cancelMyBooking` (lado de QUEM PEDE) exigia estado em `requested`/`confirmed`;
 *   · `declineRequest` (lado do DONO) **não exigia estado nenhum**.
 * Efeito: o dono podia "recusar" reserva já em `checked_in` — **com o item entregue** — e o
 * registro pulava para `cancelled`, passando a dizer que a reserva nunca aconteceu.
 *
 * O QUE EXIGE: toda função de desfazer neste módulo consulta o MESMO conjunto de estados. Não
 * exige um valor fixo (o produto pode mudar o conjunto); exige **simetria** — que é o defeito.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ARQUIVO = join(
  import.meta.dirname, '..', 'src', 'modules', 'rentals', 'rentable-resource.service.ts'
);
const NOME = 'undo-siblings-same-state-gate';

const DESFAZEDORES = ['cancelMyBooking', 'declineRequest'];

const src = readFileSync(ARQUIVO, 'utf8');

/** Corpo aproximado da função: do nome até a próxima declaração `async nome(` no mesmo nível. */
function corpoDe(nome) {
  const i = src.indexOf(`async ${nome}(`);
  if (i === -1) return null;
  const prox = [...src.matchAll(/\n  (?:private\s+)?async\s+\w+\(/g)]
    .map((m) => m.index)
    .find((j) => j > i);
  return src.slice(i, prox ?? src.length);
}

const falhas = [];
const conjuntos = new Map();

for (const fn of DESFAZEDORES) {
  const corpo = corpoDe(fn);
  if (corpo === null) {
    falhas.push(`\`${fn}\` não existe mais — se o desfazer mudou de nome, atualize este guard no mesmo commit`);
    continue;
  }
  // Estados exigidos num teste de pertencimento contra `booking.status`. Aceita as DUAS escritas:
  // array inline e constante nomeada (resolvida no arquivo).
  // 🔴 A 1ª versão só reconhecia array inline — e reprovou o conserto que usava constante nomeada,
  // ou seja, **rejeitou a escrita melhor por não ser a forma que ela esperava**. É o mesmo defeito
  // que este projeto persegue: guard que lê FORMA em vez de SUBSTÂNCIA.
  const inline = [...corpo.matchAll(/\[([^\]]*)\]\s*\.includes\s*\(\s*booking\.status/g)]
    .map((m) => m[1]);
  const porIdentificador = [...corpo.matchAll(/\b([A-Za-z_$][\w$]*)\s*\.includes\s*\(\s*booking\.status/g)]
    .map((m) => {
      const def = src.match(new RegExp(`(?:const|let|var)\\s+${m[1]}\\b[^=]*=\\s*\\[([^\\]]*)\\]`));
      return def ? def[1] : '';
    });
  const lista = [...inline, ...porIdentificador]
    .map((txt) => txt.match(/'[a-z_]+'/g) || [])
    .flat()
    .sort();
  if (lista.length === 0) {
    falhas.push(`\`${fn}\` NÃO valida o estado do booking antes de desfazer — o outro lado valida`);
    continue;
  }
  conjuntos.set(fn, lista.join(','));
}

const valores = [...new Set(conjuntos.values())];
if (valores.length > 1) {
  falhas.push(
    'os dois lados desfazem com conjuntos DIFERENTES de estado: ' +
    [...conjuntos.entries()].map(([k, v]) => `${k} → [${v}]`).join(' · ') +
    ' — simetria é o ponto; assimetria aqui vira "um lado pode o que o outro não pode"'
  );
}

if (conjuntos.size === 0 && falhas.length === 0) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — nenhum desfazedor reconhecido.\n` +
    `   Denominador vazio nunca é aprovação: é o guard cego.\n`
  );
  process.exit(1);
}

if (falhas.length > 0) {
  console.error(`\n❌ GATE FAIL [${NOME}] — ${falhas.length} problema(s):\n`);
  for (const f of falhas) console.error(`   · ${f}`);
  console.error(
    `\n   Desfazer é o elo que todo domínio esquece: não aparece no fluxo feliz, então cada lado\n` +
    `   ganha a sua regra. EM VEZ: um conjunto de estados, consultado pelos dois lados.\n`
  );
  process.exit(1);
}

console.log(
  `✅ GATE OK [${NOME}] — ${conjuntos.size} caminho(s) de desfazer, todos exigindo o MESMO ` +
  `conjunto de estados [${valores[0]}]. Antes do uso qualquer um dos dois desfaz; durante o uso, ` +
  `nenhum — e a recusa diz que isso é decisão de produto, não erro do usuário.`
);
