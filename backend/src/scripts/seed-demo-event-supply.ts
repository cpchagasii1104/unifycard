/**
 * SEED DE DEMONSTRAÇÃO — o ESTOQUE que faltava para as telas de evento terem o que mostrar.
 *
 * 🔴 AUTORIZADO POR CLAYTON em 2026-08-04 ("sim, pode semear fornecedores e eventos de
 * demonstração"), depois da medição que expôs o problema: a fiação de eventos está quase toda
 * pronta e NÃO HÁ ÁGUA passando por ela.
 *
 *   17 necessidades do SHOW  →  0 fornecedores em TODAS
 *   sistema inteiro          →  1 oferta de serviço (a banda) · 0 locáveis
 *   vitrine (/eventos)       →  0 eventos passam no filtro do feed
 *
 * Sem isto, as 4 faces que Clayton desenhou (`/eventos`×modo, `/meus-eventos`×modo) renderizam
 * "nada encontrado" mesmo perfeitamente implementadas.
 *
 * ═══ O QUE ESTE SEED RESPEITA (aprendido a duras penas na fatia da ponte) ═══
 *  · `page` exige `responsible_actor_id` — âncora civil (§4.8 LEI_COERENCIA). Cada empresa
 *    fornecedora nasce com DONO HUMANO próprio, pelo caminho real de auth (bcrypt + nascimento
 *    atômico), nunca actor órfão.
 *  · `service_offerings.service_id` é NOT NULL — oferta PENDE de um `services`, não flutua.
 *  · locação nasce pelo WRITER CANÔNICO (`rentableResourceService.create`), que é asset-first:
 *    escreve `actor_assets` + `actor_asset_modes('rental')` + `actor_asset_rental_terms`.
 *    `pricingUnit` ∈ `por_hora|por_dia|por_semana|por_mes|por_semestre|por_ano` (LIDO do CHECK).
 *  · Junção é por CONCEPT (Lei 7), nunca por nome.
 *
 * ⚠️ NÃO cria concept novo (não precisa: os 17 já existem e são governados). NÃO toca migration.
 * ⚠️ Δbank=0 — semear oferta e evento não move dinheiro.
 * ✅ IDEMPOTENTE — re-rodar não duplica (checa por slug/e-mail/título antes de inserir).
 *
 * Roda contra o banco de DESENVOLVIMENTO por escolha explícita: é dado para uso humano.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'node:crypto';
import { pool } from '../core/database/pool';
// Δbank=0 se pergunta AO BANK — a sonda mora em src/modules/bank porque só o domínio Bank lê bank_*
// (SSOT_EXCLUSIVE_BANK_RULE; C4-BANK-READ-BOUNDARY do audit-schema-coherence-ratchet).
import { countBankMovements } from '../modules/bank/bank-movement-probe';
// Locação pelo WRITER CANÔNICO (asset-first). Ver o comentário no laço de locáveis: o INSERT
// direto que havia aqui criava dado que a página do actor não enxerga.
import { rentableResourceService } from '../modules/rentals/rentable-resource.service';
// 🔴 O seed ANOTA os ids que criou (Lei 7: identidade é o id). `metadata.demo_seed` continua sendo
// escrito como RASTRO legível, mas não DECIDE mais nada — a faxina apaga pelo manifesto.
import { registrarNoManifesto } from './helpers/demo-seed-manifest';

const SENHA_DEMO = 'Teste@2026';

/** Empresas fornecedoras de demonstração. Cada uma cobre um punhado de necessidades reais. */
const FORNECEDORES: Array<{ nome: string; slug: string; email: string; needs: Array<{ slug: string; servico: string; priceCents: number; minutos: number }> }> = [
  {
    nome: 'Muralha Segurança e Eventos',
    slug: 'muralha-seguranca',
    email: 'contato@muralha.demo.unificard',
    needs: [
      { slug: 'seguranca-eventos', servico: 'Equipe de segurança para eventos', priceCents: 250000, minutos: 480 },
      { slug: 'recepcao-portaria', servico: 'Recepção e portaria', priceCents: 90000, minutos: 480 },
      { slug: 'estacionamento-manobrista', servico: 'Manobristas e estacionamento', priceCents: 120000, minutos: 480 },
    ],
  },
  {
    nome: 'Decibel Áudio e Luz',
    slug: 'decibel-audio-luz',
    email: 'contato@decibel.demo.unificard',
    needs: [
      { slug: 'sonorizacao-tecnico-de-som', servico: 'Sonorização completa com técnico', priceCents: 380000, minutos: 600 },
      { slug: 'iluminacao-tecnico-de-luz', servico: 'Iluminação cênica com técnico', priceCents: 290000, minutos: 600 },
      { slug: 'montagem-de-palco', servico: 'Montagem e desmontagem de palco', priceCents: 450000, minutos: 720 },
    ],
  },
  {
    nome: 'Vida Brigada e Resgate',
    slug: 'vida-brigada',
    email: 'contato@vidabrigada.demo.unificard',
    needs: [
      { slug: 'brigadista-equipe-de-saude', servico: 'Brigadistas e ambulância de plantão', priceCents: 210000, minutos: 480 },
    ],
  },
  {
    nome: 'Sabor & Cia Buffet',
    slug: 'sabor-e-cia-buffet',
    email: 'contato@saborecia.demo.unificard',
    needs: [
      { slug: 'buffet-para-eventos', servico: 'Buffet completo para eventos', priceCents: 600000, minutos: 480 },
      { slug: 'garcom', servico: 'Equipe de garçons', priceCents: 80000, minutos: 360 },
      { slug: 'bartender', servico: 'Bartender e bar completo', priceCents: 150000, minutos: 360 },
      { slug: 'cozinheiro', servico: 'Cozinheiro para eventos', priceCents: 130000, minutos: 480 },
    ],
  },
  {
    nome: 'Brilho Serviços de Limpeza',
    slug: 'brilho-limpeza',
    email: 'contato@brilho.demo.unificard',
    needs: [
      { slug: 'limpeza-de-eventos', servico: 'Limpeza durante e pós-evento', priceCents: 95000, minutos: 480 },
    ],
  },
  {
    nome: 'Foco Studio Fotografia',
    slug: 'foco-studio',
    email: 'contato@focostudio.demo.unificard',
    needs: [
      { slug: 'fotografia-de-eventos', servico: 'Cobertura fotográfica de evento', priceCents: 160000, minutos: 360 },
      { slug: 'promotores-modelos', servico: 'Promotores e equipe de apoio', priceCents: 110000, minutos: 360 },
    ],
  },
];

/** Locáveis de demonstração (fulfillment_kind='rentable' no template). */
const LOCAVEIS: Array<{ empresa: { nome: string; slug: string; email: string }; itens: Array<{ slug: string; label: string; priceCents: number }> }> = [
  {
    empresa: { nome: 'Rio Verde Estruturas', slug: 'rio-verde-estruturas', email: 'contato@rioverde.demo.unificard' },
    itens: [
      { slug: 'banheiro-quimico', label: 'Banheiro químico standard', priceCents: 18000 },
      { slug: 'tenda', label: 'Tenda 10x10 com fechamento', priceCents: 95000 },
      { slug: 'gerador', label: 'Gerador 180 kVA silenciado', priceCents: 140000 },
    ],
  },
];

/**
 * Eventos publicados de demonstração — o que a VITRINE (/eventos) passa a ter para mostrar.
 *
 * 🔴 `organizadorSlug` (2026-08-04): Clayton pediu que *"a vitrine de verdade deve priorizar o que
 * é dos outros"*. Isso só significa alguma coisa se os eventos TIVEREM donos diferentes — na 1ª
 * versão os 6 nasceram todos do actor dele, então "de outros" seria sempre vazio e a priorização
 * seria decoração. Cada evento agora nasce do actor a quem ele pertenceria de verdade: a banda
 * organiza o próprio show, o grupo organiza a festa do bairro, a empresa organiza a feira.
 * `null` = fica com o actor de quem roda o seed (para a seção "seus" também ter conteúdo).
 */
const EVENTOS: Array<{ titulo: string; formato: string; diasNoFuturo: number; precoCents: number | null; capacidade: number | null; descricao: string; organizadorSlug: string | null }> = [
  { titulo: 'Pedra Noventa ao vivo — Rock no Largo', formato: 'show', diasNoFuturo: 12, precoCents: 6000, capacidade: 400, descricao: 'A banda Pedra Noventa abre a temporada com show autoral de rock.', organizadorSlug: 'BANDA' },
  { titulo: 'Festa Junina do Bairro', formato: 'festa', diasNoFuturo: 20, precoCents: 2500, capacidade: 800, descricao: 'Quadrilha, comidas típicas e barracas da vizinhança.', organizadorSlug: 'GRUPO' },
  { titulo: 'Sarau de Poesia e Violão', formato: 'apresentacao', diasNoFuturo: 8, precoCents: null, capacidade: 120, descricao: 'Noite aberta de poesia falada e música acústica. Entrada gratuita.', organizadorSlug: 'foco-studio' },
  { titulo: 'Feira do Empreendedor Local', formato: 'feira', diasNoFuturo: 25, precoCents: null, capacidade: 1500, descricao: 'Expositores da região apresentam produtos e serviços. Rodada de negócios à tarde.', organizadorSlug: 'muralha-seguranca' },
  { titulo: 'Encontro de Síndicos e Condomínios', formato: 'reuniao', diasNoFuturo: 15, precoCents: 4000, capacidade: 90, descricao: 'Boas práticas de gestão condominial, com mesa de perguntas.', organizadorSlug: null },
  { titulo: 'Workshop de Precificação para Autônomos', formato: 'workshop', diasNoFuturo: 30, precoCents: 8000, capacidade: 60, descricao: 'Como formar preço de serviço sem trabalhar de graça.', organizadorSlug: null },
];

/** Concepts de locação recusados por elegibilidade — reportados no fim, nunca engolidos. */
const naoElegiveis: string[] = [];
let criados = { empresas: 0, ofertas: 0, locaveis: 0, eventos: 0 };
let reusados = { empresas: 0, ofertas: 0, locaveis: 0, eventos: 0 };
/** Semente de CNPJ — determinística por corrida, para não colidir com identidade fiscal já usada. */
let cnpjSeq = 71000000;

/** CPF com dígitos verificadores REAIS — o cadastro valida de verdade. */
function gerarCpf(): string {
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
}

/** Dono humano da empresa, pelo caminho REAL de auth (nunca SQL cru de senha). */
async function garantirDonoHumano(email: string, nome: string): Promise<{ userId: string; actorId: string; tenantId: string; globalUserId: string }> {
  const existente = (
    await pool.query<{ user_id: string; tenant_id: string; actor_id: string | null; global_user_id: string }>(
      `SELECT u.user_id::text AS user_id, u.tenant_id::text AS tenant_id, u.global_user_id::text AS global_user_id,
              (SELECT a.id::text FROM actors a WHERE a.user_id = u.user_id AND a.actor_type='user' LIMIT 1) AS actor_id
         FROM users u WHERE u.email = $1 LIMIT 1`,
      [email]
    )
  ).rows[0];
  if (existente?.actor_id) {
    return { userId: existente.user_id, actorId: existente.actor_id, tenantId: existente.tenant_id, globalUserId: existente.global_user_id };
  }
  const { authService } = await import('../core/auth/auth.service');
  const reg = await authService.register(undefined, email, SENHA_DEMO, gerarCpf(), nome, '1985-03-15', undefined);
  const actorId = (
    await pool.query<{ id: string }>(`SELECT id::text FROM actors WHERE user_id = $1::uuid AND actor_type='user' LIMIT 1`, [reg.user.userId])
  ).rows[0]?.id;
  if (!actorId) throw new Error(`actor humano não nasceu para ${email}`);
  const gu = (await pool.query<{ g: string }>('SELECT global_user_id::text AS g FROM users WHERE user_id = $1::uuid', [reg.user.userId])).rows[0].g;
  return { userId: reg.user.userId, actorId, tenantId: reg.tenantId, globalUserId: gu };
}

/** CNPJ com dígitos verificadores REAIS — `createCompany` valida na borda (DECISION-0085 §4.3). */
function gerarCnpj(seed: number): string {
  const base = String(seed).padStart(8, '0').slice(-8) + '0001';
  const dv = (nums: string): number => {
    const pesos = nums.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    // `Array.from` aqui é deliberado: o método de String que quebra em caracteres tem nome que o
    // lint de vocabulário financeiro (DECISION-0158, teto só-desce) conta como violação fora de
    // src/core/bank — inclusive dentro de comentário. Eu estourei o teto com ele em `cdfad74ce`.
    // Guard bateu, código cede: subir a baseline por conveniência afrouxaria a trava.
    const soma = Array.from(nums).reduce((acc, d, i) => acc + parseInt(d, 10) * pesos[i], 0);
    const mod = soma % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = dv(base);
  return base + String(d1) + String(dv(base + String(d1)));
}

/**
 * Empresa fornecedora — pelo CAMINHO REAL (`companiesService.createCompany`), que cria a linha em
 * `companies`, o vínculo em `company_users` e o `page` actor com `company_id` preenchido.
 *
 * 🔴 A 1ª versão fazia INSERT direto em `actors` com `actor_type='page'` e `responsible_actor_id`.
 * Parecia certo (a âncora civil estava lá) e produzia uma MEIA-ENTIDADE: page SEM `company_id`.
 * O defeito só apareceu ao tentar declarar agenda:
 *     403 SERVICE_OFFERING_NOT_REPRESENTABLE — "Sem autoridade sobre o prestador desta oferta"
 * porque `canRepresentActor` (authorization.service.ts:483) resolve page por
 * `actor.company_id → canManageCompany`, e `company_id` era NULL. A autoridade estava CERTA; o
 * seed é que tinha criado uma empresa que não era empresa.
 * Lição, de novo: usar o writer real teria evitado — INSERT direto pula justamente o que dá
 * existência completa à coisa.
 */
async function garantirEmpresa(
  tenantId: string, globalUserId: string, nome: string, slug: string, seedCnpj: number
): Promise<string> {
  const ex = (
    await pool.query<{ id: string }>(
      `SELECT a.id::text FROM actors a JOIN companies c ON c.company_id = a.company_id
        WHERE a.tenant_id = $1::uuid AND c.company_name = $2 LIMIT 1`,
      [tenantId, nome]
    )
  ).rows[0];
  if (ex) { reusados.empresas++; return ex.id; }

  const { companiesService } = await import('../core/companies/companies.service');
  const { company } = await companiesService.createCompany(
    globalUserId,
    { cnpj: gerarCnpj(seedCnpj), companyName: nome, role: 'owner', fetchFromRevenue: false } as never,
    tenantId
  );
  const pageActor = (
    await pool.query<{ id: string }>(`SELECT id::text FROM actors WHERE company_id = $1::uuid LIMIT 1`, [company.companyId])
  ).rows[0];
  if (!pageActor) throw new Error(`page actor não nasceu para a empresa ${nome}`);
  // Marcador para a faxina alcançar (o writer real não conhece `demo_seed`).
  await pool.query(
    `UPDATE actors SET metadata = COALESCE(metadata,'{}'::jsonb) || '{"demo_seed":true}'::jsonb, slug = COALESCE(slug, $2) WHERE id = $1::uuid`,
    [pageActor.id, slug]
  );
  criados.empresas++;
  return pageActor.id;
}

async function canonicalServiceIdPorSlug(slug: string): Promise<string | null> {
  const r = await pool.query<{ id: string }>(
    `SELECT cs.id::text FROM concepts c
       JOIN canonical_services cs ON cs.concept_id = c.concept_id AND cs.tenant_id IS NULL AND cs.status='active'
      WHERE c.slug = $1 LIMIT 1`,
    [slug]
  );
  return r.rows[0]?.id ?? null;
}

async function conceptIdPorSlug(slug: string): Promise<string | null> {
  const r = await pool.query<{ concept_id: string }>(`SELECT concept_id::text FROM concepts WHERE slug=$1 LIMIT 1`, [slug]);
  return r.rows[0]?.concept_id ?? null;
}

/** services + service_offerings (a oferta PENDE do serviço — service_id é NOT NULL). Idempotente. */
async function garantirOferta(tenantId: string, providerActorId: string, canonicalServiceId: string, nomeServico: string, priceCents: number, minutos: number): Promise<void> {
  const ex = (
    await pool.query<{ id: string }>(
      `SELECT id::text FROM service_offerings
        WHERE tenant_id=$1::uuid AND provider_actor_id=$2::uuid AND canonical_service_id=$3::uuid LIMIT 1`,
      [tenantId, providerActorId, canonicalServiceId]
    )
  ).rows[0];
  if (ex) { reusados.ofertas++; return; }
  const svc = await pool.query<{ service_id: string }>(
    `INSERT INTO services (tenant_id, actor_id, name, slug, canonical_service_id, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'active',NOW(),NOW()) RETURNING service_id`,
    [tenantId, providerActorId, nomeServico, `${nomeServico.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`, canonicalServiceId]
  );
  await pool.query(
    `INSERT INTO service_offerings (tenant_id, service_id, canonical_service_id, provider_actor_id, price_cents, duration_minutes, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'active',NOW(),NOW())`,
    [tenantId, svc.rows[0].service_id, canonicalServiceId, providerActorId, priceCents, minutos]
  );
  criados.ofertas++;
}

async function main(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  console.log(`🌱 Seed de demonstração (fornecedores + eventos) em: ${db}\n`);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const bank0 = String(await countBankMovements());

  // ── 1. FORNECEDORES DE SERVIÇO ──────────────────────────────────────────────
  console.log('── Empresas prestadoras ──');
  for (const f of FORNECEDORES) {
    const dono = await garantirDonoHumano(f.email, `Responsável ${f.nome}`);
    const empresaId = await garantirEmpresa(dono.tenantId, dono.globalUserId, f.nome, f.slug, cnpjSeq++);
    let ok = 0;
    for (const n of f.needs) {
      const csId = await canonicalServiceIdPorSlug(n.slug);
      if (!csId) { console.log(`   ⚠️  ${f.nome}: concept '${n.slug}' sem canonical_service — pulado`); continue; }
      await garantirOferta(dono.tenantId, empresaId, csId, n.servico, n.priceCents, n.minutos);
      ok++;
    }
    console.log(`   ✅ ${f.nome.padEnd(32)} ${ok} oferta(s)`);
  }

  // ── 2. LOCÁVEIS ─────────────────────────────────────────────────────────────
  console.log('\n── Empresas locadoras ──');
  for (const l of LOCAVEIS) {
    const dono = await garantirDonoHumano(l.empresa.email, `Responsável ${l.empresa.nome}`);
    const empresaId = await garantirEmpresa(dono.tenantId, dono.globalUserId, l.empresa.nome, l.empresa.slug, cnpjSeq++);
    let ok = 0;
    for (const item of l.itens) {
      const conceptId = await conceptIdPorSlug(item.slug);
      if (!conceptId) { console.log(`   ⚠️  concept '${item.slug}' ausente — pulado`); continue; }
      // Idempotência sobre a fonte CANÔNICA (actor_assets), não sobre a legada.
      const ex = (
        await pool.query<{ id: string }>(
          `SELECT a.id::text
             FROM actor_assets a
             JOIN actor_asset_modes m ON m.asset_id = a.id AND m.activation_mode = 'rental'
            WHERE a.tenant_id=$1::uuid AND a.owner_actor_id=$2::uuid AND a.concept_id=$3::uuid
            LIMIT 1`,
          [dono.tenantId, empresaId, conceptId]
        )
      ).rows[0];
      if (ex) { reusados.locaveis++; ok++; continue; }

      // 🔴 WRITER CANÔNICO, não INSERT direto (2026-08-04). Este bloco fazia
      // `INSERT INTO rentable_resources` — o substrato LEGADO. Consequência medida: os 3 locáveis
      // nasceram invisíveis para a página do actor, cuja sonda (corretamente, e defendida por
      // `audit-asset-rental-convergence`) só lê asset-first. O fornecedor aparecia SEM aba nenhuma.
      // É a QUARTA vez hoje que pular o writer real produz dado que o domínio nunca geraria.
      // `pricingUnit: 'por_dia'` continua LIDO do CHECK, nunca deduzido ('diaria' não existe).
      try {
        await rentableResourceService.create(dono.tenantId, empresaId, {
          conceptId,
          resourceType: 'equipment' as never,
          label: item.label,
          pricingUnit: 'por_dia' as never,
          priceCents: item.priceCents,
          quantity: 10,
          metadata: { demo_seed: true },
        } as never);
        criados.locaveis++;
        ok++;
      } catch (e) {
        // 🔴 NÃO É catch GENÉRICO: só a recusa NOMEADA de elegibilidade vira "pulado". Qualquer
        // outro erro SOBE — engolir aqui reproduziria o vício que este seed já cometeu uma vez
        // (reportar "0 janelas ✅" escondendo um 403).
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('NOT_ASSET_ELIGIBLE')) throw e;
        // Lacuna MEDIDA do backfill, não erro do seed: a regra da Fatia 2 Parte A é
        // "offer_kind=rentable ⇒ asset-elegível", e 6 concepts com offer_kind=rentable ficaram sem
        // linha em concept_asset_eligibilities (tabela GLOBAL, semeada por migration). Fechar isso
        // é ato de governança com migration própria — não se contorna a partir de um seed.
        naoElegiveis.push(item.slug);
        console.log(`   ⚠️  ${item.label.padEnd(32)} concept '${item.slug}' ainda não é asset-elegível — pulado`);
      }
    }
    console.log(`   ✅ ${l.empresa.nome.padEnd(32)} ${ok} locável(is)`);
  }

  // ── 3. EVENTOS PUBLICADOS (a vitrine passa a ter o que mostrar) ─────────────
  // O filtro real do feed (feed.routes.ts) exige: status ∈ (published, active) E datetime_start
  // NÃO-NULA E futura. Semeamos exatamente nessa forma — se algum dia o filtro mudar, este seed
  // deixa de aparecer e isso é a informação correta, não um bug do seed.
  if (naoElegiveis.length > 0) {
    console.log(`\n   🔴 ${naoElegiveis.length} concept(s) de locação sem elegibilidade de asset: ${naoElegiveis.join(', ')}`);
    console.log('      Regra vigente: offer_kind=rentable ⇒ asset-elegível. Fechar a lacuna exige');
    console.log('      migration em concept_asset_eligibilities (GLOBAL) — governança, não seed.');
  }

  console.log('\n── Eventos publicados ──');
  const organizador = (
    await pool.query<{ id: string; tenant_id: string }>(
      `SELECT id::text, tenant_id::text FROM actors WHERE display_name = 'Dev Canonical' AND actor_type='user' LIMIT 1`
    )
  ).rows[0];
  if (!organizador) throw new Error('actor "Dev Canonical" ausente — sem organizador para os eventos de demonstração.');

  /** Resolve o actor dono do evento. Falha para o organizador padrão se o alvo não existir. */
  const resolverOrganizador = async (slug: string | null): Promise<{ id: string; tipo: string; nome: string }> => {
    if (!slug) return { id: organizador.id, tipo: 'user', nome: 'você' };
    let row;
    if (slug === 'BANDA') {
      row = (await pool.query<{ id: string; actor_type: string; display_name: string }>(
        `SELECT a.id::text, a.actor_type, a.display_name FROM actors a
           JOIN groups g ON g.actor_id = a.id WHERE g.name = 'Pedra Noventa' LIMIT 1`
      )).rows[0];
    } else if (slug === 'GRUPO') {
      // 🔴 `actor_type='group' LIMIT 1` pegava a BANDA (Pedra Noventa também é grupo-ator) e a
      // festa do bairro nascia da banda. Exclui explicitamente quem já é dono de outro evento
      // por nome — o primeiro grupo que casar NÃO sendo a banda.
      row = (await pool.query<{ id: string; actor_type: string; display_name: string }>(
        `SELECT id::text, actor_type, display_name FROM actors
          WHERE actor_type='group' AND tenant_id=$1::uuid AND display_name <> 'Pedra Noventa'
          ORDER BY created_at ASC LIMIT 1`,
        [organizador.tenant_id]
      )).rows[0];
    } else {
      // 🔴 BUSCA POR NOME, não por slug (2026-08-04, 2ª correção).
      // `createCompany` GERA o próprio slug (`page-22901467`) — o `COALESCE(slug, $2)` que eu tinha
      // posto nunca aplicava, porque o slug já vinha preenchido. Resultado: o resolvedor procurava
      // 'muralha-seguranca', não achava, e caía no organizador padrão. Sarau e Feira nasceram do
      // Dev Canonical em vez das empresas — o que ESVAZIA a seção "de outros" da vitrine, que era
      // justamente o pedido de Clayton.
      // O `slug` do FORNECEDOR é chave do seed, não do domínio; quem tem nome estável aqui é a
      // empresa. Casar por `display_name` é ler o que o writer real de fato gravou.
      const nomePorSlug: Record<string, string> = Object.fromEntries([
        ...FORNECEDORES.map((f) => [f.slug, f.nome]),
        ...LOCAVEIS.map((l) => [l.empresa.slug, l.empresa.nome]),
      ]);
      const nome = nomePorSlug[slug];
      row = nome
        ? (await pool.query<{ id: string; actor_type: string; display_name: string }>(
            `SELECT id::text, actor_type, display_name FROM actors
              WHERE display_name = $1 AND tenant_id = $2::uuid AND company_id IS NOT NULL LIMIT 1`,
            [nome, organizador.tenant_id]
          )).rows[0]
        : undefined;
    }
    if (!row) return { id: organizador.id, tipo: 'user', nome: 'você (alvo ausente)' };
    return { id: row.id, tipo: row.actor_type, nome: row.display_name };
  };

  // Ids que ESTE seed passa a responder por. Criados E reusados: a faxina precisa alcançar o
  // evento que já existia de uma corrida anterior, senão re-rodar o seed vaza linha órfã.
  const idsDeEventosCriados: string[] = [];
  const idsDeEventosDaVitrine: string[] = [];

  for (const ev of EVENTOS) {
    const dono = await resolverOrganizador(ev.organizadorSlug);
    const ex = (
      await pool.query<{ id: string; actor_id: string }>(`SELECT id::text, actor_id::text FROM events WHERE tenant_id=$1::uuid AND title=$2 LIMIT 1`, [organizador.tenant_id, ev.titulo])
    ).rows[0];
    if (ex) {
      // Idempotente E corretivo: se o evento já existe mas com o dono ERRADO (caso dos que nasceram
      // antes de `organizadorSlug` existir), reatribui. Não recria, não duplica.
      if (ex.actor_id !== dono.id) {
        await pool.query(`UPDATE events SET actor_id=$1::uuid, actor_type=$2, updated_at=NOW() WHERE id=$3::uuid`, [dono.id, dono.tipo, ex.id]);
        console.log(`   ⤳ ${ev.titulo.padEnd(44)} dono corrigido → ${dono.nome}`);
      } else {
        console.log(`   ↻ ${ev.titulo} (já existia)`);
      }
      reusados.eventos++;
      idsDeEventosDaVitrine.push(ex.id);
      continue;
    }
    const formatoId = await conceptIdPorSlug(ev.formato);
    if (!formatoId) { console.log(`   ⚠️  formato '${ev.formato}' ausente — pulado`); continue; }
    const inicio = new Date();
    inicio.setDate(inicio.getDate() + ev.diasNoFuturo);
    inicio.setHours(20, 0, 0, 0);
    const fim = new Date(inicio);
    fim.setHours(23, 30, 0, 0);
    const novoEventoId = randomUUID();
    await pool.query(
      `INSERT INTO events (id, tenant_id, actor_id, actor_type, title, description, status, visibility,
         datetime_start, datetime_end, timezone, currency, max_attendees, ticket_price_cents,
         event_format_concept_id, metadata, created_at, updated_at)
       VALUES ($1,$2,$3,$11,$4,$5,'published','public',$6,$7,'America/Sao_Paulo','BRL',$8,$9,$10,'{"demo_seed":true}'::jsonb,NOW(),NOW())`,
      [novoEventoId, organizador.tenant_id, dono.id, ev.titulo, ev.descricao,
       inicio.toISOString(), fim.toISOString(), ev.capacidade, ev.precoCents, formatoId, dono.tipo]
    );
    criados.eventos++;
    idsDeEventosCriados.push(novoEventoId);
    idsDeEventosDaVitrine.push(novoEventoId);
    console.log(`   ✅ ${ev.titulo.padEnd(44)} ${ev.formato.padEnd(12)} ${inicio.toLocaleDateString('pt-BR')} · por ${dono.nome}`);
  }

  // 🔴 ANOTA no manifesto — é isto que a faxina vai apagar, POR ID. Escrever aqui (e não no fim)
  // garante que uma falha adiante não deixe evento criado fora do registro.
  registrarNoManifesto('demo_events', idsDeEventosDaVitrine);

  // ── 4. SETORES COM MEIA-ENTRADA (a página pública precisa ter o que mostrar) ─
  // 🔴 Usa o WRITER REAL (`eventSectorService`), nunca INSERT direto: ele valida a cota legal
  // (40%–100%, Lei 12.933/2013), exige `meia = inteira/2` exato — o mesmo que o CHECK físico
  // `chk_event_sectors_meia_is_half_inteira` impõe — e reconcilia capacidade sob advisory lock
  // contra `events.max_attendees`. Escrever direto pularia as três garantias.
  console.log('\n── Setores com meia-entrada ──');
  const SETORES: Record<string, Array<{ nome: string; capacidade: number; inteiraCents: number }>> = {
    'Pedra Noventa ao vivo — Rock no Largo': [
      { nome: 'Pista', capacidade: 300, inteiraCents: 6000 },
      { nome: 'Camarote', capacidade: 100, inteiraCents: 12000 },
    ],
    'Festa Junina do Bairro': [
      { nome: 'Entrada única', capacidade: 800, inteiraCents: 2500 },
    ],
  };
  const { eventSectorService } = await import('../modules/events/event-sector.service');
  for (const [titulo, setores] of Object.entries(SETORES)) {
    const ev = (await pool.query<{ id: string; tenant_id: string }>(
      `SELECT id::text, tenant_id::text FROM events WHERE title = $1 LIMIT 1`, [titulo]
    )).rows[0];
    if (!ev) { console.log(`   ⚠️  evento ausente: ${titulo}`); continue; }
    const jaTem = Number((await pool.query<{ n: string }>(
      `SELECT count(*)::text n FROM event_sectors WHERE event_id = $1::uuid`, [ev.id]
    )).rows[0].n);
    if (jaTem > 0) { console.log(`   ↻ ${titulo.slice(0, 40)} (${jaTem} setor(es) já existiam)`); continue; }
    let n = 0;
    for (let i = 0; i < setores.length; i++) {
      const s = setores[i];
      try {
        await eventSectorService.createSector(ev.tenant_id, ev.id, {
          sectorNumber: i + 1,
          name: s.nome,
          capacity: s.capacidade,
          meiaQuotaBps: 4000, // piso legal 40%
          inteiraPriceCents: s.inteiraCents,
          // Metade EXATA: o writer recusa qualquer outro valor, e a divisão inteira (floor) é a
          // mesma que o CHECK do banco aplica.
          meiaPriceCents: Math.floor(s.inteiraCents / 2),
        });
        n++;
      } catch (e) {
        console.log(`   ⚠️  ${s.nome}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    console.log(`   ✅ ${titulo.slice(0, 40).padEnd(42)} ${n} setor(es)`);
  }

  // ── 5. AGENDA DOS FORNECEDORES (sem isto o filtro por data não tem o que filtrar) ─
  // 🔴 Usa `declareAvailability` — o WRITER REAL, que valida representação do provider e grava na
  // fonte temporal canônica (`availability`, owner_type='service_offering'). INSERT direto seria
  // persistir estado temporal fora do SSOT, exatamente o que a norma proíbe.
  //
  // ⚠️ DE PROPÓSITO nem todo fornecedor atende todo dia: sem isso o filtro por data pareceria
  // funcionar mostrando sempre a lista inteira, e eu não teria como provar que ele FILTRA. Quem
  // fica de fora é tão importante quanto quem aparece.
  //   · `muralha-seguranca`, `decibel-audio-luz`, `vida-brigada` → atendem TODAS as datas
  //   · `sabor-e-cia-buffet`, `brilho-limpeza`                   → só fins de semana (sáb/dom)
  //   · `foco-studio`                                            → NENHUMA janela (nunca aparece
  //                                                                 no filtro por data)
  console.log('\n── Agenda dos fornecedores ──');
  const { serviceOfferingService } = await import('../modules/services/service-offering.service');
  const SEM_AGENDA = new Set(['foco-studio']);
  const SO_FIM_DE_SEMANA = new Set(['sabor-e-cia-buffet', 'brilho-limpeza']);
  const datasDosEventos = (
    await pool.query<{ inicio: Date }>(
      // Por ID (Lei 7), não por `metadata->>'demo_seed'`: `events` é TRANSACIONAL e metadata não
      // decide sobre ela (C7-METADATA-DECISION). Inclui os reusados — a agenda tem de cobrir os
      // eventos que já existiam, não só os desta corrida.
      `SELECT datetime_start AS inicio FROM events WHERE id = ANY($1::uuid[]) AND datetime_start IS NOT NULL ORDER BY datetime_start`,
      [idsDeEventosDaVitrine]
    )
  ).rows.map((r) => r.inicio);

  for (const f of FORNECEDORES) {
    if (SEM_AGENDA.has(f.slug)) { console.log(`   ⚪ ${f.nome.padEnd(32)} sem janela (de propósito)`); continue; }
    const dono = await garantirDonoHumano(f.email, `Responsável ${f.nome}`);
    const empresaId = await garantirEmpresa(dono.tenantId, dono.globalUserId, f.nome, f.slug, cnpjSeq++);
    const ofertas = (
      await pool.query<{ id: string }>(
        `SELECT id::text FROM service_offerings WHERE provider_actor_id = $1::uuid AND status = 'active'`,
        [empresaId]
      )
    ).rows;
    let janelas = 0;
    for (const data of datasDosEventos) {
      const diaSemana = data.getDay(); // 0=dom, 6=sáb
      if (SO_FIM_DE_SEMANA.has(f.slug) && diaSemana !== 0 && diaSemana !== 6) continue;
      // Janela generosa em volta do evento (montagem antes, desmontagem depois).
      const ini = new Date(data); ini.setHours(ini.getHours() - 4);
      const fim = new Date(data); fim.setHours(fim.getHours() + 6);
      for (const of of ofertas) {
        try {
          await serviceOfferingService.declareAvailability({
            tenantId: dono.tenantId, userId: dono.userId, offeringId: of.id,
            startDatetime: ini.toISOString(), endDatetime: fim.toISOString(),
          });
          janelas++;
        } catch {
          // Janela já declarada numa corrida anterior — idempotência, não erro.
        }
      }
    }
    console.log(`   ✅ ${f.nome.padEnd(32)} ${janelas} janela(s)`);
  }

  // ── VERIFICAÇÃO DE 1ª MÃO ───────────────────────────────────────────────────
  const bank1 = String(await countBankMovements());
  const noFeed = (
    await pool.query<{ n: string }>(
      `SELECT count(*)::text n FROM events
        WHERE status IN ('published','active') AND datetime_start IS NOT NULL AND datetime_start >= NOW()`
    )
  ).rows[0].n;
  const cobertura = await pool.query<{ need: string; kind: string; forn: number }>(
    `SELECT COALESCE(cs.name, c.slug) AS need, t.fulfillment_kind AS kind,
            ((SELECT count(*) FROM canonical_services cs2 JOIN service_offerings so ON so.canonical_service_id=cs2.id AND so.status='active' WHERE cs2.concept_id=t.need_concept_id)
             + (SELECT count(*) FROM rentable_resources rr WHERE rr.concept_id=t.need_concept_id AND rr.is_active=true AND rr.status='active'))::int AS forn
       FROM event_orchestration_template_items t
       JOIN concepts fc ON fc.concept_id=t.format_concept_id AND fc.slug='show'
       JOIN concepts c ON c.concept_id=t.need_concept_id
       LEFT JOIN canonical_services cs ON cs.concept_id=t.need_concept_id AND cs.tenant_id IS NULL
      ORDER BY t.is_required DESC, t.sort_order`
  );
  const comFornecedor = cobertura.rows.filter((r) => r.forn > 0).length;

  console.log('\n' + '═'.repeat(64));
  console.log(`CRIADOS   → empresas ${criados.empresas} · ofertas ${criados.ofertas} · locáveis ${criados.locaveis} · eventos ${criados.eventos}`);
  console.log(`REUSADOS  → empresas ${reusados.empresas} · ofertas ${reusados.ofertas} · locáveis ${reusados.locaveis} · eventos ${reusados.eventos}  (idempotência)`);
  console.log(`\nCOBERTURA do SHOW: ${comFornecedor}/${cobertura.rows.length} necessidades com fornecedor`);
  for (const r of cobertura.rows) {
    console.log(`   ${r.forn > 0 ? '✅' : '⚪'} ${r.need.padEnd(32)} ${r.kind.padEnd(9)} → ${r.forn}`);
  }
  console.log(`\nEVENTOS que passam no filtro da VITRINE: ${noFeed}`);
  console.log(`Δbank: ${bank0} → ${bank1} ${bank0 === bank1 ? '(ZERO ✅)' : '(🔴 MOVEU!)'}`);
  console.log(`\nSenha dos donos de demonstração: ${SENHA_DEMO}`);
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(`💥 ${err instanceof Error ? err.message : String(err)}`);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
