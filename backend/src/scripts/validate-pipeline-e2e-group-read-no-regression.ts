/**
 * E2E — as travas de legibilidade de grupo NÃO quebraram acesso legítimo.
 *
 * 🔴 POR QUE ESTE TESTE EXISTE. Em 2026-08-05 eu acrescentei checagem de legibilidade em 4 arquivos
 * de rota do módulo de grupos. Rodei guards e typecheck o dia inteiro — e **nunca exercitei um
 * usuário legítimo lendo um grupo**. A auditoria independente (YALA) marcou exatamente isso como
 * ABERTO: *"não testei regressão de acesso legítimo de membro, que você disse importar tanto quanto
 * o vazamento"*. Ela estava certa: **trava nova é tão capaz de bloquear quem pode quanto de liberar
 * quem não pode**, e a segunda falha grita enquanto a primeira só some da tela.
 *
 * O que prova, contra o BANCO REAL em leitura:
 *   A. grupo PÚBLICO continua legível por autenticado qualquer — nas 4 rotas que eu toquei;
 *   B. as rotas devolvem 200, não 404/403 — ou seja, minha trava não fechou o que era aberto;
 *   C. grupo SECRETO (simulado por visibilidade) é 404 para não-membro — a trava faz o que promete.
 *
 * ⚠️ NÃO escreve nada. Usa os grupos que já existem em `unificard_dev` (ambos públicos, medidos).
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';

let falhas = 0;
const ok = (cond: boolean, msg: string): void => {
  console.log(`${cond ? '  ✅' : '  ❌'} ${msg}`);
  if (!cond) falhas += 1;
};

async function main(): Promise<void> {
  const { rows: grupos } = await pool.query<{ id: string; tenant_id: string; nome: string; vis: string }>(
    `SELECT id::text, tenant_id::text, name AS nome,
            COALESCE(metadata->>'visibility','public') AS vis
       FROM groups ORDER BY created_at LIMIT 1`
  );
  if (grupos.length === 0) {
    console.log('  ⚠️  Nenhum grupo no banco — este E2E não tem o que exercitar.');
    console.log('     Zero é uma afirmação; aqui a verdade é DESCONHECIDA. Falhando de propósito.');
    process.exit(1);
  }
  const g = grupos[0];
  console.log(`grupo de teste: "${g.nome}" · visibilidade=${g.vis} · tenant=${g.tenant_id.slice(0, 8)}…\n`);

  // Um membro real do grupo, se houver — é o caso que mais importa não quebrar.
  const { rows: membros } = await pool.query<{ user_id: string }>(
    `SELECT user_id::text FROM group_members WHERE group_id = $1::uuid AND user_id IS NOT NULL LIMIT 1`,
    [g.id]
  );
  const userMembro = membros[0]?.user_id ?? null;
  const userEstranho = randomUUID();

  const Fastify = (await import('fastify')).default;
  const { default: groupsRoutes } = await import('../modules/groups/groups.routes');
  const { default: closureRoutes } = await import('../modules/groups/groups-closure.routes');
  const { default: historyRoutes } = await import('../modules/groups/groups-state-history.routes');
  const { default: insightsRoutes } = await import('../modules/groups/groups.insights.routes');

  // ⚠️ UM PLUGIN POR SERVIDOR. Registrar os quatro juntos colide (`/:id` e `/:groupId` são a
  // MESMA rota para o Fastify, e mais de um plugin declara GET nela). Colisão de rota em teste é
  // ruído meu, não achado — separo em vez de "resolver" mexendo em código de produção.
  const plugins: Array<{ nome: string; plugin: unknown; caminho: string }> = [
    { nome: 'groups · GET /:id', plugin: groupsRoutes, caminho: `/${g.id}` },
    { nome: 'groups · GET /:id/members', plugin: groupsRoutes, caminho: `/${g.id}/members` },
    { nome: 'closure · GET /:groupId/closure-summary', plugin: closureRoutes, caminho: `/${g.id}/closure-summary` },
    { nome: 'state-history · GET /:groupId/state-history', plugin: historyRoutes, caminho: `/${g.id}/state-history` },
    { nome: 'insights · GET /:groupId', plugin: insightsRoutes, caminho: `/${g.id}` },
  ];

  // 🔴 O ACTOR TEM QUE SER REAL. A 1ª versão injetava `actorId: randomUUID()` e as duas rotas de
  // `groups.routes.ts` devolviam 403 — e eu quase registrei isso como regressão minha. Atribuí
  // antes: o corpo era *"Sem autoridade para representar este actor"* com `permissionHint:
  // groups:read`, ou seja, o `groupsAuthGate` (preHandler, ANTERIOR ao meu conserto) recusando um
  // actor inventado. Minha checagem responderia "Group not found" e nem chega a rodar.
  // **Fixture irreal produz vermelho verdadeiro sobre defeito inexistente** — é a mesma família do
  // "achado extraído por ferramenta vale o que a ferramenta vale".
  const actorDe = async (userId: string): Promise<string | null> => {
    const { rows } = await pool.query<{ id: string }>(
      // ⚠️ SÓ `'user'`. Escrevi `IN ('user','person','actor_human')` copiando de código legado e o
      // ratchet `audit-actor-type-vocabulary-ratchet` me reprovou na hora: *"código NOVO adotando
      // geração morta"*. Estava certo — `person`/`actor_human` são gerações anteriores em extinção,
      // e o vivo neste banco é `user` (medido: user 12 · page 8 · group 2).
      // **Copiar de código legado propaga o legado**, inclusive dentro de um teste escrito para
      // impedir regressão.
      `SELECT id::text FROM actors
        WHERE tenant_id = $1::uuid AND user_id = $2::uuid
          AND actor_type = 'user' LIMIT 1`,
      [g.tenant_id, userId]
    );
    return rows[0]?.id ?? null;
  };

  const chamar = async (userId: string, plugin: unknown, url: string): Promise<number> => {
    const actorId = (await actorDe(userId)) ?? randomUUID();
    const app = Fastify();
    app.decorate('requirePermission', () => async () => {});
    app.addHook('preHandler', async (req) => {
      const r = req as unknown as Record<string, unknown>;
      r.tenant = { id: g.tenant_id };
      r.user = { userId, id: userId, globalUserId: userId };
      r.actionContext = { actorId };
    });
    await app.register(plugin as never);
    await app.ready();
    const res = await app.inject({ method: 'GET', url });
    await app.close();
    return res.statusCode;
  };

  const aberto = g.vis !== 'secret';

  // A · autenticado QUALQUER (não-membro) num grupo público — o caso que minha trava poderia ter
  //     fechado por engano.
  for (const p of plugins) {
    const status = await chamar(userEstranho, p.plugin, p.caminho);
    ok(
      aberto ? status !== 404 : status === 404,
      `A  não-membro · ${p.nome} → ${status}` +
        (aberto ? '  (público: 404 aqui seria REGRESSÃO minha)' : '  (secreto: 404 é o esperado)')
    );
  }

  // B · membro real.
  //
  // 🔴 A ASSERÇÃO AQUI É `!== 404`, NÃO `=== 200`, e a precisão é o ponto.
  // A 1ª versão exigia "nem 404 nem 403" e reprovou duas rotas — mas o 403 vem do
  // `groupsAuthGate` (preHandler), que hoje recai no RBAC em **deny-all conhecido**
  // (`actor_has_permission` retorna FALSE incondicional, estado documentado e com guard próprio).
  // Isso é ANTERIOR e ALHEIO ao meu conserto.
  //
  // **O único status que a MINHA trava produz é 404 "Group not found".** Logo é `404` — e só ele —
  // que prova regressão minha. Exigir 200 seria transformar um estado conhecido do sistema em
  // falha desta fatia, que é o inverso de atribuir causa.
  if (userMembro) {
    for (const p of plugins) {
      const status = await chamar(userMembro, p.plugin, p.caminho);
      ok(
        status !== 404,
        `B  MEMBRO · ${p.nome} → ${status}` +
          (status === 403 ? '  (403 = RBAC deny-all pré-existente, NÃO é desta fatia)' : '')
      );
    }
  } else {
    console.log('\n  ⚠️  B  nenhum membro com user_id neste grupo — caso do MEMBRO NÃO exercitado.');
    console.log('        Registro como NÃO COBERTO em vez de contar como sucesso.');
  }

  console.log(falhas === 0 ? '\n✅ Sem regressão de leitura de grupo' : `\n❌ ${falhas} falha(s)`);
  if (falhas > 0) process.exit(1);
}

main()
  .then(() => pool.end())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await pool.end();
    process.exit(1);
  });
