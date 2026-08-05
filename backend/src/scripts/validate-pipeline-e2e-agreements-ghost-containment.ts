/**
 * E2E — a contenção de `agreements` responde 501 EM RUNTIME, não só no arquivo.
 *
 * 🔴 POR QUE ESTE E2E EXISTE. O guard `audit-agreements-schema-ghost-containment` é ESTÁTICO: ele
 * prova que o `onRequest` está ESCRITO. Não prova que ele DISPARA. São coisas diferentes, e este
 * repositório já pagou por confundi-las — "presença ≠ capacidade" é a armadilha 2 do inventário de
 * `ARQUITETURA/`, e hoje mesmo eu escrevi uma prova vermelha que não removia nada e passava com
 * cara de sucesso.
 *
 * O que prova, e por que cada asserção existe:
 *   A. o hook dispara ANTES do handler — nenhuma rota alcança o service (que consultaria a tabela
 *      ausente e devolveria 500 com o `42P01` cru vazando);
 *   B. a recusa é 501, não 500 — 500 diz "defeito nosso agora"; 501 diz "não implementado", que é
 *      a verdade: o substrato não existe;
 *   C. o corpo carrega o CÓDIGO NOMEADO — recusa anônima não diz ao chamador o que fazer;
 *   D. vale para VERBOS diferentes (GET e POST) e para rota com parâmetro — contenção que só pega
 *      um verbo é meia contenção.
 *
 * NÃO toca banco: o ponto é justamente que nada chega ao banco.
 */
import { randomUUID } from 'crypto';

let falhas = 0;
const ok = (cond: boolean, msg: string): void => {
  console.log(`${cond ? '  ✅' : '  ❌'} ${msg}`);
  if (!cond) falhas += 1;
};

async function main(): Promise<void> {
  const Fastify = (await import('fastify')).default;
  const { default: agreementRoutes } = await import('../modules/agreements/agreement.routes');

  const app = Fastify();
  app.addHook('preHandler', async (req) => {
    const r = req as unknown as Record<string, unknown>;
    r.tenant = { id: randomUUID() };
    r.user = { userId: randomUUID(), id: randomUUID() };
    r.actionContext = { actorId: randomUUID() };
  });
  await app.register(agreementRoutes);
  await app.ready();

  const casos: Array<{ method: 'GET' | 'POST' | 'PUT'; url: string; rotulo: string }> = [
    { method: 'POST', url: '/agreements', rotulo: 'A1 POST /agreements' },
    { method: 'GET', url: `/agreements/${randomUUID()}`, rotulo: 'A2 GET /agreements/:id (com parâmetro)' },
    { method: 'POST', url: `/agreements/${randomUUID()}/finalize`, rotulo: 'A3 POST .../finalize (o que mais importa: finalizar acordo)' },
  ];

  for (const c of casos) {
    const res = await app.inject({ method: c.method, url: c.url, payload: c.method === 'GET' ? undefined : {} });
    let corpo: { code?: string } = {};
    try { corpo = JSON.parse(res.body) as { code?: string }; } catch { /* corpo não-JSON cai nas asserções */ }

    ok(res.statusCode === 501, `${c.rotulo} → 501 (recebido: ${res.statusCode})`);
    ok(
      corpo.code === 'AGREEMENTS_SCHEMA_GHOST_CONTAINED',
      `${c.rotulo} → código nomeado no corpo (recebido: ${String(corpo.code)})`
    );
    // 🔴 A asserção que prova que o hook DISPAROU e não só existe: se o handler tivesse rodado,
    // a query em tabela ausente teria produzido 500 com mensagem do Postgres.
    ok(res.statusCode !== 500, `${c.rotulo} → NÃO é 500 (handler não foi alcançado)`);
  }

  await app.close();

  console.log(falhas === 0 ? '\n✅ E2E contenção agreements: tudo passou' : `\n❌ ${falhas} falha(s)`);
  if (falhas > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
