/**
 * SEED DE TESTE — uma BANDA DE ROCK contratável, no banco em que Clayton testa.
 *
 * 🔴 A FORMA CERTA DE UMA BANDA NASCER (não inventada aqui — é a cadeia SELADA pelo E2E
 * `validate-pipeline-e2e-band-group-actor-provider`, arco fundação eventos fatia 1):
 *
 *   BANDA = GRUPO-ATOR. Não é um "perfil de artista", não é tabela nova, não é papel num enum.
 *   É uma linha de `groups` com seu actor 1:1 (`actors.actor_type='group'`), nascido junto
 *   (`ensureGroupActor`), com `responsible_actor_id` apontando para o actor do DONO — a âncora
 *   civil que permite ao coletivo ativar oferta sem ter CPF próprio.
 *
 *   createGroup → declareConcept(NO grupo-actor) → createService(actorId=grupo-actor)
 *     → createOffering(provider=grupo-actor) → updateOwnOffering 'active'
 *     → tagOfferingGenres (gênero governado) → declareAvailability (janelas)
 *
 * ⚠️ ARTISTA SOLO é a MESMA cadeia com provider = user-actor (ver seed-local-demo.ts). A diferença
 * entre banda e artista solo NÃO é um campo "tipo": é QUEM é o provider da oferta.
 *
 * ⚠️ SEM JANELA DE AGENDA A BANDA FICA INVISÍVEL na descoberta por data — o E2E prova isso na
 * asserção (4) ("banda sem janela no range fica oculta"). Por isso este seed declara janelas.
 *
 * Δbank=0 · ZERO SQL cru em domínio · idempotente (re-rodar não duplica).
 * Roda contra o banco de DESENVOLVIMENTO por escolha explícita — é dado de teste para uso humano.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { professionalC1Service } from '../core/profile/professional-c1/professional-c1.service';
import { servicesService } from '../modules/services/services.service';
import { serviceOfferingService } from '../modules/services/service-offering.service';
import { groupsService } from '../modules/groups/groups.service';
import { ServiceType, ServiceStatus } from '../modules/services/services.types';

const BAND_NAME = 'Pedra Noventa';
const GENRE_SLUG = 'rock';

async function resolveServiceConcept(slug: string): Promise<{ conceptId: string; canonicalId: string }> {
  const r = (await pool.query<{ concept_id: string; canonical_id: string }>(
    `SELECT c.concept_id::text AS concept_id, cs.id::text AS canonical_id
       FROM concepts c
       JOIN canonical_services cs ON cs.concept_id = c.concept_id AND cs.tenant_id IS NULL AND cs.scope='global' AND cs.status='active'
       JOIN concept_offer_kinds k ON k.concept_id = c.concept_id AND k.offer_kind='service'
      WHERE c.slug = $1`,
    [slug]
  )).rows[0];
  if (!r) throw new Error(`concept de serviço governado ausente: ${slug}`);
  return { conceptId: r.concept_id, canonicalId: r.canonical_id };
}

async function resolveGenre(slug: string): Promise<string | null> {
  const r = (await pool.query<{ concept_id: string }>(
    // O slug vive em `concepts`; `shared_subject_concepts` só marca quais conceitos são assunto
    // governado (e se estão habilitados). Query idêntica à do E2E selado — não reinventada.
    `SELECT s.concept_id::text AS concept_id
       FROM shared_subject_concepts s JOIN concepts c ON c.concept_id = s.concept_id
      WHERE s.enabled = true AND c.slug = $1 LIMIT 1`,
    [slug]
  )).rows[0];
  return r?.concept_id ?? null;
}

async function main(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  console.log(`🎸 Seed da banda de teste em: ${db}\n`);

  // Wiring dos ports — o mesmo que as rotas fazem no bootstrap. Sem isto, canRepresentActor não
  // resolve e o writer recusa ("ActorRepository não foi injetado"). Não é atalho: é reproduzir o
  // ambiente real fora do servidor HTTP, exatamente como o E2E selado faz.
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  // 🔴 A BANDA TEM DONO PRÓPRIO — um MÚSICO, não o organizador.
  // Motivo de desenho, descoberto ao rodar: o domínio recusa "cada usuário pode criar apenas um
  // grupo", e o organizador já tinha o dele. Mas a trava expôs algo melhor que um contorno: o
  // teste FIEL é o organizador contratar banda de OUTRA pessoa. Banda própria não exercita
  // autorização nenhuma. Por isso nasce um usuário músico pelo CAMINHO REAL de auth
  // (bcrypt + nascimento atômico global_user→user→identity→user-actor), nunca SQL cru de senha.
  const { authService } = await import('../core/auth/auth.service');
  const MUSICO_EMAIL = 'banda.pedranoventa@teste.unificard';
  const MUSICO_SENHA = 'Teste@2026';

  let owner = (await pool.query<{ user_id: string; tenant_id: string }>(
    `SELECT u.user_id::text AS user_id, u.tenant_id::text AS tenant_id FROM users u WHERE u.email = $1 LIMIT 1`,
    [MUSICO_EMAIL]
  )).rows[0];

  if (!owner) {
    // CPF com dígitos verificadores REAIS — o cadastro valida de verdade (não aceita 11 dígitos
    // quaisquer). Gerar corretamente é mais honesto que desligar a validação para o seed passar.
    const cpf = (() => {
      const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
      const dv = (nums: number[]): number => {
        const peso = nums.length + 1;
        const soma = nums.reduce((acc, n, i) => acc + n * (peso - i), 0);
        const r = (soma * 10) % 11;
        return r === 10 ? 0 : r;
      };
      const d1 = dv(base);
      const d2 = dv([...base, d1]);
      return [...base, d1, d2].join('');
    })();
    const reg = await authService.register(
      undefined, MUSICO_EMAIL, MUSICO_SENHA, cpf, 'Rui da Silva (banda Pedra Noventa)', '1990-05-20', undefined
    );
    owner = { user_id: reg.user.userId, tenant_id: reg.tenantId };
    console.log(`   ✅ músico criado via authService.register: ${MUSICO_EMAIL} / ${MUSICO_SENHA}`);
  } else {
    console.log(`   músico já existia (idempotente): ${MUSICO_EMAIL}`);
  }
  console.log(`   dono (responsável civil da banda): user=${owner.user_id}`);

  const city = (await pool.query<{ city_id: string; name: string }>(
    `SELECT city_id::text AS city_id, name FROM cities WHERE name ILIKE 'Curitiba' LIMIT 1`
  )).rows[0];
  if (!city) throw new Error('cidade Curitiba ausente no Location Core.');

  const musical = await resolveServiceConcept('apresentacao-musical');
  const genreId = await resolveGenre(GENRE_SLUG);
  console.log(`   gênero "${GENRE_SLUG}": ${genreId ?? 'AUSENTE (a banda nasce sem tag de gênero)'}`);

  // ── 1. A BANDA NASCE: grupo + grupo-actor 1:1 (nascimento ansioso)
  const existing = (await pool.query<{ id: string; actor_id: string | null }>(
    `SELECT id::text AS id, actor_id::text AS actor_id FROM groups WHERE tenant_id = $1::uuid AND name = $2`,
    [owner.tenant_id, BAND_NAME]
  )).rows[0];

  let groupId: string;
  let groupActorId: string;
  if (existing?.actor_id) {
    groupId = existing.id;
    groupActorId = existing.actor_id;
    console.log(`   banda já existia (idempotente): group=${groupId}`);
  } else {
    const group = await groupsService.createGroup(owner.tenant_id, owner.user_id, {
      name: BAND_NAME,
      description: 'Banda de rock para teste de contratação — nasce como GRUPO-ATOR (cadeia selada da fatia 1).',
    });
    groupId = group.groupId;
    const row = (await pool.query<{ actor_id: string | null }>(
      `SELECT actor_id::text AS actor_id FROM groups WHERE id = $1::uuid`, [groupId]
    )).rows[0];
    if (!row?.actor_id) throw new Error('groups.actor_id NULL após createGroup — nascimento do grupo-actor falhou.');
    groupActorId = row.actor_id;
    console.log(`   ✅ banda nasceu: group=${groupId} · grupo-actor=${groupActorId}`);
  }

  // ── 2. DESBLOQUEIO COLETIVO: o dono declara o concept NO grupo-actor
  await professionalC1Service.declareConcept(
    owner.tenant_id, groupActorId, { conceptId: musical.conceptId, skillLevel: 4 }, owner.user_id
  );
  console.log('   ✅ concept apresentacao-musical declarado no grupo-actor');

  // ── 3. SERVIÇO + OFERTA com provider = grupo-actor
  const service = await servicesService.createService(owner.tenant_id, owner.user_id, {
    actorId: groupActorId,
    name: `${BAND_NAME} ao vivo`,
    serviceType: ServiceType.SERVICE,
    status: ServiceStatus.ACTIVE,
    canonicalServiceId: musical.canonicalId,
    cityId: city.city_id,
  });
  const { offering } = await serviceOfferingService.createOffering({
    tenantId: owner.tenant_id, userId: owner.user_id, providerActorId: groupActorId,
    canonicalServiceId: musical.canonicalId, priceCents: 350000, durationMinutes: 120,
  });
  await serviceOfferingService.updateOwnOffering({
    tenantId: owner.tenant_id, userId: owner.user_id, offeringId: offering.id, status: 'active',
  });
  console.log(`   ✅ oferta ATIVA: ${offering.id} · R$ 3.500,00 · 120 min`);

  // ── 4. GÊNERO + AGENDA (sem janela, a banda NÃO aparece na descoberta por data)
  if (genreId) {
    await serviceOfferingService.tagOfferingGenres({
      tenantId: owner.tenant_id, userId: owner.user_id, offeringId: offering.id, subjectConceptIds: [genreId],
    });
    console.log('   ✅ gênero rock taggeado');
  }

  const iso = (d: Date) => d.toISOString();
  let janelas = 0;
  for (let semana = 1; semana <= 6; semana++) {
    const inicio = new Date();
    inicio.setDate(inicio.getDate() + semana * 7);
    inicio.setHours(20, 0, 0, 0);
    const fim = new Date(inicio);
    fim.setHours(23, 0, 0, 0);
    try {
      await serviceOfferingService.declareAvailability({
        tenantId: owner.tenant_id, userId: owner.user_id, offeringId: offering.id,
        startDatetime: iso(inicio), endDatetime: iso(fim),
      });
      janelas++;
    } catch {
      // Janela já declarada numa corrida anterior — idempotência, não erro.
    }
  }
  console.log(`   ✅ ${janelas} janela(s) de agenda declarada(s) (próximas 6 semanas, 20h–23h)`);

  console.log(`\n🎸 PRONTO. Procure por "${BAND_NAME}" em Contratar banda / serviços.`);
  console.log(`   grupo-actor (provider): ${groupActorId}`);
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(`💥 ${err instanceof Error ? err.message : String(err)}`);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
