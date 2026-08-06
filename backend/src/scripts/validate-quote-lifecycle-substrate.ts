// backend/src/scripts/validate-quote-lifecycle-substrate.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   docs/02_decisions/DECISION_0196_SERVICE_DEMAND_QUOTE_LIFECYCLE.md §B.2 · §C/D1 · §C/D4
// ║ NÃO:     rodar contra unificard_dev — exige EXPECTED_DATABASE_NAME de DB efêmera
// ║ EM VEZ:  backend/scripts/run-quote-lifecycle-substrate-ephemeral.ps1
// ╚════════════════════════════════════════════════════════════════
//
// F-SERVICE-DEMAND-QUOTE-LIFECYCLE — prova de COMPORTAMENTO do substrato (migration 20260806120000).
// Guard estático prova que a constraint está ESCRITA; isto prova que ela MORDE, e que o caso
// legítimo CONTINUA passando (a metade que não grita).
//
// 🔴 ABORTA se não achar o alvo — prova vermelha que não altera nada passa com cara de sucesso.

import { Client } from 'pg';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME;
const URL = process.env.DATABASE_URL ?? '';
const dbName = URL.slice(URL.lastIndexOf('/') + 1);

if (!EXPECTED) { console.error('ABORT: EXPECTED_DATABASE_NAME ausente — recusa fail-closed.'); process.exit(2); }
if (dbName !== EXPECTED) { console.error(`ABORT: DATABASE_URL aponta para "${dbName}", esperado "${EXPECTED}".`); process.exit(2); }
if (dbName === 'unificard_dev') { console.error('ABORT: alvo é o banco OFICIAL.'); process.exit(2); }

const c = new Client({ connectionString: URL });
let fails = 0;
const ok = (n: string, x = '') => console.log(`  ✅ ${n}${x ? ' — ' + x : ''}`);
const bad = (n: string, x = '') => { fails++; console.log(`  ❌ ${n}${x ? ' — ' + x : ''}`); };

/** CPF com dígitos verificadores REAIS — `register` valida na borda. */
function gerarCpf(): string {
  const base = String(Math.floor(Math.random() * 1e9)).padStart(9, '0').slice(-9);
  const dv = (nums: string): number => {
    const peso = nums.length + 1;
    const soma = Array.from(nums).reduce((acc, d, i) => acc + parseInt(d, 10) * (peso - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base);
  return base + String(d1) + String(dv(base + String(d1)));
}

(async () => {
  await c.connect();
  console.log(`\nF-SERVICE-DEMAND-QUOTE-LIFECYCLE · substrato · efêmera "${dbName}"\n`);

  // ── pré-condição: os alvos existem ────────────────────────────────────────────────────────────
  const alvo = await c.query(
    `SELECT 1 FROM pg_constraint WHERE conname = 'chk_sd_responses_offer_ref_exclusive'`);
  if (alvo.rowCount === 0) { console.error('ABORT: chk_sd_responses_offer_ref_exclusive ausente — prova inválida.'); await c.end(); process.exit(2); }
  ok('pré-condição', 'a constraint alvo existe');

  // ── fixture pelo CAMINHO REAL (writer soberano de actors — §4.8 / C5) ─────────────────────────
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  // 🔴 DOIS actors: o service recusa "responder à própria demanda" (regra legítima da 0164), e usar
  // um só produziria vermelho verdadeiro sobre defeito inexistente — a armadilha da fixture irreal.
  const { authService } = await import('../core/auth/auth.service');
  const nasce = async (nome: string) => {
    const reg = await authService.register(
      undefined, `quote-lc-${nome}-${Date.now()}@teste.local`, 'SenhaTeste!234', gerarCpf(), nome, '1985-03-15', undefined);
    const r = await c.query(`SELECT id::text AS id FROM actors WHERE user_id = $1::uuid AND actor_type='user' LIMIT 1`, [reg.user.userId]);
    if (r.rowCount === 0) { console.error(`ABORT: actor "${nome}" não nasceu pelo caminho real.`); await c.end(); process.exit(2); }
    return { tenantId: reg.tenantId as string, actorId: r.rows[0].id as string };
  };
  const emissor = await nasce('Emitente Prova');
  const fornecedor = await nasce('Ofertante Prova');
  const tenantId: string = emissor.tenantId;
  if (fornecedor.tenantId !== tenantId) { console.error('ABORT: os dois actors nasceram em tenants diferentes — fixture inválida.'); await c.end(); process.exit(2); }
  const actorId: string = fornecedor.actorId;   // dono da oferta ou ativo e quem RESPONDE
  const emissorId: string = emissor.actorId;    // quem PUBLICA a demanda

  const elig = await c.query(`SELECT concept_id FROM concept_asset_eligibilities LIMIT 1`);
  if (elig.rowCount === 0) { console.error('ABORT: nenhum concept elegível a ativo.'); await c.end(); process.exit(2); }
  const asset = await c.query(
    `INSERT INTO actor_assets (id, tenant_id, owner_actor_id, concept_id, label, status)
     VALUES (gen_random_uuid(), $1, $2, $3, 'Tenda prova', 'active') RETURNING id::text AS id`,
    [tenantId, actorId, elig.rows[0].concept_id]);
  const assetId: string = asset.rows[0].id;

  // `service_offerings.service_id` é NOT NULL — a oferta pende de um `services`. Descoberto pelo
  // banco recusando, não suposto: fixture irreal produz vermelho verdadeiro sobre defeito inexistente.
  const cs = await c.query(`SELECT id FROM canonical_services WHERE tenant_id IS NULL LIMIT 1`);
  if (cs.rowCount === 0) { console.error('ABORT: nenhum canonical_service global.'); await c.end(); process.exit(2); }
  const svc = await c.query(
    `INSERT INTO services (tenant_id, actor_id, name, slug, canonical_service_id, status)
     VALUES ($1, $2, 'Servico prova', 'servico-prova-' || substr(md5(random()::text), 1, 8), $3, 'active')
     RETURNING service_id::text AS id`,
    [tenantId, actorId, cs.rows[0].id]);
  // Obrigatórias de `service_offerings` LIDAS DE UMA VEZ do catálogo (tenant_id, canonical_service_id,
  // provider_actor_id, service_id, price_cents, duration_minutes) — descobrir uma por vez, a cada
  // execução vermelha, é o vício que esta casa combate.
  const off = await c.query(
    `INSERT INTO service_offerings (id, tenant_id, canonical_service_id, service_id, provider_actor_id,
                                    price_cents, duration_minutes, status)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, 60, 'active') RETURNING id::text AS id`,
    [tenantId, cs.rows[0].id, svc.rows[0].id, actorId]);
  const offeringId: string = off.rows[0].id;

  const concept = await c.query(`SELECT concept_id FROM concepts LIMIT 1`);
  const dem = await c.query(
    `INSERT INTO service_demands (id, tenant_id, actor_id, concept_id, title, vinculo, quantity, date_start, pricing_mode)
     VALUES (gen_random_uuid(), $1, $2, $3, 'Preciso de tenda', 'diaria', 1, CURRENT_DATE + 10, 'orcamento')
     RETURNING id::text AS id`,
    [tenantId, emissorId, concept.rows[0].concept_id]);   // ← publicada pelo EMISSOR
  const demandId: string = dem.rows[0].id;
  ok('fixture', 'actor + asset + offering + demanda (pricing_mode=orcamento)');

  const insert = (cols: string, vals: string, params: unknown[]) =>
    c.query(`INSERT INTO service_demand_responses (tenant_id, demand_id, provider_actor_id, expires_at, ${cols})
             VALUES ($1, $2, $3, now() + interval '7 days', ${vals})`, params);

  // ── A · o CHECK de exclusividade MORDE ────────────────────────────────────────────────────────
  try {
    await insert('offering_id, asset_id', '$4, $5', [tenantId, demandId, actorId, offeringId, assetId]);
    bad('A1 offering + asset juntos ACEITOS', 'o CHECK não morde');
  } catch (e: any) {
    e?.constraint === 'chk_sd_responses_offer_ref_exclusive'
      ? ok('A1 offering + asset juntos RECUSADOS', e.constraint)
      : bad('A1 recusado pelo motivo ERRADO', `${e?.constraint ?? e?.code}: ${e?.message}`);
  }

  // ── B · e o caso LEGÍTIMO continua passando (a metade que não grita) ──────────────────────────
  for (const [label, cols, vals, extra] of [
    ['B1 só offering', 'offering_id', '$4', offeringId],
    ['B2 só asset', 'asset_id', '$4', assetId],
  ] as const) {
    try {
      await insert(cols, vals, [tenantId, demandId, actorId, extra]);
      ok(label, 'aceito');
      await c.query(`DELETE FROM service_demand_responses WHERE demand_id = $1`, [demandId]);
    } catch (e: any) { bad(label, `RECUSADO: ${e?.constraint ?? e?.code}: ${e?.message}`); }
  }

  // ── C · expires_at NOT NULL sem default: omitir FALHA ALTO, não vira NULL silencioso ──────────
  try {
    await c.query(
      `INSERT INTO service_demand_responses (tenant_id, demand_id, provider_actor_id, offering_id)
       VALUES ($1, $2, $3, $4)`, [tenantId, demandId, actorId, offeringId]);
    bad('C1 expires_at omitido foi ACEITO', 'prazo decorativo nasceria de novo');
  } catch (e: any) {
    e?.code === '23502'
      ? ok('C1 expires_at omitido RECUSADO', 'not-null violation — a omissão falha ALTO')
      : bad('C1 recusado pelo motivo ERRADO', `${e?.code}: ${e?.message}`);
  }

  // ── D · target_actor_id: NULL (broadcast) e preenchido (dirigido) — nada regride ──────────────
  const dirigida = await c.query(
    `INSERT INTO service_demands (id, tenant_id, actor_id, concept_id, title, vinculo, quantity, date_start, target_actor_id)
     VALUES (gen_random_uuid(), $1, $2, $3, 'Dirigida', 'diaria', 1, CURRENT_DATE + 10, $2) RETURNING target_actor_id`,
    [tenantId, actorId, concept.rows[0].concept_id]).catch((e: any) => { bad('D1 demanda dirigida', e.message); return null; });
  if (dirigida?.rows?.[0]?.target_actor_id) ok('D1 demanda DIRIGIDA aceita', 'target_actor_id preenchido');
  const bcast = await c.query(`SELECT target_actor_id FROM service_demands WHERE id = $1`, [demandId]);
  bcast.rows[0].target_actor_id === null
    ? ok('D2 demanda de hoje segue BROADCAST', 'target_actor_id NULL — nada regride')
    : bad('D2 broadcast quebrou');

  // ── E · O WRITER VIVO — a rota `POST /demands/:id/respond` NÃO pode ter quebrado ──────────────
  // 🔴 Esta seção existe porque a migration QUASE me deixou uma regressão: `expires_at` é NOT NULL
  // sem default, e o `createResponse` original não o preenchia — toda resposta daria 23502.
  // Schema provado ≠ caminho vivo provado.
  await c.query(`DELETE FROM service_demand_responses WHERE demand_id = $1`, [demandId]);
  const { demandService } = await import('../modules/demands/demand.service');

  try {
    await demandService.respond(tenantId, actorId, demandId, { quoteCents: 5000 });
    bad('E1 orçamento SEM offering/asset foi aceito', '§B.4 não está sendo aplicada');
  } catch (e: any) {
    e?.statusCode === 400 && /offeringId ou assetId/.test(String(e?.message))
      ? ok('E1 orçamento sem offering/asset RECUSADO', '400 nomeado (§B.4)')
      : bad('E1 recusado pelo motivo ERRADO', `${e?.statusCode}: ${String(e?.message).slice(0, 120)}`);
  }

  try {
    await demandService.respond(tenantId, actorId, demandId, { quoteCents: 5000, offeringId, assetId });
    bad('E2 offering + asset juntos aceitos pelo service');
  } catch (e: any) {
    e?.statusCode === 400 && /nunca os dois/.test(String(e?.message))
      ? ok('E2 offering + asset RECUSADOS pelo service', 'antes de chegar ao banco')
      : bad('E2 recusado pelo motivo ERRADO', `${e?.statusCode}: ${String(e?.message).slice(0, 120)}`);
  }

  // 🔴 O caminho FELIZ — a metade que não grita. Se só as recusas fossem provadas, uma trava que
  // bloqueia todo mundo passaria verde.
  try {
    const r = await demandService.respond(tenantId, actorId, demandId, { quoteCents: 5000, offeringId });
    const dias = (new Date(r.response.expiresAt).getTime() - Date.now()) / 86400000;
    if (dias > 6.9 && dias < 7.1) ok('E3 resposta CRIADA com validade injetada', `expiresAt ≈ ${dias.toFixed(2)} dias (D1)`);
    else bad('E3 validade fora do default de 7 dias', `${dias.toFixed(2)} dias`);
    if (r.response.offeringId === offeringId) ok('E4 offering viaja na projeção');
    else bad('E4 offering NÃO viaja na projeção', String(r.response.offeringId));
  } catch (e: any) {
    bad('E3 o caminho FELIZ quebrou', `${e?.statusCode ?? ''} ${String(e?.message).slice(0, 160)}`);
  }

  await c.end();
  console.log(`\n${fails === 0 ? '✅ TODAS AS PROVAS PASSARAM' : `❌ ${fails} PROVA(S) FALHARAM`}\n`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('ERRO NA PROVA:', e); process.exit(1); });
