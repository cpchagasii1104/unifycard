// backend/src/modules/actor-page/actor-page.types.ts
// F-ACTOR-PAGE-SHELL-SLICE-3 — o CONTRATO server-driven da página do actor
// (DESENHO_PAGINA_DO_ACTOR.md §2.4 SELADO: "a página é descrita pelo backend, renderizada pelo
// cliente — web e app consomem o MESMO contrato; nenhum cliente decide quais abas acendem").
//
// FRONTEIRAS (invioláveis):
//   · READ-MODEL puro — este módulo NUNCA escreve nada (projeção de pilares vivos);
//   · anti-PII — o contrato nunca carrega CPF/kyc/global_user_id/documentos/dinheiro;
//   · Comprar/Contratar RENDERIZAM mas nascem gated: enabled:false, gatedBy:'PORTA-1' (§6);
//   · quais blocos acendem = derivado do que o actor PUBLICOU (probes no substrato vivo),
//     nunca aba hardcoded por vertical (§2.2b);
//   · F-ERP-COMPOSED-VIEW (Fatia 8) + F-ERP-TWO-SIDED: o bloco 'erp' (empresa = page+company_id)
//     tem DUAS caras discriminadas por `data.side` — 'sales' em mode=operating (estoque+pedidos+
//     agenda) e 'supply' em mode=consuming atuando-como-a-empresa (pedidos de compra).
//     Em AMBAS as caras o pilar FINANCEIRO é só deeplink ('/wallet') — NUNCA valor monetário
//     embutido no contrato (mantém a fronteira anti-dinheiro literal desta linha). Modo escolhe a
//     cara; permissão (canRepresentActor, na rota) decide o acesso — eixos ortogonais.

export type ActorPageMode = 'consuming' | 'operating';

export interface ActorPageHeader {
  actorId: string;
  displayName: string;
  actorType: string;
  slug: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  /** autodescrição do cartão público (metadata.card.headline), se publicada */
  headline: string | null;
  /** F-ACTOR-PAGE-SHELL-SLICE-4: resumo de localização (Location Core, DECISION-0020).
   *  Só cidade/estado/bairro — NUNCA rua/número/lat-lng na página pública (anti-PII/anti-exposição
   *  de endereço exato). null quando o actor não tem endereço operacional cadastrado. */
  location: { cityName: string | null; stateCode: string | null; neighborhoodName: string | null } | null;
}

export interface ActorPageAction {
  // 🔴 2026-08-04 — 'rent' e 'request_quote' entraram (Clayton: comprar · alugar · contratar ·
  // solicitar orçamento). Os TRÊS primeiros movem dinheiro e nascem gated por PORTA-1; o QUARTO
  // não move (Δbank medido 0 → 0) e por isso é o único que já pode acender antes da porta.
  key: 'connect' | 'message' | 'schedule' | 'buy' | 'rent' | 'contract' | 'request_quote' | 'edit_profile' | 'create_service' | 'manage_rentals' | 'support_ticket' | 'panel';
  label: string;
  enabled: boolean;
  /** por que está desabilitada (ex.: 'PORTA-1' dinheiro soberano; 'EM_BREVE' fluxo ainda não vivo) */
  gatedBy?: string;
  /** rota REAL do fluxo vivo (hub §2.3) — null quando a ação é in-page (ex.: connect abre diálogo) */
  deeplink: string | null;
  /** dados de apoio resolvidos server-side (ex.: connect.allowedLabels do vocabulário governado) */
  data?: Record<string, unknown>;
}

export interface ActorPageTab {
  key: 'all' | 'about' | 'posts' | 'products' | 'services' | 'rentals' | 'asset_sales' | 'agenda' | 'schedule_events' | 'location' | 'erp' | 'connections';
  label: string;
}

export interface ActorPageBlock {
  type: string;
  /** em que aba o bloco vive */
  tab: ActorPageTab['key'];
  /** rota REAL do fluxo vivo, ou null quando o conteúdo é renderizado in-page */
  deeplink: string | null;
  /**
   * F-ACTOR-PAGE-SHELL-SLICE-4 — dados do bloco. Sempre tem `count`. A partir da Fatia 4,
   * services/products/agenda também carregam `items` (projeção leve do pilar vivo — sempre
   * `servicesRepository`/`listVisibleProducts`/`unifiedAvailabilityService`, NUNCA SQL novo aqui):
   *   services  → items: { serviceId, name, shortDescription, priceCents, currency, pricingType, slug }[]
   *   products  → items: { offerId, name, brand, priceCents, availableQuantity, imageUrl }[]
   *   agenda    → items: { availabilityId, startDatetime, endDatetime, timezone, capacity, purposeSlug }[]
   *   location  → { cityName, stateCode, neighborhoodName } (sem rua/número/lat-lng — anti-PII)
   * "Aberto agora" NÃO existe (sem schema de horário de funcionamento) — nomeado, não construído.
   */
  data: Record<string, unknown>;
}

export interface ActorPageContract {
  actorId: string;
  mode: ActorPageMode;
  header: ActorPageHeader;
  actions: ActorPageAction[];
  tabs: ActorPageTab[];
  blocks: ActorPageBlock[];
}
