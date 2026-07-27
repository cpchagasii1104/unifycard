// backend/src/scripts/seed-economic-policies-legacy-baseline.ts
//
// SEMEADURA INICIAL DE economic_policies — F-ECONOMIC-POLICY-ADMIN (painel selado, motor
// fail-closed com ZERO policies). Objetivo único: dar a Clayton um ponto de partida
// CONFIGURÁVEL no painel (EconomicPoliciesPage.tsx), sem inventar número nem doutrina.
//
// 🔴 OS NÚMEROS NÃO SÃO RATIFICADOS. São herdados literalmente do motor legado
// `bank-split-engine.service.ts` (getSplitConfig) — comentário do próprio arquivo:
// "defaults hardcoded por contexto até cutover". Cada policy nasce DRAFT (nunca ativada
// por este script) e cada change_reason declara a origem e a não-ratificação. A primeira
// versão que CLAYTON publicar ou ativar por conta própria é que passa a ser a decisão.
//
// GOVERNED WRITE PATH — reusa EXATAMENTE o que a rota admin usa, sem duplicar validação:
//   assertCreatePolicyVersionRequestValid (economic-policy-write-validation.ts)
//   → economicPolicyRepository.createPolicyVersionWithLines (mesma função que
//     POST /economy/admin/policies chama — versão calculada no servidor, status sempre
//     'draft', transação atômica, pg_advisory_xact_lock).
// NUNCA INSERT cru em economic_policies/economic_policy_lines.
//
// IDEMPOTÊNCIA: antes de criar, verifica se já existe QUALQUER versão do policy_code no
// tenant (listPoliciesForTenant, o MESMO reader do GET admin) — se existir, pula (não cria
// versão nova, não duplica, não reativa). Reexecutar este script é seguro.
//
// REFERRAL (5%, REFERRAL_PERCENTAGE em bank-split-engine.service.ts:23) — DELIBERADAMENTE
// NÃO SEMEADO. destinationType='referrer_actor_wallet' não está em SUPPORTED_DESTINATION_TYPES
// (service-payment-execution.service.ts:48-62) — PE-3 falha POLICY_DESTINATION_UNSUPPORTED em
// QUALQUER transação que passe por uma linha assim, não só as com indicação ativa. Semear essa
// linha quebraria silenciosamente TODA execução da policy, não só o caso de indicação. Ver
// REMEDIATION_DT_LOG.md ("Pior que a mina H1, porque H1 falha visível e esta falharia calada").
//
// EVENT_TICKET/RIDE_PAYMENT — sem caller PE-3-equivalente vivo hoje (grep: nenhum
// resolveEconomicPolicy com moduleContext='event_ticket'|'ride_payment' em backend/src fora
// deste script). As policies nascem DRAFT e ficam INERTES até uma frente futura ligar um
// caller — mas já dão a Clayton os números reais para revisar/ratificar no painel.
//
// USO:
//   npx tsx backend/src/scripts/seed-economic-policies-legacy-baseline.ts [--activate]
//
// --activate é INTENCIONALMENTE não implementado nesta versão do script — ativar policy com
// número não ratificado é decisão exclusiva de Clayton (Artigo V da Constituição: "toda
// movimentação financeira exige consentimento explícito"). Rodar o script sempre deixa as
// policies em 'draft'; ativação é ação humana separada via painel ou POST .../activate.

import 'dotenv/config';
import { pool } from '../core/database/pool';
import { economicPolicyRepository } from '../modules/economy/policy-engine/economic-policy.repository';
import {
  assertCreatePolicyVersionRequestValid,
  type CreatePolicyVersionRequestBody,
} from '../modules/economy/policy-engine/economic-policy-write-validation';

// Curitiba — cidade-piloto do fundo regional (regional-fund-city-activation.ts:12).
const CURITIBA_CITY_ID = '9d431002-1fd3-4b34-ae82-678f28f64288';
const CURITIBA_STATE_ID = '281155db-290d-462b-a220-f8aa75b1bf0b'; // Paraná
const BRASIL_COUNTRY_ID = '42d04887-3033-459c-a4a9-8c6f9ea5a816';

const ADMIN_EMAIL = process.argv[2] && process.argv[2] !== '--activate' ? process.argv[2] : 'cpchagasii@hotmail.com';

interface SeedSpec {
  body: CreatePolicyVersionRequestBody;
}

async function resolveTenantAndActor(email: string): Promise<{ tenantId: string; actorId: string }> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  console.log(`Conectado em: ${db}`);

  const userRes = await pool.query<{ id: string; tenant_id: string }>(
    `SELECT id::text, tenant_id::text FROM users WHERE email = $1 LIMIT 1`,
    [email]
  );
  const user = userRes.rows[0];
  if (!user) {
    throw new Error(`ABORT: usuário '${email}' não encontrado — não sei atribuir autoria (Artigo I: sem conta-fantasma).`);
  }

  const actorRes = await pool.query<{ id: string }>(
    `SELECT id::text FROM actors WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND actor_type = 'user' LIMIT 1`,
    [user.tenant_id, user.id]
  );
  const actor = actorRes.rows[0];
  if (!actor) {
    throw new Error(`ABORT: actor de '${email}' não encontrado no tenant ${user.tenant_id}.`);
  }

  console.log(`Tenant: ${user.tenant_id}`);
  console.log(`Autor (actor_id de ${email}): ${actor.id}`);
  return { tenantId: user.tenant_id, actorId: actor.id };
}

function buildSpecs(): SeedSpec[] {
  const nowIso = new Date(Date.now() - 60_000).toISOString(); // -60s: evita corrida com effective_from <= now

  const REASON_PREFIX =
    '🔴 SEMEADURA INICIAL — NÃO RATIFICADO POR CLAYTON. Valor herdado literalmente do motor legado ' +
    'bank-split-engine.service.ts (comentário do próprio arquivo: "defaults hardcoded por contexto ' +
    'até cutover"). Existe apenas para o painel administrativo (EconomicPoliciesPage.tsx) ter um ' +
    'ponto de partida configurável — não é decisão de produto. A PRIMEIRA versão que Clayton ' +
    'publicar ou ativar por conta própria é que passa a ser a versão ratificada. ';

  const serviceExecution: SeedSpec = {
    body: {
      policyCode: 'legacy_baseline_service_execution',
      policyType: 'COMMISSION_SPLIT',
      // moduleContext/vertical escolhidos para casar com o ÚNICO caller PE-3 vivo hoje
      // (service-payment-execution.service.ts:594-601: moduleContext='service_execution',
      // vertical='services') — NÃO 'service_booking' (o nome do contexto no motor legado),
      // porque 'service_booking' nunca é consultado por nenhum resolver real. Selecionado
      // para que esta policy seja genuinamente ENCONTRÁVEL pelo motor, se/quando Clayton
      // decidir ativá-la — não é invenção, é o valor que o código real já usa.
      moduleContext: 'service_execution',
      vertical: 'services',
      // actorType/serviceType/pricingModel/settlementFlow deixados NULL (= any) — o motor
      // legado aplicava 97/3 a TODO service_booking, sem distinguir sub-tipo; manter NULL
      // reproduz fielmente esse alcance irrestrito, sem inventar segmentação nova.
      priority: 0,
      effectiveFrom: nowIso,
      changeReason:
        REASON_PREFIX +
        'Origem: bank-split-engine.service.ts getSplitConfig, case \'service_booking\' ' +
        '(revenue_share 97% / fee 3%). moduleContext/vertical ajustados para \'service_execution\'' +
        '/\'services\' (não \'service_booking\') para casar com o ÚNICO caller PE-3 vivo hoje ' +
        '(service-payment-execution.service.ts:596-597) — substituição de rótulo, não de número. ' +
        'appliesTo=gross_transaction porque calculatePolicySplits é chamado com ' +
        'paymentRequest.amountCents (o valor BRUTO do pagamento), não com uma comissão já ' +
        'extraída — ver service-payment-execution.service.ts:612-615.',
      lines: [
        {
          lineType: 'revenue_share',
          destinationType: 'receiver_actor',
          bps: 9700,
          appliesTo: 'gross_transaction',
          priority: 0,
        },
        {
          lineType: 'platform_fee',
          destinationType: 'platform_fees',
          bps: 300,
          appliesTo: 'gross_transaction',
          priority: 1,
        },
      ],
    },
  };

  const ridePayment: SeedSpec = {
    body: {
      policyCode: 'legacy_baseline_ride_payment',
      policyType: 'COMMISSION_SPLIT',
      moduleContext: 'ride_payment',
      vertical: 'rides',
      priority: 0,
      effectiveFrom: nowIso,
      changeReason:
        REASON_PREFIX +
        'Origem: bank-split-engine.service.ts getSplitConfig, case \'ride_payment\' ' +
        '(revenue_share 97% driver / fee 3%). SEM caller PE-3-equivalente vivo hoje — rides não ' +
        'migrou do motor legado (grep confirma: nenhum resolveEconomicPolicy com ' +
        'moduleContext=\'ride_payment\' em backend/src). Esta policy fica INERTE (nunca ' +
        'encontrada por nenhum resolver real) até uma frente futura ligar um caller — semeada só ' +
        'para visibilidade/revisão no painel. appliesTo=gross_transaction: mesma base do motor ' +
        'legado (percentual sobre o valor bruto da corrida, sem extração de comissão prévia).',
      lines: [
        {
          lineType: 'revenue_share',
          destinationType: 'receiver_actor',
          bps: 9700,
          appliesTo: 'gross_transaction',
          priority: 0,
        },
        {
          lineType: 'platform_fee',
          destinationType: 'platform_fees',
          bps: 300,
          appliesTo: 'gross_transaction',
          priority: 1,
        },
      ],
    },
  };

  const eventTicketCuritiba: SeedSpec = {
    body: {
      policyCode: 'legacy_baseline_event_ticket_curitiba',
      policyType: 'COMMISSION_SPLIT',
      moduleContext: 'event_ticket',
      vertical: 'events',
      // Escopada à cidade-piloto (opção "(b)" do GATE — ver relatório): NÃO existe variante
      // global nesta semeadura. Uma policy SEM esta trava, carregando a linha regional_fund,
      // resolveria (a policy é encontrada) mas FALHARIA fail-closed
      // (REGIONAL_FUND_CITY_NOT_ENABLED) em qualquer transação cujo comprador não resida em
      // Curitiba — regional-fund-city-activation.ts só habilita esse fundo para
      // CURITIBA_CITY_ID. Redistribuir os 10% para inventar uma variante global sem fundo
      // regional teria sido INVENTAR percentual novo — este script recusa fazer isso.
      countryId: BRASIL_COUNTRY_ID,
      stateId: CURITIBA_STATE_ID,
      cityId: CURITIBA_CITY_ID,
      priority: 0,
      effectiveFrom: nowIso,
      changeReason:
        REASON_PREFIX +
        'Origem: bank-split-engine.service.ts getSplitConfig, case \'event_ticket\' ' +
        '(revenue_share 70% organizer / fee 3% / regional_fund 10% / reserve 17%). Seletor ' +
        'territorial (country=Brasil/state=Paraná/city=Curitiba) aplicado porque a linha ' +
        'regional_fund só resolve para a cidade-piloto (regional-fund-city-activation.ts) — ' +
        'qualquer variante sem essa trava falharia REGIONAL_FUND_CITY_NOT_ENABLED fora de ' +
        'Curitiba, e inventar uma redistribuição dos 10% para uma variante global não é ' +
        'reproduzir o legado, é decidir um número novo (fora do escopo desta semeadura). ' +
        'regionalOriginBasis=payer_identity_residence conforme DECISION-0192 D1 (doutrina ' +
        'redigida por Clayton em 2026-07-27 — AINDA NÃO SELADA; se a auditoria independente da ' +
        '0192 mudar a doutrina, esta linha precisa ser revisada). SEM caller PE-3-equivalente ' +
        'vivo hoje para event_ticket — policy INERTE, semeada só para revisão no painel. ' +
        'appliesTo=gross_transaction: mesma base do motor legado (percentual sobre o valor ' +
        'bruto do ingresso).',
      lines: [
        {
          lineType: 'revenue_share',
          destinationType: 'receiver_actor',
          bps: 7000,
          appliesTo: 'gross_transaction',
          priority: 0,
        },
        {
          lineType: 'platform_fee',
          destinationType: 'platform_fees',
          bps: 300,
          appliesTo: 'gross_transaction',
          priority: 1,
        },
        {
          lineType: 'regional_fund',
          destinationType: 'regional_fund',
          regionalOriginBasis: 'payer_identity_residence',
          regionalLevel: 'city',
          bps: 1000,
          appliesTo: 'gross_transaction',
          priority: 2,
        },
        {
          lineType: 'reserve',
          destinationType: 'risk_reserve',
          bps: 1700,
          appliesTo: 'gross_transaction',
          priority: 3,
        },
      ],
    },
  };

  return [serviceExecution, ridePayment, eventTicketCuritiba];
}

async function main(): Promise<void> {
  const { tenantId, actorId } = await resolveTenantAndActor(ADMIN_EMAIL);

  const specs = buildSpecs();
  const results: Array<{ code: string; status: 'created' | 'skipped_existing'; policyId?: string }> = [];

  // Idempotência: mesmo reader que o GET /economy/admin/policies usa.
  const existing = await economicPolicyRepository.listPoliciesForTenant(tenantId);
  const existingCodes = new Set(existing.map((p) => p.policyCode));

  for (const spec of specs) {
    const code = spec.body.policyCode;
    if (existingCodes.has(code)) {
      console.log(`⏭️  '${code}' já existe (alguma versão) — pulando (idempotente).`);
      results.push({ code, status: 'skipped_existing' });
      continue;
    }

    // MESMA validação que a rota roda ANTES de gravar (§4.9.5) — zero duplicação de regra.
    assertCreatePolicyVersionRequestValid(spec.body);

    const { policy, lines } = await economicPolicyRepository.createPolicyVersionWithLines(
      tenantId,
      {
        policyCode: spec.body.policyCode,
        policyType: spec.body.policyType as any,
        moduleContext: spec.body.moduleContext,
        vertical: spec.body.vertical ?? null,
        actorType: spec.body.actorType ?? null,
        serviceType: spec.body.serviceType ?? null,
        pricingModel: spec.body.pricingModel ?? null,
        settlementFlow: spec.body.settlementFlow ?? null,
        countryId: spec.body.countryId ?? null,
        stateId: spec.body.stateId ?? null,
        cityId: spec.body.cityId ?? null,
        categoryId: spec.body.categoryId ?? null,
        channel: spec.body.channel ?? null,
        campaignId: spec.body.campaignId ?? null,
        priority: spec.body.priority ?? 0,
        effectiveFrom: new Date(spec.body.effectiveFrom),
        effectiveUntil: spec.body.effectiveUntil ? new Date(spec.body.effectiveUntil) : null,
        metadata: spec.body.metadata ?? {},
        createdByActorId: actorId,
        changeReason: spec.body.changeReason,
      },
      spec.body.lines.map((line) => ({
        lineType: line.lineType as any,
        destinationType: line.destinationType as any,
        destinationKey: line.destinationKey ?? null,
        regionalOriginBasis: (line.regionalOriginBasis as any) ?? null,
        regionalLevel: (line.regionalLevel as any) ?? null,
        bps: line.bps ?? null,
        fixedAmountCents: line.fixedAmountCents ?? null,
        appliesTo: line.appliesTo as any,
        conditionType: line.conditionType ?? null,
        conditionJson: line.conditionJson ?? {},
        priority: line.priority ?? 0,
        metadata: line.metadata ?? {},
      }))
    );

    console.log(`✅ '${code}' criada — id=${policy.id} version=${policy.version} status=${policy.status} (${lines.length} linhas)`);
    results.push({ code, status: 'created', policyId: policy.id });
  }

  // ── PROVA DE LEITURA — mesmo reader governado da rota GET /economy/admin/policies ──
  console.log('\n📖 Read-back via economicPolicyRepository.listPoliciesForTenant (mesmo reader do GET admin):');
  const all = await economicPolicyRepository.listPoliciesForTenant(tenantId);
  for (const p of all) {
    if (!specs.some((s) => s.body.policyCode === p.policyCode)) continue;
    const lines = await economicPolicyRepository.findPolicyLines(tenantId, p.id);
    console.log(`\n— ${p.policyCode} v${p.version} [${p.status}] moduleContext=${p.moduleContext} vertical=${p.vertical ?? '(null)'}`);
    console.log(`  country=${p.countryId ?? '(null)'} state=${p.stateId ?? '(null)'} city=${p.cityId ?? '(null)'}`);
    for (const l of lines) {
      console.log(
        `  · ${l.lineType} → ${l.destinationType} bps=${l.bps} appliesTo=${l.appliesTo}` +
          (l.regionalOriginBasis ? ` basis=${l.regionalOriginBasis}` : '') +
          (l.regionalLevel ? ` level=${l.regionalLevel}` : '')
      );
    }
  }

  console.log('\n── RESUMO ──');
  for (const r of results) {
    console.log(`  ${r.status === 'created' ? '✅ criada' : '⏭️  já existia'} — ${r.code}${r.policyId ? ` (${r.policyId})` : ''}`);
  }

  await pool.end();
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.message ?? e);
  try {
    await pool.end();
  } catch {
    /* noop */
  }
  process.exit(1);
});
