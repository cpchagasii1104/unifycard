// backend/src/core/events/event-need-supplier-discovery.service.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — a ponte necessidade-do-evento → fornecedor REAL
// ║ NORMA:   "a verdade vive no backend, frontend não cria verdade" (Clayton, 2026-08-04)
// ║ NÃO:     NÃO cruzar need_concept_id com ofertas no cliente; NÃO inventar fornecedor;
// ║          NÃO disparar demanda/RFQ/booking/agenda/Bank a partir daqui (read-only).
// ║ EM VEZ:  consumir GET /events/:id/need-suppliers, que já devolve a junção resolvida.
// ╚════════════════════════════════════════════════════════════════
//
// ═══ O ELO QUE FALTAVA (F-EVENT-SUPPLIER-BRIDGE, 2026-08-04) ═══
// Clayton, sobre "Meus Eventos" no modo Consumir: *"aparecer as empresas pertinentes a me ajudar
// com os eventos, seja de segurança, coisas de energia, banheiros, palcos, equipamentos e etc."*
//
// As DUAS PONTAS já existiam vivas e nunca tinham sido ligadas — inventariado antes de escrever:
//   ponta A: `event_operational_needs.need_concept_id` (o organizador declara "preciso de som")
//            e `event_orchestration_template_items` (o SHOW sugere 17 necessidades)
//   ponta B: `service_offerings.canonical_service_id` (empresa oferta) e `rentable_resources`
//            (dono oferta um bem), ambos alcançáveis a partir de `concept_id`
// No meio: NADA. `grep needConceptId` fora de core/events só achava E2E e o wizard.
//
// 🔴 POR QUE A JUNÇÃO É POR CONCEPT, E NÃO POR NOME: Lei 7 — CONCEPT é o SSOT de identidade
// semântica. "Segurança de eventos" é rótulo de apresentação (`canonical_services.name`); casar
// por ele reintroduziria a doença que este repositório já pagou caro (nome que "bate" com a
// expectativa é a evidência mais fraca da casa). O need guarda concept_id; a oferta guarda
// concept_id; a ponte é entre os dois, e o rótulo só desce para a tela ler.
//
// 🔴 OS DOIS CAMINHOS DE FORNECIMENTO SÃO DIFERENTES, E A RÉGUA DE CLAYTON DECIDE QUAL:
//     SERVIÇO  = gente que se contrata; o fornecedor traz o equipamento dele  → service_offerings
//     LOCAÇÃO  = bem que o organizador aluga direto, sem profissional junto   → rentable_resources
// `fulfillment_kind` (do template, herdado pela need) é quem diz qual. NÃO deduzir pelo nome do
// concept: "banheiro-quimico" é rentable e "brigadista-equipe-de-saude" é service, e as duas
// convivem no MESMO template do SHOW.
//
// ⚠️ ZERO ≠ DESCONHECIDO: quando uma necessidade não tem fornecedor, devolvemos `suppliers: []`
// com `supplierCount: 0` — afirmação MEDIDA de que não há oferta cadastrada, não falha de leitura.
// Estado real medido em unificard_dev em 2026-08-04: as 17 necessidades do SHOW têm 0 fornecedores
// (1 service_offering no sistema inteiro, 0 rentable_resources). A ponte funciona; o catálogo de
// oferta é que está vazio. A tela DEVE dizer isso ao organizador, não fingir que a busca falhou.

import { runQueriesWithTenant } from '@core/database/pool';

/** Fornecedor candidato para UMA necessidade. Projeção read-only — nunca autoridade de contratação. */
export interface NeedSupplierOption {
  /** Origem do fornecimento: 'service' = service_offerings; 'rentable' = rentable_resources. */
  sourceKind: 'service' | 'rentable';
  /** id da oferta (service_offerings.id) ou do recurso (rentable_resources.id). */
  offerId: string;
  /** Actor que fornece (prestador ou dono do bem). Identidade — a tela resolve o nome por ele. */
  providerActorId: string;
  /** Nome de exibição do fornecedor (actors.display_name). APRESENTAÇÃO, não identidade. */
  providerDisplayName: string | null;
  /** Rótulo da própria oferta/recurso (o que o fornecedor chamou). */
  offerLabel: string | null;
  priceCents: number | null;
  /** 'service': duração em minutos. 'rentable': unidade de cobrança (diaria/hora/…). */
  priceUnit: string | null;
}

export interface NeedWithSuppliers {
  needConceptId: string;
  /** Rótulo governado da necessidade (canonical_services.name → slug). */
  label: string;
  fulfillmentKind: string;
  isRequired: boolean;
  /** Presente só quando a necessidade foi DECLARADA pelo organizador (event_operational_needs). */
  declaredStatus: string | null;
  supplierCount: number;
  suppliers: NeedSupplierOption[];
}

/** Teto de fornecedores devolvidos POR necessidade — a tela é um panorama, não o catálogo inteiro. */
const SUPPLIERS_PER_NEED_LIMIT = 8;

/** Teto de janelas de agenda devolvidas POR oferta na vitrine do fornecedor. */
const WINDOWS_PER_OFFER_LIMIT = 20;

/** Uma janela publicada pelo fornecedor. `availabilityId` é o que o pedido de reserva consome. */
export interface ProviderOfferWindow {
  /** 🔴 A PK de `availability` chama-se `availability_id`, NÃO `id` — conferido no banco, não deduzido. */
  availabilityId: string;
  startAt: string;
  endAt: string;
  capacity: number | null;
}

/** Uma oferta do fornecedor, com a agenda que ele publicou para ela. */
export interface ProviderOffer {
  sourceKind: 'service' | 'rentable';
  offerId: string;
  label: string | null;
  priceCents: number | null;
  priceUnit: string | null;
  /** Identidade semântica do que se oferece (Lei 7) — a tela lê o rótulo, roteia pelo concept. */
  conceptId: string | null;
  windows: ProviderOfferWindow[];
}

/**
 * A VITRINE DO FORNECEDOR — o que ele tem a oferecer + quando pode. Read-only.
 * ⚠️ `displayName` pode ser null: quem fornece é um ACTOR, e nem todo actor tem nome de exibição.
 * Null aqui é honesto ("não há nome"), e a tela decide o fallback — não inventamos nome no servidor.
 */
export interface ProviderShowcase {
  providerActorId: string;
  displayName: string | null;
  offers: ProviderOffer[];
}

/**
 * 🕐 FILTRO DE DISPONIBILIDADE — SERVER-SIDE (F-EVENT-SUPPLIER-AVAILABILITY, 2026-08-04)
 *
 * Clayton: *"eu poder filtrar por data e horário (que é muito importante)"*, e depois:
 * *"respeitando … leis de coerência sistêmica, tempo"*.
 *
 * ═══ POR QUE NO SERVIDOR, E NÃO NO CLIENTE ═══
 * O filtro por janela que existia era CLIENT-SIDE (`frontend/src/api/service-discovery.ts:199-241`
 * varria as janelas em JS). Isso é errado por dois motivos independentes:
 *   1. com teto de resultados, o servidor corta ANTES do filtro — o cliente recebe 8 e mostra 2,
 *      e o fornecedor livre que ficou fora do teto some sem ninguém saber;
 *   2. quem conhece o conjunto inteiro é o servidor. Filtrar depois de receber é opinar sobre uma
 *      amostra e apresentar como se fosse o todo.
 *
 * ═══ SSOT TEMPORAL (respeitado, não contornado) ═══
 * `SSOT_REGISTRY_UNIFICARD.md` → *"unified_availability é a fonte única de verdade para estado
 * temporal"* e *"nenhuma outra tabela ou módulo pode definir ou persistir estado temporal"*.
 * ⚠️ A tabela VIVA chama-se `availability` (o documento nomeia `unified_availability`, que não
 * existe no banco — divergência registrada no cartório; norma é ato de Clayton, não meu).
 * Aqui NÃO se persiste tempo nenhum: é LEITURA sobre a fonte temporal. Zero tabela nova.
 *
 * ═══ O PREDICADO É ESPELHO, NÃO INVENÇÃO ═══
 * `unified-availability.repository.ts:236-244` (leitor canônico `listAvailability`) define
 * sobreposição como:
 *     end_datetime   >= :from        AND     start_datetime <= :to
 * Copiado byte a byte. Escrever outro overlap aqui criaria duas respostas para "está livre?" —
 * e elas divergiriam no limite (o caso `>=` × `>` é exatamente onde esse tipo de bug mora).
 *
 * ⚠️ O que este filtro NÃO afirma: que a janela está LIVRE. Ele afirma que o fornecedor DECLAROU
 * atender naquele período. Descontar reserva já feita depende de `bookings` (0 linhas hoje) e é
 * outra fatia — dizer "livre" agora seria afirmar o que não se mediu.
 *
 * ⚠️ Sem SQL dinâmico: a janela entra SEMPRE como `$3`/`$4` e o `IS NULL` faz curto-circuito
 * quando não há filtro. Montar string de query condicionalmente é como se erra índice de
 * parâmetro — e erro de índice aqui compararia data contra tenant_id.
 */
function janelaDeclaradaExists(ownerType: 'service_offering' | 'rentable_resource', idExpr: string): string {
  return `AND ($3::timestamptz IS NULL OR EXISTS (
            SELECT 1 FROM availability av
             WHERE av.tenant_id = $2::uuid
               AND av.owner_type = '${ownerType}'
               AND av.owner_id = ${idExpr}
               AND av.status = 'active'
               AND av.end_datetime   >= $3::timestamptz
               AND av.start_datetime <= $4::timestamptz
          ))`;
}

class EventNeedSupplierDiscoveryService {
  /**
   * Necessidades do evento (as DECLARADAS pelo organizador, senão as SUGERIDAS pelo formato) já
   * com os fornecedores reais de cada uma.
   *
   * `onlyDeclared=true`  → só o que o organizador declarou (a lista de compras dele).
   * `onlyDeclared=false` → o template inteiro do formato, marcando o que já foi declarado
   *                        (`declaredStatus`), para ele descobrir o que ainda nem considerou.
   *
   * `availableFrom`/`availableTo` → só fornecedores que DECLARARAM atender naquele período
   *                                 (ver OVERLAP_PREDICATE). Filtro no SERVIDOR, sobre a fonte
   *                                 temporal. Omitir os dois = sem filtro de tempo.
   * `useEventWindow=true`         → deriva a janela do PRÓPRIO evento (datetime_start/end). É o
   *                                 "evento como contexto": quem chega pelo evento não deveria
   *                                 redigitar a data que o sistema já sabe.
   *
   * READ-ONLY e Δbank=0: não cria need, não abre RFQ, não reserva, não move dinheiro.
   */
  async listNeedsWithSuppliers(
    tenantId: string,
    eventId: string,
    opts: { onlyDeclared?: boolean; availableFrom?: string; availableTo?: string; useEventWindow?: boolean } = {}
  ): Promise<NeedWithSuppliers[]> {
    const onlyDeclared = opts.onlyDeclared === true;

    // Janela de disponibilidade. Precedência: janela explícita > janela do evento > sem filtro.
    let janelaDe = opts.availableFrom ?? null;
    let janelaAte = opts.availableTo ?? null;
    if (!janelaDe && !janelaAte && opts.useEventWindow) {
      const ev = await runQueriesWithTenant<{ inicio: string | null; fim: string | null }>(
        tenantId,
        `SELECT datetime_start::text AS inicio, datetime_end::text AS fim FROM events WHERE id = $1::uuid`,
        [eventId]
      );
      // ⚠️ Evento SEM data não vira janela "aberta" nem janela "vazia": vira AUSÊNCIA de filtro.
      // Inventar um período aqui (hoje→sempre, por exemplo) faria a tela afirmar disponibilidade
      // sobre um período que ninguém pediu.
      janelaDe = ev[0]?.inicio ?? null;
      // Evento com início e sem fim: a janela é o próprio instante de início (start<=X<=start),
      // que é o mínimo honesto — não estica para o infinito.
      janelaAte = ev[0]?.fim ?? ev[0]?.inicio ?? null;
    }
    const filtrarPorJanela = !!janelaDe && !!janelaAte;

    // 1) As necessidades. Fonte: template do FORMATO do evento (autoridade do que aquele formato
    //    pede) LEFT JOIN a declaração do organizador. `event_format_concept_id` é a identidade
    //    (DECISION do concept-first) — NUNCA event_type legado, que a migration 20260708310000
    //    despromoveu explicitamente de autoridade.
    const needs = await runQueriesWithTenant<{
      need_concept_id: string;
      label: string;
      fulfillment_kind: string;
      is_required: boolean;
      declared_status: string | null;
    }>(
      tenantId,
      `SELECT t.need_concept_id,
              COALESCE(cs.name, nc.slug)            AS label,
              t.fulfillment_kind,
              t.is_required,
              n.status                              AS declared_status
         FROM events e
         JOIN event_orchestration_template_items t
           ON t.format_concept_id = e.event_format_concept_id
         JOIN concepts nc ON nc.concept_id = t.need_concept_id
         LEFT JOIN canonical_services cs
           ON cs.concept_id = t.need_concept_id AND cs.tenant_id IS NULL AND cs.status = 'active'
         LEFT JOIN event_operational_needs n
           ON n.event_id = e.id AND n.need_concept_id = t.need_concept_id AND n.status <> 'cancelled'
        WHERE e.id = $1::uuid
          AND ($2::boolean = false OR n.status IS NOT NULL)
        ORDER BY t.is_required DESC, t.sort_order ASC`,
      [eventId, onlyDeclared]
    );

    if (needs.length === 0) return [];

    const serviceNeedIds = needs.filter((n) => n.fulfillment_kind === 'service').map((n) => n.need_concept_id);
    const rentableNeedIds = needs.filter((n) => n.fulfillment_kind === 'rentable').map((n) => n.need_concept_id);

    // 2) Fornecedores dos dois substratos, cada um pela SUA cadeia. Duas queries com ANY(),
    //    não N+1 por necessidade.
    const [serviceRows, rentableRows] = await Promise.all([
      serviceNeedIds.length
        ? runQueriesWithTenant<{
            need_concept_id: string; offer_id: string; provider_actor_id: string;
            provider_display_name: string | null; offer_label: string | null;
            price_cents: string | number | null; price_unit: string | null;
          }>(
            tenantId,
            // canonical_services é GLOBAL (tenant_id IS NULL) — mesma condição que todo reader do
            // catálogo canônico usa. `status='active'` na oferta é o gate que já existia em
            // listActiveBycanonicalService: rascunho de prestador NUNCA vaza para descoberta.
            // 🔴 tenant_id EXPLÍCITO na oferta (não só RLS): é exatamente o que
            // `listActiveBycanonicalService` já faz. Confiar apenas no contexto de sessão aqui
            // seria assimétrico com o reader irmão — e vazamento cross-tenant de fornecedor é
            // silencioso, do tipo que ninguém reclama até ser tarde.
            `SELECT cs.concept_id                    AS need_concept_id,
                    so.id::text                      AS offer_id,
                    so.provider_actor_id::text       AS provider_actor_id,
                    a.display_name                   AS provider_display_name,
                    cs.name                          AS offer_label,
                    so.price_cents                   AS price_cents,
                    so.duration_minutes::text        AS price_unit
               FROM canonical_services cs
               JOIN service_offerings so
                 ON so.canonical_service_id = cs.id
                AND so.status = 'active'
                AND so.tenant_id = $2::uuid
               LEFT JOIN actors a ON a.id = so.provider_actor_id AND a.tenant_id = $2::uuid
              WHERE cs.tenant_id IS NULL
                AND cs.concept_id = ANY($1::uuid[])
                ${janelaDeclaradaExists('service_offering', 'so.id')}
              ORDER BY so.price_cents ASC NULLS LAST, so.created_at ASC`,
            [serviceNeedIds, tenantId, filtrarPorJanela ? janelaDe : null, filtrarPorJanela ? janelaAte : null]
          )
        : Promise.resolve([]),
      rentableNeedIds.length
        ? runQueriesWithTenant<{
            need_concept_id: string; offer_id: string; provider_actor_id: string;
            provider_display_name: string | null; offer_label: string | null;
            price_cents: string | number | null; price_unit: string | null;
          }>(
            tenantId,
            // rentable_resources guarda concept_id DIRETO (não passa por canonical_services).
            // `is_active` + status='active': mesmo par que o reader de locação já exige.
            `SELECT rr.concept_id::text          AS need_concept_id,
                    rr.id::text                  AS offer_id,
                    rr.owner_actor_id::text      AS provider_actor_id,
                    a.display_name               AS provider_display_name,
                    rr.label                     AS offer_label,
                    rr.price_cents               AS price_cents,
                    rr.pricing_unit              AS price_unit
               FROM rentable_resources rr
               LEFT JOIN actors a ON a.id = rr.owner_actor_id AND a.tenant_id = $2::uuid
              WHERE rr.tenant_id = $2::uuid
                AND rr.is_active = true
                AND rr.status = 'active'
                AND rr.concept_id = ANY($1::uuid[])
                ${janelaDeclaradaExists('rentable_resource', 'rr.id')}
              ORDER BY rr.price_cents ASC NULLS LAST, rr.created_at ASC`,
            [rentableNeedIds, tenantId, filtrarPorJanela ? janelaDe : null, filtrarPorJanela ? janelaAte : null]
          )
        : Promise.resolve([]),
    ]);

    const byNeed = new Map<string, NeedSupplierOption[]>();
    const push = (row: typeof serviceRows[number], sourceKind: 'service' | 'rentable'): void => {
      const list = byNeed.get(row.need_concept_id) ?? [];
      if (list.length >= SUPPLIERS_PER_NEED_LIMIT) return;
      list.push({
        sourceKind,
        offerId: row.offer_id,
        providerActorId: row.provider_actor_id,
        providerDisplayName: row.provider_display_name,
        offerLabel: row.offer_label,
        // price_cents chega como string (BIGINT do pg) — Number() explícito, nunca aritmética em string.
        priceCents: row.price_cents === null ? null : Number(row.price_cents),
        priceUnit: row.price_unit,
      });
      byNeed.set(row.need_concept_id, list);
    };
    for (const r of serviceRows) push(r, 'service');
    for (const r of rentableRows) push(r, 'rentable');

    return needs.map((n) => {
      const suppliers = byNeed.get(n.need_concept_id) ?? [];
      return {
        needConceptId: n.need_concept_id,
        label: n.label,
        fulfillmentKind: n.fulfillment_kind,
        isRequired: n.is_required,
        declaredStatus: n.declared_status,
        supplierCount: suppliers.length,
        suppliers,
      };
    });
  }

  /**
   * ═══ CATÁLOGO DE TIPOS DE FORNECEDOR — DESACOPLADO DE EVENTO ═══════════════════════════════
   * (F-EVENT-SUPPLIER-CATALOG, 2026-08-04)
   *
   * Clayton, três vezes, olhando a tela "Quem me ajuda":
   *   *"no lugar dos eventos que estão aparecendo, deveria aparecer os tipos de empresas, exemplo
   *   segurança, fotografia, tendas, etc. E eu poder filtrar por data e horário"*
   *
   * 🔴 O EIXO ESTAVA INVERTIDO. `listNeedsWithSuppliers` (acima) é event-first: "escolha um evento
   * → veja as necessidades DELE". Serve ao painel do organizador de UM evento, e é o que a tela
   * usava como menu principal — por isso o topo listava os eventos dele em vez dos tipos de
   * fornecedor. Aqui o eixo é o CATÁLOGO: "que tipos de fornecedor existem para evento", com o
   * evento entrando só como CONTEXTO opcional (que preenche a janela de data).
   *
   * Fonte: `event_orchestration_template_items` — DISTINCT por `need_concept_id` através de TODOS
   * os formatos, não de um só. É o vocabulário governado do que um evento pode precisar; nenhuma
   * lista nova é inventada aqui, e nenhuma é escrita no frontend.
   *
   * ⚠️ NÃO é organizer-gated, ao contrário da irmã. "Quem oferece segurança para eventos" é
   * informação de vitrine, como `by-canonical` já é — não pertence a nenhum evento específico.
   * O que É organizer-gated continua sendo a lista de necessidades DE UM EVENTO (quem precisa do
   * quê é informação de quem organiza).
   *
   * READ-ONLY · Δbank=0 · PRÉ-PORTA-01 (não move dinheiro, não reserva).
   */
  async listSupplierCatalog(
    tenantId: string,
    opts: { availableFrom?: string; availableTo?: string; needConceptId?: string } = {}
  ): Promise<NeedWithSuppliers[]> {
    const janelaDe = opts.availableFrom ?? null;
    const janelaAte = opts.availableTo ?? null;
    const filtrarPorJanela = !!janelaDe && !!janelaAte;

    // 1) Os TIPOS. DISTINCT ON porque o mesmo need aparece em vários formatos (segurança está no
    //    show E na festa); `bool_or(is_required)` porque "obrigatório em ALGUM formato" é a
    //    informação útil — dizer "obrigatório" quando é opcional em todo formato seria falso.
    const tipos = await runQueriesWithTenant<{
      need_concept_id: string; label: string; fulfillment_kind: string; is_required: boolean; formatos: string;
    }>(
      tenantId,
      `SELECT t.need_concept_id,
              COALESCE(MIN(cs.name), MIN(nc.slug))          AS label,
              MIN(t.fulfillment_kind)                       AS fulfillment_kind,
              bool_or(t.is_required)                        AS is_required,
              string_agg(DISTINCT fc.slug, ', ' ORDER BY fc.slug) AS formatos
         FROM event_orchestration_template_items t
         JOIN concepts nc ON nc.concept_id = t.need_concept_id
         JOIN concepts fc ON fc.concept_id = t.format_concept_id
         LEFT JOIN canonical_services cs
           ON cs.concept_id = t.need_concept_id AND cs.tenant_id IS NULL AND cs.status = 'active'
        WHERE ($1::uuid IS NULL OR t.need_concept_id = $1::uuid)
        GROUP BY t.need_concept_id
        ORDER BY bool_or(t.is_required) DESC, COALESCE(MIN(cs.name), MIN(nc.slug)) ASC`,
      [opts.needConceptId ?? null]
    );

    if (tipos.length === 0) return [];

    const serviceIds = tipos.filter((t) => t.fulfillment_kind === 'service').map((t) => t.need_concept_id);
    const rentableIds = tipos.filter((t) => t.fulfillment_kind === 'rentable').map((t) => t.need_concept_id);

    // 2) Fornecedores — MESMAS queries da irmã (mesma cadeia, mesmo gate de tenant, mesmo
    //    predicado de janela). Reaproveitadas em forma, não copiadas em regra: se a regra de
    //    "quem é fornecedor válido" mudar, ela muda nos dois lugares junto ou o defeito aparece.
    const [serviceRows, rentableRows] = await Promise.all([
      serviceIds.length
        ? runQueriesWithTenant<{
            need_concept_id: string; offer_id: string; provider_actor_id: string;
            provider_display_name: string | null; offer_label: string | null;
            price_cents: string | number | null; price_unit: string | null;
          }>(
            tenantId,
            `SELECT cs.concept_id AS need_concept_id, so.id::text AS offer_id,
                    so.provider_actor_id::text AS provider_actor_id, a.display_name AS provider_display_name,
                    cs.name AS offer_label, so.price_cents, so.duration_minutes::text AS price_unit
               FROM canonical_services cs
               JOIN service_offerings so
                 ON so.canonical_service_id = cs.id AND so.status = 'active' AND so.tenant_id = $2::uuid
               LEFT JOIN actors a ON a.id = so.provider_actor_id AND a.tenant_id = $2::uuid
              WHERE cs.tenant_id IS NULL AND cs.concept_id = ANY($1::uuid[])
                ${janelaDeclaradaExists('service_offering', 'so.id')}
              ORDER BY so.price_cents ASC NULLS LAST, so.created_at ASC`,
            [serviceIds, tenantId, filtrarPorJanela ? janelaDe : null, filtrarPorJanela ? janelaAte : null]
          )
        : Promise.resolve([]),
      rentableIds.length
        ? runQueriesWithTenant<{
            need_concept_id: string; offer_id: string; provider_actor_id: string;
            provider_display_name: string | null; offer_label: string | null;
            price_cents: string | number | null; price_unit: string | null;
          }>(
            tenantId,
            `SELECT rr.concept_id::text AS need_concept_id, rr.id::text AS offer_id,
                    rr.owner_actor_id::text AS provider_actor_id, a.display_name AS provider_display_name,
                    rr.label AS offer_label, rr.price_cents, rr.pricing_unit AS price_unit
               FROM rentable_resources rr
               LEFT JOIN actors a ON a.id = rr.owner_actor_id AND a.tenant_id = $2::uuid
              WHERE rr.tenant_id = $2::uuid AND rr.is_active = true AND rr.status = 'active'
                AND rr.concept_id = ANY($1::uuid[])
                ${janelaDeclaradaExists('rentable_resource', 'rr.id')}
              ORDER BY rr.price_cents ASC NULLS LAST, rr.created_at ASC`,
            [rentableIds, tenantId, filtrarPorJanela ? janelaDe : null, filtrarPorJanela ? janelaAte : null]
          )
        : Promise.resolve([]),
    ]);

    const byNeed = new Map<string, NeedSupplierOption[]>();
    const push = (row: typeof serviceRows[number], sourceKind: 'service' | 'rentable'): void => {
      const list = byNeed.get(row.need_concept_id) ?? [];
      if (list.length >= SUPPLIERS_PER_NEED_LIMIT) return;
      list.push({
        sourceKind, offerId: row.offer_id, providerActorId: row.provider_actor_id,
        providerDisplayName: row.provider_display_name, offerLabel: row.offer_label,
        priceCents: row.price_cents === null ? null : Number(row.price_cents),
        priceUnit: row.price_unit,
      });
      byNeed.set(row.need_concept_id, list);
    };
    for (const r of serviceRows) push(r, 'service');
    for (const r of rentableRows) push(r, 'rentable');

    return tipos.map((t) => {
      const suppliers = byNeed.get(t.need_concept_id) ?? [];
      return {
        needConceptId: t.need_concept_id,
        label: t.label,
        fulfillmentKind: t.fulfillment_kind,
        isRequired: t.is_required,
        // `declaredStatus` não se aplica fora de um evento — null é a resposta honesta, não "open".
        declaredStatus: null,
        supplierCount: suppliers.length,
        suppliers,
      };
    });
  }

  /**
   * ═══ A PÁGINA DO FORNECEDOR (F-SUPPLIER-SHOWCASE, 2026-08-04) ═══
   * Clayton: *"quando eu clicar no tipo de prestador de serviço, empresa ou fornecedor eu tenho que
   * ir para uma página (padrão para este modelo) que eu consiga montar um pedido de orçamento, ver a
   * disponibilidade de agenda, ver o que ele tem a oferecer"*.
   *
   * 🔴 POR QUE ESTE MÉTODO MORA AQUI, e não numa casa nova: este arquivo já é o leitor que sabe
   * atravessar os DOIS substratos de fornecimento (`service_offerings` × `rentable_resources`) com o
   * mesmo gate de tenant e o mesmo predicado temporal. Abrir um segundo leitor com as mesmas junções
   * criaria a segunda verdade sobre "quem é fornecedor válido" — exatamente o que a casa já pagou caro.
   *
   * 🔴 O QUE ESTA PÁGINA **NÃO** É: ela não contrata. Devolve `availabilityId` porque é isso que o
   * pedido de reserva consome (`POST /offerings/:offeringId/bookings`), e esse caminho é o ÚNICO vivo
   * (Δbank=0, autoridade de evento revalidada server-side). A trilha RFQ→quote→booking está CONTIDA
   * por ato de Clayton (403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED, 2026-06-18) e reabri-la é DECISION dele.
   *
   * ⚠️ ZERO ≠ DESCONHECIDO: oferta sem janela devolve `windows: []` — afirmação MEDIDA de que o
   * fornecedor não publicou agenda, não falha de leitura. Medido em unificard_dev em 2026-08-04:
   * `availability` tem 58 janelas de `service_offering` e **0** de `rentable_resource` — os locáveis
   * não têm writer de agenda, então a vitrine deles nasce sem horário e a tela precisa dizer isso.
   */
  async getProviderShowcase(tenantId: string, providerActorId: string): Promise<ProviderShowcase | null> {
    const [actorRows, serviceRows, rentableRows] = await Promise.all([
      runQueriesWithTenant<{ display_name: string | null }>(
        tenantId,
        `SELECT display_name FROM actors WHERE id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
        [providerActorId, tenantId]
      ),
      runQueriesWithTenant<{
        offer_id: string; label: string | null; price_cents: string | number | null;
        price_unit: string | null; concept_id: string | null;
      }>(
        tenantId,
        // Mesmo recorte de "oferta contratável" da irmã acima: status 'active'. Oferta em draft/suspended
        // NÃO aparece — `active` é autorização operacional de contratação (DECISION-0147), não estado visual.
        `SELECT so.id::text AS offer_id, cs.name AS label, so.price_cents,
                so.duration_minutes::text AS price_unit, cs.concept_id::text AS concept_id
           FROM service_offerings so
           LEFT JOIN canonical_services cs ON cs.id = so.canonical_service_id
          WHERE so.tenant_id = $2::uuid AND so.provider_actor_id = $1::uuid AND so.status = 'active'
          ORDER BY so.created_at ASC`,
        [providerActorId, tenantId]
      ),
      runQueriesWithTenant<{
        offer_id: string; label: string | null; price_cents: string | number | null;
        price_unit: string | null; concept_id: string | null;
      }>(
        tenantId,
        `SELECT rr.id::text AS offer_id, rr.label, rr.price_cents,
                rr.pricing_unit AS price_unit, rr.concept_id::text AS concept_id
           FROM rentable_resources rr
          WHERE rr.tenant_id = $2::uuid AND rr.owner_actor_id = $1::uuid
            AND rr.is_active = true AND rr.status = 'active'
          ORDER BY rr.created_at ASC`,
        [providerActorId, tenantId]
      ),
    ]);

    // Actor inexistente devolve null — o chamador vira 404. Devolver vitrine vazia diria "existe e
    // não oferece nada", que é afirmação diferente e falsa.
    if (actorRows.length === 0) return null;

    // Sem `windows` ainda — a agenda entra logo abaixo, numa query só. O tipo diz isso em vez de um
    // cast: `Omit` mantém o compilador defendendo o contrato até a montagem final.
    const ofertas: Array<Omit<ProviderOffer, 'windows'>> = [
      ...serviceRows.map((r) => ({ ...toOffer(r), sourceKind: 'service' as const })),
      ...rentableRows.map((r) => ({ ...toOffer(r), sourceKind: 'rentable' as const })),
    ];

    // Agenda em UMA query para todas as ofertas (nunca N+1 dentro de laço).
    // Só janelas que ainda podem ser usadas: `end_datetime >= now()`. Janela vencida não é agenda,
    // é histórico — mostrá-la como contratável seria oferecer o que não existe mais.
    const windowsByOwner = new Map<string, ProviderOfferWindow[]>();
    if (ofertas.length > 0) {
      const rows = await runQueriesWithTenant<{
        owner_type: string; owner_id: string; availability_id: string;
        start_datetime: Date; end_datetime: Date; capacity: number | null;
      }>(
        tenantId,
        `SELECT owner_type, owner_id::text AS owner_id, availability_id::text AS availability_id,
                start_datetime, end_datetime, capacity
           FROM availability
          WHERE tenant_id = $1::uuid
            AND status = 'active'
            AND end_datetime >= now()
            AND ( (owner_type = 'service_offering'  AND owner_id = ANY($2::uuid[]))
               OR (owner_type = 'rentable_resource' AND owner_id = ANY($3::uuid[])) )
          ORDER BY start_datetime ASC`,
        [tenantId, serviceRows.map((r) => r.offer_id), rentableRows.map((r) => r.offer_id)]
      );
      for (const w of rows) {
        const list = windowsByOwner.get(w.owner_id) ?? [];
        if (list.length >= WINDOWS_PER_OFFER_LIMIT) continue;
        list.push({
          availabilityId: w.availability_id,
          startAt: new Date(w.start_datetime).toISOString(),
          endAt: new Date(w.end_datetime).toISOString(),
          capacity: w.capacity,
        });
        windowsByOwner.set(w.owner_id, list);
      }
    }

    return {
      providerActorId,
      displayName: actorRows[0].display_name,
      offers: ofertas.map((o) => ({ ...o, windows: windowsByOwner.get(o.offerId) ?? [] })),
    };
  }
}

/** Projeção comum das duas origens — o que muda entre elas é a query, não a forma de saída. */
function toOffer(r: {
  offer_id: string; label: string | null; price_cents: string | number | null;
  price_unit: string | null; concept_id: string | null;
}): Omit<ProviderOffer, 'sourceKind' | 'windows'> {
  return {
    offerId: r.offer_id,
    label: r.label,
    priceCents: r.price_cents === null ? null : Number(r.price_cents),
    priceUnit: r.price_unit,
    conceptId: r.concept_id,
  };
}

export const eventNeedSupplierDiscoveryService = new EventNeedSupplierDiscoveryService();
