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
 *  · `rentable_resources.pricing_unit` ∈ `por_hora|por_dia|por_semana|por_mes|por_semestre|por_ano`
 *    (LIDO do CHECK, não deduzido — 'diaria' não existe).
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

/** Eventos publicados de demonstração — o que a VITRINE (/eventos) passa a ter para mostrar. */
const EVENTOS: Array<{ titulo: string; formato: string; diasNoFuturo: number; precoCents: number | null; capacidade: number | null; descricao: string }> = [
  { titulo: 'Pedra Noventa ao vivo — Rock no Largo', formato: 'show', diasNoFuturo: 12, precoCents: 6000, capacidade: 400, descricao: 'A banda Pedra Noventa abre a temporada com show autoral de rock.' },
  { titulo: 'Festa Junina do Bairro', formato: 'festa', diasNoFuturo: 20, precoCents: 2500, capacidade: 800, descricao: 'Quadrilha, comidas típicas e barracas da vizinhança.' },
  { titulo: 'Sarau de Poesia e Violão', formato: 'apresentacao', diasNoFuturo: 8, precoCents: null, capacidade: 120, descricao: 'Noite aberta de poesia falada e música acústica. Entrada gratuita.' },
  { titulo: 'Feira do Empreendedor Local', formato: 'feira', diasNoFuturo: 25, precoCents: null, capacidade: 1500, descricao: 'Expositores da região apresentam produtos e serviços. Rodada de negócios à tarde.' },
  { titulo: 'Encontro de Síndicos e Condomínios', formato: 'reuniao', diasNoFuturo: 15, precoCents: 4000, capacidade: 90, descricao: 'Boas práticas de gestão condominial, com mesa de perguntas.' },
  { titulo: 'Workshop de Precificação para Autônomos', formato: 'workshop', diasNoFuturo: 30, precoCents: 8000, capacidade: 60, descricao: 'Como formar preço de serviço sem trabalhar de graça.' },
];

let criados = { empresas: 0, ofertas: 0, locaveis: 0, eventos: 0 };
let reusados = { empresas: 0, ofertas: 0, locaveis: 0, eventos: 0 };

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
async function garantirDonoHumano(email: string, nome: string): Promise<{ userId: string; actorId: string; tenantId: string }> {
  const existente = (
    await pool.query<{ user_id: string; tenant_id: string; actor_id: string | null }>(
      `SELECT u.user_id::text AS user_id, u.tenant_id::text AS tenant_id,
              (SELECT a.id::text FROM actors a WHERE a.user_id = u.user_id AND a.actor_type='user' LIMIT 1) AS actor_id
         FROM users u WHERE u.email = $1 LIMIT 1`,
      [email]
    )
  ).rows[0];
  if (existente?.actor_id) {
    return { userId: existente.user_id, actorId: existente.actor_id, tenantId: existente.tenant_id };
  }
  const { authService } = await import('../core/auth/auth.service');
  const reg = await authService.register(undefined, email, SENHA_DEMO, gerarCpf(), nome, '1985-03-15', undefined);
  const actorId = (
    await pool.query<{ id: string }>(`SELECT id::text FROM actors WHERE user_id = $1::uuid AND actor_type='user' LIMIT 1`, [reg.user.userId])
  ).rows[0]?.id;
  if (!actorId) throw new Error(`actor humano não nasceu para ${email}`);
  return { userId: reg.user.userId, actorId, tenantId: reg.tenantId };
}

/** Actor 'page' da empresa, com âncora civil (responsible_actor_id). Idempotente por slug. */
async function garantirEmpresa(tenantId: string, nome: string, slug: string, donoActorId: string): Promise<string> {
  const ex = (await pool.query<{ id: string }>(`SELECT id::text FROM actors WHERE tenant_id=$1::uuid AND slug=$2 LIMIT 1`, [tenantId, slug])).rows[0];
  if (ex) { reusados.empresas++; return ex.id; }
  const r = await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, slug, responsible_actor_id, metadata, created_at, updated_at)
     VALUES ($1,'page',$2,$3,$4,'{"demo_seed":true}'::jsonb,NOW(),NOW()) RETURNING id`,
    [tenantId, nome, slug, donoActorId]
  );
  criados.empresas++;
  return r.rows[0].id;
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

  const bank0 = (await pool.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`)).rows[0].n;

  // ── 1. FORNECEDORES DE SERVIÇO ──────────────────────────────────────────────
  console.log('── Empresas prestadoras ──');
  for (const f of FORNECEDORES) {
    const dono = await garantirDonoHumano(f.email, `Responsável ${f.nome}`);
    const empresaId = await garantirEmpresa(dono.tenantId, f.nome, f.slug, dono.actorId);
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
    const empresaId = await garantirEmpresa(dono.tenantId, l.empresa.nome, l.empresa.slug, dono.actorId);
    let ok = 0;
    for (const item of l.itens) {
      const conceptId = await conceptIdPorSlug(item.slug);
      if (!conceptId) { console.log(`   ⚠️  concept '${item.slug}' ausente — pulado`); continue; }
      const ex = (
        await pool.query<{ id: string }>(
          `SELECT id::text FROM rentable_resources WHERE tenant_id=$1::uuid AND owner_actor_id=$2::uuid AND concept_id=$3::uuid LIMIT 1`,
          [dono.tenantId, empresaId, conceptId]
        )
      ).rows[0];
      if (ex) { reusados.locaveis++; ok++; continue; }
      // 🔴 pricing_unit='por_dia' — LIDO do CHECK, nunca deduzido ('diaria' NÃO existe).
      await pool.query(
        `INSERT INTO rentable_resources (tenant_id, owner_actor_id, concept_id, resource_type, label, status, is_active, pricing_unit, price_cents, quantity, metadata, created_at, updated_at)
         VALUES ($1,$2,$3,'equipment',$4,'active',true,'por_dia',$5,10,'{"demo_seed":true}'::jsonb,NOW(),NOW())`,
        [dono.tenantId, empresaId, conceptId, item.label, item.priceCents]
      );
      criados.locaveis++;
      ok++;
    }
    console.log(`   ✅ ${l.empresa.nome.padEnd(32)} ${ok} locável(is)`);
  }

  // ── 3. EVENTOS PUBLICADOS (a vitrine passa a ter o que mostrar) ─────────────
  // O filtro real do feed (feed.routes.ts) exige: status ∈ (published, active) E datetime_start
  // NÃO-NULA E futura. Semeamos exatamente nessa forma — se algum dia o filtro mudar, este seed
  // deixa de aparecer e isso é a informação correta, não um bug do seed.
  console.log('\n── Eventos publicados ──');
  const organizador = (
    await pool.query<{ id: string; tenant_id: string }>(
      `SELECT id::text, tenant_id::text FROM actors WHERE display_name = 'Dev Canonical' AND actor_type='user' LIMIT 1`
    )
  ).rows[0];
  if (!organizador) throw new Error('actor "Dev Canonical" ausente — sem organizador para os eventos de demonstração.');

  for (const ev of EVENTOS) {
    const ex = (
      await pool.query<{ id: string }>(`SELECT id::text FROM events WHERE tenant_id=$1::uuid AND title=$2 LIMIT 1`, [organizador.tenant_id, ev.titulo])
    ).rows[0];
    if (ex) { reusados.eventos++; console.log(`   ↻ ${ev.titulo} (já existia)`); continue; }
    const formatoId = await conceptIdPorSlug(ev.formato);
    if (!formatoId) { console.log(`   ⚠️  formato '${ev.formato}' ausente — pulado`); continue; }
    const inicio = new Date();
    inicio.setDate(inicio.getDate() + ev.diasNoFuturo);
    inicio.setHours(20, 0, 0, 0);
    const fim = new Date(inicio);
    fim.setHours(23, 30, 0, 0);
    await pool.query(
      `INSERT INTO events (id, tenant_id, actor_id, actor_type, title, description, status, visibility,
         datetime_start, datetime_end, timezone, currency, max_attendees, ticket_price_cents,
         event_format_concept_id, metadata, created_at, updated_at)
       VALUES ($1,$2,$3,'user',$4,$5,'published','public',$6,$7,'America/Sao_Paulo','BRL',$8,$9,$10,'{"demo_seed":true}'::jsonb,NOW(),NOW())`,
      [randomUUID(), organizador.tenant_id, organizador.id, ev.titulo, ev.descricao,
       inicio.toISOString(), fim.toISOString(), ev.capacidade, ev.precoCents, formatoId]
    );
    criados.eventos++;
    console.log(`   ✅ ${ev.titulo.padEnd(46)} ${ev.formato.padEnd(12)} ${inicio.toLocaleDateString('pt-BR')}`);
  }

  // ── VERIFICAÇÃO DE 1ª MÃO ───────────────────────────────────────────────────
  const bank1 = (await pool.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`)).rows[0].n;
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
