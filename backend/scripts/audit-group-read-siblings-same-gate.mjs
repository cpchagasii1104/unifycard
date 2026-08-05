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
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// 🔴 ESCOPO AMPLIADO 2026-08-05 (achado 3 da auditoria independente da YALA).
// As versões anteriores vigiavam **um arquivo só** (`groups.routes.ts`), porque foi lá que o
// defeito apareceu. A auditoria mostrou o buraco: o módulo tem 6 arquivos de rota, e 3 leituras
// escopadas a grupo viviam FORA do alcance (`closure-summary`, `state-history`, `insights`) — todas
// com apenas permissão de TENANT. **Guard cujo escopo é o arquivo onde o defeito apareceu vigia a
// cicatriz, não a regra.**
const DIR_ROTAS = join(import.meta.dirname, '..', 'src', 'modules', 'groups');
const NOME = 'group-read-siblings-same-gate';

function semTexto(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
}

const arquivos = readdirSync(DIR_ROTAS).filter((f) => f.endsWith('.routes.ts'));
const violacoes = [];
let totalRotas = 0;

for (const arquivo of arquivos) {
  const codigo = semTexto(readFileSync(join(DIR_ROTAS, arquivo), 'utf8'));

  // Cada `fastify.get(... '/:id...' ...)` abre um handler. Fatio do início de um até o início do
  // próximo registro de rota — aproximação suficiente e verificável, e o denominador denuncia se
  // o fatiamento deixar de encontrar as rotas.
  // ⚠️ `/:id` E `/:groupId`: o módulo usa os dois nomes de parâmetro, e a v3 só conhecia `/:id` —
  // era mais uma forma de escapar por escrita, não por substância.
  const aberturas = [...codigo.matchAll(
    /fastify\s*\.\s*get\s*(?:<[^>]*>)?\s*\(\s*(['"])(\/:(?:id|groupId)[^'"]*)\1/g
  )];
  const limites = [...codigo.matchAll(
    /fastify\s*\.\s*(?:get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(/g
  )].map((m) => m.index);

for (const abertura of aberturas) {
  totalRotas += 1;
  const inicio = abertura.index;
  const fim = limites.find((i) => i > inicio) ?? codigo.length;
  const corpo = codigo.slice(inicio, fim);
  const caminho = `${arquivo}  ${abertura[2]}`;

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
  // 🔴 PERMISSÃO DE TENANT NÃO CONTA (2026-08-05, achado 3 da YALA).
  // A v3 aceitava `require\w*Permission`, o que casava com `fastify.requirePermission([...])` —
  // permissão de MÓDULO, não autoridade sobre AQUELE grupo. Era assim que `closure-summary` passaria
  // sem checar nada específico do grupo. Segue valendo `require…Owner…`
  // (`requireGroupOwnerOrPermission`), que É escopado ao grupo.
  const FORMAS_DE_AUTORIZACAO =
    /\b(?:\w*Legivel\w*|\w*Membro\w*|isMember|canRepresent\w*|canActAs\w*|require\w*Owner\w*)\s*\(|\bisMember\b/;
  const autorizado = FORMAS_DE_AUTORIZACAO.test(corpo);

  if (!autorizado) {
    violacoes.push(
      `GET '${caminho}': lê um grupo específico e NÃO passa por NENHUMA forma de autorização ` +
      `ESCOPADA AO GRUPO (legibilidade · membership · representação · dono). ` +
      `⚠️ Permissão de tenant (\`requirePermission\`) prova acesso ao MÓDULO, não a este grupo`
    );
  }
}
}

if (totalRotas === 0) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — nenhuma rota GET escopada a grupo encontrada em ` +
    `${arquivos.length} arquivo(s) de ${DIR_ROTAS.replace(/\\/g, '/')}.\n` +
    `   Isso não é "está tudo certo": é o guard tendo ficado CEGO (a forma das rotas mudou).\n` +
    `   Zero é uma afirmação; aqui a verdade é desconhecida, e desconhecido tem que aparecer.\n`
  );
  process.exit(1);
}

if (violacoes.length > 0) {
  console.error(`\n❌ GATE FAIL [${NOME}] — ${violacoes.length} de ${totalRotas} irmão(s) sem a regra:\n`);
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
  `✅ GATE OK [${NOME}] — ${totalRotas} rota(s) GET escopada(s) a um grupo específico, em ` +
  `${arquivos.length} arquivo(s) de rota do módulo, todas passando por autorização ESCOPADA AO ` +
  `GRUPO (legibilidade · membership · representação · dono). O guard reconhece a FAMÍLIA de ` +
  `formas, não uma lista de nomes — e vigia o MÓDULO, não o arquivo onde o defeito apareceu.`
);
