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
//     nunca aba hardcoded por vertical (§2.2b).

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
}

export interface ActorPageAction {
  key: 'connect' | 'message' | 'schedule' | 'buy' | 'contract' | 'edit_profile' | 'create_service' | 'manage_rentals';
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
  key: 'all' | 'about' | 'posts' | 'products' | 'services' | 'rentals' | 'agenda' | 'schedule_events';
  label: string;
}

export interface ActorPageBlock {
  type: string;
  /** em que aba o bloco vive */
  tab: ActorPageTab['key'];
  /** rota REAL do fluxo vivo, ou null quando o conteúdo é renderizado in-page */
  deeplink: string | null;
  /** dados leves (contagens) — o conteúdo rico dos blocos é a Fatia 4 */
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
