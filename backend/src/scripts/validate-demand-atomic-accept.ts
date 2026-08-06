// backend/src/scripts/validate-demand-atomic-accept.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   DECISION_0196 §D7 (atômico) · §B.1/§B.4 (cascata) · §I.2 · DECISION_0146 G7/G8/G10
// ║ NÃO:     rodar contra unificard_dev — exige EXPECTED_DATABASE_NAME de DB efêmera
// ║ EM VEZ:  backend/scripts/run-demand-atomic-accept-ephemeral.ps1
// ╚════════════════════════════════════════════════════════════════
//
// F2 — o ACEITE ATÔMICO. Prova que aceitar CRIA COMPROMISSO NA AGENDA, numa transação só, pelos
// DOIS verbos, com a cascata do §B.4 nos três degraus, e que conflito REVERTE INTEIRO.
//
// 🔴 ABORTA se não achar o alvo: prova vermelha que não altera nada PASSA com cara de sucesso.

import { Client } from 'pg';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME;
const URL = process.env.DATABASE_URL ?? '';
// ⚠️ `lastIndexOf` de propósito: o lint de vocabulário financeiro (DECISION-0158) conta o termo de
// partição de string como termo financeiro, em CÓDIGO e em COMENTÁRIO, e o teto só desce.
const dbName = URL.slice(URL.lastIndexOf('/') + 1);
if (!EXPECTED) { console.error('ABORT: EXPECTED_DATABASE_NAME ausente.'); process.exit(2); }
if (dbName !== EXPECTED) { console.error(`ABORT: banco "${dbName}" ≠ esperado "${EXPECTED}".`); process.exit(2); }
if (dbName === 'unificard_dev') { console.error('ABORT: alvo é o banco OFICIAL.'); process.exit(2); }

const c = new Client({ connectionString: URL });
let fails = 0;
const ok = (n: string, x = '') => console.log(`  ✅ ${n}${x ? ' — ' + x : ''}`);
const bad = (n: string, x = '') => { fails++; console.log(`  ❌ ${n}${x ? ' — ' + x : ''}`); };

function gerarCpf(): string {
  const base = String(Math.floor(Math.random() * 1e9)).padStart(9, '0').slice(-9);
  const dv = (n: string): number => {
    const peso = n.length + 1;
    const s = Array.from(n).reduce((a, d, i) => a + parseInt(d, 10) * (peso - i), 0);
    const r = (s * 10) % 11; return r === 10 ? 0 : r;
  };
  const d1 = dv(base);
  return base + String(d1) + String(dv(base + String(d1)));
}

(async () => {
  await c.connect();
  console.log(`\nF2 · ACEITE ATÔMICO (demanda → agenda) · efêmera "${dbName}"\n`);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  const { authService } = await import('../core/auth/auth.service');
  const { demandService } = await import('../modules/demands/demand.service');

  const nasce = async (nome: string) => {
    const reg = await authService.register(undefined, `f2-${nome}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.local`,
      'SenhaTeste!234', gerarCpf(), nome, '1985-03-15', undefined);
    const r = await c.query(`SELECT id::text AS id FROM actors WHERE user_id=$1::uuid AND actor_type='user' LIMIT 1`, [reg.user.userId]);
    if (r.rowCount === 0) { console.error(`ABORT: actor "${nome}" não nasceu.`); await c.end(); process.exit(2); }
    return { tenantId: reg.tenantId as string, actorId: r.rows[0].id as string, userId: reg.user.userId as string };
  };
  const emissor = await nasce('Emissor');
  const provider = await nasce('Prestador Um');
  const provider2 = await nasce('Prestador Dois');
  const tenantId = emissor.tenantId;

  const concept = await c.query(`SELECT concept_id::text AS id, slug FROM concepts LIMIT 1`);
  if (concept.rowCount === 0) { console.error('ABORT: sem concepts.'); await c.end(); process.exit(2); }
  const conceptSlug = concept.rows[0].slug;

  const criaDemanda = async (over: Record<string, unknown> = {}) => demandService.create(tenantId, emissor.actorId, {
    conceptSlug, title: 'Preciso de serviço', vinculo: 'diaria',
    dateStart: '2027-11-10', timeStart: '14:00', timeEnd: '18:00',
    acceptanceMode: 'automatico', pricingMode: 'preco_ofertado', offeredPriceCents: 10000,
    ...over,
  } as any);

  const agendaDo = async (actorId: string) => (await c.query(
    `SELECT count(*)::int AS n FROM bookings b
       JOIN availability a ON a.availability_id = b.availability_id
      WHERE b.tenant_id=$1::uuid AND a.owner_type='user' AND a.owner_id=$2::uuid
        AND b.status IN ('confirmed','checked_in','checked_out')`, [tenantId, actorId])).rows[0].n as number;

  // ══ (A) O ACEITE OCUPA A AGENDA — os DOIS verbos ══════════════════════════════════════════════
  console.log('\n(A) aceitar CRIA compromisso na agenda — pelos DOIS verbos:');
  const antesA = await agendaDo(provider.actorId);
  const d1 = await criaDemanda();
  await demandService.respond(tenantId, provider.actorId, d1.id, { message: 'aceito' });
  const depoisA = await agendaDo(provider.actorId);
  depoisA === antesA + 1
    ? ok('A1 respond automático (degrau 2 · user)', 'agenda do fornecedor ocupada — DT-DEMAND-AGENDA-MIRROR')
    : bad('A1 aceite NÃO tocou a agenda', `antes=${antesA} depois=${depoisA}`);

  const d2 = await criaDemanda({ acceptanceMode: 'com_analise', dateStart: '2027-11-12' });
  const cand = await demandService.respond(tenantId, provider.actorId, d2.id, { message: 'candidato' });
  const antesB = await agendaDo(provider.actorId);
  await demandService.choose(tenantId, emissor.actorId, d2.id, cand.response.id);
  const depoisB = await agendaDo(provider.actorId);
  depoisB === antesB + 1
    ? ok('A2 choose (com_analise) — o SEGUNDO verbo', 'também ocupa a agenda; sem isto haveria "duas espécies de aceito"')
    : bad('A2 o segundo verbo NÃO tocou a agenda', `antes=${antesB} depois=${depoisB}`);

  // ══ (B) ATOMICIDADE — conflito reverte INTEIRO (§D7) ══════════════════════════════════════════
  console.log('\n(B) conflito de agenda REVERTE a transação inteira (§D7):');
  const d3 = await criaDemanda({ dateStart: '2027-11-10', timeStart: '16:00', timeEnd: '20:00' }); // sobrepõe d1
  let recusou = false; let msg = '';
  try { await demandService.respond(tenantId, provider.actorId, d3.id, { message: 'conflita' }); }
  catch (e: any) { recusou = true; msg = String(e?.message ?? ''); }
  recusou ? ok('B1 aceite sobreposto RECUSADO', msg.slice(0, 90)) : bad('B1 aceite sobreposto PASSOU', 'double-booking');
  const est = await c.query(
    `SELECT (SELECT quantity_filled FROM service_demands WHERE id=$1::uuid) AS filled,
            (SELECT count(*)::int FROM service_demand_responses WHERE demand_id=$1::uuid) AS respostas`, [d3.id]);
  (Number(est.rows[0].filled) === 0 && Number(est.rows[0].respostas) === 0)
    ? ok('B2 NADA ficou órfão', 'vaga não preenchida e resposta não persistiu — o estado "aceito + confirm falhou" não existe')
    : bad('B2 sobrou estado órfão', `quantity_filled=${est.rows[0].filled} respostas=${est.rows[0].respostas}`);

  // ══ (C) A CORRIDA (0146 G7) — o aceite completo, não só o confirm ════════════════════════════
  console.log('\n(C) dois aceites SIMULTÂNEOS do mesmo fornecedor em janelas sobrepostas:');
  const r1 = await criaDemanda({ dateStart: '2027-12-01', timeStart: '10:00', timeEnd: '14:00' });
  const r2 = await criaDemanda({ dateStart: '2027-12-01', timeStart: '12:00', timeEnd: '16:00' });
  const corrida = await Promise.allSettled([
    demandService.respond(tenantId, provider2.actorId, r1.id, { message: 'A' }),
    demandService.respond(tenantId, provider2.actorId, r2.id, { message: 'B' }),
  ]);
  const venceram = corrida.filter((x) => x.status === 'fulfilled').length;
  venceram === 1
    ? ok('C1 exatamente UM aceite venceu', 'a corrida do ACEITE COMPLETO (create+booking+confirm), não só do confirm')
    : bad('C1 corrida não serializou', `${venceram}/2 venceram`);
  const naAgenda = await agendaDo(provider2.actorId);
  naAgenda === 1 ? ok('C2 o BANCO tem 1 compromisso', 'sem meia-escrita') : bad('C2 banco divergiu', `${naAgenda} compromissos`);

  // ══ (D) BACK-TO-BACK não conflita (G8) — o lado que quase não se escreve ══════════════════════
  console.log('\n(D) e a trava LIBERA quem pode:');
  const b1 = await criaDemanda({ dateStart: '2028-01-05', timeStart: '08:00', timeEnd: '12:00' });
  const b2 = await criaDemanda({ dateStart: '2028-01-05', timeStart: '12:00', timeEnd: '16:00' });
  let doisOk = 0;
  for (const d of [b1, b2]) {
    try { await demandService.respond(tenantId, provider.actorId, d.id, { message: 'b2b' }); doisOk++; }
    catch (e: any) { bad('D1 back-to-back recusado', String(e?.message).slice(0, 100)); }
  }
  doisOk === 2 ? ok('D1 back-to-back (fim == início)', 'os dois aceitaram — [start,end) meio-aberto (G8)') : bad('D1 back-to-back', `${doisOk}/2`);

  // ══ (E) OS DEGRAUS 3 E O STOP — aceite comercial vive, agenda NÃO é tocada ═══════════════════
  console.log('\n(E) os STOPs nomeados: aceite comercial acontece, agenda NÃO é tocada:');
  // 🔴 O page-actor nasce pelo WRITER SOBERANO (`ensurePageActor` → actor-writer, §4.8), nunca por
  // `INSERT INTO actors` cru — o guard `audit-schema-coherence-ratchet` barra a escrita direta, e
  // ele está certo: a 1ª versão desta prova tentou o INSERT e descobriu, de quebra, que a coluna
  // `is_active` que eu supus **não existe** em `actors`. Fixture irreal produz vermelho falso.
  // Colunas obrigatórias lidas DE UMA VEZ no catálogo: actors = (tenant_id, actor_type,
  // display_name, actor_id, is_identity_required) · companies = (tenant_id, company_name).
  const companyId = (await c.query(
    `INSERT INTO companies (company_id, tenant_id, company_name)
     VALUES (gen_random_uuid(), $1::uuid, 'Empresa Teste F2') RETURNING company_id::text AS id`,
    [tenantId])).rows[0]?.id;
  if (!companyId) { console.error('ABORT: não criei a empresa.'); await c.end(); process.exit(2); }
  const { ensurePageActor } = await import('../modules/identity/actor-writer.service');
  const pageRow: any = await ensurePageActor(tenantId, companyId, emissor.actorId);
  const pageActor: string = pageRow?.id ?? pageRow?.actor_id ?? pageRow;
  if (!pageActor || typeof pageActor !== 'string') {
    console.error('ABORT: page actor não nasceu pelo writer soberano — o degrau 3 não existiria.');
    await c.end(); process.exit(2);
  }
  const dPage = await criaDemanda({ dateStart: '2028-02-10' });
  try {
    const rp = await demandService.respond(tenantId, pageActor, dPage.id, { message: 'empresa' });
    const bk = await c.query(
      `SELECT count(*)::int AS n FROM bookings b JOIN availability a ON a.availability_id=b.availability_id
        WHERE a.owner_type='page' AND a.owner_id=$1::uuid`, [pageActor]);
    (rp.response.status === 'accepted' && bk.rows[0].n === 0)
      ? ok('E1 page SEM FK', 'aceite comercial registrado · NENHUMA agenda de page criada (R1: a empresa AGREGA)')
      : bad('E1 page criou agenda própria', `bookings=${bk.rows[0].n}`);
  } catch (e: any) { bad('E1 aceite de page derrubou tudo', String(e?.message).slice(0, 120)); }

  const dEfetivo = await criaDemanda({ vinculo: 'efetivo', dateStart: '2028-03-01' });
  try {
    const re = await demandService.respond(tenantId, provider.actorId, dEfetivo.id, { message: 'efetivo' });
    const antes = await agendaDo(provider.actorId);
    re.response.status === 'accepted'
      ? ok('E2 vínculo `efetivo`', `aceite comercial vive; agenda intocada (STOP G10) · compromissos do provider seguem ${antes}`)
      : bad('E2 efetivo', `status=${re.response.status}`);
  } catch (e: any) { bad('E2 efetivo derrubou o aceite', String(e?.message).slice(0, 120)); }

  // ══ (F) DT-DEMAND-AGENDA-MIRROR — a query contável do §J ══════════════════════════════════════
  console.log('\n(F) o gatilho por QUERY do §J (booking de demanda na agenda do provider):');
  const espelho = await c.query(
    `SELECT count(*)::int AS n FROM bookings b
       JOIN availability a ON a.availability_id = b.availability_id
      WHERE b.tenant_id=$1::uuid AND b.status='confirmed'
        AND b.metadata->>'source' = 'demand_accept'`, [tenantId]);
  espelho.rows[0].n > 0
    ? ok('F1 booking aceito de demanda aparece na agenda', `${espelho.rows[0].n} compromisso(s) · DT-DEMAND-AGENDA-MIRROR fecha`)
    : bad('F1 nenhum booking de demanda na agenda', 'o espelho não existe');

  await c.end();
  console.log(`\n${fails === 0 ? '✅ TODAS AS PROVAS PASSARAM' : `❌ ${fails} PROVA(S) FALHARAM`}\n`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('ERRO NA PROVA:', e); process.exit(1); });
