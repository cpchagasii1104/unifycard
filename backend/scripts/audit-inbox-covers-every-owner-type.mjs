#!/usr/bin/env node
// backend/scripts/audit-inbox-covers-every-owner-type.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (criado 2026-08-05)
// ║ NORMA:   "pense nos DOIS lados — consumir e operar" (Clayton, 2026-08-05)
// ║ NÃO:     NÃO adicionar owner_type de agenda sem ensinar a caixa de entrada a enxergá-lo.
// ║ EM VEZ:  cobrir o tipo na query de pending-responsibilities, OU declará-lo aqui como
// ║          "não recebe pedido" COM MOTIVO.
// ╚════════════════════════════════════════════════════════════════
//
// ═══ O DEFEITO QUE ORIGINOU ESTE GUARD ═══
// Clayton: *"a gente só pensa do lado de quem está fazendo aquela situação, mas não pensa do outro
// lado. E a gente tem que começar a fazer isso a partir de agora."*
//
// Medido no mesmo dia: pedido de locação nascia `201 requested`, com contexto e tudo, e **não
// aparecia em tela nenhuma para o dono decidir**. A caixa de entrada cobria user, service_offering
// e group — e ignorava `actor_asset`, o owner_type que a convergência asset-first tornou canônico
// para todo bem locável. Nenhum erro em lugar nenhum: o pedido simplesmente não existia para quem
// devia responder. O pilar inteiro de locação era um formulário que escrevia no vazio.
//
// A causa não foi descuido de quem escreveu a query: foi que o tipo NASCEU DEPOIS dela, e nada
// ligava as duas coisas. Este guard é esse elo.
//
// MORDE se um valor de `AvailabilityOwnerType` não estiver nem coberto pela query da caixa de
// entrada, nem declarado abaixo como "não recebe pedido" com motivo escrito.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '../src');
const TIPOS = 'core/availability/unified-availability.types.ts';
const CAIXA = 'core/profile/pending-responsibilities.routes.ts';

/**
 * Tipos de dono de agenda que NÃO recebem pedido de terceiro — cada um com o motivo.
 * Entrar aqui é uma AFIRMAÇÃO: "ninguém pede este horário a ninguém". Se um dia passar a receber,
 * a linha sai daqui e a query passa a cobri-lo.
 */
const NAO_RECEBE_PEDIDO = {
  event: 'agenda do próprio evento (quando ele acontece), não uma oferta que alguém reserva.',
  page: 'agenda institucional de exibição; a oferta reservável da empresa é service_offering/actor_asset.',
  service: 'eixo LEGADO de serviço — DECISION-0156 moveu o tempo contratável para service_offering.',
  rentable_resource: 'substrato LEGADO de locação (0 linhas); o vivo é actor_asset (asset-first).',
};

const failures = [];

// Denominador do verde — enum lido por regex pode casar MENOS do que existe, e um verde silencioso
// sobre 3 de 8 tipos seria indistinguivel de cobertura total. Ver a nota na mensagem de sucesso.
let totalTipos = 0;
let totalCobertos = 0;
const read = (rel) => {
  const p = path.join(SRC, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null;
};

/**
 * 🔴 COMENTÁRIO NÃO É CÓDIGO — e este guard acusou, na primeira execução, um `owner_type='service'`
 * que estava dentro de um comentário explicando por que o eixo legado NÃO é usado. Terceira vez no
 * mesmo dia que um guard meu conta comentário. Guard que pune quem documenta ensina a apagar a
 * explicação para o verde voltar, e a explicação costuma valer mais que o código.
 *
 * Tira linhas `//` e `--` (SQL) antes de medir. Comentário de bloco não aparece nestes arquivos.
 */
function semComentarios(txt) {
  return txt
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('--') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');
}

const tipos = read(TIPOS);
const caixaBruta = read(CAIXA);
const caixa = caixaBruta === null ? null : semComentarios(caixaBruta);

if (tipos === null) failures.push(`${TIPOS} ausente — sem o vocabulário não dá para medir cobertura. Fail-closed.`);
if (caixaBruta === null) failures.push(`${CAIXA} ausente — a caixa de entrada sumiu.`);

if (tipos && caixa) {
  // Vocabulário vem do enum, não de lista escrita à mão aqui: lista paralela envelhece e foi
  // exatamente isso que deixou `actor_asset` de fora.
  const bloco = tipos.match(/export enum AvailabilityOwnerType\s*\{([\s\S]*?)\}/);
  if (!bloco) {
    failures.push(`${TIPOS}: não consegui ler o enum AvailabilityOwnerType — não-lido não é "zero tipos". Fail-closed.`);
  } else {
    const valores = Array.from(bloco[1].matchAll(/=\s*'([a-z_]+)'/g)).map((m) => m[1]);
    if (valores.length === 0) {
      failures.push(`${TIPOS}: enum lido e VAZIO — leitura suspeita, não conclusão. Fail-closed.`);
    }

    totalTipos = valores.length;
    for (const v of valores) {
      const cobertoNaQuery = new RegExp(`owner_type\\s*=\\s*'${v}'`).test(caixa);
      const declaradoFora = Object.prototype.hasOwnProperty.call(NAO_RECEBE_PEDIDO, v);
      if (cobertoNaQuery) totalCobertos += 1;

      if (!cobertoNaQuery && !declaradoFora) {
        failures.push(
          `owner_type '${v}' existe no vocabulário da agenda mas NÃO aparece na caixa de entrada ` +
          `(${CAIXA}) nem está declarado como "não recebe pedido" neste guard. Um pedido feito a ele ` +
          'nasceria e ninguém veria — que foi exatamente o que aconteceu com actor_asset.'
        );
      }
      if (cobertoNaQuery && declaradoFora) {
        failures.push(
          `owner_type '${v}' está declarado aqui como "não recebe pedido" E coberto pela query. ` +
          'As duas coisas não podem ser verdade — remova a declaração ou a cobertura.'
        );
      }
    }

    // A declaração precisa corresponder ao vocabulário vivo: entrada órfã é dívida escondida.
    for (const k of Object.keys(NAO_RECEBE_PEDIDO)) {
      if (!valores.includes(k)) {
        failures.push(
          `'${k}' está declarado como "não recebe pedido" mas NÃO existe mais no enum ` +
          'AvailabilityOwnerType — pode a linha, senão a lista vira ficção.'
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [inbox-covers-every-owner-type]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
// 🔴 O VERDE DECLARA O DENOMINADOR (2026-08-05) — aprendido em ARQUITETURA/DOCS/00-fundamentos/
// gate-de-granularidade.md: um guard do legado ficou verde por MESES validando 131 de 551 arquivos.
console.log(
  `GATE OK [inbox-covers-every-owner-type] — ${totalTipos} tipos de dono no enum: ${totalCobertos}` +
  ` cobertos pela caixa de entrada, ${Object.keys(NAO_RECEBE_PEDIDO).length} declarados como 'nao recebe pedido'. ` +
  'todo dono de agenda que pode RECEBER pedido aparece na ' +
  'caixa de entrada, e os que não recebem estão declarados com motivo. Pedido que ninguém vê é ' +
  'formulário escrevendo no vazio: foi assim que o pilar de locação ficou invisível ao próprio dono.'
);
