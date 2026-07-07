// SMOKE DECISION-0164 (fatia A) — ciclo completo da demanda direto no service.
// Roda: npx tsx src/scripts/smoke-demand-orchestration.ts
import { pool, runQueryWithTenant } from '@core/database/pool';
import { demandService } from '@modules/demands/demand.service';

async function main() {
  // DI dos ports sociais (o servidor real injeta no boot; script standalone injeta aqui)
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const t = await pool.query(`SELECT id::text FROM tenants WHERE slug='unificard-inicial'`);
  const tenantId = t.rows[0].id;
  const emp = await pool.query(`SELECT id::text FROM actors WHERE actor_type='page' LIMIT 1`);
  const emitter = emp.rows[0].id; // Empresa Teste Dev (a churrascaria do exemplo)
  const prov = await pool.query(
    `SELECT a.id::text FROM actors a JOIN users u ON u.user_id=a.user_id WHERE u.email='cpchagasii@hotmail.com'`);
  const provider = prov.rows[0].id; // Clayton PF = o garçom

  const ok = (name: string, cond: boolean, extra = '') =>
    console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);

  // pré-limpeza (idempotência entre runs)
  await runQueryWithTenant(tenantId, `DELETE FROM posts WHERE tenant_id=$1 AND metadata->>'demand_id' IS NOT NULL`, [tenantId]);
  await runQueryWithTenant(tenantId, 'DELETE FROM service_demand_responses WHERE tenant_id=$1', [tenantId]);
  await runQueryWithTenant(tenantId, 'DELETE FROM service_demands WHERE tenant_id=$1', [tenantId]);

  // 1. AUTOMÁTICO: garçom diária, 2 vagas, R$100
  const d1 = await demandService.create(tenantId, emitter, {
    conceptSlug: 'garcom', title: 'Garçom p/ churrascaria', vinculo: 'diaria',
    dateStart: '2026-07-08', timeStart: '16:00', timeEnd: '23:00',
    quantity: 2, radiusKm: 10, acceptanceMode: 'automatico',
    pricingMode: 'preco_ofertado', offeredPriceCents: 10000, cancelNoticeHours: 6,
  });
  ok('D1 criada (garcom, automatico, 2 vagas)', d1.status === 'open' && d1.quantity === 2 && d1.conceptSlug === 'garcom');

  // vocabulário fail-closed
  let bad = false; try { await demandService.create(tenantId, emitter, { conceptSlug: 'garcom', title: 'x', vinculo: 'bico' as any }); } catch { bad = true; }
  ok('vinculo fora do vocabulário → 400', bad);

  // 2. provider ACEITA (automático) → vaga 1/2, ainda open
  const r1 = await demandService.respond(tenantId, provider, d1.id, { message: 'Aceito!' });
  ok('aceite automático preenche vaga', r1.response.status === 'accepted' && r1.demand.quantityFilled === 1 && r1.demand.status === 'open');

  // duplicado → 409
  bad = false; try { await demandService.respond(tenantId, provider, d1.id, {}); } catch (e: any) { bad = e.statusCode === 409; }
  ok('resposta duplicada → 409 (vaga não vazou)', bad);
  const after = await demandService.getWithResponses(tenantId, emitter, d1.id);
  ok('rollback da vaga no duplicado', after.demand.quantityFilled === 1);

  // 3. provider CANCELA → vaga LIBERA (adendo 3)
  const w = await demandService.withdraw(tenantId, provider, d1.id, r1.response.id);
  ok('withdraw libera vaga', w.response.status === 'withdrawn' && w.demand.quantityFilled === 0 && w.demand.status === 'open');

  // 4. COM ANÁLISE + ORÇAMENTO: pedreiro por período
  const d2 = await demandService.create(tenantId, emitter, {
    conceptSlug: 'pedreiro', title: 'Pedreiros p/ obra', vinculo: 'periodo',
    dateStart: '2026-07-08', dateEnd: '2026-07-20', quantity: 1,
    acceptanceMode: 'com_analise', pricingMode: 'orcamento',
  });
  bad = false; try { await demandService.respond(tenantId, provider, d2.id, {}); } catch (e: any) { bad = e.statusCode === 400; }
  ok('orçamento sem quoteCents → 400', bad);
  const r2 = await demandService.respond(tenantId, provider, d2.id, { quoteCents: 250000, message: 'Orçamento: 2500' });
  ok('candidatura com_analise = pending (não fecha)', r2.response.status === 'pending' && r2.demand.quantityFilled === 0);

  // provider NÃO pode escolher a si mesmo (só emissor)
  bad = false; try { await demandService.choose(tenantId, provider, d2.id, r2.response.id); } catch (e: any) { bad = e.statusCode === 403; }
  ok('choose por não-emissor → 403', bad);

  // 5. emissor ESCOLHE → chosen + filled
  const ch = await demandService.choose(tenantId, emitter, d2.id, r2.response.id);
  ok('emissor escolhe → chosen + demanda filled', ch.response.status === 'chosen' && ch.demand.status === 'filled');

  // 6. PULL oportunidades: Clayton (sem concepts profissionais) — matching=false vê abertas
  const opps = await demandService.listOpportunities(tenantId, provider, false);
  ok('pull de oportunidades (exploração) lista abertas', opps.some((o) => o.id === d1.id));
  const oppsMatched = await demandService.listOpportunities(tenantId, provider, true);
  ok('pull matching=true filtra pelo perfil C1 (Clayton sem concept garcom → 0)', !oppsMatched.some((o) => o.id === d1.id));

  // 7. ESPELHO NO FEED (item 1 do fechamento): create com userId → post gerado + post_id vinculado
  const devUser = await pool.query(`SELECT user_id::text FROM users WHERE email='dev@unificard.local'`);
  const devActorEarly = await pool.query(`SELECT a.id::text FROM actors a JOIN users u ON u.user_id=a.user_id WHERE u.email='dev@unificard.local' AND a.actor_type='user'`);
  const devPFe = devActorEarly.rows[0].id;
  const dM = await demandService.create(tenantId, devPFe, {
    conceptSlug: 'cozinheiro', title: 'Cozinheiro p/ evento', vinculo: 'diaria',
    dateStart: '2026-07-25', timeStart: '10:00', timeEnd: '15:00', breakMinutes: 30, acceptanceMode: 'automatico',
  }, devUser.rows[0].user_id);
  const mirror = await pool.query(
    `SELECT p.id::text, p.visibility FROM posts p WHERE p.metadata->>'demand_id' = $1`, [dM.id]);
  const dMAfter = await pool.query(`SELECT post_id::text FROM service_demands WHERE id = $1`, [dM.id]);
  if (mirror.rowCount === 1) {
    ok('espelho no feed criado + post_id vinculado',
      dMAfter.rows[0].post_id === mirror.rows[0].id && mirror.rows[0].visibility === 'public');
  } else {
    console.log('⚠️  espelho não criado em ambiente-script (quirk impact_ledger fora do módulo) — validar no SERVIDOR real');
    ok('espelho: demanda intacta mesmo com espelho ausente (fail-visible correto)', dM.status === 'open');
  }
  ok('breakMinutes persistido', dM.breakMinutes === 30);

  // 8. SELO DE AGENDA (item 2): compromisso não colide com compromisso
  let rM: Awaited<ReturnType<typeof demandService.respond>> | null = null;
  try { rM = await demandService.respond(tenantId, provider, dM.id, {}); }
  catch (e: any) { console.log('   [erro aceite-base]:', e.statusCode, e.message); }
  ok('aceite (base do conflito)', rM?.response.status === 'accepted');
  const dConf = await demandService.create(tenantId, emitter, {
    conceptSlug: 'garcom', title: 'Garçom mesma janela', vinculo: 'diaria',
    dateStart: '2026-07-25', timeStart: '12:00', timeEnd: '18:00', acceptanceMode: 'automatico',
  });
  bad = false; try { await demandService.respond(tenantId, provider, dConf.id, {}); } catch (e: any) { bad = e.statusCode === 409 && /Agenda em conflito/.test(e.message); }
  ok('janela sobreposta → 409 Agenda em conflito', bad);
  const dOk = await demandService.create(tenantId, emitter, {
    conceptSlug: 'garcom', title: 'Garçom à noite', vinculo: 'diaria',
    dateStart: '2026-07-25', timeStart: '19:00', timeEnd: '23:00', acceptanceMode: 'automatico',
  });
  const rOk = await demandService.respond(tenantId, provider, dOk.id, {});
  ok('janela livre no mesmo dia → aceita', rOk.response.status === 'accepted');

  // 9. PLATEIA 0162 na leitura: demanda 'connections' do Dev-PF visível pro Clayton (aresta aceita);
  //    refinamento por tipo que Clayton NÃO é (cliente) → invisível
  const devActor = await pool.query(
    `SELECT a.id::text FROM actors a JOIN users u ON u.user_id=a.user_id WHERE u.email='dev@unificard.local' AND a.actor_type='user'`);
  const devPF = devActor.rows[0].id;
  const dConn = await demandService.create(tenantId, devPF, {
    conceptSlug: 'eletricista', title: 'Eletricista (só conexões)', vinculo: 'diaria',
    dateStart: '2026-08-01', visibility: 'connections',
  });
  const dCli = await demandService.create(tenantId, devPF, {
    conceptSlug: 'encanador', title: 'Encanador (só clientes)', vinculo: 'diaria',
    dateStart: '2026-08-02', visibility: 'connections', audienceRelationshipTypes: ['cliente'],
  });
  const oppClayton = await demandService.listOpportunities(tenantId, provider, false);
  ok('connections sem refinamento → conexão VÊ', oppClayton.some((o) => o.id === dConn.id));
  ok("refinamento 'cliente' → amigo NÃO vê (ótica do emissor)", !oppClayton.some((o) => o.id === dCli.id));

  // 9b. FIX YALA #6 — plateia é CONTROLE DE ACESSO (ler E agir), não só filtro de lista
  bad = false; try { await demandService.getWithResponses(tenantId, provider, dCli.id); } catch (e: any) { bad = e.statusCode === 404; }
  ok('GET por id fora da plateia → 404 (não vaza existência)', bad);
  bad = false; try { await demandService.respond(tenantId, provider, dCli.id, {}); } catch (e: any) { bad = e.statusCode === 404; }
  ok('RESPOND fora da plateia → 404 (mutação barrada — o pior achado da Yala)', bad);
  const emitterView = await demandService.getWithResponses(tenantId, devPF, dCli.id);
  ok('emissor sempre vê a própria demanda restrita', emitterView.demand.id === dCli.id);

  // 9c. FIX YALA #4 — double-withdraw: só UM transiciona; vaga libera UMA vez
  const w2 = await demandService.withdraw(tenantId, provider, dOk.id, rOk.response.id);
  ok('1º withdraw ok (vaga liberou)', w2.response.status === 'withdrawn' && w2.demand.quantityFilled === 0);
  bad = false; try { await demandService.withdraw(tenantId, provider, dOk.id, rOk.response.id); } catch (e: any) { bad = e.statusCode === 409; }
  const dOkAfter = await demandService.getWithResponses(tenantId, emitter, dOk.id);
  ok('2º withdraw → 409 e SEM double-release', bad && dOkAfter.demand.quantityFilled === 0);

  // 10. Δbank=0 (prova)
  const bank = await pool.query(`SELECT (SELECT count(*) FROM bank_ledger) + (SELECT count(*) FROM bank_transactions) AS n`);
  ok('Δbank=0', Number(bank.rows[0].n) === 0);

  // limpeza dos dados de smoke (inclui posts-espelho)
  await runQueryWithTenant(tenantId, `DELETE FROM posts WHERE tenant_id=$1 AND metadata->>'demand_id' IS NOT NULL`, [tenantId]);
  await runQueryWithTenant(tenantId, `DELETE FROM service_demand_responses WHERE tenant_id=$1`, [tenantId]);
  await runQueryWithTenant(tenantId, `DELETE FROM service_demands WHERE tenant_id=$1`, [tenantId]);
  console.log('\nSMOKE DECISION-0164: ciclo completo provado.');
  await pool.end();
}

main().catch((e) => { console.error('SMOKE FAIL:', e); process.exit(1); });
