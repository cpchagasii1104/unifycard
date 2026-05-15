// frontend/src/config/actorContextConfig.ts
// Diretriz Clayton 2026-05-15: actor é modo operacional do sistema.
// Mesma base estrutural + comportamento contextual dinâmico.
//
// Esta config NÃO duplica appsRegistry — ela compõe sobre ele, declarando:
//   - QUICK_ACTIONS_CATALOG: catálogo central de ações rápidas
//   - DASHBOARD_CARDS_CATALOG: cards de visão geral por id
//   - getActorContextProfile(context): retorna o perfil operacional do actor
//
// Mantém referência limitada ao que existe materialmente hoje (user, page, group,
// channel). Especializações futuras (band, restaurant, lawyer) virão como
// subtype dentro de actor_type quando a hierarquia ontológica N0/N1/N2 amadurecer.

import type { AppContext } from './appsRegistry';

// ============================================================
// CATÁLOGO: Quick Actions (todas as ações disponíveis no sistema)
// ============================================================

export interface QuickActionDefinition {
  id: string;
  label: string;
  icon: string;
  route: string;
  color: string;
}

export const QUICK_ACTIONS_CATALOG: Record<string, QuickActionDefinition> = {
  // Social / PF
  'rede-social': { id: 'rede-social', label: 'Rede Social', icon: '💬', route: '/social', color: '#10b981' },
  'meus-grupos': { id: 'meus-grupos', label: 'Meus Grupos', icon: '👥', route: '/grupos', color: '#8b5cf6' },
  'eventos': { id: 'eventos', label: 'Eventos', icon: '🎭', route: '/eventos', color: '#ec4899' },
  'comunidades': { id: 'comunidades', label: 'Comunidades', icon: '🌐', route: '/grupos', color: '#06b6d4' },

  // Mobilidade / serviços PF
  'pedir-carro': { id: 'pedir-carro', label: 'Pedir um Carro', icon: '🚗', route: '/em-desenvolvimento?feature=mobility', color: '#f59e0b' },
  'pedir-comida': { id: 'pedir-comida', label: 'Pedir Comida', icon: '🍕', route: '/em-desenvolvimento?feature=food', color: '#ef4444' },
  'marketplace': { id: 'marketplace', label: 'Marketplace', icon: '🛒', route: '/marketplace', color: '#06b6d4' },

  // Financeiro universal
  'transferir': { id: 'transferir', label: 'Transferir', icon: '↗️', route: '/banco', color: '#3b82f6' },
  'depositar': { id: 'depositar', label: 'Depósito', icon: '⬇️', route: '/banco', color: '#84cc16' },
  'sacar': { id: 'sacar', label: 'Sacar', icon: '⬆️', route: '/banco', color: '#ef4444' },
  'extrato': { id: 'extrato', label: 'Extrato', icon: '📄', route: '/extrato', color: '#3b82f6' },

  // PJ / empresa
  'vender': { id: 'vender', label: 'Vender', icon: '💰', route: '/marketplace', color: '#10b981' },
  'campanhas': { id: 'campanhas', label: 'Campanhas', icon: '📢', route: '/em-desenvolvimento?feature=campaigns', color: '#8b5cf6' },
  'pedidos': { id: 'pedidos', label: 'Pedidos', icon: '📦', route: '/em-desenvolvimento?feature=orders', color: '#f59e0b' },
  'crm': { id: 'crm', label: 'Clientes', icon: '👤', route: '/em-desenvolvimento?feature=crm', color: '#ec4899' },
  'contratar': { id: 'contratar', label: 'Contratar', icon: '🤝', route: '/em-desenvolvimento?feature=contract', color: '#06b6d4' },

  // Grupo / governança
  'membros': { id: 'membros', label: 'Membros', icon: '👥', route: '/grupos', color: '#8b5cf6' },
  'votacoes': { id: 'votacoes', label: 'Votações', icon: '🗳️', route: '/votacoes', color: '#3b82f6' },
  'contribuir': { id: 'contribuir', label: 'Contribuir', icon: '💚', route: '/em-desenvolvimento?feature=group-contribution', color: '#10b981' },
  'impacto': { id: 'impacto', label: 'Impacto', icon: '💚', route: '/impacto', color: '#10b981' },

  // Canal / publicação
  'publicar': { id: 'publicar', label: 'Publicar', icon: '✏️', route: '/social', color: '#8b5cf6' },
};

// ============================================================
// CATÁLOGO: Dashboard Cards (visão geral)
// ============================================================

export type DashboardCardId =
  | 'fundo-regional'
  | 'meu-saldo'
  | 'caixa-empresa'
  | 'caixa-grupo'
  | 'em-processamento'
  | 'limite-disponivel'
  | 'movimentacoes-mes'
  | 'indicacoes';

// ============================================================
// CATÁLOGO: Sidebar Priority (quais items destacar no menu lateral)
// ============================================================

/**
 * IDs de rota da sidebar global que recebem destaque (badge "prioritário")
 * conforme o actor ativo. NÃO esconde itens — apenas marca prioridade visual.
 */
export type SidebarPriorityId = string;

// ============================================================
// PROFILE: configuração contextual por actor
// ============================================================

export interface ActorContextProfile {
  context: AppContext;
  modeName: string;
  /** Quick actions na ordem de prioridade (até 8 renderizadas). */
  quickActions: string[];
  /** Cards de visão geral mostrados (na ordem). */
  dashboardCards: DashboardCardId[];
  /** Rotas da sidebar que recebem destaque visual. */
  sidebarPriorities: SidebarPriorityId[];
  /** CTA de criação primário sugerido (botão FAB / banner). null = nenhum. */
  primaryCreateCta: { label: string; route: string } | null;
  /** Texto opcional para banner contextual do dashboard. */
  contextualBanner?: {
    title: string;
    subtitle: string;
    route?: string;
  };
}

const PROFILE_PF: ActorContextProfile = {
  context: 'pf',
  modeName: 'Pessoa Física',
  quickActions: [
    'rede-social',
    'meus-grupos',
    'pedir-comida',
    'pedir-carro',
    'eventos',
    'marketplace',
    'transferir',
    'extrato',
  ],
  dashboardCards: ['fundo-regional', 'meu-saldo', 'em-processamento', 'limite-disponivel'],
  sidebarPriorities: ['/social', '/grupos', '/marketplace', '/em-desenvolvimento?feature=mobility', '/em-desenvolvimento?feature=food'],
  primaryCreateCta: { label: 'Criar evento', route: '/events/new' },
};

const PROFILE_PJ: ActorContextProfile = {
  context: 'pj',
  modeName: 'Empresa',
  quickActions: ['vender', 'campanhas', 'pedidos', 'crm', 'contratar', 'marketplace', 'transferir', 'extrato'],
  dashboardCards: ['caixa-empresa', 'movimentacoes-mes', 'em-processamento', 'limite-disponivel'],
  sidebarPriorities: ['/marketplace', '/services', '/banco', '/extrato'],
  primaryCreateCta: { label: 'Criar campanha', route: '/em-desenvolvimento?feature=campaign' },
  contextualBanner: {
    title: 'Sua empresa no UnifiCard',
    subtitle: 'Venda, divulgue e coordene operações em um só lugar',
    route: '/marketplace',
  },
};

const PROFILE_GROUP: ActorContextProfile = {
  context: 'group',
  modeName: 'Grupo',
  quickActions: ['membros', 'votacoes', 'contribuir', 'campanhas', 'impacto', 'eventos', 'transferir', 'extrato'],
  dashboardCards: ['caixa-grupo', 'movimentacoes-mes', 'em-processamento'],
  sidebarPriorities: ['/grupos', '/votacoes', '/impacto', '/banco'],
  primaryCreateCta: { label: 'Criar votação', route: '/em-desenvolvimento?feature=group-vote' },
  contextualBanner: {
    title: 'Seu grupo coordenado',
    subtitle: 'Decisões coletivas, contribuições rastreáveis, impacto compartilhado',
    route: '/impacto',
  },
};

const PROFILE_CHANNEL: ActorContextProfile = {
  context: 'channel',
  modeName: 'Canal',
  quickActions: ['publicar', 'eventos', 'campanhas', 'marketplace', 'rede-social', 'transferir', 'extrato'],
  dashboardCards: ['meu-saldo', 'movimentacoes-mes', 'em-processamento'],
  sidebarPriorities: ['/social', '/eventos', '/marketplace'],
  primaryCreateCta: { label: 'Publicar conteúdo', route: '/social' },
};

const PROFILES_BY_CONTEXT: Record<AppContext, ActorContextProfile> = {
  pf: PROFILE_PF,
  pj: PROFILE_PJ,
  group: PROFILE_GROUP,
  channel: PROFILE_CHANNEL,
};

/**
 * Retorna o perfil operacional contextual conforme o AppContext.
 * Default: PF (fallback seguro).
 */
export function getActorContextProfile(context: AppContext | null | undefined): ActorContextProfile {
  if (!context) return PROFILE_PF;
  return PROFILES_BY_CONTEXT[context] ?? PROFILE_PF;
}

/**
 * Resolve quick actions definitions a partir do perfil contextual.
 * Filtra IDs inválidos (defensivo).
 */
export function resolveQuickActions(profile: ActorContextProfile, limit = 8): QuickActionDefinition[] {
  return profile.quickActions
    .map((id) => QUICK_ACTIONS_CATALOG[id])
    .filter((q): q is QuickActionDefinition => !!q)
    .slice(0, limit);
}
