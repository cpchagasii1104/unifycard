// backend/src/core/governance/governed-vocabularies.manifest.ts
// F-GOVERNED-VOCABULARY-MANIFEST — o REGISTRO DESCOBRÍVEL dos vocabulários GOVERNADOS centrais do sistema.
//
// 🔴 POR QUE ISTO EXISTE: nesta frente a mesma classe de violação apareceu 2× (C1 inventou chaves de intent
// paralelas ao enum ActorIntent; R2 usou relationship_type sem registrá-lo no cânone). A causa-raiz foi:
// o vocabulário governado NÃO ERA DESCOBRÍVEL, então superfície nova enumerou por conta própria. Este
// manifesto é a fonte de descoberta: "procure o vocabulário governado PRIMEIRO" (00_AGENT_PROTOCOL / lei
// normativa do dividatecnica.md) começa aqui. O guard `audit-governed-vocabulary-manifest.mjs` (1) prova que
// cada entrada bate com o vocabulário VIVO (anti-drift — o manifesto não mente) e (2) morde se os mesmos
// valores forem COPIADOS noutro arquivo (anti-paralelo — o smell do C1/R2).
//
// ⚠️ NÃO é lista exaustiva de todo enum/CHECK (há ~199 CHECKs + ~34 enums). É a curadoria dos vocabulários
// SSOT centrais (identidade/autoridade/intent/social) — os que, se duplicados, quebram a Lei de Coerência.
// Adicionar um vocabulário governado novo = registrar aqui. Mudar valores = mudar na FONTE canônica + aqui.

export type VocabularySourceKind = 'ts-enum' | 'ts-const-array' | 'sql-check';

export interface GovernedVocabulary {
  /** nome canônico do vocabulário. */
  name: string;
  /** pilar (18_DOMAIN_ONTOLOGY / SSOT_REGISTRY): identity | authority | intent | social | temporal | money. */
  pillar: 'identity' | 'authority' | 'intent' | 'social' | 'temporal' | 'money';
  /** caminho relativo a backend/ da FONTE canônica (onde o vocabulário é definido). */
  sourceFile: string;
  /** como o vocabulário é definido na fonte. */
  sourceKind: VocabularySourceKind;
  /** símbolo (enum/const) OU coluna (para sql-check) que porta os valores. */
  symbol: string;
  /** os valores canônicos (o guard confirma que aparecem na fonte — anti-drift). */
  values: string[];
  /** referência normativa (docs/01_normative ou docs/02_decisions) + nota. */
  canonRef: string;
}

export const GOVERNED_VOCABULARIES: GovernedVocabulary[] = [
  {
    name: 'ActorIntent',
    pillar: 'intent',
    sourceFile: 'src/modules/social/actor-intents.types.ts',
    sourceKind: 'ts-enum',
    symbol: 'ActorIntent',
    values: ['SHARE_CONTENT', 'ANNOUNCE_EVENT', 'OFFER_SERVICE', 'OFFER_PRODUCT', 'REQUEST_BOOKING', 'CREATE_PROJECT', 'ANNOUNCE_JOB', 'START_VOTE', 'REQUEST_HELP', 'SEND_CTA', 'RECEIVE_PAYMENT'],
    canonRef: 'INTENTS_ACTOR_CONTRATO.md (LAYER-4 INTENT, ontologia 18). SSOT dos atos criáveis; UI/módulo NÃO decide intent. O compositor PROJETA daqui (C1).',
  },
  {
    name: 'ActorCapability',
    pillar: 'authority',
    sourceFile: 'src/modules/social/actor-capabilities.types.ts',
    sourceKind: 'ts-enum',
    symbol: 'ActorCapability',
    values: ['POST_CONTENT', 'COMMENT', 'VOTE', 'CREATE_PROJECT', 'CREATE_JOB', 'APPLY_JOB', 'RECEIVE_FUNDS', 'SEND_FUNDS', 'MANAGE_MEMBERS', 'MANAGE_CONTENT', 'CREATE_EVENT', 'HOST_EVENT', 'CREATE_CTA'],
    canonRef: 'INTENTS_ACTOR_CONTRATO.md (INTENT_CAPABILITY_MAP). O que um actor PODE; validateIntent decide.',
  },
  {
    name: 'delegation.relationship_type',
    pillar: 'authority',
    sourceFile: 'src/core/actor-delegation/actor-delegation.repository.ts',
    sourceKind: 'ts-const-array',
    symbol: 'DELEGATION_RELATIONSHIP_TYPES',
    values: ['partner', 'director', 'administrator', 'attorney', 'legal_representative', 'employee', 'contractor'],
    canonRef: 'DECISION-0160 (proposta) + CHECK chk_actor_delegations_relationship_type. Vínculo JURÍDICO PJ (§5.16 §4.9.9). Eixo ORTOGONAL a company_users.role (cargo operacional).',
  },
  {
    name: 'company_users.role',
    pillar: 'authority',
    sourceFile: 'migrations/20260530541000_company_users_membership_expansion.sql',
    sourceKind: 'sql-check',
    symbol: 'role',
    values: ['owner', 'admin', 'staff', 'contractor', 'member'],
    canonRef: '20260606_PJ_COMPANY_USER_ROLE_VOCABULARY. Cargo OPERACIONAL (deriva can_manage_*). Eixo ORTOGONAL ao vínculo jurídico (relationship_type).',
  },
  {
    name: 'posts.visibility',
    pillar: 'social',
    sourceFile: 'migrations/20260705120000_posts_visibility_governed.sql',
    sourceKind: 'sql-check',
    symbol: 'visibility',
    values: ['public', 'connections', 'only_me'],
    canonRef: 'DESENHO_PAGINA_DO_ACTOR §2.4c (Fatia 5). Plateia de leitura; connections lê actor_relationships.',
  },
  {
    name: 'actor_relationships.feed_priority',
    pillar: 'social',
    sourceFile: 'src/modules/relationships/actor-relationship.types.ts',
    sourceKind: 'ts-const-array',
    symbol: 'FEED_PRIORITIES',
    values: ['padrao', 'ver_primeiro', 'ver_mais', 'ver_menos'],
    canonRef: 'Ideia Clayton 2026-07-07 + CHECKs chk_actor_relationships_{requester,target}_feed_priority (20260707020000). Frequência de feed POR CONEXÃO, dual-ótica (cada lado a sua); efeito material no motor de relevância do feed (camada EXPLÍCITA; camada aprendida por engajamento = fatia futura).',
  },
  {
    name: 'groups.purpose',
    pillar: 'social',
    sourceFile: 'src/modules/groups/group-purpose.vocabulary.ts',
    sourceKind: 'ts-const-array',
    symbol: 'GROUP_PURPOSES',
    values: ['cuidado_e_impacto', 'comunidade_e_pertencimento', 'fe_e_espiritualidade', 'interesse_e_hobby', 'aprendizado', 'ajuda_mutua_e_cooperacao', 'encontros_e_relacionamentos'],
    canonRef: 'DECISION-0163 (ratificada 2026-07-07) + CHECK chk_groups_purpose (20260707050000). PROPÓSITO do grupo — eixo ortogonal à categoria/TREE; faceta primária de descoberta; do GRUPO, nunca inferência sobre membros (0071).',
  },
  {
    name: 'service_demands.vinculo',
    pillar: 'social',
    sourceFile: 'src/modules/demands/demand.types.ts',
    sourceKind: 'ts-const-array',
    symbol: 'DEMAND_VINCULOS',
    values: ['diaria', 'periodo', 'recorrente', 'efetivo'],
    canonRef: 'DECISION-0164 D2 + CHECK chk_service_demands_vinculo. Vínculo da demanda (Clayton: wizard se molda ao vínculo).',
  },
  {
    name: 'service_demands.acceptance_mode',
    pillar: 'social',
    sourceFile: 'src/modules/demands/demand.types.ts',
    sourceKind: 'ts-const-array',
    symbol: 'DEMAND_ACCEPTANCE_MODES',
    values: ['automatico', 'com_analise'],
    canonRef: 'DECISION-0164 D2 (adendo 2 do pack): automatico=aceite fecha (Uber-like) · com_analise=candidatura+escolha do emissor.',
  },
  {
    name: 'service_demands.pricing_mode',
    pillar: 'social',
    sourceFile: 'src/modules/demands/demand.types.ts',
    sourceKind: 'ts-const-array',
    symbol: 'DEMAND_PRICING_MODES',
    values: ['preco_ofertado', 'orcamento'],
    canonRef: 'DECISION-0164 D2 (adendo 6): preço fixado pelo emissor (reprecificável por ATO dele) vs orçamento (RFQ). Registro apenas; mover dinheiro = PORTA-1.',
  },
  {
    name: 'events.access_type',
    pillar: 'social',
    sourceFile: 'src/core/events/event.types.ts',
    sourceKind: 'ts-const-array',
    symbol: 'EVENT_ACCESS_TYPES',
    values: ['gratuito', 'pago', 'contribuicao_opcional'],
    canonRef: 'F-EVENT-ACCESS-CAPACITY (Clayton 2026-07-08) + CHECK chk_events_access_type. Acesso/custo do evento (aposenta "Tom do Evento"). ANÚNCIO apenas — mover dinheiro/estorno = PORTA-1/Bank. "a combinar" FORA do MVP.',
  },
  {
    name: 'events.need_fulfillment_kind',
    pillar: 'social',
    sourceFile: 'src/core/events/event.types.ts',
    sourceKind: 'ts-const-array',
    symbol: 'EVENT_NEED_FULFILLMENT_KINDS',
    values: ['service'],
    canonRef: 'F-EVENT-ORCHESTRATION-PHASE-B (Clayton 2026-07-08) + CHECK chk_event_orch_template_fulfillment / chk_event_op_needs_fulfillment. Como a necessidade operacional de evento é cumprida. v1 só "service" (FK composta a concept_offer_kinds valida materialmente offer_kind=service). Extensão futura rentable/product por decisão. NÃO literal solto.',
  },
  {
    name: 'events.category',
    pillar: 'social',
    sourceFile: 'src/core/events/event.types.ts',
    sourceKind: 'ts-const-array',
    symbol: 'EVENT_CATEGORIES',
    values: ['social', 'cultural', 'gastronomico', 'esportivo', 'profissional', 'comunitario', 'espiritual', 'educacional', 'comercial_institucional'],
    canonRef: 'F-EVENT-CONCEPT-FIRST-MODEL (Clayton 2026-07-08) + CHECK chk_event_category_facet. Facet de DESCOBERTA (múltipla), NÃO pai do tipo — identidade é CONCEPT (formato+tema). Não é N1/N2.',
  },
  {
    name: 'events.location_mode',
    pillar: 'social',
    sourceFile: 'src/core/events/event.types.ts',
    sourceKind: 'ts-const-array',
    symbol: 'EVENT_LOCATION_MODES',
    values: ['fixed_place', 'online', 'hybrid', 'to_be_defined', 'route'],
    canonRef: 'F-EVENT-CONCEPT-FIRST-MODEL + CHECK chk_events_location_mode. "route" (viagem/trilha/marcha) é valor governado PLANEJADO mas DISABLED no MVP (ver EVENT_LOCATION_MODES_MVP_ENABLED).',
  },
  {
    name: 'MarketplaceDomain',
    pillar: 'social',
    sourceFile: '../packages/contracts/src/vocabulary.ts',
    sourceKind: 'ts-const-array',
    symbol: 'MARKETPLACE_DOMAIN_VALUES',
    values: ['market', 'services', 'events', 'real_estate', 'vehicles', 'jobs'],
    canonRef: 'DECISION-0106. Rótulo de navegação/UX (NÃO SSOT — identidade é CONCEPT). Vocabulário compartilhado em @unificard/contracts (Reference vocabulary); FORK FECHADO — backend (core/marketplace-domain, que também porta o MAPA D1-D6→N0) e frontend (companies.ts/marketplace-categories.ts) re-exportam do MESMO símbolo.',
  },
  {
    name: 'actor_delegation_events.event_type',
    pillar: 'authority',
    sourceFile: 'migrations/20260706120000_r2_delegation_governed_links_and_audit.sql',
    sourceKind: 'sql-check',
    symbol: 'event_type',
    values: ['granted', 'revoked', 'expired'],
    canonRef: 'DECISION D3 (Lote L2). Trilha append-only de delegação (§4.9.9 audit).',
  },
  {
    name: 'rentable_resources.pricing_unit',
    pillar: 'temporal',
    sourceFile: 'src/modules/rentals/rentable-resource.types.ts',
    sourceKind: 'ts-const-array',
    symbol: 'RENTAL_PRICING_UNITS',
    values: ['por_hora', 'por_dia', 'por_semana', 'por_mes'],
    canonRef: 'DECISION-0151 ADENDO A (2026-07-07): unidade de cobrança do ANÚNCIO de locação. Preço = registro (Δbank=0); execução = PORTA-1.',
  },
  {
    name: 'concept_offer_kinds.offer_kind',
    pillar: 'temporal',
    sourceFile: 'src/core/catalog/vehicle-catalog.service.ts',
    sourceKind: 'ts-const-array',
    symbol: 'CONCEPT_OFFER_KINDS',
    values: ['rentable', 'service'],
    canonRef: 'Fix 2ª IA (2026-07-07): dimensão de APLICABILIDADE — "este concept pode ser ofertado de que modo?". "service" (F-OFFER-KIND-SERVICE-GATE 2026-07-08): gate governado — picker de criação de serviço/capability profissional/demanda SÓ enxerga concept com offer_kind=service (conteve contaminação: assunto/tema/formato de evento não é serviço por existir no CONCEPT). "rentable"=locação. CHECK chk_concept_offer_kind_value compõe daqui.',
  },
  {
    name: 'actor_asset_modes.activation_mode',
    pillar: 'temporal',
    sourceFile: 'src/core/assets/asset.types.ts',
    sourceKind: 'ts-const-array',
    symbol: 'ASSET_ACTIVATION_MODES',
    values: ['sale', 'rental', 'service_use'],
    canonRef: 'F-ASSET-MULTI-OFFER-FOUNDATION Fatia 1 (Clayton 2026-07-08) + CHECK chk_actor_asset_mode_value. MODO de ativação econômica/operacional de um item real do actor (actor_assets). MODO≠ESTADO: internal/maintenance/reserved NÃO são modos (ausência de modo=interno; manutenção/reserva=disponibilidade). service_use=item ACOPLADO a serviço/prestador (vínculo governado, fatia própria), não oferta solta. Ver RFC_ASSET_MULTI_OFFER_FOUNDATION.',
  },
];
