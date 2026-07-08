// backend/src/core/social/feed-lenses.ts
// F-SOCIAL-FEED-LENSES (GO Clayton 2026-07-08, modelo HÍBRIDO). Catálogo GOVERNADO das lentes do feed —
// FONTE ÚNICA (o frontend NUNCA enumera lentes, só projeta o que este contrato devolver). Três planos
// distintos, não misturar: Audience (quem vê) ≠ Composer (que ato) ≠ Feed Lens (o que quero acompanhar).
//
// behavior:
//   filter_feed → a lente só filtra o feed por tipo (feedQuery).
//   navigate    → a lente é atalho para a superfície dedicada (targetRoute); sem conteúdo no feed ainda.
//   hybrid      → filtra o feed E oferece CTA para a página dedicada (o correto quando a página existe).
//
// enabled/reasonDisabled derivam da LIVENESS de SSOT auditada (2026-07-08): projetos/votações existem só
// como post.intent, SEM entidade própria → disabled (não habilitar só por causa do intent). Artistas/
// pautas/comunidades: fora (sem SSOT/superfície). targetRoute só aponta para rota VIVA (verificada no App).

export type FeedLensBehavior = 'filter_feed' | 'navigate' | 'hybrid';
export type OperatingMode = 'consumir' | 'operar';

export interface FeedLens {
  key: string;
  label: string;
  icon: string;
  enabled: boolean;
  reasonDisabled: string | null;
  behavior: FeedLensBehavior;
  /** Tipo do feed a filtrar (mapeado no getFeed para post.intent/entidade). null = navigate puro. */
  feedQuery: string | null;
  /** Rota da superfície dedicada (só rota VIVA). null = sem página dedicada (filter_feed puro). */
  targetRoute: string | null;
  /** Rótulo do CTA para a página dedicada (quando hybrid/navigate). */
  primaryAction: string | null;
  /** Modos em que a lente é padrão/destaque (o contrato já permite a diferença consumir×operar). */
  defaultForMode: OperatingMode[];
  order: number;
}

// Catálogo MVP (Clayton). Ordem = ordem de exibição. 'all' é o default do feed.
const CATALOG: FeedLens[] = [
  { key: 'all', label: 'Tudo', icon: '🌐', enabled: true, reasonDisabled: null, behavior: 'filter_feed', feedQuery: 'all', targetRoute: null, primaryAction: null, defaultForMode: ['consumir', 'operar'], order: 0 },
  { key: 'posts', label: 'Publicações', icon: '📝', enabled: true, reasonDisabled: null, behavior: 'filter_feed', feedQuery: 'posts', targetRoute: null, primaryAction: null, defaultForMode: ['consumir', 'operar'], order: 1 },
  { key: 'events', label: 'Eventos', icon: '🎪', enabled: true, reasonDisabled: null, behavior: 'hybrid', feedQuery: 'events', targetRoute: '/eventos', primaryAction: 'Ver todos os eventos', defaultForMode: ['consumir', 'operar'], order: 2 },
  { key: 'services', label: 'Serviços', icon: '🛠️', enabled: true, reasonDisabled: null, behavior: 'hybrid', feedQuery: 'services', targetRoute: '/servicos', primaryAction: 'Ver serviços', defaultForMode: ['consumir', 'operar'], order: 3 },
  // Produtos: sem rota dedicada viva → filter_feed puro (post.intent product_offer).
  { key: 'products', label: 'Produtos', icon: '📦', enabled: true, reasonDisabled: null, behavior: 'filter_feed', feedQuery: 'products', targetRoute: null, primaryAction: null, defaultForMode: ['consumir', 'operar'], order: 4 },
  { key: 'rentals', label: 'Locações', icon: '🔑', enabled: true, reasonDisabled: null, behavior: 'hybrid', feedQuery: 'rentals', targetRoute: '/locacoes', primaryAction: 'Ir para Locações', defaultForMode: ['consumir', 'operar'], order: 5 },
  { key: 'opportunities', label: 'Oportunidades', icon: '🎯', enabled: true, reasonDisabled: null, behavior: 'hybrid', feedQuery: 'opportunities', targetRoute: '/oportunidades', primaryAction: 'Ver oportunidades', defaultForMode: ['consumir', 'operar'], order: 6 },
  // Grupos: SSOT vivo + página, mas SEM integração no feed ainda → navigate puro (vira hybrid quando integrar).
  { key: 'groups', label: 'Grupos', icon: '👥', enabled: true, reasonDisabled: null, behavior: 'navigate', feedQuery: null, targetRoute: '/grupos', primaryAction: 'Ir para Grupos', defaultForMode: ['consumir', 'operar'], order: 7 },
  // Projetos/Votações: só existem como post.intent, SEM entidade/SSOT próprio → disabled (não habilitar só pelo intent).
  { key: 'projects', label: 'Projetos', icon: '📁', enabled: false, reasonDisabled: 'Sem SSOT de entidade próprio ainda', behavior: 'filter_feed', feedQuery: 'projects', targetRoute: null, primaryAction: null, defaultForMode: ['consumir', 'operar'], order: 8 },
  { key: 'votes', label: 'Votações', icon: '🗳️', enabled: false, reasonDisabled: 'Sem SSOT de entidade próprio ainda', behavior: 'filter_feed', feedQuery: 'votes', targetRoute: null, primaryAction: null, defaultForMode: ['consumir', 'operar'], order: 9 },
];

/**
 * Lentes disponíveis para o actor/modo. MVP: catálogo estável (o contrato já carrega defaultForMode para
 * a diferença consumir×operar; a lista efetiva por modo evolui sem quebrar o front). actorType reservado
 * para futura modulação (ex.: PJ ver "minhas demandas" em operar). Nunca devolve lente sem SSOT vivo.
 */
export function buildFeedLenses(_actorType: string, _mode: OperatingMode): FeedLens[] {
  return CATALOG.map((l) => ({ ...l }));
}
