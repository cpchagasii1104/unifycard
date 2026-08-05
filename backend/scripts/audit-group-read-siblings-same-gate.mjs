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

  const usaRegraCompartilhada = /\bgrupoLegivelPor\s*\(/.test(corpo);
  const verificaMembership = /\bisMember\b|\behMembroDoGrupo\s*\(/.test(corpo);
  // ⚠️ Gate de DONO/REPRESENTANTE também cobre, e cobre MAIS: `requireGroupOwnerOrPermission`
  // exige representar o actor do grupo ou ter permissão RBAC sobre ele — estritamente mais
  // fechado que ser membro. A 1ª versão deste guard não conhecia essa forma e acusou
  // `GET /:id/invites`, que está CERTO. Guard que ignora a forma mais estrita transforma código
  // correto em dívida falsa, e dívida falsa gasta a confiança que o vermelho verdadeiro precisa.
  const gateDeDono = /\brequireGroupOwnerOrPermission\s*\(/.test(corpo);

  if (!usaRegraCompartilhada && !verificaMembership && !gateDeDono) {
    violacoes.push(
      `GET '${caminho}': lê um grupo específico e NÃO passa por grupoLegivelPor() nem por ` +
      `verificação de membership — irmão descoberto`
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
  console.error('');
  process.exit(1);
}

console.log(
  `✅ GATE OK [${NOME}] — ${aberturas.length} rota(s) GET escopada(s) a um grupo específico, ` +
  `todas passando pela mesma regra de legibilidade (grupoLegivelPor ou membership explícito).`
);
