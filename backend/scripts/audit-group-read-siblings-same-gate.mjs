#!/usr/bin/env node
/**
 * GUARD — IRMÃOS: toda rota de LEITURA de um grupo específico passa pela MESMA regra.
 *
 * 🔴 NASCEU DE UM DEFEITO REAL (achado 16.2 da instância de `ARQUITETURA/`, verificado por mim em
 * 2026-08-05). Três rotas irmãs, no mesmo arquivo, com gates diferentes:
 *   · `GET /groups/:id`         → só `groupsAuthGate('groups:read')`
 *   · `GET /groups/:id/members` → só `groupsAuthGate('groups:members:read')`
 *   · `GET /groups/:id/balance` → gate + verificação de membership
 * Um coberto, dois abertos. Qualquer autenticado do tenant lia um grupo SECRETO inteiro e a lista
 * de membros dele, bastando ter o id.
 *
 * A família tem nome no inventário da pasta: **irmãos** — rotas da mesma família com gates
 * diferentes. É insidiosa porque cada rota, lida sozinha, parece ter "um gate". O defeito só
 * aparece quando se lê o CONJUNTO, e ninguém lê o conjunto.
 *
 * O QUE EXIGE: todo handler `GET` cujo caminho é escopado a um grupo específico (`/:id`) tem que
 * invocar a regra de legibilidade compartilhada (`grupoLegivelPor`) OU fazer verificação explícita
 * de membership. Aceitar as duas é honesto: a de membership é ESTRITAMENTE mais fechada.
 *
 * ⚠️ Mede CÓDIGO, não comentário — senão a explicação acima faria o guard passar sozinha.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ARQUIVO = join(import.meta.dirname, '..', 'src', 'modules', 'groups', 'groups.routes.ts');
const NOME = 'group-read-siblings-same-gate';

function semTexto(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
}

const bruto = readFileSync(ARQUIVO, 'utf8');
const codigo = semTexto(bruto);

// Cada `fastify.get(... '/:id...' ...)` abre um handler. Fatio do início de um até o início do
// próximo registro de rota — aproximação suficiente e verificável, e o denominador denuncia se
// o fatiamento deixar de encontrar as rotas.
const aberturas = [...codigo.matchAll(/fastify\s*\.\s*get\s*(?:<[^>]*>)?\s*\(\s*(['"])(\/:id[^'"]*)\1/g)];
const limites = [...codigo.matchAll(/fastify\s*\.\s*(?:get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(/g)].map((m) => m.index);

const violacoes = [];
for (const abertura of aberturas) {
  const inicio = abertura.index;
  const fim = limites.find((i) => i > inicio) ?? codigo.length;
  const corpo = codigo.slice(inicio, fim);
  const caminho = abertura[2];

  // 🔴 FAMÍLIA DE FORMAS, NÃO LISTA DE NOMES (corrigido 2026-08-05, 3ª versão).
  //
  // A v2 exigia QUATRO nomes literais (`grupoLegivelPor`, `isMember`, `ehMembroDoGrupo`,
  // `requireGroupOwnerOrPermission`). Isso reprova código CORRETO escrito com outro nome — e o
  // conserto tentador vira **acrescentar uma chamada só para satisfazer o guard**, que é pior que
  // o defeito original. É a mesma doença que este projeto persegue: ler NOME em vez de SUBSTÂNCIA.
  // Aconteceu duas vezes em guards meus no mesmo dia (aqui e no de desfazer), sempre pelo mesmo
  // motivo: **guard escrito DEPOIS do conserto nasce descrevendo o conserto, não a regra.**
  //
  // Agora reconheço o VOCABULÁRIO de autorização desta casa, aberto a escritas novas:
  //   · legibilidade  → …Legivel…            (grupoLegivelPor, ehLegivelPara, …)
  //   · membership    → …Membro… / isMember   (ehMembroDoGrupo, isMember, …)
  //   · representação → canRepresent… / canActAs…
  //   · gate de dono  → require…Permission / require…Owner…
  const FORMAS_DE_AUTORIZACAO =
    /\b(?:\w*Legivel\w*|\w*Membro\w*|isMember|canRepresent\w*|canActAs\w*|require\w*(?:Permission|Owner\w*))\s*\(|\bisMember\b/;
  const autorizado = FORMAS_DE_AUTORIZACAO.test(corpo);

  if (!autorizado) {
    violacoes.push(
      `GET '${caminho}': lê um grupo específico e NÃO passa por NENHUMA forma de autorização ` +
      `reconhecida (legibilidade · membership · representação · gate de dono) — irmão descoberto`
    );
  }
}

if (aberturas.length === 0) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — nenhuma rota GET '/:id...' encontrada em groups.routes.ts.\n` +
    `   Isso não é "está tudo certo": é o guard tendo ficado CEGO (o arquivo mudou de forma).\n` +
    `   Zero é uma afirmação; aqui a verdade é desconhecida, e desconhecido tem que aparecer.\n`
  );
  process.exit(1);
}

if (violacoes.length > 0) {
  console.error(`\n❌ GATE FAIL [${NOME}] — ${violacoes.length} de ${aberturas.length} irmão(s) sem a regra:\n`);
  for (const v of violacoes) console.error(`   · ${v}`);
  console.error(
    `\n   EM VEZ: chame a regra compartilhada de legibilidade do módulo, ou faça verificação\n` +
    `   explícita de membership/representação antes de ler o grupo.\n\n` +
    `   ⚠️ SE VOCÊ JÁ AUTORIZA e o guard não reconheceu, o conserto é ESTENDER O VOCABULÁRIO\n` +
    `   deste guard (a constante FORMAS_DE_AUTORIZACAO) — NUNCA acrescentar uma chamada só para\n` +
    `   satisfazê-lo. Chamada fabricada para agradar guard é pior que o defeito original: deixa\n` +
    `   o vermelho verde sem fechar nada, e a próxima pessoa confia no verde.\n`
  );
  process.exit(1);
}

console.log(
  `✅ GATE OK [${NOME}] — ${aberturas.length} rota(s) GET escopada(s) a um grupo específico, ` +
  `todas passando por alguma forma reconhecida de autorização ` +
  `(legibilidade · membership · representação · gate de dono). O guard reconhece a FAMÍLIA de ` +
  `formas, não uma lista fechada de nomes.`
);
