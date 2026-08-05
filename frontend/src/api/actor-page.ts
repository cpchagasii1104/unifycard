// src/api/actor-page.ts
// F-ACTOR-PAGE-SHELL-SLICE-3 — client do contrato server-driven da página do actor.
// O backend DESCREVE a página (header/actions/tabs/blocks); o cliente só renderiza.
// Frontend nunca decide quais abas acendem nem habilita ação gated (frontend não cria verdade).

import { apiFetchJson } from './client';

export type ActorPageMode = 'consuming' | 'operating';

export interface ActorPageHeader {
  actorId: string;
  displayName: string;
  actorType: string;
  slug: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  headline: string | null;
  /** F-ACTOR-PAGE-SHELL-SLICE-4: resumo de localização — só cidade/estado/bairro (anti-PII). */
  location: { cityName: string | null; stateCode: string | null; neighborhoodName: string | null } | null;
}

export interface ActorPageAction {
  key: string;
  label: string;
  enabled: boolean;
  gatedBy?: string;
  deeplink: string | null;
  data?: { allowedLabels?: string[] } & Record<string, unknown>;
}

export interface ActorPageTab {
  key: string;
  label: string;
}

/** F-ACTOR-PAGE-SHELL-SLICE-4: item leve do bloco Serviços (projeção pública, sem PII). */
export interface ActorPageServiceItem {
  serviceId: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  priceCents: number | null;
  currency: string;
  pricingType: string;
}

/** Item leve do bloco Produtos. */
/**
 * Item de LOCAÇÃO. `origem` diz de qual substrato veio — enquanto a convergência asset-first não
 * termina, é o que informa qual caminho de contratação existe ('legacy' ainda não tem reserva).
 */
export interface ActorPageRentalItem {
  id: string;
  label: string | null;
  priceCents: number | null;
  pricingUnit: string | null;
  /** Sempre 'asset': a locação viva é asset-first e o guard asset-rental-convergence garante. */
  origem: 'asset';
  /**
   * 🔴 DÁ PARA PEDIR ESTE ITEM? Resolvido no servidor pela MESMA autoridade que o diálogo de
   * orçamento obedece (getProviderShowcase) — a tela só projeta.
   *
   * `null` = o servidor não soube dizer (item ausente da vitrine). NÃO é `false`: `false`
   * afirmaria "não dá", que é conclusão que ninguém mediu. Ver "zero é afirmação; desconhecido
   * é a verdade" — a tela trata `null` como indefinido, nunca como negativa.
   */
  requestable: boolean | null;
  /** Por que não dá. `null` quando dá, ou quando não se sabe. Vocabulário fechado do servidor. */
  requestableReason: 'no_schedule' | null;
}

export interface ActorPageProductItem {
  offerId: string;
  name: string;
  brand: string | null;
  priceCents: number;
  availableQuantity: number;
  imageUrl: string | null;
}

/** Janela leve do bloco Agenda. */
export interface ActorPageAgendaItem {
  availabilityId: string;
  startDatetime: string;
  endDatetime: string;
  timezone: string;
  capacity: number | null;
  purposeSlug: string | null;
}

/** F-ERP-COMPOSED-VIEW (Fatia 8): pedido de compra leve do bloco ERP. */
export interface ActorPagePurchaseOrderItem {
  id: string;
  supplierId: string;
  status: string;
  orderDate: string;
}

export interface ActorPageBlock {
  type: string;
  tab: string;
  deeplink: string | null;
  data: {
    count?: number;
    bio?: string | null;
    headline?: string | null;
    items?: ActorPageServiceItem[] | ActorPageProductItem[] | ActorPageAgendaItem[] | ActorPageRentalItem[];
    cityName?: string | null;
    stateCode?: string | null;
    neighborhoodName?: string | null;
  } & Record<string, unknown>;
}

export interface ActorPageContract {
  actorId: string;
  mode: ActorPageMode;
  header: ActorPageHeader;
  actions: ActorPageAction[];
  tabs: ActorPageTab[];
  blocks: ActorPageBlock[];
}

export async function getActorPage(actorId: string, mode: ActorPageMode = 'consuming'): Promise<ActorPageContract> {
  const res = await apiFetchJson<{ ok: boolean; data: ActorPageContract }>(
    `/actor-page/${actorId}?mode=${mode}`
  );
  return res.data;
}
