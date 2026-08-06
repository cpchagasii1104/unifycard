// backend/src/scripts/validate-professional-source-union.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   DECISION-0144 · DECISION-0147 Q2/Q3 (as DUAS metades do gate)
// ║ NÃO:     rodar contra unificard_dev — exige EXPECTED_DATABASE_NAME de DB efêmera
// ║ EM VEZ:  backend/scripts/run-professional-source-union-ephemeral.ps1
// ╚════════════════════════════════════════════════════════════════
//
// D-1 (GO Clayton 2026-08-06) — o matching de demanda lê a UNIÃO das duas metades do gate.
// Guard prova o TEXTO; isto prova o COMPORTAMENTO — inclusive que a união não alarga demais.
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
  console.log(`\nD-1 · MATCHING = UNIÃO DAS DUAS METADES DO GATE · efêmera "${dbName}"\n`);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  const { authService } = await import('../core/auth/auth.service');
  const { demandService } = await import('../modules/demands/demand.service');

  const nasce = async (nome: string) => {
    const reg = await authService.register(undefined, `d1-${nome}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.local`,
      'SenhaTeste!234', gerarCpf(), nome, '1985-03-15', undefined);
    const r = await c.query(`SELECT id::text AS id FROM actors WHERE user_id=$1::uuid AND actor_type='user' LIMIT 1`, [reg.user.userId]);
    if (r.rowCount === 0) { console.error(`ABORT: actor "${nome}" não nasceu.`); await c.end(); process.exit(2); }
    return { tenantId: reg.tenantId as string, actorId: r.rows[0].id as string };
  };
  const emissor = await nasce('Emissor D1');
  const porProfissao = await nasce('Declara Profissao');
  const porOferta = await nasce('Publica Oferta');
  const semNada = await nasce('Sem Nada');
  const tenantId = emissor.tenantId;

  // concept com canonical_service — os dois lados têm de falar do MESMO concept
  const cs = await c.query(
    `SELECT cs.id::text AS csid, cs.concept_id::text AS cid, co.slug
       FROM canonical_services cs JOIN concepts co ON co.concept_id = cs.concept_id LIMIT 1`);
  if (cs.rowCount === 0) { console.error('ABORT: sem canonical_services.'); await c.end(); process.exit(2); }
  const { csid, cid, slug } = cs.rows[0];

  // metade PF: declaração profissional ATIVA
  await c.query(
    `INSERT INTO actor_professional_concepts (tenant_id, actor_id, concept_id, skill_level, is_active, declared_at)
     VALUES ($1::uuid,$2::uuid,$3::uuid,3,true,now())`, [tenantId, porProfissao.actorId, cid]);
  // metade PJ (aqui exercida por um provider com OFERTA ATIVA no mesmo concept)
  const svc = await c.query(
    `INSERT INTO services (tenant_id, actor_id, name, slug, canonical_service_id, status)
     VALUES ($1::uuid,$2::uuid,'Servico D1','servico-d1-' || floor(random()*1e6)::text,$3::uuid,'active')
     RETURNING service_id::text AS id`, [tenantId, porOferta.actorId, csid]);
  await c.query(
    `INSERT INTO service_offerings (tenant_id, service_id, canonical_service_id, provider_actor_id, price_cents, duration_minutes, status)
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,10000,60,'active')`,
    [tenantId, svc.rows[0].id, csid, porOferta.actorId]);

  const d = await demandService.create(tenantId, emissor.actorId, {
    conceptSlug: slug, title: 'Preciso deste concept', vinculo: 'diaria', dateStart: '2028-09-01',
    acceptanceMode: 'com_analise', pricingMode: 'orcamento', visibility: 'public',
  } as any);

  const veMatching = async (actorId: string) =>
    (await demandService.listOpportunities(tenantId, actorId, true)).some((x) => x.id === d.id);

  console.log('\n(A) as DUAS metades alcançam o matching:');
  (await veMatching(porProfissao.actorId))
    ? ok('A1 quem DECLAROU profissão vê', 'metade PF (a que já existia)')
    : bad('A1 quem declarou profissão NÃO vê', 'a metade PF quebrou');
  (await veMatching(porOferta.actorId))
    ? ok('A2 quem PUBLICOU oferta vê', 'metade PJ — era o defeito: 8 páginas, 14 ofertas, 0 matches')
    : bad('A2 quem publicou oferta NÃO vê', 'o matching segue lendo só metade do gate');

  console.log('\n(B) e a união NÃO alarga além das duas metades:');
  !(await veMatching(semNada.actorId))
    ? ok('B1 quem não tem nem profissão nem oferta NÃO vê', 'matching continua sendo filtro, não "tudo"')
    : bad('B1 a união virou "todo mundo"', 'o filtro deixou de filtrar');

  console.log('\n(C) e o filtro DESLIGADO segue mostrando tudo (nada regride):');
  const semFiltro = await demandService.listOpportunities(tenantId, semNada.actorId, false);
  semFiltro.some((x) => x.id === d.id)
    ? ok('C1 matching=false mostra a demanda para todos', 'a união só age quando o filtro é pedido')
    : bad('C1 matching=false deixou de mostrar', 'a união vazou para o caminho sem filtro');

  console.log('\n(D) oferta NÃO-ativa não conta como metade PJ:');
  await c.query(`UPDATE service_offerings SET status='draft' WHERE provider_actor_id=$1::uuid`, [porOferta.actorId]);
  !(await veMatching(porOferta.actorId))
    ? ok('D1 oferta draft não casa', 'a metade PJ exige ATIVA — igual ao gate')
    : bad('D1 oferta draft ainda casa', 'a metade PJ deixou de exigir status ativo');

  await c.end();
  console.log(`\n${fails === 0 ? '✅ TODAS AS PROVAS PASSARAM' : `❌ ${fails} PROVA(S) FALHARAM`}\n`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('ERRO NA PROVA:', e); process.exit(1); });
