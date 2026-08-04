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

class EventNeedSupplierDiscoveryService {
  /**
   * Necessidades do evento (as DECLARADAS pelo organizador, senão as SUGERIDAS pelo formato) já
   * com os fornecedores reais de cada uma.
   *
   * `onlyDeclared=true`  → só o que o organizador declarou (a lista de compras dele).
   * `onlyDeclared=false` → o template inteiro do formato, marcando o que já foi declarado
   *                        (`declaredStatus`), para ele descobrir o que ainda nem considerou.
   *
   * READ-ONLY e Δbank=0: não cria need, não abre RFQ, não reserva, não move dinheiro.
   */
  async listNeedsWithSuppliers(
    tenantId: string,
    eventId: string,
    opts: { onlyDeclared?: boolean } = {}
  ): Promise<NeedWithSuppliers[]> {
    const onlyDeclared = opts.onlyDeclared === true;

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
              ORDER BY so.price_cents ASC NULLS LAST, so.created_at ASC`,
            [serviceNeedIds, tenantId]
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
              ORDER BY rr.price_cents ASC NULLS LAST, rr.created_at ASC`,
            [rentableNeedIds, tenantId]
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
}

export const eventNeedSupplierDiscoveryService = new EventNeedSupplierDiscoveryService();
